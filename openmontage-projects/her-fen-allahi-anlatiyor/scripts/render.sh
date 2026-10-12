#!/usr/bin/env bash
# Render the final vertical video. Run from the project root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BROWSER="${REMOTION_BROWSER:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"

cp "$ROOT/build/timeline.json" "$ROOT/composer/src/timeline.json"
cp "$ROOT/audio/mix.wav" "$ROOT/composer/public/mix.wav"

cd "$ROOT/composer"
npx remotion render src/index.ts Main "$ROOT/renders/final.mp4" \
  --browser-executable="$BROWSER" \
  --codec=h264 --crf=18 --audio-codec=aac --audio-bitrate=256k

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 "$ROOT/renders/final.mp4"
