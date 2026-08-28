# PROJECT.md — Eng_bot (team living memory)

> Hard cap: 150 lines. Read only the section a task needs:
> `sed -n '<start>,<end>p' .context/PROJECT.md` — never the whole file by default.

## Table of contents

| Section | Lines |
|---|---|
| About the project | 18-29 |
| Tasks and status | 31-40 |
| Environment | 42-58 |
| Architecture | 60-77 |
| Restart & live probe | 79-91 |
| ADR index | 93-99 |
| Key code fragments | 101-111 |

## About the project

Personal English-learning system for one user: a spaced-repetition vocabulary trainer
as a Telegram Mini App, plus a plain-Markdown knowledge base.

Hard constraints: zero recurring cost, no self-managed servers, no LLM calls at
runtime, single user, no audio/TTS.

Diagnosis driving the content design (revised during discovery, see CHANGELOG):
the bottleneck is retrieval, not recognition — but vocabulary volume is genuinely
the base constraint. The card unit is therefore a collocation, not a word, and the
production direction unlocks only after recognition matures.

## Tasks and status

Done: discovery (GATE 1), specification (GATE 2), first implementation pass.
Both gates approved by the owner.

Where we left off: code complete and tested locally; nothing deployed yet.
The next action is the owner's, not an agent's — steps 1-9 in `docs/deploy.md`
require his Google account, a BotFather token and a GitHub push.

No upstream remote is configured, so commits are local only.

## Environment

Language / runtime: Google Apps Script (V8) for the backend, plain browser JS for
the Mini App. No build step, no package manifest, no dependencies.

Database: Google Sheets. Tabs: `cards`, `settings`, `inbox`, `rejects`,
`flush_log`, `review_log_<year>`.

How to run tests: `./test/run-all.sh` — four suites plus a syntax gate, no install.

How to deploy: `docs/deploy.md`, nine steps, each with its own check.

Reproducing commands for volatile facts (never store the value):
- working directory: `pwd`
- commit count: `git rev-list --count HEAD`
- tracked files: `git ls-files | wc -l`
- test status: `./test/run-all.sh`

## Architecture

Module layout: `app/` Mini App (static, GitHub Pages), `gas/` Apps Script backend,
`test/` dependency-free tests, `data/` seed batches, `kb/` knowledge base,
`docs/` deploy guide and ADRs, `tech-bank/` study notes.

Key data flow, and the decision the whole design rests on: **two network calls per
session, not one per answer.** The client GETs the whole due queue, buffers answers
in localStorage, and POSTs them as one batch. Apps Script has 400-1500 ms latency
per call, so a per-answer round trip would make a hundred-card session unusable.
Offline tolerance falls out of this for free.

Scheduler: FSRS-6, default weights, `desired_retention` from `settings` (0.85).
`gas/Fsrs.gs` touches nothing but numbers and is loaded verbatim by the tests, so
backend and tests share one copy.

Transport rule that cannot be violated: simple requests only — `text/plain`, no
custom headers. Apps Script never answers `OPTIONS`; see ADR-03.

## Restart & live probe

Nothing runs locally, so there is no local restart. The live artifacts are the
Apps Script deployment and the Sheets document.

After changing anything in `gas/`:
- redeploy: `cd gas && clasp push -f`, then Deploy -> Manage deployments -> edit ->
  New version. **A `clasp push` alone does not change what the `/exec` URL serves.**
- live probe: `curl "$EXEC_URL?action=ping"` returns `{"ok":true,"pong":...}`,
  and `curl "$EXEC_URL?action=session"` returns `{"ok":false,"code":"BAD_INIT_DATA"}`.
  The second one failing that way is the success signal.
- live data probe: open the Sheets document and read the `cards` tab after the
  action under test — a green unit test is not live proof.

## ADR index

| # | Date | Decision | Link |
|---|---|---|---|
| 1 | 2026-08-28 | Allowlist array instead of one hardcoded user id | `docs/adr/ADR-01-allowlist-instead-of-single-constant.md` |
| 2 | 2026-08-28 | FSRS-6 with default parameters, retention 0.85 | `docs/adr/ADR-02-fsrs6-with-default-parameters.md` |
| 3 | 2026-08-28 | Only simple cross-origin requests | `docs/adr/ADR-03-simple-requests-only.md` |

## Key code fragments

- `gas/Fsrs.gs` — `fsrsReview(card, rating, elapsedDays, opts)` is the only entry
  point the rest of the backend uses.
- `gas/Session.gs` — `buildSession(userId)` and `applyFlush(userId, batchId, reviews)`
  are the two operations behind the whole API.
- `gas/Store.gs` — `writeCardUpdates_` batches row writes and is the only place
  that takes the lock.
- `app/api.js` — the two functions that must stay simple-request-only.
- `test/load-model.mjs` — not a test: prints the measured review-load curve. The
  daily-target default came from its output, not from a formula.
