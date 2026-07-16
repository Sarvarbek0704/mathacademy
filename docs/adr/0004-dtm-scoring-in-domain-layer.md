# ADR-0004 — DTM 189 ball qoidasi domen qatlamiga ko'chadi; `max_score` hisoblanadi

- **Holat:** Taklif
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

MathAcademy — davomat va to'lovni hisoblaydigan CRM emas. U **DTM'ga
tayyorlaydigan akademiya** uchun qurilgan, va **DTM 189 ballik tizimi —
akademiyaning mavjudlik sababi**. Agar bu qoida noto'g'ri bo'lsa, qolgan 62 783
qator kodning ma'nosi yo'q.

DTM formati (veb-qidiruv bilan tasdiqlangan, `07-dtm-assessment-engine.md` §1.1):

| Blok | Rol | Savol | Koef. | Maksimal |
|---|---|---:|---:|---:|
| Ixtisoslik 1-fan | `MAIN` | 30 | ×3.1 | **93.0** |
| Ixtisoslik 2-fan | `SECONDARY` | 30 | ×2.1 | **63.0** |
| Ona tili / Matematika / O'zbekiston tarixi | `MANDATORY` | 3 × 10 | ×1.1 | **33.0** |
| **Jami** | | **90** | | **189.0** |

⚠️ **2026 uchun format o'zgarmagan — tasdiqlangan** (infoedu.uz, oliygoh.uz):
93 + 63 + 33 = **189**. Bu qaror **barqaror qoidaga** tayanadi.

**Va bu qoidani akademiya belgilamaydi — uni davlat belgilaydi.** Domen qoidasi
tashqi va qat'iy bo'lsa, u UI'da emas, **domen qatlamida** yashashi kerak.

### Muammo 1 — 189 faqat frontendda

O'lchangan. `BLOCK_TEST` ni 189 ballga bog'laydigan **yagona joy** — brauzerdagi
`onValueChange` callback'i:

```tsx
// apps/web/src/pages/staff/AssessmentsPage.tsx:710
maxScore: v === 'BLOCK_TEST' ? '189' : form.maxScore,
```

Backend esa hech narsa bilmaydi:

```prisma
// schema.prisma:53 — assessments
type       String   @db.VarChar(30)                  // ← enum EMAS
max_score  Decimal  @default(100) @db.Decimal(8, 2)  // ← 189 haqida bilmaydi
```

```ts
// apps/api/src/modules/assessments/assessments.service.ts:118
max_score: args.dto.maxScore ?? 100,   // ← MIJOZDAN. Tekshiruv yo'q
```

DTO faqat diapazon tekshiradi (`create-assessment.dto.ts:71`): `@Min(1)`,
`@Max(1000)`. Natija: `POST {type:'BLOCK_TEST', maxScore:500}` → **`201 Created`**.

Himoya bor, lekin u **DTM himoyasi emas** — u "son aqlli oraliqda bo'lsin"
degan umumiy sanity check. `BLOCK_TEST` va `189` o'rtasidagi bog'liqlik
backendda **umuman mavjud emas**.

Va koeffitsiyent `3.1` **3 ta React faylida mustaqil yozilgan**
(`AssessmentsPage.tsx:66-73`, `GuardianGrades.tsx:83-87`, `TracksPage.tsx:52`).

### ⚠️ Muammo 2 — chuqurroq: track tarkibi ham majburlanmaydi

Bu — muammoning **kattaroq yarmi**. O'lchangan (bu ADR yozilayotganda qayta
tasdiqlandi):

```bash
grep -rn "MANDATORY" --include=*.ts apps/api/src/ | grep -v dto
# → tracks.service.ts:278:  const role = (args.role as SubjectRole) || SubjectRole.MANDATORY;
grep -c "track" apps/api/src/modules/assessments/assessments.service.ts
# → 0
```

> **`MANDATORY` butun backendda BIR MARTA uchraydi — va u yerda ham shunchaki
> default qiymat.** **987 qatorlik `assessments.service.ts` `track` so'zini
> UMUMAN BILMAYDI.**

