# Deploy

Nine steps. Each has a check that proves it worked — if the check fails, do not move on.
Everything here is reproducible from an empty Google account.

## 0. Prerequisites

- A personal Google account (not a Workspace one — an admin can block `Anyone` access
  on Web App deployments, which this design requires).
- `clasp`: `npm i -g @google/clasp`, then `clasp login`.

## 1. Spreadsheet

Create a blank spreadsheet named `Eng_bot DB`. Copy its id from the URL:
`docs.google.com/spreadsheets/d/<THIS_PART>/edit`.

**Check:** you have a 44-character id.

## 2. Bot

BotFather → `/newbot`. Keep the token.

**Check:** `curl "https://api.telegram.org/bot<TOKEN>/getMe"` returns `"ok":true` with the
bot username.

## 3. Apps Script project

```bash
cd gas
clasp create --type standalone --title "Eng_bot"
clasp push -f
```

Standalone, not container-bound: the code reads the sheet by id, so the script is not
tied to one document and the repository stays the source of truth.

**Check:** `clasp open` shows all the `.gs` files in the editor.

## 4. Script Properties

Project Settings → Script Properties. Add:

| Key | Value |
|---|---|
| `BOT_TOKEN` | from step 2 |
| `SHEET_ID` | from step 1 |
| `ALLOWLIST` | your Telegram numeric id (get it from `@userinfobot`) |

**Check:** run `selfCheck` in the editor. The log shows three `ok` lines (lengths only,
never the values) and the spreadsheet name.

Then run `setupSpreadsheet`.

**Check:** the spreadsheet now has the tabs `cards`, `settings`, `inbox`, `rejects`,
`flush_log`, `review_log_<year>`, and `settings` holds ten seeded keys.

## 5. Web App deployment

Deploy → New deployment → type **Web app**.
Execute as: **Me**. Who has access: **Anyone**.

Copy the `/exec` URL. Add it to Script Properties as `WEB_APP_URL`.

**Check:** open `<EXEC_URL>?action=ping` in a browser — you get
`{"ok":true,"pong":"…"}`. Then open `<EXEC_URL>?action=session` — you get
`{"ok":false,"code":"BAD_INIT_DATA"}`. **That failure is the success criterion:**
the endpoint is public and refuses everyone without a signature from your bot.

## 6. GitHub Pages

Push this repository to GitHub (public). Settings → Pages → Source: `main`, folder `/`
(root).

Then edit `app/config.js` and paste the `/exec` URL into `WEB_APP_URL`. Commit and push.

**Check:** `https://<user>.github.io/<repo>/app/` opens and shows «Загружаю очередь…».
Outside Telegram it will then fail with an auth message — expected, there is no initData
in a plain browser.

## 7. Mini App URL

BotFather → `/mybots` → your bot → Bot Settings → Menu Button → paste the Pages URL
from step 6. Also add it to Script Properties as `MINI_APP_URL` so the daily ping can
attach a launch button.

**Check:** the menu button in the bot opens the app and a card appears (after step 9
seeds content).

## 8. Webhook

Run `setWebhook` in the editor.

**Check:** run `menuCheckWebhook` from the spreadsheet menu, or
`curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` — `url` is filled,
`pending_update_count` is 0, no `last_error_message`. Then send `/start` to the bot;
it replies with a launch button.

## 9. Triggers and first content

Run `installTriggers`.

Then — and this cannot be done from code — open the trigger list (clock icon), and for
each trigger set **Failure notification settings → Notify me immediately**. Without it a
dead trigger stays silent until a daily summary email that is easy to miss.

Seed content: spreadsheet menu → `Eng_bot` → «Засеять стартовый батч», then
«Импортировать батч из inbox».

**Check:** the dialog reports 20 accepted, 0 rejected, 0 duplicates. The `cards` tab holds
40 rows (20 recognition in state `new`, 20 production in state `locked`). Open the Mini App
— 6 cards are offered, matching `daily_new_target`.

## Tuning afterwards

Everything below changes in the `settings` tab and takes effect on the next session,
with no deploy:

| Key | Default | Effect |
|---|---|---|
| `daily_new_target` | 6 | New cards per session |
| `desired_retention` | 0.85 | The strongest lever on daily load |
| `session_size_cap` | 120 | Hard ceiling on one session |
| `leech_threshold` | 5 | Lapses before a card is pulled out |
| `unlock_interval_days` | 21 | When a production card unlocks |
| `ping_hour` | 8 | Daily ping hour (re-run `installTriggers` after changing) |

## Tests

```bash
node test/fsrs.test.mjs
node test/session.test.mjs
node test/auth.test.mjs
node test/load-model.mjs      # not a test: prints the review-load model
```

No install step. The tests read `gas/*.gs` and `app/*.js` directly, so there is exactly
one copy of the scheduler and the auth scheme.
