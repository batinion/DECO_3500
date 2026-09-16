# Launch Sequence — Group Submission Ritual

A working local-network prototype of the "submission + sealing" phase of the digital
time-capsule concept: 4 friends join a session, each answers 6–7 questions about the
course they just finished, and once everyone's submitted, a shared "Mission Control"
screen plays a launch animation and reveals everyone's randomly-assigned mission colors.

## What's here

```
/server   Node.js + Express + Socket.IO. Serves the Mission Control web page (the
          "5th laptop" display) and coordinates all real-time state.
/app      Expo (React Native) app. What each of the 4 participants runs on their
          own device via Expo Go, or in a browser via `expo start --web`.
```

No database, no cloud services, no auth beyond the join code. Everything is local
network only — the server and every participant device must be on the same Wi-Fi.

## Running it

### 1. Start the server (on the "5th laptop")

```bash
cd server
npm install
npm run dev
```

This prints the LAN IP, port (default `4000`), and a join code to the terminal, and
also serves the **Mission Control** page — open the printed URL
(`http://<your-lan-ip>:4000`) full-screen in a browser on that laptop.

### 2. Start the participant app

```bash
cd app
npx expo install # first time only, if versions drift
npx expo start
```

This prints an **Expo dev QR code** — scan that with the Expo Go app to load the
JavaScript bundle onto your phone. **This is a different QR code from the in-app
session join code shown on Mission Control** — don't mix them up. Alternatively,
press `w` in the Expo CLI (or run `npx expo start --web`) to open the app in a
laptop browser for the real 4-person session.

Once the app is open, each participant:
1. Scans the Mission Control join QR (or types in the IP/port/code shown there) and
   enters their name.
2. Waits in the waiting room until all 4 have joined.
3. Answers 7 questions (4 general + 3 about each of the other 3 friends by name).
4. Submits — their engine lights up on Mission Control and on every phone.
5. Once all 4 have submitted, everyone sees the launch animation and their own
   2 assigned "mission key" colors.

### Solo / dev testing

You don't need 4 people to test the full flow:

1. Start the server and open Mission Control in a browser.
2. Start the Expo app and load it in Expo Go on your phone (or `expo start --web`).
3. Join with your real name.
4. Click **"Simulate remaining participants"** on Mission Control — this fills the
   other 3 slots with fake names and canned answers, so you only need to answer and
   submit your own to trigger the full ignition → launch → reveal sequence.
5. Click **"New Session"** on Mission Control to reset everything and get a fresh
   join code, so you can re-run the flow as many times as you like.

## Notes

- Both devices/laptops must be on the same Wi-Fi network — no VPN that isolates
  local traffic.
- Session state (who's joined, engine status) is in-memory only and resets if the
  server restarts. Submitted answers/photos/drawings are written to
  `server/submissions/<session-code>/<participant-id>/` as they come in, so real
  answers survive a server restart even though the live session doesn't.
- The freehand drawing question exports as PNG using `react-native-svg`'s
  `toDataURL` — this works in Expo Go and in `expo start --web`'s browser preview
  in modern browsers. If it's ever unsupported in a given preview environment, the
  app shows a clear message rather than crashing; other question types are
  unaffected.
- Out of scope for this build: accounts, cloud sync, multi-session support, and the
  capsule concept's later phases (sealing countdown, reunion notification, the
  color-unlock ritual). The 2 assigned colors are stored as structured data
  (`{ name, hex }` pairs) so a future unlock mechanic can reuse them.