Va `tracks.service.ts:281-292` "tekshiruv" deb ko'rinadi, lekin hech narsani
rad etmaydi — **jimgina ustidan yozadi**:

```ts
if (existing) {
  await this.prisma.track_subjects.update({   // ← ⚠️ jimgina ALMASHTIRADI
    where: { id: existing.id },
    data: { subject_id },
  });
  return { ok: true };                        // ← ⚠️ xato qaytmaydi
}
```

Trackda `MAIN = Matematika` bo'lsa va xodim xato bilan `MAIN = Fizika` qo'shsa —
**Matematika MAIN bo'lishdan to'xtaydi va hech kim xabar olmaydi**. Va
`addSubject` da `auditLogger` chaqirilmaydi — **iz ham qolmaydi**. Aniq
tekshirilgan holatlar (`07` §3.3):

| Savol | Javob |
|---|---|
| 0 ta fan bilan track bo'ladimi? | ✅ **Ha** — bu har yangi trackning boshlang'ich holati |
| 5 ta `MANDATORY` bo'ladimi? | ✅ **Ha, cheklovsiz** |
| `MAIN` ni o'chirib tashlash mumkinmi? | ✅ **Ha** — `removeSubject:305`, tekshiruvsiz |
| Blok test yaratishda track to'liqligi tekshiriladimi? | ❌ **Yo'q** |

**Ya'ni: yaroqsiz track ustiga yaroqsiz blok test quriladi, tizim jim turadi.**

