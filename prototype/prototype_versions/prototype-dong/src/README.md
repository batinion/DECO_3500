# Launch Sequence — Group Submission Ritual

A working local-network prototype of the "submission + sealing" phase of the digital
time-capsule concept: 4 friends join a session, each fills in a star field of
fill-in-the-blank prompts about the course they just finished (plus an optional
sketch/photo), and once everyone's submitted, a shared "Mission Control" screen plays
a launch animation and reveals everyone's randomly-assigned mission colors. Some time
later, clicking through unlocks a short puzzle-and-reopen epilogue that reveals
everyone's original answers back on Mission Control.

## What's here

```
/server   Node.js + Express + Socket.IO. Owns all session/scene state and serves:
            /                          Mission Control (big screen): scene + QR/join code,
                                       crew HUD, dev controls. Interactive.
            /scene?role=participant    The same scene, view-only (no dev controls,
                                       pointer-events: none). Embedded by the app.
            /scene/scene.js|css        The shared scene module (one source of truth).
/app      Expo (React Native) app. What each participant runs on their own device via
          Expo Go, or in a browser via `expo start --web`.
```

No database, no cloud services, no auth beyond the join code. Everything is local
network only — the server and every participant device must be on the same Wi-Fi.

## The shared live scene

Mission Control's scene is the shared world every participant sees. It is **not**
reimplemented in React Native: the app embeds `/scene?role=participant` full-bleed behind
all of its UI (`<iframe>` on web, `react-native-webview` on native — works in Expo Go).

* The server owns the scene state (phase, `phaseStartedAt`, lit engines, submission count,
  time-jump step, colours, capsule) and sends a `scene_state` snapshot on connect/reconnect
  and on every phase change.
* Every screen derives its animation from *elapsed time since `phaseStartedAt`* on a
  server-synced clock (ping on connect), so screens stay in step and a reloaded screen
  lands at the right point instead of replaying the launch.
* Mission Control is the only controller. Controller events (`advance_scene`,
  `start_puzzle`, `simulate_*`, `skip_to_reveal`, `session_reset`) are only accepted from
  sockets that connected with `role=mc`.

Phase machine: `joining → launching → cruising → arrived → timejump → earth → puzzle → revealed`

| Phase | What happens |
|---|---|
| joining | Rocket on the pad, moon in the sky. Each join lights that engine (`engine_ignite`) on every screen. |
| launching | 4th join → liftoff, clears the atmosphere, heads for the moon (~8 s, `launch_sequence_start`). |
| cruising | Memory Stars open on every participant over the live scene (rocket flying through a streaming starfield). The moon draws closer with each submission. |
| arrived | All 4 submitted → rocket reaches/orbits the moon; colours assigned and revealed on Mission Control. |
| timejump | Leaving the moon → "Cooking the space!" → "3 years have passed". Click on Mission Control to advance each step. |
| earth | Rocket reaches Earth; click Earth on Mission Control to start the "Guess Who" game. |
| puzzle | **"Guess Who"** — every submitted memory whose prompt named a friend (e.g. *"\_\_\_'s 'five minutes' always meant..."*) becomes a shuffled flash card, shown one at a time on Mission Control with the name blanked out. The crew discusses and guesses **out loud, together** — Mission Control clicks **Reveal** to show who it was really about (plus a short discussion prompt), then **Next memory** to continue. Free-write entries (no chosen friend, or no name slot in the template) aren't used as cards — they still appear in the final capsule. If nobody wrote anything guessable, this phase is skipped automatically. |
| revealed | After the last card (or the automatic skip), the capsule opens on Mission Control — every entry from every participant, plus photos/drawings. |

### Testing it without four phones

Two Node scripts drive the whole flow (including every Guess Who card) end-to-end over real Socket.IO connections, no UI needed — useful for confirming the server still behaves after a change:

```bash
cd server
node src/index.js &          # start the server first
TEST_URL=http://localhost:4000 node e2e_test.js        # full 4-person flow, 12 guessable cards
TEST_URL=http://localhost:4000 node e2e_test_empty.js  # edge case: zero guessable cards
```

Both exit non-zero with a clear message on failure (mismatched card counts, a stuck phase, a missing field, etc).

