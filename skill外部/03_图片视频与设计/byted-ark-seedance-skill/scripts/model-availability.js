'use strict';
const path = require('node:path');
const { read, write, hash, DAY } = require('./registry-sync');

// Only explicit model-specific codes trigger registry checks. HTTP status alone never retires a model.
function classify(error) {
  const code = String(error.apiCode || '').toLowerCase();
  if (['unsupportedmodel', 'modelnotfound', 'invalidendpointormodel.notfound', 'modelnotenabled',
    'modelnotaccessible', 'accessdenied.model'].includes(code)) return 'model_unavailable';
  if (error.httpStatus === 401 || error.httpStatus === 403) return 'authentication_or_permission';
  if (error.httpStatus === 429) return 'quota_or_rate_limit';
  if (error.httpStatus >= 500) return 'service_error';
  if (!error.httpStatus) return 'network_or_local_error';
  return 'request_error';
}
function scopeFile(runtime, { apiKey, baseUrl, ...options }) {
  if (!apiKey) return null;
  const c = runtime.context(options);
  // Persist only an opaque fingerprint, never the key or raw API response.
  return path.join(c.dir, `availability-${hash(JSON.stringify([c.group, apiKey, baseUrl]))}.json`);
}
function observed(runtime, context) {
  const file = scopeFile(runtime, context), now = context.now ?? Date.now();
  const state = file ? read(file) : {};
  return Object.fromEntries(Object.entries(state).filter(([id, s]) =>
    /^doubao-[a-z0-9.-]+$/.test(id) && s?.kind === 'model_unavailable' &&
    Number.isFinite(s.until) && s.until > now && s.until <= now + DAY + 60000));
}
function applyAvailability(registry, runtime, context) {
  return { ...registry, unavailable_models: observed(runtime, context) };
}
function unavailableError(id, state) {
  return Object.assign(new Error(`${id} 在当前凭证/入口下暂不可用（${state.code}）；这不表示产品已下线，可在 ${new Date(state.until).toISOString()} 后复查；核实账号状态后可用 --refresh-models 提前复查`), { code: 'LOCAL_MODEL_UNAVAILABLE' });
}
function checkAvailable(registry, id) {
  if (registry.unavailable_models?.[id]) throw unavailableError(id, registry.unavailable_models[id]);
}
function record(runtime, context, model, error) {
  const file = scopeFile(runtime, context);
  if (!file) return;
  const state = observed(runtime, context), now = context.now ?? Date.now();
  if (!error) { if (!state[model]) return; delete state[model]; }
  else if (classify(error) === 'model_unavailable') {
    const retry = Number(error.retryAfterMs);
    state[model] = { kind: 'model_unavailable', code: String(error.apiCode).slice(0, 100),
      until: now + (Number.isFinite(retry) && retry > 0 ? Math.min(retry, DAY) : DAY) };
  } else return;
  try { write(file, state); } catch { /* Failure to save diagnostics must not replace the API result. */ }
}
async function submitOnce({ runtime, context, registryOptions = {}, metadata, model, submit }) {
  const local = observed(runtime, context);
  if (local[model] && !registryOptions.force) throw unavailableError(model, local[model]);
  try {
    const result = await submit();
    record(runtime, context, model, null);
    return result;
  } catch (error) {
    error.failureKind = classify(error);
    record(runtime, context, model, error);
    if (error.failureKind === 'model_unavailable') {
      // Read-only reconciliation, never another POST and never global retirement by inference.
      try {
        const checked = await runtime.load({ ...registryOptions, force: false,
          attempted: metadata?.refresh_attempted, event: `model_error:${model}` });
        error.registryCheck = checked.metadata.refresh;
        if (checked.registry.models.some(m => m.model_id === model && m.status === 'retired')) {
          error.message += `；已发布配置确认 ${model} 已下线，后续停止路由`;
        }
      } catch { /* Preserve the original API failure. */ }
    }
    throw error;
  }
}
module.exports = { classify, observed, applyAvailability, checkAvailable, record, submitOnce };
