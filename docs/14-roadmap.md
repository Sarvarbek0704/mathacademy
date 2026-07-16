# 14 — Yo'l xaritasi

> Bu hujjat qolgan 15 tasining ustiga quriladi. U yangi tahlil qilmaydi — u
> **tartib** o'rnatadi.

---

## 0. Bu xaritani qanday o'qish kerak

Ustuvorlik **muhimlik bo'yicha emas, bog'liqlik bo'yicha** tartiblangan.

Bu farq muhim. "Tenant izolyatsiyasini strukturaviy qilish" — loyihaning eng
muhim ishi. Lekin u **birinchi** emas, chunki:

```
Migratsiya drifti tuzatilmaguncha
  └─> toza baza qurib bo'lmaydi
        └─> Testcontainers ishlamaydi
              └─> tenant izolyatsiya testi yozib bo'lmaydi
                    └─> Prisma extension refactoringini boshlab bo'lmaydi
                          (chunki uni nima ushlaydi?)
```

Ya'ni eng muhim ish **to'rt qadam narida** turibdi. Uni birinchi qilishga
urinish — testsiz 845 ta so'rovni o'zgartirish demak. Bu ishlaydigan,
real o'quvchilar ma'lumoti bor tizim.

**Har bosqich uchun uchta narsa yozilgan:** nima qilinadi, **nima uni to'sib
turibdi**, va **tugaganini qanday bilamiz**. Oxirgisi eng muhim — "qilindi"
degan his yetarli emas.

---

## 1. Bosqich 0 — Buzilganini tuzatish

> Bu bosqich yangi qiymat qo'shmaydi. U **hozir yolg'on bo'lgan narsalarni
> rostga aylantiradi**. Undan keyingi hamma narsa shunga tayanadi.

### 0.1. Migratsiya drifti — hamma narsaning old sharti

**Muammo** ([ADR-0008](./adr/0008-migrations-as-source-of-truth.md),
[04-data-model](./04-data-model.md), [11-infrastructure](./11-infrastructure.md)):

```
migratsiyada CREATE TABLE : 68
schema.prisma da model    : 69
grep track_subjects migrations/  → hech narsa
grep SubjectRole    migrations/  → hech narsa
```

`track_subjects` va `SubjectRole` — **DTM 189 ning o'zagi** — sxemada bor, kod
ishlatadi, **hech qaysi migratsiyada yo'q**. Production ishlayapti, chunki
uning bazasi boshqa yo'l bilan qurilgan. Ya'ni **deploy qilingan baza va
migratsiya tarixi bir-biriga zid**.

**Nima to'sib turibdi:** hech narsa. Bu birinchi.

**Nima qilinadi:**
1. `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script` → yetishmayotgan migratsiya
2. **Toza bazada sinash** — `migrate deploy` → ilova ko'tariladi → smoke test
3. Production'da `migrate resolve --applied <yangi_migratsiya>` — chunki jadval
   u yerda **allaqachon bor**, qayta yaratish kerak emas
4. CI'ga doimiy tekshiruv: `migrate diff --exit-code` — drift qaytmasin

⚠️ **3-qadam nozik.** U production migratsiya jadvaliga yozadi. Avval zaxira,
keyin bajarish. Xato qilinsa — `migrate deploy` keyingi safar mavjud jadvalni
qayta yaratmoqchi bo'ladi va yiqiladi.

**Tugaganini qanday bilamiz:**
```bash
# Toza konteynerda:
docker run -d postgres:15
npx prisma migrate deploy     # xatosiz
npm run start                 # ko'tariladi
# → track_subjects bo'yicha so'rov ishlaydi
```

⚠️ **Ochiq savol — javob berilmagan:** agar `db push` ishlatilgan bo'lsa,
**boshqa driftlar** ham bo'lishi mumkin. 68 vs 69 — aysbergning uchi bo'lishi
mumkin. `migrate diff` to'liq farqni ko'rsatadi; uni **o'qib chiqish** kerak,
ko'zni yumib qo'llash emas.

