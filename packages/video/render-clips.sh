#!/bin/bash
# Renders individual feature clips from the main composition.
# Output goes directly to the landing page's public folder.

set -euo pipefail

OUT="../landing/public/videos"
mkdir -p "$OUT"

echo "Rendering clips from AppShowcase..."

render_clip() {
  local name="$1"
  local range="$2"
  echo "  → $name ($range)"
  bunx remotion render AppShowcase "$OUT/$name.webm" \
    --frames="$range" \
    --codec=vp8 \
    --crf=10 \
    --scale=1 \
    2>/dev/null
}

render_clip "daemon-connect"   "250-530"
render_clip "agent-work"       "510-810"
render_clip "loop-detect"      "790-1100"
render_clip "scope-drift"      "1080-1340"
render_clip "context-cost"     "1320-1620"
render_clip "checkpoint"       "1600-1900"
render_clip "terminal-attach"  "1880-2200"
render_clip "pair-prog"        "2180-2560"

echo ""
echo "Done! Clips in $OUT/"
ls -lh "$OUT/"*.webm
