"""Synthesized music and sfx for video 2; every cue is read from web/timeline.js."""
import numpy as np, subprocess, wave, re, os

SR = 48000
_tl = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web', 'timeline.js')).read()
TOTAL = int(re.search(r'total\s*:\s*(\d+)', _tl).group(1))
SENT = [(int(a), int(b)) for a, b in re.findall(r'\[\s*(\d+)\s*,\s*(\d+)\s*\]', re.search(r'sent\s*:\s*\[(.*?)\]\s*,\s*keys', _tl, re.S).group(1))]
KEYS = {k: int(v) for k, v in re.findall(r'(\w+)\s*:\s*(\d+)', re.search(r'keys\s*:\s*\{(.*?)\}', _tl, re.S).group(1))}
assert len(SENT) == 11 and all(k in KEYS for k in 'digitou nave cinco dragao nome mil cemmil email hoje parte2'.split())
DUR = TOTAL / 30
N = int(DUR * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

def env(n, a=0.005, r=0.2, sus=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)
    return e

def lp(x, k):  # one-pole low-pass, k in (0,1)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += k * (x[i] - acc); y[i] = acc
    return y

def lp_fast(x, cutoff):
    # FFT brick-ish low-pass (fast, fine for beds)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)

def hp_fast(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 - 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)

def place(buf, sig, t0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N and j > i: buf[i:j] += sig[: j - i] * gain

midi = lambda m: 440 * 2 ** ((m - 69) / 12)
def pluck(f, dur=0.35, bright=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum((bright ** k) * np.sin(2 * np.pi * f * (k + 1) * t) / (k + 1) for k in range(6))
    return (s * env(n, 0.003, dur * 0.35)).astype(np.float32)
def brass(fs, dur):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for f in fs:
        ph = 2 * np.pi * f * t + 0.003 * np.sin(2 * np.pi * 5 * t)
        s += sum(np.sin((k + 1) * ph) / (k + 1) ** 1.3 for k in range(8))
    a = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15).clip(0)
    return lp_fast((s * a).astype(np.float32), 1800) / len(fs)

# ---------------- music ----------------
music = np.zeros(N, np.float32)
def sq(f, dur, duty=0.5, a=0.004, r=0.12):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.where(np.mod(f * t, 1) < duty, 1.0, -1.0) * np.minimum(1, t / a) * np.exp(-t / r) * np.minimum(1, (dur - t) / 0.01).clip(0)
    return s.astype(np.float32)
def tri(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    return (2 * np.abs(2 * np.mod(f * t, 1) - 1) - 1).astype(np.float32) * np.minimum(1, (dur - t) / 0.01).clip(0) * np.exp(-t * 3)
def hat(): 
    n = int(0.05 * SR); t = np.arange(n) / SR
    return hp_fast(noise_(0.05), 6000) * np.exp(-t * 80) * 0.5
def noise_(d): return rng.standard_normal(int(d * SR)).astype(np.float32)
def kick():
    n = int(0.2 * SR); t = np.arange(n) / SR; f = 45 + 100 * np.exp(-t * 35)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)).astype(np.float32)
def snare():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return hp_fast((noise_(0.12) * np.exp(-t * 30) * 0.6 + np.sin(2 * np.pi * 200 * t) * np.exp(-t * 25) * 0.4).astype(np.float32), 400)

MUSIC_END = KEYS['parte2'] / 30
S5, S6 = SENT[4][0] / 30, SENT[5][0] / 30
S5END = SENT[5][1] / 30
BPM = 132; beat = 60 / BPM; step = beat / 2
prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]  # Am F C G
lead_pat = [0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1, 2, 0, 1, 2]
si = 0; tt = 0.0
while tt < MUSIC_END - 1e-6:
    bar = int(tt / (beat * 4)); root, ch = prog[bar % 4]
    # energy: 0 calm, 1 normal, 2 build (sentences 5-6)
    lvl = 2 if S5 <= tt < MUSIC_END else 1
    if tt < S5 - 4 * beat: lvl = 1
    for k in range(16):
        ts = tt + k * step
        if ts >= MUSIC_END: break
        g = 1.0 + (0.5 * min(1, max(0, (ts - S5) / max(S5END - S5, 1))) if ts >= S5 else 0)
        # lead (square), octave up in build
        m = ch[lead_pat[k]] + (24 if lvl == 2 and k % 2 else 12)
        if k % 2 == 0 or lvl == 2:
            place(music, sq(midi(m), step * 0.9, 0.25), ts, 0.07 * g)
        # bass on eighths
        place(music, tri(midi(root - 12), step * 0.95), ts, 0.30)
        if k % 4 == 0: place(music, kick(), ts, 0.5)
        if k % 8 == 4: place(music, snare(), ts, 0.28)
        if k % 2 == 1 or lvl == 2: place(music, hat(), ts, 0.14 * g)
        if lvl == 2 and k % 4 == 2: place(music, kick(), ts, 0.3)
    tt += step * 16
