# Grammar block — specification

Status: implemented in v0.6.0. Companion to `docs/guide.md` (user-facing) and
`docs/adr/` (decisions with alternatives).

## 1. The one decision everything else follows from

**FSRS state lives on the PATTERN. Each review draws different sentences from that
pattern's pool.**

The vocabulary block schedules a card, and a card *is* its content — that is correct
there, because the thing being learned is that word. Grammar is not like that. If the
scheduler owned the sentence, then `I have worked at JET Sharing since 2023.` would
come back on schedule and be answered from memory of the sentence. Retention metrics
would climb while the rule stayed unlearned, and nothing in the data would show it.

So:

| Sheet | Row is | Carries FSRS state |
|---|---|---|
| `patterns` | one grammar pattern | yes |
| `grammar_items` | one exercise sentence | no — only `serve_count` / `last_served` |

A review of a pattern is a **round**: `grammar_items_per_round` sentences (default 3)
drawn least-served-first, wrapping around the pool. Two rounds of the same pattern in
one sitting therefore use different sentences; that invariant is asserted in
`test/grammar-client.test.mjs`.

## 2. Sequencing: interference, not the textbook

Russian has three tenses and two aspects against twelve English forms, so the forms
that cost the most are not evenly distributed. The seeded order:

| order | pattern | why here |
|---|---|---|
| 10 | `to_be_present` | Russian has no copula in the present, so `am`/`is` gets dropped |
| 20 | `present_simple_3sg` | the `-s` that keeps disappearing |
| 30 | `present_vs_continuous` | Russian aspect does not map onto Simple/Continuous |
| 40 | `present_perfect_since_for` | Russian uses the present here, English does not |
| 50 | `present_perfect_vs_past` | the single most reported Russian-speaker error |
| 60 | `questions_do_support` | Russian has no do-support; word order is carried by intonation |
| 70 | `past_simple_vs_continuous` | background versus the event that interrupted it |
| 80 | `articles_basic` | Russian has no articles at all; top-three error class |

`order_index` has gaps of ten so a pattern can be inserted without renumbering.
`docs/grammar-map.md` holds the roadmap beyond these eight, and is also where the
theory notes live.

## 3. Exercise kinds

Ordered by how many decisions the learner has to make, not by implementation cost.

| kind | shows | answered by | trains |
|---|---|---|---|
| `scramble` | Russian meaning + word tiles | tapping tiles into order | word order, auxiliary placement; forces comprehension because the tiles cannot be ordered without knowing what the sentence means |
| `transform` | a sentence + the target form | typing the new sentence | the contrast between two forms — where Russian offers no cue |
| `fix` | a sentence containing a typical error, prefilled into the input | editing it | recognising the error you personally make |
| `gapfill` | a sentence with `___` and the verb in brackets | typing the missing part | connecting a context marker (`since`, `yet`, `right now`) to a form |

`fix` prefills the input with the stem on purpose: finding an error and retyping a
whole sentence are two different tasks, and only the first one is the exercise.

Not implemented, deliberately: free production from a Russian prompt (needs
self-assessment, which conflicts with §5), multiple choice (a distractor that differs
only in form can be answered without understanding).

## 4. Content rules, both from the brief

- **No theory on screen.** The grammar label (`Present Perfect`) is always visible and
  is a link to `docs/grammar-map.md#<slug>`, so every form has a name and a place to
  go read about it later.
- **Hints explain WHY, not WHAT.** `hint_ru` is required on every item; the importer
  rejects an item without one, because an unexplained correction teaches the answer
  instead of the rule.

## 5. Rating is derived, never asked for

Vocabulary asks "did you know it" because only the learner can know. Grammar does not:
whether a sentence is correct is objectively checkable, so asking for a self-rating on
top of a check would be inventing noise.

```
errors = items answered wrong on the FIRST attempt
hints  = items where the hint was revealed before answering

errors == 0 && hints == 0  ->  4  Легко
errors == 0                ->  3  Помню          <- the hint cap
errors * 3 <= total        ->  2  С трудом
otherwise                  ->  1  Не помню
```

