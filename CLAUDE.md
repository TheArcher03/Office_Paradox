# Office Paradox — notes for Claude Code

**Studio:** Twofold Productions (Noah & Timothy Rogers). Claude Code writes the code; the brothers direct the design, art, story and playtesting.

## Read first
The studio's shared brain is the Google Drive folder **"Twofold Productions"** (not this repo). Before big changes, read:
- `02_Projects/office-paradox/PROJECT.md`: status, next steps and the **Tried so far** log. Check it before suggesting a fix.
- `02_Projects/office-paradox/design/prototype-stage-plan.md`: what each stage includes and when it's "done".
- `02_Projects/office-paradox/design/game-design-doc.md`: the game itself.
If you can't reach that folder, ask the brother you're working with before changing direction.

## The game in one line
A gray office cubicle with no task list. Do something creative and the world quietly rewards you (very gradual color). Eventually the player learns they aren't human and the cubicle is a test chamber.

## Design rules that matter in code
- **No task list, no directions.** Tasks are hidden. Never add UI that tells the player what to do (control hints like "E · sit" are fine).
- **Color returns very slowly and globally**, driven by a hidden cognition meter (Stage 2). Never by category.
- **Journal:** written entries for completed tasks; hint doodles only on the very back page, hidden until a player stalls.
- **Original only.** The computer's offline game plays like the classic jump-over-obstacles runner, but it's ours: an alien in a UFO hopping asteroids and shooting stars across planets. No borrowed art or names.

## Tech
- Three.js (3D) + cannon-es (physics), bundled with Vite into **one self-contained file**.
- `npm install` → `npm run dev` (play locally at the printed URL) → `npm run build` → `dist/index.html` (open it in a browser to play, or share it).
- Code layout: `src/main.js` (loop, player, grab/throw, camera, HUD) · `src/room.js` (cubicle, props, colliders) · `src/textures.js` (canvas-drawn placeholder textures) · `src/grayFilter.js` (the gray/grain look) · `src/audio.js` (placeholder sound made in code).
- Tuning knobs live at the top of `src/main.js` (`TUNE`). Press ` in game for the color slider.
- Controls: E sit/stand · C kneel → crawl · Space stand up · click grab / drop · hold click + pull back + flick up to throw · right-click inspect.
- `window.__op` exposes test hooks for automated browser checks (headless Chromium + screenshots). Keep them working.

## Pushing to GitHub
- Repo: `TheArcher03/Office_Paradox`. Remote: `git@github.com:TheArcher03/Office_Paradox.git` (SSH, same setup as Tavern Tales).
- Pushes work from Noah's Mac (his SSH key is registered with GitHub). A cloud Claude session can only push if GitHub is linked under claude.ai → Customize → Connectors.
- Every push to `main` deploys the game to GitHub Pages: https://thearcher03.github.io/Office_Paradox/

## How we work
- Build in small playable steps; every stage ends with something the brothers can play.
- Commit after every working step with a clear message.
- Claude can test logic and take screenshots, but only the brothers can say if it's fun. Note playtest results in the Drive folder's Tried so far log.
