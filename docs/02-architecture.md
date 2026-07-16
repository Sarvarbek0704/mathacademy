# 02 — Tizim arxitekturasi

> **Hujjat maqomi:** Loyiha · **Oxirgi yangilanish:** 2026-07-15
> **Asos:** o'qilgan real kod — `apps/api/src/` (37 294 qator, 28 modul, 51 commit)
>
> ⚠️ Bu hujjat **ishlab turgan tizimni** tavsiflaydi. Real xodimlar va ota-onalar
> undan har kuni foydalanadi. Shuning uchun bu yerda "qayta yozamiz" degan taklif
> yo'q — faqat **o'lchangan holat** va **bosqichma-bosqich yetuklashtirish yo'li**.
>
> Har bir da'vo `fayl:qator` bilan tasdiqlangan. O'lchovlar jamlanmasi — **Ilova A**.

---

## 1. Hozirgi arxitektura

### 1.1. Umumiy ko'rinish

```
┌──────────────────────┐         ┌──────────────────────┐
│ Staff UI · 36 sahifa │         │ Guardian UI · 12     │
└──────────┬───────────┘         └──────────┬───────────┘
           │   HTTP + JWT (Bearer / cookie / x-access-token)
┌──────────▼────────────────────────────────▼───────────────────┐
│  apps/api — NestJS 11 modular monolit (bitta process)         │
│                                                               │
│  main.ts: globalPrefix 'api' · cookieParser · CORS allowlist  │
│           ValidationPipe (global) · AllExceptionsFilter        │
│           Swagger /api/docs · BigInt.toJSON patch (15-21)     │
│  ⚠️ useGlobalGuards YO'Q → himoya standarti OCHIQ (3.1)       │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 28 FEATURE MODUL — modul grafida 0 ta qirra (7-bo'lim)  │  │
│  │ auth · students · groups · attendance · assessments      │  │
│  │ academic-years · timetable · ranking · risk · discipline │  │
│  │ leaves · certificates · events · competitions · awards   │  │
│  │ displays · notifications · billing · rbac · dorms · files│  │
│  │ campuses · subjects · student-tracks · cohorts           │  │
│  │ announcements · tenants · users                          │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│  ┌───────────────────────▼─────────────────────────────────┐  │
│  │ common/ — guards · pipes · decorators · filters · utils  │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│  ┌───────────────────────▼─────────────────────────────────┐  │
│  │ PrismaService (@Global) — PrismaClient + adapter-pg      │  │
│  └───────────────────────┬─────────────────────────────────┘  │
└──────────────────────────┼────────────────────────────────────┘
              ┌────────────▼──────┐   ┌──────────────────────┐
              │ PostgreSQL 15+    │   │ Lokal disk /uploads  │
              │ 69 model · 1 enum │   │ ⚠️ 1 instance'ga bog'│
              └───────────────────┘   └──────────────────────┘
              ┌───────────────────────────────────────────────┐
              │ Redis 7 ← ⚠️ HUJJATDA BOR, KODDA YO'Q (6-bo'lim)│
              └───────────────────────────────────────────────┘
```

### 1.2. Monorepo

```
mathacademy/
├── apps/api/    NestJS 11 · 37 294 qator · src/{common,prisma,modules}
├── apps/web/    React 18.3 + Vite · 25 489 qator · 48 sahifa
└── docs/
```

**Nega monorepo:** API va Web bitta domen modelini baham ko'radi. Alohida repo —
har o'zgarish uchun ikki PR, ikki deploy, va muqarrar versiya nomuvofiqligi.
Bitta muallif va 51 commit uchun bu sof zarar.

⚠️ **Halol eslatma:** hozir monorepo — **shunchaki ikki papka**. Umumiy tip paketi
yo'q: `students.service.ts:189-200` javob shaklini qaytaradi, Web esa uni **qo'lda
qayta e'lon qiladi**. Build orkestratori (Turbo/Nx) ham yo'q. Monorepo'ning
asosiy foydasi — umumiy tip — **hali olinmagan**. → `04-api-spec.md`

### 1.3. Nega modular monolit — va nega bu to'g'ri qaror

Mikroservis bu bosqichda **faqat zarar keltirardi**:

| O'lchangan fakt | Mikroservis uchun nima anglatadi |
|---|---|
| **Bitta jamoa** (1 muallif, 51 commit) | Servis chegarasi = jamoa chegarasi. Bitta jamoa uchun u sun'iy |
| **28 modul** | 28 deploy, 28 monitoring, 28 CI pipeline |
| **69 model, qattiq bog'langan** | `students`→`groups`→`attendance` JOIN bilan o'qiladi. Ajratilsa — distributed JOIN, ya'ni N+1 tarmoq chaqiruvi |
| **Testlar amalda nol** (1 placeholder) | Mikroservisda test majburiy — kompilyator chegaradan o'tmaydi. Testsiz mikroservis = boshqariladigan xaos emas, oddiy xaos |
| **Tranzaksiya kerak** | `students.service.ts:164` `$transaction`. Mikroservisda bu saga pattern — o'nlab barobar murakkab |

Monolitda modul chegarasini buzish **arzon** (import yozasan, tugadi).
Mikroservisda **imkonsiz** — bu uning yagona haqiqiy afzalligi. Lekin uning
narxi (tarmoq, deploy, kuzatuv, distributed tranzaksiya) hozir **hech qanday
muammoni hal qilmaydi**.

**Xulosa:** monolit to'g'ri. Lekin monolit "chegara yo'q" degani emas — 7 va
8-bo'limlarga qarang.

---

## 2. Qatlamlar

### 2.1. Deklaratsiya qilingan naqsh

```
HTTP → ┌─────────────────────────────────────────────┐
       │ Controller                                  │
       │ @UseGuards · @RequirePermissions            │
       │ @Query() dto  ← validatsiya                 │
       │ @Param('id', ParseBigIntPipe) ← konversiya  │
       │ MANTIQ YO'Q — faqat tarjima                 │
       └──────────────────┬──────────────────────────┘
       ┌──────────────────▼──────────────────────────┐
       │ Service — biznes qoidasi · tenant filtri ·  │
       │ tranzaksiya · audit · javob shakli          │
       └──────────────────┬──────────────────────────┘
       ┌──────────────────▼──────────────────────────┐
       │ PrismaService → PostgreSQL                  │
       └─────────────────────────────────────────────┘
```

Repository qatlami **yo'q** — ataylab. Prisma allaqachon type-safe repository.
Uning ustiga qatlam qo'yish 69 model uchun minglab qator boilerplate, foydasi
esa faqat "ORM almashtirish oson" — **hech qachon sodir bo'lmaydigan** stsenariy.

### 2.2. Kod shu naqshga amal qiladimi — TEKSHIRILDI

**Asosan ha. Uchta aniq buzilish bilan.**