Va uchinchisi ikkalasini bog'laydi: blok test UI'si fan rolini `SubjectRole`
enum'idan emas, **`group_subjects` massivining indeksidan** o'qiydi
(`AssessmentsPage.tsx:187`) — `group_subjects` da esa tartib ustuni yo'q
(`@@id([group_id, subject_id])`, `created_at`/`position` yo'q). PostgreSQL
qaytaradigan tartib **kafolatlanmagan**, ya'ni `×3.1` **noto'g'ri fanga**
tushishi mumkin. Jimgina.

> ⚠️ `189` — hisoblangan son emas. U **shunchaki yozib qo'yilgan son**.

## Qaror

**DTM 189 ball qoidasi `apps/api/src/core/dtm/` domen qatlamiga ko'chadi.**
Ikki qat'iy qoida:

**1. `BLOCK_TEST` uchun `max_score` mijozdan OLINMAYDI — u hisoblanadi:**
`max_score = new Prisma.Decimal(DTM_MAX_TOTAL.toString())` (189.0).

Mijoz `maxScore` yuborsa va u 189 dan farq qilsa — **`400 BLOCK_TEST_MAX_SCORE_IS_DERIVED`**.
Jimgina 189 ga almashtirilmaydi: mijoz `500` yuborsa — bu **bag**, va uni
yashirish kerak emas.

**2. Track tekshirilmaydi — u PARSE qilinadi:**
`validateDtmTrack(subjects: TrackSubjectShape[]): DtmTrack`. `DtmTrack` tipi
yaroqsiz tarkibni **ifodalab bo'lmaydigan** qilib yozilgan:

```ts
export interface DtmTrack {
  main: TrackSubjectShape;
  secondary: TrackSubjectShape;
  mandatory: [TrackSubjectShape, TrackSubjectShape, TrackSubjectShape];  // ← tuple
}
```

`DtmTrack` ni olishning **yagona yo'li** — `validateDtmTrack()`. Ya'ni uni
qabul qiladigan har funksiya to'liqlikni **tekin** oladi, qayta tekshirmasdan.
Hisoblash `role` bo'yicha ishlaydi — **massiv indeksi bo'yicha emas**.
Arifmetika `Decimal` da.

⚠️ **Majburlash chegarasi aniq:**

| Nima | Qoida |
|---|---|
| Track yaratish / fan qo'shish | To'liqlik **talab qilinmaydi** — bu ish jarayoni |
| `BLOCK_TEST` yaratish | To'liqlik **majburiy** — bu DTM |
| `WEEKLY_TEST` va boshqalar | Trackka **umuman tegmaydi** |

Ya'ni yaroqsiz track **mavjud bo'lishi mumkin** — u shunchaki **blok test
ko'tara olmaydi**.

`core/dtm` — **NestJS moduli emas**, sof funksiyalar to'plami. Kanon §8
("yangi modul qo'shma") buzilmaydi: 28 modul o'zgarishsiz qoladi.

**Holat: Taklif.** Implementatsiya va bosqichma-bosqich yo'l —
[../07-dtm-assessment-engine.md](../07-dtm-assessment-engine.md) §5.

## Sabablar

### Nega domen qatlami — brauzer chegara emas

Frontenddagi qoida **faqat brauzer ishtirok etganda** ishlaydi. U ishtirok
etmaydigan yo'llar allaqachon mavjud yoki rejalashtirilgan: **API to'g'ridan-to'g'ri**
(`maxScore: 500` → `201`); **CSV import / onboarding** (kanon §6 — brauzer yo'q,
ya'ni hech qanday DTM tekshiruvi yo'q); **mobil ilova** (`calcDtmTotal` ni
Swift/Kotlin'da qayta yozish = vaqt o'tib ikki xil natija); **`seed.ts`,
migratsiya, integratsiya**.

> Bu — [ADR-0002](./0002-prisma-extension-for-tenant-isolation.md) bilan **bir
> xil dalil**: kafolat chetlab o'tib bo'lmaydigan qatlamda bo'lishi kerak.
> U yerda — Prisma client; bu yerda — domen funksiyasi.

### Nega "parse, don't check"

`checkDtmTrack(subjects): void` chaqiruvchini **o'sha bo'sh massiv** bilan
qoldiradi va "kimdir tekshirgan" degan ishonchga tayanadi.
`validateDtmTrack(subjects): DtmTrack` esa **tipi bilan isbotlangan qiymat**
qaytaradi. Farqi: `mandatory: Subject[]` bo'lsa, 4 fanli track **kompilyatsiya
bo'ladi**. Tuple bo'lsa — **bo'lmaydi**.

> Bu — `tenant.util.ts` darsining takrori (ADR-0002 §Kontekst): **to'g'ri yo'l
> oson yo'l bo'lishi kerak**. Bu yerda undan ham kuchliroq: to'g'ri yo'l —
> **yagona yo'l**, chunki `DtmTrack` ni boshqa yo'l bilan yasab bo'lmaydi.

### Alternativa A — frontendda qoldirish nega yetarli emas

**Avval — uning ustunligi. U kutilganidan kuchliroq:**

- **U bugun ISHLAYDI. Va bu o'lchangan, taxmin emas.** `07` §6.2–6.3 da barcha
  yaroqli DTM javob vektorlari (31 × 31 × 11 × 11 × 11 = **1 279 091** ta)
  sanab chiqilgan:

  ```
  raw float mismatches:                 470997 of 1279091   (36.8%)
  AFTER Math.round(x*10)/10 mismatches: 0                   ← barcha xato yo'qoladi
  ```

  > ⚠️ **Ya'ni `calcDtmTotal` bugun barcha yaroqli kirishlar uchun TO'G'RI.**
  > Blok test ballari hozir noto'g'ri emas — buni aytmaslik muammoni bo'rttirish
  > bo'lardi. Va **"3.1 × 30 float'da 92.999… beradi" degan odatiy dalil —
  > YOLG'ON**: `node -e "console.log(30*3.1)"` → **93**. To'qima raqam bilan
  > qo'rqitish kanon §2 ni buzadi. Bu ADR undan **voz kechadi**.

- **Narxi nol.** Refaktor yo'q, ishlab turgan akademiya tegilmaydi
- **UI tabiiy joy.** Xodim `BLOCK_TEST` tanlaydi → maydon 189 bilan to'ladi —
  yaxshi UX, va u qoladi ham
- **Hech qanday real zarar hujjatlashtirilmagan.** `max_score: 500` bilan blok
  test bazada **bormi?** — ⚠️ **o'lchanmagan** (§Oqibatlar)

**Nega baribir yetarli emas:**

1. **To'g'rilik SABAB bilan emas, TASODIF bilan.** `Math.round(x*10)/10` xatoni
   yashiradi **faqat koeffitsiyentlar 1 kasr xonali bo'lgani uchun** (`07` §6.4):

   ```
   current  3.1/2.1/1.1  : mismatches: 0
   hypoth  3.25/2.15/1.15: mismatches: 2251   eg [0,1,2] → 4.4 o'rniga 4.5
   ```

   Agar DTM koeffitsiyentni **2 kasr xonaga** o'tkazsa, hozirgi kod **jimgina
   noto'g'ri ball chiqara boshlaydi** — 2251 holatda, ogohlantirishsiz. Va bu
   faraz emas: **format davlat qarori bilan o'zgaradi**. Ya'ni kod to'g'ri
   ishlaydi, lekin **nega to'g'ri ekanini hech kim bilmaydi** — kimdir
   `Math.round(x*10)/10` ni "keraksiz" deb o'chirsa, **470 997 holat buziladi**.

2. **U 189 ni himoya qilmaydi, faqat taklif qiladi.** UI 189 yozadi — API 500 ni
   qabul qiladi.

3. **Va eng muhim qismini umuman qamramaydi:** frontend **tarkibni** tekshirmaydi.
   MAIN'siz track ustida 189 ballik blok test — UI'da **chiroyli ko'rinadi**.
   Va **formula 3 joyda takrorlangan** — bittasini unutish jimgina noto'g'ri ball.

> **Xulosa:** bu alternativa "yomon" emas — u **mo'rt**. Va mo'rtligi
> ko'rinmaydi, chunki u bugun to'g'ri javob beradi.

### Alternativa B — DB CHECK constraint nega yetarli emas

**Avval — uning ustunligi, va u jiddiy:**

- **Kafolat BAZADA.** ORM'ni chetlab o'tgan `INSERT`, `seed.ts`, qo'lda yozilgan
  SQL, kelajakdagi import — **hammasi** tekshiriladi. Domen funksiyasi bularning
  hech birini ushlamaydi. Bu — ADR-0002 dagi RLS dalilining aynan o'zi.
  **Migratsiya bilan keladi** — kod review'ga tayanmaydi
- **Va bir qismi HAQIQATAN ishlaydi.** Partial unique index MAIN/SECONDARY
  yagonaligini **DB darajasida** kafolatlaydi:
  ```sql
  CREATE UNIQUE INDEX track_subjects_one_main_per_track
    ON track_subjects (tenant_id, track_id) WHERE role = 'MAIN';
  ```
  Hozir `@@unique([tenant_id, track_id, subject_id])` bor, lekin
  `@@unique([tenant_id, track_id, role])` **yo'q** — ya'ni DB darajasida bitta
  trackda **2 ta MAIN** bo'lishi mumkin

  > ⚠️ **Bu ADR bu indeksni RAD ETMAYDI — u qabul qiladi** (`07` §3.2).
  > CHECK constraint bu yerda **raqib emas, hamroh**: domen qatlami + DB
  > indeksi birga (defence in depth).

**Nega u YOLG'IZ yetarli emas:**

| To'siq | Tafsilot |
|---|---|
| **⚠️ Asosiy qoida bitta qatorga sig'maydi** | "Track'da **aynan** 1 MAIN + 1 SECONDARY + 3 MANDATORY" — bu **jadval bo'ylab agregat**. Row-level `CHECK` buni ifodalay olmaydi. Kerak: `TRIGGER` |
| **Cross-table qoida** | "`BLOCK_TEST` ning `max_score` = 189 **agar** guruh track'i to'liq bo'lsa" — `assessments` → `groups` → `student_tracks` → `track_subjects`. `CHECK` boshqa jadvalga qaray olmaydi |
| **`type` — enum emas, `String`** | `CHECK (type <> 'BLOCK_TEST' OR max_score = 189)` yozish mumkin, lekin `type` — `VarChar(30)`: `'block_test'` uni chetlab o'tadi. Avval enum kerak (`07` §7.3 — **alohida qaror**) |
| **Trigger — debug og'ir** | PL/pgSQL'dagi domen mantig'i: testlanmaydi, TypeScript tipi bermaydi. Format o'zgarsa — migratsiya kerak, deploy emas. Va `CHECK` buzilsa `23514` qaytadi — xodimga "trackda MAIN yo'q" deyish uchun baribir domen qatlami kerak |
| **⚠️ Migratsiya drifti** | Kanon §3: `track_subjects` **hech qaysi migratsiyada yo'q** (sxemada bor). Ya'ni constraint **mavjud bo'lmagan jadvalga** yoziladi. **Drift avval tuzatilishi shart** |

> **Xulosa:** CHECK/partial index — **to'g'ri, lekin qisman**. U yagonalikni
> yopadi, **to'liqlikni** yopmaydi. Domen qatlami — asosiy kafolat; DB indeksi —
> ikkinchi qator.

### Nega `Decimal`, `number` emas

`07` §6.4: **bugun bag yo'q**, lekin Decimal **o'zgarishga chidamlilik** beradi
(`3.25` ham, `3.1` ham aniq). Narxi **nol** — Prisma `max_score`/`score` ni
allaqachon `Decimal` qaytaradi, kod esa ularni darhol `Number()` ga aylantiradi
(`assessments.service.ts:359, 461, 736, 832`): **Decimal bor, undan voz kechilyapti**.

## Oqibatlar

**Ijobiy:**

- **189 — hisoblangan son bo'ladi**, yozib qo'yilgan emas.
  **`max_score: 500` endi `400` qaytaradi** — bag ko'rinadi
- **Yaroqsiz track ustiga blok test qurib bo'lmaydi** — `DTM_TRACK_INCOMPLETE`
- **`×3.1` to'g'ri fanga tushadi** — `role` bo'yicha, massiv indeksi bo'yicha
  emas. `AssessmentsPage.tsx:187` dagi **jimgina ma'lumot buzilishi** yo'qoladi
- **Formula bitta joyda** — 3 nusxa o'rniga. Mobil ilova uni qayta yozmaydi
- **Testlanadi mock'siz** — `core/dtm` sof. Loyihada test **amalda nol** (kanon
  §3), va bu — **eng oson boshlanadigan joy**
