# ADR-0005 — RBAC ruxsat darajasida, rol darajasida emas

- **Holat:** Qabul qilingan
- **Sana:** 2026-07-16
- **Qaror qabul qildi:** Sarvarbek Sodiqov

## Kontekst

MathAcademy'da bir nechta xodim turi bor: superadmin, admin, teacher, receptionist,
accountant. Har biri tizimning turli qismlariga kiradi. Buxgalter to'lovni ko'radi,
o'qituvchi baho qo'yadi, qabulxona xodimi o'quvchi qidiradi.

Savol oddiy ko'rinadi: **kim nima qila oladi?** Va uni majburlashning ikki yo'li bor.

**Birinchi yo'l — rol tekshiruvi.** Route'da to'g'ridan-to'g'ri rol nomi yoziladi:

```ts
@RequireRoles('accountant', 'admin')   // ← rol kodda hardkod
@Post('invoices')
createInvoice() { ... }
```

**Ikkinchi yo'l — ruxsat tekshiruvi.** Route ruxsat nomini talab qiladi, rol o'sha
ruxsatlar to'plamiga faqat **ma'lumot** sifatida ega bo'ladi:

```ts
@RequirePermissions('billing.write')   // ← rol emas, qobiliyat
@Post('invoices')
createInvoice() { ... }
```

Farq falsafiy emas — **operatsion**. Akademiya real ishlaydigan tashkilot va uning
ichki tuzilishi o'zgaradi. "Qabulxona xodimi endi davomat ham kiritsin" degan qaror
direktor tomonidan **dushanba kuni** qabul qilinadi. Birinchi yo'lda bu — kod
o'zgarishi, code review, build, deploy. Ikkinchi yo'lda — admin panelda bitta
checkbox.

Bu loyihada yana bitta kuch bor, u ko'p tizimlarda yo'q: **loyiha ko'p ijarachilik
(multi-tenant) mahsulotga aylanmoqda** ([03-multi-tenancy.md](../03-multi-tenancy.md)).
Ikkinchi akademiya kelganda uning ichki tuzilmasi birinchisiniki bilan bir xil
bo'lishiga **hech qanday sabab yo'q**. Bir akademiyada "kurator" bor, boshqasida
yo'q. Bir joyda buxgalter yotoqxona to'lovini ham yuritadi, boshqasida — alohida odam.

Agar rol nomi kodda hardkod bo'lsa, har yangi mijoz **kod o'zgarishini** talab qiladi.
Bu SaaS emas — bu har mijoz uchun alohida fork.

## Qaror

**Avtorizatsiya ruxsat (permission) darajasida majburlanadi. Rol — ruxsatlar
to'plamining nomi, tekshiruv birligi emas.**

Ma'lumot modeli to'rt jadval (`rbac` moduli):

```
permissions       — atomik qobiliyat  ('billing.write', 'assessments.read')
roles             — nom               ('accountant')
role_permissions  — rol → ruxsatlar   (ko'pdan-ko'pga)
user_roles        — user → rollar     (ko'pdan-ko'pga)
```

Route **faqat ruxsat** talab qiladi:

```ts
// apps/api/src/modules/assessments/assessments.controller.ts:172-173
@Post(':id/scores')
@RequirePermissions('assessments.write')
upsertScores(...) { ... }
```

**Rol nomi biznes logikasida tekshirilmaydi.**

Bu qaror **allaqachon amalga oshirilgan va yaxshi amalga oshirilgan** — quyidagi
o'lchov buni tasdiqlaydi. ADR uni **rasmiylashtiradi**, joriy qilmaydi.

## Sabablar

### O'lchov: bu izchil qo'llangan tizim, dekorativ emas

Grep bilan o'lchandi (`apps/api/src`, `2026-07-16`):

| O'lchov | Qiymat |
|---|---|
| `@RequirePermissions` ishlatilgan | **234** |
| `@RequireRoles` ishlatilgan | **6** |
| Ruxsat e'lon qilmagan biznes route | **0** |
| Controller fayllari | 37 |
| `@UseGuards` e'lonlari | 62 |
| `@UseGuards` siz controller | **1** — `app.controller.ts` (faqat `GET /` va `GET /health`) |

