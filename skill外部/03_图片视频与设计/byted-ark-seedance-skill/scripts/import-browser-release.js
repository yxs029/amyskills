'use strict';

// Import text read by the host browser. This helper has no network or table-write operation.
const fs = require('node:fs');
const { SOURCE, decodeRelease, loadRegistry, hash, releaseDiagnostics } = require('./model-registry');
const MAX_BYTES = 2 * 1024 * 1024;

async function importBrowserRelease({ snapshotFile, sha256, revision, schemaVersion, cacheDir, now, lease, event, keepLease, stateDir }) {
  const override = `ARK_${SOURCE.channel.toUpperCase()}_REGISTRY_FILE`;
  if (process.env[override]) throw new Error(`${override} 已设置；本地覆盖源与网页缓存不能混用`);
  if (typeof snapshotFile !== 'string' || !snapshotFile || !/^[a-f0-9]{64}$/.test(sha256 || '') ||
      !Number.isSafeInteger(revision) || revision < 1 || schemaVersion !== 1) {
    throw new Error('需要完整快照文件、发布行的 SHA-256、正整数 revision 和 schema-version=1');
  }
  const fd = fs.openSync(snapshotFile, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
  let raw;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('快照必须是最多 2MiB 的普通文件');
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const n = fs.readSync(fd, bytes, size, bytes.length - size, null);
      if (!n) break;
      size += n;
    }
    if (size > MAX_BYTES) throw new Error('快照体积超限');
    raw = bytes.subarray(0, size).toString('utf8');
  } finally { fs.closeSync(fd); }

  // A browser may append an editor sentinel or newline outside the JSON.
  // Accept removal only when the resulting bytes match the separately read published hash.
  const candidates = [raw, raw.replace(/^[\s\u200b\ufeff]+|[\s\u200b\ufeff]+$/gu, '')];
  const snapshot_json = candidates.find(value => releaseDiagnostics({ snapshot_json: value, sha256 }).verified_checksum_match);
  if (snapshot_json === undefined) throw new Error('网页快照校验和不匹配；请重新读取完整单元格，不拼接或猜测缺失内容');
  let snapshot;
  try {
    snapshot = decodeRelease({ channel: SOURCE.channel, revision, schema_version: schemaVersion, snapshot_json, sha256 });
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('发布快照不是有效 JSON');
    throw error;
  }
  const options = { source: SOURCE, registryFile: '', cacheDir, now, stateDir };
  const loaded = await loadRegistry({ ...options, offline: false, force: true, lease, event, keepLease, fetchRemote: async () => snapshot });
  if (loaded.metadata.source !== 'remote') throw new Error(loaded.metadata.refresh_error || '快照未导入，保留已有缓存');
  if (loaded.metadata.cache_warning) throw new Error(loaded.metadata.cache_warning);
  const verified = await loadRegistry({ ...options, offline: true });
  const digest = registry => hash(JSON.stringify({ ...registry,
    models: [...registry.models].sort((a, b) => a.model_id.localeCompare(b.model_id)) }));
  if (verified.metadata.source !== 'cache' || verified.metadata.revision !== revision ||
      digest(verified.registry) !== digest(loaded.registry)) {
    throw new Error('本地缓存回读不一致，可能存在并发刷新；请重新读取发布行');
  }
  return { success: true, source: 'browser', channel: SOURCE.channel, revision,
    schema_version: schemaVersion, model_count: snapshot.models.length,
    integrity: { verification_mode: releaseDiagnostics({ snapshot_json, sha256 }).verification_mode, verified_sha256: sha256 },
    cache_verified: true, next_step: '本次列模型和生成使用 --offline-models，不再调用 lark-cli' };
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('node scripts/import-browser-release.js --snapshot FILE --sha256 HASH --revision N --schema-version 1');
    return;
  }
  const names = { '--snapshot': 'snapshotFile', '--sha256': 'sha256', '--revision': 'revision', '--schema-version': 'schemaVersion', '--lease': 'lease', '--event': 'event', '--keep-lease': 'keepLease' };
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = names[argv[i]], value = argv[i + 1];
    if (!name || value === undefined || Object.hasOwn(options, name)) throw new Error('参数缺失、重复或不受支持；使用 --help 查看格式');
    if (name === 'revision' || name === 'schemaVersion') {
      if (!/^[1-9]\d*$/.test(value)) throw new Error('版本参数必须是正整数');
      options[name] = Number(value);
    } else if (name === 'keepLease') {
      if (!['true','false'].includes(value)) throw new Error('keep-lease 必须为 true/false');
      options[name] = value === 'true';
    } else options[name] = value;
  }
  try { console.log(JSON.stringify(await importBrowserRelease(options))); }
  catch (error) {
    if (options.lease) { try { await require('./model-registry').runtime.fail({ ...options, reason: 'invalid_snapshot' }); } catch {} }
    throw error;
  }
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ success: false, error: error.message }));
  process.exitCode = 1;
});
module.exports = { importBrowserRelease };
