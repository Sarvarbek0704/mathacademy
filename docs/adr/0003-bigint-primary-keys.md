# ADR-0003 — Birlamchi kalitlar: `BigInt @default(autoincrement())`

- **Holat:** Qabul qilingan
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

⚠️ **Bu ADR yangi qaror qabul qilmaydi.** Qaror **allaqachon qilingan va u
to'g'ri**. Bu hujjat mavjud qarorni **hujjatlashtiradi** — sabablarini yozadi,
narxini ochiq aytadi va nima o'lchanganini qayd etadi.

Sabab oddiy: `apps/api` da BigInt intizomini qo'llab-quvvatlaydigan **to'rtta
alohida infratuzilma fayli** bor va **199 ta** chaqiruv joyi. Bunday izchil
qo'llangan qarorning sababi hech qayerda yozilmagan. Yangi dasturchi (yoki
kelajakdagi Claude chati) `BigInt` ning noqulayligini ko'rib, uni "soddalashtirmoqchi"
bo'lishi mumkin. Bu ADR — o'sha urinishga javob.

### Nima uchun savol umuman tug'iladi

MathAcademy **ko'p ijarachilik SIS**. 69 model, 165 ta foreign key. Har jadval
identifikator talab qiladi va tanlov haqiqiy: `Int`, `BigInt`, `UUID v4`, `UUIDv7`.

Va bu — **oson qaytariladigan qaror emas**. PK tipini o'zgartirish 69 model,
165 FK, 128 DTO va butun frontendga tegadi. Ya'ni bu qaror **bir marta** qabul
qilinadi.

### O'lchangan holat — qaror qanday amalga oshirilgan

`prisma/schema.prisma` (69 model):

| Fakt | Raqam | Usul |
|---|---:|---|
| Modellar | **69** | `grep -c "^model "` |
| `BigInt @id` | **57** | `grep -c "BigInt.*@id"` |
| Ulardan `@default(autoincrement())` | **56** | grep |
| Composite `@@id([...])` — surrogat PK yo'q | **12** | `grep -n "@@id"` |
| `uuid` / `UUID` ishlatilishi | **0** | grep |

⚠️ **Aniqlashtirish — "barcha PK BigInt" da'vosi so'zma-so'z to'g'ri emas.**
Kanon §9 "PK: `BigInt @default(autoincrement())`" deydi. O'lchov aniqroq rasm
beradi:

- **56 model** — `BigInt @default(autoincrement())` surrogat PK. Bu — asosiy naqsh
- **1 model** — `student_cohort`, PK `student_id BigInt @id` (`schema.prisma:777`).
  Bu — **tabiiy kalit**: `students` bilan 1:1, o'z ID'si kerak emas. To'g'ri qaror
- **12 model** — **composite PK**, surrogat ID umuman yo'q:
  ```
  assessment_scores          @@id([assessment_id, student_id])
  attendance_marks           @@id([session_id, student_id])
  award_recipients           @@id([award_id, recipient_type, student_id, group_id])
  competition_results        @@id([competition_id, entry_id])
  display_items              @@id([playlist_id, sort_order])
  dorm_announcement_prices   @@id([dorm_announcement_id, living_type_id])
  event_participants         @@id([event_id, student_id])
  grade_snapshot_rows        @@id([snapshot_id, student_id])
  group_subjects             @@id([group_id, subject_id])
  meal_announcement_prices   @@id([meal_announcement_id, living_type_id])
  role_permissions           @@id([role_id, permission_id])
  user_roles                 @@id([user_id, role_id])
  ```
  Bularning **hammasi bola/bog'lovchi jadval**, va PK ularning tarkibiy qismlari
  `BigInt` — ya'ni **qaror buzilmagan**, u shunchaki surrogat ID qo'shmagan.

> ⚠️ **Diqqat qilinadigan bir moslik:** bu 12 modelning **hammasi**
> [ADR-0002](./0002-prisma-extension-for-tenant-isolation.md) dagi "`tenant_id`
> ustuni yo'q 18 model" ro'yxatida. Bu tasodif emas — **bir xil sabab**: ular
> bola jadval, ular tenantga (va identifikatorga) **ota orqali** yetadi.
> Ya'ni bu ADR va ADR-0002 bir xil strukturaviy chegarani turli tomondan ko'radi.

