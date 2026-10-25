# Changes in v2: clearer start, simulated crew, rescue games

Built on `prototype-shirish`. Everything runs the same way (`cd src/server && npm install && npm start`).

## From testing feedback

**1. Too much to read at the start**
- The join screen is now two short steps. **Step 1** is picking an astronaut and typing your name. **Step 2** gives two separate cards, **Join a crew** (code only) or **Create a new crew** (crew name only). Nobody can type their name into the code box any more.
- The 4-step explanation is gone. The briefing video still plays on first visit, and there's a "Watch how it works" link.
- The crew home shows one "what to do next" line and the main buttons. The crew list, activity feed and demo tools are folded away.

**2. Testing with only one person (presentation week)**
- **"Testing alone? Add 2 simulated crewmates"** appears on the crew home when you're the only one there. They join, write memories (mostly about you), get ready, and play both games: they rescue capsules, get "grabbed" so you see a distress call, fly in to help, and make colour guesses.

**3. Privacy confirmation**
- After every memory or sketch/photo, a card shows **exactly what you sent** (text, picture, who it's about), plus four plain points: sealed until the reveal, uploaded to the Launch Sequence cloud for this prototype test only, never used for anything else, and removable in "My memories" until launch.
- Note: while it runs on a laptop, the files actually live on that laptop (`server/data`, `server/submissions`).

**4. Characters bouncing around when boarding / stars confusing**
- Memory "stars" are now **memory capsules** on the launch pad. Stars only appear once you're in space, so the order makes sense: fill capsules, load them on the rocket, launch.
- **Boarding:** when everyone is ready, each astronaut walks up **one at a time** carrying their glowing capsule, slides it into the cargo hatch (a clunk sound), and climbs in. Nobody else bounces while this happens. Then the hatch locks.

**5. "You can't tell three years have passed"**
- New **time warp**: the rocket punches into a tunnel of coloured light with rings rushing past, white flashes going in and out, and a big counter racing **Day 1 → Day 1,095** with the month and year ticking along (about 9.5 seconds). There's a rising "warp" sound.

## The new reveal activities (replaces the Miro puzzle)

- **Earth in sight → the cargo hatch blows open.** There's a bang and an alarm, the screen edges pulse red, and the capsules scatter around the rocket.
- **Choose how to get them back.** Anyone picks for the crew: **Rescue mission**, **Colour restore**, or a quiet "skip and just open the capsule". It's an option, not forced.
- **Rescue mission:** you fly your own ship (drag to steer; it fires by itself). You blast the rock off your capsules and zap the Forgetters. A capsule that's heavy, grabbed by a Forgetter, or left alone for 35 seconds sends a **distress call** to everyone ("Noah's capsule was grabbed by Forgetters. Ruben is already there. [Fly there]"). Helpers show up orbiting the same rock. Nothing is ever lost. Players mostly rescue *other people's* memories, and only see a glimpse ("Week 7 · a memory about Ruben").
- **Colour restore** (dial.gg-style): a UQ colour flashes for about 4 seconds (UQ purple, Great Court sandstone, a jacaranda, a bin chicken's feathers, a brush turkey's head and wattle, a lorikeet's chest, UQ Lakes water, the Great Court lawn). Everyone recreates it with hue, saturation and brightness sliders. The crew's **average** guess restores that round's memories, with scores out of 10 and nobody "fails". Colours live in `server/src/uqColors.js`. I didn't add the UQU logo colour because I couldn't confirm its exact value, but it's a one-line addition.
- **Capsule open:** each memory shows how it came home ("Rescued by you + Noah" / "Colour restored in round 2"). Each one also asks **"Who wrote this?"**, so you tap a face before the author is revealed. A score and "Show all names" sit at the top.

## Briefing video
Updated to the new story in 8 steps (~1 min). It covers forming the crew, loading capsules, sealing, loading up one by one and liftoff, the time warp with the day counter, the hatch breach, a mini rescue plus a colour round, and opening it together and guessing. There are new synthesised sounds: load clunk, warp tunnel, breach/alarm, laser, rock crack, alien zap, rescued chime, distress call and colour score.

## Files
- New: `server/src/games.js`, `server/src/uqColors.js`, `server/public/game/rescue.html`, `server/public/game/colors.html`, `app/src/components/CapsulePod.js`, `PrivacyCard.js`, `GameFrame(.web).js`, `app/src/screens/LostScreen.js`
- Changed: `server/src/index.js`, `crews.js`, `public/scene/scene.js` + `scene.css`, `public/sfx.js`, `public/intro/index.html`, `app/App.js`, `JoinScreen`, `CrewHomeScreen`, `StarFieldPage`, `DrawUploadPage`, `MyMemoriesScreen`, `CapsuleScreen`, `PromptSheet`
- Removed: `PuzzleScreen`, `YourColorsScreen`, `Star` (the Miro puzzle and mission colours)
- `server/web-app/` has been rebuilt, so there's no need to run `npm run build-web` unless you change `/app`.

## v2.1: the shared-phone flight and the dialed-style colour game

**Rescue mission is now "Flight to the UQ Space Faculty"** (the game you sent, kept as it was), with your memories added:
- It opens on the phone of whoever picked it. Everyone gathers round that one phone and holds a corner (2, 3 or 4 crew, picked automatically from the crew size).
- Memory capsules (glowing gold, labelled "Week 7 · Ruben") are spread along the route. Fly through one to save it (+1 memory, a chime and "Memory saved!").
- The navigator's compass now points to the **next memory**, and to the faculty once they're all collected. You can only dock when every memory is on board.
- Sounds added for thrust, lasers, rock hits, explosions, crashes, black-hole warps, memory saves and docking.
- Other phones show "Gather round Shirish's phone" and the live "✦ 3 / 9 memories saved" count, plus a "Fly on my phone instead" button.
- Upright phones: the clock sits below the control panels so it isn't hidden.
- The win screen's "Open the capsule together" button opens the reveal for everyone. Demo skip links are on the menu and at the bottom while flying.
- The older per-phone asteroid game has been removed.

**Colour restore now copies dialed.gg's color-toon layout:**
- Black screen, big lowercase type, and the illustration on a spotlight. The round counter "1 / 5" sits top left, with big countdown digits top right.
- While guessing, three tall strips slide in on the left (hue, saturation, brightness) and the illustration recolours live as you drag.
- Round buttons bottom right: 💡 lamp = peek at the real colour (2 per game) and ◎ = lock in.
- Results: a big score to two decimals with a cheeky line, "you" and "target" circles, the crew average plus memories restored, and → for the next round. The round moves on once everyone has tapped →, or after 20 seconds.
- The illustrations are original and drawn for this prototype: a brush turkey (head and wattle), a bin chicken, a rainbow lorikeet, a jacaranda, the Great Court sandstone building, a UQ hoodie, UQ Lakes and the Great Court lawn. The cartoon characters and logos from dialed.gg are copyrighted, so they aren't used.

## v2.2: easier to find memories, gun follows the ship
- **On-screen guide:** a glowing arrow circles the ship and always points to the next memory, or to the faculty once every memory is collected, so the whole crew can see the way, not only the navigator. When the target is off-screen, a marker sits on the screen edge with "memory 1.3 ly". It stays in the clear space between the control panels.
- **Gun on the nose:** the gun turns with the ship, so when the helm turns you can shoot whatever is ahead. The gunner's ◀ ▶ nudge the aim up to about 45° either side, and it drifts back to dead ahead when let go.

## v2.3: phone-friendly flight layout + how to fly
- **Top card:** the "Next memory" compass now has its own card at the top, with the distance, the timer, memories saved and a **?** button.
- **Controls in one dock** along the bottom instead of the four corners: 2×2 on an upright phone (Helm · Altitude / Engines · Gunner), one row when the phone is sideways. Each group keeps its colour and player number, and the view centres on the ship in the space between.
- **How to fly** appears after Launch, before take-off. It explains the arrow and each control by role and player, plus the goal and penalties. The **?** button reopens it any time and pauses the clock.

## v3: fly together live, phone game controls, gallery reveal
- **Everyone plays the rescue flight at the same time on their own phone.** All phones build the same space from one seed (`flightworld.js`). Each person flies their own ship and sees the crew's ships, with names and colours, moving live. Asteroids drift on a shared clock and stay destroyed for everyone. A memory saved by anyone is saved for the crew ("Joli saved a memory: Week 4 · about Mei"). Once every memory is saved, anyone docks and the win screen appears on all phones, showing who saved what.
- **Simulated crewmates fly too.** They wait a few seconds, then head for a fair share of the memories (so humans still have plenty to do) and wait at the faculty.
- **Controls like a mobile platformer:** a D-pad bottom-left (▲ go, ▼ slow/back, ◀ ▶ turn), round **Fire** and **⇅ High/Low** buttons bottom-right, and small **?** and 🔊 buttons in the top corners. The "next memory" compass card sits top centre. Works upright or sideways. Laptop: arrows/WASD, Space to fire, Shift for High/Low.
- The old role-split controls (Engines/Helm/Altitude/Gunner) and the "gather round one phone" screen are gone.
- **Reveal is now a gallery (memory wall):** photos and sketches as polaroids, messages as colourful notes, slightly tilted, in 2–4 columns. Awards are pills at the top, with filters including "Photos & sketches". Tap any memory to open it full screen with ← → to move through them, see who saved it, and guess who wrote it.