- **`SubjectRole` enum nihoyat ishlatiladi** — u to'ldirilgan, lekin blok test
  uni bugun **umuman o'qimaydi**
- **`addSubject` jimgina almashtirishni to'xtatadi** → `409 SUBJECT_ROLE_ALREADY_TAKEN`
  + audit log

**Salbiy:**

- ⚠️⚠️ **ENG MUHIM: majburlashni yoqish ISHLAB TURGAN AKADEMIYADA blok test
  yaratishni TO'XTATISHI MUMKIN.** Bu — bu ADR ning eng jiddiy narxi va u
  **texnik emas**.

  Tizim track to'liqligini **hech qachon tekshirmagan** (`MANDATORY` — backendda
  1 marta). Ya'ni productionda yaroqsiz tracklar bo'lishi **ehtimoli emas —
  KUTILISHI kerak**. Har yangi track **0 fan bilan tug'iladi** — yaroqsiz holat
  **normal ish oqimining bir qismi**.

  Qaror yoqilgan kuni: xodim blok test yaratmoqchi → `400 DTM_TRACK_INCOMPLETE`
  → **u ishlay olmaydi**. Bu — real akademiya, real xodimlar (kanon §0).

  > **Bu KOD ISHI EMAS — MA'LUMOT TUZATISH ISHI.**

  Shuning uchun `07` §5.8 dagi **3b-qadam majburiy** va u **o'tkazib
  yuborilmaydi**: avval yaroqsiz tracklar o'lchansin (so'rov o'sha yerda
  tayyor), keyin yoqilsin.

  ⚠️ **Va u yolg'iz TZ hal qila olmaydigan qaror qoldiradi:** yaroqsiz tracklar
  tuzatilsinmi, blok test yaratish vaqtincha to'xtatilsinmi, yoki `is_dtm_ready`
  bilan bosqichma-bosqich o'tilsinmi — **akademiya bilan kelishiladi**.

