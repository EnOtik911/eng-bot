# HANDOFF — Active Task

> Evidence BY REFERENCE only (paths/commands — never pasted diffs or logs).
> The orchestrator alone records verification and marks rows VERIFIED.

## Plan table

| # | Subtask | Owner | Receives | Depends on | Wave | Status |
|---|---------|-------|----------|------------|------|--------|
| 1 | Discovery, 13 questions | orchestrator | brief | — | 1 | VERIFIED |
| 2 | Research, 3 tracks | orchestrator | discovery answers | 1 | 2 | VERIFIED |
| 3 | GATE 1 findings | orchestrator | research | 2 | 3 | VERIFIED — approved by owner |
| 4 | GATE 2 specification | orchestrator | GATE 1 | 3 | 4 | VERIFIED — approved by owner |
| 5 | Implementation, first pass | orchestrator | GATE 2 | 4 | 5 | VERIFIED — tests green |
| 6 | Deploy: GitHub + Pages | orchestrator | docs/deploy.md | 5 | 6 | VERIFIED — https://enotik911.github.io/eng-bot/app/ HTTP 200 |
| 7 | Deploy: Sheets, script properties, Web App | **owner** | docs/deploy.md steps 1-5 | 5 | 6 | DONE by owner — six tabs present, deployment V2 live |
| 8 | Live proof of the backend | orchestrator | exec URL | 7 | 7 | VERIFIED — six request paths probed against the deployed endpoint |
| 9 | Mini App wired to backend | orchestrator | exec URL | 8 | 7 | VERIFIED — published config.js serves the real URL |
| 10 | First real session end to end | **owner** | seedStarterBatch, runImport | 9 | 8 | pending — cards sheet still empty |
| 11 | tech-bank 005-007 | orchestrator | shipped code | 9 | 8 | pending |

## Settled decisions (do not re-litigate)

- Card unit is a collocation, type is a column — retrieval failure is a symptom of word-level storage — GATE 1, ADR pending
- Production (RU→EN) unlocks after recognition matures, not in parallel — empirical acquisition ladder + halves early debt — GATE 1
- FSRS-6, default weights, retention 0.85 in settings — 20-30% fewer reviews, same storage cost as SM-2 — ADR-02
- Two network calls per session, answers buffered client side — Apps Script latency 400-1500 ms per call — GATE 1
- Simple requests only, text/plain, no custom headers — Apps Script never answers OPTIONS — ADR-03
- Allowlist array, user_id column from day one — costs nothing now, avoids a migration later — ADR-01
- Listening comprehension is an explicit non-goal — owner's decision, recorded so it is not mistaken for an oversight — GATE 1
- RU/EN interface toggle cut from MVP, strings live in one dictionary — the only brief item that yields no learned words — GATE 1
- No `learning` state: `due` is date-granular, so "again" re-shows inside the session instead — deviation from GATE 2, flagged to owner — app/session.js:8

## Verification evidence (by reference only)

- All suites green — `./test/run-all.sh` — 40 assertions, 4 suites, plus syntax gate over 17 files
- FSRS constants pinned by golden values, not by the self-cancelling identity — test/fsrs.test.mjs
- initData scheme checked against an independent signer (node crypto) — test/auth.test.mjs
- Import rules verified in both directions: accepts real variation, still rejects a wrongly paired example — test/import-format.test.mjs
- Review-load default derived from measurement, not formula — `node test/load-model.mjs`
- PROJECT.md ToC ranges reconciled against real `## ` offsets — 112 lines, cap 150
- Three defects found by tests and fixed: missing `rating` argument in the recall path; `remaining()` double count; example-match rule too strict for collocations

## Live evidence (deployment V2, 2026-08-28)

Probed against the real `/exec`, not a test double:

- `?action=ping` -> `{"ok":true,"pong":...}`
- `?action=session` without initData -> `{"ok":false,"code":"BAD_INIT_DATA"}` — the refusal IS the success criterion
- POST flush with forged initData -> `BAD_INIT_DATA`
- POST unknown action -> `BAD_REQUEST "unknown action"`
- POST non-JSON body -> `BAD_REQUEST "body is not JSON"`
- POST Telegram-shaped update without the secret -> `{"ok":true}`, silent by design
- `Access-Control-Allow-Origin: *` present on the final response after the 302
- Published `app/config.js` on Pages carries the real exec URL (fetched from github.io)

Two design defects found only by running it:

- **standalone vs onOpen.** ADR-02 chose a standalone script; `Menu.gs` used a simple
  `onOpen()`, which only fires for container-bound scripts. The menu could never have
  appeared. Fixed with an installable onOpen trigger bound to the sheet by id, plus
  editor-runnable twins for every menu action.
- **deployment pinned to a stale version.** `clasp push` reported success while `/exec`
  kept serving version 1. Exactly the trap documented in tech-bank/004, hit for real.

One testing artifact worth remembering: `curl -X POST -L` keeps the method POST across
the 302, which returns Google's HTML error page and looks like a broken endpoint. A
browser switches to GET on the redirect; `curl --data ... -L` without `-X` reproduces
that. The code was correct and the test was wrong.

## Corrections issued to the owner

- GitHub Pages limits DO exist (100 GB/mo, 1 GB site, 10 builds/hr) — GATE 1 claimed otherwise
- GATE 1 text said "steady load = new x 5"; measured is x9.5 per **word** (x4.7 per card). The table's numbers were right, the sentence explaining them was not
- Two of the owner's annotations were lost because the poll output was piped through `tail -25`

## Resume instruction

The system is deployed and the backend is verified live. The only thing standing
between here and a working trainer is content: the `cards` sheet is empty.

Next actionable step belongs to the owner, in the Apps Script editor:
1. run `seedStarterBatch` — puts 20 rows into `inbox`
2. run `runImport` — creates 40 cards, report in the execution log
3. open the Mini App from the bot and answer six cards

Then resume at wave 8: read `review_log_2026` after that session as the end-to-end
live proof, and write tech-bank 005-007 against shipped code.
