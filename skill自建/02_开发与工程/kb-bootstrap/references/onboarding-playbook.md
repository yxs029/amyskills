# 五库打通 Onboarding Playbook（Agent 可执行版）

> 配套 `kb-bootstrap`。每库给：判态 → 接入 → 授权链接取法 → 验收只读命令 → 坑 → 续期。
> 总原则：密钥只进凭证文件（600/700）/keychain；需要人点的链接由 agent 生成后转交，不代点；写操作先确认、完成回读。

---

## ① Get笔记（biji 剪藏采集箱）

- 判态：healthcheck `[OK]` / `[!!]`；凭证 `~/.openclaw/openclaw.json`。
- 凭证字段：`skills.entries.getnote.apiKey`（`gk_live_...`）、`...env.GETNOTE_CLIENT_ID`（`cli_...`）。
- 接入：通常开箱即用。缺凭证时让用户经安全通道提供，落 openclaw.json 后 `chmod 600`。
- 验收：
  ```python
  import json,urllib.request
  d=json.load(open('/home/aaronmy/.openclaw/openclaw.json'))['skills']['entries']['getnote']
  r=urllib.request.Request("https://openapi.biji.com/open/api/v1/resource/knowledge/list",
    headers={"Authorization":d['apiKey'],"X-Client-ID":d['env']['GETNOTE_CLIENT_ID']})
  print(len(json.loads(urllib.request.urlopen(r,timeout=20).read())['data']['topics']))
  ```
- 坑：int64 ID（note_id/next_cursor）JS 丢精度→当字符串，优先 Python；响应 content 可能含未转义换行；link/img 笔记异步需轮询 `/note/task/progress`；重复链接返回 `duplicate_count>0` 无 task_id。
- 续期：apiKey 由 openclaw/平台侧管理，失效时让用户在 Get笔记开放平台重取。

## ② IMA 腾讯（笔记 + 知识库）

- 判态：healthcheck 看 `code:0`；401 报 `auth failed/200002` 即凭证失效。
- 接入：
  1. 用户从 https://ima.qq.com/agent-interface 复制 Client ID(32hex)、API Key(76base64)。
  2. `umask 077; printf %s "$CID" > ~/.config/ima/client_id; printf %s "$AK" > ~/.config/ima/api_key`（不要尾随换行也可，curl 直接 cat）。
  3. curl 验收（**apiPath 必须带 `v1`**）：
     ```bash
     curl -s -X POST https://ima.qq.com/openapi/note/v1/list_notebook \
       -H "Content-Type: application/json" \
       -H "ima-openapi-clientid: $(cat ~/.config/ima/client_id)" \
       -H "ima-openapi-apikey: $(cat ~/.config/ima/api_key)" \
       -d '{"cursor":"0","limit":1}'
     ```
- 坑：官方 `ima_api.cjs` 会静默空返回（exit0 无 stdout，更新检查卡死）→ **一律 curl**；漏 `v1` → `trpc-func-ret:1002`+404；写入非 UTF-8 → 中文永久乱码；上传文件名 title 必须等于原名且不改扩展名；不支持视频/B站/YouTube/file://。
- 续期：有效期 1 年（当前至 2027-09-20），到期前 1 月提醒重取。

## ③ 中国移动云盘（纯文件）

- 入口脚本：`~/.hermes/skills/@org-vt43r0t0/cm-cloud-manage/scripts/main.py`（记为 `$CM`）。
- 接入（login 是同步命令，无需 PTY）：
  1. `python3 "$CM" login` → 返回 `need_auth` + `loginUrl`。
  2. 把 `loginUrl` 原样发用户点击授权（链接 5–10 分钟过期）。
  3. **再跑一次 `python3 "$CM" login` 换票确认**（不是重发旧 URL）。若仍 need_auth，重跑生成新链接再来；本次第 3 次成功。
  4. 验收：`python3 "$CM" list / --limit 3`。
- 沙箱：写操作仅限 `/AI空间/智能体云盘助手`；沙箱外文件先 `copy` 进沙箱再 `download`。
- 坑：除根 `/` 外一律用接口返回 fileId，不手打路径；分页 `--cursor '<上页 meta.cursor 整段>'`；session cookie 非长期密钥，`need_auth` 即重登。
- 续期：无固定期，报 need_auth 时 1 分钟重登。

## ④ 一堂 WHYAI（课程笔记/方法论）

- 判态：`whyai status --json` 看 `logged_in` 与 user.nickname。
- 接入：未登录 `whyai login` 走浏览器 SSO。
- 验收：`whyai --json notes list`（全局 `--json` 放子命令前）能取全量（约 100+ 篇）。
- 坑：没有独立"一堂CLI"，就是 `whyai`（`yitang|yt` 是别名）；`notes list` 不支持搜索→全量落盘 Python 过滤 title/content；content 是 HTML→`re.sub('<[^>]+>','',c)`+`html.unescape`；别误串到 chat/conversations/files/memories。
- 续期：SSO 过期再 `whyai login`。

## ⑤ 飞书 lark-cli（协作文档/云空间/wiki）

- 命令位置 `~/.npm-global/bin/lark-cli`；config `~/.lark-cli/config.json`，secret 在 keychain（勿从 json 读 secret）。
- **两步授权，两个交互命令都必须 `background=true + pty=true`**（否则静默无输出/exit143）：

  Step 1 建应用：
  ```
  terminal(background=true, pty=true, command="lark-cli config init --new --lang zh")
  process(action='wait', timeout=20)
      → 从输出提取 https://open.feishu.cn/page/cli?user_code=XXXX 发用户
      → 用户在页面完成，进程自动退出；poll 见 "App ID: cli_xxx"
  ```
  Step 2 用户授权（独立、不自动完成）：
  ```
  terminal(background=true, pty=true, command="lark-cli auth login --domain docs,drive,wiki 2>&1")
  process(action='wait', timeout=15)
      → 提取 https://accounts.feishu.cn/oauth/v1/device/verify?...&user_code=XXXX 发用户
      → 用户点完进程自动退出，stdout 列新授 scopes
  ```
- 身份：个人云空间/文档必须 `--as user`（bot 看不到个人资源）。验收：
  `lark-cli api GET /open-apis/drive/explorer/v2/root_folder/meta --as user` 返回 `code:0`。
- 坑：被 kill 进程的旧 user_code 链接作废，只认当前存活进程；scope 增量不覆盖（加域再 auth login）；应用被删报 `10217`→重建；当前缺 `search:docs:read`、`space:document:retrieve`，需搜索时让用户补勾；危险写删先 `--dry-run`。
- 续期：应用删除→重建两步；user token 失效→重跑 auth login。

---

## 打通总验收（Definition of Done）

1. `bash scripts/kb-healthcheck.sh` 5 行全 `[OK]`。
2. `bash scripts/post-bootstrap-check.sh` 退出码 0（权限/泄漏/每库回读全过）。
3. 每库至少一条只读回读证据：Get笔记知识库数、IMA notebook、云盘根目录、whyai 笔记数、飞书 root_folder。
4. 对话与交付物零明文密钥；凭证 600/700。
5. 告知用户后续读写加载 `kb-router`，模糊来源先问不猜库。

## 推荐执行顺序（减少用户等待）

先跑 healthcheck → 4 个无需人工的（Get/IMA落盘后curl/whyai）并行处理 → 3 个人工链接（云盘login、飞书config init、飞书auth login）一次性收集后集中发用户 → 用户点完统一换票/验收 → 跑门禁。
