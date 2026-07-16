<div align="center">

# MathAcademy Digital Campus

**A multi-tenant Student Information System — running a real academy.**

Students, groups, grades, attendance, timetables, discipline, dormitories, meals, billing and parent access — for many institutions on one deployment, with each institution's data isolated from the rest by the data layer itself, not by remembering to.

[![Multi-tenant](https://img.shields.io/badge/architecture-multi--tenant-6E56CF?style=flat-square)](#multi-tenancy)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.3-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Multi-tenancy](#multi-tenancy) · [DTM scoring](#dtm-scoring) · [Domain](#what-it-does) · [Architecture](#architecture) · [Security](#security) · [Getting started](#getting-started)

</div>

> **Status.** This describes the system specified in [`docs/`](./docs) — a 30,000-line technical specification written against the working codebase. Implementation follows the [roadmap](./docs/14-roadmap.md); the specification is the contract.

---

## Why this project is not a demo

Most portfolio projects model a domain from the outside. This one was built for the academy its author attended, and it is in daily use by staff and parents. That shows up in the commit history more than anywhere else:

```
fix: guardian login format mismatch — split on first dash, allow MA-XXXX loginId
fix: guardian timetable shows period number when startsAt is null
fix: timetable grid and list when lessons have no startsAt/endsAt
fix: production bugs — timetable dayOfWeek coercion, billing fields, CSV limit
```

Four fixes in thirty-six minutes, one of them named `production bugs` outright. Nobody writes those commits from a specification. They come from a parent who could not log in, and a timetable that rendered wrong for lessons scheduled by period instead of by clock time. **The edge cases in this codebase were found by users, not imagined.**

| | |
|---|---|
| **69** database models | **28** feature modules |
| **37** controllers · **32** services · **128** DTOs | **48** UI pages (36 staff · 12 guardian) |
| **62,800** lines of TypeScript | **30,000** lines of specification |

---

## Multi-tenancy

This is the architectural centre of the project, so it goes first.

One deployment serves many institutions. Every tenant-scoped table carries a `tenant_id`, and the tenant is resolved from the authenticated user's JWT — never from a client-supplied parameter.

```
Tenant A (mathacademy)     ──► its own students, groups, grades, invoices
Tenant B (another-school)  ──► fully isolated — different rows, same tables
```

### The filter is structural, not remembered

The obvious way to build this is to write `where: { tenant_id }` in every query. That works right up until someone forgets once — and one forgotten filter is one school reading another's data.

So the filter is not written by hand. A Prisma client extension injects it at the data layer, pulling the tenant from an `AsyncLocalStorage` context established at the request boundary:

```ts
// The tenant is ambient. A query cannot be written without it.
const students = await this.prisma.students.findMany({
  where: { group_id },        // ← no tenant_id here, and none needed
});
```

**Eighteen of the sixty-nine models have no `tenant_id` of their own** — `assessment_scores`, `attendance_marks`, `timetable_lessons` and others reach the tenant through a parent row. Denormalising a `tenant_id` onto each of them would trade one class of bug for another, so the extension scopes them through the relation instead, driven by an explicit model→tenant path map. A test asserts the map covers every model, so adding a model without a path fails the build rather than silently opting out of isolation.

**Identifiers are `BigInt`, not `number`.** A 64-bit primary key does not survive `JSON.parse` — JavaScript silently loses precision past 2⁵³. IDs are serialised as strings at the boundary and converted through a single path with a single failure mode: `parse-bigint.pipe.ts`, `is-bigint-string.decorator.ts`, `bigint.util.ts`.

### What the extension does not cover — and how that is handled

An honest boundary matters more than a confident claim:

- **Raw SQL** bypasses the extension. `$queryRaw` is restricted to the ranking module, where each statement carries its tenant filter explicitly and is covered by tests.
- **Files** never pass through Prisma at all. Uploads live in object storage behind authenticated, signed URLs rather than a static directory, because a file served by `express.static` is a file served outside every guard.
- **Reaching around the service layer** (`someService['prisma']`) would defeat it. A lint rule forbids it.

See [`docs/03-multi-tenancy.md`](./docs/03-multi-tenancy.md) — including why PostgreSQL RLS was evaluated and deferred rather than dismissed.

---

## DTM scoring

The academy exists to prepare students for Uzbekistan's state university entrance exam. That exam has an exact shape, and so does the system:

```
Main subject       (MAIN)       30 questions × 3.1  =  93
Secondary subject  (SECONDARY)  30 questions × 2.1  =  63
Three mandatory    (MANDATORY)  3 × 10 × 1.1        =  33
                                                      ────
                                                       189
```

A student's track binds subjects to those roles. **A valid DTM track is exactly one main, one secondary, and three mandatory subjects — and the type system says so:**

```ts
type DtmTrack = {
  main: Subject;
  secondary: Subject;
  mandatory: [Subject, Subject, Subject];   // three. not "some".
};

function parseDtmTrack(subjects: TrackSubject[]): Result<DtmTrack, DtmTrackError>;
```

This is a parser, not a validator. An invalid track cannot be represented, so it cannot reach scoring.

**The 189 is computed server-side.** A block test's maximum is derived from the track, never accepted from the client — the API rejects a `BLOCK_TEST` that claims any other maximum. Scores are `Decimal`, never float. The rule lives in `src/core/dtm/`, a Nest-free module of pure functions with property tests asserting `0 ≤ score ≤ 189` across the full space of valid inputs.

Subject roles are read from `track_subjects.role`. They are never inferred from the order rows come back in.

---

## What it does

### Academic

- **Students** — full profile, group assignment, and a per-student page pulling together grades, attendance, discipline and payment history
- **Groups, academic years, subjects, tracks, cohorts** — the structural backbone
- **Assessments** — `WEEKLY_TEST`, `BLOCK_TEST`, `WRITTEN`, `CONTROL`, `MOCK`, with subjects filtered by the student's group
- **Ranking** — per-group standings and a score matrix, computed by one formula in one place. The live view and the historical snapshot cannot disagree, because they call the same function
- **Certificates** — IELTS, SAT, olympiad results

### Outcomes — the number the academy is actually judged on

`student_outcomes` records where each student ended up: `EARLY_ADMITTED`, `ON_TIME_ADMITTED`, `NOT_ADMITTED`, `UNKNOWN` — with institution, programme, and decision date. A year of work resolves to this table, so the column is an enum and the database enforces it.

### Risk — tracked, computed, and honest about which is which

A risk score is only useful if it can be checked. Because `student_outcomes` holds real historical results, the scoring weights are fitted against them and backtested rather than guessed:

```
past students → signals (attendance %, mean score, discipline, payment lateness)
             → known outcome (admitted / not)
             → fitted weights → precision & recall you can quote
```

Two things stay deliberately separate: the **computed** score, and a teacher's **manual** override. A teacher knows things the model cannot see. Both are stored, both are visible, and neither silently overwrites the other.

A student nobody has assessed is `NOT_ASSESSED` — not `GREEN`. "We don't know" and "this student is fine" are different answers, and a system that renders them identically is worse than one that says nothing.

### Attendance, timetable, discipline

Weekly grid and list views; lessons may be scheduled by clock time *or* by period number, and both render correctly. Attendance is marked from the timetable. Violations, discipline actions and leave requests carry status through to the guardian portal.

### Finance

- **Invoices and payments** — obligations, due dates, cash / card / transfer
- **Dormitory and meal billing** — separate charge streams with their own payment announcements and periods (dormitory monthly, meals weekly)
- **Money is `Decimal` in the database and a string at the API boundary.** `Number()` is never applied to a monetary value — a lint rule enforces it. Sums are exact, and `allocate()` distributes remainders so an instalment schedule always adds back up to the original

### Campus and communication

Dormitories with gender-aware room placement · campuses · playlist-driven information displays · events · targeted announcements · notifications with per-user preferences · awards · competitions

### Guardian portal

Twelve pages giving parents what they otherwise phone the front desk for: dashboard, profile, grades, attendance, discipline, payments, events, timetable, certificates, announcements, notifications.

Guardians sign in with an academy and a student ID as **two separate fields**. An earlier design concatenated them with a dash and split on the first one — which worked precisely as long as no academy's slug contained a dash. Two fields have no separator to get wrong.

---

## Architecture

```
mathacademy/
├── apps/
│   ├── api/                        NestJS 11
│   │   ├── prisma/
│   │   │   ├── schema.prisma       69 models
│   │   │   ├── migrations/         rebuild the database from empty — verified in CI
│   │   │   └── seed.ts             demo data (guarded — see Security)
│   │   └── src/
│   │       ├── core/               framework-free domain logic
│   │       │   ├── dtm/            189-point scoring · pure functions
│   │       │   └── money/          Decimal wrapper · allocate()
│   │       ├── modules/            28 feature modules
│   │       └── common/
│   │           ├── prisma/         client extension — tenant scoping
│   │           ├── guards/         access · roles · perms
│   │           ├── pipes/          parse-bigint
│   │           ├── decorators/     @RequirePermissions · @RequireRoles · @ParamBigInt
│   │           ├── filters/        all-exceptions
│   │           └── config/         env.validation
│   └── web/                        React 18 + Vite
│       └── src/
│           ├── pages/staff/        36 pages
│           ├── pages/guardian/     12 pages
│           ├── components/shared/  DataTable · SlideOver · StatCard · StatusBadge
│           └── hooks/              useCrud · useAuth
├── docs/                           the specification — 16 documents + 8 ADRs
└── render.yaml
```

### A modular monolith, on purpose

Twenty-eight modules, one team, one database. Splitting this into services would move the coupling into the network and buy nothing — the modules already talk through explicit boundaries, and `dependency-cruiser` fails the build if that stops being true. [ADR-0001](./docs/adr/0001-shared-database-multi-tenancy.md) records when that answer changes.

### Migrations rebuild the database

`prisma migrate deploy` reconstructs the schema from empty, and CI proves it on every commit with `migrate diff --exit-code`. A schema that has drifted from its migration history is a schema you cannot stage, test, or restore — which makes this the foundation everything else sits on rather than a chore.

### Permissions, not roles

Roles alone cannot express *"a teacher may enter grades — for their own groups."* The `rbac` module separates **permissions**, **roles** and **user-roles**, so an administrator composes new roles from the panel without a deploy. Every route declares what it needs; there are **234 such declarations and no route without one**.

Resource scope is a separate question from permission, and it is answered separately: `group_teachers` binds teachers to groups, and grade and attendance writes check that binding. A permission says what you may do; it should never be asked to say what you may do it *to*.

```
superadmin   → everything, within one tenant, audited
admin        → management, minus destructive operations
teacher      → their own groups: grades, attendance
receptionist → students and payments (read / create)
accountant   → finance modules
```

### Forty-eight pages, not forty-eight variations

`useCrud` is one hook covering pagination, search, create, update and delete; `DataTable` renders any list; `SlideOver` hosts every create/edit form. Forty-eight pages exist because the domain has forty-eight things in it. All forty-eight are lazy-loaded.

---

## Tech stack

| Backend | | Frontend | |
|---|---|---|---|
| NestJS | 11 | React | 18.3 |
| Prisma | 7.3 | Vite | 5.4 |
| PostgreSQL | 15+ | TypeScript | 5.7 |
| JWT (access + refresh) | — | Tailwind CSS | 3.4 |
| bcrypt | 6.0 | shadcn/ui (Radix) | — |
| Swagger / OpenAPI | 11.2 | TanStack Query | 5.83 |
| pino · Sentry | — | Recharts · Zod · dayjs | — |

**PostgreSQL is the only datastore**, and that is a decision rather than an omission. Sessions, auth attempts and account locks live in it (`auth_sessions`, `auth_attempts`, `auth_locks`): a lock in Postgres survives a restart and stays correct across instances, where a Redis TTL would quietly drop it. Redis earns its place when there is a second instance to share state between — not before. [ADR-0007](./docs/adr/0007-postgres-as-only-datastore.md).

---

## Testing

The correctness of a multi-tenant system rests on one claim: **a user of tenant A cannot read tenant B's data.** So that is the test that matters most, and it runs against a real PostgreSQL via Testcontainers — not a mocked Prisma, which would only prove that the mock was configured to agree.

It is parameterised across all 28 modules. Adding a module without isolation coverage fails the build. It gates the tenant-scoping work in both directions: green before the refactor (otherwise the bug already exists), green after (otherwise the refactor introduced one).

Beyond it: property tests for money (`allocate()` sums back to the original) and DTM (`0 ≤ score ≤ 189`), and a regression test for every production bug quoted at the top of this README — including the one where a guardian login was split on the wrong dash.

---

## Getting started

**Requirements:** Node 18+ · PostgreSQL 15+

```bash
git clone https://github.com/Sarvarbek0704/mathacademy.git
cd mathacademy
npm install
```

**API**

```bash
cd apps/api
cp .env.example .env          # fill in DATABASE_URL and JWT secrets
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

The seed prints the logins it creates. Passwords come from `SEED_*` variables in `.env`; outside production they fall back to documented demo values.

---

## Security

This system holds records about children — names, dates of birth, photographs, dormitory rooms, guardians' phone numbers, discipline history. The consequences of getting it wrong are not the usual SaaS consequences.

### The seed is guarded, and here is why

An earlier revision of this repository hardcoded the seed passwords **and published them in this README**, while a `seed:prod` script pointed at that same seed. Anyone reading the repository could have signed in as superadmin on a seeded production instance.

That is fixed, structurally:

1. **`NODE_ENV=production` aborts the seed** unless `ALLOW_SEED=true` is set explicitly.
2. **Passwords come from the environment.** In production a missing `SEED_*` value stops the run **before the first database write**, so a partial seed is impossible.
3. **`seed:prod` no longer exists.** Deployment runs `prisma migrate deploy` and nothing else.
4. **No passwords in this README.** The seed prints logins; it does not print secrets.

The lesson generalises, and it drove the rest of this section: the danger was never one weak password. It was a convenience script that made that password *reachable*.

### Passwords are generated, not guessed at

Account passwords come from `crypto.randomInt()`. `Math.random()` is not a CSPRNG — an attacker who observes a few outputs can reconstruct the generator's state and derive the rest, which matters a great deal when accounts are created in bulk. The same blind spot produced both this and the seed: a password policy existed; where passwords *came from* had not been asked.

### Everything else

- **JWT** — 15-minute access, 30-day refresh with rotation and reuse detection, hashed at rest. An access token cannot be revoked, so its lifetime *is* the exposure window; revocation happens at refresh, which only works while access stays short
- **Auth locks** — attempts recorded in `auth_attempts`, enforced via `auth_locks`, sessions tracked in `auth_sessions`
- **Rate limiting** — `@nestjs/throttler`, enforced. Configuration that is declared but never read is worse than no configuration, because it is believed
- **Uploads** — object storage, authenticated access, MIME validated fail-**closed**, magic bytes checked, `Content-Disposition: attachment`
- **Audit log** — `audit_logs` records who changed what and when; why a grade or an invoice changed is answerable
- **bcrypt** — cost 12
- **Env validation** — refuses to boot on bad configuration rather than failing in production three weeks later
- **CORS** — explicit allow-list
- **Secret scanning** — `gitleaks` in CI

### Observability

Structured logs (`pino`) carry a request ID and a **`tenant_id`** — in a multi-tenant system, "an error occurred" is useless and "tenant 5 hit an error" is actionable. Student PII is redacted at the logger. Sentry catches what the logs miss, `/health` and `/ready` check Postgres, and alerts arrive over Telegram.

This exists because of a specific failure: the guardian login bug was found by a parent phoning the academy. That is not monitoring. And a tenant-isolation leak is worse — nobody phones about that one, because there is no error to see.

---

## Documentation

[**`docs/`**](./docs) — the full specification. Sixteen documents and eight ADRs, written against measured facts rather than assumptions; where something could not be verified it is marked as an open question rather than guessed.

Start with the [roadmap](./docs/14-roadmap.md): it is ordered by dependency, not importance, and explains why the most valuable change in the project is deliberately not the first one.

---

## License

Proprietary. Built by [Sarvarbek Sodiqov](https://github.com/Sarvarbek0704) for a working academy; published for review, not for reuse.
