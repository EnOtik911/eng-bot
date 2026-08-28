# ADR-02 — FSRS-6 with default parameters, desired retention 0.85

**Date:** 2026-08-28
**Status:** accepted

## Context

The trainer needs a scheduler. Candidates: Leitner boxes, SM-2, FSRS, or a simplified
variant. Constraints: runs inside Apps Script (no dependencies), small daily volume,
irregular usage, and the owner previously abandoned Anki — so review economy matters
more than theoretical accuracy.

## Decision

FSRS-6 with the published default weights, no optimizer. `desired_retention` lives in
the `settings` sheet, default `0.85`.

## Alternatives considered

- **Leitner.** Fixed boxes, no per-card adaptation. Two cards in the same box get the
  same interval regardless of history. Simplest to build, worst review economy.
- **SM-2.** Battle-tested, but its ease factor is a permanent penalty, and it needs
  hand-tuned parameters to reach the same retention.
- **FSRS with a personal optimizer.** Better still, but the optimizer needs a review
  history that does not exist yet, and training it inside Apps Script is not realistic.

## Consequences

- ~180 lines of pure arithmetic, zero dependencies, testable without Sheets.
- Storage cost identical to SM-2: stability, difficulty, reps, lapses, due.
- `desired_retention` becomes the single tunable that controls daily load, changeable
  without a deploy. Measured: 0.85 gives roughly 25% fewer reviews than 0.90.
- Default weights are constants we cannot verify by reasoning, only against the
  reference implementation. `test/fsrs.test.mjs` pins them with golden values so a
  typo cannot pass silently.
- Revisit the optimizer after ~1000 rows in `review_log`.
