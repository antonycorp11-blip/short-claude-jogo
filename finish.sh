#!/usr/bin/env bash
# Encode frames + mix -> mp4, then QA.   bash finish.sh "Title Of Short"
set -e; test -f voice_clean.wav; test -f mix.wav; test -f voice_stem.wav; test -f music_stem.wav; test -f sfx_stem.wav; mkdir -p out; T="${1:-short}"; F="out/${T// /-}.mp4"
cp voice_stem.wav out/voz_limpa.wav
cp music_stem.wav out/trilha.wav
cp sfx_stem.wav out/efeitos.wav
# Stems are at their exact mix levels, before the final loudness normalisation.
ffmpeg -v error -y -i mix.wav -af "loudnorm=I=-14:TP=-1.5:LRA=7" -ar 48000 -ac 2 out/final_audio.wav
ffmpeg -v error -y -framerate 30 -i frames/f%04d.jpg -i out/final_audio.wav -map 0:v:0 -map 1:a:0 -vf "scale=1080:1920:flags=lanczos" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$F"
ffmpeg -v error -y -i "$F" -map 0:v:0 -c:v copy -an out/video_sem_audio.mp4
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate -of compact "$F"
echo "--- QA (empty = no black/frozen spans)"; ffmpeg -i "$F" -vf "freezedetect=n=0.0005:d=0.4,blackdetect=d=0.05" -an -f null - 2>&1 | grep -E "freeze_start|black_start" || true
ffmpeg -i "$F" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1
ffmpeg -v error -y -i "$F" -vf "fps=2,scale=180:-1,tile=10x4" -frames:v 1 out/qa_sheet.jpg; echo "$F"
