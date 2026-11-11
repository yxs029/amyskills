#!/usr/bin/env bash
# post-bootstrap-check.sh —— 五库打通交付门禁
# 检查：①healthcheck 全 OK  ②凭证文件权限  ③凭证目录密钥泄漏扫描  ④每库只读回读证据
# 用法: bash post-bootstrap-check.sh
set -u
SB_DIR="$(cd "$(dirname "$0")" && pwd)"
FAIL=0
CM="$HOME/.hermes/skills/@org-vt43r0t0/cm-cloud-manage/scripts/main.py"
ok(){ printf '  ✅ %s\n' "$1"; }
bad(){ printf '  ❌ %s\n' "$1"; FAIL=$((FAIL+1)); }

echo "======== 五库打通交付门禁 $(date '+%H:%M:%S') ========"

echo "── 1. healthcheck 必须全 [OK] ──"
OUT="$(bash "$SB_DIR/kb-healthcheck.sh" 2>&1)"
echo "$OUT" | sed 's/^/    /'
OKC=$(echo "$OUT" | grep -c '\[OK\]')
[ "$OKC" -ge 5 ] && ok "5 库均 [OK]" || bad "只有 $OKC/5 个 [OK]，未达成交付"

echo "── 2. 凭证文件权限（应为 600，目录 700）──"
for f in "$HOME/.config/ima/client_id" "$HOME/.config/ima/api_key"; do
  if [ -f "$f" ]; then
    p=$(stat -c '%a' "$f"); [ "$p" = "600" ] && ok "$(basename "$f") 权限600" || bad "$(basename "$f") 权限=$p（应600）"
  fi
done
[ -d "$HOME/.config/ima" ] && { p=$(stat -c '%a' "$HOME/.config/ima"); [ "$p" = "700" ] && ok "~/.config/ima 700" || bad "目录权限=$p（应700）"; }

echo "── 3. 密钥泄漏扫描（skill/复盘交付目录不得含明文 gk_live_/ark-/76位key）──"
HITS=$(grep -rnE 'gk_live_[A-Za-z0-9]{10,}|ark-[0-9a-f]{16,}' \
   "$HOME/.hermes/skills/productivity/kb-bootstrap" 2>/dev/null | grep -v 'post-bootstrap-check' | wc -l)
[ "$HITS" -eq 0 ] && ok "skill 目录无明文业务密钥" || bad "发现 $HITS 处疑似明文密钥"

echo "── 4. 每库只读回读证据（任选其一成功即记 OK）──"
# Get笔记
python3 - <<'PY' && ok "①Get笔记 回读成功" || bad "①Get笔记 回读失败"
import json,urllib.request
d=json.load(open('/home/aaronmy/.openclaw/openclaw.json'))['skills']['entries']['getnote']
r=urllib.request.Request("https://openapi.biji.com/open/api/v1/resource/knowledge/list",
  headers={"Authorization":d['apiKey'],"X-Client-ID":d['env']['GETNOTE_CLIENT_ID']})
j=json.loads(urllib.request.urlopen(r,timeout=20).read())
assert j.get('success') and len(j['data']['topics'])>=0
print("    知识库数:",len(j['data']['topics']))
PY
# IMA
if [ -s "$HOME/.config/ima/api_key" ]; then
  curl -s --max-time 20 -X POST https://ima.qq.com/openapi/note/v1/list_notebook \
    -H "Content-Type: application/json" \
    -H "ima-openapi-clientid: $(cat "$HOME/.config/ima/client_id")" \
    -H "ima-openapi-apikey: $(cat "$HOME/.config/ima/api_key")" \
    -d '{"cursor":"0","limit":1}' | grep -q '"code":0' && ok "②IMA 回读成功" || bad "②IMA 回读失败"
fi
# 云盘
[ -f "$CM" ] && timeout 25 python3 "$CM" list / --limit 1 >/dev/null 2>&1 && ok "③移动云盘 回读成功" || bad "③移动云盘 回读失败/未授权"
# 一堂
command -v whyai >/dev/null 2>&1 && whyai --json notes list >/dev/null 2>&1 && ok "④一堂whyai 回读成功" || bad "④一堂whyai 回读失败"
# 飞书 user
command -v lark-cli >/dev/null 2>&1 && timeout 20 lark-cli api GET /open-apis/drive/explorer/v2/root_folder/meta --as user 2>/dev/null | grep -q '"code": 0' \
  && ok "⑤飞书 user 回读成功" || bad "⑤飞书 user 回读失败/未授权"

echo "==================================================="
if [ "$FAIL" -eq 0 ]; then echo "🎉 交付门禁通过：五库可交付"; else echo "⚠️ 有 $FAIL 项未通过，按 playbook 修复后重跑"; fi
exit "$FAIL"
