# 03 — Multi-tenancy: izolyatsiyani intizomdan strukturaga ko'chirish

> **Status:** TZ (texnik topshiriq). Implementatsiya boshqa Claude chati tomonidan bajariladi.
> **Ustuvorlik:** ENG YUQORI. Bu hujjat — butun TZ ning markazi.
> **Kanon:** [`CANON.md`](./CANON.md) §5.1, §6.
> **Kod bazasi:** o'lchangan sana — 2026-07-15, `apps/api` 37 294 qator, 69 Prisma modeli.

---

## Bu hujjat nima uchun eng muhim

MathAcademy — **demo emas**. Real akademiya, real xodimlar, real ota-onalar, real
voyaga yetmagan o'quvchilarning ma'lumoti. Tizim hozir **bitta akademiya** uchun
ishlaydi, lekin arxitekturasi **ko'p akademiya** uchun qurilgan (`tenant_id` hamma
joyda bor). Ya'ni multi-tenancy bu loyihada **kelajakdagi reja emas — bugungi kod**.

Va aynan shu yerda loyihaning eng katta zaifligi yashiringan:

> **Izolyatsiya kafolati kodda emas — dasturchining xotirasida.**

845 ta Prisma chaqiruv nuqtasi bor va **har birida** tenant haqida **qo'lda**
o'ylash kerak. 844 tasi to'g'ri bo'lsa ham, bitta unutilgan filtr = **bir
maktab ikkinchisining o'quvchilarini,
baholarini, to'lovlarini, intizom yozuvlarini ko'radi**. Bu bag emas — bu ma'lumot
sizib chiqishi (data breach). Va bu bolalar ma'lumoti.

Bu hujjat shu kafolatni **intizomdan strukturaga** ko'chirish yo'lini beradi:
unutish **imkonsiz** bo'ladigan qilib.

---

## 1. Nima uchun multi-tenancy

### 1.1. Muammo

Bitta akademiya uchun tizim yozish oson: bitta database, bitta deploy, `WHERE`
shartlarida hech qanday tenant yo'q. MathAcademy shunday boshlanmagan — u boshidan
`tenant_id` bilan qurilgan. Sabab: maqsad **mahsulot**, bitta mijoz emas.

Ikkinchi akademiya qo'shilganda savol tug'iladi: **ularning ma'lumoti qayerda
yashaydi?** Uch javob bor, va har birining narxi bor.

### 1.2. Uch alternativa

#### A) Database-per-tenant

Har akademiyaga alohida PostgreSQL database (yoki alohida server).

```
mathacademy_db_akademiya_a
mathacademy_db_akademiya_b
mathacademy_db_akademiya_c
```

| | |
|---|---|
| **Izolyatsiya** | Eng kuchli. Kod bagi bilan ham A ning so'rovi B ning databasega **fizik** yeta olmaydi |
| **Backup / restore** | Bitta tenantni tiklash oson — alohida dump |
| **Blast radius** | Bitta tenant DB si buzilsa boshqalari ishlaydi |
| **Narxi — migratsiya** | 100 tenant = **100 marta `prisma migrate deploy`**. Bittasi yiqilsa — versiyalar ajraladi. Bu operatsion kabus |
| **Narxi — connection** | Har DB o'z pool ini talab qiladi. Node.js prosessi 100 pool × 10 ulanish = **1000 ulanish**. PostgreSQL default `max_connections` = 100 |
| **Narxi — kod** | `PrismaService` endi yagona emas. Har request uchun to'g'ri `PrismaClient` topilishi kerak. `PrismaClient` og'ir obyekt — 100 ta instansiya xotirada |
| **Narxi — cross-tenant hisobot** | "Barcha akademiyalarda nechta o'quvchi bor?" → 100 ta so'rov + qo'lda birlashtirish |
| **Narxi — MathAcademy uchun** | 69 model, 2 migratsiya. Hozir yagona `PrismaService` (`apps/api/src/prisma/prisma.service.ts:14-38`). Bu yo'lga o'tish — **butun data qatlamini qayta yozish** |

#### B) Schema-per-tenant

Bitta database, har tenantga alohida PostgreSQL schema.

```sql
CREATE SCHEMA tenant_a;  -- tenant_a.students, tenant_a.groups ...
CREATE SCHEMA tenant_b;  -- tenant_b.students, tenant_b.groups ...
```

| | |
|---|---|
| **Izolyatsiya** | Kuchli. `search_path` to'g'ri bo'lsa, cross-tenant so'rov yozib bo'lmaydi |
| **Connection** | Bitta pool yetadi — `SET search_path` bilan almashtiriladi |
| **Narxi — Prisma** | ⚠️ **Hal qiluvchi to'siq.** Prisma `multiSchema` ni qo'llaydi, lekin **statik** — `schema.prisma` da schema nomlari kompilyatsiya vaqtida yozilishi kerak. Dinamik "runtime da tenant schemasiga o'tish" Prisma da **qo'llab-quvvatlanmaydi** |
| **Narxi — migratsiya** | 100 schema × 69 jadval = **6900 jadval**. `prisma migrate` buni boshqara olmaydi — har schema uchun qo'lda DDL |
| **Narxi — `search_path` + pooling** | PgBouncer transaction mode da ulanish har tranzaksiyadan keyin qaytariladi. `SET search_path` **oqib ketadi** — keyingi so'rov noto'g'ri tenant schemasida ishlashi mumkin. Bu **jimgina** buziladi — eng yomon turdagi bag |
| **Narxi — MathAcademy uchun** | Prisma 7.3 bilan amalda **imkonsiz**. Prisma dan voz kechish 37 294 qatorni qayta yozish demak |

#### C) Shared database + `tenant_id` ustuni

Bitta database, bitta schema, har tenant-scoped jadvalda `tenant_id BigInt`.

```sql
SELECT * FROM students WHERE tenant_id = 5 AND ...;
```

| | |
|---|---|
| **Migratsiya** | **Bitta** `prisma migrate deploy`. Hamma tenant bir vaqtda yangilanadi |
| **Connection** | Bitta pool. Bitta `PrismaClient` |
| **Cross-tenant hisobot** | Oddiy `GROUP BY tenant_id` |
| **Yangi tenant qo'shish** | Bitta `INSERT INTO tenants` — DDL yo'q, deploy yo'q |
| **Xarajat** | Eng arzon. Kichik tenantlar bitta serverni bo'lishadi |
| **⚠️ Narxi — izolyatsiya** | **Faqat kod kafolatlaydi.** Bitta unutilgan `WHERE tenant_id` = ma'lumot sizishi. Fizik to'siq **yo'q** |
| **⚠️ Narxi — noisy neighbour** | Katta tenant kichigining so'rovlarini sekinlashtiradi |
| **⚠️ Narxi — backup** | Bitta tenantni tiklash — dump dan emas, qo'lda `WHERE tenant_id` bilan |

### 1.3. Nega shared-database + `tenant_id` tanlangan

**Halol javob: bu qaror allaqachon qabul qilingan.** 69 modeldan 51 tasida
`tenant_id` bor. 2 ta migratsiya bor. Bu TZ ning ishi — qarorni qayta ko'rib chiqish
emas, **uni to'g'ri yakunlash**.

Lekin qaror **asosli** ham. Sabablari:

1. **Migratsiya intizomi.** Kanon §9: "Migration majburiy, `db push` hech qachon".
   Bitta database = bitta migratsiya tarixi. Database-per-tenant da bu intizom
   100 ga ko'payadi va sinadi.

2. **Tenant o'lchami kichik.** Akademiya — 500-2000 o'quvchi. 100 akademiya =
   200 000 o'quvchi. Bu PostgreSQL uchun **kichik jadval**. `tenant_id` ustidagi
   indeks bilan noisy neighbour muammosi real emas.

3. **Prisma 7.3 real to'siq.** Schema-per-tenant Prisma bilan ishlamaydi (yuqorida).
   Database-per-tenant ishlaydi lekin `PrismaService` ni yagona singleton dan
   dinamik factory ga aylantirish talab qiladi — bu 28 modulning hammasiga tegadi.

4. **Yangi tenant qo'shish deploy talab qilmaydi.** Kanon §6: "Self-service
   onboarding yo'q — yangi tenant qanday qo'shiladi?" Shared-database da javob
   oddiy: `INSERT`. Database-per-tenant da javob: DDL + migratsiya + pool
   qayta konfiguratsiyasi.

5. **Zaiflik ma'lum va tuzatiladigan.** Shared-database ning yagona jiddiy narxi —
   "faqat kod kafolatlaydi". **Bu hujjat aynan shu narxni to'laydi.** Prisma client
   extension + izolyatsiya testi bilan kafolat koddan strukturaga ko'chadi.

> **Qaror:** shared database + `tenant_id`. **O'zgartirilmaydi.**
> Lekin izolyatsiya **qo'lda emas, avtomatik** bo'ladi.

### 1.4. Kelajak eshigi ochiq qolsin

