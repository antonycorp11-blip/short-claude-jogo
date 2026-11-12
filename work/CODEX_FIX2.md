# Fix pass 2 — full-video review by the supervisor

The user rejected v1: objects overlap and pass through characters, and the voice has room noise. The supervisor reviewed
the WHOLE final video at 3 fps (sheets in `work/review1/review_01..06.jpg`, each tile labeled with seconds + frame).
Fix every item below. Times are seconds / frames of the final video.

## A. Visual problems (all must be gone)

**Root cause to address globally:** characters are flat cards, so any 3D object closer than the card's plane slices
through them. Rule from now on: **no world geometry, prop or other card may intersect or cross in front of a character's
card unless it is clearly in front with a visible gap (≥0.35 m in depth), and no two character cards may overlap
each other's face or body by more than a hand.** Pickaxes and signs belong to their owner and must not reach into neighbours.

1. **Desk shots (0-12 s, 17.8-20 s, 27.8-41 s): the CRIADOR stands *inside* the desk.** The black keyboard bar crosses
   his neck/shoulders and the black chair box sits in front of his legs in every desk shot. Re-stage: either he stands in
   front of the desk (desk + keyboard fully behind him, chair moved aside or removed) or he sits behind the desk with
   the desk top below his chest and NOTHING crossing his face/neck. Keyboard sits on the desk.
2. **Shot 3 (13-17.5 s):** two miners overlap each other at ~13.5 s; neighbours' pickaxes poke into the bearded miner;
   miners are cut in half at the frame edges; the bearded miner stands on the rails with sleepers through his legs.
   Space the miners out (beside the track, on grass), keep each fully inside the 9:16 frame or fully out.
3. **Shot 3 shows "GREVE!" signs already at 16.8 s.** Only the bearded miner's "FÉRIAS JÁ!" belongs in shot 3.
   "GREVE!" signs appear only in shot 5 (strike).
4. **17.8-20.2 s:** the push-in on the CRIADOR crops the monitor text ("INA CRIADA") and then the camera passes
   *through/behind* him — at ~19.8 s he vanishes and only the chair is visible; at ~20.2 s the camera is inside the
   monitor frame. Use a clean cut or a whip-pan that never enters geometry or a character.
5. **Shot 4-5 (20.5-27.5 s):** the RH's clipboard/arm overlaps the miner next to him; a pickaxe passes through the RH;
   the RH booth wall crops people at the right edge; miners are half outside the frame; the strike march at 25.8-27.5 s
   is too far away (tiny people, unreadable signs). Stage the RH clearly in front of his booth with space around him;
   for the strike, a closer framing where 3 miners + RH and their "GREVE!" signs are readable.
6. **37.2-37.6 s:** the jaw-drop push-in goes too far — the notification text is cropped ("ocê foi / emitido") and the
   camera tilts into the monitor. Keep "Você foi demitido." fully readable during the sting; push in less.
7. **40.2-41.6 s:** an orange miner card is sitting *inside* the desk at the right; the creator's new pickaxe crosses
   his body and the cropped monitor text is unreadable while the camera moves. Remove/move the miner, keep the
   pickaxe at his side, keep the notification text readable until the cut to the mine.
8. **Shot 10 (41.8-46.5 s):** miners and RH appear sliced by the beach chairs (cards intersecting chair geometry);
   RH isn't readable; chairs read like benches. Put each relaxing character clearly in front of / on its chair without
   intersection, sunglasses visible, RH visible; keep the creator framed without the rails cutting through his legs.
9. **Text crops:** the "MINA" sign is cut at the top edge in many shots (14-17 s, 24-26 s, 45-46 s). Frame it fully or
   leave it out entirely — no half-cut text anywhere.

## B. Audio
10. **Clean the voice** (room noise). Make `clean_voice.py` (or a shell step) that writes `voice_clean.wav` from
    `voice.wav` WITHOUT changing timing or length: try ffmpeg `afftdn` (with a noise profile from the silent spans
    0.0-2.9 s and 44.4-46.4 s) and/or `arnndn` with an RNNoise model downloaded from github.com/richardpl/arnndn-models
    (e.g. `std.rnnn`); add highpass ~80 Hz. Pick the version with the lowest noise floor in the silent spans that
    still sounds natural (avoid metallic/underwater artefacts — keep the reduction moderate). Print the noise floor
    before/after (dBFS RMS of the silent spans) and the speech RMS before/after.
11. `mix.py` must use `voice_clean.wav`. Keep music −6.0 dB and SFX ≤ −6 dB vs the voice's gated RMS, peak ≤ −1 dBFS.
12. **Separate stems:** `finish.sh` must also write to `out/`: `voz_limpa.wav`, `trilha.wav`, `efeitos.wav`
    (each 48 kHz, full length, same levels as in the mix, before loudness normalisation is fine but say so) and
    `video_sem_audio.mp4` (same picture, no audio track). Update `.github/workflows/render.yml` so the `video`
    artifact uploads all of those files plus the mp4 and qa sheet. Commit `voice_clean.wav`, the new stems sources
    and `mix.wav` to the repo.

## C. Verify with a full-video preview in the cloud (not just stills)
- After fixing, `git add -A && git commit` (end the message with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) and `git push`.
- Start a cheap preview: `~/.local/bin/gh workflow run render.yml -f scale=0.4 -f title=preview` ; wait for it
  (`gh run watch <id> --exit-status` or poll `gh run view`), then `gh run download <id> -n video -D out/preview`.
- Make full-video review sheets: `python3 ~/shorts/tools/review_sheets.py out/preview/preview.mp4 work/review2 3 6 4`
  and LOOK AT EVERY SHEET. Check every item A1-A9 and the global rule. Iterate (fix → push → preview → sheets) until
  no item remains. Max 3 preview iterations; if something still fails, say which.
- Do NOT start the full-resolution render (the supervisor will).
- Final report: what you changed per item, noise-floor numbers, the preview run IDs, and any remaining issue with its
  time code.