### 0.2. `/tmp/uploads` — hozir ma'lumot yo'qotyapti

**Muammo** ([10-security](./10-security.md), [11-infrastructure](./11-infrastructure.md)):

```yaml
# render.yaml:38
- key: UPLOAD_DIR
  value: /tmp/uploads
```

Render'da `/tmp` efemer. **Har deploy'da barcha o'quvchi suratlari o'chadi**,
bazada esa mavjud bo'lmagan fayllarga ishora qilgan qatorlar qoladi. Va
`databases: plan: free` → **avtomatik zaxira yo'q**.

**Bu kelajakdagi xavf emas — bu hozir sodir bo'lyapti.**

**Nima to'sib turibdi:** hech narsa.

**Nima qilinadi:** S3-mos obyekt saqlash. Cloudflare R2 — 10 GB bepul, egress
bepul. Narx tahlili [11-infrastructure](./11-infrastructure.md) da.

⚠️ **Yuridik old shart** ([10-security](./10-security.md)): O'RQ-1125
(2026-03-26) umumiy lokalizatsiya talabini bekor qildi, **lekin biometrik
ma'lumot hali ham faqat O'zbekistonda**. **O'quvchi surati biometrikmi?** —
bu **yurist savoli** va u **fayl migratsiyasidan OLDIN** javob olishi kerak.
Aks holda migratsiya ikki marta qilinadi.

**Tugaganini qanday bilamiz:** deploy → surat joyida qoladi.

### 0.3. `Math.random()` bilan parol — 3 ta faylda

**Muammo** ([10-security](./10-security.md), [06-auth-and-rbac](./06-auth-and-rbac.md)):

| Fayl | Nima |
|---|---|
| `students.service.ts:43` | yangi o'quvchi paroli |
| `auth.service.ts:1483` | parol tiklash(?) |
| `users.service.ts:28` | yangi xodim paroli |
| `students.service.ts:1451` | **bitta siklda 60 ta parol** — ketma-ket oqim |

