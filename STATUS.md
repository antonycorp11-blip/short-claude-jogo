# Video 2 — "Você assinou o Claude e pediu um jogo" (Parte 1) — STATUS

Read `~/shorts/CLAUDE.md` first. Project copied from `~/shorts/demitido` (same engine, creator, desk, monitor).

## Script (narration by ElevenLabs, pt-BR — MP3 NOT received yet)
11 sentences → 11 shots (shot = sentence index + 1):
1 "Você nunca programou na vida. Mas assinou o Claude e digitou: 'Cria um jogo pra mim.'" (screen chat, typing) key `digitou`
2 "Trinta segundos depois, ele te entrega um jogo de nave. Funcionando." (screen game) key `nave`
3 "Você pede uma fase nova. Ele faz cinco." (screen levels, 5 tiles pop) key `cinco`
4 "Você pede um chefão. Ele cria um dragão... que fala o seu nome." (screen dragon) keys `dragao`, `nome`
5 "Empolgado, você posta o jogo na internet. Mil pessoas jogam na primeira hora." (posted counter→1.000) key `mil`
6 "No dia seguinte, cem mil." (viral counter→100.000, confetti) key `cemmil`
7 "Até que chega um e-mail de uma empresa gigante de games: 'Queremos comprar o seu jogo. Hoje.'" (email) keys `email`, `hoje`
8 "Você abre o Claude pra pedir conselho... e ele já te respondeu antes de você perguntar:" (face close-up)
9 "'Não vende. Eu já comecei a parte dois.'" (reply screen, sting) key `parte2`
10 "E agora? Você vende o jogo e fica rico... ou confia na IA e continua criando?" (choice screen)
11 "Comenta aí: vender ou continuar. A parte dois depende de você." (choice + CTA)
No Anthropic logo anywhere: the chat window is generic ("CHAT COM A IA").

## Done
- `web/main.js`: `drawScreen()` rewritten with screens chat/game/levels/dragon/posted/viral/email/reply/choice (emoji replaced by drawn shapes).
- `web/story.js`: rewritten, driven by `web/timeline.js` (TL.sent = 11 [f0,f1] spans, TL.keys = key-word frames, TL.total).
- `web/timeline.js`: PLACEHOLDER even spacing (total 1800). Replace once the voice is timed.
- Mine world is hidden (worldAt returns mine zeros, rh 0, chairs 0).

## To do
- [ ] Test-render every screen with the placeholder timeline; fix visual bugs (agent "screens").
- [ ] audio.py cue table for this story, reading frames from web/timeline.js (agent "sound").
- [ ] New private GitHub repo `short-claude-jogo` + workflow (TOTAL frames from timeline), voice pipeline script `prep_voice.sh` (agent "repo").
- [ ] When MP3 arrives: voice.wav → clean_voice.py → whisper pt timings → write web/timeline.js → audio.py → mix.py.
- [ ] Cloud preview scale 0.4 → review_sheets → fix → final scale 1 → deliver to ~/Desktop/VideosClaude/Short2-claude-jogo/ with stems.
