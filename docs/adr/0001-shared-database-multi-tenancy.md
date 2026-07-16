# ADR-0001 — Ko'p ijarachilik: yagona database + har jadvalda `tenant_id`

- **Holat:** Qabul qilingan
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

MathAcademy — **ko'p ijarachilik (multi-tenant) Student Information System**. Bu
demo emas: tizim muallif o'qigan akademiyada real xodimlar va ota-onalar tomonidan
har kuni ishlatiladi. Ma'lumot — **voyaga yetmagan o'quvchilarniki**.

Tizim boshidan `tenant_id` bilan qurilgan, ya'ni maqsad bitta mijoz emas —
**mahsulot**. Ikkinchi akademiya qo'shilganda savol qat'iy shaklga kiradi:

> **Ularning ma'lumoti fizik jihatdan qayerda yashaydi?**

Uch javob bor va har birining narxi bor. Savol texnik ko'rinsa ham, uni hal
qiladigan kuch bu loyihada texnik emas.

### Kuch 1 — pul. Bu qarorning asosiy kuchi

Muallif — **talaba**. Loyihada byudjet yo'q. Deploy **Render bepul tarifida**.

Bu — hashamatli cheklov emas, **hal qiluvchi cheklov**:

| Yondashuv | 1 tenant | 10 tenant | 100 tenant |
|---|---|---|---|
| Database-per-tenant | 1 × narx | **10 × narx** | **100 × narx** |
| Schema-per-tenant | 1 × narx | 1 × narx | 1 × narx (lekin §Sabablar — Prisma to'sig'i) |
| Shared database | 1 × narx | 1 × narx | 1 × narx |

Managed PostgreSQL narxi **instance boshiga** olinadi, qator boshiga emas. Ya'ni
database-per-tenant da 100-chi mijozning **infratuzilma narxi birinchisiniki bilan
bir xil** — hatto u 20 ta o'quvchi bilan kelgan bo'lsa ham. Bepul tarifda bu
oddiygina **mumkin emas**: bepul tarif odatda bitta database beradi.

> **Halol bo'lish uchun:** agar loyihaning byudjeti bo'lganda, bu qaror shu qadar
> oson bo'lmasdi. Database-per-tenant ning izolyatsiya ustunligi real (quyida
> tan olinadi), va pul bo'lsa u sotib olishga arziydigan narsa. Bu ADR **pul yo'q**
> degan haqiqatdan boshlanadi va shuni yashirmaydi.

### Kuch 2 — bu qaror allaqachon qabul qilingan

O'lchangan holat (`prisma/schema.prisma`, 2026-07-15):

| Fakt | Qiymat |
|---|---|
| Prisma modellari | **69** |
| `tenant_id` ustuni **bor** modellar | **51** |
| `tenant_id` ustuni **yo'q** modellar | **18** (2 tasi chinakam global) |
| Kod bazasida `tenant_id` matni | **953 marta** |
| Migratsiyalar | 2 ta |

Ya'ni bu ADR **yangi qaror qabul qilmaydi** — u mavjud qarorni hujjatlashtiradi,
sabablarini yozadi va **narxini ochiq aytadi**. Qarorni qayta ko'rib chiqish
37 294 qatorlik `apps/api` ning data qatlamini qayta yozish demak.

### Kuch 3 — tenant o'lchami kichik

Akademiya — 500–2000 o'quvchi. 100 akademiya = 200 000 o'quvchi. PostgreSQL uchun
bu **kichik jadval**. Ya'ni "shared database masshtablanmaydi" degan umumiy e'tiroz
bu domenda amalda ishlamaydi.

## Qaror

**Shared database + har tenant-scoped jadvalda `tenant_id BigInt` ustuni.**

Bitta PostgreSQL database, bitta schema, bitta `PrismaClient`, bitta connection pool.

```prisma
model students {
  id        BigInt @id @default(autoincrement())
  tenant_id BigInt
  full_name String
  // ...
}
```

Tenant **har doim JWT'dan** olinadi. **Mijoz parametridan hech qachon.**

Database-per-tenant va schema-per-tenant **rad etiladi**.

## Sabablar

### Alternativa A — Database-per-tenant nega rad etildi

Har akademiyaga alohida PostgreSQL database:

```
mathacademy_db_akademiya_a
mathacademy_db_akademiya_b
```

**Avval — uning ustunligi. U real va u jiddiy:**

- **Izolyatsiya eng kuchli va u koddan mustaqil.** Kod bagi bilan ham A ning
  so'rovi B ning databasega **fizik yeta olmaydi**. Bu — shu ADR tanlagan
  yo'lning aynan **eng zaif joyi**. Unutilgan `WHERE` bu yerda ma'lumot
  oqizmaydi — u shunchaki bo'sh natija qaytaradi