`Math.random()` — CSPRNG **emas** (V8'da xorshift128+). Bir necha chiqishni
ko'rgan hujumchi ichki holatni tiklab, **qolganlarini hisoblab chiqadi**.
Ommaviy yaratish (60 ta parol, bitta siklda) — buning uchun ideal sharoit.

**Bu parol — bola profiliga kalit.**

**Yechim:** `crypto.randomInt()` / `crypto.randomBytes()`. Bir necha qatorlik
o'zgarish.

⚠️ **Va eski parollar.** Yangi kod eski parollarni tuzatmaydi. Allaqachon
`Math.random()` bilan yaratilganlar — **hali ham bashorat qilinadi**.
Rotatsiya kerakmi — bu **qaror**, va uni foydalanuvchi qabul qiladi
(barcha o'quvchi parolini almashtirish = barcha ota-onaga xabar berish).

**Tugaganini qanday bilamiz:** `grep -rn "Math.random" apps/api/src` → parol
kontekstida 0 natija + lint qoidasi.

### 0.4. Fayl yuklash — MIME fail-open

**Muammo** ([10-security](./10-security.md)):

```ts
// files.storage.ts:43
export function assertAllowedMime(mime?: string) {
  const m = String(mime || '').trim().toLowerCase();
  if (!m) return;              // ← bo'sh MIME → tekshiruv YO'Q
  ...
}
```

Zanjir:
1. MIME **mijozdan** keladi (multer `file.mimetype`)
2. Bo'sh `Content-Type` → `assertAllowedMime` **darrov qaytadi**
3. Kengaytma tekshirilmaydi
4. `/uploads` — `express.static` bilan, **`setGlobalPrefix` dan OLDIN**
   (`main.ts:57-66`) → **barcha guard'lardan tashqarida**, autentifikatsiyasiz
5. Natija: `.html` yuklab, uni **ilovaning o'z origin'ida** ochish mumkin →
   **stored XSS**

**Yechim:** `if (!m) throw` (fail-closed) + kengaytma tekshiruvi + magic-byte
tekshiruvi + `Content-Disposition: attachment` + `Content-Security-Policy`.

⚠️ **Va alohida masala:** `/uploads` guard'dan tashqarida ekan, **fayllar
uchun tenant izolyatsiyasi umuman yo'q** — u faqat `randomUUID()` nomining
topilmasligiga tayanadi. Bu — obscurity, izolyatsiya emas. Bir marta
ulashilgan surat havolasi **abadiy ochiq**. Obyekt saqlashga o'tishda
(0.2) bu **birga hal qilinsin** — signed URL bilan.

### 0.5. `.env.example` — yolg'on hujjat

**Muammo:** o'lik env kalitlari — sozlama bor, majburlash yo'q:

| Kalit | Holat |
|---|---|
| `REDIS_*` | **kodda o'qilmaydi** — Redis umuman ishlatilmaydi ([ADR-0007](./adr/0007-postgres-as-only-datastore.md)) |
| `RATE_LIMIT_*` | `@nestjs/throttler` **o'rnatilmagan** |
| `MIN_PASSWORD_LENGTH` | o'qilmaydi |
| `MAX_SESSIONS_PER_USER` | o'qilmaydi |
| `COOKIE_SECURE` | o'qilmaydi |

**Nega bu jiddiy:** `.env.example` — **hujjat**, va uni har yangi dasturchi
nusxalaydi. Yolg'on hujjat — yo'q hujjatdan yomonroq, chunki u ishonch
uyg'otadi. Kimdir `RATE_LIMIT_MAX=10` qo'yib "himoyalandim" deb o'ylaydi.

**Bu allaqachon bir marta ta'sir qildi:** `ACCESS_TOKEN_TTL="15h"` —
`.env.example` da xato edi, kod default'i `15m`, `render.yaml` `15m`.
Ya'ni **production hech qachon 15 soat bo'lmagan**, lekin har lokal dasturchi
muhiti production'dan 60 barobar farq qilardi va hech narsa buni aytmasdi.
**Tuzatildi.**

**Yechim:** har kalit uchun ikkitadan biri — yo kod uni **o'qisin**, yo kalit
**o'chirilsin**. O'rtasi yo'q.

**Tugaganini qanday bilamiz:** `.env.example` dagi har kalit uchun
`grep -rn "KALIT" apps/api/src` → kamida 1 natija.

---

## 2. Bosqich 1 — Xavfsiz qilish

> Bu bosqich loyihaning **markaziy va'dasini** rostga aylantiradi: bir
> akademiya boshqasining ma'lumotini ko'rmaydi.

### 1.1. Tenant izolyatsiya testi — extension'ning DARVOZASI

**Nima to'sib turibdi:** 0.1 (migratsiya drifti). Toza baza qurilmaguncha
Testcontainers ishlamaydi.

**Nima qilinadi** ([13-testing-strategy](./13-testing-strategy.md)):
parametrlashtirilgan test — 28 modulning **har biri** uchun avtomatik:
A tenanti JWT'si bilan B ning resursini so'rash → 404/403, **hech qachon
ma'lumot emas**.

⚠️ **Bu test ikki marta ishlaydi:**
1. **Refactoringdan OLDIN yashil bo'lishi kerak** — agar hozir qizil bo'lsa,
   bizda allaqachon bag bor va uni extension emas, **darhol tuzatish** kerak
2. **Refactoringdan KEYIN ham yashil** — hech narsa buzilmagani isboti

**Tugaganini qanday bilamiz:** 28 modul × test → yashil. Yangi modul
qo'shilsa test **avtomatik** qamrasin (parametrlashtirilgan, qo'lda emas).

⚠️ **Halol ogohlantirish:** test **fayllarni qamramaydi** (`/uploads`
Prisma'dan o'tmaydi) va **`$queryRaw` ni qamramaydi**. Bu — testning
chegarasi, va u hujjatlashtirilsin.

### 1.2. Prisma client extension

**Nima to'sib turibdi:** 1.1.

**Nima qilinadi** ([03-multi-tenancy](./03-multi-tenancy.md),
[ADR-0002](./adr/0002-prisma-extension-for-tenant-isolation.md)):
`tenant_id` ni ma'lumot qatlamida avtomatik qo'yish. 845 qo'lda nuqta
(eng kattasi `findFirst` — 272 ta) → 0.

⚠️ **Bu qaror muammoni YO'Q QILMAYDI — kamaytiradi.** Sabab: 69 modeldan
**18 tasida `tenant_id` yo'q** — bola jadvallar tenant'ga **ota orqali**
yetadi. Extension ular uchun nested relation filtri qo'yishi kerak → **har
model uchun "tenant'ga yo'l" xaritasi** → **xarita ham unutilishi mumkin**.

Ya'ni intizom **yo'qolmaydi, ko'chadi**: 845 ta so'rovni eslashdan → 1 ta
xaritani to'liq saqlashga. Bu ancha yaxshi (1 ≪ 845 va xarita to'liqligini
test bilan majburlash mumkin), lekin **kafolat emas**. Buni tan olmasdan
extension yozish — `tenant.util.ts` xatosini takrorlash: himoyaga o'xshagan,
aslida to'liq bo'lmagan narsa **soxta xotirjamlik** beradi, va u
himoyasizlikdan yomonroq.

