# Space-Cap

**A group time-capsule ritual, supporting relationships through nostalgia and reminiscence**

*Called Launch Sequence in our code.*

| | |
| --- | --- |
| **Course** | DECO3500 Social & Mobile Computing |
| **Institution** | The University of Queensland |
| **Semester** | 2, 2026 |
| **Team** | NO_PARKING(!) |
| **Team lead** | Dev Kansana |
| **Spokesperson** | Vim Mahakumbura |

**Poster:** [Team 12 poster (PDF)](design/Team_12_Poster.pdf) · **Promotional material:** [Promotional material (PDF)](design/Promotional-material.pdf)

---

## Run the prototype

The build we demonstrated at the tradeshow is in [`prototype/final/`](prototype/final/).

You need [Node.js](https://nodejs.org) on one computer (20 or newer recommended; the server
alone runs on 18). **Every device must be on the same Wi-Fi network with client isolation
off.** A phone hotspot works. Some university networks do not.

```
cd prototype/final/src
./start-all.sh          # macOS and Linux
start-all.bat           # Windows
```

This installs dependencies on first run and starts the full Space-Cap experience on
`http://localhost:4000`. (Equivalent by hand: `cd prototype/final/src/server`, then
`npm install` and `npm start`.)

The terminal prints the links. Open the **LAN address** (`http://<ip>:4000`) on every device.
There is no login: one person taps *Create a new crew*, then *Invite* shows a code, a link
and a QR for everyone else. Selfies, photos and voice notes need the HTTPS link
(`https://<ip>:4443`), and the browser will warn once about the self-signed certificate.
That link only appears if OpenSSL is installed on the computer running the server.

The two unlock games we compared in prototype test 2 still run on their own, from
[`prototype/versions/rescue-game/`](prototype/versions/rescue-game/) (port 4001) and
[`prototype/versions/colour-game/`](prototype/versions/colour-game/) (port 4002). They are
not part of the final build.

Trying it alone? The crew screen can add simulated crewmates. Gate that control when real
people are joining, because a full crew blocks a real participant.

Full prototype notes, including the earlier builds, are in
[`prototype/README.md`](prototype/README.md). Developer notes for the final build are in
[`prototype/final/src/README.md`](prototype/final/src/README.md).

---

## Documentation

