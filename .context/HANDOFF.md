# HANDOFF — active task

## Settled decisions (do not re-litigate)

- Practice mode never writes to the scheduler — no flush path, ever. FSRS measures an
  interval from the actual review, so an early replay recorded as real lowers the
  interval and inflates tomorrow's load — gas/Session.gs:buildPractice comment
- Practice draws only from cards already seen (not new/locked/suspended), or a new word
  enters around the daily allowance — test/practice-server.test.mjs
- last_trigger_run records DELIVERY (Telegram's ok), not intent — gas/Bot.gs:dailyPing
- Resume: the tile and the "Продолжить" button both resume, so a habitual tap cannot
  cost the position — app/ui.js:startVocab
- No icon/animation library: CDN runtime dependency against an offline-first app.
  Vendored inline SVG is the allowed form — commit 5a09b9f, T-008
- Decor is meaning, not ornament: four rings = Audi, aircraft = business jet. Owner's
  motivation. Rings must not pass through a displacement filter or they stop reading
- Palette is blue-only. Violet second stop dropped; #3566EA held only 4.37:1 as text
- Bank is loaded from the chat via /load, because the spreadsheet menu needs hands in
  the spreadsheet and `clasp run` needs a GCP project this project lacks

## Programme agreed with the owner (three waves)

| Wave | Scope | Status |
|---|---|---|
| A | UX frame: guide layout, palette, decor | DONE, verified live |
| B | Analytics: per-block + overall trend screen, /export CSV to chat | NOT STARTED |
| C | Memetic achievements, black humour, Audi/aviation references | NOT STARTED |

Wave A delivered only the measured defects (guide overflow, palette, decor). The owner
also asked for a coherent UX pass over the whole app — grid, typography, buttons,
screen-to-screen consistency. That was NOT done and is still open.

## Resume instruction

Start wave B. Analytics decision already taken: screen inside the app plus a /export
command sending CSV to the chat. Read gas/Session.gs (review_log_<year> is the source)
and .context/PROJECT.md lines 66-91 before planning.
