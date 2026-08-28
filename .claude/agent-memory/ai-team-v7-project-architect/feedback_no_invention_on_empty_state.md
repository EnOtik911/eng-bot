---
name: feedback-no-invention-on-empty-state
description: When ground truth is empty/unknown (no code, no manifest), never infer or guess stack/purpose/architecture in PROJECT.md — write explicit "_Not yet defined_" placeholders instead.
metadata:
  type: feedback
---

When creating or updating `.context/PROJECT.md` for a project with little or no verifiable
ground truth, do not fill unknown sections (stack, architecture, run/test commands,
purpose) with plausible-sounding guesses derived from things like the directory name.
Write an explicit, visible placeholder instead, e.g.
`_Not yet defined — filled in at the first substantive task._`

**Why:** the orchestrator treated a directory name (`Eng_bot` → "looks like an
English-learning bot") as a trap for exactly this failure — a confident-sounding invented
PROJECT.md was named as the failure mode, while a skeleton with honest gaps was named as
the correct deliverable. See [[project-eng_bot-empty-skeleton]].

**How to apply:** applies to any project-architect task where PROJECT.md, ADRs, or
architecture docs are being written/updated and the directory lacks code/manifests/git to
verify claims against. Always run the verification commands (`ls -la`, `git rev-parse
--is-inside-work-tree`, check for manifests) yourself first and cite their actual output in
the Completion Report — never take the task brief's framing of "empty" or "this is
probably X" on faith without checking, and never paper over a real gap with an inference.
