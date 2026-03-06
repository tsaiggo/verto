# Git Workflow Rules for AI Agents

## Branch Protection (MANDATORY)

**NEVER commit or push directly to the `main` branch.**

Before making ANY code changes:
1. Check your current branch: `git branch --show-current`
2. If on `main`, create and switch to a new branch FIRST

## Branch Naming Convention

Use the following prefixes:
- `feat/xxx` — New features
- `fix/xxx` — Bug fixes
- `chore/xxx` — Maintenance tasks
- `docs/xxx` — Documentation changes
- `refactor/xxx` — Code refactoring

Example: `git checkout -b feat/add-user-auth`

## Pull Request Workflow

All changes MUST be merged via Pull Request:
1. Push your branch to remote: `git push -u origin <branch-name>`
2. Create a Pull Request targeting `main`
3. Use squash merge (preferred) when merging
4. **Create the PR but do NOT merge it yourself** — leave merging to the human

## Summary
- ❌ Direct commits to `main`
- ✅ Create branch → commit → push → open PR → human merges
