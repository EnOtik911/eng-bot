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
| 6 | Deploy to live artifacts | **owner** | docs/deploy.md | 5 | 6 | BLOCKED — needs his Google account, bot token, GitHub push |
| 7 | Live proof after deploy | orchestrator | owner's exec URL | 6 | 7 | pending |
| 8 | tech-bank 004-006 | orchestrator | shipped code | 5 | 7 | pending |

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

## Corrections issued to the owner

- GitHub Pages limits DO exist (100 GB/mo, 1 GB site, 10 builds/hr) — GATE 1 claimed otherwise
- GATE 1 text said "steady load = new x 5"; measured is x9.5 per **word** (x4.7 per card). The table's numbers were right, the sentence explaining them was not
- Two of the owner's annotations were lost because the poll output was piped through `tail -25`

## Resume instruction

Next actionable step belongs to the owner: `docs/deploy.md` steps 1-9.
When he returns with the `/exec` URL, resume at wave 7: live proof per the
`## Restart & live probe` section of PROJECT.md, then tech-bank 004-006.
