# 0004: Drop the colour game and make the unlock one shared ship

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Whole team, on the prototype test 2 results

## Context

Test 1 told us the colour-in puzzle had to go but not what should replace it. Guess Who
(v2a) was tried and ended up inside the reveal rather than as the unlock. For the unlock
itself, rather than settle it by discussion, we tested three versions against each other: a
colour restore game where players recreated an illustration from memory, a rescue flight with
one ship per player, and the same flight with one shared ship.

## Decision

The unlock is a single shared ship. Steering, throttle, altitude, memory pick-up and the gun
are split between the crew, so nobody can fly it alone. The colour game is dropped.

## Rationale

Prototype test 2, three crews of three on 13 and 15 October, nine participants. Mean ratings out of 5; each activity had two to four raters:

| Activity | "I knew what to do" | "We had to work together" |
| --- | --- | --- |
| One shared ship | 4.5 | 4.5 |
| Individual ships | 3.0 | 4.3 |
| Colour restore | 4.5 | 3.0 |

- The colour game was the easiest to understand and the least collaborative, which is the
  wrong trade for a project about doing something together (Olsson et al., 2020).
- It also distributed rewards unevenly. One player earned no letters while others earned
  three.
- Individual ships scored lowest on comprehension because each player assumed they were
  flying alone. Sharing the controls made the activity clearer, not harder.
- The shared ship tied the colour game on "I knew what to do" and led on "We had to work
  together". Three of its four ratings came from the crew that played the activities without
  the full flow first, and the one person who played it after the full story rated both
  statements 3. The talk during play and the tradeshow response are what settle it.

## Consequences

- The colour game stays in the repository at `prototype/versions/colour-game` as the
  tested alternative, and runs on its own on port 4002. The individual-ships version is in
  `prototype/versions/rescue-game` (port 4001, "Classic" mode). Neither is part of the
  final build.
- The shared ship produced both "Cooperation" and "Fun but confusing" as one-word responses.
  Naming each control on screen with its holder is the outstanding fix.
- At the tradeshow the confusion did not appear, because facilitators said aloud that the
  controls were split. The briefing closed the gap, not the interface.
