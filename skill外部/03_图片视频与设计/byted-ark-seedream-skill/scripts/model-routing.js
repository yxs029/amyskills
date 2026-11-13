'use strict';

const { BUILTIN, compatible, validateExtraValue } = require('./model-registry');
const { routeError } = require('./registry-sync');
const { checkAvailable } = require('./model-availability');
const FLASH = 'doubao-seedream-5-0-flash';
const PRO = 'doubao-seedream-5.0-pro';
function isRetiredModel(model) {
  if (typeof model !== 'string') return false;
  const id = model.trim().toLowerCase();
  return id === 'lite' || /^doubao-seedream-5[.-]0-lite(?:-.*)?$/.test(id) || id === 'doubao-seedream-5-0-260128';
}

function boolean(value, name) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${name} 必须是 true 或 false`);
}

function references(value) {
  if (value === undefined) return [];
  let refs = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) refs = JSON.parse(trimmed);
    else refs = trimmed.startsWith('data:image/') ? [trimmed] : trimmed.split(',');
  }
  if (!Array.isArray(refs) || !refs.length || refs.some(r => typeof r !== 'string' || !/^(https?:\/\/\S+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+)$/.test(r.trim()))) {
    throw new Error('reference_images 必须是非空的图片 URL / Base64 数组');
  }
  return refs.map(r => r.trim());
}

function applyModel(p, m, refs, preciseEdit) {
  const caps = new Set(m.capabilities), l = m.limits;
  const constraint = message => routeError(message, `limits:${m.model_id}`);
  const needs = [
    [p.mode === 'text-to-image', 'text_to_image'], [p.mode === 'image-to-image', 'image_to_image'],
    [preciseEdit, 'interactive_edit'], [p.layer_decomposition, 'layer_decomposition'],
    [p.background !== undefined, 'transparent_background'], [p.sequential, 'sequential'],
    [p.stream, 'stream'], [p.enable_web_search, 'web_search'], [p.optimize_prompt_mode === 'fast', 'prompt_optimization_fast']
  ];
  for (const [needed, capability] of needs) if (needed && !caps.has(capability)) throw routeError(`${m.display_name} 不支持 ${capability}`, `capability:${m.model_id}:${capability}`);
  if (refs.length > l.max_reference_images) throw constraint(`参考图数量超过 ${m.display_name} 上限 ${l.max_reference_images}`);
  if (p.count > l.max_output_images) throw constraint(`生成数量超过 ${m.display_name} 上限 ${l.max_output_images}`);
  if (!p.layer_decomposition && l.max_input_output_images !== null && refs.length + p.count > l.max_input_output_images) throw constraint('参考图与输出图总数超过模型限制');
  const size = p.size || (p.layer_decomposition ? m.defaults.layer_size : m.defaults.size);
  const sizes = p.layer_decomposition ? l.layer_size_presets : l.size_presets;
  if (!sizes.includes(size)) {
    const match = /^(\d+)x(\d+)$/.exec(size);
    if (!match || p.layer_decomposition) throw constraint(`${m.display_name} 该模式 size 支持 ${sizes.join('/')}，普通生成另支持合规宽x高`);
    const w = Number(match[1]), h = Number(match[2]), c = l.custom_size;
    if (!Number.isSafeInteger(w * h) || w <= 0 || h <= 0 || w * h < c.min_pixels || w * h > c.max_pixels || w / h < c.min_aspect_ratio || w / h > c.max_aspect_ratio) throw constraint(`${m.display_name} 自定义像素或宽高比超出模型限制`);
  }
  const extra = {};
  for (const key of Object.keys(p.extra_params)) if (!Object.hasOwn(m.extra_parameters, key)) throw new Error(`${m.display_name} 未声明扩展参数 ${key}`);
  for (const [name, spec] of Object.entries(m.extra_parameters)) {
    const value = Object.hasOwn(p.extra_params, name) ? p.extra_params[name] : spec.default;
    if (value === undefined) { if (spec.required) throw new Error(`缺少扩展参数 ${name}`); }
    else extra[name] = validateExtraValue(value, spec, name);
  }
  return { ...p, model: m.model_id, _model: m, size, _extra: extra,
    output_format: p.output_format || (p.background === 'transparent' ? 'png' : m.defaults.output_format),
    watermark: p.watermark ?? m.defaults.watermark };
}

function prepareParams(input, environmentModel, registry = BUILTIN) {
  let p = { ...input };
  const selected = p.model !== undefined ? p.model : (environmentModel || 'auto');
  if (isRetiredModel(selected) && !registry.models.some(m => m.status === 'active' && (m.model_id === selected || m.aliases.includes(selected)))) throw new Error('Seedream 5.0 Lite 已下线，请将 --model、ARK_SEEDREAM_MODEL 或 ARK_MODEL 改为 flash / doubao-seedream-5-0-flash，或 pro；不会自动替换显式模型');
  const specified = registry.models.find(m => m.model_id === selected || m.aliases.includes(selected));
  if (selected !== 'auto') {
    if (!specified) throw routeError(`未知模型 ${selected}；运行 --list-models 查看当前可用模型`, `unknown_model:${selected}`);
    if (specified.status === 'retired') throw new Error(`${specified.display_name} 已下线，不会回退到内置同名模型`);
    if (!compatible(specified)) throw new Error(`模型 ${selected} 需要更新 skill 执行器（adapter=${specified.adapter}, min_runtime=${specified.min_runtime}）`);
  }
  for (const key of ['sequential', 'watermark', 'stream', 'optimize', 'enable_web_search', 'layer_decomposition', 'interactive_edit']) {
    if (p[key] !== undefined) p[key] = boolean(p[key], key);
  }
  const refs = references(p.reference_images);
  if (p.prompt !== undefined && typeof p.prompt !== 'string') throw new Error('prompt 必须是字符串');
  const prompt = p.prompt || '';
  p.count = p.count === undefined ? 1 : Number(p.count);
  if (!Number.isInteger(p.count) || p.count < 1 || p.count > 100) throw new Error('count 必须是正整数且不能超过模型输出上限');
  if (p.count > 1 && p.sequential === false) throw new Error('count > 1 与 sequential=false 冲突');
  p.sequential = p.sequential ?? (p.count > 1);
  p.stream = p.stream ?? p.sequential;
  p.mode = p.mode || (refs.length ? 'image-to-image' : 'text-to-image');
  if (!['text-to-image', 'image-to-image'].includes(p.mode)) throw new Error('mode 必须是 text-to-image / image-to-image');
  if (p.mode === 'image-to-image' && !refs.length) throw new Error('图生图需要 reference_images');
  if (p.mode === 'text-to-image' && refs.length) throw new Error('text-to-image 与 reference_images 冲突');
  if (p.size !== undefined && typeof p.size !== 'string') throw new Error('size 必须是字符串');
  if (p.size) p.size = p.size.toUpperCase().replace('X', 'x').replace('AUTO', 'auto');
  if (p.output_format && p.response_format && p.output_format !== p.response_format) throw new Error('output_format 与旧版 response_format 图片格式冲突');
  p.output_format = p.output_format || p.response_format;
  if (p.output_format && !['png', 'jpeg'].includes(p.output_format)) throw new Error('output_format 必须是 png / jpeg（返回方式固定 url）');
  if (p.background !== undefined && !['opaque', 'transparent'].includes(p.background)) throw new Error('background 必须是 opaque / transparent');
  if (p.optimize_prompt_mode !== undefined && !['standard', 'fast'].includes(p.optimize_prompt_mode)) throw new Error('optimize_prompt_mode 必须是 standard / fast');
  if (p.reference_strength !== undefined) throw new Error('当前执行器未定义 reference_strength，请移除此参数');
  const preciseEdit = p.interactive_edit || /<(bbox|point)>/i.test(prompt);
  if (!p.layer_decomposition && !prompt.trim()) throw new Error('prompt 不能为空');
  if (prompt.length > 3000) throw new Error('prompt 长度不能超过 3000 字符（本 skill 限制）');
  if (preciseEdit && !refs.length) throw new Error('交互编辑需要参考图');
  if (p.layer_decomposition && refs.length !== 1) throw new Error('图层拆分必须且只能传 1 张参考图');
  if (p.layer_decomposition && p.count !== 1) throw new Error('图层拆分不通过 count 指定图层数');
  if (p.background === 'transparent') {
    if (refs.length !== 1) throw new Error('透明背景编辑需要 1 张带透明通道的参考图');
    if (p.output_format === 'jpeg') throw new Error('透明背景不能使用 jpeg');
    if (/^data:image\/jpe?g;/i.test(refs[0]) || /\.jpe?g(?:\?|$)/i.test(refs[0])) throw new Error('透明背景输入不能是 JPEG；需要实际带透明通道的图片');
  }
  if (p.layer_decomposition && refs.some(r => /^data:image\/(?!png;|jpeg;)/i.test(r))) throw new Error('拆图输入仅支持 png/jpeg');
  if (typeof p.extra_params === 'string') p.extra_params = JSON.parse(p.extra_params);
  p.extra_params = p.extra_params ?? {};
  if (!p.extra_params || typeof p.extra_params !== 'object' || Array.isArray(p.extra_params)) throw new Error('extra_params 必须是 JSON 对象');
  if (specified) {
    checkAvailable(registry, specified.model_id);
    p = applyModel(p, specified, refs, preciseEdit);
    p.routing_reason = '显式模型选择';
  } else {
    const highPrecision = /高精度|高画质|画质优先|印刷排版/.test(prompt);
    const priority = highPrecision ? 'quality_priority' : 'priority';
    const candidates = registry.models.filter(m => compatible(m) && !registry.unavailable_models?.[m.model_id]).sort((a,b) => a[priority] - b[priority] || a.model_id.localeCompare(b.model_id));
    const errors = [];
    let match;
    for (const m of candidates) {
      try { match = applyModel(p, m, refs, preciseEdit); break; }
      catch (error) { errors.push(error.message); }
    }
    if (!match) {
      if (registry.models.some(m => compatible(m) && registry.unavailable_models?.[m.model_id]) && !candidates.length) throw new Error('当前账号的候选模型暂不可用；不判定产品下线');
      throw routeError(`当前配置没有兼容模型：${errors.join('；') || '所有模型已下线或需要新版执行器'}。不会忽略远端限制或自动切回内置模型`, `requirements:${errors.join(';')}`);
    }
    p = match;
    p.routing_reason = highPrecision ? '满足能力约束后的高画质优先级' : '满足能力约束后的默认优先级';
  }
  p.response_format = p.output_format;
  p.optimize = p.optimize ?? !(p.layer_decomposition || preciseEdit || p.background === 'transparent');
  p.reference_images = refs.length ? JSON.stringify(refs) : undefined;
  return p;
}

function buildRequestBody(p) {
  const body = { model: p.model, size: p.size, response_format: 'url', output_format: p.output_format, watermark: p.watermark !== false };
  if (p.prompt !== undefined && p.prompt !== '') body.prompt = p.prompt;
  const refs = references(p.reference_images);
  if (refs.length) body.image = refs.length === 1 ? refs[0] : refs;
  if (p.layer_decomposition !== undefined) body.layer_decomposition = p.layer_decomposition;
  if (p.background !== undefined) body.background = p.background;
  if (p.optimize_prompt_mode) body.optimize_prompt_options = { mode: p.optimize_prompt_mode };
  const caps = p._model.capabilities;
  if (caps.includes('sequential')) body.sequential_image_generation = p.sequential ? 'auto' : 'disabled';
  if (caps.includes('stream')) body.stream = p.stream;
  if (p.enable_web_search) body.tools = [{ type: 'web_search' }];
  // AgentPlan group count is guided by the prompt, never a post-paid max_images field.
  return { ...body, ...p._extra };
}

function outputDetails(item, p) {
  const format = item.output_format || (p.layer_decomposition && item.z_index > 0 ? 'png' : p.output_format);
  const details = { output_format: format };
  for (const key of ['z_index', 'bounding_box', 'name', 'description', 'size']) {
    if (item[key] !== undefined) details[key] = item[key];
  }
  return details;
}

module.exports = { FLASH, PRO, isRetiredModel, prepareParams, buildRequestBody, outputDetails };
