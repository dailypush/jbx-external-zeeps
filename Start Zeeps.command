#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
    echo "Install Node.js LTS from https://nodejs.org/en/download first."
    echo "Then reopen this launcher."
    read -r -p "Press Enter to close…" _zeeps_close
    exit 1
fi
node scripts/start.js
_zeeps_status=$?
if [ "$_zeeps_status" -ne 0 ] && [ "$_zeeps_status" -ne 130 ]; then
    read -r -p "Press Enter to close…" _zeeps_close
fi
exit "$_zeeps_status"
