---
name: project-eng_bot-empty-skeleton
description: Eng_bot project directory was empty (no code, no git, no manifest) when .context/PROJECT.md was first created on 2026-08-28.
metadata:
  type: project
---

As of 2026-08-28, `/Users/nikitamakarov911/Documents/Life/Eng_bot` had no source code, no
package manifest, no config files, and was not a git repository. `.context/PROJECT.md` was
created as an honest skeleton with explicit "_Not yet defined_" placeholders for stack,
architecture, and run/test commands rather than any invented content.

The directory name "Eng_bot" *suggests* an English-learning bot but this was never
verified against any spec or code — treat it as an unverified hint only, not a fact, until
a real requirements/spec artifact confirms it.

**Why:** the orchestrator explicitly required zero invention/guessing given the empty
state — a confident-sounding but fabricated PROJECT.md was called out as the failure mode
to avoid.

**How to apply:** before assuming Eng_bot's stack or purpose in any future session, verify
current state first (`ls -la`, check for manifests/git) — this memory is a point-in-time
snapshot from project init, not a guarantee the project is still empty. If code now exists,
this memory is stale and should be updated/removed in favor of what's actually in
`.context/PROJECT.md`.
