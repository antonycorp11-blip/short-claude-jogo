#!/usr/bin/env python3
"""Mix cleaned voice and write aligned, pre-normalisation source stems."""
import subprocess
import numpy as np
SR=48000
def read(path):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,dtype='<f4').copy()
voice,music,sfx=map(read,['voice_clean.wav','music.wav','sfx.wav']);n=len(music)
if len(sfx)!=n: raise SystemExit('music and SFX durations differ')
if len(voice)<n: voice=np.pad(voice,(0,n-len(voice)))
else: voice=voice[:n]
# Gate 10 ms voice blocks; retain every sample of blocks at or above -40 dBFS.
block=480;chunks=[voice[i:i+block] for i in range(0,n,block)]
gated=np.concatenate([c for c in chunks if len(c) and np.sqrt(np.mean(c.astype(np.float64)**2))>=.01])
vrms=float(np.sqrt(np.mean(gated.astype(np.float64)**2)))
vpeak=float(np.max(np.abs(voice)))
rms=lambda x:float(np.sqrt(np.mean(x.astype(np.float64)**2)))
mrms=rms(music);srms=rms(sfx)
if not vrms or not mrms or not srms: raise SystemExit('silent input stem')
target=10**(-6/20)
mg=target*vrms/mrms
sg=min(target*vrms/srms,.7*vpeak/float(np.max(np.abs(sfx))))
music*=mg;sfx*=sg
mixed=voice+music+sfx
peak=float(np.max(np.abs(mixed)))
# One gain on the summed signal preserves the stem ratios and leaves 1 dB headroom.
ceiling=10**(-1/20)
gain=min(1.0,ceiling/peak) if peak else 1.0
mixed*=gain
voice*=gain;music*=gain;sfx*=gain
mix_vrms=vrms*gain
def write(path,data):
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','pcm_f32le',path],input=np.asarray(data,dtype='<f4').tobytes(),check=True)
write('voice_stem.wav',voice)
write('music_stem.wav',music)
write('sfx_stem.wav',sfx)
write('mix.wav',mixed)
db=lambda x:20*np.log10(max(x,1e-12))
print(f'voice gated RMS: {db(vrms):.2f} dBFS; voice peak: {db(vpeak):.2f} dBFS')
print(f'music RMS: {db(rms(music)):.2f} dBFS ({db(rms(music)/mix_vrms):+.1f} dB vs voice)')
print(f'SFX RMS: {db(rms(sfx)):.2f} dBFS ({db(rms(sfx)/mix_vrms):+.1f} dB vs voice); SFX peak / voice peak: {float(np.max(np.abs(sfx)))/(vpeak*gain):.3f}')
print(f'mix.wav: {n/SR:.3f} s; output gain {db(gain):+.2f} dB; peak {db(float(np.max(np.abs(mixed)))):.2f} dBFS')
