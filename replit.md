# Stellar Venture Atlas (Starfield)

A collaborative strategy game for companies: navigate from your North Star (mission) to concrete milestones, tasks, risks, KPIs, and crew on Earth. Dark starry UI, bilingual (EN/中文), fully type-safe API.

## Run & Operate (Local / Outside Replit)

**Prerequisites**
- pnpm (this is a pnpm workspace)
- PostgreSQL (local, Docker, Neon, Supabase, Render Postgres, etc.)

**One-time setup**
```bash
cd Stellar-Venture-Atlas
pnpm install
```

**Required environment**
Create a `.env` or export:
```
DATABASE_URL=postgres://user:pass@localhost:5432/starfield
# Optional overrides
PORT=5000          # API (default 5000)
PORT=5173          # when running web (default 5173 for Vite)
BASE_PATH=/        # for the web app (default /)
# When frontend and API are on different origins in prod:
# VITE_API_BASE_URL=https://your-api.example.com
```

**Run (two terminals recommended)**
```bash
# Terminal 1 - API (Express on 5000)
pnpm dev:api

# Terminal 2 - Frontend (Vite on 5173, proxies /api to backend)
pnpm dev:web
```

Then open http://localhost:5173

**Database**
```bash
# After setting DATABASE_URL, create tables (dev)
pnpm db:push
```

**Other useful commands**
- `pnpm build` — typecheck + build everything
- `pnpm codegen` — re-run Orval from openapi.yaml (updates generated clients)
- `pnpm typecheck`
- Single-service production mode (API serves built frontend too):
  1. `pnpm --filter @workspace/starfield run build`
  2. `SERVE_FRONTEND=1 pnpm --filter @workspace/api-server run start`

## Original Replit Commands (kept for reference)

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
