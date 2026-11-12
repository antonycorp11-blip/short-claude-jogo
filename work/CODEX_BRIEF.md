# Brief for Codex: build the cartoon short in this folder

You are working in `~/shorts/demitido`, a project created from the cartoon-audio-short kit. Read these first:
- `~/.claude/skills/cartoon-audio-short/SKILL.md` (the method, rules and engine gotchas. Follow sections 4.2-4.7.)
- `work/PLAN.md` (the shot plan: cast, world, 10 shots) and `work/timeline.json` (exact frame of every sentence and key word).
- `web/main.js`, `web/story.js`, `web/roman.js`, `web/motion.js`, `web/paint.js`, `audio.py`, `render.mjs`, `sheet.py` — the current files are the worked example "The Soldier Who Never Left" (Roman setting). Replace the story with ours.

## Tasks
1. **Cast** (`web/roman.js`): add outfits CRIADOR (purple hoodie, jeans, messy dark hair, headphones on neck), MINEIRO (orange overalls, yellow hard hat with head lamp; 3 colour variants, one bearded), RH (grey suit, red tie, glasses, clipboard), and CRIADOR_MINER (CRIADOR + hard hat). Props: pickaxe, picket sign with text, clipboard, sunglasses, beach chair if feasible (or build the chair in 3D). Rebuild `web/toon.js` with `cat web/toonbase.js web/roman.js > web/toon.js`.
2. **World** (`web/main.js`, between `// ---------- world ----------` and `// ---------- cards ----------`, plus `worldState()`): dev desk + giant floating monitor with a canvas-texture screen whose content is driven per frame (typing prompt, panels, red notifications — Portuguese text, not mirrored), the mine (hill, tunnel entrance with "MINA" sign, rails, minecart, ore rocks with crystals, lanterns, pines, mountains, clouds), RH booth that springs up (shot 4), beach chairs (shot 10). Mine pieces pop into existence in shot 2 with staggered springy scale-ups driven by `worldAt(f)`.
3. **Story** (`web/story.js`): SHOTS / cameras / lights / actors / fx for the 10 shots, timed to `work/timeline.json`. Visual reactions land 0-3 frames BEFORE the key word. Nothing static for 4+ frames; idle + blinks on every card. Total 1395 frames. Frame 0 must already be the hook image.
4. **Speed option**: this Mac is very slow (2014 MacBook Air, CPU WebGL). Add an env var `SCALE` to `render.mjs`/`main.js` (default 1 = 1080x1920; `SCALE=0.5` renders 540x960 with all pixel-based sizes such as ink radius and DOF scaled accordingly). Keep the output aspect 9:16.
5. **Sound** (`audio.py`): rewrite the cue table for our 10 shots (SFX listed in PLAN.md; light playful march/plucky loop for the music; music stops at frame 1100 ("demitido") then a low drone; comic boing at frame 1297). It must write only `music.wav` and `sfx.wav`, 48 kHz, exactly 1395/30 s long.
6. **mix.py** is missing from the kit: write it per SKILL.md section 4.7: `python3 mix.py voice.wav music.wav sfx.wav` → `mix.wav`. Measure gated RMS of the voice (ignore frames below -40 dBFS), scale music to exactly 50 % (−6.0 dB) of the voice's gated RMS, scale SFX to 50 % and cap SFX peaks at 0.7 × voice peak. No ducking/compression. Voice untouched. Print the measured levels. Also check `finish.sh` exists in the project (copy from `~/.claude/skills/cartoon-audio-short/kit/tools/finish.sh` if missing) and that it uses `mix.wav` and `voice.wav` names consistently; adapt if needed.
7. **Test**: render stills at SCALE=0.5 for frames `0,150,169,320,370,460,510,560,620,700,810,880,915,980,1050,1102,1160,1200,1270,1300,1360` with `SCALE=0.5 node render.mjs stills/a "<frames>"`, then `python3 sheet.py stills/a stills/sheet_a.jpg`. Open the sheet image yourself and fix visual problems (mirrored text, characters off-frame in the narrow vertical frame, camera inside geometry, missing ink). Iterate until it looks good. Report the seconds per frame you measured.

## Rules
- Do NOT start the full-length render. Stop after the stills sheet looks good.
- Do not modify `voice.wav`, `voice.m4a`, `script.txt`, `work/timeline.json` or anything under `~/.claude/skills`.
- No captions. Original characters only, no logos/brands.
- Chromium flags: `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` (render.mjs already has them, check).
- At the end, print a short report: files changed, measured seconds/frame at SCALE=0.5 and an estimate at SCALE=1, mix.py levels test if you ran it, and any known issues.