### Mavjud infratuzilma — o'lchangan

`main.ts:15-21` — global `BigInt` serializatsiya patch'i:

```ts
declare global {
  var __bigint_json_patch_applied__: boolean | undefined;
}

function patchBigIntJson() {
  if (global.__bigint_json_patch_applied__) return;   // ← idempotent
  global.__bigint_json_patch_applied__ = true;
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}
```

`main.ts:51` da chaqiriladi. **Idempotentlik guard'i — to'g'ri detal**: HMR yoki
test runner ikki marta yuklasa, prototip ikki marta patch qilinmaydi.

`common/pipes/parse-bigint.pipe.ts` — route param uchun:

```ts
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    const v = String(value ?? '').trim();
    if (!v) throw new BadRequestException('ID is required');
    if (!/^\d+$/.test(v))
      throw new BadRequestException('ID must be a number string');
    try {
      return BigInt(v);
    } catch {
      throw new BadRequestException('Invalid ID');
    }
  }
}
```

**Ishlatilishi: 199 ta chaqiruv, 31 ta controller'da.** Bu — dekorativ emas,
**izchil qo'llangan** tizim. `@Param('id', ParseBigIntPipe) id: bigint` —
kontroller qatlamida BigInt kafolatlangan.

## Qaror

**Barcha surrogat birlamchi kalitlar — `BigInt @default(autoincrement())`.**

```prisma
model students {
  id        BigInt @id @default(autoincrement())
  tenant_id BigInt
  // ...
}
```

Bola/bog'lovchi jadvallar composite PK ishlatadi (`@@id([...])`), va uning
tarkibiy qismlari ham `BigInt`.

**Foreign key'lar — har doim `BigInt`.** ID'lar API'da **string** sifatida
uzatiladi. JS `number` ga o'tkazish — **hech qayerda**.

**UUID ishlatilmaydi.**

## Sabablar

### Nega `BigInt`, `Int` emas

JS `number` — IEEE 754 double. Xavfsiz butun son chegarasi — **2⁵³ − 1**
(`Number.MAX_SAFE_INTEGER` = 9 007 199 254 740 991). Undan katta butun son
**jimgina yaxlitlanadi**:

```js
9007199254740993 === 9007199254740992   // true  ← ikki xil ID teng bo'lib qoldi
```

Bu — bu loyihada **eng xavfli turdagi bag**: xato chiqmaydi, ikki o'quvchi
bir xil ID'ga ega bo'lib ko'rinadi.

`BigInt` bu chegarani butunlay olib tashlaydi.

### Alternativa A — `Int` (32-bit) nega rad etildi

**Ustunligi — va u real:**

- **4 bayt**, `BigInt` ning 8 baytiga qarshi. 165 FK × 200 000 qator miqyosida
  bu indeks hajmida sezilarli
- **JS'da to'liq qulay** — `number`, hech qanday `n` suffiksi, `JSON.stringify`
  ishlaydi, `toJSON` patch **kerak emas**
- **2⁵³ muammosi yo'q** — 32-bit `Int` (maks ~2.1 mlrd) `Number.MAX_SAFE_INTEGER`
  dan ancha kichik, ya'ni JS'da xavfsiz
- **Bu domen uchun amalda yetarli** — 100 akademiya × 2000 o'quvchi = 200 000.
  2.1 mlrd'gacha **10 000 barobar** joy bor

⚠️ **Halol bo'lish uchun: `Int` texnik jihatdan yetарli edi va u kodni
soddalashtirardi.** Bu ADR ning butun "Salbiy" bo'limi `Int` bilan **mavjud
bo'lmasdi**. Bu jiddiy e'tibor.

**Nega baribir rad etildi:**

1. **`students` — chegara emas. `audit_logs`, `student_timeline`,
   `attendance_marks` — chegara.** Bular **voqea (event) jadvallari**: har
   davomat belgisi, har audit yozuvi, har timeline elementi — yangi qator.
   200 000 o'quvchi × kuniga 6 dars × 200 o'quv kuni = **240 mln qator/yil**
   faqat `attendance_marks` da. 32-bit `Int` — **~9 yil**. Va `SERIAL` toshib
   ketganda PostgreSQL **xato tashlaydi va INSERT to'xtaydi** — ya'ni tizim
   ishlamay qoladi
