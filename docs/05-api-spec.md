# 05 — API spetsifikatsiyasi

> **Hujjat maqomi:** Loyiha · **Oxirgi yangilanish:** 2026-07-15
> **Haqiqat manbai:** `apps/api/src` — ishlab turgan kod. Bu hujjat **o'lchangan holatni**
> qayd etadi va **maqsadli holatni** belgilaydi. Ikkisi farq qilganda — farq ochiq aytiladi.
> Kanon: [`CANON.md`](./CANON.md)

⚠️ Bu **ishlab turgan tizim** — real xodimlar va ota-onalar har kuni ishlatadi. Quyidagi
har bir taklif **migratsiya yo'li** bilan keladi. "Hammasini qayta yozamiz" degan taklif yo'q.

---

## 1. Hozirgi API — audit

### 1.1. Global prefix — bor

`apps/api/src/main.ts:54,68`:

```ts
const globalPrefix = 'api';
app.setGlobalPrefix(globalPrefix);
```

Har route `/api/...` ostida. Swagger — `/api/docs` (`main.ts:137`).

### 1.2. Versiyalash — ⚠️ YO'Q

**Tekshirildi:** `app.enableVersioning()` `main.ts` da **yo'q**. `@Version()` dekoratori
butun `src` bo'ylab **ishlatilmagan**. Hech qanday versiyalash strategiyasi yoqilmagan.

Bugungi manzillar: `POST /api/auth/staff/login`, `GET /api/staff/students`. `/api/v1/` yo'q.

**Nega bu muammo.** Hozir API'ning yagona mijozi — `apps/web`, u API bilan **bir vaqtda**
deploy qilinadi. Shuning uchun buzuvchi o'zgarish arzon: ikkalasini birga o'zgartirasan.

Mobil ilova chiqqan kunda bu tugaydi. Sabab **texnik emas, tashkiliy**:

| | Web | Mobil |
|---|---|---|
| Yangilanish | Refresh — bir zumda | Store ko'rigi: 1-7 kun |
| Eski versiya yashaydimi | Yo'q | **Ha.** Foydalanuvchi yangilamasa — yillab |
| Deploy nazorati | Bizda | **Foydalanuvchida** |

Server'da maydonni o'chirsak, yangilamagan ilova **ishdan chiqadi** — va uni orqaga
qaytarib bo'lmaydi, chunki u allaqachon telefonda. Versiyalash — "toza arxitektura"
masalasi emas, **eski mijozni tirik qoldirish** mexanizmi. Batafsil: [§10](#10-kelajak-api-versiyalash-strategiyasi).

### 1.3. ⚠️ Versiyalash oldidagi mina — refresh cookie `path`

`modules/auth/auth.service.ts:114-119`:

```ts
res.cookie(this.cookieName(), token, {
  httpOnly: true,
  ...this.cookieOptions(),
  path: '/api/auth/refresh',     // ⚠️ hardkod, prefiksga bog'liq
  expires: expiresAt,
});
```

Ertaga prefiks `/api/v1` bo'lsa, refresh endpoint `/api/v1/auth/refresh` bo'ladi.
Brauzer cookie'ni **`/api/auth/refresh` uchun** saqlagan → yangi manzilga **yubormaydi**
→ `NO_REFRESH_TOKEN` → **hamma foydalanuvchi bir vaqtda tizimdan chiqadi**.

Va bu deploy paytida darrov ko'rinmaydi: access token **15 daqiqa** yashaydi
(`render.yaml:21`). Muammo **keyinroq** boshlanadi — birinchi refresh urinishida.
Deploy "muvaffaqiyatli" ko'rinadi, keyin qulaydi.

**Xulosa:** versiyalashdan **oldin** cookie `path` konfiguratsiyadan olinishi kerak —
§10.3 dagi rejaning **birinchi qadami**.

### 1.4. Miqyos — o'lchangan

| Controller **fayl** | 37 (kanon) |
|---|---|
| `@Controller()` **klass** | **52** |
| Modul | 28 · DTO 128 · `@Post` 84 · `@Delete` 32 |

⚠️ **37 va 52 ziddiyat emas.** Kanon fayllarni sanaydi; bir fayl ikki klass tutishi
mumkin. `assessments.controller.ts` — `AssessmentsController` (`:42`, `staff/assessments`)
va `GuardianGradesController` (`:245`, `guardian/grades`). Bu naqsh 15 faylda. Bu **yomon
emas** — staff va guardian yuzasi bitta modulda turgani mantiqiy.

---

## 2. Konvensiyalar

### 2.1. Resurs nomlash — hozirgi holat

| Guruh | Soni | Misol |
|---|---|---|
| `staff/*` | 28 | `staff/students`, `staff/assessments` |
| `guardian/*` | 18 | `guardian/grades`, `guardian/billing` |
| Boshqa | 6 | `auth`, `system/tenants`, `rbac/{roles,permissions,users}`, root |

**Bu bo'linish — kuchli tomon.** Ko'p tizimda staff va guardian bitta endpointni
bo'lishadi va ruxsat mantiqi ichkarida chalkashadi. Bu yerda ular **fizik ajratilgan**:
boshqa controller, boshqa guard, boshqa javob. Ota-ona xodim endpointiga **manzil
darajasida** yeta olmaydi. Buni buzmang.

### 2.2. ⚠️ Nomlashdagi izchilsizlik — halol ro'yxat

**a) Guardian tomonda birlik, staff tomonda ko'plik:**

| Guardian | Staff twin |
|---|---|
| `guardian/timetable` (`timetable.controller.ts:195`) | `staff/timetables` (`:38`) |
| `guardian/dorm` (`guardian-dorm.controller.ts:21`) | `staff/dorms` (`:33`) |
| `guardian/student` (`guardian-student.controller.ts:32`) | `staff/students` (`:43`) |
| `guardian/outcome` (`certificates.controller.ts:235`) | `staff/outcomes` (`:141`) |

Mantiq tushunarli — ota-onada **bitta** farzand. Lekin bu qoida emas, **tuyg'u**, va u
buziladi: `guardian/grades`, `guardian/leaves`, `guardian/awards` — ko'plikda, garchi
ular ham bitta o'quvchiga tegishli.

**b) Bir entity, ikki nom:** `staff/assessments` va `guardian/grades` — **bitta**
`assessments` jadvali, **bitta** `AssessmentsService`, ikki resurs nomi.

**c) Nesting izchilsiz — bir modul ichida:**

```ts
@Controller('staff/dorms/:dormId/rooms')                    // dorm-rooms.controller.ts:33
@Controller('staff/dorms/rooms/:roomId/assignments')        // dorm-assignments.controller.ts:31 — :dormId yo'qoldi
```

**d) `kebab-case`** — ✅ **to'liq bajarilgan.** Yagona ko'p so'zli segment
`staff/academic-years` va u to'g'ri.

**Tavsiya:** yuqoridagilarni **tuzatmang** — ular ishlaydi va 48 sahifa ularga bog'langan.
Faqat **yangi** endpoint uchun qoida yozing (§2.3), eski nomlar v2 da tekislanadi.

### 2.3. Yangi endpoint uchun qoida

- Ko'plik, `kebab-case`: `/api/v1/student-tracks`
- Ichma-ichlik **maks. 2 daraja**. Chuqurroq kerak bo'lsa — filter: `/api/v1/dorm-rooms?dormId=...`
- Bitta entity — bitta resurs nomi. Auditoriya `staff/`/`guardian/` prefiksi bilan
  ajratiladi, **resurs nomini o'zgartirish bilan emas**

### 2.4. HTTP metodlari

| Metod | Ma'no | Idempotent |
|---|---|---|
| `GET` | O'qish. **Hech qachon holat o'zgartirmaydi** | Ha |
| `POST` | Yaratish yoki harakat | Yo'q (`Idempotency-Key` bilan — ha, §11) |
| `PATCH` | Qisman yangilash | Yo'q |
| `PUT` | To'liq almashtirish | Ha |
| `DELETE` | O'chirish / arxivlash | Ha |

Mavjud kod bunga asosan amal qiladi. `PUT` kam — `auth.controller.ts:355,610`.

### 2.5. ⚠️ HTTP status kodlari — izchil EMAS

`@HttpCode` butun kod bazasida **atigi 6 marta** — 32 `DELETE` va 84 `POST` ga qarshi.

| fayl:qator | kod | route |
|---|---|---|
| `students/students.controller.ts:408` | `HttpStatus.NO_CONTENT` | `DELETE :id` |
| `auth/auth.controller.ts:450` | `204` | `DELETE sessions/:sessionId` |
| `auth/auth.controller.ts:489` | `200` | `DELETE sessions` |
| `cohorts/cohorts.controller.ts:136` | `200` | `DELETE :id/students/:studentId` |
| `auth/auth.controller.ts:154,186` | `200` | `POST refresh`, `POST logout` |

**Natijada:**

- **32 `DELETE` dan atigi 2 tasi 204.** Qolgan 30 tasi NestJS default'i bo'yicha **200**
  + `{ ok: true }` (`campuses.controller.ts:101`, `subjects.controller.ts:101`, `rbac/roles.controller.ts:103`)
- **`auth.controller.ts` o'zi bilan ziddiyatda:** `DELETE sessions/:id` → 204 (`:450`),
  `DELETE sessions` → 200 (`:489`)
- **`students` va `cohorts` teskari qaror qabul qilgan** bir xil shakldagi DELETE uchun:
  `:408` → 204, `:136` → 200
- **84 `POST` dan 82 tasi 201** — shu jumladan hech narsa **yaratmaydigan**lar:
  `POST staff/assessments/:id/scores` (upsert), `POST staff/students/:id/group` (tayinlash).
  Ular 200 bo'lishi kerak edi
- **Swagger runtime bilan mos emas:** `academic-years.controller.ts` da 10 ta
  `@ApiOkResponse` va bitta ham `@ApiCreatedResponse` yo'q — lekin POST'lar **201**
  qaytaradi. **Hujjat 200 deydi, server 201 beradi.** `@ApiNoContentResponse` butun
  kod bazasida **bitta** (`auth.controller.ts:455`)

### 2.6. Status kodlari — maqsadli jadval

