# CANON — o'lchangan faktlar bazasi

> Bu TZ dagi **har bir raqam** shu yerdan keladi, va shu yerda uni bergan
> buyruq ham turibdi.
>
> **Ziddiyat bo'lsa — fakt g'olib.** Bu hujjatning o'zi ham bir necha marta
> xato bo'lgan va tuzatilgan; jurnal §9 da.

---

## 0. Bu hujjat nima uchun bor

TZ yozishda eng oson xato — **tekshirmasdan xulosa chiqarish**. Kod
"Redis'ga o'xshaydi" (`.env` da `REDIS_*` bor) → hujjatga "Redis ishlatiladi"
deb yoziladi → o'sha yolg'on 16 ta hujjatga tarqaladi → uni o'qigan dasturchi
Redis ko'taradi va u hech narsa qilmaydi.

Bu aynan shu loyihada **sodir bo'ldi**. §9 ga qarang.

Shuning uchun qoida: **har da'vo o'lchanadi**, va o'lchov shu yerda yoziladi.
"Ehtimol", "odatda", "menimcha" — TZ da yo'q. Tekshirib bo'lmagan narsa
**ochiq savol** deb belgilanadi, taxmin qilinmaydi.

---

## 1. Loyiha

| | |
|---|---|
| **Nomi** | MathAcademy Digital Campus |
| **Repo** | github.com/Sarvarbek0704/mathacademy (PUBLIC) |
| **Nima** | Ko'p ijarachilik (multi-tenant) Student Information System |
| **Muallif** | Sarvarbek Sodiqov |
| **⚠️ Eng muhim farq** | **Bu demo emas.** Loyiha muallif o'qigan akademiya uchun qurilgan va **real xodimlar va ota-onalar tomonidan har kuni ishlatiladi** |

Domen: **yotoqxonali DTM tayyorlov akademiyasi**. Bu oddiy maktab tizimi emas —
yotoqxona, ovqatlanish, intizom, DTM tayyorlov va universitetga kirish
natijalari bir tizimda.

---

## 2. Kod hajmi

```bash
# apps/api va apps/web bo'yicha
find apps/api/src -name '*.ts' | xargs wc -l | tail -1
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs wc -l | tail -1
git rev-list --count HEAD
```

| | |
|---|---|
| `apps/api` | **37 294** qator |
| `apps/web` | **25 489** qator |
| **Jami** | **62 783** |
| Commit | **51** (kanon kesimi) → **52** (seed tuzatishidan keyin) |

---

## 3. Struktura

```bash
grep -c "^model " apps/api/prisma/schema.prisma        # 69
grep -c "^enum "  apps/api/prisma/schema.prisma        # 1
ls apps/api/src/modules | wc -l                        # 28
grep -rl "@Controller" apps/api/src --include=*.ts | wc -l   # 37
find apps/api/src -name "*.spec.ts" | wc -l            # 0
```

| | |
|---|---|
| Prisma modellari | **69** |
| Enum | **1** (`SubjectRole`: MAIN / SECONDARY / MANDATORY) |
| Backend modullari | **28** |
| Controller / Service / DTO | 37 / 32 / **128** |
| Frontend sahifalari | **48** (36 staff + 12 guardian) |
| **Testlar** | `apps/api` da `.spec.ts` — **aniq 0**; `test/` katalogi **yo'q**. `apps/web` da 1 ta placeholder. Ya'ni **amalda nol** |

