# 00 — Vizyon va bozor tahlili

> **Hujjat maqomi:** Qoralama · **Oxirgi yangilanish:** 2026-07-15
> **Egasi:** Sarvarbek Sodiqov
> **Loyiha:** MathAcademy Digital Campus · github.com/Sarvarbek0704/mathacademy

---

## 1. Bu loyiha nima

### 1.1. Bir gapda

**MathAcademy Digital Campus** — yotoqxonali DTM tayyorlov akademiyasini boshqarish
uchun qurilgan **ko'p ijarachilik (multi-tenant) Student Information System (SIS)**:
o'quvchi, dars jadvali, baho, davomat, yotoqxona, ovqatlanish, intizom, to'lov va
kirish natijalari — bitta tizimda.

### 1.2. Muhim farq: bu qog'ozdagi g'oya emas

Ko'pchilik TZ hujjatlari "biz nima qurmoqchimiz" haqida yoziladi. Bu hujjat boshqacha
vaziyatda yozilyapti: **tizim allaqachon qurilgan va ishlayapti.**

O'lchangan holat (kanon bo'yicha, 2026-07 kesimi):

| Ko'rsatkich | Qiymat |
|---|---|
| Kod hajmi | `apps/api` **37 294** qator + `apps/web` **25 489** qator = **62 783** |
| Commit | **51** |
| Prisma modellari | **69** |
| Backend modullari | **28** |
| Controller / Service / DTO | 37 / 32 / **128** |
| Frontend sahifalari | **48** (36 staff + 12 guardian) |
| Migratsiyalar | **2** ta (`000000_init`, `000001_files_storage`) — ⚠️ **lekin sxemadan ajralib qolgan**: 68 `CREATE TABLE` vs 69 model. `track_subjects` va `SubjectRole` hech qaysi migratsiyada **yo'q** → toza bazada `migrate deploy` ilovani ishga tushirmaydi. [ADR-0008](./adr/0008-migrations-as-source-of-truth.md) |
| **Testlar** | **1 ta placeholder** (`apps/web/src/test/example.test.ts`) — ya'ni amalda **nol** |

> **Halollik izohi:** kanon commit sonini **51** deb qayd etgan; hujjat yozilayotganda
> `git rev-list --count HEAD` = **52** qaytardi — farq kanondan keyin qo'shilgan
> `10c67c7 security: stop publishing seed passwords…` commiti tufayli.