The hint cap exists so the scheduler cannot be lied to: without it a hinted answer is
indistinguishable from a known one, and the interval grows on borrowed knowledge.
`test/grammar-server.test.mjs` asserts no combination of hints alone can reach 4.

Wrongly answered items are **re-asked at the end of the round**. The second attempt
does not change the recorded result — the corrective repetition is for the learner, and
letting it erase the mistake would defeat the paragraph above.

## 6. Where the answer is checked, and why there

`app/answer.js` — on the client. Checking on the server would put a 400–1500 ms round
trip between typing and knowing, which is the latency this whole architecture exists to
avoid.

The client therefore sends **facts, not verdicts**: `{item_id, correct, hint_used}`.
The rating is derived server-side from those facts, so the rule has exactly one
implementation. The trust boundary is real and accepted: a single-user system where the
user is the only party who could gain from cheating, and the answer is on the screen
anyway.

Canonicalisation makes contractions, case and punctuation irrelevant, so only grammar
decides. `'s` and `'d` are expanded only after a closed list of hosts (`he`, `she`,
`it`, `that`, `there`, …) so that `the guest's folio` is not mangled into
`the guest is folio`. Genuine variants go in `answer` separated by `||`.

Known limit: a possessive after a noun outside that host list is compared literally.
Acceptable, and asserted rather than left to be discovered.

## 7. Transport and modes

One GET (`?action=grammar`) returns the whole block: every pattern with its due state,
item pools for everything playable, and the scheduler's queue for today. Pools are sent
for patterns that are *not* due as well, because choosing a pattern by hand is a
first-class mode and must not cost a round trip. Offline support falls out for free.

| mode | queue |
|---|---|
| Вперемешку | due patterns first, then new ones up to `grammar_daily_new_target` |
| Конкретный шаблон | that pattern only, ignoring the schedule |

Picking a pattern by hand applies FSRS normally. An early review is not a special case:
retrievability is high, so the stability gain is small — which is the correct answer,
not a workaround.

One POST (`{action: 'grammar_flush'}`) sends the rounds. Idempotency reuses
`flush_log`, so a batch replayed after the 302 redirect is recognised. Grammar keeps a
separate localStorage buffer and batch id from vocabulary, so one duplicate check can
never swallow the other.

## 8. Settings

| key | default | note |
|---|---|---|
| `grammar_daily_new_target` | 1 | a pattern is not a word: it stays in rotation for weeks |
| `grammar_desired_retention` | 0.9 | higher than vocabulary's 0.85 — few patterns, and a rule remembered 85% of the time is unusable in speech |
| `grammar_items_per_round` | 3 | one sentence is too thin to judge a rule |
| `grammar_session_cap` | 8 | 8 patterns × 3 sentences is the ceiling for one sitting |

## 9. Import

`grammar_inbox` is flat and denormalised — pattern metadata repeats on every row — so a
generated TSV is pasteable in one go and the pattern row is created on first sight.
Columns: see `GRAMMAR_IMPORT_COLUMNS` in `gas/Config.gs`. Generation prompt:
`kb/prompts/grammar.md`.

The seeded corpus is routed through the same importer rather than written straight into
`grammar_items`, which is how a broken hand-written item fails loudly instead of quietly
becoming an unsolvable exercise. That paid for itself immediately: the first run found
that the dedupe key ignored `stem`, so two different gap-fills sharing the answer `the`
were treated as duplicates.

Validation rejects, with the reason written to `grammar_rejects`:

- pattern metadata missing, or `pattern_id` not `lower_snake_case`
- `kind` outside `VALID_KINDS`
- empty `answer` or empty `hint_ru`
- `scramble` whose tokens do not assemble into the answer, or with fewer than three
  tokens, or without a Russian meaning (without it, it is a word puzzle)
- `gapfill` whose stem has no `___`
- `transform` / `fix` whose stem already equals the answer — nothing to do
- `tokens` present on a kind that does not show them

`test/grammar-import.test.mjs` additionally checks every seeded item **end to end**:
its canonical answer must be accepted by the real client checker, and for `fix` and
`transform` the stem must be *rejected* by it. Structural validation alone cannot see
an exercise that has no correct answer.