- **Backup / restore tenant bo'yicha.** "Falon akademiyani kechagi holatga
  qaytaring" → alohida dump, bitta `pg_restore`. Shared database'da bu —
  qo'lda `WHERE tenant_id` bilan yozilgan skript
- **Blast radius kichik.** Bitta tenant DB si buzilsa qolganlari ishlaydi
- **Shovqinli qo'shni (noisy neighbour) yo'q.** Har tenantning o'z resursi
- **Shartnoma savoliga tayyor javob.** "Bizning ma'lumot alohida bo'lsin" —
  ha, alohida

**Nega baribir rad etildi:**

| Narx | Tafsilot |
|---|---|
| **Pul** | 100 database = 100 × instance narxi. Bepul tarifda — imkonsiz. **Bu hal qiluvchi sabab** |
| **Migratsiya** | 100 tenant = **100 marta `prisma migrate deploy`**. Bittasi yiqilsa versiyalar ajraladi va tiklash qo'lda |
| **Connection** | Har DB o'z pool ini talab qiladi. 100 pool × 10 ulanish = **1000 ulanish**. PostgreSQL default `max_connections` = 100 |
| **Xotira** | `PrismaClient` og'ir obyekt. 100 instansiya bitta Node prosessida |
| **Kod** | `PrismaService` yagona singleton bo'lishdan to'xtaydi (`apps/api/src/prisma/prisma.service.ts`). Har request uchun to'g'ri client topilishi kerak → 28 modulning hammasiga tegadi |
| **Cross-tenant hisobot** | "Barcha akademiyalarda nechta o'quvchi?" → 100 so'rov + qo'lda birlashtirish |
| **Onboarding** | Yangi tenant = DDL + migratsiya + pool qayta konfiguratsiyasi. `INSERT` emas |

⚠️ **Migratsiya narxi bu loyihada alohida og'ir.** Kanon §3 da o'lchangan:
hozirgi 2 migratsiya **allaqachon drift holatida** — `track_subjects` va
`SubjectRole` hech qaysi migratsiyada yo'q, sxemada bor. Ya'ni bitta migratsiya
tarixini ham to'g'ri boshqarish hozircha uddalanmagan. Uni **100 ga ko'paytirish**
— mavjud muammoni 100 ga ko'paytirish.

### Alternativa B — Schema-per-tenant nega rad etildi

Bitta database, har tenantga alohida PostgreSQL schema:

```sql
CREATE SCHEMA tenant_a;  -- tenant_a.students, tenant_a.groups ...
CREATE SCHEMA tenant_b;  -- tenant_b.students, tenant_b.groups ...
```

**Avval — uning ustunligi:**

- **Izolyatsiya kuchli va u ham koddan mustaqil.** `search_path` to'g'ri bo'lsa,
  cross-tenant so'rovni **yozib bo'lmaydi** — jadval ko'rinmaydi
- **Narx shared database bilan bir xil** — bitta instance, bitta pool.
  Ya'ni bu variant **pul to'sig'iga urilmaydi**. Bu uni database-per-tenant dan
  jiddiyroq raqib qiladi
- **Backup tenant bo'yicha mumkin** — `pg_dump --schema=tenant_a`

Ya'ni schema-per-tenant "kuchli izolyatsiya + arzon" ni va'da qiladi. Agar to'siq
bo'lmaganda, bu qaror boshqacha bo'lishi mumkin edi.

**Nega baribir rad etildi:**

| Narx | Tafsilot |
|---|---|
| **⚠️ Prisma — hal qiluvchi to'siq** | Prisma `multiSchema` ni qo'llaydi, lekin **statik**: schema nomlari `schema.prisma` da **kompilyatsiya vaqtida** yozilishi kerak. "Runtime da tenant schemasiga o'tish" Prisma 7.3 da **qo'llab-quvvatlanmaydi** |
| **Migratsiya** | 100 schema × 69 jadval = **6900 jadval**. `prisma migrate` buni boshqarmaydi — har schema uchun qo'lda DDL |
| **`search_path` + pooling** | PgBouncer transaction mode da ulanish har tranzaksiyadan keyin qaytariladi. `SET search_path` **oqib ketadi** → keyingi so'rov noto'g'ri tenant schemasida ishlashi mumkin. Bu **jimgina** buziladi — eng yomon turdagi bag |
| **Chiqish yo'li yo'q** | Shared database'dan database-per-tenant ga o'tish mumkin (quyida). Schema-per-tenant dan chiqish — yana to'liq migratsiya |

**Xulosa:** Prisma'dan voz kechish 37 294 qatorni qayta yozish demak. Schema-per-tenant
ning ustunligi real, lekin uning narxi **butun stack'ni almashtirish**.

