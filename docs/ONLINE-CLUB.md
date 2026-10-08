# Global fastest race leaderboard (version 1)

The game remains a static site. Player-name/password accounts and the global race database run in Supabase Postgres through restricted database functions. Friend rooms and live multiplayer are reserved for version 2. The project URL and publishable key are configured in `online-config.js`.

## Provisioning

1. Create a Supabase project and run `supabase/migrations/202610080001_online_club.sql`, `supabase/migrations/202610080002_username_password.sql`, then `supabase/migrations/202610080003_best_races.sql` in its SQL editor.
2. The game uses player names and passwords directly; Supabase Auth email confirmation and SMTP are not used.
4. Copy the project URL and **publishable** key into `online-config.js`. Never put a secret or service-role key in that file.
5. Build with `npm run build` and publish `dist/`. The configured public values are copied into the build.

Without these values, local racing still works and the online dialog explains that the service is unconfigured.

## Rules

- Each account claims one player name. Names are 3–16 English letters, numbers, underscores or hyphens; matching ignores case. The database unique constraint resolves simultaneous claims.
- Passwords are stored as bcrypt hashes. Sessions use random 256-bit tokens; only token hashes are stored in the database. Sessions expire after 30 days. Five failed logins lock that player name for 15 minutes. There is no email recovery flow in this version; a forgotten password requires administrator support.
- Each player keeps one fastest completed three-lap race for each track, assist setting and rules version. Kart choice is recorded but does not split the leaderboard. The time starts at GO and ends when the player crosses the finish line, matching the results table.
- Only a completed race with three valid six-sector laps is submitted. Recovery or changing assists invalidates the race. Local single-lap bests and ghosts continue to work offline.
- The database checks all three laps, sector order, duration, trace shape and impossible jumps before accepting an improvement. This is a basic abuse filter, **not authoritative anti-cheat**: a modified browser can still fabricate a plausible trace. Do not award valuable prizes based on this leaderboard. Competitive verification would require server-side replay or authoritative simulation.
- When track layout or driving physics changes, update `rulesVersion` in `online-config.js` and the allowlist in the SQL function, so incompatible race times are not mixed.

## Acceptance checks

Register two accounts and verify that the same name with different capitalization cannot be claimed twice. Complete all three laps while signed in, refresh, and confirm the whole-race time appears on the correct track and assist board. Improve the race and confirm only the faster time remains. Sign out and verify racing and local ghosts still work. Check that a recovered or incomplete race is not uploaded.
