#!/usr/bin/env node
'use strict';
// A local preflight for the host Agent. check/begin/fail never access the network.
const { runtime, SOURCE, readTable, decodeRelease, releaseDiagnostics } = require('./model-registry');
const { modes } = require('./registry-sync');
// Explicit diagnosis reads the publication once, without writing caches or scheduling state.
// Never print the cell text, credentials, or authentication diagnostics.
async function diagnosePublished(read = readTable) {
  const { rows, rev } = await read(SOURCE, 'releases');
  const matches = rows.filter(row => row.channel === SOURCE.channel);
  const result = { action: 'diagnose', source: 'lark-cli', channel: SOURCE.channel,
    table_revision: rev, matching_rows: matches.length, cache_updated: false };
  if (matches.length !== 1) return { ...result, success: false, error: '必须且只能存在一条目标频道发布记录' };
  const row = matches[0], diagnostic = releaseDiagnostics(row);
  result.release_revision = Number.isSafeInteger(row.revision) ? row.revision : null;
  try { decodeRelease(row); return { ...result, success: true, diagnostic }; }
  catch (e) { return { ...result, success: false, error: e.message, error_code: e.code, diagnostic }; }
}
async function main(argv) {
  const command = argv.shift() || 'check', options = {};
  const names = { '--model': 'requestedModel', '--event': 'event', '--lease': 'lease', '--reason': 'reason',
    '--force': 'force', '--offline': 'offline' };
  for (let i = 0; i < argv.length; i++) {
    const name = names[argv[i]];
    if (!name || Object.hasOwn(options, name)) throw new Error('参数未知或重复');
    if (['force', 'offline'].includes(name)) options[name] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--') || value.length > 2048) throw new Error('参数缺失或过长');
      options[name] = value;
    }
  }
  Object.assign(options, modes(options, SOURCE.channel));
  if (command === 'check') return (await runtime.inspect(options)).decision;
  if (command === 'begin') return runtime.begin(options);
  if (command === 'end') return runtime.end(options);
  if (command === 'fail') return runtime.fail(options);
  if (['refresh', 'diagnose'].includes(command) && options.offline) throw new Error(`${command} 与 offline 不能同时使用`);
  if (command === 'diagnose') {
    if (process.env[`ARK_${SOURCE.channel.toUpperCase()}_REGISTRY_FILE`]) throw new Error('当前使用本地文件源；diagnose 仅用于飞书已发布配置');
    return diagnosePublished();
  }
  if (command === 'refresh') {
    const metadata = (await runtime.load({ ...options, force: true })).metadata;
    return { ...metadata, success: metadata.refresh_attempted && ['remote', 'file'].includes(metadata.source) &&
      !metadata.refresh_error && !metadata.cache_warning && !metadata.state_warning };
  }
  throw new Error('用法：sync-models.js check|begin|fail|end|refresh|diagnose [--model ID] [--event KEY] [--force] [--offline]');
}
if (require.main === module) main(process.argv.slice(2)).then(r => {
  console.log(JSON.stringify(r));
  if (['refresh', 'diagnose'].includes(process.argv[2]) && !r.success) process.exitCode = 1;
}).catch(e => {
  console.error(JSON.stringify({ success: false, error: e.message, error_code: e.code })); process.exitCode = 1;
});
module.exports = { main, diagnosePublished };