- ⚠️ **Yaroqsiz blok testlar allaqachon bazada bo'lishi mumkin — va ularni
  to'liq tuzatib bo'lmaydi.** Agar `07` §5.8 dagi ikkinchi so'rov bo'sh
  bo'lmasa — **bu allaqachon yuz bergan**: yaroqsiz blok testlar bor, ballari
  hisoblangan, **reytingga kirgan** (§8) va **snapshot'ga muzlatilgan** (§9).

  Snapshot — tarixiy hujjat. Uni qayta hisoblash **tarixni o'zgartirish** demak.
  Ya'ni bu ADR **o'tmishni tuzatmaydi** — u faqat **bugundan** to'g'ri ma'lumot
  yig'ilishini kafolatlaydi. ⚠️ **Nechta? — O'LCHANMAGAN.** Bu ADR bu raqamni
  **to'qib chiqarmaydi**: so'rov `07` §5.8 da tayyor, javob **o'lchov bilan**.

- ⚠️ **Bugun to'g'ri ishlayotgan narsa buziladi.** Alternativa A da o'lchandi:
  `calcDtmTotal` **barcha 1 279 091 vektor uchun to'g'ri**. Ya'ni bu qaror
  **buzuq narsani tuzatmaydi** — u **mo'rt narsani mustahkamlaydi**. Va har
  o'zgarish — yangi bag imkoniyati. Bu — halol savdo, va uni tan olish kerak.

