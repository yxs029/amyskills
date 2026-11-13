'use strict';

// Local scheduling only. Remote content never supplies a command, path or credential.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const DAY = 86400000, LEASE_MS = 5 * 60000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const FLAGS = value => value === true || value === 'true';
function read(file) {
  try {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size > 1024 * 1024) return {};
      const value = JSON.parse(fs.readFileSync(fd, 'utf8'));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } finally { fs.closeSync(fd); }
  } catch { return {}; }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${crypto.randomBytes(12).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}
function intervalDays(value = process.env.ARK_MODEL_CHECK_INTERVAL_DAYS || '7') {
  if (![7, 14].includes(Number(value))) throw new Error('ARK_MODEL_CHECK_INTERVAL_DAYS 仅支持 7 或 14');
  return Number(value);
}
function modes({ offline, force, dryRun } = {}, channel) {
  const explicitOffline = FLAGS(offline) || process.env[`ARK_${channel.toUpperCase()}_REGISTRY_MODE`] === 'offline';
  if (explicitOffline && FLAGS(force)) throw new Error('refresh-models 与 offline-models 不能同时使用');
  return { offline: explicitOffline || (FLAGS(dryRun) && !FLAGS(force)), force: FLAGS(force) };
}
function routeError(message, event) { return Object.assign(new Error(message), { registryEvent: event }); }
function createRuntime({ SOURCE, loadSnapshot }) {
  function context(options = {}) {
    const source = options.source || SOURCE, now = options.now ?? Date.now();
    const prefix = `ARK_${SOURCE.channel.toUpperCase()}`;
    const file = options.registryFile ?? process.env[`${prefix}_REGISTRY_FILE`];
    const customCache = options.cacheDir || process.env[`${prefix}_REGISTRY_CACHE_DIR`];
    // Test/explicit cache overrides isolate state too, unless shared state was requested.
    const dir = options.stateDir || process.env.ARK_MODEL_REGISTRY_STATE_DIR ||
      (customCache ? `${path.resolve(customCache)}-sync` : path.join(os.homedir(), '.cache', 'ark-media-registry'));
    const group = hash(file ? `file:${path.resolve(file)}` : JSON.stringify([source.base_url, source.base_token, source.tables.releases]));
    const channelKey = hash(JSON.stringify([group, source.channel]));
    return { now, file, group, dir, channelKey, options,
      stateFile: path.join(dir, `${channelKey}.json`), groupFile: path.join(dir, `${group}.group.json`),
      lockFile: path.join(dir, `${group}.lock`), interval: intervalDays(options.intervalDays) * DAY };
  }
  function timestamp(value, now) { return Number.isFinite(value) && value >= 0 && value <= now + 60000 ? value : 0; }
  async function inspect(options = {}) {
    options = { ...options, offline: options.offline ?? (process.env[`ARK_${SOURCE.channel.toUpperCase()}_REGISTRY_MODE`] === 'offline') };
    if (options.offline && options.force) throw new Error('refresh-models 与 offline-models 不能同时使用');
    const c = context(options), cached = await loadSnapshot({ ...options, offline: true });
    const state = read(c.stateFile), group = read(c.groupFile);
    const lastSuccess = timestamp(state.last_success_at, c.now) ||
      (cached.metadata.source === 'cache' ? c.now - cached.metadata.cache_age_ms : 0);
    const event = options.event || (options.requestedModel && options.requestedModel !== 'auto' &&
      !cached.registry.models.some(m => m.model_id === options.requestedModel || m.aliases.includes(options.requestedModel))
      ? `unknown_model:${options.requestedModel}` : null);
    const eventKey = event ? hash(String(event).slice(0, 2048)) : null;
    const retryAt = Math.max(Number(state.next_retry_at) || 0, Number(group.next_retry_at) || 0);
    const negativeAt = Number(state.negative?.[eventKey]) || 0;
    let reason = 'fresh', refresh = false;
    if (options.offline) reason = 'offline';
    else if (options.attempted) reason = 'already_checked';
    else if (options.force) { reason = 'forced'; refresh = true; }
    else if (retryAt > c.now && retryAt <= c.now + DAY + 60000) reason = 'cooldown';
    else if (eventKey && negativeAt > c.now && negativeAt <= c.now + DAY + 60000) reason = 'negative_cache';
    else if (eventKey) { reason = 'event'; refresh = true; }
    else if (c.file || cached.metadata.source !== 'cache' || !lastSuccess || c.now - lastSuccess >= c.interval) { reason = cached.metadata.source === 'cache' && lastSuccess ? 'due' : 'first_use'; refresh = true; }
    return { c, cached, state, eventKey, decision: { refresh, reason, channel: SOURCE.channel,
      last_success_at: lastSuccess || null, last_attempt_at: timestamp(state.last_attempt_at, c.now) || null,
      next_check_at: lastSuccess ? lastSuccess + c.interval : null, next_retry_at: retryAt || null,
      interval_days: c.interval / DAY, revision: cached.metadata.revision, source: cached.metadata.source,
      registry_file: !!c.file } };
  }
  function acquire(c) {
    fs.mkdirSync(c.dir, { recursive: true, mode: 0o700 });
    const existing = read(c.lockFile);
    if (existing.expires_at > c.now && existing.expires_at <= c.now + LEASE_MS + 60000) return null;
    // A stale lease may be reclaimed, but never delete a newly replaced lock.
    try {
      const stat = fs.statSync(c.lockFile);
      if (existing.token && read(c.lockFile).token === existing.token || c.now - stat.mtimeMs > LEASE_MS) fs.unlinkSync(c.lockFile);
    } catch {}
    const lease = { token: crypto.randomBytes(24).toString('hex'), expires_at: c.now + LEASE_MS };
    try { fs.writeFileSync(c.lockFile, JSON.stringify(lease), { flag: 'wx', mode: 0o600 }); return lease.token; }
    catch (e) { if (e.code === 'EEXIST') return null; throw e; }
  }
  function owns(c, token) { const l = read(c.lockFile); return typeof token === 'string' && /^[a-f0-9]{48}$/.test(token) && l.token === token && l.expires_at > c.now; }
  function release(c, token) { try { if (owns(c, token)) fs.unlinkSync(c.lockFile); } catch {} }
  function finish(c, { success, eventKey, reason = 'read_failed', globalFailure = false } = {}) {
    const state = read(c.stateFile), negative = Object.fromEntries(Object.entries(state.negative || {}).filter(([, v]) => Number.isFinite(v) && v > c.now && v <= c.now + DAY + 60000).slice(-127));
    if (success && eventKey) negative[eventKey] = c.now + DAY;
    write(c.stateFile, { version: 1, last_attempt_at: c.now,
      last_success_at: success ? c.now : timestamp(state.last_success_at, c.now),
      next_retry_at: success ? 0 : c.now + DAY, last_result: success ? 'success' : reason, negative });
    if (success || globalFailure) write(c.groupFile, { version: 1, next_retry_at: success ? 0 : c.now + DAY });
  }
  async function begin(options = {}) {
    const s = await inspect(options);
    if (!s.decision.refresh) return { ...s.decision, lease: null };
    let token;
    try {
      token = acquire(s.c);
      if (!token) return { ...s.decision, refresh: false, reason: 'busy', lease: null };
      write(s.c.stateFile, { ...s.state, last_attempt_at: s.c.now });
      return { ...s.decision, lease: token };
    } catch { release(s.c, token); return { ...s.decision, refresh: false, reason: 'state_unwritable', lease: null }; }
  }
  async function fail(options = {}) {
    const c = context(options);
    if (!owns(c, options.lease)) throw new Error('刷新租约无效或过期');
    const reasons = ['browser_unavailable', 'authorization_required', 'read_failed', 'invalid_snapshot'];
    try { finish(c, { reason: reasons.includes(options.reason) ? options.reason : 'read_failed', globalFailure: options.reason !== 'invalid_snapshot' }); }
    finally { release(c, options.lease); }
    return { success: false, next_retry_at: c.now + DAY, fallback: 'last_valid_or_builtin' };
  }
  async function load(options = {}) {
    const s = await inspect(options);
    const annotate = (result, attempted, decision = s.decision) => ({ ...result, metadata: { ...result.metadata,
      refresh_attempted: attempted, refresh: decision, stale: result.metadata.cache_age_ms >= s.c.interval } });
    if (s.decision.reason === 'offline' || (!s.decision.refresh && !options.lease)) return annotate(s.cached, false);
    let lease = options.lease;
    if (lease && !owns(s.c, lease)) throw new Error('刷新租约无效或过期');
    if (!lease) {
      const started = await begin(options);
      if (!started.lease) return annotate(s.cached, false, started);
      lease = started.lease;
    }
    try {
      // Ownership is checked again at fetch completion, before snapshot/cache mutation.
      const result = await loadSnapshot({ ...options, offline: false, beforeCommit: () => {
        if (!owns({ ...s.c, now: options.now ?? Date.now() }, lease)) throw new Error('刷新租约已过期，未写入配置');
      } });
      const success = ['remote', 'file'].includes(result.metadata.source);
      try {
        if (success && result.metadata.cache_warning) finish(s.c, { reason: 'cache_unwritable' });
        else finish(s.c, { success, eventKey: s.eventKey,
          reason: result.metadata.refresh_error_code === 'REGISTRY_CHECKSUM_MISMATCH' ? 'invalid_snapshot' : 'read_failed',
          globalFailure: !success && !s.c.file && /CLI|飞书|读取超时/.test(result.metadata.refresh_error || '') });
      } catch { result.metadata.state_warning = '检查状态未写入；本次使用已校验配置'; }
      return annotate(result, true);
    } finally { if (!options.keepLease) release(s.c, lease); }
  }
  async function route(options, prepare) {
    let loaded = await load(options);
    try { return { loaded, prepared: await prepare(loaded.registry) }; }
    catch (e) {
      if (!e.registryEvent || options.offline || loaded.metadata.refresh_attempted) { e.registryCheck = { ...loaded.metadata.refresh, attempted: loaded.metadata.refresh_attempted }; throw e; }
      loaded = await load({ ...options, event: e.registryEvent, force: false });
      try { return { loaded, prepared: await prepare(loaded.registry) }; }
      catch (error) { error.registryCheck = loaded.metadata.refresh; throw error; }
    }
  }
  function end(options = {}) { const c = context(options); if (!owns(c, options.lease)) throw new Error('刷新租约无效或过期'); release(c, options.lease); return { released: true }; }
  return { load, route, inspect, begin, fail, end, context };
}
module.exports = { createRuntime, modes, intervalDays, routeError, read, write, hash, DAY };
