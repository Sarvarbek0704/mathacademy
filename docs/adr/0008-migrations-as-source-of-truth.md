# ADR-0008 — Migratsiya tarixi — sxemaning yagona haqiqat manbai. `db push` production'da hech qachon

- **Holat:** Taklif
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

Prisma bilan bazani o'zgartirishning ikki yo'li bor va ular **tubdan boshqacha**:

| | `prisma db push` | `prisma migrate dev` |
|---|---|---|
| Nima qiladi | Sxemani bazaga **majburlaydi** | SQL migratsiya **fayli yaratadi** |
| Iz qoladimi | **Yo'q** | Ha — `migrations/` katalogida |
| Bazani qayta qura oladimi | Faqat sxemadan | **Tarixdan** |
| Qachon uchun | Prototip | **Production** |

`db push` — qulay: tez, savol bermaydi. Va u loyihaning erta bosqichida **to'g'ri
tanlov** edi: sxema har kuni o'zgarardi, ma'lumot tashlab yuborilardi.

Lekin loyiha o'sha bosqichdan **chiqib ketdi**. Kanon buni birinchi qatorida
aytadi: bu **DEMO EMAS** — bazada real o'quvchilar, real to'lovlar bor
([00-vision-and-market.md](../00-vision-and-market.md)). Va vizyon — ikkinchi
akademiya, CI, staging. Bularning **hammasi** bitta narsaga tayanadi: **bazani
noldan qayta qura olish**.

### ⚠️ O'lchov: baza va migratsiya tarixi ALLAQACHON ZID

Bu ADR mavjud amaliyotni **tasdiqlamaydi** — u uni **tuzatadi**. Farqi
[ADR-0007](./0007-postgres-as-only-datastore.md) dan: u yerda o'lchov qarorni
oqladi, bu yerda o'lchov **muammoni ochadi**.

```
migratsiyada CREATE TABLE : 68
schema.prisma da model    : 69
grep track_subjects migrations/  → hech narsa
grep SubjectRole    migrations/  → hech narsa
grep "CREATE TYPE"  migrations/  → hech narsa
```

**Ikkita yetishmayotgan narsa — va ular tasodifiy emas:**

```prisma
// apps/api/prisma/schema.prisma:979-983
enum SubjectRole {
  MAIN
  SECONDARY
  MANDATORY
}

// apps/api/prisma/schema.prisma:985-997
model track_subjects {
  id          BigInt       @id @default(autoincrement())
  tenant_id   BigInt
  track_id    BigInt
  subject_id  BigInt
  role        SubjectRole  @default(MANDATORY)
  // ...
  @@unique([tenant_id, track_id, subject_id])
}
```

⚠️ **`track_subjects` va `SubjectRole` — DTM 189 ballik tizimining O'ZAGI:**
o'quvchi yo'nalishi → `track_subjects` har fanga `role` beradi → MAIN 93 +
SECONDARY 63 + MANDATORY 3×11 = **189 ball**
([07-dtm-assessment-engine.md](../07-dtm-assessment-engine.md)).

Ya'ni yetishmayotgani — chekka log jadvali emas. **MathAcademy'ni oddiy maktab
tizimidan ajratib turadigan narsa** migratsiya tarixida **mavjud emas**.

### Buning ma'nosi

```bash
# Toza bazada:
npx prisma migrate deploy    # → 68 jadval yaratiladi
                             # → track_subjects YO'Q
                             # → SubjectRole tipi YO'Q
node dist/main               # → Prisma client track_subjects ni kutadi
                             # → ILOVA ISHGA TUSHMAYDI
```

Va bu **faraziy emas** — `render.yaml` aynan shuni bajaradi:

```yaml
startCommand: npx prisma migrate deploy && node dist/main
```

**Production hozir ishlayapti — chunki uning bazasi boshqa yo'l bilan qurilgan.**
`migrate deploy` u yerda **no-op**: migratsiyalar `_prisma_migrations` da
allaqachon "qo'llanilgan" deb belgilangan, jadvallar esa `db push` (yoki qo'lda
SQL) orqali paydo bo'lgan.