**✅ DTO/validatsiya chegarada.** `main.ts:108-123` global `ValidationPipe`:
`whitelist: true` (DTO'da yo'q maydon o'chiriladi), `transform: true`,
`enableImplicitConversion: true`. 128 DTO — validatsiya haqiqatan chegarada.
⚠️ `forbidNonWhitelisted: false` (`main.ts:118`) — noma'lum maydon **jim
tashlanadi**. Kechirimli, lekin mijoz `role: "admin"` yuborsa u ham jim yo'qoladi
va mijoz buni bilmaydi. → 10-bo'lim, savol 6.

**✅ Controller ozg'in.** `students.controller.ts:67-86` — faqat query'ni uzatadi.
36 controller'ning aksariyati shunday.

#### ❌ Buzilish 1 — Controller Prisma'ga to'g'ridan-to'g'ri kiradi

`guardian-student.controller.ts` **4 joyda** `private` modifikatorini aylanib
o'tadi:

```ts
// 465
const violations = await this.studentsService['prisma'].violations.findMany(...)
// 558
const invoices  = await this.studentsService['prisma'].invoices.findMany({...})
// 887
const student   = await this.studentsService['prisma'].students.findUnique({...})
// 902
const timetable = await this.studentsService['prisma'].timetable.findFirst({...})
```

`StudentsService.prisma` — `private` (`students.service.ts:65`). Bracket notation
TypeScript tekshiruvini **ataylab** chetlab o'tadi — bu tasodif emas, kompilyatorni
jim qildirish uchun yozilgan.

**Nega muhim:** `violations`, `invoices`, `timetable` — `discipline`, `billing`,
`timetable` modullarining jadvallari. Bu ham qatlamni (Controller→Prisma), ham
modul chegarasini buzadi. Va u **kompilyator uchun ko'rinmas** — refactoring
vositasi topa olmaydi.

#### ❌ Buzilish 2 — `common/` funksiyalari servisda takrorlangan

`students.service.ts:21` `toBigInt()` — `common/utils/bigint.util.ts:5`
`parseBigIntId()` ning nusxasi. **Farq muhim:** `parseBigIntId` `'0'` va `n <= 0n`
ni rad etadi, lokal `toBigInt` esa **`0` ni qabul qiladi**. Ikki xil validatsiya
qoidasi.

`students.service.ts:28` `prismaErrorToHttp()` — `common/utils/prisma-error.util.ts:9`
nusxasi. **Uchinchi nusxa** `all-exceptions.filter.ts:63-114` da global filter
sifatida **allaqachon ishlaydi**. Bir xil P2002→409 xaritasi **uch joyda**.
Kodlar ham bir xil emas: lokal `'ALREADY_EXISTS'`, util `'DUPLICATE'`.
**Oqibat:** mijoz qaysi kodni ko'radi — qaysi yo'l ishga tushganiga bog'liq.
API shartnomasi nomuvofiq.

#### ❌ Buzilish 3 — `tenantId` string sifatida sayohat qiladi

```ts
students.controller.ts:69   tenantId: String(req.user?.tenantId || ''),
students.service.ts:89      const tenant_id = toBigInt(args.tenantId, 'tenantId');
```

1. **`|| ''` fallback** — `tenantId` yo'q bo'lsa bo'sh satr → `400 INVALID_TENANTID`.
   **Fail-closed** (ma'lumot sizmaydi — yaxshi), lekin status **noto'g'ri**: bu
   autentifikatsiya muammosi, `401`/`403` bo'lishi kerak.
2. **Tip yo'qoladi:** `bigint → string → bigint`. Chegarada bir marta parse qilib,
   keyin `bigint` tashish kerak edi.
3. **`common/utils/tenant.util.ts` aynan shu uchun `getUserTenantId()` ni
   e'lon qiladi — va ishlatilmaydi** (3.6).

---

## 3. `common/` poydevori

```
common/
├── auth/jwt-request.util.ts       ← barcha guard'larning yuragi
├── config/env.validation.ts       ← noto'g'ri konfiguratsiyada ishga tushmaslik
├── decorators/  param-bigint · perms (@RequirePermissions) · roles (@Roles)
├── filters/all-exceptions.filter  ← yagona xatolik shakli
├── guards/      access · perms · roles
├── pipes/parse-bigint.pipe        ← route param → bigint
├── types/express.d.ts             ← req.user tipi
├── utils/       audit · bigint · date · id · service-error · service-try
│                prisma-error  ← ⚠️ filter bilan takrorlanadi
│                tenant        ← ⚠️⚠️ O'LIK KOD (3.6)
└── validators/is-bigint-string.decorator.ts  ← DTO uchun
```

### 3.1. Guard'lar

Uchta guard, uchtasi ham `ensureUser()` ga tayanadi:

```
So'rov
  │
  ▼  ensureUser(req, jwt, prisma)      jwt-request.util.ts:52
  │  1. req.user bormi? → qaytar (keshlangan, :57)
  │  2. Token: Bearer → cookie → x-access-token
  │  3. JWT_ACCESS_SECRET bilan verify
  │  4. payload.type bormi? (STAFF | GUARDIAN)
  │  5. sessionId bo'lsa → DB: auth_sessions
  │     revoked_at: null, expires_at > now          (:76)
  │  6. req.user = payload                          (:82)
  │
  ├─► AccessGuard      ensureUser() → true. "Kirgan bo'l" — ruxsat tekshirmaydi
  ├─► RolesGuard       @Roles. SUPERADMIN → true (:32). some() — bittasi yetarli
  └─► PermissionsGuard @RequirePermissions. SUPERADMIN → true (:32).
                       every() — HAMMASI kerak
```

**Nega `some()` vs `every()`:** rol — "kimsan" (bittasi yetarli); ruxsat — "nima
qila olasan" (talab qilinganlarning hammasi). To'g'ri semantika.

**Nega DB'da sessiya tekshiriladi (`jwt-request.util.ts:76`):** JWT stateless —
bekor qilib bo'lmaydi. Xodim ishdan bo'shatilsa tokeni muddati tugagunicha
ishlayverardi. `auth_sessions` "logout"ni imkonli qiladi. **Narxi: har so'rovda
+1 DB so'rov.** `ensureUser` natijani `req.user` ga yozadi, shu sabab ustma-ust
guard'lar DB so'rovini **takrorlamaydi** — bu o'ylangan.

⚠️ **Strukturaviy kuzatuv — global guard yo'q.** `main.ts` da `useGlobalGuards`
yo'q, `app.module.ts` da `APP_GUARD` yo'q. **Himoya standarti — OCHIQ.**

**Halol o'lchov: 36 controller'ning 36 tasida `@UseGuards` bor.** Intizom bugun
**buzilmagan**. Muammo hozirgi kodda emas: 37-controller uni unutsa **hech narsa
ogohlantirmaydi** — kompilyator jim, test yo'q, CI yo'q. Bu **kelajak xavfi**,
hozirgi bag emas. → 8-bo'lim.

### 3.2. Pipes va BigInt intizomi

**Muammo:** JS `number` — IEEE 754 double. 2⁵³ dan katta butun son **jimgina**
buziladi. Bag topilganda ma'lumot allaqachon buzilgan bo'ladi.

**Yechim — besh nuqtali mudofaa:**

| Fayl | Qayerda |
|---|---|
| `pipes/parse-bigint.pipe.ts` | Route param: `/students/:id` |
| `validators/is-bigint-string.decorator.ts` | DTO ichidagi ID |
| `utils/bigint.util.ts` | Servisdagi yagona konversiya yo'li |
| `decorators/param-bigint.decorator.ts` | `@ParamBigInt()` qisqartma |
| `main.ts:15-21` | `BigInt.prototype.toJSON` |

`main.ts` patch'i majburiy: `JSON.stringify(1n)` **TypeError tashlaydi** — BigInt
JSON'da standart emas. Patch uni `"1"` ga aylantiradi.
`__bigint_json_patch_applied__` flag — hot-reload'da ikki marta qo'llanmasligi uchun.

⚠️ `students.controller.ts:105` `@Param('id', ParseBigIntPipe)` ni to'g'ridan
ishlatadi — `@ParamBigInt()` qisqartmasi o'rniga. Zararsiz nomuvofiqlik, lekin
dekorator nima uchun yozilgani savol tug'diradi.

### 3.3. Dekoratorlar

`@Roles`, `@RequirePermissions` — `SetMetadata` o'ramlari. Guard `Reflector.
getAllAndOverride()` bilan o'qiydi.

**Nega `getAllAndOverride`, `getAllAndMerge` emas:** metod darajasi klass
darajasini **almashtiradi**, qo'shmaydi. Controller'da `students.read`, metodda
`students.write` bo'lsa — faqat `write` talab qilinadi. Aniqroq qoida g'olib —
kutilgan xulq.

### 3.4. Filter

`all-exceptions.filter.ts` — `@Catch()` (argumentsiz = hammasini tutadi).

**Nega bor:** `PrismaClientKnownRequestError` ichida jadval nomi, ustun nomi,
ba'zan qiymat bo'ladi. Bu mijozga chiqmasligi kerak — ma'lumot sizishi.

| Prisma | HTTP | Kod |
|---|---|---|
| P2002 unique | 409 | `ALREADY_EXISTS` |
| P2003 FK | 400 | `INVALID_REFERENCE` |
| P2025 topilmadi | 404 | `NOT_FOUND` |
| P2000 uzun | 400 | `INVALID_DATA` |
| boshqa | 500 | `DB_ERROR` |
| ValidationError | 400 | `INVALID_DATA` |
| InitializationError | 503 | `DB_UNAVAILABLE` |
| **noma'lum** | **500** | **`INTERNAL`** — detal yo'q |

Oxirgi qator eng muhim: kutilmagan xato hech narsa oshkor qilmaydi.

⚠️ **Ikki bo'shliq:** (1) **`traceId` yo'q** — 500 olgan foydalanuvchini logda
topishning yagona yo'li vaqt bo'yicha taxmin; (2) **log yo'q** — filter xatoni
tutadi va hech narsa yozmaydi, hatto `console.error` ham. **500 xato izsiz
yo'qoladi.** → `09-observability.md`

### 3.5. Utils

**`audit.util.ts`** — `audit_logs` ga yozadi. `:63-65` audit xatosi asosiy
operatsiyani **buzmaydi** — to'g'ri qaror: o'quvchi yaratish audit tufayli
yiqilmasligi kerak.

⚠️ **Ikki jiddiy nuqta:**
1. **DI orqali emas, qo'lda:** `students.service.ts:66` — `new AuditLogger(prisma)`,
   **26 servisda takrorlanadi**. Test'da mock qilib bo'lmaydi; audit'ni queue'ga
   ko'chirish 26 faylni tahrirlashni talab qiladi. `@Injectable()` provider
   bo'lishi kerak edi.
2. **Audit tranzaksiyadan tashqarida.** `students.service.ts:164` `$transaction`
   ichida yozadi, audit keyin alohida. Rollback bo'lsa — audit "sodir bo'ldi" deb
   qolishi mumkin. Aksincha: yozuv commit bo'ldi, audit yiqildi (yuqoridagi
   catch) → **audit izsiz o'zgarish**. Bu auditning maqsadiga zid.
   → `10-security.md`

**`bigint.util.ts`** — yagona to'g'ri konversiya yo'li. ⚠️ `students.service.ts:21`
uni chetlab o'tadi (2.2).

**`prisma-error.util.ts`** — ⚠️ global filter **allaqachon** hamma joyda shu ishni
qiladi. Bu util **kerak emas** va boshqa kod qaytaradi.

**`date.util.ts`** (`parseDateOnly`, `toDateOnly`) faol ishlatiladi
(`students.service.ts:13-17`). `service-error`, `service-try`, `id.util` —
yordamchi.

### 3.6. ⚠️⚠️ `tenant.util.ts` — O'LIK KOD

Bu — hujjatning eng muhim topilmasi va `03-multi-tenancy.md` ning kirish nuqtasi.

Faylda **to'g'ri yechim yozilgan** (`tenant.util.ts:30`):

```ts
export function withTenantCondition<T extends Record<string, any>>(
  user: RequestUser, where: T = {} as T,
): T & { tenant_id: bigint } {
  const userTenantId = getUserTenantId(user);
  if (where.tenant_id !== undefined && where.tenant_id !== null) {
    const requested = parseBigIntId(where.tenant_id, 'tenant_id');
    if (requested !== userTenantId) throw new ForbiddenException('TENANT_MISMATCH');
    return where as any;
  }
  return { ...(where as any), tenant_id: userTenantId };
}
```

`getUserTenantId()`, `ensureTenantId()`, `withTenantCondition()` — uchalasi puxta.
`ensureTenantId` hatto "mijoz so'ragan tenant o'zinikimi" tekshiruvini ham qiladi.

**Va hech qayerda ishlatilmaydi.** Grep: 1 natija — faylning o'zi.

O'rniga tenant filtri **845 chaqiruv nuqtasida qo'lda**, masalan
`students.service.ts:98`:

```ts
const where: Prisma.studentsWhereInput = {
  tenant_id,   // ← qo'lda. Unutilsa — hech narsa ogohlantirmaydi
  ...
};
```

**Nega bu himoyasizlikdan yomonroq:** faylning mavjudligi o'quvchida "tenant
himoyasi bor" degan taassurot qoldiradi. Yangi dasturchi (yoki yangi Claude
sessiyasi) uni ko'rib "demak hal qilingan" deb o'ylaydi va **tekshirmaydi**.
Himoyaga o'xshagan o'lik kod — **noto'g'ri xotirjamlik**. Bo'sh papka halolroq.

**Bu yerda hal qilinmaydi.** To'liq yechim (Prisma `$extends` bilan ma'lumot
qatlamida majburlash) va 845 nuqtaning migratsiya yo'li — `03-multi-tenancy.md`.
Bu hujjat **arxitektura oqibatini** qayd etadi: **tenant izolyatsiyasi hozir
qatlam emas, intizom.**

### 3.7. `config/env.validation.ts`

**Nega bor:** `JWT_ACCESS_SECRET` yo'q bo'lsa server ishga tushmasligi kerak —
tushib, keyin har so'rovda 500 bermasligi. `app.module.ts:43` da ulangan,
xato bo'lsa **throw**. Fail-fast.

⚠️ **Ziddiyat — ACCESS_TOKEN_TTL.** Kanon buni ko'rsatgan edi; o'lchov tasdiqladi.
To'rt joyda to'rt manzara:

| Fayl | Qiymat |
|---|---|
| `.env.example:23` | `ACCESS_TOKEN_TTL="15h"` — ⚠️ **`15m` ga tuzatildi** |
| `env.validation.ts:54` | default `'15m'` |
| `auth.service.ts:89` | `process.env.ACCESS_TOKEN_TTL \|\| '15m'` |
| `auth.module.ts:21` | `expiresIn: '15m'` — **hardkod** |
| **`render.yaml:21-22`** | **`ACCESS_TOKEN_TTL: 15m`** — deploy qilingan qiymat |

⚠️ **TUZATILGAN — bu bo'limning oldingi tahriri "Deploy'da 15 soatlik access
token" degan edi. Bu XATO.** `render.yaml` env'ni ochiq o'rnatadi
(`ACCESS_TOKEN_TTL: 15m`), ya'ni `.env.example` **production'ga umuman yetib
bormaydi**. Deploy qilingan API har doim 15 daqiqa ishlatgan.

**Real ta'sir:** `15h` faqat `cp .env.example .env` qilgan **lokal
dasturchiga** tegardi. Ya'ni bu production hodisasi emas — **muhitlar
o'rtasidagi jimgina farq**: mahalliy muhit production'dan 60 barobar
uzoqroq TTL bilan ishlardi va hech narsa buni aytmasdi. Xavfsizlik
xatti-harakati mahalliyda sinalmasdi. **Holati: `.env.example` `15m` ga
tuzatildi.**

Bu — **konfiguratsiya bag'i**. Tuzatish `10-security.md` da. Bu yerda arxitektura
xulosasi: **env validatsiyasi format tekshirmaydi**, faqat "satrmi" deb so'raydi.
`@Matches(/^\d+[smhd]$/)` va maksimal chegara kerak.

⚠️ **Ikkinchi topilma** (`auth.module.ts:18-19`):

```ts
secret: process.env.JWT_ACCESS_SECRET || 'default-secret-change-in-production',
```

**Amalda ekspluatatsiya qilib bo'lmaydi** — `env.validation.ts:47-48`
`JWT_ACCESS_SECRET` ni majburiy qiladi, u bo'lmasa app ishga tushmaydi. Lekin bu
himoyaning **tasodifiy** ekanini bildiradi: o'sha qator o'chirilsa, tizim jim
turib **ma'lum secret** bilan token imzolaydi. Fallback olib tashlansin.

---

## 4. ⚠️ Muammo: servislar juda katta

### 4.1. O'lchov

```
students       ████████████████████████████████████████  2079
auth           ████████████████████████████████          1644
billing        ███████████████████████████████           1610
displays       ██████████████████████                    1136
discipline     █████████████████████                     1123
assessments    ███████████████████                        987
academic-years ██████████████████                         927
events         █████████████████                          872
competitions   ████████████████                           856
attendance     ████████████████                           854
dorms          ████████████████                           835
certificates   ████████████████                           831
timetable       ████████████████                          818
notifications  ███████████████                            811
leaves         ██████████████                             742
```

`students` moduli to'liq: `students.service.ts` 2079 + `guardian-student.
controller.ts` **971** + `students.controller.ts` 553 = **3603**.

⚠️ 971 qatorlik **controller** — alohida signal. Controller "ozg'in tarjimon"
bo'lishi kerak edi (2.1). 971 qator — u tarjimon emas, u **ikkinchi servis**,
va u Prisma'ga to'g'ridan kiradi (2.2).

### 4.2. Bu nima anglatadi

**Qator soni o'zi muammo emas.** Muammo — u **nimani ko'rsatishi**.
`students.service.ts` metod xaritasi (o'lchangan):

```
 qator │ metod                     │ mas'uliyat
───────┼───────────────────────────┼─────────────────────────────
   70  │ list()                    │ o'quvchi CRUD
  256  │ create()                  │ o'quvchi CRUD  (276 qator!)
  533  │ detail()                  │ o'quvchi CRUD
  749  │ update()                  │ o'quvchi CRUD
───────┼───────────────────────────┼─────────────────────────────
  938  │ assignGroup()             │ joylashtirish
 1047  │ changeLivingType()        │ joylashtirish
 1179  │ assignCohort()            │ joylashtirish
───────┼───────────────────────────┼─────────────────────────────
 1300  │ resetGuardianPassword()   │ ⚠️ AUTH mas'uliyati
 1717  │ guardianMe()              │ ⚠️ AUTH mas'uliyati
───────┼───────────────────────────┼─────────────────────────────
 1393  │ bulkImport()              │ import
───────┼───────────────────────────┼─────────────────────────────
 1559  │ getStatistics()           │ hisobot
 1814  │ getRegistrationTrend()    │ hisobot
 1846  │ getStudentStats()         │ hisobot
───────┼───────────────────────────┼─────────────────────────────
 1921  │ getStudentAttendance()    │ ⚠️ ATTENDANCE jadvali
 1955  │ getStudentPayments()      │ ⚠️ BILLING jadvali
 1995  │ getStudentViolations()    │ ⚠️ DISCIPLINE jadvali
 2025  │ getStudentAssessments()   │ ⚠️ ASSESSMENTS jadvali
```

**Diagnoz: `students` — o'quvchi moduli emas. U `students` + `auth` +
`reporting` + to'rt boshqa modulning o'quvchi kesimi.**

Oxirgi to'rt metod (1921-2079) eng ko'p narsani aytadi: `students.service.ts`
`attendance`, `invoices`, `violations`, `assessments` jadvallarini **to'g'ridan**
o'qiydi. Ular boshqa modullarga tegishli. Ya'ni `students` — de-fakto
**cross-domain aggregator**, lekin buni hech kim e'lon qilmagan va hech narsa
cheklamagan. Bu — 7-bo'limdagi "modullar mustaqil" manzarasining haqiqiy yuzi.

### 4.3. ⚠️ Tavsiya EMAS: qayta yozish

**Bu ishlaydigan tizim.** 2079 qatorda **o'nlab hal qilingan chekka holat** bor —
masalan `students.service.ts:57` dagi `11 - admissionGrade` domen bilimi hujjatda
emas, **faqat kodda** yashaydi. Qayta yozish o'sha bilimni yo'qotadi.

Eng muhimi: **testlar yo'q**. Testsiz refactoring — refactoring emas, **yangi kod
yozib eskisini o'chirish**. Regressiya kafolatlangan.

**Qat'iy qoida: test yo'q ekan — bo'lish yo'q.**

### 4.4. Bosqichma-bosqich yo'l

```
BOSQICH 0 — Xavfsizlik to'ri            ⏱ birinchi, muzokarasiz
├── students integratsiya testi (real DB, Testcontainers)
│   · list/create/detail/update — happy path
│   · tenant izolyatsiyasi: A tenant B ni ko'rmaydi
│   · guardian faqat o'z farzandini ko'radi
└── ⚠️ TEST YO'Q — QUYIDAGI BOSQICHLARNING BIRORTASI BOSHLANMAYDI

BOSQICH 1 — Chegara buzilishini to'xtatish   ⏱ arzon, xavfi MINIMAL
├── guardian-student.controller.ts 4 ta ['prisma'] → StudentsService metodiga
│   (465, 558, 887, 902) → buzilish kompilyatorga ko'rinadigan bo'ladi
├── students.service.ts:21 toBigInt → common/utils/bigint.util.ts
│   ⚠️ Xulq o'zgaradi: '0' endi rad etiladi. Test bilan tasdiqlansin
├── students.service.ts:28 prismaErrorToHttp → o'chirish (filter qiladi)
└── Xulq deyarli o'zgarmaydi, faqat kod ko'chadi

BOSQICH 2 — Fayl bo'lish, modul emas     ⏱ o'rta, xavfi PAST
├── students.service.ts (2079) → bir modul, bir nechta servis:
│     students.service.ts           list/create/detail/update   (~800)
│     student-placement.service.ts  assignGroup/Cohort/Living   (~400)
│     student-import.service.ts     bulkImport                  (~170)
│     student-reports.service.ts    statistics/trend/stats      (~350)
├── students.module.ts hammasini provider qiladi
└── TASHQI API O'ZGARMAYDI — mijoz sezmaydi

BOSQICH 3 — Noto'g'ri joydagi mas'uliyat  ⏱ ehtiyot bilan, xavfi O'RTA
├── resetGuardianPassword() (1300), guardianMe() (1717) → auth moduliga?
│   ⚠️ MODUL chegarasini o'zgartiradi → API yo'li o'zgaradi → 48 sahifaga ta'sir
└── 04-api-spec.md bilan muvofiqlashtirilsin

BOSQICH 4 — Cross-domain o'qishni rasmiylashtirish  ⏱ oxirgi, xavfi YUQORI
├── getStudentAttendance/Payments/Violations/Assessments (1921-2079)
│   (a) Har modul o'z "student kesimi"ni e'lon qilsin → to'g'ri chegara,
│       lekin 4 yangi bog'liqlik va SIKL XAVFI
│   (b) Alohida student-profile aggregator moduli → sikl yo'q, lekin 29-modul
│       va kanon "yangi modul qo'shma" deydi
└── ⚠️ QAROR QABUL QILINMAGAN → 10-bo'lim, savol 1
```

**Nega shu tartib:** har bosqich oldingisining xavfsizlik to'riga tayanadi.
1-bosqich xulqni deyarli o'zgartirmaydi. 2-bosqich modul tashqarisiga ko'rinmaydi.
3 va 4 — API shartnomasiga tegadi, shuning uchun oxirida va alohida qaror bilan.

**Ish `students` dan boshlanadi** — u eng katta va u **namuna** bo'ladi. Qolgan
14 katta servis (`auth` 1644, `billing` 1610, ...) shu naqsh bo'yicha, **faqat
kerak bo'lganda** (yangi funksiya qo'shilayotganda) tegiladi.

⚠️ **"Hamma servisni tozalash sprinti" — tavsiya qilinmaydi:** u qiymat
yaratmaydi va regressiya xavfini bir vaqtda 15 modulga tarqatadi.

---

## 5. Prisma qatlami

### 5.1. PrismaService

```ts
// prisma/prisma.service.ts:14-38
@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: requireEnv('DATABASE_URL') });
    super({ adapter, log: NODE_ENV === 'development' ? ['warn','error'] : ['error'] });
  }
  async onModuleInit()    { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

- **`extends PrismaClient`** — `this.prisma.students.findMany()` to'g'ridan
  ishlaydi, o'ram kerak emas, tip xavfsizligi to'liq.
- **`OnModuleDestroy` → `$disconnect()`** — graceful shutdown. Bo'lmasa deploy'da
  PostgreSQL'da osilgan ulanishlar qoladi → `too many connections`.
- **`requireEnv('DATABASE_URL')`** — `env.validation.ts` allaqachon tekshiradi;
  bu ikkinchi mudofaa. Konstruktorda throw = app ishga tushmaydi.
- **`@Global()`** (`prisma.module.ts:4`) — 28 modulning hammasi Prisma'ga muhtoj.
  Har birida import yozish 28 qator shovqin. To'g'ri qaror.

⚠️ Shunga qaramay **7 modul** (`attendance:10`, `displays:7`, `events:10`,
`leaves:10`, `notifications:10`, `ranking:10`, `risk:7`) `PrismaModule` ni
**ortiqcha** import qiladi. Zararsiz, lekin kod bir vaqtda yozilmaganini
ko'rsatadi — ular `@Global()` dan oldin yozilgan.

### 5.2. `@prisma/adapter-pg` — nega

Prisma 7 da driver adapter — asosiy yo'l. An'anaviy Prisma Rust query engine
binary'sini talab qiladi (~20MB); adapter sof `pg` (Node) drayveri orqali ishlaydi.

| Foyda | Sabab |
|---|---|
| Binary yo'q | Docker image kichik, serverless/edge'da ishlaydi |
| Standart `pg` pool | Node ekotizimining sinovdan o'tgan drayveri |
| Sovuq start tez | Rust engine ko'tarilishi kutilmaydi |

### 5.3. ⚠️ Connection pooling — sozlanmagan

```ts
new PrismaPg({ connectionString: requireEnv('DATABASE_URL') })
```

Boshqa parametr **yo'q** → `pg` ning **standart** pooli: `max: 10`,
`idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 0`.

- **`max: 10`** — instance eng ko'pi 10 parallel DB so'rovi. Bitta akademiya
  uchun yetarli bo'lishi mumkin — lekin bu **o'lchanmagan**.
- **`connectionTimeoutMillis: 0` = cheksiz kutish.** Pool to'lsa so'rov abadiy
  osiladi, **xato bermaydi**. Bu yashirin nosozlik rejimi: tizim "sekin"
  ko'rinadi, aslida qotgan.
- **Gorizontal masshtablashda:** 4 instance × 10 = 40 ulanish. PostgreSQL
  standart `max_connections = 100` → ~10 instance'gacha joy, keyin PgBouncer.

**Hozir bag emas** — bir akademiya yuklamasida sezilmaydi. Lekin ko'p tenant
rejasida birinchi to'siqlardan biri. **Aniq qiymat yuklama testi bilan
aniqlanadi** — bu yerda taxminiy raqam yozilmaydi.

### 5.4. Migratsiya intizomi

Ikki migratsiya: `000000_init`, `000001_files_storage`. **Haqiqiy migration,
`db push` emas.**

**Nega muhim:** `db push` schema'ni majburan moslashtiradi va **tarixni
yozmaydi**. Real ma'lumot ustidagi tizimda bu ma'lumot yo'qotish. Migratsiya —
versiyalangan, ko'rib chiqiladigan, orqaga qaytariladigan.

Deploy: `npm run migrate:deploy` → `prisma migrate deploy`. `migrate dev`
**production'da hech qachon** — u DB'ni reset qilishi mumkin.

⚠️ 69 model, lekin 2 migratsiya — schema asosan bitta katta `000000_init` da.
Normal (loyiha boshlanishi), lekin kelgusi **har o'zgarish alohida migratsiya**.

---

## 6. Redis — ⚠️ hujjatda bor, kodda yo'q

Bu bo'lim **kanon bilan ziddiyatni** qayd etadi. Kanon "Redis 7" ni stack'da
sanaydi va "auth locks + Redis" deydi. **Kod buni tasdiqlamaydi.**

### 6.1. O'lchangan holat

| Tekshiruv | Natija |
|---|---|
| `redisStore` / `ioredis` / `KeyvRedis` import | **0 ta** |
| `REDIS_HOST/PORT/PASSWORD` kodda o'qiladimi | **Yo'q.** Faqat `.env.example:38-40` da e'lon qilingan |
| `cache-manager-redis-store` (`package.json:37`) | O'rnatilgan, **hech qayerda import qilinmagan** |
| `env.validation.ts` `REDIS_*` ni tekshiradimi | **Yo'q** |
| `CacheModule` qayerda | **Faqat** `auth.module.ts:11` |

```ts
// auth.module.ts:11-14
CacheModule.register({ ttl: 300000, max: 100 }),
```

**`store` parametri yo'q → in-memory LRU kesh.** Node process xotirasida.
Restart — yo'qoladi.

### 6.2. Kesh nima uchun ishlatiladi

Yagona ishlatilish — `auth.service.ts:354-399`:

```ts
private async getStaffRolesPermissions(userId: bigint) {
  const cacheKey = `user:${userId}:roles_perms`;
  const cached = await this.cacheManager.get(cacheKey);
  if (cached) return cached;
  // user_roles → roles → role_permissions → permissions  (4 pog'onali JOIN)
  await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
}
```

**Sabab to'g'ri:** rol/ruxsat so'rovi 4 pog'onali JOIN (`auth.service.ts:366-377`)
va u har login'da kerak. Keshlash o'rinli.

### 6.3. ⚠️ Uchta oqibat

**1. Ko'p instance'da ruxsat keshi nomuvofiq bo'ladi.**

```
   Admin: "Aliyevdan students.write ni ol"
                    │
            ┌───────▼───────┐
            │ Load Balancer │
            └──┬─────────┬──┘
        ┌──────▼───┐ ┌───▼──────┐
        │ API #1   │ │ API #2   │
        │ del(...) │ │  KESH    │ ← #2 xabar topmadi
        │   ✅     │ │  ESKI    │
        └──────────┘ └──────────┘
                          │
          Aliyev #2 ga tushsa — 5 daqiqagacha
          students.write HALI HAM ishlaydi
```

`invalidateUserCache()` (`auth.service.ts:397-399`) `cacheManager.del()` chaqiradi
— **faqat o'z process'ida**. Redis bo'lsa kesh umumiy bo'lardi.

**Halol baho:** hozir bu **real bag emas** — tizim bitta instance'da, oyna
5 daqiqa. Lekin bu **gorizontal masshtablashning oldini oluvchi to'siq**.
`main.ts` da holat yo'q, API stateless **ko'rinadi** — lekin emas. Yashirin holat.

**2. `max: 100` — LRU siqib chiqarish.** 101-chi faol foydalanuvchi 1-chisini
keshdan siqadi. Bitta akademiyada yetarli bo'lishi mumkin, lekin ko'p tenant
rejasida chegara **jimgina** buziladi: kesh ishlamay qo'yadi, tizim sekinlashadi,
sababini hech kim bilmaydi.

**3. Auth locks — Redis'da emas, DB'da.**

```
auth.service.ts:187  prisma.auth_locks.findUnique({...})
auth.service.ts:269  prisma.auth_locks.upsert({...})
auth.service.ts:297  prisma.auth_locks.deleteMany({...})
```

Brute-force himoyasi **to'liq PostgreSQL'da**. Kanondagi "auth locks + Redis" —
**noto'g'ri**.

⚠️ **Lekin bu yomon dizayn emas.** DB'dagi lock: (a) instance'lar orasida
**to'g'ri ishlaydi** — Redis'siz ham lock global; (b) restart'dan omon qoladi;
(c) tranzaksion. Redis'da tezroq bo'lardi, lekin Redis o'chsa brute-force
himoyasi **yo'qolardi**. Hozirgi tanlov — sekinroq, **ishonchliroq**. Uni
o'zgartirish uchun sabab yo'q.

### 6.4. Qaror: Redis kerakmi?

**Hozir — yo'q.** Bitta instance, bitta akademiya. In-memory kesh yetarli va
ishlaydi.

| Signal | Nega Redis |
|---|---|
| **2-chi API instance ko'tariladi** | Kesh nomuvofiqligi **real bagga** aylanadi (6.3.1) |
| Faol xodim > 100 | `max: 100` chegarasi |
| Rate limiting | Hisoblagich instance'lar orasida umumiy bo'lishi shart |
| Background job (BullMQ) | Redis'siz ishlamaydi |

**Birinchi signal eng ehtimolli** va u arxitektura qarori: gorizontal
masshtashlash Redis'ni **majburiy** qiladi.

**Shu paytgacha — halol bo'l:**
1. `cache-manager-redis-store` ni `package.json` dan **o'chirish** yoki ishlatish.
   Ishlatilmaydigan dependency — yolg'on signal.
2. `.env.example:38-40` `REDIS_*` ni **o'chirish** yoki ulash. Hozir ular deploy
   qiluvchini chalg'itadi: Redis ko'taradi, ulaydi, **hech narsa ulanmaydi**.
3. Hujjatlarda (README, kanon) Redis "ishlatiladi" deb yozilmasin.

**Tamoyil: hujjat va kod ziddiyatda bo'lsa — kod haqiqat.** Hujjat tuzatiladi.

---

## 7. Modullararo bog'liqlik

### 7.1. O'lchov: aylanma bog'liqlik bormi

**Yo'q. Va sabab kutilganidan qiziqroq.** 28 ta `*.module.ts` tekshirildi:

| O'lchov | Natija |
|---|---|
| **Modullararo import (graf qirrasi)** | **0 ta** |
| `forwardRef(` | **0 ta** |
| Modul X servisiga modul Y'dan DI | **0 ta** |
| Servis `exports` qiluvchi modul | **19 ta** |
| O'sha export'larni **iste'mol qiluvchi** | **0 ta** |

```
   Kutilgan manzara:            Haqiqiy manzara:

   ┌──────┐                     ┌──────┐ ┌──────┐ ┌──────┐
   │ auth │◄────┐               │ auth │ │studen│ │billin│
   └──┬───┘  ┌──┴────┐          └──┬───┘ └──┬───┘ └──┬───┘
      ▼      │billing│             └────────┼────────┘
   ┌──────┐  └───┬───┘                      ▼
   │studen│◄─────┘                  ┌──────────────┐
   └──────┘                         │ PrismaService│
                                    └──────┬───────┘
   ...bog'langan graf                      ▼
                                    ┌──────────────┐
                                    │  PostgreSQL  │
                                    └──────────────┘
                              28 IZOLYATSIYA QILINGAN vertikal
                              bo'lak, yagona umumiy DB
```

Sikl **topilmadi** — lekin bu "yaxshi boshqarilgan graf" degani emas. Graf
**umuman yo'q**: 28 bog'lanmagan tugun. Sikl strukturaviy jihatdan **imkonsiz**,
chunki qirra yo'q.

### 7.2. Bu yaxshimi?

**Yuzaki — ha:** sikl yo'q, `forwardRef` yo'q (NestJS'da sikl belgisi), har
modulni alohida test qilish oson.

**Aslida — bu chegaraning yo'qligi, chegaraning tozaligi emas.**

19 modul servisini `exports` qiladi, **hech kim import qilmaydi** → **o'lik
interfeys**. "Kelajakda kerak bo'lar" deb yozilgan. Bu `tenant.util.ts` bilan
**bir xil naqsh: niyat bor, ulanish yo'q**.

**Haqiqiy bog'liqlik yo'qolmagan — u DB'ga ko'chgan:**

```
students.service.ts:1921  getStudentAttendance()  ──► prisma.attendance  (attendance)
students.service.ts:1955  getStudentPayments()    ──► prisma.invoices    (billing)
students.service.ts:1995  getStudentViolations()  ──► prisma.violations  (discipline)
students.service.ts:2025  getStudentAssessments() ──► prisma.assessments (assessments)

guardian-student.controller.ts:465  ['prisma'].violations   ──► discipline
guardian-student.controller.ts:558  ['prisma'].invoices     ──► billing
guardian-student.controller.ts:902  ['prisma'].timetable    ──► timetable
```

**`students` kamida 5 boshqa modulning jadvallarini o'qiydi.** Bu — haqiqiy
bog'liqlik. U shunchaki **modul grafida ko'rinmaydi**, chunki `imports: []`
orqali emas, umumiy `PrismaService` orqali o'tadi.

**Nega muhim:** `discipline` `violations` jadvaliga ustun qo'shsa yoki nomini
o'zgartirsa — `students` va `guardian-student.controller` **jimgina** buziladi.
Kompilyator ogohlantiradi (Prisma type-safe), lekin **egalik chegarasi yo'q**:
`discipline` o'z jadvalini o'zgartirishga haqli deb o'ylaydi, aslida uning
**3 ta tashqi o'quvchisi** bor va u buni bilmaydi.

**Diagnoz: modul chegarasi kod darajasida bor (papka, `*.module.ts`), ma'lumot
darajasida yo'q.**

⚠️ **Halol qo'shimcha:** bu qoidani **bugun** joriy qilish 845 ta tenant
nuqtasidan ham kattaroq ish. Va u **shoshilinch emas**: hozir bitta jamoa,
Prisma tiplari kompilyatsiya vaqtida himoya qiladi. Bu — **qayd etilgan qarz**,
favqulodda holat emas.

### 7.3. Yagona cross-modul fayl havolasi

```
guardian-student.controller.ts:27
  import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
```

Tip-only, runtime DI yo'q, modul qirrasi yaratmaydi. Zararsiz, lekin
`UpdateProfileDto` `auth` va `students` orasida umumiy — u `common/` da yoki
umumiy tip paketida bo'lishi mantiqiyroq.

---

## 8. Arxitektura qoidalarini majburlash

### 8.1. Muammo: hamma qoida — intizom

Yuqoridagi barcha topilmalarning **ildizi bitta**:

| Qoida | Hozir nima majburlaydi |
|---|---|
| Tenant filtri har so'rovda | **Hech narsa.** 845 qo'lda nuqta |
| Controller Prisma'ga kirmasin | **Hech narsa.** `['prisma']` — 4 marta buzilgan |
| Modul o'z jadvalini o'qisin | **Hech narsa.** `students` 5 modul jadvalini o'qiydi |
| `common/` util'i takrorlanmasin | **Hech narsa.** `toBigInt` — 2 nusxa |
| Har controller `@UseGuards` | **Hech narsa.** Bugun 36/36 — omad, kafolat emas |
| `tenant.util.ts` ishlatilsin | **Hech narsa.** 0 marta |

**Naqsh: har muammo — "yaxshi niyat, majburlovsiz".** Intizom bir kishilik
jamoada, 51 commit davomida **ushlab turildi** — buni tan olish kerak. Lekin
intizom **masshtablanmaydi**: yangi dasturchi, yangi Claude sessiyasi, yoki
charchagan payt — va qoida buziladi.

**Qoidani hujjatga yozish — uni majburlash emas.** Bu hujjat ham majburlay
olmaydi. Buni faqat **CI'da yiqiladigan tekshiruv** qila oladi.

### 8.2. Tavsiya: `dependency-cruiser`

Farzin'da (`chess/docs/02-architecture.md:148`) shu vosita ishlatiladi. U
NestJS'ni tushunmaydi — u **import grafini** tushunadi, va bu yetarli.

**Nega ESLint emas:** ESLint `import/no-restricted-paths` bir qismini qiladi,
lekin `dependency-cruiser` graf chiqaradi, sikl topadi va **o'lik kodni
(`orphan`) aniqlaydi** — bu bizning aynan uch muammomiz.

**Nega bu 4.3 dagi "avval test" qoidasiga zid emas:** `dependency-cruiser` kodni
**o'zgartirmaydi**, faqat o'lchaydi. Regressiya xavfi **nol**. Shuning uchun uni
**bugun**, testlardan **oldin** qo'shish mumkin — va u 1-bosqichni xavfsiz qiladi.

### 8.3. Qanday qoidalar

```js
// .dependency-cruiser.js  — taklif
module.exports = {
  forbidden: [
    // 1. SIKL — hozir 0 ta → darhol error
    { name: 'no-circular', severity: 'error',
      from: {}, to: { circular: true } },

    // 2. CONTROLLER PRISMA'GA KIRMASIN
    //    Buzilish: guardian-student.controller.ts:465,558,887,902
    { name: 'controller-no-prisma',
      severity: 'error',     // 1-bosqichdan keyin. Undan oldin: 'warn'
      comment: 'Controller faqat Service bilan gaplashadi. Qatlam qoidasi.',
      from: { path: '\\.controller\\.ts$' },
      to:   { path: '^src/prisma' } },

    // 3. common/ FEATURE MODULGA BOG'LANMASIN — hozir toza → darhol error
    { name: 'common-is-leaf', severity: 'error',
      comment: 'common/ poydevor. U modulni bilsa — sikl muqarrar.',
      from: { path: '^src/common' },
      to:   { path: '^src/modules' } },

    // 4. O'LIK KOD — tenant.util.ts shu yerda chiqadi
    { name: 'no-orphans',
      severity: 'warn',      // ⚠️ error QILINMASIN — 21 dead export bor
      from: { orphan: true, pathNot: '\\.(d\\.ts|spec\\.ts)$|^src/main\\.ts$' },
      to:   {} },

    // 5. MODUL O'Z JADVALINI O'QISIN
    // ⚠️ HOZIR YOQILMAYDI — 7.2: students 5 modul jadvalini o'qiydi.
    //    Yoqilsa CI darhol qizil va hech kim tuzata olmaydi.
    //    4-bosqichdan (4.4) keyin, modulma-modul yoqiladi.
    // { name: 'module-boundary', severity: 'error',
    //   from: { path: '^src/modules/([^/]+)/' },
    //   to:   { path: '^src/modules/(?!$1)([^/]+)/' } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,   // tip-only import ham ko'rinsin
  },
};
```

**Joriy qilish tartibi — muhim:**

```
1. Vositani qo'shish, HAMMA qoida 'warn' bilan
   → CI YASHIL qoladi, hech kim bloklanmaydi
   → Buzilishlar ro'yxati = qarzning o'lchangan rasmi

2. Bugun toza qoidalarni DARHOL 'error':
   · no-circular    (0 buzilish)
   · common-is-leaf (0 buzilish)
   → Regressiyani BUGUNDAN to'xtatadi. Eng arzon g'alaba.

3. Buzilishi borlar 'warn' qoladi:
   · controller-no-prisma (4 ta) → 1-bosqichdan keyin 'error'
   · no-orphans (tenant.util.ts + 21 dead export)

4. module-boundary — kommentda. 4-bosqichgacha yoqilmaydi.
```

**Tamoyil: qoida — faqat u yashil bo'lgandan keyin `error`.** Qizil CI bilan
yashash CI'ni o'chirish bilan teng: odamlar uni e'tiborsiz qoldirishga o'rganadi.

⚠️ **Va eng muhimi: CI umuman yo'q** (`.github/` yo'q). `dependency-cruiser`
lokal ishlaydi, lekin **majburlash** uchun CI kerak. → `08-ci-cd.md`. Bu hujjat
faqat **qoidani** belgilaydi.

---

## 9. Kelajak: modul → chegara

### 9.1. Bugun ajratish kerak emas

Kanon vizyoni — bitta akademiyadan ko'p akademiyaga. **Bu mikroservis talab
qilmaydi.** Ko'p tenant ≠ ko'p servis. 100 akademiya ham bitta monolitda, bitta
DB'da, `tenant_id` bilan ishlaydi.

**Mikroservis jamoa o'sganda kerak bo'ladi, mijoz emas.**

### 9.2. Ajratishdan oldin qilinadigan ish

```
   HOZIR                 KERAK                  KEYIN (ehtimol hech qachon)

  ┌────────────┐       ┌────────────┐          ┌──────┐   ┌──────┐
  │ 28 modul   │       │ 28 modul   │          │ svc A│   │ svc B│
  │ chegara    │ ────► │ chegara    │ ────►    └──┬───┘   └──┬───┘
  │ YO'Q       │       │ MAJBURLANGAN│            ▼          ▼
  │ umumiy DB  │       │ umumiy DB  │          ┌────┐    ┌────┐
  └────────────┘       └────────────┘          │ DB │    │ DB │
                                               └────┘    └────┘
  students 5 modul     har modul o'z           tarmoq, saga,
  jadvalini o'qiydi    jadvalini o'qiydi       distributed tranzaksiya
                       (dep-cruiser majburlaydi)
```

**Ikkinchi qadamsiz uchinchisi imkonsiz.** Chegarasi yo'q monolitni ajratish —
**distributed monolit** yasash: mikroservisning barcha narxi, monolitning barcha
cheklovi. Eng yomon natija.

**Ya'ni 8-bo'lim (majburlash) — 9-bo'limning shartidir.** Ular alohida ish emas,
bitta yo'lning ikki bosqichi.

### 9.3. Qachon bo'lish kerak bo'ladi — signal jadvali

Har qadam **o'lchovga** asoslanadi, taxminga emas:

| # | Signal (o'lchanadigan) | Chora |
|---|---|---|
| 1 | — | **Hozirgi holat:** 1 instance, 1 DB, in-memory kesh |
| 2 | 2-instance kerak (CPU / uptime) | ⚠️ **Redis majburiy** (6.3.1) + `max: 100` qayta ko'riladi |
| 3 | Pool kutish vaqti o'sdi | `PrismaPg` pool sozlash → keyin PgBouncer |
| 4 | Hisobot OLTP'ni sekinlashtirdi | Read replica — `getStatistics`, `getRegistrationTrend` unga |
| 5 | Fayl yuklash disk to'ldirdi | ⚠️ `main.ts:57-66` — fayllar **lokal diskda**. Ko'p instance'da **darhol buziladi**: #1 ga yuklangan fayl #2 da yo'q → S3-mos storage. **Bu 2-bosqichning yashirin sherigi** |
| 6 | `audit_logs` juda katta | Vaqt bo'yicha partitioning |
| 7 | Bitta DB yetmayapti | Modul bo'yicha DB ajratish → mikroservis |

⚠️ **5-qator alohida e'tibor talab qiladi.** "2-instance ko'taramiz" qarori
**uchta narsani bir vaqtda buzadi**: ruxsat keshi (6.3.1), yuklangan fayllar
(`main.ts:57`), va **hech biri oldindan ko'rinmaydi**. Gorizontal masshtablash —
bitta konfiguratsiya o'zgarishi emas, **loyiha**.

**7-bosqichga yetish ehtimoli past.** Kanon halol tan oladi: bozor hajmi noma'lum.
Bu ro'yxat — "kerak bo'lsa yo'l bor" degani, "shu yo'ldan yuramiz" degani emas.

### 9.4. Birinchi ajratish nomzodlari — agar sodir bo'lsa

| Nomzod | Nega | Nega yo'q |
|---|---|---|
| `files` | Boshqa yuklama profili (I/O), boshqa storage | Kichik modul — ajratish narxi foydadan katta |
| `notifications` | Tashqi API (SMS), sekin, retry kerak | **Avval BullMQ worker** — arzonroq va yetarli bo'lishi mumkin |
| `displays` | 1136 qator, ekranlar ko'p so'rov qiladi, read-only | Read replica + kesh **yetarli** bo'lishi ehtimoli yuqori |

**Uchalasi uchun ham to'g'ri javob — hozircha "yo'q".** Bu jadval qaror emas,
**kerak bo'lganda qaraladigan ro'yxat**.

---

## 10. Ochiq savollar

1. **Cross-domain o'qish qanday rasmiylashtiriladi?** (4.4-bosqich 4, 7.2)
   `students.service.ts:1921-2079` to'rt modulning jadvalini o'qiydi.
   (a) Har modul "student kesimi" metodini e'lon qilsin → to'g'ri chegara, lekin
   4 yangi bog'liqlik va **sikl xavfi** (`attendance` ham `students` haqida
   bilishi mumkin); (b) alohida `student-profile` aggregator → sikl yo'q, lekin
   **29-modul**, kanon esa "yangi modul qo'shma" deydi.
   ⚠️ **Qaror qabul qilinmagan. Kanon cheklovi (b) ni bloklaydi — muhokama kerak.**

