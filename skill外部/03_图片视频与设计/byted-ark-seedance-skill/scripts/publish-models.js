#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { SOURCE, BUILTIN, readTable, decodeRelease, validateRegistry, compatible, ensureContinuity, cli, hash } = require('./model-registry');

function select(value, name) {
  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== 'string') throw new Error(`${name} 必须有一个选项`);
  return value[0];
}
function compileRows(rows, revision, now = new Date().toISOString()) {
  const models = [];
  for (const row of rows) {
    if (!row.model_id && !row.status) continue;
    const modality = select(row.modality, 'modality');
    if (modality !== 'video') continue;
    const status = select(row.status, 'status');
    if (status === 'draft') continue;
    const model = { model_id: row.model_id, display_name: row.display_name, modality, status };
    for (const key of ['aliases', 'capabilities', 'limits', 'defaults', 'extra_parameters', 'extensions']) {
      const value = row[`${key}_json`];
      if (value !== undefined && value !== null && value !== '') model[key] = JSON.parse(value);
      else if (key === 'aliases') model[key] = [];
      else if (key === 'extra_parameters' || key === 'extensions') model[key] = {};
    }
    for (const key of ['adapter', 'min_runtime', 'priority', 'quality_priority', 'source_url', 'notes']) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') model[key] = row[key];
    }
    models.push(model);
  }
  // Sort for deterministic previews/digests; table row order must not affect routing.
  models.sort((a,b) => a.model_id.localeCompare(b.model_id));
  return validateRegistry({ schema_version: 1, revision, channel: 'seedance', published_at: now, models });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node scripts/publish-models.js [--publish] [--output <snapshot.json>]\n默认仅读取、校验并预览；--publish 原子更新已发布快照。不要并发发布。');
    return;
  }
  for (let i = 0; i < args.length; i++) {
    if (['--publish','--dry-run'].includes(args[i])) continue;
    if (args[i] === '--output' && args[i+1]) { i++; continue; }
    throw new Error(`未知参数 ${args[i]}`);
  }
  if (args.includes('--dry-run') && args.includes('--publish')) throw new Error('--dry-run 与 --publish 不能同时使用');
  const drafts = await readTable(SOURCE, 'models', 60000);
  const releases = await readTable(SOURCE, 'releases', 60000);
  const currentRows = releases.rows.filter(r => r.channel === 'seedance');
  if (currentRows.length > 1) throw new Error('存在多条 seedance 发布记录，请先由维护者修复');
  const before = currentRows.length ? decodeRelease(currentRows[0]) : BUILTIN;
  const next = compileRows(drafts.rows, before.revision + 1);
  ensureContinuity(before, next);
  const snapshot = JSON.stringify(next);
  const preview = { action: args.includes('--publish') ? 'publish' : 'preview', revision: next.revision,
    models: next.models.map(m => ({ model_id: m.model_id, status: m.status, executable: compatible(m), priority: m.priority })),
    changes: next.models.filter(m => JSON.stringify(before.models.find(x => x.model_id === m.model_id)) !== JSON.stringify(m)).map(m => m.model_id),
    sha256: hash(snapshot) };
  if (args.includes('--output')) fs.writeFileSync(args[args.indexOf('--output') + 1], JSON.stringify(next, null, 2) + '\n');
  if (!args.includes('--publish')) { console.log(JSON.stringify(preview, null, 2)); return; }
  // Recheck both tables immediately before writing; never publish a silently changing draft.
  const recheckDrafts = await readTable(SOURCE, 'models', 60000);
  const recheckReleases = await readTable(SOURCE, 'releases', 60000);
  if (hash(JSON.stringify(drafts.rows)) !== hash(JSON.stringify(recheckDrafts.rows)) ||
      hash(JSON.stringify(releases.rows)) !== hash(JSON.stringify(recheckReleases.rows))) throw new Error('发布前表格已被修改，请重新预览');
  const values = { channel:'seedance', revision:next.revision, schema_version:1, snapshot_json:snapshot,
    sha256:hash(snapshot), published_at:next.published_at, notes:'由 publish-models.js 校验发布；真实模型可用性需另行验证。' };
  const fields = Object.fromEntries(Object.entries(values).map(([key,value]) => [SOURCE.fields.releases[key], value]));
  const payload = currentRows.length ? { update_records: { [currentRows[0].record_id]:fields } } : { create_records:[fields] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'seedance-publish-'));
  try {
    fs.writeFileSync(path.join(dir,'payload.json'), JSON.stringify(payload), { mode:0o600 });
    const result = await cli(['base', currentRows.length ? '+record-batch-update' : '+record-batch-create',
      '--base-token', SOURCE.base_token, '--table-id', SOURCE.tables.releases, '--json','@payload.json','--as','user'], {cwd:dir,timeout:30000});
    if (!result.ok || result.data?.ignored_fields?.length) throw new Error('发布写入未完全成功');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  const verify = await readTable(SOURCE,'releases',60000);
  const matches = verify.rows.filter(r => r.channel === 'seedance');
  if (matches.length !== 1 || hash(JSON.stringify(decodeRelease(matches[0]))) !== hash(snapshot)) throw new Error('写入已提交但回读未确认；先检查发布表，勿盲目重发');
  console.log(JSON.stringify({...preview,verified:true,base_url:SOURCE.base_url},null,2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode=1; });
module.exports = { compileRows, ensureContinuity };