**Bosqichma-bosqich** (batafsil [03-multi-tenancy](./03-multi-tenancy.md) da):
extension qo'shiladi → qo'lda filtrlar **qoladi** (ikkitasi ham ishlaydi) →
test yashil → modul-modul qo'lda filtrlar olib tashlanadi → lint qoidasi.

**Tugaganini qanday bilamiz:** `grep -rn "tenant_id" apps/api/src/modules`
→ faqat `tenants.service.ts` (u global, to'g'ri).

### 1.3. Chetlab o'tish yo'llarini yopish

Extension **hech narsa qilmaydi**, agar undan qochish mumkin bo'lsa:

| Teshik | Joy |
|---|---|
| `service['prisma']` — private maydonga bracket notation bilan kirish | `guardian-student.controller.ts` — **4 joyda** (465, 558, 887, 902) |
| `$queryRaw` | extension ushlamaydi |
| Fayllar | Prisma'dan o'tmaydi |

`guardian-student.controller.ts:163` — tenant filtrisiz baho o'qiydi.
⚠️ **Halol baho:** bu **ekspluatatsiya qilinmaydi** — `student_id` JWT
zanjiridan keladi. Lekin kafolat **filtrda emas, zanjirda**, va zanjirni
hech qanday test tekshirmaydi. Kod ustidagi izoh buni tan oladi:
`// Get grades - we need to add this method to StudentsService`.

---

## 3. Bosqich 2 — To'g'ri qilish

> Bu bosqichda tizim **noto'g'ri ma'lumot yozishni to'xtatadi**.

### 2.1. DTM 189 — domen qatlamiga

**Nima qilinadi** ([07-dtm-assessment-engine](./07-dtm-assessment-engine.md),
[ADR-0004](./adr/0004-dtm-scoring-in-domain-layer.md)): 189 qoidasi
frontenddan (`AssessmentsPage.tsx:710`) domenga. Backend `max_score` ni
**hisoblaydi**, mijozdan olmaydi.

Va chuqurroq: **track tarkibi majburlansin**. Hozir:
- `tracks.service.ts:281-292` — MAIN ni **jimgina almashtiradi**, `{ok:true}` qaytaradi
- `MANDATORY` butun backendda **1 marta** uchraydi — default sifatida
- 0 ta MANDATORY bilan track — **har yangi trackning boshlang'ich holati**
- `assessments.service.ts` (987 qator) `track` so'zini **bilmaydi**

