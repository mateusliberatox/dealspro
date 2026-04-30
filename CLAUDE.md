# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This git repository lives at the `Sites/` level and tracks multiple sibling projects:

```
Sites/
├── dealspro/    ← current working directory (this project)
├── techrank/    ← Next.js 16 product-ranking platform
└── xfinancas/   ← Vite + React financial SPA
```

## Sibling Project Reference

### techrank (Next.js 16 + Supabase)

Commands: `npm run dev` · `npm run build` · `npm run lint`

Stack: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Supabase, Zod, Vercel

Architecture:
- `src/app/` — App Router pages and API routes
- `src/components/` — React components grouped by domain
- `src/lib/` — Business logic: one subdirectory per domain (catalog, ranking, price, leads, ai, etc.)
- `supabase/migrations/` — DDL migrations
- Repository pattern for data access; Zod for runtime validation
- Vercel cron jobs defined in `vercel.json` (daily-ingest + rebuild-rankings)
- ISR with `revalidate = 3600` on major pages

Key env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`

### xfinancas (Vite + React SPA)

Commands: `npm run dev` · `npm run build` · `npm run lint` · `npm run test` · `npm run test:watch`

Stack: React 18, Vite 5, TypeScript 5, Tailwind CSS 3, Shadcn/ui (Radix UI), React Query, React Hook Form, Zod, Supabase, Recharts, Vitest

Architecture: SPA with React Router, React Query for server state, component-based with Shadcn/ui design system
