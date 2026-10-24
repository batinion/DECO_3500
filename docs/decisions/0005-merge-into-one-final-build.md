# 0005: Merge the two branches into one final build

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Vim, with the team

## Context

After test 1 we rebuilt in two parallel branches so five people could work at once. v2a
reworked the reveal into a guessing game. v2b restructured the whole experience around no
host and semester-long collection. Both were needed and neither was complete on its own.

## Decision

Take v2b as the base, fold the v2a guessing mechanic into the reveal rather than running it
as a separate phase, and add the shared ship from decision 0004 as the unlock.

## Rationale

- v2b changed the structure of the experience, so it was the harder of the two to port into
  the other.
- Guess Who as its own phase added a further stage to an already long flow. As a behaviour
  inside the reveal wall, tapping a memory to guess its author, it costs nothing.
- The tradeshow was fixed in Week 12 and two half-built branches could not be demonstrated.

## Consequences

- The merged build is at `prototype/final/`, and is what was demonstrated and submitted.
- Earlier builds are kept at `prototype/versions/` as evidence of process.
- The reveal now carries filters for everything, photos and sketches, about me, by me, and
  by person.