2. **`Int` dan `BigInt` ga migratsiya — 165 FK bo'ylab `ALTER TABLE`.** Ishlab
   turgan akademiyada bu **uzoq lock** demak. Bu qarorni **keyinga qoldirib
   bo'lmaydi** — u bugun arzon, keyin qimmat
3. **Aralash tip — eng yomon variant.** `students.id Int` + `audit_logs.id BigInt`
   = ikki xil intizom, va dasturchi qaysi biri ekanini eslashi kerak.
   **Bir xil bo'lgani yaxshiroq**

### Alternativa B — UUID v4 nega rad etildi

**Ustunligi — va u real:**

- **Taxmin qilinmaydi.** `/students/1` → `/students/2` naqshi ishlamaydi.
  Enumeration hujumi **strukturaviy imkonsiz**. ⚠️ Bu — bu ADR ning aniq
  zaifligini (pastda) yopadi
- **Mijoz tomonda generatsiya qilinadi** — DB round-trip'siz. Offline-first
  yoki optimistic UI uchun qimmatli
- **Tenant'lar orasida to'qnashuv yo'q** — merge/import stsenariylarida qulay
- **JSON'da tabiiy string** — `toJSON` patch kerak emas, 2⁵³ muammosi yo'q

**Nega baribir rad etildi:**

| Narx | Tafsilot |
|---|---|
| **⚠️ Indeks lokalligi** | UUID v4 **tasodifiy**. B-tree indeksda har `INSERT` **tasodifiy sahifaga** tushadi → sahifa bo'linishi (page split), indeks fragmentatsiyasi, cache miss. Autoincrement esa **ketma-ket** — har INSERT indeksning **o'ng chekkasiga** tushadi, bitta issiq sahifa |
| **16 bayt** vs 8 bayt | PK + har FK'da. **165 FK** bo'yicha bu indeks hajmini ~2× oshiradi. RAM'ga sig'maydigan indeks — disk I/O |
| **⚠️ Indeks yo'qligi bilan birga — og'irlashtiruvchi** | Kanon §3: `000000_init` da **165 FK ustida 0 ta performans indeksi**. Ya'ni indeks holati **allaqachon yomon**. UUID uni yomonlashtiradi |
| **O'qilmaydi** | Support: "MA-0001 ning ID'si nima?" → `3f2504e0-4f89-11d3-9a0c-0305e82c3301`. Log'da, URL'da, qo'lda debug'da — og'ir |
| **Migratsiya narxi** | 69 model, 165 FK. Butun sxemani qayta yozish |

### Alternativa C — UUIDv7 — ⚠️ eng jiddiy raqib, halol tan olinadi

**UUIDv7 — UUID v4 ning asosiy kamchiligini yo'q qiladi.** U **vaqt bo'yicha
tartiblangan**: birinchi 48 bit — Unix millisekund timestamp, qolgani tasodifiy.

**Ya'ni u ikkala dunyoning yaxshi tomonini oladi:**

| | autoincrement | UUID v4 | **UUIDv7** |
|---|---|---|---|
| Indeks lokalligi | ✅ Ideal | ❌ Tasodifiy | ✅ **Deyarli ideal** (vaqt bo'yicha o'suvchi) |
| Taxmin qilinadimi | ❌ **Ha** | ✅ Yo'q | ✅ **Yo'q** (tasodifiy qism bor) |
| Hajm | 8 bayt | 16 bayt | ⚠️ 16 bayt |
| Mijozda generatsiya | ❌ Yo'q | ✅ Ha | ✅ Ha |
| JS'da qulaylik | ❌ `BigInt` og'riq | ✅ String | ✅ **String** |
| 2⁵³ muammosi | ⚠️ Bor (patch bilan) | ✅ Yo'q | ✅ **Yo'q** |
| Toshib ketish | ⚠️ Nazariy | ✅ Yo'q | ✅ Yo'q |