**Stack:** NestJS 11 · Prisma 7.3 · **PostgreSQL 15+ (yagona ma'lumot ombori)** ·
React 18.3 · Vite 5.4 · TypeScript 5.7 · Tailwind 3.4 · shadcn/ui (Radix) ·
TanStack Query 5.83 · Recharts · Zod · dayjs · bcrypt (cost 12) · Swagger 11.2

⚠️ **Redis YO'Q** (o'lchangan: `redisStore`/`ioredis` importi 0 ta; `REDIS_*`
faqat `.env.example` da e'lon qilingan, kodda o'qilmaydi; `CacheModule` —
`store` parametrisiz, ya'ni in-memory LRU). Auth locks **to'liq PostgreSQL'da** —
va bu **to'g'ri qaror**: lock restart'dan omon qoladi.
[ADR-0007](./adr/0007-postgres-as-only-datastore.md)

⚠️ **Framer Motion va `date-fns`** `package.json` da bor, lekin **0 marta**
ishlatilgan. `dayjs` bilan `date-fns` — ikkita sana kutubxonasi, biri o'lik.

### 1.3. Bu TZ nima uchun yoziladi

Maqsad — **noldan qurish emas, yetuklashtirish**: bitta akademiya uchun qurilgan
ishlaydigan tizim → ko'p akademiyaga xizmat qiladigan mahsulot.

Shuning uchun TZ ning har bir bo'limi mavjud kodni **bilishi**, har o'zgarish uchun
**sabab** aytishi va **migratsiya yo'lini** ko'rsatishi shart. Ishlab turgan tizimni
buzish — bu yerda faraziy xavf emas, real xodimlarning ish kunini to'xtatish demakdir.

---

## 2. Nega bu demo emas

"Portfolio loyihasi" bilan "real ishlatiladigan tizim" o'rtasidagi farq — bozorda ham,
muhandislikda ham hal qiluvchi.

### 2.1. Demo loyihada bo'lmaydigan narsa: real bag

Demo loyihalarda baglar bo'lmaydi — chunki ularni hech kim ishlatmaydi. Real tizimda
baglar **muayyan soatda, muayyan foydalanuvchi ustida** portlaydi. Git tarixidan
ikkita dalil.

#### Dalil 1 — Guardian login formati (`3e785f1`)

Ota-onalar tizimga `<tenant-slug>-<student-id>` formatida kiradi, masalan
`mathacademy-MA-0001`. Parser esa **oxirgi tire** bo'yicha ajratardi:

```ts
// apps/api/src/modules/auth/auth.service.ts — parseGuardianLogin()
- const idx = s.lastIndexOf('-');   // ❌ "mathacademy-MA-0001" → slug="mathacademy-MA", id="0001"
+ const idx = s.indexOf('-');       // ✅ slug="mathacademy", id="MA-0001"
```

Bag zanjiri bitta emas, uchta edi va hammasi bir yo'nalishda xato qilardi:

| Qatlam | Xato | Tuzatish |
|---|---|---|
| `auth.service.ts` | `lastIndexOf('-')` — slug'ni `mathacademy-MA` deb o'qirdi | `indexOf('-')` + `toLowerCase()` |
| `auth.service.ts` | `if (!/^\d+$/.test(loginId)) return null` — faqat raqam qabul qilardi, `MA-0001` rad etilardi | shart olib tashlandi |
| `guardian-login.dto.ts` | `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/)` — DTO so'rovni servisga yetib borishidan oldin bloklardi | `/^[a-z][a-z0-9]*-[A-Za-z0-9][A-Za-z0-9-]*$/` |
| `GuardianLogin.tsx` | placeholder `STU-001` — mavjud bo'lmagan format ko'rsatardi | `mathacademy-MA-0001` |

Diqqat qiling: frontend ota-onaga **noto'g'ri format o'rgatardi**, DTO **to'g'ri
formatni rad etardi**, servis esa yetib kelgan holda ham **noto'g'ri parse qilardi**.
Bunday xato faqat bitta sharoitda topiladi — kimdir haqiqatan kirishga urinib, kira
olmaganda.

Qo'shimcha dalil: `3bb40f2 fix: guardian login React #31 crash — use getApiErrorMessage
to stringify validation errors`. DTO validatsiya xatosi obyekt qaytarganda React uni
render qilishga urinib **crash** bo'lardi — ota-ona xato o'rniga oq sahifa ko'rardi.

#### Dalil 2 — Timetable `startsAt` null (`dad02d7`, `8c50544`)

Dars jadvalidagi darslarning bir qismida `startsAt`/`endsAt` bo'sh (null) edi — faqat
`periodNo` bor edi. Kod esa vaqt doim bor deb hisoblardi:

```tsx
// apps/web/src/pages/guardian/GuardianTimetable.tsx:155
- {lesson.startsAt} - {lesson.endsAt}
+ {lesson.startsAt ? `${lesson.startsAt} – ${lesson.endsAt}` : `${lesson.periodNo}-dars`}
```

`TimetablePage.tsx` dagi `lessonPosition()` esa `startsAt` null bo'lganda hamma darsni
08:00 ga qo'yardi — grid'da hammasi bitta katakka yopishardi. Tuzatish: `periodNo`
asosida offset (har para 1.5 soat). Ota-ona esa bundan oldin `undefined - undefined`
ko'rardi.

### 2.2. Commit vaqtlari nimani ko'rsatadi

`git log` vaqt muhrlari bu baglar **bir kunda ketma-ket** tuzatilganini ko'rsatadi:

| Vaqt | Commit | Nima |
|---|---|---|
| 14:38 | `a3dab30` | `fix: production bugs — timetable dayOfWeek coercion, billing fields, certificates outcomeStatus, CSV limit` |
| 14:53 | `dad02d7` | `fix: timetable grid and list when lessons have no startsAt/endsAt` |
| 15:08 | `3e785f1` | `fix: guardian login format mismatch` |
| 15:14 | `8c50544` | `fix: guardian timetable shows period number when startsAt is null` |

36 daqiqa ichida to'rtta fix — bu reja bo'yicha ishlab chiqish emas, **ishlab turgan
tizimni o'chirmasdan tuzatish**. `a3dab30` xabari to'g'ridan-to'g'ri "**production bugs**"
deb yozilgan va ichida `certificates outcomeStatus` bor — sertifikat sahifasi noto'g'ri
enum qiymatlarini ishlatardi, ya'ni o'quvchi qayerga kirgani haqidagi ma'lumot buzilgan.

Boshqa commitlar shu naqshni takrorlaydi: `fa2efa3 fix: use SameSite=none in production
for cross-origin cookie (Vercel+Render)` · `5443d1b fix: support wildcard patterns in
WEB_ORIGINS for Vercel preview deployments` · `e68239c fix: install devDependencies on
Render build to resolve nest CLI not found (exit 127)`. Bular — **deploy qilingan
tizimning** muammolari. Hech kim ishlatmaydigan loyihada bunday commit paydo bo'lmaydi.

### 2.3. Lekin halol bo'lamiz — "real" so'zi kamchilikni oqlamaydi

Tizim real ishlatilishi uni yaxshi qilmaydi. Aynan real bo'lgani uchun kamchiliklar
**qimmatroq**:

| Fakt | Nega bu xavfli |
|---|---|
| Testlar amalda nol | 845 ta chaqiruvda tenant filtrining to'g'riligi faqat ko'z bilan tekshirilgan |
| Tenant 845 ta Prisma chaqiruvida qo'lda boshqariladi (eng kattasi `findFirst` — 272 ta) | Bittasini unutish = bir akademiya boshqasining ma'lumotini ko'radi |
| `common/utils/tenant.util.ts` — o'lik kod | To'g'ri yechim yozilgan, lekin **hech qayerda ishlatilmaydi** (grep: 1 natija — faylning o'zi). Himoyaga o'xshagan o'lik kod himoyasizlikdan yomonroq |
| CI yo'q | `.github/` katalogi mavjud emas (tekshirildi) |
| Observability yo'q | Structured logging, metrics, tracing — yo'q |
| Seed paroli public README'da chop etilgan edi | Tuzatildi (`10c67c7`), lekin bu qanchalik yaqin xavf borligini ko'rsatadi |

Oxirgi punkt alohida e'tiborga loyiq: `seed.ts` superadmin parolini hardkod qilgan va u
**public repo README'sida** turgan, `seed:prod` esa o'sha seed'ni production'da ishga
tushirardi. Endi `NODE_ENV=production` da `ALLOW_SEED=true` talab qilinadi, parollar
`SEED_*` env'dan olinadi, tekshiruv **birinchi DB yozuvidan oldin** bajariladi,
`seed:prod` o'chirildi. Bu tarix "ishlaydi" bilan "production-ready" o'rtasidagi
masofani aniq o'lchaydi.

---

## 3. Muammo: yotoqxonali akademiya bugun qanday boshqariladi?

> ⚠️ **BU BO'LIM — FARAZ.** Quyidagilar muallifning domen tajribasiga asoslangan
> taxmin, **o'lchangan ma'lumot emas**. Hech bir so'rovnoma o'tkazilmagan, hech bir
> boshqa akademiya bilan intervyu qilinmagan. Har bir farazni tekshirish yo'li §9 da.

### 3.1. Taxmin qilinayotgan hozirgi holat

| Jarayon | Taxminiy hozirgi vosita | Nega muammo (taxmin) |
|---|---|---|
| O'quvchi ro'yxati | Excel | Versiya nizosi, kim oxirgi tahrirlaganini bilib bo'lmaydi |
| Dars jadvali | Excel / qog'oz / devordagi varaq | O'zgarish bo'lsa hamma nusxa eskiradi |
| Baho va blok test | Excel | 189 ballik hisob qo'lda, xato ehtimoli yuqori |
| Davomat | Qog'oz jurnal | Kechikish statistikasi umuman yig'ilmaydi |
| Yotoqxona xonalari | Qog'oz / xotira | Kim qayerda yashaydi — tarix saqlanmaydi |
| Ovqat va to'lov | Daftar / Excel / naqd | Haftalik hisob qo'lda, qarzdorlik kechikadi |
| Intizom | Og'zaki + qog'oz | Takrorlanuvchi muammoni ko'rish imkonsiz |
| Ota-ona bilan aloqa | Telegram / qo'ng'iroq | Bir tomonlama, arxivi yo'q |
| Kirish natijalari | Hech qayerda tizimli yig'ilmaydi | Akademiyaning asosiy natijasi o'lchanmaydi |

### 3.2. Nega bu shunchaki "Excel noqulay" muammosi emas

Excel'ning asosiy muammosi noqulaylik emas — **bog'lanmaganlik**. Yotoqxonali
akademiyada ma'lumotlar bir-biriga bog'liq:

```
Kechqurun yotoqxonada yo'q → ertalab darsga kelmadi → blok test bali tushdi
   → intizom qaydi → xavf skori qizil zonada → ota-ona xabardor qilinishi kerak
```

Excel'da bu zanjirning har bir bo'g'ini **alohida faylda** yashaydi. Zanjirni ko'rish
uchun kimdir beshta faylni ochib, ismlarni qo'lda solishtirishi kerak. Amalda buni hech
kim qilmaydi — shuning uchun muammo o'quvchi ketib qolgandan keyin aniqlanadi.

MathAcademy'da bu zanjir modellashtirilgan: `attendance` → `discipline` →
`student_risk_scores` → `notifications`, va hammasi `student_timeline` da bitta oqimda
ko'rinadi. Xavf skori esa aniq qoida bilan hisoblanadi — `risk.service.ts` dagi
`levelFromScore()`: **≤33 GREEN, ≤66 YELLOW, >66 RED**.

### 3.3. Domen: nega bu oddiy maktab tizimi emas

Bu farq butun bozor pozitsiyasining asosi.

#### DTM 189 ballik tizim

O'zbekiston oliy ta'limga kirish imtihoni formati:

```
Asosiy fan (MAIN)           → 93 ball
Qo'shimcha fan (SECONDARY)  → 63 ball
Majburiy fanlar (MANDATORY) → 3 × 11 = 33 ball
                              ─────────────────
                              JAMI: 189 ball
```

Modellashtirish: `student_tracks` (o'quvchi yo'nalishi) → `track_subjects` har fanga
`role` beradi (`SubjectRole` enum: MAIN / SECONDARY / MANDATORY). Track ichida MAIN va
SECONDARY **yagona** bo'lishi tekshiriladi (`tracks.service.ts:280`).

> ⚠️ **Ochiq muammo — TZ hal qilishi kerak:** 189 ball qoidasi **faqat frontendda**
> yashaydi (`apps/web/src/pages/staff/AssessmentsPage.tsx:503,516,710,719,727`).
> Backend'da `assessments.max_score` — oddiy `Decimal(8,2)`, `assessments.weight` —
> oddiy `Decimal(6,3)` default `1.0`. Ya'ni **API `BLOCK_TEST` ni `max_score: 500`
> bilan ham qabul qiladi**. Git tarixi buni tasdiqlaydi: `1c8bdb9 fix: assessments
> filter subjects by group, auto-fill BLOCK_TEST maxScore=189` — "auto-fill" so'zi
> aynan UI qulayligi ekanini bildiradi, domen qoidasi emas. Foydalanuvchi maydonni
> qo'lda o'zgartirsa yoki API'ga to'g'ridan-to'g'ri so'rov yuborsa — qoida yo'q.

#### Kirish natijalari — akademiyaning asosiy KPI'si

`student_outcomes` (`schema.prisma:825`) o'quvchi qayerga kirganini saqlaydi:
`outcome_status` (`EARLY_ADMITTED` / `ON_TIME_ADMITTED` / `NOT_ADMITTED` / `UNKNOWN`),
`institution_name`, `faculty_or_program`, `decision_date`.

> **Diqqat:** `outcome_status` — Prisma `enum` emas, `String @db.VarChar(30)`
> (default `"UNKNOWN"`). Butun loyihada **atigi 1 ta enum** bor (`SubjectRole`). Ya'ni
> `a3dab30` da tuzatilgan "certificates outcomeStatus" bagi tasodif emas — DB darajasida
> hech narsa noto'g'ri qiymatni to'xtatmaydi. Bu TZ uchun aniq vazifa.

Nega bu muhim: kurs markazi CRM'i uchun asosiy KPI — **to'lov**. Tayyorlov akademiyasi
uchun — **nechta o'quvchi qayerga kirdi**. Butun biznes shu raqamga bog'liq, chunki
keyingi yil ota-onalar aynan shuni so'raydi.

#### Yotoqxona va ovqatlanish

Schema'da tekshirilgan modellar:

| Soha | Modellar |
|---|---|
| Yotoqxona | `dorms`, `dorm_rooms`, `student_room_assignments`, `dorm_student_charges`, `dorm_billing_months`, `dorm_payment_announcements`, `dorm_announcement_prices`, `living_types` |
| Ovqatlanish | `meal_weeks`, `meal_student_charges`, `meal_payment_announcements`, `meal_announcement_prices` |
| Tarix | `student_group_history`, `student_living_history`, `grade_snapshots` + `grade_snapshot_rows`, `student_timeline` |
| Ekranlar | `displays`, `display_playlists`, `display_items` — bino ichidagi axborot ekranlari |

`meal_weeks` — ovqatlanish **haftalik** hisoblanadi, `dorm_billing_months` — yotoqxona
**oylik**. Bu ikki xil billing sikli bitta tizimda. Kurs markazi CRM'ida bunday narsa
yo'q, chunki kurs markazida o'quvchi kechasi uyiga ketadi.

---

## 4. Bozor — halol tahlil

> Bu bo'lim ataylab pessimistik yozilgan. Loyihani o'zimizga sotmaymiz.

### 4.1. Bozor hajmi — noma'lum

| Ko'rsatkich | Qiymat | Ishonch |
|---|---|---|
| O'zbekistonda yotoqxonali DTM tayyorlov akademiyalari soni | **Noma'lum** | — |
| Ulardan nechtasi raqamli tizimga to'laydi | **Noma'lum** | — |
| O'rtacha akademiya hajmi (o'quvchi soni) | **Noma'lum** | — |
| To'lashga tayyor o'rtacha oylik summa | **Noma'lum** | — |
| Bozorning yillik o'sishi | **Noma'lum** | — |

**Bu kataklar ataylab bo'sh qoldirilgan.** Bu raqamlarni bilmayman va to'qib
chiqarmayman. Ular aniqlanmaguncha butun mahsulot strategiyasi faraz ustida turadi.

Aniq bo'lgan yagona narsa — bozorning **shakli**:

- **<10 akademiya** → bu mahsulot emas, bitta mijoz uchun maxsus tizim (custom
  software). Bu ham normal, lekin SaaS qurish shart emas.
- **50–200** → tor, lekin real B2B bozor. Katta raqib kirishi uchun juda kichik —
  bu himoya.
- **500+** → jiddiy bozor, lekin unda raqiblar allaqachon paydo bo'lgan bo'lardi.

Uchinchi variantning yo'qligi o'zi ma'lumot: **ehtimol bozor kichik**. Buni faraz
sifatida qabul qilib, tekshirish kerak (§9, S1).

### 4.2. Raqiblar — kimlar bor

O'quv markazlari CRM bozorida raqiblar mavjud (kanon bo'yicha tekshirilgan):

| Raqib | Nima qiladi | Kuchli tomoni |
|---|---|---|
| **WeWork** (we-work.uz) | O'quv markazi CRM, o'zini "№1" deb ataydi, **200+ markaz** | Bozor ulushi, brend, sotuv kanali ishlaydi |
| **EducationCRM** (educationcrm.uz) | O'quv markazi CRM | Mavjud mijoz bazasi |
| **CRM Edu** (crm-edu.uz) | O'quv markazi CRM | Mavjud mijoz bazasi |
| **univ.uz** | Ta'lim platformasi | Mavjud mijoz bazasi |

**200+ markaz — bu WeWork'ning raqami, MathAcademy'niki emas.** Bu raqam bozorda
to'laydigan mijozlar borligini isbotlaydi, lekin **boshqa segmentda**.

### 4.3. Farq — nega ular to'g'ridan-to'g'ri raqib emas

Bu tahlilning markaziy nuqtasi. Yuqoridagilar — **o'quv markazi (kurs markazi) CRM'i**.
MathAcademy — **yotoqxonali tayyorlov akademiyasi SIS'i**. Bu ikki xil biznes.

| Domen ehtiyoji | Kurs markazi CRM (WeWork va h.k.) | MathAcademy |
|---|---|---|
| Lead / sotuv voronkasi | ✅ Asosiy funksiya | ❌ Yo'q — akademiyaga kirish imtihon orqali |
| Davomat | ✅ Bor | ✅ Bor (`attendance`) |
| To'lov / SMS | ✅ Asosiy funksiya | ✅ Bor (`billing`, `notifications`) |
| Dars jadvali | ✅ Bor | ✅ Bor (`timetable`) |
| **Yotoqxona (xona, joylashuv, tarix)** | ❌ Yo'q | ✅ 8 ta model |
| **Ovqatlanish (haftalik hisob)** | ❌ Yo'q | ✅ 4 ta model |
| **Intizom qaydlari** | ❌ Yo'q | ✅ `discipline` (1123 qator servis) |
| **DTM 189 ballik tayyorgarlik** | ❌ Yo'q | ✅ `student_tracks` + `SubjectRole` |
| **Kirish natijalari (KPI)** | ❌ Yo'q | ✅ `student_outcomes` |
| **Xavf skori** | ❌ Yo'q | ✅ `student_risk_scores` (GREEN/YELLOW/RED) |
| **Baho kesimi tarixi** | ❌ Yo'q | ✅ `grade_snapshots` |
| **Bino ichidagi ekranlar** | ❌ Yo'q | ✅ `displays` |
| Ko'p filial (campus) | ⚠️ Ba'zilarida | ✅ `campuses` |
| Ruxsat darajasidagi RBAC | ⚠️ Odatda rol darajasida | ✅ `permissions` + `roles` alohida |

Sodda qilib: **kurs markazida o'quvchi kechasi uyiga ketadi. Akademiyada u shu yerda
yashaydi.** Shu bitta farqdan yotoqxona, ovqatlanish, intizom, kechayu-kunduz javobgarlik
va ota-onaning "bolam qanday?" degan savoli kelib chiqadi. WeWork bu savolga javob
bermaydi, chunki uning mijozida bunday savol yo'q.

### 4.4. Lekin bu farq qanchalik himoya?

Halol javob: **texnik jihatdan kam, biznes jihatdan ko'proq.**

**Texnik himoya zaif.** WeWork ertaga yotoqxona moduli qo'shsa — bu bir necha oylik ish.
Xonani o'quvchiga biriktirish murakkab muhandislik masalasi emas. 8 ta Prisma modeli —
bu himoya devori emas.

**Lekin ular buni qilmaydi:** bozori kattaroq (200+ markaz) va yangi segment ularga
kichik ko'rinadi; yotoqxona moduli kurs markazlariga kerak emas — mahsulotni
og'irlashtiradi; ular o'z segmentida allaqachon g'olib.

Ya'ni **himoya — bozorning kichikligi**. Bu xavfli qulaylik: kichik bozor raqibni ham
to'sadi, sizni ham cheklaydi. Agar bozorda 20 ta akademiya bo'lsa — raqib kelmaydi,
lekin siz ham hech qachon katta bo'lmaysiz. Bu ziddiyat §7 va §9 da qayta ko'tariladi.

### 4.5. Eng ehtimolli raqib — Excel emas, "hech narsa qilmaslik"

Eng kuchli raqib jadvalda yo'q: **status-kvo**.

Akademiya rahbari Excel bilan ishlayapti. U ishlaydi — yomon, sekin, xato bilan, lekin
ishlaydi. Yangi tizimga o'tish esa: ma'lumot ko'chirish, xodimlarni o'qitish, bir necha
hafta chalkashlik, va pul. Raqamli tizimning foydasi esa **kechikkan va ko'rinmas**
(xato kamayadi — lekin buni o'lchash qiyin).

Shuning uchun sotuvdagi asosiy savol "WeWork'dan yaxshimisiz?" emas, balki **"nega
umuman o'zgartiray?"**. Bu savolga javob yo'q ekan, mahsulotning texnik sifati
ahamiyatsiz.

---

## 5. HEMIS va davlat tizimlari talabi

### 5.1. HEMIS — qo'llanilmaydi

**HEMIS** (Higher Education Management Information System) — **oliy ta'lim muassasalari
(OTM)** uchun majburiy davlat axborot tizimi. **MathAcademy'ga qo'llanilmaydi**: akademiya
OTM emas — u o'quvchini OTM'ga **tayyorlaydi**, lekin o'zi diplom bermaydi. HEMIS
integratsiyasi TZ doirasidan tashqarida.

Bu foyda: majburiy bo'lganda mahsulot arxitekturasi davlat sxemasiga bo'ysunishi kerak
bo'lardi. Hozircha bunday cheklov yo'q.

### 5.2. Lekin — ochiq savol

⚠️ **Tekshirilmagan:** maktabgacha / o'rta / nodavlat ta'lim muassasalari uchun
**boshqa** davlat axborot tizimiga ulanish talabi bormi?

Javob **ikki tomonlama** ta'sir qiladi:

| Agar talab **bor** bo'lsa | Agar talab **yo'q** bo'lsa |
|---|---|
| ❌ Integratsiya majburiy → davlat sxemasiga moslashish | ✅ Arxitektura erkin |
| ✅ **Lekin bu himoya**: integratsiya qilgan tizim ustun, WeWork uchun ham to'siq | ❌ Rasmiy maqom yo'q — har kim kirishi mumkin |
| ✅ Rasmiy ro'yxat sotuv kanaliga aylanadi | ❌ Sotuv butunlay o'zingizga bog'liq |

Ya'ni "talab yo'q" javobi ham to'liq yaxshi xabar emas: rasmiy talab — bu ham to'siq,
ham himoya. Buni **kod yozishdan oldin** aniqlash kerak. Manba: Xalq ta'limi vazirligi
me'yoriy hujjatlari, nodavlat ta'lim muassasalari litsenziya shartlari.

### 5.3. Yuridik savol — bolalar ma'lumoti

⚠️ **Bu yurist savoli, muhandis savoli emas. Bu hujjat yuridik maslahat bermaydi.**

Tizim **voyaga yetmagan** o'quvchilar haqida saqlaydi: shaxsiy ma'lumot (ism, tug'ilgan
sana, ota-ona kontakti) · **qayerda yashashi** (`student_room_assignments` — qaysi
yotoqxona, qaysi xona) · **intizom qaydlari** (`discipline`) · **xavf skori**
(`student_risk_scores` — RED zonadagi bola) · avatar rasmi (`AvatarUpload`).

Bu birikma — bola qayerda uxlashi, qanday muammosi borligi va rasmi — oddiy CRUD
ma'lumot emas. Aniqlanishi kerak: (1) voyaga yetmaganlar ma'lumotini qayta ishlash
uchun qanday rozilik talab qilinadi? (2) ma'lumot **lokalizatsiyasi** talabi bormi?
(3) saqlash muddati va o'chirish majburiyati? (4) ota-ona qaysi ma'lumotni ko'rish
huquqiga ega?

**2-savol ayniqsa jiddiy.** `render.yaml` va Vercel deploy izlari repo'da bor — ya'ni
serverlar O'zbekistondan tashqarida. Agar lokalizatsiya talabi bo'lsa, bu infratuzilma
qarori va keyinroq o'zgartirish qimmat.

---

## 6. Nega bu loyiha yutishi mumkin

Halol bo'lish ikki tomonga ishlaydi. Quyidagilar — real ustunliklar.

### 6.1. Muallif domenni ichdan biladi

Bu eng kam takrorlanadigan ustunlik. Muallif **shu akademiyada o'qigan**.

Tashqi dasturchi yotoqxona modulini "xona, o'rin, o'quvchi" deb modellaydi. Ichdan
bilgan odam biladi: o'quvchi yil davomida xona **almashadi** (`student_living_history`);
yashash **turi** bor (`living_types`); ovqat **haftalik**, yotoqxona **oylik** hisoblanadi
— ikki xil billing sikli; to'lov e'lonining **narxi** e'lon bo'yicha o'zgaradi
(`dorm_announcement_prices`, `meal_announcement_prices`); baho kesimi **davriy**
saqlanadi (`grade_snapshots` + `period_type`).

Bu detallar so'rovnomadan chiqmaydi — faqat o'sha hayotni yashagan odamda bo'ladi.
69 ta model — bu domen bilimining moddiylashgan shakli.

### 6.2. Tizim allaqachon real ishlatiladi

Raqiblar uchun eng qiyin narsa — **birinchi mijoz**. MathAcademy'da u bor.

| Nima | Nega muhim |
|---|---|
| Real feedback tsikli | §2.2 dagi 36 daqiqalik fix seriyasi — foydalanuvchi bilan bevosita aloqa |
| Domen validatsiyasi | 48 sahifa qurilgan va ishlatilyapti — ehtiyoj taxmin emas, tasdiqlangan |
| Referens mijoz | Ikkinchi mijozga "bu ishlaydi" deyish uchun dalil bor |
| Real ma'lumot | Test ma'lumoti emas — haqiqiy hajm va chekka holatlar (`startsAt: null` kabi) |

Ko'p SaaS loyihalari nol mijozdan boshlaydi va birinchi mijozgacha yetmay o'ladi.
Bu loyiha teskari yo'nalishda: **mijoz bor, mahsulot yo'q.**

### 6.3. Texnik poydevor jiddiy joylarda to'g'ri

Kod ideal emas (§2.3), lekin bir necha muhim qaror **to'g'ri** qilingan:

| Qaror | Nega to'g'ri |
|---|---|
| **Multi-tenancy boshidan** | Tenant JWT'dan olinadi, **mijoz parametridan hech qachon emas**. 30 servisdan 29 tasi `tenant_id` bilan filtrlaydi; istisno — `tenants.service.ts` (global boshqaruv, to'g'ri) |
| **BigInt intizomi** | ID'lar `BigInt`, chunki JS `number` 2⁵³ dan katta butun sonni yo'qotadi. Butun infratuzilma qurilgan: `parse-bigint.pipe.ts`, `is-bigint-string.decorator.ts`, `bigint.util.ts`, `param-bigint.decorator.ts` |
| **Haqiqiy migration** | 2 ta migration fayl, `db push` **hech qachon**. Ko'p loyiha buni keyin afsus qiladi |
| **RBAC ruxsat darajasida** | `permissions` + `roles` + `role_permissions` + `user_roles` — rol emas, **ruxsat** darajasida |
| **Env validatsiya** | `common/config/env.validation.ts` — noto'g'ri konfiguratsiyada tizim **ishga tushmaydi** |
| **Auth himoyasi** | `auth_attempts`, `auth_locks`, `auth_sessions` — **PostgreSQL'da** (Redis'da emas: lock restart'dan omon qoladi), bcrypt cost 12, `audit_logs` |

Multi-tenancy'ni **keyin** qo'shish odatda qayta yozish demakdir. Bu yerda u boshidan
bor. Muammo bajarilishida (845 qo'lda nuqta), qarorda emas — ya'ni tuzatiladigan.

### 6.4. Raqiblarda yo'q narsa

Kombinatsiya: **domen bilimi (ichdan) + ishlaydigan kod (62 783 qator) + real mijoz.**

WeWork'da mijoz va kod bor — bu domen bilimi yo'q. Yangi startapda domen bilimi bo'lishi
mumkin — lekin kod ham, mijoz ham yo'q. Uchtasi birga bo'lishi kam uchraydi.

**Lekin** bu kombinatsiya faqat **mahsulotni** yaratadi. Biznesni emas — keyingi bo'lim.

---

## 7. Nega bu loyiha yutmasligi mumkin

Bu bo'lim eng muhimi. Yuqoridagi hamma narsa to'g'ri bo'lsa ham, loyiha muvaffaqiyatsiz
bo'lishi mumkin — quyidagi sabablar bo'yicha.

### 7.1. Sotuv kanali yo'q

**Eng katta xavf shu.**

WeWork'da 200+ markaz bor. Bu shuni anglatadiki, ularda **sotuv mashinasi ishlaydi**:
kim qo'ng'iroq qiladi, kim demo ko'rsatadi, kim shartnoma imzolaydi — hammasi ma'lum.

MathAcademy'da: **nol**. Sotuvchi yo'q, marketing yo'q, veb-sayt yo'q, narx yo'q, demo
skripti yo'q. Ikkinchi akademiyaga qanday yetib borish rejasi yo'q.

Bu texnik masala emas — kod yozib hal qilib bo'lmaydi. Muhandis uchun eng noqulay xavf
turi aynan shu: **eng katta xavf sizning kuchli tomoningizdan tashqarida.** Kod yozish
davom etsa, xavf kamaymaydi — faqat kechikadi.

### 7.2. Bitta akademiya = bitta mijoz = konsentratsiya xavfi

| Xavf | Ta'siri |
|---|---|
| Yagona mijoz shartnomani to'xtatsa | Loyihaning **butun** real ishlatilishi tugaydi. §6.2 dagi ustunlik yo'qoladi |
| Yagona mijoz ehtiyoji = mahsulot ehtiyoji deb qabul qilinsa | Bitta akademiyaga xos narsa umumiy deb modellashtiriladi — ikkinchi mijozda mos kelmaydi |
| Feedback bitta manbadan | Bir xil fikrlash tarzi. Boshqa akademiya butunlay boshqacha ishlashi mumkin |

Ikkinchi qator alohida xavfli. Tizim **bitta akademiya bilan tasdiqlangan** — ya'ni n=1.
Statistik jihatdan bu tasdiq emas, bu misol. Masalan `SubjectRole`
(MAIN/SECONDARY/MANDATORY) — DTM formati, davlat qoidasi → universal bo'lishi ehtimoli
yuqori. Lekin `meal_weeks` (haftalik ovqat hisobi) — bu shu akademiyaning qoidasimi yoki
umumiy amaliyotmi? **Bilmaymiz.**

### 7.3. Onboarding qo'lda

Kanon aniq yozadi: **self-service onboarding yo'q**. Yangi tenant qanday qo'shiladi?
Ehtimol qo'lda — SQL yozib, seed ishga tushirib, konfiguratsiya qilib. Ya'ni:
`har yangi mijoz = muallifning bir necha kuni` → `10 mijoz = boshqarib bo'lmaydigan yuk`
→ **miqyoslashmaydi**.

SaaS bo'lish uchun kerak bo'lgan, lekin **yo'q** narsalar (kanon §6):

| Yo'q narsa | Onboarding'ga ta'siri |
|---|---|
| Self-service onboarding | Har mijoz qo'lda sozlanadi |
| Tenant bo'yicha billing | Obuna, tarif, limit — yo'q. Pul qanday olinadi? |
| CI | Har deploy qo'lda tekshiriladi (`.github/` yo'q — tasdiqlangan) |
| Observability | 10 tenantda kimda muammo borligini bilib bo'lmaydi |
| Testlar | Ko'p tenantda regression = bir necha mijozning ish kuni |