Ya'ni: **deploy qilingan baza va migratsiya tarixi bir-biriga zid.** Ilova
ishlayapti, lekin uni qayta qurishning **hech qanday yo'li yo'q**.

### Forensika: bu qanday sodir bo'lgan

Uchta mustaqil dalil `db push` tarixini ko'rsatadi:

**1. `migration_lock.toml` yo'q** (`find apps/api/prisma -name migration_lock.toml`
→ hech narsa). Prisma bu faylni `migrate dev` birinchi ishlaganda **avtomatik**
yaratadi. Yo'qligi — migratsiyalar `migrate dev` bilan **yaratilmagani** demak.

**2. Katalog nomlari Prisma formatida emas** — `000000_init/`,
`000001_files_storage/`. Prisma `YYYYMMDDHHMMSS_nom` ishlatadi
(`20240115093012_init/`). `000000` / `000001` — **odam qo'li bilan** raqamlangan.

**3. ⚠️ Eng aniq dalil — `IF NOT EXISTS`:**

```sql
-- apps/api/prisma/migrations/000001_files_storage/migration.sql
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "purpose" VARCHAR(30);
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "storage_provider" VARCHAR(20) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "storage_path" TEXT;
CREATE INDEX IF NOT EXISTS "files_tenant_owner_purpose_idx" ON "files" (...);
```

**Prisma `migrate dev` hech qachon `IF NOT EXISTS` generatsiya qilmaydi.**
Unga kerak emas — u bazaning holatini **biladi**.

`IF NOT EXISTS` — bu odam yozgan SQL, va u shuning uchun yozilgan: **ustunlar
bazada allaqachon bor bo'lishi mumkin edi.** Ya'ni muallif migratsiyani
`db push` bilan **allaqachon o'zgartirilgan** baza ustiga xavfsiz qo'llash uchun
himoya qo'ygan.

Bu — "avval `db push`, keyin migratsiyani orqasidan yozib qo'yish" naqshining
**imzosi**. Va aynan shu naqsh `track_subjects` ni tushirib qoldirgan: u
`db push` bilan yaratilgan, orqasidan yozilmagan.

**4. Qo'shimcha:** `apps/api/prisma/migrations/000000_init.sql` — **0 bayt**,
katalog **tashqarisida**. Prisma buni butunlay e'tiborsiz qoldiradi (migratsiya =
katalog + ichida `migration.sql`). Zararsiz, lekin chalg'itadi.

**Xulosa — va bu ayblov emas:** `db push` bilan boshlash **to'g'ri** edi.
Xato — undan chiqishda tarixni **to'liq** tiklamaslik. Bu 51 kommitli, bir
kishilik loyihada **tabiiy** yo'l qo'yish. ADR ning vazifasi — kimni
ayblashni emas, **nima qilishni** aytish.

## Qaror

**Migratsiya tarixi — sxemaning yagona haqiqat manbai.**

Bu quyidagilarni anglatadi:

1. **`prisma db push` production'da va staging'da — hech qachon.** Faqat
   dasturchining lokal, tashlab yuboriladigan bazasida
2. **Har sxema o'zgarishi — migratsiya fayli.** `schema.prisma` o'zgardi, lekin
   `migrations/` o'zgarmadi → bu **to'liq bo'lmagan o'zgarish**
3. **Toza bazada `migrate deploy` → ilova ishga tushadigan holat.** Bu —
   **tekshiriladigan invariant**, niyat emas
4. **Mavjud drift tuzatiladi** — quyidagi reja bo'yicha, **1-USTUVORLIK sifatida**

Va majburlash:

```bash
# CI'da har PR'da:
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url $SHADOW_DB_URL \
  --exit-code
# exit 2 = drift bor → PR bloklanadi
```

## Sabablar

### Nega bu 1-USTUVORLIK — hamma narsadan oldin

TZ ning boshqa hujjatlari muhim ishlarni sanaydi: tenant izolyatsiyasi
([ADR-0002](./0002-prisma-extension-for-tenant-isolation.md)), testlar
([13-testing-strategy.md](../13-testing-strategy.md)), CI
([11-infrastructure.md](../11-infrastructure.md)).

⚠️ **Ularning hammasi bu ADR ga tayanadi.** Sabab bitta: **hammasi bazani
qayta qura olishni talab qiladi.**