| Kod | Qachon |
|---|---|
| 200 | OK — o'qish, yangilash, harakat |
| 201 | **Faqat** yangi resurs yaratildi (+ `Location`) |
| 204 | O'chirildi / arxivlandi, body yo'q |
| 400 | Validatsiya xatosi (sintaksis) |
| 401 | Autentifikatsiya yo'q yoki yaroqsiz |
| 403 | Autentifikatsiya bor, ruxsat yo'q |
| 404 | Topilmadi **yoki ko'rish huquqi yo'q** |
| 409 | Konflikt (unique buzildi) |
| 422 | Domen qoidasi buzildi (sintaksis to'g'ri, mantiq noto'g'ri) |
| 429 | Rate limit (§9 — hozir **hech qachon qaytmaydi**) |
| 500 | Ichki xato |

**400 va 422 farqi:** 400 — "`maxScore` son emas". 422 — "son to'g'ri, lekin
`BLOCK_TEST` uchun 93 dan oshmasligi kerak" (kanon §4.1).

**403 va 404 — multi-tenant tizimda bu xavfsizlik masalasi.** A tenanti B ning
o'quvchisini so'rasa → **404**. 403 "bu ID mavjud, lekin sizniki emas" deb **boshqa
maktabning ma'lumoti borligini tasdiqlaydi** — hujumchi ID sinab, raqobatchida nechta
o'quvchi borligini sanaydi. Hozirgi kod bunga tabiiy amal qiladi (`findFirst` +
`tenant_id` → topilmasa `NOT_FOUND`), lekin bu **tasodifiy to'g'ri** — qoida yozilmagan.

### 2.7. ⚠️ Javob konverti — 4 xil shakl

API'ning eng ko'rinadigan izchilsizligi.

**A. `{ data, meta{page,limit,total,totalPages,hasNext,hasPrev} }`** — eng keng tarqalgan.
`assessments.service.ts:247-283`:

```ts
return {
  data: items.map((item) => ({ id: item.id.toString(), ... })),
  meta: {
    page, limit, total,
    totalPages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  },
};
```

Shu shakl: `announcements:157`, `campuses:136`, `certificates:347`, `cohorts:125`,
`discipline:254`, `displays:159`, `events:207`, `files:256`, `ranking:350`, `billing:864`.

**B. `{ data, meta{limit,offset,total,hasMore} }`** — `students.service.ts:188-249`:
`meta: { limit, offset, total, hasMore: offset + limit < total }`. `hasNext` emas —
**`hasMore`**; `totalPages` yo'q.

**C. `{ data, meta{page,limit,total,totalPages} }`** — `hasNext`/`hasPrev` **yo'q**:
`attendance.service.ts:282`, `users.service.ts:189`, `dorms.service.ts:136`.
⚠️ **`assessments.service.ts` o'zi ichida ziddiyatda:** `:275` A shaklini, `:746` — C
shaklini qaytaradi. Bitta fayl, ikki shakl.

**D. `meta` umuman yo'q** — `groups.service.ts:135-139`: `{ total, limit, offset, data }`.

**Va yana:** `ranking.service.ts:382` `data` emas, **`rows`** qaytaradi.
`academic-years.service.ts:84` — `{ ok: true, data }`, kod bazasida yagona.

**Mutatsiya javoblari ham izchilsiz.** `{ ok: true }` ~60 marta, har biri o'zicha kalit qo'shadi:

```ts
discipline.service.ts:486   return { ok: true, id: violation_id.toString() };
groups.service.ts:713       return { ok: true, createdGroupId: String(created.id) };
groups.service.ts:511       return { ok: true, groupId, subjectIds };
timetable.service.ts:734    return { ok: true, count: lessonsData.length };
```

Yangi yaratilgan resurs ID'si **uch xil nom** oladi: `id`, `createdGroupId`, `groupId`.

⚠️ **Eng jiddiy:** `ok: false` **200 status bilan** — `auth.service.ts:775,1535`,
`guardian-files.controller.ts:93`. Ya'ni **xatolik HTTP status'da emas, body ichida**.
Mijoz `res.ok` ni tekshirsa — o'tib ketadi.

**Maqsadli shakl.** Ro'yxat:

```json
{
  "data": [ { "id": "1", "fullName": "Aliyev Ali" } ],
  "meta": { "limit": 50, "offset": 0, "total": 341, "hasMore": true }
}
```

Bitta resurs — konvertsiz: `{ "id": "1", "fullName": "Aliyev Ali", "status": "ACTIVE" }`

`{ ok: true }` **yangi kodda ishlatilmaydi**: HTTP status allaqachon muvaffaqiyatni
bildiradi. 200 + `{ ok: true }` — takror. 200 + `{ ok: false }` — **yolg'on**.

**Migratsiya:** eski endpointlar `{ ok: true }` ni qaytaraverishi mumkin. Qoida faqat
**yangi** endpointga va v2 ga tegishli. Umumiy `PaginatedResult<T>` tipi `common/types/`
ga qo'shilsin — shunda shakl **tip darajasida** majburlanadi, intizom bilan emas.

---

## 3. ⚠️ BigInt va JSON — API kontraktining eng muhim detali

### 3.1. Muammo

Kanon §5.2: ID'lar `BigInt` — JS `number` 2⁵³ dan katta butun sonni yo'qotadi.

Lekin **JSON spetsifikatsiyasida BigInt yo'q**:

```js
JSON.stringify({ id: 1n })
// TypeError: Do not know how to serialize a BigInt
```

Bu `undefined` qaytarmaydi — **exception tashlaydi**. NestJS'da bu javob serializatsiyasi
paytida, ya'ni **exception filter ishlagandan keyin** — natija `500`, va stack ham
tushunarsiz, chunki xato controller'da emas, Express'ning `res.json()` ichida.

Ya'ni **patch bo'lmasa, ID qaytaradigan har bir endpoint 500 beradi.** "Ba'zan" emas — **har doim**.

### 3.2. Yechim — bor va to'g'ri joyda

`main.ts:11-21`:

```ts
declare global {
  var __bigint_json_patch_applied__: boolean | undefined;
}

function patchBigIntJson() {
  if (global.__bigint_json_patch_applied__) return;
  global.__bigint_json_patch_applied__ = true;
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}
```

Chaqiruv — `bootstrap()` ning **birinchi qatori** (`main.ts:51`), `NestFactory.create()`
dan **oldin** (`:53`). Tartib muhim: patch keyin qo'yilsa, boshlanishda ishlagan kod
patchsiz `JSON.stringify` chaqirishi mumkin. Hozirgi tartib **to'g'ri**.

`JSON.stringify` `toJSON()` ni avtomatik chaqiradi — standart xatti-harakat (`Date` ham
shunday). Guard — HMR/testda ikki marta patch qo'yilmasligi uchun.

### 3.3. Javob: ID **string** sifatida seriyalanadi

```json
{ "id": "1", "tenantId": "1", "studentAccountId": "456" }
```

`1` emas, `"1"`. Bu **kontrakt**. Va u ikki qatlamda kafolatlangan:

1. **Qo'lda** — har servis `.toString()` chaqiradi (`students.service.ts:190`,
   `assessments.service.ts:249`)
2. **Global patch** — kimdir `.toString()` ni **unutsa**, patch baribir string qaytaradi

Ikkinchisi — **himoya to'ri**. 128 DTO va 32 servisda unutish muqarrar; patchsiz har
unutish → 500.

⚠️ Lekin bu shuni ham anglatadi: **`.toString()` ni unutish sezilmaydi.** Test yo'q
(kanon §3), 500 ham yo'q → unutilgan joy topilmaydi. Bu qabul qilinadi, chunki natija
baribir to'g'ri.

### 3.4. Kirish tomonda — 4 xil validator

ID'ni **qabul qilish** tomonida to'rt mexanizm bor:

1. `common/pipes/parse-bigint.pipe.ts` — route param uchun (`ParseBigIntPipe`)
2. `common/utils/bigint.util.ts` — `parseBigIntId(v, field)`
3. `common/validators/is-bigint-string.decorator.ts` — DTO uchun (`IsBigIntString`)
4. DTO ichida inline `@Matches(/^\d+$/)` — `assessments/dto/upsert-scores.dto.ts:25`

⚠️ **Ular bir xil ishlamaydi:**

| | `"0"` qabul qiladimi | Xato xabari |
|---|---|---|
| `ParseBigIntPipe` | ✅ **Ha** | `'ID must be a number string'` — odam uchun |
| `parseBigIntId` | ❌ Yo'q | `INVALID_ID` — mashina uchun |
| `IsBigIntString` | ❌ Yo'q | **yo'q** (`defaultMessage` yozilmagan) |
| inline `@Matches` | ✅ **Ha** | `'studentId must be numeric string'` |

Va `common/decorators/param-bigint.decorator.ts`:

```ts
export const ParamBigInt = (name = 'id') => Param(name, new ParseBigIntPipe());
```

⚠️ Controller'lar uni **ishlatmaydi** — hamma joyda to'liq shakl
`@Param('id', ParseBigIntPipe) id: bigint` (`students.controller.ts:105`,
`assessments.controller.ts:126`, `auth.controller.ts:480`). Ya'ni `ParamBigInt` —
**o'lik kod**, `tenant.util.ts` bilan bir xil taqdir (kanon §5.1).

**Tavsiya:** bittasini tanlang. `parseBigIntId` semantikasi to'g'ri — `ParseBigIntPipe`
shunga keltirilsin, `ParamBigInt` ishlatilsin yoki o'chirilsin. Xavfsiz o'zgarish:
`"0"` hech qachon haqiqiy ID emas (`autoincrement()` 1 dan boshlanadi).

### 3.5. ⚠️ OpenAPI ID'ni string deb aytmaydi

**Tekshirildi:** 109 faylda 569 ta `@ApiProperty` bor. Ulardan **birontasi ham** ID uchun
`type: 'string'` yoki `type: 'number'` ni ochiq yozmaydi.

Kirish DTO'larida tip TS'dan chiqariladi (`studentId?: string` → Swagger `string`) — bu
ishlaydi. Konvensiya — `example` + `pattern` + `@Matches`
(`assessments/dto/upsert-scores.dto.ts:19-26`):

```ts
@ApiProperty({ example: '123', description: 'students.id (numeric string)', pattern: '^\\d+$' })
@IsString()
@Matches(/^\d+$/, { message: 'studentId must be numeric string' })
studentId!: string;
```

