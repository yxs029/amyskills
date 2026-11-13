'use strict';

const { BUILTIN, compatible, clone, validateExtraValue } = require('./model-registry');
const { assertActiveModel } = require('./seedance-model-policy');
const { validateMediaUrl } = require('./seedance-security');
const { routeError } = require('./registry-sync');
const { checkAvailable } = require('./model-availability');
const STANDARD = 'doubao-seedance-2-0-260128';
const FAST = 'doubao-seedance-2-0-fast-260128';
const MINI = 'doubao-seedance-2-0-mini-260615';
const V25 = 'doubao-seedance-2.5';
const CORE_FIELDS = new Set(['model','content','duration','resolution','ratio','output_format','generate_audio','watermark',
  'return_last_frame','camera_fixed','draft','service_tier','frames','seed','tools','omni_reference_task_type','callback_url']);

function resolveModel(id, registry = BUILTIN) {
  if (!registry.models.some(m => m.status === 'active' && (m.model_id === id || m.aliases.includes(id)))) assertActiveModel(id);
  const model = registry.models.find(m => m.model_id === id || m.aliases.includes(id));
  if (!model) throw routeError(`未知模型 ${id}；使用 list-models 查看已发布模型`, `unknown_model:${id}`);
  if (model.status === 'retired') throw new Error(`${model.display_name} 已下线，不会回退到内置同名模型`);
  if (!compatible(model)) throw new Error(`${id} 需要更新 skill 执行器（adapter=${model.adapter}, min_runtime=${model.min_runtime}）`);
  checkAvailable(registry, model.model_id);
  return model;
}

