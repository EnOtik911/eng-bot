# ADR-01 — Allowlist array instead of a single hardcoded user id

**Date:** 2026-08-28
**Status:** accepted

## Context

The brief fixes a hard constraint: single-user system, no auth beyond verifying it is
him. The obvious reading is one constant compared against `user.id`.

During discovery the owner said he might later hand the bot to acquaintances, and left
the decision to us.

## Decision

Keep the system single-user, build no multi-tenancy — and implement the check as an
allowlist array in `ALLOWLIST` (comma-separated), with a `user_id` column on every card
row from day one.

## Alternatives considered

- **One constant.** Cheapest today. Adding a second person later means adding a column
  to a live sheet, backfilling it, and touching every query that assumes one owner.
- **Real accounts and auth.** Violates the hard constraint and solves a problem that
  does not exist.

## Consequences

- Today the cost is zero: one line instead of one line, one column with one value.
- Adding a person later is a cell edit, not a schema migration.
- The queue builder filters by `user_id` already, so the code has no hidden
  single-owner assumption to discover later.
- Risk accepted: a column that is constant for months looks like dead weight to a
  future reader. This ADR is the answer to "why is this here".
