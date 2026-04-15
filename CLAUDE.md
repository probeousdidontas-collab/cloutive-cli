# Cloutive CLI — Claude Code Instructions

## Task Tracking

Read `docs/TEAMTODO.md` at the start of every session. This is the shared task list across team members and AI assistants. Update it as you complete or discover work.

## Git Workflow

- Always commit and push your changes so the team can pull and get updates
- This includes changes to `docs/TEAMTODO.md` — TODO updates must be committed and pushed too
- Never leave uncommitted work at the end of a session

## Environment

- Production environment docs: `docs/prod.txt`
- Shared dev box: `ozant@100.119.161.97` (workspace: `/Users/ozant/oc-workspace-cloutiveassistantbot`)

## Project Structure

- `aws-optimizer/apps/web` — Frontend (Vite + React + Mantine, deployed to Cloudflare Workers)
- `aws-optimizer/apps/sandbox` — Sandbox worker (Cloudflare Workers + Containers)
- `aws-optimizer/packages/convex` — Backend (Convex)
