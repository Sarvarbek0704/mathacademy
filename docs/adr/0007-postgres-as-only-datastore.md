# ADR-0007 — PostgreSQL — yagona ma'lumot ombori. Redis qo'shilmaydi

- **Holat:** Qabul qilingan
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

Ziyo'da ikkita narsa an'anaviy ravishda Redis talab qiladi:

1. **Brute-force himoyasi** — login urinishlarini sanash va akkauntni bloklash.
   Klassik yechim: `INCR` + `EXPIRE`
2. **Ruxsat keshi** — har so'rovda foydalanuvchining rol/ruxsat to'plamini bazadan
   o'qimaslik uchun ([ADR-0005](./0005-permission-based-rbac.md) buni talab qiladi:
   avtorizatsiya ma'lumotda yashaydi, demak o'qilishi kerak)

Loyihaning `.env.example` va `package.json` fayllari Redis **bor** deb ishontiradi.
Kanon ham uzoq vaqt shunday deb yozgan edi.

### ⚠️ O'lchov: Redis UMUMAN ishlatilmaydi

Grep bilan tekshirildi (`2026-07-16`):

| Tekshiruv | Natija |
|---|---|
| `redisStore` / `ioredis` importi `apps/api/src` da | **0** |
| `REDIS_` o'qilishi kod ichida (`process.env.REDIS_*`) | **0** |
| `REDIS_HOST/PORT/PASSWORD` e'loni | `apps/api/.env.example:50-52` — **faqat e'lon** |
| `cache-manager-redis-store` `package.json` da | O'rnatilgan, **import qilinmagan** |
| Redis xizmati `render.yaml` da | **yo'q** |

Yagona kesh — in-memory:

```ts
// apps/api/src/modules/auth/auth.module.ts:11-14
CacheModule.register({
  ttl: 300000, // 5 minutes in milliseconds
  max: 100,
}),
```

⚠️ **`store` parametri yo'q.** `@nestjs/cache-manager` default'i — **in-memory LRU**,
maksimum 100 yozuv, process xotirasida.

Va auth lock'lari **to'liq PostgreSQL'da**:

```ts
// apps/api/src/modules/auth/auth.service.ts:187
const lock = await this.prisma.auth_locks.findUnique({ ... });
// :214
await this.prisma.auth_attempts.create({ ... });
// :240
const recentFails = await this.prisma.auth_attempts.count({ ... });
// :269
await this.prisma.auth_locks.upsert({ ... });
// :297
await this.prisma.auth_locks.deleteMany({ ... });
```

**Ya'ni:** `.env.example` Redis va'da qiladi, `package.json` uni yuklab oladi,
**kod uni hech qachon chaqirmaydi**. Redis bu loyihada — **hujjatdagi arvoh**.

### Bu ADR nima qilyapti

Bu — **mavjud, ammo hech qachon aytilmagan qarorni rasmiylashtirish**. Kimdir
(muallif) qandaydir nuqtada Redis'siz davom etishga qaror qilgan va uni yozib
qo'ymagan — faqat konfiguratsiyada izini qoldirgan.

**Va u qaror to'g'ri.** Quyida asoslanadi. ADR uni **tasdiqlaydi**, tuzatmaydi.
Bu — [ADR-0008](./0008-migrations-as-source-of-truth.md) dan **farqi**: u yerda
ADR amaliyotni tuzatadi, bu yerda — tasdiqlaydi.

## Qaror

**PostgreSQL — yagona ma'lumot ombori. Redis (yoki boshqa tashqi ma'lumot xizmati)
qo'shilmaydi.**

Aniq:

- **Auth lock, urinish sanash, sessiya** → PostgreSQL (`auth_locks`,
  `auth_attempts`, `auth_sessions`) — **mavjud, o'zgarmaydi**
- **Ruxsat keshi** → in-memory LRU — **mavjud, o'zgarmaydi**
- **Redis** → qo'shilmaydi

Va tozalash ishi:

- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` — `.env.example:50-52` dan
  **o'chiriladi**
- `cache-manager-redis-store` — `package.json` dan **o'chiriladi**

## Sabablar

### Nega Postgres'dagi lock — Redis'dagidan YAXSHIROQ

Bu asosiy sabab va u "sodda bo'lgani uchun" emas — **texnik jihatdan to'g'riroq**:

**1. Lock restart'dan omon qoladi.**

Redis'da lock — TTL bilan xotirada. Redis restart bo'ldi (deploy, OOM, provayder
migratsiyasi) → **barcha lock yo'qoladi**. Bloklangan hujumchi **darhol** yana
urinishga kirishadi.

Postgres'da lock — jadval qatori. Restart unga **ta'sir qilmaydi**. Bu — xavfsizlik
mexanizmi uchun **to'g'ri** xatti-harakat: xavfsizlik holati infratuzilma
hodisasidan qattiqroq bo'lishi kerak.

**2. Instance'lar orasida ikkinchi infratuzilmasiz ishlaydi.**

Ikkita API instance ko'tarilsa, `auth_locks` **avtomatik** umumiy — chunki baza
umumiy. Redis'da bu ham ishlardi, lekin **yana bitta xizmat** evaziga.

**3. Audit izi tekin keladi.**

`auth_attempts` — jadval. Ya'ni "kim, qachon, qayerdan urinib ko'rdi" **so'rov
qilinadi**:

```sql
SELECT username_or_id, COUNT(*) FROM auth_attempts
WHERE tenant_id = 1 AND created_at > now() - interval '24 hours' AND success = false
GROUP BY 1 ORDER BY 2 DESC;
```

Redis'dagi `INCR` counter buni **bera olmaydi** — u faqat son, tarix emas.
Xavfsizlik hodisasini tekshirish uchun bu **hal qiluvchi**.

**4. Tranzaksiya.**

Lock qo'yish va urinishni yozish **bitta tranzaksiyada** bo'lishi mumkin. Redis +
Postgres bo'lsa — ikki tizim, atomarlik yo'q, ikkalasi orasida nomuvofiqlik oynasi.

### Nega bepul tarifda bu ayniqsa to'g'ri

Loyiha Render'da ishlaydi (`render.yaml`). Redis qo'shish — **yana bir xizmat**:
narx, monitoring, backup, ishga tushmasa nima bo'ladi.

Va Redis'ning asosiy ustunligi (tezlik) bu yerda **deyarli qiymatsiz**:

| | |
|---|---|
| Kunlik login | Bir necha o'nlab (bitta akademiya xodimlari + ota-onalar) |
| Login'dagi eng qimmat amal | **bcrypt cost 12** — ~250 ms |
| `auth_locks` `findUnique` (unique indeks bo'yicha) | **~1 ms** |

Ya'ni lock tekshiruvi login vaqtining **~0.4%** ini tashkil qiladi. Redis uni
0.2 ms ga tushirsa — foydalanuvchi **hech narsa sezmaydi**, chunki bcrypt 250 ms
kutmoqda.

**Redis bu yerda muammoni hal qilmaydi — u infratuzilmani ko'paytiradi.**

### Nega bitta ombor — arxitektura ustunligi

- **Bitta backup** — Postgres dump. Redis bo'lsa: ikki backup, ikki tiklash
  protsedurasi, va ular orasidagi **nomuvofiqlik**
- **Bitta tranzaksiya chegarasi** — yuqorida
- **Bitta ishga tushish bog'liqligi** — Postgres yoq → ilova yoq. Bu **aniq**.
  Redis ham bo'lsa: Redis yoq → ilova **qisman** ishlaydimi? Bu savolga javob
  yozilishi kerak, va u **hech qachon to'liq yozilmaydi**
- **Bitta operatsion bilim** — muallif bitta odam ([00-vision-and-market.md](../00-vision-and-market.md))

### Alternativa A: Redis qo'shish — nega rad etildi

**Ustunligi — bu real va halol yozilishi kerak:**

- **Tezlik.** In-memory, tarmoq orqali ~0.2 ms. Postgres so'rovi ~1-5 ms
- **TTL native.** `SETEX key 300 value` — muddat tugashi **avtomatik**.
  Postgres'da `expires_at` ustuni **va uni tozalaydigan job** kerak. Hozir
  `auth_locks` da eskirgan qatorlarni kim o'chiradi? — **hech kim**. Bu real
  kamchilik
- **Pub/sub.** Bu **eng muhim ustunligi** va aynan bizning muammomizni hal qiladi:
  kesh bekor qilinishini instance'lar orasida tarqatish (quyida "Salbiy" ga qarang).
  Postgres `LISTEN`/`NOTIFY` beradi, lekin u Prisma orqali qulay emas
- **Atomik hisoblagich.** `INCR` — lock-free. Postgres'da `count(*)` — jadval
  o'qish
- **Umumiy kesh.** 2 instance bir keshni ko'radi. Bizning in-memory LRU — ko'rmaydi

**Nega baribir rad etildi:**

1. **Yagona real ustunlik — pub/sub va umumiy kesh — faqat 2+ instance'da qiymatga
   ega.** Hozir 1 instance. Ya'ni Redis **bugun mavjud bo'lmagan muammoni** hal
   qiladi
2. **Tezlik ustunligi bu miqyosda o'lchanmaydi** — yuqorida ko'rsatildi (bcrypt
   250 ms)
3. **TTL ustunligi haqiqiy, lekin arzon almashtiriladi** — `auth_locks` uchun
   `WHERE expires_at > now()` filtri **kifoya** (eskirgan qator ta'sir qilmaydi,
   faqat joy egallaydi). Tozalash — haftalik cron
4. **Lock uchun Redis — regressiya bo'lardi.** Yuqorida: restart'da lock
   yo'qolishi **xavfsizlik zaifligi**. Ya'ni Redis'ga o'tish auth'ni
   **yomonlashtiradi**

**Halol xulosa:** Redis kerak bo'ladi — 2-instance kerak bo'lgan kuni. Hozir
**erta**. Va uni erta qo'shish — ishlatilmaydigan infratuzilmani boqish
(bu allaqachon sodir bo'lgan: `package.json` da o'rnatilgan, hech qachon
chaqirilmagan paket).

### Alternativa B: kesh umuman olib tashlansin — nega rad etildi

**Ustunligi:** quyidagi eng katta salbiy oqibat (kesh bekor qilinishi) **butunlay
yo'qoladi**. Ruxsat har so'rovda bazadan o'qiladi → **doim yangi**. Bekor qilingan
ruxsat **darhol** kuchga kiradi. Xavfsizlik nuqtai nazaridan bu **eng to'g'ri**
yechim.

**Nega rad etildi:** har so'rov `user_roles` + `role_permissions` JOIN'ini talab
qilardi. Va ⚠️ **bu JOIN'lar ustida maqsadli indeks yo'q** — kanon o'lchagan:
`000000_init` da `CREATE INDEX` **0 ta**, `FOREIGN KEY` **165 ta**. PostgreSQL
tashqi kalit ustiga avtomatik indeks yaratmaydi.

Ya'ni keshni olib tashlash **hozirgi sxemada** har so'rovga ketma-ket skan
qo'shardi. Kesh bu yerda — **indeks yo'qligini yashiradigan plastır**.

**Bu muhim tan olish:** kesh mavjud, chunki indeks yo'q. Indeks qo'shilsa
([04-data-model.md](../04-data-model.md)), bu alternativa **jiddiy qayta ko'riladi** —
va u holda eng to'g'ri javob bo'lishi mumkin.

### Alternativa C: Postgres `LISTEN` / `NOTIFY` bilan kesh bekor qilish

**Ustunligi:** Redis'siz pub/sub. Instance'lar orasidagi kesh bekor qilinishi
**hal bo'lardi** — ya'ni asosiy salbiy oqibat yo'qolardi, yangi infratuzilmasiz.

**Nega hozir rad etildi:** Prisma `LISTEN`/`NOTIFY` ni qo'llab-quvvatlamaydi —
xom `pg` ulanishi va uni **doimiy ochiq** tutish kerak. Bu — ulanish
boshqaruvi, qayta ulanish logikasi, va Render'ning ulanish limiti. 1 instance'da
bu ish **nol foyda** beradi.

**Lekin bu — 2-instance kerak bo'lganda birinchi ko'riladigan variant**, Redis'dan
oldin. Chunki u bu ADR ni **buzmaydi**: Postgres yagona ombor bo'lib qoladi.

## Oqibatlar

**Ijobiy:**

- **Bitta ma'lumot ombori** — bitta backup, bitta tiklash, bitta operatsion bilim
- **Auth lock restart'dan omon qoladi** — Redis'dagidan xavfsizroq
- **Auth urinishlari so'rov qilinadi** — audit va hodisa tekshiruvi tekin
- **Ishga tushish bog'liqligi aniq** — Postgres yoq → ilova yoq. Yarim holat yo'q
- **Narx** — bepul tarifda ikkinchi xizmat yo'q
- **Lock va urinish yozuvi bitta tranzaksiyada** bo'lishi mumkin

**Salbiy:**

- ⚠️⚠️ **ENG QIMMAT OQIBAT — kesh bekor qilinishi FAQAT O'Z PROCESS'IDA ishlaydi.**

  ```ts
  // apps/api/src/modules/auth/auth.service.ts:358
  const cacheKey = `user:${userId}:roles_perms`;
  // :393
  await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);   // TTL 5 daqiqa
  // :397-399
  private async invalidateUserCache(userId: bigint): Promise<void> {
    await this.cacheManager.del(`user:${userId}:roles_perms`);     // ← faqat SHU process
  }
  ```

  **Ssenariy:** 2 ta instance ishlayapti. Admin xodimning `billing.write` ruxsatini
  olib tashladi. So'rov **instance-1** ga tushdi → `invalidateUserCache()` uning
  xotirasini tozaladi. **Instance-2** ning LRU keshida eski ruxsat **hali turibdi**
  va u **TTL tugagunicha — 5 daqiqagacha** amal qiladi.

  **Ya'ni: bekor qilingan ruxsat 5 daqiqagacha yashaydi.** Ishdan bo'shatilgan
  xodim 5 daqiqa davomida invoys yarata oladi — agar so'rovi instance-2 ga tushsa.

  ⚠️ **Va bu yolg'iz portlamaydi.** Xuddi shu paytda **UPLOAD_DIR muammosi** ham
  chiqadi:

  ```ts
  // apps/api/src/main.ts:57
  const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
  // :60-61
  app.use('/uploads', express.static(uploadDir, { ... }));
  ```

  ```yaml
  # render.yaml
  - key: UPLOAD_DIR
    value: /tmp/uploads
  ```

  Fayl **lokal diskda** (Render'da esa `/tmp` — **efemer**). Instance-1 ga yuklangan
  fayl instance-2 dan **ko'rinmaydi**. Ya'ni 2-instance ko'tarilgan **o'sha
  daqiqada** ikkita narsa birdan buziladi: ruxsat va fayllar.

  ⚠️ **Xulosa — bu ADR ning eng muhim jumlasi:** bu qaror **"1 instance" farazini
  yashirin shartga aylantiradi.** Farazning o'zi hech qayerda yozilmagan — na
  kodda, na `render.yaml` da, na README'da. U shunchaki **rost**, toki kimdir
  masshtabni oshirmaguncha. Va oshirgan odam bu ADR ni o'qimasa — nima
  buzilganini **tushunmaydi**, chunki hech narsa xato bermaydi: ruxsat jimgina
  eski qoladi, rasm jimgina 404 qaytaradi.

  **Shuning uchun bu ADR yozilyapti.** Qarorni asoslash uchun emas — **narxini
  qayd qilish** uchun.

- ⚠️ **`.env.example` mavjud bo'lmagan infratuzilmani va'da qiladi.**
  `apps/api/.env.example:50-52` da `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
  turibdi. Yangi dasturchi (yoki DevOps) buni o'qib **Redis o'rnatadi** — va u
  hech qachon ishlatilmaydi.

  Bu — **yolg'on hujjat**, va yolg'on hujjat hujjatsizlikdan **yomonroq**: u
  ishonch uyg'otadi. Bu — `tenant.util.ts` bilan **bir xil naqsh**
  ([03-multi-tenancy.md](../03-multi-tenancy.md)): mavjud ko'ringan, aslida
  ishlamaydigan narsa. Ikkalasi ham **o'chirilishi** kerak.

  Xuddi shu narsa `package.json` dagi `cache-manager-redis-store` uchun ham:
  o'rnatilgan, import qilinmagan → `npm audit` yuzasi, nol foyda.

