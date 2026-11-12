# dsh-local-otagent-sidebar

在 DeepSeek Harness Web GUI 的侧栏里，增加 `hermes` / `openclaw` 两个入口，
通过标准 ACP 协议驱动本机这两个 agent，可开多个会话、流式收消息、发文件，
并支持局域网访问（沿用 GUI 自身的口令，不新增端口）。

> 当前为 **Plan 2：聊天界面**。侧栏两个入口 = 可折叠会话树 + 聊天视图：
> 打字发送、回复逐段流式渲染、拖附件上传（openclaw 图片直发 / hermes 资源引用）、
> 会话改名/关闭/切换互不串台。共享黑板与派活协议在 Plan 3。
> 设计文档：`docs/superpowers/specs/2026-11-11-otagent-sidebar-design.md`（人读版）
> 与 `...-技术版.md`（施工者版）；实施计划：`docs/superpowers/plans/2026-11-11-core-bridge.md`。

## 目录结构

```
src/
  config.ts          schemastery 配置（两条 agent 命令、超时、协作、上传）
  store.ts           会话名册 + 消息日志（DSH_HOME/otagent/，原子写，权威真相源）
  acp-connection.ts  ACP 封装：spawn / ndjson / initialize 握手 / 超时 / 能力门控
  manager.ts         进程池（一 agent 一连接）、per-session 串行队列、生命周期、转交
  stream.ts          SSE 按会话定向订阅（不广播）
  routes.ts          同源 /api/otagent/* 路由 + requestRejection 验票
  index.ts           Host 插件入口 apply/inject/name/Config
  shared.ts          PANEL_IDS（host / client 共用）
  client/            client bundle（面板行 + 占位主面板）
scripts/
  wrap-client.mjs    把 tsdown IIFE 包成 window.__ModuleLoader__.load 形状
  smoke.mjs          端到端冒烟脚本
tests/               vitest（41 个测试）
```

## 构建

```bash
cd /home/aaronmy/dsh-workspace/hermesSidebar
export PATH=/usr/local/n/versions/node/24.14.1/bin:$PATH
pnpm install
pnpm verify          # = build + typecheck + test
```

产物：`lib/index.mjs`（host）、`lib/client.js`（浏览器 bundle）。

## 安装进 web profile

```bash
cd /home/aaronmy/cece-workspace/dsh-sandbox
export PATH=/usr/local/n/versions/node/24.14.1/bin:$PATH
node node_modules/@deepseek-ai/dsh/lib/bin.js \
  plugin --profile web add file:/home/aaronmy/dsh-workspace/hermesSidebar
```

`dsh plugin` 会自动把包名写进 `data/profiles/web/package.json` 的
`dsh.profile.bundles`（无需手改）。本机没有 `apps/web` 源码、也没有
`dev:web` watcher，所以改动浏览器部分必须「重新构建 → 重启 host → 刷新页面」。

## 启停 dsh web（按 MANUAL.md）

```bash
# 停
PID=$(pgrep -f "dsh/lib/bin.js" | head -1); kill $PID; sleep 5

# 起（stdout 必须重定向到文件，否则拿不到 token）
cd /home/aaronmy/cece-workspace/dsh-sandbox
export PATH=/usr/local/n/versions/node/24.14.1/bin:$PATH
export DSH_HOME=/home/aaronmy/cece-workspace/dsh-sandbox/data
export DSH_TELEMETRY_MODE=DISABLED
node node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile web --patch web-volcengine.yml --patch web-local.yml \
  > data/web.log 2>&1 &
sleep 8
grep "dsh web:" data/web.log      # 拿带 token 的访问 URL
```

访问：`http://192.168.0.190:3080/?token=<最新>`（局域网同网段可开）。

## 冒烟

```bash
cd /home/aaronmy/dsh-workspace/hermesSidebar
export PATH=/usr/local/n/versions/node/24.14.1/bin:$PATH
node scripts/smoke.mjs
# 或显式给带 token 的地址：node scripts/smoke.mjs "http://192.168.0.190:3080?token=xxx"
```

它会自动从 `data/web.log` 取最新 token，**先用 `GET /?token=` 换到
`dsh-auth-*` 签名 cookie**（303 + set-cookie），之后所有 `/api/*` 请求都带
`Cookie` 头。⚠️ `?token=` 只在首页有效，直接拼到 API URL 上会 401（浏览器靠
`credentials:same-origin` 自动带 cookie，所以 GUI 不受影响）。
随后依次验证 agent 列表、建会话、发消息、SSE、取消、关闭，逐步打印 PASS/FAIL。
**SSE 帧数在 Plan 1 只作 INFO 输出**（Hermes 冷启动 10~24s，且聊天渲染属 Plan 2），不会误报失败。

## 已知坑（实机验证，别踩）

- **P-01** OpenClaw **不要注入 `OPENCLAW_GATEWAY_TOKEN` 环境变量**：会触发网关
  `scope upgrade pending approval`，connect 阶段直接失败。命令必须带
  `--url ws://127.0.0.1:18789`，token 由 `~/.openclaw/openclaw.json` 提供。
- **P-02** Hermes 冷启动 **10~24 秒**（`minimax_search` MCP 缺 `uvx` 重试 3 次），
  `initTimeoutMs` 默认 30000，别调到 8 秒。
- **P-03** Hermes 的 `session/list` 不登记新建会话 → 会话名册以插件自有的
  `sessions.json` 为权威。
- **P-04** Hermes 声明 `image:true` 但实现会忽略非文本块 → 发文件一律变成
  「附件路径文字」，界面不承诺图片视觉输入。
- **P-05** 两侧 `session/new` 都必须传 `mcpServers: []`（OpenClaw 非空报错）。
- **P-06** SSE 按会话定向推，不广播（多设备不串台）。
- **P-07** 别去占 `sidebar.workspaces`（single slot + 动态插件负 priority，
  会顶掉整棵工作区树）。入口用 `sidebar.panellist` + `main` 成对注册。
- **P-12** 不改 `web-local.yml` / `web-volcengine.yml` / `apps/web` 产物 /
  `openclaw.json`；不新增监听端口。

## 验收（Plan 2 范围）

- [ ] GUI 点开 hermes/openclaw：左侧会话树可折叠（刷新后记住折叠态），右侧消息流 + composer
- [ ] 「＋ 新建会话」建多个会话，状态点实时（绿=运行中）
- [ ] 输入消息 Enter 发送，回复逐段流式出现
- [ ] 「＋」选文件：openclaw 图片直发（对方真看到图）、hermes 显示「资源引用」
- [ ] 双击会话改名；切换会话互不串流
- [ ] `pnpm verify` 全绿（79 测试）

## 验收（Plan 1 范围，保留）

- [ ] `pnpm verify` 全绿（41 测试 + typecheck + build）
- [ ] `pnpm build` 产出 `lib/index.mjs` 与 `lib/client.js`，后者含
      `window.__ModuleLoader__.load`、`otagent-hermes`、`otagent-openclaw`
- [ ] 装进 profile 并重启后，GUI 侧栏出现 hermes / openclaw 两行，点开能切到占位面板，
      控制台无 `slot ... not declared` 报错
- [ ] `node scripts/smoke.mjs` 关键步骤全 PASS
- [ ] `ss -tlnp | grep 3080` 仍是唯一 3080；`ss -tlnp | grep 18789` 仍为 `127.0.0.1`
