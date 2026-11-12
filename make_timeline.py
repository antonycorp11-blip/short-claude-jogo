#!/usr/bin/env python3
"""python3 make_timeline.py voice_clean.wav  -> web/timeline.js + work/words_pt.json"""
import difflib, json, re, subprocess, sys, unicodedata

SENTS = [
 "Você nunca programou na vida. Mas assinou o Claude e digitou: 'Cria um jogo pra mim.'",
 "Trinta segundos depois, ele te entrega um jogo de nave. Funcionando.",
 "Você pede uma fase nova. Ele faz cinco.",
 "Você pede um chefão. Ele cria um dragão... que fala o seu nome.",
 "Empolgado, você posta o jogo na internet. Mil pessoas jogam na primeira hora.",
 "No dia seguinte, cem mil.",
 "Até que chega um e-mail de uma empresa gigante de games: 'Queremos comprar o seu jogo. Hoje.'",
 "Você abre o Claude pra pedir conselho... e ele já te respondeu antes de você perguntar:",
 "'Não vende. Eu já comecei a parte dois.'",
 "E agora? Você vende o jogo e fica rico... ou confia na IA e continua criando?",
 "Comenta aí: vender ou continuar. A parte dois depende de você.",
]
# key -> (sentence index 0-based, word, which occurrence: 0 first / -1 last)
KEYS = {"digitou":(0,"digitou",0),"nave":(1,"nave",0),"cinco":(2,"cinco",0),"dragao":(3,"dragao",0),
        "nome":(3,"nome",0),"mil":(4,"mil",0),"cemmil":(5,"mil",-1),"email":(6,"email",0),
        "hoje":(6,"hoje",0),"parte2":(8,"parte",0)}
FPS = 30

def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", w)

def script_words():
    out = []
    for si, s in enumerate(SENTS):
        for t in s.split():
            n = norm(t)
            if n: out.append((si, n))
    return out

def sim(a, b):
    if a == b: return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()

def align(words):
    """words: list of {word,start,end}. Returns list (per script word) of asr index or None (global DP)."""
    S = script_words(); A = [norm(w["word"]) for w in words]
    n, m = len(S), len(A)
    GAP = -0.6
    sc = [[0.0]*(m+1) for _ in range(n+1)]; bk = [[0]*(m+1) for _ in range(n+1)]
    for i in range(1, n+1): sc[i][0] = i*GAP; bk[i][0] = 1
    for j in range(1, m+1): sc[0][j] = j*GAP; bk[0][j] = 2
    for i in range(1, n+1):
        for j in range(1, m+1):
            s = sim(S[i-1][1], A[j-1]); s = (s*2-1) if s >= 0.5 else -1
            best = (sc[i-1][j-1]+s, 0)
            best = max(best, (sc[i-1][j]+GAP, 1), (sc[i][j-1]+GAP, 2), key=lambda x: x[0])
            sc[i][j], bk[i][j] = best
    res = [None]*n; i, j = n, m
    while i > 0 or j > 0:
        b = bk[i][j]
        if i > 0 and j > 0 and b == 0:
            if sim(S[i-1][1], A[j-1]) >= 0.5: res[i-1] = j-1
            i -= 1; j -= 1
        elif i > 0 and (j == 0 or b == 1): i -= 1
        else: j -= 1
    return res

def build(words, duration):
    S = script_words(); res = align(words)
    # per script word times, interpolating unmatched ones
    st = [words[r]["start"] if r is not None else None for r in res]
    en = [words[r]["end"] if r is not None else None for r in res]
    idx = [k for k, v in enumerate(st) if v is not None]
    if not idx: raise SystemExit("no words aligned")
    for k in range(len(S)):
        if st[k] is None:
            lo = max([x for x in idx if x < k], default=None); hi = min([x for x in idx if x > k], default=None)
            if lo is None: st[k] = en[k] = st[hi]
            elif hi is None: st[k] = en[k] = en[lo]
            else:
                f = (k-lo)/(hi-lo); st[k] = en[k] = en[lo] + f*(st[hi]-en[lo])
    sent = []
    for si in range(len(SENTS)):
        ks = [k for k, (s, _) in enumerate(S) if s == si]
        sent.append([round(st[ks[0]]*FPS), round(max(en[k] for k in ks)*FPS)])
    keys = {}
    for key, (si, w, occ) in KEYS.items():
        ks = [k for k, (s, n) in enumerate(S) if s == si and n == w]
        keys[key] = round(st[ks[occ]]*FPS)
    return dict(total=round(duration*FPS), sent=sent, keys=keys, matched=sum(r is not None for r in res), n=len(S))

def write(tl, path="web/timeline.js"):
    k = tl["keys"]
    txt = ("// Timings from ElevenLabs voice (make_timeline.py)\n"
      f"export const TL={{total:{tl['total']},\n sent:[{','.join('[%d,%d]'%tuple(s) for s in tl['sent'])}],\n"
      f" keys:{{{','.join('%s:%d'%(a,k[a]) for a in KEYS)}}}}};\n")
    open(path, "w").write(txt)

def main():
    import os
    wav = sys.argv[1]
    dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",wav]).decode())
    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(wav, language="pt", word_timestamps=True, initial_prompt=" ".join(SENTS))
    words = [dict(word=w.word.strip(), start=w.start, end=w.end) for s in segs for w in s.words]
    os.makedirs("work", exist_ok=True)
    json.dump(words, open("work/words_pt.json","w"), ensure_ascii=False, indent=1)
    tl = build(words, dur); write(tl)
    print(f"matched {tl['matched']}/{tl['n']} script words, total {tl['total']} frames")
    for i, (a, b) in enumerate(tl["sent"], 1): print(f"  sent {i:2d}: {a:5d} - {b:5d}  ({(b-a)/FPS:.2f}s)")
    for k, v in tl["keys"].items(): print(f"  key {k:7s}: {v}")

if __name__ == "__main__": main()