Izchil emas: `displays/dto/display-list.query.dto.ts:16-23` — `pattern` yo'q.
`users/dto/list-users.query.dto.ts:28-31` — `pattern` ham, `@Matches` ham yo'q →
`roleId` ixtiyoriy satr qabul qiladi.

⚠️ **Javob tomonda umuman hujjat yo'q.** `modules/*/dto/` dagi **hamma** DTO —
request/query DTO. **Response DTO klassi yo'q.** ID string ekani inline `schema` yozilgan
**9 joyda** ko'rinadi (`auth.controller.ts:69,84,131,132,223,225,421`,
`academic-years.controller.ts:74`, `files.controller.ts:138`): `id: { type: 'string', example: '1' }`.
Qolgan ~49 controller uchun javob **OpenAPI'da tasvirlanmagan**.

**Nega bu muhim:** mobil ilova tiplari OpenAPI'dan generatsiya qilinadi. Javob sxemasi
yo'q → tip yo'q → dasturchi qo'lda `id: number` deb yozadi (mantiqan!) → `"1"` kelganda
parse xatosi yoki jimgina noto'g'ri xatti-harakat.

**Tavsiya:** eng ko'p ishlatiladigan 5 modul uchun response DTO yozing (`students`,
`assessments`, `attendance`, `billing`, `auth`) → `@ApiOkResponse({ type: ... })` → CI'da
OpenAPI diff. Hammasi uchun bir kunda emas. Response DTO **kodni o'zgartirmaydi** —
faqat hujjat qo'shadi, shuning uchun xavfsiz.

### 3.6. Nima uchun `string`, `number` emas

```js
Number(9223372036854775807)  // 9223372036854776000  ⚠️ boshqa son
```

Bugun ID'lar kichik va `number` **ishlaydi**. Muammo `id > 2^53` bo'lgan kunda — ya'ni
`autoincrement()` uchun **hech qachon emas**. Lekin kelajakda snowflake ID yoki tenant
bo'yicha diapazon kerak bo'lsa — `string` allaqachon tayyor, va bu **buzuvchi emas**,
chunki mijoz ID'ni **opaque** deb qaraydi.

**Qoida:** ID — **opaque satr**. Mijoz uni solishtiradi (`===`), yuboradi, saqlaydi.
**Hech qachon** arifmetika qilmaydi, tartiblamaydi, `Number()` ga o'girmaydi.

---

## 4. Pagination

### 4.1. Hozirgi holat — ⚠️ ikki xil format

| Uslub | Fayl soni | Holat |
|---|---|---|
| `page` + `limit` | **29 fayl / 31 klass** | Ustunlik qiladi |
| `limit` + `offset` | **5 fayl** | Ozchilik |
| `cursor` | **0** | `cursor` so'zi butun `src` da yo'q |

**`limit`/`offset` ishlatadigan 5 fayl:**

```
students/dto/student-list.query.ts:136,143              limit = 50, offset = 0
groups/dto/group-list.query.ts:70,77                    default YO'Q
students/dto/guardian-grades.query.dto.ts:63,70         offset = 0, limit = 20
notifications/dto/list-notifications.query.dto.ts:43,49 ⚠️ tipi `string`!
notifications/dto/list-templates.query.dto.ts:26,32     ⚠️ tipi `string`!
```

⚠️ `notifications` DTO'larida `limit?: string` — son emas, **satr**. Boshqa hamma joyda
`@Type(() => Number)` + `@IsInt()`. Bu ikki fayl konvensiyadan chiqib ketgan.

⚠️ **Eng ko'p ishlatiladigan modul — `students` — ozchilikda.** U API'ning eng katta
servisi (2079 qator, kanon §3) va `limit`/`offset` ishlatadi, qolgan 29 fayl — `page`/`limit`.
Mijoz `students` uchun bir xil, `assessments` uchun boshqa xil kod yozadi.

**`billing` o'zi ichida bo'lingan:** `billing.service.ts:235 listMealWeeks(...limit = 20,
offset = 0)` va `:767 listInvoices(...)` — `page` DTO qabul qiladi.

**Default `limit` ham izchil emas:** 20 (ko'pchilik), 50 (`students:136`,
`assessments:143`, `attendance:79`), yoki **umuman yo'q** (`groups`, `academic-years`).

`@Max(1000)` ko'p DTO'da bor — `limit=999999` bilan DoS qilib bo'lmaydi. Lekin `groups`
va `academic-years` da `@Max` **yo'q** — tekshirilsin.

### 4.2. Offset pagination nega sekinlashadi

Ikkalasi ham (`page`/`limit` va `limit`/`offset`) — **bitta narsa**: `page` faqat
`offset = (page-1) * limit` ning boshqacha yozuvi. Ikkalasida ham bir xil ikki muammo:

**1. Sekin.** `OFFSET 100000` — PostgreSQL 100 000 qatorni **o'qiydi va tashlaydi**.
Index qutqarmaydi: `OFFSET` index'dan **keyin** qo'llanadi.

**2. Siljish (drift).** Ro'yxat o'qilayotganda yangi qator qo'shilsa:

```
t=0:  1-sahifa  → [A, B, C]     (yangi X qo'shildi, tartib DESC created_at)
t=1:  2-sahifa  → [C, D, E]     ⚠️ C ikki marta ko'rindi
```

`students` uchun `sortBy: 'created_at'`, `sortDir: 'desc'` default — ya'ni **yangi
o'quvchi qo'shilishi ro'yxatni suradi**. Real ssenariy: qabul mavsumida sekretar
o'quvchi qo'shayotganda direktor ro'yxatni ko'radi.

### 4.3. Halol baho — hozir bu muammomi?

**Yo'q, hozircha emas.** Bitta akademiyada o'quvchi soni **yuzlarda**. `OFFSET 200` —
PostgreSQL uchun sezilmaydi.

⚠️ Aniq raqam **o'lchov bilan aniqlanadi** — eng katta tenant'da nechta o'quvchi bor va
`students.list` p95 latency qancha? O'lchanmagan (kanon §6: observability yo'q).

**Qachon muammo bo'ladi:**
- `tenant_id` filtri har tenant'ni ajratadi → **bitta tenant ichidagi** hajm muhim, umumiy emas
- `audit_logs`, `student_timeline`, `notifications` — bular **tenant ichida ham** tez
  o'sadi. Bir o'quvchining timeline'i yillar davomida minglab yozuv
- Mobil ilovadagi cheksiz skroll — offset uchun **eng yomon** naqsh, aynan drift ko'rinadi

### 4.4. Tavsiya — bosqichma-bosqich

**Hammasini cursor'ga o'tkazish — YO'Q.** 34 DTO va 48 sahifa. Foyda yo'q, xavf katta.