- ⚠️ **In-memory kesh `max: 100`** (`auth.module.ts:13`). Ya'ni 100 dan ortiq
  faol foydalanuvchi bo'lsa LRU eski yozuvlarni **chiqarib tashlaydi** →
  kesh hit darajasi tushadi → har so'rov indekssiz JOIN'ga aylanadi. Bitta
  akademiyada 100 xodim yetarli. **Ikkinchi akademiya qo'shilganda — yo'q.**
  Va bu chegarani **hech kim kuzatmaydi** (metrics yo'q — [15-observability.md](../15-observability.md))

- **Kesh process xotirasida — restart'da yo'qoladi.** Deploy'dan keyin birinchi
  so'rovlar sekin. 1 instance'da bu sezilmaydi, lekin bu — **kesh isishi**
  muammosi va u hech qayerda o'lchanmaydi

- **`auth_locks` / `auth_attempts` da eskirgan qatorlarni hech kim o'chirmaydi.**
  Redis TTL buni tekin qilardi. Postgres'da retention job **kerak** va u
  **yozilmagan**. `auth_attempts` — har login urinishida qator → jadval
  cheksiz o'sadi

- **Har lock tekshiruvi — baza so'rovi.** Login yo'lida qo'shimcha round-trip.
  Bugun ~1 ms va bcrypt 250 ms fonida ko'rinmaydi; yuk ortsa **birinchi
  o'lchanadigan narsa**

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| ⚠️ **Ikkinchi API instance kerak bo'ldi** | Instance soni > 1 → **bu qaror avtomatik bekor bo'ladi**. Kesh bekor qilinishi va `UPLOAD_DIR` **birga** hal qilinishi shart |
| Faol foydalanuvchi 100 dan oshdi | `max: 100` LRU chegarasi → kesh hit darajasi tushadi. Ikkinchi tenant qo'shilishi bu chegarani **darhol** buzadi |
| Auth so'rovi login vaqtining sezilarli qismiga aylandi | `auth_locks` + `auth_attempts` so'rovlari > 50 ms → indeks yoki Redis |
| `auth_attempts` jadvali katta bo'lib ketdi | > 1M qator yoki `count(*)` > 100 ms → retention job **majburiy** |
| Real-time funksiya talab qilindi | Bildirishnoma push, jonli ekran yangilanishi (`displays`) → pub/sub kerak → avval `LISTEN`/`NOTIFY`, keyin Redis |
| Background job kerak bo'ldi | Navbat (queue) talab qilindi → BullMQ Redis talab qiladi. Muqobil: `pg-boss` (Postgres'da) — bu ADR ni buzmaydi |

