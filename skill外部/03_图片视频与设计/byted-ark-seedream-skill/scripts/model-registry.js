'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const BUILTIN = require('../references/model-registry.builtin.json');
const SOURCE = require('../references/model-source.json');
const RUNTIME = 1;
const MAX_BYTES = 2 * 1024 * 1024;
const CAPABILITIES = ['text_to_image', 'image_to_image', 'interactive_edit', 'layer_decomposition',
  'transparent_background', 'prompt_optimization_fast', 'sequential', 'stream', 'web_search'];
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);
const RESERVED = new Set(['model', 'prompt', 'image', 'size', 'response_format', 'output_format', 'watermark',
  'layer_decomposition', 'background', 'optimize_prompt_options', 'stream', 'tools',
  'sequential_image_generation', 'sequential_image_generation_options', 'reference_strength']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function fail(message) { throw new Error(message); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function keys(value, allowed, label) {
  if (!object(value) || Object.keys(value).some(k => !allowed.includes(k))) fail(`${label} 字段或类型无效`);
}
function integer(value, min = 0, max = 1000000) { return Number.isSafeInteger(value) && value >= min && value <= max; }
function strings(value) { return Array.isArray(value) && value.every(s => typeof s === 'string' && s.length > 0 && s.length <= 256) && new Set(value).size === value.length; }
function safeTree(value, depth = 0) {
  if (depth > 12) fail('配置嵌套过深');
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    if (BLOCKED.has(k)) fail('配置包含禁止的对象属性');
    safeTree(v, depth + 1);
  }
}
function compatible(model) {
  return model.status === 'active' && model.modality === 'image' && model.adapter === 'seedream-image-v1' &&
    model.min_runtime <= RUNTIME && model.capabilities.every(c => CAPABILITIES.includes(c));
}
function validateExtraValue(value, spec, name) {
  if ((spec.type === 'integer' ? !Number.isSafeInteger(value) : typeof value !== spec.type) ||
      (typeof value === 'number' && !Number.isFinite(value))) fail(`扩展参数 ${name} 类型无效`);
  if (spec.enum && !spec.enum.includes(value)) fail(`扩展参数 ${name} 不在允许值内`);
  if (typeof value === 'number' && ((spec.minimum !== undefined && value < spec.minimum) || (spec.maximum !== undefined && value > spec.maximum))) fail(`扩展参数 ${name} 超出范围`);
  if (typeof value === 'string' && value.length > (spec.max_length ?? 2000)) fail(`扩展参数 ${name} 过长`);
  return value;
}
function validateRegistry(input) {
  if (Buffer.byteLength(JSON.stringify(input)) > MAX_BYTES) fail('配置体积超限');
  safeTree(input);
  keys(input, ['schema_version', 'revision', 'channel', 'published_at', 'models'], '配置');
  if (input.schema_version !== 1 || !integer(input.revision, 1, Number.MAX_SAFE_INTEGER) || input.channel !== 'seedream' ||
      typeof input.published_at !== 'string' || !Number.isFinite(Date.parse(input.published_at)) || !Array.isArray(input.models) || input.models.length > 500) fail('配置协议、版本或模型列表无效');
  const aliases = new Set();
  for (const m of input.models) {
    keys(m, ['model_id', 'display_name', 'modality', 'status', 'aliases', 'adapter', 'min_runtime', 'priority', 'quality_priority', 'capabilities', 'limits', 'defaults', 'extra_parameters', 'extensions', 'source_url', 'notes'], '模型');
    if (!/^doubao-seedream-[a-z0-9.-]+$/.test(m.model_id) || typeof m.display_name !== 'string' || m.modality !== 'image' || !['active', 'retired'].includes(m.status) || !strings(m.aliases)) fail('模型 ID、状态或别名无效');
    for (const id of [m.model_id, ...m.aliases]) {
      if (id === 'auto' || BLOCKED.has(id) || !/^[a-z0-9][a-z0-9.-]*$/.test(id) || aliases.has(id)) fail(`重复或非法模型别名 ${id}`);
      aliases.add(id);
    }
    if (m.status === 'retired') continue;
    if (typeof m.adapter !== 'string' || !integer(m.min_runtime, 1) || !integer(m.priority) || !integer(m.quality_priority) || !strings(m.capabilities)) fail(`模型 ${m.model_id} 路由属性无效`);
    if (!m.capabilities.includes('text_to_image') && !m.capabilities.includes('image_to_image')) fail('模型至少声明一种图片输入能力');
    keys(m.limits, ['size_presets','layer_size_presets','max_reference_images','max_output_images','max_input_output_images','max_layers','custom_size'], 'limits');
    const l = m.limits;
    if (!strings(l.size_presets) || !l.size_presets.length || !strings(l.layer_size_presets) ||
        l.size_presets.some(s => !/^\d+(?:\.\d+)?K$/.test(s)) || l.layer_size_presets.some(s => s !== 'auto' && !/^\d+(?:\.\d+)?K$/.test(s)) ||
        !integer(l.max_reference_images, 0, 100) || !integer(l.max_output_images, 1, 100) || !integer(l.max_layers, 0, 100) ||
        !(l.max_input_output_images === null || integer(l.max_input_output_images, 1, 200))) fail('模型数量或尺寸约束无效');
    keys(l.custom_size, ['min_pixels', 'max_pixels', 'min_aspect_ratio', 'max_aspect_ratio'], 'custom_size');
    const c = l.custom_size;
    if (!integer(c.min_pixels, 1, 100000000) || !integer(c.max_pixels, c.min_pixels, 100000000) ||
        !Number.isFinite(c.min_aspect_ratio) || !Number.isFinite(c.max_aspect_ratio) || c.min_aspect_ratio <= 0 || c.max_aspect_ratio < c.min_aspect_ratio) fail('自定义像素约束无效');
    keys(m.defaults, ['size', 'layer_size', 'output_format', 'watermark'], 'defaults');
    if (!l.size_presets.includes(m.defaults.size) || !['png', 'jpeg'].includes(m.defaults.output_format) || typeof m.defaults.watermark !== 'boolean' ||
        (m.capabilities.includes('layer_decomposition') && (!l.layer_size_presets.includes(m.defaults.layer_size) || l.max_layers < 1))) fail('默认参数与模型能力冲突');
    if (!object(m.extra_parameters) || Object.keys(m.extra_parameters).length > 30) fail('extra_parameters 必须是对象且不超过30项');
    for (const [name, spec] of Object.entries(m.extra_parameters)) {
      if (!/^[a-z][a-z0-9_]*$/.test(name) || RESERVED.has(name) || /key|token|secret|auth|url|host|endpoint|header|script|command|path|file|proxy|callback/.test(name)) fail(`扩展参数 ${name} 不允许透传`);
      keys(spec, ['type','enum','minimum','maximum','max_length','default','required'], '扩展参数定义');
      if (!['string','number','integer','boolean'].includes(spec.type) || (spec.required !== undefined && typeof spec.required !== 'boolean') ||
          (spec.enum !== undefined && (!Array.isArray(spec.enum) || !spec.enum.length || spec.enum.length > 100)) ||
          (spec.minimum !== undefined && !Number.isFinite(spec.minimum)) || (spec.maximum !== undefined && !Number.isFinite(spec.maximum)) ||
          (spec.minimum !== undefined && spec.maximum !== undefined && spec.minimum > spec.maximum) ||
          (spec.max_length !== undefined && !integer(spec.max_length, 1, 2000))) fail('扩展参数定义无效');
      if (spec.enum) for (const value of spec.enum) validateExtraValue(value, spec, name);
      if (spec.default !== undefined) validateExtraValue(spec.default, spec, name);
    }
    if (m.extensions !== undefined && !object(m.extensions)) fail('extensions 必须是对象');
  }
  return clone(input);
}

function cliPath() {
  if (process.env.LARK_CLI_BIN) return process.env.LARK_CLI_BIN;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const file = path.join(dir, process.platform === 'win32' ? 'lark-cli.exe' : 'lark-cli');
    if (fs.existsSync(file)) return path.resolve(file);
  }
  throw Object.assign(new Error('未找到飞书 lark-cli；可能未安装或不在 PATH 中'), { code: 'REGISTRY_CLI_NOT_FOUND' });
}
async function cli(args, { cwd, timeout = 12000 } = {}) {
  try {
    const { stdout } = await exec(cliPath(), args, { cwd, timeout, maxBuffer: MAX_BYTES, windowsHide: true });
    return JSON.parse(stdout);
  } catch (error) {
    // Missing executables are distinct from authentication failures; never echo provider diagnostics.
    if (error.code === 'REGISTRY_CLI_NOT_FOUND') throw error;
    if (error.code === 'ENOENT') {
      throw Object.assign(new Error('无法启动飞书 lark-cli；配置路径或执行程序不存在'), { code: 'REGISTRY_CLI_NOT_FOUND' });
    }
    let detail;
    try { detail=JSON.parse(error.stderr || error.stdout || '{}'); } catch {}
    if (detail?.error?.subtype === 'storage' && /keychain/i.test(detail.error.message || '')) {
      throw Object.assign(new Error('飞书 CLI 无法访问系统钥匙串；未读取发布配置，不能判断配置校验和'),
        { code: 'REGISTRY_CLI_KEYCHAIN_UNAVAILABLE' });
    }
    if (Number(detail?.error?.code) === 800050828) {
      const limited=new Error('飞书表格限流，读取预算内重试后仍不可用');
      limited.rateLimited=true;
      throw limited;
    }
    throw new Error(error.killed ? '飞书操作超时' : '飞书 CLI 操作失败或未授权');
  }
}
async function readTable(source, kind, timeout = 12000, run = cli, wait = ms => new Promise(resolve=>setTimeout(resolve,ms))) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedream-registry-'));
  const started = Date.now();
  const rows = [];
  let rev, offset = 0;
  try {
    for (let page = 0; page < 5; page++) {
      const remaining = timeout - (Date.now() - started);
      if (remaining <= 0) fail('飞书读取超时');
      const fields = source.fields[kind];
      let manifest;
      // Retry confirmed rate limits only for this read, within the shared deadline.
      // A mutation with an uncertain response must be checked, never blindly repeated.
      for(let attempt=0;;attempt++) {
        try {
          manifest=await run(['base', '+record-list', '--base-token', source.base_token, '--table-id', source.tables[kind],
        ...Object.values(fields).flatMap(id => ['--field-id', id]), '--limit', '2000', '--offset', String(offset),
        '--format', 'ndjson', '--output', `page-${page}.ndjson`, '--as', 'user'], {cwd:dir,timeout:timeout-(Date.now()-started)});
          break;
        } catch(error) {
          const delay=3000 * 2**attempt;
          if(!error.rateLimited || attempt>=4 || timeout-(Date.now()-started)<=delay+1000) throw error;
          await wait(delay);
        }
      }
      if (manifest.manifest_version !== 'v1' || !integer(manifest.records_count, 0, 2000) || !integer(manifest.rev) || typeof manifest.has_more !== 'boolean' || !object(manifest.columns)) fail('飞书读取结果协议不兼容（需要新版 lark-cli）');
      if (rev !== undefined && rev !== manifest.rev) fail('分页期间表格已变化，请重试读取');
      rev = manifest.rev;
      const filename = path.join(dir, `page-${page}.ndjson`);
      if (fs.statSync(filename).size > MAX_BYTES) fail('飞书记录体积超限');
      const records = fs.readFileSync(filename, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
      if (records.length !== manifest.records_count) fail('飞书记录不完整');
      const names = Object.fromEntries(Object.entries(fields).map(([key, id]) => {
        const name = Object.keys(manifest.columns).find(n => manifest.columns[n].field_id === id);
        if (!name && records.length) fail(`缺少配置列 ${key}`);
        return [key, name];
      }));
      for (const row of records) rows.push({ record_id: row.record_id, ...Object.fromEntries(Object.entries(names).map(([key, name]) => [key, row[name]])) });
      if (!manifest.has_more) return { rows, rev };
      if (!integer(manifest.next_offset, offset + 1)) fail('飞书分页游标无效');
      offset = manifest.next_offset;
    }
    fail('模型表记录数超出读取上限');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function restoreLarkSelfLinks(text) {
  // The Base text read path may render a bare URL as [URL](URL).
  // Restore only identical-label HTTP(S) links; never follow URLs or rewrite JSON values.
  return text.replace(/\[(https?:\/\/[^\s"'\\\[\]()<>]+)\]\(\1\)/gu, '$1');
}
function releaseDiagnostics(row) {
  const raw = row.snapshot_json, text = typeof raw === 'string';
  const expected = typeof row.sha256 === 'string' && /^[a-f0-9]{64}$/.test(row.sha256) ? row.sha256 : null;
  const actual = text ? hash(raw) : null, restored = text ? restoreLarkSelfLinks(raw) : null;
  const rawMatch = !!expected && text && actual === expected;
  const linkMatch = !!expected && text && restored !== raw && hash(restored) === expected;
  let validJSON = false, compactMatch = false;
  if (text) try { compactMatch = hash(JSON.stringify(JSON.parse(raw))) === expected; validJSON = true; } catch {}
  return { expected_sha256: expected, actual_sha256: actual,
    snapshot_type: raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw,
    chars: text ? raw.length : null, bytes: text ? Buffer.byteLength(raw) : null,
    checksum_match: rawMatch, valid_json: validJSON,
    outer_whitespace_matches: !!expected && text && hash(raw.replace(/^[\s\u200b\ufeff]+|[\s\u200b\ufeff]+$/gu, '')) === expected,
    json_reserialized_matches: compactMatch, lark_self_links_matches: linkMatch,
    verified_checksum_match: rawMatch || linkMatch,
    verification_mode: rawMatch ? 'raw' : linkMatch ? 'lark_self_links' : 'none',
    verified_sha256: rawMatch || linkMatch ? expected : null };
}
function decodeRelease(row) {
  const diagnostic = releaseDiagnostics(row);
  if (!diagnostic.verified_checksum_match) {
    throw Object.assign(new Error('已发布配置校验和不匹配；仅凭此错误不能判断是发布内容还是读取格式问题'),
      { code: 'REGISTRY_CHECKSUM_MISMATCH', registryDiagnostic: diagnostic });
  }
  // The complete restored byte sequence must match the original published SHA-256.
  // A changed parameter, different link target, or truncation still rejects the whole release.
  const text = diagnostic.verification_mode === 'raw' ? row.snapshot_json : restoreLarkSelfLinks(row.snapshot_json);
  const snapshot = validateRegistry(JSON.parse(text));
  if (snapshot.revision !== row.revision || snapshot.schema_version !== row.schema_version || snapshot.channel !== row.channel) fail('发布元数据与快照不一致');
  return snapshot;
}
async function fetchPublished(source = SOURCE) {
  const { rows } = await readTable(source, 'releases');
  const matches = rows.filter(r => r.channel === source.channel);
  if (matches.length !== 1) fail('必须且只能存在一条 seedream 发布记录');
  const snapshot = decodeRelease(matches[0]), diagnostic = releaseDiagnostics(matches[0]);
  return { snapshot, record_id: matches[0].record_id, integrity: {
    verification_mode: diagnostic.verification_mode, received_sha256: diagnostic.actual_sha256,
    verified_sha256: diagnostic.verified_sha256 } };
}
function parseCache(filename, sourceKey, now) {
  try {
    if (fs.statSync(filename).size > MAX_BYTES) return null;
    const c = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (c.source_key !== sourceKey || !Number.isFinite(c.fetched_at) || c.fetched_at > now + 60000 || hash(JSON.stringify(c.snapshot)) !== c.sha256) return null;
    c.snapshot = validateRegistry(c.snapshot);
    return c;
  } catch { return null; }
}
function guardRetirements(snapshot, previous) {
  // Explicit, validated newer releases can reactivate a model. Offline fallback retains tombstones.
  const entries = [...(previous?.models || []).filter(m => m.status === 'retired'),
    ...BUILTIN.models.filter(m => m.status === 'retired' && !snapshot.models.some(n => n.model_id === m.model_id))];
  const retiredAliases = new Set(entries.flatMap(m => [m.model_id, ...m.aliases]));
  const models = snapshot.models.filter(m => ![m.model_id, ...m.aliases].some(id => retiredAliases.has(id)));
  return { ...snapshot, models: [...models, ...entries.filter((m, i) => entries.findIndex(x => x.model_id === m.model_id) === i)] };
}
function ensureContinuity(before, next) {
  for (const model of before.models) {
    const current = next.models.find(m => m.model_id === model.model_id);
    if (!current) fail(`模型 ${model.model_id} 不能删除或移回草稿；下线请保留 retired 记录`);
    if (model.aliases.some(alias => !current.aliases.includes(alias))) fail(`${model.model_id} 必须保留已发布别名`);
  }

}
function readRetirements(filename) {
  try {
    const r = require('./registry-sync').read(filename);
    if (r.sha256 !== hash(JSON.stringify(r.snapshot))) return null;
    const snapshot = validateRegistry(r.snapshot);
    return snapshot.models.every(m => m.status === 'retired') ? snapshot : null;
  } catch { return null; }
}
async function loadSnapshot(options = {}) {
  const now = options.now ?? Date.now();
  const source = options.source || SOURCE;
  const registryFile = options.registryFile ?? process.env.ARK_SEEDREAM_REGISTRY_FILE;
  const sourceKey = hash(registryFile ? `file:${path.resolve(registryFile)}` : JSON.stringify(source));
  const cacheDir = options.cacheDir || process.env.ARK_SEEDREAM_REGISTRY_CACHE_DIR || path.join(os.homedir(), '.cache', 'ark-seedream');
  const filename = path.join(cacheDir, `${sourceKey}.json`);
  const retiredFile = path.join(cacheDir, `${sourceKey}.retired.json`);
  const tombstones = readRetirements(retiredFile);
  let cached = parseCache(filename, sourceKey, now), error, errorCode, diagnostic;
  const offline = options.offline ?? (process.env.ARK_SEEDREAM_REGISTRY_MODE === 'offline');
  if (!offline) {
    try {
      let snapshot, integrity;
      if (options.fetchRemote) snapshot = await options.fetchRemote();
      else if (registryFile) {
        if (fs.statSync(registryFile).size > MAX_BYTES) fail('配置文件体积超限');
        snapshot = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
      } else ({ snapshot, integrity } = await fetchPublished(source));
      snapshot = validateRegistry(snapshot);
      options.beforeCommit?.();
      if (tombstones && (snapshot.revision < tombstones.revision ||
          (snapshot.revision === tombstones.revision && tombstones.models.some(m => !snapshot.models.some(n => n.model_id === m.model_id && n.status === 'retired'))))) fail('下线记录需要更高发布版本才能恢复上线');
      const digest = hash(JSON.stringify(snapshot));
      // Keep version numbers monotonic. A content rollback is published as a new revision.
      const current = parseCache(filename, sourceKey, now);
      if (current && (!cached || current.snapshot.revision > cached.snapshot.revision)) cached = current;
      if (cached && (snapshot.revision < cached.snapshot.revision || (snapshot.revision === cached.snapshot.revision && digest !== cached.sha256))) fail('发布版本倒退或同版本内容被改写');
      // Require explicit retired rows; deleting a row must not silently resurrect a built-in model later.
      ensureContinuity(BUILTIN, snapshot);
      if (tombstones) ensureContinuity(tombstones, snapshot);
      if (cached) ensureContinuity(cached.snapshot, snapshot);
      if (snapshot.revision < BUILTIN.revision) fail('发布版本低于内置版本');
      const effective = guardRetirements(snapshot);
      let cacheWarning;
      try {
        fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
        const lock = `${filename}.lock`;
        const fd = fs.openSync(lock, 'wx', 0o600);
        try {
          const latest = parseCache(filename, sourceKey, now);
          if (!latest || latest.snapshot.revision <= snapshot.revision) {
            const tmp = `${filename}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
            try {
              fs.writeFileSync(tmp, JSON.stringify({ source_key: sourceKey, fetched_at: now, sha256: digest, snapshot }), { mode: 0o600 });
              fs.renameSync(tmp, filename);
            const retired = { ...snapshot, models: snapshot.models.filter(m => m.status === 'retired').map(({ model_id, display_name, modality, status, aliases }) => ({ model_id, display_name, modality, status, aliases })) };
            require('./registry-sync').write(retiredFile, { snapshot: retired, sha256: hash(JSON.stringify(retired)) });
            } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
          }
        } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
      } catch { cacheWarning = '缓存未写入；本次仍使用已校验远端配置'; }
      return { registry: effective, metadata: { source: registryFile ? 'file' : 'remote', revision: snapshot.revision, checked_at: new Date(now).toISOString(), cache_warning: cacheWarning, integrity } };
    } catch (e) { error = e.message; errorCode = e.code; diagnostic = e.registryDiagnostic; }
  }
  const fresh = !!cached;
  const snapshot = fresh ? cached.snapshot : BUILTIN;
  return { registry: guardRetirements(snapshot, cached?.snapshot || tombstones), metadata: {
    source: fresh ? 'cache' : 'builtin', revision: snapshot.revision, offline: !!offline,
    cache_age_ms: cached ? Math.max(0, now - cached.fetched_at) : null,
    refresh_error: error, refresh_error_code: errorCode, refresh_diagnostic: diagnostic,
    retirement_revision: cached?.snapshot.revision,
    warning: fresh ? '使用最近成功配置缓存' : '使用内置配置；无法获知尚未同步的远端变化'
  } };
}
const runtime = require('./registry-sync').createRuntime({ SOURCE, loadSnapshot });
const loadRegistry = runtime.load;
function listModels(registry) {
  return registry.models.map(m => ({ ...m, executable: compatible(m) }));
}
module.exports = { BUILTIN, SOURCE, RUNTIME, CAPABILITIES, compatible, validateRegistry, validateExtraValue,
  runtime, loadRegistry, listModels, readTable, fetchPublished, decodeRelease, releaseDiagnostics, ensureContinuity, cli, hash, clone };
