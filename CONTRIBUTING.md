# Contributing

House rules for Team NO_PARKING(!). Short, because rules nobody reads don't help.

## Before you start

Pick up an issue from the [project board](https://github.com/batinion/DECO3500/projects), assign it to yourself, and move it to **In Progress**. If the work you're about to do has no issue, create one first — a two-line issue is fine.

## Branches

One branch per issue:

```
type/issue-number-short-description
```

| Prefix | Use for |
| :--- | :--- |
| `research/` | Interviews, literature, competitor work |
| `design/` | Sketches, wireframes, prototypes, visual assets |
| `docs/` | Written documentation, notes, decision records |
| `proto/` | Prototype code |
| `chore/` | Repo structure, templates, housekeeping |

Example: `research/12-interview-protocol`

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), always referencing the issue number:

```
docs: add interview protocol and consent script (#12)
design: low-fi wireframes for capsule sealing flow (#18)
chore: restructure deliverables folder (#3)
```

Commit in meaningful units. One commit per work session with everything dumped in makes the history useless as evidence of process — and this course marks process.

## Pull requests

Open a PR against `main`, link the issue with `Closes #12`, and request one teammate as reviewer. Reviews should happen within 24 hours; if the reviewer is unavailable, ask in Teams rather than merging unreviewed.

Keep `main` in a state you'd be happy for a tutor to open at any moment.

## Files

Follow the naming convention in the [README](README.md#file-naming-convention):

```
YYYY-MM-DD_vX.Y_short-description.ext
```

Never overwrite a previous iteration. Add a new file and log what changed in that deliverable's `CHANGELOG.md`.

Binary files (`.pptx`, `.pdf`, `.fig`, images) are committed normally — they are the deliverables. Keep exports reasonable in size; if a file is over ~50 MB, link it from Teams or UQ storage and note the location in the relevant folder instead.

## Research materials

Interview transcripts and participant notes go in `docs/research/interviews/`. **De-identify before committing** — use participant codes (`P01`, `P02`) rather than names, and do not commit consent forms containing signatures or contact details. If in doubt, ask the team before pushing.
