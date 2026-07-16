# ADR-0002 — Tenant izolyatsiyasi: `tenant_id` Prisma client extension bilan avtomatik qo'yiladi

- **Holat:** Taklif
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

[ADR-0001](./0001-shared-database-multi-tenancy.md) shared database'ni tanladi va
uning narxini ochiq yozdi:

> **Izolyatsiya kafolati kodga tayanadi, bazaga emas. Fizik to'siq yo'q.**

Bu ADR — o'sha narxni to'lash urinishi. U loyihaning **eng muhim texnik qarori**,
chunki u bitta savolga javob beradi: *bir akademiya ikkinchisining bolalari
ma'lumotini ko'rmasligini nima kafolatlaydi?*

Hozirgi javob: **hech narsa. Faqat dasturchining xotirasi.**

### O'lchangan holat

Barcha raqamlar `apps/api` bo'yicha o'lchangan (2026-07-15/16):

| Fakt | Raqam | Usul |
|---|---:|---|
| Butun `src/` da Prisma chaqiruvlari | **845** | grep, 13 ta operatsiya bo'yicha |
| Ulardan `findFirst` (eng katta toifa) | **272** | grep |
| `*.service.ts` da `findMany` + `findUnique` | **176** | 121 + 55, grep — kanon shu tor kesimni sanagan |
| `tenant_id` matni | **953** | grep |
| Prisma modellari | **69** | `grep -c "^model "` |
| `tenant_id` **bor** modellar | **51** | awk |
| `tenant_id` **YO'Q** modellar | **18** | awk |
| Ulardan chinakam global | **2** (`tenants`, `permissions`) | qo'lda tahlil |
| Ulardan **himoyasiz bola jadval** | **16** | qo'lda tahlil |
| Raw query | **1** (to'g'ri yozilgan) | grep |
| `tenant.util.ts` chaqirilishi | **0** | grep |
| Tenant izolyatsiya testi | **0** | — |

> ⚠️ **176 — bu eng ko'rinadigan qism, to'liq yuza emas** (u `findFirst` ni —
> 272 ta — sanamaydi). Haqiqiy himoyalanishi kerak bo'lgan yuza — **845 ta
> Prisma chaqiruvi**.

### `tenant.util.ts` — o'lik kod

`apps/api/src/common/utils/tenant.util.ts` da **to'g'ri yechim yozilgan**:
`withTenantCondition()`, `ensureTenantId()`, `getUserTenantId()`. 44 qator,
yaxshi fikrlangan kod.

Va u **hech qayerda ishlatilmaydi**:

```bash
grep -rn "tenant.util" --include=*.ts apps/     # → (bo'sh)
```

Nol import. Nol chaqiruv.

**Nega u o'lgan — bu eng muhim savol, chunki bu ADR o'sha xatoni takrorlamasligi
kerak.** Sabab tanbal dasturchi emas. Sabab **arxitekturaviy**:

```ts
// tenant.util.ts bilan:
const where = withTenantCondition(user, { status: 'ACTIVE' });

// hozirgi kod:
const where = { tenant_id, status: 'ACTIVE' };
```

**Farqi nima? Deyarli hech narsa.** Ikkalasida ham dasturchi **eslashi** kerak.
`withTenantCondition()` ni chaqirishni unutish — `tenant_id` yozishni unutish
bilan **bir xil xato**. Va u yozish uchun **uzunroq**.

> **Yaxshi abstraksiya — to'g'ri yo'lni oson yo'l qiladigan abstraksiya.**
> `tenant.util.ts` buni qilmaydi. Shuning uchun o'lgan.

Ustiga-ustak, u `user: RequestUser` ni argument sifatida talab qiladi — hozirgi
servislar esa `tenantId: string` qabul qiladi (`students.service.ts:71`). Ya'ni
uni ishlatish uchun **30 servisning imzosini** o'zgartirish kerak edi.

⚠️ **Va o'lik himoya himoyasizlikdan yomonroq:** auditor `common/utils/` ga
qaraydi, `tenant.util.ts` ni ko'radi, "izolyatsiya hal qilingan" deb xulosa qiladi
va **grep qilmaydi**. Fayl bo'lmaganda u darhol so'rardi: "izolyatsiya qayerda?"

