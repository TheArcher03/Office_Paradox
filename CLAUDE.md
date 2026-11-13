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
- Code layout: `src/main.js` (loop, seated player, pick up / crumple / toss, camera) · `src/room.js` (cubicle, props, colliders) · `src/textures.js` (canvas-drawn placeholder textures) · `src/grayFilter.js` (the gray/grain look) · `src/audio.js` (placeholder sound made in code).
- Stage 2 files: `src/brain.js` (hidden task list `TASKS`, cognition meter, save file in localStorage) · `src/journal.js` (the J journal; its last page is reserved for hint doodles and stays empty until Stage 5).
- Adding a task: add it to `TASKS` in `brain.js` (points, pop-up title, journal entry), then call `brain.complete('id')` from wherever the game detects it. Color follows cognition automatically, very slowly.
- Stage 2 tasks: paper ball in the trash can · 10 full chair turns in one direction (A / D or the mouse) · feed a spreadsheet sheet to the shredder (hold a flat sheet, look at the shredder, click) · cross off the calendar to the end of the month (click or hold on it).
- Stage 3 file: `src/computer.js` draws the whole in-game computer onto one canvas shown on the monitor: boot screen, the "deskOS" desktop, the no-connection browser, the picture viewer and the UFO game (`PLANETS`, `updateGame`, `drawGame`). The cat is `drawCat` in `src/textures.js`.
- Stage 3 tasks: play the UFO game to 50 points (Internet → Play) · print the cat (Pictures → cat.bmp → Print) · pin the printed cat to the corkboard (hold the sheet, look at the corkboard, click). Click the monitor to lean in; right-click leans back.
- Tuning knobs live at the top of `src/main.js` (`TUNE`). Press ` in game for the color slider, throw strength and Reset the room.
- Controls (v4, seated pass): the chair is locked in place and you spin 360° with the mouse. Click = use your hands: pick up paper → crumple a flat sheet → toss the ball where you're looking. Right-click / F puts it down. A / D spin the chair. J opens the journal. Only loose paper can be picked up; everything else is fixed.
- Held paper is pinned to the camera (low right of the view), not steered by physics. Loose props are drawn from the physics engine's interpolated positions so motion stays smooth on 120 Hz screens. Keep both.
- `window.__op` exposes test hooks for automated browser checks (headless Chromium + screenshots). Keep them working.

## Pushing to GitHub
- Repo: `TheArcher03/Office_Paradox`. Remote: `git@github.com:TheArcher03/Office_Paradox.git` (SSH, same setup as Tavern Tales).
- Pushes work from Noah's Mac (his SSH key is registered with GitHub). A cloud Claude session can only push if GitHub is linked under claude.ai → Customize → Connectors.
- Every push to `main` deploys the game to GitHub Pages: https://thearcher03.github.io/Office_Paradox/

## How we work
- Build in small playable steps; every stage ends with something the brothers can play.
- Commit after every working step with a clear message.
- Claude can test logic and take screenshots, but only the brothers can say if it's fun. Note playtest results in the Drive folder's Tried so far log.
