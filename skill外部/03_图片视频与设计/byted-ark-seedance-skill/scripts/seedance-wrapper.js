#!/usr/bin/env node

// Seedance task workflow: one validated registry snapshot per creation.
// Model data belongs in the published registry; task lookup remains independent.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateTaskId, validateApiBase } = require('./seedance-security');
const { prepareForOptions, prepareRequest, registryForOptions, createClient, maybeDownloadTaskOutputs, parseArgv, parseBoolean, sanitizePayloadForStorage } = require('./seedance');
const { BUILTIN, listModels } = require('./model-registry');
const { resolveModel } = require('./model-routing');

const PENDING_FILE = path.join(__dirname, '..', '.pending-tasks.json');
const PREFERENCE_FILE = path.join(__dirname, '..', '.user-preference.json');
const CLI_SCRIPT = path.join(__dirname, 'seedance.js');

// ============================================
// 👤 用户偏好管理
// ============================================
function loadPreferences() {
  if (!fs.existsSync(PREFERENCE_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(PREFERENCE_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function savePreferences(prefs) {
  const tmpFile = `${PREFERENCE_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(prefs, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.renameSync(tmpFile, PREFERENCE_FILE);
}

// ============================================
// 🛠️ 参数工具函数
// ============================================

// 从 args 数组中移除指定参数及其值
function removeArgPair(args, argName) {
  const index = args.indexOf(argName);
  if (index !== -1) {
    const next = args[index + 1];
    const deleteCount = next && !next.startsWith('--') ? 2 : 1;
    args.splice(index, deleteCount);
  }
  return args;
}

// 展开 ~ 开头的路径
function expandHome(p) {
  const os = require('os');
  const home = os.homedir();
  if (p === '~') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  return p;
}

// 下载目录三级 fallback
function getDefaultDownloadDir() {
  const os = require('os');
  const home = os.homedir();
  const desktop = path.join(home, 'Desktop');
  
  const paths = [
    process.env.ARK_SEEDANCE_SAVE_PATH ? path.resolve(expandHome(process.env.ARK_SEEDANCE_SAVE_PATH)) : null,
    fs.existsSync(desktop) ? path.join(desktop, 'Seedance-Videos') : null,
    path.join(home, 'Seedance-Videos'),
    path.join(process.cwd(), 'Seedance-Videos'),
  ].filter(Boolean);
  
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
      fs.accessSync(p, fs.constants.W_OK);
      return p;
    } catch (e) {
      continue;
    }
  }
  return paths[paths.length - 1];
}

// Resolve only when output is needed; help and rejected requests must not create folders.
let defaultDownloadDir;
function downloadRoot() {
  return defaultDownloadDir ||= getDefaultDownloadDir();
}

// 参数格式兼容：自动把 --key=value 拆分成 --key value
function expandEqualsArgs(args) {
  const result = [];
  for (const arg of args) {
    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, ...rest] = arg.split('=');
      result.push(key, rest.join('='));
    } else {
      result.push(arg);
    }
  }
  return result;
}

// 参数命名兼容层
function normalizeArgs(args) {
  args = expandEqualsArgs(args);
  
  const argMap = {
    '--generate_audio': '--generate-audio',
    '--service_tier': '--service-tier',
    '--enable_web_search': '--enable-web-search',
    '--reference_images': '--image-file',
    '--reference_video': '--video-file',
    '--reference_audio': '--audio-file',
    '--api_key': '--api-key',
    '--user_id': '--user-id',
    '--task_id': '--task-id',
    '--return_last_frame': '--return-last-frame',
    '--camera_fixed': '--camera-fixed',
    '--callback_url': '--callback-url',
    '--payload_file': '--payload-file',
    '--base_url': '--base-url',
    '--save_api_key': '--save-api-key',
    '--save_model_preference': '--save-model-preference',
    '--speed_preference': '--speed-preference',
    '--omni_reference_task_type': '--omni-reference-task-type',
    '--output_format': '--output-format',
    '--image_role': '--image-role',
    '--extra_params': '--extra-params',
    '--refresh_models': '--refresh-models',
    '--offline_models': '--offline-models',
    '--quality_preference': '--quality-preference',
  };
  return args.map(arg => argMap[arg] || arg);
}

// 安全 JSON 解析
function safeJSONParse(stdoutStr) {
  try {
    return JSON.parse(stdoutStr);
  } catch (e) {
    const firstBrace = stdoutStr.indexOf('{');
    const lastBrace = stdoutStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(stdoutStr.substring(firstBrace, lastBrace + 1));
      } catch (err) {
        throw new Error('截取后依然无法解析 JSON');
      }
    }
    throw e;
  }
}

// 获取 args 中某个参数的值
function getArgValue(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  const val = args[idx + 1];
  if (!val || val.startsWith('--')) return null;
  return val;
}

// 判断 args 中是否包含某个参数（布尔参数）
function hasArg(args, key) {
  const idx = args.indexOf(key);
  if (idx === -1) return false;
  // 检查后面是否跟着 false
  const next = args[idx + 1];
  if (next && !next.startsWith('--') && (next === 'false' || next === '0')) return false;
  return true;
}

// ============================================
// 📋 待办任务管理（与 v2 相同）
// ============================================
function ensurePendingFile() {
  if (!fs.existsSync(PENDING_FILE)) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify([], null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  }
}

function getPendingTasks() {
  ensurePendingFile();
  return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
}

function savePendingTasks(tasks) {
  const tmpFile = `${PENDING_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.renameSync(tmpFile, PENDING_FILE);
}

function addPendingTask(taskId, prompt, model) {
  const tasks = getPendingTasks();
  tasks.push({
    task_id: taskId,
    prompt: prompt,
    model: model,
    created_at: Date.now(),
  });
  savePendingTasks(tasks);
  console.log(`✅ 任务 ${taskId} 已加入待办列表`);
}

function removePendingTask(taskId) {
  const tasks = getPendingTasks();
  const newTasks = tasks.filter(t => t.task_id !== taskId);
  if (newTasks.length !== tasks.length) {
    savePendingTasks(newTasks);
    console.log(`✅ 任务 ${taskId} 已从待办列表移除`);
  }
}

// ============================================
// 🔧 底层 CLI 调用
// ============================================
function execCLI(args, { silent = false } = {}) {
  const childArgs = [...args], env = {...process.env};
  const keyIndex = childArgs.indexOf('--api-key');
  if (keyIndex >= 0 && childArgs[keyIndex + 1]) {
    env.ARK_SEEDANCE_TEMP_API_KEY = childArgs[keyIndex + 1];
    childArgs.splice(keyIndex, 2);
  }
  const result = spawnSync(process.execPath, [CLI_SCRIPT, ...childArgs], {
    encoding: 'utf8',
    env,
  });
  
  if (!silent) {
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
  
  return result;
}

function parseTaskIdFromOutput(output) {
  const match = output.match(/"id":\s*"(cgt-[^"]+)"/);
  if (match) return validateTaskId(match[1]);
  
  const match2 = output.match(/Created task:\s*(cgt-\S+)/);
  if (match2) return validateTaskId(match2[1]);
  
  return null;
}

// ============================================
// ✅ 偏好设置空转处理
// ============================================
//
// 当用户只说"以后都用 seedance 2.0"而没有 prompt 时，
// 只保存偏好，不报错。
//
function handleSavePreference(args, registry=BUILTIN) {
  const modelId = getArgValue(args, '--save-model-preference');
  const userId = getArgValue(args, '--user-id') || 'default';
  
  if (!modelId) return false; // 没有偏好参数，继续正常流程
  
  // 清除偏好
  if (modelId === 'none' || modelId === 'clear') {
    const prefs = loadPreferences();
    delete prefs[userId];
    savePreferences(prefs);
    console.log(JSON.stringify({
      status: 'success',
      message: '已清除您的模型偏好设置，后续将自动选择最佳模型。'
    }));
    return true;
  }
  
  const model=resolveModel(modelId,registry);
  // 保存偏好
  const prefs = loadPreferences();
  prefs[userId] = {
    preferred_model: model.model_id,
    updated_at: new Date().toISOString()
  };
  savePreferences(prefs);
  
  // 空转模式：没有 prompt 时只保存偏好
  if (!hasArg(args, '--prompt') && !hasArg(args, '--payload-file')) {
    console.log(JSON.stringify({
      status: 'success',
      message: `已成功保存模型偏好: ${model.display_name}（${modelId}）。后续生成视频时将优先使用此模型。如需清除，请告诉我「取消模型偏好」。`
    }));
    return true;
  }
  
  return false; // 有 prompt，继续正常流程
}

// ============================================
// 🖼️ 格式化输出
// ============================================
function formatTaskStatus(taskDetail, pendingInfo, downloadDir) {
  const statusMap = {
    'queued': '排队中',
    'running': '生成中',
    'succeeded': '成功',
    'failed': '失败',
    'cancelled': '已取消',
    'expired': '已过期',
  };
  
  const status = taskDetail.status || 'unknown';
  const prompt = pendingInfo?.prompt || taskDetail.request?.content?.[0]?.text || '(无提示词)';
  const elapsed = pendingInfo ? Math.floor((Date.now() - pendingInfo.created_at) / 1000 / 60) : null;
  
  const result = {
    success: status === 'succeeded',
    task_id: taskDetail.id,
    prompt: prompt,
    model: pendingInfo?.model || taskDetail.model || 'unknown',
    status: status,
    status_text: statusMap[status] || status,
    elapsed_minutes: elapsed ? Math.max(1, Math.floor(elapsed)) : null,
  };
  
  if (status === 'succeeded' && taskDetail.content) {
    if (taskDetail.duration) {
      result.duration_seconds = taskDetail.duration;
    }
    
    if (taskDetail.downloads && taskDetail.downloads.length > 0) {
      result.downloads = taskDetail.downloads.map(dl => ({
        type: dl.type || 'video',
        url: dl.url,
        local_path: dl.local_path,
        download_success: dl.download_success,
        download_error: dl.download_error || null,
      }));
    }
    
    if (taskDetail.usage?.completion_tokens) {
      result.tokens_used = taskDetail.usage.completion_tokens;
    }
  }
  
  if (status === 'failed' && taskDetail.error) {
    result.error = {
      code: taskDetail.error.code,
      message: taskDetail.error.message,
    };
  }
  
  return JSON.stringify(result, null, 2);
}

// Create against one validated registry snapshot, then manage the returned task.
async function handleCreate(args) {
  args = normalizeArgs(args);
  const initialOptions = parseArgv(['create', ...args]).options;
  const dryRun = parseBoolean(initialOptions.dryRun, false);
  if (dryRun && (initialOptions.saveModelPreference !== undefined || parseBoolean(initialOptions.saveApiKey, false))) {
    throw new Error('--dry-run 不允许同时保存模型偏好或 API Key');
  }
  if (initialOptions.saveModelPreference !== undefined) {
    const loaded = await registryForOptions(initialOptions);
    if (handleSavePreference(args, loaded.registry)) return;
  }
  const userId=initialOptions.userId || 'default';
  const preferredModel=loadPreferences()[userId]?.preferred_model;
  const { loaded, prepared }=await prepareForOptions(initialOptions,{
    preferredModel, speedPreference:initialOptions.speedPreference, qualityPreference:initialOptions.qualityPreference
  });
  const finalModel=prepared.selected_model;
  const payload=prepared.payload;
  const apiBase=validateApiBase(initialOptions.baseUrl || process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com');
  if (dryRun) {
    console.log(JSON.stringify({dry_run:true,registry:loaded.metadata,selected_model:finalModel,api_model:payload.model,
      routing_reason:prepared.routing_reason,model_change_reason:prepared.model_change_reason,
      endpoint:`${apiBase}/api/plan/v3/contents/generations/tasks`,request:sanitizePayloadForStorage(payload)},null,2));
    return;
  }
  console.log(JSON.stringify({registry:loaded.metadata,selected_model:finalModel,routing_reason:prepared.routing_reason,
    model_change_reason:prepared.model_change_reason}));

  // 5️⃣ 预判任务是否适合一开始就走异步
  const explicitWait = initialOptions.wait === undefined ? null : parseBoolean(initialOptions.wait);
  const shouldStartAsync = (() => {
    if (explicitWait !== null) return !explicitWait;
    const duration = payload.duration;
    const resolution = payload.resolution;
    const serviceTier = payload.service_tier;
    const hasVideoRef = payload.content.some(x=>x.type==='video_url');
    const hasAudioRef = payload.content.some(x=>x.type==='audio_url');
    if (duration > 10) return true;
    if (resolution === '1080p' || resolution === '4k') return true;
    if (hasVideoRef || hasAudioRef) return true;
    return false;
  })();
  
  const shouldWait = explicitWait === true;
  
  const prompt = getArgValue(args, '--prompt') || '';
  
  for(const [name,value] of [['timeout-sec',initialOptions.timeoutSec],['poll-interval',initialOptions.pollInterval]]) {
    if(value!==undefined && (!Number.isFinite(Number(value)) || Number(value)<=0 || Number(value)>86400)) throw new Error(`${name} 必须为 0 到 86400 之间的正数`);
  }
  // Submit exactly the validated request, without a second registry read or routing pass.
  const client=await createClient({...initialOptions,registry:loaded.registry});
  const response=await client.createTask(payload);
  const taskId=parseTaskIdFromOutput(JSON.stringify(response));
  if(!taskId) throw new Error('无法解析任务 ID，任务可能已创建但未加入待办列表；不要自动重复提交');

  // 立即写 pending，确保不管后续是否超时/被杀，任务都不会丢
  addPendingTask(taskId, prompt, finalModel);
  
  const createdAt=Date.now();
  if(shouldStartAsync) {
    console.log(JSON.stringify({status:'pending',task_id:taskId,model:finalModel,message:'任务已提交；使用 get 或 check-pending 查询，尚未配置自动通知。'},null,2));
    return;
  }
  const timeoutSec=Number(initialOptions.timeoutSec ?? (shouldWait?1200:300));
  const intervalSec=Number(initialOptions.pollInterval ?? 5);
  const deadline=Date.now()+timeoutSec*1000;
  while(Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,Math.min(intervalSec*1000,Math.max(0,deadline-Date.now()))));
    if(Date.now()>=deadline) break;
    let task;
    try {task=await client.getTask(taskId);} catch(error) {console.error(error.message);continue;}
    if(!['succeeded','failed','cancelled','expired'].includes(task.status)) continue;
    if(task.status==='succeeded') {
      const taskDir=path.join(downloadRoot(),validateTaskId(taskId));
      fs.mkdirSync(taskDir,{recursive:true});
      // Status polling never downloads media. Download the completed response once,
      // using the media timeout rather than the old 10-second polling timeout.
      await maybeDownloadTaskOutputs(task,taskDir);
      fs.writeFileSync(path.join(taskDir,'task.json'),JSON.stringify(task,null,2),{mode:0o600});
    }
    removePendingTask(taskId);
    console.log(formatTaskStatus(task,{task_id:taskId,prompt,model:finalModel,created_at:createdAt}));
    return;
  }
  console.log(JSON.stringify({status:'pending',task_id:taskId,model:finalModel,message:'等待超时，已保留待办；使用 get 或 check-pending 查询。'},null,2));
}

// ============================================
// 📋 handleGet / handleCheckPending / handleList / handleDelete
// （与 v2 相同，略作兼容性微调）
// ============================================
async function handleGet(args) {
  args = normalizeArgs(args);

  let downloadDir;
  const dirIndex = args.indexOf('--download-dir');
  const taskIdIndex = args.indexOf('--task-id');
  const taskId = taskIdIndex !== -1 ? args[taskIdIndex + 1] : 'unknown';

  if (dirIndex !== -1) {
    downloadDir = args[dirIndex + 1];
  } else {
    downloadDir = path.join(downloadRoot(), validateTaskId(taskId));
    args.push('--download-dir', downloadDir);
  }

  const result = execCLI(['get', ...args], { silent: true });
  
  if (result.status !== 0) {
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status);
  }
  
  let taskDetail;
  try {
    taskDetail = safeJSONParse(result.stdout);
  } catch (e) {
    console.log(`⚠️ 无法解析任务状态`);
    return;
  }
  
  const pendingTasks = getPendingTasks();
  const pendingInfo = pendingTasks.find(t => t.task_id === taskDetail.id);
  
  console.log('');
  console.log(formatTaskStatus(taskDetail, pendingInfo, downloadDir));
  console.log('');
  
  const status = taskDetail.status;
  if (['succeeded', 'failed', 'cancelled', 'expired'].includes(status)) {
    removePendingTask(taskDetail.id);
  }
}

async function handleCheckPending(args = []) {
  args = normalizeArgs(args);
  
  const pendingTasks = getPendingTasks();
  
  if (pendingTasks.length === 0) {
    console.log('📭 没有待完成的任务');
    return;
  }
  
  const completedTasks = [];
  const inProgressTasks = [];
  
  for (const pendingTask of pendingTasks) {
    const taskDownloadDir = path.join(downloadRoot(), validateTaskId(pendingTask.task_id));
    
    const result = execCLI(['get', ...args, '--task-id', pendingTask.task_id, '--download-dir', taskDownloadDir], { silent: true });
    
    if (result.status !== 0) {
      console.log(`❌ 查询任务 ${pendingTask.task_id} 失败`);
      if (result.stderr) {
        console.log(`   原因: ${result.stderr.trim()}`);
      }
      continue;
    }
    
    let taskDetail;
    try {
      taskDetail = safeJSONParse(result.stdout);
    } catch (e) {
      console.log(`⚠️ 无法解析任务 ${pendingTask.task_id} 的状态`);
      continue;
    }
    
    const status = taskDetail.status;
    
    if (['succeeded', 'failed', 'cancelled', 'expired'].includes(status)) {
      completedTasks.push({ pending: pendingTask, detail: taskDetail, downloadDir: taskDownloadDir });
    } else {
      inProgressTasks.push({ pending: pendingTask, detail: taskDetail });
    }
  }
  
  if (completedTasks.length > 0) {
    for (const item of completedTasks) {
      console.log(formatTaskStatus(item.detail, item.pending, item.downloadDir));
      console.log('');
      
      removePendingTask(item.pending.task_id);
    }
  }
  
  if (inProgressTasks.length > 0) {
    const elapsedList = inProgressTasks.map(item => {
      const elapsed = Math.floor((Date.now() - item.pending.created_at) / 1000 / 60);
      return `${item.pending.task_id} - ${elapsed} 分钟`;
    });
    console.log(`⚙️ 进行中: ${inProgressTasks.length} 个（${elapsedList.join('、')}）`);
  }
}

async function handleList(args) {
  args = normalizeArgs(args);
  const result = execCLI(['list', ...args]);
  if (result.status !== 0) process.exit(result.status);
}

async function handleDelete(args) {
  args = expandEqualsArgs(args);
  args = normalizeArgs(args);
  
  let taskId;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task-id' && args[i+1]) taskId = args[i+1];
  }
  
  const result = execCLI(['delete', ...args]);
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  
  if (taskId) {
    try {
      removePendingTask(taskId);
    } catch (e) {
      // 静默失败
    }
  }
  
}

// ============================================
// 🚪 主入口
// ============================================
async function main() {
  const args = process.argv.slice(2);

  let command = 'help';
  let commandArgs = [];

  if (args.length > 0) {
    if (!args[0].startsWith('--')) {
      // 显式指定了子命令，如 create, get, list
      command = args[0];
      commandArgs = args.slice(1);
    } else {
      // 🚀 核心修复：如果 Agent 没传命令直接传参数，默认视为 create 任务
      command = 'create';
      commandArgs = args;
    }
  }

  commandArgs = normalizeArgs(commandArgs);
  const invocation = parseArgv([command, ...commandArgs]).options;
  if (parseBoolean(invocation.dryRun, false) && (command !== 'create' || invocation.saveModelPreference !== undefined || parseBoolean(invocation.saveApiKey, false))) {
    throw new Error('--dry-run 仅用于 create 预览，不允许保存配置或执行其他命令');
  }
  if (invocation.listModels || command==='list-models') {
    const loaded=await registryForOptions(invocation);
    console.log(JSON.stringify({registry:loaded.metadata,models:listModels(loaded.registry)},null,2));
    return;
  }
  if(invocation.saveModelPreference!==undefined && command!=='create') throw new Error('模型偏好设置请使用 create');

  switch (command) {
    case 'create':
      await handleCreate(commandArgs);
      break;
    case 'get':
      await handleGet(commandArgs);
      break;
    case 'check-pending':
      await handleCheckPending(commandArgs);
      break;
    case 'list':
      await handleList(commandArgs);
      break;
    case 'delete':
      await handleDelete(commandArgs);
      break;
    case 'help':
    default:
      console.log(`
Seedance Skill v6.2 - 豆包视频生成（动态模型配置）

用法:
  node seedance-wrapper.js create [options]   创建视频任务（自动模型路由）
  node seedance-wrapper.js get --task-id <id>  查询单个任务
  node seedance-wrapper.js check-pending        批量检查待办任务
  node seedance-wrapper.js list [options]       列出历史任务
  node seedance-wrapper.js list-models          查看发布模型与配置来源
  node seedance-wrapper.js delete --task-id <id> 删除任务
  node seedance-wrapper.js create --dry-run [options] 离线预览，不读取 Key、不提交任务

模型与参数:
  --model doubao-seedance-2.5         显式使用 Seedance 2.5
  --omni-reference-task-type <auto|edit|extend>
  --output-format <mp4|mov>
  --image-role <auto|reference>       1–2 张图片也可作为参考图
  --duration <seconds>                按已发布配置校验时长范围
  --refresh-models                    dry-run 时刷新飞书配置
  --offline-models                    使用有效缓存或内置配置
  --extra-params <JSON>                已发布的普通标量扩展参数
  --quality-preference <high|normal>   使用画质优先级

偏好参数:
  --save-model-preference <model-id>  设置用户偏好模型（如 doubao-seedance-2.0）
                                      传入 none/clear 清除偏好
  --speed-preference <fast|normal>    速度偏好信号（仅当用户说"快点出"时传）

模型路由机制:
  1. 已发布配置 → 有效缓存 → 内置配置，按频道隔离
  2. 显式模型优先；不兼容的旧偏好重新路由并说明原因
  3. 完整参数检查后按配置中的优先级选择；硬性规格不降级
      `.trim());
  }
}

module.exports = { normalizeArgs };

if (require.main === module) main().catch(e => {
  console.error('❌ 执行失败:', e.message);
  console.error(e.stack);
  console.error(JSON.stringify({ failure_kind: e.failureKind, registry_event: e.registryEvent, registry_check: e.registryCheck }));
  process.exit(1);
});
