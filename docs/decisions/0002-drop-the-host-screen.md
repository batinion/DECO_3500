# 0002: Drop the host screen and give everyone the same interface

- **Status:** Accepted
- **Date:** 2026-09-19
- **Deciders:** Whole team

## Context

The v1 build used a shared Mission Control screen on a laptop alongside an app on each
person's phone. One person drove the shared screen and the others followed.

Prototype test 1 put this in front of two groups. Both rejected it, and one tester was
explicit about why:

> "The master-screen setup suits workshops, hackathons and internships. As you get older,
> group experiences are rarely leader-follower. They're more mutual. It'd be better to have
> one shared space rather than someone leading."

We had designed around the exhibition, a big screen with laptops connected to it, rather
than around how a group of friends would actually use this.

## Decision

Remove Mission Control. Everyone opens the same address on their own device and everyone
has the same controls. Anyone can start a crew and share a code, link or QR.

## Rationale

- Two independent groups raised it, which is what separated it from one person's preference.
- Grudin (1994) describes groupware failing when one person does the work and others only
  benefit. A host screen builds exactly that asymmetry into the product.
- The host model also forced an awkward question we could not answer: who sets up the
  shared screen in real life?

## Consequences

- Launch, time jump and return now run automatically rather than waiting for host clicks.
- Several crews can run at once on one server, which made the tradeshow possible.
- Joining by IP address and port disappeared, which addressed a separate test 1 complaint.
- Recorded as requirement R1.
