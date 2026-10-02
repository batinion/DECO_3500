# What I changed: memory submission (feedback 3, 4, 5) + no host

Built on the `prototype copy` zip. This is a separate copy, not merged with this morning's changes on GitHub (user screens, Earth visuals, star look). Those still need merging in.

## Why

From the user test and tutor feedback:

- **#5, memories built over time, not one sitting.** A tester said lots of memories are made over a season, and one day of making the capsule only works in a classroom. Testers also suggested adding memories over a trip or a year.
- **No host.** The master screen felt like a "leader–follower" setup, and testers asked who would set it up. Everything now runs on each person's own device.
- **#3, course-specific prompts.**
- **#4, more substantial content.**
- **Instructions.** One tester didn't realise the memories were about the other people: "if there was a thing that said … we want you to focus on other people".
- **Kahoot-style live feedback.** A tester suggested showing in real time when crewmates do something.

## What changed

**No host / any device**
- Mission Control is gone. The server now also serves the app, so everyone just opens `http://<laptop-ip>:4000` on their phone. There are no IP/port fields and no Expo needed to use it.
- Anyone can **start a crew** and share a code, invite link or QR. Everyone has the same controls.
- Several crews can run at once. Crews of 2–6 people, with one engine per person.
- Launch, moon, time jump and Earth now run automatically instead of waiting for host clicks. Anyone can tap "Open the capsule".
- The capsule reveal now shows on everyone's phone, not on a big screen.

**Collecting over the semester (#5)**
- There's a new "collecting" stage while the rocket sits on the pad. A crew can live for weeks: you add memories whenever you like, and each memory goes in on its own and is tagged with the semester week.
- Crews and memories are saved to `server/data/crews.json`, so they survive restarts. Reopening the link, or rejoining with the same name, puts you back in.
- **Launch happens when everyone taps "I'm ready for launch"**, which needs at least 3 memories each. It works for both a single sitting and a full semester.
- **Demo tools** let you show a semester in minutes: skip a week, add test crewmates, simulate their memories.

**Course-specific prompts (#3)**
- There are 33 new prompts about DECO life: crits, Miro boards, user testing, studio, the night before the deadline, Merlo coffee, group chats, and so on.
- Each prompt is tagged start, mid, end or any. Stars are picked to fit the current week and skip prompts you've already answered, so coming back later gives fresh ones.

**More substantial content (#4)**
- You can attach a photo to any memory.
- Sketch/photo is now its own memory with a caption and who it's of. It used to be a mandatory page 2.
- "My memories" is a private list of what you've added, with an option to take one out.
- The crew home has a sealed activity feed ("Noah added a memory about you") plus a teaser: "🔒 3 memories about you are waiting".
- The reveal is a **timeline by week** with awards (most remembered, crew historian, busiest week) and filters (about me, by me, about each person).
- The rocket gets a **cargo gauge**, and each new memory shows a star flying into the rocket.

**Instructions**
- The join screen has a 4-step "how it works".
- The Memory Stars screen has an always-visible banner: "These are about your crewmates — not you."
- The crew home explains what to do now, and what to do at the end of semester.

**Live feedback**
- When someone adds a memory, everyone in the crew sees a pop-up: "Ed just added a memory about you 👀".

**Mission briefing clip + spacecraft sounds** (added after the first version)
- Testers couldn't relate to the flow from text alone, so a **40-second animated briefing** now plays on first open. It walks through what you'll do in six steps (form the crew, drop memories all semester, sealed, everyone taps Ready and it lifts off, comes home years later, open it together), using the same rocket as the app.
- It has spacecraft sounds: radio beeps, engine ignition, memory chimes, a countdown, a launch rumble, a whoosh, a fanfare.
- Replay it from the join screen ("Watch the mission briefing") or the crew home ("How it works"), or open it directly at `/intro`.
- The same sounds play at the real moments in the app, with a mute button. They're synthesised in the browser (`public/sfx.js`), so there are no audio files.
- New files: `server/public/intro/index.html`, `server/public/sfx.js`, `app/src/lib/sounds.js`, `app/src/components/IntroOverlay(.web).js`.

**Crew characters** (to make memory submission more fun)
- There are **8 original astronaut characters** (Nova, Comet, Orbit, Luna, Pixel, Sprout, Blaze, Moji). Each has 3 expressions: normal, surprised and cheering. You pick yours when you join.
- **Your crew stands around the rocket.** When someone drops a memory, their character hops and a star flies from them into the rocket, and the crewmate it's about looks surprised 😮. Ready crewmates cheer and get a ✓, and at launch the crew boards the rocket.
- **Small face notifications.** "Ed dropped a memory about you 👀" pops up with Ed's character and a star, plus a chime.
- Characters also appear in the crew list, the activity feed, the crewmate picker ("who is this about?"), the capsule reveal ("you → Noah" with both faces) and the briefing clip.
- One shared drawing file: `app/src/lib/avatars.js`. The app bundles it, and the server serves the same file at `/avatars.js` for the rocket scene and the briefing.

## Untouched (stage 2)
- The puzzle step is still the Miro placeholder, plus a "demo: skip" link. Replacing it with a group activity (testers suggested Jackbox/Kahoot-style guessing, Gartic Phone, crew awards) is a separate task.
- Mission colours work as before.

## Files
- Server: `src/crews.js` (new, replaces `session.js`) and `src/index.js` (rewritten). In `public/scene/`: crew-specific scene, engines for up to 6 people, cargo gauge, memory particles. Removed: `public/index.html`, `app.js`, `style.css` (Mission Control).
- App: `App.js`; `lib/prompts.js`, `lib/server.js`. Screens: `JoinScreen`, `CrewHomeScreen` (new), `StarFieldPage`, `DrawUploadPage`, `MyMemoriesScreen` (new), `CapsuleScreen`. Components: `PromptSheet`, `CrewPanel`. Removed: `SubmissionScreen`, `SubmittedWaitingScreen`, `RosterList`, `QRScanner`.