**Stack:** NestJS 11 · Prisma 7.3 · **PostgreSQL 15+ (yagona ma'lumot ombori)** ·
React 18.3 · Vite 5.4 · TypeScript 5.7 · Tailwind 3.4 · shadcn/ui (Radix) ·
TanStack Query 5.83 · Recharts · Zod · dayjs · bcrypt (cost 12) · Swagger 11.2

**28 modul:** academic-years · announcements · assessments · attendance · auth ·
awards · billing · campuses · certificates · cohorts · competitions · discipline ·
displays · dorms · events · files · groups · leaves · notifications · ranking ·
rbac · risk · student-tracks · students · subjects · tenants · timetable · users

**Eng katta servislar (qator):** students 2079 · auth 1644 · billing 1610 ·
displays 1136 · discipline 1123 · assessments 987

---

## 4. Multi-tenancy — o'zak

Shared database, har tenant-scoped jadvalda `tenant_id`. Tenant **JWT'dan**
olinadi, mijoz parametridan **hech qachon emas**.

### 4.1. Tenant 845 ta chaqiruv nuqtasida qo'lda boshqariladi

```bash
cd apps/api/src
grep -rhoE "\.(findMany|findUnique|findFirst|create|createMany|update|updateMany|delete|deleteMany|upsert|count|aggregate|groupBy)\(" --include=*.ts . | wc -l
# → 845
```

| Operatsiya | Soni |
|---|---|
| `findFirst` | **272** |
| `findMany` | 131 |
| `create` | 90 |
| `update` | 79 |
| `count` | 78 |
| `findUnique` | 65 |
| `delete` | 37 |
| `updateMany` | 24 |
| `groupBy` | 23 |
| `upsert` | 14 |
| `createMany` / `deleteMany` | 13 / 13 |
| `aggregate` | 6 |
| **JAMI** | **845** |

⚠️ **Nuans:** 845 tasi bir xil emas. `create` uchun `tenant_id` **`data`** da
kerak, `where` da emas. `tenants.service.ts` — to'g'ri global (u tenantlarni
boshqaradi). Ya'ni "845 ta unutilgan `WHERE`" **noto'g'ri ibora**. To'g'risi:
**845 ta nuqta, har birida tenant haqida o'ylash kerak**.

**30 servisdan 29 tasi** `tenant_id` bilan filtrlaydi.

### 4.2. `tenant.util.ts` — o'lik kod

```bash
grep -rl "withTenantCondition" apps/api/src --include=*.ts
# → faqat 1 natija: faylning o'zi
```

`common/utils/tenant.util.ts` da **to'g'ri yechim yozilgan** —
`withTenantCondition()`, `ensureTenantId()`, `getUserTenantId()` — va
**hech qayerda ishlatilmaydi**.

**Himoyaga o'xshagan o'lik kod himoyasizlikdan yomonroq** — uni ko'rgan odam
"himoya bor ekan" deb o'ylaydi.

### 4.3. ⚠️ 18 model `tenant_id` siz

```bash
awk '/^model /{n=$2; b=""} /^}/{if(b !~ /tenant_id/ && n!="") print n; n=""} {if(n!="") b=b $0}' \
  apps/api/prisma/schema.prisma
```

assessment_scores · attendance_marks · award_recipients · competition_entries ·
competition_results · display_items · dorm_announcement_prices · dorm_rooms ·
event_participants · grade_snapshot_rows · group_subjects ·
meal_announcement_prices · permissions · role_permissions · student_cohort ·
tenants · timetable_lessons · user_roles

`tenants` va `permissions` — **to'g'ri global**. Qolgan 16 tasi — **bola
jadvallar**, tenant'ga **ota orqali** yetadi (`assessment_scores` →
`assessments.tenant_id`).

**Oqibat:** Prisma extension ular uchun `where.tenant_id` yoza **olmaydi** —
ustun yo'q. **Nested relation filtri** kerak → har model uchun "tenant'ga yo'l"
xaritasi → **xarita ham unutilishi mumkin**. Muammo **yo'qolmaydi — ko'chadi**.

### 4.4. Uch real naqsh

| Naqsh | Joy | Baho |
|---|---|---|
| **To'g'ri** — ota orqali scope | `assessments.service.ts:908` `where: { assessments: { tenant_id } }` | Namuna |
| **Ma'lumot oqimi bo'yicha xavfsiz, mo'rt** | `ranking.service.ts:128` — filtr yo'q, lekin `assessment_id: { in: [...] }` oldingi tenant-scoped so'rovdan | Kafolat **so'rovda emas, zanjirda**. Hech qanday test ushlamaydi |
| **Servis qatlamini aylanib o'tish** | `guardian-student.controller.ts` — `studentsService['prisma']`, **4 joyda** (465, 558, 887, 902) | Bracket notation `private` ni chetlab o'tadi. Kod izohida tan olingan: `// we need to add this method to StudentsService` |

