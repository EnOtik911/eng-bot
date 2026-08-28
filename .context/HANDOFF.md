# HANDOFF — Active Task

> Reset at the start of each new task. Holds ONLY the current plan table, settled
> decisions, and verification evidence BY REFERENCE (paths/commands — never pasted
> diffs, logs, or file contents). Compaction trigger: ~60 lines mid-task.
> The orchestrator alone records verification evidence and marks rows VERIFIED (RULE 4b).

## Plan table

| # | Subtask | Owner agent | Why this agent | Receives (handoff payload) | Depends on | Wave | Status |
|---|---------|-------------|----------------|---------------------------|------------|------|--------|

## Settled decisions (do not re-litigate)

<!-- Line format: -->
<!-- - <decision> — <one line why> — <where fixed: ADR-xx / file:line> -->
<!-- Example: - Use Postgres over Mongo for primary store — need relational
     integrity across orders/invoices — ADR-03 -->

## Verification evidence (by reference only)

<!-- - <what was verified> — <exact command run> — <artifact path:line> -->

- T-000 PROJECT.md within 150-line cap — `wc -l .context/PROJECT.md` -> 83 — .context/PROJECT.md
- T-000 ToC line ranges match real section offsets — `grep -n '^## ' .context/PROJECT.md` reconciled against table at .context/PROJECT.md:8-16 — all 7 sections exact
- T-000 no volatile absolute paths stored as values (RULE 5) — `grep -n '/Users/' .context/PROJECT.md` -> no match — .context/PROJECT.md:50-53 store reproducing commands instead
- T-000 empty-project ground truth, no invented stack — `ls -la` + `git rev-parse --is-inside-work-tree` (-> fatal: not a git repository) — .context/PROJECT.md:20-29

## HANDOFF

**From:** [agent name]
**To:** [agent name or ALL]
**Task:** [what was done]
**Results:** [file paths, key outputs]
**Input for next:** [exactly what to take and from where]
**Assumptions:** [what was assumed, what may be wrong]
**Blockers:** [what to watch out for]

## Resume instruction

<!-- Next actionable step + exact resume command. Resume only from the last VERIFIED wave. -->

---

*(No active task. Project initialized 2026-08-28 via /ai-team-v7:team-init.)*
