<div align="center">

# MathAcademy Digital Campus

**A multi-tenant Student Information System — running a real academy.**

Students, groups, grades, attendance, timetables, discipline, dormitories, meals, billing and parent access — for many institutions on one deployment, with each institution's data fully isolated from the rest.

[![Multi-tenant](https://img.shields.io/badge/architecture-multi--tenant-6E56CF?style=flat-square)](#multi-tenancy)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.3-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Multi-tenancy](#multi-tenancy) · [Domain](#what-it-actually-does) · [Architecture](#architecture) · [Getting started](#getting-started) · [Security](#security)

</div>

---

## Why this project is not a demo

Most portfolio projects model a domain from the outside. This one was built for the academy its author attended, and it is in daily use by staff and parents. That shows up in the commit history more than anywhere else:

```
fix: guardian login format mismatch — split on first dash, allow MA-XXXX loginId
fix: guardian timetable shows period number when startsAt is null
fix: timetable grid and list when lessons have no startsAt/endsAt
fix: production bugs — timetable dayOfWeek coercion, billing fields, CSV limit
```

Nobody writes those commits from a specification. They come from a parent who could not log in, and a timetable that rendered wrong for lessons scheduled by period instead of by clock time. **The edge cases in this codebase were found by users, not imagined.**

| | |
|---|---|
| **69** database models | **28** feature modules |
| **37** controllers · **32** services · **128** DTOs | **48** UI pages (36 staff · 12 guardian) |
| **62,800** lines of TypeScript | **51** commits |

---

## Multi-tenancy

This is the architectural centre of the project, so it goes first.

One deployment serves many institutions. Every tenant-scoped table carries a `tenant_id`, and the tenant is resolved from the authenticated user's JWT — never from a client-supplied parameter.

```
Tenant A (mathacademy)     ──► its own students, groups, grades, invoices
Tenant B (another-school)  ──► fully isolated — different rows, same tables
```

**29 of 30 services scope every query by `tenant_id`.** The one that does not is `tenants.service.ts`, which manages the tenants themselves and is deliberately global.

Requests carry the tenant implicitly:

```ts
// The tenant comes from the verified JWT, never from the request body or query.
const tenant_id = toBigInt(args.tenantId, 'tenantId');

const students = await this.prisma.students.findMany({
  where: { tenant_id, group_id },   // ← every query, without exception
});
```

**Identifiers are `BigInt`, not `number`.** A 64-bit primary key does not survive `JSON.parse` — JavaScript silently loses precision past 2⁵³. The project handles this explicitly rather than hoping IDs stay small:

- `parse-bigint.pipe.ts` — converts route params at the edge
- `is-bigint-string.decorator.ts` — validates BigInt-shaped strings in DTOs
- `bigint.util.ts` — a single conversion path with a single failure mode

### Known limitation — stated honestly

Tenant scoping is currently applied **by hand at every call site**: 121 `findMany` and 55 `findUnique` calls, each remembering to include `tenant_id`. That is 176 chances to forget, and one forgotten filter is one school reading another's data.

A `withTenantCondition()` helper exists in `common/utils/tenant.util.ts` — it injects `tenant_id` automatically and rejects mismatches — but **it is not yet wired into the services**. Moving the guarantee from discipline to structure (a Prisma client extension that scopes every query at the data layer) is the next piece of work. See [Roadmap](#roadmap).

---

## What it actually does

### Academic

- **Students** — full profile, group assignment, avatars, and a per-student page pulling together grades, attendance, discipline and payment history
- **Groups, academic years, subjects, tracks, cohorts** — the structural backbone; tracks bind subjects to a student's stream, cohorts group students across groups (applicants, high-achievers, …)
- **Assessments** — `REGULAR`, `BLOCK_TEST`, `MOCK_EXAM`, `FINAL`. Block tests use a 189-point scheme (mathematics + English + required subjects) with subjects auto-filtered by the student's group
- **Ranking** — per-group standings and a score matrix
- **Certificates** — IELTS, SAT, olympiad and admission outcomes (`EARLY_ADMITTED`, `ON_TIME_ADMITTED`, `NOT_ADMITTED`)

### Attendance & timetable

- **Timetable** — weekly grid and list views; lessons may be scheduled by clock time *or* by period number, and both render correctly
- **Attendance** — marked directly from the timetable, filterable by session, group and date

### Discipline

- **Violations** and **discipline actions** with status tracking
- **Leave requests** — excused and unexcused absence

### Finance

- **Invoices and payments** — obligations, due dates, cash / card / transfer
- **Billing** — monthly revenue charts and statistics
- **Dormitory and meal billing** — separate charge streams with their own payment announcements

### Campus operations

- **Dormitories** — buildings, rooms, and gender-aware room placement
- **Campuses** — physical locations with map integration
- **Displays** — playlist-driven content for information screens around the building

### Communication

- **Events** with participant lists · **Announcements** targeted at staff, students or guardians · **Notifications** with per-user preferences and templates · **Awards** · **Competitions** with entries and results

### Guardian portal

Twelve pages giving parents exactly what they ask the front desk for: dashboard, student profile, grades, attendance, discipline, payments, events, timetable, certificates, announcements and notifications.

Guardians authenticate with `<tenant-slug>-<student-id>` — for example `mathacademy-MA-0001`. That format is why one of the fixes above exists: splitting on the *first* dash rather than the last.

---

## Architecture

```
mathacademy/
├── apps/
│   ├── api/                        NestJS 11
│   │   ├── prisma/
│   │   │   ├── schema.prisma       69 models
│   │   │   ├── migrations/         real migrations — never `db push`
│   │   │   └── seed.ts             demo data (guarded — see Security)
│   │   └── src/
│   │       ├── modules/            28 feature modules
│   │       └── common/
│   │           ├── guards/         access · roles · perms
│   │           ├── pipes/          parse-bigint
│   │           ├── decorators/     @Roles · @Perms · @ParamBigInt
│   │           ├── filters/        all-exceptions
│   │           ├── utils/          tenant · bigint · audit · prisma-error
│   │           └── config/         env.validation
│   └── web/                        React 18 + Vite
│       └── src/
│           ├── pages/staff/        36 pages
│           ├── pages/guardian/     12 pages
│           ├── components/shared/  DataTable · SlideOver · StatCard · StatusBadge
│           ├── hooks/              useCrud · useAuth
│           └── lib/                api · auth · utils
└── render.yaml
```

### Migrations, not `db push`

The schema is versioned in `prisma/migrations/`. Deployment runs `prisma migrate deploy`; the database is never mutated by a framework guessing at the diff. This matters once a system holds real student records.

### RBAC beyond roles

Roles alone cannot express *"a teacher may enter grades, but only for their own groups."* The `rbac` module separates **permissions**, **roles** and **user-roles**, so permission sets are data rather than code — an administrator composes new roles from the panel without a deploy.

```
superadmin   → everything
admin        → management, minus destructive operations
teacher      → their own groups: grades, attendance
receptionist → students and payments (read / create)
accountant   → finance modules
```

### The frontend avoids forty-eight variations of the same page

`useCrud` is a single hook covering pagination, search, create, update and delete; `DataTable` renders any list with search and custom cells; `SlideOver` hosts every create/edit form. Forty-eight pages exist because the domain has forty-eight things in it — not because forty-eight pages were written by hand.

---

## Tech stack

| Backend | | Frontend | |
|---|---|---|---|
| NestJS | 11 | React | 18.3 |
| Prisma | 7.3 | Vite | 5.4 |
| PostgreSQL | 15+ | TypeScript | 5.7 |
| Redis | 7+ | Tailwind CSS | 3.4 |
| JWT (access + refresh) | — | shadcn/ui (Radix) | — |
| bcrypt | 6.0 | TanStack Query | 5.83 |
| Swagger / OpenAPI | 11.2 | Recharts · Framer Motion | — |
| class-validator | — | Zod · dayjs | — |

Redis is used for caching, session storage and **authentication locks** — repeated failed logins lock the account rather than merely slowing it down.

---

## Getting started

**Requirements:** Node 18+ · PostgreSQL 15+ · Redis 7+

```bash
git clone https://github.com/Sarvarbek0704/mathacademy.git
cd mathacademy
npm install
```

**API**

```bash
cd apps/api
cp .env.example .env          # fill in DATABASE_URL, Redis, JWT secrets
npx prisma migrate deploy
npm run seed                  # demo data — local only, see Security
```

**Web**

```bash
cd apps/web
echo "VITE_API_URL=http://localhost:4000" > .env.local
```

**Run**

```bash
npm run dev:api    # http://localhost:4000  · Swagger at /api/docs
npm run dev:web    # http://localhost:5173
```

The seed prints the logins it creates. Passwords come from `SEED_*` variables in `.env`; outside production they fall back to the documented demo values.

---

## Security

### The seed is guarded, and here is why

An earlier revision of this repository hardcoded the seed passwords **and published them in this README**, while a `seed:prod` script pointed at that same seed. Anyone reading the repository could have signed in as superadmin on a seeded production instance.

That is fixed, structurally:

1. **`NODE_ENV=production` aborts the seed** unless `ALLOW_SEED=true` is set explicitly.
2. **Passwords come from the environment.** Demo fallbacks apply outside production only; in production a missing `SEED_*` value stops the run **before the first database write**, so a partial seed is impossible.
3. **`seed:prod` no longer exists.** Deployment runs `prisma migrate deploy` and nothing else.
4. **No passwords in this README.** The seed prints logins; it does not print secrets.

The lesson is worth stating plainly: the danger was never one weak password. It was a convenience script that made that password *reachable* from a public document.

### Everything else

- **JWT** — 15-minute access, 30-day refresh, hashed at rest
- **Auth locks** — failed attempts recorded in `auth_attempts`, enforced via `auth_locks` and Redis
- **Audit log** — `audit_logs` records who changed what and when; the reason a grade or an invoice changed is answerable
- **bcrypt** — cost 12
- **Env validation** — `env.validation.ts` refuses to boot on bad configuration rather than failing in production three weeks later
- **CORS** — explicit allow-list

---

## Roadmap

An honest list of what is not done.

| | Why it matters |
|---|---|
| **Structural tenant isolation** | Move `tenant_id` injection into a Prisma client extension. Today 176 call sites each remember it by hand; one lapse leaks data between schools. Highest-value change in the project |
| **Tenant-isolation test** | *"A user from tenant A cannot read tenant B's data"* is the single test this system most needs, and it does not exist yet |
| **Test coverage** | Effectively zero. The correctness of 176 tenant-scoped queries currently rests on review alone |
| **Wire up or delete `tenant.util.ts`** | Dead code that looks like a safeguard is worse than no safeguard |

---

## License

Proprietary. Built by [Sarvarbek Sodiqov](https://github.com/Sarvarbek0704) for a working academy; published for review, not for reuse.