| Ish | Nega migratsiyaga tayanadi |
|---|---|
| **CI** | Har PR'da toza baza ko'tarilishi kerak. Hozir: 68 jadval, ilova ishga tushmaydi |
| **Testcontainers bilan test** | Konteynerda toza Postgres → `migrate deploy` → test. Hozir: **imkonsiz** |
| **Tenant izolyatsiya testi** | Kanon: "tizimning eng muhim testi". U baza talab qiladi. Baza qurilmaydi |
| **Staging** | Ta'rifi bo'yicha — production sxemasining nusxasi. Nusxa **olib bo'lmaydi** |
| **Boshqa provayderga ko'chish** | Yangi baza migratsiyadan quriladi. **Qurilmaydi** |
| **Falokatdan tiklash** | ⚠️ Backup'dan tiklash ishlaydi (u ma'lumot nusxasi). Lekin backup buzilsa — **sxemani qayta qurishning yo'li yo'q** |

Ya'ni: **testlar yozishdan oldin, testlar ishga tushadigan baza kerak.** Bu —
[13-testing-strategy.md](../13-testing-strategy.md) ning **oldingi sharti**,
parallel ish emas. Shuning uchun bu ADR **Taklif** holatida bo'lsa ham, ishlar
ketma-ketligida **birinchi**.

### Nega migratsiya tarixi — haqiqat manbai bo'lishi kerak

**1. Migratsiya — holat emas, o'tish.** `schema.prisma` sxemaning **hozirgi
holatini** aytadi, **qanday** shu holatga kelganini emas. Ma'lumot bazasi uchun
bu farq hal qiluvchi: `ALTER TABLE` ma'lumotni **o'zgartiradi** va o'sha o'zgarish
**takrorlanadigan** bo'lishi kerak. `db push` faqat holatni biladi va o'tishni
**o'zi o'ylab topadi** — ba'zan ma'lumotni yo'qotib.

**2. Migratsiya — review qilinadigan joy.** `ALTER TABLE ... DROP COLUMN` xavfli.
Migratsiya faylida bu **ko'rinadi**. `db push` da u **jimgina** sodir bo'ladi —
faqat terminaldagi ogohlantirish, `--accept-data-loss` bilan o'chiriladigan.

**3. Migratsiya — birdan-bir bajariladigan hujjat.** Boshqa hujjat eskiradi;
migratsiya eskirsa — **deploy sinadi**. Bu — hujjatning eng yaxshi turi.

### Alternativa A: `db push` bilan davom etish — nega rad etildi

**Ustunligi — halol yozilsin:**

- **Tezroq.** Migratsiya nomi o'ylash, fayl review qilish shart emas
- **Konflikt yo'q.** Ikki dasturchi bir vaqtda sxema o'zgartirsa — migratsiya
  fayllari raqam bo'yicha to'qnashadi. `db push` da bunday muammo yo'q
- **Shadow database kerak emas.** `migrate dev` shadow DB talab qiladi — bepul
  tarifda bu qo'shimcha baza degani
- **Hozir ishlayapti.** Production tik turibdi, ota-onalar to'lov qilyapti.
  "Buzilmagan narsani tuzatma"

Oxirgi argument jiddiy va uni chetlab o'tib bo'lmaydi: **hozirgi holat ishlayapti.**

**Nega baribir rad etildi:**

1. **"Ishlayapti" — faqat bitta mashinada.** Ikkinchi muhit (CI, staging) kerak
   bo'lgan **daqiqada** to'xtaydi. Va u daqiqa yaqin — TZ ning butun mazmuni shu
2. **Ma'lumot xavfi real.** `db push` ustun o'chirilishini **jimgina** taklif
   qiladi. Bazada **real o'quvchi yozuvlari** bor. Bir marta `--accept-data-loss`
   bosilsa — qaytarib bo'lmaydi va **backup'dan tiklash** kerak bo'ladi
3. **Konflikt argumenti bu loyihaga tegishli emas** — muallif bitta odam
4. **Xato allaqachon sodir bo'lgan.** `track_subjects` yo'qolgani — faraziy xavf
   emas, **yuz bergan hodisa**. `db push` bilan davom etish — uni **takrorlashga
   rozilik** berish

