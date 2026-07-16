# 07 — DTM baholash mexanizmi (Assessment Engine)

> **Status:** taklif (RFC) · **Muallif:** TZ · **Sana:** 2026-07
> **Kanon:** [`CANON.md`](./CANON.md) §4.1 · **Modullar:** `assessments`, `student-tracks`, `ranking`
> **Bog'liq:** hech qanday yangi modul qo'shilmaydi — mavjud `assessments` ichida `core/dtm` qatlami tug'iladi

Bu hujjat loyihaning **domen yuragi** haqida. `mathacademy` — davomat va to'lovni
hisoblaydigan CRM emas. U **DTM'ga tayyorlaydigan akademiya** uchun qurilgan, va
DTM 189 ballik tizimi — akademiyaning mavjudlik sababi. Agar bu qoida noto'g'ri
bo'lsa, qolgan 62 783 qator kodning ma'nosi yo'q.

Hujjatning markaziy da'vosi qisqa: **189 ball qoidasi hozir domen qatlamida emas,
u frontendda yashaydi.** Quyida bu aniq fayl va qator bilan ko'rsatiladi, oqibati
o'lchanadi, va ishlaydigan yechim beriladi.

---

## 1. DTM nima

**DTM** — O'zbekiston Respublikasi **Davlat test markazi**. Oliy ta'lim
muassasalariga (OTM) kirish uchun abituriyentlar topshiradigan yagona test
imtihonini tashkil qiladi. Akademiyaning butun o'quv jarayoni — dars jadvali,
blok testlar, reyting, xavf skori — shu bitta imtihonga qaratilgan.

### 1.1. Format — veb-qidiruv bilan tasdiqlangan

Kanon (§4.1) da yozilgan format **tasdiqlandi**. Qidiruv natijalari
2025/2026 va 2026/2027 o'quv yillari uchun bir xil ma'lumot beradi:

