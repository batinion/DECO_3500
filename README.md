# Launch Sequence

**A group time-capsule ritual — supporting relationships through nostalgia and reminiscence**

| | |
| :--- | :--- |
| **Course** | DECO3500 — Social & Mobile Computing |
| **Institution** | The University of Queensland |
| **Semester** | 2, 2026 |
| **Team** | NO_PARKING(!) |
| **Team lead** | Dev Kansana |
| **Spokesperson** | Vim Mahakumbura |

---

## Documentation

Our full design process lives in the **[project wiki](https://github.com/batinion/DECO_3500/wiki)**.

| Page | What's in it |
| :--- | :--- |
| [Week 9 Stand-up](https://github.com/batinion/DECO_3500/wiki/Week-9-Stand-up) | Project state, evidence and next steps |
| [Research Findings](https://github.com/batinion/DECO_3500/wiki/Research-Findings) | Ten interviews, six themes, literature, competitor landscape |
| [Requirements](https://github.com/batinion/DECO_3500/wiki/Requirements) | 17 experience requirements, each traced to evidence |
| [Prototypes and Evaluation](https://github.com/batinion/DECO_3500/wiki/Prototypes-and-Evaluation) | Every build, every test, and what changed because of it |
| [Team Meetings](https://github.com/batinion/DECO_3500/wiki/Team-Meetings) | Meeting records and decisions |
| [Ethical Considerations](https://github.com/batinion/DECO_3500/wiki/Ethical-Considerations) | Stakeholders, risks and what we take responsibility for |
| [Design Process Overview](https://github.com/batinion/DECO_3500/wiki/Design-Process-Overview) | The top-level story, for the final submission |

Task tracking is on the [project board](https://github.com/batinion/DECO_3500/projects), not in separate paperwork.

---

## Overview

People preserve and revisit memories constantly, but almost always alone. Camera rolls fill up, group chats scroll away, and physical mementoes sit in boxes nobody opens. This project asks how mobile and social technology can support **shared** reminiscence — memory as something a group builds and returns to together.

**Launch Sequence** is a group time-capsule ritual for a circle of friends at the end of something shared — a course, a season, a job. Each person uses their own phone to write short prompted memories **about the others**, and the crew's rocket fills as memories go in. There is no host and no leader. When everyone is ready the capsule seals and launches, time jumps forward, and the crew has to come back together to open it.

### Research foundations

Grounded in **ten semi-structured interviews** run by four team members, spanning ages 20s to 60+ and Australian, Indian and American participants, against 14 defined areas of enquiry. Six themes emerged:

| Theme | What we found |
| :--- | :--- |
| **Recreative curation** | Nobody decides what matters upfront — it gets sorted out only when forced, such as when storage runs out. |
| **Digital vs. physical asymmetry** | Physical items are hoarded because space feels endless; digital memories are deleted constantly. |
| **Deliberately unopened memories** | Keeping something and wanting to revisit it are different needs. Boxes of photos sit unopened for a year at a time. |
| **Contested inheritance** | Some want to pass down objects, others explicitly want to pass down values. No consensus. |
| **Place-triggered recall** | Memories resurface without intention on returning to a location. |
| **Socially learned methods** | Preservation techniques are picked up from social media, not from family. |

Memory is tied to identity. Asked why he preserves anything at all, one participant said simply: *"To keep identity, man. At least that's what I believe."*

Full detail, with quotes: **[Research Findings](https://github.com/batinion/DECO_3500/wiki/Research-Findings)**.

---

## The prototype

A real-time, multi-device web experience. Several people join one crew on their own phones, write memories about each other, and open the capsule together.

**No login.** One person starts a crew; everyone else joins with the code, invite link or QR shown on screen. Names are typed in, not registered.

### Running it

You need [Node.js](https://nodejs.org) v18+ on one computer. **Every device must be on the same Wi-Fi network**, with no client isolation — a phone hotspot works, some university networks don't.

```bash
cd prototype/src/server
npm install          # first time only
npm run dev
```

The terminal prints a local address and a LAN address. Open the LAN address on each phone or laptop.

For the Expo participant app in the current main build:

```bash
cd prototype/src/app
npx expo start       # scan the QR with Expo Go, or press w for a browser
```

**Testing without four phones:** the Mission Control screen has a *Simulate remaining participants* control that fills the other seats with sample answers, and *New Session* to reset.

### Prototype versions

Two branches were built in parallel after our first round of user testing, each addressing a different half of the feedback. They are being merged for the tradeshow.

| Version | What it adds | Run it |
| :--- | :--- | :--- |
| [`prototype/src`](prototype/src) | The main build — crew join, memory stars, sealing, launch, time jump, reveal | See above |
| [`prototype_versions/prototype-dong`](prototype_versions/prototype-dong) | **Guess Who reveal** — memories become flash cards with the name blanked, and the crew guesses together. Includes end-to-end test scripts. [Screenshots](prototype_versions/prototype-dong/prototype%20screenshots) | Same as above |
| [`prototype_versions/prototype-shirish`](prototype_versions/prototype-shirish) | **No host, semester-long collection** — no Mission Control, memories collected week by week, 33 course-specific prompts, crew characters, animated briefing, timeline reveal. [Screenshots](prototype_versions/prototype-shirish/screenshots) · [changelog](prototype_versions/prototype-shirish/CHANGES-shirish.md) | `cd src/server && npm install && npm start`, then open the printed link — no Expo needed |

---

## The team

Duties are assigned to stretch each member beyond their existing strengths, in line with the assignment brief.

| Member | Program | Primary role | Stretch duty |
| :--- | :--- | :--- | :--- |
| **Dev Kansana** | Master of Interaction Design | Research & design coordination — holds the through-line from research to design decisions | Contributes directly to the prototype build |
| **Vim Mahakumbura** | Master of Information Technology | Design lead — concept design, UX and visual direction | Presentation and slide design owner |
| **Shirish Kamble** | Master of Interaction Design | Research lead — domain and stakeholder research, evidence gathering | User testing coordinator |
| **Dattatray Siraskar** | Master of Interaction Design | Strategy & market fit lead — viability and competitor critique | Documentation and GitHub project management |
| **Dong Nguyen** | Master of Information Technology | Technical & data lead — prototype build, data handling, feasibility | Co-facilitates user research sessions |

<details>
<summary><b>Individual aims for this project</b></summary>

<br>

**Dev** — Unlearning my design approach, and understanding design communication through group exercise.

**Vim** — Apply social concepts in mobile systems design and explore the boundaries of digital social designing.

**Shirish** — Learn about topics without running for solutions first, and understand the impact of the social and mobile nature of technologies.

**Dattatray** — Apply in-depth market research and critical thinking to identify core problem statements, and design user-friendly, scalable solutions that enhance social and collaborative experiences in mobile computing.

**Dong** — Get comfortable designing as part of a group, where the final idea is genuinely better because it wasn't just my own.

</details>

---

## Repository structure

```
.
├── prototype/src/                 Current main build (server + Expo app)
├── prototype_versions/            Parallel branches from the post-test rebuild
│   ├── prototype-dong/            Guess Who reveal + screenshots
│   └── prototype-shirish/         No-host, semester-long build + screenshots
├── prototype-progress/            Running record of prototype development
│
├── docs/
│   ├── charter/                   Team charter
│   ├── research/                  Interview and competitor templates, literature
│   └── decisions/                 Numbered decision records
│
├── deliverables/                  Anything submitted or presented
│   ├── A1-introductory-pitch/
│   ├── A2-design-proposal/
│   └── A3-final-submission/       Each with iterations/, final/ and a CHANGELOG
│
├── design/                        Sketches, wireframes, prototypes, assets
├── teammeetings/                  Meeting material (summaries live on the wiki)
├── ethicalconsideration/          Ethics working files (page lives on the wiki)
└── .github/                       Issue and pull request templates
```

### File naming

Every versioned file follows one pattern, so folders sort chronologically on their own:

```
YYYY-MM-DD_vX.Y_short-description.ext
```

Bump the minor version (`v0.1` → `v0.2`) for a working revision, and the major version only when something is submitted. Never overwrite an older iteration — the trail of versions is the evidence of process, and this course marks process.

### Decision records

Significant decisions get a short numbered file in [`docs/decisions/`](docs/decisions/) recording the context, the options considered, the decision and its consequences. When a tutor asks "why did you go that way?", the answer is already written down.

---

## How we work

| Item | Agreement |
| :--- | :--- |
| Main channel | Microsoft Teams — meetings recorded and transcribed since 20 September |
| Backup channel | Outlook email, phone |
| Response time | Within 12 hours |
| Regular meeting | Weekly, plus ad-hoc working sessions |
| Decision-making | Discussion aiming for consensus; where consensus isn't reached in reasonable time, we consult tutors |

### GitHub workflow

1. **Every task is an issue.** If it isn't on the board, it isn't tracked.
2. **Every issue has one owner.** Shared work gets a primary owner plus collaborators noted in the description.
3. **The board is reviewed at every team meeting.** Anything stalled gets re-scoped or reassigned there, not silently dropped.
4. **One branch per issue**, named `type/issue-number-short-description`.
5. **Commits and pull requests reference the issue number**, so the history explains itself.
6. **Meetings and process are written up on the wiki** as they happen, not reconstructed at the end.

Full conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Timeline

| Milestone | Weeks | Status |
| :--- | :--- | :--- |
| **M1 — Concept convergence** | 5–7 | Ten interviews, competitor teardown, concept chosen |
| **M2 — Requirements & first build** | 7–8 | Requirements traced to evidence; working multi-device prototype |
| **M3 — Testing & stand-up** | 9 | Two tester groups, tutor feedback, eleven owned response tasks |
| **M4 — Build & refine** | 10–12 | Merge the two branches, third testing round, poster, tradeshow |
| **M5 — Final submission** | 13 | Documentation, process overview and ethics exported to PDF |

---

## References

Bluck, S., Alea, N., Habermas, T., & Rubin, D. C. (2005). A tale of three functions: The self-reported uses of autobiographical memory. *Social Cognition, 23*(1), 91–117. https://doi.org/10.1521/soco.23.1.91.59198

Conway, M. A. (2005). Memory and the self. *Journal of Memory and Language, 53*(4), 594–628. https://doi.org/10.1016/j.jml.2005.08.005

Hirst, W., et al. (2015). A ten-year follow-up of a study of memory for the attack of September 11, 2001: Flashbulb memories and memories for flashbulb events. *Journal of Experimental Psychology: General, 144*(3), 604–623. https://doi.org/10.1037/xge0000055

Lundgren, S., Fischer, J. E., Reeves, S., & Torgersson, O. (2015). Designing mobile experiences for collocated interaction. *Proceedings of CSCW '15*, 496–507. https://doi.org/10.1145/2675133.2675171

Olsson, T., Jarusriboonchai, P., Woźniak, P., Paasovaara, S., Väänänen, K., & Lucero, A. (2020). Technologies for enhancing collocated social interaction: Review of design solutions and approaches. *Computer Supported Cooperative Work (CSCW), 29*, 29–83. https://doi.org/10.1007/s10606-019-09345-0

Petrelli, D., & Whittaker, S. (2010). Family memories in the home: Contrasting physical and digital mementos. *Personal and Ubiquitous Computing, 14*(2), 153–169. https://doi.org/10.1007/s00779-009-0277-7

Wardell, V., & Palombo, D. J. (2024). Stability and malleability of emotional autobiographical memories. *Nature Reviews Psychology, 3*(6), 393–406. https://doi.org/10.1038/s44159-024-00312-1

---

Coursework repository for DECO3500 at The University of Queensland. Research materials are held in accordance with the participant consent obtained for this project.
