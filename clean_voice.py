#!/usr/bin/env python3
"""Conservatively denoise voice.wav while preserving its exact sample count."""
import subprocess
import numpy as np

SR = 48000


def decode(path):
    result = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        check=True, capture_output=True,
    )
    return np.frombuffer(result.stdout, dtype='<f4').copy()


def rms_db(samples):
    rms = np.sqrt(np.mean(samples.astype(np.float64) ** 2))
    return 20 * np.log10(max(float(rms), 1e-12))


original = decode('voice.wav')
head = original[:round(2.9 * SR)]
tail = original[round(44.4 * SR):round(46.4 * SR)]
profile = np.concatenate([head, tail])
# Feed both silent spans to afftdn first. Its learned profile is frozen at the
# join, then the training prefix is removed so the original timing is intact.
command_time = len(profile) / SR
source = np.concatenate([profile, original]).astype('<f4')
graph = (
    f"asendcmd=c='{command_time:.6f} afftdn sn stop',"
    "afftdn=sn=start:nr=10:gs=2,highpass=f=80"
)
result = subprocess.run(
    ['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1',
     '-i', '-', '-af', graph, '-f', 'f32le', '-'],
    input=source.tobytes(), check=True, capture_output=True,
)
processed = np.frombuffer(result.stdout, dtype='<f4')
clean = processed[len(profile):len(profile) + len(original)].copy()
if len(clean) != len(original):
    raise SystemExit('denoiser changed the sample count')
subprocess.run(
    ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1',
     '-i', '-', '-c:a', 'pcm_f32le', 'voice_clean.wav'],
    input=clean.tobytes(), check=True,
)
for label, sl in [('silent head', slice(0, round(2.9 * SR))),
                  ('silent tail', slice(round(44.4 * SR), round(46.4 * SR))),
                  ('speech', slice(round(2.9 * SR), round(44.4 * SR)))]:
    print(f'{label}: {rms_db(original[sl]):.2f} -> {rms_db(clean[sl]):.2f} dBFS RMS')
print(f'voice_clean.wav: {len(clean) / SR:.6f} s ({len(clean)} samples)')