---

## 5. Domen — DTM 189

O'zbekiston oliy ta'limga kirish imtihoni. **2026 uchun format o'zgarmagan**
(veb-qidiruv bilan tasdiqlangan).

```
Asosiy fan (MAIN)          30 savol × 3.1  =  93
Qo'shimcha fan (SECONDARY) 30 savol × 2.1  =  63
Majburiy (MANDATORY)       3 × 10 × 1.1    =  33
                                              ────
                                              189
```

Modellashtirish: `student_tracks` → `track_subjects.role` (`SubjectRole`).

### ⚠️ 189 qoidasi faqat frontendda

```
apps/web/src/pages/staff/AssessmentsPage.tsx:710
  maxScore: v === 'BLOCK_TEST' ? '189' : form.maxScore
```

Backend: `assessments.max_score` — oddiy `Decimal(8,2)`, `weight` — oddiy
`Decimal(6,3)` default 1.0. **API `BLOCK_TEST` ni `max_score: 500` bilan ham
qabul qiladi.**

### ⚠️ Track tarkibi majburlanmaydi

```bash
grep -rn "MANDATORY" apps/api/src --include=*.ts | grep -v dto
# → 1 natija: tracks.service.ts:278 — default qiymat sifatida
```

- `tracks.service.ts:281-292` — MAIN fan qo'shilsa eskisi **jimgina
  almashtiriladi**, `{ ok: true }` qaytariladi
- 0 ta MANDATORY bilan track — **har yangi trackning boshlang'ich holati**
- `assessments.service.ts` (987 qator) — `track` so'zini **bilmaydi**

### ⚠️ Fan roli massiv indeksidan o'qiladi

`AssessmentsPage.tsx:187` rolni `group_subjects` **indeksidan** oladi.
`groups.service.ts:183` da `ORDER BY subject_id: 'asc'` — ya'ni tartib
**deterministik**, lekin u fanlar **bazaga qo'shilgan** tartibi, rol bilan
aloqasiz.

**Tasodifiy tartibdan yomonroq:** xato **barqaror** → sinovda o'tadi → yillar
yashirinadi → **tenantga bog'liq**. `SubjectRole` enum **bor**,
`track_subjects.role` **to'ldirilgan**, `TracksPage.tsx:52` uni **to'g'ri
o'qiydi**. Ikki sahifa, ikki haqiqat.

---

## 6. Ma'lumotlar bazasi

### 6.1. ⚠️ Migratsiya drifti — 1-ustuvorlik

```bash
grep -rh "CREATE TABLE" apps/api/prisma/migrations/ | wc -l   # 68
grep -c "^model " apps/api/prisma/schema.prisma               # 69
grep -rn "track_subjects\|SubjectRole" apps/api/prisma/migrations/   # hech narsa
```

**`track_subjects` va `SubjectRole` — DTM 189 ning o'zagi — hech qaysi
migratsiyada yo'q.** Toza bazada `migrate deploy` → ilova ishga tushmaydi.
Production ishlayapti, chunki bazasi boshqa yo'l bilan qurilgan.

**`db push` tarixining uchta forensik izi:**
1. `migration_lock.toml` **yo'q** — Prisma uni `migrate dev` da avtomatik yaratadi
2. Katalog nomlari `000000_init/` — Prisma `YYYYMMDDHHMMSS_nom` ishlatadi
3. `files_storage/migration.sql` da har operatorda **`IF NOT EXISTS`** — Prisma
   buni **hech qachon generatsiya qilmaydi**. Odam yozgan himoya: ustunlar
   bazada allaqachon bor edi

### 6.2. ⚠️ Indeks yo'q