⚠️ **ENG KATTA XAVF BUTUN XARITADA.** Majburlashni yoqish **ishlab turgan
akademiyada blok test yaratishni to'xtatishi mumkin** — chunki tizim track
to'liqligini **hech qachon** tekshirmagan, ya'ni productionda yaroqsiz
tracklar **bor deb faraz qilish kerak**.

**Bu kod ishi emas — ma'lumot tuzatish ishi.** Tartib:
1. Audit so'rovi: nechta track yaroqsiz? (SQL
   [07-dtm](./07-dtm-assessment-engine.md) da tayyor)
2. Natijani **foydalanuvchiga ko'rsatish** — u akademiyani biladi, biz emas
3. Tozalash
4. **Keyin** majburlash

3-qadamni TZ hal qila olmaydi.

### 2.2. Fan roli — indeksdan emas, `role` dan

**Muammo** ([12-frontend-spec](./12-frontend-spec.md)): `AssessmentsPage.tsx:187`
fan rolini `group_subjects` **massiv indeksidan** o'qiydi. `groups.service.ts:183`
da `ORDER BY subject_id: 'asc'` bor — ya'ni tartib **deterministik**, lekin u
fanlar **bazaga qo'shilgan** tartibi, **rol bilan aloqasiz**.

**Bu tasodifiy tartibdan YOMONROQ:** xato **barqaror** → sinovda o'tadi →
yillar yashirinadi → **tenantga bog'liq** → mahsulotga o'tishda portlaydi.

Va: `SubjectRole` enum **bor**, `track_subjects.role` **to'ldirilgan**,
`TracksPage.tsx:52` uni **to'g'ri o'qiydi**. Ya'ni **ikki sahifa, ikki
haqiqat**.

⚠️ **Mavjud ballar buzilgan bo'lishi mumkin** — audit SQL
[12-frontend-spec](./12-frontend-spec.md) §5.1.6 da. Bu **real o'quvchilarning
real ballari**.

### 2.3. Pul — izchil kontrakt

[09-billing-and-finance](./09-billing-and-finance.md),
[ADR-0006](./adr/0006-money-decimal-in-db-string-at-api.md).

⚠️ **Halol boshlanish: baza TO'G'RI.** Float **yo'q** — hammasi
`Decimal(12,2)`. "Pul float bilan saqlangan" tanqidi bu loyihaga **tegishli
emas**.

Muammo nozikroq: **JS chegarasida izchillik yo'q**. Bitta servis
(`billing.service.ts`) pulni ikki xil qaytaradi — `:1605` `Number(inv.amount)`,
`:1578` `.toString()`.

Va: `Number("20000000.00")` → **aniq**. Xavf faqat kasr yig'ilganda, va
o'zbek so'mida tiyin amalda ishlatilmaydi → **bag uxlab yotibdi**. Lekin
schema uni majburlamaydi.

**Yechim:** API chegarasida doim string; servisda `Decimal.js`; `Number()`
pulga hech qachon (lint).

### 2.4. Enum'lar — `outcome_status` dan boshlab

[04-data-model](./04-data-model.md). **69 model, 1 enum.** 43 cheklangan ustun
`String`.

`outcome_status` eng shoshilinch: u **akademiyaning asosiy KPI'si**.
`EARLY_ADMITTED` va `early_admitted` alohida guruh bo'lib chiqadi — `GROUP BY`
**jimgina noto'g'ri javob** beradi.

⚠️ **Bu analitikaning old sharti**, keyingi yaxshilanish emas — chunki
[08-analytics](./08-analytics-and-risk.md) dagi backtesting `student_outcomes`
ni **haqiqat manbai** sifatida ishlatadi. Iflos label = iflos model.

### 2.5. Indekslar

