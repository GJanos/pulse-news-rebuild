End-of-session sync. Execute each step fully before moving to the next. Do not skip or reorder.

**Step 1 — Simplify:**

Run `git diff HEAD` to get the full set of changed files. For each changed file, work through the following analysis in order. List every finding with `file:line` before applying any fix. Then apply fixes one at a time and verify the typecheck passes after each.

1. **Dead code** — unused variables, imports, branches, or parameters that can never be reached. Delete them.
2. **Duplication** — identical or near-identical logic repeated across two or more sites. Extract to a shared helper only if it is called from at least two places and the name adds clarity.
3. **Unnecessary complexity** — conditionals that can be collapsed, intermediate variables that add no clarity, async/await on calls that are now synchronous, Promise chains that can be flattened.
4. **Bloated function scope** — functions that do more than one thing ("and" in the description). Split only when the pieces are independently testable or reused.
5. **Naming** — variables, functions, or types whose names describe implementation instead of intent. Rename to state what the thing is or does, not how.
6. **Stale comments** — comments that describe what the code does (redundant with the code), reference old behaviour, or are commented-out blocks. Delete them. Keep only comments that explain a non-obvious WHY.

If a finding would change observable behaviour, skip it and note it in the devlog instead.

**Step 2 — Devlog:**
Read `.claude/commands/sync-devlog.md` and execute it.

**Step 3 — README:**
Read `.claude/commands/sync-readme.md` and execute it.

**Step 4 — Commit and push:**
Read `.claude/commands/sync-repo.md` and execute it.
