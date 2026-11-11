#!/usr/bin/env bash
# detect-env.sh —— 只探测不修改：命令、凭证文件、初步待办清单
# 用法: bash detect-env.sh   （安全：只读，不发起写操作，不打印密钥）
set -u
CM="$HOME/.hermes/skills/@org-vt43r0t0/cm-cloud-manage/scripts/main.py"
TODO=0
note(){ printf '  %s\n' "$1"; }
todo(){ printf '  [待办] %s\n' "$1"; TODO=$((TODO+1)); }

echo "================================================"
echo " Aaron 五库环境探测  $(date '+%Y-%m-%d %H:%M')"
echo "================================================"

echo; echo "① Get笔记 (openapi.biji.com)"
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
  python3 - "$HOME/.openclaw/openclaw.json" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))['skills']['entries']['getnote']
    if d.get('apiKey') and d.get('env',{}).get('GETNOTE_CLIENT_ID'):
        print("  [有凭证] openclaw.json 含 apiKey + clientId（连通性以 healthcheck 为准）")
    else: print("  [待办] openclaw.json 缺 getnote.apiKey 或 GETNOTE_CLIENT_ID")
except Exception:
    print("  [待办] openclaw.json 无 getnote 条目")
PY
else todo "缺 ~/.openclaw/openclaw.json（Get笔记 apiKey+clientId）"; fi

echo; echo "② IMA (ima.qq.com)"
if [ -s "$HOME/.config/ima/client_id" ] && [ -s "$HOME/.config/ima/api_key" ]; then
  CID_LEN=$(wc -c < "$HOME/.config/ima/client_id"); AK_LEN=$(wc -c < "$HOME/.config/ima/api_key")
  note "有凭证 client_id(${CID_LEN}B)/api_key(${AK_LEN}B)（有效期与连通以 healthcheck 为准）"
else todo "缺 ~/.config/ima/client_id 或 api_key → 取 https://ima.qq.com/agent-interface 后安全落盘(chmod600)"; fi

echo; echo "③ 中国移动云盘"
if [ -f "$CM" ]; then note "官方脚本存在"; else todo "缺云盘脚本 $CM"; fi

echo; echo "④ 一堂 WHYAI"
if command -v whyai >/dev/null 2>&1; then note "whyai 已安装：$(whyai --version 2>/dev/null | head -1)"; else todo "未安装 whyai CLI"; fi

echo; echo "⑤ 飞书 lark-cli"
if command -v lark-cli >/dev/null 2>&1; then
  note "lark-cli 已安装: $(command -v lark-cli)"
  [ -f "$HOME/.lark-cli/config.json" ] && note "存在 ~/.lark-cli/config.json（应用层；user 授权以 healthcheck 为准）" || todo "无 lark-cli config（需 config init --new，PTY）"
else todo "未安装 lark-cli（~/.npm-global/bin）"; fi

echo; echo "================================================"
if [ "$TODO" -eq 0 ]; then
  echo " 环境探测通过，未发现明显缺失。请跑 kb-healthcheck.sh 做真实连通验证。"
else
  echo " 共 $TODO 项待办，按 references/onboarding-playbook.md 逐库处理。"
fi
echo " 本脚本只读，不修改系统、不输出密钥。"