- ⚠️ **`teacher_comment` muammosi hal qilinmaydi — u faqat ochiladi.**
  Blok test tarkibi hozir **izoh maydoniga JSON** qilib tiqiladi
  (`AssessmentsPage.tsx:275`, `@MaxLength(500)`). Bu ADR
  `block_test_subject_answers` jadvalini talab qiladi — **yangi jadval +
  backfill**. Va backfill **taxminiy**: eski JSON'da `m1/m2/m3` **qaysi fan
  ekani yozilmagan** — u `group_subjects` tartibiga tayanadi, ya'ni aynan `07`
  §4.5 dagi **ishonchsiz manba**.

  → `07` §5.8 tavsiyasi: **backfill qilinmasin**, `score` (jami ball — u to'g'ri)
  saqlansin. **Noto'g'ri taqsimotni "aniq" qilib ko'rsatishdan ko'ra, uni yo'q
  deb tan olish halolroq.**

- ⚠️ **`core/` — yangi katalog.** Hozir `apps/api/src/` da faqat `common`,
  `modules`, `prisma` bor. Yangi konvensiya = yangi tushuntirish qarzi. (Kanon
  §8 buzilmaydi — `core/dtm` NestJS moduli emas.)
- ⚠️ **`Decimal` → JSON `string` — buzuvchi o'zgarish.** `averageScore: number`
  → `string`. **48 sahifa** mavjud, qamrovi **o'lchanmagan**. → `core/dtm` ga
  tegishli emas (u allaqachon Decimal), **alohida bosqich**.

- ⚠️ **Bu ADR ochiq savollar ustiga quriladi.** `07` §1.2/§12 da tasdiqlanmagan:
  **matematika bir vaqtda `MAIN` va `MANDATORY` bo'la oladimi?** Hozirgi
  `validateDtmTrack` "5 ta har xil fan" deb faraz qiladi va takror `subjectId`
  ni rad etadi. **Agar javob "ha" bo'lsa — bu kod noto'g'ri** va tekshiruv
  `(subjectId, role)` juftligiga o'tishi kerak. Xuddi shunday: **`MOCK` ham 189
  ballikmi?**

  ⚠️ **Ya'ni bu ADR "Taklif" holatida qolishi — rasmiyatchilik emas.** U
  akademiya xodimidan yoki rasmiy manbadan javob **kutadi**.

## Majburlash

- **Ma'lum vektorlar + property test:** 30/30/10/10/10 → **aniq 189.0**;
  `total ≤ 189.0` **har doim**; `DTM_MAX_BY_ROLE` hisoblangan qiymatga teng —
  ya'ni koeffitsiyent o'zgarsa va maksimal unutilsa, **test yiqiladi** (`07` §10)
- **Regressiya testi:** 1 279 091 vektor — Decimal natijasi float+`Math.round`
  natijasiga teng: **hozirgi to'g'ri xatti-harakat muzlatiladi**.
  **Integratsiya testi:** `POST {type:'BLOCK_TEST', maxScore:500}` → **400**
