# Ziyo — Texnik topshiriq (TZ)

> Ko'p ijarachilik (multi-tenant) Student Information System.
>
> ⚠️ **Bu papka boshqa TZ'lardan bitta muhim narsa bilan farq qiladi: loyiha
> allaqachon ishlaydi.** Bu — noldan qurish rejasi emas. Bu — real xodimlar
> va ota-onalar har kuni ishlatadigan tizimni **yetuklashtirish** rejasi.
>
> Ya'ni har taklif ikki savolga javob berishi kerak: *nima yaxshilanadi* va
> *ishlab turgan narsa buzilmaydimi*.

---

## Bu hujjatlar qanday yozilgan

**Har da'vo kodda o'lchangan.** "Ehtimol", "odatda", "menimcha" — yo'q. Agar
hujjatda raqam bo'lsa, u `grep` yoki `wc` natijasi. Agar tekshirib bo'lmagan
bo'lsa — **ochiq savol** deb belgilangan, taxmin qilinmagan.

Barcha o'lchovlar — **[CANON.md](./CANON.md)** da, va har raqam yonida uni
bergan **buyruq** turibdi. Ziddiyat bo'lsa: **fakt g'olib**.

Bu jarayon **kanonning o'zini ham oltita joyda tuzatdi.** Boshlang'ich brif
"Redis ishlatiladi", "migratsiyalar to'g'ri", "MAIN fan yagonaligi
tekshiriladi" degan edi — uchalasi ham **xato**. To'liq jurnal —
[CANON.md §9](./CANON.md#9--tuzatishlar-jurnali--bu-kanon-nimalarda-xato-bolgan).
U **ataylab o'chirilmagan**: eng ibratli xato — "tenant filtri 176 joyda"
da'vosi, u **takrorlanadigan o'lchov** edi, lekin noto'g'ri savolga javob
berardi. Haqiqiy raqam — **845**.

**Loyihaning kuchli tomonlari ham yozilgan** — tanqid uchun tanqid yo'q:
BigInt intizomi, permission-based RBAC (234 ta e'lon, himoyasiz route 0 ta),
`Decimal` bilan pul (Float **yo'q**), Postgres'dagi auth lock, `useCrud`
poydevori, 48/48 sahifa lazy-loading.

---

## Qayerdan boshlash

| Siz | O'qing |
|---|---|
| **Loyiha bilan endi tanishyapsiz** | [00-vision-and-market.md](./00-vision-and-market.md) → [01-product-spec.md](./01-product-spec.md) |
| **Implementatsiyani boshlayapsiz** | **[14-roadmap.md](./14-roadmap.md)** → [03-multi-tenancy.md](./03-multi-tenancy.md) → [adr/](./adr/) |
| **"Nega bu shunday?" deb so'ramoqchisiz** | [adr/](./adr/) |
| **Domenni tushunmoqchisiz** | [07-dtm-assessment-engine.md](./07-dtm-assessment-engine.md) — DTM 189 ball, loyihaning mavjudlik sababi |
| **Nima buzilganini bilmoqchisiz** | [14-roadmap.md](./14-roadmap.md) §1 — "Bosqich 0" |

⚠️ **Implementatsiya qiladigan bo'lsangiz — [14-roadmap.md](./14-roadmap.md)
dan boshlang, bu ro'yxatdan emas.** Ustuvorlik **muhimlik bo'yicha emas,
bog'liqlik bo'yicha** tartiblangan, va eng muhim ish **birinchi emas**.

---

## Hujjatlar

### Poydevor

| # | Hujjat | Nima haqida |
|---|---|---|
| 00 | [Vizyon va bozor](./00-vision-and-market.md) | Nima uchun bu loyiha. Raqiblar (WeWork, EducationCRM). **Bozor hajmi — noma'lum, to'qilmagan.** Nega yutishi va nega yutmasligi mumkin |
| 01 | [Mahsulot spetsifikatsiyasi](./01-product-spec.md) | 6 aktyor, 7 foydalanuvchi yo'li, 28 modul, guardian portali, non-goal'lar |
| 02 | [Arxitektura](./02-architecture.md) | Monolit — **to'g'ri qaror**. Qatlamlar, `common/` poydevori, modullararo bog'liqlik (**28 modul, 0 import qirrasi**) |
| 04 | [Ma'lumotlar modeli](./04-data-model.md) | 69 model. **18 tasida `tenant_id` yo'q**. 69 modelga **1 enum**. 165 FK, **0 performans indeksi**. Migratsiya drifti |
| 05 | [API spetsifikatsiyasi](./05-api-spec.md) | Versiyalash **yo'q**. BigInt→string patch (to'g'ri). Xatolik formati. `ENABLE_SWAGGER` yolg'oni |

### O'zak — loyihaning yuragi

| # | Hujjat | Nima haqida |
|---|---|---|
| 03 | [**Multi-tenancy**](./03-multi-tenancy.md) | **Eng muhim hujjat.** 845 qo'lda nuqta. `tenant.util.ts` — o'lik kod. Prisma extension yechimi va uning **halol chegarasi**. RLS taqqoslash. Fayllar — `express.static` guard'dan tashqarida |
| 07 | [DTM baholash dvigateli](./07-dtm-assessment-engine.md) | **189 ball** (93+63+33) — akademiyaning mavjudlik sababi. Qoida **frontendda**, domende emas. Track tarkibi majburlanmaydi |
| 08 | [Analitika va xavf](./08-analytics-and-risk.md) | `student_outcomes` — asosiy KPI. Xavf skori **qo'lda kiritiladi** (`{manual:true}`) — *tracking*, *detection* emas. `COALESCE(...,'GREEN')` — "bilmayman" "xavfsiz" bo'lib ko'rinadi |
| 09 | [Billing va moliya](./09-billing-and-finance.md) | Uch to'lov oqimi. **Float yo'q — baza to'g'ri.** Muammo: JS chegarasida izchillik yo'q |

### Platforma

| # | Hujjat | Nima haqida |
|---|---|---|
| 06 | [Autentifikatsiya va RBAC](./06-auth-and-rbac.md) | JWT, refresh, brute-force. **RBAC yaxshi qilingan.** Lekin resource-level scope **yo'q va modelda ham yo'q**. Guardian slug bagi |
| 10 | [Xavfsizlik](./10-security.md) | `seed.ts` voqeasi. **`Math.random()` bilan parol — 3 faylda.** MIME fail-open → stored XSS. Bolalar ma'lumoti, O'RQ-1125 |
| 11 | [Infratuzilma](./11-infrastructure.md) | Render bepul tarif chegaralari. **`/tmp/uploads` — har deploy'da suratlar o'chadi.** Narxlar (2026, tasdiqlangan). CI — Actions billing |
| 12 | [Frontend spetsifikatsiyasi](./12-frontend-spec.md) | `useCrud` poydevori. **BigInt bagi YO'Q** (tekshirildi). Fan roli massiv indeksidan o'qiladi. **Dizayn hal qilinmagan** — §14 savollari |
| 13 | [Test strategiyasi](./13-testing-strategy.md) | **Testlar amalda nol.** Tenant izolyatsiya testi — tizimning eng muhim testi. Testcontainers, factory, property test |
| 15 | [Observability](./15-observability.md) | Structured logging **yo'q**, `new Logger()` — **0 natija**. Filter xatoni **butunlay tashlab yuboradi**. $0 to'plam |

### Yo'l

| # | Hujjat | Nima haqida |
|---|---|---|
| 14 | [**Yo'l xaritasi**](./14-roadmap.md) | **Shu yerdan boshlang.** Bog'liqlik tartibi, nima nimani to'sib turibdi, tugaganini qanday bilamiz. Xaritada **yo'q** narsalar va nega |

### Asos

| Hujjat | Nima haqida |
|---|---|
| [**CANON.md**](./CANON.md) | **O'lchangan faktlar bazasi.** TZ dagi har raqam shu yerdan keladi, va uni bergan buyruq ham shu yerda. §9 — **tuzatishlar jurnali**: kanon nimalarda xato bo'lgan va qanday topilgan |

### Qarorlar

[**adr/**](./adr/) — 8 ta Architecture Decision Record. Nega shunday qilingan
va **rad etilgan alternativalar** (ularning ustunligi bilan birga). Ular ikki
xil: **tasdiqlovchi** (mavjud amaliyot to'g'ri, ADR narxini qayd qiladi) va
**tuzatuvchi** (amaliyot bilan niyat zid).

---

## Uchta narsa — o'qishdan oldin biling

### 1. Loyiha ishlaydi, va bu hamma narsani o'zgartiradi

Commit tarixida:
```
fix: guardian login format mismatch — split on first dash, allow MA-XXXX loginId
fix: guardian timetable shows period number when startsAt is null
fix: production bugs — timetable dayOfWeek coercion, billing fields, CSV limit
```
36 daqiqada to'rtta tuzatish, biri to'g'ridan-to'g'ri **"production bugs"**
deb nomlangan. Bu commit'lar spetsifikatsiyadan yozilmaydi — ular **kira
olmagan ota-onadan** kelib chiqadi.

**Oqibat:** hech narsani "toza" deb qayta yozib bo'lmaydi. Har o'zgarish
migratsiya yo'li bilan keladi.

### 2. Eng shoshilinch ish — eng muhimi emas

```
Migratsiya drifti → toza baza yo'q → test yo'q → extension refactoringi yo'q
```
Loyihaning eng muhim ishi (strukturaviy tenant izolyatsiyasi) **to'rt qadam
narida**. Buni tushunmasdan boshlash — testsiz 845 ta so'rovni o'zgartirish
demak.

### 3. TZ ikkita narsani hal qila olmaydi

- **Ma'lumot tuzatish** — productionda nechta yaroqsiz track bor? Faqat
  o'lchov ko'rsatadi, va nima qilish kerakligini faqat akademiyani biladigan
  odam aytadi
- **Bozor** — sotuv kanali va mijoz. Bosqich 4 ning butun asosi shu, va u
  **kodda yo'q**

Bu ikkisi [14-roadmap.md](./14-roadmap.md) §7 da ochiq savol sifatida
turibdi. TZ ularni yashirmaydi.

---

## Konvensiyalar

| | |
|---|---|
| **TZ tili** | O'zbek (lotin). Texnik atamalar ingliz |
| **Kod va kommentlar** | Ingliz |
| **README (repo ildizi)** | Ingliz |
| **Prisma model nomlari** | `snake_case`, ko'plik (`student_tracks`) — Prisma odati emas, lekin **mavjud kod**. [ADR](./adr/) da asoslangan |
| **Migratsiya** | Majburiy. `db push` — **hech qachon** ([ADR-0008](./adr/0008-migrations-as-source-of-truth.md)) |