Our design process lives on the **[project wiki](https://github.com/batinion/DECO_3500/wiki)**.

| Page | What's in it |
| --- | --- |
| [Design Process Overview](https://github.com/batinion/DECO_3500/wiki/Design-Process-Overview) | The top-level story, for the final submission |
| [Ethical Considerations](https://github.com/batinion/DECO_3500/wiki/Ethical-Considerations) | Stakeholders, risks, and what we take responsibility for |
| [Prototypes and Evaluation](https://github.com/batinion/DECO_3500/wiki/Prototypes-and-Evaluation) | Every build, every round of testing, and what changed because of it |
| [Requirements](https://github.com/batinion/DECO_3500/wiki/Requirements) | 17 experience requirements, each traced to evidence, with their status |
| [Research Findings](https://github.com/batinion/DECO_3500/wiki/Research-Findings) | Eleven interviews, six themes, literature, competitor landscape |
| [Team Meetings](https://github.com/batinion/DECO_3500/wiki/Team-Meetings) | Meeting records and the decisions carried out of them |
| [Week 9 Stand-up](https://github.com/batinion/DECO_3500/wiki/Week-9-Stand-up) | Project state at the assessed stand-up |

Task tracking is on the [project board](https://github.com/batinion/DECO_3500/projects),
not in separate paperwork. Significant decisions are recorded in
[`docs/decisions/`](docs/decisions/). Source research is in [`research/`](research/) and
testing evidence in [`user-testing/`](user-testing/). Use of AI tools is recorded in
[`docs/AI-usage-log.md`](docs/AI-usage-log.md).

---

## Overview

People preserve and revisit memories constantly, but almost always alone. Camera rolls fill
up, group chats scroll away, and physical mementoes sit in boxes nobody opens. This project
asks how mobile and social technology can support **shared** reminiscence: memory as
something a group builds and returns to together.

**Space-Cap** is a group time-capsule ritual for a circle of friends at the end of
something shared, whether a course, a season or a job. Each person uses their own device to
write short prompted memories **about the others**, and the crew's rocket fills as memories
go in. There is no host and no leader. When everyone is ready the capsule seals and
launches, time jumps forward, and the crew has to come back together to open it. The unlock
is a single ship with its controls split between the crew, so nobody opens the capsule
alone.

Grounded in **eleven semi-structured interviews** run by three team members (ten of them in
the thematic analysis), spanning ages 20s to 60+ and Australian, Indian and American
participants. After early concept and paper rounds, we ran three rounds of user testing:
prototype test 1, prototype test 2 and the Week 12 tradeshow.

---

## Repository structure

```
.
├── prototype/
│   ├── final/              The build we demonstrated and submit (src/ and screenshots/)
│   ├── versions/           Earlier builds and the two standalone unlock games
│   ├── demo-material/      Media used at the stall
│   └── progress/           Running record of prototype development
│
├── design/
│   ├── Team_12_Poster.pdf  The A2-size tradeshow poster
│   ├── Promotional-material.pdf
│   ├── design_artifacts/   Miro boards, in the order we made them
│   ├── screenshots/        Screens from the final build
│   └── tone_and_positioning.md
│
├── research/
│   ├── README.md           Research summary: literature, interviews, frameworks
│   ├── interviews/         Eleven discovery interviews and the thematic analysis
│   ├── literature/         Secondary research and references
│   └── Competitor_analysis/  Teardown of existing time-capsule tools
│
├── user-testing/           Concept rounds and three rounds of user testing (tests 1, 2, tradeshow)
│
├── docs/
│   ├── charter/            Team charter
│   ├── decisions/          Numbered decision records
│   └── AI-usage-log.md     Where and how AI tools were used
│
├── deliverables/           Anything submitted or presented, by assignment
└── .github/                Issue and pull request templates
```

Ethics and meeting records are wiki pages rather than folders, because that is where the
assignment asks for them and keeping a second copy here would only let the two drift apart.

### File naming

```
YYYY-MM-DD_vX.Y_short-description.ext
```

Bump the minor version for a working revision and the major version when something is
submitted. Never overwrite an older iteration. The trail of versions is the evidence of
process, and this course marks process.

---

## The team

Roles shifted from our original [team charter](docs/charter/) as the project developed. This is
who ended up doing what.

| Member | Program | What they did |
| --- | --- | --- |
| **Dev Kansana** | Master of Interaction Design | Poster and promotional material; time-jump design and the opening sequence |
| **Vim Mahakumbura** | Master of Information Technology | Built the prototype, from the first version through to the final build; setup and flow, instruction rewrites, meeting records; two interviews |
| **Shirish Kamble** | Master of Interaction Design | Research lead: five interviews; the no-host, semester-long rebuild that became the base of the final build |
| **Dattatray Siraskar** | Master of Interaction Design | Documentation and GitHub project management: repository, project board and wiki; testing plan, feedback instrument and evaluation write-up |
| **Dong Nguyen** | Master of Information Technology | Four interviews; Guess Who reveal with end-to-end tests; contributions to the final build; prototype screenshots and progress records |

---

## How we work

| Item | Agreement |
| --- | --- |
| Main channel | Microsoft Teams, with meetings recorded and transcribed since 20 September |
| Backup channel | Outlook email, phone |
| Response time | Within 12 hours |
| Regular meeting | Weekly, plus ad-hoc working sessions |
| Decision-making | Discussion aiming for consensus; where consensus is not reached in reasonable time, we consult tutors |

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
| --- | --- | --- |
| **M1 Concept convergence** | 5 to 7 | Eleven interviews, competitor teardown, concept chosen |
| **M2 Requirements and first build** | 7 to 8 | Requirements traced to evidence; working multi-device prototype |
| **M3 Testing and stand-up** | 9 | Two tester groups, tutor feedback, eleven owned response tasks |
| **M4 Build and refine** | 10 to 12 | Branches merged, second testing round, poster, tradeshow |
| **M5 Final submission** | 13 | Documentation, process overview and ethics exported to PDF |

---

## References

Bluck, S., Alea, N., Habermas, T., & Rubin, D. C. (2005). A tale of three functions: The self-reported uses of autobiographical memory. *Social Cognition, 23*(1), 91-117. https://doi.org/10.1521/soco.23.1.91.59198

Conway, M. A. (2005). Memory and the self. *Journal of Memory and Language, 53*(4), 594-628. https://doi.org/10.1016/j.jml.2005.08.005

Grudin, J. (1994). Groupware and social dynamics: Eight challenges for developers. *Communications of the ACM, 37*(1), 92-105. https://doi.org/10.1145/175222.175230

Hollan, J., & Stornetta, S. (1992). Beyond being there. *Proceedings of CHI '92*, 119-125. https://doi.org/10.1145/142750.142769

Lundgren, S., Fischer, J. E., Reeves, S., & Torgersson, O. (2015). Designing mobile experiences for collocated interaction. *Proceedings of CSCW '15*, 496-507. https://doi.org/10.1145/2675133.2675171

Olsson, T., Jarusriboonchai, P., Woźniak, P., Paasovaara, S., Väänänen, K., & Lucero, A. (2020). Technologies for enhancing collocated social interaction: Review of design solutions and approaches. *Computer Supported Cooperative Work (CSCW), 29*, 29-83. https://doi.org/10.1007/s10606-019-09345-0

Petrelli, D., & Whittaker, S. (2010). Family memories in the home: Contrasting physical and digital mementos. *Personal and Ubiquitous Computing, 14*(2), 153-169. https://doi.org/10.1007/s00779-009-0277-7

Wardell, V., & Palombo, D. J. (2024). Stability and malleability of emotional autobiographical memories. *Nature Reviews Psychology, 3*(6), 393-406. https://doi.org/10.1038/s44159-024-00312-1

---

Coursework repository for DECO3500 at The University of Queensland. Research materials are
held in accordance with the participant consent obtained for this project.
