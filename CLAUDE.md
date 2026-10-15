## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Subagent orchestration (always graph it out)

- Default to a subagent graph for non-trivial work: decompose into a DAG, fan-out independent branches, fan-in merge here. Direct reads only for 1–3 known files.
- `Skill` tool = in-session skill; `subagent` = parallel read-only fan-out (`explore`, or `general` only if the branch must write/run). Skill routing above still decides *what*; this section decides *how* (parallel graph vs inline).
- Parallel = multiple `subagent` calls in ONE message, max 3–5 branches. Reads fan out, writes serialize — one writer per file set, parent merges.
- Every subagent prompt: goal + file scope + write-policy + return format (`file:line` + summary). Repeat constraints; subagents don't nest.
