#!/usr/bin/env bash
# kb-router 五库连通性体检 —— 只读操作，不打印任何密钥明文
# 用法: bash kb-healthcheck.sh
set -u

PASS='[OK] 可用'
WARN='[!!] 异常'
LOCK='[LOCK] 需授权'

GN_CFG="$HOME/.openclaw/openclaw.json"
CM="$HOME/.hermes/skills/@org-vt43r0t0/cm-cloud-manage/scripts/main.py"

echo "================================================"
echo " 五库连通性体检  $(date '+%Y-%m-%d %H:%M')"
echo "================================================"

# ① Get笔记 -------------------------------------------------
echo
echo -n "① Get笔记 : "
python3 - "$GN_CFG" <<'PY'
import json,sys,urllib.request
cfg=sys.argv[1]
try:
    d=json.load(open(cfg))['skills']['entries']['getnote']
    req=urllib.request.Request(
        "https://openapi.biji.com/open/api/v1/resource/knowledge/list",
        headers={"Authorization":d['apiKey'],
                 "X-Client-ID":d['env']['GETNOTE_CLIENT_ID']})
    j=json.loads(urllib.request.urlopen(req,timeout=20).read().decode())
    print("[OK] 可用  知识库连通，共 %d 个 (openapi.biji.com)"
          % len(j.get('data',{}).get('topics',[])) if j.get('success')
          else "[!!] 异常  业务返回失败")
except FileNotFoundError:
    print("[!!] 异常  无 %s" % cfg)
except Exception:
    print("[!!] 异常  凭证失效或网络错误")
PY

# ② IMA ------------------------------------------------------
echo
echo -n "② IMA     : "
if [ -f "$HOME/.config/ima/client_id" ] && [ -f "$HOME/.config/ima/api_key" ]; then
  IMA=$(curl -s --max-time 20 -X POST https://ima.qq.com/openapi/note/v1/list_notebook \
        -H "Content-Type: application/json" \
        -H "ima-openapi-clientid: $(cat "$HOME/.config/ima/client_id")" \
        -H "ima-openapi-apikey: $(cat "$HOME/.config/ima/api_key")" \
        -d '{"cursor":"0","limit":1}' 2>/dev/null)
  case "$IMA" in
    *'"code":0'*) echo "$PASS 笔记本连通 (ima.qq.com)" ;;
    *200002*|*'auth failed'*) echo "$LOCK 凭证失效(401)，重取: https://ima.qq.com/agent-interface" ;;
    *) echo "$WARN 返回异常: ${IMA:0:80}" ;;
  esac
else
  echo "$LOCK 缺 ~/.config/ima/client_id 或 api_key"
fi

# ③ 中国移动云盘 ---------------------------------------------
echo
echo -n "③ 移动云盘: "
if [ -f "$CM" ]; then
  CLOUD=$(timeout 25 python3 "$CM" list / --limit 1 2>&1)
  case "$CLOUD" in
    *need_auth*|*未登录*) echo "$LOCK 未授权 → python3 $CM login (取 loginUrl 发老大)" ;;
    *error*) echo "$WARN 接口报错: ${CLOUD:0:80}" ;;
    *) echo "$PASS 已授权 (沙箱 /AI空间/智能体云盘助手)" ;;
  esac
else
  echo "$WARN 脚本缺失: $CM"
fi

# ④ 一堂 WHYAI -----------------------------------------------
echo
echo -n "④ 一堂whyai: "
if command -v whyai >/dev/null 2>&1; then
  if whyai status --json 2>/dev/null | grep -q '"logged_in": true'; then
    NICK=$(whyai status --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['nickname'])" 2>/dev/null)
    echo "$PASS 已登录 ($NICK)，notes / note-folders 可用"
  else
    echo "$LOCK 未登录 → whyai login (一堂浏览器SSO)"
  fi
else
  echo "$WARN whyai CLI 未安装"
fi

# ⑤ 飞书 lark-cli --------------------------------------------
echo
echo -n "⑤ 飞书lark : "
if command -v lark-cli >/dev/null 2>&1; then
  # 先看 user 身份能否读云空间根文件夹（个人资源走 user）
  USR=$(timeout 20 lark-cli api GET /open-apis/drive/explorer/v2/root_folder/meta --as user 2>&1)
  case "$USR" in
    *'"code": 0'*)
      echo "$PASS 已授权(user 身份)，docs/drive/wiki 可读"
      ;;
    *'No user logged in'*|*'No user'*|*login*)
      # user 没授权，再看应用本身是否存在
      BOT=$(timeout 20 lark-cli api GET /open-apis/tenant/v2/tenant/query --as bot 2>&1)
      case "$BOT" in
        *10217*|*'app has been deleted'*) echo "$LOCK 应用已删除(10217) → lark-cli config init --new 重建" ;;
        *) echo "$LOCK 应用在，但 user 未授权 → lark-cli auth login --domain docs,drive,wiki" ;;
      esac
      ;;
    *10217*|*'app has been deleted'*) echo "$LOCK 应用已删除(10217) → lark-cli config init --new 重建" ;;
    *) echo "$WARN 状态未知: ${USR:0:80}" ;;
  esac
else
  echo "$WARN lark-cli 未安装"
fi

echo
echo "================================================"
echo " [LOCK]=需老大配合授权一次  [!!]=需修复  [OK]=可直接调用"
echo " 本脚本只显示状态，绝不输出密钥明文。"