**Dars:** yechim **to'g'ri qatlamda** bo'lishi kerak — chetlab o'tish **imkonsiz**
joyda.

### Bu faraz emas — intizom allaqachon bir marta buzilgan

`apps/api/src/modules/students/guardian-student.controller.ts` servis qatlamini
**butunlay aylanib o'tadi**:

```ts
const grades = await this.studentsService['prisma'].assessment_scores.findMany({
  where: { student_id: account.student_id },   // ← tenant filtri YO'Q
});
```

`this.studentsService['prisma']` — bracket notation TypeScript'ning `private`
tekshiruvini **kompilyatsiya vaqtida chetlab o'tadi** (`students.service.ts:65`
da maydon `private readonly prisma`).

⚠️ **O'lchov aniqlashtirildi.** `03-multi-tenancy.md` §3.8.1 bu naqshni **6 ta**
deb sanagan. U single-line grep ishlatgan — lekin chaqiruvlarning ko'pi
Prettier tomonidan **ko'p qatorga bo'lingan**:

```ts
const account = await this.studentsService[
  'prisma'
].student_accounts.findUnique({
```

Multiline hisob:

```bash
perl -0777 -ne '$c=()=/studentsService\[\s*.prisma.\s*\]/g; print "$c\n"' \
  apps/api/src/modules/students/guardian-student.controller.ts
# → 22
```

**6 emas — 22 ta.** Hammasi bitta faylda: `student_accounts` (7),
`assessment_scores`, `attendance_marks`, `grade_snapshot_rows` (2),
`discipline_actions`, `violations`, `invoices`, `certificates`,
`student_outcomes`, `event_participants` (2), `competition_results`,
`students`, `timetable`.

> Bu — 03 hujjatining tezisiga **zid emas, uni kuchaytiradi**: naqsh o'sha, yuza
> 3.7 barobar katta. Va bu o'lchov farqining o'zi ham dalil — **qo'lda sanashga
> tayanib bo'lmaydi.**

161-qatordagi komment: `// Get grades - we need to add this method to StudentsService`.
Muallif **bilgan** bu noto'g'riligini. Shunday qolgan.

> ⚠️ **Bu — "intizomga tayangan himoya yetarli emas" da'vosining real isboti.**
> Muallif intizomli: `students.service.ts` ning bitta metodida `tenant_id`
> **17 marta** yozilgan. Lekin **bitta shoshilinch controller** butun intizomni
> aylanib o'tgan. Buni na tip tizimi, na lint, na test, na code review to'xtatgan.

## Qaror

**`tenant_id` Prisma client extension (`$extends`) orqali ma'lumot qatlamida
avtomatik qo'yiladi.**

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

Tenant `AsyncLocalStorage` (`node:async_hooks`) orqali uzatiladi —
NestJS request-scoped provider orqali **emas**.

Extension `$allModels.$allOperations` ni ushlaydi, ya'ni ~845 chaqiruvning
hammasini, `findMany`/`findUnique` ni emas.

`tenant_id` ustuni **bo'lmagan 16 model** uchun extension **nested relation
filtri** qo'yadi — har model uchun "tenantga yo'l" xaritasi bo'yicha.

**Holat: Taklif.** Bu ADR implementatsiyani tasdiqlamaydi — u yondashuvni
tasdiqlaydi. Implementatsiya va bosqichma-bosqich migratsiya yo'li
[../03-multi-tenancy.md](../03-multi-tenancy.md) §4–§5 da.

## Sabablar

### Nega bu `tenant.util.ts` dan farq qiladi

Bitta sabab, va u hal qiluvchi:

> `withTenantCondition()` ni chaqirishni **unutish mumkin edi**.
> Extension'ni **chetlab o'tib bo'lmaydi** — u `PrismaService` ning o'zida
> yashaydi, va boshqa Prisma client yo'q.

Ya'ni bu safar to'g'ri yo'l — **yagona yo'l**, "oson yo'l" emas.

⚠️ Va bu **`guardian-student.controller.ts` ning 22 ta bypass'ini ham yopadi** —
chunki `studentsService['prisma']` baribir **o'sha extended client**. Bracket
notation `private` ni chetlab o'tadi, lekin extension'ni emas.