### Alternativa C — Shared database + `tenant_id` (tanlandi)

| | |
|---|---|
| **Migratsiya** | **Bitta** `prisma migrate deploy`. Hamma tenant bir vaqtda yangilanadi |
| **Connection** | Bitta pool, bitta `PrismaClient` |
| **Narx** | Eng arzon. Bepul tarifda **ishlaydi** |
| **Yangi tenant** | Bitta `INSERT INTO tenants`. DDL yo'q, deploy yo'q |
| **Cross-tenant hisobot** | Oddiy `GROUP BY tenant_id` |
| **Prisma** | Tabiiy ishlaydi — hech qanday to'siq yo'q |

### Chiqish eshigi ochiq qoladi

Bu — shared database'ning kam eslatiladigan afzalligi va u bu qarorning
**xavfini kamaytiradi**.

Agar bir kun katta tenant kelsa yoki mijoz shartnomada jismoniy izolyatsiya
talab qilsa — **hybrid** yo'l bor: o'sha tenant uchun alohida deploy + alohida
database. **Kod o'zgarmaydi**, chunki `tenant_id` baribir bor — shunchaki o'sha
databaseda bitta tenant yashaydi.

Ya'ni bu qaror **qaytarib bo'ladigan** qaror. Schema-per-tenant esa emas.

## Oqibatlar

**Ijobiy:**

- **Infratuzilma narxi tenant soniga bog'liq emas.** Bepul tarifda 100 tenant
  ham nazariy jihatdan sig'adi. Loyihaning mavjud bo'lish sharti