# dead stop at parte2
iend = int(MUSIC_END * SR); i0 = iend - int(.01 * SR)
music[i0:iend] *= np.linspace(1, 0, iend - i0, dtype=np.float32); music[iend:] = 0
# tense drone under sentences 10-11 (starts at parte2 / fades in)
dn = N - iend; td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 55 * td) + 0.5 * np.sin(2 * np.pi * 58.3 * td) + 0.35 * np.sin(2 * np.pi * 82.4 * td) + 0.2 * np.sin(2 * np.pi * 116.5 * td)) * np.minimum(1, td / 1.0) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.4 * td))
place(music, lp_fast(drone.astype(np.float32), 500), MUSIC_END, 0.10)
# soft "question" sting at the start of sentence 10 (rising minor third, unresolved)
def question():
    out = np.zeros(int(1.6 * SR), np.float32)
    for f, t0, d in [(midi(64), 0, 0.35), (midi(71), 0.28, 0.9)]:
        n = int(d * SR); t = np.arange(n) / SR
        s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.minimum(1, t / 0.02) * np.exp(-t * 3)
        i = int(t0 * SR); out[i:i + n] += s.astype(np.float32)
    return out
place(music, question(), SENT[9][0] / 30, 0.18)

sfx = np.zeros(N, np.float32)
def noise(d): return rng.standard_normal(int(d * SR)).astype(np.float32)
def thunk(f0=90, d=0.3):
    n = int(d * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f0 * t * (1 + 0.6 * np.exp(-t * 40))) * np.exp(-t * 14) + lp_fast(noise(d), 1200) * np.exp(-t * 30) * 0.5).astype(np.float32)
def rumble(d):
    n = int(d * SR); t = np.arange(n) / SR
    s = lp_fast(noise(d), 160) * 3 * np.minimum(1, t / 0.15) * np.exp(-t / (d * 0.45))
    return s.astype(np.float32)
def crash(d=1.2):
    n = int(d * SR); t = np.arange(n) / SR; s = np.zeros(n, np.float32)
    for k in range(14):
        tk = rng.uniform(0, d * 0.6); i = int(tk * SR); g = thunk(rng.uniform(60, 160), 0.35) * rng.uniform(0.3, 0.9)
        s[i:i + len(g)] += g[: n - i]
    s += lp_fast(noise(d), 2500) * np.exp(-t * 3) * 0.25
    return s
def cuckoo():
    out = []
    for f, d in [(740, 0.16), (587, 0.24)]:
        n = int(d * SR); t = np.arange(n) / SR
        out.append(np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.01) * np.exp(-t * 6)); out.append(np.zeros(int(0.06 * SR)))
    return np.concatenate(out).astype(np.float32)
def scrape(d=0.8):
    n = int(d * SR); t = np.arange(n) / SR
    s = noise(d) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t)) * np.sin(np.pi * t / d)
    s = hp_fast(lp_fast(s, 5000), 1500)
    ring = np.sin(2 * np.pi * 1870 * t) * np.exp(-t * 3) * 0.2
    return (s * 0.6 + ring).astype(np.float32)
