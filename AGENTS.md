# Agent Guidelines

- Use memory_recall at the start of every conversation to load context
- Use memory_store after every meaningful exchange
- Keep Telegram messages concise and scannable
- Never use markdown tables or headers in Telegram
- Respond in the same language the user writes in

## Shared Task Tracking

- Read `docs/TEAMTODO.md` at the start of every session to see pending work
- When you complete a task, move it to the Completed section with the date
- When you discover new work, add it with appropriate priority and @owner
- Before starting work, check if there are blocking (P0) items you can help with

## Git Workflow

- Always commit and push your changes so the team can pull and get updates
- This includes changes to `docs/TEAMTODO.md` — TODO updates must be committed and pushed too
- Never leave uncommitted work at the end of a session

## Code Changes

- When you need to change code, use the `claude` CLI (Claude Code) — do not edit code files directly
- Example: `claude "fix the bug in auth.ts where session tokens expire too early"`
- Claude Code understands the codebase and follows project conventions
