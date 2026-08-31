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

- Sheets returns DATES AS Date OBJECTS from getValues(), never strings. Every
  comparison must go through dateKey_ (gas/Session.gs). String(date).slice(0,10)
  gives 'Sun Aug 28', which equals no date and sorts ABOVE any '2026-..' — it made
  `due <= today` permanently false for four months. Any new test that stubs a date
  must stub a Date object, not a string — that is how the suites missed it
- Analytics are computed server-side; the client never receives the review log
- Achievements are a pure function of the metrics, so a 30-day streak is testable
- .card carries backdrop-filter: NEVER emit that class from JS (css-perf guards it)

## Programme agreed with the owner (three waves)

| Wave | Scope | Status |
|---|---|---|
| A | UX frame: guide layout, palette, decor | DONE, verified live |
| B | Analytics: per-block + overall trend screen, /export CSV to chat | DONE, deployed @13 |
| C | Memetic achievements, black humour, Audi/aviation references | DONE, 17 achievements |

Wave A delivered only the measured defects (guide overflow, palette, decor). The owner
also asked for a coherent UX pass over the whole app — grid, typography, buttons,
screen-to-screen consistency. That was NOT done and is still open.

- Gloss lives in TWO columns on purpose: `breakdown` = which word is which,
  `note` = why it is said that way. On a review only the breakdown is wanted, so
  they must stay separable. Both are LAST in their schemas
- The gloss block is open on a card's first appearance, collapsed on review: a
  finished explanation in front of you replaces the recall a review tests
- backfillGloss (/gloss) is the only way to fill already-imported units — the
  importer rejects duplicates, so a re-import fills nothing
- Minutes shown to the user come from 8 s/card in test/load-model.mjs, the same
  measurement the daily target came from. Do not invent a different constant

## Open, not done

- Gloss content exists for 119 units (starter batch, core, social). business,
  analysis, fintech and tech have the column and no text — roughly a month of queue
  away at 10 new/day. Write them with the same two-column format.
- The broad UX pass (grid, typography, buttons, screen-to-screen consistency) is
  still untouched beyond the pace work.
- FSRS state written BEFORE the date fix used NaN elapsed days, so existing
  stability/difficulty values are suspect. The scheduler self-corrects over
  subsequent reviews; a deliberate reset was NOT done and needs the owner's call.
- The leaked bot token has still never been revoked in BotFather.

## Resume instruction

Ask the owner whether to reset the FSRS state corrupted by the date bug, then take
the UX pass. Read .context/PROJECT.md lines 66-91 first.