### ⚠️ MAJBURIY TAN OLISH: bu qaror muammoni yo'q qilmaydi — kamaytiradi

**Bu bo'lim ADR ning eng muhim qismi.** Uni yozmasdan extension qurish —
`tenant.util.ts` xatosini takrorlash: himoyaga o'xshagan, aslida to'liq bo'lmagan
narsa. **Soxta xotirjamlik.**

#### 1. 18 modelda `tenant_id` ustuni YO'Q

69 modeldan 18 tasida ustun yo'q. Faqat 2 tasi (`tenants`, `permissions`)
chinakam global. **Qolgan 16 tasi tenant-scoped — shunchaki ustunsiz:**

| Model | Tenantga yo'l | Chaqiruvlar |
|---|---|---:|
| `dorm_rooms` | `dorms.tenant_id` | 20 |
| `attendance_marks` | `attendance_sessions.tenant_id` | 18 |
| `timetable_lessons` | `timetable.tenant_id` | 17 |
| `assessment_scores` | `assessments.tenant_id` | 16 |
| `competition_entries` | `competitions.tenant_id` | 16 |
| `display_items` | `display_playlists.tenant_id` | 15 |
| `event_participants` | `events.tenant_id` | 11 |
| `student_cohort` | `students.tenant_id` | 10 |
| `user_roles` | `users.tenant_id` | 10 |
| `grade_snapshot_rows` | `grade_snapshots.tenant_id` | 6 |
| `award_recipients` | `awards.tenant_id` | 6 |
| `role_permissions` | `roles.tenant_id` | 6 |
| `group_subjects` | `groups.tenant_id` | 5 |
| `competition_results` | `competitions.tenant_id` | 4 |
| `meal_announcement_prices` | `meal_payment_announcements.tenant_id` | 1 |
| `dorm_announcement_prices` | `dorm_payment_announcements.tenant_id` | 1 |
| | **Jami** | **~162** |

Bu modellarda `where.tenant_id = X` **yozib bo'lmaydi** — ustun yo'q. Extension
**nested relation filtri** qo'yishi kerak:

```ts
// assessment_scores uchun:
where: { assessments: { tenant_id } }
```

Ya'ni extension **har model uchun "tenantga yo'l" xaritasini bilishi kerak**:

```ts
const TENANT_PATH: Record<string, string> = {
  assessment_scores: 'assessments',
  attendance_marks: 'attendance_sessions',
  dorm_rooms: 'dorms',
  // ... 16 ta
};
```

> ⚠️ **VA O'SHA XARITA HAM UNUTILISHI MUMKIN.**
>
> Yangi bola jadval qo'shilsa va xaritaga yozilmasa — u **jimgina himoyasiz**
> qoladi. Aynan `tenant_id` yozishni unutish kabi.
>
> **Muammo yo'qolmaydi — u KO'CHADI.** 845 ta unutish nuqtasidan
> **1 ta xaritaga**. Bu ulkan yaxshilanish: 845 → 1. Lekin **1 ≠ 0**.

**Nega baribir arziydi:** xarita — **bitta fayl, ~16 qator, bir joyda**. Uni
review qilish mumkin. `WHERE` unutilishini 845 joyda review qilib bo'lmaydi.
Va xaritani **test majburlaydi**: "har model yo `TENANT_PATH` da, yo `tenant_id`
ustuni bor, yo aniq `GLOBAL_MODELS` ro'yxatida" — bu test schema'dan generatsiya
qilinadi va yangi model qo'shilsa **CI yiqiladi**.

Ya'ni: **1 ta unutish nuqtasi bor, lekin uni mashina qo'riqlaydi.**

#### 2. Extension QAMRAMAYDIGAN joylar

Extension — devor, lekin devorda **eshiklar** bor. Ular aniq sanaladi:

**(a) `$queryRaw` / `$executeRaw` — extension ushlamaydi.**

```bash
grep -rn "queryRaw\|executeRaw" --include=*.ts apps/api/src
# → apps/api/src/modules/ranking/ranking.service.ts:261
```

Butun kod bazasida **bitta** raw query. **Halol baho: u to'g'ri yozilgan** —
tenant uch joyda filtrlangan (`a.tenant_id`, `s.tenant_id`,
`student_risk_scores.tenant_id`), parametrlar `Prisma.sql` tagged template
orqali.

