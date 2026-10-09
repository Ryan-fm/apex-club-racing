# Toy leaderboard branch

Official SDK reviewed on 2026-10-09: https://www.bilibili.com/toy/publish/sdk

Branch: `codex/toy-leaderboard`, based on main after ramp removal. This branch uses Toy instead of Supabase for public rankings and score submission. It does not publish a Toy automatically.

## Ranking contract

- SDK URL: `https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js`; lazy loaded outside the driving loop, with timeout and capability checks.
- Board 1: Bay standard; board 2: Citadel standard; board 3: Harbor standard. Boards 4–5 reserved. Toy exposes five boards, so all six circuit/assist combinations cannot be split independently. Assisted races remain local.
- Score = negative completed three-lap race time in integer milliseconds. Toy retains the highest score and sorts descending, so shorter time wins. Supported score range -16777216 to 16777215; reject out-of-range race times. Toy resolves ties by earliest achievement.
- `getRankList({board,period,limit:50})` returns rank, score, nickname, avatar only; it does not store kart or replay metadata. Rules replace the old kart column. Periods: all/month/week/day. Board reads require no login.
- `submitScore({board,score})` is triggered by the results button for a valid standard three-lap finish. Platform handles Bilibili login/profile confirmation. No custom account/password is needed; no Supabase fallback.
- Profile access is optional and click-triggered on the account page. Do not retain or log toyOpenId. A profile connection is scoped to this page; it is not a separate game login.
- Reads are cached per board/period, in-flight requests are coalesced, refresh is manual. Submissions are deduplicated per result in the current page. No polling, no driving-loop SDK calls, no immediate automatic retries; rate limit 307044 displays a later manual retry message. All players share a Toy quota; exact limits are not public.
- Public board layout and error handling are testable locally; live identity, confirmation, score persistence and cross-device ranks require the published/preview Toy container. SDK loading alone does not grant Toy capabilities on localhost/Vercel.
- Client-side race validation is retained; Toy receives only a score, not the three lap traces. This is not server-authoritative race validation. Keep board semantics stable across subsequent updates; changing rules in these slots mixes historical records.

## Friend rooms / multiplayer feasibility

The documented ability list contains no create/join/leave room API, matchmaking, friend list, socket transport, broadcast or state synchronization. Author relationship APIs describe the visitor's relationship to the Toy author, not arbitrary friends.

Cloud storage is isolated by logged-in user + Toy, not a shared room database. It has no documented cross-user reads or atomic room operations; do not use it to poll vehicle positions.

Toy can supply invitation entry points: `share({path:'race.html?room=...'})` in the Bilibili App and `getQrCode({path:'race.html?room=...'})` in App/Web. Links must remain inside the current Toy. Neither API creates the room or carries real-time race updates.

To implement live friend racing, add a separate room/signaling service and a WebSocket authoritative simulation or WebRTC data channel design. Implement room codes, membership, ready state, start synchronization, disconnects, reconnects, results and validation. Check the Toy runtime's external network/WebSocket policies with a prototype before choosing the transport. Optional toyOpenId can associate users within this Toy after platform confirmation, but it is not a server-verifiable login credential in the documented APIs. No multiplayer code is introduced by this branch.

## Validation

Run `npm test` and `npm run build`. Before Toy publication, run the Toy content preflight and verify the actual Toy preview. Test guest ranks, login/permission cancellation, successful submission, slower result retention, period changes, unsupported environment and rate-limit handling. Publication/review submission is a separate step.