**1. Formatni birlashtiring (hozir).** Yangi endpoint uchun `limit`/`offset` tanlang
(`students` allaqachon shunday va u eng ko'p ishlatiladi). `page` ni frontend hisoblaydi.
Yagona `PaginationQuery` bazaviy DTO yozilsin, yangi DTO undan `extends` qilsin. Eski 29
DTO **tegilmaydi**.

**2. `notifications` DTO'sidagi `string` tipini tuzating** — bu bag, konvensiya emas.

**3. Cursor faqat kerak bo'lgan joyda.** O'lchang. p95 > 300ms bo'lgan ro'yxatlar uchun.
Nomzodlar: `audit_logs`, `student_timeline`, `notifications`, `attendance` tarixi.

Cursor qo'shish **buzuvchi emas** — qo'shimcha parametr:

```http
GET /api/v1/student-timeline?studentId=1&limit=20&after=eyJpZCI6IjEyMyJ9
```

`after` berilsa — cursor rejimi; berilmasa — eski `offset` rejimi. Ikkalasi birga yashaydi.

BigInt `autoincrement()` ID vaqt bo'yicha o'suvchi → cursor to'g'ridan-to'g'ri ishlaydi:

```sql
WHERE tenant_id = $1 AND id < $cursor ORDER BY id DESC LIMIT $limit + 1
```

`limit + 1` — `hasMore` ni aniqlash uchun, qo'shimcha `COUNT(*)` siz. Bu offset
pagination'ning yana bir yashirin narxi: har sahifa uchun **ikki** so'rov.

---

## 5. Xatolik formati

### 5.1. Hozirgi holat — yagona filter bor ✅

`common/filters/all-exceptions.filter.ts`, `main.ts:125` da global:
`app.useGlobalFilters(new AllExceptionsFilter());`

`@Catch()` — parametrsiz, **hamma** exception'ni tutadi. To'g'ri.

Javob shakli (`:14-21`):

```ts
type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
  path?: string;
  timestamp: string;
};
```

### 5.2. Nima yaxshi qilingan

**Prisma xatolari HTTP'ga to'g'ri tarjima qilinadi** (`:66-101`):

```ts
case 'P2002': return new ConflictException({ message: 'ALREADY_EXISTS', code: 'ALREADY_EXISTS' });
case 'P2003': return new BadRequestException({ message: 'INVALID_REFERENCE', code: 'INVALID_REFERENCE' });
case 'P2025': return new NotFoundException({ message: 'NOT_FOUND', code: 'NOT_FOUND' });
case 'P2000': return new BadRequestException({ message: 'INVALID_DATA', code: 'INVALID_DATA' });
default:      return new InternalServerErrorException({ message: 'DB_ERROR', code: 'DB_ERROR' });
```

Bu **muhim xavfsizlik yutug'i**. Prisma xatosi tutilmasa, `P2002` xabari **ustun nomini
va qiymatini** oshkor qiladi: `Unique constraint failed on the fields: (tenant_id,
student_login_id)`. Hozirgi kod uni `ALREADY_EXISTS` ga almashtiradi. ✅

**500 da ichki detal chiqmaydi** (`:110-113`) — stack, SQL, fayl yo'li javobga tushmaydi. ✅

### 5.3. ⚠️ Muammo 1 — `code` amalda ko'pincha yo'q

`code` tipda bor (`:20`), lekin qayerdan keladi? (`:48-61`):

```ts
private extractHttpResponse(response, ex) {
  if (typeof response === 'string') {
    return { message: response, error: ex.name };     // ⚠️ code yo'q
  }
  const r = response as any;
  return {
    message: r?.message ?? ex.message ?? 'ERROR',
    error: r?.error ?? ex.name,
    code: r?.code,                                     // ⚠️ faqat qo'lda berilgan bo'lsa
  };
}
```

`code` **faqat** exception ob'yekt bilan tashlanganda to'ldiriladi. Prisma xatolari —
to'ldiradi. Lekin kod bazasidagi **ko'pchilik** exception satr bilan tashlanadi:
`throw new UnauthorizedException('NO_REFRESH_TOKEN')` (`auth.service.ts`),
`throw new UnauthorizedException('NOT_GUARDIAN')` (`assessments.controller.ts:264`).

Bularda `response` — **satr** → `code: undefined`. Va `JSON.stringify` `undefined`
qiymatli kalitni **butunlay tashlab yuboradi**:

```json
{
  "statusCode": 401,
  "message": "NO_REFRESH_TOKEN",
  "error": "Unauthorized",
  "path": "/api/auth/refresh",
  "timestamp": "2026-07-15T09:12:03.441Z"
}
```

`code` **yo'q**.

### 5.4. Mijoz xatoni qanday ajratadi — hozir

**Amalda `message` `code` vazifasini bajaradi.** Bu tasodifiy emas — kod bazasi `message`
ga izchil `SCREAMING_SNAKE_CASE` yozadi: `NO_REFRESH_TOKEN`, `INVALID_CREDENTIALS`,
`SESSION_EXPIRED`, `USER_NOT_FOUND`, `NEW_PASSWORD_SAME_AS_OLD`, `FORBIDDEN_ROLE`,
`NOT_GUARDIAN`. Ya'ni **intizom bor** — 37 controller bo'ylab.

⚠️ **Lekin `message` uch vazifani bajaradi va ular ziddiyatda:**

1. **Mashina uchun kod** — `INVALID_CREDENTIALS`
2. **Odam uchun matn** — `ParseBigIntPipe:8` `'ID must be a number string'`
3. **Massiv** — validatsiya xatosida `message: string[]` (`main.ts:114`
   `new BadRequestException(errors)`)

Uchta shakl, bitta maydon:

```ts
if (err.message === 'INVALID_CREDENTIALS') { ... }        // ishlaydi... ba'zan
if (err.message === 'ID must be a number string') { ... } // ⚠️ tarjima qilsak buziladi
```

Eng yomoni: **`message` ni o'zbekchaga tarjima qilsak, mijoz mantiqi buziladi.**
Ota-onaga "Login yoki parol noto'g'ri" kerak, `INVALID_CREDENTIALS` emas. Lekin tarjima
qilsak — `if (err.message === 'INVALID_CREDENTIALS')` ishlamaydi. Ya'ni **hozirgi format
ko'p tillilikni bloklaydi**.

### 5.5. ⚠️ Muammo 2 — `traceId` yo'q

So'rovni log bilan bog'laydigan identifikator **yo'q**. Foydalanuvchi "xato chiqdi" desa —
`path` + `timestamp` bo'yicha qidirish kerak. Bir vaqtda 20 xodim ishlayotganda bu
ishlamaydi. Kanon §6: observability yo'q — `traceId` buning eng arzon birinchi qadami.

### 5.6. Tavsiya — `code` ni majburiy qilish

**Bu buzuvchi o'zgarish EMAS**, agar `message` saqlansa. Faqat maydon **qo'shiladi**.

```ts
private extractHttpResponse(response, ex) {
  const fallback = this.codeFromStatus(ex.getStatus());   // 400→VALIDATION_FAILED, 401→UNAUTHORIZED, …
  if (typeof response === 'string') {
    // Kod bazasi konvensiyasi: SCREAMING_SNAKE_CASE message = kod
    const isCode = /^[A-Z][A-Z0-9_]*$/.test(response);
    return { message: response, error: ex.name, code: isCode ? response : fallback };
  }
  const r = response as any;
  return {
    message: r?.message ?? ex.message ?? 'ERROR',
    error: r?.error ?? ex.name,
    code: r?.code ?? fallback,
  };
}
```

Natija:
- `throw new UnauthorizedException('INVALID_CREDENTIALS')` → `code: 'INVALID_CREDENTIALS'`
  — **mavjud 37 controller kodiga tegmasdan**
- `throw new BadRequestException('ID must be a number string')` → `code: 'VALIDATION_FAILED'`
- `message` **o'zgarmaydi** → web ishlayveradi

**Eng arzon yutuq:** bitta fayl, ~20 qator.

### 5.7. Maqsadli xatolik shakli

```json
{
  "statusCode": 401,
  "code": "INVALID_CREDENTIALS",
  "message": "Login yoki parol noto'g'ri",
  "error": "Unauthorized",
  "path": "/api/v1/auth/staff/login",
  "timestamp": "2026-07-15T09:12:03.441Z",
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

Validatsiya xatosi — maydon darajasida:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Validatsiya xatosi",
  "traceId": "0af7651916cd43dd8448eb211c80319c",
  "errors": [
    { "field": "maxScore", "code": "OUT_OF_RANGE", "message": "BLOCK_TEST uchun 93 dan oshmasligi kerak" },
    { "field": "heldAt", "code": "MUST_BE_DATE", "message": "Sana formati noto'g'ri" }
  ]
}
```

**Qoidalar:**
- `code` — mashina uchun, `SCREAMING_SNAKE_CASE`, **hech qachon o'zgarmaydi**. Uni
  o'zgartirish = buzuvchi o'zgarish (§10.2)
- `message` — odam uchun, **tarjima qilinadi**. Mijoz unga **hech qachon** bog'lanmaydi
- `traceId` — har doim bor
- 500 da ichki detal **hech qachon** yo'q — allaqachon shunday, buzmang

⚠️ **RFC 9457 (Problem Details) qabul qilinmadi.** U `type`/`title`/`status`/`detail` ni
talab qiladi va `statusCode`/`message` ni **almashtiradi** — ya'ni **buzuvchi**. 48 sahifa
`err.message` va `err.statusCode` ni o'qiydi. Foyda (standartga moslik) narxdan kichik.
Hozirgi shakl `code` va `traceId` qo'shilsa **yetarli**. RFC 9457 — v2 uchun ochiq savol (§12).

---

## 6. Autentifikatsiya

### 6.1. Umumiy oqim

| | STAFF | GUARDIAN |
|---|---|---|
| Login | `POST /api/auth/staff/login` | `POST /api/auth/guardian/login` |
| Identifikator | `username` + `tenantSlug` | `<tenant-slug>-<student-id>` |
| Guard | `PermissionsGuard` / `RolesGuard` | `AccessGuard` |
| Token'da | `userId`, `roles[]`, `permissions[]` | `studentAccountId`, `studentId` |

⚠️ Guardian login formati — `mathacademy-MA-0001`, **birinchi tire bo'yicha** ajratiladi
(kanon §4.2). Oxirgi tire bo'yicha ajratsa `mathacademy-MA` + `0001` chiqadi — real bag edi.

### 6.2. Login → access + refresh

```http
POST /api/auth/staff/login
Content-Type: application/json

{ "tenantSlug": "mathacademy", "username": "admin", "password": "..." }
```

```http
HTTP/1.1 200 OK
Set-Cookie: madc_rt=<opaque-token>; Path=/api/auth/refresh; HttpOnly; SameSite=None; Secure; Expires=Thu, 14 Aug 2026 09:12:03 GMT
Content-Type: application/json

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "staff": { "id": "1", "fullName": "Director (Superadmin)", "username": "admin" },
  "roles": ["SUPERADMIN"],
  "permissions": ["students.read", "students.write"],
  "tenantId": "1"
}
```

`id` va `tenantId` — **string**. Swagger ham shunday deydi (`auth.controller.ts:69,84`). ✅

Keyingi so'rovlar: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 6.3. Refresh cookie — `madc_rt`

`auth.service.ts:84-128`:

```ts
private cookieName(): string {
  return process.env.COOKIE_NAME_REFRESH || 'madc_rt';
}

private cookieOptions(): { sameSite: 'none' | 'lax'; secure: boolean } {
  const isProd = process.env.NODE_ENV === 'production';
  return { sameSite: isProd ? 'none' : 'lax', secure: isProd };
}
```

**Yaxshi qarorlar (buzmang):**
- `httpOnly: true` — JS o'qiy olmaydi → XSS refresh token'ni o'g'irlay olmaydi ✅
- `path: '/api/auth/refresh'` — cookie **faqat** refresh endpointiga yuboriladi, qolgan
  51 controller uni ko'rmaydi → CSRF yuzasi keskin kichrayadi ✅
- Refresh token **opaque**, JWT emas. DB'da `sha256` hash saqlanadi
  (`auth_sessions.refresh_token_hash`) → DB o'g'irlansa ham token tiklanmaydi ✅
- Access va refresh **alohida secret** (`env.validation.ts:48,51`). `.env.example:19-21`
  da sabab yozilgan: aks holda access token refresh sifatida qayta ishlatiladi ✅

⚠️ **`sameSite: 'none'` production'da** — API va web **turli domenda** bo'lgani uchun
zarur. `Secure` bilan birga HTTPS talab qilinadi. Lekin `SameSite=None` cookie **har
qanday** saytdan yuboriladi; uni qutqaradigan narsa — `path` cheklovi va refresh
endpoint'ning CSRF uchun foydasizligi (u faqat access token qaytaradi).

### 6.4. ⚠️ `ACCESS_TOKEN_TTL` — ziddiyat tasdiqlandi

Kanon §5.4 buni bayroqlagan edi. **Tekshirildi — ziddiyat real:**

```ts
// auth.service.ts:88-90
private accessTtl(): string {
  return process.env.ACCESS_TOKEN_TTL || '15m';    // default: 15 daqiqa
}

// env.validation.ts:53-54
ACCESS_TOKEN_TTL: string = '15m';                   // default: 15 daqiqa
```

```bash
# .env.example:24
ACCESS_TOKEN_TTL="15h"                              # ⚠️ 15 SOAT
```

**Kod default'i 15 daqiqa. `.env.example` 15 soat berardi.**

⚠️ **TUZATILGAN — va da'voni aniq qiling, oshirmang.** Bu bo'limning oldingi
tahriri "amalda ishlayotgan qiymat — 15 soat" deb yozgan edi. **Bu XATO.**
O'lchangan:

```yaml
# render.yaml:21-22 — deploy qilingan servis
- key: ACCESS_TOKEN_TTL
  value: 15m
```

**Deploy qilingan API 15 daqiqa ishlatadi.** `render.yaml` env'ni ochiq
o'rnatadi, ya'ni `.env.example` production'ga umuman yetib bormaydi.
`15h` faqat **lokal `cp .env.example .env` qilgan dasturchiga** tegardi.

Ya'ni bu — production hodisasi emas, **dasturchi tuzog'i**: mahalliy muhit
production'dan 60 barobar farq qilardi va buni hech narsa aytmasdi.
`.env.example` **hujjat**, va u noto'g'ri hujjat edi.

**HOLATI: `.env.example` `15m` ga tuzatildi** (sabab izohi bilan). Bu band
tarix sifatida qoldirilgan — chunki saboq qimmat: **`.env.example` xatosi
"jiddiy emas" ko'rinadi, aslida u har yangi dasturchining muhitini
belgilaydi.**

**Nega umuman 15 daqiqa muhim.** Access token — **JWT**, ya'ni **bekor qilib
bo'lmaydi**. `auth_sessions` refresh token'ni bekor qiladi, access token
o'z-o'zidan yashaydi. Xodim ishdan bo'shatilsa, `revokeAllSessions`
chaqirilsa ham — uning access token'i TTL tugagunicha ishlayveradi. Ya'ni
**TTL = zarar oynasi**. O'quvchilar ma'lumoti (voyaga yetmaganlar) uchun bu
oyna qisqa bo'lishi kerak.

**Qolgan tavsiya:** `env.validation.ts` da format tekshirilsin
(`@Matches(/^\d+[smhd]$/)`) — hozir faqat `@IsString()`, ya'ni
`ACCESS_TOKEN_TTL="banana"` bemalol o'tadi.

⚠️ **Ehtiyot:** 15h → 15m o'zgarishi sezilmaydi **faqat agar** refresh oqimi ishlayotgan
bo'lsa. Web'da 401 da refresh chaqiriladimi — **tekshirilsin**. Agar yo'q bo'lsa, TTL'ni
kamaytirish xodimlarni har 15 daqiqada login qilishga majbur qiladi. Deploy'dan oldingi
**majburiy tekshiruv**.

### 6.5. ⚠️ Refresh rotation yo'q

`auth.service.ts` `refresh()` cookie'dan token oladi, `sha256Hex(token)` bo'yicha
`auth_sessions` dan sessiya topadi, `revoked_at` / `expires_at` ni tekshiradi
(`SESSION_REVOKED` / `SESSION_EXPIRED`), keyin yangi access token beradi.

**Refresh token o'zgarmaydi** — bir xil token 30 kun ishlatiladi.

**Oqibat:** refresh token o'g'irlansa, hujumchi uni **30 kun** ishlatadi va buni
**aniqlash imkoni yo'q** — server haqiqiy foydalanuvchi va hujumchini farqlay olmaydi.

Rotation + reuse detection bilan: har refresh yangi token beradi, eskisi bekor qilinadi.
Eski token qayta ishlatilsa → **o'g'irlik signali** → butun zanjir bekor qilinadi.

Bu **API kontraktini o'zgartirmaydi** — mijoz baribir `POST /auth/refresh` chaqiradi.
⚠️ Batafsil xavfsizlik tahlili `10-security.md` mavzusi; bu yerda faqat kontraktga
ta'siri yo'qligi qayd etiladi.

### 6.6. Sessiya boshqaruvi — bor va yaxshi

```
GET    /api/auth/sessions              → faol sessiyalar
DELETE /api/auth/sessions/:sessionId   → bittasini bekor qilish  (204)
DELETE /api/auth/sessions              → hammasini bekor qilish  (200)
```

`auth_sessions`, `auth_attempts`, `auth_locks` — brute-force himoyasi bilan (kanon §5.4).
Bu **ko'p tizimda yo'q** funksiya. ✅ ⚠️ Lekin §2.5 dagi status ziddiyati aynan shu yerda.

---

## 7. Asosiy endpointlar

To'liq ro'yxat — `/api/docs`. Bu yerda **vakillik qiluvchilar** va **nozik joylar**.
⚠️ Manzillar **bugungi holat** — `/api/v1` yo'q (§1.2).

### 7.1. Auth (`auth.controller.ts`)

| Method | Path | Ruxsat | Tavsif |
|---|---|---|---|
| `POST` | `/api/auth/staff/login` | Ochiq | Xodim login → access + `madc_rt` |
| `POST` | `/api/auth/guardian/login` | Ochiq | Ota-ona login (`<slug>-<student-id>`) |
| `POST` | `/api/auth/refresh` | Cookie | Yangi access token. **Body bo'sh** |
| `POST` | `/api/auth/logout` | Cookie | Sessiya bekor + cookie tozalash |
| `GET` | `/api/auth/me` | `AccessGuard` | Joriy foydalanuvchi + roles + permissions |
| `PUT` | `/api/auth/profile` | `AccessGuard` | Profil yangilash |
| `DELETE` | `/api/auth/sessions/:sessionId` | `AccessGuard` | Bitta sessiya (**204**) |
| `POST` | `/api/auth/admin/reset-staff-password/:userId` | `SUPERADMIN`, `ADMIN` | Parol reset |

⚠️ **`auth.controller.ts:649,681` — test endpointlari production'da:**

```ts
@Get('only-superadmin')     // :649 — "Superadmin test endpoint"
@Get('perm-test')           // :681 — "Permission test endpoint"
```

Zararsiz va guard bilan himoyalangan, lekin **API yuzasida turadi va Swagger'da chop
etiladi**. Ular guard'larni sinash uchun yozilgan — o'rni **e2e test**. Testlar
yozilganda (kanon §6) ko'chirilsin va o'chirilsin.

### 7.2. Students (`students.controller.ts` — `staff/students`)

Guard: `PermissionsGuard`, har route'da `@RequirePermissions(...)`.

| Method | Path | Ruxsat | Tavsif |
|---|---|---|---|
| `GET` | `/api/staff/students` | `students.read` | Ro'yxat. `limit`/`offset` (⚠️ §4.1) |
| `GET` | `/api/staff/students/:id` | `students.read` | Detal + timeline + tarix |
| `POST` | `/api/staff/students` | `students.write` | Yaratish + guardian hisob (**201**) |
| `PATCH` | `/api/staff/students/:id` | `students.write` | Yangilash |
| `PATCH` | `/api/staff/students/:id/status` | `students.write` | Status o'zgartirish |
| `POST` | `/api/staff/students/:id/group` | `students.write` | Guruhga tayinlash (⚠️ **201**) |
| `POST` | `/api/staff/students/bulk-import` | `students.write` | Ommaviy import (max 100) |
| `DELETE` | `/api/staff/students/:id` | `students.write` | Arxivlash (**204**) |
| `GET` | `/api/staff/students/statistics/summary` | `students.read` | Statistika |

```http
GET /api/staff/students?q=ali&status=ACTIVE&limit=2&offset=0
Authorization: Bearer eyJ...
```

```json
{
  "data": [
    { "id": "1", "fullName": "Aliyev Ali", "studentLoginId": "MA-0001", "status": "ACTIVE" },
    { "id": "7", "fullName": "Aliyeva Aziza", "studentLoginId": "MA-0007", "status": "ACTIVE" }
  ],
  "meta": { "limit": 2, "offset": 0, "total": 341, "hasMore": true }
}
```

⚠️ **Ikki nozik joy:**

**a) Route tartibi.** `@Get(':id')` (`:90`) `@Get('statistics/summary')` (`:356`) dan
**oldin** e'lon qilingan. NestJS route'larni **e'lon tartibida** solishtiradi →
`/statistics/summary` avval `:id` ga tushadi → `ParseBigIntPipe` `'statistics'` ni
ko'radi → `400`, `404` emas. Statik segment **har doim** parametrli route'dan oldin
turishi kerak. Oson tuzatiladi (metodlar joyini almashtirish), **buzuvchi emas**.
⚠️ Bu real bagmi — §12.1.

