# 11 — Infratuzilma (Infrastructure)

> **Loyiha:** MathAcademy Digital Campus — ko'p ijarachilik (multi-tenant) SIS
> **Hujjat holati:** mavjud infratuzilmani o'lchash va uni real ishlatishga yaroqli
> holatga keltirish rejasi. Har bir narx **2026-yil iyul holatiga** veb-qidiruv bilan
> tekshirilgan, manbasi berilgan. Narxlar o'zgaradi — qaror oldidan manbani qayta oching.
>
> ⚠️ **Moliyaviy kontekst (butun hujjatni belgilaydi):** muallif — talaba, byudjet **$0**.
> Har taklif uchun narx bor; pullik yechim yonida **bepul alternativa** ham bor.
> "Shunchaki $25/oy to'lang" — bu hujjatda javob emas.
>
> ⚠️ **Va eng muhimi:** bu **DEMO EMAS**. Tizimni real xodimlar va real ota-onalar har
> kuni ishlatadi. "Bepul tarifda uxlab qolsa ham mayli" bu yerda o'tmaydi — kim kutadi
> degan savolning javobi: **ota-ona kutadi.**

**Bog'liq hujjatlar:** `10-security.md` (sirlar, ma'lumot lokalizatsiyasi, audit) ·
`13-testing-strategy.md` (CI'dagi testlar, anonimlashtirish) · `15-observability.md`
(hozir **yo'q**) · `14-roadmap.md`

---

## 0. Avval shuni o'qing — uchta o'lchangan topilma

Bu hujjat 13 bo'limdan iborat, lekin **uchta fakt qolgan hammasini belgilaydi**:

| # | Topilma | Oqibat | Bo'lim |
|---|---|---|---|
| 1 | 🔴 **Migratsiya tarixi sxemaga zid** — 68 `CREATE TABLE` vs 69 model. `track_subjects` va `SubjectRole` (DTM 189 ning o'zagi) **hech qaysi migratsiyada yo'q** | **Toza bazada ilova ko'tarilmaydi.** Ko'chish, staging, CI — hammasi bloklangan. Bu hujjatdagi **har bir taklifning old sharti** | **7.0** |
| 2 | 🔴 **Bepul Postgres 30 kunda expire, 44-kunda O'CHIRILADI, backup yo'q** | Real o'quvchi ma'lumoti nusxasiz, taymer ustida | **3.2** |
| 3 | 🔴 **`UPLOAD_DIR=/tmp/uploads` — ephemeral disk** | Fayllar har deployda **va har uyg'onishda** yo'qoladi. DB o'lik havolalar bilan to'ladi, **jimgina** | **5.2** |

**Tartib:** 1 va 2 (dump) **bugun, parallel** — ular bir-biriga bog'liq emas. Qolgan
hamma narsa 1 dan keyin.

⚠️ **Va bitta yaxshi xabar:** Redis **yo'q va kerak ham emas** — locklar Postgres'da, va bu
**to'g'ri qaror** (4-bo'lim). Upstash uchun $0 tejaldi.

---

## 1. Hozirgi holat — `render.yaml` da nima yozilgan

### 1.1 Fayl to'liq o'qildi

Butun deploy konfiguratsiyasi bitta faylda: `render.yaml` (57 qator). Boshqa infra fayli
**yo'q** — Dockerfile yo'q, docker-compose yo'q, `.github/` yo'q (6-bo'limda tasdiqlangan).

`render.yaml` **ikkita** resurs e'lon qiladi:

| Resurs | Turi | Tarif | Qator |
|---|---|---|---|
| `mathacademy-api` | `web` (Node) | **ko'rsatilmagan → Render `free` beradi** | `render.yaml:1-7` |
| `mathacademy-db` | PostgreSQL | **`plan: free`** — ochiq yozilgan | `render.yaml:54-58` |

### 1.2 API qanday quriladi va ishga tushadi

```yaml
rootDir: apps/api
buildCommand: npm ci --include=dev && npx prisma generate && npm run build
startCommand: npx prisma migrate deploy && node dist/main
```

**Build:** `apps/api` ichida devDependencies bilan o'rnatadi (`nest build` uchun
`@nestjs/cli` kerak — `apps/api/package.json:52`), Prisma client generatsiya qiladi,
`dist/` yasaydi. **Start:** har ko'tarilishda **avval `prisma migrate deploy`**, keyin
`node dist/main` (7-bo'limda batafsil — u yerda jiddiy muammo bor).

`DATABASE_URL` — `fromDatabase` orqali avtomatik (`render.yaml:11-14`); ulanish satri
qo'lda yozilmagan. ✅ `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` — `generateValue: true`
(`render.yaml:17-20`): sir repoda emas va ikkalasi **har xil**, ya'ni `.env.example:17-20`
dagi ogohlantirish talabi bajarilgan. ✅

### 1.3 ⚠️ Muammo №1 — frontend umuman deploy qilinmaydi

`render.yaml` da **`apps/web` uchun servis yo'q**. API deploy bo'ladi; **48 sahifali React
ilovasi (36 staff + 12 guardian) hech qayerga chiqmaydi**. Ya'ni `render.yaml` — **to'liq
deploy tavsifi emas**. Frontend qo'lda, boshqa joyga qo'yilgan va u kodda
hujjatlashtirilmagan. **Infratuzilmaning yarmi repo tashqarisida, kimningdir boshida.**

**Tuzatish ($0):** `apps/web` ni Render **Static Site** sifatida qo'shish. Static site
bepul va — muhimi — **uxlamaydi**, chunki u konteyner emas, CDN. Ya'ni 2-bo'limdagi
muammo frontendga **tegishli emas**.

```yaml
  - type: web
    name: mathacademy-web
    runtime: static
    rootDir: apps/web
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html   # SPA — react-router uchun majburiy
```

⚠️ `rootDir` + `npm ci` monorepo workspace bilan ziddiyat qiladi — 8.2 ga qarang.

### 1.4 ⚠️ Muammo №2 — `WEB_ORIGINS` yo'q → production'da CORS o'lik

`main.ts:72` `parseOrigins(process.env.WEB_ORIGINS)` o'qiydi. `main.ts:76-82` ruxsat
to'plamini quradi:

```ts
const allowSet = new Set([
  `http://localhost:${frontendPort}`, `http://127.0.0.1:${frontendPort}`,
  `http://localhost:${port}`, `http://127.0.0.1:${port}`,
  ...exactOrigins,
]);
```

`main.ts:83,97-98` da esa: `if (!isProduction && isLocalDevOrigin(origin)) return callback(null, true);`

Endi `render.yaml` ni qarang: **`WEB_ORIGINS` umuman yo'q**, `NODE_ENV=production`
(`render.yaml:9-10`), `WEB_PORT=3000` (`render.yaml:35-36`). Natija: `exactOrigins` bo'sh
→ `allowSet` faqat localhost:3000/4000 → production'da localhost yumshatishi o'chiq →
**har qanday real brauzer origin'i `callback(null, false)` oladi**.

Ya'ni `render.yaml` dagi konfiguratsiya bilan **frontend API'ga ulana olmaydi**. 1.3 bilan
birga o'qilganda xulosa bitta: **`render.yaml` ishlab turgan tizimni tavsiflamaydi.**
Real deploy Render panelida qo'lda kiritilgan env'lar bilan boshqacha sozlangan.

**Bu o'z-o'zidan infra muammosi:** IaC fayli haqiqatga mos kelmasa u xavfli — kimdir uni
ko'rib "shunday ekan" deb qayta deploy qilsa, tizim buziladi.

**Tuzatish ($0):**

```yaml
      - key: WEB_ORIGINS
        value: https://mathacademy-web.onrender.com
      - key: COOKIE_DOMAIN
        value: .onrender.com     # yoki o'z domeningiz
      - key: COOKIE_SAME_SITE
        value: none              # API va web har xil domenda bo'lsa majburiy
```

⚠️ `COOKIE_DOMAIN` va `COOKIE_SAME_SITE` ham `render.yaml` da yo'q, lekin
`.env.example:26-29` da bor va refresh cookie shularga bog'liq. `COOKIE_SECURE=true`
(`render.yaml:27-28`) to'g'ri, lekin `SameSite` sozlanmasa cross-site refresh cookie
brauzerda tashlanadi.

### 1.5 Bepul tarifmi?

**Ha, to'liq bepul — $0/oy.** Postgres `plan: free` ochiq yozilgan; web servisda tarif
ko'rsatilmagan → Render Free beradi. Bepul narx uchun to'lanadigan haq — 2, 3, 4, 5-bo'limlarda.

---

## 2. ⚠️ Render bepul tarifi — uxlash muammosi

### 2.1 Fakt (tekshirilgan)

Render rasmiy hujjatidan:

> Render spins down a Free web service that goes **15 minutes** without receiving any
> inbound traffic. A Free web service spins back up whenever it next receives an HTTP
> request ... this process takes **about one minute**.
>
> Render grants **750 Free instance hours** to each workspace per calendar month.

Manba: [Deploy for Free – Render Docs](https://render.com/docs/free). Sovuq start
uchinchi tomon o'lchovlarida odatda **30–60 soniya**
([Kuberns 2026](https://kuberns.com/blogs/render-pricing/)).

### 2.2 Bu MathAcademy uchun nimani anglatadi

| Vaqt | Nima bo'ladi |
|---|---|
| 23:00–07:00 | Hech kim kirmaydi → servis **uxlaydi** |
| 07:00 | Birinchi ota-ona kechagi bahoni ko'rmoqchi → **~40 soniya oq ekran** |
| 13:00 | Tushlik, 20 daqiqa jimlik → **yana uxlaydi** |
| 13:20 | O'qituvchi davomat qo'ymoqchi → **yana ~40 soniya** |

Bu kuniga bir marta emas — **har jimlik oynasidan keyin**. Kichik akademiyada jimlik
oynalari kun davomida ko'p.

40 soniya kutgan ota-ona "sayt ishlamayapti" deb o'ylaydi, yangilaydi, yana kutadi, keyin
akademiyaga qo'ng'iroq qiladi. Ya'ni bu texnik muammo emas — bu **akademiya obro'si va
xodim ish vaqti**. ⚠️ Va Neon (scale-to-zero) qo'shilsa sovuq startlar **qo'shiladi**:
API ~40s + DB ~1s (3.4).

### 2.3 Yechim A — Render Starter · **$7/oy**

512 MB RAM, 0.5 vCPU, **uxlamaydi**. Bu Render'ning **rasmiy va yagona
qo'llab-quvvatlanadigan** yechimi — hujjat ochiq aytadi: uxlashni to'xtatish uchun pullik
tarifga o'ting. Manbalar: [Render Docs — Free](https://render.com/docs/free),
[Costbench 2026](https://costbench.com/software/developer-tools/render/free-plan/).

```yaml
  - type: web
    name: mathacademy-api
    plan: starter        # ← $7/oy, uxlamaydi
```

⚠️ **512 MB yetadimi — O'LCHANMAGAN.** NestJS + Prisma 7 + 69 model yengil emas; Prisma
engine bir o'zi odatda 80–150 MB. **Deploy qilib RSS o'lchang.** OOM bo'lsa keyingi qadam
Standard (2 GB) — **$25/oy** ([Kuberns](https://kuberns.com/blogs/render-pricing/)). Bu
sakrash byudjet uchun sezilarli, shuning uchun o'lchov **avval** qilinsin.

### 2.4 Yechim B — Cron ping · **Render buni taqiqlaydimi?**

**Tekshirildi. Javob: rasmiy hujjatda ochiq taqiq YO'Q, lekin qo'llab-quvvatlanadigan yo'l
ham emas.**

- Render'ning [Free hujjati](https://render.com/docs/free) pingni **umuman tilga olmaydi** — sukut.
- Render pozitsiyasi bir xil: uxlamaslik kerak bo'lsa — pullik tarif. Ping "workaround"
  ([community #197645](https://github.com/orgs/community/discussions/197645)).
- [Render ToS](https://render.com/terms) da aniq taqiq bandi **topilmadi**.

⚠️ **Lekin matematik cheklov hal qiluvchi:**

```
Bir oyda soatlar:            ~730 soat (24 × 30.4)
Free instance hours limiti:   750 soat/oy  (butun WORKSPACE uchun!)
```

**Bitta** servisni ping bilan 24/7 uyg'oq tutsangiz — **730/750** yeysiz, qoladi 20 soat.
Demak: ✅ bitta servis uchun texnik sig'adi; ❌ **ikkinchi servisga (staging) joy
qolmaydi**; ❌ oy o'rtasida qayta deploy qilib eski instansiya biroz ishlab qolsa —
limitdan oshasiz; ❌ limitdan oshsa Render servisni **to'xtatadi** — "40 soniya kutish"
o'rniga **umuman ishlamaydi**.

**Narxi:** ping $0 (UptimeRobot bepul: 50 monitor / 5 daq; cron-job.org bepul).
**Xavfi:** 750 soatga urilib butun tizim o'chishi.

**Halol xulosa:** ping — bu **$7 ni tejash uchun tizimni oy oxirida o'chib qolish xavfiga
qo'yish**. Real ota-onalar uchun bu almashuv **yomon**. Faqat vaqtinchalik ishlating va
750 soat hisoblagichini kuzating.

### 2.5 Yechim C — boshqa provayder

⚠️ **2026-da bepul hosting bozori qisqargan.** Tekshirilgan holat:

| Provayder | 2026 bepul tarif | Baho |
|---|---|---|
| **Fly.io** | ❌ **Yo'q.** 2024-da Hobby/Launch/Scale bekor. Yangi hisob: **2 VM-soat yoki 7 kun** trial, keyin ~$5/oy min | Bepul yechim sifatida **o'lgan** |
| **Railway** | ❌ **Doimiy bepul yo'q** (2023-da olib tashlandi). Hobby **$5/oy** ($5 kredit ichida). 2026-boshida prepaid kredit ham olib tashlandi — karta majburiy | $5/oy, resurs kreditdan yeyiladi |
| **Koyeb** | ✅ **2 ta "nano" servis bepul** | Yagona jiddiy bepul raqib. ⚠️ nano NestJS+Prisma uchun yetadimi — **o'lchanmagan** |
| **Render** | ✅ Bepul, lekin uxlaydi + 750 soat | Hozirgi holat |

Manbalar: [Fly.io Free Tier 2026](https://www.saaspricepulse.com/blog/flyio-free-tier-2026),
[Railway Pricing 2026](https://www.srvrlss.io/provider/railway/),
[Platforms with a real free tier in 2026 — Render](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)

**Ko'chish arziydimi? Yo'q.** Koyeb'ga ko'chish = yangi platforma o'rganish +
`render.yaml` ni tashlash + noma'lum resurs limiti — **$7 ni tejash uchun**. Muallif vaqti
ham resurs. **Render'da qoling.**

### 2.6 Yechim D — O'zbekiston hostingi (avval huquq, keyin narx)

**Tekshirilgan huquqiy holat.** "Shaxsga doir ma'lumotlar to'g'risida"gi qonunning
27¹-moddasi **2026-yil 27-martda yumshatildi**:

- **Majburiy O'zbekistonda:** biometrik, genetik ma'lumotlar, telekom abonentlari ma'lumoti;
- **Boshqa shaxsiy ma'lumotlar xorijda saqlanishi MUMKIN**, agar shartlardan biri
  bajarilsa: chet davlat teng himoya ta'minlovchi deb tan olinishi / standart shartnomaviy
  shartlar yoki majburiy korporativ qoidalar / vakolatli organ tasdiqlagan xalqaro
  standartlarga rioya.

Manbalar: [Kun.uz 2026-03-27](https://kun.uz/news/2026/03/27/shaxsga-doir-ayrim-malumotlarni-ozbekistondan-tashqarida-saqlashga-ruxsat-berildi),
[Gazeta.uz 2026-03-28](https://www.gazeta.uz/oz/2026/03/28/personal-data/),
[gov.uz — qonun matni](https://gov.uz/oz/advice/61/document/2116)

**MathAcademy uchun:** avvalgi (2021–2026) rejimda Render'da o'quvchi ma'lumotini saqlash
qonunbuzarlik bo'lishi mumkin edi. 2026-mart o'zgarishidan keyin — **ehtimol mumkin**,
lekin shartlar bajarilganini **faqat yurist tasdiqlaydi** (13-bo'lim, 9–11-savollar).

**Agar yurist "O'zbekistonda saqlansin" desa — narxlar:**

| Yechim | Narxi (2026) | Izoh |
|---|---|---|
| **aHOST VDS** (TAS-IX) | **~150 000 so'm/oy** dan (25 GB SSD, 1 GB RAM, 1 core) → ~800 000 so'm/oy (400 GB, 8 GB, 6 core) | ~$12–64/oy (kurs ~12 500 so'm/$; **kursni tekshiring**) |
| **UZINFOCOM** | Tarif jadvali ochiq topilmadi — **to'g'ridan-to'g'ri so'rash kerak** | Virtual hosting, VPS, co-location |
| **`.uz` domen** | **27 000 so'm/yil** (rasmiy) | ~$2/yil |

Manbalar: [aHOST VDS](https://www.ahost.uz/vds),
[hosting-obzor.uz VPS reyting](https://www.hosting-obzor.uz/index.php?list=vds-vps-hosting)

⚠️ **VDS ≠ Render.** VDS'da sizga **bo'sh Linux** beriladi: nginx, TLS (certbot),
PostgreSQL, **backup**, systemd, monitoring, xavfsizlik yangilanishlari — hammasi
o'zingizda. Bu **$12/oy + haftasiga bir necha soat ish**. Render'ning $7 i shu ishni ham
qamraydi. **Halol solishtiruv: VDS arzon emas, u boshqa valyutada — pul o'rniga vaqt.**

✅ TAS-IX ichida bo'lgani uchun O'zbekiston foydalanuvchilariga **sezilarli tez** va ko'p
operatorlarda trafik hisobga kirmaydi. Lekin bu **keyingi bosqich muammosi**.

---

## 3. Ma'lumotlar bazasi

### 3.1 Hozir qayerda

`render.yaml:54-58` — Render'ning boshqariladigan PostgreSQL'i, `plan: free`.

### 3.2 ⚠️ FALOKAT: bepul Postgres 90 kun emas, **30 kun**

Topshiriqdagi "90 kun" — **eskirgan. Haqiqat yomonroq.** Render changelog (2024-05-20):

> **Free PostgreSQL instances now expire after 30 days (previously 90)**

Manba: [Render Changelog](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90).
[Render Docs](https://render.com/docs/free) tasdiqlaydi:

> Free Render Postgres databases **expire 30 days after creation**. After a Free database
> expires, you have a grace period of **14 days** ... After the grace period, **Render
> deletes the database (along with all of its data)**.
>
> Free Render Postgres databases **don't support any form of backups**. Fixed storage
> capacity of **1 GB**.

**Hozirgi `render.yaml` bilan taymer:**

```
0-kun   → DB yaratildi
30-kun  → EXPIRE — DB ishlamay qoladi
44-kun  → grace tugadi → DB va BARCHA MA'LUMOT O'CHIRILADI. Backup YO'Q.
```

**Bu real akademiyaning ma'lumoti:** baholar, davomat, to'lovlar, intizom, yotoqxona
taqsimoti, `student_outcomes` (kim qayerga kirgan — akademiyaning asosiy KPI'si).
**44-kuni hammasi yo'q bo'ladi va tiklab bo'lmaydi.**

⚠️ **Bu hujjatdagi eng jiddiy topilma.** **Bugun DB yoshini tekshiring** (Render panel →
Database → Created). 30 kundan oshgan bo'lsa — siz grace period ichidasiz. Va **hozir
`pg_dump` oling** (10.2) — bu 5 daqiqalik ish va u ma'lumotni saqlab qoladi.

### 3.3 Alternativalar — bepul tariflar (2026, tekshirilgan)

| Provayder | Storage | Compute | Muddat | Backup | ⚠️ Tuzoq |
|---|---|---|---|---|---|
| **Render Free** | 1 GB | doim | **30 kun → o'chadi** | ❌ **yo'q** | O'lim taymeri |
| **Neon Free** | **0.5 GB** | 100 CU-soat/oy, 2 CU gacha, scale-to-zero | ✅ **muddatsiz** | ✅ PITR (cheklangan) | 0.5 GB kichik; scale-to-zero → ~1s sovuq start |
| **Supabase Free** | **500 MB** DB + 1 GB fayl | doim | ✅ muddatsiz | 7 kun log | ⚠️ **1 hafta faolsizlikda proyekt PAUZA** (2026-fev qattiqlashtirildi) — qo'lda uyg'otish |
| **Aiven Free** | **1 GB** | 1 GB RAM, 1 CPU, **max 20 ulanish**, pooling yo'q | ✅ muddatsiz | cheklangan | 20 ulanish Prisma pool uchun tor; faolsizlikda o'chadi |

Manbalar: [Neon plans](https://neon.com/docs/introduction/plans),
[Aiven Free PostgreSQL](https://aiven.io/free-postgresql-database),
[Supabase Free Tier 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/),
[Top PostgreSQL Free Tiers 2026 — Koyeb](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026)

### 3.4 Tavsiya (halol tahlil)

**Bir zumda: Render Free Postgres'dan chiqing. U vaqt bombasi.**

⚠️ **LEKIN — old shart:** ko'chish = yangi, toza bazada schema qurish. Va **hozir toza
bazada schema qurilmaydi** (7.0 — `track_subjects` migratsiyada yo'q). Ya'ni **avval 7.0.2,
keyin ko'chish**. Bu tartibni buzsangiz, Neon'da ilova ko'tarilmaydi va siz buni ko'chish
o'rtasida bilib qolasiz. ✅ **Dump olish (10.2) esa bunga bog'liq emas — uni hozir qiling.**

**→ Neon (tavsiya, $0):**
- ✅ **Muddatsiz** — o'lim taymeri yo'q. Bu **hal qiluvchi farq**. Backup/PITR bor.
- ⚠️ 0.5 GB kichik ko'rinadi, lekin **o'lchanmagan**. SIS ma'lumoti asosan matn va son;
  rasmlar DB'da emas (5-bo'lim). Bir necha yuz o'quvchi × bir necha yil ≈ o'nlab MB.
  **`SELECT pg_database_size(...)` — bitta so'rov bu savolni yopadi.**
- ⚠️ **Sovuq start:** Free'da scale-to-zero **doim yoqilgan**, 5 daq faolsizlikdan keyin
  uxlaydi; uyg'onish ~300–800 ms, birinchi so'rovgacha ~0.5–1 s
  ([Neon Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)). Render'ning
  40 soniyasi yonida **arzimas** — lekin API Starter'ga o'tgach bu yagona qolgan sovuq
  start bo'ladi.
- ⚠️ 100 CU-soat/oy = 730 soatlik oyning 13%i. Faqat faol vaqt sanaladi; akademiya kunduzi
  ishlaydi → **ehtimol yetadi, kuzatilsin**.

**→ Aiven ($0):** 1 GB — Neon'dan ko'p. Lekin **20 ulanish, pooling yo'q** →
`DATABASE_URL` ga `?connection_limit=5` **majburiy**. Faolsizlikda o'chadi.

**→ Supabase:** ❌ **tavsiya etilmaydi.** 1 hafta faolsizlikda pauza — yozgi ta'tilda
tizimni o'chirib qo'yadi va sentabrda **qo'lda** uyg'otish kerak bo'ladi. Ishonchsiz.

**Pullik yo'l:** Render Postgres tariflari 2025–2026 da bir necha marta qayta tuzilgan —
narxni [Render Pricing](https://render.com/pricing) dan **deploy oldidan** tekshiring.
Bu yerda eskirgan raqam yozish xavfli.

---

## 4. Redis — **yo'q, va hozir kerak ham emas**

### 4.1 O'lchangan fakt

`.env.example:38-40` da `REDIS_HOST=localhost`, `REDIS_PORT`, `REDIS_PASSWORD`.
`apps/api/package.json:36-37` da `cache-manager` va `cache-manager-redis-store`.

**Lekin o'lchov boshqa narsa ko'rsatadi:**

| Nima izlandi | Natija |
|---|---|
| `redisStore` / `ioredis` importi | **0 ta** |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` `src/` ichida | **0 ta** — faqat `.env.example` da |
| `cache-manager-redis-store` importi | **0 ta** — o'rnatilgan, ishlatilmagan |
| `render.yaml` da Redis / Key Value servisi | **yo'q** |

Yagona kesh — `auth.module.ts:11-14`:

```ts
CacheModule.register({
  ttl: 300000, // 5 minutes in milliseconds
  max: 100,
});
```

`store` **berilmagan** → `@nestjs/cache-manager` **jarayon ichidagi xotira (in-memory LRU)**
ishlatadi. **Redis loyihada umuman ishlamaydi.**

### 4.2 ✅ Va bu — to'g'ri qaror. Ayblanmaydi

Auth locks **to'liq PostgreSQL'da** (`auth_attempts`, `auth_locks`, `auth_sessions` —
kanon 5.4). Bu Redis'dan **yaxshiroq**:

- ✅ Lock konteyner restartidan **omon qoladi** — va bepul tarifda konteyner kuniga bir
  necha marta uxlab-uyg'onadi (2-bo'lim). Redis'da (ayniqsa Render Key Value'da, u diskka
  yozmaydi) brute-force hisoblagichi **har uyg'onishda nolga qaytardi**;
- ✅ Instansiyalar orasida **to'g'ri ishlaydi** — DB yagona haqiqat manbai;
- ✅ Bitta bog'liqlik kam.

**Ya'ni Upstash kerak emas. $0 tejaldi.** Redis qo'shish bu yerda **hal qilinmagan
muammoga yechim** bo'lardi.

### 4.3 ⚠️ Lekin: `.env.example` mavjud bo'lmagan infratuzilmani va'da qiladi

Yangi dasturchi `.env.example:38-40` ni ko'radi → Docker'da Redis ko'taradi → u **hech
narsa qilmaydi**, va dasturchi buni bilmaydi. Bu `tenant.util.ts` bilan **bir xil naqsh**
(kanon 5.1): ishlayotgandek ko'rinadigan o'lik kod.

**Tuzatish ($0, 2 daqiqa):**
1. `cache-manager-redis-store` ni `package.json` dan **o'chirish** — u `npm ci` da yuklanadi,
   build vaqtini uzaytiradi, hujum yuzasini kengaytiradi va hech qanday kod import qilmaydi;
2. `.env.example` dan `REDIS_*` ni **olib tashlash** yoki ochiq izohlash:
   `# Redis ishlatilmaydi — kesh in-memory (auth.module.ts:11), locklar Postgres'da.`

### 4.4 ⚠️ Masshtablash chegarasi — bu **narx jadvaliga tegadi**

`auth.service.ts:359,393` ruxsatlarni keshlaydi (`user:${userId}:roles_perms`, TTL 5 daq),
`auth.service.ts:397-398` esa `invalidateUserCache()` bilan bekor qiladi
(`auth.service.ts:1063,1173` dan chaqiriladi — rol/ruxsat o'zgarganda).

In-memory kesh bilan **`invalidateUserCache()` faqat o'z process'ida ishlaydi.** Ya'ni:

> **2-instansiya ko'tarilsa — administrator o'qituvchidan ruxsatni olib tashlaydi,
> 1-instansiya keshni tozalaydi, 2-instansiya esa bekor qilingan ruxsatni yana
> 5 daqiqagacha amal qildiraveradi.**

Bu xavfsizlik oqibati bo'lgan bag — va u **`UPLOAD_DIR` lokal disk muammosi bilan bir
vaqtda portlaydi** (5-bo'lim): 2-instansiya ko'tarilishi bilan (a) **fayllar bo'linadi**
(har instansiyada o'z diski), (b) **ruxsat keshi nomuvofiq bo'ladi**.

⚠️ **Ikkalasi ham "1 instansiya" farazi ustida turibdi.** Demak **masshtablash kod
o'zgarishisiz mumkin emas** — bu 12-bo'limdagi narx jadvalida ko'rinadi: instansiya
ko'paytirishdan **oldin** R2 (fayl) va taqsimlangan kesh **majburiy**.

### 4.5 Redis qachon kerak bo'ladi — va narxi

**Trigger bitta:** ikkinchi instansiya. Ungacha — kerak emas.

| Variant | Bepul chegara | Pullik |
|---|---|---|
| **Upstash Redis** | ⚠️ **500K komanda/oy**, 256 MB | — |
| **Render Key Value** | 25 MB, 50 ulanish, ⚠️ **diskka saqlanmaydi** — restartda hammasi yo'qoladi | 25 MB Starter **$10/oy** |

⚠️ **"10k komanda/kun" — eskirgan raqam.** Upstash 2025-mart'da o'zgartirdi: endi **500K
komanda/oy** ≈ **16 600/kun** ≈ 690/soat. Kesh faqat `roles_perms` uchun ishlatilsa — bu
**ko'p marta yetadi**. Manbalar: [Upstash Redis Pricing](https://upstash.com/pricing/redis),
[Upstash new pricing](https://upstash.com/blog/redis-new-pricing),
[Render Key Value](https://www.srvrlss.io/provider/render/).

**O'shanda ham Upstash** ($0) — Render Key Value emas, chunki u restartda ma'lumotni
yo'qotadi. ⚠️ **Yoki umuman Redis'siz:** keshni olib tashlab, `roles_perms` ni har so'rovda
DB'dan o'qish. 5 daqiqalik keshning tejagani o'lchanmagan — **avval o'lchang, keyin
infratuzilma qo'shing.**

---

## 5. Fayllar — ⚠️ tasdiqlangan ma'lumot yo'qotish bag'i

### 5.1 Kod nima qiladi

`main.ts:57-66`:
```ts
const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { ... }));
```

`files.storage.ts:24` — xuddi shu `resolve(process.env.UPLOAD_DIR || 'uploads')`.
`files.controller.ts:130` (Swagger tavsifi, muallif so'zlari): *"Stores file **on disk
(UPLOAD_DIR)** and creates a DB record in files table."*

`.env.example:14`: `UPLOAD_DIR="uploads"` · `render.yaml:37-38`: `UPLOAD_DIR: /tmp/uploads`

### 5.2 ⚠️ Bu **bag**, va u `render.yaml` da yozib qo'yilgan

Render disk'i **ephemeral** — qayta deploy yoki restartda konteyner **yangidan** yaratiladi
va eski fayl tizimi **yo'qoladi**. Doimiy saqlash uchun Render'da alohida **Persistent
Disk** kerak (pullik) — `render.yaml` da u **yo'q**. Va `UPLOAD_DIR` **`/tmp/uploads`** ga
qo'yilgan — ephemeral'ning ham ephemerali. Bu tasodif emasga o'xshaydi: kimdir "root
papkaga yozib bo'lmayapti" muammosini `/tmp` bilan hal qilgan, ya'ni **muammoni yo'qotish**
bilan **hal qilish**ni almashtirgan.

| Hodisa | Fayllarga nima bo'ladi |
|---|---|
| Yangi deploy (har `git push`) | ❌ **Barcha yuklangan fayllar o'chadi** |
| Bepul tarifda uxlab-uyg'onish (**kuniga bir necha marta**) | ❌ **O'chadi** |
| Render infra restart | ❌ **O'chadi** |

⚠️ **Va eng yomoni — bu "jim" bag.** `files` jadvalidagi yozuv **qoladi**
(`files.service.ts:158` `storage_provider` ni `/uploads/` prefiksiga qarab belgilaydi).
Ya'ni: DB aytadi "rasm bor, URL `/uploads/abc.jpg`" → disk 404 qaytaradi → foydalanuvchi
**singan rasm** ko'radi → **hech kim xabar olmaydi**, chunki `express.static` da
`fallthrough: true` (`main.ts:64`) va log yozilmaydi.

**Ya'ni DB mavjud bo'lmagan fayllarga havolalar bilan asta-sekin to'ladi va buni hech kim
sezmaydi — ota-ona sezguncha.**

### 5.3 Yechim: S3-mos obyekt saqlash

**→ Cloudflare R2 (tavsiya):** bepul **10 GB saqlash**, 1M Class A + 10M Class B
operatsiya/oy, **egress BEPUR va cheksiz** (hech qanday storage sinfi uchun to'lanmaydi),
keyin ~$0.015/GB/oy. S3-mos API → `@aws-sdk/client-s3` ishlaydi. Manbalar:
[R2 Pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 Free Tier 2026](https://nubbo.app/blog/cloudflare-r2-free-tier/).
⚠️ 10 GB — bu **10 GB-oy** (o'rtacha oylik hajm), bir zumdagi maksimum emas
([cloudflare-docs #19072](https://github.com/cloudflare/cloudflare-docs/issues/19072)) —
kichik akademiya uchun farqi yo'q.

**→ Backblaze B2:** birinchi **10 GB doim bepul**, egress o'rtacha hajmning 3 barobarigacha
bepul, Cloudflare CDN orqali **cheksiz bepul egress**; keyin $6/TB/oy
([B2 Pricing](https://www.backblaze.com/cloud-storage/pricing)).

**→ Render Persistent Disk:** ❌ pullik, **Free'da yo'q**, va disk servisga bog'lanadi →
gorizontal skeyl imkonsiz. R2 bepul va yaxshiroq.

### 5.4 Migratsiya yo'li (ishlab turgan tizimni buzmasdan)

✅ **Yaxshi xabar:** `files.storage.ts:10` da `url: string` qaytaruvchi interfeys bor va
`files.service.ts:158` da `storage_provider` ustuni bor — **abstraksiya poydevori qo'yilgan**.

1. `files.storage.ts` ga `S3Storage` implementatsiyasi qo'shiladi (`local` yonida).
2. `STORAGE_PROVIDER=s3|local` env bilan tanlanadi. **Default `local`** — dev muhiti buzilmaydi.
3. `files.storage_provider` ustuni allaqachon bor → eski (`local`) va yangi (`s3`) yozuvlar
   **birga yashaydi**; read yo'li shunga qarab tarmoqlanadi.
4. Production'da `STORAGE_PROVIDER=s3` → **yangi fayllar R2'ga tushadi**.
5. Eski `local` yozuvlar allaqachon **yo'qolgan** (5.2) — ularni `files` jadvalidan
   tozalaydigan bir martalik skript kerak, aks holda DB o'lik havolalar bilan qoladi.

⚠️ **Qadam 5 dan oldin:** hozirgi konteynerda `/tmp/uploads` da **hali tirik** fayllar
bo'lishi mumkin (oxirgi deploydan beri yuklangani). **Darhol ko'chirib oling** — keyingi
deploy ularni o'ldiradi.

---

## 6. CI/CD

### 6.1 Hozir: yo'q

**Tekshirildi:** `ls d:\GitHubim\mathacademy\.github` → **`No such file or directory`**.
Kanon (6-bo'lim) to'g'ri.

Ya'ni: lint hech qachon avtomatik ishlamaydi; typecheck ishlamaydi; test — ishlatishga narsa
ham yo'q (kanon: **1 ta placeholder**); **buzilgan kod to'g'ridan-to'g'ri production'ga
ketadi**, chunki Render `main` ga push bo'lishi bilan deploy qiladi. Yagona himoya —
build'ning o'zi (`nest build` TS xatosida yiqiladi). Bu tekshiruv emas, **tasodif**.

### 6.2 ⚠️ Actions billing lock — bu ehtimol XATO va uni bepul yechish mumkin

**Fakt (tekshirilgan):**

> GitHub Actions usage is **free for standard GitHub-hosted runners in public
> repositories**, and for self-hosted runners.

Manbalar: [GitHub Docs — Billing and usage](https://docs.github.com/en/actions/concepts/billing-and-usage),
[Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

**Kanon 0-bo'limi:** `github.com/Sarvarbek0704/mathacademy` — **PUBLIC**.

**Demak: public repo + GitHub-hosted standard runner = $0. Har doim. Cheksiz.** Free
plan'dagi 2000 daqiqa/oy limiti **faqat private repolar uchun**.

**Unda nega lock?** Bu ma'lum va hujjatlashtirilgan muammo: billing muammosi (to'lanmagan
invoys, **$0 spending limit + "Stop usage" yoqilgani**, muvaffaqiyatsiz to'lov) **butun
hisob** darajasida Actions'ni bloklaydi — va **public repolar ham qoqiladi**, garchi ular
uchun to'lov umuman bo'lmasa ham. Manbalar:
[community #165506](https://github.com/orgs/community/discussions/165506),
[#167403](https://github.com/orgs/community/discussions/167403),
[#199036](https://github.com/orgs/community/discussions/199036),
[Billing Errors guide](https://devactivity.com/insights/solving-github-actions-billing-blocks-a-guide-to-uninterrupted-development-and-improved-performance-metrics/)

**Amal rejasi ($0 + bir necha kun sabr):**

1. **Settings → Billing and plans → Budgets and alerts.** Budget **$0** va "Stop usage when
   budget is exceeded" **yoqilgan** bo'lsa — bu eng keng tarqalgan sabab. O'chiring yoki
   chegarani ko'taring (public repo uchun baribir $0 hisoblanadi).
2. **Billing → Payment information** — muvaffaqiyatsiz to'lov / to'lanmagan invoys bormi.
3. 1 va 2 toza bo'lsa — **GitHub Support** (support.github.com). Faqat ularda blokni
   tozalaydigan asboblar bor. Aniq yozing:

   > "My repository `Sarvarbek0704/mathacademy` is **public**. Per your documentation,
   > Actions on standard GitHub-hosted runners are free for public repositories with no
   > minute limit. However my workflows are blocked with a billing error. There should be
   > no billable usage on this account. Please investigate and clear the block."

   ⚠️ Javob **bir necha kun** kutishi mumkin — shuning uchun 6.3 kerak.

**Nima QILMANG:** karta biriktirib "muammoni hal qilish". Public repo uchun to'lov **kerak
emas** — to'lasangiz, siz bag'ni pul bilan yopgan bo'lasiz.

### 6.3 Bepul vaqtinchalik yechim — lokal pre-commit hook ($0)

```bash
npm i -D husky lint-staged --workspace-root
npx husky init
```

`.husky/pre-commit` → `npx lint-staged`. Root `package.json` ga:

```json
"lint-staged": {
  "apps/api/**/*.ts": ["eslint --fix", "prettier --write"],
  "apps/web/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"]
}
```

`.husky/pre-push` (og'irroq tekshiruv):
```sh
npm -w apps/api run build   # tsc typecheck shu ichida
npm -w apps/web run build
npm -w apps/web run test
```

⚠️ **Halol chegarasi:** hook `--no-verify` bilan **chetlab o'tiladi** va faqat **bitta
mashinada** ishlaydi. Bu CI o'rnini **bosmaydi** — bu **plaster**. CI ning ma'nosi
tekshiruvni **majburlash**; hook faqat **eslatadi**.

### 6.4 CI YAML — hozir yozilsin, `workflow_dispatch` bilan

Lock yechilishini kutmasdan pipeline **hozir** yozib qo'yilsin. Avtomatik triggerlar
izohga olingan — lock yechilganda ikki blokni izohdan chiqarish kifoya.

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  workflow_dispatch:        # qo'lda — hozircha yagona trigger
  # ⚠️ Actions billing lock yechilgach quyidagilarni izohdan chiqaring:
  # push:
  #   branches: [main]
  # pull_request:
  #   branches: [main]

jobs:
  api:
    name: API — lint · build · test
    runs-on: ubuntu-latest    # public repo → $0, cheksiz
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install          # monorepo: root'dan (npm workspaces)
        run: npm ci

      - name: Prisma generate
        run: npx prisma generate
        working-directory: apps/api

      - name: Lint
        # ⚠️ apps/api/package.json:15 dagi lint skriptida --fix bor.
        # CI da --fix XATO: u xatoni tuzatib yashiradi. Shuning uchun bu yerda
        # eslint to'g'ridan-to'g'ri, --fix'siz chaqiriladi.
        run: npx eslint "src/**/*.ts" --max-warnings=0
        working-directory: apps/api

      - name: Build (typecheck shu yerda)
        run: npm run build
        working-directory: apps/api

      - name: Test
        run: npm test
        working-directory: apps/api
        # ⚠️ Hozir apps/api da .spec.ts yo'q → jest "no tests found" bilan yiqilishi
        # mumkin. Birinchi test yozilgunicha:  run: npm test -- --passWithNoTests

  web:
    name: Web — lint · build · test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Lint
        run: npm run lint
        working-directory: apps/web
      - name: Build
        run: npm run build
        working-directory: apps/web
      - name: Test
        run: npm test
        working-directory: apps/web
```

⚠️ **`--fix` izohi muhim.** `apps/api/package.json:15`:
`"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"`. `--fix` dasturchi mashinasida
foydali, CI'da **zararli**: xatoni tuzatib yuboradi → CI yashil bo'ladi → tuzatish **hech
qayerga commit qilinmaydi**. Ya'ni CI **yolg'on gapiradi**.

⚠️ **Yetishmayotgan job №1 — drift check.** 7.0.2 dagi `migrate diff --exit-code` job'i shu
faylga qo'shilsin. U aynan 7.0 dagi bag qaytishini oldini oladi va **arzon** (bir necha soniya).

⚠️ **Yetishmayotgan job №2 — tenant izolyatsiyasi.** Kanon 6-bo'limi aytadi: "A tenanti
B'ni o'qiy olmaydi" **tizimning eng muhim testi** va u yo'q. Yozilgach, CI'da alohida job
bo'lsin (Postgres service container bilan). Test mazmuni — 13-testing-strategy.md, CI joyi
— shu yerda. ⚠️ **Old shart:** service container toza baza ko'taradi → **7.0 tuzatilmaguncha
bu job umuman ishlamaydi.**

### 6.5 Deploy — hozir qanday

Render `main` ga push bo'lishi bilan **avtomatik** deploy qiladi (`render.yaml` da
`autoDeploy` ochiq yozilmagan → yoqilgan hisoblanadi). ⚠️ **CI yo'q + avtodeploy bor = har
push to'g'ridan-to'g'ri production'ga.** Real ma'lumot ustidagi tizim uchun xavfli
kombinatsiya.

**CI ishga tushgach ($0):** `render.yaml` ga `autoDeployTrigger: checksPass` — Render CI
yashil bo'lgandagina deploy qiladi. Bu funksiya bepul.

---

## 7. Migratsiya — ⚠️ tarix sxemaga zid (**hamma narsadan oldin**)

### 7.0 🔴 O'LCHANGAN: migratsiya drifti — bu hujjatdagi har bir taklifning old sharti

```
migratsiyalarda CREATE TABLE : 68
schema.prisma da model       : 69
grep track_subjects migrations/  → hech narsa
grep SubjectRole    migrations/  → hech narsa
```

**Mustaqil tasdiqlandi.** `schema.prisma:979` da `enum SubjectRole`, `schema.prisma:985`
da `model track_subjects` bor. **Hech qaysi migratsiyada ular yo'q.**

⚠️ **Va bu — DTM 189 ballik tizimning o'zagi** (kanon 4.1): `track_subjects` har fanga
`role` beradi (MAIN 93 + SECONDARY 63 + 3×MANDATORY 33 = 189). Ya'ni **loyihaning eng
muhim domen jadvali migratsiya tarixida yo'q.**

**Oqibat — sovuq mantiq:**

```
toza baza + prisma migrate deploy
   → track_subjects yaratilmaydi
   → Prisma client uni kutadi
   → ILOVA ISHGA TUSHMAYDI
```

**Nega production hozir ishlayapti?** Chunki uning bazasi **boshqacha qurilgan** — ehtimol
`db push` bilan. Ya'ni **deploy qilingan baza va migratsiya tarixi bir-biriga zid**.
⚠️ Kanon 3-bo'limi "haqiqiy migration, `db push` emas" deydi va README:157 buni takrorlaydi
— **bu da'vo hozir to'liq to'g'ri emas**, chunki tarixda bitta jadval yetishmaydi va u
qandaydir yo'l bilan bazaga tushgan.

### 7.0.1 ⚠️ Nega bu bo'lim endi 1-o'rinda turadi

**Bu hujjatda taklif qilingan deyarli hamma narsa toza bazada schema qurishni talab
qiladi. Ya'ni hozir ularning hech biri ishlamaydi:**

| Taklif | Nega bloklangan |
|---|---|
| **3-bo'lim — Neon/Aiven'ga ko'chish** | Ko'chish = yangi bazada schema qurish. **Hozir imkonsiz.** Va bu Bosqich 0 ning eng shoshilinch bandi edi (DB 30 kunda o'chadi) |
| **9-bo'lim — staging** | Staging = toza baza. **Qurib bo'lmaydi** |
| **6-bo'lim — CI** | CI test uchun Postgres service container ko'taradi. **Ko'tarolmaydi** |
| **10-bo'lim — tiklash** | ⚠️ Nozik farq: `pg_restore` **ishlaydi** (dump strukturani ham, ma'lumotni ham oladi). **Migratsiyadan** qayta qurish — ishlamaydi |

**Demak tartib:** avval migratsiya tarixi tuzatiladi, keyin qolgan hammasi. Bu bepul yoki
pullik masalasi emas — **shunchaki birinchi**.

⚠️ Yagona istisno: **`pg_dump` olish (10.2) migratsiyaga bog'liq emas va u ham birinchi
bo'lishi mumkin.** Ikkalasini birga qiling — dump har qanday holatda ham himoya.

### 7.0.2 Tuzatish yo'li (⚠️ production bazasi ustida — nozik)

**Fikr:** yetishmayotgan migratsiyani generatsiya qilamiz, keyin production'da uni
"allaqachon qo'llangan" deb belgilaymiz — chunki jadval u yerda **bor** va uni qayta
yaratishga urinish yiqiladi.

```bash
# 1. Yetishmayotgan farqni migratsiyaga aylantirish
mkdir -p prisma/migrations/000002_add_track_subjects
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > prisma/migrations/000002_add_track_subjects/migration.sql
```

⚠️ **2-qadam — SQL ni QO'LDA o'qing.** Ichida faqat `CREATE TYPE "SubjectRole"` va
`CREATE TABLE track_subjects` (+ index/FK) bo'lishi kerak. **Agar u yerda `DROP` bo'lsa —
TO'XTANG.** Bu drift boshqa yo'nalishda ham borligini bildiradi: production bazasida
sxemada yo'q narsa bor. Uni o'chirish = ma'lumot yo'qotish.

```bash
# 3. TOZA bazada sinash — bu butun mashqning maqsadi
createdb drift_test
DATABASE_URL="postgresql://postgres:root@localhost:5432/drift_test" npx prisma migrate deploy
# 69 ta jadval chiqishi kerak:
psql -d drift_test -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# va ilova ko'tarilishi kerak — bu yagona haqiqiy tekshiruv
```

```bash
# 4. PRODUCTION'da: qo'llash EMAS, "qo'llangan" deb BELGILASH
#    ⚠️ Oldidan pg_dump oling (10.2). Bu buyruq _prisma_migrations ga yozadi.
#    ⚠️ Jadval production'da BOR — deploy qilinsa CREATE TABLE yiqiladi.
npx prisma migrate resolve --applied 000002_add_track_subjects
```

⚠️ **`migrate resolve --applied` — bu "migratsiya ishlamasin, faqat ishlagan deb yozib
qo'y" degani.** Agar production'da jadval aslida **boshqacha** bo'lsa (ustun turi, index
farq qilsa), siz driftni **yashirasiz**, tuzatmaysiz. **Shuning uchun 4-qadamdan oldin
production `track_subjects` strukturasini generatsiya qilingan SQL bilan solishtiring:**

```bash
pg_dump "$PROD_DATABASE_URL" --schema-only -t track_subjects
```

**5. Nazorat:** shu ishdan keyin **doimiy** tekshiruv CI'ga qo'shilsin (6.4), aks holda
drift qaytadi:

```yaml
      - name: Migration drift check
        run: |
          npx prisma migrate diff \
            --from-migrations ./prisma/migrations \
            --to-schema-datamodel ./prisma/schema.prisma \
            --shadow-database-url "${{ env.SHADOW_DATABASE_URL }}" \
            --exit-code && echo "drift yo'q" || (echo "❌ DRIFT"; exit 1)
        working-directory: apps/api
```

⚠️ **Bu job — CI'dagi eng qimmatli tekshiruvlardan biri.** U aynan shu bag qaytishini
oldini oladi.

**Aniqlik uchun — 68 raqami qayerdan:** butun `CREATE TABLE` `000000_init/migration.sql`
da (68 ta). `000001_files_storage/migration.sql` — faqat `ALTER TABLE files` + index,
jadval yaratmaydi. Ya'ni **yetishmayotgani aynan bitta: `track_subjects`** (+ `SubjectRole`
enum). ⚠️ `migrations/` ichidagi yolg'iz `000000_init.sql` fayli — **0 bayt, bo'sh**;
drift sababi emas, shunchaki qoldiq (o'chirilsin).

### 7.1 Deploy'da migratsiya qanday ishlaydi

`render.yaml:7`: `startCommand: npx prisma migrate deploy && node dist/main`

**Qachon:** har konteyner ishga tushganda — har deployda ✅; ⚠️ **har uyg'onishda** (bepul
tarifda kuniga bir necha marta); ⚠️ har infra restartida.

✅ **Bu xavfli emas** — `migrate deploy` idempotent: `_prisma_migrations` ni o'qiydi va
faqat qo'llanmaganlarni ishga tushiradi. **Qaror to'g'ri.** ✅ Kanon 9-bo'limi talabi
(`db push` **hech qachon**) — buzilmasin. ⚠️ Lekin 7.0 ni o'qing: bu talab hozir
**amalda to'liq bajarilmayapti**.

### 7.2 ⚠️ Muammo: migratsiya yiqilsa

`&&` — chap tomon 0 bo'lmagan kod bilan chiqsa, o'ng tomon **ishlamaydi**:

```
prisma migrate deploy  → FAIL (exit 1)
node dist/main         → UMUMAN ISHGA TUSHMAYDI
Render                 → "service failed to start"
```

✅ **Yaxshi tomoni:** buzilgan sxema bilan ilova yarim ishlab ma'lumotni buzmaydi — "fail fast".

**Yomon tomoni:**

1. ⚠️ **Prisma'da avtomatik rollback YO'Q.** Yiqilsa migratsiya `_prisma_migrations` da
   `failed` deb belgilanadi va **qo'lda aralashuv** talab qiladi
   (`prisma migrate resolve --rolled-back|--applied`). Render konteyneri esa **qayta-qayta
   urinadi va qayta-qayta yiqiladi**.
2. ⚠️ **Qisman qo'llangan migratsiya.** PostgreSQL DDL tranzaksion — bitta fayl ichidagi
   `ALTER`lar odatda butunlay qaytariladi. **Lekin** `CREATE INDEX CONCURRENTLY` kabi
   operatsiyalar tranzaksiyadan tashqarida → **yarim holat** qolishi mumkin.
3. ⚠️ **Eng yomon stsenariy — ma'lumot yo'qotuvchi migratsiya muvaffaqiyatli o'tishi.**
   `DROP COLUMN` yiqilmaydi, u **ishlaydi**. Rollback uchun **backup kerak** — va bepul
   Render Postgres'da **backup yo'q** (3.2). Ya'ni: **hozir ma'lumot yo'qotuvchi
   migratsiyadan tiklanishning yo'li yo'q.**

### 7.3 Yechimlar (barchasi $0)

**1. Deploy'dan oldin majburiy dump** (10-bo'lim). Yagona real rollback yo'li.

**2. Migratsiya intizomi — faqat qo'shuvchi (additive-only).** Narxi $0, faqat intizom:

| ✅ Xavfsiz | ❌ Xavfli |
|---|---|
| `ADD COLUMN ... NULL` | `DROP COLUMN` |
| `CREATE TABLE` · `CREATE INDEX` | `ALTER COLUMN ... TYPE` (mos kelmaydigan) |
| `ADD CONSTRAINT ... NOT VALID` → keyin `VALIDATE` | `RENAME COLUMN` · `ADD COLUMN NOT NULL` default'siz |

**Ustunni o'chirish — uch bosqichli deploy** (expand → migrate → contract): (1) kod ustunni
o'qishni to'xtatadi, ustun DB'da qoladi; (2) bir necha kun kuzatish; (3) `DROP COLUMN`.
69 modelli, real ma'lumotli tizimda bu **majburiy**.

**3. `startCommand` ni ajratish.** Migratsiyani Render'ning **Pre-Deploy Command** ga
ko'chirish mumkin: pre-deploy yiqilsa **eski versiya ishlab turaveradi** (hozir esa servis
butunlay o'ladi). ⚠️ **Lekin** Pre-Deploy Command **pullik tariflarda** — Free'da yo'q.
Ya'ni bu $7 bilan birga keladi.

---

## 8. Monorepo qurish

### 8.1 Hozirgi tuzilma

Root `package.json`: **npm workspaces** (`apps/*`, `packages/*`), `react`/`react-dom`
override, skriptlar `dev:web`, `dev:api`, `lint`, `format`. Boshqa build orkestratori yo'q.

| App | `name` | Build | Test |
|---|---|---|---|
| `apps/api` | ⚠️ **`api-tmp`** | `nest build` | `jest` |
| `apps/web` | ⚠️ **`vite_react_shadcn_ts`** | `vite build` | `vitest run` |

⚠️ Ikkala nom ham **shablon qoldig'i**: `api-tmp` — "vaqtinchalik"; `vite_react_shadcn_ts` —
Lovable/shadcn skaffoldining standart nomi (`lovable-tagger` dependency'si buni tasdiqlaydi,
`apps/web/package.json:85`). Ishga xalaqit bermaydi, lekin `npm -w <name>` buyruqlarini
o'qib bo'lmaydigan qiladi. **`@mathacademy/api` va `@mathacademy/web` ga o'zgartirilsin** —
2 qatorlik ish.

⚠️ **`packages/*` workspace'da e'lon qilingan, lekin `packages/` papkasi yo'q.** Yoki
yaratilsin, yoki e'londan olib tashlansin.

### 8.2 ⚠️ `render.yaml` monorepo bilan — nozik joy

`rootDir: apps/api` → Render `apps/api` ichida `npm ci` ishga tushiradi. Lekin
`package-lock.json` **root'da** (707 KB), `apps/api` da emas.

npm workspaces'da `npm ci` ni **workspace ichidan** ishga tushirish lockfile'ni topa olmaydi
yoki **workspace daraxtini buzadi**. Amalda: yo `npm ci` xato beradi, yo `apps/api/node_modules`
da **root lockfile'dan mustaqil**, boshqa versiyali daraxt quriladi — ya'ni **lokal va
production'da har xil dependency versiyalari**.

⚠️ **Tizim hozir ishlayotgani — bu npm'ning kechirimliligi, ishonchlilik emas.** Bir kun
kutilmagan versiya farqi bilan portlaydi.

**Tuzatish ($0)** — `rootDir` ni root'da qoldirib, workspace bayrog'i bilan:

```yaml
  - type: web
    name: mathacademy-api
    runtime: node
    # rootDir yo'q → repo ildizi
    buildCommand: npm ci && npm -w apps/api exec prisma generate && npm -w apps/api run build
    startCommand: npm -w apps/api exec prisma migrate deploy && node apps/api/dist/main
```

⚠️ **Sinovdan o'tkazilsin** — u ishlab turgan deployga tegadi. Avval staging (9-bo'lim).

### 8.3 Turbo / Nx kerakmi — **halol javob: YO'Q**

**Turbo/Nx nima beradi:** (1) task orkestratsiya — ⚠️ `apps/api` va `apps/web`
**bir-biriga bog'liq emas**, orkestratsiya qiladigan narsa yo'q; (2) incremental cache —
⚠️ ikkita app, cache 30 soniyani tejaydi; (3) remote cache — ⚠️ jamoa **bitta odam**;
(4) affected detection — ⚠️ ikkita paketda foydasiz.

**Nima olib keladi:** yangi konfiguratsiya (`turbo.json`) va uni saqlash; yangi dependency;
yangi debug qatlami (build yiqilganda — Nest'mi, Vite'mi, Turbo cache'mi?); Render
buildCommand'ni qayta yozish; va **vaqt** — muallif vaqti CI va R2 migratsiyasiga ketishi
kerak, `turbo.json` ga emas.

**Xulosa: 2 ta bog'liq bo'lmagan app uchun Turbo/Nx — ortiqcha.** npm workspaces yetadi.
Qayta ko'riladi agar: `packages/shared` paydo bo'lib unga 2+ paket bog'lansa (orkestratsiya
real kerak bo'ladi), yoki app soni 4+ ga yetsa.

⚠️ **Buning o'rniga arziydigan ish:** root'da `build` ham, `test` ham **yo'q** — bu
Turbo'dan ko'ra ko'proq muammo:

```json
"scripts": {
  "dev:web": "npm -w apps/web run dev",
  "dev:api": "npm -w apps/api run start:dev",
  "build": "npm -ws run build --if-present",
  "test": "npm -ws run test --if-present",
  "typecheck": "npm -ws exec tsc --noEmit",
  "lint": "npm -ws run lint",
  "format": "prettier . --write"
}
```

---

## 9. Muhitlar (Environments)

### 9.1 Hozir: ikkita, va ular ajratilmagan

| Muhit | Bormi | Ma'lumot | Qanday |
|---|---|---|---|
| `local` | ✅ | `.env` + `npm run seed` | `dev:api` + `dev:web` |
| `staging` | ❌ **YO'Q** | — | — |
| `production` | ✅ | **Real o'quvchi ma'lumoti** | `main` ga push → avtodeploy |

⚠️ `.env.example:8` — `DATABASE_URL="postgresql://postgres:root@localhost:5432/academy_test"`.
Parol `root` — lokal uchun **maqbul**, muhimi lokalda qolishi; `.env` git-ignore qilingan
(`.env.example:5`). ✅

### 9.2 ⚠️ Staging yo'qligi nimani anglatadi

**Har migratsiya birinchi marta production'da ishlaydi.** Lokal DB — `academy_test`, seed
bilan to'ldirilgan. Production'da **real, tartibsiz ma'lumot**: bo'sh maydonlar, eski
yozuvlar, tenant chegara holatlari. **Migratsiya lokalda o'tishi production haqida hech
narsa isbotlamaydi.** Va 7.3 bilan birga: rollback yo'q, backup yo'q → **staging yo'qligi +
backup yo'qligi = tuzatib bo'lmaydigan xato uchun ochiq yo'l**.

### 9.3 Bepul staging ($0)

⚠️ **Old shart — hammasiga taalluqli:** staging **ta'rifi bo'yicha toza baza**. 7.0
tuzatilmaguncha quyidagi variantlarning **hech biri qurilmaydi**. Variant C dagi
`pg_restore` yo'li istisno — u dump'dan strukturani oladi, migratsiyadan emas — lekin
undan keyingi `migrate deploy` qadami baribir 7.0 ga tegadi.

**Variant A — Render Preview Environments:** ⚠️ **pullik**, Free'da yo'q. O'tkazamiz.

**Variant B — ikkinchi bepul stack:** API — Render Free (staging'da 40 soniya kutish
**muammo emas**); Web — Render Static (bepul); DB — **Neon branch** (Free 1 proyekt beradi,
lekin 10 branch — staging uchun branch aslida **yaxshiroq**, u production sxemasidan nusxa
oladi).

⚠️ **Render 750 soat/oy — workspace bo'yicha**, servis bo'yicha emas: production Free +
staging Free bitta hisobdan yeydi. Agar production **Starter**'ga o'tsa — Starter soatlari
Free hisoblagichga **kirmaydi** va 750 soat butunlay staging'ga qoladi. Ya'ni **$7 to'lash
staging'ni ham ochib beradi**.

**Variant C — eng arzon va eng oson ($0, hozir bajarilsin):** staging server umuman kerak
emas — **production dump ustida lokal migratsiya sinovi**:

```bash
pg_dump "$PROD_DATABASE_URL" -Fc -f prod.dump          # 10-bo'lim skripti
createdb academy_staging
pg_restore -d academy_staging --no-owner prod.dump
DATABASE_URL="postgresql://postgres:root@localhost:5432/academy_staging" \
  npx prisma migrate deploy                             # REAL ma'lumot ustida sinov
```

⚠️ **10-security.md savoli:** production dump'da **voyaga yetmagan bolalarning** ismlari,
baholari, yashash joyi bor. Uni muallif noutbukiga tushirish — **ma'lumot chiqishi**.
Chinakam yo'l — **anonimlashtirilgan dump** (ism/telefon/manzil almashtiriladi).
Anonimlashtirish skripti 13-testing-strategy.md da. **Bu variant C ning yagona jiddiy
kamchiligi va u dump'ni odatga aylantirishdan OLDIN hal qilinishi shart.**

---

## 10. Zaxira (Backup)

### 10.1 ⚠️ Hozir: **backup YO'Q**

> Free Render Postgres databases **don't support any form of backups**.
> — [Render Docs](https://render.com/docs/free)

3.2 bilan birga: **DB 30 kunda expire, 44-kunda o'chiriladi, backup yo'q.** Ya'ni butun
ma'lumot **bitta bepul instansiyada, nusxasiz**. ⚠️ **Bu hujjatning eng shoshilinch bandi.
Boshqa hamma narsa kutishi mumkin, bu — yo'q.**

### 10.2 Bepul yechim: `pg_dump` + R2 (≈ $0)

`scripts/backup.sh` (repoga qo'shilsin):

```bash
#!/usr/bin/env bash
set -euo pipefail
# Talab: pg_dump, rclone (ikkalasi bepul). Env: DATABASE_URL, R2_BUCKET, BACKUP_PASSPHRASE.

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="mathacademy-${STAMP}.dump"

# -Fc = custom format: siqilgan + pg_restore bilan tanlab tiklash mumkin
pg_dump "$DATABASE_URL" -Fc -f "/tmp/${FILE}"

# ⚠️ Dump'da voyaga yetmagan o'quvchilar ma'lumoti bor — 10-security.md talabi
gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase "$BACKUP_PASSPHRASE" "/tmp/${FILE}"

rclone copy "/tmp/${FILE}.gpg" "r2:${R2_BUCKET}/backups/"
rm -f "/tmp/${FILE}" "/tmp/${FILE}.gpg"
```

**Qayerda ishlasin:**

| Variant | Narxi | Baho |
|---|---|---|
| **GitHub Actions** (`schedule:` cron) | **$0** (public repo) | ⚠️ Actions lock yechilishini kutadi (6.2). ⚠️ `DATABASE_URL` ni GitHub Secrets'ga qo'yish = **production DB kalitini GitHub'ga berish** — 10-security savoli |
| **Render Cron Job** | ⚠️ Free'da cron **yo'q** — pullik | Actions bepul bo'lgani uchun mantiqsiz |
| **Muallif noutbuki** (Task Scheduler) | **$0**, hozir ishlaydi | ⚠️ Noutbuk o'chiq bo'lsa — backup yo'q. **Lekin backup yo'qligidan cheksiz yaxshi** |

**Saqlash narxi:** dump o'lchami noma'lum, lekin SIS ma'lumoti asosan matn va `-Fc` siqadi
— taxminan **o'nlab MB**. R2 bepul 10 GB'ga kunlik dump'ning yuzlab nusxasi sig'adi.
**Amaliy narx: $0.** ⚠️ **Aniq raqam kerak:** birinchi `pg_dump` dan keyin hajmni o'lchang
va shu yerga yozing — taxmin qolmasin.

### 10.3 Tiklash — sinalmagan backup = backup emas

```bash
gpg --batch --decrypt --passphrase "$BACKUP_PASSPHRASE" -o restore.dump <fayl>.gpg
createdb mathacademy_restore_test
pg_restore -d mathacademy_restore_test --no-owner restore.dump
psql -d mathacademy_restore_test -c "SELECT count(*) FROM students;"
```

⚠️ **Oyda kamida bir marta bajarilsin.** Tiklanmaydigan backup — tinchlantiruvchi yolg'on.
Va bu ish 9.3-variant C bilan **bir xil** → har staging sinovi avtomatik backup tekshiruvi
ham bo'ladi. **Ikkita muammo, bitta odat.**

✅ **Muhim nozik farq (7.0 fonida):** `pg_restore` **ishlaydi** va u drift bilan buzilmaydi
— dump strukturani ham, ma'lumotni ham o'zi bilan olib yuradi, `track_subjects` ham
ichida. **Ya'ni backup hozir ham to'liq himoya beradi.** Buzilgani — **migratsiyadan**
qayta qurish yo'li (`migrate deploy` toza bazada). Shuning uchun dump olish 7.0 ni kutmaydi
va **bugun** qilinsin.

### 10.4 Saqlash siyosati

R2'da joy bo'lgani uchun bepul: kunlik — 14 kun · haftalik (yakshanba) — 8 hafta · oylik
(1-sana) — 12 oy · **har deploy oldidan — 30 kun** (7.2 dagi rollback uchun).

---

## 11. Domen va SSL

**Domen:** `render.yaml` da custom domain **yo'q** → tizim `mathacademy-api.onrender.com`
da. **$0.** ⚠️ Lekin bu real akademiya: ota-onaga `https://mathacademy-api.onrender.com`
havolasini berish tizim jiddiy emasdek ko'rsatadi va ishonchni pasaytiradi. Bu texnik emas,
**mahsulot** muammosi — lekin infra hal qiladi.

**SSL:** ✅ **bepul va avtomatik**, hech narsa qilish kerak emas:

> All applications and static sites hosted on Render come with **fully managed and free TLS
> certificates**, with no setup required. Render uses **Let's Encrypt and Google Trust
> Services** ... and automatically renews them.
> — [Render Docs — TLS](https://render.com/docs/tls)

Custom domain qo'shilsa ham TLS **bepul** qoladi, wildcard ham
([Custom Domains](https://render.com/docs/custom-domains)).

**Domen narxlari (2026):**

| Domen | Narxi | Izoh |
|---|---|---|
| **`.uz`** | **27 000 so'm/yil** (rasmiy) | ~$2/yil. ⚠️ Registratorlar qimmatroq: aHOST'da yangilash **140 000 so'm/yil** |
| **`.uz` (aHOST aksiya)** | 51 000 so'm 1-yil | ⚠️ Aksiya **2026-24-iyungacha** edi — **muddati o'tgan**, tekshiring |
| **`.com`** | ~$10–15/yil | Registratorga qarab |

Manbalar: [aHOST domen](https://clients.ahost.uz/cart.php?a=add&domain=register&language=uzbek),
[Uztelecom — hosting va domen](https://uztelecom.uz/uz/jismoniy-shaxslarga/bulutli-xizmatlar/web-hosting-va-domen)

**Tavsiya:** `.uz` — mantiqiy va **eng arzon** (~$2/yil ≈ **oyiga $0.17**). Bu butun
hujjatdagi eng arzon yaxshilanish. ⚠️ Ro'yxatdan o'tkazishda talab qilinadigan hujjatlar
bor va u **akademiya nomiga** qilinsin, muallif nomiga emas — aks holda muallif ketganda
domen akademiyada qolmaydi. Bu tashkiliy savol, texnik emas.

---

## 12. Bosqichma-bosqich reja

### Bosqich 0 — HOZIR · **$0/oy**

⚠️ **Tartib muhim.** Qadam 0 va 1 — **eng birinchi**, va sabab har xil: qadam 1 (dump)
hech narsaga bog'liq emas va u yagona himoya; **qadam 0 esa 3, 5, 6 va 9-bo'limlardagi
hamma narsani ochib beradi** (7.0.1).

| # | Ish | Nega | Bo'lim |
|---|---|---|---|
| **0** | 🔴🔴 **MIGRATSIYA DRIFTINI TUZATING** — `track_subjects` + `SubjectRole` tarixda yo'q | **Toza bazada ilova ko'tarilmaydi.** Ko'chish, staging, CI — hammasi shunga bog'liq. Bepul/pullik emas — **birinchi** | **7.0** |
| **1** | 🔴🔴 **Bugun `pg_dump` oling** | DB 30 kunda expire, backup yo'q. Bu qadam 0 ga bog'liq **emas** — parallel qiling | 10.2 |
| 2 | 🔴 **DB yoshini tekshiring** | 30+ kun bo'lsa — grace period'dasiz, 14 kun qoldi | 3.2 |
| 3 | 🔴 **Neon'ga ko'ching** | O'lim taymerini o'chirish. ⚠️ **Qadam 0 dan keyin** — aks holda yangi bazada schema qurilmaydi | 3.4 |
| 4 | 🔴 **`/tmp/uploads` dagi tirik fayllarni ko'chiring** | Keyingi deploy o'ldiradi | 5.4 |
| 5 | 🟠 **Cloudflare R2 + `S3Storage`** | Fayl yo'qotish bag'ini yopish. ⚠️ Bu **masshtablashning old sharti** ham (4.4) | 5.3–5.4 |
| 6 | 🟠 **`render.yaml` ni haqiqatga moslash** (`WEB_ORIGINS`, `COOKIE_*`, web static) | IaC yolg'on gapiryapti | 1.3–1.4 |
| 7 | 🟠 **GitHub Support'ga yozing** | Public repo → Actions bepul bo'lishi kerak | 6.2 |
| 8 | 🟡 **husky + lint-staged** | Lock yechilgunicha plaster | 6.3 |
| 9 | 🟡 **`ci.yml` (`workflow_dispatch`) + drift check job** | Drift qaytmasligi uchun | 6.4, 7.0.2 |
| 10 | 🟡 **`cache-manager-redis-store` + `REDIS_*` o'chirilsin** | Mavjud bo'lmagan infratuzilma va'dasi | 4.3 |
| 11 | 🟡 **`.uz` domen** | ~$2/yil = oyiga $0.17 | 11 |

**Natija:** narx **$0/oy** (+ ~$2/yil domen) · ✅ **toza bazada ilova ko'tariladi** ·
✅ ma'lumot yo'qolmaydi · ✅ fayllar yo'qolmaydi · ✅ buzilgan kod ushlanadi (lock
yechilgach) · ❌ **uxlash MUAMMO BO'LIB QOLADI** — ota-ona hali ham 40 soniya kutadi.

⚠️ **Halol xulosa: $0 bilan uxlash muammosini hal qilib bo'lmaydi.** Ping — 750 soat
limiti bilan xavfli (2.4); bepul provayderlar 2026-da o'lgan (2.5). **$0 ning chegarasi
shu yerda.**

### Bosqich 1 — mijoz paydo bo'lganda · **≈ $7.17/oy**

Ya'ni akademiya (yoki ikkinchi akademiya) **to'lay boshlaganda**. $7 — bitta o'quvchining
oylik to'lovining kichik ulushi. Bu **so'raladigan** summa.

| Komponent | Tarif | Narx |
|---|---|---|
| API | **Render Starter** | **$7/oy** |
| Web | Render Static | $0 |
| DB | Neon Free | $0 |
| Fayllar | R2 Free (10 GB) | $0 |
| Backup | GitHub Actions + R2 | $0 |
| CI | GitHub Actions (public) | $0 |
| Domen | `.uz` | ~$0.17/oy |

**Nima o'zgaradi:** ✅ **uxlash tugaydi** — ota-ona ertalab darhol kiradi; ✅ 750 Free soat
bo'shaydi → **staging Free'da quriladi** ($0, 9.3); ✅ Pre-Deploy Command ochiladi →
migratsiya yiqilsa eski versiya tirik qoladi (7.3); ⚠️ qoladigan sovuq start — Neon ~1
soniya, sezilmaydi; ⚠️ **512 MB RAM O'LCHANSIN** — yetmasa Standard **$25/oy**.

✅ **Xavfsiz, chunki bu hali ham BITTA instansiya.** Starter — vertikal qadam
(uxlamaydigan bitta konteyner), gorizontal emas. 4.4 va 5.2 dagi "1 instansiya" farazi
buzilmaydi. **Shuning uchun $7 xavfsiz sotib olinadigan yagona qadam.**

### Bosqich 2 — o'sganda · **≈ $32–45/oy + KOD ISHI**

⚠️ **Bu bosqich pul bilan sotib olinmaydi.** Bosqich 0→1 da pul yetardi. Bu yerda —
**yo'q**, va sabab 4.4 da o'lchangan:

> **2-instansiya ko'tarilishi bilan:** (a) **fayllar bo'linadi** — har instansiyaning o'z
> `/tmp/uploads` i, ota-ona rasmni ko'radimi yo'qmi — **qaysi instansiyaga tushishiga
> bog'liq**; (b) **ruxsat keshi nomuvofiq bo'ladi** — `invalidateUserCache()`
> (`auth.service.ts:397`) faqat o'z process'ida ishlaydi, ya'ni **bekor qilingan ruxsat
> 2-instansiyada 5 daqiqagacha amal qiladi**.

**Ikkalasi ham "1 instansiya" farazi ustida turibdi. Ya'ni masshtablash — kod o'zgarishi,
tarif o'zgarishi emas.** Instansiya sonini oshirish tugmasi Render panelida bor va u
**tizimni jimgina buzadi**.

**Old shartlar (kod, $0 — LEKIN vaqt):**

| # | Ish | Bo'lim |
|---|---|---|
| 1 | **R2 migratsiyasi tugagan bo'lsin** — fayllar instansiyadan tashqarida | 5.3–5.4 |
| 2 | **Kesh yechilgan bo'lsin** — Upstash'ga ko'chirish **yoki** keshni umuman olib tashlash | 4.4–4.5 |

**Faqat shundan keyin:**

| Komponent | Tarif | Narx |
|---|---|---|
| API | Render Standard (2 GB) | **$25/oy** |
| DB | Neon Launch (scale-to-zero o'chadi) | ⚠️ **[Neon Pricing](https://neon.com/pricing) dan tekshiring** |
| Redis | Upstash | $0 → keyin oz |
| Fayllar | R2 | ~$0.015/GB — 100 GB da ~$1.50 |
| Staging | Render Free | $0 |

⚠️ **Trigger — his-tuyg'u emas, o'lchov:** Standard'ga (**vertikal, xavfsiz**) — RSS
512 MB ning 80% dan oshsa yoki OOM restart ko'rinsa; Neon Launch'ga — 100 CU-soat limitiga
urilsa yoki 0.5 GB to'lsa; **2-instansiyaga (gorizontal, XAVFLI) — yuqoridagi ikki old
shart bajarilmaguncha HECH QACHON**.

✅ **Foydali xulosa:** Standard ($25) — bu **vertikal** qadam va u xavfsiz. Ya'ni o'sishning
katta qismi kod o'zgarishisiz, faqat RAM oshirish bilan qoplanadi. Gorizontal skeyl
**ancha keyin** kerak bo'ladi.

### Bosqich 3 — lokalizatsiya talab qilinsa · **⚠️ shartli**

**Faqat yurist "O'zbekistonda saqlansin" desa** (2.6). 2026-mart o'zgarishidan keyin bu
ehtimoldan uzoq, lekin biometrik ma'lumot qo'shilsa (masalan yuz bo'yicha davomat) —
**darhol majburiy**. aHOST VDS (TAS-IX) **~150 000+ so'm/oy** (~$12+) **+ muallif vaqti**:
nginx, certbot, PostgreSQL, backup, monitoring, xavfsizlik yangilanishlari — **haftasiga
bir necha soat**, va bu eng katta xarajat. ⚠️ **Oldindan qilmang** — "har ehtimolga qarshi"
VDS'ga ko'chish = $12 + haftalik ish, hal qilinmagan muammo uchun.

### Narx jadvali — yig'ma

| | Bosqich 0 | Bosqich 1 | Bosqich 2 | Bosqich 3 |
|---|---|---|---|---|
| **Oylik** | **$0** | **$7** | **$32–45** | **$12 + vaqt** |
| **Pul yetadimi** | ✅ Ha ($0) | ✅ **Ha — pul yechadi** | ❌ **Yo'q — kod ishi kerak** (4.4, 5.2) | ❌ Yo'q — vaqt kerak |
| Uxlaydimi | ⚠️ **Ha** | ✅ Yo'q | ✅ Yo'q | ✅ Yo'q |
| Toza bazada ko'tariladimi | ✅ **Qadam 0 dan keyin** | ✅ | ✅ | ✅ |
| Ma'lumot/fayl yo'qoladimi | ✅ Yo'q | ✅ Yo'q | ✅ Yo'q | ✅ Yo'q |
| Instansiya | 1 | 1 (**vertikal**) | 1 → 2+ faqat old shartlardan keyin | 1 |
| Staging | ❌ Faqat lokal | ✅ Render Free | ✅ | ✅ |
| CI | ⚠️ Lock'ga bog'liq | ✅ | ✅ | ✅ |

---

## 13. Ochiq savollar

### Shoshilinch (javob kutmaydi)

1. 🔴🔴 **`track_subjects` production bazasiga QANDAY tushgan?** `db push` bilanmi, qo'lda
   SQL bilanmi? Javob muhim: agar `db push` ishlatilgan bo'lsa — **boshqa driftlar ham
   bo'lishi mumkin** (ustun turi, index), va 68 vs 69 farqi aysbergning uchi. 7.0.2 dagi
   `pg_dump --schema-only` solishtiruvi buni ochadi.
2. 🟡 **`prisma/migrations/000000_init.sql`** — papkadan tashqarida yolg'iz yotgan fayl.
   **O'lchandi: u 0 bayt, bo'sh.** Ya'ni drift sababi **emas** va zarari yo'q (Prisma
   papkadan tashqaridagi `.sql` ni o'qimaydi). Shunchaki qoldiq — **o'chirilsin**, chunki
   u `000000_init/` bilan chalkashtiradi.
3. 🔴 **Production DB hozir necha kunlik?** 30 kundan oshgan bo'lsa — grace period'dasiz va
   **14 kundan keyin hammasi o'chadi**. Render panel → Database → Created. **Bugun javob bering.**
4. 🔴 **Backup umuman bormi?** Muallif hech qachon `pg_dump` qilmagan bo'lsa — tizim
   **nusxasiz** ishlayapti.
5. 🔴 **`/tmp/uploads` da hozir nechta fayl bor?** Keyingi deploy ularni o'chiradi. `files`
   jadvalidagi nechta yozuv mavjud bo'lmagan faylga ishora qiladi — **bitta so'rov**.

### Infratuzilma

6. **Frontend hozir qayerda deploy qilingan?** `render.yaml` da yo'q, lekin tizim
   ishlayapti. Vercel? Netlify? Qo'lda? **Javob `render.yaml` ga yozilsin.**
7. **Render panelida qanday env'lar qo'lda kiritilgan?** `WEB_ORIGINS` kabi `render.yaml`
   da yo'q, lekin **zarur** o'zgaruvchilar bor. Ro'yxati **qayerda hujjatlashtirilgan?**
   Hech qayerda bo'lsa — muallif hisobi yo'qolsa tizim qayta tiklanmaydi.
8. **512 MB RAM yetadimi?** NestJS + Prisma 7 + 69 model. **O'lchanmagan.** Starter'ga
   to'lashdan oldin bilish kerak.
9. **Hozirgi DB hajmi va dump hajmi qancha?** `pg_database_size` + birinchi `pg_dump`.
   Neon Free'ning 0.5 GB'i yetadimi — ikki o'lchov bilan hal bo'ladi (3.4, 10.2).
10. **`SHADOW_DATABASE_URL` bormi?** 7.0.2 dagi `migrate diff` va CI drift check unga
    muhtoj. Lokalda — oddiy bo'sh baza; CI'da — Postgres service container.

### Xavfsizlik / huquq (10-security.md bilan)

11. ⚠️ **YURIST:** o'quvchi rasmlari **biometrik ma'lumot** hisoblanadimi? Ha bo'lsa —
    xorijda (R2/Render/Neon) saqlash **taqiqlanadi** va Bosqich 3 majburiy bo'ladi.
12. ⚠️ **YURIST:** akademiya `pd.gov.uz` reyestriga ro'yxatdan o'tganmi? Bu operator
    majburiyati; tizim uni bajarishga to'sqinlik qilmasligi kerak.
13. ⚠️ **YURIST:** 2026-mart tahriridagi uchta shartdan **qaysi biri** bajariladi? Render
    AQSh kompaniyasi — "standart shartnomaviy shartlar" yo'li real'mi?
14. **Production `DATABASE_URL` ni GitHub Secrets'ga qo'yish** (backup uchun) — qabul
    qilinadigan xavfmi? Alternativa: backup faqat muallif mashinasida.
15. **`BACKUP_PASSPHRASE` qayerda saqlanadi?** Yo'qolsa — backup ham yo'qoladi.
16. **Staging dump'ini anonimlashtirish skriptini** kim va qachon yozadi? Usiz 9.3-variant
    C — bu ma'lumot chiqishi.

### Kod

17. **5 daqiqalik `roles_perms` keshi nimani tejayapti?** (`auth.service.ts:359,393`)
    O'lchanmagan. Agar tejagani kichik bo'lsa — keshni **olib tashlash** 4.4 dagi
    masshtablash to'sig'ini Redis qo'shmasdan yechadi. **Bu o'lchov $10/oy ni hal qiladi.**
18. **`api-tmp` va `vite_react_shadcn_ts` nomlari o'zgartirilsinmi?** 2 qatorlik ish, lekin
    `npm -w` buyruqlariga tegadi.
19. **`packages/*` e'lon qilingan, papka yo'q** — qoldiqmi yoki reja?
20. **`lovable-tagger`** (`apps/web/package.json:85`) — production build'da kerakmi?
    Skaffold qoldig'iga o'xshaydi.

### Qaror kutayotgan

21. **Uxlash muammosiga $0 yechim yo'q (2.4–2.5).** Akademiya $7/oy to'lashga tayyormi? Bu
    **texnik emas, suhbat savoli** — va u eng arzon yechim.
22. **`autoDeployTrigger: checksPass` qachon yoqiladi?** Test yo'q ekan, CI faqat lint+build
    + drift check tekshiradi. Bu yetarli signalmi?

---

## Manbalar

Har bir narx va limit quyidagilardan tekshirilgan (**2026-yil iyul**):

- [Deploy for Free – Render Docs](https://render.com/docs/free) — 15 daq uxlash, ~1 daq uyg'onish, 750 soat/oy, Postgres 30 kun + 14 kun grace, 1 GB, backup yo'q
- [Render Changelog — Free PostgreSQL now expires after 30 days (previously 90)](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90)
- [Render Pricing](https://render.com/pricing) · [Kuberns 2026](https://kuberns.com/blogs/render-pricing/) · [Costbench](https://costbench.com/software/developer-tools/render/free-plan/) — Starter $7, Standard $25
- [srvrlss.io — Render](https://www.srvrlss.io/provider/render/) — Key Value 25 MB free / $10 Starter
- [Render TLS](https://render.com/docs/tls) · [Custom Domains](https://render.com/docs/custom-domains) — SSL bepul
- [Render ToS](https://render.com/terms) · [community #197645](https://github.com/orgs/community/discussions/197645) — ping bo'yicha ochiq taqiq topilmadi
- [Platforms with a real free tier in 2026 — Render](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Fly.io Free Tier 2026](https://www.saaspricepulse.com/blog/flyio-free-tier-2026) — bepul tarif yo'q
- [Railway Pricing 2026](https://www.srvrlss.io/provider/railway/) — bepul tarif yo'q, Hobby $5
- [Neon plans](https://neon.com/docs/introduction/plans) · [Neon Scale to Zero](https://neon.com/docs/introduction/scale-to-zero) · [Neon Pricing](https://neon.com/pricing) — 0.5 GB, 100 CU-soat, 1 proyekt, 10 branch
- [Aiven Free PostgreSQL](https://aiven.io/free-postgresql-database) — 1 GB, 20 ulanish, pooling yo'q
- [Supabase Free Tier 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/) — 500 MB, 1 hafta faolsizlikda pauza
- [Top PostgreSQL Free Tiers 2026 — Koyeb](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026)
- [Upstash Redis Pricing](https://upstash.com/pricing/redis) · [Upstash new pricing](https://upstash.com/blog/redis-new-pricing) — **500K komanda/oy** (10k/kun EMAS), 256 MB
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) · [R2 Free Tier 2026](https://nubbo.app/blog/cloudflare-r2-free-tier/) — 10 GB, egress bepul
- [Backblaze B2 Pricing](https://www.backblaze.com/cloud-storage/pricing) — 10 GB bepul, $6/TB
- [GitHub Docs — Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage) · [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing) — **public repo → bepul, cheksiz**
- [community #165506](https://github.com/orgs/community/discussions/165506) · [#167403](https://github.com/orgs/community/discussions/167403) · [#199036](https://github.com/orgs/community/discussions/199036) — billing lock public reponi ham bloklaydi
- [Kun.uz 2026-03-27](https://kun.uz/news/2026/03/27/shaxsga-doir-ayrim-malumotlarni-ozbekistondan-tashqarida-saqlashga-ruxsat-berildi) · [Gazeta.uz 2026-03-28](https://www.gazeta.uz/oz/2026/03/28/personal-data/) · [gov.uz qonun](https://gov.uz/oz/advice/61/document/2116) · [pd.gov.uz](https://pd.gov.uz/)
- [aHOST VDS](https://www.ahost.uz/vds) · [aHOST domen](https://clients.ahost.uz/cart.php?a=add&domain=register&language=uzbek) · [hosting-obzor.uz VPS](https://www.hosting-obzor.uz/index.php?list=vds-vps-hosting) · [Uztelecom](https://uztelecom.uz/uz/jismoniy-shaxslarga/bulutli-xizmatlar/web-hosting-va-domen) — VDS ~150 000 so'm/oy dan, `.uz` 27 000 so'm/yil

⚠️ **Narxlar 2026-yil iyul holatiga. Qaror oldidan manbani qayta oching — bu bozor tez
o'zgaradi: Fly.io va Railway bepul tariflarini o'ldirdi, Render Postgres 90→30 kunga
qisqardi, Upstash 10k/kun → 500k/oy ga o'tdi.**
