[← Back to the game](../README.md)

# Development guide

A browser-based Three.js arcade kart racer with a race lobby, 3-lap races, solo and 4v4 AI team competition, charged drifting and mini turbos.

## Run locally

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 from the repository root. Three.js 0.179.1 is included locally under `vendor/three`; the game has no runtime CDN dependency.

## Race modes

- **Team:** one player and three AI teammates versus four AI opponents. Choose blue or red in the lobby.
- **Solo:** one player versus seven AI opponents.
- Local single-player simulation; no network multiplayer, friend invitations or room service is implemented.
- 3-second countdown, 3 laps, finish order, results table and replay/lobby actions.
- Rank scores: **15 / 12 / 10 / 8 / 6 / 4 / 2 / 1**. Team with more points wins; equal scores produce a draw.
- Race ends when all racers finish or 20 seconds after the first finish. Unfinished racers are DNF and score zero.
- Live team scores are provisional, based on current positions; results use confirmed finish positions.

## Controls

- Automatic acceleration is enabled by default and can be disabled in the lobby.
- **Up:** accelerate; **Down:** brake or hold at rest to reverse. Brake overrides auto throttle.
- **Left / Right:** steer. Auto throttle never steers the vehicle.
- **Shift + direction at speed:** start a drift. Keep Shift held while countersteering. Release at 32% charge for an exit-boost opportunity, or 78% for a stronger one. Wall contact cancels charge.
- **W:** trigger the ready mini boost after releasing drift, leaving a gold ramp, or landing. Release alone does not fire it. Countersteering on release offers a cut boost. A press up to 100ms before a genuine take-off/landing window is buffered once.
- **Ctrl:** consume one nitro unit for a 2.1-second boost. Up to three units can be stored. Release Ctrl before pressing W for a combo.
- Rebind keys in **Settings → Custom hotkeys**. UI hints follow the saved bindings. These are desktop defaults; phone buttons retain their actions.
- Q: EMP affects nearby opponents, excluding teammates in team mode.
- H: pause/help; R: restart the entire race including AI and countdown.
- Choose from six karts before racing; the lobby previews the body kit and displays speed, acceleration, handling and drift charge rate.
- COMET: agile; APEX: balanced; BOLT: top speed; SLIDE: drift specialist (1.4× APEX charge rate); TITAN: heavy off-road styling with reduced collision displacement; VINTAGE: fastest acceleration with a lower top speed.
- Team races apply team paint while retaining each kart’s shape and handling. AI racers also use the expanded garage.

## Visuals

Procedural 3D karts with painted bodywork, drivers, helmets, wheels and rear wings; sea, landscaped islands, clouds, barriers, corner signs and start/finish gate. Drift sparks, dynamic exhaust, speed lines, live minimap and teammate labels.

## Verification

```sh
node --check game.js
npm test
```

Tests cover 4v4 allocation, absolute lap progress, finish crossing order, DNF timeout, scoring, charged-drift release and wall cancellation.

## Driver profile

The lobby includes an articulated helmeted 3D driver with a fitted racing suit, gloves, boots, reflective visor, studio lighting and contact shadows. Stand, Dance (Street Groove), and Victory animations blend between connected limb poses. Drag the avatar or focus its canvas and use Left/Right to rotate. Animations blend smoothly between poses and stop rendering during races or while the browser tab is hidden. Character geometry and animation are generated locally; no external character files are required.

## Release build

```sh
npm run build
```

Publish the contents of `dist/` to a static HTTPS host. Optional online accounts and global best laps use Supabase; see [Online club setup](ONLINE-CLUB.md). The build adds a content revision to local JavaScript and CSS URLs to prevent stale modules after an update. The included `_headers` file sets conservative response headers on hosts that support it; configure equivalent headers elsewhere. Do not publish the project root, test artifacts or `output/`.

Requires a modern browser with WebGL 2. Desktop keyboard and mobile touch controls are supported; tilt steering depends on device sensors and permission. No online multiplayer.

## Handling and accessibility