[04-data-model](./04-data-model.md). O'lchangan:

| | `000000_init` |
|---|---|
| `CREATE INDEX` (performans) | **0** |
| `FOREIGN KEY` | **165** |

PostgreSQL — MySQL'dan farqli — FK ustiga **avtomatik indeks yaratmaydi**.
Har FK JOIN va har `ON DELETE CASCADE` bola jadvalni to'liq skanerlaydi.

⚠️ **Lekin o'lchovsiz indeks qo'shma.** Bitta akademiyada bu sezilmaydi.
Avval [15-observability](./15-observability.md) dagi sekin so'rov loglash,
keyin `EXPLAIN ANALYZE`, **keyin** indeks. Aks holda ishlatilmaydigan indeks
yoziladi va u har `INSERT` ni sekinlashtiradi.

---

## 4. Bosqich 3 — Ko'rinadigan qilish

[15-observability](./15-observability.md).

Hozir: structured logging **yo'q**, metrics **yo'q**, `new Logger()` —
**0 natija**, `console.*` — 18 ta. `all-exceptions.filter.ts` da **birorta
logger chaqiruvi yo'q**: tanib bo'lmagan xato `InternalServerErrorException`
ga o'giriladi va asl `exception` **butunlay tashlab yuboriladi**.

**Ya'ni production'da 500 chiqsa — nima ekanini bilishning iloji yo'q.**

Buni `guardian login` bagi bilan solishtir: u **ota-ona qo'ng'iroq qilgani
uchun** topilgan. Bu — observability emas.

⚠️ **Va undan yomoni:** tenant oqishida **hech kim qo'ng'iroq qilmaydi**.
Xato yo'q, 200 OK. Foydalanuvchi buni **hech qachon** aytmaydi.

**$0 to'plam:** pino (+ redaction — bolalar ma'lumoti logga tushmasin) +
Sentry free (5 000 xato/oy) + `/health` + Telegram alert. **~90% qiymat.**

---

## 5. Bosqich 4 — Mahsulotga aylantirish

> Bu — [00-vision](./00-vision-and-market.md) ning maqsadi: bitta akademiya
> SIS'i → ko'p akademiya mahsuloti.

### 4.1. ⚠️ Ikkinchi akademiya kodda TO'SILGAN

**Bu — butun xaritadagi eng katta kinoya.** TZ ning maqsadi ikkinchi
akademiya qo'shish, va u **hozir imkonsiz**:

```
create-tenant.dto.ts:25   → slug'da tire RUXSAT etadi
auth.service.ts:62-72     → parseGuardianLogin BIRINCHI tire bo'yicha ajratadi
```

Slug `math-academy` → tenant `math` deb qidiriladi → topilmaydi → **o'sha
akademiyaning BIRORTA ota-onasi kira olmaydi**. Xato xabari yo'q, log yo'q —
shunchaki "login yoki parol noto'g'ri".

**Nega hozir ko'rinmaydi:** yagona slug — `mathacademy`, tiresiz. **Ikkinchi
mijoz kelgan kuni chiqadi**, va sababi topilishi qiyin bo'ladi.

Yechim variantlari [06-auth-and-rbac](./06-auth-and-rbac.md) da. Eng to'g'risi —
login'ni **ikki maydonga bo'lish** (tenant + student ID alohida): ajratgich
muammosi butunlay yo'qoladi.

### 4.2. O'quvchi ID formati — uch xil

```
students.service.ts:48-50   padStart(6,'0')      → 000001
seed.ts:622                                       → MA-0001
GuardianLogin.tsx:80                              → mathacademy-MA-0001
```

⚠️ **Seed ma'lumoti hujjatga mos, real yaratilgan o'quvchi mos emas.**
Ya'ni bag **demo'da hech qachon chiqmaydi** — faqat production'da, real
o'quvchi bilan.

### 4.3. Self-service onboarding

