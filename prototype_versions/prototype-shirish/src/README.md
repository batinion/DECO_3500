# Launch Sequence — Crew Memory Capsule

A digital time capsule for a DECO course group. A crew collects memories about each other
**over the whole semester** — whenever something happens — and they stay sealed. When
everyone is ready (usually at an end-of-semester catch-up), the rocket launches, "3 years
pass", it comes home, and the crew opens the capsule together: the semester replayed week
by week on everyone's own phone.

**There is no host and no Mission Control screen.** Anyone can start a crew; everyone in it
has the same controls. Each person only needs their own phone or laptop.

## Run it

You need [Node.js](https://nodejs.org) (v18+) on one computer.

```bash
cd server
npm install      # first time only
npm start
```

(or double-click `start-servers.bat` on Windows / run `./start-server.sh` on Mac.)

The terminal prints two links:

```
On this computer:      http://localhost:4000
Phones on same Wi-Fi:  http://192.168.x.x:4000
```

Open the second link on every phone/laptop on the same Wi-Fi. That's it — no app to
install, no IP/port to type. One person taps **Start a crew**, then **Invite** shows a code,
a QR and a link for everyone else.

The web app is already built into `server/web-app/`. If you change anything in `/app`,
rebuild it with `npm run build-web` (in `/server`) and restart.

## Crew characters

Everyone picks one of 8 astronaut characters when they join. The crew stands around the
rocket on the launch pad. When someone drops a memory, their character hops and throws a
star into the rocket, and the person it's about looks surprised. Everyone also gets a small
notification with the author's face ("Ed dropped a memory about you 👀"). Characters show
up in the crew list, feed, crewmate picker, capsule reveal and briefing clip. They're
drawn in `app/src/lib/avatars.js` (served to the scene as `/avatars.js`).

## Mission briefing clip + sounds

The first time someone opens the link, a **40-second animated briefing** plays before the
join screen. It shows, step by step, what they'll do: form the crew → drop memories about
each other all semester → they stay sealed → everyone taps Ready → liftoff → it comes home
years later → open it together. It has spacecraft sounds: radio beeps, engines igniting,
memory chimes, a 3-2-1 countdown, a launch rumble, whooshes and a fanfare.

- Replay it any time: **"Watch the mission briefing"** on the join screen, or **"▶ How it
  works"** on the crew home. Open it on its own at `http://<ip>:4000/intro` (handy for
  showing on a laptop at the showcase).
- The same sounds play at the real moments in the app: an engine igniting when someone
  joins, a chime when a memory goes in, a ping when a crewmate is ready, the countdown +
  liftoff, a whoosh for the time jump, a radio call when the rocket is home, a fanfare
  when the capsule opens. There's a 🔊/🔇 button top-right.
- All sounds are generated live in the browser (`server/public/sfx.js`), so there are no
  audio files and nothing to license. Web only; in Expo Go the app is silent.

## The flow

| Stage | What happens |
|---|---|
| **Start / join** | Name + optional crew name → a 6-letter code. Friends join with the code, the invite link or the QR. Each person lights one engine on the rocket (2–6 crewmates). Coming back later with the same name puts you back in as yourself. |
| **Collecting (all semester)** | Crew home shows the week (1–13), the crew, a sealed activity feed ("Noah added a memory about you" — never the content) and live pop-ups when someone adds one. **Add memories** opens the Memory Stars: course prompts about a crewmate, each dropped into the capsule on its own. **Sketch / photo** adds a drawing or photo with a caption. **My memories** lists what you've added (only you can see them) and lets you take one out. Every memory shows up as a star flying into the rocket, and a cargo gauge on the rocket fills up. |
| **Ready for launch** | Once you've added at least 3 memories you can tap **I'm ready for launch**. When every crewmate is ready, the rocket launches by itself. |
| **Launch → moon → time jump → Earth** | Runs automatically, in sync on every phone. Mission colours are dealt on arrival at the moon. |
| **Rocket is home** | Anyone taps **Open the capsule** → the collaborative puzzle (still the Miro placeholder — next stage). |
| **Capsule open** | Everyone's phone shows the semester week by week, with "awards" (most remembered, crew historian, busiest week) and filters: about me, by me, about each crewmate. |

## Showing a whole semester in a few minutes (testing / showcase)

On the crew home, open **Demo tools (for testing)**:

- **Skip ahead a week**: moves the crew's calendar on, so the prompts change (start → mid → end of semester) and new memories get the new week.
- **Add a test crewmate / Test crewmates add a memory / Test crewmates get ready**: test alone without 4 people.
- At the puzzle: **Demo: skip the puzzle and open the capsule**.

## Where things live

```
/server
  src/index.js        HTTP + Socket.IO; per-crew rooms; the phase machine (runs itself)
  src/crews.js        Crew state: members, memories, readiness, weeks — saved to data/crews.json
  public/scene/       The shared rocket scene (each phone embeds /scene?code=XXXXXX)
  public/intro/       The 40-sec mission-briefing clip (served at /intro)
  public/sfx.js       Spacecraft sound effects, shared by the clip and the app
  web-app/            The built participant app, served at /
  data/crews.json     All crews + memories (survives restarts; delete to start fresh)
  submissions/        Uploaded photos and sketches, per crew/person
/app                  Expo (React Native) app — runs as the web app, or in Expo Go
  src/lib/prompts.js  The Memory Star prompt bank (edit freely)
  src/screens/        Join, CrewHome, StarField (Memory Stars), DrawUpload (sketch/photo),
                      MyMemories, YourColors, Puzzle, Capsule
```

### Editing prompts

`app/src/lib/prompts.js`. Each prompt has a `when` tag — `start` (weeks 1–4), `mid`
(5–9), `end` (10–13) or `any`. Each visit shows 6 stars weighted to the current part of
semester, skipping prompts you've already answered, plus one free-write star.
`{name}` = crewmate picker, `__` = a blank.

### Developing with live reload

Run the server (`npm start` in `/server`), then in `/app`: `npx expo start --web` and open
http://localhost:8081 — it connects to the server on port 4000 automatically. For Expo
Go on a phone, `npx expo start` and type the server's IP once under "Server address" on
the join screen.

## Notes / limits (prototype)

- Everyone must be on the same Wi-Fi as the computer running the server. For people to add
  memories from home over a real semester, the server needs to be hosted online (e.g.
  Render/Railway); nothing in the app would need to change.
- No accounts: you're identified by your name within a crew plus the browser's saved
  session. Good enough for testing; real privacy/access was raised in user testing and is
  out of scope here.
- Max 6 crewmates per crew.