2. **`PrismaPg` pool `max` qancha?** (5.3) Hozir standart `10`,
   `connectionTimeoutMillis: 0` — cheksiz kutish. **Yuklama testisiz javob yo'q.**
   Taxminiy raqam yozilmaydi. → `09-observability.md`

3. **Gorizontal masshtablash qachon kerak?** (6.4, 9.3) Javob uchun **hozirgi
   yuklama o'lchanmagan**: RPS, p95 latency, bir vaqtdagi faol xodim — hech biri
   ma'lum emas, metrics yo'q. **Birinchi ish — o'lchashni yoqish, qaror emas.**

4. **`resetGuardianPassword` va `guardianMe` `auth` ga ko'chiriladimi?**
   (4.4-bosqich 3) API yo'lini o'zgartiradi (`/staff/students/...` → `/auth/...`)
   va 48 sahifadan qaysidir buziladi. → `04-api-spec.md`

5. **`.env.example` dagi `REDIS_*` va `cache-manager-redis-store` o'chiriladimi?**
   (6.4) Ular hech narsaga ulanmagan. O'chirish — halol. Qoldirish — "Redis
   rejada" degan signal. **Qaysi biri rost?**

6. **`forbidNonWhitelisted: false` (`main.ts:118`) to'g'rimi?** (2.2) Noma'lum
   maydon jim tashlanadi, mijoz xato yuborsa bilmaydi. Kechirimlilik vs aniqlik.
   → `04-api-spec.md`

