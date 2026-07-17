# 08 — Analitika va Xavf Skori

> **Status:** TZ (texnik topshiriq) · **Loyiha:** Ziyo
> **Muallif:** Sarvarbek Sodiqov
> **Kanon:** [`CANON.md`](./CANON.md) § 4.2
>
> ⚠️ **Bu hujjatning eng muhim qismi — 3-bo'lim.** U mavjud xavf skorini tanqid qiladi.
> Tanqid qattiq, lekin u kodni o'qib yozilgan, taxmin qilib emas. Har da'vo ostida
> fayl va qator raqami bor.

---

## Mundarija

1. [Nega analitika bu loyihaning farqi](#1-nega-analitika-bu-loyihaning-farqi)
2. [`student_outcomes` — asosiy KPI](#2-student_outcomes--asosiy-kpi)
3. [⚠️ Xavf skori — halol audit](#3-️-xavf-skori--halol-audit)
4. [Xavf skorini haqiqiy qilish](#4-xavf-skorini-haqiqiy-qilish)
5. [`grade_snapshots` — davriy kesim](#5-grade_snapshots--davriy-kesim)
6. [`student_timeline` — voqealar oqimi](#6-student_timeline--voqealar-oqimi)
7. [Tarix jadvallari](#7-tarix-jadvallari)
8. [Yetishmayotgan analitika](#8-yetishmayotgan-analitika)
9. [Ishlash (performance)](#9-ishlash-performance)
10. [⚠️ Etika](#10-️-etika)
11. [Ochiq savollar](#11-ochiq-savollar)

---

## 1. Nega analitika bu loyihaning farqi

### 1.1. Raqiblar nima qiladi

Kanon § 7 da tekshirilgan bozor konteksti bor: O'zbekistonda o'quv markazlari CRM
bozorida **WeWork** (we-work.uz), **EducationCRM** (educationcrm.uz), **CRM Edu**
(crm-edu.uz), **univ.uz** bor. Ular yaxshi mahsulotlar va o'z ishini qiladi.

Lekin ularning ishi — **operatsion**:

| Ular yozadi | Savol |
|---|---|
| Davomat | "Bugun kim keldi?" |
| To'lov | "Kim qarzdor?" |
| SMS/xabar | "Ota-onaga xabar bordimi?" |
| Guruh, jadval | "Dars qachon?" |

Bularning hammasi **o'tgan zamon** haqida. CRM — buxgalteriya daftarining raqamli
shakli. U **hodisani qayd etadi**.

### 1.2. Bu tizim nima qilishi kerak

`mathacademy` — **yotoqxonali DTM tayyorlov akademiyasi** uchun. Akademiyaning butun
mavjudligi bitta savolga bog'liq:

> **O'quvchi universitetga kirdimi?**

Ota-ona pul to'laydi, bolasini yotoqxonaga beradi, uni bir yil ko'rmaydi — **shu bitta
natija uchun**. Davomat 100% bo'lishi mumkin, to'lov o'z vaqtida bo'lishi mumkin, va
o'quvchi baribir kirmasligi mumkin. Unda CRM'ning barcha yashil raqamlari — yolg'on.

Shuning uchun bu tizim boshqa o'q ustida qurilishi kerak:

```
Operatsion CRM:      hodisa → qayd → hisobot
Bu tizim:            hodisa → qayd → NATIJA bilan bog'lash → keyingi safar bashorat
                                     ↑
                            farq shu yerda
```

Domendagi ikkita jadval bu farqni ifodalaydi:

- **`student_outcomes`** — natija. "Bu o'quvchi qayerga kirdi." Raqiblarda bu **yo'q**,
  chunki kurs markazi o'quvchisining keyingi taqdirini kuzatmaydi.
- **`student_risk_scores`** — bashorat. "Bu o'quvchi kirmasligi mumkin."

⚠️ **Va aynan shu yerda halol bo'lish kerak.** `student_outcomes` — **haqiqiy va
ishlaydi** (2-bo'lim). `student_risk_scores` — **hozircha bashorat emas** (3-bo'lim).
Ya'ni loyihaning asosiy qiymat taklifi **yarim qurilgan**. TZ ning vazifasi — ikkinchi
yarmini qurish.

### 1.3. Nima uchun bu himoyalanadigan afzallik

Raqib bir haftada davomat moduli yozadi. Lekin raqib **beshta yillik natija ma'lumotini
bir haftada yoza olmaydi** — uni kutish kerak. `student_outcomes` to'ldirilgan sari
tizimning qiymati oshadi va uni nusxalash qiyinlashadi.

Bu — texnik afzallik emas, **ma'lumot afzalligi**. Va u faqat natija halol yozilsa
ishlaydi.

---

## 2. `student_outcomes` — asosiy KPI

### 2.1. Real schema

`apps/api/prisma/schema.prisma:825`:

```prisma
model student_outcomes {
  id                 BigInt    @id @default(autoincrement())
  tenant_id          BigInt
  student_id         BigInt    @unique
  outcome_status     String    @default("UNKNOWN") @db.VarChar(30)
  institution_name   String?
  faculty_or_program String?
  decision_date      DateTime? @db.Date
  source             String?
  notes              String?
  created_by_user_id BigInt?
  created_at         DateTime  @default(now()) @db.Timestamptz(6)
  users              users?    @relation(fields: [created_by_user_id], references: [id], onUpdate: NoAction)
  students           students  @relation(fields: [student_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  tenants            tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}
```

### 2.2. `outcome_status` qiymatlari

Kanon § 4.2 da to'rtta qiymat ko'rsatilgan va ular kodda tasdiqlangan —
`apps/api/src/modules/certificates/dto/set-outcome.dto.ts:24`:

```ts
@IsIn(['EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'])
outcomeStatus!: string;
```

| Qiymat | Ma'nosi | Akademiya uchun |
|---|---|---|
| `EARLY_ADMITTED` | Muddatidan oldin kirgan (olimpiada, grant, imtiyoz) | **Eng yaxshi natija** |
| `ON_TIME_ADMITTED` | DTM orqali o'z vaqtida kirgan | Asosiy maqsad |
| `NOT_ADMITTED` | Kirmagan | Muvaffaqiyatsizlik |
| `UNKNOWN` | Ma'lum emas | **Xavfli** — 2.5-bo'limga qara |

`EARLY_ADMITTED` ni alohida ajratish domen jihatidan to'g'ri: olimpiada g'olibi DTM
topshirmaydi, ya'ni uning DTM balli yo'q, lekin u **eng muvaffaqiyatli** o'quvchi.
Agar faqat `ADMITTED/NOT_ADMITTED` bo'lsa, bu ma'lumot yo'qolardi.

### 2.3. Qanday yoziladi

⚠️ **Kutilmagan joyda:** outcome `certificates` modulida boshqariladi, `students` yoki
alohida `outcomes` modulida emas —
`apps/api/src/modules/certificates/certificates.service.ts:472`:

```ts
const outcome = await tx.student_outcomes.upsert({
  where: { student_id },
  update: { outcome_status: args.dto.outcomeStatus, ... },
  create: { tenant_id, student_id, outcome_status: args.dto.outcomeStatus, ... },
  include: { students: { select: { full_name: true } } },
});
```

Buning sababi tarixiy bo'lsa kerak: "sertifikat + kirish natijasi" bitta ekranda
boshqariladi. Ruxsat esa alohida — `seed.ts:144` da `outcomes.read`, `outcomes.write`
mavjud. Ya'ni **ruxsat modeli to'g'ri, modul joylashuvi g'alati**.

**TZ tavsiyasi:** modulni ko'chirmaslik (kanon § 8 — yangi modul qo'shilmaydi, mavjudi
o'zgartirilmaydi). Lekin hujjatlashtirish shart: *"outcome API'si `certificates`
modulida"*. Aks holda keyingi ishlab chiquvchi uni topolmaydi.

### 2.4. Nima ishlaydi

| Imkoniyat | Fayl | Holat |
|---|---|---|
| Outcome yozish/yangilash | `certificates.service.ts:472` | ✅ |
| Ro'yxat + filtr | `certificates.service.ts:535` | ✅ |
| Bitta o'quvchi outcome'i | `certificates.service.ts:593` | ✅ |
| O'chirish | `certificates.service.ts:642` | ✅ |
| Statistika (`groupBy outcome_status`) | `certificates.service.ts:689` | ✅ |
| Kohort kesimida outcome | `cohorts.service.ts:239` | ✅ |
| Ota-ona ko'rishi | `guardian-student.controller.ts:676` | ✅ |
| Audit | `certificates.service.ts:504` | ✅ |

Ya'ni **asos bor va ishlaydi**. Bu 4-bo'lim uchun eng muhim fakt: backtesting uchun
kerak bo'lgan tarixiy natija ma'lumoti **allaqachon yig'ilyapti**.

### 2.5. Muammolar

#### (a) `student_id @unique` — o'quvchi umri davomida bitta outcome

`schema.prisma:828` da `student_id BigInt @unique`. Bu **1:1 munosabat**. Natijada:

- O'quvchi 11-sinfda kirmadi (`NOT_ADMITTED`), keyingi yil qayta o'qib kirdi
  (`ON_TIME_ADMITTED`) → **birinchi natija o'chib ketadi** (`upsert` uni ustiga yozadi).
- Backtesting uchun bu yo'qotish: "qayta topshirgan" — bu o'z-o'zidan qimmatli signal.

#### (b) Akademik yil bog'lanishi yo'q

`student_outcomes` da `academic_year_id` **yo'q**. "O'tgan yilga nisbatan kirish foizi
qanday?" savoliga javob berish uchun bilvosita yo'l kerak:
`students.expected_graduation_year` (`schema.prisma:913`) yoki
`cohorts.graduation_year`. Ikkalasi ham **prognoz maydoni**, faktik bitiruv yili emas.
8-bo'limda batafsil.

#### (c) `updated_at` yo'q, tarix yo'q

`upsert` (`certificates.service.ts:472`) eski qiymatni **jimgina** almashtiradi.
`created_at` bor, `updated_at` yo'q. "Bu o'quvchi avval `UNKNOWN` edi, qachon
`ON_TIME_ADMITTED` bo'ldi?" — javob faqat `audit_logs` da (u yerda `afterData` yoziladi,
`certificates.service.ts:511`). Ya'ni tiklash mumkin, lekin so'rov qilib bo'lmaydi.

#### (d) ⚠️ `outcome_status` — `String @db.VarChar(30)`, enum EMAS

**Bu — 4-bo'limning oldingi sharti (precondition), keyingi yaxshilanish emas.**
Sababi 2.5d-4 da.

**O'lchangan fakt:** butun sxemada **atigi 1 ta enum** bor:

```
grep -c "^enum " apps/api/prisma/schema.prisma
→ 1
```

Va u — `SubjectRole` (`schema.prisma:979`, MAIN/SECONDARY/MANDATORY). **69 model, 1
enum.** Qolgan hamma tasniflovchi ustun — string:

| Ustun | Tur | Fayl |
|---|---|---|
| `student_outcomes.outcome_status` | `VarChar(30)` | `schema.prisma:829` |
| `student_risk_scores.level` | `VarChar(10)` | `schema.prisma:848` |
| `students.status` | `VarChar(20)` | `schema.prisma:914` |
| `grade_snapshots.period_type` | `VarChar(10)` | `schema.prisma:483` |
| `grade_snapshot_rows.risk_level` | `VarChar(10)` | `schema.prisma:472` |
| `student_timeline.event_type` | `String` (cheklovsiz!) | `schema.prisma:875` |

Ya'ni bu **bitta ustunning xatosi emas, tizimli naqsh**. Lekin `outcome_status` —
**eng muhimi**, chunki u **KPI** va u **ground truth**.

##### (d-1) Yagona himoya — DTO

Validatsiya faqat `set-outcome.dto.ts:28` da:

```ts
@IsIn(['EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'])
outcomeStatus!: string;
```

Baza darajasida **hech narsa yo'q**. `outcome_status = 'kirdi'` yoki `''` yoki
`'ADMITTED'` — Postgres qabul qiladi. DTO'ni chetlab o'tadigan **har qanday** yo'l
himoyasiz:

- `seed.ts`
- migratsiya
- qo'lda SQL (`psql`)
- kelajakda yoziladigan yangi endpoint yoki bulk import
- `prisma studio`

##### (d-2) ⚠️ Bu ALLAQACHON bir marta buzilgan — `a3dab30`

Git tarixida real hodisa bor. Commit `a3dab30` ("fix: production bugs — ... certificates
outcomeStatus ..."), `apps/web/src/pages/staff/CertificatesPage.tsx`:

```diff
-    outcomeType: 'UNIVERSITY_ADMIT',
+    outcomeStatus: 'ON_TIME_ADMITTED',
-      outcomeType: outcomeForm.outcomeType,
+      outcomeStatus: outcomeForm.outcomeStatus,
-                const typeInfo = OUTCOME_TYPES[outcome.outcomeType] || OUTCOME_TYPES.UNKNOWN;
+                const typeInfo = OUTCOME_TYPES[outcome.outcomeStatus] || OUTCOME_TYPES.UNKNOWN;
```

Ya'ni frontend **butunlay boshqa lug'at** ishlatgan: maydon `outcomeType` (`outcomeStatus`
emas), qiymat `UNIVERSITY_ADMIT` (`ON_TIME_ADMITTED` emas). Ikki qatlam **bir-birini
tushunmagan** va bu **production'da** aniqlangan.

⚠️ **Halol nuans — koordinator versiyasini aniqlashtiraman.** Bu holatda maydon nomi
noto'g'ri bo'lgani uchun `outcomeStatus` `undefined` bo'lardi → `@IsIn` **rad etardi**
→ 400. Ya'ni **DTO ishladi va iflos qiymat bazaga tushmadi**. Bu — DTO foydasiga dalil.

**Lekin xulosa aynan teskari va u kuchliroq:**

> `UNIVERSITY_ADMIT` degan lug'at loyihada **real mavjud edi** va uni **faqat DTO**
> to'xtatdi. Agar o'sha paytda kimdir `outcomeStatus: 'UNIVERSITY_ADMIT'` deb
> **to'g'ri maydon nomi bilan** yozganida — yoki uni `seed.ts` ga qo'yganida — u
> **bugun bazada bo'lardi**, va hech narsa xato bermasdi.

Ya'ni bu safar **omad kelgan**. Omad — arxitektura emas.

##### (d-3) Oqibat — KPI jimgina noto'g'ri bo'ladi

`certificates.service.ts:689` — asosiy KPI so'rovi:

```ts
const outcomeStats = await this.prisma.student_outcomes.groupBy({
  by: ['outcome_status'],
  where: { tenant_id, ... },
  _count: { outcome_status: true },
});
```

`GROUP BY` — **satrlarni aynan** solishtiradi. Agar bazada `ON_TIME_ADMITTED` va
`UNIVERSITY_ADMIT` aralash bo'lsa:

```
ON_TIME_ADMITTED   → 120
UNIVERSITY_ADMIT   →  45      ← yangi guruh. Hech kim buni "kirgan" deb sanamaydi
NOT_ADMITTED       →  30
```

Va `certificates.service.ts:723` dagi reduce ularni `byStatus` ob'ektiga solib
qaytaradi. Frontend `OUTCOME_TYPES[...]` bo'yicha map qiladi va topa olmasa —
**jimgina tushirib qoldiradi yoki `UNKNOWN` deb ko'rsatadi**.

⚠️ **Hech qanday xato yuzaga chiqmaydi.** Akademiya "165 kirdi" o'rniga "120 kirdi"
ni ko'radi va bu **yolg'onni haqiqat deb qabul qiladi**.

##### (d-4) ⚠️ Nima uchun bu 4-bo'limdan OLDIN qilinadi

4-bo'lim `student_outcomes` ni **ground truth** (haqiqat manbai) sifatida ishlatadi:
backtest og'irliklarni aynan shu label'larga qarab sozlaydi
(`risk-backtest.service.ts` da `actual: s.student_outcomes!.outcome_status === 'NOT_ADMITTED'`).

Agar label iflos bo'lsa:

```
'UNIVERSITY_ADMIT' → 'NOT_ADMITTED' EMAS → actual = false
                   → lekin 'ON_TIME_ADMITTED' ham emas
                   → o'quvchi "kirmagan"lar qatoriga ham, "kirgan"lar qatoriga ham
                     tushmaydi... yoki filtrga ko'ra noto'g'ri tushadi
```

**Va buni hech kim sezmaydi** — model o'rganadi, metrika chiqadi, raqam ishonarli
ko'rinadi. **Iflos label ustiga qurilgan model — jimgina noto'g'ri model.** Bu
dasturlashdagi eng qimmat xato turi: xato bermaydi, natija beradi, va natija yolg'on.

> **Qoida: label toza bo'lmaguncha, skor qurilmaydi.**
> Tartib: **(1) enum → (2) backtest → (3) skor.** Teskarisi emas.

##### (d-5) Migratsiya — ⚠️ tartib muhim

**Bir qadamda qilib bo'lmaydi.** Agar bazada yaroqsiz qiymat bo'lsa, migratsiya
**yiqiladi**. Shuning uchun: **avval audit, keyin tozalash, keyin enum.**

**Qadam 1 — real holatni ko'rish (migratsiya emas, shunchaki so'rov):**

```sql
-- ⚠️ BIRINCHI shu ishga tushiriladi. Natijasiz keyingi qadamga o'tilmaydi.
SELECT outcome_status, count(*) AS n
FROM student_outcomes
GROUP BY outcome_status
ORDER BY n DESC;
```

Kutilgan natija — faqat to'rtta ma'lum qiymat. **Lekin bu tekshirilmagan taxmin.**
Agar `UNIVERSITY_ADMIT`, `''`, `'ADMITTED'` yoki `NULL` chiqsa — 2-qadam kerak.

**Qadam 2 — tozalash (faqat 1-qadam yaroqsiz qiymat topsa):**

⚠️ Bu **ma'lumot yo'qotadigan qaror** va uni **akademiya tasdiqlaydi**, muhandis emas.
`'UNIVERSITY_ADMIT'` → `'ON_TIME_ADMITTED'` mi yoki `'EARLY_ADMITTED'` mi — **buni
faqat akademiya biladi**. Noaniq bo'lsa → `'UNKNOWN'` (yolg'on aniqlikdan yaxshi).

```sql
-- Har bir map alohida tasdiqlanadi. Bu shablon, ko'r-ko'rona ishlatilmaydi.
UPDATE student_outcomes SET outcome_status = 'ON_TIME_ADMITTED'
  WHERE outcome_status IN ('UNIVERSITY_ADMIT', 'ADMITTED');
UPDATE student_outcomes SET outcome_status = 'UNKNOWN'
  WHERE outcome_status IS NULL OR btrim(outcome_status) = '';
UPDATE student_outcomes SET outcome_status = upper(btrim(outcome_status));
```

**Qadam 3 — tekshirish (bo'sh qaytishi SHART):**

```sql
SELECT DISTINCT outcome_status FROM student_outcomes
WHERE outcome_status NOT IN ('EARLY_ADMITTED','ON_TIME_ADMITTED','NOT_ADMITTED','UNKNOWN');
-- 0 qator qaytmasa — 4-qadam YIQILADI
```

**Qadam 4 — enum (`schema.prisma`):**

```prisma
enum OutcomeStatus {
  EARLY_ADMITTED
  ON_TIME_ADMITTED
  NOT_ADMITTED
  UNKNOWN
}

model student_outcomes {
  ...
  outcome_status OutcomeStatus @default(UNKNOWN)   // ⚠️ String @db.VarChar(30) EMAS
  ...
}
```

Prisma generatsiya qiladigan migratsiya (`prisma migrate dev --name outcome_status_enum`):

```sql
-- migration: 000002_outcome_status_enum
CREATE TYPE "OutcomeStatus" AS ENUM (
  'EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'
);

ALTER TABLE "student_outcomes"
  ALTER COLUMN "outcome_status" DROP DEFAULT,
  ALTER COLUMN "outcome_status" TYPE "OutcomeStatus"
    USING "outcome_status"::"OutcomeStatus",          -- ⚠️ 3-qadam o'tmasa shu yerda yiqiladi
  ALTER COLUMN "outcome_status" SET DEFAULT 'UNKNOWN';
```

⚠️ **`ALTER TYPE` — jadvalni to'liq qayta yozadi va `ACCESS EXCLUSIVE` lock oladi.**
`student_outcomes` kichik (bir necha yuz qator) → soniyalar. Lekin bu **deploy oynasida**
qilinadi, ish vaqtida emas.

⚠️ **Kod ta'siri:** `Prisma.student_outcomesWhereInput` da `outcome_status` endi
`OutcomeStatus` turi. `certificates.service.ts:475,488` (`args.dto.outcomeStatus` —
`string`) **kompilyatsiya xatosi beradi**. Bu — **yaxshi**: TypeScript har bir
tegilishi kerak joyni ko'rsatadi. DTO ham yangilanadi:

```ts
// set-outcome.dto.ts
import { OutcomeStatus } from '@prisma/client';

@ApiProperty({ enum: OutcomeStatus, example: OutcomeStatus.ON_TIME_ADMITTED })
@IsEnum(OutcomeStatus)                    // @IsIn([...]) o'rniga — yagona manba
outcomeStatus!: OutcomeStatus;
```

Endi lug'at **bitta joyda** (`schema.prisma`) yashaydi va Swagger, DTO, DB, TypeScript
— hammasi **avtomatik mos**. `a3dab30` turidagi bag **tuzilish jihatidan imkonsiz**
bo'ladi.

##### (d-6) Qolgan string ustunlar

`outcome_status` — birinchi, chunki KPI. Qolganlari uchun **bir xil naqsh**, lekin
har biri alohida qaror:

| Ustun | Tavsiya | Nega |
|---|---|---|
| `student_risk_scores.level` | ⚠️ **Kutish** | 3.6a `NOT_ASSESSED` qo'shadi — avval u hal bo'lsin |
| `students.status` | Enum | Ko'p joyda `status: 'ACTIVE'` string solishtiruv |
| `grade_snapshots.period_type` | Enum yoki CHECK | 5.4b — idempotentlikni buzyapti |
| `student_timeline.event_type` | CHECK (6.5) | Enum juda qattiq — yangi voqea turi tez-tez qo'shiladi |

⚠️ **69 modelni birdan enum'ga o'tkazish TAKLIF QILINMAYDI** (kanon § 10: mavjud kodni
butunlay qayta yozish taklif qilinmaydi). Har enum — migratsiya + lock + kod
o'zgarishi. Ustuvorlik: **KPI va ground truth avval, qolgani ehtiyojga qarab.**

#### (e) ⚠️ `UNKNOWN` — eng katta xavf

`outcome_status` default'i `UNKNOWN` (`schema.prisma:829`). Va outcome yozish
**qo'lda**. Ya'ni:

> Agar xodim outcome yozishni unutsa, o'quvchi abadiy `UNKNOWN` bo'lib qoladi.

Bu shunchaki bo'sh katak emas. Bu **butun analitikani buzadi**, chunki `UNKNOWN`
tasodifiy taqsimlanmaydi:

- Kirgan o'quvchi o'zi qo'ng'iroq qiladi, rasm yuboradi, akademiya uni reklamada
  ishlatadi → **yoziladi**
- Kirmagan o'quvchi aloqani uzadi → **yozilmaydi** → `UNKNOWN`

Natijada `UNKNOWN` guruhida `NOT_ADMITTED` nomutanosib ko'p bo'ladi. Bu klassik
**survivorship bias**. Agar `UNKNOWN` ni hisobdan chiqarib "kirish foizi" hisoblansak,
raqam **haqiqatdan yuqori** chiqadi — akademiya o'zini o'zi aldaydi.

**TZ talabi — outcome to'liqligi (completeness) o'lchanadi va ko'rsatiladi:**

```ts
// certificates.service.ts:689 dagi getStats() ga qo'shiladi
// Bitiruv yiliga kirgan o'quvchilar bo'yicha qamrov
const cohortSize = await this.prisma.students.count({
  where: { tenant_id, expected_graduation_year: year, archived_at: null },
});
const known = await this.prisma.student_outcomes.count({
  where: {
    tenant_id,
    outcome_status: { not: 'UNKNOWN' },
    students: { expected_graduation_year: year },
  },
});

return {
  outcomes: { ... },
  // ⚠️ Har qanday kirish foizi shu raqam bilan birga ko'rsatiladi
  coverage: {
    cohortSize,
    known,
    unknown: cohortSize - known,
    coveragePct: cohortSize > 0 ? Math.round((known / cohortSize) * 1000) / 10 : 0,
  },
};
```

**Qoida:** agar `coveragePct < 80` — UI kirish foizini **raqam sifatida ko'rsatmaydi**,
o'rniga "Ma'lumot yetarli emas (qamrov: X%)" deb yozadi. Chunki 40% qamrov ustiga
qurilgan "92% kirish" — yolg'on, va u qaror qabul qilish uchun ishlatiladi.

> 80% chegarasi — **taklif, isbot emas**. Uni akademiya rahbari bilan kelishish kerak.
> Muhimi chegara raqami emas, **qamrov ko'rsatilishi** faktidir.

---

## 3. ⚠️ Xavf skori — halol audit

> Bu bo'lim `apps/api/src/modules/risk/` ning to'liq o'qilishi natijasi. Modul kichik:
> `risk.service.ts` (341 qator), `risk.controller.ts` (123), `risk.module.ts` (11),
> `dto/set-risk.dto.ts` (35), `dto/list-risk.query.dto.ts` (46).

### 3.1. Asosiy topilma — `risk tracking`, `risk detection` EMAS

**Xavf skori hisoblanmaydi. U qo'lda kiritiladi.**

Bu — hujjatning markaziy fakti, shuning uchun uni eng aniq shaklda qo'yaman:

```
risk DETECTION (tizim aniqlaydi):
  ma'lumot → funksiya → xulosa → saqlash
             ^^^^^^^^
             tizim shu yerda O'YLAYDI

risk TRACKING (tizim saqlaydi):        ← mathacademy BUGUN shu
  odam o'ylaydi → HTTP body → saqlash
                              ^^^^^^^
                              tizim shu yerda FAQAT DAFTAR
```

> **Tizim "bu o'quvchi xavfda" degan xulosani CHIQARMAYDI.**
> **U kimdir chiqargan xulosani SAQLAYDI.**

Bu farq butun 3-bo'limni belgilaydi. Va u savollarning o'zini o'zgartiradi:

| Boshlang'ich savol | Kod o'qilgandan keyin |
|---|---|
| "Skor qanday hisoblanadi?" | ⚠️ **Hisoblanmaydi.** Savol predmetsiz |
| "Og'irliklar qayerdan olingan?" | ⚠️ **Og'irlik yo'q**, chunki formula yo'q |
| "33/66 chegarasi asoslanganmi?" | ⚠️ Ular **qo'lda kiritilgan sonni rangga aylantiradi**. `levelFromScore` — sof **ko'rsatish (presentation)** funksiyasi, tasnif emas |
| "Skor validatsiya qilinganmi?" | ⚠️ **Savol ma'nosini yo'qotadi.** Bashorat yo'q → bashorat aniqligi ham yo'q |

⚠️ **Muhim: bu "modul yomon yozilgan" degani EMAS.** `risk` moduli o'z ishini
**to'g'ri bajaradi**: tenant izolyatsiyasi bor, audit bor, RBAC bor, tarix saqlanadi
(`create`, `update` emas), pagination bor. **Daftar sifatida u yaxshi daftar.**

Muammo — kodda emas, **da'voda**. Modul `risk`, jadval `student_risk_scores`, funksiya
`levelFromScore`, ustun `calculated_at`, ustun `signals` — bularning **hammasi**
hisoblash va bashorat tilida gapiradi. Kod esa buni bajarmaydi. **Nomlar va'da beradi,
implementatsiya bermaydi.**

Va bu — eng xavfli holat: `calculated_at` (`schema.prisma:846`) ustunini ko'rgan
har qanday odam "demak, kimdir hisoblagan" deb o'ylaydi. Aslida u — `new Date()`
(`risk.service.ts:70`), ya'ni **"kiritilgan vaqt"**.

### 3.1.1. Isbot — kod

`risk.service.ts` da hisoblash funksiyasi **yo'q**. Skorni yaratadigan yagona joy —
`setRisk()`, `risk.service.ts:58-72`:

```ts
const score = args.dto.score;          // ← xodim kiritgan son. Hammasi shu.
const level = levelFromScore(score);
const signals = { manual: true, note: args.dto.note || null };

const riskScore = await this.prisma.student_risk_scores.create({
  data: {
    tenant_id,
    student_id,
    score,
    level,
    signals: JSON.stringify(signals),
    note: args.dto.note?.trim() || null,
    calculated_at: new Date(),
  },
});
```

`args.dto.score` qayerdan keladi — `dto/set-risk.dto.ts:20-25`:

```ts
@ApiProperty({ example: 72, description: 'Risk score (0–100)' })
@Type(() => Number)
@IsInt()
@Min(0)
@Max(100)
score!: number;
```

Ya'ni skor — **HTTP body'dagi butun son**. Yagona tekshiruv: 0 ≤ score ≤ 100.

Frontend buni yashirmaydi ham — `apps/web/src/pages/staff/RiskPage.tsx:185`:

```tsx
description="O'quvchi uchun qo'lda risk ballini kiriting yoki o'zgartiring"
```

Va `RiskPage.tsx:26` — boshlang'ich qiymat `'50'`, oddiy `<Input type="number">`
(`RiskPage.tsx:213`).

### 3.2. Skor qanday hisoblanadi?

**Hech qanday.** Batafsil:

| Signal | Jadval mavjudmi? | `risk.service.ts` uni o'qiydimi? |
|---|---|---|
| Davomat | ✅ `attendance_marks`, `attendance_sessions` | ❌ **Yo'q** |
| Baho / test natijasi | ✅ `assessment_scores`, `assessments` | ❌ **Yo'q** |
| Intizom | ✅ `violations`, `discipline_actions` | ❌ **Yo'q** |
| To'lov | ✅ `invoices`, `dorm_student_charges`, `meal_student_charges` | ❌ **Yo'q** |
| Ruxsatnoma (leave) | ✅ `leave_requests` | ❌ **Yo'q** |
| Reyting dinamikasi | ✅ `grade_snapshot_rows` | ❌ **Yo'q** |

`risk.service.ts` da import qilingan yagona ma'lumot manbalari: `students`,
`student_risk_scores`, `groups`, `student_accounts`. Ya'ni **birorta ham xavf signali
o'qilmaydi**.

`signals` maydoni bor (`schema.prisma:849`), lekin unga har doim bir xil narsa
yoziladi (`risk.service.ts:60`):

```ts
const signals = { manual: true, note: args.dto.note || null };
```

Ya'ni `signals` — signallar ro'yxati emas, **"bu qo'lda kiritilgan" degan bayroq**.
Maydon nomi va mazmuni mos emas. Har bir yozuvda `{"manual":true,...}` takrorlanadi.

### 3.3. Og'irliklar (weights) qayerdan olingan?

**Og'irlik yo'q, chunki formula yo'q.**

`risk.service.ts` da birorta ko'paytiruvchi, koeffitsient, `weight` o'zgaruvchisi yo'q.
Grep bilan tekshirildi — modulda `weight` so'zi **umuman uchramaydi**.

Ya'ni "og'irliklar asoslanganmi yoki taxminmi?" savoli **noto'g'ri qo'yilgan**. To'g'ri
javob: og'irliklar mavjud emas. Butun skor — bitta xodimning **subyektiv fikri**, 0–100
oralig'iga siqilgan.

Bu hatto taxmin ham emas. Taxmin — bu qandaydir qoida. Bu esa — **fikr**.

### 3.4. `levelFromScore`: 33 va 66 qayerdan?

`risk.service.ts:22-26`:

```ts
function levelFromScore(score: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (score <= 33) return 'GREEN';
  if (score <= 66) return 'YELLOW';
  return 'RED';
}
```

**Javob: 0–100 ni uchga bo'lgan.** 100/3 ≈ 33.3, 200/3 ≈ 66.7. Kodda izoh yo'q,
konfiguratsiya yo'q, hech qanday asos yo'q.

Bu **butunlay ixtiyoriy**. Buni ko'rsatish oson:

- `score = 33` → GREEN, `score = 34` → YELLOW. Farq — 1 ball. Xodim `<Input>` ga
  kiritgan 1 ball.
- Agar xodim "o'rtacha" deb o'ylab 50 yozsa → YELLOW. 30 yozsa → GREEN. Ikkalasi ham
  bir xil fikrni anglatishi mumkin edi.

Chegara ixtiyoriy bo'lishi **o'z-o'zidan yomon emas** — har qanday tasnif chegarasi
biror joydan boshlanadi. Yomoni: **chegara ixtiyoriy, va uning ostidagi skor ham
ixtiyoriy**. Ikkita ixtiyoriylik ustma-ust.

Yana bir muammo: **chegara kodda qattiq yozilgan**. Agar backtesting (4-bo'lim)
"RED chegarasi 66 emas, 58 bo'lishi kerak" desa — buning uchun **kodni o'zgartirib
qayta deploy qilish** kerak. Chegara `system_settings` (`schema.prisma:968`) da
bo'lishi kerak edi.

Va **uchinchi joyda takrorlangan** — `RiskPage.tsx:76,81,206`:

```tsx
i.score > 66 ? 'text-destructive' : i.score > 33 ? 'text-warning' : 'text-success'
```

Frontend backend'ning `level` maydonini ishlatmaydi, **o'zi qayta hisoblaydi**. Hozir
raqamlar mos, lekin bitta joyda o'zgartirsa — ikkinchisi jimgina noto'g'ri rang
ko'rsatadi.

### 3.5. ⚠️ Eng muhim savol: skor validatsiya qilinganmi?

**Yo'q. Umuman.**

Kod bo'ylab tekshirildi: `student_risk_scores` va `student_outcomes` ni **bir so'rovda
birlashtirgan birorta joy yo'q**. Ya'ni:

- Hech kim "RED bo'lgan o'quvchilar haqiqatan ko'proq `NOT_ADMITTED` bo'ldimi?" deb
  so'ramagan.
- Bu savolga javob beradigan endpoint yo'q.
- Test yo'q (kanon § 3: butun loyihada 1 ta placeholder test).

**Xulosa — halol formulasi:**

> Xavf skori — bashorat emas. U hatto evristika ham emas.
> U — **xodimning fikri, ma'lumotlar bazasiga yozilgan**.
> Uning bashorat qiluvchi kuchi **noma'lum** — nol emas, **o'lchanmagan**.

Bu farq muhim. Tajribali o'qituvchining fikri **juda qimmatli** bo'lishi mumkin —
u bolani har kuni ko'radi. Muammo fikrda emas, **fikrni tekshirilgan model sifatida
ko'rsatishda**.

### 3.5.1. ⚠️ Va skorni KIM qo'ygani ham yozilmaydi

Bu — 3.1 ning to'g'ridan-to'g'ri davomi va u vaziyatni **ancha yomonlashtiradi**.

**O'lchangan fakt** — `schema.prisma:842-853`, to'liq model:

```prisma
model student_risk_scores {
  id            BigInt   @id @default(autoincrement())
  tenant_id     BigInt
  student_id    BigInt
  calculated_at DateTime @default(now()) @db.Timestamptz(6)
  score         Int
  level         String   @db.VarChar(10)
  signals       String?
  note          String?
  students      students @relation(...)
  tenants       tenants  @relation(...)
}
```

**`created_by_user_id` YO'Q.** Taqqoslash uchun — qo'shni modellarda u **bor**:

| Model | `created_by_user_id` | Fayl |
|---|---|---|
| `student_outcomes` | ✅ bor | `schema.prisma:835` |
| `student_timeline` | ✅ bor | `schema.prisma:878` |
| `student_group_history` | ✅ `changed_by_user_id` | `schema.prisma:793` |
| `student_living_history` | ✅ `changed_by_user_id` | `schema.prisma:816` |
| `students` | ✅ bor | `schema.prisma:918` |
| **`student_risk_scores`** | ❌ **YO'Q** | `schema.prisma:842` |

Ya'ni bu **konvensiyadan chetga chiqish**, tizimli tanlov emas. Va u ehtimol
**tasodifiy** — chunki jadval "hisoblanadi" deb o'ylab loyihalangan. Hisoblangan
skorning muallifi yo'q, tizim uni yaratadi. Lekin **hisoblash yozilmagan** va
qo'lda kiritish qolgan. Natijada: **muallifsiz qo'lda baho**.

**Eng ochiq isbot** — `risk.service.ts:47-49` da o'zgaruvchi **hisoblanadi**:

```ts
const created_by_user_id = args.userId
  ? toBigInt(args.userId, 'userId')
  : null;
```

Lekin `create` chaqiruvida (`risk.service.ts:62-72`) u **ishlatilmaydi**:

```ts
const riskScore = await this.prisma.student_risk_scores.create({
  data: {
    tenant_id,
    student_id,
    score,
    level,
    signals: JSON.stringify(signals),
    note: args.dto.note?.trim() || null,
    calculated_at: new Date(),
    // ⚠️ created_by_user_id shu yerda YO'Q — o'zgaruvchi hisoblangan, lekin tashlab yuborilgan
  },
});
```

U faqat 12 qator pastda, audit log'ga uzatiladi (`risk.service.ts:77`):

```ts
await this.auditLogger.log({
  tenantId: tenant_id,
  actorType: 'STAFF',
  actorUserId: created_by_user_id,     // ← yagona ishlatilishi
  ...
});
```

**Nima uchun audit yetarli emas:**

1. **So'rov qilib bo'lmaydi.** "Bu o'qituvchi qo'ygan skorlar qanchalik aniq?" —
   `audit_logs` va `student_risk_scores` ni `entity_id` orqali join qilish kerak. Bu
   ishlaydi, lekin `audit_logs` — o'sib boradigan, arxivlanadigan jadval. Analitika
   uchun manba emas.
2. **Audit tozalanishi mumkin.** Retention siyosati bo'lsa (hozir yo'q, lekin
   bo'lishi kerak) — skor qoladi, muallifi **yo'qoladi**.
3. **UI ko'rsata olmaydi.** `listRisk` (`risk.service.ts:147`) qaytaradigan ob'ektda
   muallif **yo'q**. Ya'ni `RiskPage` da "Aziz — RED, 78" ko'rinadi, **kim qo'ygani
   ko'rinmaydi**.

**Yig'ib aytganda:**

> Bu — **subyektiv baho**, **validatsiya qilinmagan**, **muallifi yozilmagan**, va
> u **bolaning ota-onasiga ko'rsatiladi** (10.3).

To'rt xususiyat alohida ham muammo. Birga — **javobgarlikning to'liq yo'qligi**.
Bola RED, hech kim buni tushuntirib bera olmaydi, va hech kim buni **yozmagan**.

**TZ talabi — migratsiya (arzon va zudlik bilan):**

```prisma
model student_risk_scores {
  ...
  note               String?
  created_by_user_id BigInt?           // ⚠️ QO'SHILADI — qo'shni modellar bilan bir xil
  users              users?   @relation(fields: [created_by_user_id], references: [id], onUpdate: NoAction)
  ...
}
```

```sql
-- migration: 000007_risk_score_author
ALTER TABLE student_risk_scores ADD COLUMN created_by_user_id BIGINT;
ALTER TABLE student_risk_scores
  ADD CONSTRAINT student_risk_scores_created_by_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON UPDATE NO ACTION;
```

⚠️ **`NULL` bo'lishi shart** (`BigInt?`) — mavjud skorlarning muallifi **noma'lum va
uni tiklab bo'lmaydi** (audit'dan backfill mumkin, lekin bu alohida ish va
kafolatsiz). `NULL` = "muallif noma'lum" va bu **halol**. `0` yoki admin ID qo'yish —
ma'lumotni to'qish bo'lardi.

Kod o'zgarishi — **bir qator** (`risk.service.ts:62` `data` bloki):

```ts
data: {
  tenant_id,
  student_id,
  score,
  level,
  signals: JSON.stringify(signals),
  note: args.dto.note?.trim() || null,
  calculated_at: new Date(),
  created_by_user_id,          // ✅ allaqachon :47 da hisoblangan
},
```

Va `listRisk` (`risk.service.ts:147`) muallifni qaytaradi. UI'da: **"RED (78) — Nodira
Karimova, 12-mart"**. Skorni **odam qo'ygani ko'rinib tursin** — bu 3.1 dagi halollikni
UI darajasiga olib chiqadi.

### 3.6. Yana beshta topilma

Bular kodni o'qishda chiqdi va ular skorni yanada ishonchsiz qiladi.

#### (a) ⚠️ Skorlanmagan o'quvchi jimgina GREEN bo'ladi

Uch joyda bir xil xato — `risk.service.ts:214`:

```ts
level: s.student_risk_scores[0]?.level ?? 'GREEN',   // skor yo'q → GREEN
```

`risk.service.ts:330`:

```ts
const level = s.student_risk_scores[0]?.level || 'GREEN';
if (level === 'RED') summary.high++;
else if (level === 'YELLOW') summary.medium++;
else summary.low++;                                   // skor yo'q → low
```

`ranking.service.ts:79`:

```sql
COALESCE(lr.level, 'GREEN') AS risk_level
```

**Nima uchun bu jiddiy:** skor **qo'lda** kiritiladi. Ya'ni ko'pchilik o'quvchida skor
**umuman yo'q**. Va ular hammasi **GREEN** ko'rinadi.

Natija: dashboard'dagi `getRiskSummary` (`risk.service.ts:311`) "low: 240, medium: 8,
high: 3" deb ko'rsatishi mumkin — va 240 ning 235 tasi shunchaki **hech kim
qaramagan** o'quvchilar.

Bu — **xavf tizimida mumkin bo'lgan eng yomon xato turi**. Tizim "hammasi joyida"
deydi, aslida "men bilmayman" degani. Va u aynan **e'tiborsiz qolgan** o'quvchini
yashiradi — ya'ni haqiqatan xavf ostidagini.

**TZ talabi:** `NOT_ASSESSED` (yoki `null`) — GREEN'dan **alohida** holat bo'lishi
shart, UI'da kulrang. Bu **kod o'zgarishi, migratsiya emas** — `level` allaqachon
`String @db.VarChar(10)`.

```ts
// risk.service.ts:210 — tavsiya etilgan ko'rinish
const data = students.map((s) => ({
  studentId: s.id.toString(),
  studentName: s.full_name,
  score: s.student_risk_scores[0]?.score ?? null,
  level: s.student_risk_scores[0]?.level ?? 'NOT_ASSESSED',  // ❗ GREEN emas
  calculatedAt: s.student_risk_scores[0]?.calculated_at ?? null,
}));
```

`getRiskSummary` ham to'rtinchi hisobni qaytaradi:
`{ low, medium, high, notAssessed }`. Rahbariyat "3 ta RED" o'rniga "3 ta RED va 235 ta
qaralmagan" ni ko'rishi kerak.

#### (b) Ikkita mustaqil xavf ta'rifi

`ranking.service.ts:66-79` da `grade_snapshot_rows.risk_level` **oxirgi qo'lda kiritilgan
skordan** ko'chiriladi:

```sql
latest_risk AS (
  SELECT DISTINCT ON (student_id) student_id, level
  FROM student_risk_scores
  WHERE tenant_id = ${tenantId}
  ORDER BY student_id, calculated_at DESC, id DESC
),
ranked AS (
  SELECT t.student_id, t.total_score,
    DENSE_RANK() OVER (ORDER BY t.total_score DESC) AS rank,
    COALESCE(lr.level, 'GREEN') AS risk_level
  FROM totals t
  LEFT JOIN latest_risk lr ON lr.student_id = t.student_id
)
```

Ya'ni snapshot'dagi `risk_level` — **snapshot davriga tegishli emas**. U snapshot
**yaratilgan paytdagi** oxirgi skor. Agar 2025-yanvar davri uchun snapshot 2025-iyunda
yaratilsa — yanvar qatoriga **iyundagi** xavf darajasi yoziladi.

Bu ma'lumotni buzadi: `grade_snapshot_rows` "3 oy oldin qanday edi" uchun mo'ljallangan
(5-bo'lim), lekin `risk_level` ustuni bu va'dani bajarmaydi.

#### (c) ⚠️ Reyting IKKI XIL hisoblanadi — uchta mustaqil farq

Bu xavf skoridan tashqarida, lekin **butun analitika ishonchliligiga** tegadi va u
5-bo'limning (`grade_snapshots`) poydevorini buzadi.

Bitta domen tushunchasi — "o'quvchining reytingi" — **ikki marta, ikki tilda, ikki
xil** yozilgan:

| | **Snapshot** (SQL, `ranking.service.ts:39-85`) | **Jonli reyting** (JS, `ranking.service.ts:152-182`) |
|---|---|---|
| Yig'ish | `SUM(...)` — **yig'indi** (`:47`) | `sumPct / countTaken` — **o'rtacha** (`:167`) |
| `weight` | `* a.weight` — **hisoblanadi** (`:46`) | ⚠️ **umuman ishlatilmaydi** (`:162`) |
| Teng ball | `DENSE_RANK()` → 1, 2, 2, 3 (`:78`) | `forEach((d,i) => d.rank = i+1)` → 1, 2, **3**, 4 (`:180`) |

**Uchala farq ham tasdiqlangan.** Eng ochig'i — grep:

```
grep -rn "weight" apps/api/src/modules/ranking/
→ ranking.service.ts:46:   (sc.score / NULLIF(a.max_score, 0)) * 100 * a.weight,
```

**Butun `ranking` modulida `weight` so'zi ATIGI BIR MARTA uchraydi** — snapshot SQL'ida.
Jonli reyting uni hatto `select` ham qilmaydi.

##### ⚠️ `weight` — bu DTM koeffitsiyenti

Bu farqni jiddiy qiladigan narsa: `assessments.weight` (`schema.prisma:62`,
`Decimal(6,3)` default `1.000`) — bu **bezak emas**. Kanon § 4.1 ga ko'ra DTM 189
ballik tizimida fanlar **teng emas**:

```
Asosiy fan (MAIN)          → 93 ball
Qo'shimcha fan (SECONDARY) → 63 ball
Majburiy fanlar (MANDATORY) → 3 × 11 = 33 ball
```

Ya'ni MAIN fan MANDATORY fandan **~8.5 barobar** og'irroq. `weight` — aynan shu
nomutanosiblikni ifodalaydi.

**Xulosa:** jonli reyting — ya'ni **o'qituvchi va o'quvchi ekranda ko'radigan
reyting** — DTM og'irliklarini **e'tiborga olmaydi**. U matematikadan olingan 5 ni
ona tilidan olingan 5 bilan **teng** sanaydi. DTM esa sanamaydi.

⚠️ Bu kanon § 4.1 dagi mavjud muammoning **davomi**: "189 ball qoidasi faqat
frontendda". Endi ma'lum bo'ldiki, u **backend'da ham yarim** — snapshot biladi,
jonli reyting bilmaydi.

##### Amaliy oqibat

Ikki o'quvchi, bir xil ballar, **ikki xil dunyo**:

```
Aziz:  matematika 90/100 (weight 3.1), ona tili 60/100 (weight 1.1)
Bobur: matematika 60/100 (weight 3.1), ona tili 90/100 (weight 1.1)

Jonli reyting (weight yo'q, o'rtacha):
  Aziz  = (90 + 60) / 2 = 75.0   → 1-o'rin (teng, lekin indeks bo'yicha)
  Bobur = (60 + 90) / 2 = 75.0   → 2-o'rin  ⚠️ TENG, lekin 2-o'rin ko'rsatiladi

Snapshot (weight bor, yig'indi):
  Aziz  = 90*3.1 + 60*1.1 = 345.0  → 1-o'rin
  Bobur = 60*3.1 + 90*1.1 = 285.0  → 2-o'rin

Ya'ni: jonli ekran "ikkalangiz teng" deydi.
       Snapshot "Aziz 60 ball oldinda" deydi.
       DTM haqiqati — snapshot tomonida.
```

Va `DENSE_RANK` farqi mustaqil ravishda buzadi: uch o'quvchi 1, 2, 2 ball bilan —
snapshot `1, 2, 2` deydi, jonli ekran `1, 2, 3` deydi. **Uchinchi o'quvchi ekranda
o'rin yo'qotadi**, garchi u ikkinchisi bilan **teng bo'lsa ham**. Bu — o'quvchiga
ko'rsatiladigan raqam, va u **adolatsiz**.

##### ⚠️ Nima uchun bu 5-bo'limni buzadi

`grade_snapshots` ning butun ma'nosi — "**bugungi holatning kechagi surati**" (5.2).

**Lekin u surat emas.** U — **boshqa formula bilan hisoblangan boshqa son**.

```
Kecha ekranda ko'rgan:     75.0,  2-o'rin     (o'rtacha, weight yo'q, indeks-rank)
Snapshot'da yozilgan:      285.0, 2-o'rin     (yig'indi, weight bor, DENSE_RANK)
                           ^^^^^
                     bu ikkisi bir-biriga hech qanday aloqasi yo'q
```

Ya'ni **tarix — o'tmishning yozuvi emas, o'tmish haqidagi boshqa fikr**. Va trend
tahlili (4-bo'lim, `assessmentTrend` belgisi) aynan shu ustiga quriladi.

⚠️ **Va bu 4-bo'limni ham buzadi:** agar `computeFeatures` (4.3, Bosqich 1)
`grade_snapshot_rows.total_score` dan o'qisa — u o'quvchi va o'qituvchi **hech qachon
ko'rmagan** raqamni oladi. Model bir dunyoni o'rganadi, odamlar boshqasida yashaydi.

##### Ildiz sabab — yagona haqiqat manbai yo'q

Bu **uchta alohida bag emas**. Bu — **bitta arxitektura kamchiligining uchta ko'rinishi**:

> "O'quvchining reytingi" — **domen qoidasi**. U **ikki marta yozilgan**: bir marta
> Postgres SQL'ida, bir marta TypeScript'da. Ikkisi **hech qachon sinxronlashtirilmagan**
> va ularni sinxron ushlab turadigan **hech narsa yo'q** (kanon § 3: testlar amalda nol).

Ular **ajralib ketishga mahkum edi**. Va ajralib ketdi — uchta joyda.

##### TZ talabi

**Yagona formula, yagona manba.** Ikki yo'l bor:

**Variant A — jonli reyting snapshot SQL'ini chaqiradi** (⚠️ tavsiya etiladi):

`totalsSql()` (`ranking.service.ts:33`) **allaqachon parametrlashtirilgan** — u
`tenantId`, `groupId`, `start`, `end` oladi va `$queryRaw` bilan to'g'ridan-to'g'ri
chaqirilishi mumkin. `liveRanking` (`:90`) o'zining JS hisobini **tashlab yuboradi**
va o'sha SQL'ni chaqiradi:

```ts
async liveRanking(args: { tenantId: string; groupId: string; from: string; to: string }) {
  const tenantId = toBigInt(args.tenantId, 'tenantId');
  const groupId  = toBigInt(args.groupId, 'groupId');
  // ... group tekshiruvi, assessment headers (bular qoladi — ular ko'rsatish uchun) ...

  // ✅ Snapshot bilan AYNAN bir xil SQL — ajralib ketishi IMKONSIZ
  const rows = await this.prisma.$queryRaw<
    { student_id: bigint; total_score: string; rank: number; risk_level: string }[]
  >(this.totalsSql(tenantId, groupId, args.from, args.to));
  // ...
}
```

**Foydasi:** formula **bitta joyda**. Snapshot va jonli ekran — **ta'rifan** bir xil,
chunki ular **ayni bir SQL**. Sinxronlashtirish muammosi **yo'qoladi**, kelishuv
orqali emas, **tuzilish orqali**.

**Narxi:** jonli reyting endi har chaqiruvda SQL agregat ishlatadi. Bir necha yuz
o'quvchida — sezilmaydi (9.3). Va `assessments` bo'yicha per-cell ballar (`scores`
map, `:154`) baribir alohida so'rov bilan olinadi — u o'zgarmaydi.

**Variant B — domen qatlamiga chiqarish:** formula TypeScript'da bitta funksiyada,
SQL undan generatsiya qilinadi. **Toza, lekin qimmat** va bu loyihada domen qatlami
naqshi yo'q (kanon § 5).

⚠️ **Har ikki holatda ham — bu BUZUVCHI o'zgarish.** Reyting raqamlari **o'zgaradi**,
va o'quvchilar buni **darhol sezadi** ("nega men 3-o'rindan 5-ga tushdim?"). Shuning
uchun:

1. Akademiya bilan **oldindan** kelishiladi
2. Qaysi formula to'g'ri — **akademiya qaror qiladi**, muhandis emas. ⚠️ TZ **yig'indi
   + weight + DENSE_RANK** ni tavsiya qiladi (DTM mantiqiga mos: topshirmaslik ham
   natija, fanlar teng emas, teng ball teng o'rin), **lekin bu tavsiya, qaror emas**
3. O'quvchilarga **e'lon qilinadi** — reyting ular uchun muhim, jimgina o'zgartirish
   ishonchni buzadi
4. Chorak/davr **o'rtasida emas**, boshida joriy qilinadi

⚠️ **Eski snapshot'lar qayta hisoblanmaydi** — 5.5 dagi `risk_level` bilan bir xil
sabab: baholar o'zgargan bo'lishi mumkin. Ular **eski formula bilan** deb
belgilanadi (`grade_snapshots` ga `formula_version VarChar(10)` ustuni qo'shiladi) va
backtesting'da **aralashtirilmaydi**.

#### (d) `signals` — `String`, `Json` emas

`schema.prisma:849`: `signals String?`. Va `risk.service.ts:68`: `JSON.stringify(signals)`,
`risk.service.ts:155`: `JSON.parse(r.signals)`.

Bu hozir muammo emas (ichida faqat `{manual:true}` bor). Lekin 4-bo'limdagi haqiqiy
signallar kiritilsa — `signals` ichidan **so'rov qilib bo'lmaydi**:

```ts
// ❌ String'da ishlamaydi
where: { signals: { path: ['attendance_pct'], lt: 70 } }
```

Postgres `jsonb` buni qo'llab-quvvatlaydi. **Migratsiya kerak:**

```sql
-- migration: 000003_risk_signals_jsonb
ALTER TABLE student_risk_scores
  ALTER COLUMN signals TYPE jsonb USING signals::jsonb;
```

Mavjud ma'lumot to'g'ri JSON (har doim `JSON.stringify` orqali yozilgan), shuning uchun
`USING signals::jsonb` xavfsiz. Lekin migratsiyadan oldin tekshiriladi:

```sql
SELECT count(*) FROM student_risk_scores
WHERE signals IS NOT NULL AND signals !~ '^\s*[\{\[]';
-- 0 bo'lishi shart
```

#### (e) `score Int` — noaniqlikni ifodalay olmaydi

`schema.prisma:847`: `score Int`. Ya'ni "70" deyish mumkin, "70, lekin ishonch past"
deyish mumkin emas.

Qo'lda kiritishda bu muhim emas. Hisoblangan skorda muhim: 2 ta test topshirgan
o'quvchi va 20 ta test topshirgan o'quvchining 70 balli **bir xil ishonchda emas**.
4-bo'limda `confidence` maydoni taklif qilinadi.

### 3.7. Xulosa — hozirgi holat jadvali

| Da'vo | Haqiqat | Manba |
|---|---|---|
| "Xavf skori hisoblanadi" | ❌ Qo'lda kiritiladi | `risk.service.ts:58` |
| "Signallardan tuziladi" | ❌ Birorta signal o'qilmaydi | `risk.service.ts:60` |
| "Og'irliklar bor" | ❌ Formula yo'q | modulda `weight` yo'q |
| "33/66 chegarasi asoslangan" | ❌ 100/3. Bu **rang funksiyasi**, tasnif emas | `risk.service.ts:22` |
| "Skor validatsiya qilingan" | ❌ Savol predmetsiz — bashorat yo'q | outcome↔risk join yo'q |
| "GREEN = xavfsiz" | ❌ GREEN = "skor yo'q" ham bo'lishi mumkin | `risk.service.ts:214,330` |
| "Skorni kim qo'ygani ma'lum" | ❌ `created_by_user_id` **yo'q** | `schema.prisma:842` |
| "`calculated_at` = hisoblangan vaqt" | ❌ `new Date()` = **kiritilgan vaqt** | `risk.service.ts:70` |
| Daftar sifatida to'g'ri ishlaydi | ✅ Tenant, audit, RBAC, tarix, pagination | `risk.module.ts` |
| **Signal manbalari mavjud** | ✅ Davomat, baho, intizom, to'lov — **hammasi bazada** | 3.2-jadval |
| **Tarixiy natija mavjud** | ✅ `student_outcomes` to'ldirilyapti | `certificates.service.ts:472` |

**Oxirgi ikki qator — 4-bo'limning butun asosi va bu hujjatdagi eng yaxshi xabar.**

Mashinaviy o'rganishda eng qiyin, eng qimmat va ko'pincha **imkonsiz** qism — bu
**label** (haqiqat markeri). "Bu o'quvchi kirdimi?" degan savolga javob **yillar** talab
qiladi va uni **sotib olib bo'lmaydi**.

`mathacademy` da u **allaqachon bor**. `X` (signallar) bor. `y` (natija) bor.

```
BOR:      davomat, baho, intizom, to'lov, tarix   →  X
BOR:      student_outcomes                        →  y
YO'Q:     X va y ni bog'laydigan funksiya         →  f
```

**Poydevor qurilgan. Ikkala devor ham turibdi. Ular orasida ko'prik yo'q.**

⚠️ **Shuning uchun 4-bo'lim — "yaxshi bo'lardi" degan taklif emas, `risk` modulining
ASOSIY ISHI.** U hali bajarilmagan.

---

## 4. Xavf skorini haqiqiy qilish

> ⚠️ **Bu bo'limning maqsadi 3-bo'limdan keyin o'zgardi.** Backtesting — **mavjud
> skorni tekshirish emas** (tekshiradigan narsa yo'q). Bu — **birinchi skorni qurish**.
> Ya'ni bu bo'lim `risk` modulining bajarilmagan asosiy ishini tasvirlaydi.

### 4.1. Nima uchun bu MUMKIN

Ko'p loyihalarda "bashorat qilaylik" degan taklif ma'lumot yo'qligiga urilib to'xtaydi.
Bu yerda **unday emas**:

1. **Tarixiy natija bor** — `student_outcomes` to'ldirilgan (2-bo'lim). Bu — `y`
   (haqiqat). ⚠️ **Lekin avval u tozalanadi** — 2.5d-4.
2. **Signal manbalari bor** — davomat, baho, intizom, to'lov jadvallari to'la
   (3.2-bo'lim jadvali). Bu — `X` (belgilar).
3. **Vaqt kesimi bor** — `grade_snapshots` (5-bo'lim) davriy holatni saqlaydi.
4. **Guruh/yashash tarixi bor** — `student_group_history`,
   `student_living_history` (7-bo'lim).

Ya'ni `X` ham, `y` ham bazada. **Yetishmayotgani — ularni birlashtiradigan funksiya.**

Butun ish shu oqimda:

```
o'tgan yil o'quvchilari
  → signallar (davomat %, o'rtacha ball, intizom soni, to'lov kechikishi)
  → student_outcomes (kirdi / kirmadi)          ← ground truth, ALLAQACHON bor
  → og'irliklarni sozla
  → yangi o'quvchilarga qo'lla
```

⚠️ **Oldingi shart (2.5d-4): `outcome_status` enum'ga o'tkazilmaguncha bu boshlanmaydi.**
Iflos label → jimgina noto'g'ri model. Tartib: **enum → backtest → skor**.

### 4.1.1. ⚠️ Qo'lda kiritish YO'QOLMAYDI — bu talab

3-bo'lim qo'lda kiritishni qattiq tanqid qildi. Shuning uchun noto'g'ri xulosa chiqishi
oson: *"demak, uni o'chirib, avtomatik hisob bilan almashtiramiz."*

**Yo'q. Bu xato bo'lardi.**

Sabab: **ustozning bilimi — real signal, va u model ko'rmaydigan narsani ko'radi.**

| Ustoz biladi | Bazada bormi |
|---|---|
| "Otasi kasal bo'lib qoldi" | ❌ |
| "Oilada moddiy qiyinchilik boshlandi" | ❌ (`invoices` kechikishi — **oqibat**, sabab emas) |
| "Do'sti bilan janjallashdi, ikkalasi ham tushib ketdi" | ❌ |
| "Ko'zi yaxshi ko'rmayapti, doskani o'qiy olmayapti" | ❌ |
| "Universitetga emas, chet elga ketmoqchi" | ❌ (kirmasa ham — **muvaffaqiyat**) |
| "Motivatsiyasi so'ndi, ko'zida uchqun yo'q" | ❌ |

Model bularning **birortasini** ko'rmaydi. Model faqat `attendance_marks` va
`assessment_scores` ni ko'radi — ya'ni **oqibatni**, sababdan **oylar keyin**. Ustoz
esa sababni **bugun** ko'radi.

Ya'ni: **hisoblangan skor ustozdan tezroq emas, sekinroq.** U faqat **kengroq** (300
o'quvchini bir vaqtda ko'radi, ustoz esa 25 tasini).

**To'g'ri dizayn — ikkalasi, alohida ustunda, ikkalasi ham ko'rinadi:**

```prisma
model student_risk_scores {
  id                  BigInt   @id @default(autoincrement())
  tenant_id           BigInt
  student_id          BigInt
  calculated_at       DateTime @default(now()) @db.Timestamptz(6)

  // ⚠️ MAVJUD ustun — ma'nosi ANIQLASHTIRILADI: bu yakuniy, ko'rsatiladigan skor
  score               Int
  level               String   @db.VarChar(10)

  // ✅ YANGI — hisoblangan qism
  computed_score      Int?                          // null = formula hali ishlamagan
  computed_at         DateTime? @db.Timestamptz(6)  // ⚠️ HAQIQATAN hisoblangan vaqt
  weights_version     String?   @db.VarChar(20)     // 'v1', 'v2' — qaysi og'irlik bilan
  signals             Json?                         // ⚠️ String EMAS (3.6d)

  // ✅ YANGI — odam qismi
  manual_score        Int?                          // null = ustoz tegmagan
  manual_reason       String?                       // ⚠️ tuzatilsa MAJBURIY (kodda)
  created_by_user_id  BigInt?                       // ⚠️ 3.5.1
  note                String?

  users               users?   @relation(fields: [created_by_user_id], references: [id], onUpdate: NoAction)
  ...
}
```

**Qoida — sodda va qat'iy:**

```ts
// Yakuniy skor: odam bo'lsa — odam. Yo'q bo'lsa — formula. Ikkalasi ham yo'q — NOT_ASSESSED.
const score = manual_score ?? computed_score ?? null;
const level = score === null ? 'NOT_ASSESSED' : levelFromScore(score);
```

⚠️ **Odam formulani yengadi, teskarisi emas.** Sababi:

1. Ustoz kontekstni ko'radi (yuqoridagi jadval), formula ko'rmaydi
2. Javobgarlik odamda bo'lishi kerak (10-bo'lim)
3. Formula xato qilsa — ustoz tuzatadi. Ustoz xato qilsa — **bu ham ma'lumot**
   (4.1.2)

**UI ikkalasini ham ko'rsatadi** — bu **majburiy**, chunki farqning o'zi — signal:

```
Aziz Karimov
  Hisoblangan:  72  (RED)   ← davomat 61%, matematika pasaymoqda
  Ustoz bahosi: 30  (GREEN) ← "Otasi kasal edi, hal bo'ldi. Nazoratdaman." — N.Karimova, 12-mart
  ─────────────────────────
  Ko'rsatiladi: 30  (GREEN)
```

⚠️ **`manual_reason` — tuzatishda MAJBURIY.** Sababsiz tuzatish qabul qilinmaydi
(`BadRequestException('MANUAL_REASON_REQUIRED')`). Sabab: sababsiz bekor qilish —
javobgarlikdan qochish, va u **hech qanday ma'lumot qoldirmaydi**.

### 4.1.2. Farqning o'zi — eng qimmatli signal

Bu — yuqoridagi dizaynning kutilmagan foydasi va u alohida aytilishi kerak.

`computed_score` va `manual_score` **alohida saqlanganda**, keyingi yil quyidagilarni
o'lchash mumkin:

| So'rov | Nima anglatadi |
|---|---|
| Ustoz tuzatgan holatlarda kim haqroq chiqdi? | **Ikkalasini ham baholaydi** |
| Formula RED, ustoz GREEN → natija? | Formula shovqin beryaptimi |
| Formula GREEN, ustoz RED → natija? | ⚠️ **Eng qimmatlisi** — ustoz formula ko'rmagan narsani ko'rgan |
| Qaysi ustoz tuzatishlari aniqroq? | (⚠️ ehtiyot — 8.1 dagi selection effect) |
| `manual_reason` da qaysi sabablar takrorlanadi? | **Yangi belgi nomzodlari** |

Oxirgi qator — eng muhimi. Agar `manual_reason` da 15 marta "oilada muammo" yozilgan
bo'lsa — bu **model uchun yangi belgi kerakligini** aytadi. Ya'ni odam formulani
**o'rgatadi**, uni almashtirmaydi.

> **Ustoz — modelning raqibi emas, uning eng yaxshi belgi manbai.**

Va agar formula ustoz bilan **doim** mos kelsa — formula **keraksiz** (ustoz o'zi
yetarli). Agar **hech qachon** mos kelmasa — formula **buzuq**. Ikkala holat ham
faqat ikki ustun alohida saqlansa bilinadi.

### 4.2. ⚠️ ML taklif QILINMAYDI — va nega

Halol hisob-kitob:

```
1 akademiya × ~1 bitiruv kohorti/yil × bir necha yuz o'quvchi
= yiliga ~100–300 marker (label)
Undan NOT_ADMITTED (kam uchraydigan sinf) = balki 20–60 ta
```

Bu **hech qanday ML uchun yetarli emas**. Nima uchun:

- **Sinf nomutanosibligi:** agar akademiya yaxshi ishlasa, kirmaganlar ozchilik.
  "Hammasi kiradi" deb bashorat qiladigan model 85% aniqlik beradi va **butunlay
  foydasiz** bo'ladi.
- **Overfitting:** 10 ta belgi × 200 ta namuna bilan gradient boosting shovqinni
  yodlab oladi. Train'da 0.95 AUC, keyingi yilda 0.55.
- **`UNKNOWN` bias** (2.5e-bo'lim): markerlarning o'zi tanlangan (biased). Modeldan
  "kirmaganni bashorat qilish" emas, "aloqani uzganni bashorat qilish" chiqadi.
- **Tushuntirib bo'lmaslik:** ota-onaga "gradient boosting shunday dedi" deb bo'lmaydi.
  10-bo'limga qara.
- **Domen siljishi:** DTM formati o'zgaradi, akademiya o'qituvchini almashtiradi.
  2023-yil modeli 2026-yilda boshqa dunyoni ko'radi.

**Xulosa:** ML — bu yerda muhandislik xatosi bo'lardi. "Zamonaviy" ko'rinardi va
yomonroq ishlardi.

### 4.3. To'g'ri yo'l — 4 bosqich

#### ⚠️ Bosqich −1 — Oldingi shartlar (bularsiz backtesting MA'NOSIZ)

3-, 5-bo'limlar uchta **ma'lumot ifloslanishini** aniqladi. Ularning har biri
backtesting'ni **jimgina** buzadi:

| # | Muammo | Nima bo'ladi agar tuzatilmasa | Bo'lim |
|---|---|---|---|
| 1 | `outcome_status` enum emas | **Label iflos** → model iflos ma'lumotga o'rgatiladi | 2.5d |
| 2 | Skorsiz o'quvchi = GREEN | **Soxta signal**: "GREEN edi, kirmadi" | 3.6a, 5.2 |
| 3 | Reyting formulasi ikki xil | Model **ekrandan boshqa** dunyoni o'rganadi | 3.6c |

⚠️ **Uchalasi ham "xato bermaydigan" turdagi muammo.** Backtest ishlaydi, raqam
chiqadi, raqam ishonarli ko'rinadi — va **yolg'on** bo'ladi. Bu — eng qimmat xato
turi.

> **Ma'lumot toza bo'lmaguncha, model qurilmaydi.**
> `garbage in → confident garbage out` — va ikkinchisi birinchisidan **xavfliroq**,
> chunki unga ishoniladi.

#### Bosqich 0 — Halollik (arzon, 1-2 kun)

Boshqa hech nima qilinmasa ham **bu bajariladi**:

1. UI'da yorliq: "Xavf skori — **o'qituvchi bahosi**, avtomatik hisob emas"
   (`RiskPage.tsx:103` dagi `PageHeader` description). ⚠️ 3.1: nomlar va'da beradi,
   kod bermaydi — hech bo'lmasa **UI halol gapirsin**
2. `NOT_ASSESSED` holati (3.6a) — GREEN yolg'onini to'xtatish
3. `GET /guardian/risk` **o'chiriladi** (10.3)
4. `created_by_user_id` qo'shiladi (3.5.1) — muallifsiz baho qolmasin
5. Swagger tavsifi tuzatiladi: `risk.controller.ts:52` da "Set (record) a new risk
   score" → "Record a **manual staff assessment** of student risk"

Nima uchun birinchi: **noto'g'ri raqam ko'rsatmaslik — to'g'ri raqam ko'rsatishdan
muhimroq va arzonroq.**

#### Bosqich 1 — Belgilar jadvali (feature table)

Backtesting uchun har o'quvchi bo'yicha **belgilangan sanadagi holat** kerak. Muhim
qoida: **faqat o'sha sanaga qadar mavjud ma'lumot** (leakage bo'lmasin).

`apps/api/src/modules/risk/risk-features.service.ts` (yangi fayl, modul o'zgarmaydi —
kanon § 8 buzilmaydi):

```ts
// apps/api/src/modules/risk/risk-features.service.ts
export interface RiskFeatures {
  studentId: string;
  asOf: Date;
  attendanceAbsentPct: number | null;  // oxirgi 90 kun, ABSENT ulushi
  assessmentAvgPct: number | null;     // oxirgi 90 kun, o'rtacha (score/max_score)
  assessmentTrend: number | null;      // oxirgi 45 kun − oldingi 45 kun
  assessmentsTaken: number;            // ⚠️ ishonch uchun
  violationsCount: number;             // oxirgi 180 kun
  invoiceOverdueDays: number | null;   // eng katta kechikish
  livesInDorm: boolean | null;         // asOf sanasida (living_history orqali)
  groupChanges: number;                // oxirgi 365 kun (group_history)
  coverage: number;                    // 0..1 — nechta belgi null emas
}

async computeFeatures(args: {
  tenantId: bigint;
  studentId: bigint;
  asOf: Date;                          // ❗ bu sanadan KEYINGI ma'lumot O'QILMAYDI
}): Promise<RiskFeatures> { /* ... */ }
```

⚠️ **Leakage — eng oson qilinadigan xato.** Agar `asOf = 2025-01-15` bo'lsa va biz
2025-mart imtihonini o'qisak — model "bashorat" qilmaydi, **javobni ko'radi**.
Backtesting mukammal natija beradi, real hayotda ishlamaydi. Har so'rovda
`held_at <= asOf`, `session_date <= asOf` shart.

#### Bosqich 2 — Backtesting

Yangi endpoint: `POST /staff/risk/backtest` (`risk.controller.ts` ga qo'shiladi,
`@RequirePermissions('risk.write')`).

```ts
// apps/api/src/modules/risk/risk-backtest.service.ts
async backtest(args: {
  tenantId: bigint;
  graduationYear: number;     // masalan 2025 — natijasi ma'lum kohort
  asOfMonth: number;          // 1..12 — qaysi oydagi holat bo'yicha bashorat
  weights: RiskWeights;
}) {
  // 1) Kohortni ol — faqat natijasi MA'LUM bo'lganlar
  const students = await this.prisma.students.findMany({
    where: {
      tenant_id: args.tenantId,
      expected_graduation_year: args.graduationYear,
      student_outcomes: { outcome_status: { not: 'UNKNOWN' } },   // ⚠️ 4.4-bo'lim
    },
    select: { id: true, student_outcomes: { select: { outcome_status: true } } },
  });

  // 2) Har biriga asOf sanasidagi belgilarni hisobla
  const asOf = new Date(Date.UTC(args.graduationYear, args.asOfMonth - 1, 1));
  const rows = [];
  for (const s of students) {
    const f = await this.features.computeFeatures({
      tenantId: args.tenantId, studentId: s.id, asOf,
    });
    rows.push({
      score: scoreFromFeatures(f, args.weights),
      actual: s.student_outcomes!.outcome_status === 'NOT_ADMITTED',   // y = 1
      coverage: f.coverage,
    });
  }

  // 3) HAR chegara uchun metrika — 66 ni oldindan tanlamaymiz
  const curve = [];
  for (let th = 5; th <= 95; th += 5) {
    const tp = rows.filter((r) => r.score > th && r.actual).length;
    const fp = rows.filter((r) => r.score > th && !r.actual).length;
    const fn = rows.filter((r) => r.score <= th && r.actual).length;
    const tn = rows.filter((r) => r.score <= th && !r.actual).length;
    curve.push({
      threshold: th, tp, fp, fn, tn,
      precision: tp + fp > 0 ? tp / (tp + fp) : null,
      recall: tp + fn > 0 ? tp / (tp + fn) : null,
    });
  }

  return { n: rows.length, baseRate: rows.filter(r => r.actual).length / rows.length, curve };
}
```

**Natijani qanday o'qish kerak:**

| Metrika | Ma'nosi | Akademiya uchun |
|---|---|---|
| `baseRate` | Kirmaganlar ulushi | **Taqqoslash asosi**. Model shundan yaxshi bo'lishi shart |
| `precision` | RED deganlarning nechtasi haqiqatan kirmadi | Past → xodim vaqti behuda |
| `recall` | Kirmaganlarning nechtasini oldindan topdik | Past → tizim maqsadini bajarmaydi |

⚠️ **Recall muhimroq.** Xato narxi nosimmetrik: yaxshi o'quvchini RED deb qo'shimcha
darsga chaqirish — kichik zarar. Kirmaydigan o'quvchini GREEN deb o'tkazib yuborish —
**bir yil va bola kelajagi**. Shuning uchun chegara `recall ≈ 0.7–0.8` bo'ladigan
joydan tanlanadi, `precision` ma'qul bo'lguncha.

**Muvaffaqiyat mezoni — oldindan yozilgan (post-hoc emas):**

> Skor ishlaydi deyish uchun: `recall ≥ 0.6` va shu chegarada `precision` `baseRate`
> dan **kamida 2 barobar** yuqori. Aks holda skor tanga tashlashdan yaxshi emas va
> **ko'rsatilmaydi**.

Bu mezon **oldindan** kelishilishi shart. Aks holda natijani ko'rib "ha, 0.45 ham
yaxshi-ku" deb o'zimizni aldaymiz.

#### Bosqich 3 — Og'irliklarni sozlash

`weights` — `system_settings` da (`schema.prisma:968`), **kodda emas**:

```ts
// system_settings: key = 'risk.weights.v1'
{
  "attendanceAbsentPct": 0.30,
  "assessmentAvgPct":    0.35,
  "assessmentTrend":     0.15,
  "violationsCount":     0.10,
  "invoiceOverdueDays":  0.10,
  "thresholds": { "yellow": 34, "red": 67 }
}
```

Nima uchun `system_settings`: (1) backtesting turli og'irlikni sinaydi, deploy'siz;
(2) har tenant o'z akademiyasiga moslaydi; (3) `key` `@@unique([tenant_id, key])`
(`schema.prisma:976`) — tenant izolyatsiyasi tayyor.

**Boshlang'ich og'irliklar — bu taxmin va shunday deb belgilanadi.** Ular birinchi
backtest uchun boshlang'ich nuqta, xolos.

Sozlash tartibi:
1. Backtest'ni boshlang'ich og'irlik bilan yurgiz
2. Grid search: har og'irlik {0, 0.1, ..., 0.5}, yig'indisi 1.0 — bir necha ming
   kombinatsiya, bir necha soniya
3. Eng yaxshi `recall`ni beruvchini tanla
4. ⚠️ **Boshqa yilda tekshir** — 2024 kohortida sozla, 2025 kohortida sina. Agar
   2025'da qulasa — bu overfitting, og'irlik soni kamaytiriladi (4-5 tadan 2-3 taga)

Agar 2+ yillik ma'lumot bo'lsa, **logistik regressiya** (`X` → `NOT_ADMITTED`) ham
mumkin — koeffitsientlari o'qiladi, ular og'irlikka aylanadi. Bu hali ham ML emas,
statistika. Va tushuntirib beriladi: "davomat past bo'lsa xavf ortadi, koeffitsient
0.34".

### 4.4. Halol e'tirof — bu ham to'liq to'g'ri emas

TZ o'z taklifining kamchiligini yashirmasligi kerak:

1. **`UNKNOWN` ni tashlab yuborish — bias kiritadi** (`backtest()` da
   `outcome_status: { not: 'UNKNOWN' }`). Ular tasodifiy emas (2.5e). Ya'ni backtest
   ham **biroz yolg'on**. Buni to'g'irlashning yagona yo'li — outcome qamrovini
   oshirish, statistik hiyla emas.
2. **Bir necha yuz namuna — kichik.** `precision = 0.62` ni ishonch oralig'isiz
   ko'rsatmaslik kerak. Bootstrap CI beriladi va u **keng** bo'ladi.
3. **Aralashuv paradoksi:** agar RED ko'rilib o'quvchiga yordam berilsa va u kirsa —
   skor "xato" ko'rinadi, aslida **ishladi**. Bu asosiy muammo va uni to'liq hal qilib
   bo'lmaydi. Yumshatish: har RED uchun aralashuv `student_timeline` ga yoziladi
   (6-bo'lim) → keyinchalik "aralashilgan/aralashilmagan" ajratilib tahlil qilinadi.
4. **Sabab emas, korrelyatsiya.** Yotoqxonada yashovchilar ko'proq kirsa — bu
   yotoqxona yaxshi degani emas. Balki yotoqxonaga kuchli o'quvchi kelgan
   (**selection effect**). Tizim hech qachon "yotoqxona kirishni oshiradi" demaydi.

---

## 5. `grade_snapshots` — davriy kesim

### 5.1. Real schema

`schema.prisma:479` va `:467`:

```prisma
model grade_snapshots {
  id                  BigInt                @id @default(autoincrement())
  tenant_id           BigInt
  group_id            BigInt
  period_type         String                @db.VarChar(10)
  period_start        DateTime              @db.Date
  period_end          DateTime              @db.Date
  generated_at        DateTime              @default(now()) @db.Timestamptz(6)
  grade_snapshot_rows grade_snapshot_rows[]
  groups              groups                @relation(...)
  tenants             tenants               @relation(...)
}

model grade_snapshot_rows {
  snapshot_id     BigInt
  student_id      BigInt
  total_score     Decimal         @db.Decimal(12, 2)
  rank            Int
  risk_level      String          @default("GREEN") @db.VarChar(10)
  grade_snapshots grade_snapshots @relation(..., onDelete: Cascade)
  students        students        @relation(..., onDelete: Cascade)

  @@id([snapshot_id, student_id])
}
```

### 5.2. Nega kerak

`assessment_scores` — xom ma'lumot, undan istalgan vaqtda reyting hisoblash mumkin.
Unda snapshot nega?

**Chunki xom ma'lumotdan o'tmishni qayta hisoblash — o'tmishni ko'rsatmaydi.**

- Baho keyinchalik **tuzatiladi** (o'qituvchi xato yozgan) → yanvar reytingi bugun
  qayta hisoblansa, boshqa chiqadi
- O'quvchi **guruhini o'zgartiradi** → `students.current_group_id` yangi guruhga
  ishora qiladi, u yanvarda boshqa guruhda edi (`ranking.service.ts:118` `current_group_id`
  bo'yicha filtrlaydi — ya'ni **qayta hisoblash yanvarni buzadi**)
- O'quvchi **chiqib ketadi** → `status != 'ACTIVE'` → reytingdan yo'qoladi, garchi
  yanvarda 3-o'rinda bo'lgan

Snapshot — **muzlatilgan haqiqat**. "Bu o'quvchi 3 oy oldin qanday edi" savoliga javob
faqat u orqali beriladi. Va 4-bo'limdagi backtesting uchun bu **zarur**: o'tmishdagi
holatni bilmasak, o'tmishdagi bashoratni tekshirib bo'lmaydi.

⚠️ **Shunday bo'lishi kerak edi. Amalda esa — yo'q.**

Snapshot **ikkita** va'da beradi va **ikkalasini ham bajarmaydi**:

| Va'da | Haqiqat | Qayerda |
|---|---|---|
| "Bu — o'sha paytdagi reyting" | ❌ **Boshqa formula** bilan hisoblangan boshqa son. Ekranda ko'rilgan raqam emas | 3.6c |
| "Bu — o'sha paytdagi xavf darajasi" | ❌ Snapshot **yaratilgan** paytdagi daraja. Va skori yo'qlar **GREEN** | 3.6b, 3.6a |

Ya'ni `grade_snapshot_rows` ning **to'rt ustunidan ikkitasi** (`total_score`/`rank`
va `risk_level`) o'z ma'nosini bajarmaydi.

**Bu tarixni "yozuv"dan "fikr"ga aylantiradi.** Va eng yomoni — bu **jimgina** sodir
bo'ladi: jadval to'la, raqamlar bor, hech narsa xato bermaydi. Faqat ular
**boshqa savolning javobi**.

⚠️ **Backtesting uchun bu halokatli** (4-bo'lim): "GREEN edi, lekin kirmadi" degan
har bir qator — **soxta signal**. Aslida u "hech kim qaramagan edi, va kirmadi" edi.
Model shundan "GREEN bo'lish xavfli" degan xulosa chiqaradi — **butunlay teskari**
va butunlay ma'nosiz.

**Shuning uchun 5-bo'lim — 4-bo'limning oldingi sharti**, xuddi 2.5d (enum) kabi:

```
(1) outcome_status enum        →  label toza bo'lsin
(2) NOT_ASSESSED ≠ GREEN       →  bo'shliq "xavfsiz" deb yozilmasin
(3) yagona reyting formulasi   →  tarix ekran bilan bir xil bo'lsin
(4) ANDAGINA backtesting
```

### 5.3. Qanday to'ldiriladi — TEKSHIRILDI

**Javob: qo'lda. Cron yo'q.**

Tekshiruv:

```
grep -rni "@Cron|ScheduleModule|nestjs/schedule|setInterval" apps/api/src
→ 0 natija
```

`@nestjs/schedule` **loyihada umuman yo'q**. Ya'ni butun kod bazasida birorta rejalashtirilgan
vazifa yo'q.

Snapshot yaratishning yagona yo'li — `RankingService.createSnapshot()`
(`ranking.service.ts:192`), u HTTP endpoint orqali, `CreateGradeSnapshotDto` bilan
(`periodType`, `periodStart`, `periodEnd`, `groupId`).

Ya'ni: **xodim eslasa — snapshot bor. Unutса — yo'q.**

Qayta ishga tushirish to'g'ri qilingan (`ranking.service.ts:236-244`) — bir xil davr
uchun eski snapshot topilsa, qatorlar `deleteMany` bilan o'chirilib qayta yoziladi,
`generated_at` yangilanadi. Ya'ni idempotent. **Bu yaxshi.**

### 5.4. Muammolar

#### (a) ⚠️ Snapshot'lar tartibsiz bo'ladi

Qo'lda chaqirilgani uchun 1-guruh yanvar, fevral, mart snapshot'iga ega, 2-guruh esa
faqat martga ega bo'lishi mumkin. Guruhlararo taqqoslash **imkonsiz** bo'ladi, chunki
davrlar mos kelmaydi.

Va bu **jimgina** sodir bo'ladi — hech kim "5 ta guruhda fevral snapshot'i yo'q"
demaydi.

#### (b) ⚠️ `period_type` — cheklanmagan `VarChar(10)`

`schema.prisma:483`. `'MONTH'`, `'month'`, `'oy'` — hammasi qabul qilinadi. Va
`ranking.service.ts:225` da snapshot qidirish `period_type` bo'yicha **aniq
solishtiruv**:

```ts
const existing = await this.prisma.grade_snapshots.findFirst({
  where: { tenant_id, group_id, period_type: args.dto.periodType, period_start: start, period_end: end },
});
```

Ya'ni `'MONTH'` va `'month'` — **ikki xil snapshot**, bir xil davr uchun. Idempotentlik
jimgina buziladi.

#### (c) `@@unique` yo'q

`(tenant_id, group_id, period_type, period_start, period_end)` bo'yicha unique
constraint yo'q. Ikki xodim bir vaqtda `createSnapshot` chaqirsa — `findFirst`
(`:221`) ikkalasida ham `null` qaytaradi → **ikkita dublikat snapshot**. Race condition.

#### (d) `risk_level` ustuni ishonchsiz

3.6b da tushuntirildi: davrga tegishli emas, snapshot yaratilgan paytdagi qiymat.

### 5.5. TZ tavsiyasi

**Cron QO'SHILMAYDI.** Nima uchun: snapshot yaratish uchun `periodStart`/`periodEnd`
kerak, ular akademiya kalendariga bog'liq (chorak qachon tugaydi?). Buni `academic_years`
dan olish kerak, va u alohida ish. Cron noto'g'ri davrlar uchun snapshot yaratsa —
foydadan ko'ra zarar.

O'rniga **uch qadam**:

1. **Migratsiya — unique + CHECK:**

```sql
-- migration: 000004_snapshot_integrity
UPDATE grade_snapshots SET period_type = upper(period_type);

ALTER TABLE grade_snapshots
  ADD CONSTRAINT grade_snapshots_period_type_check
  CHECK (period_type IN ('WEEK','MONTH','QUARTER','TERM','YEAR'));

CREATE UNIQUE INDEX grade_snapshots_period_uniq
  ON grade_snapshots (tenant_id, group_id, period_type, period_start, period_end);
```

⚠️ Migratsiyadan oldin dublikat tekshiriladi (agar bor bo'lsa, `generated_at` eng
yangisi qoldiriladi):

```sql
SELECT tenant_id, group_id, period_type, period_start, period_end, count(*)
FROM grade_snapshots
GROUP BY 1,2,3,4,5 HAVING count(*) > 1;
```

2. **"Yetishmayotgan snapshot" ko'rsatkichi** — `GET /staff/ranking/snapshots/gaps`:
   akademik yil davrlarini guruhlar bilan solishtirib, yo'qlarini qaytaradi. Cron'siz
   ham xodim **nimani unutganini ko'radi**.

3. **`risk_level` ni to'g'irlash** — snapshot ichida `period_end` sanasidagi oxirgi
   skor olinadi:

```sql
latest_risk AS (
  SELECT DISTINCT ON (student_id) student_id, level
  FROM student_risk_scores
  WHERE tenant_id = ${tenantId}
    AND calculated_at::date <= ${end}::date    -- ❗ davrga bog'lash
  ORDER BY student_id, calculated_at DESC, id DESC
)
```

⚠️ Bu **eski snapshot'larni tuzatmaydi** — ular allaqachon noto'g'ri yozilgan. Qayta
generatsiya ham yordam bermaydi (skor tarixi bor, lekin baholar o'zgargan bo'lishi
mumkin). **Eski snapshot'lar `risk_level` ustuni ishonchsiz deb belgilanadi** va
backtesting'da ishlatilmaydi.

---

## 6. `student_timeline` — voqealar oqimi

### 6.1. Real schema

`schema.prisma:871`:

```prisma
model student_timeline {
  id                 BigInt   @id @default(autoincrement())
  tenant_id          BigInt
  student_id         BigInt
  event_type         String
  title              String
  details            String?
  created_by_user_id BigInt?
  created_at         DateTime @default(now()) @db.Timestamptz(6)
  users              users?   @relation(fields: [created_by_user_id], references: [id], onUpdate: NoAction)
  students           students @relation(fields: [student_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  tenants            tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}
```

### 6.2. Timeline ≠ Audit — asosiy farq

Bu ikki jadval yuzaki o'xshaydi va **doim aralashtiriladi**. Farq — savolda:

| | `audit_logs` | `student_timeline` |
|---|---|---|
| Savol | "**Kim** o'zgartirdi?" | "O'quvchi **bilan nima bo'ldi**?" |
| Subyekt | Xodim (aktor) | O'quvchi |
| Maqsad | Mas'uliyat, xavfsizlik | Kontekst, hikoya |
| O'quvchi | Obyekt | Qahramon |
| Kim o'qiydi | Admin, tergov | O'qituvchi, kurator |
| Mazmun | `before`/`after` JSON | Odam o'qiydigan matn |
| O'chirilishi | ❌ Hech qachon | ✅ Mumkin (yuridik talab yo'q) |
| Saqlash | Yillar (compliance) | Ta'lim davri |

**Misol.** O'quvchi guruhi o'zgardi:

- `audit_logs`: `{ action: 'UPDATE', entityType: 'students', before: {groupId:'5'},
  after: {groupId:'9'}, actorUserId: 12 }` — *"12-user 5→9 qildi"*
- `student_timeline`: `{ event_type: 'GROUP_ASSIGNED', title: 'Group Assignment',
  details: 'Assigned to group: 11-A Fizika' }` — *"Aziz 11-A Fizikaga o'tdi"*

Ikkalasi ham **bir joyda yoziladi** — `students.service.ts:1008` (timeline) va
`students.service.ts:1020` (audit), bitta tranzaksiyada. **Bu to'g'ri dizayn.**

Nima uchun ikkalasi kerak: audit'ni ta'lim maqsadida ishlatib bo'lmaydi (JSON, texnik,
`before/after`), timeline'ni yuridik dalil sifatida ishlatib bo'lmaydi (o'chirilishi
mumkin, aktor ixtiyoriy).

### 6.3. Nima yoziladi — TEKSHIRILDI

Butun kod bazasida timeline'ga yozadigan **oltita joy**, hammasi `students.service.ts`:

| Qator | `event_type` | `title` | Qachon |
|---|---|---|---|
| `:483` | `STUDENT_CREATED` | Student Created | O'quvchi qo'shilganda |
| `:905` | `STUDENT_UPDATED` | — | Profil tahrirlanganda |
| `:1012` | `GROUP_ASSIGNED` | Group Assignment | Guruh o'zgarganda |
| `:1136` | `LIVING_TYPE_CHANGED` | — | Yashash turi o'zgarganda |
| `:1258` | `COHORT_ASSIGNED` | — | Kohortga qo'shilganda |
| `:1357` | `GUARDIAN_PASSWORD_RESET` | — | Ota-ona paroli tiklanganda |

O'qish — `students.service.ts:625`:

```ts
const timeline = await this.prisma.student_timeline.findMany({
  where: { student_id: id, tenant_id },
  include: { users: { select: { id: true, full_name: true } } },
  orderBy: { created_at: 'desc' },
  take: 20,
});
```

### 6.4. Muammolar

#### (a) ⚠️ Timeline deyarli bo'sh — faqat ma'muriy voqealar

Yuqoridagi jadvalga qara. **Oltita voqeaning oltitasi ham — CRUD.** O'quvchining
ta'lim hayotidan **hech nima yo'q**:

| Voqea | Modul mavjudmi | Timeline'ga yoziladimi |
|---|---|---|
| Imtihon topshirdi | ✅ `assessments` | ❌ |
| Reytingda ko'tarildi/tushdi | ✅ `ranking` | ❌ |
| Intizomiy jazo oldi | ✅ `discipline` | ❌ |
| Mukofot oldi | ✅ `awards` | ❌ |
| Olimpiadada qatnashdi | ✅ `competitions` | ❌ |
| Sertifikat oldi | ✅ `certificates` | ❌ |
| Uzoq muddat kelmadi | ✅ `attendance` | ❌ |
| Ta'til/ruxsat oldi | ✅ `leaves` | ❌ |
| **Universitetga kirdi** | ✅ `certificates` (outcome) | ❌ |
| Xavf darajasi RED bo'ldi | ✅ `risk` | ❌ |

Ya'ni `student_timeline` "o'quvchi bilan nima bo'ldi" degan **va'dani bermaydi**. U
"o'quvchi kartochkasi qachon tahrirlandi" ni ko'rsatadi — ya'ni **audit'ning
yomonroq nusxasi**.

Ayniqsa achinarli: **`STUDENT_CREATED` bor, `ADMITTED` yo'q.** Ya'ni o'quvchi hayotining
boshlanishi yozilgan, **maqsadga erishgani — yo'q**. Bu butun tizimning nuqtai nazarini
ko'rsatadi: ma'muriy, ta'limiy emas.

#### (b) `GUARDIAN_PASSWORD_RESET` — timeline'da nima qilyapti?

`students.service.ts:1357`. Bu **sof ma'muriy/xavfsizlik hodisasi**. O'quvchining
ta'lim hikoyasiga hech qanday aloqasi yo'q. Bu — `audit_logs` voqeasi.

Bu — 6.2 dagi chalkashlikning to'g'ridan-to'g'ri isboti: chegara chizilmagani uchun
ma'muriy voqealar timeline'ga oqib kirgan.

#### (c) `event_type` — cheklanmagan `String`

`schema.prisma:875` — `event_type String`, hatto `VarChar` ham emas. Har kim istagan
qiymat yozadi. `events.service.ts:80` da butunlay boshqa jadvalda (`events`) ham
`event_type` bor va u `args.dto.eventType ?? 'OTHER'` — mijoz beradigan qiymat. Ikki
`event_type` bir-biriga aloqasiz, lekin nomi bir xil — chalkashlik manbai.

#### (d) `take: 20` — qattiq yozilgan, pagination yo'q

`students.service.ts:631`. 3 yil o'qigan o'quvchining timeline'i yuzlab qatordan iborat
bo'ladi (agar 6.4a tuzatilsa). Foydalanuvchi **oxirgi 20 tadan boshqasini ko'ra
olmaydi**. "O'tgan yil nima bo'ldi?" — javob yo'q.

#### (e) Indeks yo'q

`WHERE student_id = ? AND tenant_id = ? ORDER BY created_at DESC` — va bu ustunlarda
**birorta indeks yo'q**. 9-bo'limga qara (bu butun schema muammosi).

### 6.5. TZ tavsiyasi

1. **Chegara qoidasi (hujjatlashtiriladi va majburlanadi):**

   > `student_timeline` ga **faqat o'quvchining ta'lim hayotidagi voqea** yoziladi.
   > Xodim harakati, parol, sozlama, ruxsat — **faqat `audit_logs`**.
   > Test: *"Buni ota-onaga ko'rsatish mantiqiymi?"* Yo'q bo'lsa — timeline emas.

   Shunga ko'ra `GUARDIAN_PASSWORD_RESET` (`students.service.ts:1357`) **olib
   tashlanadi** (audit'da qoladi).

2. **`event_type` katalogi** — TypeScript union + CHECK constraint:

```ts
// apps/api/src/modules/students/timeline-events.ts (yangi fayl)
export const TIMELINE_EVENTS = [
  // Ma'muriy (minimal — faqat o'quvchi uchun ahamiyatlisi)
  'STUDENT_CREATED', 'GROUP_ASSIGNED', 'LIVING_TYPE_CHANGED', 'COHORT_ASSIGNED',
  'STATUS_CHANGED',
  // Akademik
  'ASSESSMENT_TAKEN', 'RANK_IMPROVED', 'RANK_DROPPED',
  // Intizom va mukofot
  'VIOLATION_RECORDED', 'DISCIPLINE_ACTION', 'AWARD_RECEIVED',
  'COMPETITION_ENTERED', 'CERTIFICATE_ISSUED',
  // Xavf va aralashuv (⚠️ 4.4.3 uchun zarur)
  'RISK_LEVEL_CHANGED', 'INTERVENTION_LOGGED',
  // Natija (⚠️ eng muhimi va hozir yo'q)
  'OUTCOME_RECORDED',
] as const;

export type TimelineEvent = (typeof TIMELINE_EVENTS)[number];
```

3. **Ustuvor qo'shimchalar** (hammasi emas, uchtasi):
   - `OUTCOME_RECORDED` — `certificates.service.ts:472` dagi `upsert` tranzaksiyasiga
   - `RISK_LEVEL_CHANGED` — `risk.service.ts:62` da, faqat daraja **o'zgarganda**
     (har skorda emas, aks holda shovqin)
   - `INTERVENTION_LOGGED` — yangi. "RED ko'rdik, nima qildik". **Bu 4.4.3 dagi
     aralashuv paradoksini yumshatish uchun yagona yo'l** — busiz skorni hech qachon
     halol baholab bo'lmaydi

4. **Pagination** — `students.service.ts:625` timeline'ni alohida endpointga chiqarish:
   `GET /staff/students/:id/timeline?page=&limit=&eventType=`. Detail'da `take: 20`
   qoladi (oldindan ko'rish), to'liq ro'yxat alohida.

---

## 7. Tarix jadvallari

### 7.1. `student_group_history`

`schema.prisma:786`:

```prisma
model student_group_history {
  id                 BigInt    @id @default(autoincrement())
  tenant_id          BigInt
  student_id         BigInt
  group_id           BigInt
  start_date         DateTime  @db.Date
  end_date           DateTime? @db.Date       // null = hozirgi
  changed_by_user_id BigInt?
  created_at         DateTime  @default(now()) @db.Timestamptz(6)
  ...
}
```

### 7.2. `student_living_history`

`schema.prisma:809` — bir xil naqsh, `living_type_id` va qo'shimcha `note`:

```prisma
model student_living_history {
  id                 BigInt       @id @default(autoincrement())
  tenant_id          BigInt
  student_id         BigInt
  living_type_id     BigInt
  start_date         DateTime     @db.Date
  end_date           DateTime?    @db.Date
  changed_by_user_id BigInt?
  note               String?
  created_at         DateTime     @default(now()) @db.Timestamptz(6)
  ...
}
```

### 7.3. Nega kerak — asosiy sabab

`students.current_group_id` (`schema.prisma:905`) va `students.living_type_id`
(`:907`) — **hozirgi holat**. Ular ustiga yoziladi va **o'tmish yo'qoladi**.

Tarix jadvallarisiz bu savollarga javob **yo'q**:

- "Bu o'quvchi zaif guruhdan kuchli guruhga o'tganda natijasi yaxshilandimi?"
- "Yanvar reytingi qaysi guruhga tegishli edi?" (5.2 — `ranking.service.ts:118`
  `current_group_id` bo'yicha filtrlaydi → qayta hisoblash o'tmishni buzadi)
- "Yotoqxonaga ko'chgandan keyin davomat o'zgardimi?"
- **8-bo'limdagi HAR BIR savol** — chunki hammasi "o'sha paytda qanday edi" ga
  bog'liq

Ya'ni bu jadvallar — **analitikaning poydevori**, shunchaki jurnal emas.

### 7.4. Qanday to'ldiriladi — TEKSHIRILDI

**Naqsh to'g'ri.** `students.service.ts:978-1005` (guruh):

```ts
// 1) Eski yozuvni yop
if (student.current_group_id) {
  await tx.student_group_history.updateMany({
    where: { student_id, group_id: student.current_group_id, end_date: null },
    data: { end_date: new Date() },
  });
}
// 2) Joriy holatni yangila
await tx.students.update({ where: { id: student_id }, data: { current_group_id: group_id } });
// 3) Yangi yozuvni och
await tx.student_group_history.create({
  data: { tenant_id, student_id, group_id, start_date: new Date(), changed_by_user_id },
});
```

Hammasi `$transaction` ichida (`students.service.ts:960` atrofida). ✅ Yashash tarixi
uchun bir xil naqsh — `students.service.ts:1098-1126`.

Yaratishda ham yoziladi: `students.service.ts:424` (guruh), `:437` (yashash) — faqat
`current_group_id` / `living_type_id` berilgan bo'lsa.

**Bu to'g'ri qilingan va TZ uni o'zgartirishni taklif qilmaydi.**

### 7.5. Muammolar

#### (a) `start_date` — `@db.Date`, lekin `new Date()` yoziladi

`students.service.ts:429`:

```ts
start_date: new Date(), // yoki new Date(toDateOnly(new Date()))
```

`students.service.ts:442`:

```ts
start_date: new Date(), // ✅ toDateOnly(new Date()) -> new Date()
```

Izohlarning o'zi ikkilanishni ko'rsatadi. Ustun `@db.Date` bo'lgani uchun Postgres
vaqt qismini kesadi — **lekin qaysi vaqt zonasida?** Toshkent UTC+5. Agar server UTC
da ishlasa va o'zgarish mahalliy vaqt bilan 01:00 da bo'lsa → UTC'da oldingi kun →
`start_date` **bir kun oldin** yoziladi.

Bu 4.3-bosqich-1 dagi leakage uchun muhim: `asOf` sanasida "yotoqxonada yashaydimi"
savoli chegara sanada noto'g'ri javob berishi mumkin.

**Tavsiya:** `common/utils` da `toDateOnly(date, tz = 'Asia/Tashkent')` yaratilib,
har ikki joyda ishlatiladi. Loyihada `dayjs` bor (kanon § 3).

#### (b) ⚠️ Qoplanish (overlap) kafolatlanmagan

`updateMany ... where: { end_date: null }` (`students.service.ts:980`) — agar biror
sabab bilan **ikkita** ochiq yozuv paydo bo'lsa (masalan, boshqa kod yo'li orqali),
u ikkalasini ham yopadi. Lekin `end_date IS NULL` yozuvi **bittadan ko'p bo'lmasligi**
uchun DB darajasida hech qanday kafolat yo'q.

Postgres'da buni to'g'ri hal qilish mumkin:

```sql
-- migration: 000005_history_no_overlap
CREATE UNIQUE INDEX student_group_history_one_open
  ON student_group_history (student_id) WHERE end_date IS NULL;

CREATE UNIQUE INDEX student_living_history_one_open
  ON student_living_history (student_id) WHERE end_date IS NULL;
```

⚠️ Bu **partial unique index**. Migratsiyadan oldin mavjud dublikat tekshiriladi:

```sql
SELECT student_id, count(*) FROM student_group_history
WHERE end_date IS NULL GROUP BY 1 HAVING count(*) > 1;
```

Agar natija bo'sh bo'lmasa — migratsiya **muvaffaqiyatsiz bo'ladi** va bu **yaxshi**:
ma'lumot allaqachon buzuq degani, avval tozalash kerak.

To'liq qoplanishni (`daterange` + `EXCLUDE USING gist`) taqiqlash ham mumkin, lekin
`btree_gist` extension talab qiladi. **Hozircha erta** — partial index 90% holatni
qoplaydi.

#### (c) ⚠️ Track tarixi YO'Q

`students.track_id` (`schema.prisma:906`) — **hozirgi** yo'nalish. Va uning uchun
`student_track_history` **yo'q**.

Ya'ni: o'quvchi "Fizika-Matematika" dan "Biologiya-Kimyo" ga o'tsa — **oldingi track
izsiz yo'qoladi**.

Bu 8.3 savolini ("Qaysi track eng samarali?") **buzadi**: track o'zgartirgan o'quvchi
oxirgi track'ga hisoblanadi. Va track o'zgartirish — o'z-o'zidan **kuchli xavf
signali** (o'quvchi yo'nalishini topolmayapti). Bu signal hozir **yo'q**.

Bu — hujjatdagi eng aniq **yangi jadval** taklifi:

```prisma
// TAKLIF — hozir schema.prisma da YO'Q
model student_track_history {
  id                 BigInt         @id @default(autoincrement())
  tenant_id          BigInt
  student_id         BigInt
  track_id           BigInt
  start_date         DateTime       @db.Date
  end_date           DateTime?      @db.Date
  changed_by_user_id BigInt?
  reason             String?        // ⚠️ "nega o'zgardi" — analitik qiymat shu yerda
  created_at         DateTime       @default(now()) @db.Timestamptz(6)
  ...
}
```

⚠️ **Bu yangi modul emas** (kanon § 8 buzilmaydi) — `students` moduli ichida, mavjud
`student_group_history` naqshining aynan nusxasi.

⚠️ **Migratsiya cheklovi — halol:** o'tmishdagi track o'zgarishlari **tiklab
bo'lmaydi**. Ular hech qachon yozilmagan. `audit_logs` da `students` UPDATE yozuvlari
bor, lekin ular `track_id` ni o'z ichiga oladimi — tekshirilishi kerak. Eng yaxshi
holatda: jadval bugundan boshlab to'ldiriladi, birinchi backfill sifatida har
o'quvchining hozirgi `track_id` si `start_date = admission_date` bilan yoziladi
(taxminiy, va shunday deb belgilanadi).

---

## 8. Yetishmayotgan analitika

Bu bo'lim akademiya rahbarining real savollarini oladi va har biriga: **ma'lumot
bormi**, **so'rov qanday**, **nima to'sqinlik qiladi**.

⚠️ **Umumiy ogohlantirish — hamma savolga tegishli:** bu savollarning hammasi
**korrelyatsiya** haqida, **sabab** haqida emas. 4.4.4 ga qara.

### 8.1. "Qaysi o'qituvchining guruhi ko'proq kiradi?"

**Ma'lumot: qisman bor.**

- ✅ `groups.curator_user_id` (`schema.prisma:509`) — guruh kuratori
- ✅ `student_outcomes` — natija
- ⚠️ Bog'lanish — **`students.current_group_id` orqali, va bu xato**

**Muammo:** `current_group_id` — **hozirgi** guruh. Bitiruvchi o'quvchi 3 yil davomida
3 ta guruhda bo'lgan bo'lishi mumkin. Natija **oxirgi** kuratorga yoziladi. Ya'ni
o'quvchini 3 yil tayyorlagan o'qituvchi hech narsa olmaydi, oxirgi 2 oyda olgan
o'qituvchi hammasini oladi.

**Naive so'rov (❌ ISHLATILMASIN):**

```sql
SELECT u.full_name, count(*) FILTER (WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')) AS admitted
FROM student_outcomes o
JOIN students s ON s.id = o.student_id
JOIN groups g ON g.id = s.current_group_id
JOIN users u ON u.id = g.curator_user_id
WHERE o.tenant_id = $1
GROUP BY u.full_name;
```

**To'g'ri yo'l — `student_group_history` orqali vaqtga proporsional atribusiya:**

```sql
-- Har o'quvchi-kurator juftligi uchun birga o'tkazilgan kunlar
WITH spans AS (
  SELECT h.student_id,
         g.curator_user_id,
         GREATEST(
           (COALESCE(h.end_date, CURRENT_DATE) - h.start_date)::int,
           0
         ) AS days
  FROM student_group_history h
  JOIN groups g ON g.id = h.group_id
  WHERE h.tenant_id = $1 AND g.curator_user_id IS NOT NULL
),
weighted AS (
  SELECT sp.curator_user_id,
         sp.student_id,
         sp.days::numeric / NULLIF(SUM(sp.days) OVER (PARTITION BY sp.student_id), 0) AS share
  FROM spans sp
)
SELECT u.full_name,
       ROUND(SUM(w.share), 1)                                    AS student_equivalents,
       ROUND(SUM(w.share) FILTER (
         WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')
       ), 1)                                                     AS admitted_equivalents,
       count(*) FILTER (WHERE o.outcome_status = 'UNKNOWN')      AS unknown_cnt
FROM weighted w
JOIN users u            ON u.id = w.curator_user_id
JOIN student_outcomes o ON o.student_id = w.student_id
WHERE o.tenant_id = $1
GROUP BY u.full_name
HAVING SUM(w.share) >= 10        -- ⚠️ kichik namuna filtri
ORDER BY admitted_equivalents / NULLIF(SUM(w.share), 0) DESC;
```

⚠️ **Va bu raqam ham noto'g'ri bo'lishi mumkin.** Nima uchun:

1. **Kurator ≠ o'qituvchi.** `groups.curator_user_id` — ma'muriy rol. Matematikani
   boshqa odam o'qitgan bo'lishi mumkin. Fan o'qituvchisi `timetable_lessons` orqali
   bilinadi, lekin bu boshqa (murakkabroq) so'rov.
2. **⚠️ Selection effect — eng jiddiy.** Agar kuchli o'quvchilar "A" guruhga
   yig'ilsa, "A" kuratori doim yutadi. Bu **guruh tarkibi**, o'qituvchi sifati emas.
   To'g'ri o'lchov — **qo'shilgan qiymat**: o'quvchining kirish balli
   (`students.admission_grade`, `schema.prisma:911`) va natijasi orasidagi farq.
3. **Kichik namuna.** 12 ta o'quvchi bilan 75% va 15 ta bilan 67% — statistik jihatdan
   **farq qilmaydi**. `HAVING >= 10` yetarli emas; ishonch oralig'i ko'rsatilishi
   kerak.

⚠️ **TZ pozitsiyasi — bu raqam UI'da o'qituvchi ismi bilan KO'RSATILMAYDI.** Sabab:
u xodim baholashda ishlatiladi va **noto'g'ri**. U faqat "qaysi guruhga e'tibor kerak"
uchun ichki tahlil sifatida qoladi.

### 8.2. "Yotoqxonada yashaydiganlar ko'proq kiradimi?"

**Ma'lumot: bor.** ✅ `student_living_history` (7.2) + `student_outcomes`.

```sql
-- Bitiruv yilining 1-yanvaridagi yashash turi bo'yicha
WITH at_date AS (
  SELECT h.student_id, lt.code, lt.name
  FROM student_living_history h
  JOIN living_types lt ON lt.id = h.living_type_id
  WHERE h.tenant_id = $1
    AND h.start_date <= $2::date                          -- $2 = '2025-01-01'
    AND (h.end_date IS NULL OR h.end_date > $2::date)
)
SELECT d.name AS living_type,
       count(*)                                                          AS total,
       count(*) FILTER (WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')) AS admitted,
       count(*) FILTER (WHERE o.outcome_status = 'UNKNOWN')              AS unknown,
       ROUND(100.0 * count(*) FILTER (
         WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')
       ) / NULLIF(count(*) FILTER (WHERE o.outcome_status <> 'UNKNOWN'), 0), 1) AS admitted_pct
FROM at_date d
JOIN students s         ON s.id = d.student_id
JOIN student_outcomes o ON o.student_id = d.student_id
WHERE s.expected_graduation_year = $3
GROUP BY d.name
ORDER BY admitted_pct DESC NULLS LAST;
```

**To'siqlar:**

1. `living_types.code` — `String` (`schema.prisma:572`), enum emas, `@@unique([tenant_id, code])`
   (`:585`). Har tenant o'z kodlarini yozadi → **tenantlararo taqqoslash imkonsiz**.
   Ko'p akademiyali mahsulot uchun (kanon § 7) bu muammo.
2. ⚠️ **Selection effect — juda kuchli.** Yotoqxonaga kim boradi? Ehtimol (a) uzoq
   viloyatdan, (b) juda motivatsiyali, (c) oilasi ko'proq to'lay oladigan. Bu uchtasi
   ham natijaga **mustaqil ta'sir qiladi**. Agar yotoqxonachilar ko'proq kirsa —
   yotoqxona sababmi yoki tanlanmami? **Bu ma'lumot javob bera olmaydi.**
3. `admission_grade` bo'yicha stratifikatsiya biroz yordam beradi (bir xil kirish
   balli guruhi ichida solishtirish), lekin **to'liq hal qilmaydi**.

**TZ pozitsiyasi:** so'rov beriladi, natija **"korrelyatsiya, sabab emas"** yorlig'i
bilan ko'rsatiladi. "Yotoqxona kirishni oshiradi" degan xulosa **taqiqlanadi** — bu
marketingda ishlatilishi va yolg'on bo'lishi mumkin.

### 8.3. "Qaysi track eng samarali?"

**Ma'lumot: qisman.**

- ✅ `students.track_id` (`schema.prisma:906`), `student_tracks` (`:885`)
- ❌ **Track tarixi yo'q** (7.5c)

```sql
SELECT t.name AS track,
       count(*)                                                          AS total,
       count(*) FILTER (WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')) AS admitted,
       count(*) FILTER (WHERE o.outcome_status = 'UNKNOWN')              AS unknown
FROM students s
JOIN student_tracks t   ON t.id = s.track_id
JOIN student_outcomes o ON o.student_id = s.id
WHERE s.tenant_id = $1 AND s.expected_graduation_year = $2
GROUP BY t.name;
```

**To'siqlar:**

1. `track_id` **nullable** — track'siz o'quvchilar tushib qoladi
2. **Track o'zgartirganlar oxirgi track'ga hisoblanadi** — 7.5c
3. ⚠️ **"Samarali" so'zi noto'g'ri.** Tracklar **turli qiyinlikdagi universitetlarga**
   olib boradi. Tibbiyot track'i 40% kirish beradi, "boshqa" track'i 90% — bu
   tibbiyot track'i yomon degani **emas**, u qiyinroq joyga intiladi.

**TZ tavsiyasi:** track'lar bir-biri bilan **taqqoslanmaydi**. Har track o'z
**tarixiy o'zi bilan** taqqoslanadi ("Fizika-Matematika 2025: 68%, 2024: 61%").
Bu — yagona halol taqqoslash.

Va ⚠️ **`decision_date` bilan `EARLY_ADMITTED` ni ajratish** kerak: grant/olimpiada
orqali kirish — o'qituvchi ishimi yoki o'quvchi iste'dodimi? Ma'lumot ajrata olmaydi.

### 8.4. "Kirish foizi o'tgan yilga nisbatan qanday?"

**Ma'lumot: bor, lekin bilvosita.** ⚠️ Bu — eng muhim savol va **eng zaif javob**.

`student_outcomes` da `academic_year_id` **yo'q** (2.5b). Yil ikki yo'l bilan
aniqlanadi:

| Yo'l | Maydon | Muammo |
|---|---|---|
| A | `students.expected_graduation_year` (`schema.prisma:913`) | **Prognoz.** O'quvchi kech bitirса — noto'g'ri |
| B | `cohorts.graduation_year` (`student_cohort` orqali) | Kohort **ixtiyoriy** (`students.service.ts:449` — `if (args.dto.cohortLabel)`) |
| C | `student_outcomes.decision_date` (`schema.prisma:832`) | `nullable`, va DTM qarori kalendar yiliga to'g'ri kelmasligi mumkin |

```sql
SELECT s.expected_graduation_year AS year,
       count(*)                                                          AS cohort_size,
       count(o.id) FILTER (WHERE o.outcome_status <> 'UNKNOWN')          AS known,
       count(*) FILTER (WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')) AS admitted,
       -- ⚠️ Maxraj: FAQAT ma'lum natijalar
       ROUND(100.0 * count(*) FILTER (
         WHERE o.outcome_status IN ('EARLY_ADMITTED','ON_TIME_ADMITTED')
       ) / NULLIF(count(o.id) FILTER (WHERE o.outcome_status <> 'UNKNOWN'), 0), 1) AS admitted_pct,
       -- ⚠️ Bu ustunsiz yuqoridagi foiz KO'RSATILMAYDI
       ROUND(100.0 * count(o.id) FILTER (WHERE o.outcome_status <> 'UNKNOWN')
             / NULLIF(count(*), 0), 1)                                   AS coverage_pct
FROM students s
LEFT JOIN student_outcomes o ON o.student_id = s.id
WHERE s.tenant_id = $1
  AND s.archived_at IS NULL
  AND s.expected_graduation_year BETWEEN $2 AND $3
GROUP BY s.expected_graduation_year
ORDER BY 1;
```

⚠️ **Eng katta xavf shu yerda.** Agar 2024-yil qamrovi 90% va 2025-yil qamrovi 50%
bo'lsa — foizlar **taqqoslanmaydi**. Lekin ular bir jadvalda yonma-yon turadi va
rahbar ularni **taqqoslaydi**. Va noto'g'ri qaror qabul qiladi.

**Shuning uchun `coverage_pct` — ixtiyoriy ustun emas, majburiy.** 2.5e dagi qoida
(qamrov < 80% → foiz ko'rsatilmaydi) aynan shu yerda amal qiladi.

### 8.5. Umumiy xulosa

| Savol | Ma'lumot | Asosiy to'siq | Halol javob mumkinmi |
|---|---|---|---|
| Qaysi o'qituvchi? | Qisman | Atribusiya + selection effect | ⚠️ **Yo'q** — ko'rsatilmaydi |
| Yotoqxona? | Bor | Selection effect | ⚠️ Faqat korrelyatsiya sifatida |
| Qaysi track? | Qisman | Track tarixi yo'q + taqqoslanmaydi | ⚠️ Faqat yil-ga-yil |
| Yil-ga-yil? | Bor | `UNKNOWN` qamrovi | ✅ **Ha** — qamrov bilan |

**Naqsh ko'rinib turibdi:** yagona halol javob beriladigan savol — **o'zini o'zi bilan
taqqoslash**. Barcha kesimli taqqoslashlar (o'qituvchi, track, yotoqxona) selection
effect'ga uriladi.

⚠️ **TZ pozitsiyasi:** yo'q analitikani "qo'shish kerak" deb ro'yxatlash oson.
Lekin **noto'g'ri analitika — analitikaning yo'qligidan yomonroq**, chunki u qaror
qabul qilishga ishlatiladi. Shuning uchun ustuvorlik:

1. **8.4 (yil-ga-yil) + qamrov** — halol, kerakli, mumkin → **birinchi qilinadi**
2. 8.2 (yotoqxona) — korrelyatsiya yorlig'i bilan
3. 8.3 (track) — track tarixi qo'shilgandan keyin (7.5c)
4. 8.1 (o'qituvchi) — ⚠️ **ichki tahlil sifatida, UI'ga chiqarilmaydi**

---

## 9. Ishlash (performance)

### 9.1. ⚠️ Asosiy topilma — bazada indeks yo'q

Bu bo'lim "materialized view kerakmi" deb boshlanishi kerak edi. Lekin migratsiya
o'qilganda boshqa narsa chiqdi.

**O'lchangan fakt** (`apps/api/prisma/migrations/000000_init/migration.sql`):

| Nima | Soni |
|---|---|
| `CREATE TABLE` | **68** |
| `FOREIGN KEY` | **165** |
| `CREATE UNIQUE INDEX` | **27** |
| **`CREATE INDEX`** | **0** |

Va `000001_files_storage/migration.sql:6` da **bitta**:

```sql
CREATE INDEX IF NOT EXISTS "files_tenant_owner_purpose_idx" ON "files" ("tenant_id", "owner_type", "owner_id", "purpose");
```

**Ya'ni: 68 jadvalli bazada jami 1 ta unique bo'lmagan indeks bor.**

⚠️ **Muhim:** PostgreSQL foreign key uchun indeksni **avtomatik yaratmaydi** (bu MySQL
xususiyati). Prisma ham PostgreSQL migratsiyasida relation ustunlari uchun indeks
qo'shmaydi. Ya'ni 165 ta FK ustunining hech biri indekslanmagan.

Natijada bu hujjatdagi **har bir so'rov** — sequential scan:

| So'rov | Fayl | Indeks |
|---|---|---|
| `student_risk_scores WHERE student_id ORDER BY calculated_at DESC` | `risk.service.ts:237` | ❌ |
| `student_timeline WHERE student_id ORDER BY created_at DESC` | `students.service.ts:625` | ❌ |
| `student_group_history WHERE student_id` | `students.service.ts:605` | ❌ |
| `student_outcomes groupBy outcome_status` | `certificates.service.ts:689` | ❌ |
| `assessment_scores WHERE student_id` | `students.service.ts:635` | ❌ |
| `latest_risk` CTE (`DISTINCT ON`) | `ranking.service.ts:66` | ❌ |

⚠️ **`student_outcomes.student_id @unique` — istisno.** `@unique` implicit indeks
yaratadi, shuning uchun `findUnique({ where: { student_id } })`
(`certificates.service.ts:809`) tez. Bu tasodifiy omad.

**Eng yomoni — `getRiskSummary`** (`risk.service.ts:315`):

```ts
const students = await this.prisma.students.findMany({
  where: { tenant_id, status: 'ACTIVE', archived_at: null },
  select: {
    id: true,
    student_risk_scores: { orderBy: { calculated_at: 'desc' }, take: 1, select: { level: true } },
  },
});
```

Prisma buni **N+1 emas**, balki `WHERE student_id IN (...)` bilan bitta qo'shimcha
so'rovga aylantiradi — lekin `take: 1` per-student bo'lgani uchun **butun
`student_risk_scores` jadvalini o'qib, xotirada guruhlaydi**. Indeks yo'qligi bilan
birga: **butun jadval seq scan + sort**. Va bu **dashboard so'rovi** — har kirishda
ishlaydi.

`latestByGroup` (`risk.service.ts:189`) — bir xil naqsh.

### 9.2. Birinchi qadam — materialized view emas, indeks

**Bu — TZ ning eng arzon va eng foydali tavsiyasi.** Migratsiya:

```sql
-- migration: 000006_analytics_indexes
-- ⚠️ Production'da CONCURRENTLY ishlatiladi (jadvalni bloklamaydi).
-- Prisma migrate tranzaksiya ichida ishlaydi, CONCURRENTLY esa tranzaksiyada
-- ishlamaydi → bu migratsiya QO'LDA, deploy oynasida bajariladi va keyin
-- `prisma migrate resolve --applied` bilan belgilanadi.

-- Xavf: "oxirgi skor" naqshi (risk.service.ts:237, :199, :319; ranking.service.ts:66)
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_risk_scores_student_calc_idx
  ON student_risk_scores (student_id, calculated_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_risk_scores_tenant_calc_idx
  ON student_risk_scores (tenant_id, calculated_at DESC);

-- Timeline (students.service.ts:625)
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_timeline_student_created_idx
  ON student_timeline (student_id, created_at DESC);

-- Outcome statistikasi (certificates.service.ts:689)
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_outcomes_tenant_status_idx
  ON student_outcomes (tenant_id, outcome_status);

-- Tarix (students.service.ts:605, :615 va 8-bo'limdagi so'rovlar)
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_group_history_student_start_idx
  ON student_group_history (student_id, start_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS student_living_history_student_start_idx
  ON student_living_history (student_id, start_date DESC);

-- Kohort so'rovlari (8.4)
CREATE INDEX CONCURRENTLY IF NOT EXISTS students_tenant_gradyear_idx
  ON students (tenant_id, expected_graduation_year) WHERE archived_at IS NULL;

-- Snapshot (ranking.service.ts:221, :371)
CREATE INDEX CONCURRENTLY IF NOT EXISTS grade_snapshots_tenant_group_period_idx
  ON grade_snapshots (tenant_id, group_id, period_start DESC);
```

⚠️ **Bu indekslar `schema.prisma` ga ham `@@index` sifatida qo'shiladi**, aks holda
keyingi `prisma migrate dev` ularni **drift** deb hisoblab o'chirishga urinadi. Bu —
oson qilinadigan xato.

**Kutilgan ta'sir — halol:** bir necha yuz o'quvchida seq scan ham tez (jadval RAM'da).
Ya'ni bugun **foydalanuvchi farqni sezmasligi mumkin**. Indekslar 10 tenant × 3 yil
ma'lumot bo'lganda kerak bo'ladi. Lekin ular **hozir qo'shiladi**, chunki: (a) arzon,
(b) jadval kichik ekan `CONCURRENTLY` soniyalar oladi, (c) 500K qatorda buni qilish
alohida loyihaga aylanadi.

### 9.3. Materialized view — qachon?

**Hozircha erta.** Sabab — o'lchov:

```
1 akademiya × ~300 faol o'quvchi
student_risk_scores: har o'quvchiga ~10 skor  ≈ 3 000 qator
student_timeline:    har o'quvchiga ~10 voqea ≈ 3 000 qator
student_outcomes:    ≈ 300 qator
grade_snapshot_rows: 12 davr × 300          ≈ 3 600 qator
```

Bu — **Postgres uchun hech nima**. `student_outcomes` bo'yicha `groupBy` 300 qatorda
indekssiz ham < 5ms. Materialized view bu yerda **murakkablik qo'shadi va hech nima
bermaydi** (yangilash strategiyasi, eskirish, cron — 5.3 da ko'rdik, cron yo'q).

**Chegara — o'lchov bilan, taxmin bilan emas.** Materialized view **quyidagilardan
kamida ikkitasi** bajarilganda muhokama qilinadi:

| Ko'rsatkich | Chegara | Qanday o'lchanadi |
|---|---|---|
| Analitik so'rov p95 kechikishi | **> 500ms** | APM / `pg_stat_statements` |
| `grade_snapshot_rows` hajmi | **> 5 000 000 qator** | `SELECT count(*)` |
| Analitik so'rovlar CPU ulushi | **> 20%** | `pg_stat_statements.total_exec_time` |
| Dashboard ochilishi | **> 2s** | Frontend RUM |

⚠️ **Bularning hech birini hozir o'lchab bo'lmaydi** — kanon § 6 ga ko'ra
observability **yo'q** (structured logging, metrics, tracing — yo'q).

**Ya'ni birinchi qadam materialized view emas, `pg_stat_statements`.** Busiz har
qanday optimizatsiya — ko'r-ko'rona.

```sql
-- postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Haftalik tekshiruv: eng qimmat 20 so'rov
SELECT substring(query, 1, 80) AS q, calls,
       round(mean_exec_time::numeric, 2)  AS mean_ms,
       round(total_exec_time::numeric, 0) AS total_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### 9.4. Read replica — undan ham erta

Read replica **OLTP va OLAP yuklamasini ajratish** uchun. Bu mantiqiy, lekin:

- **Narx:** ikkinchi DB instance — infratuzilma xarajati ikki barobar
- **Murakkablik:** Prisma ikkita `datasource` ni tabiiy qo'llab-quvvatlamaydi.
  Ikkita `PrismaClient` yoki `@prisma/extension-read-replicas` kerak
- **Replication lag:** "snapshot yaratdim, ko'rinmayapti" — yangi bag sinfi
- ⚠️ **Tenant izolyatsiyasi:** kanon § 5.1 — tenant **845 chaqiruv nuqtasida qo'lda**. Read
  replica **yana bir yo'l** qo'shadi. Prisma extension bilan strukturaviy izolyatsiya
  qilinmaguncha (kanon § 5.1 — TZ ning markaziy vazifasi) **ikkinchi ulanish yo'lini
  ochish xavfli**

**Chegara:** read replica **faqat** shu ikkisi bajarilgandan keyin:
1. Tenant izolyatsiyasi Prisma extension'ga ko'chirilgan (kanon § 5.1)
2. Analitik so'rovlar primary DB CPU'sining **> 30%** ini yeyapti (o'lchangan)

### 9.5. Ustuvorlik

| # | Ish | Narx | Foyda | Qachon |
|---|---|---|---|---|
| 1 | `pg_stat_statements` | Bir necha soat | **O'lchash imkoniyati** | ✅ Hozir |
| 2 | Analitik indekslar (9.2) | 1 kun | Kelajakni himoya qiladi | ✅ Hozir |
| 3 | `getRiskSummary` ni SQL agregatga (`DISTINCT ON` + `GROUP BY`) | 1 kun | Dashboard | O'lchovdan keyin |
| 4 | Materialized view | 1 hafta+ | ⚠️ Hozir nol | 9.3 chegarasi |
| 5 | Read replica | Katta | ⚠️ Hozir nol | 9.4 chegarasi |

---

## 10. ⚠️ Etika

> Bu bo'lim ixtiyoriy emas. Tizim **voyaga yetmagan bolalar** haqida **salbiy
> bashorat** qiladi va uni **kattalarga ko'rsatadi**.

### 10.1. Muammoning aniq shakli

3-bo'lim isbotladi: skor — validatsiya qilinmagan subyektiv baho, **muallifi
yozilmagan** (3.5.1). 10-bo'lim savol beradi: **shunday bo'lsa ham, uni kim ko'rishi
kerak?**

Uch aniq xavf bor va **ikkitasi hozir mavjud**.

### 10.1.1. ⚠️ Javobgarlik — hozir hech kimda

Bu — 3.5.1 ning etik ko'rinishi va u boshqa hamma narsadan oldin turadi.

**Bugungi holat:**

```
Bola RED yorlig'ini oldi.
  Kim qo'ydi?          → ⚠️ NOMA'LUM (created_by_user_id yo'q, schema.prisma:842)
  Nimaga asoslanib?    → ⚠️ NOMA'LUM (signals = {manual: true}, risk.service.ts:60)
  Qachon hisoblandi?   → ⚠️ Hisoblanmagan (calculated_at = new Date(), :70)
  Kim javobgar?        → ⚠️ HECH KIM
```

Ya'ni tizim **bolaga salbiy yorliq qo'yadi** va **hech kim uni himoya qilmaydi** —
chunki uni **kim qo'ygani ham yozilmagan**.

⚠️ **Bu — tizimning eng jiddiy etik kamchiligi**, `GET /guardian/risk` dan ham
oldinroq. Sababi: guardian endpoint'ini o'chirish mumkin, lekin javobgarliksizlik —
**tuzilishda**.

Va u **tuzatilishi oson** (3.5.1: bitta ustun, bitta qator kod). Shuning uchun u
Bosqich 0 ga kiritildi.

**Prinsip:**

> Bolaga yorliq qo'ygan har bir qaror — **imzolangan** bo'lishi kerak.
> Imzosiz yorliq — javobgarliksiz hokimiyat.

### 10.1.2. ⚠️ Avtomatlashtirilganda javobgarlik kimda? — OCHIQ SAVOL

Bu — 4-bo'lim amalga oshirilgandan **keyin** paydo bo'ladigan savol, va uni **hozir**
qo'yish kerak, chunki javob dizaynga ta'sir qiladi.

Bugun (yomon, lekin oddiy):

```
Ustoz "78" yozdi → ustoz javobgar (agar 3.5.1 tuzatilsa)
```

4-bo'limdan keyin (yaxshiroq, lekin murakkab):

```
Formula "72" chiqardi → kim javobgar?
```

**Nomzodlar va ularning muammosi:**

| Kim | Nega mantiqiy | ⚠️ Nega yetarli emas |
|---|---|---|
| Og'irliklarni sozlagan odam | U qaror qildi | U bu bolani **ko'rmagan** ham |
| Formulani yozgan muhandis | U kod yozdi | U **ta'lim mutaxassisi emas** |
| Skorni ko'rgan kurator | U harakat qiladi | U formulani **tushunmaydi** |
| Akademiya rahbari | U tizimni joriy qildi | 300 bolaga **jismonan yeta olmaydi** |
| ⚠️ **Hech kim** | — | **Bu — real va eng ehtimolli natija** |

**"Hech kim" javobi — avtomatlashtirishning klassik xavfi.** Formula **javobgarlikni
yo'q qilmaydi, uni tarqatib yuboradi** — va tarqalgan javobgarlik = javobgarlik yo'q.
Har kim "tizim shunday dedi" deydi.

Bu — 4.1.1 dagi dizayn qarorining **asosiy sababi**:

> **`manual_score` odamni sxemada saqlaydi** (human-in-the-loop).
> Yakuniy skor `manual_score ?? computed_score` bo'lgani uchun —
> **odam har doim oxirgi so'zga ega**, ya'ni **har doim javobgar**.

Ya'ni 4.1.1 — nafaqat aniqlik uchun (ustoz ko'proq ko'radi), balki **javobgarlik
uchun**. Formula **maslahat beradi**, odam **qaror qiladi**, va qaror **imzolanadi**
(`created_by_user_id`, `manual_reason`).

⚠️ **Lekin bu to'liq yechim emas — halol bo'lish kerak:**

Agar formula 300 o'quvchiga skor chiqarsa va kurator ularning 290 tasiga **tegmasa** —
u "qaror qildi"mi yoki **shunchaki rozi bo'ldi**mi? Bu — **avtomatlashtirish
xotirjamligi** (automation complacency): odam formal ravishda javobgar, amalda —
rezina muhr.

**Bu savolga TZ javob bera olmaydi.** U — akademiya boshqaruvi savoli:

- RED yorlig'ini **tasdiqlash** talab qilinadimi? (ya'ni kurator ko'rmaguncha skor
  **hech kimga ko'rinmaydi**)
- Tasdiqlanmagan RED — **kimga ham ko'rinmaydi**mi yoki faqat "tasdiq kutmoqda"mi?
- Agar kurator 2 hafta tasdiqlamasa — nima bo'ladi?

⚠️ **TZ pozitsiyasi — bitta qat'iy tavsiya:** agar avtomatik skor joriy qilinsa,
**RED darajasi tasdiqsiz ko'rsatilmaydi**. GREEN/YELLOW — avtomatik ko'rinishi mumkin.
RED — **odam ko'rib, imzolashi shart**. Sabab: RED — bu **harakat talab qiladigan
ayblov**, va ayblovni mashina qo'ymaydi.

Bu — **ochiq savol sifatida qoldiriladi** (11-bo'lim), chunki u tashkiliy sig'imga
bog'liq: agar kuratorda haftasiga 40 ta RED tasdiqlash vaqti bo'lmasa — bu qoida
**qog'ozda qoladi** va yomonroq bo'ladi (tasdiq bor deb o'ylanadi, aslida yo'q).

### 10.2. Xavf 1 — O'qituvchi ko'radi (self-fulfilling prophecy)

**Mavjud holat — kod:** `apps/api/prisma/seed.ts:166`:

```ts
const TEACHER_PERMS = new Set([
  ...
  'ranking.read', 'risk.read',      // ← o'qituvchi xavf skorini ko'radi
  ...
]);
```

Ya'ni **har bir o'qituvchi** `GET /staff/risk/latest/group/:groupId`
(`risk.controller.ts:73`) orqali **butun guruhining** xavf darajasini ko'radi.

**Nima uchun bu jiddiy:** ta'lim psixologiyasida bu yaxshi hujjatlashtirilgan hodisa
(Rosenthal–Jacobson, "Pygmalion effekti"): o'qituvchining o'quvchi haqidagi kutilmasi
o'quvchi natijasiga **ta'sir qiladi**. O'qituvchi bolani "RED" deb ko'rsa, u:

- kamroq savol beradi ("baribir bilmaydi")
- kamroq kutadi
- va bola **haqiqatan** yomonroq natija ko'rsatadi

**Sirkulyar halokat:** skor bashorat qildi → o'qituvchi munosabatini o'zgartirdi →
bola qulab tushdi → skor **"to'g'ri chiqdi"** → skorga ishonch **ortdi**.

⚠️ Bu backtesting'ni (4-bo'lim) ham buzadi: skor o'zi yaratgan natijani "bashorat
qilgan" bo'lib ko'rinadi.

**Bu — 4.4.3 dagi aralashuv paradoksining qora tomoni.** Aralashuv ijobiy bo'lsa
(qo'shimcha dars) — skor "xato" ko'rinadi, aslida ishladi. Salbiy bo'lsa (voz kechish)
— skor "to'g'ri" ko'rinadi, aslida **sabab bo'ldi**.

**TZ tavsiyasi:**

1. **O'qituvchi xom skorni ko'rmaydi.** `risk.read` o'rniga o'qituvchi **harakatni**
   ko'radi:

   > ❌ "Aziz — RED, 78 ball"
   > ✅ "Aziz — matematika bo'yicha qo'shimcha mashg'ulot tavsiya etiladi"

   Sabab: xodimga **yorliq** emas, **vazifa** kerak. Vazifa foydali, yorliq zararli.

2. **Kurator/admin xom skorni ko'radi** — chunki resurs taqsimlaydi (kimga qo'shimcha
   o'qituvchi). Bu — tizimli qaror, shaxsiy munosabat emas.

3. **Har ko'rish audit'ga yoziladi.** `risk.read` allaqachon RBAC ostida, lekin
   `GET` so'rovlari audit qilinmaydi (`risk.service.ts:103` — `listRisk` da
   `auditLogger` chaqiruvi **yo'q**, faqat `setRisk` da bor, `:74`). Bolalar haqidagi
   sezgir bashorat uchun **o'qish ham audit qilinadi**.

⚠️ **Ochiq savol — halol:** o'qituvchidan ma'lumotni yashirish ham muammo. Kurator
bolani har kuni ko'radi va **skordan ko'ra ko'proq biladi**. Uni "himoya qilish" uchun
ko'r qilish — mensimaslik. Bu **akademiya rahbari bilan hal qilinadi**, muhandis
tomonidan emas.

### 10.3. ⚠️ Xavf 2 — Ota-ona ko'radi (endpoint mavjud!)

**Mavjud holat — kod.** `risk.controller.ts:106-123`:

```ts
@ApiTags('Guardian - Risk')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/risk')
export class GuardianRiskController {
  constructor(private readonly svc: RiskService) {}

  @Get()
  @ApiOperation({ summary: 'Get latest risk score for my child' })
  me(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianMe({ studentAccountId: String(user.studentAccountId || '') });
  }
}
```

Va `risk.service.ts:299-305` **xom skorni qaytaradi**:

```ts
return {
  student: { id: studentId.toString(), fullName: account.students.full_name },
  risk: latest || null,          // { score: 78, level: 'RED', calculated_at: ... }
};
```

**Frontend tekshiruvi:** `apps/web/src/pages/guardian/` da **12 sahifa** bor
(`GuardianDashboard`, `GuardianGrades`, `GuardianDiscipline`, ...) — **birortasi
risk ko'rsatmaydi**. Grep tasdiqladi: `apps/web/src` da `risk` faqat staff
fayllarida.

⚠️ **Ya'ni: API xavf skorini ota-onaga beradi, UI uni ko'rsatmaydi.**

Bu — **eng xavfli kombinatsiya**:
- Hech kim buni **maqsadli qaror** sifatida qabul qilmagan
- Hech kim buni **ko'rmaydi** (UI yo'q → hech kim tekshirmaydi)
- Lekin **API ochiq**. Guardian JWT'si bor har kim `curl` bilan oladi
- Kanon § 5.4: guardian login formati `<tenant-slug>-<student-id>` (`mathacademy-MA-0001`)
  — ya'ni **taxmin qilinadigan** identifikator

**Nima uchun bu jiddiy — texnik emas, insoniy:**

Ota-ona ekranda "Sizning farzandingiz: **QIZIL — 78/100**" ni ko'rsa:

- U **hech qanday kontekstni bilmaydi**. Bu nima? Kim qo'ydi? Nimaga asoslangan?
- U **qanday javob beradi?** Bolaga bosim. Jazо. Uyat. Qo'rquv.
- U **noto'g'ri bo'lishi mumkin** — 3-bo'lim: bu bir xodimning `<Input>` ga yozgan
  soni, validatsiya qilinmagan
- ⚠️ **Bola yotoqxonada.** U ota-onasini himoyalanish uchun ko'ra olmaydi. U 700 km
  narida, telefon orqali "sen qizilsan" eshitadi

**Bu — bir xodim bir marta noto'g'ri `78` yozsa, bola bir yil azob chekishi mumkin
degani.** Va hech qanday kafolat yo'q: skor uchun **ikkinchi tekshiruv yo'q**,
**tasdiqlash oqimi yo'q**, **o'zgartirish tarixi faqat audit'da**.

**TZ qarori — bu bo'limda yagona qat'iy talab:**

> ⚠️ **`GuardianRiskController` (`risk.controller.ts:106-123`) O'CHIRILADI.**
>
> Bugun. Boshqa hech qanday ish qilinmasa ham.
>
> **Sabab:** validatsiya qilinmagan subyektiv salbiy yorliqni voyaga yetmagan bolaning
> ota-onasiga kontekstsiz berish — hech qanday foyda bermaydi va real zarar keltirishi
> mumkin. UI unga ishonmagan (12 sahifadan birortasi ko'rsatmaydi). API ham ishonmasin.
>
> **Buzilish xavfi: nol** — birorta frontend uni chaqirmaydi.

`RiskService.guardianMe()` (`risk.service.ts:271`) ham olib tashlanadi (o'lik kod
qoldirmaslik — kanon § 6: "himoyaga o'xshagan o'lik kod — himoyasizlikdan yomonroq";
bu yerda teskarisi: **himoyasiz o'lik kod**).

**Keyinchalik nima ko'rsatiladi?** Ota-onaga **skor emas, fakt**:

- ✅ "Davomat: 82% (o'rtacha: 94%)" — fakt, tekshiriladigan, kontekstli
- ✅ "Matematika: 12/20 (guruh o'rtachasi: 15)" — fakt
- ❌ "Xavf: QIZIL" — hukm

Farq: fakt **muhokama qilinadi**, yorliq **yopishadi**.

### 10.4. Xavf 3 — O'quvchining o'zi

Hozir o'quvchiga alohida login yo'q — `student_accounts` guardian uchun
(`risk.service.ts:278` `student_accounts` → `students`; kanon § 4.2: guardian login
`<tenant-slug>-<student-id>`).

Lekin bilvosita: ota-ona ko'rsa → bola biladi. Va **displays** moduli bor
(`displays`, `display_playlists`, `display_items` — kanon § 4.2) — bino ichidagi
ekranlar.

⚠️ **Qat'iy talab:** xavf skori **hech qachon** `displays` ga chiqmaydi. Reyting
allaqachon ommaviy (`ranking` moduli) — bu bahsli, lekin hech bo'lmasa **natija**
(bola nazorat qiladi). Xavf skori — **hukm** (bola nazorat qilmaydi). Ommaviy xavf
yorlig'i — **ommaviy tahqirlash**.

Bu hozir **kodda taqiqlanmagan**, faqat hech kim qilmagani uchun sodir bo'lmagan.

### 10.5. Umumiy prinsiplar

1. **Skor — savol, javob emas.** "Bu bolaga qarash kerakmi?" — ha. "Bu bola
   kirmaydi" — **hech qachon**. UI tili shuni aks ettiradi.
2. **Yorliq emas, harakat.** Xodim ko'radigan chiqish — **vazifa**, sifat emas.
3. **Kontekstsiz raqam berilmaydi.** Skor ko'rsatilsa — signallar (4.3), sana, kim
   qo'ygani birga. `signals` maydoni shuning uchun kerak (3.6d).
4. **E'tiroz yo'li bo'lsin.** Kurator "bu noto'g'ri" desa — yozadi (`note` maydoni
   bor, `schema.prisma:850`) va bu ko'rinadi. Hozir yangi skor qo'yish mumkin
   (`setRisk` har doim `create`, `risk.service.ts:62` — tarix saqlanadi ✅), lekin
   e'tiroz **alohida tushuncha emas**.
5. **Eskirish.** 6 oylik skor — **ma'lumot emas, shovqin**. `calculated_at` bor
   (`schema.prisma:846`), lekin hech qayerda tekshirilmaydi. Tavsiya: **90 kundan
   eski skor "eskirgan"** deb belgilanadi va `getRiskSummary` da alohida hisoblanadi.
6. **Bolalar ma'lumoti — yurist savoli.** Kanon § 10: yuridik maslahat berilmaydi.
   O'zbekiston "Shaxsga doir ma'lumotlar to'g'risida"gi qonuni bu **hosila
   (derived) bashorat** ma'lumotiga qanday qo'llanadi — **yuristga**. Ayniqsa: ota-ona
   roziligi kerakmi? Bola 18 yoshga to'lganda skor o'chiriladimi? Bu savollar
   **muhandis tomonidan hal qilinmaydi**.

### 10.6. Qaror va ochiq qolgani

| Savol | Holat |
|---|---|
| Ota-ona xom skorni ko'radimi? | ✅ **HAL QILINDI: yo'q.** Endpoint o'chiriladi (10.3) |
| Displays'ga chiqadimi? | ✅ **HAL QILINDI: hech qachon** (10.4) |
| Skorlanmagan GREEN ko'rinadimi? | ✅ **HAL QILINDI: yo'q**, `NOT_ASSESSED` (3.6a) |
| Skor validatsiyasiz ko'rsatiladimi? | ✅ **HAL QILINDI:** "o'qituvchi bahosi" yorlig'i (Bosqich 0) |
| Skorni kim qo'ygani yoziladimi? | ✅ **HAL QILINDI: ha**, `created_by_user_id` (3.5.1, 10.1.1) |
| Qo'lda kiritish o'chiriladimi? | ✅ **HAL QILINDI: yo'q**, u saqlanadi (4.1.1) |
| Odam formulani yenga oladimi? | ✅ **HAL QILINDI: ha**, `manual_score ?? computed_score` (4.1.1) |
| O'qituvchi xom skorni ko'radimi? | ⚠️ **OCHIQ** — akademiya rahbari qaror qiladi (10.2) |
| **Avtomatlashtirilganda javobgar kim?** | ⚠️ **OCHIQ** — 10.1.2. TZ javob bera olmaydi |
| RED tasdiqlashni talab qiladimi? | ⚠️ **OCHIQ** — tashkiliy sig'imga bog'liq (10.1.2) |
| Bola 18 ga to'lganda skor o'chadimi? | ⚠️ **OCHIQ** — yurist |
| Ota-ona roziligi kerakmi? | ⚠️ **OCHIQ** — yurist |

---

## 11. Ochiq savollar

### Mahsulot / akademiya rahbari uchun

1. **Outcome kim va qachon yozadi?** 2.5e ko'rsatdi: bu jarayon **belgilanmagan**, va
   `UNKNOWN` butun analitikani buzadi. Kim mas'ul? Qanday muddat? Bitiruvchilar bilan
   aloqa qanday saqlanadi? **Bu — texnik emas, tashkiliy savol, va u 4-bo'limdagi
   hamma narsani hal qiladi.**
2. **Xavf skori bugun ishlatiladimi?** Xodimlar `RiskPage` ga son kiritadimi yoki
   sahifa bo'sh turibdimi? Agar hech kim ishlatmasa — 4-bo'lim boshqa ustuvorlik
   oladi. `SELECT count(*) FROM student_risk_scores` — **javob bir so'rovda**.
3. **Skorni kim qo'yadi?** Kurator? Direktor? Kelishuv yo'li bilanmi? Bu 10.2 ni hal
   qiladi.
4. **O'qituvchi xom skorni ko'rishi kerakmi?** (10.2). Ikki tomon ham asosli.
5. **Muvaffaqiyat mezoni oldindan kelishiladimi?** 4.3 da `recall ≥ 0.6`,
   `precision ≥ 2× baseRate` taklif qilindi. Agar backtest natijasi bundan past bo'lsa
   — **skor o'chiriladimi?** Bu savolga **hozir** javob berish kerak, natijani
   ko'rgandan keyin emas.
6. **Qamrov chegarasi 80% to'g'rimi?** (2.5e). Past chegara — yolg'on raqam. Yuqori —
   hech qachon raqam yo'q.
7. ⚠️ **Avtomatlashtirilganda javobgar kim?** (10.1.2). TZ `manual_score` orqali
   odamni sxemada saqlaydi, lekin **automation complacency** ni hal qilmaydi.
   **Boshqaruv savoli.**
8. ⚠️ **RED tasdiqsiz ko'rsatiladimi?** (10.1.2). TZ "yo'q" deb tavsiya qiladi, lekin
   bu **tashkiliy sig'imga** bog'liq — haftasiga 40 ta RED ni kim tasdiqlaydi?
9. ⚠️ **Reyting formulasi — qaysi biri to'g'ri?** (3.6c). Bu **buzuvchi o'zgarish**:
   o'quvchilarning o'rni **o'zgaradi**. Yig'indi + `weight` + `DENSE_RANK` tavsiya
   etiladi (DTM mantiqi), lekin **akademiya qaror qiladi**. Va o'quvchilarga
   e'lon qilinadi.
10. ⚠️ **Jonli reyting `weight` ni e'tiborsiz qoldirgani — bag mi yoki qaror mi?**
    (3.6c). Ehtimol bag. Lekin agar akademiya ataylab "kundalik reyting sodda
    bo'lsin" degan bo'lsa — unda snapshot noto'g'ri. **Kimdir buni bilishi kerak.**

### Texnik

11. ⚠️ **`SELECT outcome_status, count(*) FROM student_outcomes GROUP BY 1` — natija
    nima?** (2.5d-5). **Bu birinchi ishga tushiriladigan so'rov.** Butun 4-bo'lim
    shunga bog'liq: agar `UNIVERSITY_ADMIT` yoki `''` chiqsa — ground truth
    **allaqachon iflos** va uni **akademiya** tozalashi kerak (muhandis emas — qaysi
    qiymat nimaga map qilinishini faqat u biladi).
12. **`student_outcomes` 1:1 qoladimi?** (2.5a). Qayta topshirgan o'quvchi — bu real
    holat va qimmatli signal. `@unique` olib tashlansa — API va UI o'zgaradi.
13. **Qolgan string ustunlar enum'ga o'tadimi?** (2.5d-6). `students.status`,
    `period_type`, `event_type` — har biri alohida qaror. **69 modelni birdan emas.**
14. **`period_type` qiymatlari qaysi?** (5.4b). `academic_years` bilan qanday
    bog'lanadi? CHECK constraint uchun ro'yxat kerak.
15. **Eski `grade_snapshot_rows` bilan nima qilinadi?** (5.5, 3.6c). Ularning
    `risk_level` **ham**, `total_score`/`rank` **ham** ishonchsiz (boshqa formula).
    `formula_version` bilan belgilanadimi yoki tashlab yuboriladimi? ⚠️ Agar
    tashlansa — backtesting uchun tarix **qolmaydi**.
16. **Track tarixi backfill qilinadimi?** (7.5c). `audit_logs` da `students` UPDATE
    yozuvlari `track_id` ni saqlaganmi — **tekshirilishi kerak**. Agar yo'q — o'tmish
    yo'qolgan.
17. **`toDateOnly` vaqt zonasi.** (7.5a). `Asia/Tashkent` qattiq yoziladimi yoki
    tenant sozlamasidan olinadimi? Ko'p akademiyali mahsulot uchun — ikkinchisi, lekin
    `tenants` da timezone maydoni bormi?

### Ustuvorlik

18. **Kanon § 5.1 (tenant izolyatsiyasi) va bu hujjat — qaysi biri birinchi?**
    Bu hujjatda taklif qilingan har bir yangi so'rov — **yana bitta qo'lda
    `tenant_id`**. Ya'ni analitikani kengaytirish 845 raqamini oshiradi. Ehtimol
    javob: Prisma extension **avval**, keyin analitika. Lekin unda 4-bo'lim
    kechikadi.
19. **Testlar.** Kanon § 3: amalda nol test. Backtesting **kodi** — statistik logika,
    va u xato bo'lsa **hech kim bilmaydi** (natija "shunchaki raqam"). Agar bitta
    joyda test yozilsa — **`risk-backtest.service.ts` da yozilsin**. Leakage testi
    (`asOf` dan keyingi ma'lumot o'qilmasligi) — **majburiy**.

---

## Xulosa — bir paragrafda

Bu tizim **natijani kuzatadi** — va bu uni raqiblardan ajratadi. `student_outcomes`
ishlaydi va akademiyaning haqiqiy KPI'sini yozadi. **Lekin kuzatuvning o'zi
ishonchsiz**, va buni uchta o'lchangan fakt ko'rsatadi: (1) `outcome_status` — enum
emas, oddiy `VarChar(30)`, ya'ni **KPI label'i cheklanmagan** va u `a3dab30` da
allaqachon bir marta buzilgan; (2) reyting **ikki xil hisoblanadi** — snapshot
`SUM`+`weight`+`DENSE_RANK`, jonli ekran `AVG`, `weight`siz, indeks-rank (`weight`
butun modulda **bir marta** uchraydi, `ranking.service.ts:46`), ya'ni tarix ekran
bilan **bir xil dunyoni** yozmaydi; (3) bo'shliq **GREEN bilan to'ldiriladi**
(`risk.service.ts:214,330`, `ranking.service.ts:79`) — tizim "bilmayman" o'rniga
"yaxshi" deydi va buni **tarixga muzlatadi**. Xavf skorining o'zi esa bashorat emas
— u `risk tracking`, `risk detection` emas: `risk.service.ts:58` HTTP body'dan kelgan
sonni saqlaydi, birorta signal o'qimaydi, `levelFromScore` (100/3) — sof **rang
funksiyasi**, va `created_by_user_id` **umuman yo'q** (`schema.prisma:842`) — ya'ni
bolaga yorliq qo'yiladi, muallifi **yozilmaydi**. Yaxshi xabar **katta**: ML'da eng
qiyin, ko'pincha imkonsiz qism — **label** — bu yerda **allaqachon bor**
(`student_outcomes`), signallar ham bor (davomat, baho, intizom, to'lov). Ikkala devor
turibdi, **ko'prik yo'q**. Uni qurish — ML'siz, oddiy og'irlik va logistik regressiya
bilan, **ustozni sxemada saqlagan holda** (`manual_score ?? computed_score` — chunki
ustoz "otasi kasal" ni ko'radi, model ko'rmaydi). Tartib qat'iy: **enum → NOT_ASSESSED
→ yagona formula → backtest → skor**; teskarisi — ishonchli yolg'on. Va eng shoshilinch
ish skor bilan bog'liq emas: `GET /guardian/risk` (`risk.controller.ts:113`) bu
tekshirilmagan, muallifsiz skorni **bugun ota-onaga beradi** — birorta UI uni
chaqirmaydi, ya'ni o'chirish narxi **nol**. Va eng arzon texnik g'alaba: 68 jadvalli
bazada **bitta indeks bor**.
