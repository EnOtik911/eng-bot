# HANDOFF — active task

## T-006 — grammar block (second app block)

Owner brief: two blocks in the app; grammar modes = pick a tense, or mixed. Many
exercise variations where sentence parts are shown and must be arranged or typed.
No theory on screen, but the tense label always visible and linked out. Hints that
explain WHY are wanted. Owner answered the four proposal questions with "результативность
важнее, делаем всё, делай как будет лучше" — so all four exercise kinds shipped and the
sequencing decision was taken on evidence rather than referred back.

| # | Subtask | Status |
|---|---|---|
| 1 | Research: drill types, Russian-L1 interference, scramble vs gap-fill, form-focused instruction | done |
| 2 | Schema: `patterns` + `grammar_items` + inbox/rejects, settings, ADR-04 | VERIFIED |
| 3 | `gas/Grammar.gs` scheduler, derived rating, hint cap | VERIFIED |
| 4 | `gas/GrammarImport.gs` validator + rollback | VERIFIED |
| 5 | Corpus: 8 patterns x 12 items x 4 kinds = 96 | VERIFIED |
| 6 | Client: `answer.js`, `grammar.js`, `grammar-ui.js`, home screen, picker | VERIFIED |
| 7 | Tests: 5 new suites, 61 new assertions; red-then-green demonstrated for each | VERIFIED |
| 8 | Docs: spec, grammar map, generation prompt, user guide, ADR-04 | VERIFIED |
| 9 | Deploy | BLOCKED on owner |

## Settled decisions (do not re-litigate)

- FSRS state on the PATTERN, sentences drawn from a pool — scheduling the sentence
  trains the sentence while metrics report a mastered rule — ADR-04
- Rating derived server-side from `{correct, hint_used}`, never self-reported; grammar
  correctness is objectively checkable, so a self-rating would be invented noise —
  `docs/spec-grammar.md` §5
- Hint caps the round at GOOD — without it a hinted answer is indistinguishable from a
  known one — `gas/Grammar.gs:grammarRating_`
- Answer checking lives on the client only; server records facts. Latency, not trust —
  `docs/spec-grammar.md` §6
- Pattern order by L1 interference, not by textbook order — `docs/spec-grammar.md` §2
- Wrong items re-asked at round end, but the re-attempt does NOT change the record —
  `app/grammar.js:submit`
- `fix` items prefill the stem into the input: finding an error and retyping a sentence
  are different tasks — `app/grammar-ui.js:renderItem`
- One GET returns pools for non-due patterns too, so picking a pattern by hand costs no
  round trip — `gas/Grammar.gs:buildGrammarSession`
- Grammar keeps a separate localStorage buffer and batch id from vocabulary — one
  duplicate check must not swallow the other — `app/store.js`
- Seed corpus routed through the real importer, not written straight to the sheet —
  found the dedupe-key defect on the first run

## Verification evidence (by reference)

- full suite: `./test/run-all.sh` — 14 suites, 137 assertions, all green
- `test/dom-ids.test.mjs` closes a gap no other suite covered: a typo in an element id
  passes syntax checking and logic tests, then blanks the app silently at runtime. It
  also caught one dangling i18n key (`theoryLink`) that was declared and never wired
- red demonstration: pool cursor frozen -> 1 fail; retry overwrite -> 3 fails; hint cap
  removed -> 2 fails; corpus token mismatch -> 1 fail. All restored green afterwards.
- corpus solvability: `test/grammar-import.test.mjs` runs every one of the 96 canonical
  answers through the real client checker, and asserts `fix`/`transform` stems are
  rejected by it
- CSS budgets: 3 glass surfaces of 5 allowed, all four new colour pairs pass WCAG AA
- generated artifacts in sync: `node test/build-all-in-one.mjs --check`,
  `node test/build-guide.mjs --check`
- security: `keys` was a tracked 0-byte file that `.gitignore` could not cover; verified
  empty in every historical version, untracked and deleted. No secret was ever committed.

## Next actionable step — owner only

1. `cd gas && clasp push -f`, then Deploy -> Manage deployments -> edit -> New version.
   A push alone does not change what `/exec` serves.
2. `git push` — the Pages client. Safe to do before step 1: the home screen degrades to
   "Грамматика ещё не залита" and vocabulary keeps working.
3. In the sheet: menu -> «Первичная настройка листов», then «Засеять грамматику», then
   «Импортировать грамматику». Expected: 8 rows in `patterns`, 96 in `grammar_items`,
   0 on `grammar_rejects`.
4. Live probe: open the app, home screen shows a grammar count; run one mixed round;
   read `patterns` and `grammar_log_2026` — the round must be there with a derived rating.

Still outstanding from earlier tasks: revoke the leaked bot token; run
`backfillFirstReview()`; run `runTestPing` to clear the stale-trigger banner.
