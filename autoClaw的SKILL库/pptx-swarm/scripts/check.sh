#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export PYTHONUTF8=1
: "${LC_ALL:=C.UTF-8}"; export LC_ALL
: "${LANG:=C.UTF-8}";   export LANG
export PYTHONPATH="$SCRIPT_DIR${PYTHONPATH:+:$PYTHONPATH}"

PYTHON_BIN="${PPTD_DSL_PYTHON:-${PPTD_PYTHON:-python3}}"

if [ -f "$SCRIPT_DIR/pptd_dsl.pyz" ]; then
    exec "$PYTHON_BIN" "$SCRIPT_DIR/pptd_dsl.pyz" check "$@"
fi

echo "pptd_dsl.pyz not found in $SCRIPT_DIR" >&2
exit 1
