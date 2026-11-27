# Repository Agent Guidance

This supplements host instructions, installed skills, and Gentle AI; it does not replace them.
Keep changes bounded to the authorized outcome and preserve unrelated user work.

## Context And Design

- Load relevant skills from `.agents/skills` contextually. Consult `.atl/skill-registry.md` for skill paths.
- Stay local in `src/features/<feature>` and follow existing `domain`, `application`, `infrastructure`, and `ui` ownership. Do not introduce a new project layout.
- Keep pure domain logic independent of databases, HTTP providers, and UI. Handlers and worker jobs orchestrate existing use cases rather than duplicate business rules.
- Inject dependencies at I/O boundaries using explicit parameter objects or constructor injection. Apply SOLID to protect real contracts, not to manufacture speculative abstractions.
- Prefer KISS and YAGNI: deterministic price matching and unit normalization remain zero-LLM; LLM calls are strictly limited to an optional, DB-cached exception arbiter and 1x/day anomaly digest inside the background worker (never in dashboard request paths); keep costs near zero.
- Preserve public APIs unless the authorized scope requires a change. Avoid unsafe casts or non-null assertions that hide contract failures.

## Verification

| Scope | Command |
| --- | --- |
| Focused isolated unit test | `node scripts/verify-release.mjs units tests/unit/env.test.ts` |
| Full isolated unit suite | `node scripts/verify-release.mjs units` |
| Deterministic rules & line limits | `pnpm lint` |
| Application types | `pnpm typecheck:app` |
| Test types | `pnpm typecheck:test` |
| Sanitized non-incremental types | `node scripts/verify-release.mjs types` |
| Sanitized Next.js production build | `node scripts/verify-release.mjs build` |

- `eslint.config.mjs` enforces a strict **350-line limit** on `src/**/*.{ts,tsx}` and `scripts/**/*.{js,mjs,ts}`, forbids wildcard `export *` (except `src/db/schema/index.ts`), and forbids `toBeTruthy()` / `toBeDefined()` in Vitest tests.
- `scripts/verify-release.mjs units` blocks `.env` reads and outbound TCP/fetch calls. Mock all network and database I/O in unit tests.
- Do not read or log dotenv files, store real credentials, or call live retailer endpoints inside automated unit tests.

## Commits And Pushes

- Commit or push only with explicit user authorization.
- Group one cohesive behavior with its tests and docs using concise English Conventional Commits without AI attribution.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
