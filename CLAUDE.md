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
- Stage 3 tasks: play the UFO game to 50 points (Internet → Play) · print the cat (Pictures → cat.bmp → Print) · pin the printed cat to the corkboard (hold the sheet, look at the corkboard, click). Click the monitor to lean in; right-click leans back. While leaned in, the game releases the mouse so the player's real cursor is the pointer (`pointAtScreen` maps it onto the screen; the drawn pointer is only a fallback); leaning back captures the mouse again.
- Stage 4 (in `src/main.js`, the "Stage 4" block, plus `src/dream.js`): paper airplane (hold click on a flat sheet to fold, click to launch, mouse steers, flight cam) · pencil drums (click the pencil cup; left/right click or A/D; 16 clean hits in a row) · the nap (click the lever at the front-right of the chair seat: feet up, lean back, eyes close after a moment, a full-color dream, wake at 5:00) · replay cam (after most achievements, the last ~2 seconds replay from the "smoke detector" as grainy security footage). A quick click on a sheet still crumples it.
- Only one thing owns the view at a time: `busy()` is true during the computer, drums, flight, recline, dream and replay. Check it before adding input or hover behavior.
- Stage 5 (the "Stage 5" block in `src/main.js`, plus `src/doodles.js`): the workday runs 9:00 to 5:00 in about 8 real minutes (`dayRate`); at 5:00 the screen fades to the next day (`startDayEnd` / `applyOvernight`). Overnight: the calendar resets, an airplane thrown over the wall is back on the desk, and the plant appears from Day 3. From Day 2, good drumming gets a knock back through the wall. After `hintAfter` seconds without a discovery, one hint doodle appears on the journal's back page. At the end of Day 3 (or the day all 10 tasks are found): the third-person glitch, then the title card; clicking continues into Day 4.
- The detail pass (after Stage 5; no new tasks, it only makes the place feel real):
  - Look: `src/props.js` builds every object (rounded edges, real keys, cords, labels); `src/room.js` places them and builds the walls, ceiling, desk and the endless identical cubicles beyond the wall (`outside`). Relief (normal) maps and printed labels are drawn in `src/textures.js` (`normalMap`, `label`, `assetTag`). Lighting is in `src/main.js`: one shadow-casting ceiling spot (`sun`), soft fills, an environment map for reflections, then GTAO (contact shadows) → bloom → output → the gray filter. `TUNE.ao` / `TUNE.bloom` set to 0 turn those off if a machine struggles.
  - Things you can use live in `src/things.js` (`createThings`): desk lamp, fan (pushes loose paper), phone (lift the handset, dial with the number keys), stapler, mug (sip; E to examine), three drawers, the desk toy. Overnight they're all tidied back (`things.overnight`). To add one: build it in `props.js`, `usable(obj, 'name')` in `room.js`, handle `'name'` in `things.use`.
  - Keys: E picks up an "examinable" (`examinable(obj, name, size)` in `room.js`) and the mouse turns it over; hold Space to stand on the chair and look over the wall (`peek`); Shift or the mouse wheel leans in (zoom).
  - Hovering now uses the first solid thing under the dot (`firstHit` in `updateHover`), so objects block each other properly. Spindly things get an invisible `hitbox`.
  - Wall panels are 2.0 m tall (`ROOM.wallH`); an invisible collider continues to the ceiling so paper can't leave.
- Menu, radial menu and two hands (Noah's notes after the detail pass), all in `src/main.js`:
  - The overlay in `index.html` is a real menu: title screen (Clock in / Continue, New game, Controls) and, once playing, the pause menu (Resume, Restart run). `showMenu` / `startGame`; New game and Restart erase the save after one confirm click.
  - Right-click opens the radial menu (`radialOptions`, `openRadial`, `closeRadial`): hold, move toward a wedge, let go. Holding something: Put down / Left hand. Pointing at a thing with more than one action (mug, stapler): its actions. A quick right-click with something in hand still just puts it down. Never put a hidden task in the wheel (crumple and fold stay unlabeled).
  - `left` is the left hand, same shape as `held`. `swapHands()` (the wheel, or Q) passes things across. Tools are `pencil` (click the pencil cup) and `tack` (the tub under the corkboard); putting a tool down returns it to its container.
  - Two tasks now need both hands: a pencil in each hand starts the drums; pinning to the corkboard needs the sheet in one hand and a tack in the other.
  - The journal also sits in the top drawer (`use: 'journal'`); J still works. At the computer the drawn pointer is back and the real cursor is hidden over the glass. The nap shows no legs; only the camera leans.
- Tuning knobs live at the top of `src/main.js` (`TUNE`). Press ` in game for the color slider, throw strength and Reset the room.
- Controls (v4, seated pass; dot cursor added after Stage 5): the chair is locked in place. The dot is a cursor the mouse moves around the view (`dot`, in -1..1 screen units); past `edgeZone` from the middle it turns / tilts the view (`edgeTurn`, `edgeTilt` in `updatePlayer`). Everything that aims (hover, toss, pin, plane launch) goes through `aimRay()` / `aimDir`, not the view center. Click = use your hands: pick up paper → crumple a flat sheet → toss the ball where you're looking. Right-click / F puts it down. A / D spin the chair. J opens the journal. Only loose paper can be picked up; everything else is fixed.
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