Agar bir kun katta tenant (masalan 20 000 o'quvchili tarmoq) kelsa yoki mijoz
shartnomada "bizning ma'lumot alohida databaseda bo'lsin" desa — **hybrid** yo'l
bor: shu tenant uchun alohida deploy + alohida database, kod o'zgarmaydi (chunki
`tenant_id` baribir bor, shunchaki o'sha DB da bitta tenant yashaydi).

Bu — shared-database ning yana bir afzalligi: undan chiqish yo'li bor.
Schema-per-tenant dan chiqish yo'li yo'q.

---

## 2. Hozirgi holat — halol audit

Bu bo'limdagi barcha raqamlar **shu TZ yozilayotganda o'lchangan**, kanondan
ko'chirilmagan. O'lchash usuli har raqam ostida ko'rsatilgan.

### 2.1. 845 ta chaqiruv nuqtasi — o'lchangan

Kanon 5.1 bu yuzani **176** deb ataydi (121 `findMany` + 55 `findUnique`,
`*.service.ts` bo'yicha). Bu raqam **qayta hosil qilinadi**, lekin u **to'liq
rasm emas**: kanon faqat ikkita operatsiyani sanagan va **eng katta toifani —
`findFirst` ni butunlay o'tkazib yuborgan** (faqat `*.service.ts` da 269 ta).

Barcha Prisma operatsiyalari bo'yicha to'liq o'lchov:

```bash
cd apps/api/src
for m in findMany findUnique findFirst count aggregate groupBy \
         create createMany update updateMany delete deleteMany upsert; do
  printf "%-12s %s\n" "$m" "$(grep -ro "\.$m(" --include=*.ts . | wc -l)"
done
```

| Operatsiya | Butun `src/` | `*.service.ts` |
|---|---:|---:|
| `findFirst` | **272** | 269 — *kanon sanamagan* |
| `findMany` | 131 | **121** |
| `create` | 90 | — |
| `count` | 78 | — |
| `update` | 79 | — |
| `findUnique` | 65 | **55** |
| `delete` | 37 | — |
| `updateMany` | 24 | — |
| `groupBy` | 23 | — |
| `upsert` | 14 | — |
| `createMany` | 13 | — |
| `deleteMany` | 13 | — |
| `aggregate` | 6 | — |
| **JAMI** | **845** | 176 — *kanon hisobi: faqat `findMany` + `findUnique`* |

> ⚠️ **Bu kanon raqamidan ~5 barobar katta.** 176 — bu **eng ko'rinadigan** qism.
> Haqiqiy himoyalanishi kerak bo'lgan yuza **845 ta Prisma chaqiruvi**. Ayniqsa
> **`findFirst` — 272 ta**, ya'ni `findMany` dan ham ko'p — va aynan u
> sanalmay qolgan.
>
> Bu **yomon xabar emas — yaxshi xabar**. `findFirst` ning ko'pligi shuni
> ko'rsatadiki, kod muallifi `findUnique` ning tenant filtri qabul qilmasligini
> **bilgan** va ataylab `findFirst` ga o'tgan (2.4-bo'limga qarang). Ya'ni intizom
> bor. Lekin intizom — kafolat emas.

**TZ uchun xulosa:** yechim faqat `findMany` va `findUnique` ni emas, **hamma
operatsiyani** qamrashi kerak. `$allModels.$allOperations` aynan shuni beradi.

### 2.2. Namuna: `students.service.ts` — to'g'ri qilingan

`students.service.ts` (2079 qator — eng katta servis) intizomning yaxshi namunasi.
Tenant har metodda birinchi qatorda olinadi va `where` ga qo'lda qo'shiladi:

`apps/api/src/modules/students/students.service.ts:87-98`:

```ts
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const q = String(args.q || '').trim();
      const limit = Math.max(1, Math.min(200, Number(args.limit || 50)));
      const offset = Math.max(0, Number(args.offset || 0));
      const sortBy = args.sortBy || 'id';
      const sortDir = args.sortDir || 'desc';

      // Build where clause
      const where: Prisma.studentsWhereInput = {
        tenant_id,
```

Va `tenantId` controller da **JWT dan** olinadi, mijoz parametridan emas —
`apps/api/src/modules/students/students.controller.ts:66-68`:

```ts
  list(@Req() req: any, @Query() query: StudentListQuery) {
    return this.studentsService.list({
      tenantId: String(req.user?.tenantId || ''),
```

**Bu to'g'ri.** Muammo bu kodda emas. Muammo shundaki, **bu to'g'rilik 845 marta
takrorlanishi kerak va uni hech narsa majburlamaydi**.

### 2.3. Bir metodda tenant necha marta yoziladi

`students.service.ts:256-530` — `create()` metodi. Bitta metodda `tenant_id`
**17 marta** yoziladi:

```
299:  where: { id: tenant_id }              // tenants.findUnique
310:  tenant_id,                            // campuses.findFirst
324:  tenant_id,                            // groups.findFirst
337:  tenant_id,                            // student_tracks.findFirst
345:  tenant_id,                            // student_tracks.create
360:  tenant_id,                            // living_types.findFirst
371:  where: { tenant_id },                 // student_id_sequences.upsert
372:  create: { tenant_id, last_seq: 1 },
386:  tenant_id,                            // students.create
407:  tenant_id,                            // student_accounts.create
426:  tenant_id,                            // student_group_history.create
439:  tenant_id,                            // student_living_history.create
453:  tenant_id,                            // cohorts.findFirst
462:  tenant_id,                            // cohorts.create
481:  tenant_id,                            // student_cohort ...
492:  tenant_id,                            // student_timeline.create
```

**17 ta imkoniyat xato qilish uchun. Bitta metodda.** Va bu 30 servisdan bittasi.

Butun kod bazasida `tenant_id` matni **953 marta** uchraydi:

```bash
grep -ro "tenant_id" --include=*.ts apps/api/src | wc -l   # → 953
```

953 ta qo'lda yozilgan `tenant_id`. Har biri — potensial xato nuqtasi.

### 2.4. `findUnique` muammosi allaqachon ma'lum bo'lgan

Kod muallifi `findUnique` ning tenant filtri qabul qilmasligini bilgan va uni
**qo'lda `findFirst` ga aylantirgan**. Bu — nima uchun `findFirst` 272 marta
ishlatilganining sababi.

`apps/api/src/modules/students/students.service.ts:538-539`:

```ts
      const student = await this.prisma.students.findFirst({
        where: { id, tenant_id },
```

`students` ning PK si `id`. "To'g'ri" Prisma usuli — `findUnique({ where: { id } })`.
Lekin unda tenant filtri yo'q. Shuning uchun `findFirst` ishlatilgan.

**Bu — muallifning to'g'ri qarori.** Va bu TZ uchun muhim signal: yechim shu
naqshni **avtomatlashtirishi** kerak, uni buzmasligi kerak (4.6-bo'lim).

### 2.5. Xavfsiz `findUnique` lar — compound unique tenant bilan

65 ta `findUnique` ning bir qismi **allaqachon xavfsiz**, chunki compound unique
kalitning o'zida `tenant_id` bor.

`apps/api/src/modules/auth/auth.service.ts:187-195`:

```ts
    const lock = await this.prisma.auth_locks.findUnique({
      where: {
        tenant_id_account_type_username_or_id: {
          tenant_id: tenantId,
          account_type: accountType,
          username_or_id: usernameOrId,
        },
      },
      select: { locked_until: true, reason: true },
    });
```

`apps/api/src/modules/notifications/notifications.service.ts:495-503`:

```ts
        const template = await this.prisma.notification_templates.findUnique({
          where: {
            tenant_id_code_channel: {
              tenant_id,
              code: dto.templateCode,
              channel: dto.channel,
            },
          },
        });
```

**Bu naqsh — eng yaxshi yechim.** `tenant_id` unique kalitning **bir qismi**, ya'ni
uni tushirib qoldirish TypeScript xatosi beradi. Kompilyator kafolatlaydi.

⚠️ **TZ uchun tavsiya:** yangi modellarda unique constraint **doim** `tenant_id`
bilan boshlansin: `@@unique([tenant_id, code])`. Bu extension dan ham kuchliroq —
chunki bu **tip darajasidagi** kafolat.

### 2.6. ⚠️ Kanon aytmagan muammo: 18 model `tenant_id` siz

Bu — o'lchash paytida topilgan va **kanonda yo'q** yangi fakt. TZ ning eng muhim
texnik kashfiyoti.

O'lchash:

```bash
cd apps/api
awk '/^model /{name=$2; has=0}
     /tenant_id/{if(name!="")has=1}
     /^}/{if(name!=""){printf "%-30s %s\n", name, (has?"OK":"NO tenant_id"); name=""}}' \
  prisma/schema.prisma
```

**Natija: 69 modeldan 51 tasida `tenant_id` bor, 18 tasida YO'Q.**

`tenant_id` **yo'q** 18 model:

| Model | Turi | Tenantga qanday bog'langan |
|---|---|---|
| `tenants` | **Chinakam global** | — bu tenantning o'zi |
| `permissions` | **Chinakam global** | — tizim ruxsatlar katalogi |
| `assessment_scores` | Bola jadval | `assessments.tenant_id` orqali |
| `attendance_marks` | Bola jadval | `attendance_sessions.tenant_id` orqali |
| `award_recipients` | Bola jadval | `awards.tenant_id` orqali |
| `competition_entries` | Bola jadval | `competitions.tenant_id` orqali |
| `competition_results` | Bola jadval | `competitions.tenant_id` orqali |
| `display_items` | Bola jadval | `display_playlists.tenant_id` orqali |
| `dorm_announcement_prices` | Bola jadval | `dorm_payment_announcements.tenant_id` orqali |
| `dorm_rooms` | Bola jadval | `dorms.tenant_id` orqali |
| `event_participants` | Bola jadval | `events.tenant_id` orqali |
| `grade_snapshot_rows` | Bola jadval | `grade_snapshots.tenant_id` orqali |
| `group_subjects` | Bog'lovchi | `groups.tenant_id` orqali |
| `meal_announcement_prices` | Bola jadval | `meal_payment_announcements.tenant_id` orqali |
| `role_permissions` | Bog'lovchi | `roles.tenant_id` orqali |
| `student_cohort` | Bog'lovchi | `students.tenant_id` orqali |
| `timetable_lessons` | Bola jadval | `timetable.tenant_id` orqali |
| `user_roles` | Bog'lovchi | `users.tenant_id` orqali |

> ⚠️ **Hal qiluvchi farq:** 18 tadan **faqat 2 tasi** (`tenants`, `permissions`)
> chinakam global. Qolgan **16 tasi tenant-scoped — shunchaki ustuni yo'q.**
>
> Bu shuni anglatadiki, extension ning allowlist i **"`tenant_id` ustuni yo'qmi →
> o'tkazib yubor"** qoidasi bo'lsa — **16 ta model jimgina himoyasiz qoladi.**
> Bu — yechimni yechim emas, **xavfsizlik illyuziyasi** qiladi.

**Diqqat: `roles` da `tenant_id` BOR.** TZ topshirig'idagi "`roles`?" savoliga javob:
**yo'q, `roles` allowlist ga kirmaydi** — u tenant-scoped model, extension uni
avtomatik filtrlashi kerak. Faqat `permissions` (global katalog) va `role_permissions`
(bog'lovchi, `roles` orqali) alohida muomala talab qiladi.

### 2.7. Bu 16 model amalda ishlatiladimi — ha

```bash
cd apps/api/src/modules
for m in assessment_scores attendance_marks dorm_rooms timetable_lessons \
         user_roles student_cohort display_items competition_entries; do
  printf "%-24s %s\n" "$m" "$(grep -ro "\.$m\." --include=*.ts . | wc -l)"
done
```

| Model | Chaqiruvlar |
|---|---:|
| `dorm_rooms` | 20 |
| `attendance_marks` | 18 |
| `timetable_lessons` | 17 |
| `assessment_scores` | 16 |
| `competition_entries` | 16 |
| `display_items` | 15 |
| `event_participants` | 11 |
| `student_cohort` | 10 |
| `user_roles` | 10 |
| `grade_snapshot_rows` | 6 |
| `award_recipients` | 6 |
| `role_permissions` | 6 |
| `group_subjects` | 5 |
| `competition_results` | 4 |
| `meal_announcement_prices` | 1 |
| `dorm_announcement_prices` | 1 |

**Jami ~162 ta chaqiruv, extension avtomatik himoyalay olmaydigan modellarga.**

### 2.8. Real misol — himoya faqat tasodifan ishlaydi

`apps/api/src/modules/students/students.service.ts:635-636`:

```ts
      const recentAssessments = await this.prisma.assessment_scores.findMany({
        where: { student_id: id },
```

**`tenant_id` filtri yo'q.** Va `assessment_scores` da `tenant_id` ustuni ham yo'q.

Nega bu hozir **sizmaydi**? Chunki 97 qator yuqorida, `students.service.ts:538-539`
da `id` allaqachon tekshirilgan:

```ts
      const student = await this.prisma.students.findFirst({
        where: { id, tenant_id },
      });
```

Agar `id` boshqa tenantning o'quvchisi bo'lsa, `student` = `null` va metod
`NotFoundException` bilan tugaydi — 635-qatorga yetmaydi.

> ⚠️ **Ya'ni himoya — chaqiruvlar tartibiga bog'liq.** U `assessment_scores`
> so'rovining o'zida emas. Kimdir 538-qatordagi tekshiruvni refaktor paytida
> olib tashlasa yoki 635-qatorni boshqa metodga ko'chirsa — **filtr jimgina
> yo'qoladi va hech qanday test buni tutmaydi** (chunki test yo'q).

Xuddi shu naqsh `students.service.ts:655-663`:

```ts
      const attendanceSummary = await this.prisma.attendance_marks.groupBy({
        by: ['status'],
        where: {
          students: { id: student.id },
          attendance_sessions: {
            session_date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
```

`attendance_marks` da ham `tenant_id` yo'q. `attendance_sessions` filtri bor lekin
**faqat sana bo'yicha** — `tenant_id` yo'q. Yana chaqiruv tartibiga tayanadi.

### 2.9. `update`/`delete` — `id` bo'yicha, tenant siz

`apps/api/src/modules/auth/auth.service.ts:465-468`:

```ts
      await this.prisma.users.update({
        where: { id: user.id },
        data: { last_login_at: now(), updated_at: now() },
      });
```

Bu **xavfsiz**, chunki `user` 424-qatorda `findFirst({ where: { tenant_id, username } })`
bilan olingan. Yana — **chaqiruv tartibiga bog'liq himoya**.

Lekin 79 ta `update` va 37 ta `delete` ning har biri shunday tekshirilganini
**hech kim isbotlay olmaydi**. Test yo'q. Faqat ko'z bilan tekshirilgan.

### 2.10. Yagona raw query — va u to'g'ri

```bash
grep -rn "queryRaw\|executeRaw" --include=*.ts apps/api/src
# → apps/api/src/modules/ranking/ranking.service.ts:261
```

**Butun kod bazasida bitta raw query.** `apps/api/src/modules/ranking/ranking.service.ts:39-64`:

```ts
    return Prisma.sql`
      WITH totals AS (
        SELECT
          s.id AS student_id,
          ...
        FROM students s
        LEFT JOIN assessment_scores sc
          ON sc.student_id = s.id
        LEFT JOIN assessments a
          ON a.id = sc.assessment_id
         AND a.tenant_id = ${tenantId}
         AND a.group_id = ${groupId}
         AND a.held_at::date >= ${start}::date
         AND a.held_at::date <= ${end}::date
        WHERE s.tenant_id = ${tenantId}
          AND s.current_group_id = ${groupId}
          AND s.status = 'ACTIVE'
        GROUP BY s.id
      ),
      latest_risk AS (
        SELECT DISTINCT ON (student_id)
          student_id, level
        FROM student_risk_scores
        WHERE tenant_id = ${tenantId}
        ORDER BY student_id, calculated_at DESC, id DESC
      ),
```

**Halol baho: bu query TO'G'RI yozilgan.** Tenant uch joyda filtrlangan
(`a.tenant_id`, `s.tenant_id`, `student_risk_scores.tenant_id`), parametrlar
`Prisma.sql` tagged template orqali — SQL injection yo'q.

Lekin ⚠️ **`assessment_scores` (53-54 qator) filtrlanmagan** — u `s.id` va
`a.id` orqali join qilingan, ya'ni yana **bilvosita** himoyalangan. Agar
`a.tenant_id` sharti `LEFT JOIN` `ON` dan `WHERE` ga ko'chirilsa yoki olib
tashlansa — cross-tenant ball hisoblanadi.

Va 261-qatordagi `INSERT INTO grade_snapshot_rows` — `grade_snapshot_rows` da
`tenant_id` yo'q, ya'ni yozuvning tenanti faqat `snapshot_id` orqali bilinadi.

> **Muhim:** extension bu query ni **ushlamaydi** (4.9-bo'lim). Ya'ni raw query
> yozilganda `tenant_id` **har doim qo'lda** yozilishi kerak — bu qoida qoladi.
> Yaxshi xabar: hozir bitta raw query bor va u to'g'ri.

### 2.11. `tenants.service.ts` — yagona haqiqiy istisno

`apps/api/src/modules/tenants/tenants.service.ts` — 268 qator, `tenant_id` filtri
**yo'q**. Va bu **to'g'ri**: bu servis tenantlarning o'zini boshqaradi.

`tenants.service.ts:87` — `where` bo'sh boshlanadi:

```ts
      const where: Prisma.tenantsWhereInput = {};
      if (args.query.q) {
```

`tenants.service.ts:107-115` — hamma tenant qaytariladi:

```ts
      const [total, items] = await this.prisma.$transaction([
        this.prisma.tenants.count({ where }),
        this.prisma.tenants.findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
      ]);
```

⚠️ **Lekin savol bor:** bu endpoint kim uchun? Agar oddiy tenant admini
`GET /api/staff/tenants` ni chaqira olsa — u **barcha akademiyalar ro'yxatini**
ko'radi (nom, slug, timezone). Bu to'g'ridan-to'g'ri o'quvchi ma'lumoti emas,
lekin **raqobat ma'lumoti** — "kim bizning raqibimiz shu tizimda". Bu 9-bo'limda
ko'rib chiqiladi.

### 2.12. Audit xulosasi

| Fakt | Raqam | Manba |
|---|---:|---|
| Butun `src/` da Prisma chaqiruvlari | **845** | grep, 13 ta operatsiya bo'yicha |
| Ulardan `findFirst` (eng katta toifa) | **272** | grep |
| `*.service.ts` da `findMany` + `findUnique` | **176** | grep — kanon shu tor kesimni sanagan |
| `tenant_id` matni | **953** | grep |
| Prisma modellari | **69** | `grep -c "^model "` |
| `tenant_id` **bor** modellar | **51** | awk skript |
| `tenant_id` **yo'q** modellar | **18** | awk skript |
| Ulardan chinakam **global** | **2** | qo'lda tahlil |
| Ulardan **himoyasiz bola jadval** | **16** | qo'lda tahlil |
| 16 modelga chaqiruvlar | **~162** | grep |
| Raw query | **1** (to'g'ri yozilgan) | grep |
| `tenant.util.ts` ishlatilishi | **0** | grep |
| Tenant izolyatsiya testi | **0** | — |

**Eng muhim xulosa:** muammo kanon aytganidan **~5 barobar kattaroq**. 176 emas —
845 nuqta, plus 16 ta strukturaviy himoyasiz model. Lekin yechim ham kuchliroq:
bitta extension 845 nuqtaning hammasini bir vaqtda yopadi.

---

## 3. ⚠️ `tenant.util.ts` — o'lik kod fojiasi

### 3.1. Faylning to'liq kodi

`apps/api/src/common/utils/tenant.util.ts` — **44 qator, to'liq**:

```ts
import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../auth/jwt-request.util';
import { parseBigIntId } from './bigint.util';

export function getUserTenantId(user: RequestUser): bigint {
  try {
    return parseBigIntId(user?.tenantId, 'tenant_id');
  } catch {
    throw new ForbiddenException('INVALID_TENANT');
  }
}

export function ensureTenantId(
  user: RequestUser,
  tenantId?: bigint | string | number,
): bigint {
  const userTenantId = getUserTenantId(user);

  if (tenantId === null || tenantId === undefined || tenantId === ('' as any)) {
    return userTenantId;
  }

  const requestedTenantId = parseBigIntId(tenantId, 'tenant_id');
  if (requestedTenantId !== userTenantId) {
    throw new ForbiddenException('TENANT_MISMATCH');
  }
  return requestedTenantId;
}

export function withTenantCondition<T extends Record<string, any>>(
  user: RequestUser,
  where: T = {} as T,
): T & { tenant_id: bigint } {
  const userTenantId = getUserTenantId(user);

  if (where.tenant_id !== undefined && where.tenant_id !== null) {
    const requested = parseBigIntId(where.tenant_id, 'tenant_id');
    if (requested !== userTenantId)
      throw new ForbiddenException('TENANT_MISMATCH');
    return where as any;
  }

  return { ...(where as any), tenant_id: userTenantId };
}
```

### 3.2. Isbot: hech qayerda ishlatilmaydi

```bash
grep -rn "withTenantCondition\|ensureTenantId\|getUserTenantId" \
  --include=*.ts apps/
```

Natija — **5 ta qator, hammasi faylning o'zida**:

```
apps/api/src/common/utils/tenant.util.ts:5:export function getUserTenantId(...)
apps/api/src/common/utils/tenant.util.ts:13:export function ensureTenantId(
apps/api/src/common/utils/tenant.util.ts:17:  const userTenantId = getUserTenantId(user);
apps/api/src/common/utils/tenant.util.ts:30:export function withTenantCondition<T ...>(
apps/api/src/common/utils/tenant.util.ts:34:  const userTenantId = getUserTenantId(user);
```

Import qidiruvi:

```bash
grep -rn "tenant.util" --include=*.ts apps/
# → (bo'sh)
```

> **Nol import. Nol chaqiruv. 44 qator o'lik kod.**
>
> `apps/api` da 37 294 qator bor. Bu 44 qator — 0.12%. Lekin ular aynan
> loyihaning **eng muhim invariantini** da'vo qiladi.

### 3.3. Kod tahlili — u yaxshi yozilganmi?

**Ha, asosan.** Har uch funksiya ham to'g'ri fikrlangan:

**`getUserTenantId()` (5-11)** — ✅ to'g'ri.
`parseBigIntId` orqali BigInt intizomiga rioya qiladi (kanon §5.2). Xato bo'lsa
`ForbiddenException('INVALID_TENANT')` — 403, ma'lumot sizdirmaydi.

**`ensureTenantId()` (13-28)** — ✅ to'g'ri va aqlli.
So'ralgan `tenantId` JWT dagidan farq qilsa `TENANT_MISMATCH` (403). Bo'sh bo'lsa
JWT dagini qaytaradi. Bu — "mijozdan kelgan tenantga hech qachon ishonma" qoidasining
to'g'ri implementatsiyasi.

**`withTenantCondition()` (30-44)** — ✅ to'g'ri, lekin ⚠️ cheklangan.
`where` ga `tenant_id` qo'shadi, agar allaqachon bor bo'lsa moslikni tekshiradi.

### 3.4. Lekin uning **arxitekturaviy** kamchiligi bor

Agar bu kod ishlatilganda ham, **845 nuqtani 845 ga qoldirardi**:

```ts
// tenant.util.ts bilan bo'lsa:
const where = withTenantCondition(user, { status: 'ACTIVE' });
const students = await this.prisma.students.findMany({ where });

// hozirgi kod:
const students = await this.prisma.students.findMany({
  where: { tenant_id, status: 'ACTIVE' },
});
```

**Farqi nima? Deyarli hech narsa.** Ikkalasida ham dasturchi **eslashi** kerak.
`withTenantCondition()` chaqirishni unutish — `tenant_id` yozishni unutish bilan
bir xil xato.

> **Bu — o'lik kodning eng chuqur sababi.** U ishlatilmagani tasodif emas: u
> **hech narsani osonlashtirmaydi**. `withTenantCondition(user, {...})` yozish
> `{ tenant_id, ... }` yozishdan **uzunroq**. Dasturchi tabiiy ravishda qisqasini
> tanlagan.
>
> Yaxshi abstraksiya — **to'g'ri yo'lni oson yo'l** qiladigan abstraksiya.
> `tenant.util.ts` buni qilmaydi. Shuning uchun o'lgan.

Yana bir kamchilik: `withTenantCondition()` `user` obyektini **argument sifatida**
talab qiladi. Ya'ni har servis metodi `RequestUser` ni controller dan qabul qilishi
kerak. Hozirgi kod bunday emas — servislar `tenantId: string` qabul qiladi
(`students.service.ts:71`). Ya'ni `tenant.util.ts` ni ishlatish uchun **30 servisning
imzosini o'zgartirish** kerak edi. Buni hech kim qilmagan.

### 3.5. Nega o'lik himoya himoyasizlikdan YOMONROQ

Bu — bu bo'limning asosiy da'vosi. Uch sabab:

**1. U auditni chalg'itadi.**
Xavfsizlik auditori (yoki yangi dasturchi, yoki kelajakdagi Claude chati)
`common/utils/` ga qaraydi, `tenant.util.ts` ni ko'radi, `withTenantCondition()`
ni o'qiydi va xulosa qiladi: **"tenant izolyatsiyasi hal qilingan"**. Va keyingi
faylga o'tadi. **Grep qilmaydi.**

Agar bu fayl **umuman bo'lmaganda**, o'sha auditor darhol so'rardi:
"tenant izolyatsiyasi qayerda?" — va 845 ta qo'lda nuqtani topardi.

> **Ya'ni fayl mavjudligi — muammoni topishga to'sqinlik qiladi.**
> Yo'q himoya "yo'q" deb ko'rinadi. O'lik himoya "bor" deb ko'rinadi.

**2. U yolg'on ishonch beradi.**
Kod-review paytida: "Bu yerda tenant filtri yo'q-ku?" — "Ha, lekin bizda
`tenant.util.ts` bor, u hal qiladi." Hech kim tekshirmaydi.

**3. U tuzatishni kechiktiradi.**
"Multi-tenancy ni ko'rib chiqish kerak" backlog da turadi. Kimdir aytadi:
"Yo'q, u allaqachon qilingan, `tenant.util.ts` da." Tiket yopiladi.

### 3.6. Yana bir signal: bu kod qachondir rejalashtirilgan

`tenant.util.ts` ning mavjudligi shuni ko'rsatadiki, muallif **muammoni bilgan**
va yechim yozgan. Lekin yechim **noto'g'ri qatlamda** edi (servis argumenti, data
qatlami emas), shuning uchun qabul qilinmagan.

**Bu — TZ uchun eng qimmatli dars:** yechim to'g'ri qatlamda bo'lishi kerak —
**Prisma client ning o'zida**, ya'ni chetlab o'tish **imkonsiz** joyda.

### 3.7. Qaror: fayl bilan nima qilinadi

`tenant.util.ts` ning uch funksiyasidan **ikkitasi** yangi arxitekturada
**qayta tug'iladi**:

| Funksiya | Taqdiri |
|---|---|
| `getUserTenantId()` | ✅ **Saqlanadi**, `tenant-context.ts` ga ko'chadi — ALS ga tenant yozishdan oldin JWT ni parse qilish uchun aynan shu kerak |
| `ensureTenantId()` | ✅ **Saqlanadi** — mijoz `tenantId` yuborgan joylarda (agar bunday endpoint bo'lsa) kerak bo'ladi. Superadmin impersonation da ham (9-bo'lim) |
| `withTenantCondition()` | ❌ **O'chiriladi** — extension uning ishini avtomatik bajaradi. Qolsa — yana o'lik kod bo'ladi |

⚠️ **1-bosqichda `tenant.util.ts` O'CHIRILMAYDI** — u extension ishga
tushirilgandan va test o'tgandan keyin (5-bosqich) o'chiriladi. Sabab: bir vaqtda
ikki narsani o'zgartirmaslik.

Lekin **darhol** (birinchi kun, extension dan oldin) faylning boshiga
ogohlantirish qo'shiladi — chunki o'lik kodning eng katta zarari **chalg'itish**:

```ts
/**
 * ⚠️ DEAD CODE — DO NOT RELY ON THIS FOR TENANT ISOLATION.
 *
 * As of 2026-07-15 these helpers have ZERO call sites (verified by grep).
 * Tenant isolation in this codebase is currently enforced by MANUAL `tenant_id`
 * handling at 845 Prisma call sites across src/, NOT by this file.
 *
 * The structural replacement is the Prisma client extension in
 * `src/prisma/tenant.extension.ts` — see docs/03-multi-tenancy.md.
 *
 * `withTenantCondition()` will be REMOVED once the extension migration
 * completes (docs/03-multi-tenancy.md §5, phase 5).
 * `getUserTenantId()` / `ensureTenantId()` will move to
 * `src/common/tenant/tenant-context.ts`.
 */
```

> **Nega bu birinchi kun qilinadi:** kommentni qo'shish 2 daqiqa, xavfi nol, va
> u yolg'on ishonchni **darhol** to'xtatadi. Extension esa haftalar oladi.

---

### 3.8. ⚠️ Qo'shimcha topilma: `guardian-student.controller.ts` — servis qatlamini aylanib o'tish

Audit paytida topilgan **eng jiddiy real naqsh**. Bu faraz emas — kodda turibdi.

#### 3.8.1. Bracket notation bilan `private` maydonga kirish

```bash
grep -rn "\['prisma'\]" --include=*.ts apps/api/src
```

**6 ta natija, hammasi bitta faylda** — `apps/api/src/modules/students/guardian-student.controller.ts`:

| Qator | Model | `tenant_id` ustuni bormi | So'rovda tenant filtri |
|---|---|---|---|
| `:151` | `student_accounts` | ✅ bor | ❌ **yo'q** |
| `:163` | `assessment_scores` | ❌ **yo'q** | ❌ **yo'q** |
| `:465` | `violations` | ✅ bor | ❌ **yo'q** |
| `:558` | `invoices` | ✅ bor | ❌ **yo'q** |
| `:887` | `students` | ✅ bor | ❌ **yo'q** |
| `:902` | `timetable` | ✅ bor | ❌ **yo'q** |

`apps/api/src/modules/students/guardian-student.controller.ts:161-166`:

```ts
    // Get grades - we need to add this method to StudentsService
    const grades = await this.studentsService[
      'prisma'
    ].assessment_scores.findMany({
      where: {
        student_id: account.student_id,
        assessments: {
          is_published_to_guardians: true,
        },
      },
```

Bu yerda **uchta** alohida muammo bor:

**1. `this.studentsService['prisma']` — TypeScript `private` ni chetlab o'tish.**

`students.service.ts:65` da maydon `private` deb e'lon qilingan:

```ts
  constructor(private readonly prisma: PrismaService) {
```

Bracket notation (`obj['prisma']`) TypeScript ning `private` tekshiruvini **kompilyatsiya
vaqtida chetlab o'tadi** — bu TypeScript ning ma'lum "escape hatch" i. Ya'ni controller
**servis qatlamini butunlay aylanib o'tib**, to'g'ridan-to'g'ri Prisma ga kiryapti.

**2. Muallif buni vaqtinchalik deb bilgan.**

161-qatordagi komment: `// Get grades - we need to add this method to StudentsService`.

Ya'ni muallif **bilgan** bu noto'g'riligini, "keyin tuzataman" degan. Va shunday
qolgan. Bu — texnik qarzning klassik ko'rinishi.

**3. Tenant filtri umuman yo'q.**

Xavfsizlik **faqat** `account.student_id` ga tayanadi, u esa `:151` da
`student_accounts.findUnique({ where: { id: BigInt(studentAccountId) } })` dan
kelgan — **bu ham tenant filtrsiz**, faqat JWT dagi `studentAccountId` ga tayanadi.

Ya'ni: **ota-onaning farzandi bahosini himoya qiladigan yagona narsa — JWT dagi
`studentAccountId` ning to'g'riligi.** Zanjirda bitta halqa. Agar `account`
qidiruvida xato bo'lsa — boshqa akademiyaning bolasi bahosi ochiladi.

> ⚠️ **Bu — "intizomga tayangan himoya yetarli emas" degan da'voning real isboti.**
> Muallif intizomli — `students.service.ts` da 17 marta `tenant_id` yozgan. Lekin
> **bitta shoshilinch controller** butun intizomni aylanib o'tgan. Va buni hech
> narsa to'xtatmagan: na tip tizimi, na lint, na test, na code review.

#### 3.8.2. `violations` va `invoices` — extension bularni AVTOMATIK tuzatadi

Muhim nuqta: `:465` (`violations`) va `:558` (`invoices`) — bu modellarda
`tenant_id` ustuni **bor** (§2.6 dagi 51 ta modeldan).

`guardian-student.controller.ts:465-469`:

```ts
    const violations = await this.studentsService['prisma'].violations.findMany(
      {
        where: {
          student_id: account.student_id,
        },
```

**`violations` da `tenant_id` bor, lekin so'rovda ishlatilmagan.**

> ✅ **Yaxshi xabar:** extension o'rnatilgach, bu **4 ta so'rov (`:465`, `:558`,
> `:887`, `:902`) avtomatik tuzatiladi** — chunki modellarda `tenant_id` ustuni
> bor va extension uni majburan qo'shadi. Bir qator kod o'zgartirmasdan.
>
> ⚠️ **Yomon xabar:** `:163` (`assessment_scores`) **avtomatik tuzatilmaydi** —
> ustun yo'q. U tenant yo'l xaritasini talab qiladi (§4.7).

Bu — extension ning qiymatini eng yaxshi ko'rsatadigan misol: **u allaqachon
mavjud, hech kim bilmagan 4 ta teshikni yopadi.**

#### 3.8.3. Uchta naqsh — himoyaning uch darajasi

Bir xil jadval (`assessment_scores`) uch xil himoyalangan. Bu — muammoning
mohiyatini ko'rsatadi.

#### Naqsh 1 — ✅ TO'G'RI: ota orqali scope

`apps/api/src/modules/assessments/assessments.service.ts:908-918`:

```ts
  async getPerformanceSummary(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');

    const scores = await this.prisma.assessment_scores.findMany({
      where: {
        assessments: {
          tenant_id,
          is_published_to_guardians: true,
        },
      },
      select: {
        score: true,
      },
    });
```

**Kafolat so'rovning O'ZIDA.** `assessment_scores` da `tenant_id` yo'q, shuning
uchun `assessments` relatsiyasi orqali filtrlangan. Bu so'rovni kontekstdan
ajratib olsangiz ham — u xavfsiz.

> **Bu — extension nusxa ko'chirishi kerak bo'lgan naqsh.** §4.7 aynan shuni
> avtomatlashtiradi.

#### Naqsh 2 — ⚠️ MO'RT: ma'lumot oqimi bo'yicha xavfsiz

`apps/api/src/modules/ranking/ranking.service.ts:127-133`:

```ts
      // Fetch all scores for those assessments
      const scores = await this.prisma.assessment_scores.findMany({
        where: {
          assessment_id: { in: assessments.map((a) => a.id) },
          student_id: { in: students.map((s) => s.id) },
        },
        select: { assessment_id: true, student_id: true, score: true },
      });
```

**So'rovda tenant filtri yo'q.** U xavfsiz, chunki 22 qator yuqorida
(`ranking.service.ts:106-120`) ikkala massiv ham tenant bo'yicha filtrlangan:

```ts
      const assessments = await this.prisma.assessments.findMany({
        where: {
          tenant_id: tenantId,
          group_id: groupId,
          ...
      const students = await this.prisma.students.findMany({
        where: { tenant_id: tenantId, current_group_id: groupId, status: 'ACTIVE' },
```

> ⚠️ **Kafolat so'rovda emas — MA'LUMOT OQIMIDA.** U 22 qator masofada, boshqa
> ikki so'rovda yashaydi.
>
> Kimdir `assessments` so'rovidan `tenant_id` ni olib tashlasa (masalan "global
> hisobot kerak" deb), `scores` so'rovi **jimgina** cross-tenant bo'ladi.
> Kompilyator jim. Lint jim. Test yo'q. **Hech narsa ushlamaydi.**

#### Naqsh 3 — 🔴 XAVFLI: bitta halqaga tayangan

`guardian-student.controller.ts:163` (yuqorida, §3.8.1).

| | Naqsh 1 | Naqsh 2 | Naqsh 3 |
|---|---|---|---|
| Kafolat qayerda | So'rovda | 22 qator narida | JWT da, servis aylanib o'tilgan |
| Kontekstdan ajratsa | Xavfsiz | **Sizadi** | **Sizadi** |
| Extension tuzatadimi | Kerak emas | ✅ ha (xarita bilan) | ✅ ha (xarita bilan) |
| Hozir sizadimi | Yo'q | Yo'q | Yo'q (lekin bitta halqa) |

**Uchalasi ham hozir to'g'ri natija qaytaradi.** Muammo shundaki, ikkitasining
to'g'riligi **tasodifiy** — u kodning boshqa qismiga bog'liq.

#### 3.8.4. Darhol qilinadigan ish

`guardian-student.controller.ts` dagi 6 ta bracket-notation chaqiruvi
**extension dan oldin** ham tuzatilishi kerak — chunki ular arxitektura buzilishi:

1. Har biri `StudentsService` ga to'g'ri metod sifatida ko'chiriladi
   (muallifning `// we need to add this method to StudentsService` kommenti aynan shuni deydi)
2. Har metod `tenantId` qabul qiladi va filtrlaydi
3. Lint qoidasi qo'shiladi: `['prisma']` bracket-access **taqiqlanadi** (§5.4)

Bu — extension dan **mustaqil** ish va u 1-bosqichdan oldin bajarilishi mumkin.

---

## 4. Yechim: Prisma Client Extension (`$extends`)

### 4.1. Asosiy g'oya

Tenant filtri **servisda emas, Prisma client ning o'zida** qo'shiladi. Servis
`tenant_id` yozmaydi — u **avtomatik** qo'shiladi.

```
HOZIR:                              KEYIN:

Controller                          Controller
  ↓ tenantId: string                  ↓ (hech narsa)
Service                             Service
  ↓ where: { tenant_id, ... }         ↓ where: { ... }
Prisma                              Prisma + extension
  ↓                                   ↓ where: { tenant_id, ... }  ← AVTOMATIK
PostgreSQL                          PostgreSQL

Kafolat: dasturchi eslasa           Kafolat: struktura
```

**Nega bu `tenant.util.ts` dan farq qiladi (§3.4):** `withTenantCondition()` ni
chaqirishni **unutish mumkin edi**. Extension ni **chetlab o'tib bo'lmaydi** —
u `PrismaService` ning o'zida yashaydi, va boshqa Prisma client yo'q.

### 4.2. Nega AsyncLocalStorage, nega request-scoped provider emas

Extension `tenant_id` ni qayerdan oladi? U request haqida hech narsa bilmaydi.

**Variant A — NestJS request-scoped provider.** ❌ Rad etiladi.

```ts
@Injectable({ scope: Scope.REQUEST })   // ← BUNI QILMANG
export class PrismaService extends PrismaClient { ... }
```

Sabab — **NestJS DI ning "bubbling up" xususiyati**: provider `REQUEST` scope
bo'lsa, uni inject qiladigan **har bir** provider ham avtomatik request-scoped
bo'ladi. Va ularni inject qilganlar ham. Zanjir yuqoriga ko'tariladi.

`PrismaService` ni **hamma** servis inject qiladi (`students.service.ts:65`,
`tenants.service.ts:26`, `access.guard.ts:10`, `perms.guard.ts:17`, ...). Ya'ni:

> **`PrismaService` request-scoped bo'lsa — 32 servis, 37 controller va 3 guard
> ning HAMMASI request-scoped bo'ladi.** Har HTTP request da butun DI daraxti
> qaytadan quriladi.

Narxi:
- Har request da 32 servis + `AuditLogger` instansiyasi yaratiladi
  (`students.service.ts:66` — `new AuditLogger(prisma)` konstruktorda)
- Guard lar request-scoped bo'lsa NestJS ularni har request da qayta quradi
- ⚠️ **Eng yomoni:** `PrismaClient` ning o'zi qayta yaratilsa — **connection pool
  ham qayta yaratiladi**. Bu qabul qilib bo'lmaydigan narsa

> ⚠️ **Aniq sekinlashuv foizi o'lchov bilan aniqlanadi** — raqam to'qib
> chiqarmaymiz. Lekin arxitekturaviy sabab yetarli: connection pool ni request ga
> bog'lash **printsipial xato**.

**Variant B — `AsyncLocalStorage` (Node.js `async_hooks`).** ✅ Tanlanadi.

`AsyncLocalStorage` — Node.js ning standart moduli (v12.17+, `node:async_hooks`).
U **async chaqiruvlar zanjiri bo'ylab kontekst uzatadi**, DI ga tegmasdan.

```
request keladi
  → als.run({ tenantId: 5n }, () => next())
      → guard      ── als.getStore() → { tenantId: 5n }
      → controller ── als.getStore() → { tenantId: 5n }
      → service    ── als.getStore() → { tenantId: 5n }
      → extension  ── als.getStore() → { tenantId: 5n }   ← shu yerda kerak
```

Afzalliklari:
- `PrismaService` **singleton** qoladi. Pool bitta
- Servis imzolari o'zgarmaydi
- DI daraxti o'zgarmaydi
- `await` orqali ham, `Promise.all` orqali ham kontekst yo'qolmaydi

Kamchiliklari (halol):
- ⚠️ **Yashirin bog'liqlik.** Funksiya imzosida `tenantId` ko'rinmaydi — u
  "havoda". Bu — o'qilishni qiyinlashtiradi
- ⚠️ **Performance:** `async_hooks` ning oz miqdorda overhead i bor. Node 16+ da
  bu sezilarli emas, lekin **o'lchov bilan tasdiqlansin**
- ⚠️ **Kontekstdan tashqari kod.** Cron job, CLI skript, `seed.ts` — ularda
  request yo'q, ya'ni ALS bo'sh. Buni **ataylab** hal qilish kerak (§4.5)

### 4.3. `tenant-context.ts` — ALS store

Yangi fayl: `apps/api/src/common/tenant/tenant-context.ts`

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../auth/jwt-request.util';
import { parseBigIntId } from '../utils/bigint.util';

/**
 * Why the store is an object and not a bare bigint:
 * we need to distinguish three states, not two.
 *
 *   1. no store at all      -> we are outside a request (cron, seed, CLI)
 *   2. store, tenantId set  -> normal request, filter by that tenant
 *   3. store, bypass: true  -> deliberate cross-tenant access (see section 9)
 *
 * Collapsing 1 and 3 is exactly the mistake that makes a "safe by default"
 * design unsafe: an accidental missing context would silently become an
 * intentional bypass.
 */
export type TenantStore = {
  tenantId: bigint | null;
  /** Deliberate cross-tenant access. Must be audited by the caller. */
  bypass: boolean;
  /** Why the bypass was granted - written to audit_logs. */
  bypassReason?: string;
};

const als = new AsyncLocalStorage<TenantStore>();

/** Runs `fn` with the given tenant bound to the async context. */
export function runWithTenant<T>(tenantId: bigint, fn: () => T): T {
  return als.run({ tenantId, bypass: false }, fn);
}

/**
 * Runs `fn` with tenant filtering DISABLED.
 * Only for: system startup, auth session lookup (no JWT yet), and the
 * explicitly audited superadmin paths in section 9.
 */
export function runWithoutTenant<T>(reason: string, fn: () => T): T {
  return als.run({ tenantId: null, bypass: true, bypassReason: reason }, fn);
}

/** Raw store access. Returns undefined when outside any context. */
export function getTenantStore(): TenantStore | undefined {
  return als.getStore();
}

/**
 * The tenant for the current async context.
 * Returns null when there is no context OR when bypass is active - the caller
 * (the Prisma extension) decides what each case means.
 */
export function getCurrentTenantId(): bigint | null {
  return als.getStore()?.tenantId ?? null;
}

export function isTenantBypassed(): boolean {
  return als.getStore()?.bypass === true;
}

/**
 * Moved from `common/utils/tenant.util.ts` (which was dead code - see
 * docs/03-multi-tenancy.md section 3). This is the ONLY place a tenant is read
 * out of a JWT payload.
 */
export function getUserTenantId(user: RequestUser): bigint {
  try {
    return parseBigIntId(user?.tenantId, 'tenant_id');
  } catch {
    throw new ForbiddenException('INVALID_TENANT');
  }
}
```

> **Diqqat — `getUserTenantId()` `tenant.util.ts` dan AYNAN ko'chirildi.**
> U yaxshi kod edi (§3.3), faqat noto'g'ri joyda ishlatilgan edi. Uni qayta
> yozish shart emas.

### 4.4. Middleware — kontekstni o'rnatish

Yangi fayl: `apps/api/src/common/tenant/tenant-context.middleware.ts`

⚠️ **Muhim qaror: middleware JWT ni O'ZI verify QILMAYDI.** Sabab: JWT verify
allaqachon `ensureUser()` da bor (`jwt-request.util.ts:52-91`) va u sessiya
bekor qilinganini ham tekshiradi (`:76-79`). Ikki joyda verify qilish = ikki
joyda xato qilish imkoniyati.

Lekin muammo bor: **NestJS da middleware guard dan OLDIN ishlaydi.** Ya'ni
middleware vaqtida `req.user` hali yo'q.

Yechim — middleware `ensureUser()` ni **chaqiradi** (u idempotent:
`jwt-request.util.ts:57-58` da `req.user` bor bo'lsa darhol qaytaradi), keyin
guard yana chaqirganda kesh dan oladi:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ensureUser } from '../auth/jwt-request.util';
import { getUserTenantId, runWithTenant } from './tenant-context';

/**
 * Binds the JWT's tenant to the async context for the whole request.
 *
 * NOTE: this does NOT authenticate. `ensureUser()` is idempotent and caches on
 * `req.user`, so the guards that run after this middleware reuse the same
 * verified payload - see jwt-request.util.ts:57-58. Query count does not go up.
 *
 * Unauthenticated requests (login, health, swagger) get NO tenant context.
 * That is deliberate: the extension fails closed on tenant-scoped models, and
 * the login flow establishes its own context once it resolves the slug - see
 * section 4.5.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId: bigint | null = null;

    try {
      const user = await ensureUser(req, this.jwt, this.prisma);
      tenantId = getUserTenantId(user);
    } catch {
      // Not authenticated (or bad token). Do NOT throw here - that is the
      // guards' job, and throwing in middleware would turn every 401 into a
      // confusing 500. We run without a tenant context; the guard rejects the
      // request a moment later.
      tenantId = null;
    }

    if (tenantId === null) return next();

    return runWithTenant(tenantId, () => next());
  }
}
```

Ro'yxatdan o'tkazish — `app.module.ts`:

```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
```

⚠️ **Tovuq-tuxum muammosi.** `ensureUser()` `auth_sessions.findFirst` chaqiradi
(`jwt-request.util.ts:76`), va `auth_sessions` da `tenant_id` **bor** (§2.6 dagi
51 modeldan). Ya'ni bu so'rov extension tomonidan filtrlanadi — lekin kontekst
hali o'rnatilmagan. Extension `NO_TENANT_CONTEXT` tashlaydi va **login butunlay
buziladi**.

**Yechim** — sessiya qidiruvini bypass ga o'rash. `jwt-request.util.ts:76-79`
o'zgaradi:

```ts
      // The session lookup necessarily happens BEFORE a tenant context can
      // exist - the tenant is inside the very token we are verifying.
      const session = await runWithoutTenant(
        'auth: session lookup precedes tenant context',
        () =>
          prisma.auth_sessions.findFirst({
            where: { id: sid, revoked_at: null, expires_at: { gt: new Date() } },
          }),
      );
      if (!session) throw new UnauthorizedException('SESSION_REVOKED');

      // Defence in depth: the session must belong to the tenant the token
      // claims. This check does not exist today (jwt-request.util.ts:76-79
      // ignores tenant_id entirely) and is added together with the bypass.
      if (session.tenant_id.toString() !== String(payload.tenantId)) {
        throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
      }
```

> ✅ **Bu bypass xavfsizlikni PASAYTIRMAYDI — oshiradi.** Hozir
> `jwt-request.util.ts:76-79` sessiyani `tenant_id` bilan **umuman
> tekshirmaydi**. Bypass qo'shilishi bilan birga **yangi tekshiruv** qo'shiladi.

### 4.5. Login oqimi — kontekstsiz ishlaydigan joy

Bu — dizayndagi eng nozik nuqta.

`auth.service.ts:139-146` — login tenant slug bo'yicha boshlanadi:

```ts
  private async getTenantIdBySlugOrThrow(tenantSlug: string): Promise<bigint> {
    const t = await this.prisma.tenants.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!t) throw new UnauthorizedException('TENANT_NOT_FOUND');
    return t.id;
  }
```

`tenants` — global model (§2.6), extension unga tegmaydi. ✅ Muammo yo'q.

Lekin login ning qolgan qadamlari tenant-scoped modelga tegadi:

| Qator | Model | `tenant_id` bormi | Kontekst bormi |
|---|---|---|---|
| `:140` | `tenants` | ❌ global | kerak emas ✅ |
| `:187` | `auth_locks` | ✅ bor | ❌ **yo'q** |
| `:424` | `users` | ✅ bor | ❌ **yo'q** |
| `:437,446` | `auth_attempts` | ✅ bor | ❌ **yo'q** |
| `:465` | `users.update` | ✅ bor | ❌ **yo'q** |
| `:161` | `audit_logs.create` | ✅ bor | ❌ **yo'q** |

**Yechim:** slug dan tenant topilgach, login ning **qolgan qismi** shu tenant
kontekstida bajariladi. Bu bypass **emas** — tenant ma'lum:

```ts
  // auth.service.ts - staffLogin, changed structure
  async staffLogin(dto: StaffLoginDto, req: Request, res: Response) {
    try {
      const tenantSlug = String(dto.tenantSlug || '').trim();

      // `tenants` is a global model, so this runs without a tenant context.
      const tenantId = await this.getTenantIdBySlugOrThrow(tenantSlug);

      const username = String(dto.username || '').trim();
      if (!username) throw new UnauthorizedException('INVALID_CREDENTIALS');

      // From here the tenant IS known, even though no JWT exists yet.
      // Everything below is scoped exactly as a normal request would be.
      return await runWithTenant(tenantId, async () => {
        await this.ensureNotLocked(tenantId, 'STAFF', username);

        const user = await this.prisma.users.findFirst({
          where: { username },        // <- tenant_id no longer written by hand
          select: {
            id: true,
            password_hash: true,
            is_active: true,
            full_name: true,
            username: true,
          },
        });

        if (!user || !user.is_active) {
          await this.logAttempt(tenantId, 'STAFF', username, false, req);
          await this.maybeLock(tenantId, 'STAFF', username, req);
          throw new UnauthorizedException('INVALID_CREDENTIALS');
        }
        // ... unchanged
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }
```

> ✅ Hozir login `tenant_id` ni 6 joyda qo'lda yozadi. Keyin — **nol joyda**,
> lekin **hammasi** filtrlangan.

⚠️ **Guardian login (`auth.service.ts:593`).** Kanon §4.2: format
`<tenant-slug>-<student-id>`, **birinchi tire bo'yicha** ajratiladi ("bu real
bag edi"). Tenant slug login stringidan ajratiladi, keyin xuddi shunday
`runWithTenant` ga o'raladi. ⚠️ **Ajratish mantig'iga TEGILMAYDI** — u
allaqachon to'g'ri va tuzatilgan bag. Faqat atrofiga wrapper qo'shiladi.

### 4.6. `findUnique` muammosi — va uning haqiqiy yechimi

TZ topshirig'i muammoni shunday qo'ygan: *"`where` faqat unique fieldni qabul
qiladi, `tenant_id` qo'sha olmaysan → `findUniqueOrThrow` → `findFirst` ga
aylantirish kerak"*.

**Halol javob: bu Prisma 5 dan beri TO'G'RI EMAS.**

Prisma **`extendedWhereUnique`** ni 4.5 da preview, **5.0 da GA** qildi.
Loyihada **Prisma 7.3** (`apps/api/package.json`: `"@prisma/client": "^7.3.0"`).
Ya'ni:

```ts
// On Prisma 5+ this is fully valid AND type-safe:
await prisma.students.findUnique({
  where: {
    id: 42n,          // <- unique field (at least one is REQUIRED)
    tenant_id: 5n,    // <- extra NON-unique filter - ALLOWED since v5
  },
});
```

Generatsiya qilingan `studentsWhereUniqueInput` tipi endi skalyar filtrlarni ham
o'z ichiga oladi. `tenant_id` mos kelmasa — `null` qaytadi.

> **Bu nima uchun hal qiluvchi:** `findUnique` → `findFirst` aylantirish
> **`$allOperations` ichida IMKONSIZ**. Extension da `query(args)` —
> **original operatsiyaga bog'langan closure**. `operation` o'zgaruvchisini
> o'zgartirsangiz hech narsa bo'lmaydi:
>
> ```ts
> // WRONG - a common mistake:
> async $allOperations({ model, operation, args, query }) {
>   if (operation === 'findUnique') {
>     operation = 'findFirst';   // <- has NO effect on query()
>   }
>   return query(args);          // <- still runs findUnique
> }
> ```
>
> Ya'ni `extendedWhereUnique` — **variant emas, yagona toza yo'l.**

**Nozik jihat:** `extendedWhereUnique` `where` da **kamida bitta** unique field
talab qiladi. Extension `tenant_id` ni **qo'shadi**, olib tashlamaydi — unique
field joyida qoladi. Muammo yo'q.

⚠️ **O'lchov bilan aniqlanadi:** Prisma qo'shimcha filtrni SQL `WHERE` ga
qo'shadimi yoki yozuvni olib keyin JS da tekshiradimi — versiyaga bog'liq va
hujjatlanmagan. **Xavfsizlik natijasi bir xil** (cross-tenant yozuv qaytmaydi),
lekin ikkinchi holatda yozuv bir lahza xotiraga o'qiladi. Implementatsiya
paytida Prisma query log (`log: ['query']`) bilan tekshirilsin va natija shu
hujjatga yozilsin.

### 4.7. ⚠️ Eng qiyin qism: 16 model uchun tenant yo'l xaritasi

Bu — yechimning **eng zaif joyi** va uni yashirmaslik kerak.

§2.6 da aniqlandi: 16 modelda `tenant_id` ustuni **yo'q**, lekin ular
tenant-scoped. Extension ularga `where.tenant_id = X` **qo'sha olmaydi** —
ustun yo'q, Prisma tip xatosi beradi va SQL ham buziladi.

Ular uchun extension **nested relation filtri** qo'yishi kerak:

```ts
// assessment_scores has no tenant_id, so instead of:
where: { tenant_id: 5n }              // impossible - no such column
// the extension must produce:
where: { assessments: { tenant_id: 5n } }   // scope through the parent
```

Ya'ni extension **har model uchun tenantga yo'lni bilishi kerak**.

#### Xarita

`apps/api/src/prisma/tenant-model-map.ts`:

```ts
/**
 * How each model reaches its tenant.
 *
 * 'column'  -> the model has its own tenant_id column (51 models)
 * 'global'  -> the model is genuinely not tenant-scoped (2 models)
 * 'via'     -> the model has NO tenant_id column and must be scoped through a
 *              parent relation (16 models). The string is the relation FIELD
 *              NAME as generated by Prisma, not the table name.
 *
 * WARNING: this map is hand-written, and a missing entry is exactly the class
 * of bug this whole document exists to eliminate. It is therefore enforced by
 * a test that reads the Prisma DMMF and fails when any model is unclassified
 * or misclassified - see `tenant-model-map.spec.ts` below. Do not treat the
 * map as the source of truth; treat the schema as the source of truth and the
 * map as an assertion about it.
 */
export type TenantScope =
  | { kind: 'column' }
  | { kind: 'global' }
  | { kind: 'via'; relation: string };

export const TENANT_MODEL_MAP: Record<string, TenantScope> = {
  // ---- genuinely global (2) ----
  tenants: { kind: 'global' },
  permissions: { kind: 'global' },

  // ---- scoped through a parent relation (16) ----
  assessment_scores: { kind: 'via', relation: 'assessments' },
  attendance_marks: { kind: 'via', relation: 'attendance_sessions' },
  award_recipients: { kind: 'via', relation: 'awards' },
  competition_entries: { kind: 'via', relation: 'competitions' },
  competition_results: { kind: 'via', relation: 'competitions' },
  display_items: { kind: 'via', relation: 'display_playlists' },
  dorm_announcement_prices: { kind: 'via', relation: 'dorm_payment_announcements' },
  dorm_rooms: { kind: 'via', relation: 'dorms' },
  event_participants: { kind: 'via', relation: 'events' },
  grade_snapshot_rows: { kind: 'via', relation: 'grade_snapshots' },
  group_subjects: { kind: 'via', relation: 'groups' },
  meal_announcement_prices: { kind: 'via', relation: 'meal_payment_announcements' },
  role_permissions: { kind: 'via', relation: 'roles' },
  student_cohort: { kind: 'via', relation: 'students' },
  timetable_lessons: { kind: 'via', relation: 'timetable' },
  user_roles: { kind: 'via', relation: 'users' },

  // ---- everything else has its own tenant_id column (51) ----
  // Not listed one by one on purpose: the test below asserts that every model
  // absent from this map really does have a tenant_id column. Listing 51 names
  // by hand would add 51 more chances to be wrong.
};

export function scopeFor(model: string): TenantScope {
  return TENANT_MODEL_MAP[model] ?? { kind: 'column' };
}
```

#### ⚠️ Halol e'tirof: bu muammoni yo'q qilmaydi — KO'CHIRADI

> **Bu xaritaning o'zi ham unutilishi mumkin.** Yangi model qo'shilsa va u
> `tenant_id` siz bola jadval bo'lsa — xaritaga yozish **esdan chiqadi**, va
> `scopeFor()` uni `{ kind: 'column' }` deb qaytaradi, keyin extension
> mavjud bo'lmagan ustunga filtr qo'yib **crash** bo'ladi (yaxshi holat) yoki
> jimgina o'tkazib yuboradi (yomon holat).
>
> Ya'ni: **845 ta unutish nuqtasi → 1 ta unutish nuqtasi.** Bu **katta
> yaxshilanish**, lekin **nol emas**. Buni da'vo qilish yolg'on bo'lardi.

#### Xaritani majburlash — schema haqiqat manbai

Yechim: xarita **schema bilan solishtiriladi** va nomuvofiqlik **testni
yiqitadi**. Prisma o'z metama'lumotini (DMMF) runtime da beradi.

`apps/api/src/prisma/tenant-model-map.spec.ts`:

```ts
import { Prisma } from '@prisma/client';
import { TENANT_MODEL_MAP, scopeFor } from './tenant-model-map';

/**
 * These tests are the reason the map is trustworthy. They read the real schema
 * (via Prisma's DMMF) and assert that the map agrees with it. A new model, a
 * dropped tenant_id column, or a renamed relation all fail here - loudly, at
 * CI time, not silently at runtime in front of a customer.
 */
describe('TENANT_MODEL_MAP agrees with schema.prisma', () => {
  const models = Prisma.dmmf.datamodel.models;

  const hasTenantColumn = (m: (typeof models)[number]) =>
    m.fields.some((f) => f.name === 'tenant_id' && f.kind === 'scalar');

  it('classifies every model in the schema', () => {
    const unclassified = models
      .filter((m) => !hasTenantColumn(m))
      .filter((m) => !TENANT_MODEL_MAP[m.name])
      .map((m) => m.name);

    // A model with no tenant_id column and no map entry would be silently
    // unprotected. This is THE test that keeps the map honest.
    expect(unclassified).toEqual([]);
  });

  it('every model NOT in the map really has a tenant_id column', () => {
    const wrong = models
      .filter((m) => !TENANT_MODEL_MAP[m.name])
      .filter((m) => !hasTenantColumn(m))
      .map((m) => m.name);

    expect(wrong).toEqual([]);
  });

  it('every model IN the map as "column" really has the column', () => {
    const wrong = Object.entries(TENANT_MODEL_MAP)
      .filter(([, scope]) => scope.kind === 'column')
      .map(([name]) => models.find((m) => m.name === name))
      .filter((m): m is (typeof models)[number] => !!m)
      .filter((m) => !hasTenantColumn(m))
      .map((m) => m.name);

    expect(wrong).toEqual([]);
  });

  it('every "via" relation exists and leads to a tenant-scoped model', () => {
    const problems: string[] = [];

    for (const [modelName, scope] of Object.entries(TENANT_MODEL_MAP)) {
      if (scope.kind !== 'via') continue;

      const model = models.find((m) => m.name === modelName);
      if (!model) {
        problems.push(`${modelName}: not in schema (stale map entry)`);
        continue;
      }

      const rel = model.fields.find(
        (f) => f.name === scope.relation && f.kind === 'object',
      );
      if (!rel) {
        problems.push(`${modelName}.${scope.relation}: no such relation`);
        continue;
      }

      // The relation must be to-one. Scoping through a to-many relation would
      // mean "has SOME parent in my tenant", which is not isolation.
      if (rel.isList) {
        problems.push(`${modelName}.${scope.relation}: is a list, cannot scope`);
        continue;
      }

      // The parent must itself be reachable to a tenant, otherwise we have
      // only moved the hole one level up.
      const parent = models.find((m) => m.name === rel.type);
      if (!parent || !hasTenantColumn(parent)) {
        problems.push(
          `${modelName} -> ${rel.type}: parent has no tenant_id (chain broken)`,
        );
      }
    }

    expect(problems).toEqual([]);
  });

  it('models declared global are a closed, reviewed set', () => {
    // Adding a model here disables tenant filtering for it entirely. That must
    // be a conscious, reviewed decision - so the list is pinned.
    const globals = Object.entries(TENANT_MODEL_MAP)
      .filter(([, s]) => s.kind === 'global')
      .map(([n]) => n)
      .sort();

    expect(globals).toEqual(['permissions', 'tenants']);
  });
});
```

> ✅ **Nima o'zgardi:** xarita endi "esda tutish kerak bo'lgan narsa" emas —
> **schema bilan avtomatik solishtiriladigan tasdiq**. Yangi model qo'shgan
> dasturchi xaritani unutsa, `npm test` **darhol yiqiladi** va aniq nima
> qilish kerakligini aytadi.
>
> ⚠️ **Qolgan zaiflik:** test model `via` deb belgilanganda **relation TO'G'RI
> tanlanganini** tekshira olmaydi. Masalan `assessment_scores` uchun
> `relation: 'students'` deb yozilsa — test **o'tadi** (`students` da
> `tenant_id` bor, to-one relation). Va u ham **to'g'ri** izolyatsiya beradi
> (o'quvchi ham o'sha tenantda). Ya'ni xato bo'lsa ham xavfsiz. Lekin
> `dorm_rooms` uchun noto'g'ri ota tanlansa — natija noto'g'ri bo'lishi mumkin.
> **Bu 16 ta qator — ular code review da qo'lda tekshirilsin, bir marta.**

Bu 16 ta qator — **butun tizimda qo'lda tekshiriladigan yagona joy**. 845 dan 16 ga.

### 4.8. Extension — to'liq kod

`apps/api/src/prisma/tenant.extension.ts`:

```ts
import { Prisma } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import {
  getCurrentTenantId,
  isTenantBypassed,
} from '../common/tenant/tenant-context';
import { scopeFor } from './tenant-model-map';

/** Operations that read and therefore need a WHERE filter. */
const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations that mutate existing rows - also need a WHERE filter. */
const MUTATE_OPS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/** Operations that create rows - need tenant_id written into DATA. */
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

/**
 * Merges a tenant condition into an existing `where`, without ever clobbering
 * what the caller already wrote.
 *
 * This matters because of real code like assessments.service.ts:908, which
 * already scopes through the parent by hand:
 *
 *   where: { assessments: { tenant_id, is_published_to_guardians: true } }
 *
 * A naive `where.assessments = { tenant_id }` would DELETE the
 * `is_published_to_guardians` filter and start leaking unpublished grades to
 * guardians. So for 'via' models we merge INTO the existing relation object.
 */
function applyTenantToWhere(
  model: string,
  where: any,
  tenantId: bigint,
): any {
  const scope = scopeFor(model);
  const w = where ?? {};

  if (scope.kind === 'global') return where;

  if (scope.kind === 'column') {
    // If the caller already pinned a tenant, it must be OUR tenant. Silently
    // overwriting would hide a bug; throwing surfaces it. This mirrors the
    // TENANT_MISMATCH behaviour of the old tenant.util.ts:37-40.
    if (w.tenant_id !== undefined && w.tenant_id !== null) {
      const requested = BigInt(w.tenant_id as any);
      if (requested !== tenantId) throw new ForbiddenException('TENANT_MISMATCH');
      return w;
    }
    return { ...w, tenant_id: tenantId };
  }

  // scope.kind === 'via'
  const rel = scope.relation;
  const existing = w[rel];

  // Merge, do not replace. See the comment above.
  if (existing && typeof existing === 'object') {
    if (existing.tenant_id !== undefined && existing.tenant_id !== null) {
      const requested = BigInt(existing.tenant_id as any);
      if (requested !== tenantId) throw new ForbiddenException('TENANT_MISMATCH');
      return w;
    }
    return { ...w, [rel]: { ...existing, tenant_id: tenantId } };
  }

  return { ...w, [rel]: { tenant_id: tenantId } };
}

/** Writes tenant_id into create payloads. Handles both object and array data. */
function applyTenantToData(model: string, data: any, tenantId: bigint): any {
  const scope = scopeFor(model);

  // 'global' models are not scoped; 'via' models have no tenant_id column to
  // write into - their tenant is implied by the parent FK the caller supplies.
  if (scope.kind !== 'column') return data;

  if (Array.isArray(data)) {
    return data.map((row) => ({ tenant_id: tenantId, ...row }));
  }
  return { tenant_id: tenantId, ...data };
}

export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Deliberate cross-tenant access (auth session lookup, superadmin -
          // see sections 4.4 and 9). The caller has already justified it.
          if (isTenantBypassed()) return query(args);

          const scope = scopeFor(model);
          if (scope.kind === 'global') return query(args);

          const tenantId = getCurrentTenantId();

          // FAIL CLOSED. No context + tenant-scoped model = programmer error,
          // not a reason to return every tenant's rows. This is the single
          // most important line in this file.
          if (tenantId === null) {
            throw new ForbiddenException(
              `NO_TENANT_CONTEXT: ${model}.${operation} ran outside a tenant ` +
                `context. Wrap it in runWithTenant(), or add the model to ` +
                `TENANT_MODEL_MAP as 'global' if it is truly not tenant-scoped.`,
            );
          }

          const a: any = args ?? {};

          if (READ_OPS.has(operation) || MUTATE_OPS.has(operation)) {
            a.where = applyTenantToWhere(model, a.where, tenantId);
            return query(a);
          }

          if (CREATE_OPS.has(operation)) {
            a.data = applyTenantToData(model, a.data, tenantId);
            return query(a);
          }

          if (operation === 'upsert') {
            // upsert needs all three: the lookup, the insert and the update.
            a.where = applyTenantToWhere(model, a.where, tenantId);
            a.create = applyTenantToData(model, a.create, tenantId);
            return query(a);
          }

          // Unknown operation. Fail closed rather than pass it through: a new
          // Prisma version adding an operation must not silently bypass this.
          throw new ForbiddenException(
            `UNHANDLED_OPERATION: ${model}.${operation} is not covered by the ` +
              `tenant extension. Add it to READ_OPS/MUTATE_OPS/CREATE_OPS.`,
          );
        },
      },
    },
  }),
);
```

#### Har operatsiya bo'yicha nima bo'ladi

| Operatsiya | Nima qilinadi | `tenant_id` **bor** model | `via` model |
|---|---|---|---|
| `findMany` | `where` ga qo'shiladi | `where.tenant_id` | `where.<rel>.tenant_id` |
| `findFirst` / `OrThrow` | `where` ga qo'shiladi | ✅ | ✅ |
| `findUnique` / `OrThrow` | `where` ga qo'shiladi (`extendedWhereUnique`, §4.6) | ✅ | ⚠️ pastga qarang |
| `count` | `where` ga qo'shiladi | ✅ | ✅ |
| `aggregate` | `where` ga qo'shiladi | ✅ | ✅ |
| `groupBy` | `where` ga qo'shiladi | ✅ | ✅ |
| `update` | `where` ga qo'shiladi | ✅ | ✅ |
| `updateMany` | `where` ga qo'shiladi | ✅ | ✅ |
| `delete` | `where` ga qo'shiladi | ✅ | ✅ |
| `deleteMany` | `where` ga qo'shiladi | ✅ | ✅ |
| `create` | `data.tenant_id` yoziladi | ✅ | ➖ kerak emas (ota FK belgilaydi) |
| `createMany` | har elementga yoziladi | ✅ | ➖ |
| `upsert` | `where` + `create` | ✅ | ✅ |
| noma'lum | **`UNHANDLED_OPERATION` tashlaydi** | 🔒 | 🔒 |

⚠️ **`via` model + `findUnique` — real cheklov.** `extendedWhereUnique` skalyar
filtrlarga ruxsat beradi, lekin **relation filtri** `WhereUniqueInput` da
qo'llab-quvvatlanadimi — **o'lchov bilan aniqlanishi kerak**. Agar yo'q bo'lsa,
`via` modellarda `findUnique` **ishlamaydi** va `findFirst` ga qo'lda o'tish
kerak. Amalda bu kichik muammo: 16 `via` modelning ko'pchiligida composite PK
bor (`assessment_scores.@@id([assessment_id, student_id])`) va ular `findUnique`
bilan kam ishlatiladi. **Implementatsiya paytida tekshirilsin.**

#### `data.tenant_id` — nega `{ tenant_id, ...data }` va `{ ...data, tenant_id }` emas

```ts
return { tenant_id: tenantId, ...data };   // <- tenant_id FIRST
```

Tartib **ataylab**. Agar servis `data` da `tenant_id` ni **o'zi** yozgan bo'lsa
(hozir 90 ta `create` ning ko'pchiligi shunday — masalan
`students.service.ts:386`), `...data` **ustidan yozadi** va servis qiymati
g'olib bo'ladi.

Bu **migratsiya davri uchun ataylab** qilingan (§5, 1-bosqich): eski qo'lda
yozilgan `tenant_id` va yangi avtomatik `tenant_id` **bir xil qiymat** —
konflikt yo'q. Teskari tartib (`{ ...data, tenant_id }`) ham xuddi shu natija
berardi, chunki qiymatlar teng.

⚠️ **Lekin agar teng bo'lmasa?** Ya'ni servis boshqa tenantning `tenant_id`
sini yozsa. Hozirgi tartibda — servis g'olib, **bu xavfli**. Shuning uchun
`create` uchun ham tekshiruv qo'shilishi kerak. 3-bosqichda (§5) qo'lda
`tenant_id` lar olib tashlangach bu masala **yo'qoladi**, lekin 1-bosqichda
himoya kerak:

```ts
function applyTenantToData(model: string, data: any, tenantId: bigint): any {
  const scope = scopeFor(model);
  if (scope.kind !== 'column') return data;

  const one = (row: any) => {
    if (row?.tenant_id !== undefined && row.tenant_id !== null) {
      // During migration (phase 1) services still write tenant_id by hand.
      // Agreeing values are fine; a disagreement is a real bug and must not
      // be silently resolved in either direction.
      if (BigInt(row.tenant_id) !== tenantId) {
        throw new ForbiddenException('TENANT_MISMATCH');
      }
      return row;
    }
    return { ...row, tenant_id: tenantId };
  };

  return Array.isArray(data) ? data.map(one) : one(data);
}
```

### 4.9. ⚠️ Extension NIMANI USHLAMAYDI — ochiq teshiklar

Bu ro'yxat to'liq va halol bo'lishi shart. Extension — **kuchli, lekin
to'liq emas**.

#### 1. Raw query — `$queryRaw`, `$executeRaw`

```ts
await prisma.$queryRaw`SELECT * FROM students`;   // <- extension NEVER sees this
```

`$queryRaw` / `$executeRaw` / `$queryRawUnsafe` / `$executeRawUnsafe`
`$allModels` ga **tegishli emas** — ular model operatsiyasi emas, client
operatsiyasi. Extension ularni **umuman ko'rmaydi**.

**Hozirgi holat (§2.10):** butun kod bazasida **1 ta** raw query
(`ranking.service.ts:261`) va u **to'g'ri yozilgan**.

**Qoida:** raw query da `tenant_id` **har doim qo'lda** yoziladi. Bu qoida
qoladi va uni **lint majburlaydi** (§5.4):

```js
// eslint.config.mjs
{
  selector: "TaggedTemplateExpression[tag.property.name=/^\\$(query|execute)Raw$/]",
  message:
    "Raw SQL is invisible to the tenant extension. Include an explicit " +
    "tenant_id predicate and add an eslint-disable with a justification.",
}
```

> ⚠️ **Bu — RLS ning (§6) eng kuchli argumenti.** RLS raw query ni ham
> qamraydi, extension esa yo'q.

#### 2. Nested writes

```ts
await prisma.groups.create({
  data: {
    name: 'A-1',
    students: { create: [{ full_name: 'Ali' }] },   // <- NOT intercepted
  },
});
```

Extension `groups.create` ni ko'radi va `data.tenant_id` yozadi. Lekin ichkaridagi
`students.create` — bu **alohida operatsiya emas**, u `groups.create` ning
argumenti. Extension unga **tegmaydi** va o'quvchi `tenant_id` siz yaratilishga
uriniladi → **DB xatosi** (`tenant_id` `NOT NULL`).

✅ **Yaxshi xabar: bu fail-closed.** Jimgina noto'g'ri tenant emas — **ochiq
crash**. Ya'ni test darhol topadi.

⚠️ **Lekin `connect` boshqacha:**

```ts
await prisma.students.create({
  data: {
    full_name: 'Ali',
    groups: { connect: { id: 999n } },   // <- group from ANOTHER tenant?
  },
});
```

Extension `students` ga `tenant_id` yozadi, lekin `connect: { id: 999n }`
**tekshirilmaydi**. Boshqa tenantning guruhiga bog'lash mumkin.

**Yechim:** hozirgi kod bu naqshni ishlatmaydi — u FK ni qo'lda tekshiradi
(`students.service.ts:321-330` — `groups.findFirst({ where: { id, tenant_id } })`
keyin `current_group_id` yoziladi). **Bu naqsh saqlanadi** va `connect`
ishlatish lint bilan cheklanadi.

#### 3. Nested read (`include` / `select`)

```ts
await prisma.tenants.findMany({ include: { students: true } });
```

`tenants` — global, extension o'tkazadi. Ichkaridagi `students` **nested
read** — extension uni **ko'rmaydi**. Natija: **hamma tenantning o'quvchilari**.

✅ Amalda bu xavfsiz, chunki nested read **FK bo'yicha** boradi — ya'ni
`tenants.findMany({ include: { students }})` da har tenant faqat o'z
o'quvchilarini oladi. Muammo faqat `tenants` global model bo'lgani uchun
**kim bu so'rovni chaqira olishida** (§9).

⚠️ **Lekin bitta real xavf bor:** `include` ichida `where` bo'lsa —

```ts
await prisma.groups.findMany({
  include: { students: { where: { status: 'ACTIVE' } } },   // no tenant filter
});
```

Bu xavfsiz (`groups` filtrlangan → FK orqali faqat shu tenant o'quvchilari),
lekin **extension buni kafolatlamaydi** — FK kafolatlaydi.

#### 4. `$transaction` — ✅ ishlaydi

```ts
await prisma.$transaction([
  prisma.students.findMany({ where: {} }),
  prisma.groups.count(),
]);
```

Batch `$transaction` da har operatsiya **alohida** `$allOperations` dan o'tadi.
✅ Filtrlanadi.

Interactive `$transaction(async (tx) => ...)` — `tx` **extension li client dan**
keladi, ya'ni `tx.students.findMany()` ham filtrlanadi. ✅

⚠️ **Lekin ALS kontekstini tekshirish kerak:** `$transaction` callback ichida
`AsyncLocalStorage` konteksti saqlanadimi? **Ha** — `async_hooks` promise
zanjiri bo'ylab ishlaydi. Lekin bu **testda tasdiqlansin** (§7 da test bor).

Hozirgi kod `$transaction` ni ko'p ishlatadi (`students.service.ts:268, 763,
953, 1063, 1194`) — bu **eng muhim tekshiruv**.

#### 5. `seed.ts`, cron, CLI

Kontekst yo'q → `NO_TENANT_CONTEXT`. Bu **to'g'ri**, lekin `seed.ts` ni
buzadi. Yechim: `seed.ts` `runWithTenant()` yoki `runWithoutTenant()` ga
o'raladi (seed tenant yaratadi, ya'ni bypass haqiqatan kerak).

#### Teshiklar jamlanmasi

| Teshik | Xavf | Yumshatish |
|---|---|---|
| Raw query | 🔴 to'liq bypass | Lint + hozir 1 ta va to'g'ri + RLS (§6) |
| Nested `create` | 🟢 fail-closed (crash) | Test topadi |
| Nested `connect` | 🟡 cross-tenant bog'lash | Lint + mavjud FK-tekshirish naqshi |
| Nested read `include` | 🟢 FK himoyalaydi | — |
| `via` model + `findUnique` | 🟡 noaniq | O'lchov bilan aniqlanadi |
| Xarita to'liqmasligi | 🟡 1 nuqta | DMMF testi (§4.7) |
| `$transaction` | 🟢 ishlaydi | Test bilan tasdiqlansin |

### 4.10. `PrismaService` ga ulash

`apps/api/src/prisma/prisma.service.ts` — hozirgi kod (38 qator) minimal
o'zgaradi:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { tenantExtension } from './tenant.extension';

function requireEnv(name: string): string {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

/**
 * The base client. Nothing outside this file may use it directly - it has NO
 * tenant isolation. It is exported only so tests can seed fixtures across
 * tenants (see tenant-isolation.spec.ts).
 */
export class UnsafePrismaClient extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: requireEnv('DATABASE_URL'),
    });
    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
}

/**
 * The extended client type. `$extends` returns a NEW client object rather than
 * mutating in place, which is why PrismaService can no longer simply `extend
 * PrismaClient` and be done - we compose instead of inherit.
 */
const extendedClient = () => new UnsafePrismaClient().$extends(tenantExtension);
export type ExtendedPrismaClient = ReturnType<typeof extendedClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly base = new UnsafePrismaClient();

  /**
   * Every model delegate reachable by application code goes through here, and
   * therefore through the tenant extension. There is deliberately no public
   * escape hatch: crossing tenants requires runWithoutTenant(), which is
   * auditable, greppable, and lint-enforced.
   */
  public readonly client: ExtendedPrismaClient;

  constructor() {
    this.client = this.base.$extends(tenantExtension) as ExtendedPrismaClient;
  }

  async onModuleInit() {
    await this.base.$connect();
  }

  async onModuleDestroy() {
    await this.base.$disconnect();
  }
}
```

⚠️ **Bu — jiddiy ergonomika muammosi.** Hozirgi kod
`this.prisma.students.findMany()` deb yozadi (`students.service.ts:165`).
Yangi kodda `this.prisma.client.students.findMany()` bo'ladi — ya'ni **~845 ta
chaqiruvni o'zgartirish kerak**. Bu 1-bosqichning "zarar yo'q" tamoyilini buzadi.

**Yechim — Proxy bilan interfeysni saqlash:**

```ts
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly base = new UnsafePrismaClient();
  private readonly extended: ExtendedPrismaClient;

  constructor() {
    this.extended = this.base.$extends(tenantExtension) as ExtendedPrismaClient;

    // Keep the existing call sites working unchanged: `prisma.students.…`
    // continues to resolve, but now lands on the EXTENDED delegate. This is
    // what makes phase 1 a zero-diff change for all ~845 call sites.
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        return (target.extended as any)[prop];
      },
    });
  }

  async onModuleInit() { await this.base.$connect(); }
  async onModuleDestroy() { await this.base.$disconnect(); }
}
```

⚠️ **Proxy ning narxi:** har `prisma.students` ga murojaatda bitta `get` trap.
Bu mikro-overhead, lekin **o'lchov bilan tasdiqlansin**. Agar sezilarli bo'lsa —
delegate lar konstruktorda keshlanadi.

⚠️ **TypeScript muammosi:** Proxy tiplarni bilmaydi. `PrismaService` ni
`ExtendedPrismaClient` bilan intersection qilib e'lon qilish kerak:

```ts
export interface PrismaService extends ExtendedPrismaClient {}
```

Bu — declaration merging. Ishlaydi, lekin **hiyla**. Muqobil: 1-bosqichda
`client` maydonini ochiq qoldirib, 3-bosqichda modul-modul ko'chirish.
**Qaysi biri — implementatsiya paytida hal qilinadi**, ikkalasi ham qabul qilinadi.

---

## 5. Migratsiya yo'li

845 nuqtani bir kunda o'zgartirib bo'lmaydi. Va **kerak ham emas**.

**Asosiy tamoyil:** extension va qo'lda filtrlar **bir vaqtda ishlaydi va bir-biriga
xalaqit bermaydi**. Sabab — ikkalasi ham **bir xil qiymat** qo'yadi:

```ts
// Service writes this:            where: { tenant_id: 5n, status: 'ACTIVE' }
// Extension sees tenant_id already present, checks 5n === 5n, leaves it alone.
// Result:                          where: { tenant_id: 5n, status: 'ACTIVE' }
```

`applyTenantToWhere()` (§4.8) aynan shu holatni boshqaradi: `tenant_id` bor
bo'lsa — **moslikni tekshiradi**, mos bo'lsa tegmaydi. Ya'ni **ikki tomonlama
himoya**, konflikt yo'q.

> Bu — migratsiyani xavfsiz qiladigan yagona narsa. Agar extension qo'lda
> filtrni buzganda, uni **hamma joyda bir vaqtda** olib tashlash kerak bo'lardi —
> ya'ni big-bang. Big-bang **rad etiladi**.

### 5.0-bosqich: 🔴 BLOKER — migratsiya drifti

> ⚠️ **Bu bosqich hamma narsadan oldin turadi. U bajarilmasa, 2-bosqich
> (izolyatsiya testi) TEXNIK JIHATDAN IMKONSIZ.**

O'lchov:

```bash
cd apps/api
grep -c "^model " prisma/schema.prisma                    # -> 69
grep -rho "CREATE TABLE" prisma/migrations/ | wc -l       # -> 68
grep -rin "track_subjects\|SubjectRole" prisma/migrations/ # -> (bo'sh)
```

**Natija: schema'da 69 model, migratsiyalarda 68 `CREATE TABLE`.**
**`track_subjects` jadvali va `SubjectRole` enum'i HECH QAYSI migratsiyada yo'q.**

Ya'ni `prisma/migrations/` va `prisma/schema.prisma` **bir-biriga mos emas**.
Kimdir `track_subjects` ni schema'ga qo'shgan, `db push` bilan lokal bazaga
yuborgan, lekin migratsiya **yaratmagan**. Bu — kanon §9 ning to'g'ridan-to'g'ri
buzilishi: *"Migration majburiy, `db push` hech qachon"*.

**Nega bu aynan SHU hujjatning muammosi:**

`track_subjects` — bu tasodifiy jadval emas. Kanon §4.1: DTM 189 ballik tizim
`student_tracks` → `track_subjects` orqali modellashtiriladi, `role`
(`SubjectRole`: MAIN / SECONDARY / MANDATORY) beradi. Bu — **domenning o'zagi**.
Va `track_subjects` da `tenant_id` **bor** (§2.6 dagi 51 modeldan), ya'ni u
izolyatsiya testidan o'tishi **shart**.

**Oqibati — zanjir:**

```
migrate deploy toza bazaga
  -> 68 jadval yaratiladi, track_subjects YO'Q
  -> Prisma Client 69 model kutadi
  -> prisma.track_subjects.findMany() -> SQL xatosi: relation does not exist
  -> Testcontainers fixture yiqiladi
  -> izolyatsiya testi umuman ishga tushmaydi
```

> 🔴 **Testcontainers toza bazani `migrate deploy` bilan ko'taradi
> (`13-testing-strategy.md` §5.3). Migratsiyalar yaroqsiz bo'lsa — test
> yozib bo'lmaydi. Nuqta.**
>
> Bu — TZ ning eng muhim testini bloklab turgan **bitta yetishmayotgan
> migratsiya fayli**.

**Nima qilinadi:**

```bash
cd apps/api
# 1. Diff'ni ko'r: schema va migratsiyalar orasida nima farq bor
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > prisma/migrations/000002_track_subjects/migration.sql

# 2. Diff'ni QO'LDA o'qi. U track_subjects + SubjectRole dan boshqa narsani
#    o'z ichiga olsa - drift kutilganidan kattaroq, TO'XTA va tekshir.

# 3. Toza bazada tasdiqla
npx prisma migrate deploy    # 69 jadval bo'lishi kerak
```

⚠️ **Diff'ni ko'r-ko'rona qabul qilma.** U `DROP` bayonotini o'z ichiga olsa —
production'da ma'lumot yo'qoladi. `migrate diff` **ikki tomonlama** ishlaydi:
agar production bazada `track_subjects` allaqachon bor bo'lsa (`db push`
tufayli), yangi migratsiya u yerda `CREATE TABLE` ni **qayta** bajarishga
uriniladi → xato.

**Yechim:** production bazada jadval bor bo'lsa — migratsiya
`--applied` bilan belgilanadi (`prisma migrate resolve --applied 000002_...`),
ya'ni "bu allaqachon bajarilgan" deb yoziladi. Toza bazalarda esa u haqiqatan
bajariladi. ⚠️ **Bu qadam production holatini bilishni talab qiladi — ochiq
savol (§10).**

**Qanday tekshiriladi:**

| Tekshiruv | Kutilgan |
|---|---|
| `npx prisma migrate diff --from-migrations ... --to-schema-datamodel ...` | **bo'sh** (drift yo'q) |
| Toza bazada `migrate deploy` → `\dt` | **69 jadval** |
| `grep -c "^model " schema.prisma` == migratsiyadagi jadvallar | ✅ teng |
| `prisma.track_subjects.findMany()` toza bazada | ✅ ishlaydi, xato yo'q |

⚠️ **Bu tekshiruv CI ga qo'shiladi** — drift qaytmasligi uchun:

```yaml
# .github/workflows/ci.yml
- name: Fail if schema.prisma has drifted from migrations
  run: |
    npx prisma migrate diff \
      --from-migrations prisma/migrations \
      --to-schema-datamodel prisma/schema.prisma \
      --shadow-database-url "${{ env.SHADOW_DATABASE_URL }}" \
      --exit-code && echo "no drift" || (echo "DRIFT DETECTED" && exit 1)
```

`--exit-code`: farq bo'lsa **2** qaytaradi. Ya'ni `db push` bilan schema
o'zgartirgan har qanday PR **CI da yiqiladi**. Kanon §9 ning intizomi endi
**avtomatik majburlanadi**.

### 5.0b-bosqich: tayyorgarlik (extension'siz)

Bular extension dan **mustaqil** va migratsiya tuzatilgach darhol bajariladi.

| Ish | Fayl | Sabab |
|---|---|---|
| O'lik kodga ogohlantirish | `common/utils/tenant.util.ts` | §3.7 — yolg'on ishonchni darhol to'xtatish |
| 6 ta bracket-access ni servisga ko'chirish | `students/guardian-student.controller.ts:151,163,465,558,887,902` | §3.8 — arxitektura buzilishi |
| `assessment_scores` ni ota orqali scope qilish | `guardian-student.controller.ts:163` | §3.8.1 — real teshik |

**Tekshirish:** `grep -rn "\['prisma'\]" apps/api/src` → **0 natija**.

**Nega erta:** bu ishlar **hech qanday yangi mexanizm talab qilmaydi** va
mavjud eng jiddiy teshikni yopadi. Extension haftalar oladi, bular — kunlar.

### 5.1-bosqich: extension qo'shiladi, qo'lda filtrlar QOLADI

**Nima qilinadi:**

1. `common/tenant/tenant-context.ts` (§4.3)
2. `common/tenant/tenant-context.middleware.ts` (§4.4)
3. `prisma/tenant-model-map.ts` + uning testi (§4.7)
4. `prisma/tenant.extension.ts` (§4.8)
5. `prisma/prisma.service.ts` — Proxy bilan (§4.10)
6. `jwt-request.util.ts:76` — `runWithoutTenant` wrapper + sessiya tenant tekshiruvi (§4.4)
7. `auth.service.ts` — `staffLogin` / `guardianLogin` ni `runWithTenant` ga o'rash (§4.5)
8. `prisma/seed.ts` — `runWithoutTenant` ga o'rash (§4.9)

**Nima QILINMAYDI:** birorta ham servisdan `tenant_id` **olib tashlanmaydi**.

**Diff hajmi:** ~6 yangi fayl + 4 mavjud faylga kichik o'zgarish. **~845 chaqiruv
tegilmaydi.**

**Kutilayotgan natija:** tizim **aynan avvalgidek** ishlaydi. Hech qanday
funksional o'zgarish yo'q. Extension jimgina ishlaydi va qo'lda filtrlar bilan
rozi bo'ladi.

**Qanday tekshiriladi:**

| Tekshiruv | Kutilgan natija |
|---|---|
| `npm run build` | ✅ o'tadi |
| `npm test` (map testi) | ✅ 5 ta test o'tadi (§4.7) |
| **Qo'lda smoke test**: staff login | ✅ ishlaydi (§4.5 wrapper to'g'rimi) |
| **Qo'lda smoke test**: guardian login `mathacademy-MA-0001` | ✅ ishlaydi (birinchi-tire bag qaytmaganmi) |
| **Qo'lda smoke test**: o'quvchilar ro'yxati | ✅ avvalgi son |
| **Qo'lda smoke test**: o'quvchi yaratish (`$transaction`) | ✅ ishlaydi (ALS `$transaction` da saqlanadimi — §4.9) |
| **Qo'lda smoke test**: ranking (raw query) | ✅ ishlaydi |
| `TENANT_MISMATCH` loglari | **0 ta bo'lishi SHART** |

> 🔴 **`TENANT_MISMATCH` — bu bosqichning eng muhim signali.** Agar u loglarda
> paydo bo'lsa, demak biror servis **JWT dagidan boshqa** `tenant_id` yozayapti.
> Bu — **hozir mavjud bag**. Uni topish va tushunish **shart**, yumshatmasdan.

⚠️ **Rollback rejasi:** bitta feature flag:

```ts
const TENANT_EXTENSION_ENABLED = process.env.TENANT_EXTENSION !== 'off';
this.client = TENANT_EXTENSION_ENABLED
  ? this.base.$extends(tenantExtension)
  : (this.base as any);
```

Production da muammo chiqsa — `TENANT_EXTENSION=off` + restart. Qo'lda filtrlar
hali joyida, ya'ni tizim **avvalgi xavfsizlik darajasiga** qaytadi, nolga emas.

⚠️ **Flag 4-bosqichdan keyin O'CHIRILADI.** Aks holda u — doimiy bypass eshigi.

### 5.2-bosqich: 🚪 DARVOZA — izolyatsiya testi yoziladi va O'TADI

**Bu — butun rejaning markazi va 5.3 ning old sharti.**

⚠️ **Old shart: 5.0 (migratsiya drifti) bajarilgan bo'lishi SHART.** Aks holda
Testcontainers toza bazani ko'tara olmaydi.

**Nima qilinadi:** to'liq kod va Testcontainers setup —
**`13-testing-strategy.md` §5–6**. Bu yerda takrorlanmaydi. Qisqacha ko'rinish
va bu hujjat uchun ahamiyati §7 da.

**Nega extension dan KEYIN, lekin qo'lda filtrlarni olib tashlashdan OLDIN:**

Test **hozirgi** (qo'lda filtrli) kodda ham o'tishi kerak — chunki hozirgi kod
(bizning bilishimizcha) to'g'ri. Agar test **hozir yiqilsa** — demak biz
bilmagan **real bag topildi**. Bu — juda qimmatli natija.

> ✅ **Bu bosqichning haqiqiy qiymati:** test 3-bosqich uchun **xavfsizlik
> to'ri**. Usiz qo'lda filtrlarni olib tashlash — ko'r-ko'rona.

**Qanday tekshiriladi:**
- Test **o'tadi** → extension va qo'lda filtrlar rozi. 3-bosqichga yo'l ochiq
- Test **yiqiladi** → 🔴 **to'xtash**. Real bag topildi. Uni tuzatmasdan davom etilmaydi
- **Mutation check:** extension ni ataylab o'chir (`TENANT_EXTENSION=off`) va
  bitta servisdan qo'lda `tenant_id` ni olib tashla → test **yiqilishi SHART**.
  Yiqilmasa — test yolg'on, u hech narsani tekshirmayapti

> ⚠️ **Oxirgi punkt — eng muhimi.** O'tadigan test qiymatli emas; **to'g'ri
> sababdan yiqiladigan** test qiymatli. Buni tasdiqlamasdan 3-bosqichga
> o'tilmaydi.

### 5.3-bosqich: modul-modul qo'lda filtrlar olib tashlanadi

**Tartib — xavf bo'yicha teskari** (eng kam xavfli birinchi):

| # | Modul | Sabab |
|---|---|---|
| 1 | `subjects`, `living_types`, `campuses` | Kichik, oddiy CRUD, kam bog'liqlik |
| 2 | `cohorts`, `academic-years`, `groups` | O'rtacha |
| 3 | `attendance`, `assessments` | ⚠️ `via` model ishlatadi |
| 4 | `students` (2079 qator) | Eng katta, eng ko'p `$transaction` |
| 5 | `billing`, `dorms` | Pul — xato qimmat |
| 6 | `auth` (1644 qator) | ⚠️ **Oxirgi.** Kontekst o'rnatilishidan oldin ishlaydi |
| ❌ | `tenants` | **Hech qachon** — global servis (§2.11) |

**Har modul uchun sikl:**

```
1. Modulda `tenant_id` ni `where` dan olib tashla (data dan EMAS - hozircha)
2. `npm test` -> shu modulning izolyatsiya testi o'tishi SHART
3. Qo'lda smoke test - modulning asosiy oqimi
4. Alohida commit: "refactor(students): rely on tenant extension for scoping"
5. Keyingi modul
```

⚠️ **Har modul alohida commit.** Sabab: bitta modul buzilsa — `git revert`
bitta commit, boshqalari tegilmaydi.

**Qanday tekshiriladi (har modul):**

| Tekshiruv | Kutilgan |
|---|---|
| Modulning izolyatsiya testi | ✅ o'tadi |
| `grep -c "tenant_id" <modul>.service.ts` | Kamayadi |
| Modul smoke test | ✅ ishlaydi |
| `TENANT_MISMATCH` / `NO_TENANT_CONTEXT` | **0** |

⚠️ **`data.tenant_id` OXIRGI olib tashlanadi.** `where` dan olib tashlash
xavfsiz (extension qo'shadi). `data` dan olib tashlash — `create` ning
`tenant_id` `NOT NULL` ustuniga bog'liq, ya'ni xato bo'lsa **darhol crash**.
Bu yaxshi, lekin alohida qadam sifatida qilinsin.

### 5.4-bosqich: lint qoidasi — qo'lda `tenant_id` taqiqlanadi

Faqat **hamma modul** 3-bosqichdan o'tgach.

`apps/api/eslint.config.mjs`:

```js
{
  files: ['src/modules/**/*.service.ts', 'src/modules/**/*.controller.ts'],
  ignores: ['src/modules/tenants/**', 'src/modules/auth/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // Writing tenant_id by hand means either (a) you did not know the
        // extension exists, or (b) you are working around it. Both need a
        // reviewer, so both need an explicit eslint-disable with a reason.
        selector: "Property[key.name='tenant_id']",
        message:
          'tenant_id is applied automatically by the Prisma tenant extension ' +
          '(src/prisma/tenant.extension.ts). Do not write it by hand. ' +
          'See docs/03-multi-tenancy.md. If you genuinely need it, add ' +
          'eslint-disable-next-line with a justification.',
      },
      {
        selector:
          "MemberExpression[computed=true][property.value='prisma']",
        message:
          "Reaching into a service's private prisma via bracket notation " +
          'bypasses the service layer. Add a proper method instead. ' +
          'See docs/03-multi-tenancy.md section 3.8.',
      },
      {
        selector:
          "TaggedTemplateExpression[tag.property.name=/^\\$(query|execute)Raw$/]",
        message:
          'Raw SQL is invisible to the tenant extension ' +
          '(docs/03-multi-tenancy.md section 4.9). Include an explicit ' +
          'tenant_id predicate and eslint-disable with a justification.',
      },
    ],
  },
}
```

⚠️ **Istisnolar (`ignores`):**
- `modules/tenants/**` — global servis, `tenant_id` bilan ishlashi **kerak**
- `modules/auth/**` — `runWithTenant` ni o'zi o'rnatadi, `tenantId` bilan ishlaydi
- `prisma/tenant.extension.ts` — mexanizmning o'zi
- `prisma/seed.ts` — tenant yaratadi

**Qanday tekshiriladi:**
- `npm run lint` → ✅ 0 xato
- **Sun'iy tekshiruv:** biror servisga `where: { tenant_id, ... }` qo'sh →
  lint **yiqilishi SHART**
- **Sun'iy tekshiruv:** `service['prisma']` yoz → lint **yiqilishi SHART**

### 5.5-bosqich: tozalash

| Ish | Fayl |
|---|---|
| `withTenantCondition()` o'chiriladi | `common/utils/tenant.util.ts` (§3.7) |
| `getUserTenantId` / `ensureTenantId` ko'chiriladi | → `common/tenant/tenant-context.ts` |
| `tenant.util.ts` o'chiriladi | — |
| `TENANT_EXTENSION` flag o'chiriladi | `prisma.service.ts` (§5.1) |

**Tekshirish:** `grep -rn "tenant.util" apps/` → **0**.

### Bosqichlar jamlanmasi

| Bosqich | Diff | Xavf | To'xtash sharti |
|---|---|---|---|
| **5.0 migratsiya drifti** | 1 migratsiya fayli | 🔴 **bloker** | Diff'da `DROP` bo'lsa |
| 5.0b tayyorgarlik | ~200 qator | 🟢 past | — |
| 5.1 extension | ~6 yangi fayl | 🟡 o'rta | `TENANT_MISMATCH` > 0 |
| 5.2 test (**darvoza**) | `13-testing-strategy.md` §6 | 🟢 past | Test yiqilsa → real bag |
| 5.3 tozalash | ~845 nuqta, modul-modul | 🟡 o'rta | Har modulda test |
| 5.4 lint | ~30 qator | 🟢 past | — |
| 5.5 o'lik kod | −44 qator | 🟢 past | — |

**Bog'liqlik zanjiri — tartib buzilmaydi:**

```
5.0  migratsiya tuzatiladi
      |  (usiz toza baza ko'tarib bo'lmaydi)
      v
5.2  izolyatsiya testi yoziladi va O'TADI
      |  (usiz refactor ko'r-ko'rona)
      v
5.3  qo'lda filtrlar olib tashlanadi
```

⚠️ **5.1 (extension) 5.2 dan oldin ham, keyin ham qo'shilishi mumkin** — u
qo'lda filtrlarga xalaqit bermaydi. Lekin **5.3 faqat 5.2 dan keyin**.

⚠️ **Vaqt baholari ataylab yozilmadi.** Kanon §2: "Halol bo'l. Raqam to'qima."
Muddat — implementatsiya qiluvchi chat kod bilan tanishgach beradi.

---

## 6. PostgreSQL RLS — halol taqqoslash

### 6.1. RLS nima beradi

Row-Level Security — PostgreSQL ning **o'z** mexanizmi. Siyosat (policy)
jadvalga biriktiriladi va **har** `SELECT`/`UPDATE`/`DELETE` ga qo'llanadi —
so'rov qayerdan kelganidan **qat'i nazar**.

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
```

> **Hal qiluvchi farq:** bu siyosat **`$queryRaw` ni ham** qamraydi. Va `psql`
> dan qo'lda yozilgan so'rovni ham. Va ORM bagini ham. **Extension ning
> 4.9-bo'limdagi teshiklarining KO'PCHILIGI RLS da yo'q.**

`FORCE ROW LEVEL SECURITY` muhim: usiz jadval **egasi** (owner) siyosatni
chetlab o'tadi. Migratsiyalar owner sifatida ishlaydi, ya'ni app **boshqa
rol** bilan ulanishi kerak.

### 6.2. Nega u extension dan kuchli

| | Extension | RLS |
|---|---|---|
| `findMany`/`findUnique`/... | ✅ | ✅ |
| **`$queryRaw`** | ❌ **ko'rmaydi** | ✅ **qamraydi** |
| Nested `connect` | ❌ | ✅ |
| Nested `create` | 🟡 crash | ✅ |
| `psql` dan qo'lda so'rov | ❌ | ✅ |
| Boshqa til / servis shu DB ga ulansa | ❌ | ✅ |
| ORM ning o'z bagi | ❌ | ✅ |
| **`via` modellar** (§2.6) | 🟡 xarita kerak | ⚠️ **ular ham ustunsiz** |

⚠️ **Muhim: RLS ham 16 ta `via` modelni avtomatik hal qilmaydi.** Ustun yo'q →
siyosat yozib bo'lmaydi... to'g'ridan-to'g'ri. Lekin RLS da yechim **tozaroq**:

```sql
-- assessment_scores has no tenant_id, so the policy joins to the parent.
CREATE POLICY tenant_isolation ON assessment_scores
  USING (EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = assessment_scores.assessment_id
      AND a.tenant_id = current_setting('app.tenant_id')::bigint
  ));
```

Ishlaydi, lekin har satr uchun subquery — ⚠️ **performance narxi o'lchov bilan
aniqlanadi**. Muqobil: `assessment_scores` ga `tenant_id` ustuni **qo'shish**
(§6.6).

### 6.3. ⚠️ Muammo: `SET LOCAL` + connection pooling

Bu — RLS ning Prisma bilan asosiy to'siqi.

`current_setting('app.tenant_id')` qiymati **ulanishga (session) bog'liq**.
Ya'ni har so'rovdan oldin uni o'rnatish kerak:

```sql
SET LOCAL app.tenant_id = '5';   -- only lives until the transaction ends
```

`SET LOCAL` **tranzaksiya** doirasida yashaydi. Ya'ni **tranzaksiya kerak**.

`SET` (LOCAL siz) — **sessiya** doirasida yashaydi. Va aynan shu yerda
**xavf**: pool da ulanish qaytariladi va keyingi request **boshqa tenant** bilan
**o'sha ulanishni** oladi → `app.tenant_id` **eskisi qoladi** → **cross-tenant
o'qish**.

> 🔴 **`SET` (LOCAL siz) + pooling = ma'lumot sizishi.** Bu — RLS ni noto'g'ri
> qilishning klassik usuli. **Faqat `SET LOCAL` + tranzaksiya.**

**Prisma bilan nima demak:** har request **interactive transaction** ichida
bo'lishi kerak:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId.toString()}, true)`;
  //                                                       true = LOCAL (tx-scoped)
  return handler(tx);
});
```

⚠️ **Bu — arxitekturaviy zilzila:**
- **Har** HTTP request bitta uzun tranzaksiya bo'ladi
- Tranzaksiya ulanishni **band qiladi** — pool tugaydi
- Prisma interactive transaction ning **timeout** i bor (default 5s). Sekin
  request → `P2028`
- ⚠️ **Read-only endpoint ham tranzaksiyada** — bu keraksiz qulflar va WAL
  bosimi
- `students.service.ts` allaqachon `$transaction` ishlatadi (`:268, :763, ...`)
  → **ichma-ich tranzaksiya**. Prisma buni qo'llamaydi

> ⚠️ **`set_config(..., true)` va `SET LOCAL` — bir xil narsa.** `set_config`
> ni tanlash sababi: u **parametrlashtiriladi**, `SET LOCAL app.tenant_id = $1`
> esa yo'q (PostgreSQL `SET` da parametr qabul qilmaydi) → `SET LOCAL` bilan
> qiymatni string ga qo'shish kerak → **SQL injection yuzasi**. `set_config`
> bu muammoni yo'q qiladi.

### 6.4. PgBouncer transaction mode'da nima buziladi

Bu savol ataylab so'ralgan, chunki javob **intuitiv emas**.

**PgBouncer transaction mode:** ulanish **har tranzaksiya oxirida** pool ga
qaytariladi.

| Yondashuv | PgBouncer transaction mode |
|---|---|
| `SET app.tenant_id` (sessiya) | 🔴 **BUZILADI.** Tranzaksiya tugagach ulanish boshqa mijozga ketadi. Qiymat oqib ketadi yoki yo'qoladi — ikkalasi ham halokatli |
| `SET LOCAL` / `set_config(..., true)` **tranzaksiya ichida** | ✅ **ISHLAYDI.** Qiymat tranzaksiya bilan tug'iladi va o'ladi. Ulanish qaytarilganda qiymat ham yo'qoladi |
| Prepared statements | ⚠️ PgBouncer transaction mode da muammoli. Prisma `pg` adapter bilan buni boshqaradi, lekin **tekshirilsin** |

> ✅ **Ya'ni: `SET LOCAL` + tranzaksiya PgBouncer transaction mode bilan
> ISHLAYDI.** Bu — keng tarqalgan noto'g'ri tushuncha ("PgBouncer RLS ni
> buzadi"). U **sessiya-darajali** `SET` ni buzadi, `SET LOCAL` ni emas.

⚠️ **Lekin narx qoladi:** har request tranzaksiya bo'lgani uchun, PgBouncer ning
asosiy foydasi (ko'p qisqa so'rov → kam ulanish) **kamayadi**. Uzun tranzaksiya
= uzoq band ulanish.

⚠️ **MathAcademy da PgBouncer bormi — NOMA'LUM.** `prisma.service.ts:20-22`
to'g'ridan-to'g'ri `DATABASE_URL` ga ulanadi (`PrismaPg` adapter). Deployment
konfiguratsiyasi bu TZ ga kirmagan. **Ochiq savol (§10).**

### 6.5. Nega RLS hozir tanlanmadi

**Halol javob: u kuchliroq, lekin narxi hozir juda katta.**

| Sabab | Tafsilot |
|---|---|
| **1. Har request tranzaksiya** | §6.3 — arxitekturaviy zilzila. Ichma-ich `$transaction` muammosi (`students.service.ts:268` va yana 4 joy) |
| **2. Ikki DB roli kerak** | App `FORCE RLS` ostidagi non-owner rol bilan ulanishi kerak; migratsiya owner bilan. Hozir bitta `DATABASE_URL` |
| **3. 69 ta jadval × siyosat** | 51 ta oddiy + 16 ta subquery-li + 2 ta global. Migratsiya sifatida yozilishi kerak |
| **4. `via` modellar baribir muammo** | §6.2 — subquery, performance noma'lum |
| **5. Debug qiyin** | Siyosat yiqilsa — bo'sh natija, xato emas. "Nega ma'lumot yo'q?" deb soatlab qidiriladi |
| **6. Test yo'q** | ⚠️ **Eng muhim sabab.** RLS — DB darajasidagi katta o'zgarish. Uni **testsiz** kiritish — ko'r-ko'rona |

> **Qaror: RLS RAD ETILMAYDI — KEYINGA QOLDIRILADI.**
>
> Ketma-ketlik muhim: **avval test (§7), keyin extension (§5), keyin —
> imkoniyat bo'lsa — RLS ikkinchi qatlam sifatida.**
>
> Sabab: §7 dagi izolyatsiya testi **mexanizmdan mustaqil**. U HTTP darajasida
> ishlaydi. Ya'ni **o'sha test** RLS ni ham tasdiqlaydi. Test bo'lgach, RLS
> qo'shish **xavfsiz** bo'ladi — hozir emas.

### 6.6. RLS ga yo'l ochiq qolishi uchun nima qilinadi

Agar kelajakda RLS qo'shilsa, ikkita ish **hozirdan** uni osonlashtiradi:

**1. `via` modellarga `tenant_id` ustuni qo'shish (denormalizatsiya).**

16 ta modelga `tenant_id BigInt` qo'shilsa:
- Extension xaritasi (§4.7) **keraksiz** bo'ladi — hamma model `column`
- RLS siyosatlari **subquery'siz** — oddiy va tez
- §2.6 dagi strukturaviy zaiflik **yo'qoladi**

⚠️ **Narxi:** migratsiya (16 jadval, backfill), denormalizatsiya (bir ma'lumot
ikki joyda), va **izchillik** — `assessment_scores.tenant_id`
`assessments.tenant_id` bilan mos bo'lishi kerak. Buni FK bilan majburlash
mumkin:

```sql
-- Composite FK forces the child's tenant to match the parent's.
-- Without this, denormalisation just creates a second thing to get wrong.
ALTER TABLE assessments ADD UNIQUE (id, tenant_id);
ALTER TABLE assessment_scores
  ADD CONSTRAINT fk_scores_assessment_tenant
  FOREIGN KEY (assessment_id, tenant_id)
  REFERENCES assessments (id, tenant_id) ON DELETE CASCADE;
```

> ✅ **Bu — eng kuchli yechim.** U izolyatsiyani **DB constraint** darajasiga
> ko'taradi: bola satr otasidan boshqa tenantda **bo'la olmaydi**, hech qanday
> kod bilan. Extension ham, RLS ham keraksiz bo'lgan joyda.
>
> ⚠️ Lekin bu **69 model, 2 migratsiya** bo'lgan ishlab turgan tizimga katta
> o'zgarish. **Ochiq savol (§10)** — alohida baholansin.

**2. `set_config` uchun joy tayyorlash.** §4.10 dagi `PrismaService` da
tranzaksiya wrapper i uchun joy qoldirilsin — RLS qo'shilganda `runWithTenant`
ning ichiga `set_config` qo'shish yetarli bo'lsin.

### 6.7. Yakuniy taqqoslash

| Mezon | Extension | RLS | Composite FK (§6.6) |
|---|---|---|---|
| Kafolat darajasi | Ilova | **DB** | **DB (constraint)** |
| Raw query qamrovi | ❌ | ✅ | ✅ (struktura) |
| Bugungi narx | 🟡 o'rta | 🔴 yuqori | 🔴 yuqori (migratsiya) |
| Ishlab turgan tizimga xavf | 🟡 | 🔴 | 🟡 |
| Debug | 🟢 oson (exception) | 🔴 qiyin (bo'sh natija) | 🟢 oson (FK xatosi) |
| `via` modellar | 🟡 xarita | 🟡 subquery | ✅ **hal qiladi** |
| Testsiz kiritish mumkinmi | 🟡 flag bilan | ❌ **yo'q** | ❌ yo'q |

**Tavsiya etilgan ketma-ketlik:**

```
1. Test (section 7)         <- mexanizmdan mustaqil, hammasini tasdiqlaydi
2. Extension (section 5)    <- bugungi eng yaxshi narx/foyda
3. Composite FK (6.6)       <- strukturaviy, `via` muammosini yo'q qiladi
4. RLS (section 6)          <- oxirgi qatlam, agar hali kerak bo'lsa
```

⚠️ **Diqqat:** 3-qadamdan keyin 4-qadam **kerak bo'lmasligi mumkin**. Composite
FK + extension birgalikda RLS ning foydasining katta qismini beradi, narxining
kichik qismiga.

---

## 7. Tenant izolyatsiya testi — refactoring'ning DARVOZASI

> 📄 **To'liq kod: `13-testing-strategy.md` §5 (Testcontainers setup) va §6
> (izolyatsiya testi).** Bu yerda takrorlanmaydi.
>
> Bu bo'lim faqat shu hujjat uchun muhim bo'lgan narsani aytadi: **test nima
> uchun refactoring'dan OLDIN keladi.**

### 7.1. Nega bu — darvoza, "yaxshi bo'lardi" emas

§5.3 da **~845 ta Prisma chaqiruvidan** qo'lda `tenant_id` olib tashlanadi.
Ya'ni har bir chaqiruvda kafolat **qo'lda yozilgan filtrdan** → **extension'ga**
o'tadi.

Savol: **extension haqiqatan ham o'sha ishni bajarayotganini qayerdan bilamiz?**

Testsiz javob: **bilmaymiz.** Refactor'dan keyin kod **xuddi shunday ko'rinadi**
(`where: { status: 'ACTIVE' }`), lekin u endi ko'rinmaydigan mexanizmga tayanadi.
Agar extension biror holatda ishlamasa — masalan `via` model'da (§4.7),
`$transaction` ichida (§4.9), yoki `groupBy` da — natija:

```
Kod toza ko'rinadi. Testlar yo'q. Xato ishlab chiqarishga chiqadi.
Bir maktab ikkinchisining o'quvchilarini ko'radi.
```

> 🔴 **Testsiz refactor — himoyani olib tashlab, o'rniga tekshirilmagan
> narsani qo'yish.** Bu — hozirgi holatdan **YOMONROQ**. Hozir hech bo'lmasa
> 845 ta chaqiruv ko'z bilan tekshirilgan.
>
> **Qoida: test o'tmaguncha §5.3 boshlanmaydi. Istisno yo'q.**

### 7.2. Test nimani isbotlaydi — mexanizmdan mustaqil

Testning eng muhim xususiyati: u **HTTP darajasida** ishlaydi, Prisma
darajasida emas.

```
A tenantining JWT'si  ──►  GET /api/staff/students/<B ning o'quvchisi id>
                                        │
                                        ▼
                              404 yoki 403, HECH QACHON ma'lumot emas
```

**Nega bu hal qiluvchi:** test extension haqida **hech narsa bilmaydi**. U
`tenant_id` haqida ham, ALS haqida ham bilmaydi. U faqat **tashqi xulq-atvorni**
tekshiradi.

Oqibati — bitta test **to'rt xil mexanizmni** tasdiqlaydi:

| Mexanizm | Test o'zgaradimi |
|---|---|
| Hozirgi qo'lda filtrlar (845 nuqta) | ❌ yo'q |
| Prisma extension (§4) | ❌ yo'q |
| Composite FK (§6.6) | ❌ yo'q |
| PostgreSQL RLS (§6) | ❌ yo'q |

> ✅ **Shuning uchun test BIRINCHI yoziladi.** U bir marta yoziladi va
> mexanizm har qanday o'zgarganda **xuddi o'sha** test ishlatiladi. U —
> migratsiyaning butun davomida yagona o'zgarmas mezon.

### 7.3. Test hozirgi kodda ham O'TISHI kerak

⚠️ Bu — nozik va muhim nuqta.

Test **extension'dan oldin**, hozirgi qo'lda filtrli kodda yoziladi va
**o'tishi kerak** — chunki hozirgi kod (bizning bilishimizcha) to'g'ri.

| Natija | Ma'nosi |
|---|---|
| Test **o'tadi** | ✅ Hozirgi kod to'g'ri. Darvoza ochiq — §5.1/5.3 ga yo'l bor |
| Test **yiqiladi** | 🔴 **TO'XTA.** Biz bilmagan **real bag** topildi — ya'ni bir maktab hozir boshqasining ma'lumotini ko'ryapti. Bu — TZ emas, **insident** |

> Ikkinchi natija **ehtimoldan yiroq emas**. §3.8 da ko'rsatilgan
> `guardian-student.controller.ts` naqshi aynan shunday narsa qanday paydo
> bo'lishini ko'rsatadi.

### 7.4. ⚠️ Mutation check — o'tadigan test yetarli emas

O'tadigan test **hech narsani isbotlamaydi** — u har doim `expect(true)` bo'lishi
mumkin. Test **to'g'ri sababdan yiqilishini** tasdiqlash **shart**:

```bash
# 1. Extension'ni ataylab o'chir
TENANT_EXTENSION=off npm run test:integration
#    -> qo'lda filtrlar hali joyida, test O'TADI (kutilgan)

# 2. Endi bitta servisdan qo'lda filtrni ham olib tashla:
#    students.service.ts:98 dan `tenant_id,` ni o'chir
TENANT_EXTENSION=off npm run test:integration
#    -> test YIQILISHI SHART

# 3. Extension'ni yoq, qo'lda filtr hali o'chirilgan holatda:
npm run test:integration
#    -> test QAYTA O'TISHI SHART  <- BU ENG MUHIM TASDIQ
```

> ✅ **3-qadam — butun rejaning isboti.** U aynan shuni ko'rsatadi:
> **extension qo'lda filtrning o'rnini bosa oladi.** Bu tasdiqlanmasa,
> §5.3 — taxminga asoslangan refactor.
>
> ⚠️ Bu uch qadam **hujjatlashtirilsin va natijasi yozilsin**. "Test o'tdi"
> yetarli emas — "test o'chirilgan himoyada yiqildi va extension bilan
> qaytadan o'tdi" kerak.

### 7.5. Qamrov: qaysi modullar

`13-testing-strategy.md` §6.3 parametrlashtirilgan testni beradi. Bu hujjat
nuqtai nazaridan **majburiy minimum**:

| Ustuvorlik | Modul | Sabab |
|---|---|---|
| 🔴 1 | `students` | Asosiy entity, 2079 qator |
| 🔴 2 | `assessments` + `assessment_scores` | ⚠️ **`via` model** (§2.6) — extension'ning eng zaif joyi |
| 🔴 3 | `billing`, `invoices`, `payments` | Pul |
| 🔴 4 | `guardian-*` endpointlari | §3.8 — servis qatlami aylanib o'tilgan |
| 🟡 5 | `attendance` + `attendance_marks` | `via` model |
| 🟡 6 | `ranking` | ⚠️ **raw query** (§2.10) — extension qamramaydi |
| 🟡 7 | qolgan 22 modul | Parametrlashtirilgan |

⚠️ **2, 5 va 6 — eng muhim.** Ular aynan extension **kafolat bermaydigan**
joylar. Qolganlari extension bilan avtomatik ishlaydi; bular — yo'q.

---

## 8. JWT'dan tenant — hech qachon mijozdan

### 8.1. Qoida

> **Tenant faqat va faqat imzolangan JWT payload'idan olinadi.**
> Query param'dan, body'dan, header'dan, subdomain'dan — **hech qachon**.

Sabab oddiy: mijozdan kelgan har qanday narsa — **mijoz nazoratida**.
`?tenantId=2` ni `?tenantId=3` ga o'zgartirish — brauzerda bir soniya.

### 8.2. Hozirgi kod — bu qoidaga amal qiladi

Zanjir to'liq va to'g'ri:

**1. Token yaratilishida tenant serverdan keladi** —
`auth.service.ts:415-416, 473-475`:

```ts
      const tenantSlug = String(dto.tenantSlug || '').trim();
      const tenantId = await this.getTenantIdBySlugOrThrow(tenantSlug);
      ...
      const payload = {
        tenantId: tenantId.toString(),
        type: 'STAFF',
```

⚠️ Mijoz `tenantSlug` **yuboradi** — lekin bu xavfsiz: u faqat **qaysi
akademiyaga login qilmoqchi** ekanini bildiradi. Parol o'sha tenant ichida
tekshiriladi (`auth.service.ts:424` — `where: { tenant_id: tenantId, username }`).
Noto'g'ri slug = noto'g'ri parol = `INVALID_CREDENTIALS`.

**2. Token imzolanadi** — `auth.service.ts:314`:

```ts
    const accessToken = await this.jwt.signAsync(payload, {
```

**3. Har request'da verify qilinadi** — `jwt-request.util.ts:63-70`:

```ts
  const secret = String(process.env.JWT_ACCESS_SECRET || '').trim();
  if (!secret)
    throw new InternalServerErrorException('JWT_ACCESS_SECRET_MISSING');

  try {
    const payload = await jwt.verifyAsync<RequestUser>(token, { secret });

    if (!payload?.type) throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
```

✅ `verifyAsync` imzoni tekshiradi. Payload o'zgartirilgan bo'lsa — xato.
✅ Secret yo'q bo'lsa — **ishga tushmaydi**, "secret'siz davom etish" yo'q.

**4. Controller JWT'dan oladi** — `students.controller.ts:67`:

```ts
      tenantId: String(req.user?.tenantId || ''),
```

✅ `req.user` — `ensureUser()` qo'ygan **verify qilingan** payload
(`jwt-request.util.ts:82`).

> ✅ **Halol baho: bu zanjir to'g'ri.** Hech qaysi endpoint tenant'ni mijoz
> parametridan olmaydi. Bu — kanon §5.1 ning da'vosi va u **tasdiqlandi**.

### 8.3. Guard nima qiladi — va nima qilmaydi

Uchta guard bor. ⚠️ **Ularning hech biri tenant'ni tekshirmaydi** — va bu
**to'g'ri**, chunki tekshiradigan narsa yo'q: tenant JWT'dan keladi, ya'ni u
allaqachon ishonchli.

`access.guard.ts:13-17` — to'liq:

```ts
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    await ensureUser(req, this.jwt, this.prisma);
    return true;
  }
```

**Vazifasi:** "sen kimsan?" (autentifikatsiya). Tenant'ni **o'rnatadi**
(`req.user`), lekin **tekshirmaydi**.

`perms.guard.ts:22-37` — vazifasi: "senda ruxsat bormi?" (avtorizatsiya):

```ts
    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = await ensureUser(req, this.jwt, this.prisma);

    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (roles.includes('SUPERADMIN')) return true;

    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    const ok = required.every((p) => perms.includes(p));
    if (!ok) throw new ForbiddenException('FORBIDDEN_PERMISSION');
    return true;
```

⚠️ **`perms.guard.ts:32` — `SUPERADMIN` ruxsat tekshiruvini butunlay
chetlab o'tadi.** Lekin **tenant'ni emas** — uning `tenantId` si baribir
JWT'dan. Ya'ni superadmin **o'z tenanti ichida** hamma narsa qila oladi,
lekin boshqa tenantga **kira olmaydi**. Bu — §9 ning mavzusi.

### 8.4. Uchta qatlam — mas'uliyat taqsimoti

Extension qo'shilgach rasm shunday bo'ladi:

| Qatlam | Savol | Fayl | Yiqilsa |
|---|---|---|---|
| **Autentifikatsiya** | Sen kimsan? | `jwt-request.util.ts:52` | 401 |
| **Avtorizatsiya** | Senda ruxsat bormi? | `perms.guard.ts:22` | 403 |
| **Izolyatsiya** | Bu ma'lumot seningmi? | `tenant.extension.ts` | **404** |

> ⚠️ **Nega izolyatsiya 404 beradi, 403 emas.**
>
> 403 ("taqiqlangan") — **mavjudlikni tasdiqlaydi**. A tenanti
> `/students/42` so'rasa va 403 olsa, u biladi: **42-o'quvchi mavjud**, faqat
> boshqa maktabda. Bu — ma'lumot sizishi (mavjudlik oracle'i).
>
> 404 hech narsa aytmaydi. Extension aynan shuni beradi: `where` ga
> `tenant_id` qo'shiladi → `findFirst` `null` qaytaradi → servis
> `NotFoundException`. **Sizish yo'q.**
>
> ✅ Hozirgi kod allaqachon shunday: `students.service.ts:538-543` —
> `findFirst({ where: { id, tenant_id } })` → topilmasa `NOT_FOUND`.

### 8.5. ⚠️ Token TTL — tasdiqlangan fakt

Kanon §5.4 ziddiyat qayd etgan: *"`.env.example` da `ACCESS_TOKEN_TTL="15h"` —
README 15 daqiqa deydi. Ziddiyat, tekshirilsin."*

**Tekshirildi — ziddiyat HAL QILINGAN:**

```bash
grep -rn "ACCESS_TOKEN_TTL" render.yaml apps/api/.env.example
# render.yaml:21:      - key: ACCESS_TOKEN_TTL
# apps/api/.env.example:31:ACCESS_TOKEN_TTL="15m"
```

✅ `.env.example` endi **`15m`** — 15 daqiqa. `render.yaml:21` da deploy
qiymati **`15m`**. Kanon o'qigan `15h` — **eskirgan**, u tuzatilgan.

> ⚠️ **Bu hujjatda "deploy'da 15 soat" DEB YOZILMAYDI — bu xato bo'lardi.**
> Access token TTL = **15 daqiqa**, refresh = 30 kun.

**Nega bu multi-tenancy uchun muhim:** JWT'da `tenantId` bor. Foydalanuvchi
boshqa tenantga ko'chirilsa (yoki o'chirilsa), eski token **TTL tugagunga
qadar** eski `tenantId` bilan ishlaydi. 15 daqiqa — qabul qilinadigan oyna.
15 soat — **bo'lmasdi**. ✅ Hozirgi qiymat to'g'ri.

⚠️ Qo'shimcha himoya bor: `jwt-request.util.ts:76-79` har request'da
`auth_sessions` ni tekshiradi, ya'ni sessiya bekor qilinsa token **darhol**
ishlamaydi — TTL kutilmaydi. §4.4 bu tekshiruvga `tenant_id` moslik shartini
ham qo'shadi.

---

## 9. Superadmin cross-tenant kirishi

### 9.1. Hozirgi holat — superadmin cross-tenant KIRA OLMAYDI

Bu — audit natijasi, taxmin emas.

`perms.guard.ts:32`:

```ts
    if (roles.includes('SUPERADMIN')) return true;
```

Superadmin **ruxsat** tekshiruvidan o'tadi. Lekin uning `tenantId` si —
JWT'dan (`auth.service.ts:474`), ya'ni **bitta aniq tenant**. Va servislar
`tenantId` ni `req.user` dan olishadi (`students.controller.ts:67`).

> ✅ **Ya'ni hozir "superadmin" = "o'z akademiyasida cheklanmagan huquq",
> "hamma akademiyaga kirish" emas.** Bu — **to'g'ri va xavfsiz** dizayn.

⚠️ **Bitta istisno:** `tenants.service.ts` (§2.11) global. `GET /api/staff/tenants`
**barcha** tenantlar ro'yxatini qaytaradi (`tenants.service.ts:109-115`).

Bu — o'quvchi ma'lumoti emas, lekin: akademiya A ning admini raqib akademiya B
ning shu tizimda ekanini bilib oladi. ⚠️ **Bu endpoint kim uchun ochiqligi
tekshirilishi kerak** — §10 ochiq savol.

### 9.2. Kerakmi? — Ha, lekin cheklangan

**Argument: kerak.**

- **Qo'llab-quvvatlash.** Akademiya qo'ng'iroq qiladi: "hisobotimiz noto'g'ri".
  Muallif ko'ra olmasa — muammoni tiklash imkonsiz
- **Onboarding.** Kanon §6: "Self-service onboarding yo'q". Yangi tenant
  sozlanayotganda kimdir uning ma'lumotini ko'rishi kerak
- **Insident.** Ma'lumot buzilsa — tiklash uchun kirish kerak

**Argument: xavfli.**

- **Bu — bolalar ma'lumoti.** Kanon §10: voyaga yetmagan o'quvchilar
- Bitta buzilgan superadmin akkaunt = **hamma akademiya** sizadi
- Kanon §5.4: seed superadmin paroli **public README'da chop etilgan edi**.
  Bu — nazariy xavf emas, **shu loyihada bo'lgan voqea**

> ⚠️ **Aynan shu tarix sababli cross-tenant kirish `TENANT_BYPASS` sifatida
> emas, TOR va AUDIT QILINADIGAN yo'l sifatida qurilishi kerak.**
> Agar o'sha paytda superadmin cross-tenant kira olganda, README'dagi parol
> **bitta emas, hamma akademiyani** ochardi.

### 9.3. Qaror

> **Cross-tenant kirish — `PLATFORM_ADMIN` uchun, `SUPERADMIN` uchun EMAS.**

Ikkisi **boshqa** narsa:

| | `SUPERADMIN` | `PLATFORM_ADMIN` |
|---|---|---|
| Kim | Akademiya admini | Platforma egasi (muallif) |
| Qamrov | **Bitta** tenant | Hamma tenant |
| Qayerda | `roles` jadvalida (`tenant_id` bor) | ⚠️ Alohida mexanizm |
| Hozir bormi | ✅ ha | ❌ **yo'q** |

⚠️ **Muhim:** `roles` modelida `tenant_id` **bor** (§2.6). Ya'ni rol —
tenant ichidagi narsa. `PLATFORM_ADMIN` ni `roles` ga qo'shib bo'lmaydi — u
tenantdan **tashqarida** turishi kerak. Bu — yangi model yoki `users` da
alohida flag. **Ochiq savol (§10).**

### 9.4. Agar qurilsa — qanday

**Tamoyillar:**

1. **Impersonation, bypass emas.** Platforma admini "hamma tenantni ko'radi"
   emas — u **bitta aniq tenantga kiradi**, muddat bilan
2. **Sabab majburiy.** Ticket raqami yoki matn — bo'sh bo'lsa rad etiladi
3. **Har so'rov audit'ga.** Bir yozuv emas — **har bir** so'rov
4. **Muddat.** Sessiya qisqa (masalan 30 daqiqa), avtomatik tugaydi
5. **Yozish taqiqlanadi.** Faqat `READ`. Yozish kerak bo'lsa — alohida qaror

```ts
/**
 * Grants a platform admin temporary, audited, READ-ONLY access to one tenant.
 *
 * This is deliberately NOT a "see all tenants" switch. It is impersonation of
 * a single named tenant, with a reason, for a bounded time, and every query
 * made inside it is attributable.
 *
 * Why not runWithoutTenant(): that disables filtering entirely, which would
 * let a single bug in one endpoint dump every academy at once. Binding to one
 * tenant keeps the blast radius at one tenant even if something goes wrong.
 */
async impersonateTenant(args: {
  actorUserId: bigint;
  targetTenantId: bigint;
  reason: string;
  ipAddress?: string;
}) {
  if (!args.reason?.trim()) {
    throw new BadRequestException('IMPERSONATION_REASON_REQUIRED');
  }

  // The audit row is written BEFORE access is granted, and outside the
  // impersonation context. If the process dies mid-session the record of the
  // attempt still exists. Ordering matters: this mirrors the seed.ts fix in
  // canon 5.4, where the check moved BEFORE the first DB write.
  await runWithoutTenant('audit: impersonation grant', () =>
    this.prisma.audit_logs.create({
      data: {
        tenant_id: args.targetTenantId,
        actor_type: 'STAFF',
        actor_user_id: args.actorUserId,
        action: 'IMPERSONATE_START',
        entity_type: 'tenants',
        entity_id: args.targetTenantId,
        after_data: JSON.stringify({ reason: args.reason }),
        ip_address: args.ipAddress,
      },
    }),
  );

  // Bound to ONE tenant - the extension keeps filtering normally.
  return this.jwt.signAsync(
    {
      tenantId: args.targetTenantId.toString(),
      type: 'STAFF',
      userId: args.actorUserId.toString(),
      roles: ['PLATFORM_ADMIN_IMPERSONATING'],
      permissions: [],           // read-only: no write permissions granted
      impersonation: {
        actorUserId: args.actorUserId.toString(),
        reason: args.reason,
      },
    },
    // Longer than a normal access token (15m, see section 8.5) on purpose: an
    // impersonated session must not silently refresh. When it expires the
    // admin has to ask again, with a reason, producing a fresh audit row.
    // The TTL bounds the session, not the convenience.
    { expiresIn: '30m' },
  );
}
```

> ✅ **Diqqat: bu yechim extension'ni O'CHIRMAYDI.** Impersonation token'ida
> `tenantId` **bitta** tenant — ya'ni extension odatdagidek filtrlaydi.
> Ya'ni platforma admini ham **bir vaqtda faqat bitta** akademiyani ko'radi.
>
> **Blast radius: bitta tenant.** `runWithoutTenant()` ishlatilganda —
> **hamma tenant**. Farq juda katta.

**Audit — har so'rov uchun:**

```ts
/**
 * Impersonated sessions are logged per-request, not per-session. A single
 * "admin entered tenant 5" row does not answer the question a parent will
 * actually ask: "who looked at MY child's record, and when?"
 */
@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const imp = req.user?.impersonation;
    if (!imp) return next.handle();

    return next.handle().pipe(
      tap(() => {
        void runWithoutTenant('audit: impersonated request', () =>
          this.prisma.audit_logs.create({
            data: {
              tenant_id: BigInt(req.user.tenantId),
              actor_type: 'STAFF',
              actor_user_id: BigInt(imp.actorUserId),
              action: 'IMPERSONATE_READ',
              entity_type: 'http',
              after_data: JSON.stringify({
                method: req.method,
                path: req.originalUrl,
                reason: imp.reason,
              }),
            },
          }),
        );
      }),
    );
  }
}
```

⚠️ **Tenant ko'rishi kerakmi?** Ya'ni akademiya A ga: "platforma admini
2026-07-16 da ma'lumotingizni ko'rdi, sabab: TICKET-42". **Ochiq savol (§10)** —
lekin `audit_logs.tenant_id` = **target tenant**, ya'ni ma'lumot bor va uni
ko'rsatish texnik jihatdan tayyor.

### 9.5. Hozircha — qurilmaydi

> **Tavsiya: `PLATFORM_ADMIN` HOZIR qurilmaydi.**

Sabab:
- Hozir **bitta** akademiya ishlaydi. Muallif — o'sha akademiyaning superadmini.
  Cross-tenant kirish **hech kimga kerak emas**
- Har qanday bypass mexanizmi — **yangi hujum yuzasi**. Ehtiyoj yo'q joyda
  qurish = bepul xavf
- ⚠️ **Ustuvorlik:** §5 (extension) va §7 (test) **birinchi**. Ular bo'lmasa
  impersonation qurish — himoyasiz tizimga orqa eshik qo'shish

**Qachon qurilsan:** ikkinchi tenant qo'shilganda va birinchi
"bizning hisobotimiz noto'g'ri" qo'ng'irog'i kelganda. **Undan oldin emas.**

---

## 9b. ⚠️ Extension qamramaydigan yuza: fayllar

Bu — audit paytida topilgan va **extension'dan butunlay tashqarida** turgan
muammo. U shu yerda qayd etiladi, chunki u **tenant izolyatsiyasi** masalasi.

### 9b.1. `/uploads` barcha guard'lardan tashqarida

`apps/api/src/main.ts:57-68`:

```ts
  const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  app.use(
    '/uploads',
    express.static(uploadDir, {
      maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
      etag: true,
      fallthrough: true,
    }),
  );

  app.setGlobalPrefix(globalPrefix);      // <- :68, /api prefiksi SHU YERDA
```

⚠️ **`express.static` `setGlobalPrefix` dan OLDIN ro'yxatdan o'tadi.** Ya'ni
`/uploads/*` — `/api` prefiksidan **tashqarida**, ya'ni:

- ❌ `AccessGuard` **ishlamaydi** — JWT talab qilinmaydi
- ❌ `PermissionsGuard` **ishlamaydi**
- ❌ Tenant middleware (§4.4) **ishlamaydi**
- ❌ Prisma **umuman ishtirok etmaydi** → **extension ham yo'q**

> 🔴 **Xulosa: fayllar uchun tenant izolyatsiyasi UMUMAN YO'Q.**
> `GET /uploads/<path>` — **autentifikatsiyasiz**, internetdagi har kimga ochiq.

### 9b.2. Yagona himoya — nom topilmasligi

`apps/api/src/modules/files/files.storage.ts:85` va `:98`:

```ts
  const stored = `${Date.now()}_${randomUUID()}${ext || ''}`;
  ...
  const url = `/uploads${rel.startsWith('/') ? '' : '/'}${rel}`;
```

Fayl nomi — `<timestamp>_<uuid v4><ext>`. Ya'ni himoya **faqat** URL'ni
taxmin qilib bo'lmasligiga tayanadi ("security through obscurity").

**Halol baho:** `randomUUID()` — kriptografik jihatdan kuchli (122 bit
entropiya). URL'ni **brute-force** qilib bo'lmaydi. Ya'ni bu **eng yomon**
turdagi teshik emas.

⚠️ **Lekin:**

| Xavf | Tafsilot |
|---|---|
| **URL abadiy** | Bir marta sizsa (Telegram'ga tashlansa, brauzer tarixida, Referer header'da, proxy log'ida) — **abadiy ochiq**. Bekor qilish yo'q |
| **`maxAge: '30d'`** (`main.ts:63`) | Fayl CDN va brauzer keshida 30 kun. O'chirilgandan keyin ham |
| **Ruxsat tekshirilmaydi** | A akademiyaning xodimi B ning fayl URL'ini olsa — **ochadi**. Tenant tekshiruvi yo'q |
| **O'chirish** | `files.service.ts:527` — `safeDeleteLocalFile`. DB'dan o'chadi, keshdan — yo'q |

⚠️ **Va bu — bolalar ma'lumoti.** `files` modelining `purpose` maydoni bor;
`violations.files` (intizom) va `certificates` unga bog'langan. Ya'ni bu
fayllar — o'quvchi hujjatlari, intizom dalillari, sertifikatlar.

### 9b.3. `files` modeli o'zi to'g'ri

Adolat uchun: `files` **modelida** hammasi joyida —

```prisma
model files {
  id                  BigInt         @id @default(autoincrement())
  tenant_id           BigInt
  ...
  @@index([tenant_id, owner_type, owner_id, purpose])
}
```

✅ `tenant_id` bor → extension `files` **jadvalini** himoya qiladi. Ya'ni
`GET /api/staff/files` **filtrlanadi**.

> 🔴 **Muammo — metama'lumot bilan kontent orasidagi bo'shliq.**
> Prisma `files` **yozuvini** himoya qiladi. `express.static` **faylning
> o'zini** hech qanday himoyasiz beradi. Extension bu bo'shliqni
> **qamray olmaydi** — u Prisma qatlamida yashaydi, fayl esa u yerdan o'tmaydi.

### 9b.4. Yechim yo'nalishi

Bu — shu hujjatning ishi **emas** (u `10-security.md` / `11-infrastructure.md`
ga tegishli), lekin yo'nalish qayd etiladi:

```ts
/**
 * Files must be served THROUGH the app, not around it.
 *
 * Today express.static (main.ts:57) is mounted before setGlobalPrefix, so file
 * bytes never pass a guard and never touch Prisma - which is exactly why the
 * tenant extension cannot help here. Routing downloads through a controller
 * puts them back inside the same isolation everything else already has.
 */
@UseGuards(PermissionsGuard)
@Get('files/:id/download')
async download(@Param('id', ParseBigIntPipe) id: bigint, @Res() res: Response) {
  // Goes through the extension: a file from another tenant simply is not found.
  const file = await this.prisma.files.findFirst({ where: { id } });
  if (!file) throw new NotFoundException('FILE_NOT_FOUND');

  return res.sendFile(resolve(file.storage_path!));
}
```

**Bosqichlar:**
1. `express.static` **o'chiriladi** (`main.ts:57-66`)
2. Yuklab olish controller orqali — guard + extension ishlaydi
3. ⚠️ Yoki: S3/R2 + **qisqa muddatli presigned URL** (`11-infrastructure.md`)
4. `maxAge: '30d'` → `private, no-store` (tenant ma'lumoti keshlanmasin)

⚠️ **Buzilish xavfi:** frontend `/uploads/...` URL'larini to'g'ridan-to'g'ri
`<img src>` da ishlatadi. Ularni o'zgartirish — frontend ishi. **Ochiq savol (§10).**

---

## 10. Ochiq savollar

Javob berilmagan savollar. Ular **to'qib chiqarilmaydi** — kim javob berishi
ko'rsatilgan.

### Texnik — implementatsiya paytida hal qilinadi

| # | Savol | Kim |
|---|---|---|
| 1 | **`extendedWhereUnique` SQL'ga tushadimi yoki JS'da filtrlaydimi?** (§4.6) Xavfsizlik natijasi bir xil, lekin ikkinchisida yozuv bir lahza xotiraga o'qiladi. `log: ['query']` bilan tekshirilsin | Implementatsiya |
| 2 | **`via` modelda `findUnique` + relation filtri ishlaydimi?** (§4.8) Ishlamasa — `findFirst` ga qo'lda o'tish | Implementatsiya |
| 3 | **ALS konteksti `$transaction` ichida saqlanadimi?** (§4.9) `students.service.ts:268` va yana 4 joy shunga bog'liq. **Test bilan tasdiqlansin** | Implementatsiya |
| 4 | **Proxy (§4.10) vs `client` maydoni** — qaysi biri? Proxy ~845 chaqiruvni saqlaydi, lekin TypeScript hiylasi talab qiladi | Implementatsiya |
| 5 | **Proxy overhead o'lchansin** — sezilarli bo'lsa delegate'lar keshlansin | Implementatsiya |
| 6 | **`async_hooks` overhead** — o'lchansin | Implementatsiya |

### Arxitekturaviy — qaror kerak

| # | Savol | Kim |
|---|---|---|
| 7 | **16 `via` modelga `tenant_id` qo'shilsinmi?** (§6.6) Composite FK bilan bu izolyatsiyani **DB constraint** darajasiga ko'taradi va xaritani (§4.7) keraksiz qiladi. Narxi: migratsiya + backfill + denormalizatsiya | Muallif |
| 8 | **RLS qo'shiladimi — qachon?** (§6) Tavsiya: test → extension → composite FK → **keyin** baholansin. 3-qadamdan keyin kerak bo'lmasligi mumkin | Muallif |
| 9 | **PgBouncer ishlatiladimi?** (§6.4) `prisma.service.ts:20` to'g'ridan-to'g'ri `DATABASE_URL`. RLS qarori shunga bog'liq | Muallif / infra |
| 10 | **Production bazada `track_subjects` bormi?** (§5.0) `db push` qilinganmi? Migratsiyani `resolve --applied` qilish kerakmi — javob shunga bog'liq. ⚠️ **Bu 5.0 ni bloklaydi** | Muallif |

### Mahsulot — javob kerak

| # | Savol | Kim |
|---|---|---|
| 11 | **`GET /api/staff/tenants` kim uchun?** (§2.11, §9.1) Oddiy tenant admini barcha akademiyalar ro'yxatini ko'rishi kerakmi? Agar yo'q — `PLATFORM_ADMIN` bilan cheklansin | Muallif |
| 12 | **`PLATFORM_ADMIN` qayerda yashaydi?** (§9.3) `roles` da `tenant_id` bor, ya'ni rol tenant ichidagi narsa. Yangi model kerakmi yoki `users` da flag? | Muallif |
| 13 | **Impersonation tenant'ga ko'rsatiladimi?** (§9.4) "Platforma admini ma'lumotingizni ko'rdi, sabab: X". Texnik jihatdan tayyor (`audit_logs.tenant_id` = target) | Muallif |
| 14 | **Impersonation yozish huquqiga ega bo'lsinmi?** (§9.4) Tavsiya: yo'q, faqat `READ` | Muallif |
| 15 | **`/uploads` qachon yopiladi?** (§9b) Frontend `<img src="/uploads/...">` ishlatadi — o'zgartirish frontend ishini talab qiladi. Ustuvorligi? | Muallif |

### Yuridik — ⚠️ yurist savoli

| # | Savol |
|---|---|
| 16 | **Kanon §10:** bu — maktab, o'quvchilar **voyaga yetmagan**. O'zbekiston qonunchiligida bolalar shaxsiy ma'lumotlarini **shared database**'da saqlashga cheklov bormi? Ba'zi yurisdiksiyalarda ta'lim ma'lumoti uchun **fizik ajratish** talab qilinadi — bu bo'lsa §1.3 qarori qayta ko'riladi |
| 17 | Akademiya bilan shartnomada "ma'lumot alohida bazada" talabi bo'lsa? §1.4 dagi hybrid yo'l |
| 18 | Impersonation (§9.4) — platforma egasining bolalar ma'lumotiga kirishi **qonuniy asosi** bormi? Ota-ona roziligi kerakmi? |
| 19 | **§9b:** autentifikatsiyasiz ochiq fayllar (intizom dalillari, sertifikatlar) — bu **hozirgi** holat. Bu ma'lumotni himoya qilish talabini buzadimi? ⚠️ **Bu nazariy emas — bugungi kod** |

### ⚠️ Javobi bo'lmagan — halol e'tirof

| # | |
|---|---|
| 20 | **Bozor hajmi noma'lum.** Kanon §7: O'zbekistonda nechta yotoqxonali tayyorlov akademiyasi bor — **noma'lum**. Bu multi-tenancy'ning **iqtisodiy** asosini belgilaydi. 3 ta akademiya bo'lsa — shared database ortiqcha murakkablik. 300 ta bo'lsa — u yagona yo'l. ⚠️ **To'qib chiqarilmaydi** |
| 21 | **Nechta tenant kutilmoqda?** §1.2 dagi tahlil "100 tenant" ni misol qildi. Real raqam — noma'lum |

---

## Xulosa — bir sahifada

**Muammo:** izolyatsiya kafolati **kodda emas, dasturchi xotirasida**.
**845** ta Prisma chaqiruv nuqtasi — har birida tenant haqida o'ylash kerak
(kanon buni 176 deb sanagan: `findFirst` — 272 ta — hisobga olinmagan) va **16 ta
strukturaviy himoyasiz model** (§2.6 — kanonda yo'q, shu audit topdi).

**Fojia:** `tenant.util.ts` — to'g'ri yozilgan, **0 marta ishlatilgan** (§3).
U himoyaga o'xshaydi, shuning uchun himoyasizlikdan **yomonroq** — auditni
chalg'itadi.

**Yechim:** Prisma client extension (§4) — `tenant_id` **avtomatik**
qo'shiladi, unutish **imkonsiz**. ALS orqali kontekst. Fail-closed.

**Halol cheklovlar:** extension raw query'ni (§4.9), nested `connect`'ni va
**fayllarni** (§9b) qamramaydi. Xarita (§4.7) — 845 nuqtani **1 ga**
kamaytiradi, **nolga emas**.

**Tartib — buzilmaydi:**

```
5.0  migratsiya drifti tuzatiladi     <- 🔴 BLOKER: usiz toza baza yo'q
      v
5.2  izolyatsiya testi O'TADI          <- 🚪 DARVOZA: usiz refactor ko'r-ko'rona
      v
5.1  extension qo'shiladi              <- qo'lda filtrlar QOLADI, zarar yo'q
      v
5.3  modul-modul tozalanadi            <- har modul testdan keyin
      v
5.4  lint majburlaydi
      v
6.6  composite FK (baholansin)         <- `via` muammosini butunlay yo'q qiladi
      v
6    RLS (agar hali kerak bo'lsa)
```

> **Eng muhim jumla:** test — mexanizmdan **mustaqil** (§7.2). U bir marta
> yoziladi va extension'ni ham, RLS'ni ham, composite FK'ni ham **bir xil**
> tasdiqlaydi. Shuning uchun u **birinchi**.
