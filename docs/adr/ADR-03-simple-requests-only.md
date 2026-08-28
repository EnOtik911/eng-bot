# ADR-03 — Only "simple" cross-origin requests to the backend

**Date:** 2026-08-28
**Status:** accepted

## Context

The Mini App is served from `github.io`; the backend is an Apps Script Web App on
`script.google.com`. That is cross-origin, so the browser applies CORS.

Apps Script exposes only `doGet` and `doPost`. It does not answer `OPTIONS` at all.
A preflighted request therefore fails before it reaches our code, and no header set in
`doPost` can fix it — the failure happens on a request we never see.

## Decision

The client may only ever issue requests that the Fetch spec classifies as *simple*:

- method `GET` or `POST`;
- no custom request headers;
- `Content-Type` restricted to `text/plain` (JSON travels as a plain-text body).

Codified in `app/api.js`, with the reason stated at the top of the file.

## Alternatives considered

- **`application/json` plus CORS headers in `doPost`.** Does not work: it triggers
  preflight, which Apps Script drops.
- **A proxy in front of Apps Script** (for example a Cloudflare Worker). Would remove
  the restriction entirely and cost nothing in money. Rejected for now: it adds a
  second platform to the stack for convenience rather than necessity. This is the
  first thing to reach for if the constraint ever becomes painful.
- **`GET` with everything in the query string.** Works, but a batch of ratings does
  not belong in a URL.

## Consequences

- Auth data travels in the body or query, never in an `Authorization` header.
- Any future contributor adding a header will break the app with an error message
  that points at CORS and not at the cause. Hence this ADR and the comment in `api.js`.
- Apps Script answers `POST` with a 302 to `script.googleusercontent.com`; `fetch`
  follows it and the final response carries `Access-Control-Allow-Origin: *`.
  `redirect: 'follow'` is therefore required, and is set explicitly.
