# Tone and positioning

**Owner:** Dattatray · **Status:** working guide — update it when the language changes

This note exists because of one thing testers told us in prototype test 1:

> "My concern is the leader–follower setup with the master screen. That suits workshops, hackathons and internships. As you get older, group experiences are rarely leader-follower. They're more mutual."

> "As a one-day thing, I'd only use it in a classroom setting."

Removing the host screen fixed the structure. This note is about the half that isn't code: making it *read* like something friends do, not something a facilitator runs. Everyone writing screen text, the poster, or the pitch should build to this.

---

## What it is, and what it isn't

| Launch Sequence is | Launch Sequence is not |
| :--- | :--- |
| Something a group starts because the night is already happening | Something scheduled into a timetable slot |
| Run by nobody — everyone has the same controls | Run by a facilitator who sets up and explains |
| A thing you play | A task you complete |
| Yours to fill however you like | An exercise with a correct answer |
| Over when the crew says it's over | Over when everyone has finished the steps |

The model a tester handed us without meaning to: his friends run an annual awards night called "the Oscars", with nominations and voting, because two of them are named Oscar. Nobody organises it as a workshop. It just happens, every year, and everyone turns up.

---

## Say this, not that

Words carry the framing more than layout does. Most of these are already right in the current build — this list is for catching the leftovers in buttons, empty states, error messages and the poster.

| Say | Not | Why |
| :--- | :--- | :--- |
| crew, crewmate | participant, user | "Participant" is what you are in someone else's study |
| start a crew | create a session, set up | Nobody "sets up" a night out |
| drop a memory | submit, upload | Submit is what you do to a form |
| I'm ready for launch | mark as complete, finish | Readiness is a choice; completion is a requirement |
| the rocket needs more fuel | you have not met the minimum | Same rule, no failure state |
| 3 memories about you are waiting | 3 pending items | Anticipation, not an inbox |
| Ed dropped a memory about you | New submission received | Name the person, not the event |
| open the capsule | view results, reveal data | It's a thing you open together |
| how it works | instructions, tutorial | Friends explain, instructors instruct |
| mission briefing | onboarding, walkthrough | Keep it in the world we built |

Avoid entirely: *master screen, Mission Control* (gone with the host), *lobby code, server IP, port*, *activity*, *exercise*, *task*, *step 1 of 4*, *required field*.

---

## Five rules of thumb

**Nobody is in charge.** No screen should imply one person starts, controls or ends it. If a sentence only makes sense when read by an organiser, rewrite it.

**Nobody fails.** No minimums phrased as requirements, no error states for not having done enough yet, no progress bar that looks like a form. The rocket not having enough fuel is the crew's problem, not one person's.

**It joins a night that's already happening.** The best moment to start a crew is at the table, at the last class, at the leaving drinks. Nothing should suggest you need to book time for it.

**The app shuts up during the good part.** The reveal got the strongest reaction in testing. That moment needs room for people to talk over it — prompts that start a conversation, not text that fills the silence.

**Keep the world consistent.** Crew, engines, cargo, launch pad, briefing, capsule. Once we're in that world, dropping into product language ("submit your entries") breaks it harder than anything visual.

---

## How we demo it at the tradeshow

This matters more than people expect: how we behave at the stall decides which of the two it reads as, whatever the screen says.

- **Hand over the phones and stop talking.** Two visitors playing with no narration reads as a game. One of us explaining each step reads as a workshop.
- **Don't say "participants", "demo" or "our prototype"** to visitors. Say "grab a phone, you two are a crew".
- **Let them get it wrong.** If someone writes about themselves, that's a finding, not a failure to correct.
- **Have the briefing clip playing on a laptop** so people can catch the idea without one of us performing it.

---

## How we check it's working

Give the build to a friend group with nobody from the team in the room. If they can start it, get through it and open the capsule without asking us anything, it reads as a friends' activity. If they can't, it's still a workshop — and the first place to look is the wording, not the code.
