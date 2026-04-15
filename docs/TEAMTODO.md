# Team TODO

Shared task tracker for the team and AI assistants (Claude Code, OpenClaw, etc.).
Check this file at the start of every session. Update it as you complete or discover work.

## Format

```
- [ ] <task> — @<owner> — <priority> — <date added>
- [x] <task> — @<owner> — <priority> — <date completed>
```

Owners: @ozan, @serkan, @claude-code, @openclaw, @anyone
Priority: P0 (blocking), P1 (important), P2 (nice to have)

---

## Blocking / P0

- [ ] Enable Cloudflare Containers on new account (probeousdidontas@gmail.com) — sandbox worker deploy fails with "Unauthorized" at container push step. May require Workers Paid plan upgrade. — @ozan — P0 — 2026-04-15

## Important / P1

- [ ] Deploy sandbox worker to staging after Containers is enabled — @anyone — P1 — 2026-04-15
- [ ] Deploy production frontend (aws-optimizer-web-prod) to new Cloudflare account — @anyone — P1 — 2026-04-15
- [ ] Set up Convex production deployment (currently only dev:quirky-sparrow-76) — @anyone — P1 — 2026-04-15

## Nice to Have / P2

- [ ] Configure custom domain (app.awsoptimizer.com) in wrangler.jsonc production env — @anyone — P2 — 2026-04-15
- [ ] Update worker.test.ts hardcoded Convex URLs from zealous-chipmunk-626 to quirky-sparrow-76 — @anyone — P2 — 2026-04-15

## Completed

- [x] Migrate Cloudflare account from ozan.turksever@gmail.com to probeousdidontas@gmail.com — @claude-code — 2026-04-15
- [x] Migrate Convex from zealous-chipmunk-626 to quirky-sparrow-76 — @claude-code — 2026-04-15
- [x] Import data from old Convex snapshot — @claude-code — 2026-04-15
- [x] Deploy staging frontend to new account — @claude-code — 2026-04-15
- [x] Update shared dev box (100.119.161.97) with new credentials and config — @claude-code — 2026-04-15
- [x] Validate login works on staging — @claude-code — 2026-04-15
- [x] Document production environment in docs/prod.txt — @claude-code — 2026-04-15