- **Bitta migratsiya tarixi.** Kanon §9 ("migration majburiy, `db push` hech
  qachon") 100 ga ko'paymaydi
- **Self-service onboarding real.** Yangi tenant = `INSERT`. Kanon §6 dagi
  "yangi tenant qanday qo'shiladi?" savoliga oddiy javob
- **Cross-tenant analitika bepul** — mahsulot darajasidagi hisobot uchun kerak
- **Prisma bilan ziddiyat yo'q** — stack o'zgarmaydi
- **Chiqish yo'li bor** — hybrid deploy kodga tegmaydi

**Salbiy:**

- ⚠️ **Izolyatsiya kafolati KODGA tayanadi, bazaga emas. Bu — eng katta narx.**
  Fizik to'siq yo'q. **Bitta unutilgan `WHERE tenant_id` = bir akademiya
  ikkinchisining o'quvchilarini, baholarini, to'lovlarini, intizom yozuvlarini
  ko'radi.** Bu bag emas — bu **ma'lumot sizib chiqishi (data breach)**, va bu
  bolalar ma'lumoti.

  O'lchangan yuza: butun `src/` bo'yicha Prisma chaqiruvlari — **845**, eng
  kattasi `findFirst` (272 ta). Har birida tenant haqida qo'lda o'ylash kerak.
  (Kanon 5.1 bu yuzani **176** deb sanaydi — u faqat `*.service.ts` dagi
  `findMany` + `findUnique` ni hisoblagan.) 845 tasidan 844 tasi to'g'ri bo'lsa
  ham, bittasi yetarli.

  Database-per-tenant'da bu narx **nolga teng bo'lardi**. Bu — rad etilgan
  alternativaning eng jiddiy ustunligi va u shu qaror bilan **sotib olinmadi**.

  → Bu narx [ADR-0002](./0002-prisma-extension-for-tenant-isolation.md) da
  to'lanadi (Prisma client extension). Lekin **to'liq to'lanmaydi** — o'sha ADR
  o'z chegaralarini ochiq sanaydi.

- ⚠️ **`tenant_id` ustuni bo'lmagan 18 model — strukturaviy bo'shliq.**
  Faqat 2 tasi (`tenants`, `permissions`) chinakam global. Qolgan **16 tasi
  tenant-scoped, shunchaki ustunsiz** — ular tenantga **ota jadval orqali**
  yetadi (`assessment_scores` → `assessments.tenant_id`).

  Oqibati: bu modellarda himoya **so'rovning o'zida emas** — u chaqiruvlar
  tartibiga bog'liq. Misol, `students.service.ts:635-636`:
  ```ts
  const recentAssessments = await this.prisma.assessment_scores.findMany({
    where: { student_id: id },   // ← tenant filtri YO'Q
  });
  ```
  Bu hozir sizmaydi, chunki 97 qator yuqorida (`:538-539`) `id` tenant bo'yicha
  tekshirilgan. Ya'ni **himoya 97 qator narida yashaydi**. Refaktor uni jimgina
  o'chirishi mumkin.

- ⚠️ **Shovqinli qo'shni (noisy neighbour) — kamaytirilgan, yo'q qilinmagan.**
  Katta tenant kichigining so'rovlarini sekinlashtiradi. Tenant o'lchami kichik
  bo'lgani uchun bu hozir real emas — **lekin faqat indeks bo'lsa**.

  ⚠️ O'lchangan (kanon §3): `000000_init` da **165 ta FOREIGN KEY** va ular
  ustida **0 ta performans indeksi**. PostgreSQL — MySQL'dan farqli — FK ustiga
  avtomatik indeks yaratmaydi. **`tenant_id` bo'yicha composite indeks yo'q.**
  Sxemada 1 ta `@@index` (`files:464`).

  Ya'ni har `WHERE tenant_id = X AND group_id = Y` — ketma-ket skan. Bitta
  akademiyada sezilmaydi. **Ko'p tenantda har so'rov barcha akademiyalar
  qatorini kechadi** — ya'ni shovqinli qo'shni muammosi indeks yo'qligi bilan
  **kuchayadi**. Bu — bu qarorning to'lanmagan qarzi.

- ⚠️ **Backup / restore tenant bo'yicha oson emas.** "Falon akademiyani
  kechagi holatga qaytaring" → `pg_restore` emas, qo'lda yozilgan `WHERE tenant_id`
  skripti, 69 jadval bo'ylab, FK tartibiga rioya qilib. Bu skript **hozir yo'q**
  va u yozilmaguncha bu va'da berilmasligi kerak.

- ⚠️ **Blast radius katta.** Bitta database yiqilsa — **hamma tenant yiqiladi**.
  Database-per-tenant'da bu 1/N bo'lardi.

- ⚠️ **`tenants.service.ts` — global servis, va u savol qoldiradi.**
  U `tenant_id` bilan filtrlamaydi va **bu to'g'ri** (u tenantlarning o'zini
  boshqaradi). Lekin `tenants.service.ts:107-115` barcha tenantni qaytaradi.
  Agar oddiy tenant admini `GET /staff/tenants` ni chaqira olsa — u **barcha
  akademiyalar ro'yxatini** ko'radi. Bu o'quvchi ma'lumoti emas, lekin
  **raqobat ma'lumoti**. → ADR mavzusi emas, RBAC savoli.

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| **Mijoz shartnomada jismoniy izolyatsiya talab qilsa** | Shartnoma matnida "ma'lumot alohida databaseda" bandi. → **Hybrid**: o'sha tenant uchun alohida deploy + DB. Kod o'zgarmaydi. Butun qaror bekor qilinmaydi |
| Bitta tenant butun DB yukining ustunligini egallasa | `pg_stat_statements` bo'yicha bitta `tenant_id` > **50%** so'rov vaqti, 30 kun davomida → o'sha tenantni hybrid'ga ko'chirish |
| Ma'lumot bazasi hajmi bepul/joriy tarifga sig'masa | DB hajmi tarif limitining **80%** iga yetsa → avval tarif oshiriladi, qaror emas |
| Tenant bo'yicha restore talabi rasmiy SLA ga kirsa | SLA hujjatida "tenant-level point-in-time restore" paydo bo'lsa → database-per-tenant qayta baholanadi |
| Regulyativ talab paydo bo'lsa (bolalar ma'lumoti) | ⚠️ **Yurist savoli.** O'zbekiston shaxsiy ma'lumotlar qonuni voyaga yetmaganlar ma'lumotini alohida saqlashni talab qilsa → qaror majburan o'zgaradi |
| Extension yechimi (ADR-0002) muvaffaqiyatsiz bo'lsa | Izolyatsiya testi (`13-testing-strategy.md`) extension bilan ham cross-tenant oqish topsa → shared database'ning asosiy asosi qulaydi |

> **Diqqat:** birinchi qatordan boshqa hech bir signal bu qarorni **to'liq**
> bekor qilmaydi. Shared database'dan chiqish **tenant bo'yicha** bo'ladi
> (hybrid), hammasi uchun emas.

## Havolalar

- [../03-multi-tenancy.md](../03-multi-tenancy.md) — to'liq TZ, o'lchangan audit, migratsiya yo'li
- [./0002-prisma-extension-for-tenant-isolation.md](./0002-prisma-extension-for-tenant-isolation.md) — bu qarorning narxini to'laydigan ADR
- [../02-architecture.md](../02-architecture.md)
- [../04-data-model.md](../04-data-model.md) — 69 model, `tenant_id` taqsimoti
- [../11-infrastructure.md](../11-infrastructure.md) — Render deploy, tarif
- [`CANON.md`](../CANON.md) §5.1, §6
- Microsoft — "Multi-tenant SaaS database tenancy patterns"
