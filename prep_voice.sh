#!/usr/bin/env bash
# usage: bash prep_voice.sh <voice.mp3>
set -euo pipefail
cd "$(dirname "$0")"
[ $# -eq 1 ] || { echo "usage: bash prep_voice.sh <path-to-mp3>"; exit 1; }
ffmpeg -v error -y -i "$1" -ac 1 -ar 48000 -c:a pcm_s16le voice.wav
python3 clean_voice_light.py          # voice.wav -> voice_clean.wav (same length)
python3 make_timeline.py voice_clean.wav
python3 audio.py
python3 mix.py voice_clean.wav music.wav sfx.wav
echo "done: mix.wav + web/timeline.js ready"
