# Space-Cap: final build

*Called Launch Sequence in the code.* The source is in [`src/`](src/); walkthrough screenshots are in [`screenshots/`](screenshots/). All paths below are relative to `src/`.

A digital time capsule for a DECO course group. A crew collects memories about each other
**over the whole semester**, whenever something happens, and they stay sealed. When
everyone is ready (usually at an end-of-semester catch-up), the rocket launches, years pass
on Earth, the crew summons it home, and they open the capsule together: the semester
replayed on everyone's own phone.

**There is no host and no Mission Control screen.** Anyone can start a crew; everyone in it
has the same controls. Each person only needs their own phone or laptop.

## Run it

You need [Node.js](https://nodejs.org) on one computer (v20+ recommended; the server alone
runs on v18, but rebuilding the web app with Expo needs a current Node).

```bash
cd prototype/final/src/server
npm install      # first time only
npm start
```

(or double-click `src/start-all.bat` on Windows / run `src/start-all.sh` on Mac and Linux. Both
install dependencies on first run and start the server on port 4000.)

The terminal prints the links:

```
On this computer:      http://localhost:4000
Phones on same Wi-Fi:  http://192.168.x.x:4000
Camera + voice notes need HTTPS:  https://192.168.x.x:4443  (accept the one-time warning)
```

Open the Wi-Fi link on every phone/laptop on the same network. No app to install, no
IP/port to type. One person taps **Create a new crew**, then **Invite** shows a code, a QR
and a link for everyone else.

### Camera and voice notes (HTTPS)

Browsers only allow the camera and microphone on `https://` (or `http://localhost`). So the
server also listens on **port 4443** with a self-signed certificate:

- Phones that want to take photos, selfies or voice notes should open
  `https://<ip>:4443` and choose **Advanced → Proceed** on the "not private" warning (once).
- The certificate is generated automatically into `server/certs/` using **`openssl`**, and
  regenerated if the computer's LAN IP changes. If `openssl` isn't installed (common on
  Windows), HTTPS silently stays off and the HTTPS line isn't printed. Everything else
  works, but camera and mic won't. Install OpenSSL (e.g. it ships with Git for Windows) and
  restart.
- Ports can be changed with the `PORT` and `HTTPS_PORT` environment variables.

### Rebuilding the web app

The web app is already built into `server/web-app/`. If you change anything in `/app`,
rebuild it with `npm run build-web` (in `/server`) and restart the server.

## Crew characters

Everyone picks one of 8 astronaut characters when they join. The crew stands around the
rocket on the launch pad. When someone drops a memory, their character hops and throws a
star into the rocket, and the person it's about looks surprised. Everyone also gets a small
notification with the author's face ("Ed dropped a memory about you 👀"). Characters show
up in the crew list, feed, crewmate picker, capsule reveal and briefing clip. They're
drawn in `app/src/lib/avatars.js` (served to the scene as `/avatars.js`).

## Mission briefing clip + sounds

The first time someone opens the link, a **short animated briefing (about 40 seconds)**
plays before the join screen. It shows, step by step, what they'll do: form the crew → drop
memories about each other all semester → they stay sealed → everyone taps Ready → liftoff →
it comes home years later → open it together. It has spacecraft sounds: radio beeps,
engines igniting, memory chimes, a 3-2-1 countdown, a launch rumble, whooshes and a fanfare.

- Replay it any time: **"Watch the mission briefing"** on the join screen, or **"▸ How it
  works"** on the crew home. Open it on its own at `http://<ip>:4000/intro` (handy for
  showing on a laptop at the showcase).
- The same sounds play at the real moments in the app: an engine igniting when someone
  joins, a chime when a memory goes in, a ping when a crewmate is ready, the countdown +
  liftoff, a radio call when the rocket is home, a fanfare when the capsule opens. There's
  a 🔊/🔇 button top-right.
- All sounds are generated live in the browser (`server/public/sfx.js`), so there are no
  audio files. Web only; in Expo Go the app is silent.

## The flow