- **DB (ikkinchi qator):** `track_subjects` partial unique index MAIN/SECONDARY
  uchun. ⚠️ **Avval migratsiya drifti tuzatilsin** (kanon §3 — 1-ustuvorlik)
- **Konstantalar bitta faylda** — `dtm-scoring.constants.ts`, manba havolasi va
  "davlat belgilaydi, testga moslash uchun o'zgartirilmaydi" ogohlantirishi bilan.
  **`dtm_scoring_version` ustuni bugundan** (`07` §11.3): arzon, nullable, va
  **keyin qo'shish eski ma'lumotni qutqara olmaydi**

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| **DTM formati o'zgarsa** | dtm.uz / Vazirlik qarorida yangi taqsimot. ⚠️ **2026 uchun o'zgarmagan — tasdiqlangan** (93+63+33=189, infoedu.uz, oliygoh.uz). O'zgarsa → `DTM_CURRENT_VERSION` bump + `RULESETS` ga yangi yozuv. **Bu ADR bekor bo'lmaydi — u aynan shu holat uchun qurilgan** |
| **Koeffitsiyent 2 kasr xonaga o'tsa** | `3.25` kabi qiymat → **frontend yechimi o'sha kuni jimgina buziladi** (o'lchangan: 2251 holat). Bu — Alternativa A ning **o'limi**, bu ADR ning tasdig'i |
| **Matematika `MAIN` + `MANDATORY` bo'la olsa** | Rasmiy manba tasdiqlasa → `validateDtmTrack` da takror tekshiruvi `(subjectId, role)` ga o'tadi. **Kod o'zgaradi, qaror emas** |
| **Productionda yaroqsiz track topilsa** | `07` §5.8/3b so'rovi **bo'sh bo'lmasa** → majburlash **yoqilmaydi**, avval ma'lumot tuzatiladi yoki `is_dtm_ready` bosqichi qo'shiladi |
| **Yaroqsiz blok test snapshot'ga kirgan bo'lsa** | Ikkinchi so'rov bo'sh bo'lmasa → **akademiya bilan qaror**: tuzatish / bekor qilish / "eski qoida" deb belgilash |
| **Har tenant o'z formulasini sozlashi talab qilinsa** | SaaS yo'lida (kanon §7) mijoz "bizda boshqacha baholash" desa → `RULESETS` (kod) yetarli emas, `dtm_scoring_versions` **jadvali** kerak. ⚠️ Bu **butun qarorni** o'zgartiradi: ruleset kod emas, **tenant ma'lumoti** bo'ladi |
| **Akademiya boshqa imtihonga o'tsa** | IELTS/SAT qo'shilsa → `core/dtm` **umumlashtirilmaydi**, yoniga `core/<exam>` qo'shiladi |

## Havolalar

- [../07-dtm-assessment-engine.md](../07-dtm-assessment-engine.md) — to'liq TZ: `core/dtm` kodi, testlar, migratsiya yo'li (§5.8), Decimal o'lchovi (§6), versiyalash (§11), ochiq savollar (§12)
- [./0002-prisma-extension-for-tenant-isolation.md](./0002-prisma-extension-for-tenant-isolation.md) — "kafolat chetlab o'tib bo'lmaydigan qatlamda" dalilining bir xil shakli
- [../04-data-model.md](../04-data-model.md) — `student_tracks`, `track_subjects`, `SubjectRole` (loyihadagi yagona enum)
- [../08-analytics-and-risk.md](../08-analytics-and-risk.md) — reyting va snapshot: yaroqsiz ball qayerga oqadi
- [../13-testing-strategy.md](../13-testing-strategy.md) — `core/dtm` — testni boshlash uchun eng oson joy
- [`CANON.md`](../CANON.md) §4.1, §3 (migratsiya drifti)
- DTM formati: [infoedu.uz](https://infoedu.uz/maksimal-ball-bu-yil-ham-189-0-boladi) · [oliygoh.uz](https://oliygoh.uz/post/2026-yil-qabulida-maksimal-ball-ozgarmadi-189-ball-boladi)
- Alexis King — "Parse, don't validate"
