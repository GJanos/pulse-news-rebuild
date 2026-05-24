The project has four README files. Each owns its domain:

- `README.md` — top-level: architecture, decisions, pointers to subsystems
- `cron/README.md` — pipeline config, how to run, retry/URL strategy
- `app/README.md` — Expo setup, feature phases, data flow, outstanding decisions
- `supabase/README.md` — schema, RLS model, V2 additions

**Step 1 — Identify what changed**
Run `git diff HEAD` and read `DEVLOG.md` (last 1–2 entries). Note which subsystem(s) the changes touch.

**Step 2 — Route changes to the right README**

| Changed files                          | Update               |
| -------------------------------------- | -------------------- |
| `cron/**`                              | `cron/README.md`     |
| `app/**`                               | `app/README.md`      |
| `supabase/**`                          | `supabase/README.md` |
| Architecture, decisions, new subsystem | `README.md`          |
| Multiple subsystems                    | All affected READMEs |

Only touch files where something is actually wrong or missing — minimal diff is the goal.

**Step 3 — Apply these rules to each README you update**

- **Delete** anything no longer true (replaced tools, abandoned approaches, stale stubs)
- **Update** facts that have changed (new config fields, revised flow, resolved TODOs)
- **Add** only when a significant area is undocumented
- **Keep** tone: terse, factual, no marketing language
- Project structure listings must match actual files on disk
- Decisions must reflect locked-in choices only — remove entries that have since been resolved without updating
- Do not rewrite sections that are still accurate