Yangi tenant qanday qo'shiladi? Hozir — qo'lda. Mahsulot bo'lish uchun:
sozlash sehrgari, boshlang'ich ma'lumot, tenant branding.

⚠️ **4.1 va 4.2 tuzatilmaguncha bu ma'nosiz** — onboarding qilingan tenant
ishlamaydi.

### 4.4. Tenant bo'yicha billing

Obuna, tarif, limit. ⚠️ **Bu — mahsulot qarori, texnik emas.**
[00-vision](./00-vision-and-market.md) halol aytadi: bozor hajmi **noma'lum**,
sotuv kanali **yo'q**. Bu ikkisi **kod bilan hal bo'lmaydi**.

**Shuning uchun bu bosqich xaritaning oxirida** — va u yerda qolishi mumkin.
Bir akademiya uchun ideal ishlaydigan tizim — **allaqachon qiymat**.
Ikkinchi mijoz topilmasa, 4.3 va 4.4 hech qachon kerak bo'lmaydi.

---

## 6. Bu xaritada NIMA YO'Q va nega

| Nima | Nega yo'q |
|---|---|
| **Mikroservislarga bo'lish** | 28 modul, 1 jamoa, 1 baza. Monolit **to'g'ri qaror** ([02-architecture](./02-architecture.md)). Bo'lish muammoni hal qilmaydi — ko'chiradi |
| **Katta servislarni qayta yozish** | students 2079, auth 1644 qator — katta, lekin **ishlaydi**. Testsiz qayta yozish = xavf, foyda yo'q. Avval test (1.1), keyin — **kerak bo'lsa** |
| **ML bilan xavf bashorati** | Bir necha yuz o'quvchi. ML uchun juda kam. Logistik regressiya yetarli **va tushuntirib beriladi** — ustozga "nega bu bola RED?" degan savolga javob kerak ([08-analytics](./08-analytics-and-risk.md)) |
| **OpenTelemetry / tracing** | Monolit, 1 baza. Tracing qiymati mikroservisda ([15-observability](./15-observability.md)) |
| **Prisma model nomlarini o'zgartirish** | 69 model. `snake_case` ko'plik — Prisma odati emas, lekin **mavjud kod**. O'zgartirish narxi > foydasi |
| **Redis qo'shish** | Kerak emas ([ADR-0007](./adr/0007-postgres-as-only-datastore.md)). Postgres'dagi lock **restart'dan omon qoladi** — Redis'dan yaxshiroq |
| **Dizayn o'zgarishi** | Foydalanuvchi bilan **alohida muhokama qilinadi**. TZ dizayn qarori qabul qilmaydi |

---

## 7. Ochiq savollar — javob TZ dan tashqarida

Bular **kod bilan hal bo'lmaydi**. Har biri foydalanuvchi yoki mutaxassis
javobini talab qiladi.

| # | Savol | Kimga |
|---|---|---|
| S1 | **O'quvchi surati biometrik ma'lumotmi?** O'RQ-1125 dan keyin lokalizatsiya bekor qilingan, **lekin biometrik hali ham faqat O'zbekistonda**. Javob 0.2 (fayl migratsiyasi) yo'nalishini belgilaydi | Yurist |
| S2 | **`Math.random()` bilan yaratilgan eski parollar rotatsiya qilinsinmi?** Bu = barcha ota-onaga xabar | Foydalanuvchi |
| S3 | **Production'da nechta yaroqsiz track bor?** 2.1 ni yoqish blok test yaratishni to'xtatishi mumkin | O'lchov + foydalanuvchi |
| S4 | **`SELECT DISTINCT outcome_status` — real holat qanday?** 2.4 migratsiyasi iflos ma'lumotda **yiqiladi** | O'lchov |
| S5 | **Xavf skori ota-onaga ko'rinishi kerakmi?** `GET /guardian/risk` **mavjud va ishlaydi**, lekin 12 guardian sahifasining **birortasi** uni chaqirmaydi. Ya'ni **o'chirish narxi nol** — hozir. Bu **etika savoli**: RED yorlig'ini ota-ona ko'rsa nima bo'ladi? | Foydalanuvchi |
| S6 | **Bozor hajmi.** O'zbekistonda nechta yotoqxonali tayyorlov akademiyasi bor? Bosqich 4 shunga bog'liq | Tadqiqot |
| S7 | **5 daqiqalik ruxsat keshi nimani tejayapti?** O'lchanmagan. Tejagani kichik bo'lsa — keshni olib tashlash masshtablash to'sig'ini yechadi ([11-infrastructure](./11-infrastructure.md)) | O'lchov |
| S8 | **Interfeys tili.** Ko'p tenant = rus tilida so'ralishi mumkin. i18n kerakmi? | Foydalanuvchi |

