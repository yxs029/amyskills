#!/usr/bin/env bash
# =============================================================================
# hermes-model-backup.sh —— Hermes config.yaml 时间戳备份 / golden / 回滚
# 用法:
#   ./hermes-model-backup.sh                 # 打一个时间戳备份
#   ./hermes-model-backup.sh --golden        # 把当前 config 存为已知可用 golden
#   ./hermes-model-backup.sh --rollback-latest  # 回滚到最近的时间戳备份
#   ./hermes-model-backup.sh --rollback-golden  # 回滚到 golden
#   ./hermes-model-backup.sh --list          # 列出所有备份
# =============================================================================
set -euo pipefail

CFG="${HERMES_HOME:-$HOME/.hermes}/config.yaml"
TS="$(date +%Y%m%d-%H%M%S)"
BAK="${CFG}.bak.${TS}"
GOLDEN="${CFG}.golden"

die(){ echo "❌ $*" >&2; exit 1; }
[ -f "$CFG" ] || die "找不到 $CFG（用 HERMES_HOME 或在已初始化的 Hermes 机器上运行）"

backup(){
  cp -p "$CFG" "$BAK"
  chmod 600 "$BAK"
  echo "✅ 已备份: $BAK"
}

case "${1:-backup}" in
  backup)
    backup ;;
  --golden)
    cp -p "$CFG" "$GOLDEN"; chmod 600 "$GOLDEN"
    echo "✅ 已存为 golden: $GOLDEN" ;;
  --rollback-latest)
    LATEST="$(ls -1t "${CFG}".bak.* 2>/dev/null | grep -v '\.golden$' | head -1 || true)"
    [ -n "$LATEST" ] || die "没有找到时间戳备份"
    cp -p "$CFG" "${CFG}.prerestore.${TS}"   # 回滚前再留一份现场
    cp -p "$LATEST" "$CFG"; chmod 600 "$CFG"
    echo "✅ 已从最近备份回滚: $LATEST"
    echo "   回滚前现场存于: ${CFG}.prerestore.${TS}"
    echo "👉 接着执行: hermes config check && hermes config show | head -20 ，然后重启" ;;
  --rollback-golden)
    [ -f "$GOLDEN" ] || die "没有 golden（先跑一次 --golden）"
    cp -p "$CFG" "${CFG}.prerestore.${TS}"
    cp -p "$GOLDEN" "$CFG"; chmod 600 "$CFG"
    echo "✅ 已从 golden 回滚: $GOLDEN"
    echo "   回滚前现场存于: ${CFG}.prerestore.${TS}"
    echo "👉 接着执行: hermes config check && hermes config show | head -20 ，然后重启" ;;
  --list)
    ls -lt "${CFG}".bak.* "$GOLDEN" 2>/dev/null || echo "(无备份)" ;;
  *)
    grep '^#' "$0" | sed 's/^# \{0,1\}//' ; die "未知参数: $1" ;;
esac
