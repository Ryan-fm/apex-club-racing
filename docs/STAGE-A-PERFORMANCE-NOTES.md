# Stage A implementation notes

Date: 2026-09-15

## What changed

- Added a diagnostics-only performance probe. Open `/?perf=1` or `/?slice=gate&perf=1` to show the APEX PERF panel.
- Added a fixed playable gate slice at `/?slice=gate&perf=1`. It selects Jade Citadel, TITAN, solo race, starts near the gate approach, skips the first-time lesson, and temporarily enables auto throttle for this diagnostic entry without saving that setting.
- Extracted normalized player input into `runtime/input-frame.js`. This preserves the existing physical hotkeys, canonical actions, mobile input, and one-shot command semantics.
- Added cached DOM write helpers in `runtime/race-ui.js` and moved the high-frequency race HUD path to diff-before-write updates.
- Reduced redundant race effect work by skipping dead particles, avoiding temporary arrays in particle emission, only updating tyre mark positions when a mark is emitted, and exposing active particle/mark counts for diagnostics.
- Added performance and input-frame tests.

## How to compare

Use the same machine, browser, viewport, DPR, quality setting, language, and route.

1. Build and serve `dist/`.
2. Open `http://localhost:<port>/?slice=gate&perf=1`.
3. Run the gate sprint for at least 30 seconds.
4. Use **Save baseline** before a candidate change, and **Save candidate** after the change.
5. Compare p50, p95, p99, slow frames, physics steps, and the phase timings in the APEX PERF panel/localStorage entry `apex-performance-baseline`.

The browser preview on this machine after Stage A showed:

- Backend: WebGL2
- Viewport: 1280 x 720 at DPR 1
- Gate slice, TITAN, Jade Citadel
- Sample during short run: p50 about 16.7ms, p95 about 17.6ms, p99 about 17.7ms, 1 slow frame, no console errors

These numbers are a smoke check, not a device performance claim. Longer runs and target phone/desktop measurements are still required.

## Still pending

- WebGPU renderer experiment and material migration.
- Fixed-step replay harness for exact trajectory comparison.
- GPU timing where the browser/platform exposes it.
- Full matrix across two maps, six cars, Chinese/English, mobile landscape, and quality modes.
