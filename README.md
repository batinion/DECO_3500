<div align="center">

# Preserving Memories to Support Relationships

**Encouraging social interaction through nostalgia and reminiscence**

`Team NO_PARKING(!)` · DECO3500 / DECO7660 — Social & Mobile Computing · The University of Queensland · Semester 2, 2026

![Status](https://img.shields.io/badge/status-in%20progress-F48A56?style=flat-square)
![Course](https://img.shields.io/badge/course-DECO3500%20%2F%207660-2B2420?style=flat-square)
![Semester](https://img.shields.io/badge/semester-2%2C%202026-6B6259?style=flat-square)
![Team](https://img.shields.io/badge/team-NO__PARKING(!)-ED6845?style=flat-square)

</div>

---

## Overview

People preserve and revisit memories constantly, but almost always alone. Camera rolls fill up, group chats scroll away, and physical mementoes sit in boxes nobody opens. This project asks how mobile and social technology can support **shared** reminiscence — memory as something a group builds and returns to together, rather than something one person archives in private.

Our domain is **supporting relationships through nostalgia and reminiscence**. We are designing for groups with a shared endpoint approaching: a university cohort about to graduate, a team at the end of a season, workmates before someone moves on, a friendship group about to scatter.

### Research foundations

Our direction is grounded in three semi-structured interviews (ages 60+, late 20s, early 20s) and the literature below. Six themes emerged from the interview data:

| Theme | What we found |
| :--- | :--- |
| **Recreative curation** | Nobody decides what matters upfront — it gets sorted out only when forced, such as when storage runs out. |
| **Digital vs. physical asymmetry** | Physical items are hoarded because space feels endless; digital memories are deleted constantly. |
| **Deliberately unopened memories** | One participant keeps a video of her grandmother she has never watched. Preservation is not always about revisiting. |
| **Contested inheritance** | Some want to pass down objects, others explicitly want to pass down values. No consensus. |
| **Place-triggered recall** | Two participants independently described memories flooding back on visiting a childhood location. |
| **Socially learned methods** | Preservation techniques are picked up from social media, not from family. |

---

## The Team

Duties are assigned to stretch each member beyond their existing strengths, in line with the assignment brief. Each member holds a **primary role** and a **stretch duty** that deliberately sits outside their comfort zone.

| Member | Program | Primary Role | Stretch Duty |
| :--- | :--- | :--- | :--- |
| **Dev Kansana** <br/> `Team Lead` | Master of Interaction Design | Research & Design Coordination — holds the through-line from research to design decisions | Contributes directly to the prototype build alongside the whole team |
| **Vim Mahakumbura** <br/> `Spokesperson` | Master of Information Technology | Design Lead — owns concept design, UX and visual direction | Presentation & Slide Design Owner; mentors Shirish on clean UI practice |
| **Shirish Kamble** | Master of Interaction Design | Research Lead — owns domain and stakeholder research, evidence gathering | User Testing Coordinator — plans and facilitates testing and interview sessions |
| **Dattatray Siraskar** | Master of Interaction Design | Strategy & Market Fit Lead — grounds the concept in viability and competitor critique | Documentation & GitHub Project Management — maintains this repo, issues and board |
| **Dong Nguyen** | Master of Information Technology | Technical & Data Lead — prototype build, data handling, technical feasibility | Co-facilitates user research sessions alongside Shirish |

<details>
<summary><strong>Individual aims for this project</strong></summary>

<br/>

> **Dev** — Unlearning my design approach, and understanding design communication through group exercise.
>
> **Vim** — Apply social concepts in mobile systems design and explore the boundaries of digital social designing.
>
> **Shirish** — Learn about topics without running for solutions first, and understand the impact of the social and mobile nature of technologies.
>
> **Dattatray** — Apply in-depth market research and critical thinking to identify core problem statements, and design user-friendly, scalable solutions that enhance social and collaborative experiences in mobile computing.
>
> **Dong** — Get comfortable designing as part of a group, where the final idea is genuinely better because it wasn't just my own.

</details>

---

## Repository Structure

```
.
├── docs/                          Written record of the project
│   ├── charter/                   Team charter and any signed revisions
│   ├── research/
│   │   ├── interviews/            Protocols, consent forms, transcripts, notes
│   │   ├── literature/            Annotated papers and reading notes
│   │   └── competitor-analysis/   Teardowns of existing products
│   ├── decisions/                 Numbered decision records (see below)
│   └── meeting-notes/             One file per meeting, YYYY-MM-DD.md
│
├── deliverables/                  Anything submitted or presented
│   ├── A1-introductory-pitch/
│   │   ├── iterations/            Every working version, in order
│   │   ├── final/                 The submitted artefact only
│   │   └── CHANGELOG.md           What changed between iterations, and why
│   ├── A2-design-proposal/
│   └── A3-final-submission/
│
├── design/                        Visual and interaction design work
│   ├── sketches/                  Hand sketches, whiteboard photos
│   ├── wireframes/                Low-fidelity structure
│   ├── prototypes/                Figma exports, clickable prototypes
│   └── assets/                    Logos, icons, type, exported imagery
│
├── prototype/                     Code for the working prototype
│   └── src/
│
└── .github/                       Issue and pull request templates
```

### File naming convention

Every versioned file follows one pattern, so the folder sorts chronologically on its own:

```
YYYY-MM-DD_vX.Y_short-description.ext
```

| Example | Meaning |
| :--- | :--- |
| `2026-08-10_v0.1_pitch-outline.pptx` | First rough draft |
| `2026-08-18_v0.4_pitch-tutor-feedback.pptx` | Fourth iteration, incorporating tutor feedback |
| `2026-08-22_v1.0_pitch-final.pptx` | Submitted version — lives in `final/` |

Bump the **minor** version (`v0.1` → `v0.2`) for a working revision. Bump the **major** version (`v0.9` → `v1.0`) only when something is submitted. Never overwrite an older iteration — the trail of versions *is* the evidence of process, and this course marks process.

### Decision records

Significant decisions — the domain we chose, the concept we converged on, a scope cut — get a short numbered file in `docs/decisions/`, e.g. `0002-concept-convergence.md`. Each records the context, the options considered, the decision, and its consequences. When a tutor asks "why did you go that way?", the answer is already written down.

---

## How We Work

| Item | Agreement |
| :--- | :--- |
| **Main channel** | Microsoft Teams |
| **Backup channel** | Outlook email, phone |
| **Response time** | Within 12 hours |
| **Regular meeting** | Every Sunday, 3:00pm |
| **Decision-making** | Discussion aiming for consensus; where consensus isn't reached in reasonable time, we consult tutors |

### GitHub workflow

1. **Every task is an issue.** No task exists only in a Teams message. If it isn't on the board, it isn't tracked.
2. **Every issue has one owner and a due date.** Shared work gets a primary owner plus collaborators noted in the description.
3. **The board is reviewed at every Sunday meeting.** Anything stalled gets re-scoped or reassigned there, not silently dropped.
4. **Branch per issue**, named `type/issue-number-short-description` — e.g. `research/12-interview-protocol`.
5. **Commits and pull requests reference the issue number**, so the history explains itself: `docs: add interview protocol (#12)`.

### Commit message convention

We use [Conventional Commits](https://www.conventionalcommits.org/) so the log stays readable:

```
docs:     written documentation, notes, transcripts
design:   sketches, wireframes, prototypes, visual assets
feat:     new prototype functionality
fix:      corrections to prototype or documentation
chore:    repo maintenance, structure, tooling
```

---

## Project Timeline

| Milestone | Weeks | Focus |
| :--- | :--- | :--- |
| **M1 — Concept Convergence** | 5–7 | User interviews across group types, competitor teardown, converge on one direction |
| **M2 — Requirements & Low-Fi** | 7–8 | Requirements from evidence, low-fidelity prototype, technical feasibility |
| **M3 — Studio Stand-up** | 9 | Present research, prototype and first testing results |
| **M4 — Build & Refine** | 10–12 | Mid-fidelity build, second testing round, iterate, prepare poster |
| **M5 — Final Submission** | 13 | Final pitch, poster, documentation |

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/batinion/DECO3500.git
cd DECO3500

# Start work on an issue
git checkout -b research/12-interview-protocol

# Commit, referencing the issue
git add .
git commit -m "docs: add interview protocol and consent script (#12)"
git push -u origin research/12-interview-protocol
```

Then open a pull request against `main`, link the issue, and request a review from one teammate.

---

## References

Bluck, S., Alea, N., Habermas, T., & Rubin, D. C. (2005). A tale of three functions: The self-reported uses of autobiographical memory. *Social Cognition, 23*(1), 91–117. https://doi.org/10.1521/soco.23.1.91.59198

Conway, M. A. (2005). Memory and the self. *Journal of Memory and Language, 53*(4), 594–628. https://doi.org/10.1016/j.jml.2005.08.005

Hirst, W., et al. (2015). A ten-year follow-up of a study of memory for the attack of September 11, 2001. *Journal of Experimental Psychology: General, 144*(3), 604–623. https://doi.org/10.1037/xge0000055

Petrelli, D., & Whittaker, S. (2010). Family memories in the home: Contrasting physical and digital mementos. *Personal and Ubiquitous Computing, 14*(2), 153–169. https://doi.org/10.1007/s00779-009-0277-7

Wardell, V., & Palombo, D. J. (2024). Stability and malleability of emotional autobiographical memories. *Nature Reviews Psychology, 3*(6), 393–406. https://doi.org/10.1038/s44159-024-00312-1

---

<div align="center">
<sub>Coursework repository for DECO3500 / DECO7660 at The University of Queensland.<br/>Research materials are held in accordance with the participant consent obtained for this project.</sub>
</div>