- Drift starts with a small hop, progressive yaw and tyre slip; countersteer adjusts the line without instantly reversing the slide.
- World-space tyre marks, smoke and sparks show the path of a drift. Blue charge upgrades to orange at the super-turbo threshold.
- Nitro and mini turbos use exhaust, a duration meter and controlled field-of-view changes. Excess speed decays gradually when boost expires.
- `Sound & display` contains optional procedural engine, tyre and boost audio; reduced camera motion; a lower-cost graphics mode; and a toggle drift key option. With toggle drift enabled, steer once to choose a direction, then tap Shift to start and tap again to release.
- H or Escape pauses; losing window focus or hiding the tab pauses active racing. A startup error screen handles unsupported graphics or failed module loading.
- Automated tests cover racing, saved keys, language, customization, boost chains, collision recovery and fixed-input replay consistency.

## Third-party notice

Three.js 0.179.1 is distributed under the MIT license. The required runtime modules and the original notice are in `vendor/three/`. Procedural game geometry and audio do not load external models, textures or sound files.

## TITAN armored buggy

Open `garage.html` for the 360-degree model showroom: front, side, rear and top views, orbit/zoom, three finishes, wireframe and an optional seated driver. TITAN replaces the former RALLY slot and is selected by default. The showroom and race share `armored-kart.js`, including steerable wheels and model-specific tyre/exhaust effect anchors.

The original procedural model follows the supplied heavy off-road racing reference: deep-tread tires, layered armor, double-wishbone suspension with coil springs, a bucket seat and roll hoop, intake stacks, rear cooling fans, twin exhausts and detailed front/rear lighting.

Run `npm run export:model` to generate `output/titan-armored-buggy.glb`. The portable GLB includes the full static vehicle with PBR materials and individual wheel/structural nodes; runtime flames and the optional driver are excluded. Instanced tire blocks are expanded for compatibility. Wheel animation remains controlled by the game.

## Mobile controls

Play in landscape on a WebGL 2 phone browser. Left/right arrows, brake, throttle, held drift, nitro and EMP support simultaneous touches. Auto acceleration is recommended. Fullscreen/landscape is best effort; on iPhone, rotate manually and disable rotation lock.

Enable tilt steering in Phone controls, grant motion permission if prompted, hold the phone comfortably to calibrate, then lean left/right. Center steering resets neutral; touch arrows override tilt. Permission denial, missing sensors or stale readings fall back to touch. Rotation pauses racing so you can resume safely. Real-device iOS/Android sensor testing is still recommended; automated checks validate screen-axis mapping and dead zone, not hardware.

## Manual steering physics

Player movement uses independent world position, heading and velocity. Auto throttle only accelerates: no steering means the car continues straight and can hit the outside barrier. Drift retains momentum; countersteering changes heading. Track projection measures signed race progress, so driving backwards subtracts distance. Wall impacts cancel drift charge and boost. Pause and choose **Recover car to track** if stuck; recovery does not increase progress. AI opponents still follow their racing routes.

## Three-turn gate practice and diagnostics

Open `/?slice=gate` or select **Gate run · Three-turn practice** in the lobby. This solo segment starts at the citadel gates and ends after three bends and a gold ramp. Challenge results use `apex-challenge-citadel-gates-v1-*`; official lap records, ghosts and medals are untouched.

For a reproducible developer check, open `/?slice=gate&perf=1&replay=gate`. This explicit diagnostic mode drives from a recorded input tape and saves no challenge records. Ordinary practice and races remain manually steered. `node scripts/generate-driving-replay.mjs` regenerates the tape using the production simulation; `npm test` replays it at 30/60/120 display Hz.

The performance panel records untrimmed race-only frame intervals, CPU phase durations, renderer calls and triangles. Pause/countdown/lobby frames are excluded; physics catch-up is capped independently. Export JSON to retain raw samples. GPU duration is unavailable; CPU render submission time is not GPU execution time. Compare identical scene, car, quality, resolution, language and input tape on the same device.