function applyModel(input, model, extra = {}) {
  const p = clone(input), c = new Set(model.capabilities), l = model.limits;
  const need = (condition, capability) => {
    if (condition && !c.has(capability)) throw routeError(`${model.display_name} 不支持 ${capability}`, `capability:${model.model_id}:${capability}`);
  };
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw new Error('extra_params 必须为 JSON 对象');
  for (const key of Object.keys(extra)) if (CORE_FIELDS.has(key) || !Object.hasOwn(model.extra_parameters,key)) throw new Error(`未声明或保留的扩展参数 ${key}`);
  for (const key of Object.keys(p)) if (!CORE_FIELDS.has(key) && !Object.hasOwn(model.extra_parameters,key)) throw new Error(`未声明的请求参数 ${key}`);
  for (const [key,value] of Object.entries(model.defaults)) if (p[key] === undefined) p[key] = value;
  p.model = model.model_id;
  for (const [name,spec] of Object.entries(model.extra_parameters)) {
    const value = Object.hasOwn(extra,name) ? extra[name] : Object.hasOwn(p,name) ? p[name] : spec.default;
    if (value === undefined) { if (spec.required) throw new Error(`缺少扩展参数 ${name}`); }
    else p[name] = validateExtraValue(value,spec,name);
  }
  if (!Array.isArray(p.content) || !p.content.length) throw new Error('content 必须是非空数组');
  const media = { image:[],video:[],audio:[] };
  let textCount=0;
  for (const item of p.content) {
    if (!item || typeof item !== 'object') throw new Error('content 项无效');
    if (item.type === 'text') {
      if (typeof item.text !== 'string' || !item.text.trim()) throw new Error('text 内容不能为空');
      textCount++; continue;
    }
    if (item.type === 'draft_task') { need(true,'draft'); continue; }
    const kind = Object.keys(media).find(k=>item.type===`${k}_url`);
    if (!kind) throw new Error('未知 content 类型');
    const url = item[`${kind}_url`]?.url;
    if (typeof url !== 'string' || !url.trim() || /^(?:file:|\/|~\/|[a-z]:\\)/i.test(url)) throw new Error(`${kind} 素材需要 URL、Base64 或素材 ID，不能使用本地路径`);
    if (/^https?:\/\//.test(url)) validateMediaUrl(url);
    else if (url.startsWith('data:')) {
      if (!new RegExp(`^data:${kind}/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$`,'i').test(url)) throw new Error(`${kind} Base64 格式或媒体类型不匹配`);
    } else if (!/^asset:\/\/[A-Za-z0-9_-]+$/.test(url)) throw new Error(`${kind} 素材必须使用公网 HTTP(S) URL、合法 Base64 或 asset://素材ID`);
    if (kind !== 'image') item.role ??= `reference_${kind}`;
    const roles = kind === 'image' ? ['first_frame','last_frame','reference_image'] : [`reference_${kind}`];
    if (!roles.includes(item.role)) throw new Error(`无效 ${kind} role`);
    if (kind === 'video' && url.startsWith('data:') && !c.has('video_base64')) throw new Error(`${model.display_name} 不支持视频 Base64，请使用可访问 URL 或素材 ID`);
    media[kind].push(item);
  }
  const first=media.image.filter(x=>x.role==='first_frame'),last=media.image.filter(x=>x.role==='last_frame');
  const refs=p.content.filter(x=>['reference_image','reference_video','reference_audio'].includes(x.role));
  const total=Object.values(media).reduce((n,items)=>n+items.length,0);
  need(!total && textCount>0,'text_to_video');
  need(first.length || last.length,'image_to_video');
  need(last.length,'start_end_frame');
  for (const kind of Object.keys(media)) {
    need(media[kind].some(x=>x.role===`reference_${kind}`),`reference_${kind}`);
    if (media[kind].length > l[`max_reference_${kind==='image'?'images':kind==='video'?'videos':'audios'}`]) throw routeError(`${model.display_name} ${kind} 素材数量超限`, `limits:${model.model_id}`);
  }
  if (l.max_reference_assets !== null && total > l.max_reference_assets) throw routeError('参考素材总数超限', `limits:${model.model_id}`);
  need(media.audio.length && !media.image.length && !media.video.length,'audio_only');
  if (first.length || last.length) {
    if (first.length!==1 || last.length>1 || refs.length) throw new Error('首尾帧模式需要一个首帧、至多一个尾帧，不能混用全模态参考');
    if (model.adapter==='seedance-task-v2.5' && p.ratio!=='adaptive') throw new Error('该执行协议首帧/首尾帧 ratio 必须为 adaptive');
  }
  if (!Number.isInteger(p.duration)) throw new Error('duration 必须为整数');
  if (!(p.duration===-1 && l.allow_auto_duration || p.duration>=l.duration_min && p.duration<=l.duration_max)) throw routeError(`${model.display_name} duration 必须是${l.allow_auto_duration?'-1 或 ':''}${l.duration_min}–${l.duration_max} 整数秒`, `limits:${model.model_id}`);
  if (!l.resolutions.includes(p.resolution)) throw routeError(`${model.display_name} 分辨率支持 ${l.resolutions.join('/')}`, `limits:${model.model_id}`);
  if (!l.ratios.includes(p.ratio)) throw routeError(`${model.display_name} ratio 不支持 ${p.ratio}`, `limits:${model.model_id}`);
  if (!l.output_formats.includes(p.output_format)) throw routeError(`${model.display_name} output_format 不支持 ${p.output_format}；MOV 需要支持此格式的模型（内置 2.5）`, `limits:${model.model_id}`);
  for (const key of ['generate_audio','watermark','return_last_frame','camera_fixed','draft']) {
    if (p[key]!==undefined && typeof p[key]!=='boolean') throw new Error(`${key} 必须是布尔值`);
    if (!['watermark','draft'].includes(key)) need(p[key]===true,key);
  }
  if (p.service_tier!==undefined && !['default','flex'].includes(p.service_tier)) throw new Error('service_tier 无效');
  if ((p.draft===true && !c.has('draft')) || (p.service_tier==='flex' && !c.has('flex_tier'))) throw new Error('当前模型不支持 draft / flex');
  need(p.service_tier==='flex','flex_tier');
  if (p.frames!==undefined) { need(true,'frame_count'); if (!Number.isSafeInteger(p.frames) || p.frames<1) throw new Error('frames 必须为正整数'); }
  if (p.seed!==undefined && !Number.isSafeInteger(p.seed)) throw new Error('seed 必须为整数');
  if (p.tools!==undefined) {
    if (!Array.isArray(p.tools) || p.tools.some(t=>!t || t.type!=='web_search' || Object.keys(t).length!==1)) throw new Error('tools 只支持 web_search');
    need(p.tools.length>0,'web_search');
  }
  if (refs.length && c.has('omni_task_type')) p.omni_reference_task_type ??= 'auto';
  if (p.omni_reference_task_type!==undefined) {
    if (!c.has('omni_task_type')) throw new Error('显式全模态任务类型需要支持该协议的模型（内置 2.5）');
    if (!['auto','edit','extend'].includes(p.omni_reference_task_type) || !refs.length) throw new Error('omni_reference_task_type 仅支持全模态参考任务的 auto/edit/extend');
    if (['edit','extend'].includes(p.omni_reference_task_type)) {
      if (!media.video.length) throw new Error('编辑/延长任务需要参考视频');
      if (p.ratio!=='adaptive') throw new Error('编辑/延长任务 ratio 必须为 adaptive');
      if (p.omni_reference_task_type==='edit' && p.duration!==-1) throw new Error('编辑任务 duration 必须为 -1');
    }
  }
  if (Buffer.byteLength(JSON.stringify(p))>l.max_request_bytes) throw new Error('请求体超过模型字节上限，请使用素材 URL 或素材 ID');
  return p;
}

function routePayload(input, registry=BUILTIN, { preferredModel, speedPreference, qualityPreference, extraParams={} }={}) {
  if (speedPreference!==undefined && !['fast','normal'].includes(speedPreference)) throw new Error('speed-preference 必须为 fast/normal');
  if (qualityPreference!==undefined && !['high','normal'].includes(qualityPreference)) throw new Error('quality-preference 必须为 high/normal');
  if (input.model && input.model!=='auto') {
    const m=resolveModel(input.model,registry);
    return {payload:applyModel(input,m,extraParams),selected_model:m.model_id,routing_reason:'显式模型选择',model_change_reason:null};
  }
  let reason;
  if (preferredModel) {
    try {
      const m=resolveModel(preferredModel,registry);
      return {payload:applyModel(input,m,extraParams),selected_model:m.model_id,routing_reason:'已保存模型偏好',model_change_reason:null};
    } catch(e) { reason=e.message; }
  }
  const priority=qualityPreference==='high'?'quality_priority':'priority';
  const candidates=registry.models.filter(m => compatible(m) && !registry.unavailable_models?.[m.model_id]).sort((a,b)=>
    (speedPreference==='fast' ? Number(b.capabilities.includes('fast_generation'))-Number(a.capabilities.includes('fast_generation')):0) ||
    a[priority]-b[priority] || a.model_id.localeCompare(b.model_id));
  const issues=[];
  for (const m of candidates) {
    try {
      const payload=applyModel(input,m,extraParams);
      return {payload,selected_model:m.model_id,routing_reason:`能力过滤后的${speedPreference==='fast'?'速度':qualityPreference==='high'?'画质':'默认'}优先级`,
        model_change_reason:reason?{preferred:preferredModel,reason,fallback_to:m.model_id}:null};
    } catch(e) {issues.push(e.message);}
  }
  if (!candidates.length && registry.models.some(m => compatible(m) && registry.unavailable_models?.[m.model_id])) throw new Error('当前账号的候选模型暂不可用；不判定产品下线');
  throw routeError(`没有可用模型满足当前需求：${issues.join('；') || '模型已下线或需要新版执行器'}。不会忽略表格限制或重新启用内置模型`, `requirements:${issues.join(';')}`);
}
module.exports={STANDARD,FAST,MINI,V25,resolveModel,applyModel,routePayload};
