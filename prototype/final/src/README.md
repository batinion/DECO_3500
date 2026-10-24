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

(or, to start everything at once, double-click `start-all.bat` on Windows / run `./start-all.sh` on Mac and Linux. That also starts the two standalone games on 4001 and 4002.)

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
| **Briefing** | First visit: a ~40-second animated briefing with sound (skippable, replay any time). |
| **Join (2 steps)** | 1) Pick an astronaut + type your name. 2) Two separate choices: **Join a crew** (just the 6-letter code) or **Create a new crew** (crew name → you get a code to share). |
| **Collecting (all semester)** | Crew home shows one "what to do next" line, **Load a memory**, sketch/photo, my memories and the ready button. Crew list, activity feed and demo tools are folded away. Memories are **capsules** you fill in and load onto the rocket. After each one, a **privacy card** shows exactly what you sent and how it's used. |
| **Practice mode** | Alone? "Add 2 simulated crewmates" — they write memories, get ready, and play both games. |
| **Boarding** | When everyone is ready, each astronaut walks up one by one, loads their capsule into the cargo hold, and climbs aboard. Hatch locks. |
| **Liftoff → time warp** | Countdown, liftoff, then a tunnel of light with a counter racing from Day 1 to Day 1,095 (the date ticks along). |
| **Earth → hatch breach** | Earth comes into view… the cargo hatch blows open and the memories scatter. Red alarm. |
| **Choose the activity** | Anyone picks for the crew: **Rescue mission**, **Colour restore**, or "skip and just open the capsule". |
| **Rescue mission (everyone, live)** | "Flight to the UQ Space Faculty": every phone flies its own ship in the same space (same seed → same black holes, debris, asteroids and memory capsules). Ships, asteroid hits and saved memories sync through the server ~10×/sec. D-pad bottom-left (▲ go, ▼ slow, ◀ ▶ turn), round Fire and High/Low buttons bottom-right, "next memory" compass card at the top, ? for how to fly. Simulated crewmates fly to a fair share of the memories. Once every memory is saved, anyone docks to finish. |
| **Colour restore** | dialed.gg color-toon style: an original UQ illustration (brush turkey, bin chicken, jacaranda, lorikeet, Great Court sandstone, UQ hoodie, the lakes, the lawn) shows its real colour for a few seconds; then you recreate it with three tall hue / saturation / brightness strips while the illustration recolours live. 2 "peeks" per game (lamp button). Results: score out of 10 to two decimals, "you" vs "target", the crew average restores that round's memories, → for the next round. |
| **Capsule open** | A memory wall: photos and sketches as polaroids, messages as bright notes, in a masonry gallery (2–4 columns). Awards and filters on top. Tap any memory to open it full screen, flick ← →, see how it was saved, and **guess who wrote it** before the name is shown. |

## Showing a whole semester in a few minutes (testing / showcase)

On the crew home, open **Demo tools (for testing)**:

- **Skip ahead a week**: moves the crew's calendar on, so the prompts change (start → mid → end of semester) and new memories get the new week.
- **Testing alone? Add 2 simulated crewmates** (on the crew home when you're the only one): the quickest way to run the whole thing solo.
- **Add a simulated crewmate / … add a memory / … get ready**: finer control.
- In either game: **Demo: finish** (bottom-left) brings every memory home straight away.

## Where things live

```
/server
  src/index.js        HTTP + Socket.IO; per-crew rooms; the phase machine (runs itself)
  src/crews.js        Crew state: members, memories, readiness, weeks — saved to data/crews.json
  public/scene/       The shared rocket scene (each phone embeds /scene?code=XXXXXX)
  public/intro/       The ~1-min mission-briefing clip (served at /intro)
  public/game/        flight.html + flightworld.js (live multiplayer rescue) + colors.html (colour restore)
  src/games.js        Game rules, scoring and the simulated crewmates' play
  src/uqColors.js     The colour list for Colour restore (edit freely)
  public/sfx.js       Spacecraft sound effects, shared by the clip and the app
  web-app/            The built participant app, served at /
  data/crews.json     All crews + memories (survives restarts; delete to start fresh)
  submissions/        Uploaded photos and sketches, per crew/person
/app                  Expo (React Native) app — runs as the web app, or in Expo Go
  src/lib/prompts.js  The Memory Star prompt bank (edit freely)
  src/screens/        Join, CrewHome, StarField (memory capsules), DrawUpload (sketch/photo),
                      MyMemories, Lost (pick the activity), Capsule
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
  session. Good enough for testing.
- The privacy card tells participants their memories are uploaded to the "Launch Sequence
  cloud" for this test only. While you run it on a laptop, they're actually stored on that
  laptop (`server/data/` and `server/submissions/`). Delete those folders after a session.
- Max 6 crewmates per crew.
