# Fix pass 1 (supervisor review of stills/sheet_a.jpg)
Fix only these, then re-render the same 21 stills at SCALE=0.5 and rebuild stills/sheet_a.jpg. Do NOT start the full render.
1. Monitor text is cut off on the left edge in the over-shoulder/close shots around frames 150-370 ("JOGO CRIADO COM IA" shows as "OGO CRIADO", "MINA CRIADA" loses its first letter). Keep all monitor text fully inside the visible frame: reframe those cameras or move the text block inward with safe margins (~8 % of frame width).
2. Pickaxes read as a grey stick poking horizontally through the miners' faces/noses. Redraw the pickaxe so the handle is held diagonally at the side of the body (head of the pick clearly visible, above the shoulder or down by the hip), never crossing the face. Same for CRIADOR_MINER in the last shots.
3. mix.wav peaks at +0.68 dBFS. Make mix.py write a float WAV or apply only a single linear gain so the mix never exceeds -1 dBFS, without changing the music/SFX-vs-voice ratios. Re-run mix.py and print the levels.
4. finish.sh: frames may be rendered at SCALE<1. Make the encode scale frames to exactly 1080x1920 (lanczos) so output is always 1080x1920. It runs on Ubuntu with apt ffmpeg too, so keep it portable (no macOS-only flags).
Print a short report at the end.
