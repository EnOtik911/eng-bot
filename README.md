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
| `tech-bank/` | Study notes on the stack (Russian text, English terms) |
| `.context/` | Team working memory |

## Stack

Google Apps Script Web App + Google Sheets + Telegram Mini App on GitHub Pages.
Scheduler: FSRS-6 with default parameters, desired retention configurable in the
`settings` sheet.

## Getting started

See [docs/deploy.md](docs/deploy.md). Nine steps, each with a check that proves it worked.

## Tests

```bash
node test/fsrs.test.mjs
```

No install step — the test harness reads `gas/Fsrs.gs` directly, so the scheduler has
exactly one source of truth shared by the backend and the tests.