**234 ga 6** nisbati muhim. Bu "RBAC bor" degani emas — bu **ruxsat tekshiruvi
default holatga aylangan** degani. Rol tekshiruvi 6 ta joyda qolgan va u ham
ataylab: superadmin darajasidagi global amallar uchun.

Va yagona himoyalanmagan controller — health check. Bu **to'g'ri**: monitoring
endpoint'i autentifikatsiya talab qilmasligi kerak.

⚠️ **Bu loyihaning eng kuchli tomoni va halol tan olinishi kerak.** 62 783 qatorli,
testsiz, 51 kommitli loyihada 234 ta izchil ruxsat e'loni — bu tasodif emas. Bu
poydevor. TZ ning boshqa qismlari mavjud kodni tanqid qiladi
([03-multi-tenancy.md](../03-multi-tenancy.md) — 845 qo'lda tenant nuqtasi); bu
bo'lim esa **nima to'g'ri qilinganini** yozadi, chunki ADR ning vazifasi — maqtash
ham, tanqid ham emas, **halollik**.

### Nega ruxsat, rol emas — asosiy sabab: deploysiz o'zgarish

Ruxsat modeli **ma'lumotda** yashaydi, kodda emas. Demak:

```sql
-- Yangi rol yaratish — deploy yo'q
INSERT INTO roles (tenant_id, name) VALUES (1, 'dorm_manager');
INSERT INTO role_permissions (role_id, permission_id)
  SELECT <new_role_id>, id FROM permissions
  WHERE name IN ('dorms.read', 'dorms.write', 'billing.read');
```

Rol tekshiruvida xuddi shu narsa **har route'da** kod o'zgarishini talab qilardi:

```ts
- @RequireRoles('admin')
+ @RequireRoles('admin', 'dorm_manager')   // ← 234 joyda takrorlanadigan savol
```

234 ta e'lon borligini eslang. Rol modelida har yangi rol — **234 ta route'ni qayta
ko'rib chiqish** degani. Ruxsat modelida — bitta `INSERT`.

### Nega bu multi-tenancy uchun majburiy

`roles` jadvali `tenant_id` ga ega, `permissions` esa **global**
([kanon: 18 model `tenant_id` siz](../04-data-model.md)). Bu ataylab va to'g'ri:

- **`permissions` global** — chunki qobiliyatlar to'plamini **kod** belgilaydi.
  `assessments.write` nima qilishini controller aytadi, mijoz emas
- **`roles` tenant'ga tegishli** — chunki har akademiya o'z ichki tuzilmasini
  o'zi yig'adi

Ya'ni: **kod qobiliyat lug'atini beradi, tenant undan o'z alifbosini yig'adi.**

Rol tekshiruvida bu imkonsiz. `@RequireRoles('curator')` yozilsa, "kurator" tushunchasi
**barcha tenantlar uchun** kodga muhrlanadi — kuratori yo'q akademiya uchun ham.

### Alternativa A: hardkod rol tekshiruvi — nega rad etildi

**Ustunligi — halol yozilsin, u real:**

- **Ancha soddaroq.** Jadval yo'q, JOIN yo'q, admin panel yo'q. `user.role === 'admin'`
- **Tezroq.** Ruxsatlarni bazadan o'qish shart emas — rol JWT ichida
- **O'qilishi oson.** `@RequireRoles('accountant')` route ustida turganda kim kirishi
  **darhol** ko'rinadi. `@RequirePermissions('billing.write')` esa savol tug'diradi:
  "bu ruxsat kimda bor?" — javob **bazada**, kodda emas
- **Xatoga kamroq joy.** Ruxsat noto'g'ri biriktirilsa buzuq konfiguratsiya jimgina
  ishlaydi

Oxirgi ustunlik jiddiy: **ruxsat modeli avtorizatsiyani kod review'dan ma'lumotga
ko'chiradi.** Kod review'da xato ushlanadi, `role_permissions` jadvalidagi noto'g'ri
qator — **ushlanmaydi**.

**Nega baribir rad etildi:** loyihaning vizyoni — ko'p akademiya. Rol nomi kodga
muhrlanishi vizyonni **to'g'ridan-to'g'ri** to'sadi. Sodda yechim bugun to'g'ri,
ikkinchi mijoz kelgan kuni noto'g'ri. Va bu ADR aynan **o'sha kunga** yoziladi.

### Alternativa B: to'liq ABAC (Casbin / OPA) — nega rad etildi

**Ustunligi — bu kuchliroq yechim, buni yashirmaslik kerak:**

- ABAC **resurs darajasida** qaror qabul qiladi — RBAC qila olmaydigan narsa
  (quyidagi "Salbiy" bo'limiga qarang, bu aynan bizning bo'shlig'imiz)
- Siyosat (policy) kod emas, **alohida artefakt** — deploysiz o'zgaradi va **versiyalanadi**
- OPA/Rego siyosatni **test qilish** imkonini beradi — hozir bizda umuman test yo'q
- Casbin `RBAC with domains` modeli multi-tenancy uchun **tayyor** primitiv beradi

Ya'ni ABAC bizning eng katta muammomizni (scope) **hal qiladi**, RBAC esa yo'q.

**Nega baribir rad etildi:**

1. **Muammo RBAC'da emas.** Quyida ko'rsatiladi: scope tekshiruvining yo'qligi —
   **ma'lumot modeli bo'shlig'i**. Sxemada o'qituvchi–guruh bog'lanishi yo'q. OPA
   qo'shsak ham u tekshiradigan narsa **mavjud emas**. Bo'sh ma'lumot ustiga kuchli
   policy engine qo'yish — muammoni hal qilmaydi, **yashiradi**
2. **Miqyos.** Bir akademiya, 5 rol, 28 modul. Casbin/OPA — o'nlab mijoz va murakkab
   ierarxiya uchun. Bu miqyosda ular **ortiqcha**: yangi til (Rego), yangi deploy
   birligi, yangi debug yuzasi
3. **Ishlayotgan narsani almashtirish narxi.** 234 ta e'lon migratsiya qilinishi kerak.
   Ishlayotgan tizimda bu **regressiya xavfi**, foyda esa noaniq

**Bu qaror abadiy emas.** "Qachon qayta ko'riladi" bo'limiga qarang: scope modelga
qo'shilgach va tenant soni o'sgach, ABAC **qayta ko'rib chiqiladi**. Hozir rad etilishi —
"yomon" degani emas, **"hali erta"** degani.

### Alternativa C: rol ierarxiyasi (admin ⊃ teacher) — nega rad etildi

**Ustunligi:** ruxsat biriktirish ishini kamaytiradi — `admin` avtomatik `teacher`
qila oladigan hamma narsani qiladi.

**Nega rad etildi:** ierarxiya **yolg'on farazga** tayanadi — yuqori rol quyi rolning
**barcha** qobiliyatiga ega. Amalda bu noto'g'ri: direktor baho qo'ymasligi kerak.
Ierarxiya "kim kimdan yuqori" savolini "kim nima qila oladi" savoli bilan
**chalkashtiradi** — bular boshqa savollar.

Hozirgi model ierarxiyasiz: har rol o'z ruxsatlarini **aniq** oladi. Ko'proq yozuv,
lekin **hech qanday yashirin faraz yo'q**.

## Oqibatlar

**Ijobiy:**

- **Ruxsat to'plami deploysiz o'zgaradi.** Yangi rol — `INSERT`, build emas
- **Har tenant o'z rol tuzilmasini yig'adi.** `roles.tenant_id` buni ta'minlaydi;
  `permissions` global qolib, qobiliyat lug'atini kod nazoratida saqlaydi
- **234 ta e'lon — o'qiladigan spetsifikatsiya.** `grep @RequirePermissions` butun
  avtorizatsiya yuzasini **bir buyruqda** beradi. Bu hujjatdan ishonchliroq, chunki
  u kod
- **Superadmin bypass markazlashgan** (`perms.guard.ts:31`) — bitta joyda, izlash oson
- **Yangi route yozish arzon.** Ruxsat nomi qo'shiladi, guard qolganini bajaradi

**Salbiy:**

- ⚠️⚠️ **ENG QIMMAT OQIBAT — ruxsat "nima qilish mumkin"ni ayta oladi,
  "qaysi resursga"ni YO'Q.**

  Bu ADR ning eng muhim jumlasi. Aniq misol (real kod, real qatorlar):

  ```ts
  // apps/api/src/modules/assessments/assessments.controller.ts:172-173
  @Post(':id/scores')
  @RequirePermissions('assessments.write')
  upsertScores(@Param('id') id: string, @Body() dto: UpsertAssessmentScoresDto) { ... }
  ```

  `assessments.write` ruxsatiga ega **har qanday** o'qituvchi — **istalgan**
  `assessment` ga, demak **istalgan guruhning** o'quvchisiga baho qo'ya oladi.
  Guard `assessment.group_id` ni o'qituvchining guruhi bilan **solishtirmaydi**,
  chunki solishtiradigan narsa yo'q.

  **O'lchangan sabab — va bu RBAC bagi EMAS:**

  | Bog'lanish | Qayerda | Izoh |
  |---|---|---|
  | `teacher_user_id` | `schema.prisma:1080` — **faqat** `timetable_lessons` | Dars jadvali, guruh a'zoligi emas |
  | `curator_user_id` | `schema.prisma:509` — `groups` | Kurator ≠ fan o'qituvchisi |
  | `created_by_user_id` | `schema.prisma:33` — `assessments` | Kim yaratgani, kim egasi emas |

  69 modelli sxemada **"bu o'qituvchi bu guruhga dars beradi"** degan bog'lanish
  **yo'q**. Eng yaqini — `timetable_lessons.teacher_user_id`, lekin u dars **jadvali**
  faktini yozadi, mas'uliyat chegarasini emas. Jadvaldan foydalanib scope chiqarish
  mumkin edi, lekin u noto'g'ri: bir marta almashtirgan o'qituvchi butun guruhga
  abadiy huquq oladi.

  **Xulosa: scope tekshiruvidan oldin scope tushunchasining O'ZI modelga qo'shilishi
  kerak.** Bu — RBAC bagi emas, **ma'lumot modeli bo'shlig'i**.

  Va shuning uchun yuqorida ABAC rad etildi: OPA qo'shish bu bo'shliqni to'ldirmaydi.
  Avval `teacher_group_assignments` (yoki shunga o'xshash) modelga qo'shiladi —
  **keyin** uni kim tekshirishi (RBAC kengaytmasi yoki ABAC) muhokama qilinadi.
  Teskari tartib — `tenant.util.ts` xatosini takrorlash: himoyaga o'xshagan,
  aslida bo'sh narsa.

- ⚠️ **`PermissionsGuard` fail-open.** O'lchangan
  (`apps/api/src/common/guards/perms.guard.ts:27`):

  ```ts
  const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [...]);
  if (!required || required.length === 0) return true;   // ← ruxsat e'lon qilinmasa — O'TADI
  ```

  Ya'ni `@RequirePermissions` yozilmagan route **ochiq**. Hozir bu bag emas —
  o'lchandi: himoyasiz biznes route **0 ta**. Lekin kafolat **struktura emas,
  intizom**: 37 controller har biri `@UseGuards` ni **eslashi** kerak, va
  `APP_GUARD` orqali global guard **ro'yxatdan o'tkazilmagan** (grep: 0 natija).

  Bu — [03-multi-tenancy.md](../03-multi-tenancy.md) dagi **845 qo'lda tenant nuqtasi**
  bilan **bir xil naqsh**: to'g'ri qilingan, lekin unutish mumkin. Farqi shundaki,
  tenant filtri 845 joyda unutilishi mumkin, bu esa — yangi controller yozilgan kuni.

  Yechim arzon va bu ADR doirasida emas, lekin qayd etiladi: `APP_GUARD` + fail-closed
  default + aniq `@Public()` dekoratori. Unda `app.controller.ts` health check'i
  **aniq e'lon** bilan ochiq bo'ladi, tasodifan emas.

- ⚠️ **Avtorizatsiya to'g'riligi endi kod review'da ko'rinmaydi.** `@RequirePermissions('billing.write')`
  ni o'qib "buni kim qila oladi?" degan savolga javob **yo'q** — javob `role_permissions`
  jadvalida. Rol modelida bu javob route ustida turardi. Bu — ruxsat modeli uchun
  to'lanadigan **haqiqiy narx**, va uni Alternativa A ning ustunligi sifatida yuqorida
  tan oldik.

  Yumshatish: `permissions` global bo'lgani uchun ularning ro'yxati **seed'da** —
  ya'ni versiyalangan. Lekin `role_permissions` — tenant ma'lumoti, u versiyalanmaydi.

- ⚠️ **Ruxsat nomlari kod va ma'lumot o'rtasida bo'lingan shartnoma.** `@RequirePermissions('assessments.write')`
  dagi string `permissions.name` bilan **aynan** mos kelishi kerak. Typo — kompilyatsiya
  xatosi emas, **jimgina 403**. TypeScript bu yerda hech narsa ushlamaydi.

  234 ta string literal — 234 ta typo imkoniyati. Yumshatish: ruxsat nomlarini
  `const` obyekt/union tipiga chiqarish va seed'ni o'sha manbadan generatsiya qilish.

- **Har so'rovda ruxsatlarni yuklash kerak.** Bu kesh talab qiladi
  (`auth.service.ts:358`, kalit `user:${userId}:roles_perms`, TTL 5 daq) — va kesh
  o'z muammosini olib keladi, [ADR-0007](./0007-postgres-as-only-datastore.md) ga qarang:
  bekor qilish **faqat o'z process'ida** ishlaydi.

  Ya'ni bu ADR va ADR-0007 **bir-biriga bog'langan**: ruxsat modelining ishlashi
  keshga, kesh esa "1 instance" farazi ustiga qurilgan.

## Qachon qayta ko'riladi

| Signal | O'lchov |
|---|---|
| Scope modelga qo'shildi (o'qituvchi–guruh bog'lanishi) | `schema.prisma` da o'qituvchi↔guruh jadvali paydo bo'ldi → resurs darajasidagi tekshiruv **majburiy** bo'ladi, ADR yangilanadi |
| Ruxsat soni boshqarib bo'lmas darajaga chiqdi | `permissions` da > 150 qator yoki bitta route'da > 3 ruxsat → guruhlash/ierarxiya qayta ko'riladi |
| Tenant soni o'sdi va siyosat murakkablashdi | > 10 tenant **va** tenant'ga xos scope qoidalari talab qilindi → ABAC (Casbin/OPA) qayta baholanadi |
| Fail-open real bagga aylandi | Ruxsatsiz route production'ga chiqdi (bitta hodisa yetarli) → `APP_GUARD` + fail-closed **darhol** |
| Auditor yoki mijoz "kim nimaga kirgan" hisobotini so'radi | Ruxsat + resurs ID birga log qilinishi kerak → `audit_logs` kengaytiriladi |

## Havolalar

- [06-auth-and-rbac.md](../06-auth-and-rbac.md) — RBAC to'liq spetsifikatsiyasi
- [03-multi-tenancy.md](../03-multi-tenancy.md) — tenant izolyatsiyasi; bir xil "intizom vs struktura" naqshi
- [04-data-model.md](../04-data-model.md) — `permissions` / `roles` / `role_permissions` / `user_roles`
- [10-security.md](../10-security.md) — xavfsizlik yuzasi
- [ADR-0007](./0007-postgres-as-only-datastore.md) — ruxsat keshi va uning bekor qilinishi
- Kod: `apps/api/src/common/guards/perms.guard.ts`, `apps/api/src/modules/rbac/`
- NIST RBAC modeli (INCITS 359-2012) — rol/ruxsat ajratimi
- Casbin — `RBAC with domains` (rad etilgan alternativa, kelajakda qayta ko'riladi)
