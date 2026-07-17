# ADR-0006 — Pul: bazada Decimal, API chegarasida string. `Number()` hech qachon

- **Holat:** Taklif
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

Ziyo pul bilan ishlaydi va bu **real pul**: ota-onalar har oy o'quv,
yotoqxona va ovqatlanish uchun to'laydi. `billing` moduli — loyihaning uchinchi
eng katta servisi (1 610 qator).

Valyuta — UZS (so'm).

### ⚠️ Avval: bu loyihada Float YO'Q

Ko'p "pul ADR"lari `0.1 + 0.2 !== 0.3` misolidan boshlanadi va mavjud kodni
float ishlatgani uchun ayblaydi. **Bu yerda bunday tanqid o'rinsiz** — grep
tasdiqladi:

```
grep "Float" apps/api/prisma/schema.prisma   →  0 natija
```

Sxemadagi **barcha** pul maydonlari `Decimal(12,2)`:

| Jadval | Ustun | Tip | Qator |
|---|---|---|---|
| `dorm_announcement_prices` | `price_amount` | `Decimal(12,2)` | `schema.prisma:330` |
| `dorm_student_charges` | `amount` | `Decimal(12,2)` | `schema.prisma:390` |
| `invoices` | `amount` | `Decimal(12,2)` | `schema.prisma:536` |
| `meal_announcement_prices` | `price_amount` | `Decimal(12,2)` | `schema.prisma:591` |
| `meal_student_charges` | `amount` | `Decimal(12,2)` | `schema.prisma:625` |
| `payments` | `paid_amount` | `Decimal(12,2)` | `schema.prisma:708` |

**Baza qatlami to'g'ri va o'zgartirilmaydi.** PostgreSQL `NUMERIC(12,2)` — o'nlik
kasr, ikkilik emas. `0.1 + 0.2` muammosi bazada **mavjud emas**. Buni halol tan
olish kerak, chunki ADR ning vazifasi — muammoni **topilgan joyda** ko'rsatish,
kutilgan joyda emas.

### Asl muammo — nozikroq: JS chegarasida izchillik yo'q

Prisma `NUMERIC` ni JS'ga `Prisma.Decimal` obyekti sifatida qaytaradi. Muammo
o'sha obyekt bilan **nima qilinishida**, va bu yerda **bitta servis ichida ikki
xil shartnoma** bor:

```ts
// apps/api/src/modules/billing/billing.service.ts:1576-1583
return {
  unpaidCount,
  unpaidTotal: unpaidTotal._sum.amount?.toString() || '0',        // ← string
  partialCount,
  partialTotal: partialTotal._sum.amount?.toString() || '0',      // ← string
  totalInvoices,
  currentMonthRevenue: currentMonthRevenue._sum.paid_amount?.toString() || '0',  // ← string
  revenueTrend: Array.from(monthMap.values()).reverse(),
};
```

```ts
// apps/api/src/modules/billing/billing.service.ts:1601-1607
return invoices.map((inv) => ({
  id: inv.id.toString(),
  studentName: inv.students.full_name,
  amount: Number(inv.amount),                                     // ← number
  type: inv.type,
  dueDate: inv.due_date,
}));
```

**Bir fayl. 25 qator masofa. Ikki xil tip.** `/billing/summary` pulni string
qaytaradi, `/billing/pending-payments` — number. Mijoz kodi ikkalasini ham
qo'llab-quvvatlashi kerak va **qaysi endpoint qaysi tipni beradi** — hech qayerda
yozilmagan.

Va yana ikkita joy:

```ts
// billing.service.ts:1569  — grafik uchun, ming so'mga bo'linadi
const amount = Number(p.paid_amount) / 1000;

// billing.service.ts:1248  — solishtirish uchun
} else if (Number(totalPaid) > 0) {
```

Ya'ni `Decimal` obyekti JS chegarasida **to'rt xil taqdirga** uchraydi:
`.toString()`, `Number()`, `Number()/1000`, `Number() > 0`. Qoida yo'q.

## Qaror

**Uch qatlam, uch aniq tip:**

| Qatlam | Tip | Qoida |
|---|---|---|
| **Baza** | `Decimal(12,2)` | Mavjud. **O'zgarmaydi.** |
| **Servis (domen)** | `Prisma.Decimal` | Arifmetika `.plus()` / `.minus()` / `.times()` bilan |
| **API chegarasi** | **`string`** | **Har doim.** Istisnosiz |

**`Number()` pulga hech qachon.** Hech qayerda. Hisobda ham, solishtiruvda ham,
grafikda ham.

```ts
// ❌ Taqiqlanadi
amount: Number(inv.amount)
const amount = Number(p.paid_amount) / 1000;
if (Number(totalPaid) > 0)

// ✅ To'g'ri
amount: inv.amount.toString()                      // API chegarasi
const amount = p.paid_amount.dividedBy(1000);      // domen arifmetikasi
if (totalPaid.greaterThan(0))                      // solishtiruv
```

Grafik uchun ming so'mga bo'lish ham — **domen amali emas, ko'rsatish amali**.
U frontendga ko'chadi yoki `Decimal.dividedBy()` bilan bajarilib, chegarada
string bo'ladi.

## Sabablar

### Nega baza o'zgarmaydi

`Decimal(12,2)` — **to'g'ri javob**. `NUMERIC` o'nlik arifmetika beradi:
`0.1 + 0.2 = 0.3` — aniq. Chegara: `12` raqam, `2` kasr → maksimum
**9 999 999 999.99 so'm** ≈ 10 milliard. Akademiya invoysi uchun bu yetarli
va bu ADR uni muhokama qilmaydi.

Ishlayotgan va to'g'ri narsani o'zgartirish — **sof xavf, nol foyda**.

### ⚠️ Halol xavf tahlili: bu bag hozir UXLAB YOTIBDI

ADR ning halol bo'lishi shuni talab qiladi: **`Number(inv.amount)` bugun
ma'lumot buzmaydi.** Nega:

```js
Number("20000000.00")   // 20000000  — ANIQ
Number("9999999999.99") // 9999999999.99 — ANIQ (2⁵³ dan kichik)
```

JS `number` — IEEE 754 double, **2⁵³ ≈ 9 007 199 254 740 992** gacha butun sonni
**aniq** ifodalaydi. Bizning maksimum — 10 milliard, ya'ni 2⁵³ dan **~900 000 marta
kichik**. Butun so'm qiymatlari `Number()` dan **shikastsiz** o'tadi.

Xavf **faqat kasr qiymat yig'ilganda** paydo bo'ladi:

```js
// Agar tiyin real ishlatilsa:
let total = 0;
for (const p of payments) total += Number(p.amount);  // 0.1 + 0.2 muammosi
```

Va bu yerda ikkinchi halol fakt: **O'zbek so'mida tiyin amalda muomalada yo'q.**
Narxlar butun so'mda. `Decimal(12,2)` ning `.00` qismi amalda **doim nol**.

**Ya'ni:** bag mavjud, lekin **uyqu holatida**. Uni uyg'otadigan narsa —
foizli hisob (kechikish jarimasi, chegirma, qisman to'lov taqsimoti). Bularning
hech biri hozir yo'q.

⚠️ **Lekin schema buni majburlamaydi.** `Decimal(12,2)` kasr **ruxsat etadi**.
Agar ertaga "5% chegirma" qo'shilsa, `20000000 * 0.05 = 1000000` — butun,
muammosiz. Lekin "1/3 ga bo'lib to'lash" qo'shilsa — `6666666.666...` va
`Number()` yig'indisi **jimgina** balансni buzadi.

**Xulosa:** bu ADR bagni tuzatmaydi — **bag hali yo'q**. U bagning **tug'ilishini**
oldini oladi. Bu — eng arzon vaqt, chunki hozir tuzatish 4 ta qatorni o'zgartirish;
foizli hisob qo'shilgandan keyin — auditni ham talab qiladi.

### Nega API chegarasida string, number emas

Uch sabab:

1. **JSON `number` — bu IEEE 754 double.** JSON spetsifikatsiyasi (RFC 8259 §6)
   aniq ogohlantiradi: qabul qiluvchi tomonning aniqligi kafolatlanmaydi. Pulni
   JSON number sifatida yuborish — **mijozning JS parseriga ishonish**
2. **Izchillik `Decimal` bilan.** `Decimal` konstruktori string qabul qiladi:
   `new Decimal("20000000.00")` — **yo'qotishsiz**. `new Decimal(20000000)` —
   avval `number` bosqichidan o'tadi
3. **BigInt bilan bir xil naqsh.** Loyihada ID'lar `BigInt` va ular API'da
   **allaqachon string** (`inv.id.toString()` — `billing.service.ts:1602`).
   Pul uchun boshqa qoida joriy qilish — **ikkita naqsh**, ikkita esda tutiladigan narsa.
   Bitta qoida: **"aniqligi muhim son — chegarada string"**

### Alternativa A: BigInt tiyin (`Decimal` o'rniga) — nega tanlanmadi

**Ustunligi — bu KUCHLIROQ yechim va buni yashirish mumkin emas:**

- **Yaxlitlash muammosi tuzilmaviy jihatdan imkonsiz.** Tiyindan mayda birlik yo'q →
  kasr paydo bo'lolmaydi. `Decimal` esa kasrni **ruxsat etadi** va uni to'g'ri
  boshqarish dasturchi zimmasida
- **JS native tip.** Kutubxona yo'q, `+` / `-` / `*` to'g'ridan-to'g'ri ishlaydi
- **Tip xavfsizligi.** `1n + 1` → `TypeError`. Aralashtirish **imkonsiz**.
  `Decimal` da esa `new Decimal(5).plus(0.1)` — jimgina float'ni yutadi
- **Chegara amalda cheksiz** — 2⁶³ tiyin ≈ 92 kvadrillion so'm
- **Loyihada allaqachon BigInt intizomi bor** — ID'lar uchun (`parse-bigint.pipe.ts`,
  `bigint.util.ts`, `is-bigint-string.decorator.ts`). Ya'ni jamoa BigInt'ni **biladi**
  va infratuzilma **tayyor**

Oxirgi nuqta jiddiy: BigInt tiyinga o'tish loyihaning **mavjud naqshiga mos** tushardi.

**Nega baribir tanlanmadi:**

1. **Baza migratsiyasi talab qiladi.** `NUMERIC(12,2)` → `BIGINT` = har qiymatni
   ×100 qilish. Bu **6 ta jadvalda** (`invoices`, `payments`, `dorm_student_charges`,
   `meal_student_charges`, va 2 ta `*_announcement_prices`), **real ota-onalar
   to'lovi ustida**. Qaytarib bo'lmaydigan `UPDATE`
2. ⚠️ **Va loyihaning migratsiya tarixi hozir ishonchsiz** —
   [ADR-0008](./0008-migrations-as-source-of-truth.md) ga qarang: sxema va
   migratsiya tarixi **allaqachon zid**. Ishonchsiz migratsiya mexanizmi ustida
   **pul ustunini** o'zgartirish — mas'uliyatsizlik. Bu alternativa hech bo'lmasa
   ADR-0008 hal bo'lgunicha **texnik jihatdan mumkin emas**
3. **`Decimal` allaqachon to'g'ri.** BigInt "yaxshiroq", lekin `Decimal` "noto'g'ri"
   emas. Migratsiya narxi to'g'ridan **to'g'riroqqa** o'tish uchun to'lanadi —
   noto'g'ridan to'g'riga emas. Bu narx/foyda nisbati **yomon**
4. **Asl muammo baza tipi emas.** Yuqorida ko'rsatildi: muammo — JS chegarasidagi
   izchillik. Uni **bugun**, migratsiyasiz hal qilish mumkin. BigInt'ga o'tish
   xuddi shu izchillik ishini **baribir** talab qiladi — ya'ni migratsiya
   **qo'shimcha** ish, muqobil emas

**Halol xulosa:** agar loyiha bugun noldan yozilsa — **BigInt tiyin tanlanardi**.
U tanlanmayapti, chunki loyiha noldan yozilmayapti. Bu — texnik ustunlik emas,
**kontekst** qarori. Va ADR aynan shuning uchun yoziladi: olti oydan keyin kimdir
"nega BigInt emas?" deb so'raganda javob **shu yerda**, "o'ylamaganmiz" emas.

### Alternativa B: hamma joyda `Number` (izchil, lekin float) — nega rad etildi

**Ustunligi:** eng sodda. `Number(inv.amount)` — bitta chaqiruv, obyekt yo'q,
mijozda `parseFloat` shart emas, JSON tabiiy. Va yuqorida ko'rsatilganidek —
**bugungi qiymatlar uchun aniq**.

**Nega rad etildi:** bu — bagni **rasmiylashtirish**. Bugun ishlaydi, chunki tiyin
ishlatilmaydi. Ertaga foizli hisob qo'shilganda **jimgina** buziladi va buzilish
buxgalteriya solishtiruvida chiqadi — ya'ni **eng qimmat joyda**. "Hozir ishlayapti"
— arxitektura sababi emas.

### Alternativa C: `string` bazada ham — nega rad etildi

**Ustunligi:** hech qanday konversiya yo'q, hech qayerda.

**Nega rad etildi:** bazada arifmetika **imkonsiz** bo'ladi. `SUM(amount)`,
`ORDER BY amount` — ishlamaydi. Hozir `billing.service.ts` ikkalasini ham
ishlatadi (`_sum.amount`, `orderBy: { amount: 'desc' }` — `:1590`). Bu qaror
hisobotlarni **ilova xotirasiga** ko'chirardi — mantiqsiz.

## Oqibatlar

**Ijobiy:**

- **Bitta shartnoma.** Pul API'da **doim** string. `billing.service.ts:1578` va
  `:1605` o'rtasidagi ziddiyat yo'qoladi
- **Aniqlik yo'qolmaydi** — bazadan mijozgacha o'nlik ifoda saqlanadi
- **Baza tegilmaydi** — migratsiya yo'q, real to'lov ma'lumoti xavf ostida emas
- **ID naqshiga mos** — `BigInt` ID'lar allaqachon string. Bitta qoida: aniqligi
  muhim son chegarada string
- **BigInt'ga o'tish yo'li ochiq qoladi.** API string bo'lgani uchun ichki
  ifodani keyin o'zgartirish **mijozni buzmaydi**. Ya'ni bu qaror
  Alternativa A ni **taqiqlamaydi**, uni **arzonlashtiradi**

**Salbiy:**

- ⚠️ **`Decimal` noqulay va bu real narx.** `a + b` o'rniga `a.plus(b)`.
  Solishtiruv `a > b` o'rniga `a.greaterThan(b)`. Har amal — metod chaqiruvi.
  Kod **shovqinli** bo'ladi va yangi dasturchi buni **unutadi**:

  ```ts
  if (invoice.amount > 0)              // ← Decimal obyekti > 0 → har doim true!
  if (invoice.amount.greaterThan(0))   // ← to'g'ri
  ```

  Birinchi variant **kompilyatsiya bo'ladi** va **jimgina noto'g'ri ishlaydi**.
  Bu — `Decimal` ning BigInt oldidagi eng katta zaifligi (`1n > 0` xavfsiz,
  `1n + 1` esa xato tashlaydi).

- ⚠️ **Muammo yo'qolmaydi — KO'CHADI.** API string qaytarsa, mijoz uni **baribir**
  songa aylantirishi kerak — ko'rsatish, saralash, jamlash uchun. Va u
  `parseFloat("20000000.00")` yozadi. Ya'ni:

  ```
  Backend:  Decimal → string    ✅ aniqlik saqlandi
  Frontend: string → parseFloat ❌ aniqlik yo'qoldi
  ```

  **Chegarani himoya qilish — mijozni himoya qilmaydi.** Bu ADR
  `apps/web` uchun hech narsani hal qilmaydi va buni tan olish kerak.
  Frontend uchun alohida qaror kerak ([12-frontend-spec.md](../12-frontend-spec.md)):
  ko'rsatish uchun `Intl.NumberFormat`, hisob uchun — hisob **umuman
  frontendda bo'lmasligi kerak**.

  Bu — DTM 189 qoidasi bilan **bir xil naqsh**: mantiq frontendga sizib
  o'tgan ([07-dtm-assessment-engine.md](../07-dtm-assessment-engine.md)).

- ⚠️ **`decimal.js` hozir loyihada YO'Q.** O'lchandi: `apps/api/package.json` da
  to'g'ridan-to'g'ri bog'liqlik sifatida **yo'q**, `import ... from 'decimal.js'` —
  **0 natija**. `Prisma.Decimal` faqat Prisma orqali (`@prisma/client` ^7.3.0)
  keladi.

  Ya'ni "servisda `Decimal.js`" — bu **mavjud amaliyot emas, taklif**. Hozir
  `Decimal` obyekti servisga keladi va darhol `Number()` yoki `.toString()` bilan
  **tashlab yuboriladi** — u bilan arifmetika **umuman qilinmaydi**. Shuning uchun
  bu ADR holati — **Taklif**, "Qabul qilingan" emas.

- **`Prisma.Decimal` — Prisma'ga bog'lanish.** Domen qatlami ORM tipiga tayanadi.
  Prisma almashtirilsa yoki `Decimal` ifodasini o'zgartirsa (Prisma 7 da bu
  sozlanadigan) — domen kodi ta'sirlanadi. To'g'ri yechim — o'z `Money` tipini
  o'rash, lekin bu bu ADR doirasidan tashqarida