## Running it

### 1. Start the server (on the "5th laptop")

```bash
cd server
npm install
npm run dev
```

This prints the LAN IP, port (default `4000`), and a join code to the terminal, and
serves **Mission Control** — open `http://<your-lan-ip>:4000` full-screen on that laptop.

### 2. Start the participant app

```bash
cd app
npx expo install # first time only; installs react-native-webview and other deps
npx expo start
```

This prints an **Expo dev QR code** — scan that with Expo Go. **This is a different QR
code from the join code shown on Mission Control** — don't mix them up. Alternatively
press `w` (or run `npx expo start --web`) to open the app in a laptop browser.

`react-native-webview` is the one new native dependency (it renders the scene on phones);
it is included in Expo Go, so no dev build is needed.

**Where the scene comes from before login.** The scene needs Mission Control's address
before the participant has entered their name. The app resolves it in this order:
1. `?server=ip:port` in the page URL (web), e.g. `http://localhost:8081/?server=192.168.0.10:4000`
2. the last address used (AsyncStorage)
3. otherwise a static starfield, and the live scene loads as soon as a valid IP/port is
   typed or scanned.

### The participant flow

1. **Landing:** the whole screen is the live Mission Control scene. A compact panel (bottom-right
   corner, or a bottom sheet on narrow phones) has the join form: scan the QR or type
   name / code / IP / port.
2. **Join = ignition:** your engine lights on Mission Control and every participant screen.
   The panel reads "Engine N lit — waiting on X more crew".
3. **4th join → launch** to the moon, in sync on every screen.
4. **Memory Stars** appear over the cruising rocket. Tap stars to fill in prompts (collect at
   least 3), optionally sketch / add a photo, then submit. A "2 of 4 submitted" chip shows
   crew progress; Mission Control shows it as a crew HUD.
5. **All submitted →** arrival at the moon, your 2 mission colours, time jump, Earth —
   all mirrored on your screen, advanced only from Mission Control.
6. Click Earth on Mission Control → "Guess Who" begins. Participants' phones just show a
   "look up at Mission Control" message — the game itself plays out on the shared screen,
   one memory card at a time, with the group guessing and discussing out loud before each
   reveal. After the last card, the capsule opens on Mission Control.

### Solo / dev testing

You don't need 4 people to test the full flow:

1. Start the server and open Mission Control in a browser.
2. Load the app in a laptop browser and/or Expo Go and join with your real name — your
   engine lights on all screens.
3. **Simulate joins** (dev bar) — staggered fake joins light the other engines; the 4th
   triggers the launch on every screen.
4. When Memory Stars open, answer and submit your own, then **Simulate submissions** —
   the simulated crew submits (real participants always write their own), which triggers
   arrival, colours, and the time jump.
5. Click through the time jump on Mission Control, then click Earth.
6. **Skip to reveal** force-submits everyone and jumps to the opened capsule.
   **New Session** resets everything (new join code) and broadcasts to every scene.

## Notes

- Both devices/laptops must be on the same Wi-Fi network — no VPN that isolates
  local traffic.
- A participant who disconnects keeps their engine lit; reloading mid-session returns them to
  the correct scene state (no launch replay).
- The scene renders on one `requestAnimationFrame` loop, with fewer background stars and a
  30 fps cap on the participant view, and pauses while the page/tab is hidden.
- Session state (who's joined, engine status) is in-memory only and resets if the
  server restarts. Submitted answers/photos/drawings are written to
  `server/submissions/<session-code>/<participant-id>/` as they come in, so real
  answers survive a server restart even though the live session doesn't.
- The freehand sketch on page 2 exports as PNG using `react-native-svg`'s
  `toDataURL` — this works in Expo Go and in `expo start --web`'s browser preview
  in modern browsers. If it's ever unsupported in a given preview environment, the
  app shows a clear message rather than crashing; nothing else is affected.
- The fill-in-the-blank prompt bank lives in `app/src/lib/prompts.js` — edit it to
  change what prompts get offered. 6 are randomly selected per session, plus the
  always-present free-write star (7 total).
- Out of scope for this build: accounts, cloud sync, and multi-session support.