> ⚠️ **Halol xulosa: agar bu loyiha bugun noldan boshlanayotgan bo'lsa,
> UUIDv7 to'g'riroq tanlov bo'lishi mumkin edi.**
>
> U bu ADR ning **ikkala jiddiy zaifligini** — enumeration va JS noqulayligini —
> **bir vaqtda** yopadi, va indeks lokalligi bo'yicha autoincrement'ga deyarli
> teng. Uning yagona real narxi — 16 bayt va tartiblanish ichida vaqt
> ma'lumotining sizishi (yozuv qachon yaratilganini ID'dan bilish mumkin).

**Nega baribir `BigInt` qoladi:**

1. **Mavjud kod.** Bu — hal qiluvchi sabab, va u texnik emas, **iqtisodiy**.
   O'lchangan: **69 model**, **165 FK**, `ParseBigIntPipe` **199 joyda**,
   `toBigInt` **682 marta**, 128 DTO. UUIDv7 ga o'tish — bularning
   **hammasiga** tegadi
2. **Migratsiya narxi ishlab turgan tizimda.** Bu **demo emas** (kanon §0):
   real akademiya, har kuni ishlatiladi. 69 jadvalning PK tipini almashtirish
   — ma'lumot migratsiyasi + 165 FK qayta bog'lash + downtime. Va migratsiya
   tarixi **allaqachon drift holatida** (kanon §3: `track_subjects` migratsiyada
   yo'q). **Drift ustiga PK migratsiyasi qo'yish — javobgarlik emas, qimor**
3. **Prisma'da UUIDv7 hozircha native emas.** `@default(uuid(7))` Prisma
   versiyasiga bog'liq; `@default(dbgenerated(...))` bilan PostgreSQL tomonda
   funksiya yozish kerak (PG 18'gacha `uuidv7()` yadroda yo'q). Ya'ni qo'shimcha
   infratuzilma
4. **Muammo qaysi biri kattaroq?** Enumeration — **real, lekin RBAC bilan
   yumshatilgan** (pastda). Migratsiya — **real va qimmat**. Balans
   `BigInt` tomonda

> **Ya'ni bu — "BigInt UUIDv7 dan yaxshi" degani emas.** Bu — **"o'zgartirish
> narxi foydadan katta"** degani. Bu farqni yozish muhim: aks holda kelajakda
> kimdir "biz UUIDv7 ni o'ylab ko'rmaganmiz" deb o'ylaydi. **O'ylab ko'rilgan.**
>
> ⚠️ **Bu qaror yangi loyiha uchun majburiy emas.** Agar MathAcademy'dan
> ajralgan yangi servis yozilsa — u UUIDv7 ni **erkin tanlashi mumkin**.
> Bu ADR **mavjud 69 modelga** tegishli.

## Oqibatlar

**Ijobiy:**

- **2⁵³ muammosi tuzilmaviy jihatdan yo'q** — ID hech qachon jimgina
  yaxlitlanmaydi
- **Indeks lokalligi ideal** — ketma-ket INSERT, page split yo'q. ⚠️ Bu ayniqsa
  muhim, chunki indeks holati allaqachon yomon (165 FK, 0 performans indeksi)
- **8 bayt** — 165 FK bo'yicha UUID'ga nisbatan indeks hajmi ~2× kichik
- **O'qiladi** — log, URL, qo'lda debug oson
- **`ParseBigIntPipe` 199 joyda** — controller qatlamida BigInt kafolatlangan,
  izchil
- **`main.ts:15-21` patch idempotent** — HMR/test runner'da ikki marta
  qo'llanmaydi

**Salbiy:**

- ⚠️ **`BigInt` JS'da noqulay.** `JSON.stringify(1n)` → **`TypeError`**.
  Shuning uchun global prototip patch (`main.ts:15-21`) — va **prototip
  patch'ning o'zi hidli**: u global holatni o'zgartiradi, uchinchi tomon
  kutubxonasi `toJSON` ga tayansa kutilmagan natija berishi mumkin
- ⚠️ **Aralashtirib bo'lmaydi:** `1n + 1` → `TypeError`. Bu **yaxshi** (xato
  erta chiqadi), lekin har konversiyada `BigInt()` / `n` suffiksi — kod shovqinli