---

## 8. Yakuniy tartib — bitta jadvalda

| # | Ish | To'sib turgan narsa | Nega shu tartibda |
|---|---|---|---|
| **0.1** | Migratsiya drifti | — | **Hamma narsaning old sharti** |
| **0.2** | `/tmp/uploads` | S1 (yurist) | **Hozir ma'lumot yo'qotyapti** |
| **0.3** | `Math.random()` parol | — | Xavfsizlik, arzon tuzatish |
| **0.4** | MIME fail-open | — | Stored XSS |
| **0.5** | O'lik env kalitlari | — | Hujjat yolg'on gapirmasin |
| **1.1** | Tenant izolyatsiya testi | 0.1 | Extension'ning **darvozasi** |
| **1.2** | Prisma extension | 1.1 | Loyihaning **eng muhim ishi** |
| **1.3** | Chetlab o'tish yo'llari | 1.2 | Extension'siz ma'nosiz |
| **2.1** | DTM domenga | 1.1, S3 | **Ma'lumot tuzatish** talab qiladi |
| **2.2** | Fan roli `role` dan | 2.1 | Mavjud ballar buzilgan bo'lishi mumkin |
| **2.3** | Pul kontrakti | 1.1 | Test kerak |
| **2.4** | Enum'lar | S4 | **Analitikaning old sharti** |
| **2.5** | Indekslar | 3 (o'lchov) | **O'lchovsiz qo'shma** |
| **3** | Observability | 0.1 | Qolganini ko'rish uchun |
| **4.1** | Slug tire bagi | — | **Ikkinchi akademiyani to'sadi** |
| **4.2** | O'quvchi ID formati | 4.1 | Bir oiladan |
| **4.3** | Onboarding | 4.1, 4.2 | Ulardan oldin ma'nosiz |
| **4.4** | Tenant billing | S6 | **Mahsulot qarori, texnik emas** |

⚠️ **4.1 e'tibor bering:** u hech narsaga bog'liq emas va **arzon**. Uni
istalgan vaqtda qilish mumkin. Xaritaning oxirida turgani — **muhimligi
past bo'lgani uchun emas**, balki u bosqich 4 ning ma'nosi bo'lgani uchun.
Ikkinchi mijoz ufqda ko'ringan zahoti — u **birinchi** bo'ladi.

---

## 9. Bu xaritaning chegarasi

TZ **ikkita narsani hal qila olmaydi**, va buni ochiq aytish kerak:

1. **Ma'lumot tuzatish** (S3, S4) — productionda nima borligini faqat
   o'lchov ko'rsatadi, va nima qilish kerakligini faqat akademiyani biladigan
   odam aytadi
2. **Bozor** (S6) — sotuv kanali va mijoz. Bosqich 4 ning butun asosi shu, va
   u **kodda yo'q**

Birinchi uchtasi (bosqich 0, 1, 2) — sof muhandislik. Ular **bugun**
boshlanishi mumkin va ular loyihani **bir akademiya uchun ideal** qiladi.

Bu — o'z-o'zicha yetarli maqsad.