Oxirgi qator eng jiddiy. Hozir bag chiqsa — bitta akademiya ta'sirlanadi va muallif 36
daqiqada tuzatadi (§2.2). 20 akademiyada bag chiqsa — 20 ta qo'ng'iroq, va tuzatish 36
daqiqa emas, chunki qaysi tenantda nima borligini bilmaysiz. **Testsiz ko'p ijarachilik
— vaqt bombasi:** 845 ta qo'lda nuqtadan bittasi unutilsa, bir akademiya boshqasining
o'quvchilarini ko'radi. Bu bag emas — **ma'lumot sizib chiqishi**, va bu bolalar
ma'lumoti (§5.3).

### 7.4. Bozor juda kichik bo'lishi mumkin

§4.1: bozor hajmi noma'lum. Agar javob **"10 tadan kam"** bo'lsa — SaaS qurish iqtisodiy
jihatdan mantiqsiz va to'g'ri strategiya butunlay boshqacha: bitta mijozga chuqur maxsus
tizim. Bu **haqiqiy ehtimol**, chekka holat emas. Uni tekshirmasdan yozilgan har bir
qator kod — noaniq garov.

### 7.5. Muallif bitta

62 783 qator kod, 28 modul, 69 model — **bitta odam**. Bu ustunlik (tezlik, izchillik),
lekin ayni paytda: **bus factor = 1**; sotuv, qo'llab-quvvatlash va muhandislik bitta
odamda; mijoz sonining ortishi qo'llab-quvvatlash yukini chiziqli oshiradi, muhandislik
vaqtini esa nolga tushiradi.

