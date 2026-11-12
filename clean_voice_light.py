#!/usr/bin/env python3
"""Light cleanup for already-clean ElevenLabs audio: voice.wav -> voice_clean.wav, same length.
(clean_voice.py has video-1 silence spans hard-coded; this one just high-passes and gently denoises.)"""
import subprocess
subprocess.run(["ffmpeg","-v","error","-y","-i","voice.wav","-af","highpass=f=70,afftdn=nr=6:nf=-45",
                "-ac","1","-ar","48000","-c:a","pcm_f32le","voice_clean.wav"], check=True)
def n(p):
    return float(subprocess.check_output(["ffprobe","-v","error","-count_packets","-show_entries","format=duration","-of","csv=p=0",p]))
a,b=n("voice.wav"),n("voice_clean.wav"); print(f"voice {a:.3f}s -> clean {b:.3f}s")