**b) `GET :id/timeline` mo'ljallanganini qilmaydi** (`:397-403`):

```ts
getTimeline(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
  // This is included in the detail endpoint, but could be separate
  return this.studentsService.detail({ ... });     // ⚠️ to'liq detal qaytaradi
}
```

`/timeline` so'ralganda **butun** `detail()` javobi qaytadi. Kommentda tan olingan.
Mobil ilova uchun bu ortiqcha trafik.

### 7.3. Assessments (`assessments.controller.ts`)

| Method | Path | Ruxsat | Tavsif |
|---|---|---|---|
| `POST` | `/api/staff/assessments` | `assessments.write` | Yaratish (**201**) |
| `GET` | `/api/staff/assessments` | `assessments.read` | Ro'yxat. `page`/`limit` (⚠️) |
| `GET` | `/api/staff/assessments/:id` | `assessments.read` | Detal + ballar |
| `POST` | `/api/staff/assessments/:id/scores` | `assessments.write` | Ball upsert (⚠️ **201**) |
| `PATCH` | `/api/staff/assessments/:id/publish` | `assessments.write` | Ota-onaga ochish |
| `GET` | `/api/guardian/grades` | `AccessGuard` + GUARDIAN | Farzand baholari |

**⚠️ Bu yerda kanon §4.1 dagi eng katta domen bo'shlig'i:**

```http
POST /api/staff/assessments
Content-Type: application/json

{ "groupId": "1", "subjectId": "5", "type": "BLOCK_TEST",
  "title": "Blok test #3", "heldAt": "2026-02-07T10:00:00+05:00", "maxScore": 500 }
```

```json
HTTP/1.1 201 Created
{ "id": "123", "type": "BLOCK_TEST", "maxScore": 500, "isPublished": false }
```

**API buni qabul qiladi.** DTM'da `BLOCK_TEST` maksimumi — 93 ball (MAIN fan).
`assessments.max_score` — oddiy `Decimal(8,2)`, cheklov yo'q. 189 ballik qoida **faqat
frontendda** (`AssessmentsPage.tsx:503,516,710,719,727`).

Ya'ni **UI himoya qilyapti, API emas.** Mobil ilova yozilganda bu qoida **qaytadan
yoziladi** — va boshqacha yoziladi. Uchinchi mijoz chiqsa — uchinchi marta.

