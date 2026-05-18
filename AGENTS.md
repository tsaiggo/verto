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

---

## Adding a New Content Source

Content lives behind the `ContentSource` interface in
`lib/content-source/`. To add a new backend (e.g. Notion, S3, Dropbox):

1. Create `lib/content-source/<name>.ts` exporting a `create<Name>Source()`
   factory that returns a `ContentSource` (see `types.ts`).
2. Implement `listFiles()` (enumerate every readable `.md`/`.mdx` file),
   `readFile(entry)` (fetch raw text by opaque `id`), and optionally
   `readOptionalFile(path)` (used to load `navigation.json`).
3. Register the source in `lib/content-source/index.ts` by adding a case
   to `pickSource()` and a matching `VERTO_CONTENT_SOURCE` value.
4. Add tests under `lib/__tests__/<name>-source.test.ts` with a mocked
   `fetch` (see the `github-source` / `onedrive-source` tests).
5. Document env vars in `README.md` → Content Sources and in `.env.example`.
