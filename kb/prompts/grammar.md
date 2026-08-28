# Generation prompt — grammar items

Paste the output into the `grammar_inbox` sheet, then run the menu item
«Импортировать грамматику». Rejected rows land on `grammar_rejects` with a reason —
fix and re-paste those, do not weaken the rules.

Read `docs/spec-grammar.md` §3 and §9 before changing anything here.

---

## Prompt

Generate exercise items for ONE English grammar pattern, as TSV, no header row.

Columns, in this exact order, tab-separated:

```
pattern_id  order_index  label  title_ru  notes_slug  kind  prompt_ru  stem  answer  tokens  hint_ru
```

Pattern metadata (`pattern_id`, `order_index`, `label`, `title_ru`, `notes_slug`) is
identical on every row of the batch.

- `pattern_id` — lower_snake_case, e.g. `past_perfect`
- `order_index` — integer from the roadmap in `docs/grammar-map.md`
- `label` — the grammar name shown on every screen, in English, standard terminology
  so it can be looked up: `Past Perfect`, `Conditionals 2 / 3`
- `title_ru` — the specific slice, in Russian, short: `до другого события в прошлом`
- `notes_slug` — kebab-case, matches the anchor in `docs/grammar-map.md`

### Kinds — produce at least three of each, twelve rows minimum

**`scramble`** — assemble the sentence from tiles.
`prompt_ru` = the Russian meaning (REQUIRED — without it this is a word puzzle, not an
exercise). `stem` empty. `tokens` = the words in correct order, `|`-separated, no
punctuation, at least 3. `answer` = the full sentence with punctuation.
The tokens joined by spaces must equal the answer ignoring case and punctuation.

**`transform`** — restate in another form.
`prompt_ru` = the target, REQUIRED, e.g. `→ Present Perfect`, `→ вопрос`, `→ отрицание`.
`stem` = the source sentence. `answer` = the result. They must differ.

**`fix`** — one typical error to find and correct.
`stem` = the wrong sentence. `answer` = the corrected one. `prompt_ru` may be empty.
The error must be one a Russian speaker actually makes — a calque, a dropped auxiliary,
a wrong tense choice — not a typo.

**`gapfill`** — one gap.
`stem` contains exactly one `___`, optionally with the verb in brackets:
`I ___ (live) here since 2019.` `answer` = only what goes in the gap. `prompt_ru` may
be empty. Never two gaps in one item.

### Rules that the importer enforces — violating them wastes the batch

1. `hint_ru` is REQUIRED on every row. It explains **why**, never restates the answer.
   Mark the form under discussion in backticks: `` `since` требует Present Perfect,
   потому что действие началось в прошлом и продолжается``.
2. `answer` never contains `___`.
3. `tokens` only on `scramble`, and always on `scramble`.
4. Genuine alternatives go in `answer` separated by `||`, full form first:
   `I have not seen it.||I haven't seen it.` Do not list contraction variants that
   differ ONLY by an apostrophe — the checker already accepts those.
5. Two rows in one pattern may share a short answer (`the`, `is`) as long as the stems
   differ.

### Content
Sentences come from the learner's actual work: kicksharing operations and metrics
(fleet utilization, idle vehicle, rate plan, promo redemption, attribution window),
hotel PMS (guest folio, room inventory, channel manager, no-show policy), and product /
business-analyst work (gather requirements, align on scope, edge case, roll out,
push back on a deadline, take ownership of).

Keep sentences short — 6 to 12 words. Vary the subject across persons and numbers,
because third-person agreement is half of what is being trained.

### Self-check before you output
For every row, ask: can this be answered correctly WITHOUT understanding the rule? If
yes, the item is mechanical — rewrite it so the choice depends on meaning. That is the
single largest difference between a drill that transfers into speech and one that does not.
