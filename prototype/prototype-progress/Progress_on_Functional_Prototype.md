# Progress on the Functional Prototype

**Section owner:** Dong

**For:** Week 9 Stand-up

**Focus:** Progress so far, what we learned from testing, and where we're headed

---

## 1. What We Built and Tested

We built an early working prototype of the full capsule experience:

1. Sign up — enter name, server IP, and lobby code
2. Star-map memory prompts — hover over stars in a space-themed UI, click to get a themed fill-in-the-blank prompt (e.g. "____ reminded me of that movie I watched a while back")
3. Each person writes a minimum of 3 memory prompts about their friends
4. Each person also uploads one memory photo
5. A rocket visually "fuels up" based on how many participants have completed their prompts
6. Once everyone's done, the rocket launches and orbits — a visual stand-in for the capsule's waiting period
7. Each person receives 2 personal colors — their individual "launch code" / key
8. Time-skip narrative moment ("5–10 years later"), rocket lands
9. Unlock puzzle: a black-and-white sketch of one submitted photo appears, and the group collaboratively colors it in using only their assigned launch-code colors
10. Once colored and uploaded, the puzzle is complete
11. Reveal: all written memory prompts from step 3 are unveiled for the group to read

We ran **one round of user testing** on this version.

---

## 2. What We Learned From Testing

### User testing feedback
- Testers were **confused about why the coloring puzzle** was the unlock mechanic, the connection between "coloring a photo together" and "unlocking a memory" didn't land clearly.

### Tutor feedback
- The **reveal moment needed to be more interactive.** Currently, all memory prompts appear at once, a passive moment rather than something the group actively engages with.

---

## 3. Our Response: Redesigning the Reveal

Based on this feedback, we're moving the reveal toward a **flash-card guessing game**:

- Each written memory prompt is shown **one at a time**
- The name the prompt is about is **blanked out**
- The rest of the group has to **guess who it was written about**
- A simple **leaderboard/score** tracks correct guesses, adding a light competitive layer

### Why this is a stronger direction
- Turns the reveal from something people *watch* into something people *actively play*
- Keeps the group engaged with each individual memory instead of skimming past it
- Still supports our core "collaborative reconstruction" idea, the group works together to figure out *who* a memory belongs to, rather than just viewing it
- Aligns with research from our course readings: Olsson et al.'s review of collocated social interaction technologies identifies "engaging people in collective activity" as a stronger, more effective design approach than passive "increasing awareness", which is what the static reveal was doing

---

## 4. Paper Prototype — Flash-Card Reveal (Concept Sketch)

A rough paper prototype was sketched to visualize this new interactive reveal concept:

- **Panel 1 — Card intro:** a face-down card labeled "Memory #3 of 8," building anticipation before each round
- **Panel 2 — Prompt revealed (name blanked):** e.g. *"____ always says '5 minutes' when they really mean 30."*
- **Panel 3 — Guessing:** player icons/names shown as clickable guess options, with a countdown timer
- **Panel 4 — Correct answer reveal:** blank fills in with the real name; checkmark/cross shown per player; points awarded
- **Panel 5 — Leaderboard update:** running scores shown after each round
- **Panel 6 — Next card / final round:** "Next Memory →" button, or a final scores screen on the last round

This was intentionally kept as a **rough sketch**, not a polished mockup — at this stage, a rough prototype better communicates that this is still an open design decision rather than a finished one.

---

## 5. What's Still Open

- Should the coloring puzzle be kept alongside the new flash-card reveal, replaced entirely, or repositioned earlier in the flow (e.g. moved to the sealing phase instead of the unlock phase)?
- Only one round of testing has been done so far, with a small group — findings are preliminary

---

## 6. Plan Moving Forward

- [ ] Build a working version of the flash-card guessing mechanic
- [ ] Run 2–3 more rounds of user testing with different friend groups before the tradeshow
- [ ] Decide the final placement/role of the coloring puzzle based on further feedback
- [ ] Refine leaderboard/scoring so it feels fun and lighthearted, not stressful or overly competitive
- [ ] Document testing findings and design decisions on GitHub as they happen
