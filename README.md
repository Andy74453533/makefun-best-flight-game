[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Andy74453533/makefun-best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Andy74453533/makefun-best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Island Runway

A 3D flight game for the [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057).

Fly a little propeller plane around a tropical island: chase view over sea, beach and
green hills, a runway on the south shore, and a course of glowing orange rings to fly
through. Each sortie is a new ring course — later ones fly lower and further out.
Fuel and hull turn every sortie into decisions: rings give points and a little fuel,
a good landing refuels the plane and banks a bonus, a hard landing costs hull, and
running out of fuel means gliding home.

## How to fly

- **W / S** — throttle up / down
- **Arrow keys** (or **A / D**) — bank and pitch; the mouse steers too while held
- **P** — pause, **M** — mute, **Space / click** — start, restart, next sortie

The HUD shows an attitude indicator, a compass tape, airspeed, altitude, vertical
speed, throttle, fuel and hull — plus stall, low-fuel and pull-up warnings.

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No network request, no build step. The 3D view uses the vendored three.js build in
`game/vendor/three.min.js`; every sound is synthesised with WebAudio.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json` with the vendored make.fun library
- `game/index.html` — the page (WebGL canvas + HUD canvas, no external references)
- `game/src/config.js` — tuning numbers, palette and key bindings
- `game/src/random.js` — seeded random (the same seed grows the same island)
- `game/src/input.js` — keyboard and pointer input
- `game/src/island.js` — terrain, sea, sky, clouds and the runway
- `game/src/plane.js` — the flight model (throttle, bank, pitch, stall, fuel, hull)
- `game/src/missions.js` — sorties, ring courses and scoring
- `game/src/audio.js` — synthesised engine, wind and chime sounds
- `game/src/render.js` — the 3D scene, the plane model and the chase camera
- `game/src/hud.js` — the cockpit overlay (instruments, warnings, panels)
- `game/src/shots.js` — the staged screenshot scenes with an autopilot
- `game/src/main.js` — boot, the fixed-step loop and the screens
- `screenshots/` — 3–4 real renders of the game, the first by name is the cover
