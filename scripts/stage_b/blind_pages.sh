#!/bin/bash
# usage: scripts/stage_b/blind_pages.sh N [suffix] -> renders the question pages (no answer key) of pdf/test_bN.pdf
# to $TMPDIR/blindBN, for a blind solve by a reviewer that must not see the key.
set -e
cd "$(dirname "$0")/../.."
N=$1; PDF=pdf/test_b$N.pdf
OUT=${TMPDIR:-/tmp}/blindB$N${2:+_$2}
mkdir -p "$OUT"
P=$(pdfinfo $PDF | awk '/Pages/{print $2}')
K=$P
for p in $(seq 1 $P); do if [ "$(pdftotext -f $p -l $p $PDF - | grep -c 'טריק')" -gt 2 ]; then K=$((p-1)); break; fi; done
pdftoppm -r 100 -png -f 1 -l $K $PDF "$OUT/p"
echo "test b$N: $P pages, questions on 1-$K -> $OUT ($(ls "$OUT" | wc -l | tr -d ' ') images)"
