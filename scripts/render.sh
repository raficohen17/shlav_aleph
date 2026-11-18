#!/bin/bash
# usage: render.sh input.html output.pdf
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
"$CH" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 --print-to-pdf="$2" "file://$in" 2>/dev/null
