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
| 7 | Tests: 6 new suites, 69 new assertions; red-then-green demonstrated for each | VERIFIED |
| 8 | Docs: spec, grammar map, generation prompt, user guide, ADR-04 | VERIFIED |
| 9 | Deploy | BLOCKED on owner |

## T-007 — visual fix (v0.6.1), same session

Owner reported white-on-white text on his phone with a screenshot. Root cause was NOT
in the palette: `applyTheme` overwrote five CSS variables from Telegram's themeParams,
of which only two existed in styles.css. One was `--fg`. His Telegram is in dark theme,
so `text_color` arrived white, `--fg` became white, the background stayed light.
Everything on `--fg-dim`/`--fg-faint` stayed readable because Telegram does not know
those names — which is exactly how the screenshot could be read element by element.

contrast.test.mjs could not see it: it reads values from CSS while the substitution
happened in JS. Textbook case of a suite checking consistency instead of correctness.

Fixed by removing the themeParams palette read entirely (see the comment in
`app/ui.js:applyTheme` for why half-adaptation is the worst option), plus
`test/theme.test.mjs` which asserts the runtime never overrides a variable the contrast
suite depends on, and that every variable the runtime does set actually exists.

Also delivered from the same message: fourth glass layer (`.pattern-row`), stronger
refraction (`saturate(200%)`, inset specular edge, glass fill .62 -> .56), and a
sharp-edged decor layer (paper plane, four rings) — sharp edges are the requirement, a
blurred blob under a blurring surface gives nothing to refract.

Two other suites were found to be weaker than they looked, and strengthened:
- css-perf's blur check silently degraded to measuring only the 1px @supports fallbacks
  once the value moved behind `--glass-fx`; now it resolves var() chains and asserts it
  found at least as many blur values as there are glass rules
- the @supports fallback and prefers-reduced-motion checks asserted the block exists,
  not that it covers every glass / every animation; both now check coverage

`--fg-faint` regressed to 4.49:1 when the glass got more transparent — caught by the
contrast suite and fixed to #57647C (4.69:1), computed against the same background the
suite composites rather than picked by eye.

Verified visually, not only by reasoning: rendered headless in a scratchpad Playwright
(NOT the owner's browser) with a stub Telegram SDK carrying his DARK theme, and read the
pixels. Darkest pixel in the title box is luminance 21 against #0E1526 = 19. My own
first read of the full-page screenshot said "still washed out" and was wrong — the
downscaled PNG averaged the glyphs away; the 3x crop and the pixel measurement agree the
text is black.

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
- The app's palette is NEVER taken from Telegram themeParams. Half from a foreign theme
  and half our own is what produced white-on-white; contrast is tested for this palette
  only — `app/ui.js:applyTheme`, `test/theme.test.mjs`
- Exactly four glass surfaces, budget five. Decor shapes must stay sharp-edged: blur
  under blur refracts nothing — `app/styles.css`
- `item.kind` is a schema value and never reaches the screen; the Russian per-kind
  instruction is the only label — `test/dom-ids.test.mjs`

## Verification evidence (by reference)

- full suite: `./test/run-all.sh` — 15 suites, 151 assertions, all green
- one push in this task landed with `import-format.test.mjs` red: it globs every
  data/*.tsv and applied the vocabulary rules to the new grammar corpus. Fixed by
  routing files by header to the matching validator, with an assertion that every file
  in data/ WAS routed — skipping unrecognised files would leave a new corpus unchecked,
  which is worse than the false failure. Demonstrated red on an unknown header and on a
  corrupted grammar row.
- `test/grammar-e2e.test.mjs` closes the gap between the two halves: the real corpus goes
  through the real validator, the real scheduler, the real client checker and the real
  flush, with only Sheets stubbed. Client suites use hand-written payloads, so a shape
  mismatch between server and client would have surfaced only in the app
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

1. DONE — backend live at V8. `clasp push -f` was already done by the owner; the
   deployment was still pinned to @7, so `create-version` + `redeploy <id> -V 8` was
   run. Probe: `?action=grammar` now returns `BAD_INIT_DATA` (action recognised, fell
   through to auth) instead of `unknown action: grammar`. `redeploy` takes the id
   POSITIONALLY, not via `-i`.
2. DONE — client live on Pages at v0.6.0 (probed: answer.js, grammar.js, grammar-ui.js
   all 200). Both halves are now on the new version.
3. PENDING — owner only, in the sheet: menu -> «Первичная настройка листов», then
   «Засеять грамматику», then «Импортировать грамматику». Expected: 8 rows in
   `patterns`, 96 in `grammar_items`, 0 on `grammar_rejects`. Cannot be done from the
   terminal: `clasp run` needs a GCP project and an API-executable deployment that this
   project deliberately does not have.
4. Live probe: open the app, home screen shows a grammar count; run one mixed round;
   read `patterns` and `grammar_log_2026` — the round must be there with a derived rating.

Runbook defect found while the owner was executing step 10 and fixed in the same pass:
`docs/deploy.md` used a `$EXEC_URL` variable it never told him to set, so `curl -s`
printed nothing and looked like a dead server. The doc now sets it from `app/config.js`,
says explicitly that empty output means the command did not run, and the command was
verified by running it in both bash and zsh. Same class as the `bot<ТОКЕН>` angle
brackets: a placeholder that reads as literal.

Still outstanding from earlier tasks: revoke the leaked bot token; run
`backfillFirstReview()`; run `runTestPing` to clear the stale-trigger banner.