| Fakt | Qiymat | Manba |
|---|---|---|
| Maksimal ball | **189** | [infoedu.uz](https://infoedu.uz/maksimal-ball-bu-yil-ham-189-0-boladi), [oliygoh.uz](https://oliygoh.uz/post/2026-yil-qabulida-maksimal-ball-ozgarmadi-189-ball-boladi) |
| Jami savollar | **90 ta** | [oliygoh.uz](https://oliygoh.uz/post/maksimal-ball-189-boladi-5-ta-fan-90-ta-test-3-soat-vaqt) |
| Jami fanlar | **5 ta** (2 ixtisoslik + 3 majburiy) | [infoedu.uz](https://infoedu.uz/abituriyentlar-kirish-imtihonida-quyidagi-blok-fanlardan-ball-toplashlari-mumkin) |
| Imtihon davomiyligi | **3 soat (180 daqiqa)** | [oliygoh.uz](https://oliygoh.uz/post/maksimal-ball-189-boladi-5-ta-fan-90-ta-test-3-soat-vaqt) |
| Noto'g'ri javob uchun jarima | **yo'q** (ball ayirilmaydi) | [infoedu.uz](https://infoedu.uz/maksimal-ball-bu-yil-ham-189-0-boladi) |
| 2026 uchun o'zgarish | **yo'q** — "baholash tizimi o'zgarishsiz qoldi" | [infoedu.uz](https://infoedu.uz/maksimal-ball-bu-yil-ham-189-0-boladi) |

**Majburiy 3 fan qat'iy belgilangan:** ona tili (o'zbek / rus / qoraqalpoq),
matematika, O'zbekiston tarixi.

### 1.2. ⚠️ Nimani tasdiqlash kerak

Halol bo'lish uchun — quyidagilar qidiruvda **aniq tasdiqlanmadi**, ular
implementatsiyadan oldin rasmiy manbadan (dtm.uz, Vazirlik qarori) tekshirilsin:

- **`MANDATORY` fanlar ro'yxati konfiguratsiya qilinadimi?** Matematika ba'zi
  yo'nalishlarda `MAIN` bo'lishi mumkin (masalan, aniq fanlar bloki). U holda
  u bir vaqtda majburiy ham, asosiy ham bo'ladimi, yoki majburiy blokdan
  chiqib ketadimi? — **tasdiqlash kerak.** Bu modelga bevosita ta'sir qiladi.
- **Ballning kasr qismi qanday yaxlitlanadi** — DTM rasmiy natijasi 189,0
  ko'rinishida 1 kasr xonasi bilan beriladi. Yaxlitlash qoidasi (yarim yuqoriga?)
  rasmiy hujjatda topilmadi — **tasdiqlash kerak.**
- **Imtiyoz/qo'shimcha ballar** (olimpiada g'oliblari va h.k.) 189 ustiga
  qo'shiladimi yoki alohida hisoblanadimi — **tasdiqlash kerak.** Hozir tizimda
  bu tushuncha umuman yo'q.

Bu noaniqliklar quyidagi dizaynni **buzmaydi**: aynan shuning uchun koeffitsiyentlar
kodda konstanta sifatida bir joyda saqlanadi (§5) va versiyalash ko'rib chiqiladi (§11).

---

## 2. 189 ball tarkibi

### 2.1. Rasmiy taqsimot

| Blok | Rol | Savol | Har savol | Maksimal |
|---|---|---:|---:|---:|
| Ixtisoslik 1-fan | `MAIN` | 30 | **3.1** | **93.0** |
| Ixtisoslik 2-fan | `SECONDARY` | 30 | **2.1** | **63.0** |
| Ona tili | `MANDATORY` | 10 | **1.1** | **11.0** |
| Matematika | `MANDATORY` | 10 | **1.1** | **11.0** |
| O'zbekiston tarixi | `MANDATORY` | 10 | **1.1** | **11.0** |
| **Jami** | | **90** | | **189.0** |

Oraliq yig'indilar:
- **Ixtisoslik bloki** = 93 + 63 = **156 ball** (manbalarda shu nom bilan uchraydi)
- **Majburiy blok** = 3 × 11 = **33 ball**
- **156 + 33 = 189**

### 2.2. Kanondagi bir noaniqlikni aniqlashtirish

Kanon §4.1 da majburiy blok `3 × 11 = 33` deb yozilgan. Bu **natija** bo'yicha
to'g'ri, lekin **birlik** bo'yicha chalg'itadi: `11` — bu koeffitsiyent emas, bitta
fanning maksimal balli (10 savol × 1.1). Kod yozilganda bu farq muhim, chunki
funksiya kirishi **savol soni** (0..10), koeffitsiyent esa **1.1**. Frontend
buni to'g'ri qilgan (`AssessmentsPage.tsx:72` da `(m1+m2+m3) * 1.1`), lekin
matn darajasida chalkashlik bor — quyidagi kodda `QUESTIONS` va `COEFFICIENT`
alohida konstantalar sifatida ajratilgan.

---

## 3. Modellashtirish — track va track_subjects

### 3.1. Sxema (mavjud, `prisma/schema.prisma`)

DTM'da fan roli abituriyentga emas, **yo'nalishga** (track) bog'liq. Sxema buni
to'g'ri modellashtirgan:

```prisma
// schema.prisma:979
enum SubjectRole {
  MAIN
  SECONDARY
  MANDATORY
}

// schema.prisma:885
model student_tracks {
  id              BigInt            @id @default(autoincrement())
  tenant_id       BigInt
  name            String
  description     String?
  color           String?
  created_at      DateTime          @default(now()) @db.Timestamptz(6)
  groups          groups[]
  students        students[]
  track_subjects  track_subjects[]

  @@unique([tenant_id, name])
}

// schema.prisma:985
model track_subjects {
  id          BigInt       @id @default(autoincrement())
  tenant_id   BigInt
  track_id    BigInt
  subject_id  BigInt
  role        SubjectRole  @default(MANDATORY)
  created_at  DateTime     @default(now()) @db.Timestamptz(6)

  @@unique([tenant_id, track_id, subject_id])
}
```

Bu — **loyihadagi yagona enum** (kanon §3). Va u aynan DTM uchun. Bu tasodif emas:
DTM roli — domendagi eng qat'iy cheklangan qiymatlar to'plami.

### 3.2. ⚠️ MAIN/SECONDARY yagonaligi — kanon da'vosi XATO

Kanon §4.1 da: *"Track ichida MAIN va SECONDARY **yagona** bo'lishi tekshiriladi
(`tracks.service.ts:280`)"*.

**Bu da'vo noto'g'ri, va kanon tuzatildi.** `tracks.service.ts:281-292` da
"tekshiruv" bor, lekin u **hech narsani rad etmaydi — jimgina ustidan yozadi**
va `{ ok: true }` qaytaradi:

```ts
// apps/api/src/modules/student-tracks/tracks.service.ts:273
async addSubject(args: { tenantId: string; trackId: string; subjectId: string; role?: string }) {
  try {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const track_id = toBigInt(args.trackId, 'trackId');
    const subject_id = toBigInt(args.subjectId, 'subjectId');
    const role = (args.role as SubjectRole) || SubjectRole.MANDATORY;

    // Check MAIN/SECONDARY uniqueness per track
    if (role === SubjectRole.MAIN || role === SubjectRole.SECONDARY) {
      const existing = await this.prisma.track_subjects.findFirst({
        where: { tenant_id, track_id, role },
      });
      if (existing) {
        await this.prisma.track_subjects.update({   // ← ⚠️ jimgina ALMASHTIRADI
          where: { id: existing.id },
          data: { subject_id },
        });
        return { ok: true };                        // ← ⚠️ xato qaytmaydi
      }
    }
    // ...
```

Ya'ni yagonalik **kafolatlanadi**, lekin **sukut bilan**. Oqibatlari:

1. **Ma'lumot jimgina yo'qoladi.** Trackda `MAIN = Matematika` bo'lsa va xodim
   xato bilan `MAIN = Fizika` qo'shsa — Matematika **MAIN bo'lishdan to'xtaydi**,
   hech kim xabar olmaydi. Track endi Matematikasiz.
2. **Yagonalik faqat servis kodida.** `@@unique([tenant_id, track_id, subject_id])`
   bor, lekin `@@unique([tenant_id, track_id, role])` **yo'q**. Ya'ni DB darajasida
   bitta trackda 2 ta `MAIN` bo'lishi mumkin. Agar biror kod `track_subjects` ga
   to'g'ridan-to'g'ri yozsa (seed, migratsiya, kelajakdagi import) — cheklov yo'q.
3. **Audit log yo'q.** `addSubject` da `auditLogger` chaqirilmaydi, holbuki shu
   fayldagi `create`/`update`/`delete` metodlari chaqiradi. Ya'ni trackning DTM
   tarkibi o'zgarishi — domendagi eng muhim o'zgarishlardan biri — **iz qoldirmaydi**.

**Taklif (§5.4 da kod bilan):** `MAIN`/`SECONDARY` almashtirish **aniq niyat**
bo'lsin (`replace: true` flag), aks holda `409 SUBJECT_ROLE_ALREADY_TAKEN`.
Va DB darajasida partial unique index qo'shilsin:

```sql
-- migration: 000002_dtm_track_role_uniqueness
CREATE UNIQUE INDEX track_subjects_one_main_per_track
  ON track_subjects (tenant_id, track_id)
  WHERE role = 'MAIN';

CREATE UNIQUE INDEX track_subjects_one_secondary_per_track
  ON track_subjects (tenant_id, track_id)
  WHERE role = 'SECONDARY';
```

> **Migratsiya ogohlantirishi:** bu indeksni qo'shishdan oldin mavjud ma'lumotni
> tekshirish shart — agar biror trackda allaqachon 2 ta `MAIN` bo'lsa, migratsiya
> ishlamaydi. Tekshiruv so'rovi:
> ```sql
> SELECT tenant_id, track_id, role, count(*)
> FROM track_subjects WHERE role IN ('MAIN','SECONDARY')
> GROUP BY 1,2,3 HAVING count(*) > 1;
> ```
> Bo'sh natija — migratsiya xavfsiz.

### 3.3. ⚠️ Va kattarog'i: track to'liqligi HECH QAYERDA tekshirilmaydi

§3.2 — muammoning kichik yarmi. Kattasi quyida, va u butun DTM modelining
poydevoriga tegadi.

DTM blok testi **aniq tuzilishni** talab qiladi: **1 MAIN + 1 SECONDARY +
3 MANDATORY**. Bu 5 fan, boshqacha bo'lishi mumkin emas — chunki 30 + 30 +
10×3 = 90 savol, va 93 + 63 + 33 = 189 ball. Tarkib buzilsa, **189 soni
ma'nosini yo'qotadi**.

Butun backend bo'yicha qidiruv:

```
$ grep -rn "MANDATORY" --include=*.ts apps/api/src/ | grep -v dto
apps/api/src/modules/student-tracks/tracks.service.ts:278:
      const role = (args.role as SubjectRole) || SubjectRole.MANDATORY;
```

**`MANDATORY` butun backendda BIR MARTA uchraydi — va u yerda ham shunchaki
default qiymat.** Hech bir servis track tarkibini tekshirmaydi.

Aniq tekshirilgan holatlar:

| Savol | Javob | Dalil |
|---|---|---|
| **0 ta MANDATORY bilan track bo'ladimi?** | ✅ **Ha** — bu har yangi trackning **boshlang'ich holati** | `CreateTrackDto` da `subjects` maydoni **yo'q** (faqat `name`, `description`, `color`). `tracks.service.ts:49` fansiz track yaratadi |
| **5 ta MANDATORY bo'ladimi?** | ✅ **Ha, cheklovsiz** | `addSubject:281` faqat `MAIN`/`SECONDARY` ni maxsus ko'radi. `MANDATORY` to'g'ridan-to'g'ri `upsert` ga ketadi — sanoq yo'q |
| **MAIN ni o'chirib tashlash mumkinmi?** | ✅ **Ha** | `removeSubject:305` — `deleteMany`, hech qanday tekshiruvsiz. Blok testi bor trackdan MAIN ni olib tashlash mumkin |
| **Blok test yaratishda track to'liqligi tekshiriladimi?** | ❌ **Yo'q** | `grep -n "track" assessments.service.ts` → **bo'sh natija**. 987 qatorlik servis `track` so'zini **umuman bilmaydi** |

**Ya'ni: yaroqsiz track ustiga yaroqsiz blok test quriladi va tizim jim turadi.**

Ketma-ketlik aniq:

1. Xodim track yaratadi → **0 fan** bilan. Hech qanday ogohlantirish.
2. Unga 4 ta `MANDATORY` qo'shadi, `MAIN` qo'shishni unutadi. Hech qanday ogohlantirish.
3. Shu trackdagi guruhga `BLOCK_TEST` yaratadi → `max_score = 189` (frontend
   `AssessmentsPage.tsx:710` shunday qo'yadi). **Qabul qilinadi.**
4. Ball kiritiladi → frontend `scoringGroupSubjects[0]` ni "asosiy" deb oladi
   (§4.5) — bu aslida `MANDATORY` fan. **`×3.1` majburiy fanga tushadi.**
5. Ball reytingga kiradi (§8), snapshot'ga muzlatiladi (§9).

Hech bir qadamda xato yo'q. Natija — **189 ball hisoblanmagan, u shunchaki
yozib qo'yilgan son**.

Bu §4 dagi muammoning **ikkinchi yarmi**, va u chuqurroq:

> §4: **189 ball qoidasi** majburlanmaydi (`max_score: 500` o'tadi).
> §3.3: **DTM tarkibining o'zi** majburlanmaydi (MAIN'siz track o'tadi).

Ikkinchisi birinchisidan yomonroq, chunki `max_score: 500` **ko'rinadi** —
u UI da "500" bo'lib turadi. MAIN'siz track esa **ko'rinmaydi**: blok test
189 ballik bo'lib ko'rinadi, ballar chiroyli hisoblanadi, va hammasi
noto'g'ri.

---

## 4. ⚠️ ASOSIY MUAMMO: 189 qoidasi frontendda

Bu — hujjatning sababi. Quyida muammo **to'liq**, fayl va qator bilan.

### 4.1. Qoida qayerda yashaydi

DTM mantig'i **frontendning 3 ta faylida**, backendda **umuman yo'q**.

**(a) `AssessmentsPage.tsx:66-73` — hisoblash formulasi:**

```tsx
// apps/web/src/pages/staff/AssessmentsPage.tsx:66
function calcDtmTotal(b: BlockRow): number {
  const main = parseFloat(b.main) || 0;
  const secondary = parseFloat(b.secondary) || 0;
  const m1 = parseFloat(b.m1) || 0;
  const m2 = parseFloat(b.m2) || 0;
  const m3 = parseFloat(b.m3) || 0;
  return Math.round((main * 3.1 + secondary * 2.1 + (m1 + m2 + m3) * 1.1) * 10) / 10;
}
```

**(b) `AssessmentsPage.tsx:710` — max_score ni UI belgilaydi:**

```tsx
// apps/web/src/pages/staff/AssessmentsPage.tsx:704
<Select
  value={form.type}
  onValueChange={(v) =>
    setForm({
      ...form,
      type: v,
      maxScore: v === 'BLOCK_TEST' ? '189' : form.maxScore,  // ← 710-qator
    })
  }
>
```

`189` — bu yerda **literal**. Bu tizimdagi yagona joy bo'lib, `BLOCK_TEST` ni
189 ballga bog'laydi. Va bu — brauzerdagi `onValueChange` callback ichida.

**(c) `AssessmentsPage.tsx:500-503, 516, 719, 727` — qoida matn sifatida:**

```tsx
// 499-504
<div className="... text-amber-700 ...">
  <span>Asosiy ×3.1 (maks 93)</span>
  <span>Qo'shimcha ×2.1 (maks 63)</span>
  <span>Majburiy ×1.1 (maks 11×3=33)</span>
  <span className="font-black">Jami: 189 ball</span>
</div>
// 516
<div className="text-center text-primary font-black">/189</div>
// 719
<SelectItem value="BLOCK_TEST">Blok test (DTM — 189 ball)</SelectItem>
// 727
DTM: Asosiy 93 + Qo'shimcha 63 + Majburiy 3×11 = 189 ball
```

**(d) `GuardianGrades.tsx:83-87` — formulaning IKKINCHI nusxasi:**

```tsx
// apps/web/src/pages/guardian/GuardianGrades.tsx:82
{[
  { label: 'Asosiy',      val: main,      max: 30, pts: main * 3.1 },
  { label: "Qo'shimcha",  val: secondary, max: 30, pts: secondary * 2.1 },
  { label: 'Maj.1',       val: m1,        max: 10, pts: m1 * 1.1 },
  { label: 'Maj.2',       val: m2,        max: 10, pts: m2 * 1.1 },
  { label: 'Maj.3',       val: m3,        max: 10, pts: m3 * 1.1 },
].map(...)}
```

**(e) `TracksPage.tsx:52, 357` — formulaning UCHINCHI nusxasi:**

```tsx
// apps/web/src/pages/staff/TracksPage.tsx:52
{ value: 'MAIN', label: 'Asosiy fan', desc: '30 savol × 3.1 ball = 93 ball', icon: Star },
// TracksPage.tsx:357
Jami: 93 + 63 + 11×3 = 189 ball
```

**Xulosa:** koeffitsiyent `3.1` **3 ta faylda mustaqil yozilgan**. DTM ertaga
koeffitsiyentni o'zgartirsa, uni 3 joyda topib almashtirish kerak. Bittasini
unutish — jimgina noto'g'ri ball.

### 4.2. Backendda nima bor

**Sxema — hech qanday DTM bilimi yo'q:**

```prisma
// schema.prisma:53
model assessments {
  id                        BigInt   @id @default(autoincrement())
  tenant_id                 BigInt
  academic_year_id          BigInt
  group_id                  BigInt
  subject_id                BigInt
  type                      String   @db.VarChar(30)     // ← enum EMAS (§7)
  title                     String
  max_score                 Decimal  @default(100) @db.Decimal(8, 2)   // ← 189 haqida bilmaydi
  weight                    Decimal  @default(1.000) @db.Decimal(6, 3)
  held_at                   DateTime @db.Timestamptz(6)
  // ...
}
```

**Servis — `max_score` mijozdan olinadi:**

```ts
// apps/api/src/modules/assessments/assessments.service.ts:110
const assessment = await tx.assessments.create({
  data: {
    tenant_id,
    academic_year_id: group.academic_year_id,
    group_id,
    subject_id,
    type: args.dto.type,
    title: args.dto.title.trim(),
    max_score: args.dto.maxScore ?? 100,   // ← 118-qator: MIJOZDAN. Tekshiruv yo'q
    weight: args.dto.weight ?? 1.0,        // ← 119-qator: DTM koeffitsiyenti yo'q
    held_at,
    is_published_to_guardians: args.dto.publishToGuardians ?? false,
    created_by_user_id,
  },
  // ...
});
```

987 qatorlik `assessments.service.ts` da `189` soni **bir marta ham uchramaydi**.
`BLOCK_TEST` so'zi ham uchramaydi. Servis `type` ni shunchaki `String` sifatida
o'tkazadi.

**DTO — faqat diapazon tekshiradi, DTM'ni emas:**

```ts
// apps/api/src/modules/assessments/dto/create-assessment.dto.ts:46
@ApiProperty({
  example: 'WEEKLY_TEST',
  enum: ['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'],
})
@IsString()
@IsIn(['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'])
type!: string;

// create-assessment.dto.ts:71
@IsOptional()
@Type(() => Number)
@IsNumber({ maxDecimalPlaces: 2 })
@Min(1)
@Max(1000)          // ← 1..1000 oralig'idagi ISTALGAN son o'tadi
maxScore?: number = 100;
```

### 4.3. Natija — API nimani qabul qiladi

Kanon §4.1 da: *"API `BLOCK_TEST` ni `max_score: 500` bilan ham qabul qiladi"*.
**Tasdiqlandi**, va aniqroq chegara bilan:

```http
POST /staff/assessments
Content-Type: application/json

{
  "groupId": "1",
  "subjectId": "5",
  "title": "1-Blok test",
  "type": "BLOCK_TEST",
  "maxScore": 500,          ← ✅ QABUL QILINADI (1..1000 oralig'ida)
  "heldAt": "2026-03-01T10:00:00+05:00"
}
→ 201 Created
```

Chegaralar aniq:

| `maxScore` | Natija | Sabab |
|---|---|---|
| `189` | ✅ qabul | to'g'ri |
| `500` | ✅ **qabul** | ⚠️ `@Max(1000)` o'tkazadi — DTM buzilgan |
| `1` | ✅ **qabul** | ⚠️ `@Min(1)` o'tkazadi — DTM buzilgan |
| `1001` | ❌ rad | `@Max(1000)` — lekin bu DTM emas, tasodifiy chegara |
| `0` / manfiy | ❌ rad | `@Min(1)` |

Ya'ni **himoya bor, lekin u DTM himoyasi emas** — u shunchaki "son aqlli
oraliqda bo'lsin" degan umumiy sanity check. `BLOCK_TEST` va `189` o'rtasidagi
bog'liqlik backendda **umuman mavjud emas**.

Yana bir oqibat — `upsertScores` da:

```ts
// assessments.service.ts:460
// Validate score doesn't exceed max_score
if (Number(item.score) > Number(assessment.max_score)) {
  throw new BadRequestException(
    `SCORE_EXCEEDS_MAX: ${item.score} > ${assessment.max_score}`,
  );
}
```

Bu tekshiruv **to'g'ri**, lekin u `max_score` ga ishonadi. Agar `max_score = 500`
bo'lsa, blok testga **400 ball** qo'yish mumkin. Va bu ball reytingga kiradi (§8).

### 4.4. ⚠️ Alohida topilgan muammo: block test tarkibi `teacher_comment` da

Kodni o'qishda kanondan tashqari muammo topildi va u DTM uchun jiddiy.

Blok testning fanlar bo'yicha taqsimoti **hech qayerda strukturaviy saqlanmaydi**.
Frontend uni JSON qilib **`teacher_comment` matn maydoniga** tiqadi:

```tsx
// apps/web/src/pages/staff/AssessmentsPage.tsx:275
return {
  studentId: s.id,
  score: total,
  teacherComment: JSON.stringify({    // ← ⚠️ izoh maydoni ma'lumot ombori sifatida
    main: parseFloat(b.main) || 0,
    secondary: parseFloat(b.secondary) || 0,
    m1: parseFloat(b.m1) || 0,
    m2: parseFloat(b.m2) || 0,
    m3: parseFloat(b.m3) || 0,
  }),
};
```

Va guardian tomoni uni qayta parse qiladi (`GuardianGrades.tsx`), `try/catch` bilan
(`AssessmentsPage.tsx:210-222` — `catch {}`, ya'ni **xato jimgina yutiladi**).

Nima uchun bu jiddiy:

1. **`teacher_comment` — `@MaxLength(500)`** (`upsert-scores.dto.ts`). JSON
   sig'adi, lekin bu tasodif. Maydon izoh uchun mo'ljallangan.
2. **O'qituvchi izoh yozolmaydi.** Blok testda izoh maydoni JSON bilan band —
   ya'ni funksiya jimgina yo'qolgan.
3. **Fanlar bo'yicha tahlil qilib bo'lmaydi.** "Guruhda matematika bo'yicha
   o'rtacha necha ball?" — bu savolga SQL bilan javob bo'lmaydi, chunki ma'lumot
   matn ichida. Akademiya uchun bu — **eng kerakli hisobot**.
4. **`m1/m2/m3` qaysi fan ekani noma'lum.** JSON da faqat pozitsiya bor, fan ID si yo'q.

### 4.5. ⚠️ Va eng yomoni: rollar umuman ishlatilmaydi

Bu — eng kutilmagan topilma. `track_subjects.role` (`MAIN`/`SECONDARY`/`MANDATORY`)
butun DTM modeli poydevori. Lekin **blok test UI si undan foydalanmaydi**:

```tsx
// apps/web/src/pages/staff/AssessmentsPage.tsx:180
// For BLOCK_TEST: fetch group detail to get group subjects for column headers
const { data: scoringGroupRes } = useQuery({
  queryKey: ['staff', 'groups', 'detail', detail?.group?.id],
  queryFn: async () => (await api.get(`/staff/groups/${detail!.group.id}`)).data,
  enabled: !!detail?.group?.id && isBlockTest,
});
const scoringGroupSubjects: any[] = (scoringGroupRes?.data || scoringGroupRes)?.subjects || [];
// Map group subjects to block-test column roles by index
const mainSubject = scoringGroupSubjects[0];              // ← ⚠️ INDEKS bo'yicha!
const secondarySubject = scoringGroupSubjects[1];         // ← ⚠️ INDEKS bo'yicha!
const mandatorySubjects = scoringGroupSubjects.slice(2, 5); // ← ⚠️ INDEKS bo'yicha!
```

Ya'ni "asosiy fan" — bu **`group_subjects` massivining 0-elementi**. `role` emas.
`student_tracks` emas. `track_subjects` emas. **Massiv tartibi.**

Va `group_subjects` da tartib kafolati **yo'q**:

```prisma
// schema.prisma:492
model group_subjects {
  group_id   BigInt
  subject_id BigInt
  @@id([group_id, subject_id])
}
```

Bu jadvalda `ORDER BY` uchun ustun ham yo'q (`created_at` yo'q, `position` yo'q).
Ya'ni PostgreSQL qaytaradigan tartib — **kafolatlanmagan**. Bugun ishlashi mumkin,
`VACUUM` yoki plan o'zgarishidan keyin — o'zgarishi mumkin.

**Oqibati aniq va og'ir:** agar guruh fanlari tartibi o'zgarsa, `×3.1`
koeffitsiyenti **noto'g'ri fanga** qo'llanadi. O'quvchining asosiy fani
qo'shimcha sifatida hisoblanadi. Ball jimgina noto'g'ri bo'ladi — hech qanday
xato, hech qanday ogohlantirish. **Bu ma'lumot buzilishi (data corruption).**

Demak kanon §4.1 dagi "189 qoidasi frontendda" da'vosi **haqiqatdan ham
yumshoqroq**. To'g'rirog'i: **189 qoidasi frontendda, va u yerda ham noto'g'ri
manbadan o'qiydi.** `SubjectRole` enum'i mavjud, to'ldirilgan, lekin blok test
uni **umuman o'qimaydi**.

### 4.6. Nega bu muhim

Kanon bu loyihaning **DEMO EMAS** ekanini ta'kidlaydi — real xodimlar, real
ota-onalar. Shu kontekstda:

- **Mobil ilova yozilsa** — `calcDtmTotal` ni Swift/Kotlin da **qayta yozish**
  kerak. Ikki implementatsiya = vaqt o'tib ikki xil natija. Qaysi biri to'g'ri?
- **Ma'lumot bazasida yaroqsiz blok testlar paydo bo'ladi.** `max_score = 500`
  bo'lgan `BLOCK_TEST` — bu shunchaki xato yozuv emas, u **reytingga kiradi**
  (§8) va **snapshot ga muzlatiladi** (§9). Keyin uni tuzatib bo'lmaydi:
  tarixiy snapshot allaqachon noto'g'ri.
- **Integratsiya/import.** Yangi tenant onboarding qilinsa (kanon §6) va
  ma'lumot CSV dan import qilinsa — brauzer ishtirok etmaydi, ya'ni **hech qanday
  DTM tekshiruvi yo'q**.
- **Bu qoida qonun emas, lekin qonunga yaqin.** DTM formatini akademiya
  belgilamaydi — uni davlat belgilaydi. Domen qoidasi tashqi va qat'iy bo'lsa,
  u UI da emas, domen qatlamida yashashi kerak.

### 4.7. ⚠️ Yo'l-yo'lakay topilgan buzuq funksiya (DTM emas, lekin shu modul)

`AssessmentsPage.tsx` "Tahrirlash" va "O'chirish" tugmalariga ega
(`432-445-qatorlar`), ular `useCrud` orqali:

```ts
// apps/web/src/hooks/useCrud.ts:69
const update = async (id: string | number, body: any) => {
  const res = await api.patch(`${endpoint}/${id}`, body);   // → PATCH /staff/assessments/:id
  // ...
const remove = async (id: string | number) => {
  await api.delete(`${endpoint}/${id}`);                    // → DELETE /staff/assessments/:id
```

Lekin `assessments.controller.ts` da bunday route **yo'q**. Mavjud route'lar:

```
@Post()                        → yaratish
@Get()                         → ro'yxat
@Get('statistics/group/:groupId')
@Get('summary')
@Get('summary/upcoming')
@Get(':id')
@Post(':id/scores')
@Patch(':id/publish')          ← yagona PATCH, va u ':id' emas
```

`@Patch(':id')` va `@Delete(':id')` **mavjud emas**. `assessments.service.ts`
da ham `update`/`delete` metodi yo'q (987 qator o'qildi — yo'q).

**Ya'ni blok testni tahrirlash va o'chirish ishlamaydi — 404 qaytadi.** Bu DTM
muammosi emas, lekin shu modulda va TZ ni bajaruvchi buni bilishi kerak.
⚠️ **Tekshirilsin:** bu bilib qilingan qarormi (baho o'zgarmas bo'lishi kerak —
bu mantiqiy!) yoki unutilganmi? Agar birinchisi bo'lsa — **UI dan tugmalar
olib tashlansin**. Agar ikkinchisi — route qo'shilsin. Hozirgi holat — eng yomoni:
tugma bor, bosiladi, jimgina ishlamaydi.

---

## 5. Yechim: DTM'ni domen qatlamiga ko'chirish

### 5.1. Tamoyil

DTM qoidasi **sof funksiya**: kirish — javoblar soni, chiqish — ball. Unda
ma'lumot bazasi yo'q, HTTP yo'q, NestJS yo'q. Demak u **Nest'ga bog'liq
bo'lmasligi kerak**.

Yangi katalog: `apps/api/src/core/dtm/`. Nega `common/` emas — `common/` da
infratuzilma (pipe, guard, util) yashaydi; `core/` da **domen bilimi**. Bu farq
muhim: `core/dtm` ni hech qanday mock'siz test qilish mumkin.

⚠️ **Diqqat:** `apps/api/src/` da hozir `core/` **yo'q** (faqat `common`,
`modules`, `prisma`). Bu — yangi katalog. Kanon §8 "yangi modul qo'shma" deydi
— `core/dtm` **NestJS moduli emas**, u shunchaki funksiyalar to'plami.
28 modul o'zgarishsiz qoladi.

```
apps/api/src/core/dtm/
├── dtm-scoring.constants.ts   — konstantalar (yagona haqiqat manbai)
├── dtm-scoring.types.ts       — tiplar
├── dtm-scoring.ts             — calculateBlockTestScore()
├── dtm-validation.ts          — validateBlockTest()
├── index.ts                   — public API
└── __tests__/
    ├── dtm-scoring.spec.ts
    └── dtm-scoring.property.spec.ts
```

### 5.2. Konstantalar

```ts
// apps/api/src/core/dtm/dtm-scoring.constants.ts
import { Decimal } from '@prisma/client/runtime/library';

/**
 * DTM (Davlat Test Markazi) block-test scoring rules.
 *
 * Source of truth for the 189-point system. Verified 2026-07 against:
 *  - https://infoedu.uz/maksimal-ball-bu-yil-ham-189-0-boladi
 *  - https://oliygoh.uz/post/2026-yil-qabulida-maksimal-ball-ozgarmadi-189-ball-boladi
 *
 * Format confirmed unchanged for the 2025/2026 and 2026/2027 admission years.
 *
 * ⚠️ These values are set by the state, not by the academy. Never edit them to
 * "make a test fit". If DTM changes the format, see docs/07 §11 (versioning).
 */

/** Points awarded per correct answer, by subject role. */
export const DTM_COEFFICIENT = {
  MAIN: new Decimal('3.1'),
  SECONDARY: new Decimal('2.1'),
  MANDATORY: new Decimal('1.1'),
} as const;

/** Number of questions per subject, by role. */
export const DTM_QUESTION_COUNT = {
  MAIN: 30,
  SECONDARY: 30,
  MANDATORY: 10,
} as const;

/** Exactly how many subjects a complete DTM track must have, by role. */
export const DTM_SUBJECT_COUNT = {
  MAIN: 1,
  SECONDARY: 1,
  MANDATORY: 3,
} as const;

/** Maximum points obtainable per role-block (coefficient × questions × subjects). */
export const DTM_MAX_BY_ROLE = {
  MAIN: new Decimal('93.0'),       // 3.1 × 30 × 1
  SECONDARY: new Decimal('63.0'),  // 2.1 × 30 × 1
  MANDATORY: new Decimal('33.0'),  // 1.1 × 10 × 3
} as const;

/** The number this whole system exists for. */
export const DTM_MAX_TOTAL = new Decimal('189.0');

/** Total questions in a real DTM exam sitting. */
export const DTM_TOTAL_QUESTIONS = 90;

/** Decimal places in an official DTM result (e.g. "178.2"). */
export const DTM_SCORE_PRECISION = 1;
```

`DTM_MAX_BY_ROLE` — hosila qiymat, uni hisoblab chiqarish mumkin edi. Lekin
konstanta sifatida yozildi va **test uni hisoblangan qiymat bilan solishtiradi**
(§10). Bu — ikki tomonlama tekshiruv: agar kimdir koeffitsiyentni o'zgartirsa
va maksimalni unutsa, test yiqiladi.

### 5.3. Hisoblash — sof funksiya

```ts
// apps/api/src/core/dtm/dtm-scoring.types.ts
import { Decimal } from '@prisma/client/runtime/library';
import { SubjectRole } from '@prisma/client';

/** One subject's result in a block test: how many questions the student got right. */
export interface SubjectAnswers {
  subjectId: string;
  role: SubjectRole;
  correctAnswers: number;
}

/**
 * A DTM-valid track. Note the shapes: exactly one MAIN, exactly one SECONDARY,
 * and a 3-tuple of MANDATORY — not Subject[].
 *
 * This is the point: an invalid track cannot be *expressed* in this type.
 * `mandatory: Subject[]` would let a 4-subject track compile; the tuple does not.
 * The only way to obtain a DtmTrack is through validateDtmTrack(), so every
 * function accepting one gets completeness for free — no defensive re-checking.
 */
export interface DtmTrack {
  main: TrackSubjectShape;
  secondary: TrackSubjectShape;
  mandatory: [TrackSubjectShape, TrackSubjectShape, TrackSubjectShape];
}

/** A fully computed DTM block-test score. */
export interface DtmScore {
  total: Decimal;
  byRole: {
    MAIN: Decimal;
    SECONDARY: Decimal;
    MANDATORY: Decimal;
  };
  bySubject: Array<{
    subjectId: string;
    role: SubjectRole;
    correctAnswers: number;
    points: Decimal;
  }>;
}
```

```ts
// apps/api/src/core/dtm/dtm-scoring.ts
import { Decimal } from '@prisma/client/runtime/library';
import { SubjectRole } from '@prisma/client';
import {
  DTM_COEFFICIENT,
  DTM_QUESTION_COUNT,
  DTM_SUBJECT_COUNT,
  DTM_MAX_TOTAL,
} from './dtm-scoring.constants';
import type { SubjectAnswers, DtmScore } from './dtm-scoring.types';

/** Thrown when input violates the DTM format. Framework-free on purpose. */
export class DtmError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'DtmError';
  }
}

/**
 * Convert a set of per-subject correct-answer counts into a DTM block-test score.
 *
 * Pure: no I/O, no Prisma, no Nest. Deterministic for a given input.
 * All arithmetic is Decimal — see docs/07 §6 for why.
 *
 * @throws DtmError if the answer set does not form a valid DTM sitting.
 */
export function calculateBlockTestScore(answers: SubjectAnswers[]): DtmScore {
  assertValidAnswerSet(answers);

  const byRole = {
    MAIN: new Decimal(0),
    SECONDARY: new Decimal(0),
    MANDATORY: new Decimal(0),
  };

  const bySubject = answers.map((a) => {
    const points = DTM_COEFFICIENT[a.role].mul(a.correctAnswers);
    byRole[a.role] = byRole[a.role].add(points);
    return {
      subjectId: a.subjectId,
      role: a.role,
      correctAnswers: a.correctAnswers,
      points,
    };
  });

  const total = byRole.MAIN.add(byRole.SECONDARY).add(byRole.MANDATORY);

  // Defensive: this must be impossible if assertValidAnswerSet is correct.
  // If it ever fires, the constants and the validator have drifted apart.
  if (total.greaterThan(DTM_MAX_TOTAL)) {
    throw new DtmError(
      'DTM_INVARIANT_VIOLATED',
      `Computed ${total.toString()} > max ${DTM_MAX_TOTAL.toString()}`,
    );
  }

  return { total, byRole, bySubject };
}

/** Validate that an answer set matches the DTM format exactly. */
function assertValidAnswerSet(answers: SubjectAnswers[]): void {
  const counts: Record<SubjectRole, number> = {
    MAIN: 0,
    SECONDARY: 0,
    MANDATORY: 0,
  };

  const seen = new Set<string>();

  for (const a of answers) {
    if (seen.has(a.subjectId)) {
      throw new DtmError('DTM_DUPLICATE_SUBJECT', `Subject ${a.subjectId} appears twice`);
    }
    seen.add(a.subjectId);

    if (!Number.isInteger(a.correctAnswers) || a.correctAnswers < 0) {
      throw new DtmError(
        'DTM_INVALID_ANSWER_COUNT',
        `correctAnswers must be a non-negative integer, got ${a.correctAnswers}`,
      );
    }

    const max = DTM_QUESTION_COUNT[a.role];
    if (a.correctAnswers > max) {
      throw new DtmError(
        'DTM_ANSWER_COUNT_EXCEEDS_QUESTIONS',
        `${a.role} has ${max} questions, got ${a.correctAnswers} correct`,
      );
    }

    counts[a.role]++;
  }

  for (const role of ['MAIN', 'SECONDARY', 'MANDATORY'] as const) {
    if (counts[role] !== DTM_SUBJECT_COUNT[role]) {
      throw new DtmError(
        'DTM_INCOMPLETE_TRACK',
        `Expected exactly ${DTM_SUBJECT_COUNT[role]} ${role} subject(s), got ${counts[role]}`,
      );
    }
  }
}
```

Diqqat qilinsin: bu funksiya **`role` bo'yicha** ishlaydi — massiv indeksi bo'yicha
emas (§4.5 dagi bag shu yerda tuzatiladi). `subjectId` har fanda mavjud, ya'ni
"qaysi fan necha ball berdi" **strukturaviy** javob bo'ladi (§4.4 tuzatiladi).

### 5.4. Validatsiya — assessment darajasida

```ts
// apps/api/src/core/dtm/dtm-validation.ts
import { Decimal } from '@prisma/client/runtime/library';
import { SubjectRole } from '@prisma/client';
import { DTM_MAX_TOTAL, DTM_SUBJECT_COUNT } from './dtm-scoring.constants';
import { DtmError } from './dtm-scoring';

export interface TrackSubjectShape {
  subjectId: string;
  role: SubjectRole;
}

export interface BlockTestShape {
  type: string;
  maxScore: Decimal | number | string;
  trackSubjects: TrackSubjectShape[];
}

/**
 * Parse a loose subject list into a DtmTrack, or fail.
 *
 * Deliberately a *parser*, not a checker: it returns the narrow type rather
 * than void. A checker leaves callers holding the same loose array they had
 * before and trusting that someone validated it; a parser hands back a value
 * whose type proves it. See §5.5 — the service can then never build a block
 * test on an incomplete track, because it has no DtmTrack to build it from.
 */
export function validateDtmTrack(subjects: TrackSubjectShape[]): DtmTrack {
  const byRole: Record<SubjectRole, TrackSubjectShape[]> = {
    MAIN: [],
    SECONDARY: [],
    MANDATORY: [],
  };

  const seen = new Set<string>();
  for (const s of subjects) {
    if (seen.has(s.subjectId)) {
      throw new DtmError('DTM_DUPLICATE_SUBJECT', `Subject ${s.subjectId} appears twice in track`);
    }
    seen.add(s.subjectId);
    byRole[s.role].push(s);
  }

  for (const role of ['MAIN', 'SECONDARY', 'MANDATORY'] as const) {
    if (byRole[role].length !== DTM_SUBJECT_COUNT[role]) {
      throw new DtmError(
        'DTM_TRACK_INCOMPLETE',
        `Track needs exactly ${DTM_SUBJECT_COUNT[role]} ${role} subject(s), has ${byRole[role].length}`,
      );
    }
  }

  return {
    main: byRole.MAIN[0],
    secondary: byRole.SECONDARY[0],
    // Safe: length checked to be exactly 3 above.
    mandatory: byRole.MANDATORY as [TrackSubjectShape, TrackSubjectShape, TrackSubjectShape],
  };
}

/**
 * A BLOCK_TEST is only valid at exactly 189.0 points, on a DTM-complete track.
 * Returns the parsed track so the caller can use it without re-deriving roles.
 */
export function validateBlockTest(assessment: BlockTestShape): DtmTrack {
  if (assessment.type !== 'BLOCK_TEST') {
    throw new DtmError('DTM_NOT_A_BLOCK_TEST', `Expected BLOCK_TEST, got ${assessment.type}`);
  }

  const max = new Decimal(assessment.maxScore.toString());
  if (!max.equals(DTM_MAX_TOTAL)) {
    throw new DtmError(
      'DTM_INVALID_MAX_SCORE',
      `BLOCK_TEST max_score must be ${DTM_MAX_TOTAL.toString()}, got ${max.toString()}`,
    );
  }

  return validateDtmTrack(assessment.trackSubjects);
}
```

### 5.5. Servis darajasida majburlash

**Asosiy qaror: `BLOCK_TEST` uchun `max_score` mijozdan OLINMAYDI — u
hisoblanadi.** Mijoz `maxScore` yuborsa ham, backend uni e'tiborsiz qoldiradi
(yoki qarama-qarshi bo'lsa rad etadi).

`assessments.service.ts:110-123` quyidagicha o'zgaradi:

```ts
// apps/api/src/modules/assessments/assessments.service.ts (create() ichida)
import { DTM_MAX_TOTAL, validateDtmTrack, DtmError, type DtmTrack } from '../../core/dtm';

// ... group va subject tekshiruvidan keyin, create() dan oldin:

// --- DTM: derive max_score for block tests instead of trusting the client ---
let max_score: Prisma.Decimal | number;
let dtmTrack: DtmTrack | null = null;

if (args.dto.type === 'BLOCK_TEST') {
  // A block test is a whole-track exam. Resolve the group's track.
  const groupWithTrack = await tx.groups.findFirst({
    where: { id: group_id, tenant_id },
    select: { track_id: true },
  });

  if (!groupWithTrack?.track_id) {
    throw new BadRequestException('BLOCK_TEST_REQUIRES_TRACK');
  }

  const trackSubjects = await tx.track_subjects.findMany({
    where: { tenant_id, track_id: groupWithTrack.track_id },
    select: { subject_id: true, role: true },
  });

  // Parse, don't check: past this line the track IS 1 MAIN + 1 SECONDARY + 3
  // MANDATORY, guaranteed by the type. Nothing downstream re-verifies it.
  try {
    dtmTrack = validateDtmTrack(
      trackSubjects.map((ts) => ({
        subjectId: ts.subject_id.toString(),
        role: ts.role,
      })),
    );
  } catch (e) {
    if (e instanceof DtmError) throw new BadRequestException(e.code);
    throw e;
  }

  // Not negotiable, and not the client's business.
  max_score = new Prisma.Decimal(DTM_MAX_TOTAL.toString());

  // Reject a client that thinks it knows better — silence would hide a real bug.
  if (args.dto.maxScore !== undefined && Number(args.dto.maxScore) !== 189) {
    throw new BadRequestException('BLOCK_TEST_MAX_SCORE_IS_DERIVED');
  }
} else {
  max_score = args.dto.maxScore ?? 100;
}

const assessment = await tx.assessments.create({
  data: {
    tenant_id,
    academic_year_id: group.academic_year_id,
    group_id,
    subject_id,
    type: args.dto.type,
    title: args.dto.title.trim(),
    max_score,                          // ← endi BLOCK_TEST uchun hisoblangan
    weight: args.dto.weight ?? 1.0,
    held_at,
    is_published_to_guardians: args.dto.publishToGuardians ?? false,
    created_by_user_id,
  },
  // ...
});
```

**⚠️ Diqqat — majburlash qayerda TURMAYDI.** `validateDtmTrack` **track
yaratishda chaqirilmaydi**. Bu ataylab: §3.3 ga ko'ra har yangi track 0 fan
bilan tug'iladi va fanlar keyin birma-bir qo'shiladi. Agar track har doim
to'liq bo'lishi talab qilinsa — **track yaratib bo'lmaydi**.

Shuning uchun chegara aniq:

| Nima | Qoida |
|---|---|
| Track yaratish / fan qo'shish | To'liqlik **talab qilinmaydi** — bu ish jarayoni |
| `BLOCK_TEST` yaratish | To'liqlik **majburiy** — bu DTM |
| `WEEKLY_TEST` va boshqalar | Trackka **umuman tegmaydi** |

Ya'ni "yaroqsiz track" mavjud bo'lishi mumkin — u shunchaki **blok test
ko'tara olmaydi**. Bu §3.3 dagi muammoni yechadi, ish oqimini buzmasdan.
(Muqobil: `is_dtm_ready` hosila maydoni, UI da ogohlantirish uchun —
§12/10c ochiq savol.)

**Nega `BLOCK_TEST_MAX_SCORE_IS_DERIVED` xatosi, jimgina e'tiborsizlik emas?**
Chunki mijoz `maxScore: 500` yuborsa — bu **bag**. Uni jimgina 189 ga
almashtirish bagni yashiradi. Xato qaytarish uni ko'rsatadi. (Bu — §3.2 dagi
`addSubject` xatosining aksi: u yerda jimgina almashtirish aynan muammo.)

**`addSubject` tuzatilishi** (§3.2 da va'da qilingan):

```ts
// apps/api/src/modules/student-tracks/tracks.service.ts
async addSubject(args: {
  tenantId: string;
  trackId: string;
  subjectId: string;
  role?: string;
  replace?: boolean;      // ← YANGI: almashtirish aniq niyat bo'lsin
  userId?: string;
  ipAddress?: string;
}) {
  try {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const track_id = toBigInt(args.trackId, 'trackId');
    const subject_id = toBigInt(args.subjectId, 'subjectId');
    const role = (args.role as SubjectRole) || SubjectRole.MANDATORY;

    if (role === SubjectRole.MAIN || role === SubjectRole.SECONDARY) {
      const existing = await this.prisma.track_subjects.findFirst({
        where: { tenant_id, track_id, role },
      });

      if (existing && existing.subject_id !== subject_id) {
        if (!args.replace) {
          // Was: silent overwrite. A track losing its MAIN subject without a
          // trace is a data-loss bug, not a convenience.
          throw new ConflictException('SUBJECT_ROLE_ALREADY_TAKEN');
        }

        const updated = await this.prisma.track_subjects.update({
          where: { id: existing.id },
          data: { subject_id },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: args.userId ? toBigInt(args.userId, 'userId') : null,
          action: 'UPDATE',
          entityType: 'track_subjects',
          entityId: updated.id,
          beforeData: { role, subjectId: existing.subject_id.toString() },
          afterData: { role, subjectId: subject_id.toString() },
          ipAddress: args.ipAddress,
        });

        return { ok: true, replaced: true };
      }
    }

    await this.prisma.track_subjects.upsert({
      where: { tenant_id_track_id_subject_id: { tenant_id, track_id, subject_id } },
      create: { tenant_id, track_id, subject_id, role },
      update: { role },
    });
    return { ok: true, replaced: false };
  } catch (error) {
    rethrowServiceError(error);
  }
}
```

### 5.6. Ballarni saqlash — javoblardan hisoblash

`upsertScores` blok test uchun **ball emas, javoblar sonini** qabul qiladi.
Bu §4.4 (JSON `teacher_comment` da) va §4.5 (indeks bo'yicha rol) muammolarini
birdaniga hal qiladi.

Yangi jadval kerak — bu **yagona sxema qo'shimchasi**:

```prisma
// schema.prisma — YANGI model
model block_test_subject_answers {
  assessment_id BigInt
  student_id    BigInt
  subject_id    BigInt
  role          SubjectRole
  correct_count Int         @db.SmallInt
  points        Decimal     @db.Decimal(6, 2)

  assessments assessments @relation(fields: [assessment_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  students    students    @relation(fields: [student_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  subjects    subjects    @relation(fields: [subject_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([assessment_id, student_id, subject_id])
}
```

Nega `points` ham saqlanadi, garchi u hosila bo'lsa: **DTM koeffitsiyenti
o'zgarishi mumkin** (§11). Agar faqat `correct_count` saqlansa va koeffitsiyent
o'zgarsa — eski testlar **qayta hisoblanib**, tarix o'zgarib ketadi. `points`
saqlanishi — bu "o'sha paytda shu ball berilgan" degan fakt.

Servisda:

```ts
// assessments.service.ts — upsertScores() ichida, BLOCK_TEST uchun tarmoq
if (assessment.type === 'BLOCK_TEST') {
  const trackSubjects = await tx.track_subjects.findMany({
    where: { tenant_id, track_id: group.track_id! },
    select: { subject_id: true, role: true },
  });

  const roleBySubject = new Map(
    trackSubjects.map((ts) => [ts.subject_id.toString(), ts.role]),
  );

  for (const item of args.dto.blockAnswers ?? []) {
    const answers: SubjectAnswers[] = item.subjects.map((s) => {
      const role = roleBySubject.get(s.subjectId);
      if (!role) {
        throw new BadRequestException(`SUBJECT_NOT_IN_TRACK: ${s.subjectId}`);
      }
      return { subjectId: s.subjectId, role, correctAnswers: s.correctAnswers };
    });

    // Domain layer does the maths. Service only persists.
    let computed: DtmScore;
    try {
      computed = calculateBlockTestScore(answers);
    } catch (e) {
      if (e instanceof DtmError) throw new BadRequestException(e.code);
      throw e;
    }

    const student_id = toBigInt(item.studentId, 'studentId');

    await tx.assessment_scores.upsert({
      where: { assessment_id_student_id: { assessment_id, student_id } },
      update: {
        score: new Prisma.Decimal(computed.total.toString()),
        teacher_comment: item.teacherComment?.trim() || null,  // ← endi haqiqiy izoh
        entered_by_user_id,
        entered_at: new Date(),
      },
      create: {
        assessment_id,
        student_id,
        score: new Prisma.Decimal(computed.total.toString()),
        teacher_comment: item.teacherComment?.trim() || null,
        entered_by_user_id,
        entered_at: new Date(),
      },
    });

    // Structured breakdown — queryable, unlike a JSON blob in a comment field.
    await tx.block_test_subject_answers.deleteMany({
      where: { assessment_id, student_id },
    });
    await tx.block_test_subject_answers.createMany({
      data: computed.bySubject.map((s) => ({
        assessment_id,
        student_id,
        subject_id: toBigInt(s.subjectId, 'subjectId'),
        role: s.role,
        correct_count: s.correctAnswers,
        points: new Prisma.Decimal(s.points.toString()),
      })),
    });
  }
}
```

Endi "guruhda matematika bo'yicha o'rtacha ball" — oddiy SQL:

```sql
SELECT s.name, AVG(b.points), AVG(b.correct_count)
FROM block_test_subject_answers b
JOIN subjects s ON s.id = b.subject_id
WHERE b.assessment_id = $1
GROUP BY s.name;
```

### 5.7. Frontend endi backenddan oladi

`calcDtmTotal` (`AssessmentsPage.tsx:66`) **o'chiriladi**. Ustunlar `role`
bo'yicha keladi, indeks bo'yicha emas. Yangi endpoint:

```ts
// GET /staff/assessments/:id/block-template
{
  "maxScore": "189.0",
  "subjects": [
    { "subjectId": "12", "name": "Matematika",  "role": "MAIN",      "questions": 30, "coefficient": "3.1", "maxPoints": "93.0" },
    { "subjectId": "13", "name": "Fizika",      "role": "SECONDARY", "questions": 30, "coefficient": "2.1", "maxPoints": "63.0" },
    { "subjectId": "1",  "name": "Ona tili",    "role": "MANDATORY", "questions": 10, "coefficient": "1.1", "maxPoints": "11.0" },
    { "subjectId": "2",  "name": "Matematika",  "role": "MANDATORY", "questions": 10, "coefficient": "1.1", "maxPoints": "11.0" },
    { "subjectId": "3",  "name": "Tarix",       "role": "MANDATORY", "questions": 10, "coefficient": "1.1", "maxPoints": "11.0" }
  ]
}
```

Frontend jonli oldindan ko'rish (preview) uchun ballni **shu javobdagi
`coefficient` bilan** ko'paytiradi — o'zida `3.1` yozmaydi:

```tsx
// UI preview only. The server recomputes and its answer wins.
const preview = template.subjects.reduce(
  (sum, s) => sum + (answers[s.subjectId] ?? 0) * parseFloat(s.coefficient),
  0,
);
```

Bu `TracksPage.tsx:52` va `GuardianGrades.tsx:83` uchun ham amal qiladi —
har uchala nusxa yo'qoladi.

### 5.8. Migratsiya yo'li

Ishlab turgan tizim. Bir kunda o'zgartirilmaydi. Bosqichlar:

| # | Qadam | Buzadimi? | Izoh |
|---|---|---|---|
| 1 | `core/dtm` + testlar qo'shish | ❌ yo'q | Hech kim chaqirmaydi. Sof qo'shimcha |
| 2 | `POST /assessments` da `BLOCK_TEST` uchun `max_score` hisoblash | ⚠️ ehtimol | Faqat 189 dan farqli yuboruvchi mijozni buzadi. Frontend allaqachon 189 yuboradi |
| 3 | `track_subjects` partial unique index | ⚠️ ehtimol | Avval §3.2 dagi tekshiruv so'rovi ishlatilsin |
| 3b | **Mavjud tracklarni audit qilish** | ❌ yo'q | Faqat `SELECT`. ⚠️ §3.3 ga ko'ra **yaroqsiz tracklar bugun mavjud bo'lishi kutiladi** — 2-qadam ularni buzadi |
| 4 | `block_test_subject_answers` jadvali (bo'sh) | ❌ yo'q | Yangi jadval |
| 5 | Backfill: `teacher_comment` JSON → yangi jadval | ❌ yo'q | Bir martalik skript. Eski ma'lumot joyida qoladi |
| 6 | `/block-template` endpoint | ❌ yo'q | Yangi route |
| 7 | Frontend `calcDtmTotal` → backend | ❌ yo'q | 2-qadamdan keyin |
| 8 | Eski JSON-in-comment o'qishni o'chirish | ❌ yo'q | 5 va 7 dan keyin |

**3b-qadam — bu majburiy, o'tkazib yuborilmasin.** §3.3 ga ko'ra tizim bugungacha
track to'liqligini **hech qachon** tekshirmagan. Ya'ni productionda yaroqsiz
tracklar bo'lishi **ehtimoli emas — kutilishi** kerak. 2-qadam ularni birdan
majburlaydi va **ishlab turgan akademiyada blok test yaratish to'xtaydi**.

Avval o'lchansin:

```sql
-- Qaysi tracklar DTM uchun yaroqsiz?
SELECT
  t.id,
  t.name,
  count(*) FILTER (WHERE ts.role = 'MAIN')      AS main_count,
  count(*) FILTER (WHERE ts.role = 'SECONDARY') AS secondary_count,
  count(*) FILTER (WHERE ts.role = 'MANDATORY') AS mandatory_count
FROM student_tracks t
LEFT JOIN track_subjects ts ON ts.track_id = t.id
GROUP BY t.id, t.name
HAVING count(*) FILTER (WHERE ts.role = 'MAIN')      <> 1
    OR count(*) FILTER (WHERE ts.role = 'SECONDARY') <> 1
    OR count(*) FILTER (WHERE ts.role = 'MANDATORY') <> 3;

-- Va: yaroqsiz track ustida allaqachon blok test bormi?
SELECT a.id, a.title, a.held_at, g.name AS group_name, t.name AS track_name
FROM assessments a
JOIN groups g         ON g.id = a.group_id
JOIN student_tracks t ON t.id = g.track_id
WHERE a.type = 'BLOCK_TEST'
  AND t.id IN ( /* yuqoridagi so'rov */ );
```

Ikkinchi so'rov bo'sh bo'lmasa — **bu allaqachon yuz bergan**: yaroqsiz blok
testlar bazada bor, ballari hisoblangan, reytingga kirgan.
⚠️ **Qaror kerak (akademiya bilan):** ular tuzatilsinmi, bekor qilinsinmi,
yoki "eski qoida bilan" belgilanib qoldirilsinmi (§11 versiyalash)? Bu —
**ma'lumot tuzatish ishi**, kod ishi emas, va uni TZ yolg'iz hal qila olmaydi.

**5-qadam (backfill) uchun ogohlantirish:** eski JSON da `m1/m2/m3` qaysi fan
ekani yozilmagan (§4.4). Ya'ni backfill `group_subjects` tartibiga **taxmin
qilib** tayanishi kerak — bu esa aynan §4.5 dagi ishonchsiz manba.
⚠️ **Qaror kerak:** eski blok testlarni backfill qilishga urinilsinmi (taxminiy,
noto'g'ri bo'lishi mumkin) yoki `score` (jami ball, u to'g'ri) saqlanib,
taqsimot tarixiy ma'lumot sifatida JSON da qoldirilsinmi? **Ikkinchisi
tavsiya etiladi** — noto'g'ri taqsimotni "aniq" qilib ko'rsatishdan ko'ra,
uni yo'q deb tan olish halolroq.

---

## 6. ⚠️ Pul emas, lekin baribir aniq son

### 6.1. Avval — kanondagi bir da'voni tuzatish

Bu bo'limning odatiy asosi shunday: *"3.1 × 30 float'da 92.99999... beradi"*.
**Bu da'vo noto'g'ri.** Tekshirildi:

```
$ node -e "console.log(30*3.1)"
93                    ← aniq 93. 92.999… emas
$ node -e "console.log(30*2.1)"
63
$ node -e "console.log(10*1.1)"
11
$ node -e "console.log(30*3.1 + 30*2.1 + 3*(10*1.1) === 189)"
true                  ← float da ham aniq 189
```

To'qima raqam bilan qo'rqitish — kanon §2 ("Halol bo'l. Raqam to'qima")
buzilishi. Shuning uchun quyida **haqiqiy** o'lchov beriladi.

### 6.2. Haqiqiy o'lchov

Barcha yaroqli DTM javob vektorlari (31 × 31 × 11 × 11 × 11 = **1 279 091** ta)
to'liq sanab chiqildi va float natija aniq (Decimal) natija bilan solishtirildi:

```
raw float mismatches: 470997 of 1279091      ← 36.8% xato
examples:
  main=0 sec=0 m=0,0,3  float=3.3000000000000003  exact=3.3
  main=0 sec=0 m=0,0,7  float=7.700000000000001   exact=7.7
  main=0 sec=0 m=0,1,6  float=7.700000000000001   exact=7.7
```

Ya'ni float xatosi **real va keng tarqalgan** — lekin `3.1 × 30` da emas,
`1.1 × 7` da.

### 6.3. Va endi eng muhim qismi: hozir bu **bag emas**

Xuddi shu 1 279 091 vektor frontendning **haqiqiy** funksiyasi bilan sinaldi
(`Math.round(x*10)/10` bilan, `AssessmentsPage.tsx:72`):

```
AFTER Math.round(x*10)/10 mismatches: 0      ← barcha 470 997 xato yo'qoladi
```

**Ya'ni `calcDtmTotal` bugun barcha yaroqli kirishlar uchun to'g'ri.** Blok test
ballari hozir noto'g'ri emas. Buni aytmaslik — muammoni bo'rttirish bo'lardi.

### 6.4. Unda nega Decimal?

Chunki **to'g'rilik tasodifga tayanadi**. `Math.round(x*10)/10` xatoni yashiradi
faqat **koeffitsiyentlar 1 kasr xonali bo'lgani uchun**. Bu sinaldi:

```
current  3.1/2.1/1.1  : mismatches: 0
hypoth   2.6/1.9/1.3  : mismatches: 0
hypoth  3.25/2.15/1.15: mismatches: 2251   eg [a=0, b=1, m=2] → 4.4  o'rniga  4.5
```

**Agar DTM koeffitsiyentni 2 kasr xonaga o'tkazsa** (masalan `3.25`), hozirgi
kod **jimgina noto'g'ri ball chiqara boshlaydi** — 2251 holatda, hech qanday
xatosiz, hech qanday ogohlantirishsiz. `Math.round(x*10)/10` band-aid'i
o'sha kunda ishlashdan to'xtaydi va **buni hech kim sezmaydi**.

Bu farazi emas: DTM formati davlat qarori bilan o'zgaradi va akademiya bunga
ta'sir qila olmaydi (§11).

Demak Decimal uchun asos — "bugun buzuq" emas, balki:

1. **To'g'rilik sabab bilan bo'lsin, tasodif bilan emas.** Hozir kod to'g'ri
   ishlaydi, lekin **nega** to'g'ri ekanini hech kim bilmaydi. `Math.round(x*10)/10`
   ni kimdir "keraksiz" deb o'chirsa — 470 997 holat buziladi.
2. **O'zgarishga chidamlilik.** Decimal da `3.25` ham, `3.1` ham bir xil aniq.
3. **Prisma allaqachon Decimal qaytaradi.** `max_score` va `score` — `Decimal`.
   Kod ularni darhol `Number()` ga aylantiradi (`assessments.service.ts:359,
   461, 736, 832`). Ya'ni Decimal **bor**, undan **voz kechilyapti**.
4. **Yangi kutubxona kerak emas.** `apps/api/package.json` da `decimal.js`
   yo'q — va **kerak ham emas**: Prisma o'zi `Decimal` ni beradi
   (`@prisma/client/runtime/library`). Ya'ni bu nol qo'shimcha bog'liqlik.

### 6.5. Qoida

> **Ball — `Decimal`. Arifmetika `Decimal` da. `Number()` faqat chegarada
> (JSON javob), va faqat `.toString()` orqali.**

```ts
// ❌ Hozirgi kod — assessments.service.ts:461
if (Number(item.score) > Number(assessment.max_score)) { ... }

// ✅ Taklif
if (new Decimal(item.score).greaterThan(assessment.max_score)) { ... }
```

```ts
// ❌ assessments.service.ts:358 — o'rtacha, float da
averageScore: scores.length
  ? scores.reduce((sum, s) => sum + Number(s.score), 0) / scores.length
  : 0,

// ✅ Decimal da
averageScore: scores.length
  ? scores
      .reduce((sum, s) => sum.add(s.score), new Decimal(0))
      .div(scores.length)
      .toDecimalPlaces(2)
      .toString()
  : '0',
```

⚠️ **Bu API javobini o'zgartiradi:** `number` → `string`. Frontend `Number()`
qilishi kerak. Bu buzuvchi o'zgarish — **alohida bosqichda** qilinsin, DTM
ishidan keyin. `core/dtm` ga bu **tegishli emas** (u allaqachon Decimal).

⚠️ **Aniq bo'lmagan joy:** JSON'da Decimal ni `string` qilib berish standart
yechim, lekin 48 sahifa mavjud. Nechta joy buziladi — **o'lchov bilan
aniqlanadi** (grep `Number(` + `maxScore|score`).

---

## 7. Baholash turlari — enum'mi yoki string?

### 7.1. Tekshiruv natijasi: **string**

```prisma
// schema.prisma:59
type  String  @db.VarChar(30)
```

Enum emas. Loyihadagi yagona enum — `SubjectRole` (kanon §3 tasdiqlaydi).

Tekshiruv `@IsIn` orqali, **DTO darajasida**, ikki faylda takrorlangan:

```ts
// create-assessment.dto.ts:52
@IsIn(['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'])
type!: string;

// assessment-list.query.dto.ts:41
@IsIn(['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'])
type?: string;
```

Va frontendda **uchinchi marta** (`AssessmentsPage.tsx:306-312` label'lar,
`718-722` `<SelectItem>` lar, `GuardianGrades.tsx:38`).

### 7.2. Ma'nolari

| Qiymat | Label (UI) | Domen ma'nosi |
|---|---|---|
| `WEEKLY_TEST` | Haftalik test | Muntazam fan testi |
| `BLOCK_TEST` | Blok test | **DTM simulyatsiyasi — 189 ball** |
| `WRITTEN` | Yozma | Yozma ish |
| `CONTROL` | Nazorat | Nazorat ishi |
| `MOCK` | Sinov | Sinov imtihoni |

⚠️ **Tekshirilsin:** `MOCK` va `BLOCK_TEST` farqi domenda noaniq. Ikkalasi ham
"imtihonga o'xshatish" ma'nosini beradi. `MOCK` ham 189 ballikmi? Agar ha —
u ham DTM qoidasiga bo'ysunishi kerak, va §5 dagi kod `['BLOCK_TEST', 'MOCK']`
ni qamrashi kerak. Agar yo'q — farq hujjatlashtirilsin. **Akademiya xodimidan
so'ralsin.**

### 7.3. Taklif: enum qilinsin

**Nega:**

1. **Ro'yxat 3 joyda takrorlangan** — 2 ta DTO + frontend. Yangi tur qo'shish
   3 ta o'zgarish. Bittasini unutish — `@IsIn` rad etadi yoki UI label
   ko'rsatmaydi.
2. **DB darajasida himoya yo'q.** `VarChar(30)` ga `'BANANA'` yozish mumkin.
   DTO uni to'xtatadi — lekin faqat HTTP orqali kelsa. `seed.ts`, migratsiya,
   kelajakdagi import — DTO dan o'tmaydi.
3. **`BLOCK_TEST` — oddiy string emas, u domen kaliti.** §5 dagi butun mantiq
   `type === 'BLOCK_TEST'` ga tayanadi. Bu taqqoslash **tipsiz string** bilan.
   Enum bo'lsa — TypeScript kompilyatsiyada tutadi.
4. **Presedent bor.** `SubjectRole` — aynan shunday sabab bilan enum qilingan.
   `AssessmentType` bir xil xususiyatga ega: yopiq, kichik, barqaror ro'yxat.

```prisma
// schema.prisma — taklif
enum AssessmentType {
  WEEKLY_TEST
  BLOCK_TEST
  WRITTEN
  CONTROL
  MOCK
}

model assessments {
  // ...
  type  AssessmentType   // ← String @db.VarChar(30) o'rniga
  // ...
}
```

**Migratsiya** — buzmasdan:

```sql
-- migration: 000003_assessment_type_enum
CREATE TYPE "AssessmentType" AS ENUM
  ('WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK');

-- ⚠️ Avval: mavjud ma'lumotda begona qiymat bormi?
--   SELECT DISTINCT type FROM assessments
--   WHERE type NOT IN ('WEEKLY_TEST','BLOCK_TEST','WRITTEN','CONTROL','MOCK');
--   Bo'sh natija bo'lishi SHART, aks holda quyidagi ALTER yiqiladi.

ALTER TABLE assessments
  ALTER COLUMN type TYPE "AssessmentType"
  USING type::"AssessmentType";
```

Enum qilingandan keyin DTO'lardagi `@IsIn(...)` **massivi** `Object.values(AssessmentType)`
ga almashadi — ro'yxat bitta joyda qoladi.

⚠️ **Ogohlantirish:** PostgreSQL enum'iga qiymat qo'shish oson (`ALTER TYPE ...
ADD VALUE`), **olib tashlash qiyin**. Yangi baholash turi qo'shilishi ehtimoli
bor bo'lsa (masalan `ORAL`, `PROJECT`), bu narx hisobga olinsin. Menimcha
narx arziydi — ro'yxat 5 yil ichida 5 ta bo'lib turibdi.

---

## 8. Reyting (ranking)

### 8.1. Qanday hisoblanadi

`ranking.service.ts` da **ikki xil** reyting bor. Bu — muammoning ildizi (§8.3).

**(a) Snapshot uchun — SQL, `ranking.service.ts:33`:**

```sql
WITH totals AS (
  SELECT
    s.id AS student_id,
    COALESCE(
      SUM(
        COALESCE(
          (sc.score / NULLIF(a.max_score, 0)) * 100 * a.weight,   -- ← foizga normallashtirish
          0
        )
      ),
      0
    )::numeric(12,2) AS total_score
  FROM students s
  LEFT JOIN assessment_scores sc ON sc.student_id = s.id
  LEFT JOIN assessments a ON a.id = sc.assessment_id
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
  SELECT DISTINCT ON (student_id) student_id, level
  FROM student_risk_scores
  WHERE tenant_id = ${tenantId}
  ORDER BY student_id, calculated_at DESC, id DESC
),
ranked AS (
  SELECT
    t.student_id,
    t.total_score,
    DENSE_RANK() OVER (ORDER BY t.total_score DESC) AS rank,   -- ← DENSE_RANK
    COALESCE(lr.level, 'GREEN') AS risk_level
  FROM totals t
  LEFT JOIN latest_risk lr ON lr.student_id = t.student_id
)
SELECT * FROM ranked
ORDER BY rank ASC, student_id ASC
```

Yaxshi tomonlari:
- **`numeric(12,2)`** — PostgreSQL `numeric` aniq, float emas. ✅ (§6 nuqtai
  nazaridan: SQL yo'li **JS yo'lidan aniqroq**)
- **`NULLIF(a.max_score, 0)`** — nolga bo'lishdan himoya ✅
- **Foizga normallashtirish** — 189 ballik blok test va 100 ballik haftalik
  testni solishtirish uchun ✅ (aks holda blok test 1.89× og'irroq bo'lardi)
- Tenant filtri bor ✅

**(b) Jonli reyting uchun — JS, `ranking.service.ts:152`:**

```ts
const data = students.map((st) => {
  const studentScores = scoreMap.get(st.id) || new Map();
  let sumPct = 0;
  let countTaken = 0;

  for (const a of assessments) {
    const raw = studentScores.get(a.id);
    perAssessment[a.id.toString()] = raw !== undefined ? raw : null;
    if (raw !== undefined) {
      sumPct += (raw / Number(a.max_score)) * 100;    // ← float, weight YO'Q
      countTaken++;
    }
  }

  const avgPct = countTaken > 0 ? sumPct / countTaken : 0;   // ← o'rtacha
  return { /* ... */ percentage: Math.round(avgPct * 100) / 100 };
});

// Sort by percentage desc, assign rank
data.sort((a, b) => b.percentage - a.percentage);
data.forEach((d, i) => {
  (d as any).rank = i + 1;                                   // ← ROW_NUMBER mantiq
});
```

### 8.2. Ball matritsasi

`liveRanking` (`ranking.service.ts:90`) frontend uchun matritsa qaytaradi:

- **Ustunlar** — davr ichidagi baholashlar (`assessmentHeaders`: `id`, `title`,
  `subjectName`, `maxScore`, `heldAt`, `type`)
- **Qatorlar** — guruhdagi `ACTIVE` o'quvchilar
- **Katak** — `perAssessment[assessmentId]` = xom ball yoki `null` (topshirmagan)
- **Yakuniy ustun** — `percentage` + `rank`

### 8.3. ⚠️ Tie (teng ball) — tekshirildi, natija: IKKI XIL

Bu — tekshirish so'ralgan savol. Javob muammoli.

| | Snapshot (SQL) | Jonli reyting (JS) |
|---|---|---|
| Fayl | `ranking.service.ts:78` | `ranking.service.ts:180` |
| Mexanizm | `DENSE_RANK()` | `data.forEach((d,i) => d.rank = i+1)` |
| Teng ball → | **bir xil o'rin** | **turli o'rin** |
| Misol: 100, 90, 90, 80 | 1, 2, 2, **3** | 1, 2, **3**, 4 |

**Ya'ni bir xil o'quvchi, bir xil ball, ikki xil o'rin** — qaysi sahifaga
qarashga qarab. Ota-ona jonli reytingda 3-o'rinni ko'radi, snapshot da
2-o'rinni. Qaysi biri to'g'ri?

Va yana ikki farq:

1. **`weight` jonli reytingda YO'Q.** SQL da `* a.weight` bor (46-qator), JS da
   yo'q (162-qator). Ya'ni `weight = 2` bo'lgan test snapshot da ikki barobar
   og'ir, jonli reytingda oddiy. **Ikki xil natija.**
2. **Yig'indi vs o'rtacha.** SQL `SUM(...)` qiladi, JS `sumPct / countTaken`
   (o'rtacha). Ya'ni SQL da **ko'p test topshirgan** o'quvchi yuqoriroq,
   JS da **yaxshi topshirgan**. Bu **butunlay boshqa reyting**.

Uchinchi farq — JS versiyasida tie holatida tartib **beqaror**: `data.sort()`
teng elementlar uchun kafolat bermaydi (JS `sort` barqaror, lekin kirish tartibi
`full_name: 'asc'` — ya'ni tie alifbo bo'yicha hal bo'ladi, **bu bilib qilingan
qarormi?** — hujjatlashtirilmagan).

**Taklif:** ikkala yo'l **bitta manbadan** hisoblansin. Jonli reyting ham
`totalsSql()` ni chaqirsin (u allaqachon parametrlangan) va matritsa uchun
faqat kataklarni alohida olsin. Unda tie mantiqi bitta bo'ladi.

⚠️ **Qaror kerak (biznes savoli, texnik emas):**
- Tie'da `DENSE_RANK` (1,2,2,3) mi yoki `RANK` (1,2,2,4) mi? DTM'ning o'zi
  qanday qiladi? **Akademiyadan so'ralsin.**
- Reyting **yig'indi** bo'yicha mi yoki **o'rtacha** bo'yicha mi? Bu — eng muhim
  savol, chunki hozir ikki javob bir vaqtda mavjud.
- `weight` reytingga kirsinmi? (SQL: ha, JS: yo'q)

### 8.4. DTM bilan bog'liqligi

`max_score = 500` bo'lgan yaroqsiz blok test (§4.3) reytingga qanday kiradi:

```
(score / max_score) * 100 * weight
= (400 / 500) * 100 * 1
= 80%
```

Ya'ni **yaroqsiz test yaroqli ko'rinadi** — 80% hech qanday shubha
uyg'otmaydi. Reyting jimgina buziladi. §5 dagi majburlash aynan buni oldini oladi.

---

## 9. `grade_snapshots` — davriy kesim

### 9.1. Nega kerak

Reyting — **vaqt funksiyasi**. `liveRanking` "hozir" ni ko'rsatadi va u har
kuni o'zgaradi: yangi test qo'shiladi, o'quvchi guruhdan ketadi
(`current_group_id` o'zgaradi), status `ACTIVE` dan chiqadi.

Demak "1-chorakda kim 1-o'rinda edi?" degan savolga jonli reyting **javob bera
olmaydi** — u o'sha davrni qayta hisoblasa ham, **o'quvchilar tarkibi
o'zgargan** bo'ladi (`WHERE s.current_group_id = ${groupId} AND s.status = 'ACTIVE'`
— bu **bugungi** holat).

Snapshot — bu "o'sha kuni tizim shunday deb aytgan" degan **fakt**. Akademiya
uchun bu:

- **Sertifikat/mukofot** (`awards`, `certificates` modullari) — "1-chorak
  g'olibi" e'lon qilingandan keyin o'zgarmasligi kerak
- **Ota-onaga hisobot** — "farzandingiz 2-chorakda 5-o'rinda edi"
- **Tendensiya** — o'quvchi 3-o'rindan 15-o'ringa tushdimi? Bu `risk` moduli
  uchun signal
- **Nizo** — "menga noto'g'ri o'rin berildi" da murojaat qilinadigan yozuv

### 9.2. Sxema

```prisma
// schema.prisma:479
model grade_snapshots {
  id                  BigInt                @id @default(autoincrement())
  tenant_id           BigInt
  group_id            BigInt
  period_type         String                @db.VarChar(10)   // ← string (§7 bilan bir xil muammo)
  period_start        DateTime              @db.Date
  period_end          DateTime              @db.Date
  generated_at        DateTime              @default(now()) @db.Timestamptz(6)
  grade_snapshot_rows grade_snapshot_rows[]
}

// schema.prisma:467
model grade_snapshot_rows {
  snapshot_id     BigInt
  student_id      BigInt
  total_score     Decimal  @db.Decimal(12, 2)    // ← Decimal ✅
  rank            Int
  risk_level      String   @default("GREEN") @db.VarChar(10)

  @@id([snapshot_id, student_id])
}
```

`total_score` — `Decimal(12,2)`, SQL `::numeric(12,2)` bilan mos ✅

### 9.3. Qanday ishlaydi

`createSnapshot` (`ranking.service.ts:192`):

1. Guruhni tekshiradi (tenant bilan) — `NotFoundException('GROUP_NOT_FOUND')`
2. Sanalarni tekshiradi — `PERIOD_END_BEFORE_START`
3. **Shu davr uchun snapshot bormi** — qidiradi (`tenant_id + group_id +
   period_type + period_start + period_end`)
4. Tranzaksiya ichida:
   - bor bo'lsa: `generated_at` yangilanadi, **eski qatorlar o'chiriladi**
   - yo'q bo'lsa: yangi `grade_snapshots` yoziladi
   - `INSERT ... SELECT` bilan `totalsSql()` natijasi to'g'ridan-to'g'ri
     `grade_snapshot_rows` ga yoziladi — **ma'lumot JS ga chiqmaydi** ✅ (§6:
     float ga tegmaydi)
5. Audit log

`risk_level` snapshot vaqtidagi eng oxirgi xavf skoridan olinadi
(`latest_risk` CTE, `DISTINCT ON`).

⚠️ **Muhim nuans — xavf skori avtomatik hisoblanmaydi.** Kanon §4.2 `levelFromScore()`
ni tilga oladi va bu "hisoblangan skor" taassurotini beradi. Kod boshqacha
deydi (`risk.service.ts:60`):

```ts
const signals = { manual: true, note: args.dto.note || null };
```

Ya'ni skorni **odam qo'lda kiritadi**, `levelFromScore()` esa faqat sonni
rangga aylantiradi (≤33 GREEN, ≤66 YELLOW, >66 RED). Signal avtomatik
yig'ilmaydi.

Snapshot uchun oqibati: `grade_snapshot_rows.risk_level` — bu **o'sha paytda
kimdir qo'lda qo'ygan baho**, tizim xulosasi emas. Agar hech kim skor
kiritmagan bo'lsa, `COALESCE(lr.level, 'GREEN')` (81-qator) uni **`GREEN`**
qiladi — ya'ni **"ma'lumot yo'q" jimgina "xavfsiz" bo'lib ko'rinadi**. Bu
snapshot'da muzlatiladi va ota-onaga ko'rsatilishi mumkin.
⚠️ **Tekshirilsin:** `GREEN` default to'g'ri qarormi? "Noma'lum" holati
(`UNKNOWN`) kerakmi?

### 9.4. ⚠️ Muammo: snapshot o'zgarmas emas

Kanon `grade_snapshots` ni "tarixiy kuzatuv" deydi. Lekin kod uni
**qayta yozadi** (`ranking.service.ts:236-244`):

```ts
if (existing) {
  sid = existing.id;
  await tx.grade_snapshots.update({
    where: { id: sid },
    data: { generated_at: new Date() },
  });
  await tx.grade_snapshot_rows.deleteMany({    // ← ⚠️ eski kesim O'CHADI
    where: { snapshot_id: sid },
  });
}
```

Ya'ni "1-chorak" snapshot'ini qayta generatsiya qilish **eskisini yo'q qiladi**.
Agar 1-chorak natijasi allaqachon e'lon qilingan va sertifikat berilgan bo'lsa —
snapshot endi sertifikat bilan **mos kelmasligi mumkin**.

Bu — snapshot g'oyasining o'ziga zid: **o'zgarmas kesim o'zgaruvchan bo'lib
qoldi.**

Nima uchun bu DTM uchun muhim: agar §4.3 dagi yaroqsiz blok test keyinroq
tuzatilsa, snapshot qayta generatsiya qilinadi — va **tarix jimgina o'zgaradi**.
Kim qachon qaysi o'rinda bo'lgani endi noma'lum.

**Taklif — ikki variant, biznes qaroriga bog'liq:**

- **(a) Muzlatish:** `grade_snapshots.finalized_at DateTime?` qo'shilsin.
  `finalized_at != null` bo'lsa — qayta generatsiya `409 SNAPSHOT_FINALIZED`
  qaytarsin. Tuzatish kerak bo'lsa — **yangi** snapshot yaratilsin.
- **(b) Versiyalash:** `@@unique` ga `version` qo'shilsin, eskisi o'chirilmasin.

⚠️ Qaysi biri — **akademiya jarayoniga bog'liq**. "Reyting e'lon qilinadimi?
Qachon?" — bu savolga javob kerak. **Ochiq savol.**

⚠️ **Yana:** `period_type` — `VarChar(10)`, va uning yaroqli qiymatlari
(`WEEKLY`? `MONTHLY`? `QUARTER`?) hech qayerda enum qilinmagan. `create-snapshot.dto.ts`
tekshirilsin — bu §7 bilan bir xil muammo.

---

## 10. Testlar

Kanon §3: **testlar amalda nol** (1 ta placeholder). Kanon §6: bu eng katta
bo'shliqlardan biri.

`core/dtm` — testni boshlash uchun **eng yaxshi joy**, chunki u sof: DB yo'q,
mock yo'q, Nest yo'q. Bitta `describe` va funksiya.

### 10.1. Ma'lum vektorlar

```ts
// apps/api/src/core/dtm/__tests__/dtm-scoring.spec.ts
import { calculateBlockTestScore, DtmError } from '../dtm-scoring';
import { DTM_MAX_TOTAL, DTM_MAX_BY_ROLE, DTM_COEFFICIENT, DTM_QUESTION_COUNT } from '../dtm-scoring.constants';
import type { SubjectAnswers } from '../dtm-scoring.types';

/** A complete, valid DTM track: 1 MAIN + 1 SECONDARY + 3 MANDATORY. */
const track = (main: number, sec: number, m1: number, m2: number, m3: number): SubjectAnswers[] => [
  { subjectId: '1', role: 'MAIN',      correctAnswers: main },
  { subjectId: '2', role: 'SECONDARY', correctAnswers: sec },
  { subjectId: '3', role: 'MANDATORY', correctAnswers: m1 },
  { subjectId: '4', role: 'MANDATORY', correctAnswers: m2 },
  { subjectId: '5', role: 'MANDATORY', correctAnswers: m3 },
];

describe('calculateBlockTestScore — known vectors', () => {
  it('all correct = exactly 189', () => {
    const r = calculateBlockTestScore(track(30, 30, 10, 10, 10));
    expect(r.total.toString()).toBe('189');
    expect(r.total.equals(DTM_MAX_TOTAL)).toBe(true);
  });

  it('all wrong = exactly 0', () => {
    const r = calculateBlockTestScore(track(0, 0, 0, 0, 0));
    expect(r.total.toString()).toBe('0');
  });

  it('splits 189 into 93 / 63 / 33', () => {
    const r = calculateBlockTestScore(track(30, 30, 10, 10, 10));
    expect(r.byRole.MAIN.toString()).toBe('93');
    expect(r.byRole.SECONDARY.toString()).toBe('63');
    expect(r.byRole.MANDATORY.toString()).toBe('33');
  });

  it('is exact where float is not: 7 mandatory = 7.7, not 7.700000000000001', () => {
    const r = calculateBlockTestScore(track(0, 0, 7, 0, 0));
    expect(r.total.toString()).toBe('7.7');
    // Proof the naive version is wrong:
    expect(7 * 1.1).not.toBe(7.7);
  });

  it('mandatory-only perfect = 33', () => {
    expect(calculateBlockTestScore(track(0, 0, 10, 10, 10)).total.toString()).toBe('33');
  });

  it('main-only perfect = 93', () => {
    expect(calculateBlockTestScore(track(30, 0, 0, 0, 0)).total.toString()).toBe('93');
  });
});

describe('constants are internally consistent', () => {
  // Guards against someone changing a coefficient but forgetting the max.
  it('MAIN max = coefficient x questions', () => {
    expect(DTM_COEFFICIENT.MAIN.mul(DTM_QUESTION_COUNT.MAIN).equals(DTM_MAX_BY_ROLE.MAIN)).toBe(true);
  });
  it('SECONDARY max = coefficient x questions', () => {
    expect(DTM_COEFFICIENT.SECONDARY.mul(DTM_QUESTION_COUNT.SECONDARY).equals(DTM_MAX_BY_ROLE.SECONDARY)).toBe(true);
  });
  it('MANDATORY max = coefficient x questions x 3 subjects', () => {
    expect(DTM_COEFFICIENT.MANDATORY.mul(DTM_QUESTION_COUNT.MANDATORY).mul(3).equals(DTM_MAX_BY_ROLE.MANDATORY)).toBe(true);
  });
  it('role maxima sum to 189', () => {
    const sum = DTM_MAX_BY_ROLE.MAIN.add(DTM_MAX_BY_ROLE.SECONDARY).add(DTM_MAX_BY_ROLE.MANDATORY);
    expect(sum.equals(DTM_MAX_TOTAL)).toBe(true);
  });
  it('total questions = 90', () => {
    expect(DTM_QUESTION_COUNT.MAIN + DTM_QUESTION_COUNT.SECONDARY + DTM_QUESTION_COUNT.MANDATORY * 3).toBe(90);
  });
});

describe('rejects invalid input', () => {
  it('rejects more correct answers than questions', () => {
    expect(() => calculateBlockTestScore(track(31, 30, 10, 10, 10))).toThrow(DtmError);
  });
  it('rejects a track without MAIN', () => {
    expect(() =>
      calculateBlockTestScore([
        { subjectId: '2', role: 'SECONDARY', correctAnswers: 30 },
        { subjectId: '3', role: 'MANDATORY', correctAnswers: 10 },
        { subjectId: '4', role: 'MANDATORY', correctAnswers: 10 },
        { subjectId: '5', role: 'MANDATORY', correctAnswers: 10 },
      ]),
    ).toThrow('Expected exactly 1 MAIN subject(s), got 0');
  });
  it('rejects two MAIN subjects', () => {
    expect(() =>
      calculateBlockTestScore([
        { subjectId: '1', role: 'MAIN', correctAnswers: 30 },
        { subjectId: '9', role: 'MAIN', correctAnswers: 30 },
        { subjectId: '2', role: 'SECONDARY', correctAnswers: 30 },
        { subjectId: '3', role: 'MANDATORY', correctAnswers: 10 },
        { subjectId: '4', role: 'MANDATORY', correctAnswers: 10 },
        { subjectId: '5', role: 'MANDATORY', correctAnswers: 10 },
      ]),
    ).toThrow(DtmError);
  });
  it('rejects negative answers', () => {
    expect(() => calculateBlockTestScore(track(-1, 30, 10, 10, 10))).toThrow(DtmError);
  });
  it('rejects fractional answers', () => {
    expect(() => calculateBlockTestScore(track(1.5, 30, 10, 10, 10))).toThrow(DtmError);
  });
  it('rejects a duplicate subject', () => {
    expect(() =>
      calculateBlockTestScore([
        { subjectId: '1', role: 'MAIN', correctAnswers: 30 },
        { subjectId: '2', role: 'SECONDARY', correctAnswers: 30 },
        { subjectId: '3', role: 'MANDATORY', correctAnswers: 10 },
        { subjectId: '3', role: 'MANDATORY', correctAnswers: 10 },  // ← takror
        { subjectId: '5', role: 'MANDATORY', correctAnswers: 10 },
      ]),
    ).toThrow('appears twice');
  });
});
```

### 10.2. Track to'liqligi — §3.3 uchun

Bu testlar aynan §3.3 da topilgan bo'shliqni yopadi. Ular hozir **hammasi
yiqiladi**, chunki `validateDtmTrack` hali yo'q — bu normal, TZ shuni qurishni
so'raydi.

```ts
// apps/api/src/core/dtm/__tests__/dtm-validation.spec.ts
import { validateDtmTrack, validateBlockTest } from '../dtm-validation';
import { DtmError } from '../dtm-scoring';
import type { TrackSubjectShape } from '../dtm-validation';

const complete: TrackSubjectShape[] = [
  { subjectId: '1', role: 'MAIN' },
  { subjectId: '2', role: 'SECONDARY' },
  { subjectId: '3', role: 'MANDATORY' },
  { subjectId: '4', role: 'MANDATORY' },
  { subjectId: '5', role: 'MANDATORY' },
];

describe('validateDtmTrack', () => {
  it('parses a complete track into main / secondary / 3-tuple', () => {
    const t = validateDtmTrack(complete);
    expect(t.main.subjectId).toBe('1');
    expect(t.secondary.subjectId).toBe('2');
    expect(t.mandatory).toHaveLength(3);
  });

  // Each case below is currently reachable in production — see §3.3.
  it('rejects an empty track (the default state of every new track today)', () => {
    expect(() => validateDtmTrack([])).toThrow('Track needs exactly 1 MAIN subject(s), has 0');
  });

  it('rejects a track with no MAIN', () => {
    expect(() => validateDtmTrack(complete.filter((s) => s.role !== 'MAIN'))).toThrow(DtmError);
  });

  it('rejects a track with two MAIN subjects', () => {
    expect(() =>
      validateDtmTrack([...complete, { subjectId: '9', role: 'MAIN' }]),
    ).toThrow('Track needs exactly 1 MAIN subject(s), has 2');
  });

  it('rejects 4 MANDATORY subjects', () => {
    expect(() =>
      validateDtmTrack([...complete, { subjectId: '6', role: 'MANDATORY' }]),
    ).toThrow('Track needs exactly 3 MANDATORY subject(s), has 4');
  });

  it('rejects 2 MANDATORY subjects', () => {
    expect(() => validateDtmTrack(complete.slice(0, 4))).toThrow(
      'Track needs exactly 3 MANDATORY subject(s), has 2',
    );
  });

  it('rejects the same subject twice', () => {
    expect(() =>
      validateDtmTrack([...complete.slice(0, 4), { subjectId: '3', role: 'MANDATORY' }]),
    ).toThrow('appears twice');
  });
});

describe('validateBlockTest', () => {
  it('accepts max_score 189 on a complete track', () => {
    expect(() =>
      validateBlockTest({ type: 'BLOCK_TEST', maxScore: 189, trackSubjects: complete }),
    ).not.toThrow();
  });

  // The exact payload the API accepts today — see §4.3.
  it('rejects max_score 500', () => {
    expect(() =>
      validateBlockTest({ type: 'BLOCK_TEST', maxScore: 500, trackSubjects: complete }),
    ).toThrow('max_score must be 189');
  });

  it('rejects 189 on an incomplete track', () => {
    expect(() =>
      validateBlockTest({ type: 'BLOCK_TEST', maxScore: 189, trackSubjects: complete.slice(0, 2) }),
    ).toThrow('DTM_TRACK_INCOMPLETE');
  });
});
```

### 10.3. Property test

Asosiy invariant: **har qanday yaroqli javoblar to'plami uchun `0 <= score <= 189`.**

DTM kirish maydoni kichik — 31 × 31 × 11 × 11 × 11 = **1 279 091** kombinatsiya.
Bu **to'liq sanab chiqiladigan** hajm (o'lchandi: ~2 soniya). Ya'ni tasodifiy
property test kerak emas — **to'liq isbot** mumkin. Bu kamdan-kam imkoniyat,
undan foydalanilsin:

```ts
// apps/api/src/core/dtm/__tests__/dtm-scoring.property.spec.ts
import { calculateBlockTestScore } from '../dtm-scoring';
import { DTM_MAX_TOTAL } from '../dtm-scoring.constants';
import type { SubjectAnswers } from '../dtm-scoring.types';

const track = (main: number, sec: number, m1: number, m2: number, m3: number): SubjectAnswers[] => [
  { subjectId: '1', role: 'MAIN',      correctAnswers: main },
  { subjectId: '2', role: 'SECONDARY', correctAnswers: sec },
  { subjectId: '3', role: 'MANDATORY', correctAnswers: m1 },
  { subjectId: '4', role: 'MANDATORY', correctAnswers: m2 },
  { subjectId: '5', role: 'MANDATORY', correctAnswers: m3 },
];

describe('DTM invariants — exhaustive over the whole valid input space', () => {
  it('0 <= score <= 189 for every one of the 1,279,091 valid answer sets', () => {
    let checked = 0;
    let maxSeen = '0';

    for (let main = 0; main <= 30; main++)
      for (let sec = 0; sec <= 30; sec++)
        for (let m1 = 0; m1 <= 10; m1++)
          for (let m2 = 0; m2 <= 10; m2++)
            for (let m3 = 0; m3 <= 10; m3++) {
              const { total } = calculateBlockTestScore(track(main, sec, m1, m2, m3));

              expect(total.isNegative()).toBe(false);
              expect(total.greaterThan(DTM_MAX_TOTAL)).toBe(false);

              if (total.greaterThan(maxSeen)) maxSeen = total.toString();
              checked++;
            }

    expect(checked).toBe(31 * 31 * 11 * 11 * 11);   // 1_279_091
    expect(maxSeen).toBe('189');                    // the ceiling is reachable
  }, 60_000);

  it('score is monotonic: one more correct answer never lowers the total', () => {
    for (let main = 0; main < 30; main++) {
      const a = calculateBlockTestScore(track(main, 15, 5, 5, 5)).total;
      const b = calculateBlockTestScore(track(main + 1, 15, 5, 5, 5)).total;
      expect(b.greaterThan(a)).toBe(true);
    }
  });

  it('every total has at most 1 decimal place — matches official DTM results', () => {
    for (let main = 0; main <= 30; main++)
      for (let m1 = 0; m1 <= 10; m1++) {
        const { total } = calculateBlockTestScore(track(main, 0, m1, 0, 0));
        expect(total.decimalPlaces()).toBeLessThanOrEqual(1);
      }
  });

  it('a MAIN answer is always worth more than a SECONDARY one', () => {
    const withMain = calculateBlockTestScore(track(1, 0, 0, 0, 0)).total;
    const withSecondary = calculateBlockTestScore(track(0, 1, 0, 0, 0)).total;
    expect(withMain.greaterThan(withSecondary)).toBe(true);
  });
});
```

### 10.4. Regressiya testi — float band-aid uchun

§6.3 da aniqlandi: hozirgi frontend to'g'ri, lekin **tasodifan**. Bu test
o'sha tasodifni **hujjatlashtiradi** va u yo'qolganda ogohlantiradi:

```ts
describe('Decimal vs float — why core/dtm exists', () => {
  it('float arithmetic is wrong for ~37% of valid inputs', () => {
    let mismatches = 0;
    for (let main = 0; main <= 30; main++)
      for (let sec = 0; sec <= 30; sec++)
        for (let m1 = 0; m1 <= 10; m1++)
          for (let m2 = 0; m2 <= 10; m2++)
            for (let m3 = 0; m3 <= 10; m3++) {
              const float = main * 3.1 + sec * 2.1 + (m1 + m2 + m3) * 1.1;
              const exact = calculateBlockTestScore(track(main, sec, m1, m2, m3)).total;
              if (!exact.equals(float)) mismatches++;
            }
    // Measured 2026-07: 470_997 of 1_279_091.
    // Decimal has zero. This is the whole argument.
    expect(mismatches).toBeGreaterThan(400_000);
  }, 60_000);
});
```

### 10.5. Integratsiya testlari (Decimal'dan tashqari)

`core/dtm` sof, lekin majburlash servisda. Kerakli testlar:

| Test | Kutilgan |
|---|---|
| `POST /assessments {type:'BLOCK_TEST', maxScore:500}` | `400 BLOCK_TEST_MAX_SCORE_IS_DERIVED` |
| `POST /assessments {type:'BLOCK_TEST'}` (maxScore yo'q) | `201`, DB da `max_score = 189.00` |
| `BLOCK_TEST` to'liq bo'lmagan trackda (MAIN yo'q) | `400 DTM_TRACK_INCOMPLETE` |
| `BLOCK_TEST` tracksiz guruhda | `400 BLOCK_TEST_REQUIRES_TRACK` |
| `POST /assessments {type:'WEEKLY_TEST', maxScore:50}` | `201` — DTM qoidasi tegmaydi |
| Trackka 2-chi `MAIN`, `replace` yo'q | `409 SUBJECT_ROLE_ALREADY_TAKEN` |
| Trackka 2-chi `MAIN`, `replace: true` | `200`, audit log yozilgan |

⚠️ **Eng muhim test — bu yerda emas.** Kanon §6: tenant izolyatsiya testi
tizimning eng muhim testi va u yo'q. Bu hujjat uni almashtirmaydi.
`core/dtm` — testni **boshlash** uchun oson joy, chunki infratuzilma talab
qilmaydi. Tenant testi alohida TZ da.

---

## 11. Kelajak: DTM formati o'zgarsa

### 11.1. Hozirgi holat

Veb-qidiruv (§1.1): **2025/2026 va 2026/2027 uchun format o'zgarmagan.** Ya'ni
189 kamida ikki yil barqaror. Bu — versiyalashni **hozir qurmaslik** uchun
asos.

Lekin format **davlat qarori bilan** o'zgaradi va akademiya bunga ta'sir qila
olmaydi. "O'zgarmaydi" deb faraz qilish — noto'g'ri.

### 11.2. Nima uchun bu jiddiy

§6.4 da o'lchandi: agar koeffitsiyent **2 kasr xonaga** o'tsa (masalan `3.25`),
hozirgi frontend kodi **2251 holatda jimgina noto'g'ri ball** chiqaradi. Ya'ni
DTM o'zgarishi bu tizim uchun faqat "raqamni almashtirish" emas — **arifmetika
modeli buziladi**.

`core/dtm` (Decimal bilan) bu muammoni tug'ilishidan oldin o'ldiradi.

### 11.3. Versiyalash — kerakmi?

**Muammoning aniq shakli:** 2027-da koeffitsiyent o'zgardi deylik. 2026-da
o'tkazilgan blok test bazada `max_score = 189`, `score = 156.3`. Endi:

- Konstantani o'zgartirsak — **eski test yaroqsiz bo'lib qoladi**
  (`validateBlockTest` uni rad etadi, chunki `max_score != yangi_maks`)
- Snapshot'lar eski ballar bilan hisoblangan (§9) — ular qayta generatsiya
  qilinsa, **tarix o'zgaradi**
- Ota-ona 2026 natijasini ko'rsa — qaysi qoida bilan ko'rsatiladi?

**Prinsip: baholash o'z davri qoidasi bilan qoladi.** 2026-da 189 ball edi —
u abadiy 189 bo'lib qoladi.

**Taklif — `dtm_scoring_versions` jadvali?** Menimcha **hozir emas**, va sabab bor.

Kanon §10: "mavjud kodni butunlay qayta yozish taklifi" yozilmaydi. To'liq
versiyalash mexanizmi — hozircha **bir versiya** mavjud bo'lgan holatda —
haqiqiy bo'lmagan muammoni yechish. YAGNI.

**Buning o'rniga — arzon, qaytmas qadam:**

`assessments` ga bitta ustun:

```prisma
model assessments {
  // ...
  /// Which DTM scoring rule produced this assessment's max_score.
  /// NULL for non-DTM types. Frozen at creation — never recomputed.
  dtm_scoring_version String?  @db.VarChar(20)   // e.g. "2025-2026"
}
```

Va `create()` da:

```ts
if (args.dto.type === 'BLOCK_TEST') {
  max_score = new Prisma.Decimal(DTM_MAX_TOTAL.toString());
  dtm_scoring_version = DTM_CURRENT_VERSION;   // "2025-2026"
}
```

```ts
// dtm-scoring.constants.ts
/** The DTM ruleset currently in force. Bump when the state changes the format. */
export const DTM_CURRENT_VERSION = '2025-2026';
```

**Nega bu yetarli:**

- **Arzon** — bitta nullable ustun, migratsiya buzmaydi
- **Qaytmas qadam** — ma'lumot **bugundan** yig'ila boshlaydi. Ustunni keyin
  qo'shsak, eski yozuvlarda **hech qachon** to'g'ri qiymat bo'lmaydi
- **Eshikni ochiq qoldiradi** — haqiqatan ikkinchi versiya kelganda,
  `dtm_scoring_versions` jadvali qo'shilib, bu ustun unga FK bo'ladi
- **Validatsiyani versiyaga bog'laydi** — `validateBlockTest` eski test uchun
  o'sha versiyaning `DTM_MAX_TOTAL` ini olishi mumkin

Ikkinchi versiya kelganda `core/dtm` shunday o'sadi:

```ts
// dtm-scoring.constants.ts (kelajakda)
const RULESETS = {
  '2025-2026': {
    coefficient: { MAIN: new Decimal('3.1'), SECONDARY: new Decimal('2.1'), MANDATORY: new Decimal('1.1') },
    questions: { MAIN: 30, SECONDARY: 30, MANDATORY: 10 },
    maxTotal: new Decimal('189.0'),
  },
  // '2027-2028': { ... }
} as const;

export function getRuleset(version: string) {
  const rs = RULESETS[version];
  if (!rs) throw new DtmError('DTM_UNKNOWN_VERSION', `No ruleset for ${version}`);
  return rs;
}
```

`calculateBlockTestScore(answers, version)` — ikkinchi parametr. Eski testlar
o'z versiyasi bilan qayta hisoblanadi, yangilari yangisi bilan. **Jadval hali
ham kerak emas** — kod konstantalari yetarli, chunki ruleset — bu **kod**,
tenant ma'lumoti emas. Har tenant o'z DTM qoidasini o'ylab topa olmaydi.

⚠️ **Bu — mening tavsiyam, qat'iy qaror emas.** Agar akademiya "har tenant o'z
baholash formulasini sozlasin" deyishni istasa (SaaS bo'lish yo'lida — kanon §7),
u holda jadval kerak bo'ladi. **Ochiq savol.**

---

## 12. Ochiq savollar

### DTM formati (rasmiy manba yoki akademiya xodimidan)

1. **Matematika bir vaqtda `MAIN` va `MANDATORY` bo'la oladimi?** Aniq fanlar
   blokida matematika ixtisoslik fani, lekin u majburiy 3 talikda ham bor.
   Ikki marta hisoblanadimi (30×3.1 + 10×1.1)? Yoki majburiy blokdan chiqadimi?
   **Bu javob `validateDtmTrack` ni o'zgartiradi** — §5.4 dagi kod hozir
   "5 ta har xil fan" deb faraz qiladi va takror `subjectId` ni rad etadi.
   Agar matematika ikkala rolda bo'lsa, `DTM_DUPLICATE_SUBJECT` tekshiruvi
   `(subjectId, role)` juftligiga o'tishi kerak.
2. **Ball yaxlitlash qoidasi?** DTM natijasi 1 kasr xonali. Yarim yuqoriga
   (`ROUND_HALF_UP`) mi, yoki `ROUND_HALF_EVEN`? Hozirgi kod `Math.round` —
   bu `HALF_UP` (musbat sonlar uchun). **Tasdiqlash kerak.**
3. **Imtiyoz ballari** (olimpiada, sertifikat) 189 ustiga qo'shiladimi? Tizimda
   bu tushuncha yo'q. Kerakmi?
4. **DTM natijasining o'zi tizimga kiritiladimi?** Hozir faqat akademiya ichidagi
   simulyatsiya bor. Real DTM natijasi `student_outcomes` (kanon §4.2) bilan
   qanday bog'lanadi?

### Domen qarorlari (akademiya)

5. **`MOCK` va `BLOCK_TEST` farqi nima?** (§7.2) `MOCK` ham 189 ballikmi?
   Javob §5 dagi kodning qamrovini belgilaydi.
6. **Reyting: yig'indi yoki o'rtacha?** (§8.3) Hozir ikkalasi ham bor — SQL
   `SUM`, JS o'rtacha. **Bitta javob kerak.**
7. **Tie: `DENSE_RANK` (1,2,2,3) yoki `RANK` (1,2,2,4)?** (§8.3) Hozir
   snapshot birinchisini, jonli reyting hech qaysisini qilmaydi.
8. **`weight` reytingga kirsinmi?** SQL: ha (`* a.weight`), JS: yo'q. Blok test
   uchun `weight` qanday bo'lishi kerak — 1.0 mi, yoki u haftalik testdan
   og'irroqmi? Hozir default `1.0` va uni **hech kim ongli belgilamagan**.
9. **Snapshot e'lon qilinadimi va muzlatiladimi?** (§9.4) Javob `finalized_at`
   kerakligini hal qiladi.
10. **`period_type` yaroqli qiymatlari?** (§9.4) `VarChar(10)` — hujjatlashtirilmagan.

### Texnik qarorlar (TZ ni bajaruvchi)

10b. **Productionda nechta yaroqsiz track bor?** (§5.8/3b) Tizim buni hech
    qachon tekshirmagan — javob **o'lchov bilan aniqlanadi**, so'rov §5.8 da
    tayyor. Agar yaroqsiz track ustida blok test topilsa, uning ballari
    noto'g'ri va u reytingga kirgan — **bu ma'lumot tuzatish ishi**.
10c. **Track "qoralama" holatida bo'la oladimi?** (§3.3) Har yangi track 0 fan
    bilan tug'iladi — ya'ni yaroqsiz holat **normal ish oqimining bir qismi**.
    Demak "har doim yaroqli" qoidasi track yaratishni buzadi. Kerak:
    `student_tracks.is_dtm_ready` (hosila) yoki `published_at` — track faqat
    to'liq bo'lgandan keyin blok testga yaroqli bo'lsin. **Qaysi biri —
    akademiya ish oqimiga bog'liq.**
11. **`assessments` tahrirlash/o'chirish — bag mi, qaror mi?** (§4.7) UI da
    tugma bor, route yo'q. Baholarni o'zgarmas qilish **mantiqiy qaror** bo'lishi
    mumkin — agar shunday bo'lsa, tugmalar olib tashlansin va sabab
    hujjatlashtirilsin.
12. **Eski blok testlar backfill qilinsinmi?** (§5.8) Eski JSON da fan ID si
    yo'q, ya'ni backfill taxminiy. Tavsiyam: **qilinmasin**, `score` saqlansin.
13. **`Decimal` → JSON `string` migratsiyasi qachon?** (§6.5) Bu buzuvchi
    o'zgarish, 48 sahifaga ta'sir qiladi. Qamrovi **o'lchov bilan aniqlanadi**.
14. **`AssessmentType` enum — narx arziydimi?** (§7.3) PostgreSQL enum'dan
    qiymat o'chirish qiyin. Ro'yxat qanchalik barqaror?
15. **`dtm_scoring_version` ustuni hozir qo'shilsinmi?** (§11.3) Tavsiyam: ha —
    arzon, va keyin qo'shish eski ma'lumotni qutqara olmaydi.

### Yuridik (yurist savoli — kanon §10)

16. **Blok test natijalari — voyaga yetmagan o'quvchi ma'lumoti.** Reyting
    ochiq ekranlarda (`displays` moduli) ko'rsatiladimi? Boshqa o'quvchilar
    kimning nechanchi o'rinda ekanini ko'rishi — **maqbulmi?** `liveRanking`
    top-10 ni ismlari bilan qaytaradi (`ranking.service.ts:476`). Bu — **yurist
    savoli**, texnik emas.

---

## Xulosa — bir jumlada

DTM 189 ball tizimi tasdiqlandi va 2026 uchun o'zgarmagan. Lekin u tizimda
**domen qoidasi sifatida mavjud emas** — va bu ikki qatlamda:

- **Ball qoidasi majburlanmaydi:** `189` 3 ta React faylida takrorlangan,
  backend uni bilmaydi, `POST {type:'BLOCK_TEST', max_score:500}` → `201`.
- **Tarkib qoidasi ham majburlanmaydi:** `MANDATORY` butun backendda **bir
  marta** uchraydi (default qiymat sifatida). MAIN'siz track, 4 ta MANDATORY,
  fansiz track — hammasi o'tadi. `assessments.service.ts` `track` so'zini
  **umuman bilmaydi**.

Va uchinchisi ikkalasini bog'laydi: blok test UI si fan rolini `SubjectRole`
enum'idan emas, **`group_subjects` massivining indeksidan** o'qiydi
(`AssessmentsPage.tsx:187`) — ya'ni `×3.1` noto'g'ri fanga tushishi mumkin,
jimgina.

Yechim yangi modul emas: `core/dtm` — sof, testlanadigan, Decimal asosidagi
~200 qator. Ikki qoida bilan: `max_score` **hisoblanadi**, mijozdan olinmaydi;
va track **parse qilinadi** (`validateDtmTrack(): DtmTrack`), tekshirilmaydi —
shunda yaroqsiz tarkibni ifodalab bo'lmaydi.

⚠️ **Va bir ogohlantirish:** §5.8/3b — bu qoidalarni yoqishdan oldin
productiondagi mavjud tracklar o'lchansin. Tizim ularni hech qachon
tekshirmagan, ya'ni yaroqsizlari **bor deb faraz qilinsin**.