Bu **422** bo'lishi kerak:

```json
HTTP/1.1 422 Unprocessable Entity
{
  "statusCode": 422,
  "code": "MAX_SCORE_EXCEEDS_ROLE_LIMIT",
  "message": "MAIN fan uchun BLOCK_TEST maksimumi 93 ball",
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

400 emas, **422**: `maxScore: 500` sintaktik jihatdan mukammal `Decimal`. Buzilgan narsa
— **domen qoidasi**.

⚠️ **Ehtiyot — bu buzuvchi bo'lishi mumkin.** Agar bazada `max_score > 93` bo'lgan
`BLOCK_TEST` bo'lsa, yangi validatsiya **yangi** yozuvni bloklaydi, eskisi qoladi.
**Avval o'lchang:** `SELECT count(*) FROM assessments WHERE type='BLOCK_TEST' AND
max_score > 93`. 0 bo'lsa — darrov joriy qiling; katta bo'lsa — avval ma'lumot tozalansin.

### 7.4. Guardian yuzasi

| Method | Path | Ruxsat | Tavsif |
|---|---|---|---|
| `GET` | `/api/guardian/grades` | GUARDIAN | Baholar (`page`/`limit`) |
| `GET` | `/api/guardian/grades/subjects` | GUARDIAN | Fan bo'yicha o'rtacha |
| `GET` | `/api/guardian/attendance` | GUARDIAN | Davomat |
| `GET` | `/api/guardian/billing` | GUARDIAN | To'lovlar |
| `GET` | `/api/guardian/student` | GUARDIAN | Farzand profili |
| `GET` | `/api/guardian/dorm` | GUARDIAN | Yotoqxona |

⚠️ **Guardian tekshiruvi controller'da qo'lda takrorlanadi** —
`assessments.controller.ts:262-265, 280-282, 302-304`:

```ts
const user = req.user;
if (!user || user.type !== 'GUARDIAN') {
  throw new UnauthorizedException('NOT_GUARDIAN');
}
```

Bir xil 3 qator, bir faylda **uch marta**. 18 guardian controller bo'ylab — o'nlab marta.
Bu **kanon §5.1 dagi tenant filtri muammosining kichik nusxasi**: kafolat intizomga
bog'langan. Bittasini unutish = ota-ona xodim ma'lumotini ko'radi.

**Tavsiya:** `GuardianGuard` + controller darajasida bir marta:

```ts
@UseGuards(AccessGuard, GuardianGuard)
@Controller('guardian/grades')
```

Har metodda emas. **Unutish imkonsiz bo'ladi.**

⚠️ Va `guardian-files.controller.ts:93` bu tekshiruvni **noto'g'ri shaklda** qiladi:

```ts
if (!user || user.type !== 'GUARDIAN') return { ok: false };   // ⚠️ 200 OK
```

`throw` emas — `return`.

⚠️ **Da'voni aniq qiling — bu ZAIFLIK EMAS.** Tekshiruv **ishlaydi**: `return`
funksiyani to'xtatadi, fayl yuklanmaydi. Xodim `POST /api/guardian/files` ga
tegsa — hech narsa bo'lmaydi. **Ruxsatsiz kirish sodir bo'lmaydi.**

Muammo boshqa va u ikkita:

1. **Kontrakt bagi.** Rad etish `403` emas, **`200 OK`** bilan qaytadi. HTTP
   status'iga qarab qaror qabul qiladigan har qanday mijoz (yoki proxy, yoki
   monitoring) buni **muvaffaqiyat** deb o'qiydi. Xato faqat body ichida
2. **Naqsh mo'rt.** Bu — `AccessGuard` faqat autentifikatsiyani tekshirgani
   uchun **yagona avtorizatsiya tekshiruvi**. U guard'da emas, metod ichida,
   va uni unutish oson. Yuqoridagi guard yechimi aynan shuni hal qiladi

Ya'ni: **bugun xavfsiz, ertaga emas.** Tuzatish arzon (`throw new
ForbiddenException()`), lekin uni "kritik zaiflik" deb ustuvorlashtirma —
[14-roadmap](./14-roadmap.md) da u bosqich 1.3 da, bosqich 0 da emas.

### 7.5. RBAC va tenants

| Method | Path | Ruxsat | Tavsif |
|---|---|---|---|
| `GET` | `/api/rbac/roles` | Ruxsat | Rollar |
| `GET` | `/api/rbac/permissions` | Ruxsat | Ruxsatlar |
| `POST` | `/api/rbac/users/:id/roles` | Ruxsat | Rol tayinlash |
| `GET` | `/api/system/tenants` | `SUPERADMIN` | Tenantlar (**global**, tenant filtri yo'q) |

⚠️ `system/tenants` — kanon §5.1 bo'yicha **yagona to'g'ri istisno**. Lekin aynan
shuning uchun **eng xavfli** endpoint. `SUPERADMIN` **tenant ichidagi** rolmi yoki
**global**mi? Agar A akademiyasining `SUPERADMIN` i uni ko'ra olsa — u **hamma
akademiyani** ko'radi. **Tekshirilsin** — §12.2.

---

## 8. OpenAPI / Swagger

### 8.1. Hozirgi holat

`main.ts:127-139`:

```ts
const swaggerConfig = new DocumentBuilder()
  .setTitle('Mathacademy Digital Campus API')
  .setVersion('1.0.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
  swaggerOptions: { persistAuthorization: true },
});
```

`GET /api/docs` — Swagger UI. `GET /api/docs-json` — OpenAPI JSON.
⚠️ `.setVersion('1.0.0')` — **hujjat** versiyasi, API versiyasi emas. Manzilga ta'sir qilmaydi.

### 8.2. ⚠️ MUAMMO — `ENABLE_SWAGGER` ishlatilmaydi

**Tekshirildi.** `ENABLE_SWAGGER` butun repo bo'ylab **ikki joyda**:

```
render.yaml:31             - key: ENABLE_SWAGGER
apps/api/.env.example:35   ENABLE_SWAGGER="true"
```

Va **`src/` da hech qayerda o'qilmaydi.** `main.ts:136-139` da hech qanday shart yo'q —
`SwaggerModule.setup()` **so'zsiz** chaqiriladi.

- `ENABLE_SWAGGER=false` qo'ysangiz — **hech narsa o'zgarmaydi**
- `render.yaml` da e'lon qilingan → **kimdir uni ishlaydi deb o'ylagan**
- `env.validation.ts` uni **tekshirmaydi** (12 o'zgaruvchi ro'yxatida yo'q) → xato ham bermaydi

**Bu env yolg'on gapiryapti.** Va bu oddiy o'lik koddan **yomonroq**: o'lik kod hech
narsa va'da qilmaydi. `ENABLE_SWAGGER="true"` esa **himoya bor** degan taassurot beradi.
Deploy qiluvchi `ENABLE_SWAGGER=false` qo'yadi, "Swagger yopiq" deb hisoblaydi, ketadi.
Aslida ochiq.

Bu — kanon §5.1 dagi `tenant.util.ts` naqshining takrori: **himoyaga o'xshagan o'lik kod
himoyasizlikdan yomonroq**, chunki u tekshiruvni to'xtatadi.

### 8.3. Ochiq Swagger nega hujum yuzasi

Autentifikatsiyasiz odam quyidagini oladi:

1. **To'liq endpoint xaritasi** — 52 controller, 84 POST, 32 DELETE
2. **Ruxsat modeli** — `students.write`, `assessments.write`
3. **DTO sxemalari** — qaysi maydon majburiy, enum qanday qiymat oladi
   (`student-list.query.ts:58` `enum: ['ACTIVE','GRADUATED','EXPELLED','WITHDRAWN']`)
4. **Admin endpointlari** — `POST /api/auth/admin/reset-staff-password/:userId` (`:514`)
5. **"Try it out"** — hujum uchun tayyor mijoz, `persistAuthorization: true` bilan

Bu **to'g'ridan-to'g'ri zaiflik emas** — guard'lar ishlaydi. Lekin bu **razvedka**
bosqichini nolga tushiradi: hujumchi qaysi endpointni sinashni aniq biladi.

Kontekst muhim: bu **voyaga yetmagan o'quvchilar** ma'lumoti bo'lgan multi-tenant tizim
(kanon §0, §10). Repo **public** — kod allaqachon ochiq. Lekin kod ochiqligi va **ishlab
turgan serverning** to'liq xaritasi ochiqligi — boshqa narsa: kodda qaysi tenant qaysi
domenda turgani yo'q.

### 8.4. Tavsiya

```ts
const swaggerEnabled =
  process.env.ENABLE_SWAGGER === 'true' && process.env.NODE_ENV !== 'production';