- **Migratsiya bir kunda bo'lmaydi.** `Number()` ning 4 ta ma'lum joyi bor
  (`billing.service.ts:1248, 1569, 1605` va h.k.), lekin butun kod bo'ylab
  tekshirilmagan. ESLint qoidasi kerak, aks holda 5-chi joy ertaga qo'shiladi

## Majburlash

Bu ADR **niyat bilan emas, CI bilan** majburlanadi (CI hozir yo'q —
[11-infrastructure.md](../11-infrastructure.md)):

- **ESLint:** `prisma/schema.prisma` da pul maydonida `Float` — taqiqlanadi
  (hozir buzilmagan, lekin qoida **kelajakni** himoya qiladi)
- **ESLint (custom):** `Number(` ichida `amount` / `price` / `paid` nomli
  identifikator — xato
- **Kod review:** har yangi pul endpoint'i chegarada string qaytaradimi
- **Test:** `billing` endpoint'lari `typeof amount === 'string'` kontrakt testi

⚠️ **Bularning hech biri hozir mavjud emas.** Loyihada test **amalda nol**
([13-testing-strategy.md](../13-testing-strategy.md)) va `.github/` katalogi yo'q.
Ya'ni bu ADR hozir **faqat hujjat**, majburlash mexanizmi emas. Halol yozilsin.

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| Kasrli pul hisobi qo'shildi | Foiz, chegirma, jarima yoki taqsimot logikasi kodga kirdi → BigInt tiyin **darhol** qayta baholanadi |
| Tiyin real ishlatila boshladi | `invoices.amount` da `.00` bo'lmagan qiymat paydo bo'ldi (SQL: `WHERE amount % 1 <> 0` → > 0 qator) |
| Ko'p valyuta talab qilindi | Ikkinchi valyuta kerak bo'ldi → `currency` ustuni **majburiy** (hozir yo'q — barcha jadval UZS deb faraz qiladi) |
| Balans mos kelmadi | Buxgalteriya solishtiruvida farq topildi (bitta hodisa yetarli) → audit + BigInt migratsiyasi |
| ADR-0008 hal bo'ldi | Migratsiya tarixi ishonchli bo'ldi → BigInt migratsiyasi **texnik jihatdan mumkin** bo'ladi |
| 10 mlrd chegarasi yaqinlashdi | `MAX(amount) > 5_000_000_000` → `Decimal(12,2)` kengaytiriladi |

## Ochiq savollar

1. **`currency` ustuni kerakmi?** Hozir **hech bir** pul jadvalida valyuta ustuni
   yo'q — UZS **yashirin faraz**. Bir tenant uchun to'g'ri. Ikkinchi akademiya
   boshqa valyutada ishlasa? Ehtimoldan yiroq (O'zbekiston bozori), lekin
   faraz **yozilmagan**
2. **`assessments.max_score` va `weight` ham `Decimal`** (`schema.prisma:61-62`) —
   bu pul emas, ball. Ular uchun `Number()` xavfsizmi? Ehtimol ha, lekin bir xil
   ESLint qoidasi ularni ham ushlaydi — false positive
3. **`billing.service.ts:1569` da `/1000`** — grafik uchun ming so'mga bo'lish.
   Bu backend ishimi yoki frontend? Qaror `Decimal.dividedBy()` deydi, lekin
   to'g'ri javob — buni **umuman backendda qilmaslik**
4. **`Prisma.Decimal` ustiga o'z `Money` tipi o'ralsinmi?** ORM bog'liqligini
   uzadi, lekin yana bir abstraksiya qatlami qo'shadi
5. **Mavjud 4 ta `Number()` joyi qachon tuzatiladi?** Bu ADR qabul qilinsa —
   ular **bagga aylanadi**. Tuzatish rejasi kerak

## Havolalar

- [04-data-model.md](../04-data-model.md) — pul maydonlari va `Decimal(12,2)`
- [05-api-spec.md](../05-api-spec.md) — API chegarasi shartnomasi
- [12-frontend-spec.md](../12-frontend-spec.md) — mijozda `parseFloat` muammosi
- [13-testing-strategy.md](../13-testing-strategy.md) — kontrakt testlari
- [ADR-0003](./0003-bigint-primary-keys.md) — BigInt ID'lar; API'da string naqshi
- [ADR-0008](./0008-migrations-as-source-of-truth.md) — nega BigInt migratsiyasi hozir mumkin emas
- Kod: `apps/api/src/modules/billing/billing.service.ts:1248, 1569, 1578, 1605`
- Martin Fowler — "Money" pattern (Patterns of Enterprise Application Architecture)
- RFC 8259 §6 — JSON `number` aniqligi kafolatlanmaydi
- PostgreSQL — `NUMERIC` tipi hujjati
