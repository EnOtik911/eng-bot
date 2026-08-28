# PROJECT.md — Eng_bot (team living memory)

> Hard cap: 150 lines. Read only the section a task needs:
> `sed -n '<start>,<end>p' .context/PROJECT.md` — never the whole file by default.

## Table of contents

| Section | Lines |
|---|---|
| About the project | 19-29 |
| Tasks and status | 32-44 |
| Environment | 47-62 |
| Architecture | 65-90 |
| Restart & live probe | 93-108 |
| ADR index | 111-117 |
| Key code fragments | 120-135 |

## About the project

Personal English-learning system for one user: a Telegram Mini App with two blocks —
spaced-repetition vocabulary and a grammar trainer — plus a plain-Markdown knowledge base.

Hard constraints: zero recurring cost, no self-managed servers, no LLM calls at
runtime, single user, no audio/TTS.

Diagnosis driving the content design (revised during discovery, see CHANGELOG):
the bottleneck is retrieval, not recognition — but vocabulary volume is genuinely
the base constraint. The card unit is therefore a collocation, not a word, and the
production direction unlocks only after recognition matures.

## Tasks and status

Done: discovery (GATE 1), specification (GATE 2), vocabulary block deployed and
verified live, light glass visual system, generated user guide, grammar block
(v0.6.0) complete and green locally.

Where we left off: the grammar block is committed but NOT deployed. Deploying it
needs three owner actions no agent can take — `clasp push -f` plus a redeploy, a
`git push` for the Pages client, and three menu runs in the sheet (setup, seed,
import). Until then the home screen shows grammar as unavailable and vocabulary
keeps working; that degradation is deliberate and tested.

Still open from earlier: the bot token pasted in chat has never been confirmed
revoked in BotFather.

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
`test/` dependency-free tests, `data/` seed batches, `kb/` knowledge base and
generation prompts, `docs/` guides, specs and ADRs, `tech-bank/` study notes.

Key data flow, and the decision the whole design rests on: **two network calls per
session, not one per answer.** The client GETs the whole due queue, buffers answers
in localStorage, and POSTs them as one batch. Apps Script has 400-1500 ms latency
per call, so a per-answer round trip would make a hundred-card session unusable.
Offline tolerance falls out of this for free.

Scheduler: FSRS-6, default weights, `desired_retention` from `settings` (0.85 for
vocabulary, 0.9 for grammar). `gas/Fsrs.gs` touches nothing but numbers and is loaded
verbatim by the tests, so backend and tests share one copy. It never knew what it was
scheduling, which is why the grammar block sits beside it rather than through it.

Grammar's own load-bearing decision (ADR-04): FSRS state lives on the PATTERN, and each
round draws different sentences from that pattern's pool. Scheduling the sentence would
train the sentence while the metrics reported a mastered rule.

Grammar's rating is derived server-side from facts the client reports
(`{item_id, correct, hint_used}`), never self-reported: a hint caps the round at GOOD so
the scheduler cannot grow an interval on borrowed knowledge.

Transport rule that cannot be violated: simple requests only — `text/plain`, no
custom headers. Apps Script never answers `OPTIONS`; see ADR-03.

## Restart & live probe

Nothing runs locally, so there is no local restart. The live artifacts are the
Apps Script deployment and the Sheets document.

Grammar additionally needs, once, from the spreadsheet menu: «Первичная настройка
листов» -> «Засеять грамматику» -> «Импортировать грамматику». Live probe for it:
the `patterns` tab holds 8 rows and `grammar_items` holds 96.

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
| 4 | 2026-08-28 | Grammar schedules the pattern, not the sentence | `docs/adr/ADR-04-schedule-the-pattern-not-the-sentence.md` |

## Key code fragments

- `gas/Fsrs.gs` — `fsrsReview(card, rating, elapsedDays, opts)` is the only entry
  point the rest of the backend uses.
- `gas/Session.gs` — `buildSession(userId)` and `applyFlush(userId, batchId, reviews)`
  are the two operations behind the whole API.
- `gas/Store.gs` — `writeCardUpdates_` batches row writes and is the only place
  that takes the lock.
- `app/api.js` — the two functions that must stay simple-request-only.
- `gas/Grammar.gs` — `buildGrammarSession(userId)`, `applyGrammarFlush(...)` and
  `grammarRating_(errors, hints, total)`, the one place the rating rule exists.
- `app/answer.js` — the only implementation of "is this answer correct"; the server
  records facts and never re-checks.
- `test/load-model.mjs` — not a test: prints the measured review-load curve. The
  daily-target default came from its output, not from a formula.
- `docs/spec-grammar.md` — the grammar block's specification; read it before touching
  anything under the grammar heading.