| | `000000_init` | `000001_files_storage` |
|---|---|---|
| `CREATE UNIQUE INDEX` | 27 | 0 |
| `CREATE INDEX` (performans) | **0** | 1 |
| `FOREIGN KEY` | **165** | 0 |

Sxemada **1 ta `@@index`** (`files:464`), 23 ta `@@unique`.

**Ikki alohida muammo:**
1. **165 FK, 0 indeks.** PostgreSQL — MySQL'dan farqli — FK ustiga avtomatik
   indeks **yaratmaydi**. Har `ON DELETE CASCADE` bola jadvalni **to'liq
   skanerlaydi**
2. **`tenant_id` bo'yicha composite indeks yo'q.** Bitta akademiyada
   sezilmaydi; ko'p tenantda har so'rov **barcha akademiyalar qatorini** kechadi

⚠️ `@@unique` bilvosita indeks beradi va ba'zi so'rovlarni tasodifan qoplaydi —
"indeks umuman yo'q" **noto'g'ri ibora**. **Maqsadli performans indeksi** yo'q.

### 6.3. ⚠️ 69 model — 1 enum

43 cheklangan ustun `String`. Eng muhimi: **`outcome_status`** —
`String @db.VarChar(30)`, va u **akademiyaning asosiy KPI'si**.
`EARLY_ADMITTED` va `early_admitted` alohida guruh bo'ladi; `GROUP BY`
**jimgina noto'g'ri javob** beradi.

Bu allaqachon bir marta ta'sir qilgan: `a3dab30` — *"fix: production bugs —
… certificates outcomeStatus …"*.

⚠️ **Aniqlik:** o'sha holatda DTO **ishlagan** (frontend maydon nomini noto'g'ri
yuborgan, `@IsIn` rad etgan, iflos qiymat bazaga tushmagan). Ya'ni **omad
kelgan — omad arxitektura emas**.

### 6.4. Pul — baza to'g'ri

```bash
grep -n "Float" apps/api/prisma/schema.prisma   # hech narsa
```

**Float YO'Q.** Hamma summa `Decimal(12,2)`. ⚠️ **"Pul float bilan saqlangan"
tanqidi bu loyihaga TEGISHLI EMAS.**

Muammo nozikroq — **JS chegarasida izchillik yo'q**. Bitta servis ikki xil
qaytaradi:
```
billing.service.ts:1605   amount: Number(inv.amount)          // number
billing.service.ts:1578   unpaidTotal: ...toString() || '0'   // string
```
`Number()` pulga **11 joyda**. ⚠️ Halol xavf bahosi: `Number("20000000.00")` →
**aniq**. Xavf faqat kasr yig'ilganda, va **o'zbek so'mida tiyin amalda
ishlatilmaydi** → bag **uxlab yotibdi**, lekin schema uni majburlamaydi.

---

## 7. Xavfsizlik

### 7.1. Tuzatilgan: `seed.ts` parollari

`seed.ts` superadmin parolini hardkod qilgan, README uni
**public repoda jadval bilan chop etgan**, `seed:prod` skripti o'sha seedni
production'da ishga tushirardi.

**Tuzatildi:** `NODE_ENV=production` da abort; `ALLOW_SEED=true` talab;
parollar `SEED_*` env'dan; tekshiruv **birinchi DB yozuvidan OLDIN** (modul
yuklanishida — aks holda yarim-seed bo'lardi); `seed:prod` o'chirildi.
⚠️ **Parol git tarixida qoldi — rotatsiya kerak.**

### 7.2. ⚠️ `Math.random()` bilan parol — 3 faylda

```
students.service.ts:43     yangi o'quvchi paroli
auth.service.ts:1483       parol tiklash
users.service.ts:28        yangi xodim paroli
students.service.ts:1451   bitta siklda 60 ta parol
```

