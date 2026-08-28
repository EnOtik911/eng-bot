# PROJECT.md — Eng_bot (team living memory)

> Created by `project-architect`. Hard cap: 150 lines. Read only the section a task
> needs: `sed -n '<start>,<end>p' .context/PROJECT.md` — never the whole file by default.

## Table of contents

| Section | Lines |
|---|---|
| About the project | 18-30 |
| Tasks and status | 31-38 |
| Environment | 39-54 |
| Architecture | 55-61 |
| Restart & live probe | 62-67 |
| ADR (architectural decisions) — index only | 68-80 |
| Key code fragments | 81-83 |

## About the project

**Status: uninitialized.** The working directory (`pwd`) contains no source code, no
package manifest, no config files, and is not a git repository — verified directly
(`ls -la`, `git rev-parse --is-inside-work-tree`) at skeleton creation time, not assumed.

The directory name `Eng_bot` *suggests* an English-learning bot, but this is an
**unverified hint only** — no requirements, spec, or code confirm it yet. Do not build on
this assumption; confirm the actual goal with the user before any implementation work.

Purpose, target user, and success criteria: _Not yet defined — filled in at the first
substantive task (RULE 7 discovery)._

## Tasks and status

_No tasks recorded yet._ This file exists only as an empty-project skeleton so that
other agents have a `PROJECT.md` to read (per project-architect's specifics: "without it,
other agents cannot work"). First real task should run RULE 7 discovery before any plan.

Where we left off: skeleton just created; nothing implemented.

## Environment

Language / framework / runtime: _Not yet defined — no manifest exists
(no `package.json`, `requirements.txt`, `go.mod`, etc. found)._

Database: _Not yet defined._

How to run: _Not yet defined._

How to test: _Not yet defined._

Reproducing commands for volatile facts (per RULE 5 — never store the value itself):
- Working directory path: `pwd`
- Repo file listing: `ls -la`
- Git status (once initialized): `git -C "$(pwd)" status`

## Architecture

Module layout: _Not yet defined — no directories or files exist besides `.context/`
and `.claude/`._

Key components / data flows: _Not yet defined._

## Restart & live probe

_Not yet defined — no running process exists. This section must be filled in (exact
restart command + exact command that reads the live artifact) before RULE 4 live-proof
verification can apply to this project._

## ADR (architectural decisions) — index only

<!-- One line per decision, linking to the full record in `.context/adr/ADR-NN-slug.md`.
     Full ADR text (Context, Decision, Alternatives Considered, Consequences) never
     goes inline here — adr-manager owns that template.
     Header + example schema (no real ADRs exist yet):
     | # | Date | Decision | Link |
     |---|---|---|---|
     | 1 | 2026-08-21 | Use Postgres over Mongo for primary store | `.context/adr/ADR-01-use-postgres.md` |
-->

_No ADRs recorded yet._

## Key code fragments

_None yet — no code exists in this project._
