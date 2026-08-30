# CHANGELOG — machine index. Append-only, ONE line per completed task.
# Schema (5 fields, hard cap 200 chars per entry):
# date | task-id | agents-used | outcome | verify-ref
# Example: 2026-08-11 | TX-time-backfill | backend-builder,test-engineer | 968 rows backfilled, idempotent | HANDOFF.md#verification-evidence

2026-08-28 | T-000-team-init | orchestrator,project-architect | .context scaffold + PROJECT.md skeleton (empty repo) | .context/HANDOFF.md#verification-evidence
2026-08-28 | T-001-discovery | orchestrator | 13 questions, diagnosis revised twice by owner; GATE 1 approved | .lavish/discovery.html
2026-08-28 | T-002-gate2-spec | orchestrator | schema, FSM, API contract, deploy steps; GATE 2 approved | .lavish/discovery.html
2026-08-28 | T-003-implementation | orchestrator | 17 source files, 40 assertions green, 3 real defects found by tests | ./test/run-all.sh
2026-08-28 | T-006-grammar-block | orchestrator | grammar block: 8 patterns/96 items, 4 kinds, derived rating; 145 assertions green | .context/HANDOFF.md:44
2026-08-28 | T-007-visual-fix | orchestrator | white-on-white from themeParams override; 4th glass, refraction, decor; 160 assertions | .context/HANDOFF.md:24
2026-08-28 | T-008-motion | orchestrator | spring/FLIP/decor without libraries; glass-per-row defect found; 161 assertions | .context/HANDOFF.md:24
2026-08-30 | T-009-bank | orchestrator | ping covers grammar, diagnostics, 303-unit bank, one-click loader | .context/HANDOFF.md:24
