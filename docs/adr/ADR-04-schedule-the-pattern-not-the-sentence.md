# ADR-04 — Grammar schedules the pattern, not the sentence

Date: 2026-08-28
Status: accepted, implemented in v0.6.0

## Context

The vocabulary block schedules a card, and a card *is* its content: the thing being
learned is that word, so identifying the scheduling unit with the content is correct
there.

The grammar block needs a scheduling unit too, and the obvious move is to copy the
vocabulary schema: one row per exercise, FSRS state on the row. It is obvious, it
reuses everything, and it is wrong.

A grammar exercise is an instance of a rule. If the scheduler owns the instance, then
`I have worked at JET Sharing since 2023.` returns on schedule and gets answered from
memory of that sentence. Nothing in the data distinguishes that from having learned the
rule: the ratings are good, stability grows, intervals lengthen. The failure is silent
and the metrics actively conceal it — which is worse than an obvious failure, because
there is no signal to act on.

## Decision

FSRS state lives on the **pattern**. Exercise sentences live in a separate pool and
carry no scheduling state, only `serve_count` and `last_served`.

A review of a pattern is a **round** of `grammar_items_per_round` sentences (default 3),
drawn least-served-first with the cursor wrapping around the pool. A pattern drilled
twice in a row therefore uses different sentences.

Consequences that follow and were accepted deliberately:

- The rating cannot be self-reported per sentence; it is derived from the round
  (see §5 of `docs/spec-grammar.md`). Grammar answers are objectively checkable, so
  this is a gain, not a compromise.
- A pattern with an empty pool is not playable and is filtered out of both the queue
  and the picker, rather than producing an empty round.
- Content becomes the bottleneck instead of code. A pattern needs at least six
  sentences before a second round is meaningful; the corpus test enforces that floor.

## Alternatives considered

**One row per exercise, FSRS on the row** — the vocabulary schema. Rejected for the
reason above. It is cheaper in code and more expensive in the only currency that
matters here.

**FSRS on the pattern, one sentence per review.** Rejected: one sentence is too thin a
signal to move a rule's stability, and a single miss would swing the rating between
Легко and Не помню with nothing in between.

**Random sentence selection instead of a rotating cursor.** Rejected: random repeats
before the pool is exhausted, which reintroduces exactly the memorisation being avoided,
and makes the same call non-reproducible so nothing can be tested.

**Sentences generated at runtime from templates.** Rejected on a hard constraint — no
LLM calls at runtime — and on quality: a template that varies only the noun produces
mechanical drills, and mechanical drills are the thing the research says not to build.

## Consequences

The two blocks now differ in three visible ways, and each difference is downstream of
this one decision: separate settings (`grammar_*`), separate localStorage buffer and
batch id, and no rating buttons in grammar.

`gas/Fsrs.gs` was not touched. It never knew what it was scheduling, which is why a
second block could be added beside it rather than through it.