### 7.6. Xavflar jamlanmasi

| # | Xavf | Ehtimol | Ta'sir | Kod bilan hal bo'ladimi? |
|---|---|---|---|---|
| X1 | Sotuv kanali yo'q → ikkinchi mijoz kelmaydi | **Yuqori** | **Kritik** | ❌ Yo'q |
| X2 | Bozor juda kichik (<10 akademiya) | O'rta | **Kritik** | ❌ Yo'q |
| X3 | Yagona mijoz ketadi | Past | Yuqori | ❌ Yo'q |
| X4 | Tenant ma'lumoti sizib chiqadi (845 qo'lda nuqta) | O'rta | **Kritik** | ✅ Ha — TZ ning asosiy vazifasi |
| X5 | Testsiz regression ko'p mijozni buzadi | **Yuqori** | Yuqori | ✅ Ha |
| X6 | Qo'lda onboarding miqyoslashmaydi | **Yuqori** | O'rta | ✅ Ha |
| X7 | Yuridik muammo (bolalar ma'lumoti, lokalizatsiya) | Noma'lum | Yuqori | ⚠️ Qisman — yurist kerak |
| X8 | Raqib yotoqxona moduli qo'shadi | Past | O'rta | ❌ Yo'q |
| X9 | Bus factor = 1 | — | Yuqori | ❌ Yo'q |

**Diqqat qiling: eng yuqori xavflarning ko'pi kod bilan hal bo'lmaydi.**

Bu TZ ning chegarasini aniq belgilaydi. TZ X4, X5, X6 ni hal qiladi — ya'ni tizimni
texnik jihatdan ko'p mijozga tayyorlaydi. Lekin X1 va X2 hal qilinmasa, X4–X6 ni hal
qilishning ma'nosi yo'q: **hech kim ishlatmaydigan tizimni mukammal himoyalash — behuda ish.**

Shuning uchun tavsiya: **X1 va X2 ni tekshirish TZ implementatsiyasiga parallel
boradi, undan keyin emas.**

---

## 8. Vizyon

### 8.1. Yo'nalish

| BUGUN | ERTAGA |
|---|---|
| Bitta akademiya SIS'i (62 783 qator, 51 commit) | O'zbekiston tayyorlov akademiyalari uchun mahsulot |
| 1 tenant, qo'lda onboarding | N tenant, self-service |
| Testsiz | Tenant izolyatsiya testi bilan |
| UI'da domen qoidalari | Domen qatlamida |

### 8.2. Bosqichlar

Har bosqich **oldingisining tekshiruvi** bilan boshlanadi. Sakrash yo'q.

| Bosqich | Nima | Chiqish mezoni |
|---|---|---|
| **B0 — Tekshirish** | Bozor hajmi, davlat talabi, yuridik holat aniqlanadi (§9: S1, S2, S5) | Javob bor. Agar bozor <10 → strategiya qayta ko'riladi |
| **B1 — Texnik ishonchlilik** | Strukturaviy tenant izolyatsiyasi (Prisma extension), tenant izolyatsiya testi, CI | "A tenanti B'ni o'qiy olmaydi" testi **yashil**. 845 qo'lda nuqta bosqichma-bosqich ko'chiriladi |
| **B2 — Domen qatlami** | DTM 189 qoidasi backend'ga, `outcome_status` enum'ga | API `BLOCK_TEST` ni `max_score: 500` bilan **rad etadi** |
| **B3 — Ikkinchi tenant** | Self-service onboarding, tenant billing, observability | Ikkinchi akademiya **muallif aralashuvisiz** qo'shiladi |
| **B4 — Mahsulot** | Narx, sotuv, qo'llab-quvvatlash | Birinchi **to'laydigan** ikkinchi mijoz |

### 8.3. Eng muhim mezon

**B3 dagi chiqish mezoni butun vizyonning sinovi.** Agar ikkinchi akademiya muallifning
qo'lda ishlashisiz qo'shila olmasa — bu mahsulot emas, bu xizmat (consulting). Ikkalasi
ham qonuniy biznes, lekin xizmat odam soniga qarab o'sadi, mahsulot esa yo'q.

Undan ham oldingi savol — **B0**. Agar bozorda 8 ta akademiya bo'lsa, B1–B4 ning hammasi
noto'g'ri ish bo'ladi. To'g'ri ish esa: bitta mijozga eng yaxshi tizimni qurish va SaaS
haqida umuman o'ylamaslik.

### 8.4. Non-goals — bu loyiha nima qilmaydi

- **Kurs markazlari CRM bozorida WeWork bilan raqobatlashish** — bu boshqa segment,
  ularda 200+ markaz va ishlaydigan sotuv bor
- **Mavjud kodni butunlay qayta yozish** — bu ishlaydigan tizim
- **Prisma model nomlarini o'zgartirish** — 69 modelni sindiradi
- **HEMIS integratsiyasi** — akademiya OTM emas (§5.1)
- **Umumiy maktab tizimiga aylanish** — yotoqxona + DTM + kirish natijalari fokusi
  yo'qolsa, ustunlik yo'qoladi
- **Yangi modul qo'shish** — 28 modul qat'iy; TZ mavjudini yetuklashtiradi

---

## 9. Ochiq savollar

Bu hujjatdagi eng halol bo'lim. Quyidagilar **javobi yo'q** savollar.

### 9.1. Bozor

| # | Savol | Nega muhim | Qanday tekshiriladi |
|---|---|---|---|
| **S1** | O'zbekistonda nechta yotoqxonali DTM tayyorlov akademiyasi bor? | Javob <10 bo'lsa — SaaS strategiyasi noto'g'ri (§7.4) | Nodavlat ta'lim muassasalari reyestri; Xalq ta'limi vazirligi ochiq ma'lumotlari |
| **S2** | Ulardan nechtasi hozir raqamli tizim ishlatadi? | Status-kvo raqibini o'lchash (§4.5) | 5 ta akademiya rahbari bilan suhbat |
| **S3** | Akademiya bunday tizimga oyiga qancha to'lashga tayyor? | Narx modeli yo'q | Narx testi, 3 ta rahbar |
| **S4** | Ikkinchi akademiyaga qanday yetib boriladi? | **X1 — eng katta xavf**, javobi yo'q | Reja tuzilishi kerak |

### 9.2. Huquqiy va davlat

| # | Savol | Nega muhim | Kim javob beradi |
|---|---|---|---|
| **S5** | O'rta/nodavlat ta'lim uchun majburiy davlat axborot tizimi bormi? | Ham to'siq, ham himoya (§5.2) | Me'yoriy hujjatlar; vazirlik |
| **S6** | Voyaga yetmaganlar ma'lumoti uchun qanday rozilik talab qilinadi? | Bolalar ma'lumoti (§5.3) | **Yurist** |
| **S7** | Ma'lumot lokalizatsiyasi talabi bormi? | Hozir Render + Vercel — serverlar tashqarida | **Yurist** |
| **S8** | Ota-ona bolasi haqidagi qaysi ma'lumotni ko'rish huquqiga ega? | `discipline`, `student_risk_scores` — nozik ma'lumot | **Yurist** + akademiya siyosati |

### 9.3. Mahsulot, domen va texnik

| # | Savol | Kontekst |
|---|---|---|
| **S9** | Qaysi model universal, qaysi biri shu akademiyaga xos? | n=1 muammosi (§7.2). `meal_weeks` haftalik hisobi — umumiymi? |
| **S10** | Ikkinchi akademiya boshqa DTM formatidan foydalanadimi? | `SubjectRole` (MAIN/SECONDARY/MANDATORY) qanchalik qat'iy? |
| **S11** | Yangi tenant onboarding qanday ko'rinishi kerak? | Hozir noma'lum — qo'lda |
| **S12** | Tenant billing modeli qanday? Obuna? O'quvchi soniga qarab? | SaaS bo'lish sharti |
| **S13** | "O'qituvchi FAQAT o'z guruhiga baho qo'ya oladi" qoidasi qanday majburlanadi? Resource-level tekshiruv bormi? | RBAC `permissions` darajasida ishlaydi, lekin resurs egaligi alohida masala. **Tekshirilsin** |
| ~~**S14**~~ | ~~JWT access TTL — 15 soat yoki 15 daqiqa?~~ | ✅ **JAVOB TOPILDI, TUZATILDI.** `render.yaml:21` → `ACCESS_TOKEN_TTL: 15m`, ya'ni **deploy qilingan servis har doim 15 daqiqa ishlatgan**. Xato faqat `.env.example` da edi va u **lokal** dasturchiga tegardi — muhitlar orasidagi jimgina 60-barobar farq. `.env.example` `15m` ga tuzatildi |
| **S15** | 845 qo'lda tenant nuqtasini Prisma extension'ga qanday **bosqichma-bosqich** ko'chirish mumkin? | Bir kunda o'zgartirib bo'lmaydi. Migratsiya yo'li TZ da |
| **S16** | `outcome_status` `VarChar(30)` dan enum'ga o'tishda mavjud ma'lumot toza-mi? | `a3dab30` bagi noto'g'ri qiymat yozilgan bo'lishi mumkinligini ko'rsatadi |

### 9.4. Eng muhim uchtasi

Agar faqat uchtasiga javob berish imkoni bo'lsa:

1. **S1** — bozorda nechta akademiya bor? Javob butun strategiyani belgilaydi.
2. **S4** — ikkinchi mijozga qanday yetib boriladi? Javobsiz — mahsulot yo'q.
3. **S13/S15** — tenant izolyatsiyasi kafolatlanganmi? Javobsiz — mahsulot **xavfli**.

Birinchi ikkitasi kod bilan hal bo'lmaydi. Uchinchisi — TZ ning asosiy vazifasi.

---

## 10. Keyingi hujjatlar

| Hujjat | Nima haqida |
|---|---|
| `01-product-spec.md` | Personalar (staff rollari, guardian), user story, RBAC matritsasi |
| `02-architecture.md` | Multi-tenancy, Prisma extension migratsiyasi, modul chegaralari |
| `03-data-model.md` | 69 model, domen qoidalari, DTM 189 backend'ga |
| `04-testing.md` | Tenant izolyatsiya testi — **eng muhim test** |
| `05-roadmap.md` | B0–B4 bosqichlari, xavflar (X1–X9) |

---

> **Ushbu hujjatdagi barcha kod havolalari, commit hash'lari va o'lchamlar
> [`CANON.md`](./CANON.md) va repo'ning `HEAD` holatiga nisbatan tekshirilgan
> (2026-07-15). Bozor raqamlari — bo'sh, chunki o'lchanmagan.**