7. **Audit tranzaksiya ichida bo'lishi kerakmi?** (3.5) Hozir tashqarida va xatosi
   yutiladi (`audit.util.ts:63`) → **audit izsiz o'zgarish mumkin**. Auditning
   maqsadi shu bo'lsa — qabul qilib bo'lmas. Narxi: audit yiqilsa asosiy
   operatsiya ham yiqiladi. → `10-security.md`

8. **`AuditLogger` DI provider bo'lishi kerakmi?** (3.5) Hozir 26 servisda
   `new AuditLogger(prisma)`, test qilib bo'lmaydi. 1-bosqichga qo'shiladigan
   arzon tuzatishmi yoki alohida ishmi?

9. **CI qayerda ishlaydi?** (8.3) `dependency-cruiser` CI'siz — lokal skript.
   `.github/` yo'q. **Bu hujjatning butun 8-bo'limi CI mavjudligiga bog'liq.**
   → `08-ci-cd.md`

---

## Ilova A — o'lchangan faktlar (2026-07-15)

| O'lchov | Qiymat | Manba |
|---|---|---|
| Feature modul | 28 | `src/modules/` |
| Controller | 36 | `modules/*/*.controller.ts` |
| `@UseGuards` yo'q controller | **0** | har fayl tekshirildi |
| Global guard (`APP_GUARD`/`useGlobalGuards`) | **yo'q** | `main.ts`, `app.module.ts` |
| Modullararo import qirrasi | **0** | 28 ta `*.module.ts` |
| `forwardRef(` | **0** | `src/modules/` |
| Servis `exports` qiluvchi modul | 19 | `exports: [...]` |
| O'sha export'larni iste'mol qiluvchi | **0** | qirra yo'q |
| `['prisma']` bracket kirish | **4** | `guardian-student.controller.ts:465,558,887,902` |
| `findFirst(` | 271 | `src/modules/` |
| `findMany(` | 131 | `src/modules/` |
| `findUnique(` | 65 | `src/modules/` |
| `tenant_id` servislarda | 932 | `modules/*/*.service.ts` |
| `tenant.util.ts` ishlatilishi | **0** | faqat faylning o'zi |
| Redis import (`redisStore`/`ioredis`) | **0** | `src/` |
| `REDIS_*` env o'qilishi | **0** | faqat `.env.example:38-40` |
| `CacheModule` | 1 | `auth.module.ts:11` (in-memory) |
| Migratsiya | 2 | `prisma/migrations/` |

> ⚠️ **Raqamlar haqida halol izoh.** Kanon 5.1 da tenant nuqtalari **176**
> (121 `findMany` + 55 `findUnique`, `*.service.ts` bo'yicha). **Bu raqam kam
> sanaydi:** u `findFirst` ni — eng katta toifani, 272 ta — umuman hisobga
> olmagan. Butun `src/` bo'yicha barcha Prisma chaqiruvlari — **845**.
> Aniq tenant auditi — `03-multi-tenancy.md` ning ishi.