def ting():
    n = int(1.2 * SR); t = np.arange(n) / SR
    return (sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in [(2093, 4), (3136, 6), (4186, 8)]) * 0.3).astype(np.float32)
def sting():
    n = int(2.0 * SR); t = np.arange(n) / SR
    low = np.sin(2 * np.pi * 41 * t) * np.exp(-t * 1.5) * 1.2
    hit = lp_fast(noise(2.0), 900) * np.exp(-t * 6) * 0.8
    stab = brass([midi(45), midi(48), midi(51)], 1.4); s = low + hit; s[: len(stab)] += stab * 2.2 * np.exp(-np.arange(len(stab)) / SR * 2)
    return s.astype(np.float32)
def creak(d=0.6, f0=140):
    n = int(d * SR); t = np.arange(n) / SR
    rate = f0 * (1 + 0.35 * np.sin(2 * np.pi * 1.3 * t / d))
    ph = np.cumsum(rate) / SR; pulses = (np.mod(ph, 1) < 0.08).astype(np.float32)
    s = lp_fast(pulses * (0.6 + 0.4 * rng.random(n).astype(np.float32)), 2200) * np.sin(np.pi * t / d)
    return hp_fast(s, 200) * 2.5
def snap():
    d = 0.5; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(noise(d), 800) * np.exp(-t * 18) * 1.4 + np.pad(thunk(120, 0.4), (0, n - int(0.4 * SR))) * 0.6).astype(np.float32)
def splash(d=1.0):
    n = int(d * SR); t = np.arange(n) / SR
    s = lp_fast(noise(d), 4000) * (np.exp(-t * 4) * np.minimum(1, t / 0.01)) + lp_fast(noise(d), 400) * np.exp(-t * 7) * 1.5
    return s.astype(np.float32)
def whoosh(d=0.5):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 1500) * np.sin(np.pi * t / d) ** 2 * 0.6).astype(np.float32)
def snore(d=1.1):
    n = int(d * SR); t = np.arange(n) / SR
    buzz = (np.mod(np.cumsum(60 + 25 * np.sin(np.pi * t / d)) / SR, 1) < 0.3).astype(np.float32)
    return (lp_fast(buzz * 0.5 + noise(d) * 0.15, 700) * np.sin(np.pi * t / d) ** 2).astype(np.float32)
def leaves(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 6000), 2500) * (0.3 + 0.3 * np.sin(2 * np.pi * 0.7 * t) ** 2) * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)).astype(np.float32)
def water(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 900) * 0.5 + hp_fast(lp_fast(noise(d), 3000), 1200) * 0.15 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * t))).astype(np.float32)

# ---------------- cues (all frames from timeline.js) ----------------
F = lambda f: f / 30
K = KEYS
def pew(d=0.18, f0=1800, f1=300):
    n = int(d * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 18)) / SR
    return (np.sin(ph) * np.exp(-t * 9)).astype(np.float32)
def powerup(d=0.7):
    n = int(d * SR); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for i, m in enumerate([72, 76, 79, 84, 88, 91]):
        a = int(i * d / 7 * SR); seg = sq(midi(m), 0.14, 0.5, r=0.2)
        out[a:a + len(seg)] += seg[: n - a]
    return out * 0.5
def pop(f=600):
    n = int(0.09 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * np.cumsum(f * (1 + 1.5 * np.exp(-t * 60))) / SR) * np.exp(-t * 40)).astype(np.float32)
def click():
    n = int(0.03 * SR); t = np.arange(n) / SR
    return (hp_fast(noise_(0.03), 2500) * np.exp(-t * 200) + np.sin(2 * np.pi * 1200 * t) * np.exp(-t * 150) * 0.3).astype(np.float32)
