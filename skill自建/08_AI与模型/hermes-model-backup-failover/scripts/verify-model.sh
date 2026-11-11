#!/usr/bin/env bash
# verify-model.sh -- Hermes L1(curl) / L2(config) / L3(agent) 三级验证
set -uo pipefail
ENV_FILE="${HERMES_HOME:-$HOME/.hermes}/.env"
CFG="${HERMES_HOME:-$HOME/.hermes}/config.yaml"
PASS=0; FAIL=0
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
ok(){  echo "PASS $*"; PASS=$((PASS+1)); }
bad(){ echo "FAIL $*"; FAIL=$((FAIL+1)); }

probe_chat(){
  local name="$1" url="$2" model="$3" envvar="$4"
  local key; key="$(printenv "$envvar" 2>/dev/null || true)"
  if [ -z "$key" ]; then bad "[$name] missing env $envvar"; return; fi
  local auth="Authorization: Bearer $key"
  local code
  code="$(curl -sS -o /tmp/_vm_body.$$ -w '%{http_code}' --max-time 30 \
      "$url/chat/completions" \
      -H "$auth" -H "Content-Type: application/json" \
      -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":1024}" || true)"
  if [ "$code" = "200" ]; then ok "[$name] $model 200"; else bad "[$name] HTTP $code $(head -c 200 /tmp/_vm_body.$$)"; fi
  rm -f /tmp/_vm_body.$$
}

echo "==== L1 curl ===="
[ -n "${VOLCENGINE_API_KEY:-}" ] && probe_chat "ArkCoding/MiniMax-M3" "https://ark.cn-beijing.volces.com/api/coding/v3" "MiniMax-M3" "VOLCENGINE_API_KEY"
[ -n "${OPENROUTER_API_KEY:-}" ] && probe_chat "OpenRouter" "https://openrouter.ai/api/v1" "openrouter/free" "OPENROUTER_API_KEY"

echo; echo "==== L2 config ===="
if command -v hermes >/dev/null 2>&1; then
  if hermes config check >/tmp/_vm_check.$$ 2>&1; then ok "config check"; else bad "config check"; cat /tmp/_vm_check.$$; fi
  hermes config show 2>/dev/null | grep -A3 -E '^model:' | head -6 || true
else
  python3 -c "import yaml;yaml.safe_load(open('$CFG'))" 2>/dev/null && ok "yaml ok" || bad "yaml bad"
fi
rm -f /tmp/_vm_check.$$

if [ "${1:-}" = "--agent" ]; then
  echo; echo "==== L3 agent ===="
  BACKUP="${CFG}.bak.l3.$(date +%Y%m%d-%H%M%S)"; cp -p "$CFG" "$BACKUP"
  python3 - "$BACKUP" <<'PY'
import os,sys,time
from pathlib import Path
env=Path.home()/'.hermes/.env'
if env.exists():
    for line in env.read_text().splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k,v=line.split('=',1); os.environ.setdefault(k,v)
try:
    sys.path.insert(0, str(Path.home()/'.hermes/hermes-agent'))
    from run_agent import AIAgent
    key=os.environ.get('VOLCENGINE_API_KEY')
    if not key: print('skip L3'); sys.exit(0)
    ag=AIAgent(base_url='https://ark.cn-beijing.volces.com/api/coding/v3', api_key=key,
        provider='volcengine-coding-plan', api_mode='chat_completions', model='MiniMax-M3',
        max_iterations=5, quiet_mode=True, platform='cli', skip_context_files=True, skip_memory=True)
    t0=time.time(); r=ag.run_conversation(user_message='reply two chars', system_message='short')
    print('L3 ok %.1fs'%(time.time()-t0), (r.get('final_response') or '').strip()[:60])
except Exception as e:
    print('L3 fail:', type(e).__name__, str(e)[:160])
PY
  cp -p "$BACKUP" "$CFG"; echo "config restored"
fi
echo; echo "==== result PASS=$PASS FAIL=$FAIL ===="
[ "$FAIL" -eq 0 ]
