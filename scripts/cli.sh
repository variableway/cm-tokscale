#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_PATH="$SCRIPT_DIR/../packages/cli/src/cli.ts"
START=$(perl -MTime::HiRes=time -e 'printf "%.0f", time * 1000')
bun "$CLI_PATH" "$@"
EXIT=$?
END=$(perl -MTime::HiRes=time -e 'printf "%.0f", time * 1000')
echo -e "\n⏱  Done in $((END - START))ms"
exit $EXIT