CSPRNG **emas** (V8'da xorshift128+). Bir necha chiqishni ko'rgan hujumchi
ichki holatni tiklab qolganlarini hisoblaydi. Ommaviy yaratish — ideal sharoit.
**Bu parol bola profiliga kalit.**

**`seed.ts` bilan bir naqsh:** parol siyosati bor, **parol qayerdan kelishi**
o'ylanmagan.

### 7.3. ⚠️ Fayllar

- `main.ts:57-66` — `/uploads` `express.static` bilan, **`setGlobalPrefix`
  (`:68`) dan OLDIN** → **barcha guard'lardan tashqarida**, autentifikatsiyasiz
- `files.storage.ts:43` — `assertAllowedMime`: `if (!m) return;` → **bo'sh
  MIME'da fail-open**. MIME mijozdan keladi
- `render.yaml:38` — **`UPLOAD_DIR: /tmp/uploads`**. Render'da `/tmp` efemer →
  **har deploy'da o'quvchi suratlari o'chadi**, bazada yo'q fayllarga ishora
  qilgan qatorlar qoladi. `databases: plan: free` → **zaxira yo'q**

⚠️ Nozik jihat: `files` **modelida** `tenant_id` bor, ya'ni extension
**yozuvni** himoya qiladi — lekin `express.static` **faylning o'zini** guard'siz
beradi. **Metama'lumot bilan kontent orasidagi bo'shliq.**

Yagona himoya — `randomUUID()` fayl nomi (122 bit, brute-force qilib
bo'lmaydi). Lekin URL sizsa **abadiy ochiq**, ustiga `maxAge: '30d'`.

### 7.4. O'lik env kalitlari — yolg'on hujjat

| Kalit | Holat |
|---|---|
| `REDIS_*` | kodda **o'qilmaydi** |
| `RATE_LIMIT_*` | `@nestjs/throttler` **o'rnatilmagan** |
| `MIN_PASSWORD_LENGTH` | o'qilmaydi |
| `MAX_SESSIONS_PER_USER` | o'qilmaydi |
| `COOKIE_SECURE` | o'qilmaydi |

`.env.example` — **hujjat**, va uni har yangi dasturchi nusxalaydi. Yolg'on
hujjat yo'q hujjatdan yomonroq: kimdir `RATE_LIMIT_MAX=10` qo'yib
"himoyalandim" deb o'ylaydi.

**Tuzatilgan:** `ACCESS_TOKEN_TTL` (`15h` → `15m`); `ENABLE_SWAGGER` (endi kod
uni **o'qiydi** — ilgari `/api/docs` production'da so'zsiz ochiq edi);
`test:e2e` (mavjud bo'lmagan configga ishora qilardi).

### 7.5. To'g'ri qilingan — buzilmasin

- `all-exceptions.filter.ts` — stack trace yo'q, Prisma `meta.target`
  uzatilmaydi (schema sizmaydi)
- `ranking.service.ts` `Prisma.sql` — to'liq parametrlashtirilgan, **3 joyda**
  tenant filtri bilan
- Fayl nomi `randomUUID()` — path traversal yo'q; `safeSegment()` tozalaydi
- CORS — `origin: true` **emas**, allow-list
- `$queryRawUnsafe` — **0 ta**; `dangerouslySetInnerHTML` — 1 ta (shadcn
  `chart.tsx`, config-driven, xavfsiz)

---

## 8. RBAC — yaxshi qilingan

```bash
grep -rho "@RequirePermissions" apps/api/src --include=*.ts | wc -l   # 234
grep -rho "@RequireRoles" apps/api/src --include=*.ts | wc -l         # 6
```

⚠️ Dekoratorlar **`@Roles` / `@Perms` EMAS** — real nomlar
`@RequirePermissions` va `@RequireRoles`.

**`PermissionsGuard` ostida ruxsat e'lon qilmagan bitta ham route yo'q.**
Izchil qo'llangan tizim — **kuchli tomon**.

### ⚠️ Resource-level scope yo'q — va modelda ham yo'q

"O'qituvchi FAQAT o'z guruhiga baho qo'ya oladi" — **majburlanmaydi va hozirgi
sxemada majburlab BO'LMAYDI**:
- `teacher_user_id` — faqat `timetable_lessons` da
- `groups` — faqat `curator_user_id`
- `assessments` — faqat `created_by_user_id`

Ya'ni **RBAC bagi emas — ma'lumot modeli bo'shlig'i**. Scope tekshiruvidan
oldin **scope tushunchasining o'zi** modelga qo'shilishi kerak.

### Superadmin cross-tenant — qurilmagan, va bu to'g'ri

`perms.guard.ts:32` superadmin ruxsat tekshiruvini chetlab o'tadi, lekin
`tenantId` baribir **JWT'dan** → cross-tenant **kira olmaydi**.

---

## 9. ⚠️ Tuzatishlar jurnali — bu kanon nimalarda xato bo'lgan

> Bu bo'lim **ataylab o'chirilmaydi.** U TZ jarayonining eng muhim qismi:
> boshlang'ich brif ishonch bilan yozilgan va **oltita da'vosi xato** bo'lib
> chiqdi. Har biri **kodni o'qish** orqali topildi.
>
> Saboq: **ishonch aniqlik emas.** Kanon "yagona haqiqat manbai" deb e'lon
> qilingan edi — lekin fakt kanondan ustun turdi.

| # | Kanon nima degan | Haqiqat | Qanday topildi |
|---|---|---|---|
| 1 | "Redis 7 ishlatiladi, auth locks + Redis" | **Redis umuman ishlatilmaydi.** Import 0 ta; `CacheModule` `store`siz = in-memory LRU; auth locks **PostgreSQL'da** | `grep redisStore\|ioredis` → 0. Xulosa `.env` da `REDIS_*` borligidan **chiqarilgan edi, tekshirilmagan** |
| 2 | "2 ta **haqiqiy migration**, `db push` emas" | **Migratsiyalar sxemadan ajralib qolgan.** 68 `CREATE TABLE` vs 69 model; `track_subjects` yo'q | `grep -c "CREATE TABLE"` vs `grep -c "^model "` |
| 3 | "MAIN/SECONDARY yagonaligi `tracks.service.ts:280` da tekshiriladi" | **Hech narsa tekshirilmaydi** — eski MAIN **jimgina almashtiriladi**, `{ok:true}` qaytariladi | Kod o'qildi |
| 4 | "Dekoratorlar `@Roles`, `@Perms`" | **`@RequirePermissions` (234 ta)**, `@RequireRoles` (6 ta) | `grep` |
| 5 | "Xavf skori: `levelFromScore` ≤33 GREEN…" — bashorat sifatida | **Skor qo'lda kiritiladi** (`risk.service.ts:60` `{manual:true}`). Hech qanday signal ta'sir qilmaydi. Bu **tracking**, **detection emas** | Kod o'qildi |
| 6 | "Tenant filtri **176** joyda (121 `findMany` + 55 `findUnique`)" | **845 ta chaqiruv.** ⚠️ Lekin tashxis nozik — quyiga qara | To'liq operatsiya ro'yxati bo'yicha qayta `grep` |

⚠️ **6-qator alohida izohga loyiq, chunki u eng ibratli xato.**

**176 to'qib chiqarilmagan.** U **takrorlanadi**:
```bash
grep -ro '\.findMany(' --include=*.service.ts apps/api/src | wc -l    # → aynan 121
grep -ro '\.findUnique(' --include=*.service.ts apps/api/src | wc -l  # → aynan 55
```
Ya'ni o'lchov **to'g'ri bajarilgan** — noto'g'ri **qamrov** ustida.

Va eng ibratlisi:
```bash
grep -ro '\.findFirst(' --include=*.service.ts apps/api/src | wc -l   # → 269
```
**`findFirst` — men sanayotgan aynan o'sha fayllarning ichida 269 ta.** Ya'ni
xato "ikkita operatsiya e'tibordan chetda qoldi" emas. Xato: **men eng katta
toifaning yonidan o'tib, ikkita kichigini sanadim va yig'indini "jami" deb
e'lon qildim.**

Nega bu muhim: raqam **ishonchli ko'rinardi** — u aniq, takrorlanadigan, va
buyruq bilan asoslangan edi. Uni tekshirgan odam o'sha buyruqni ishga tushirib,
o'sha javobni olardi. **Xato o'lchovda emas — savolda edi.**

Shuning uchun hujjatlarda **11 ta `176` ataylab qoldirilgan** va har biri
"kanonning kam sanovi" deb belgilangan. Ular o'chirilmaydi: raqamning
qayerdan kelgani — uning noto'g'riligidan ko'ra foydaliroq saboq.

**Yana ikkita da'vo oshirib yuborilgan edi va yumshatildi:**

| Da'vo | Aniqlik |
|---|---|
| "`.env.example` `15h` → **production'da 15 soatlik token**" | **Yo'q.** `render.yaml:21` → `ACCESS_TOKEN_TTL: 15m`. Deploy **har doim 15 daqiqa** bo'lgan. `15h` faqat **lokal** dasturchiga tegardi |
| "`guardian-files.controller.ts:93` → **ruxsatsiz kirish 200 OK oladi**" | **Zaiflik emas.** `return` amalni **to'xtatadi** — fayl yuklanmaydi. Bu **status kodi bagi** (`403` bo'lishi kerak), bypass emas |

**Va bitta da'vo to'liq rad etildi:**

| Gipoteza | Natija |
|---|---|
| "Frontendda BigInt ID `parseInt`/`Number` bilan buziladi" | **Bag yo'q.** `grep -rnP "(parseInt\|Number)\s*\(\s*[\w.\[\]']*([Ii]d\|ID)\b"` → **0 natija**. ID'lar butun frontend bo'ylab string. To'qib chiqarilmadi |

---

## 10. Konvensiyalar

| | |
|---|---|
| Prisma model nomlari | **`snake_case`, KO'PLIK** (`student_tracks`) — Prisma odati emas, lekin **mavjud kod**; 69 modelni o'zgartirish narxi > foydasi |
| Ustunlar | `snake_case` (`tenant_id`, `created_by_user_id`) |
| PK | `BigInt @default(autoincrement())` |
| Vaqt | `@db.Timestamptz(6)` |
| Migratsiya | **Majburiy.** `db push` — **hech qachon** ([ADR-0008](./adr/0008-migrations-as-source-of-truth.md)) |
| TZ tili | O'zbek (lotin), texnik atamalar ingliz |
| Kod va kommentlar | Ingliz |

---

## 11. Bu TZ hal qila olmaydigan narsalar

| Savol | Kimga |
|---|---|
| O'quvchi surati **biometrik ma'lumotmi**? O'RQ-1125 (2026-03-26) umumiy lokalizatsiyani bekor qildi, **lekin biometrik hali ham faqat O'zbekistonda** | Yurist |
| Production'da **nechta yaroqsiz track** bor? DTM majburlashini yoqish blok test yaratishni to'xtatishi mumkin | O'lchov + foydalanuvchi |
| `SELECT DISTINCT outcome_status` — real holat qanday? Enum migratsiyasi iflos ma'lumotda **yiqiladi** | O'lchov |
| `Math.random()` bilan yaratilgan **eski parollar rotatsiya qilinsinmi**? | Foydalanuvchi |
| O'zbekistonda **nechta yotoqxonali tayyorlov akademiyasi** bor? Bozor hajmi **noma'lum** | Tadqiqot |

⚠️ **Bozor raqamlari to'qib chiqarilmagan.** Raqiblar bor (WeWork — we-work.uz,
"№1", 200+ markaz; EducationCRM; CRM Edu), lekin ular **kurs markazi CRM'i**.
mathacademy boshqa narsa: yotoqxona + ovqat + intizom + DTM + kirish natijalari.
**HEMIS** — oliy ta'lim (OTM) uchun majburiy, akademiya OTM emas → qo'llanilmaydi.