### Alternativa B: migratsiyalarni tashlab, `000000_init` ni qayta generatsiya qilish

Ya'ni: `migrations/` ni o'chirish, `migrate dev --create-only` bilan hozirgi
sxemadan **yangi, to'liq** init yaratish.

**Ustunligi:** eng toza natija. Bitta fayl, sxemaga **100% mos**, hech qanday
`IF NOT EXISTS` axlati yo'q. Yangi muhit uchun **mukammal**.

**Nega rad etildi:** production bazasi bilan **nima qilinadi?** Uning
`_prisma_migrations` jadvalida eski yozuvlar bor. Yangi init boshqa nomga ega
bo'ladi → Prisma uni "qo'llanilmagan" deb hisoblaydi → `migrate deploy` uni
**ishga tushirishga urinadi** → `CREATE TABLE` mavjud jadvallar ustida → **xato**.

Uni `migrate resolve --applied` bilan hal qilish mumkin, lekin u holda bu
alternativa **Alternativa C ga aylanadi**, faqat tarixni yo'q qilish evaziga.
Tarix esa — hatto to'liq bo'lmagani ham — **qimmatli** (`files_storage` real
o'zgarish edi).

### Alternativa C: drift'ni qo'shimcha migratsiya bilan yopish — **TANLANDI**

Tarix saqlanadi, yetishmayotgani **yangi migratsiya** sifatida qo'shiladi.

Bu — kamroq "toza", lekin **xavfsizroq** va production bilan **mos**.

## Tuzatish rejasi

⚠️ **Bu — nozik operatsiya. Real ma'lumot ustida. Har qadam tekshiriladi.**

### 1-qadam: driftni aniq o'lchash

```bash
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url $SHADOW_DB_URL \
  --script > drift.sql
```

Bu **migratsiya tarixi** va **sxema** o'rtasidagi farqni SQL sifatida beradi.

⚠️ **Kutilgan natija — `track_subjects` + `SubjectRole`. Lekin u YAGONA bo'lmasligi
mumkin** ("Ochiq savollar" ga qarang). `drift.sql` **to'liq o'qilsin**, taxmin
qilinmasin.

### 2-qadam: toza bazada sinov — **majburiy**

```bash
# Toza Postgres (Docker)
docker run --rm -e POSTGRES_PASSWORD=x -p 5433:5432 -d postgres:15

DATABASE_URL="postgres://postgres:x@localhost:5433/test" npx prisma migrate deploy
# ← drift.sql migratsiya sifatida qo'shilgandan keyin:
#   69 model uchun 69 jadval + SubjectRole tipi bo'lishi SHART

DATABASE_URL="..." node dist/main    # ← ILOVA ISHGA TUSHISHI SHART
```

**Bu qadam o'tmasa — production'ga tegilmaydi.**

### 3-qadam: production — `resolve`, `deploy` emas

⚠️ **Bu yerda `migrate deploy` ishlatilmaydi.** Sabab: `track_subjects` jadvali
production bazasida **allaqachon bor** (`db push` yaratgan). Yangi migratsiyaning
`CREATE TABLE` si **xato beradi**.

```bash
# Migratsiya "qo'llanilgan" deb belgilanadi — SQL ishga TUSHMAYDI
npx prisma migrate resolve --applied 000002_track_subjects
```

Bu Prisma'ga aytadi: "bu migratsiya natijasi bazada allaqachon bor, uni o'tkazib yubor".

⚠️ **`resolve --applied` dan OLDIN tekshirilsin:** production'dagi `track_subjects`
**aynan** migratsiya yozganidek ekanmi? Ustun tiplari, `@@unique`, FK'lar,
`SubjectRole` qiymatlari — hammasi. Agar farq bo'lsa, `resolve` **driftni
muhrlaydi** — ya'ni yolg'onni rasmiylashtiradi.

Tekshirish:

```bash
npx prisma migrate diff \
  --from-url $PRODUCTION_DATABASE_URL \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
# Natija BO'SH bo'lishi kerak
```

### 4-qadam: qaytadan takrorlanmasligi uchun

- `migration_lock.toml` qo'shiladi
- `apps/api/prisma/migrations/000000_init.sql` (bo'sh axlat) **o'chiriladi**
- CI'da `migrate diff --exit-code` — doimiy tekshiruv (quyida)

## Oqibatlar

**Ijobiy:**

- **Toza bazada ilova ishga tushadi** — CI, staging, Testcontainers **mumkin
  bo'ladi**. Bu — TZ ning qolgan qismini ochadigan kalit
- **Sxema o'zgarishi review qilinadi** — `ALTER TABLE` PR'da ko'rinadi
- **Ma'lumot yo'qotish xavfi kamayadi** — `--accept-data-loss` yo'li yopiladi
- **Provayderga bog'liqlik uziladi** — bazani istalgan joyda qayta qurish mumkin
- **Tarix saqlanadi** — Alternativa C tanlangani uchun `files_storage`
  o'zgarishi yo'qolmaydi
- **Backup'ga qo'shimcha himoya** — backup ma'lumotni saqlaydi, migratsiya
  **strukturani**. Ikkalasi birga to'liq tiklanish beradi

**Salbiy:**

- ⚠️ **Drift YANA yuzaga kelishi mumkin — va bu ADR uni o'zi to'xtatmaydi.**

  Bu ADR — hujjat. Hujjat `db push` ni **to'xtatmaydi**. Bugungi drift ham
  hujjat yo'qligidan emas — kanon **allaqachon** "Migration: majburiy,
  `db push` hech qachon" deb yozgan edi. **Va drift baribir sodir bo'ldi.**

  ⚠️ Ya'ni: **niyat ishlamadi.** Yagona ishlaydigan yechim — "Qaror" bo'limidagi
  `migrate diff --exit-code` tekshiruvi CI'da, har PR'da.

  ⚠️ **Va `.github/` katalogi hozir YO'Q** (o'lchandi). Ya'ni bu ADR ning
  majburlash mexanizmi **mavjud emas**. Bu — [ADR-0006](./0006-money-decimal-in-db-string-at-api.md)
  bilan bir xil holat: qaror to'g'ri, majburlash yo'q. Halol yozilsin:
  **CI qo'shilmaguncha bu ADR — faqat umid.**

- ⚠️ **Tuzatish operatsiyasining o'zi xavfli.** `migrate resolve --applied` —
  Prisma'ga "ishonaver, bajarilgan" deyish. Agar production'dagi jadval
  migratsiya yozganidan **farq qilsa**, `resolve` bu farqni **abadiy muhrlaydi**
  va u boshqa **hech qachon aniqlanmaydi** — chunki tarix endi "toza" ko'rinadi.

  Ya'ni **noto'g'ri bajarilgan tuzatish hozirgi holatdan yomonroq**: hozir drift
  **ko'rinadi** (68 ≠ 69), tuzatishdan keyin u **ko'rinmay qoladi**.

- **`migrate dev` shadow database talab qiladi.** Lokal ishlab chiqishda
  qo'shimcha baza. Bepul tarifda — Docker'da lokal Postgres. Kichik, lekin
  real ishqalanish

- **Har sxema o'zgarishi endi sekinroq.** `db push` — 2 soniya. `migrate dev` —
  fayl yaratadi, nom so'raydi, review talab qiladi. Bu **ataylab**: qimmat
  qaror sekin bo'lishi kerak

- **Migratsiya fayllari o'chirilmaydi va to'planadi.** Bir yildan keyin 50+
  fayl. Bu normal, lekin yangi muhitda `migrate deploy` sekinlashadi.
  (Yechim — `migrate diff` bilan squash, lekin **yillar keyin**)

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| **Drift tuzatildi** | `migrate diff --from-migrations --to-schema-datamodel --exit-code` → **exit 0**. `CREATE TABLE` soni = model soni (69 = 69). Holat **Taklif → Qabul qilingan** |
| ⚠️ **Toza bazada ilova ishga tushdi** | Docker'da `migrate deploy` + `node dist/main` → health check 200. **Bu — asosiy qabul mezoni** |
| CI drift tekshiruvi ishga tushdi | `.github/workflows/` da `migrate diff --exit-code` bor va PR bloklaydi |
| Yangi drift topildi | CI `exit 2` qaytardi → ADR ishlayapti (bu **muvaffaqiyat** signali) |
| Migratsiya soni ko'paydi | > 100 migratsiya yoki `migrate deploy` > 60 s → squash muhokama qilinadi |
| Jamoa o'sdi | 2+ dasturchi → migratsiya raqami konflikti paydo bo'ladi → nomlash konvensiyasi qayta ko'riladi |

## Ochiq savollar

1. ⚠️ **68 vs 69 — aysbergning uchimi?** `track_subjects` **yo'qligi** o'lchandi.
   Lekin `db push` ishlatilgan bo'lsa, **boshqa driftlar** ham bo'lishi mumkin
   va ular **jadval darajasida ko'rinmaydi**:
   - Migratsiyada bor, lekin **ustuni** yetishmaydigan jadval?
   - Ustun **tipi** boshqacha (`VARCHAR(30)` vs `TEXT`)?
   - `@@unique` yoki FK yetishmayapti?
   - `DEFAULT` qiymati farq qiladi?

   **Jadval sanog'i (68) buni ushlamaydi.** Faqat `migrate diff` ning to'liq
   chiqishi ushlaydi. **1-qadam bajarilgunicha driftning haqiqiy hajmi
   NOMA'LUM** — va bu ADR uni bilishini da'vo qilmaydi.

2. **Production bazasi qanday qurilgan — aniq?** `db push`mi, qo'lda SQLmi, yoki
   aralashmi? `_prisma_migrations` jadvalidagi yozuvlar javob beradi —
   **tekshirilsin**. Buni bilish `migrate resolve` ni xavfsiz qiladi.

3. **`files_storage` dagi `IF NOT EXISTS` nima uchun qo'yilgan?** Taxminimiz:
   `db push` ustunlarni allaqachon yaratgan edi. Agar shunday bo'lsa — drift
   **ma'lum** edi va e'tiborsiz qoldirilgan. Muallif tasdiqlasin.

4. **Shadow database qayerdan olinadi?** `migrate dev` va CI'dagi `migrate diff`
   uchun kerak. Render'da qo'shimcha baza — narx. Lokal Docker yetarlimi?

5. ⚠️ **Backup mavjudmi va u sinab ko'rilganmi?** Tuzatish rejasi "xato bo'lsa
   backup'dan tiklaymiz" farazi ustida turibdi. **Backup yo'q bo'lsa — 3-qadam
   bajarilmasligi kerak.** [11-infrastructure.md](../11-infrastructure.md) da
   javob bo'lishi kerak.

6. **`migrate deploy` `render.yaml` da `startCommand` ichida** — ya'ni **har
   instance ishga tushganda** ishlaydi. 1 instance'da xavfsiz; 2 instance bir
   vaqtda ko'tarilsa ikkalasi migratsiya qo'llashga urinadi. Prisma advisory lock
   ishlatadi, lekin **tekshirilsin**
   ([ADR-0007](./0007-postgres-as-only-datastore.md)).

## Havolalar

- [04-data-model.md](../04-data-model.md) — 69 model, sxema tuzilishi
- [07-dtm-assessment-engine.md](../07-dtm-assessment-engine.md) — `track_subjects` va DTM 189
- [11-infrastructure.md](../11-infrastructure.md) — CI, deploy, backup
- [13-testing-strategy.md](../13-testing-strategy.md) — Testcontainers; **bu ADR uning oldingi sharti**
- [ADR-0001](./0001-shared-database-multi-tenancy.md) — shared database
- [ADR-0006](./0006-money-decimal-in-db-string-at-api.md) — nega pul migratsiyasi bu ADR gacha kutadi
- [ADR-0007](./0007-postgres-as-only-datastore.md) — `startCommand` va 2-instance
- Kod: `apps/api/prisma/schema.prisma:979-997`,
  `apps/api/prisma/migrations/000001_files_storage/migration.sql`,
  `apps/api/package.json` (`migrate:deploy`), `render.yaml`
- Prisma — "Prototyping your schema with db push" (nega faqat prototip uchun)
- Prisma — `migrate resolve` va baseline hujjati
- Prisma — "Customizing migrations" va shadow database