- ⚠️ **API'da ID string sifatida qaytadi** (`"id": "42"`). Bu ataylab, lekin
  bu **shartnomani noqulay** qiladi: `"42"` son ekanini tip tizimi bilmaydi

- ⚠️ **`bigint.util.ts` — kanon uni "yagona konversiya yo'li" deydi. O'lchov
  buni tasdiqlamaydi.**

  Bu — ADR yozilayotganda o'lchangan va **kanonni tuzatadigan** topilma:

  ```bash
  grep -rn "toBigInt" --include=*.ts apps/api/src | wc -l          # → 682
  grep -rn "parseBigIntId" --include=*.ts apps/api/src | wc -l     # → 6
  grep -rn "bigint.util" --include=*.ts apps/api/src
  # → src/common/utils/id.util.ts:1   (re-export)
  # → src/common/utils/tenant.util.ts:3  (O'LIK KOD — ADR-0002 §Kontekst)
  ```

  `toBigInt` **28 ta servis faylida mustaqil qayta e'lon qilingan** —
  `announcements`, `assessments`, `attendance`, `awards`, `billing`, `campuses`,
  `certificates`, `cohorts`, `competitions`, `discipline`, `displays`, `dorms`,
  `events`, `files`, `groups`, `leaves`, `notifications`, `ranking`,
  `permissions`, `roles`, `user-roles`, `risk`, `tracks`, `students`,
  `subjects`, `tenants`, `timetable`, `users`.

  **Va nusxalar bir xil emas.** `assessments.service.ts:18`:
  ```ts
  if (!/^\d+$/.test(s) || s === '0')            // ← '0' RAD ETILADI
  ```
  `students.service.ts:21`:
  ```ts
  if (!s || !/^\d+$/.test(s))                   // ← '0' QABUL QILINADI
  ```

  Ya'ni **`students` servisi `id=0` ni o'tkazadi, qolgan 27 tasi rad etadi.**
  Bu — 28 ta nusxaning **allaqachon ajralib ketgani** isboti.

  Va `parseBigIntId` (haqiqiy umumiy util) — amalda **o'lik**: uni faqat
  `tenant.util.ts` (o'zi o'lik kod) va `id.util.ts` (iste'molchisiz re-export)
  chaqiradi.

  > ⚠️ **Bu — `tenant.util.ts` naqshining takrori** (ADR-0002 §Kontekst):
  > umumiy util yozilgan, lekin **lokal nusxa yozish osonroq bo'lgan** —
  > shuning uchun umumiysi o'lgan. Bir loyihada **ikkinchi marta** o'sha xato.
  >
  > **Bu qarorning salbiy oqibati emas — uni amalga oshirishning kamchiligi.**
  > Lekin uni bu ADR'da yozish shart, chunki kanon §5.2 bu infratuzilmani
  > "to'g'ri qilingan" deb maqtaydi va **bu maqtov to'liq emas**: controller
  > qatlami (199 × `ParseBigIntPipe`) haqiqatan to'g'ri, **servis qatlami esa
  > 28 ta nusxa**.

- ⚠️ **Ikkita infratuzilma fayli — O'LIK KOD (o'lchangan):**
  - `common/decorators/param-bigint.decorator.ts` — `ParamBigInt`. **0 ta
    chaqiruv** (grep: 1 natija, faylning o'zi). Controller'lar uning o'rniga
    `@Param('id', ParseBigIntPipe)` ni to'g'ridan-to'g'ri yozadi — ya'ni
    dekorator **hech narsani qisqartirmagan**
  - `common/validators/is-bigint-string.decorator.ts` — `IsBigIntString`.
    **0 ta chaqiruv** (grep: 2 natija, ikkalasi ham faylning o'zida). 128 DTO
    dan **bittasi ham** ishlatmaydi

  Kanon §5.2 bu to'rt faylni "BigInt intizomi — to'g'ri qilingan" ro'yxatida
  keltiradi. **Halol o'lchov: 4 tadan 2 tasi ishlatiladi** (`ParseBigIntPipe` —
  199, `bigint.util.ts` — amalda 0), **2 tasi o'lik**.

- ⚠️ **Autoincrement ID taxmin qilinadi — enumeration.** `/students/1`,
  `/students/2`, `/students/3`. Bu — **strukturaviy** zaiflik va uni
  `BigInt` yechmaydi. UUIDv7 yechardi.

  **Halol baho — himoya bor va u jiddiy:**
  `students.controller.ts:89-90`:
  ```ts
  @RequirePermissions('students.read')
  @Get(':id')
  ```
  Kanon §5.3 (o'lchangan): `PermissionsGuard` ostida ruxsat e'lon qilmagan
  **bitta ham route yo'q** — **234 ta** `@RequirePermissions`. Va tenant filtri
  servisda (`students.service.ts:538-539`: `findFirst({ where: { id, tenant_id } })`).

  Ya'ni: **begona o'quvchini ID taxmin qilib o'qib bo'lmaydi.** ID taxmin
  qilinadi, lekin ma'lumot qaytmaydi.

  **Lekin qolgan real xavflar:**
  1. **Ma'lumot sizishi hajm haqida.** `/students/50000` mavjud bo'lsa —
     tizimda kamida 50 000 o'quvchi bor. Bu — **raqobat ma'lumoti**.
     Xuddi shu `invoices`, `tenants` uchun
  2. **404 va 403 farqi.** Agar begona tenant ID'siga `404`, mavjud bo'lmagan
     ID'ga ham `404` qaytsa — sizish yo'q. Agar **farq qilsa** — hujumchi
     enumeration bilan boshqa tenant'da qaysi ID'lar borligini xaritalaydi.
     ⚠️ **Bu o'lchanmagan. Tekshirilsin** — `13-testing-strategy.md` mavzusi
  3. ⚠️ **`/uploads` — bu yerda himoya UMUMAN yo'q.** `main.ts:57-61`
     `express.static` bilan xizmat qiladi — guard yo'q, tenant yo'q, JWT yo'q.
     Agar fayl nomi taxmin qilinadigan bo'lsa, enumeration **ishlaydi**.
     → ADR-0002 §Oqibatlar va [../10-security.md](../10-security.md)

  > **Ya'ni: enumeration bu qarorning real narxi. U RBAC bilan yumshatilgan,
  > lekin yo'q qilinmagan — va `/uploads` da umuman yumshatilmagan.**

- ✅ ⚠️ **Frontendda `parseInt(id)` bagi — O'LCHANDI, TOPILMADI.**

  Kutilgan bag: frontend ID'ni `parseInt` qilsa, 2⁵³ dan katta ID jimgina
  buziladi. O'lchov:

  ```bash
  grep -rn "parseInt(" --include=*.tsx --include=*.ts apps/web/src | wc -l  # → 15
  ```

  15 ta `parseInt` ning **hech biri ID ustida emas**. Hammasi — domen sonlari:
  `maxScore` (`AssessmentsPage.tsx:818`), `graduationYear` (`CohortsPage.tsx:237,834`),
  `rank` (`CompetitionsPage.tsx:215,473`), `capacity` (`DormsPage.tsx:236`),
  `grade` (`GroupsPage.tsx:84`), `score` (`RiskPage.tsx:95,206,207`),
  `admissionGrade` (`StudentsPage.tsx:165,183,184`), `dayOfWeek` / `periodNo`
  (`TimetablePage.tsx:970,995`).

  > **Bu bag YO'Q. 0 natija.** Frontend ID'larni **string** sifatida ishlatadi
  > — ya'ni `main.ts` dagi `toJSON` patch bilan shartnoma **izchil bajarilgan**.
  >
  > ⚠️ Bu — bu ADR ning "salbiy" bo'limiga **to'qib qo'shilishi mumkin bo'lgan**
  > va **qo'shilmagan** narsa. Halol yozuv qoidasi (kanon §2): *"Raqam to'qima"*.
  > **Nazariy xavf real bag emas.** Xavf **qoladi** (kelajakda kimdir yozishi
  > mumkin), lekin u **bugungi bag deb ko'rsatilmaydi**.
  >
  > **Himoya:** lint qoidasi — `parseInt`/`Number` ni `*Id` bilan tugaydigan
  > maydonlarga qo'llash **taqiqlanadi**. Bu — bagni tutish emas, **oldini olish**.

## Majburlash

- **ESLint:** `apps/web` da `*Id` maydonlariga `parseInt` / `Number` /
  unary `+` **taqiqlanadi** (hozir 0 ta buzilish — qoida **toza holatda**
  kiritiladi, bu eng arzon payt)
- **ESLint:** `apps/api/src/modules/**` da lokal `function toBigInt` e'loni
  **taqiqlanadi** → `common/utils/bigint.util.ts` dan import majburiy.
  ⚠️ Bundan oldin 28 nusxa yagona semantikaga keltirilishi kerak — `'0'`
  masalasi hal qilinsin (`students.service.ts` boshqacha ishlaydi)
- **O'lik kod:** `param-bigint.decorator.ts` va `is-bigint-string.decorator.ts`
  yo **ishlatilsin**, yo **o'chirilsin**. Ishlatilmaydigan himoya —
  himoyasizlikdan yomonroq (ADR-0002 §Kontekst dagi dalil)
- **Test:** `BigInt.prototype.toJSON` patch'i uchun test — API javobida ID
  **string** ekani. Hozir bu **hech narsa bilan tekshirilmagan**, va u patch
  butun API shartnomasining asosi
- **Migratsiya intizomi:** yangi model — `BigInt @id @default(autoincrement())`,
  yoki composite `@@id` (agar bola jadval bo'lsa). `Int` PK **taqiqlanadi**

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| **Enumeration real hujumga aylansa** | `404` vs `403` farqi o'lchansa va u tenant xaritalashga yo'l bersa → javob kodlari birlashtiriladi (**ADR emas, bugfix**) |
| **`/uploads` fayl nomlari taxmin qilinadigan bo'lsa** | Fayl yo'li `id` yoki ketma-ket sondan hosil bo'lsa → **fayl nomi UUID v4** ga o'tadi. ⚠️ Bu **PK qaroriga tegmaydi** — faqat fayl nomiga |
| **Mijozda ID generatsiya qilish talab qilinsa** | Offline-first mobil ilova yoki optimistic UI kerak bo'lsa → **UUIDv7 qayta ko'riladi**. Autoincrement mijozda generatsiya qilinmaydi — bu printsipial chegara |
| **Yangi mustaqil servis yozilsa** | MathAcademy'dan ajralgan servis → bu ADR **majburiy emas**, UUIDv7 erkin tanlanadi |
| **`BigInt` toshib ketish yaqinlashsa** | `attendance_marks` yoki `audit_logs` da `last_value` **2⁶²** dan oshsa → bu amalda hech qachon bo'lmaydi (2⁶³ ≈ 9.2 × 10¹⁸). **Bu signal hech qachon yonmaydi va shu yaxshi** |
| **Prisma UUIDv7 ni native qo'llasa + yangi loyiha** | `@default(uuid(7))` rasmiy bo'lsa → **mavjud 69 model baribir o'zgarmaydi**. Migratsiya narxi bu qarorning asosi, va Prisma qo'llashi u narxni kamaytirmaydi |
| **Kanon §5.2 tuzatilsa** | Bu ADR o'lchagan fakt (28 nusxa `toBigInt`, 2 ta o'lik fayl) kanonga kirsa → bu ADR §Oqibatlar yangilanadi |

## Havolalar

- [../04-data-model.md](../04-data-model.md) — 69 model, PK va FK taqsimoti
- [./0002-prisma-extension-for-tenant-isolation.md](./0002-prisma-extension-for-tenant-isolation.md) — 18 model `tenant_id` siz; 12 composite PK model bilan ustma-ust tushadi
- [../10-security.md](../10-security.md) — enumeration, `/uploads` kirish nazorati
- [../05-api-spec.md](../05-api-spec.md) — ID string sifatida uzatilishi
- [../12-frontend-spec.md](../12-frontend-spec.md) — frontendda ID string qoidasi
- [../13-testing-strategy.md](../13-testing-strategy.md) — `toJSON` patch testi, `404`/`403` o'lchovi
- [`CANON.md`](../CANON.md) §5.2, §9
- `apps/api/src/main.ts:15-21` — `BigInt.prototype.toJSON` patch
- `apps/api/src/common/pipes/parse-bigint.pipe.ts` — 199 ta chaqiruv
- RFC 9562 — UUID Version 7 (vaqt bo'yicha tartiblangan)