| Stage | What happens |
|---|---|
| **Briefing** | First visit: the animated briefing with sound (skippable, replay any time). |
| **Join (2 steps)** | 1) Pick an astronaut + type your name. 2) Two separate choices: **Join a crew** (just the 6-letter code) or **Create a new crew** (crew name → you get a code to share). Invite links (`/?join=CODE`) fill the code in. |
| **Collecting (all semester)** | Crew home shows **Load a memory**, sketch/photo, my memories and the ready button. Crew list, activity feed and demo tools are folded away. Each visit deals **8 memory capsules**: always a voice note, a free-write and an image upload; the **selfie** and the **"voice note for 2050"** go to one crewmate per round; "ask your mate" / "ask {name}" prompts are shared out so nobody duplicates them; the rest are ordinary prompts. After each one, a **privacy card** shows exactly what you sent and how it's used. |
| **Ready rules** | You need **at least 3 memories** before you can tap **I'm ready for launch** ("I need more time" undoes it). The rocket launches when **every** crewmate is ready and the crew has **at least 2 members**. |
| **Practice mode** | Alone? "Testing alone? Add 2 simulated crewmates": they write memories and get ready. (They don't fly in the rescue mission; see below.) |
| **Boarding** | Each astronaut walks up one by one, loads their capsule into the cargo hold, and climbs aboard. Hatch locks. |
| **Liftoff → cruise** | Countdown, liftoff, the rocket clears the atmosphere, shuts its engines down and floats away. |
| **Meanwhile on Earth** | A goodbye gif, then glimpses of the future (2032, 2040, 2050) with a turning clock. Then every phone gets a **"Summon the rocket" email**; the rocket only comes back once **everyone** has tapped it (simulated crewmates tap by themselves). |
| **Earth → hatch breach** | Earth comes into view… the cargo hatch blows open and the memories scatter. Red alarm. |
| **Choose the activity** | Anyone picks for the crew: **Rescue mission**, or "skip the activity and just open the capsule". Whoever picks first starts it for everyone. |
| **Rescue mission (everyone, live)** | "Flight to the UQ Space Faculty": the crew flies **one shared ship**. Everyone taps **Take your seats**; the flight starts once every real crewmate is seated. The five controls (**steer, throttle, altitude, memory pick-up, gun**) are dealt out at random (with fewer than 5 players, some hold several), so the crew has to talk to each other. The server simulates the ship (black holes, debris, asteroids) and every phone draws it. Save every memory capsule, then dock with the crew's rocket. **Max 5 real players.** |
| **Landing** | The empty launch site, then the rocket comes down onto the same pad. |
| **Capsule open** | A memory wall: photos and sketches as polaroids, messages as bright notes, voice notes playable, in a masonry gallery. Filters on top (all, about me, by me, photos, about each crewmate). Tap any memory to open it full screen, flick ← →, and **guess who wrote it** before the name is shown. |

## Showing a whole semester in a few minutes (testing / showcase)

On the crew home, open **Demo tools**:

- **Skip ahead a week**: moves the crew's calendar on, so new memories are stamped with the
  later semester week (shown in the reveal). It doesn't change which prompts are dealt.
- **Testing alone? Add 2 simulated crewmates** (shown when you're the only one): the
  quickest way to run the whole thing solo.
- **Add a simulated crewmate / … add a memory / … get ready**: finer control.
- **Skip memory submission and get ready**: get ready without loading 3 memories.
- In the rescue mission: the skip menu → **"skip the flight and finish now"** brings every
  memory home straight away, for everyone on board.

## Where things live

```
/server
  src/index.js        HTTP + HTTPS + Socket.IO; per-crew rooms; the phase machine (runs itself)
  src/crews.js        Crew state: members, memories, readiness, weeks; saved to data/crews.json
  src/games.js        Starts the rescue mission (older game modes are kept only for old saves)
  src/sharedship.js   The shared-ship rescue: server-side ship sim, control dealing, seats, docking
  src/colors.js       Each crewmate's colour (tints their memories in the reveal)
  src/uqColors.js     Leftover colour list from the cut "Colour restore" game (no longer used)
  public/scene/       The shared rocket scene (each phone embeds /scene?code=XXXXXX)
  public/intro/       The mission-briefing clip (served at /intro)
  public/game/        shared.html + flightworld.js: the rescue mission (served at /game/rescue)
  public/future/      Gifs for "Meanwhile on Earth" (see README.txt there; years set in scene.js)
  public/sfx.js       Spacecraft sound effects, shared by the clip and the app
  web-app/            The built participant app, served at /
  certs/              Self-signed HTTPS certificate (auto-generated; don't commit)
  data/crews.json     All crews + memories (created on first run; delete to start fresh)
  submissions/        Uploaded photos, sketches and voice notes, per crew/person
/app                  Expo (React Native) app; runs as the web app, or in Expo Go
  src/lib/prompts.js  The memory prompt bank + how capsules are dealt (edit freely)
  src/screens/        Join, CrewHome, StarField (memory capsules), DrawUpload (sketch/photo),
                      MyMemories, Lost (pick the activity), Capsule
```

### Editing prompts

`app/src/lib/prompts.js`. Each prompt in `PROMPT_BANK` has:

- `template`: the sentence that is saved and shown on the reveal cards. `{name}` = crewmate
  picker (prompts without it are about the whole group), `__` = a blank (can be several).
- `ask` *(optional)*: the instruction shown while writing ("Ask {name} …"); never saved.
- `askMates` *(optional)*: shows an "Ask your mate…" tag; label only.
- `needsPhoto` *(optional)*: the capsule can only be loaded once a photo is attached.
- `facilitatorNote` *(optional)*: for the person running the demo; never shown to participants.

Voice-note prompts are in `VOICE_PROMPTS`, and the selfie / free-write / image labels in
`EXTRA_LABELS`. `pickCapsules()` decides each visit's 8 capsules (see the comment above it).
The id prefixes (`s/m/e/a/q`) are historical; keep existing ids so saved answers still map.

### Changing the future gifs

Put `2032.gif`, `2040.gif` and `2050.gif` in `server/public/future/`. The years and
filenames are set in the `FUTURE` list in `public/scene/scene.js`. Until a file exists, a
placeholder shows its name.

### Developing with live reload

Run the server (`npm start` in `/server`), then in `/app`: `npx expo start --web` and open
http://localhost:8081. It connects to the server on port 4000 automatically (or add
`?server=ip:port`). For Expo Go on a phone, `npx expo start` and type the server's IP once
under "Server address" on the join screen.

## Notes / limits (prototype)

- Everyone must be on the same Wi-Fi as the computer running the server. For people to add
  memories from home over a real semester, the server needs to be hosted online (e.g.
  Render/Railway); nothing in the app would need to change.
- No accounts: you're identified by your name within a crew plus the browser's saved
  session. Good enough for testing.
- The privacy card tells participants their memories are uploaded to the "Launch Sequence
  cloud" for this test only. While you run it on a laptop, they're actually stored on that
  laptop (`server/data/` and `server/submissions/`). Delete those folders after a session.
- Crews hold up to **6** crewmates, but the rescue ship takes **5 real players** at most.
  With a full crew of 6, use "skip the activity and just open the capsule".
- Check the source of every gif in `server/public/future/` before sharing the project beyond the course.
