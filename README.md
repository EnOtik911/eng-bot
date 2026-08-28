# Eng_bot

Personal English-learning system: a spaced-repetition vocabulary trainer delivered as a
Telegram Mini App, plus a plain-Markdown knowledge base.

Single user. Zero recurring cost. No self-managed servers. No LLM calls at runtime —
content is generated offline and imported as TSV.

## Layout

| Path | What lives here |
|---|---|
| `app/` | Mini App — static, served by GitHub Pages at `/app/` |
| `gas/` | Google Apps Script backend, pushed with `clasp` |
| `test/` | Runnable tests, no dependencies (`node test/fsrs.test.mjs`) |
| `data/` | Seed batches in the TSV interchange format |
| `kb/` | Knowledge base — plain Markdown, readable without any tooling |
| `docs/` | Deployment guide and ADRs |
| `.context/` | Team working memory |

## Stack

Google Apps Script Web App + Google Sheets + Telegram Mini App on GitHub Pages.
Scheduler: FSRS-6 with default parameters, desired retention configurable in the
`settings` sheet.

## Getting started

See [docs/deploy.md](docs/deploy.md) — nine steps, each with a check that proves it
worked, plus troubleshooting and the redeploy trap (`clasp push` alone does not change
what `/exec` serves).

That file is deliberately written in Russian while the rest of the documentation is in
English: it is a runbook the owner executes, not prose a reviewer reads. Commands, keys
and identifiers stay verbatim.

## Documents

| File | What it is |
|---|---|
| [docs/deploy.md](docs/deploy.md) | Deployment runbook, nine steps with a check each, plus troubleshooting |
| [docs/guide.md](docs/guide.md) | How to use the trainer: what the four ratings do, the card lifecycle, the import loop, every setting and its consequence |
| [docs/positioning.md](docs/positioning.md) | Honest comparison against Anki, Quizlet, Memrise and Clozemaster — including the nine things they do and this does not |
| [docs/adr/](docs/adr/) | Architecture decisions with alternatives and cost of being wrong |

Both `guide.md` and `deploy.md` are in Russian on purpose: they are documents the owner
executes, not prose a reviewer reads.

## Tests

```bash
node test/fsrs.test.mjs
```

No install step — the test harness reads `gas/Fsrs.gs` directly, so the scheduler has
exactly one source of truth shared by the backend and the tests.