⚠️ **Birinchi signal — asosiysi.** Bu qaror **1 instance farazi bilan bog'langan**.
Faraz buzilgan kuni qaror **o'z-o'zidan** bekor bo'ladi va yangi ADR yoziladi.

## Ochiq savollar

1. **`auth_attempts` retention qancha?** Xavfsizlik audit'i uchun 90 kun? Yuridik
   talab bormi? ⚠️ **Bolalar ma'lumoti** — ota-ona login urinishlari ham shu
   jadvalda ([10-security.md](../10-security.md), yurist savoli)
2. **Postgres `LISTEN`/`NOTIFY` 2-instance uchun yetarlimi?** Redis'dan oldin
   sinab ko'rilsinmi? U bu ADR ni buzmaydi — Postgres yagona ombor bo'lib qoladi
3. **`UPLOAD_DIR` qachon obyekt xotirasiga (S3/R2) ko'chadi?** Bu kesh muammosidan
   **alohida**, lekin **bir vaqtda** portlaydi. Render'da `/tmp` efemer — ya'ni
   fayllar **hozir ham** deploy'da yo'qolayotgan bo'lishi mumkin.
   ⚠️ **Bu tekshirilishi kerak — agar shunday bo'lsa, bu allaqachon bag**
4. **In-memory kesh TTL 5 daqiqa — nega 5?** Hech qayerda asoslanmagan. Bu
   "bekor qilingan ruxsat qancha yashaydi" savolining javobi — ya'ni **xavfsizlik
   parametri**, va u tasodifiy tanlangan ko'rinadi
5. **`cache-manager-redis-store` va `REDIS_*` qachon o'chiriladi?** Bu ADR ularni
   o'chirishni **talab qiladi**, lekin ish rejaga qo'yilmagan

## Havolalar

- [02-architecture.md](../02-architecture.md) — umumiy arxitektura
- [06-auth-and-rbac.md](../06-auth-and-rbac.md) — auth lock va ruxsat keshi
- [10-security.md](../10-security.md) — brute-force himoyasi
- [11-infrastructure.md](../11-infrastructure.md) — Render deploy, `UPLOAD_DIR`
- [15-observability.md](../15-observability.md) — kesh hit darajasi o'lchanmaydi
- [ADR-0005](./0005-permission-based-rbac.md) — ruxsat modeli keshni **talab qiladi**
- Kod: `apps/api/src/modules/auth/auth.module.ts:11-14`,
  `apps/api/src/modules/auth/auth.service.ts:187, 269, 297, 358, 393, 397`,
  `apps/api/src/main.ts:57`, `apps/api/.env.example:50-52`, `render.yaml`
- "Choose Boring Technology" — Dan McKinley (innovation token tushunchasi)
- `pg-boss` — Postgres'da navbat, Redis'siz muqobil