if (swaggerEnabled) {
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
```

**Ikki shart, "va" bilan:** `ENABLE_SWAGGER=true` ni production'da kimdir tasodifan
qo'yishi mumkin — `NODE_ENV !== 'production'` ikkinchi to'siq.

Va `env.validation.ts` ga:

```ts
@IsOptional()
@IsIn(['true', 'false'])
ENABLE_SWAGGER?: string = 'false';
```

Default **`false`** — `.env.example:35` dagi `"true"` emas. Xavfsiz default — o'chirilgan.

⚠️ **Lekin OpenAPI JSON baribir kerak** — mobil tiplar undan generatsiya qilinadi (§10.5).
Yechim: `SwaggerModule.createDocument()` ni **CI'da** ishga tushirib, JSON'ni artefakt
sifatida saqlang. Hujjat bor, lekin **build vaqtida**, runtime'da emas.

**Migratsiya:** `apps/web` ga ta'sir qilmaydi — web Swagger UI'ni ishlatmaydi. Xavfsiz.

---

## 9. Rate limiting

### 9.1. ⚠️ Yo'q. Env yolg'on gapiryapti

**Tekshirildi — uch bosqichda:**

**1. Dependency** — `apps/api/package.json:25-47` da 22 ta `dependencies` bor
(`@nestjs/common`, `@nestjs/swagger`, `cache-manager-redis-store`, `class-validator`…).
**`@nestjs/throttler` ular orasida YO'Q.** `devDependencies` da ham yo'q.

**2. Kod:** `throttl`/`Throttl` (case-insensitive) — butun `src` bo'ylab **0 natija**.
`ThrottlerModule`, `ThrottlerGuard`, `@Throttle` — hech biri yo'q.

**3. Env:** `.env.example:32-33` `RATE_LIMIT_TTL="60"` / `RATE_LIMIT_MAX="100"`,
`render.yaml:41,43` — va **`src/` da hech qayerda o'qilmaydi**. `env.validation.ts` ham
ularni tekshirmaydi.

### 9.2. Halol xulosa

**`.env.example` va `render.yaml` mavjud bo'lmagan funksiyani e'lon qilyapti.**

`RATE_LIMIT_TTL="60"` va `RATE_LIMIT_MAX="100"` **hech narsa qilmaydi**. O'chirsangiz —
hech narsa o'zgarmaydi. `RATE_LIMIT_MAX="1"` qo'ysangiz — hech narsa o'zgarmaydi.

Bu `ENABLE_SWAGGER` (§8.2) bilan bir xil naqsh va bir xil zarar: **konfiguratsiya himoya
bor deb yolg'on gapiradi**. Deploy qiluvchi `render.yaml` ni ko'radi, "rate limiting
sozlangan" deb xulosa qiladi. Xato xulosa.

⚠️ **Repo public** (kanon §0) — bu fakt **hamma uchun ochiq**: kimdir `package.json` ni
ochib `@nestjs/throttler` yo'qligini ko'radi.

### 9.3. Nima himoyalanmagan

| Endpoint | Xavf |
|---|---|
| `POST /api/auth/staff/login` | Parol brute-force |
| `POST /api/auth/guardian/login` | ⚠️ Login formati **bashoratli**: `mathacademy-MA-0001`, `MA-0002`… — hujumchi hamma login'ni **sanab chiqadi** |
| `POST /api/auth/refresh` | Token brute-force |
| `POST /api/staff/students/bulk-import` | 100 o'quvchi × cheksiz so'rov = DB to'ldirish |
| `GET /*` | `limit=1000` bilan cheksiz takror |

⚠️ **Qisman himoya bor** — kanon §5.4: `auth_attempts`, `auth_locks` + Redis. Login
**butunlay** himoyasiz emas.

**Lekin bu rate limiting emas, account lockout.** Farqi:

| | Account lockout (bor) | Rate limiting (yo'q) |
|---|---|---|
| Kalit | Hisob (username) | IP / hisob / global |
| Himoya qiladi | Bitta hisobga ko'p urinish | **Ko'p hisobga bittadan urinish** |
| Password spraying | ❌ | ✅ |
| DoS | ❌ | ✅ |
| `GET` endpointlar | ❌ | ✅ |

**Password spraying:** hujumchi 500 guardian login'iga (`MA-0001`…`MA-0500`) **bittadan**
`Parol123` sinaydi. Hech bir hisob qulflanmaydi (har biriga 1 urinish), lekin bittasi
ochilishi ehtimoli katta. Va guardian login'lari **bashoratli** — slug ochiq, ID ketma-ket.

Va `auth_locks` **DoS vektori** ham bo'lishi mumkin: hujumchi ataylab noto'g'ri parol
yuborib, **haqiqiy** foydalanuvchi hisobini qulflaydi. IP bo'yicha rate limiting buni
to'xtatadi, lockout — yo'q. ⚠️ Lock siyosati `10-security.md` mavzusi.

### 9.4. Tavsiya

```bash
npm i @nestjs/throttler
```

```ts
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: Number(process.env.RATE_LIMIT_TTL || 60) * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 100),
}]),
```

```ts
// auth.controller.ts
@Throttle({ default: { limit: 5, ttl: 900_000 } })   // 5 / 15 daqiqa
@Post('staff/login')
```

⚠️ **Ehtiyot — default in-memory store.** Ko'p instansiyada (Render autoscale) har
instansiya **o'z hisobini** yuritadi: 3 × 5 = amalda 15 urinish. Redis **allaqachon bor**
(`cache-manager-redis-store`) → `ThrottlerStorageRedisService` ishlatilsin.

⚠️ **`app.set('trust proxy')` majburiy.** Render/nginx orqasida `req.ip` — **proxy IP**.
Hamma foydalanuvchi bitta IP'dan kelgandek ko'rinadi → birinchi 100 so'rovdan keyin
**hamma bloklanadi**. `auth.service.ts:131-134` allaqachon `x-forwarded-for` ni qo'lda
o'qiydi — ya'ni proxy borligi **ma'lum**, lekin Express'ga aytilmagan. **Deploy'dan
oldingi majburiy qadam.**

Maqsadli limitlar:

| Endpoint | Limit | Kalit |
|---|---|---|
| `POST /auth/*/login` | 5 / 15 daqiqa | IP + username |
| `POST /auth/refresh` | 30 / soat | IP |
| `POST /auth/admin/reset-*` | 10 / soat | userId |
| `POST /staff/students/bulk-import` | 5 / soat | tenantId |
| `GET /*` (autentifikatsiyalangan) | 300 / daqiqa | userId |
| `GET /*` (anonim) | 60 / daqiqa | IP |

Va header'lar har javobda (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`);
429 bo'lsa `Retry-After` ham.

**Agar rate limiting joriy qilinmasa** — `RATE_LIMIT_TTL` va `RATE_LIMIT_MAX` ni
`.env.example` va `render.yaml` dan **o'chiring**. Yolg'on konfiguratsiya —
konfiguratsiya yo'qligidan yomonroq. Bu **eng arzon halol qadam**: ikki qator o'chirish.

---

## 10. Kelajak: API versiyalash strategiyasi

### 10.1. Nega hozir, mobil ilovadan oldin

Bugun web `/api/staff/students` ni chaqiradi. Ertaga `/api/v1/staff/students` qilsak —
web'ni ham o'zgartiramiz, ikkalasi birga deploy bo'ladi. **Xarajat: bir kun.**

Mobil ilovadan keyin: ilova `/api/staff/students` ga qotib qolgan. `/api/v1/` qo'shsak,
eski manzilni **abadiy** qoldirishimiz kerak. **Xarajat: abadiy.**

Versiyalash uchun **oxirgi arzon lahza — hozir**.

### 10.2. Nima buzuvchi hisoblanadi

| Buzuvchi ❌ | Buzuvchi emas ✅ |
|---|---|
| Maydonni o'chirish | Yangi **ixtiyoriy** maydon qo'shish |
| Maydon tipini o'zgartirish (`string` → `number`) | Yangi endpoint qo'shish |
| Ixtiyoriy maydonni **majburiy** qilish | Yangi **ixtiyoriy** query param |
| Enum'dan qiymat **olib tashlash** | Enum'ga qiymat **qo'shish** ⚠️ |
| Xatolik `code` ini o'zgartirish | Xatolik `message` ini tarjima qilish |
| Manzilni o'zgartirish | `code`/`traceId` **qo'shish** (§5.6) |
| Status kodini o'zgartirish (201 → 200) | — |
| Validatsiyani **qattiqlashtirish** (§7.3 DTM) | Validatsiyani yumshatish |

⚠️ **Enum'ga qiymat qo'shish — nozik.** Server uchun qo'shuvchi, mijoz uchun buzuvchi
bo'lishi mumkin: eski ilova `switch (status)` da `default` yozmagan bo'lsa, yangi
`ARCHIVED` qiymati kelganda oq ekran. **Qoida:** mijoz noma'lum enum qiymatiga chidamli
bo'lsin. Buni **hujjatlashtiring** — mobil dasturchi bilishi kerak.

⚠️ **Validatsiyani qattiqlashtirish buzuvchi.** §7.3 dagi DTM qoidasi — aynan shu. Bugun
`maxScore: 500` o'tadi, ertaga o'tmaydi → eski mijoz uchun **regressiya**.

### 10.3. Migratsiya rejasi — 4 bosqich

**Bosqich 0 — cookie `path` ni ozod qiling (⚠️ MAJBURIY BIRINCHI).**

§1.3 dagi mina:

```ts
private refreshCookiePath(): string {
  return process.env.REFRESH_COOKIE_PATH || '/api/auth/refresh';
}
```

⚠️ **`clearRefreshCookie` ham** (`auth.service.ts:122-128`) — u ham `path` yozadi va u
**mos kelishi shart**. Mos kelmasa `clearCookie` ishlamaydi va logout **jimgina
muvaffaqiyatsiz** bo'ladi — foydalanuvchi "chiqdim" deb o'ylaydi, cookie qoladi.

**Bosqich 1 — `/api/v1` ni qo'shing, `/api` ni qoldiring.**

```ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: ['1', VERSION_NEUTRAL],
});
```

`VERSION_NEUTRAL` — route **ikkala** manzilda javob beradi. Web `/api/...`, yangi mijoz
`/api/v1/...`. **Bitta kod, ikkita manzil.** (`defaultVersion: '1'` yolg'iz bo'lsa —
`/api/staff/students` yo'qoladi va web darhol buziladi.)

⚠️ **O'lchang, taxmin qilmang.** `enableVersioning` + `VERSION_NEUTRAL` xatti-harakati
NestJS 11 da `setGlobalPrefix` bilan birikkanda **integratsiya testi** bilan tasdiqlansin,
hujjat o'qib emas.

**Bosqich 2 — web'ni `/api/v1` ga ko'chiring.**

Agar API bazasi bitta joyda bo'lsa (`useCrud` hook, kanon §5.5) — **bitta satr**:
`const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';`
⚠️ **Tekshirilsin** — §12.6.

**Bosqich 3 — `/api/` (versiyasiz) ni o'chiring.**

Faqat web to'liq ko'chgandan **va** log'da versiyasiz so'rov **nolga tushgandan** keyin.
Bu **o'lchov talab qiladi** — §5.5 dagi observability ishi bu qadamning **shartidir**.
O'lchovsiz o'chirish — ko'r-ko'rona.

### 10.4. v2 qachon kerak

**Deyarli hech qachon.** Ko'p o'zgarishni v1 ichida qilish mumkin:

- Yangi maydon → qo'shing, eski qoldiring
- Maydon nomini o'zgartirish → **ikkalasini** qaytaring, eskisini `@deprecated`
  belgilang, ishlatilishini o'lchang, nol bo'lganda o'chiring
- Yangi shakl → **yangi endpoint**

v2 faqat **ko'p buzuvchi o'zgarish birga** kerak bo'lganda: §2.7 konvert + §2.5 status +
§2.2 nom tekislash — bularni **birga** qilish mantiqiy. Bittalab v2 chiqarish — yo'q.

**v1 kamida 12 oy yashaydi** v2 chiqqandan keyin: mobil yangilanish foydalanuvchiga
bog'liq va O'zbekistonda eski Android telefonlarda avtoyangilanish har doim yoqilmagan.

### 10.5. Mijoz tiplari — qo'lda yozilmaydi

```bash
npm run openapi:generate     # openapi-typescript
```

Qo'lda yozilgan tip backend bilan farqlanib ketadi va buni **hech kim sezmaydi** —
ayniqsa testlar nol bo'lganda (kanon §3). Generatsiya qilingan tip CI'da tekshiriladi:
API o'zgarsa build **yiqiladi**. Bu **yaxshi** — bag production'da emas, PR'da topiladi.

⚠️ **Shart:** bu §3.5 dagi response DTO ishidan keyin ishlaydi. Hozir javob sxemasi
OpenAPI'da yo'q → tip ham yo'q. **Tartib:** response DTO → OpenAPI to'liq → tip
generatsiyasi → CI diff.

---

## 11. Idempotentlik

### 11.1. Hozirgi holat — yo'q

**Tekshirildi:** `Idempotency`/`idempotenc` — butun repo bo'ylab **0 natija**. Header ham,
jadval ham, middleware ham yo'q.

### 11.2. Nega kerak

Buxgalter yotoqxona to'lovini kiritadi. Tugmani bosadi. Internet sekin. Javob kelmaydi.
Yana bosadi.

```http
POST /api/staff/billing/payments
{ "studentId": "1", "amount": 1500000, "method": "CASH" }
```

Ikki so'rov, ikki yozuv. O'quvchi **ikki marta to'lagan** ko'rinadi. Yoki teskarisi:
birinchi so'rov aslida **o'tgan**, faqat javob yo'qolgan → ikkinchisi dublikat yaratadi.

**Bu faraziy emas:**
- Sekin internet (O'zbekiston mintaqalarida real)
- Buxgalter tugma ishlaganini bilmaydi
- Mobil ilova — **yanada yomon**: tarmoq uzilishi normal, va HTTP mijozlari ko'pincha
  **avtomatik retry** qiladi

⚠️ Va bu **pul** — kanon §4.2: `dorm_student_charges`, `meal_student_charges`. Ota-ona
hisobida noto'g'ri raqam → ishonch yo'qoladi.

### 11.3. Frontend himoyasi yetarli emas

"Tugmani disable qilamiz" — bu **bir mijoz uchun** ishlaydi. Lekin: mobil ilova — boshqa
kod; tarmoq retry — mijoz kodidan **pastda**, disable tugma uni to'xtatmaydi; ikki xodim
bir vaqtda kiritishi mumkin.

**Idempotentlik — server kafolati.** Mijozga ishonch — kafolat emas.

### 11.4. Tavsiya

```http
POST /api/v1/staff/billing/payments
Authorization: Bearer eyJ...
Idempotency-Key: 7f3e9a12-4b8c-4d1e-9f2a-3c5b7d9e1f04
Content-Type: application/json

{ "studentId": "1", "amount": 1500000, "method": "CASH" }
```

Birinchi so'rov:

```json
HTTP/1.1 201 Created
{ "id": "9012", "studentId": "1", "amount": "1500000.00", "status": "CONFIRMED" }
```

Takroriy so'rov (**bir xil kalit, bir xil body**):

```json
HTTP/1.1 201 Created
Idempotent-Replay: true

{ "id": "9012", "studentId": "1", "amount": "1500000.00", "status": "CONFIRMED" }
```

**Bir xil javob. Yangi yozuv yo'q.**

Konflikt (**bir xil kalit, boshqacha body**):

```json
HTTP/1.1 422 Unprocessable Entity
{
  "statusCode": 422,
  "code": "IDEMPOTENCY_KEY_REUSE",
  "message": "Bu Idempotency-Key boshqa so'rov uchun ishlatilgan",
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

Body hash bo'yicha solishtiriladi — aks holda mijoz kalitni qayta ishlatib, boshqa
to'lovni "takror" deb yashirishi mumkin.

**Qayerda majburiy:**

| Endpoint | Sabab |
|---|---|
| `POST /staff/billing/payments` | Pul. Dublikat = noto'g'ri hisob |
| `POST /staff/billing/invoices` | Pul |
| `POST /staff/students` | Dublikat o'quvchi + dublikat guardian hisob |
| `POST /staff/students/bulk-import` | 100 ta dublikat |
| `POST /staff/assessments/:id/scores` | ⚠️ **Yo'q** — allaqachon `upsert` |

⚠️ **`upsertScores` allaqachon idempotent** (`assessments.controller.ts:172`). Upsert —
tabiiy idempotent: bir xil ball ikki marta yozilsa, natija bir xil. Bu **to'g'ri dizayn**
va unga `Idempotency-Key` **kerak emas**.

**Implementatsiya:**

```prisma
model idempotency_keys {
  id           BigInt   @id @default(autoincrement())
  tenant_id    BigInt
  key          String   @db.VarChar(255)
  request_hash String   @db.VarChar(64)
  status_code  Int
  response     Json
  created_at   DateTime @default(now()) @db.Timestamptz(6)
  expires_at   DateTime @db.Timestamptz(6)

  @@unique([tenant_id, key])
  @@index([expires_at])
}
```

⚠️ **`@@unique([tenant_id, key])`, `@@unique([key])` emas** — kanon §5.1. Aks holda A
tenanti "abc" ni ishlatsa, B tenantida "abc" **bloklanadi** → B tenanti A ning kalit
ishlatganini **sezadi**.

Va `@@unique` — **poyga (race) himoyasi**. Ikki bir vaqtdagi so'rov: birinchisi `INSERT`,
ikkinchisi `P2002` → `all-exceptions.filter.ts:69` uni `ALREADY_EXISTS` ga o'giradi →
interceptor buni "kutish va birinchi javobni qaytarish" ga aylantiradi.
**Tekshirish-keyin-yozish mantiqi yetarli emas** — ikki so'rov ikkalasi ham "kalit yo'q"
deb ko'radi.

Kalit muddati: **24 soat** (`expires_at`). ⚠️ Model nomi `snake_case`, ko'plik — kanon §9.
**Migration majburiy**, `db push` hech qachon.

**Migratsiya:** header **ixtiyoriy** boshlanadi. Bo'lmasa — hozirgidek ishlaydi; bo'lsa —
himoya qo'shiladi. **Buzuvchi emas.** Keyin, mijozlar ko'chgach, pul endpointlari uchun
**majburiy** qilinadi — bu v2 (§10.2: "ixtiyoriy maydonni majburiy qilish" = buzuvchi).

---

## 12. Ochiq savollar

1. **`GET /api/staff/students/statistics/summary` route tartibi — bagmi?**
   `@Get(':id')` (`students.controller.ts:90`) statik segmentdan **oldin** turadi.
   `/statistics/summary` `:id` ga tushib, `ParseBigIntPipe` 400 bermoqdami? Agar ha —
   **bu sahifa ishlamayapti**. Bir so'rov bilan tekshiriladi.

2. **`SUPERADMIN` — tenant ichidagi rolmi yoki global?**
   `/api/system/tenants` (`tenants.controller.ts:34`) `SUPERADMIN` bilan himoyalangan.
   A akademiyasining superadmin'i hamma tenantni ko'ra oladimi? Agar ha — bu **eng jiddiy
   tenant izolyatsiya buzilishi**. Kanon §5.1 ning markaziy vazifasi.

3. **Web 401 da refresh chaqiradimi?**
   `ACCESS_TOKEN_TTL` ni 15h → 15m tuzatish (§6.4) shunga bog'liq. Avtomatik refresh
   yo'q bo'lsa, xodimlar har 15 daqiqada login qiladi va tuzatish **regressiya** sifatida
   qabul qilinadi.

4. **Bazada `max_score > 93` bo'lgan `BLOCK_TEST` bormi?**
   §7.3 dagi DTM validatsiyasidan oldin o'lchanishi shart.

5. **Eng katta tenant'da `students.list` p95 latency qancha?**
   §4.3 — cursor kerakmi yoki yo'qmi, bu **o'lchovga** bog'liq. Hozir o'lchanmagan.

6. **`apps/web` da API bazaviy manzili bitta joydami?**
   §10.3 Bosqich 2 shunga bog'liq. `useCrud` markazlashtirganmi yoki 48 sahifada
   `fetch('/api/...')` tarqalganmi?

7. **RFC 9457 v2 da qabul qilinsinmi?** §5.7. v2 bo'lmasa — arzimaydi.

8. **Ko'p tillilik kerakmi va qachon?**
   Xatolik `message` — inglizcha kod. Ota-onaga o'zbekcha matn kerak. Frontendda tarjima
   qilinsinmi (`code` → matn xaritasi) yoki server `Accept-Language` ni qo'llasinmi?
   Birinchisi arzon va **hozir ishlaydi** — lekin har mijoz o'z xaritasini yuritadi.

9. **Webhook kerakmi?** Click/Payme integratsiyasi rejadami? Agar ha — ular
   `Authorization` header'siz keladi va imzo tekshiruvi kerak: **alohida autentifikatsiya
   yo'li**, API yuzasiga ta'sir qiladi.

10. **Public API kerakmi?** Uchinchi tomon ma'lumot olishi kerakmi? Agar ha — API key,
    kvota, **alohida** versiyalash siyosati.

11. **Test endpointlari (`only-superadmin`, `perm-test`) o'chirilsinmi?** §7.1. Guard
    testlari e2e'ga ko'chirilsa — o'chiriladi. Kanon §6 dagi "testlar yo'q" ishiga bog'liq.

12. **Bolalar ma'lumoti — yuridik talab bormi?**
    ⚠️ **Yurist savoli.** Kanon §10. O'quvchilar **voyaga yetmagan**. API orqali qanday
    ma'lumot qaytarish mumkin, qancha saqlanadi, ota-ona nima ko'ra oladi — O'zbekiston
    qonunchiligida talab bormi? Bu hujjat **javob bermaydi**.