def roar(d=1.4):
    n = int(d * SR); t = np.arange(n) / SR
    s = lp_fast(noise_(d), 400) * (1 + 0.6 * np.sin(2 * np.pi * 28 * t)) * 3 + np.sin(2 * np.pi * 55 * t * (1 - 0.2 * t / d)) * 0.8
    return (s * np.minimum(1, t / 0.1) * np.exp(-t / (d * 0.5))).astype(np.float32)
def creepy_ding():
    n = int(1.6 * SR); t = np.arange(n) / SR
    return (sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in [(185, 2.2), (196, 2.4), (370, 3.5)]) * 0.4).astype(np.float32)
def tickrun(f0, count, gap, g=0.25):
    for i in range(count):
        place(sfx, pop(700 + i * 60), f0 + i * gap(i), g * (0.6 + 0.4 * i / max(count - 1, 1)))
def cash():
    out = np.zeros(int(1.4 * SR), np.float32); t = np.arange(len(out)) / SR
    for f in [1568, 2093, 2637, 3136]:
        out += np.sin(2 * np.pi * f * t) * np.exp(-t * 4) * 0.25
    out += hp_fast(noise_(1.4), 5000) * np.exp(-t * 6) * 0.35
    for i, m in enumerate([72, 76, 79, 84]):
        seg = sq(midi(m), 0.12, 0.5, r=0.15); a = int(i * 0.07 * SR); out[a:a + len(seg)] += seg * 0.3
    return out
def blip():
    return np.concatenate([sq(midi(88), 0.07, 0.5, r=0.1), np.zeros(int(.03 * SR), np.float32), sq(midi(93), 0.1, 0.5, r=0.12)]) * 0.5

# keyboard clicks while typing (around digitou)
kf = K['digitou']; rr = np.random.default_rng(3)
t_ = kf - 70
while t_ < kf + 6:
    place(sfx, click(), F(t_), 0.28 * rr.uniform(.7, 1)); t_ += rr.integers(3, 6)
# whoosh + power-up on the spaceship
place(sfx, whoosh(.5), F(K['nave'] - 8), .5); place(sfx, powerup(), F(K['nave']), .45)
# laser pew-pews during sentence 2
a, b = SENT[1]
for i, f in enumerate(np.linspace(a + 0.25 * (b - a), b - 8, 5)): place(sfx, pew(f1=300 + 40 * i), F(f), .25)
# five pops staggered by 4 frames, last at cinco
for i in range(5): place(sfx, pop(500 + 90 * i), F(K['cinco'] - 4 * (4 - i)), .5)
place(sfx, roar(), F(K['dragao']), .75)
place(sfx, creepy_ding(), F(K['nome']), .55)
# counter tick-runs
a5, b5 = SENT[4]; tickrun(F(a5 + 0.2 * (b5 - a5)), 14, lambda i: 0, 0) if False else None
n5 = 10; s5 = a5 + 0.15 * (b5 - a5); e5 = K['mil']
for i in range(n5):
    f = s5 + (e5 - s5) * (i / (n5 - 1)) ** 0.9
    place(sfx, pop(500 + 70 * i), F(f), .12 + .02 * i)
a6, b6 = SENT[5]; n6 = 16; s6 = a6; e6 = K['cemmil'] - 6
for i in range(n6):
    f = s6 + (e6 - s6) * (i / (n6 - 1)) ** 1.4
    place(sfx, pop(600 + 80 * i), F(f), .13 + .015 * i)
place(sfx, cash(), F(K['cemmil']), .6)
place(sfx, ting(), F(K['email']), .5)
place(sfx, thunk(70, .45), F(K['hoje']), .9)
place(sfx, blip(), F(K['parte2'] - 2), .5); place(sfx, sting(), F(K['parte2']), .8)
place(sfx, pop(700), F(SENT[9][0]), .4)

def write(name,x):
    raw=np.asarray(x,dtype='<f4').tobytes()
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','pcm_f32le',name],input=raw,check=True)
write('music.wav',music);write('sfx.wav',sfx)
print(f'music.wav and sfx.wav: {N} samples, {DUR:.3f} s at {SR} Hz')