⚠️ Lekin `assessment_scores` u yerda ham filtrlanmagan — u `s.id` va `a.id`
orqali **bilvosita** himoyalangan. Agar `a.tenant_id` sharti `LEFT JOIN ON`
dan `WHERE` ga ko'chirilsa — cross-tenant ball hisoblanadi.

→ **Qoida qoladi:** raw query'da `tenant_id` **har doim qo'lda**. Extension
yordam bermaydi. Yaxshi xabar — hozir bittasi bor va u to'g'ri.

**(b) `service['prisma']` — chetlab o'tish (22 joyda).**

Extension **bu holatda ishlaydi** (o'sha client), lekin naqshning o'zi
arxitektura buzilishi va u boshqa yo'l bilan zarar keltirishi mumkin. Lint
qoidasi qo'shiladi: `['prisma']` bracket-access **taqiqlanadi**.

**(c) ⚠️ FAYLLAR — extension umuman ko'rmaydi. Bu eng jiddiy teshik.**

`apps/api/src/main.ts:57-61`:

```ts
const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir, { ... }));
```

`/uploads` **`express.static` bilan xizmat qilinadi. Prisma'dan umuman
o'tmaydi.** Ya'ni:

> **Fayl URL'ini bilgan har kim uni yuklab oladi — tenant tekshiruvisiz,
> RBAC tekshiruvisiz, JWT tekshiruvisiz.**

`files` modeli va uning `tenant_id` ustuni (`schema.prisma:464` da yagona
`@@index([tenant_id, owner_type, owner_id, purpose])`) bu yerda **hech narsa
qilmaydi** — statik server metadata'ni o'qimaydi.

Va bu — o'quvchi hujjatlari, ehtimol rasmlari. **Bolalarniki.**

→ **Extension buni yechmaydi va yechishga da'vo qilmasligi kerak.** Bu alohida
qaror talab qiladi (signed URL yoki autentifikatsiyalangan stream endpoint) —
[../10-security.md](../10-security.md) mavzusi. Bu ADR uni **bo'shliq sifatida
qayd etadi**, yopilgan deb emas.

#### 3. Xulosa — halol formulirovka

| Yuza | Extension'dan keyin |
|---|---|
| 51 model, `tenant_id` bor | ✅ Avtomatik. Unutish imkonsiz |
| 16 model, ustunsiz | ⚠️ Xarita bilan. **Xarita unutilishi mumkin** (test qo'riqlaydi) |
| 2 global model | ✅ Aniq allowlist |
| 1 raw query | ❌ **Qamramaydi.** Qo'lda qoladi |
| 22 bracket bypass | ✅ Qamraydi (o'sha client) |
| `/uploads` statik fayllar | ❌ **Umuman qamramaydi.** Alohida qaror |

> **Ya'ni: bu qaror izolyatsiya muammosini YO'Q QILMAYDI. U uni ~845 ta tarqoq
> unutish nuqtasidan 1 ta markazlashgan, testlanadigan, review qilinadigan
> xaritaga + 2 ta ochiq sanalgan teshikka (raw query, fayllar) kamaytiradi.**
>
> Bu — g'alaba. Lekin uni **g'alaba deb** atash kerak, **yechim deb** emas.

### Alternativa A — PostgreSQL RLS (Row-Level Security) nega rad etildi

**Bu eng jiddiy raqib. Uning ustunligi extension'nikidan kuchliroq.**

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.tenant_id')::bigint);
```

**Ustunligi — halol va u jiddiy:**

- ⚠️ **Kafolat BAZADA, kodda emas.** Bu — extension'ning **printsipial**
  zaifligini yopadi. RLS bilan ORM'ni chetlab o'tgan so'rov ham,
  `$queryRaw` ham, `psql` dan qo'lda yozilgan `SELECT` ham **filtrlanadi**.
  Extension bularning **hech birini** ushlamaydi
- **Raw query muammosi yo'qoladi** — RLS raw query'ga ham qo'llanadi.
  Yuqoridagi (a) teshigi **yopiladi**
- **Xarita muammosi yumshaydi** — 16 model uchun policy'ni `EXISTS` bilan
  ota jadvalga yozish mumkin, va u **DDL'da**, TypeScript'da emas. Unutilgan
  model — `ENABLE ROW LEVEL SECURITY` qilinmagan jadval sifatida **SQL so'rovi
  bilan topiladi**:
  ```sql
  SELECT tablename FROM pg_tables t
  WHERE schemaname='public'
    AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename=t.tablename);
  ```
  Ya'ni "unutilgan model" tekshiruvi **bazadan** so'raladi
- **Yangi dasturchi buzolmaydi** — u hatto bilmasa ham himoya ishlaydi

**Nega baribir rad etildi:**

| To'siq | Tafsilot |
|---|---|
| **⚠️ `SET LOCAL app.tenant_id` + connection pooling** | RLS tenant'ni session/transaction o'zgaruvchisidan oladi. Prisma pool'da ulanishlar **qayta ishlatiladi**. `SET` (LOCAL'siz) — **oqib ketadi**: keyingi request boshqa tenant'ning qiymatini meros oladi |
| **⚠️ PgBouncer transaction mode** | Ulanish **har tranzaksiyadan keyin** qaytariladi. `SET LOCAL` faqat tranzaksiya ichida ishlaydi → **har Prisma so'rovi aniq tranzaksiyaga o'ralishi kerak** (`$transaction` + `SET LOCAL` + so'rov). Bu Prisma'da tabiiy naqsh emas va u har so'rovga round-trip qo'shadi |
| **Prisma qo'llab-quvvatlamaydi** | Prisma'da "har ulanishga `SET LOCAL` qo'y" degan rasmiy ilgak yo'q. Uni `$extends` bilan yasash kerak — ya'ni **baribir extension yoziladi**, ustiga RLS murakkabligi bilan |
| **Migratsiya** | 51 jadvalga policy — bu DDL. Hozirgi migratsiya tarixi **allaqachon drift holatida** (kanon §3: `track_subjects` migratsiyada yo'q). Drift ustiga 51 policy qo'yish — xavfli |
| **Debug og'ir** | Policy noto'g'ri bo'lsa so'rov **bo'sh natija** qaytaradi, xato emas. "Ma'lumot yo'qoldi" turidagi bag |
| **Ishlab turgan tizim** | Policy'ni noto'g'ri yozish = **hamma so'rov bo'sh qaytadi** = akademiya ishlamaydi. Extension'ning xatosi ham shunday, lekin uni deploy'siz qaytarish oson |

> **Halol xulosa:** RLS **texnik jihatdan to'g'riroq javob**. U bazada kafolat
> beradi va u extension'ning ikkita teshigidan bittasini (raw query) yopadi.
>
> U rad etilmoqda, chunki **hozirgi kontekstda uni to'g'ri qurish extension'dan
> qiyinroq va xavflirok**: `SET LOCAL` + pooling to'g'ri qilinmasa, RLS
> **extension'dan yomonroq** bo'ladi — u ishlayotgandek ko'rinadi va tenant
> oqizadi. Ya'ni yana **soxta xotirjamlik**, lekin bu safar bazada.
>
> ⚠️ **Bu qaror "hech qachon" emas — "hozir emas".** RLS extension ustiga
> **ikkinchi qatlam** sifatida qo'shilishi mumkin va bu to'g'ri yo'nalish
> (defence in depth). Signal — pastdagi jadvalda.

### Alternativa B — hozirgicha qoldirish (qo'lda `tenant_id`) nega yetarli emas

**Ustunligi — va u ham halol:**

- **Ishlaydi.** Hozir ma'lum bo'lgan **birorta ham** cross-tenant oqish yo'q
- **Aniq va o'qiladigan.** `where: { tenant_id, ... }` — so'rovga qarab
  nima bo'layotganini ko'rasan. Extension esa **yashirin sehr** qo'shadi
- **Narxi nol.** Refaktor yo'q, xavf yo'q, ishlab turgan tizim tegilmaydi
- **`findFirst` 272 marta ishlatilgani intizom borligini isbotlaydi** —
  muallif `findUnique` tenant filtri qabul qilmasligini **bilgan** va ataylab
  `findFirst` ga o'tgan
- **Eng yaxshi nuqtalar allaqachon tipdan kuchli:** `auth.service.ts:187-195`
  va `notifications.service.ts:495-503` da `tenant_id` **compound unique
  kalitning bir qismi** — uni tushirib qoldirish **TypeScript xatosi** beradi.
  Bu extension'dan ham kuchliroq kafolat

**Nega baribir yetarli emas:**

1. **"Hozir oqish yo'q" — bu isbot emas, bu o'lchanmagan holat.** Tenant
   izolyatsiya testi **0 ta**. 845 ta so'rovning to'g'riligi **faqat ko'z bilan**
   tekshirilgan. Kanon §6: *"A tenanti B'ni o'qiy olmaydi — bu tizimning eng
   muhim testi va u yo'q"*

2. **Himoya chaqiruvlar tartibiga bog'liq — bu mo'rt.** Uch xil naqsh o'lchandi:

   | Naqsh | Kafolat qayerda | Kontekstdan ajratilsa |
   |---|---|---|
   | `assessments.service.ts:908-918` | So'rovning **o'zida** (`assessments: { tenant_id }`) | ✅ Xavfsiz |
   | `ranking.service.ts:127-133` | **22 qator narida**, boshqa ikki so'rovda | 🔴 **Sizadi** |
   | `guardian-student.controller.ts:163` | JWT'da, servis aylanib o'tilgan | 🔴 **Sizadi** |

   Uchalasi ham **hozir to'g'ri natija qaytaradi**. Ikkitasining to'g'riligi —
   **tasodifiy**.

3. **Yuza o'sib boradi.** Har yangi endpoint — yangi unutish imkoniyati.
   `students.service.ts` ning **bitta** `create()` metodida `tenant_id`
   **17 marta** yoziladi (`:256-530`). 17 ta xato qilish imkoniyati. Bitta
   metodda. 30 servisdan bittasida.

4. **Bu qaror ADR-0001 ni qarzdor qoldiradi.** Shared database tanlandi, chunki
   "zaiflik ma'lum va **tuzatiladigan**". Agar tuzatilmasa — ADR-0001 ning
   asosi yo'qoladi.

> Bu alternativa "yomon" emas — u shunchaki **o'lchanmagan**. Va o'lchanmagan
> xavfsizlik — xavfsizlik emas.

### Nega AsyncLocalStorage, nega request-scoped provider emas

Extension `tenant_id` ni qayerdan oladi? U request haqida hech narsa bilmaydi.

**Rad etilgan: NestJS `Scope.REQUEST`.**

```ts
@Injectable({ scope: Scope.REQUEST })   // ← BUNI QILMANG
export class PrismaService extends PrismaClient { ... }
```

NestJS DI'ning **"bubbling up"** xususiyati: provider `REQUEST` scope bo'lsa,
uni inject qiladigan **har bir** provider ham request-scoped bo'ladi. Zanjir
yuqoriga ko'tariladi.

`PrismaService` ni **hamma** inject qiladi (`students.service.ts:65`,
`access.guard.ts:10`, `perms.guard.ts:17`, ...). Ya'ni **32 servis, 37
controller va 3 guard** request-scoped bo'ladi.

⚠️ **Eng yomoni:** `PrismaClient` qayta yaratilsa — **connection pool ham
qayta yaratiladi**. Connection pool'ni request'ga bog'lash — **printsipial
xato**.

**Tanlandi: `AsyncLocalStorage`** (`node:async_hooks`, standart modul).

```
request → als.run({ tenantId: 5n }, () => next())
            → guard / controller / service / extension
                 └─ als.getStore() → { tenantId: 5n }
```

- `PrismaService` **singleton** qoladi. Pool bitta
- Servis imzolari o'zgarmaydi
- DI daraxti o'zgarmaydi

Kamchiliklari (halol): **yashirin bog'liqlik** — `tenantId` funksiya imzosida
ko'rinmaydi, u "havoda"; `async_hooks` overhead'i (**o'lchov bilan
tasdiqlansin**, raqam to'qilmaydi); va **kontekstdan tashqari kod** (cron, CLI,
`seed.ts`) — u yerda ALS bo'sh va buni **ataylab** hal qilish kerak.

## Oqibatlar

**Ijobiy:**

- **51 model uchun `tenant_id` ni unutish imkonsiz bo'ladi** — ~845 chaqiruvning
  katta qismi bir vaqtda yopiladi
- **`guardian-student.controller.ts` dagi 22 ta bypass avtomatik tuzatiladi** —
  bir qator kod o'zgartirmasdan. Ular hozir **hech kim bilmagan teshiklar**
- **Servis kodi qisqaradi** — 953 ta qo'lda `tenant_id` ning katta qismi
  yo'qoladi
- **Yangi kod tabiiy xavfsiz** — yangi dasturchi `tenant_id` haqida bilmasa ham
  to'g'ri kod yozadi
- **Yagona nuqta** — izolyatsiya mantig'i bitta faylda, review qilinadigan,
  testlanadigan
- **`tenant.util.ts` o'ligi tiriladi** — `getUserTenantId()` va `ensureTenantId()`
  `tenant-context.ts` ga ko'chadi va **haqiqatan ishlatiladi**
- **ADR-0001 ning qarzi to'lanadi** (to'liq emas, lekin katta qismi)

**Salbiy:**

- ⚠️ **Muammoni YO'Q QILMAYDI.** Yuqorida to'liq yozilgan: 16 model uchun
  "tenantga yo'l" xaritasi kerak va **xarita unutilishi mumkin**. 845 ta
  unutish nuqtasi → 1 ta. **1 ≠ 0.**
- ⚠️ **Raw query qamralmaydi.** `ranking.service.ts:261` va **har qanday
  kelajakdagi raw query** qo'lda `tenant_id` talab qiladi. RLS bu teshikni
  yopardi — extension yopmaydi. **Bu rad etilgan alternativaning aniq ustunligi.**
- ⚠️ **`/uploads` fayllari umuman qamralmaydi.** `express.static` Prisma'dan
  o'tmaydi. Fayl URL'ini bilgan har kim uni oladi. Extension bu yerda **hech
  narsa qilmaydi** va bu ADR uni **yopilmagan** deb qoldiradi
- ⚠️ **Yashirin sehr — o'qilishni qiyinlashtiradi.** `findMany({ where: { status } })`
  ga qarab, SQL'da `tenant_id` borligini **ko'rib bo'lmaydi**. Yangi dasturchi
  uchun bu chalg'ituvchi. Qo'lda `tenant_id` ning **aniq ustunligi** aynan shu —
  va bu qaror uni **yo'qotadi**
- ⚠️ **Yangi turdagi bag imkoniyati: extension'ning o'zi.** Hozir bag bitta
  so'rovda bo'ladi. Extension'da bag bo'lsa — u **hamma so'rovda** bo'ladi.
  Xato radiusi kichikdan katta bo'ladi
- ⚠️ **Debug qiyinlashadi.** "Nega bu so'rov bo'sh qaytdi?" → endi javob
  ko'rinmaydigan qatlamda
- ⚠️ **Migratsiya bir kunlik ish emas.** ~845 nuqta. Extension yoqilgach,
  qo'lda `tenant_id` **ikki marta** qo'yiladi (extension + kod) — bu zararsiz
  (`AND tenant_id=5 AND tenant_id=5`), lekin **faqat qiymatlar mos bo'lsa**.
  Mos kelmasa — bo'sh natija. → bosqichma-bosqich yo'l va `bypass` mexanizmi
  ([../03-multi-tenancy.md](../03-multi-tenancy.md) §5)
- ⚠️ **`async_hooks` overhead'i o'lchanmagan.** Node 16+ da sezilarli emas
  deyiladi, lekin **bu loyihada o'lchanmagan**. Raqam to'qilmaydi
- ⚠️ **Kontekstsiz kod xavfi.** `seed.ts`, cron, CLI'da ALS bo'sh. Agar "store
  yo'q" = "filtrlamа" deb talqin qilinsa — **tasodifiy kontekst yo'qolishi
  ataylab bypass'ga aylanadi**. Shuning uchun store'da uch holat ajratiladi:
  kontekst yo'q / tenant bor / **aniq** `bypass: true` + sabab (audit'ga yoziladi)
- ⚠️ **Testsiz bu qaror ma'nosiz.** Extension'ni **tenant izolyatsiya testi**
  bilan birga qilish kerak. Hozir test **0 ta**. Testsiz extension — yana
  `tenant.util.ts`: ishonch bor, isbot yo'q

## Majburlash

Bu ADR **niyat bilan emas, mashina bilan** majburlanadi. Aks holda u
`tenant.util.ts` taqdirini takrorlaydi.

- **Schema-driven test:** `schema.prisma` dan generatsiya qilinadi — har model
  yo `tenant_id` ustuniga ega, yo `TENANT_PATH` xaritasida, yo aniq
  `GLOBAL_MODELS` ro'yxatida. Uchalasidan hech biri bo'lmasa — **CI yiqiladi**.
  ⚠️ Bu — "xarita unutiladi" xavfiga qarshi **yagona real himoya**
- **Izolyatsiya testi:** A tenanti B'ning har bir modelini o'qiy olmasligi.
  69 model bo'yicha, generatsiya qilingan. Kanon §6: *"bu tizimning eng muhim
  testi"*
- **Lint qoidasi:** `['prisma']` bracket-access **taqiqlanadi** (22 ta mavjud
  holat avval tuzatiladi)
- **Lint qoidasi:** `$queryRaw` — review'da `tenant_id` majburiy, komment bilan
- **Darhol (birinchi kun, extension'dan oldin):** `tenant.util.ts` boshiga
  `⚠️ DEAD CODE` ogohlantirishi. 2 daqiqa, xavfi nol, yolg'on ishonchni
  **darhol** to'xtatadi
- ⚠️ **Yangi modellarda unique constraint doim `tenant_id` bilan boshlansin:**
  `@@unique([tenant_id, code])`. Bu extension'dan **kuchliroq** — bu **tip
  darajasidagi** kafolat (`auth.service.ts:187-195` naqshi)

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| **Izolyatsiya testi extension bilan ham oqish topsa** | Generatsiya qilingan 69-modelli testda **≥1** cross-tenant natija → yondashuv qayta baholanadi, RLS'ga o'tiladi |
| **Xarita unutilishi real bo'lsa** | CI schema-testi qo'shilgach ham **≥1** model xaritasiz production'ga yetsa → xarita yondashuvi yetarli emas, RLS |
| **Raw query soni o'ssa** | `grep -c queryRaw` **> 5** → extension qamrovi juda kichik qoladi, **RLS'ga o'tish signali** (u raw'ni ham qamraydi) |
| **PgBouncer transaction mode kerak bo'lsa** | Connection limiti bosim qilsa → RLS'ning `SET LOCAL` to'sig'i qayta o'lchanadi (u holda **ikkalasi ham** qiyin bo'ladi) |
| **`async_hooks` overhead'i sezilsa** | p95 latency **>10%** o'ssa (extension'dan oldin/keyin o'lchov) → ALS o'rniga aniq parametr uzatish |
| **Prisma RLS'ni rasman qo'llasa** | Prisma'da per-connection `SET LOCAL` ilgagi paydo bo'lsa → **RLS extension ustiga ikkinchi qatlam** sifatida qo'shiladi (defence in depth), extension o'chirilmaydi |
| **`/uploads` teshigi yopilmasa** | Bu ADR qabul qilingandan **90 kun** ichida fayl autentifikatsiyasi qarori chiqmasa → bu ADR "izolyatsiya hal qilindi" deb keltirilishi **taqiqlanadi** |

## Havolalar

- [../03-multi-tenancy.md](../03-multi-tenancy.md) — to'liq TZ: implementatsiya, ALS, `bypass`, bosqichma-bosqich migratsiya
- [./0001-shared-database-multi-tenancy.md](./0001-shared-database-multi-tenancy.md) — bu ADR to'layotgan qarz
- [../10-security.md](../10-security.md) — `/uploads` fayl kirish nazorati (yopilmagan bo'shliq)
- [../13-testing-strategy.md](../13-testing-strategy.md) — izolyatsiya testi
- [../06-auth-and-rbac.md](../06-auth-and-rbac.md) — JWT'dan tenant, superadmin impersonation
- [`CANON.md`](../CANON.md) §5.1, §5.4, §6
- Prisma — Client extensions (`$extends`, `$allModels.$allOperations`)
- Node.js — `AsyncLocalStorage` (`node:async_hooks`)
- PostgreSQL — Row Security Policies
