# 10 — Xavfsizlik

> Bog'liq modullar: `auth`, `rbac`, `files`, `students`, `announcements`, `ranking`
> Bog'liq hujjat: `00-vision-and-market.md`
> Status: **audit + spetsifikatsiya**. Bu hujjatdagi har bir da'vo real kodda tekshirilgan.
> Tekshirilgan sana: **2026-07-15**

---

## 0. Bu hujjat nima haqida

MathAcademy — **DEMO EMAS**. U real akademiyada, real xodimlar va real ota-onalar
tomonidan har kuni ishlatiladi. Bazada saqlanadigan narsalar ro'yxati bu hujjatning
ohangini belgilaydi:

| Ma'lumot | Jadval | Nega jiddiy |
|---|---|---|
| Bola ismi, tug'ilgan sanasi, jinsi | `students` | Voyaga yetmagan shaxsni identifikatsiya qiladi |
| Bola surati | `files` (`purpose=STUDENT_PHOTO`) | Yuz tasviri + ism + yosh |
| Yotoqxona xonasi | `student_room_assignments` | **Bola kechasi qayerda uxlashini aytadi** |
| Ota-ona telefoni | `student_accounts.profile_phone` | To'g'ridan-to'g'ri aloqa kanali |
| Intizom yozuvi | `discipline_actions`, `violations` | Bolaga zarar yetkazadigan qoralovchi ma'lumot |
| Xavf skori | `student_risk_scores` | Psixologik/akademik baholash |
| Kirish natijasi | `student_outcomes` | Karyera ma'lumoti |
| To'lov | `invoices`, `payments` | Oilaviy moliyaviy holat |

Oddiy SaaS'da buzilish oqibati — "mijoz g'azablandi". Bu yerda oqibat boshqa:
**yotoqxona xonasi raqami + bola surati + ota-ona telefoni + jadval** birgalikda
bolaga jismoniy zarar yetkazish uchun yetarli ma'lumot to'plami.

Shu sababli bu hujjat "best practice ro'yxati" emas. Har bir bo'limda **aniq fayl,
aniq qator** va **nima bor / nima yo'q** ko'rsatilgan.

### 0.1. ⭐ Bu hujjatning markaziy mavzusi: parol qayerdan keladi?

Auditda ikkita eng jiddiy topilma chiqdi. Ular birinchi qarashda bog'liq emas:

1. `seed.ts` superadmin parolini hardkod qilgan va README uni chop etgan (§2.1-2.5)
2. `students.service.ts:43` o'quvchi parolini **`Math.random()`** bilan yasaydi (§2.6-2.9)

**Lekin ular bir xil ko'r nuqtaning ikki ko'rinishi.**

Loyihada parol **siyosati** bor: `bcrypt` cost 12 (`env.validation.ts:67`),
`MIN_PASSWORD_LENGTH`, `PASSWORD_COMPLEXITY`, brute-force lock (`auth.service.ts:226`).
Ya'ni parol **qanday saqlanadi** va **qanday tekshiriladi** — o'ylangan.

Parol **qayerdan keladi** — o'ylanmagan.

> **Naqsh:** xavfsizlik e'tibori parolning *hayotining o'rtasiga* (saqlash, tekshirish,
> murakkablik) qaratilgan. Uning *tug'ilishi* — generatsiya va yetkazish — e'tibordan
> chetda qolgan. Ikkala teshik ham aynan shu yerda.
>
> Kuchli parol siyosati **noto'g'ri yaratilgan parolni tuzatmaydi**. `MathAdmin@20XX!`
> har qanday siyosatdan o'tadi (§2.3). `Math.random()` yasagan 12 belgilik parol ham
> o'tadi (§2.7). Ikkalasi ham buzilgan.

Bu — xavfsizlikda tez-tez uchraydigan ko'r nuqta va shuning uchun u bu hujjatning
**birinchi ikki bo'limini** egallaydi.

**Hujjat chegarasi:** yuridik masalalarda (bolalar ma'lumoti, ma'lumot lokalizatsiyasi,
§11) bu hujjat **maslahat bermaydi**. U faqat texnik tizim nimani qo'llab-quvvatlashi
kerakligini belgilaydi va qolganini **"yurist savoli"** deb belgilaydi.

---

## 1. Tahdid modeli

### 1.1. Aktivlar

| # | Aktiv | Buzilish oqibati |
|---|---|---|
| A1 | Superadmin hisobi | Tizimning to'liq egallanishi, barcha tenantlar |
| A2 | Bola shaxsiy ma'lumoti (ism, sana, surat, **xona**, manzil) | Qaytarilmas. Bolaga real jismoniy xavf |
| A3 | Ota-ona kontakti | Firibgarlik, ijtimoiy injiniring ("o'g'lingiz kasal, pul yuboring") |
| A4 | Baho / davomat (`assessment_scores`, `attendance_marks`) | Akademik yaxlitlik yo'qoladi |
| A5 | Intizom va xavf yozuvi | Stigma, bolaga zarar |
| A6 | Tenant izolyatsiyasi | Raqib akademiya butun o'quvchi bazasini oladi |
| A7 | `audit_logs` | Nizoda yagona isbot. Yo'qolsa — hujum ko'rinmaydi |
| A8 | Yuklangan fayllar (`/uploads`) | A2 ning fizik ko'rinishi |

### 1.2. Hujumchi profillari — nima bor, nima yo'q

Bular real profillar, nazariy emas.

---

#### H1 — Raqib akademiya (ma'lumot o'g'irlash)

**Motivatsiya:** o'quvchi bazasi = mijoz bazasi. Ism + telefon = to'g'ridan-to'g'ri
"bizga o'ting" qo'ng'irog'i. Bu O'zbekiston o'quv markazlari bozorida real amaliyot.

**Yo'li:** demo hisob oladi yoki xodim yollaydi → tenant izolyatsiyasini sinaydi.

| Himoya | Holat |
|---|---|
| Tenant JWT'dan olinadi, mijoz parametridan emas | ✅ **BOR** |
| 30 servisdan 29 tasi `tenant_id` bilan filtrlaydi | ⚠️ **845 chaqiruv nuqtasida QO'LDA**. Bittasini unutish = teshik |
| `tenant.util.ts` (`withTenantCondition`) | ❌ **O'LIK KOD** — hech qayerda ishlatilmaydi |
| Strukturaviy kafolat (Prisma `$extends`) | ❌ **YO'Q** |
| "A tenanti B'ni o'qiy olmaydi" testi | ❌ **YO'Q** — tizimning eng muhim testi mavjud emas |
| `/uploads` da tenant izolyatsiyasi | ❌ **YO'Q** — §4.4 |

**Xulosa:** himoya **intizomga** tayanadi, strukturaga emas. 845 nuqta ko'z bilan
tekshirilgan va **nol test** bilan qoplangan.

---

#### H2 — O'quvchining o'zi (baho, davomat o'zgartirish)

**Motivatsiya:** juda kuchli. DTM 189 ball = universitet = hayot yo'li. Bu eng ko'p
uriniladigan hujum bo'ladi.

**Yo'li:** guardian hisobi (ota-onasinikini biladi) → API'ni to'g'ridan-to'g'ri chaqiradi.

| Himoya | Holat |
|---|---|
| RBAC ruxsat darajasida (`perms.guard.ts`) | ✅ **BOR va izchil** — §1.5 |
| Guardian'da `assessments.write` yo'q | ✅ **BOR** |
| Guardian login formati taxmin qilinadigan (`mathacademy-MA-0001`) | ⚠️ **HA** — §1.3 |
| Guardian paroli `Math.random()` bilan yasalgan | 🔴 **HA** — §2.6 |
| `audit_logs` — kim bahoni o'zgartirdi | ✅ **BOR** |
| "O'qituvchi FAQAT o'z guruhiga baho qo'yadi" | 🔴 **MAJBURLANMAYDI — VA MAJBURLAB BO'LMAYDI** — §1.6 |
| DTM 189 qoidasi backend'da | ❌ **YO'Q** — faqat frontendda. API `max_score: 500` ni qabul qiladi |

**Xulosa:** rol darajasida himoya **bor va yaxshi**. **Resurs darajasida — yo'q**, va
bu §1.6 da ko'rsatilganidek **sxema muammosi**, guard muammosi emas.

---

#### H3 — Tashqi hujumchi (bolalar ma'lumoti qora bozorda)

**Motivatsiya:** voyaga yetmagan shaxs ma'lumoti qora bozorda kattalarnikidan
qimmatroq — chunki bola kredit tarixini yillar davomida hech kim tekshirmaydi.
Surat + ism + yosh + **manzil** to'plami esa alohida kategoriya.

**Yo'li:** avtomatik skaner → ochiq Swagger → parol spraying yoki fayl yuklash teshigi.

| Himoya | Holat |
|---|---|
| bcrypt cost 12 | ✅ **BOR** |
| Hisob bo'yicha lock (5 urinish/1soat → 3soat) | ✅ **BOR** (`auth.service.ts:232`) |
| **IP bo'yicha** rate limit | ❌ **YO'Q** — §9. Parol spraying ishlaydi |
| Global rate limit (`@nestjs/throttler`) | ❌ **DEPENDENCY YO'Q** — §9 |
| Swagger production'da yopiq | ❌ **YO'Q** — `main.ts:137` shartsiz. §7.3 |
| Xavfsizlik header'lari (helmet) | ❌ **DEPENDENCY YO'Q** — §8 |
| Fayl yuklashda MIME majburlash | ⚠️ **ZAIF** — §4.2 |
| Xatoda stack trace | ✅ **YO'Q** (yaxshi) — §10 |

---

#### H4 — Ichki (xodim) — ruxsatdan tashqari kirish

**Motivatsiya:** qiziquvchanlik ("bu bola qayerda yashaydi?"), o'ch olish, yoki pul
(H1 uni yollagan). Bu **eng qiyin sinf** — u haqiqiy hisob bilan ishlaydi.

| Himoya | Holat |
|---|---|
| `audit_logs` — kim/nima/qachon | ✅ **BOR** (`audit.util.ts`) |
| Ruxsat darajasida ajratish | ✅ **BOR va izchil** — §1.5 |
| **Resurs** darajasida ajratish (o'z guruhi) | 🔴 **YO'Q** — §1.6. Insider uchun eng muhim |
| Audit log append-only (o'chirib bo'lmaydi) | ❌ **TEKSHIRILMAGAN** — DB trigger yo'q |
| Ommaviy o'qishni aniqlash (bitta hisob 500 profil ochdi) | ❌ **YO'Q** — alert yo'q |
| Fayl o'qish auditi (kim qaysi bola suratini ko'rdi) | ❌ **YO'Q** — §4.4 |
| Sessiya limiti (`MAX_SESSIONS_PER_USER=10`) | ❌ **O'LIK ENV** — §3.3 |

**Xulosa:** insider **ko'radi va uni yozib qo'yamiz**, lekin **hech kim o'qimaydi**.
Audit log — faqat hodisadan keyin foydali; hozir uni **kuzatadigan hech narsa yo'q**.

⚠️ Va §1.6 ga ko'ra insider **ruxsat chegarasidan tashqariga chiqishi shart emas** —
uning ruxsati allaqachon butun tenantni qamraydi.

---

### 1.3. Alohida tahdid: guardian login taxmin qilinadi + lockout DoS

Guardian login formati kanonda belgilangan: `<tenant-slug>-<student-id>` →
`mathacademy-MA-0001`, `mathacademy-MA-0002` … `mathacademy-MA-0060`.

Bu **to'liq taxmin qilinadigan**. Ikkita natija:

1. **Parol spraying:** hujumchi 60 ta loginni biladi. Har biriga 4 ta parol sinaydi
   (5 ta lock chegarasidan past) → lock ishlamaydi, chunki lock **hisob bo'yicha**,
   IP bo'yicha emas. Seed'dagi `Ota@1XXXX` kabi parol qolgan bo'lsa — kirdi.
2. **Lockout DoS:** hujumchi har bir loginga 5 marta noto'g'ri parol yuboradi →
   **60 ta ota-ona 3 soatga tizimdan chiqarib tashlanadi**. Xarajat: 300 ta HTTP
   so'rov. Himoya: yo'q.

3. **Parol taxmin qilinadigan:** guardian parollari `Math.random()` bilan yasalgan
   (§2.6). Ya'ni hujumchi parolni **taxmin qilishi shart emas** — u uni **hisoblab
   chiqishi** mumkin. Bu §1.3 ni nazariy hujumdan amaliy hujumga aylantiradi.

**Talab:** §9 dagi IP bo'yicha rate limit birinchi ikkitasini yopadi. Uchinchisi
uchun §2.9 (`crypto.randomInt`) kerak — rate limit uni **yopmaydi**, chunki hujumchi
parolni bilsa, unga **bitta** so'rov yetadi.

Lockout DoS uchun qo'shimcha — lock faqat "shu IP + shu hisob" kombinatsiyasiga
qo'llanilsin, yoki lock o'rniga progressiv kechikish (exponential backoff) ishlatilsin.

---

### 1.4. ⚠️ Tenant enumeration — xato xabari akademiyalar ro'yxatini beradi

Guardian login formati `<tenant-slug>-<student-id>` — ya'ni **tenant slug login
qatorida ochiq turadi**. Savol: hujumchi `aaa-MA-0001`, `bbb-MA-0001` deb sanab,
tizimda **qaysi akademiyalar borligini** aniqlay oladimi?

**Tekshirildi — HA.** Xato xabarlari farq qiladi:

| Holat | Kod | Javob |
|---|---|---|
| Tenant slug mavjud emas | `auth.service.ts:144` | `401 TENANT_NOT_FOUND` |
| Tenant bor, parol xato | `auth.service.ts:560,570` | `401 INVALID_CREDENTIALS` |
| Format noto'g'ri | `auth.service.ts:532` | `401 INVALID_STUDENT_ID_FORMAT` |

Ikkalasi ham `401`, lekin **matn boshqacha**. Ya'ni:

```console
$ curl -d '{"studentId":"aaa-MA-0001","password":"x"}' .../api/auth/guardian/login
{"statusCode":401,"message":"TENANT_NOT_FOUND"}          ← akademiya yo'q

$ curl -d '{"studentId":"mathacademy-MA-0001","password":"x"}' .../api/auth/guardian/login
{"statusCode":401,"message":"INVALID_CREDENTIALS"}       ← akademiya BOR ✓
```

**Nega bu muhim (§1.2 H1 — raqib akademiya):** MathAcademy SaaS'ga aylanganda
(kanon §7) mijozlar ro'yxati — **tijorat siri**. Raqib lug'at bo'yicha slug sanab,
platformadagi **barcha akademiyalarni** aniqlay oladi. Bu H1 ning birinchi qadami:
avval kimga hujum qilishni bilish kerak.

Qo'shimcha: `TENANT_NOT_FOUND` **yagona so'rovda** javob beradi — rate limit bo'lsa ham
(§9), lug'at hujumi sekin, lekin **bajarilishi mumkin**.

**Talab — ENUM-01:** `getTenantIdBySlugOrThrow` (`auth.service.ts:139-146`) login
oqimida **`INVALID_CREDENTIALS`** qaytarsin:

```ts
// auth.service.ts — login oqimi uchun
private async getTenantIdForLogin(tenantSlug: string): Promise<bigint> {
  const t = await this.prisma.tenants.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  // Never reveal whether the tenant exists: the slug is part of the login
  // string, so a distinct error turns login into a tenant directory.
  if (!t) throw new UnauthorizedException('INVALID_CREDENTIALS');
  return t.id;
}
```

⚠️ **To'liq tuzatish uchun yetarli emas** — vaqt bo'yicha farq qoladi. Tenant yo'q
bo'lsa bcrypt **umuman chaqirilmaydi** (~100 ms tejaladi), tenant bor bo'lsa
chaqiriladi. Bu o'lchanadigan farq. **Talab — ENUM-02:** tenant topilmasa ham
**soxta bcrypt taqqoslash** bajarilsin (dummy hash bilan), shunda javob vaqti
bir xil bo'ladi.

⚠️ **Bog'liq bag (auth hujjatida batafsil, bu yerda faqat xavfsizlik burchagi):**
`create-tenant.dto.ts:25` slug'da **tire ruxsat etadi**, `parseGuardianLogin`
(`auth.service.ts:62-72`) esa **birinchi tire** bo'yicha ajratadi. Ya'ni slug
`math-academy` bo'lsa: `math-academy-MA-0001` → tenantSlug=`math`, loginId=
`academy-MA-0001` → `TENANT_NOT_FOUND`. **Bu tenantning barcha ota-onalari
umuman kira olmaydi.** Xavfsizlik burchagi: ENUM-01 dan keyin bu **jimgina**
`INVALID_CREDENTIALS` beradi, ya'ni diagnostika **yanada qiyinlashadi**. Shuning
uchun ikkala tuzatish **birga** qilinsin — slug validatsiyasi tire'ni taqiqlasin
yoki `parseGuardianLogin` slug'ni DB bo'yicha eng uzun moslik bilan topsin.

---

### 1.5. ✅ RBAC — bu tizimning kuchli tomoni (tan olinsin)

Auditda o'lchandi (`apps/api/src` bo'ylab grep):

| Dekorator | Soni |
|---|---|
| `@RequirePermissions` | **234** |
| `@RequireRoles` | **6** |
| Ruxsat e'lon qilmagan route | **0** |

⚠️ **Kanon tuzatildi:** kanon §5.3 `@Roles` / `@Perms` deb yozgan edi. Grep natijasi —
**0 ta**. Real nomlar: `@RequirePermissions` va `@RequireRoles`.

**Bu — jiddiy kuchli tomon va uni tan olish kerak.** 234 ta nuqtada ruxsat e'lon
qilingan va **bitta ham** himoyasiz route yo'q. Bu tenant filtridagi holatdan
(845 qo'lda nuqta, kanon §5.1) **tubdan farq qiladi**: u yerda unutish mumkin va
unutilgan bo'lishi mumkin; bu yerda izchillik **to'liq**.

Ya'ni: *rol → ruxsat* qatlami ishonchli. Muammo keyingi qatlamda — *ruxsat → qaysi
resurs* (§1.6).

---

### 1.6. 🔴 Ma'lumot modeli bo'shlig'i: "o'z guruhi" qoidasini majburlab BO'LMAYDI

Kanon §5.3 buni ochiq savol qilib qoldirgan edi: *"o'qituvchi FAQAT o'z guruhiga
baho qo'ya oladi" qoidasi qanday majburlanadi?*

**Javob: hech qanday. Va hozirgi sxemada bu mumkin emas.**

Sxema tekshirildi (`prisma/schema.prisma`) — `teacher_user_id` **butun sxemada
bitta joyda** uchraydi:

```prisma
// schema.prisma:1080 — timetable_lessons modeli ichida
teacher_user_id BigInt?
users           users?  @relation(fields: [teacher_user_id], references: [id], onUpdate: NoAction)
```

Ya'ni **o'qituvchi ↔ guruh bog'lanishi yo'q**. Bor narsa — o'qituvchi ↔ *dars*
(`timetable_lessons`) bog'lanishi. Va `groups.curator_user_id` — lekin bu kurator,
ya'ni bitta guruhga bitta odam.

**Natija:** `assessments.write` ruxsatiga ega **har qanday** o'qituvchi
**butun tenant bo'ylab, istalgan guruhga** baho qo'ya oladi. Guard'lar buni
to'xtatmaydi — chunki guard `assessments.write` bor-yo'qligini tekshiradi, **qaysi
guruhga** ekanini emas. Va tekshirmoqchi bo'lsa ham — **taqqoslash uchun ma'lumot yo'q**.

**Nega bu §1.2 H2 va H4 uchun hal qiluvchi:**

- **H2 (o'quvchi):** 10 ta o'qituvchidan **bittasining** paroli → butun akademiya
  baholari. Fishing nishoni 10 barobar kengayadi
- **H4 (insider):** o'qituvchi **hech qanday chegarani buzmasdan**, o'zining oddiy
  ruxsati bilan begona guruh bolalarining baholarini, intizom yozuvini va xavf
  skorini ko'radi. Audit logda bu **normal faoliyat** kabi ko'rinadi

**Talab — RBAC-01 (Yuqori):** bu **sxema o'zgarishi**, guard o'zgarishi emas.
Ya'ni migratsiya kerak:

```prisma
// Yangi model — o'qituvchi qaysi guruhda qaysi fanni o'qitadi
model teacher_group_subjects {
  id              BigInt   @id @default(autoincrement())
  tenant_id       BigInt
  teacher_user_id BigInt
  group_id        BigInt
  subject_id      BigInt
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  tenants  tenants  @relation(fields: [tenant_id], references: [id])
  users    users    @relation(fields: [teacher_user_id], references: [id])
  groups   groups   @relation(fields: [group_id], references: [id])
  subjects subjects @relation(fields: [subject_id], references: [id])

  unique([teacher_user_id, group_id, subject_id])
  index([tenant_id, teacher_user_id])
}
```

⚠️ **Migratsiya yo'li** — ishlab turgan tizimni buzmasdan:

| Bosqich | Ish |
|---|---|
| 1 | Model qo'shilsin (migratsiya, `db push` **emas** — kanon §9) |
| 2 | Mavjud `timetable_lessons` dan **to'ldirilsin**: `SELECT DISTINCT teacher_user_id, group_id, subject_id FROM timetable_lessons` — ya'ni "kim nimani o'qityapti" allaqachon **ma'lum**, u shunchaki noto'g'ri joyda turibdi |
| 3 | Tekshiruv **faqat log rejimida** yoqilsin — kim qoidani buzayotganini 2 hafta kuzatilsin, hech narsa bloklanmasin |
| 4 | Log toza bo'lsa → majburlash yoqilsin |

3-bosqich **majburiy**. Darhol bloklash real ishni buzadi: masalan, direktor o'rinbosari
hamma guruhga baho qo'yayotgan bo'lishi mumkin va bu **qonuniy** bo'lishi mumkin.
Buni oldindan bilmasdan bloklash — tizimni ishlamas holga keltirish.

⚠️ Superadmin/admin uchun bu tekshiruv **qo'llanilmasin** — aks holda ular ishlay olmaydi.

---

### 1.7. ⚠️ 18 model `tenant_id` siz — izolyatsiya "ota orqali"

Tenant filtri **845 ta chaqiruv nuqtasida qo'lda** (kanon §5.1 buni 176 deb
sanagan — `findFirst` hisobga olinmagan). Auditda bundan ham nozikroq muammo
topildi: **18 ta model'da `tenant_id` ustuni umuman yo'q**.

Ular tenantga **ota (parent) orqali** yetadi:

| Model | Tenantga qanday yetadi |
|---|---|
| `assessment_scores` | → `assessments.tenant_id` |
| `attendance_marks` | → `attendance_sessions.tenant_id` |
| `timetable_lessons` | → `timetable.tenant_id` |
| `dorm_rooms` | → `dorms.tenant_id` |
| `role_permissions`, `user_roles`, `group_subjects`, `student_cohort`, `event_participants`, `competition_entries`, `competition_results`, `award_recipients`, `grade_snapshot_rows`, va boshqalar | → ota model |

**Nega bu xavfli:** `assessment_scores` bo'yicha **to'g'ridan-to'g'ri** so'rov
tenant filtri **bo'lmasligi mumkin** — va TypeScript buni **xato deb ko'rsatmaydi**,
chunki `where: { student_id }` mukammal to'g'ri Prisma so'rovi. Filtr yo'qligi
**jimgina** o'tadi.

Ya'ni kanon §5.1 dagi muammo bu modellarda **kuchayadi**: `students` da `tenant_id`
ni unutish ko'zga tashlanadi (chunki qo'shni qatorlarda u bor), `assessment_scores`
da esa **unutish uchun hech narsa yo'q** — ustunning o'zi mavjud emas.

#### Real misol — topildi

`students/guardian-student.controller.ts:161-169`:

```ts
const grades = await this.studentsService['prisma'].assessment_scores.findMany({
  where: {
    student_id: account.student_id,
    assessments: { is_published_to_guardians: true },
  },
  // ...
  take: 50,
});
```

**Ikkita alohida muammo:**

**1. `tenant_id` filtri yo'q.** So'rov faqat `student_id` bo'yicha.

⚠️ **Halol baho: bu hozir ekspluatatsiya QILINMAYDI.** Sabab — `student_id`
ishonchli zanjirdan keladi:

```
JWT → user.studentAccountId → student_accounts.findUnique({ id })
                            → account.student_id → assessment_scores
```

JWT'dagi `studentAccountId` server tomonidan qo'yilgan, mijoz uni o'zgartira olmaydi.
Ya'ni izolyatsiya **buzilmagan** — u **tasodifan** to'g'ri.

Lekin kafolat **filtrda emas, zanjirning uzunligida**. Bu — kanon §5.1 aytgan
muammoning aynan o'zi: *kafolat intizomga tayanadi*. Zanjirga bitta bo'g'in
qo'shilsa yoki `student_id` biror kun query paramdan olinsa — **IDOR**. Va buni
hech qanday test ushlamaydi (testlar yo'q).

⚠️ Yon eslatma: `guardian-student.controller.ts:151-156` dagi
`student_accounts.findUnique({ where: { id: BigInt(studentAccountId) } })` da ham
`tenant_id` yo'q. Bu ham JWT'dan keladi, ya'ni ayni damda xavfsiz.

**2. 🔴 Bracket notation bilan `private` maydonga kirish.**

```ts
this.studentsService['prisma']
```

`prisma` — `StudentsService` ning **private** maydoni. `['prisma']` — bu
TypeScript'ning private tekshiruvini **chetlab o'tish** usuli. Ya'ni controller
servis qatlamini **butunlay aylanib o'tib**, DB'ga to'g'ridan-to'g'ri boradi.

Bu **4 ta joyda** uchraydi (grep):

| Fayl:qator | So'rov |
|---|---|
| `guardian-student.controller.ts:163` | `assessment_scores.findMany` — **baholar** |
| `guardian-student.controller.ts:465` | `violations.findMany` — **intizom** |
| `guardian-student.controller.ts:558` | `invoices.findMany` — **to'lovlar** |
| `guardian-student.controller.ts:887,902` | `students.findUnique`, `timetable.findFirst` |

**Nega bu xavfsizlik muammosi, uslub muammosi emas:** kanon §5.1 ning yechimi —
**Prisma client extension** (`$extends`) tenant filtrini **ma'lumot qatlamida**
avtomatik qo'shish. Bu to'g'ri yechim.

⚠️ **Lekin `$extends` `PrismaService` ga qo'llanadi.** Agar controller
`service['prisma']` orqali **o'sha** klientga kirsa — extension **ishlaydi** (chunki
bu bir xil obyekt). Ya'ni bu holatda `$extends` uni **qutqaradi**.

Muammo boshqacha: bu naqsh **arxitektura chegarasini buzadi** va u **ko'payadi**.
Bugun 4 ta joy; kimdir `new PrismaClient()` yozsa yoki extension'siz klient
ishlatsa — extension **chetlab o'tiladi** va bu **jimgina** sodir bo'ladi.
Ya'ni kanon §5.1 ning markaziy yechimi **teshik bilan yetkaziladi**.

**Talab — ISO-01:** `['prisma']` naqshi **taqiqlansin**:

```js
// eslint.config.mjs
{
  rules: {
    'no-restricted-syntax': ['error', {
      // Bracket notation defeats TS private checks and lets controllers reach
      // the DB directly, bypassing the service layer where tenant scoping lives.
      selector: "MemberExpression[computed=true][property.value='prisma']",
      message:
        "Do not reach into a service's private prisma client. Add a method to " +
        'the service instead — tenant scoping belongs in the data layer.',
    }],
  },
}
```

⚠️ Bu qoida **4 ta mavjud joyni darhol buzadi**. Shuning uchun: avval o'sha 4 ta
so'rov `StudentsService` ga metod sifatida ko'chirilsin (tenant filtri bilan),
keyin qoida yoqilsin.

**Talab — ISO-02:** `$extends` (kanon §5.1) joriy qilinganda, u **`tenant_id`
ustuni yo'q 18 model uchun ishlamasligi** hisobga olinsin. Extension `where` ga
`tenant_id` qo'sha olmaydi — bunday ustun yo'q. Bu modellar uchun **ota orqali
filtr** kerak:

```ts
// assessment_scores uchun extension tenant_id qo'sha olmaydi — u yerda
// bunday ustun yo'q. Ota orqali filtrlash kerak:
where: {
  student_id: ...,
  assessments: { tenant_id: tenantId },   // ota orqali
}
```

⚠️ Bu — `$extends` yechimini rejalashtirishda **hisobga olinishi shart bo'lgan
cheklov**. 69 modeldan 18 tasi (**~26%**) avtomatik himoyadan **tashqarida
qoladi** va ular orasida eng noziklari bor: `assessment_scores` (baholar) va
`attendance_marks` (davomat).

**Talab — ISO-03 (eng ishonchli, lekin qimmat):** uzoq muddatda PostgreSQL
**Row-Level Security (RLS)** ko'rib chiqilsin. RLS DB darajasida ishlaydi, ya'ni
ORM'ni aylanib o'tish **imkonsiz**. ⚠️ Lekin bu 69 model uchun katta ish va
`$extends` dan **keyin** ko'rib chiqilsin, undan oldin emas.

---

## 2. ⚠️ Parollarning kelib chiqishi — ikkita real teshik

> Bu bo'lim bu hujjatning eng qimmatli qismi, chunki u **faraz emas**. Ikkala teshik
> ham shu repoda, shu loyihada real mavjud va git tarixida isboti bor.
>
> §2.1-2.5 — `seed.ts` hodisasi (tuzatilgan, lekin qoldig'i bor).
> §2.6-2.9 — `Math.random()` bilan parol generatsiyasi (**hali tuzatilmagan**).
>
> §0.1 da aytilganidek — bu ikkalasi **bir xil ko'r nuqta**.

### 2.1. Nima bo'lgan

`prisma/seed.ts` superadmin parolini kodda hardkod qilgan edi:

```ts
// ESKI KOD — endi yo'q
const adminPw = await hash('MathAdmin@20XX!');
const admin = await upsertUser('admin', adminPw, 'Adminov Superadmin');
await assignRole(admin.id, superadminRole.id);   // ← SUPERADMIN
```

Bu o'z-o'zidan hali falokat emas. Falokat — **uch narsaning birikmasi**:

1. **Parol kodda** edi (`seed.ts`)
2. **README uni chop etgan** edi — public repoda (`github.com/Sarvarbek0704/mathacademy`),
   chiroyli jadval ko'rinishida: login | parol | rol
3. **`seed:prod` skripti** `package.json` da bor edi va **o'sha seed'ni** ishga tushirardi

### 2.2. Zanjir

```
Public README (github.com/Sarvarbek0704/mathacademy)
        │
        │  «SUPERADMIN | admin | MathAdmin@20XX!»
        ▼
   Parol ma'lum
        │
        │  npm run seed:prod
        ▼
Production DB'da `admin` hisobi shu parol bilan yaratiladi
        │
        ▼
   Repo o'qigan HAR KIM = superadmin
        │
        ▼
60 ta bola: ism, tug'ilgan sana, surat, YOTOQXONA XONASI, ota-ona telefoni
```

Hujum uchun kerak bo'lgan malaka: **README'ni o'qish**.

### 2.3. Asosiy sabab — bu yerda diqqat qiling

Oson xulosa: *"parol zaif edi, kuchli parol qo'yish kerak"*. **Bu xulosa noto'g'ri.**

`MathAdmin@20XX!` — 15 belgi, katta/kichik harf, raqam, maxsus belgi. Har qanday
parol siyosati uni **o'tkazadi**. Brute-force bilan buzish deyarli imkonsiz.

Parolning kuchi **umuman ahamiyatsiz** edi, chunki uni **taxmin qilish shart emas edi** —
u chop etilgan edi.

> **Saboq:** xavf **zaif parol** emas edi.
> Xavf — parolni **yetib boradigan qilgan qulaylik skripti**.
>
> `seed:prod` — "productionni tez to'ldirish" uchun yozilgan foydali qulaylik. Aynan
> shu qulaylik ommaviy ma'lum sirni imtiyozli muhitga **yetkazib beruvchi kanal**ga
> aylandi. Sir + kanal = buzilish. Sirning kuchi kanalning mavjudligini qoplamaydi.

Bu naqsh takrorlanadi. Har safar "tez qilish uchun" skript yozilganda savol shu:
**bu skript nimani qayerga yetkazadi?**

### 2.4. Tuzatish — nima qilindi

Tuzatish commit'i: `10c67c7` — *"security: stop publishing seed passwords, guard the
seed against production"*.

**1. Production'da abort** (`seed.ts:47-58`):

```ts
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION && process.env.ALLOW_SEED !== 'true') {
  console.error('\n❌ Refusing to seed: NODE_ENV=production.\n' + ...);
  process.exit(1);
}
```

**2. Parollar env'dan, production'da fallback yo'q** (`seed.ts:67-79`):

```ts
function seedPassword(envKey: string, devFallback: string): string {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  if (IS_PRODUCTION) {
    console.error(`\n❌ ${envKey} is not set.\n` + ...);
    process.exit(1);
  }
  return devFallback;   // faqat local/demo
}
```

**3. ⭐ Tekshiruv birinchi DB yozuvidan OLDIN** (`seed.ts:89-94`) — bu eng nozik detal:

```ts
// Module yuklanishida hal qilinadi — DB ishidan OLDIN
const SEED_PASSWORDS = {
  admin:    seedPassword('SEED_ADMIN_PASSWORD', 'MathAdmin@20XX!'),
  demo:     seedPassword('SEED_DEMO_PASSWORD', 'Demo@1XXX'),
  teacher:  seedPassword('SEED_TEACHER_PASSWORD', 'Ustoz@20XX!'),
  guardian: seedPassword('SEED_GUARDIAN_PASSWORD', 'Ota@1XXXX'),
} as const;
```

**Nega bu muhim?** Avvalgi revizyada bu `main()` **ichida** edi. Ketma-ketlik shunday
bo'lardi:

```
main() boshlanadi
  → tenant yoziladi          ✅ DB'ga yozildi
  → 60 ta permission yoziladi ✅ DB'ga yozildi
  → rollar yoziladi           ✅ DB'ga yozildi
  → seedPassword('SEED_ADMIN_PASSWORD')  ← ❌ ENDI abort
  → process.exit(1)
```

Natija — **yarim-seed qilingan baza**: tenant bor, rollar bor, lekin **hech qanday
foydalanuvchi yo'q**. Nomuvofiq holat, qo'lda tozalash talab qiladi. Endi tekshiruv
modul yuklanishida bo'lgani uchun operatsiya **hammasi-yoki-hech-narsa**.

**4. `seed:prod` o'chirildi.** `package.json:22` da endi buning o'rniga izoh turadi:

```json
"//seed:note": "There is deliberately no seed:prod script. ..."
```

`render.yaml:7` da deploy buyrug'i: `npx prisma migrate deploy && node dist/main` —
seed yo'q. ✅

**5. README tuzatildi.** Endi parol jadvali o'rniga hodisaning halol tavsifi turadi
(`README.md:235`).

**6. Seed loglari faqat loginlarni chop etadi** (`seed.ts:1271-1280`), parollarni emas.

### 2.5. ⚠️ HALI QILINMAGAN — parol git tarixida qoldi

Bu bo'limning eng muhim jumlasi.

Tuzatish commit'i parolni **hozirgi kod**dan olib tashladi. U parolni **tarix**dan
olib tashlamadi. Tekshirildi:

```console
$ git log --all -S "<eski-parol>" --oneline
10c67c7 security: stop publishing seed passwords, guard the seed against production
5255383 docs: add comprehensive README.md
6fc2cc4 feat: production seed, render.yaml, api fixes, and seed:prod script
```

**Uchta commit.** Ular hali ham public repoda. Ya'ni:

```console
$ git clone https://github.com/Sarvarbek0704/mathacademy
$ cd mathacademy
$ git show 6fc2cc4 | grep -i "MathAdmin"
```

— va parol ekranda. Xuddi shu holat `Ustoz@20XX!`, `Ota@1XXXX`, `Demo@1XXX` uchun ham.

> **Qoida:** git'ga tushgan sir — **abadiy oshkor**. Uni "olib tashlash" degan narsa
> yo'q. Yagona to'g'ri javob — **rotatsiya**.

**Talab — RS-01 (Kritik, boshqa hamma narsadan oldin):**

1. **Rotatsiya.** Agar production'da `admin` hisobi shu parol bilan mavjud bo'lsa —
   **darhol** o'zgartirilsin. Bu birinchi qadam, `git filter-repo` emas.
2. `SEED_*` qiymatlari Render env'ga `openssl rand -base64 32` bilan generatsiya
   qilib qo'yilsin.
3. `auth_attempts` jadvali tekshirilsin: `admin` hisobiga muvaffaqiyatli login bo'lganmi,
   qaysi IP'dan, qachon. Bu — teshik **ishlatilganmi yoki yo'qmi** degan savolga
   yagona javob manbai.
4. **Faqat shundan keyin** tarixni tozalash muhokama qilinsin (`git filter-repo`).
   ⚠️ Bu barcha commit SHA'larini o'zgartiradi va fork/clone'lardagi nusxalarni
   o'chirmaydi. Shuning uchun bu **ikkinchi darajali** chora — rotatsiya birinchi.

**Ochiq savol:** production DB hozir mavjudmi va unda `admin` hisobi shu parol bilanmi?
Bu **tekshirilishi shart** va javob shu hujjatga yozilishi kerak.

---

### 2.6. 🔴 Ikkinchi teshik: `Math.random()` bilan parol — HALI OCHIQ

`seed.ts` teshigi tuzatilgan. Bu — **tuzatilmagan** va u har kuni ishlayapti.

`students.service.ts:37-46`:

```ts
function generateTemporaryPassword(): string {
  // 12 character password with mix of letters, numbers, symbols
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

**Grep qilindi — bu bitta joyda emas. Uchta faylda:**

| Fayl | Qator | Funksiya | Nima uchun parol |
|---|---|---|---|
| `students.service.ts` | **43** | `generateTemporaryPassword()` | **Guardian hisobi** (bola profiliga kalit) |
| `auth.service.ts` | **1483** | `generateRandomPassword(length = 12)` | Parol tiklash oqimi |
| `users.service.ts` | **28** | (inline) | **Xodim hisobi** — teacher, admin |

Va `students.service.ts` dagi funksiya **uch joyda** chaqiriladi:

| Qator | Kontekst |
|---|---|
| `students.service.ts:380` | Yangi o'quvchi yaratilganda → guardian hisobi |
| `students.service.ts:1330` | Parolni qayta tiklash |
| `students.service.ts:1451` | Ommaviy (bulk) yaratish |

Ya'ni **tizimdagi deyarli har bir avtomatik yaratilgan parol** — guardian, xodim,
o'qituvchi, va parol tiklash — `Math.random()` dan keladi.

### 2.7. Nega bu jiddiy — parol "kuchli" ko'rinsa ham

Yaratilgan parol: 12 belgi, 70 belgili alifbodan. Nazariy entropiya:
`log₂(70¹²) ≈ 73.6 bit`. Har qanday parol siyosatidan o'tadi. Brute-force bilan
buzib bo'lmaydi.

**Real entropiya — 0 bit** (hujumchi chiqishni ko'rgan bo'lsa).

Sabab: `Math.random()` — **CSPRNG emas**. V8'da u **xorshift128+** algoritmi bilan
amalga oshirilgan. Bu — tez, sifatli statistik generator, lekin u **kriptografik
maqsad uchun mo'ljallanmagan** va V8 hujjatlari buni ochiq aytadi.

**Nima buzilgan:** xorshift128+ ning ichki holati — **128 bit**, va u **oshkora**.
Chiqishlar shu holatning determinatsiyalangan funksiyasi. Bir necha chiqishni ko'rgan
hujumchi (odatda 3-5 ta 64-bitlik qiymat yetarli) holatni **tiklab oladi** — bu
yechilgan masala, ochiq vositalar mavjud. Holat ma'lum bo'lsa:

- **Keyingi** barcha qiymatlar hisoblanadi
- **Oldingi** qiymatlar ham hisoblanadi (xorshift teskari aylantiriladi)

Ya'ni parol taxmin qilinmaydi — u **hisoblab chiqiladi**. Bitta urinishda.
§9 dagi rate limit bunga **umuman ta'sir qilmaydi**.

### 2.8. Real ssenariy — bu nazariy emas

```
1. Hujumchi o'z farzandini akademiyaga yozdiradi (yoki mavjud ota-ona)
     → students.service.ts:380 → generateTemporaryPassword() → parol MA-0042 uchun
     → hujumchi bu parolni QONUNIY ravishda oladi (bu uning paroli)

2. Hujumchi "parolni tiklash" ni bir necha marta so'raydi
     → students.service.ts:1330 → yana chiqishlar
     → endi uning qo'lida bir nechta ketma-ket Math.random() natijasi

3. Xorshift128+ holati tiklanadi

4. Hujumchi hisoblaydi: o'sha sessiyada yaratilgan BOSHQA o'quvchilar parollari
     → ommaviy import (students.service.ts:1451) BIR sikldа 60 ta parol yasaydi
     → ya'ni BITTA holat tiklanishi 60 ta oilaning parolini beradi

5. Har bir parol = bola profiliga to'liq kirish:
     ism · tug'ilgan sana · SURAT · YOTOQXONA XONASI · ota-ona telefoni ·
     intizom yozuvi · xavf skori · jadval (bola qachon qayerda)
```

⚠️ **4-qadam ayniqsa yomon.** `students.service.ts:1451` — ommaviy yaratish.
Ya'ni 60 ta o'quvchi **bitta sikl ichida**, **bitta `Math.random()` oqimidan**
parol oladi. Bu hujumchi uchun ideal holat: ketma-ket chiqishlar, uzilishsiz.
Bitta ota-ona **butun sinfning** parolini oladi.

⚠️ **`users.service.ts:28` yanada yomonroq** — bu **xodim** paroli. Ya'ni bu yo'l
bilan hisoblangan parol **o'qituvchi** hisobiga olib boradi, va §1.6 ga ko'ra
o'qituvchi **butun tenant** bo'ylab ma'lumot ko'radi.

**Bu §2.3 saboqning aynan takrori:** parolning kuchi (73.6 bit!) ahamiyatsiz, chunki
uni **taxmin qilish shart emas**. Seed'da u chop etilgan edi; bu yerda u **hisoblanadi**.
Ikkala holatda ham parol siyosati **to'g'ri ishlagan va hech narsani himoya qilmagan**.

### 2.9. Talab — PWD-01 (Kritik)

Node.js'da to'g'ri javob standart kutubxonada — qo'shimcha dependency **kerak emas**:

```ts
// apps/api/src/common/utils/password.util.ts — YANGI, yagona manba
import { randomInt } from 'crypto';

const PASSWORD_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

/**
 * Generates a temporary password using the OS CSPRNG.
 *
 * Math.random() must never be used here: V8 implements it with xorshift128+,
 * whose 128-bit state can be recovered from a handful of observed outputs —
 * after which every past and future password is computable. A parent who
 * legitimately receives one password could derive the passwords of every
 * other account created in the same batch (students.service.ts:1451).
 *
 * randomInt() is rejection-sampled, so it has no modulo bias.
 */
export function generateTemporaryPassword(length = 16): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}
```

**Nega `randomInt`, `randomBytes` emas:** `randomBytes` bilan ham to'g'ri qilish
mumkin, lekin `bytes[i] % 70` yozish **modulo bias** kiritadi (256 70 ga bo'linmaydi
— birinchi 46 ta belgi biroz ko'proq chiqadi). `randomInt` **rejection sampling**
ishlatadi va bu xatoni tuzatib bo'lmaydigan darajada osonlashtirmaydi. Ikkalasi ham
CSPRNG, lekin `randomInt` — noto'g'ri ishlatish qiyinroq bo'lgan API.

⚠️ `length = 16` — 12 emas. Bu vaqtinchalik parol, uni odam yodlamaydi.

**Bajarilishi kerak — uchala nusxa ham:**

| # | Fayl | Ish |
|---|---|---|
| 1 | `common/utils/password.util.ts` | Yaratilsin (yuqoridagi kod) |
| 2 | `students.service.ts:37-46` | O'chirilsin → `password.util` dan import |
| 3 | `auth.service.ts:1478-1486` | O'chirilsin → `password.util` dan import |
| 4 | `users.service.ts:28` | O'chirilsin → `password.util` dan import |

⚠️ **Uchala joy ham** tuzatilsin. Bittasini qoldirish — teshikni ochiq qoldirish,
chunki hujumchi **istalgan** oqimdan chiqish yig'ishi mumkin.

⚠️ **PWD-02 — mavjud parollar rotatsiyasi.** PWD-01 faqat **yangi** parollarni
tuzatadi. `Math.random()` bilan yasalgan **mavjud** parollar hali ham bazada.
Ular hisoblanadigan bo'lib qoladi. Ya'ni:

- Barcha `student_accounts` va `users` uchun `must_change_password: true` qo'yilsin
  (bu maydon `student_accounts` da **allaqachon bor** — `seed.ts:669` da ishlatilgan)
- Yoki barcha vaqtinchalik parollar qayta yaratilsin va tarqatilsin

Bu — tashkiliy qaror. ⚠️ Lekin **PWD-01 siz PWD-02 ning ma'nosi yo'q** (yangi
parollar ham buzuq bo'ladi), va **PWD-02 siz PWD-01 to'liq emas** (eski parollar
qoladi). Ikkalasi birga.

**Talab — PWD-03 (arzon, kelajakni himoya qiladi):** ESLint qoidasi:

```js
// eslint.config.mjs
{
  rules: {
    'no-restricted-properties': ['error', {
      object: 'Math',
      property: 'random',
      message:
        'Math.random() is not a CSPRNG (V8 uses xorshift128+; its state is ' +
        'recoverable from a few outputs). For anything security-relevant use ' +
        'crypto.randomInt() — see common/utils/password.util.ts.',
    }],
  },
}
```

⚠️ Bu qoida `seed.ts` dagi deterministik `randScore()` ni **buzmaydi** — u
`Math.random()` ishlatmaydi (`seed.ts:221-224` — u `idx` asosidagi qasddan
deterministik funksiya). Ya'ni qoida hozir **faqat** haqiqiy 3 ta muammoli
joyni belgilaydi.

---

## 3. Sirlar (secrets) boshqaruvi

### 3.1. Hozirgi holat

| Element | Holat |
|---|---|
| `.env` git'da ignore qilingan | ✅ `.gitignore:4` — `.env` |
| Repoda `.env` fayli kuzatilyaptimi | ✅ **YO'Q** (`git ls-files` → faqat `.env.example`) |
| `.env.example` da real sir bormi | ⚠️ **Placeholder**, lekin xavfli: `JWT_ACCESS_SECRET="jwt_access"` |
| Production sirlari | Render env vars (`render.yaml`) |
| JWT sirlari production'da | ✅ `generateValue: true` — Render generatsiya qiladi (`render.yaml:17-20`) |
| Sir skaneri (gitleaks/trufflehog) | ❌ **YO'Q** |
| CI | ❌ **YO'Q** — `.github/` katalogi mavjud emas |

### 3.2. `.env.example` — ikki muammo

**1-muammo:** `JWT_ACCESS_SECRET="jwt_access"` va `JWT_REFRESH_SECRET="jwt_secret"`.
Bular `cp .env.example .env` qilgan har bir dasturchida qoladi. `env.validation.ts:48`
faqat `@IsString()` tekshiradi — **uzunlik yoki entropiya tekshiruvi yo'q**.

Agar kimdir `.env` ni production'ga ko'chirsa, JWT `"jwt_access"` bilan imzolanadi —
ya'ni **istalgan odam superadmin token yasay oladi**. Render `generateValue: true`
buni hozir qoplaydi, lekin himoya **deploy platformasiga** tayanadi, kodga emas.

**Talab — SEC-01:** `env.validation.ts` ga production tekshiruvi qo'shilsin:

```ts
// apps/api/src/common/config/env.validation.ts
const WEAK_SECRETS = new Set(['jwt_access', 'jwt_secret', 'secret', 'changeme']);

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) throw new Error(errors.toString());

  if (validatedConfig.NODE_ENV === Environment.Production) {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const v = validatedConfig[key];
      if (v.length < 32 || WEAK_SECRETS.has(v.toLowerCase())) {
        throw new Error(
          `${key} is weak or a placeholder. Generate one: openssl rand -base64 64`,
        );
      }
    }
    if (validatedConfig.JWT_ACCESS_SECRET === validatedConfig.JWT_REFRESH_SECRET) {
      // .env.example:19 buni ogohlantiradi, lekin hech narsa majburlamaydi
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
  }

  return validatedConfig;
}
```

Oxirgi tekshiruvning sababi `.env.example:19-20` da yozilgan: agar ikkala sir bir xil
bo'lsa, **access token'ni refresh token sifatida qayta ishlatish mumkin**. Hozir bu
faqat izoh — hech narsa uni majburlamaydi.

**2-muammo:** `.env.example:23` — `ACCESS_TOKEN_TTL="15h"`. Bu **15 soat**.

| Manba | Qiymat |
|---|---|
| `.env.example:23` | `15h` |
| `env.validation.ts:54` (default) | `15m` |
| `auth.service.ts:89` (fallback) | `15m` |
| `render.yaml:22` (production) | `15m` |

Production'da **15 daqiqa** (`render.yaml` g'olib). Ya'ni real xavf yo'q, lekin
`.env.example` — bu dasturchi ko'chiradigan fayl, ya'ni **har bir dev muhitida
15 soatlik token**. O'g'irlangan token 15 soat yashaydi.

**Talab — SEC-02:** `.env.example:23` → `ACCESS_TOKEN_TTL="15m"`. Bir belgilik tuzatish.

### 3.3. ⚠️ O'lik env — konfiguratsiya yolg'on gapiryapti

Bu §9 dagi rate limit muammosining kattaroq ko'rinishi. Grep qilindi — quyidagi
kalitlar `.env.example` va `render.yaml` da **bor**, lekin `apps/api/src/` da
**hech qayerda o'qilmaydi**:

| Env kaliti | `.env.example` | `render.yaml` | Kodda o'quvchi |
|---|---|---|---|
| `ENABLE_CORS` | `true` | `true` | ❌ **NOL** |
| `ENABLE_SWAGGER` | `true` | **`false`** | ❌ **NOL** ← §7.3 |
| `RATE_LIMIT_TTL` | `60` | `60` | ❌ **NOL** |
| `RATE_LIMIT_MAX` | `100` | `100` | ❌ **NOL** |
| `MIN_PASSWORD_LENGTH` | `6` | `6` | ❌ **NOL** |
| `PASSWORD_COMPLEXITY` | `true` | `true` | ❌ **NOL** |
| `MAX_SESSIONS_PER_USER` | `10` | `10` | ❌ **NOL** |
| `SESSION_INACTIVITY_TIMEOUT` | `86400` | `86400` | ❌ **NOL** |
| `COOKIE_SECURE` | `false` | `true` | ❌ **NOL** — `NODE_ENV` dan olinadi |
| `COOKIE_SAME_SITE` | `lax` | — | ❌ **NOL** |
| `COOKIE_DOMAIN` | `localhost` | — | ❌ **NOL** |
| `ALLOWED_UPLOAD_MIME` | ❌ yo'q | ❌ yo'q | ✅ `files.storage.ts:43` |

**11 ta kalitdan 11 tasi o'lik.** Va oxirgi qator teskari muammo: `ALLOWED_UPLOAD_MIME`
kodda **o'qiladi**, lekin hech qayerda **hujjatlashtirilmagan**.

Bu `tenant.util.ts` bilan bir xil naqsh (kanon §5.1): **himoyaga o'xshagan o'lik kod
himoyasizlikdan yomonroq**, chunki u tekshiruvchini ishontiradi. `render.yaml:31` da
`ENABLE_SWAGGER: false` yozilgan — kod reviewda bu "Swagger production'da yopiq"
degan taassurot qoldiradi. **U ochiq** (§7.3).

**Talab — SEC-03:** har bir env kaliti uchun **ikkitadan biri**:
1. Kodda o'qilsin va majburlansin, **yoki**
2. `.env.example` va `render.yaml` dan **o'chirilsin**.

Uchinchi variant (hozirgi holat — "bor, lekin ishlamaydi") qabul qilinmaydi.
`ALLOWED_UPLOAD_MIME` esa `.env.example` ga qo'shilsin.

### 3.4. Sir skaneri — CI'ga qo'shish

Hozir sirni git'ga tushishidan **hech narsa to'xtatmaydi**. §2 aynan shunday sodir
bo'lgan. Ikki qatlam kerak:

**1-qatlam — tarixni bir marta tekshirish** (hozir, qo'lda):

```bash
# gitleaks — butun tarix bo'ylab
docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks:latest \
  detect --source=/repo --report-format=json --report-path=/repo/gitleaks-report.json

# trufflehog — ikkinchi fikr; u topilmani "verified" deb tasdiqlaydi
docker run --rm -v "$(pwd):/repo" trufflesecurity/trufflehog:latest \
  git file:///repo --only-verified
```

⚠️ **Kutilayotgan natija:** ikkalasi ham `6fc2cc4`, `5255383`, `10c67c7` commitlarida
seed parollarini topadi (§2.5). Bu **kutilgan** — u yerda haqiqatan sir bor. Topilma
`.gitleaksignore` ga yozilmasin; u **RS-01 rotatsiyasi bajarilgach** yopiladi.

**2-qatlam — har PR'da** (`.github/workflows/security.yml`):

```yaml
name: security
on: [push, pull_request]

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # butun tarix — shartsiz kerak
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`fetch-depth: 0` — bu **majburiy**. Standart `fetch-depth: 1` faqat oxirgi commit'ni
oladi va gitleaks hech narsa topmaydi. Ya'ni CI yashil bo'ladi va hech narsani
tekshirmaydi — yana bir "himoyaga o'xshagan" narsa.

---

## 4. ⚠️ Fayl yuklash — audit

Bu bo'lim alohida jiddiy, chunki `purpose=STUDENT_PHOTO` — **bolalar surati**.

Tekshirilgan fayllar: `files.storage.ts`, `files.service.ts`, `files.controller.ts`,
`guardian-files.controller.ts`, `main.ts:57-66`.

### 4.1. Fayl nomi sanitizatsiyasi — ✅ TO'G'RI

`../../etc/passwd` ishlaydimi? **Yo'q.** Sabab (`files.storage.ts:84-87`):

```ts
const ext = extname(args.originalName || '').slice(0, 10);
const stored = `${Date.now()}_${randomUUID()}${ext || ''}`;
const diskPath = join(sub, stored);
```

Foydalanuvchi nomi **umuman ishlatilmaydi** — fayl `1736899200000_a3f8...uuid.jpg`
nomi bilan saqlanadi. Path traversal uchun joy yo'q. Katalog segmentlari ham
tozalanadi (`safeSegment`, `files.storage.ts:33-38`):

```ts
function safeSegment(v: string): string {
  return String(v || '').trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
}
```

`/` va `\` → `_`. ✅ **Bu to'g'ri yozilgan. Buzmang.**

⚠️ Bitta nuqta: `safeSegment` `.` ni ruxsat etadi, ya'ni `..` segment sifatida o'tadi.
Lekin `ownerType`/`ownerId`/`purpose` `..` bo'lishi uchun `toBigInt()` va DTO
validatsiyasidan o'tishi kerak — `ownerId` faqat raqam (`files.service.ts:18-23`).
Amalda ekspluatatsiya qilinmaydi, lekin **chuqur himoya** uchun tuzatilsin:

```ts
function safeSegment(v: string): string {
  const s = String(v || '').trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
  return s === '.' || s === '..' ? '_' : s;   // qo'shilsin
}
```

### 4.2. ⚠️ MIME tekshiruvi — ZAIF (2 ta teshik)

`files.storage.ts:40-50`:

```ts
export function assertAllowedMime(mime?: string) {
  const m = String(mime || '').trim().toLowerCase();
  if (!m) return;                                    // ← TESHIK #1
  const allowed = (process.env.ALLOWED_UPLOAD_MIME || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const set = allowed.length ? new Set(allowed) : DEFAULT_ALLOWED_MIME;
  if (!set.has(m)) throw new BadRequestException('UNSUPPORTED_FILE_TYPE');
}
```

**Teshik #1 — bo'sh MIME = tekshiruvsiz o'tish.** `if (!m) return;` — agar
`Content-Type` yuborilmasa, funksiya **hech narsa tekshirmasdan qaytadi**. Fail-open.

**Teshik #2 — MIME mijozdan keladi.** `files.service.ts:440` da:

```ts
mimeType: args.file.mimetype,   // ← multer buni Content-Type header'idan oladi
```

`file.mimetype` — bu **mijoz yuborgan** `Content-Type` qiymati. Server faylning
**mazmunini** tekshirmaydi. Ya'ni:

```console
$ curl -X POST https://api.../api/staff/files/upload \
    -H "Authorization: Bearer <token>" \
    -F "ownerType=STUDENT" \
    -F "fileName=payload.html" \
    -F "file=@evil.html;type=image/png"
                        ^^^^^^^^^^^^^^ yolg'on MIME — tekshiruv o'tadi
```

`assertAllowedMime('image/png')` → o'tadi. Keyin `extname('payload.html')` → `.html`.
Fayl `1736899200000_uuid.html` nomi bilan diskka yoziladi.

**Kengaytma umuman tekshirilmaydi.** Bu §4.3 bilan birlashganda stored XSS beradi.

**Talab — FILE-01:**

```ts
// apps/api/src/modules/files/files.storage.ts
import { fileTypeFromBuffer } from 'file-type';   // yangi dependency

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
  'application/pdf': '.pdf',
};

/**
 * Resolves the real MIME by sniffing magic bytes. The client-supplied
 * Content-Type is advisory only — it is attacker-controlled.
 */
export async function resolveVerifiedMime(buffer: Buffer): Promise<string> {
  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed) throw new BadRequestException('UNSUPPORTED_FILE_TYPE');

  const allowed = (process.env.ALLOWED_UPLOAD_MIME || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const set = allowed.length ? new Set(allowed) : DEFAULT_ALLOWED_MIME;

  if (!set.has(sniffed.mime)) throw new BadRequestException('UNSUPPORTED_FILE_TYPE');
  return sniffed.mime;
}
```

Va `saveLocalFile` da kengaytma **originalName'dan emas, tasdiqlangan MIME'dan** olinsin:

```ts
const verifiedMime = await resolveVerifiedMime(args.buffer);
const ext = MIME_TO_EXT[verifiedMime];              // allow-list, mijozdan emas
const stored = `${Date.now()}_${randomUUID()}${ext}`;
```

`files.service.ts:440,451` da DB'ga ham `args.file.mimetype` emas, `verifiedMime`
yozilsin — aks holda baza yolg'on MIME saqlaydi.

⚠️ **Eslatma — SVG:** `DEFAULT_ALLOWED_MIME` da `image/svg+xml` **yo'q**. Bu to'g'ri
va shunday qolsin. SVG — bu `<script>` ni ichiga oladigan XML hujjat, ya'ni rasm
niqobidagi HTML. Qo'shilmasin.

### 4.3. ⚠️ Yuklangan fayl web root ichida — STORED XSS

`main.ts:57-66`:

```ts
const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
app.use(
  '/uploads',
  express.static(uploadDir, {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    etag: true,
    fallthrough: true,
  }),
);
```

Diqqat qiling: bu `app.setGlobalPrefix('api')` dan **oldin** (`main.ts:68`). Ya'ni
URL `/api/uploads/...` emas, **`/uploads/...`** — global prefiksdan tashqarida,
ya'ni **hech qanday guard qo'llanmaydi**.

`express.static` faylni **diskdagi kengaytmasiga qarab** `Content-Type` bilan beradi.
`.html` fayl → `Content-Type: text/html` → **brauzer uni ijro etadi**.

**To'liq zanjir:**

```
1. Hujumchi (istalgan `files.write` ruxsatli xodim, YOKI istalgan guardian —
   §4.5 ga qarang) `evil.html` ni `type=image/png` bilan yuklaydi
2. §4.2 teshigi tufayli MIME tekshiruvi o'tadi
3. Fayl diskka `..._uuid.html` sifatida yoziladi
4. Javobda URL qaytadi: /uploads/tenant_1/GUARDIAN/5/GUARDIAN_AVATAR/..._uuid.html
5. Qurbon shu URL'ni ochadi
6. text/html ijro etiladi — API origin'ida (api.mathacademy.uz)
7. §8 da CSP yo'q → skript to'liq ishlaydi
8. Refresh cookie `path=/api/auth/refresh` (auth.service.ts:117) — httpOnly,
   ya'ni skript uni O'QIY OLMAYDI ✅
   LEKIN skript o'sha origin'dan fetch() qila oladi va cookie avtomatik ketadi
   → yangi access token oladi → API'ni qurbon nomidan chaqiradi
```

Ya'ni `httpOnly` cookie o'g'irlanmaydi, lekin **ishlatiladi**. Bu — akkaunt egallash.

**Talab — FILE-02 (uchta chora, uchalasi ham):**

1. **FILE-01** — kengaytma allow-list'dan (`.html` hech qachon diskka tushmaydi)
2. **`Content-Disposition: attachment`** — brauzer render qilmasin, yuklab olsin
3. **`Content-Security-Policy: sandbox`** — agar baribir render bo'lsa, hech narsa ijro etmasin

```ts
// apps/api/src/main.ts
app.use(
  '/uploads',
  express.static(uploadDir, {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    etag: true,
    fallthrough: true,
    setHeaders: (res) => {
      // Uploads are user-controlled bytes. Never let the browser render them
      // in our origin: an .html or .svg here would be same-origin script.
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    },
  }),
);
```

⚠️ `Content-Disposition: attachment` `<img src>` ni **buzmaydi** — u faqat to'g'ridan-
to'g'ri navigatsiyaga ta'sir qiladi. Ya'ni o'quvchi suratlari sahifada normal ko'rinadi.

**Uzoq muddatli yechim:** fayllarni **boshqa origin**da saqlash
(`uploads.mathacademy.uz` yoki S3-mos obyekt saqlash). Shunda XSS bo'lsa ham u
API origin'idan tashqarida bo'ladi va cookie'ga yeta olmaydi. Bu §12 bilan birga
hal qilinadi.

### 4.4. ⚠️ Tenant izolyatsiyasi — DISKDA BOR, XIZMATDA YO'Q

**Diskda ajratish bor** (`files.storage.ts:52-58, 74-80`):

```
uploads/
  tenant_1/STUDENT/42/STUDENT_PHOTO/1736899200000_a3f8...uuid.jpg
  tenant_2/STUDENT/17/STUDENT_PHOTO/1736899300000_b7c2...uuid.jpg
```

**API'da ajratish bor** — `listFiles`, `getFile`, `updateFile`, `deleteFile` hammasi
`tenant_id` bilan filtrlaydi (`files.service.ts:207, 276, 316, 509`). ✅

**`/uploads` da ajratish YO'Q.** `express.static` — bu shunchaki fayl serveri. U:
- JWT o'qimaydi
- tenant bilmaydi
- guard'lardan o'tmaydi (global prefiksdan tashqarida)

**Savol: A tenanti B ning faylini ola oladimi?**

**Javob: HA — agar URL'ni bilsa.** Va bu yerda nozik farq bor:

| Savol | Javob |
|---|---|
| URL taxmin qilinadigan (`/uploads/123.jpg`)mi? | ❌ **YO'Q** — `randomUUID()` v4, ~122 bit entropiya |
| Brute-force bilan topib bo'ladimi? | ❌ **YO'Q** — amalda imkonsiz |
| URL'ni bilgan **autentifikatsiyasiz** odam ola oladimi? | ⚠️ **HA** |

Ya'ni bu **capability URL** modeli: "URL = ruxsat". Bu qasddan tanlangan qaror emas —
bu shunchaki `express.static` ning tabiati.

**Nega bu bolalar surati uchun yetarli emas:**

1. URL `files.list` javobida qaytadi → brauzer tarixi, `Referer` header, proksi log,
   Sentry breadcrumb, screenshot, WhatsApp'ga tashlangan link — hammasida qoladi
2. **Muddati yo'q** — URL bir marta chiqsa, abadiy ishlaydi
3. **Bekor qilib bo'lmaydi** — xodim ishdan ketdi, lekin uning brauzeridagi URL'lar
   ishlayveradi
4. `maxAge: '30d'` (`main.ts:62`) — CDN va brauzer keshlaydi. O'chirilgan fayl ham
   30 kun yashaydi
5. **Audit yo'q** — kim qaysi bola suratini ko'rganini **hech kim bilmaydi**.
   §1.2 H4 (insider) uchun bu muhim: fayl o'qish audit logga tushmaydi

**Talab — FILE-03 (Yuqori ustuvorlik):** `/uploads` static xizmati **butunlay
olib tashlansin** va o'rniga guard ostidagi endpoint qo'yilsin:

```ts
// apps/api/src/modules/files/files.controller.ts
@Get(':id/content')
@RequirePermissions('files.read')
@ApiOperation({ summary: 'Stream file bytes (tenant-checked)' })
async content(
  @Req() req: any,
  @Param('id', ParseBigIntPipe) id: bigint,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  // Reuses the same tenant filter every other read path uses.
  const file = await this.svc.getFileForStream({
    tenantId: this.tenantId(req),
    fileId: id.toString(),
    userId: this.userId(req),
    ipAddress: this.ip(req),          // audit: who read which child's photo
  });

  res.set({
    'Content-Type': file.mimeType,           // verified MIME (FILE-01), DB'dan
    'Content-Disposition': 'attachment',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=0, no-store',   // CDN keshlamasin
  });
  return new StreamableFile(createReadStream(file.storagePath));
}
```

Bu to'rt narsani bir vaqtda hal qiladi: tenant tekshiruvi, ruxsat tekshiruvi,
**o'qish auditi**, va kesh muammosi.

⚠️ **Migratsiya yo'li** — `/uploads` ni bir kunda o'chirib bo'lmaydi, chunki 48 sahifa
va DB'dagi `files.url` ustuni unga bog'langan:

| Bosqich | Ish |
|---|---|
| 1 | `GET /api/staff/files/:id/content` qo'shilsin. `/uploads` **qoladi**. Buzilish yo'q |
| 2 | `main.ts` ga FILE-02 header'lari qo'shilsin. Bu **darhol** qilinadi — XSS zanjirini uzadi |
| 3 | Frontend `file.url` o'rniga `/api/staff/files/${id}/content` ishlatsin |
| 4 | `express.static` **faqat 30 kun** `Referer` logi bilan qoldirilsin — kim hali eski URL ishlatayotganini ko'rish uchun |
| 5 | Log bo'sh bo'lsa → `/uploads` o'chirilsin. `files.url` ustuni deprecate qilinsin |

### 4.5. Guardian yuklash yo'li

`guardian-files.controller.ts:87-108` — guardian **o'z avatarini** yuklay oladi.
`ownerType`/`ownerId`/`purpose` serverda majburlanadi (`ownerId = studentAccountId`),
mijozdan olinmaydi. ✅ **To'g'ri.**

⚠️ Lekin bu ham `saveLocalFile` ga boradi → §4.2 teshigi guardian uchun ham ochiq.
Ya'ni **istalgan ota-ona** `.html` yuklay oladi. Bu H3 (tashqi hujumchi) uchun kirish
nuqtasi: bitta guardian paroli → API origin'ida stored XSS.

⚠️ Ikkinchi eslatma — `guardian-files.controller.ts:93`:

```ts
if (!user || user.type !== 'GUARDIAN') return { ok: false };
```

Bu `ForbiddenException` emas, **200 OK + `{ok: false}`** qaytaradi. Xodim bu
endpoint'ni chaqirsa, HTTP 200 oladi. Xatolik emas, lekin noto'g'ri semantika —
mijoz muvaffaqiyat deb o'ylashi mumkin. `throw new ForbiddenException()` bo'lsin.

### 4.6. Hajm chegarasi — ✅ ikki qatlam

| Qatlam | Joy |
|---|---|
| Multer (oqim to'xtatiladi) | `files.controller.ts:148` — `limits: { fileSize: getMaxUploadBytes() }` |
| Xizmat (ikkilamchi) | `files.storage.ts:70` — `if (args.buffer.length > max)` |

`MAX_UPLOAD_MB=25` → 25 MB. `env.validation.ts:42-45` uni `@Min(1) @Max(200)` bilan
tekshiradi. ✅

⚠️ Bitta nuqta: `getMaxUploadBytes()` dekorator baholanganda **bir marta** o'qiladi
(modul yuklanishida), ya'ni env keyin o'zgarsa ta'sir qilmaydi. Amalda muammo emas.

⚠️ Multer **xotirada** saqlaydi (`file.buffer`) — disk storage emas. 25 MB × bir vaqtda
10 ta yuklash = 250 MB RAM. Render free plan — 512 MB. §9 dagi rate limit yo'qligi
bilan birga bu **oson DoS**: 20 ta parallel 25 MB yuklash → OOM.

### 4.7. Fayl audit — ✅ yozish bor, ❌ o'qish yo'q

`files.service.ts:460-476` — yuklash `audit_logs` ga yoziladi (kim, qachon, qaysi
fayl, IP). ✅ `createFile`, `updateFile`, `deleteFile` ham. ✅

**O'qish yozilmaydi** — chunki o'qish `express.static` orqali ketadi va u audit
haqida hech narsa bilmaydi. FILE-03 buni tuzatadi.

---

## 5. XSS / injection

### 5.1. React avtomatik escape — ✅

`announcements` matni qayerdan keladi:

```
Staff UI → POST /api/staff/announcements (body: string)
  → announcements.service.ts → prisma.announcements.create({ body })
  → GET /api/guardian/announcements
  → GuardianAnnouncements.tsx:77 → {ann.content}
```

`GuardianAnnouncements.tsx:76-78`:

```tsx
<div className="prose prose-sm dark:prose-invert max-w-none ... whitespace-pre-wrap">
  {ann.content}
</div>
```

`{ann.content}` — oddiy JSX interpolatsiya. React uni **avtomatik escape qiladi**.
`<script>alert(1)</script>` matn sifatida ko'rinadi. `whitespace-pre-wrap` — bu CSS,
qator uzilishlarini saqlaydi, HTML render qilmaydi. ✅ **Bu to'g'ri. Buzmang.**

⚠️ **Kelajak xavfi:** `prose` klassi Tailwind Typography'dan — u odatda **HTML
mazmun** uchun ishlatiladi. Agar kimdir keyinchalik "e'lonlarda qalin matn kerak"
deb `react-markdown` yoki `dangerouslySetInnerHTML` qo'shsa — bu darhol XSS bo'ladi,
chunki `announcements.body` **mijozdan keladigan erkin matn**.

**Talab:** agar rich text kerak bo'lsa — **DOMPurify majburiy**, server tomonida ham:

```ts
// announcements.service.ts — agar HTML qabul qilinsa
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const DOMPurify = createDOMPurify(new JSDOM('').window);
const clean = DOMPurify.sanitize(dto.body, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: [],   // href yo'q — javascript: URI oldini oladi
});
```

### 5.2. `dangerouslySetInnerHTML` — GREP QILINDI

Butun `apps/web/src` bo'ylab: **1 ta natija**.

`apps/web/src/components/ui/chart.tsx:70`:

```tsx
<style
  dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES).map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  }).join("\n")}
}`).join("\n"),
  }}
/>
```

**Baho: past xavf, lekin nol emas.**

Bu shadcn/ui ning standart `chart.tsx` komponenti. Interpolatsiya qilinadigan
qiymatlar — `id` (`React.useId()` dan), `key` va `color` — bularning hammasi
**`ChartConfig` obyektidan** keladi, ya'ni **dasturchi kodda yozgan** konstanta.
Foydalanuvchi ma'lumoti bu yerga bormaydi.

⚠️ **Shart:** bu shunday qolishi kerak. Agar biror sahifa `ChartConfig` ni API
javobidan qursa (masalan, `label` yoki `color` ni serverdan olsa), bu **CSS injection**
bo'ladi. `<style>` ichida `</style><script>` yozish mumkin.

**Talab — XSS-01:** kod qoidasi sifatida yozilsin — *`ChartConfig` faqat statik,
kodda yozilgan obyekt bo'lishi mumkin. API javobidan qurilmaydi.* Bu ESLint qoidasi
bilan majburlab bo'lmaydi, shuning uchun **code review checklist**iga kirsin.

`innerHTML` — **0 ta natija**. ✅

### 5.3. Mass assignment

`main.ts:118`: `forbidNonWhitelisted: false`.

`whitelist: true` — DTO'da yo'q maydonlar **jimgina olib tashlanadi**. Ya'ni
`{ role: 'superadmin' }` yuborilsa, u DTO'ga tushmaydi. Himoya **bor**. ✅

Lekin `forbidNonWhitelisted: false` — ortiqcha maydon **xatolik bermaydi**, jimgina
tashlanadi. Bu xavfsizlik teshigi emas, lekin hujum urinishi **ko'rinmaydi**. Agar
kimdir `role: 'superadmin'` yuborsa — biz buni **bilmaymiz**.

**Talab (past ustuvorlik):** `forbidNonWhitelisted: true` qilinsin. ⚠️ Bu buzuvchi
o'zgarish — 128 ta DTO bor va frontend ortiqcha maydon yuborayotgan bo'lishi mumkin.
Testlar yo'qligi sababli (kanon §6) bu **testlardan keyin** qilinsin.

---

## 6. SQL injection

Prisma parametrlashtirilgan so'rovlar yasaydi — 845 ta Prisma chaqiruvida
injection xavfi **yo'q**.

**Grep qilindi:** `$queryRaw|$executeRaw|$queryRawUnsafe|$executeRawUnsafe` butun
`apps/api/src` bo'ylab → **1 ta natija**.

`ranking.service.ts:261`:

```ts
await tx.$executeRaw(
  Prisma.sql`
    INSERT INTO grade_snapshot_rows (snapshot_id, student_id, total_score, rank, risk_level)
    SELECT ${sid} AS snapshot_id, r.student_id, r.total_score, r.rank, r.risk_level
    FROM (${this.totalsSql(tenantId, groupId, args.dto.periodStart, args.dto.periodEnd)}) r
  `,
);
```

Va `totalsSql` (`ranking.service.ts:39-85`):

```ts
private totalsSql(tenantId: bigint, groupId: bigint, start: string, end: string) {
  return Prisma.sql`
    WITH totals AS (
      SELECT s.id AS student_id, ...
      FROM students s
      LEFT JOIN assessments a
        ON a.id = sc.assessment_id
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
      ...
```

**Baho: ✅ XAVFSIZ. Bu to'g'ri yozilgan.**

Sabab: `Prisma.sql` — **tagged template**. `${tenantId}` matn sifatida qo'shilmaydi —
u `$1`, `$2` parametriga aylanadi va PostgreSQL'ga alohida yuboriladi. Bu shunchaki
"escape" emas: parametr **hech qachon SQL matni sifatida tahlil qilinmaydi**.

`$queryRawUnsafe` / `$executeRawUnsafe` — **0 ta natija**. ✅ (Aynan shu ikkitasi
xavfli bo'lardi — ular string birlashtirishni qabul qiladi.)

⚠️ **Ijobiy eslatma:** `totalsSql` da **uchta joyda** `tenant_id` filtri bor —
`assessments`, `students`, va `student_risk_scores` (`latest_risk` CTE). Raw SQL'da
tenant filtrini unutish oson bo'lardi; bu yerda unutilmagan. ✅

**Talab — SQL-01:** ESLint qoidasi qo'shilsin — `$queryRawUnsafe` va `$executeRawUnsafe`
**taqiqlansin**:

```js
// eslint.config.mjs
{
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[property.name=/^\\$(query|execute)RawUnsafe$/]",
      message: 'Use Prisma.sql tagged templates. Raw*Unsafe concatenates strings into SQL.',
    }],
  },
}
```

Hozir 0 ta ishlatilishi bor — ya'ni bu qoida **hech narsani buzmaydi** va kelajakni
himoya qiladi. Arzon g'alaba.

---

## 7. CORS

### 7.1. Real sozlama — `origin: true` EMAS ✅

Kanon xavotiri tekshirildi. `main.ts:85-105`:

```ts
app.enableCors({
  origin: (origin, callback) => {
    // Non-browser clients (curl/postman/server-to-server)
    if (!origin) return callback(null, true);

    if (allowSet.has(origin)) return callback(null, true);
    if (matchesWildcard(origin, wildcardOrigins)) return callback(null, true);
    if (!isProduction && isLocalDevOrigin(origin)) return callback(null, true);

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

**Bu `origin: true` emas.** Allow-list funksiyasi. Asos to'g'ri. ✅

Ijobiy detallar:
- `callback(null, false)` — rad etishda **xato tashlamaydi**, shunchaki CORS header
  qo'shmaydi. To'g'ri naqsh.
- `!isProduction` sharti — localhost qulayligi production'da **o'chadi** ✅
- `allowedHeaders` cheklangan ✅

### 7.2. ⚠️ Uchta muammo

**Muammo 1 — `WEB_ORIGINS` production'da o'rnatilmagan.**

`render.yaml` da `WEB_ORIGINS` **umuman yo'q** (tekshirildi — 53 qatorlik faylda
bunday kalit yo'q). Ya'ni production'da `allowSet` faqat quyidagilardan iborat
(`main.ts:76-82`):

```
http://localhost:3000
http://127.0.0.1:3000
http://localhost:4000
http://127.0.0.1:4000
```

Xavfsizlik nuqtai nazaridan bu **xavfsiz** (hech kim kira olmaydi), lekin bu
**frontend production'da API'ga ulana olmaydi** degani. Ikki ehtimol:

1. `WEB_ORIGINS` Render dashboard'da **qo'lda** qo'shilgan — u holda `render.yaml`
   haqiqatni aks ettirmaydi va yangi muhit yaratilganda buziladi
2. Frontend hozircha deploy qilinmagan

**Ochiq savol:** qaysi biri? `render.yaml` ga `WEB_ORIGINS` qo'shilsin.

**Muammo 2 — wildcard naqsh xavfli** (`main.ts:42-48`):

```ts
function matchesWildcard(origin: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (!p.includes('*')) return false;
    const regex = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return regex.test(origin);
  });
}
```

Regex to'g'ri anchor qilingan (`^...$`) va metabelgilar escape qilingan. Kod sifatli.
**Lekin naqshning o'zi xavfli.** Agar kimdir `WEB_ORIGINS="https://*.vercel.app"`
yozsa:

```
^https://.*\.vercel\.app$
```

→ `https://mathacademy-hack.vercel.app` **mos keladi**. Vercel'da hisob ochish
bepul va 30 soniya vaqt oladi. `credentials: true` bilan birgalikda bu — hujumchi
saytidan **cookie bilan** API'ga so'rov yuborish imkoni.

**Talab — CORS-01:** production'da wildcard **o'chirilsin**:

```ts
// main.ts
if (isProduction && wildcardOrigins.length > 0) {
  throw new Error(
    'WEB_ORIGINS must not contain wildcards in production. ' +
    'A pattern like https://*.vercel.app lets anyone with a Vercel account ' +
    'make credentialed cross-origin requests. List exact origins.',
  );
}
```

Bu — fail-fast. Noto'g'ri konfiguratsiyada tizim **ishga tushmasin**. Bu naqsh
`env.validation.ts` da allaqachon qabul qilingan (kanon §5.4).

**Muammo 3 — `if (!origin) return callback(null, true)`.**

Bu keng tarqalgan naqsh va odatda **xavfsiz**: brauzer cross-origin so'rovda `Origin`
header'ini **doim** yuboradi. `Origin` yo'q = brauzer emas = curl/server. Va CORS
brauzerdan tashqarida ma'nosiz.

⚠️ Lekin nozik holat: `<img src="https://api.../uploads/...">` yoki `<link>` kabi
so'rovlar `Origin` yubormaydi. Bu §4.4 ga bog'liq — `/uploads` baribir CORS'dan
tashqarida (u `app.use` orqali, `enableCors` dan oldin). FILE-03 buni hal qiladi.

Hozircha bu qatorni **o'zgartirmaslik** tavsiya etiladi — o'zgartirish Swagger va
health check'ni buzadi, foyda esa nazariy.

### 7.3. 🔴 Swagger production'da OCHIQ — eng tez tuzatiladigan kritik topilma

`main.ts:127-139`:

```ts
const swaggerConfig = new DocumentBuilder()
  .setTitle('Mathacademy Digital Campus API')
  ...
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
  swaggerOptions: { persistAuthorization: true },
});
```

**Hech qanday shart yo'q.** `ENABLE_SWAGGER` env kaliti bu yerda **o'qilmaydi**
(§3.3). `render.yaml:31` da `ENABLE_SWAGGER: false` yozilgan — **kod uni ko'rmaydi**.

Ya'ni **`https://<api>/api/docs` production'da hamma uchun ochiq**: 28 modul,
37 controller, 128 DTO — butun hujum yuzasi xaritasi, misol qiymatlari bilan.

Bu o'z-o'zidan buzilish emas (endpoint'lar guard ostida), lekin bu H3 (tashqi
hujumchi) uchun **tayyor razvedka hujjati**. Va §9 (rate limit yo'q) bilan birga —
tayyor hujum rejasi.

Bu topilma §3.3 ning to'g'ridan-to'g'ri natijasi: **konfiguratsiya yolg'on gapirdi**.
`render.yaml` ni o'qigan odam "Swagger yopiq" deb ishonadi.

**Talab — SWAG-01 (Kritik, 3 qator):**

```ts
// main.ts
const enableSwagger = process.env.ENABLE_SWAGGER === 'true';
if (enableSwagger) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mathacademy Digital Campus API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  console.log(`Swagger started on http://localhost:${port}/api/docs`);
}
```

⚠️ `=== 'true'` — **fail-closed**. Ya'ni env yo'q bo'lsa Swagger **o'chiq**.
`!== 'false'` yozilsa fail-open bo'lardi va bir kun env unutilganda Swagger yana
ochilardi. Bu §2.3 saboqning bevosita qo'llanilishi: **standart holat xavfsiz
bo'lsin**.

`main.ts:143` dagi log ham shart ichiga kirsin.

---

## 8. Xavfsizlik header'lari

### 8.1. Holat — helmet YO'Q

`package.json` tekshirildi (`apps/api/package.json:25-48`) — dependencies ro'yxati:

```
@nestjs/cache-manager, @nestjs/common, @nestjs/config, @nestjs/core,
@nestjs/jwt, @nestjs/platform-express, @nestjs/swagger, @prisma/adapter-pg,
@prisma/client, bcrypt, cache-manager, cache-manager-redis-store,
class-transformer, class-validator, cookie-parser, express, multer, pg,
prisma, reflect-metadata, rxjs, swagger-ui-express
```

**`helmet` yo'q.** `main.ts` da ham grep qilindi — **0 ta natija**.

Ya'ni hozir API quyidagi header'larni **yubormaydi**:

| Header | Nima qiladi | Holat |
|---|---|---|
| `Content-Security-Policy` | XSS'ni ijro etilishidan to'xtatadi | ❌ **YO'Q** |
| `Strict-Transport-Security` | HTTPS majburlaydi, downgrade oldini oladi | ❌ **YO'Q** |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking | ❌ **YO'Q** |
| `X-Content-Type-Options: nosniff` | MIME sniffing | ❌ **YO'Q** |
| `Referrer-Policy` | URL sizishi (§4.4!) | ❌ **YO'Q** |
| `X-Powered-By: Express` **o'chirish** | Versiya oshkor qiladi | ❌ **YUBORILADI** |

CSP yo'qligi §4.3 zanjirini to'liq ishlaydigan qiladi. `Referrer-Policy` yo'qligi
§4.4 ni yomonlashtiradi — fayl URL'lari `Referer` header'ida tashqi saytlarga sizadi.

### 8.2. Talab — HDR-01

```bash
npm i helmet
```

```ts
// apps/api/src/main.ts
import helmet from 'helmet';

// app.setGlobalPrefix() dan OLDIN — /uploads ni ham qamrab olishi uchun
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // This is a JSON API + Swagger. Nothing here needs inline script
        // except swagger-ui, which is dev-only after SWAG-01.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],   // Tailwind/Swagger
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],                // clickjacking
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: 'no-referrer' },     // §4.4 — URL sizmasin
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
  }),
);
app.disable('x-powered-by');
```

**Izohlar:**

- `frameAncestors: ["'none'"]` — API'ni iframe'ga solish mumkin emas
- `referrerPolicy: 'no-referrer'` — §4.4 dagi URL sizishini kamaytiradi
- `hsts` faqat production'da — localda HTTPS yo'q, aks holda dev muhit buziladi
- ⚠️ `helmet` **`app.setGlobalPrefix()` dan oldin** qo'yilsin, chunki `/uploads`
  static (`main.ts:59`) global prefiksdan tashqarida va **u ham** header'larga
  muhtoj (§4.3)
- ⚠️ `scriptSrc: ["'self'"]` Swagger UI'ni buzishi mumkin. SWAG-01 dan keyin
  Swagger faqat dev'da ishlaydi, ya'ni production CSP qat'iy bo'lishi mumkin

**Frontend uchun alohida:** CSP API'da emas, **frontend serverida** eng muhim.
Vercel/Netlify/Render'da `_headers` yoki `vercel.json` orqali. Bu alohida ish —
ochiq savol §15.

### 8.3. Tekshirish

```bash
curl -sI https://<api>/api/health | grep -iE "content-security|strict-transport|x-frame|x-powered|referrer"
```

Kutilgan: CSP, HSTS, X-Frame-Options bor; `X-Powered-By` **yo'q**.

---

## 9. Rate limiting — ⚠️ env yolg'on gapiryapti

### 9.1. Holat

| Manba | Nima deydi |
|---|---|
| `.env.example:32-33` | `RATE_LIMIT_TTL="60"`, `RATE_LIMIT_MAX="100"` |
| `render.yaml:41-44` | `RATE_LIMIT_TTL: 60`, `RATE_LIMIT_MAX: 100` |
| `package.json` | ❌ **`@nestjs/throttler` YO'Q** |
| `apps/api/src/**` grep | ❌ **`RATE_LIMIT` — 0 ta natija** |
| `apps/api/src/**` grep | ❌ **`Throttler` — 0 ta natija** |

**Xulosa: sozlama bor, majburlash yo'q.**

Bu §3.3 dagi eng zararli namuna. Ikki xil odam bu fayllarni o'qiydi:

- **Deploy qiluvchi** `render.yaml:43` da `RATE_LIMIT_MAX: 100` ni ko'radi →
  "daqiqada 100 so'rov cheklovi bor" deb o'ylaydi
- **Auditor** `.env.example:32` ni ko'radi → shu xulosaga keladi

**Ikkalasi ham xato.** Chek yo'q. Bu qiymatlar **hech qayerda o'qilmaydi**. Ular —
xavfsizlik teatri.

### 9.2. Nima himoyalanmagan

`auth.service.ts:226-290` da **hisob bo'yicha** lock bor:

```ts
const lockConfig = {
  windowHours: 1,
  maxAttempts: 5,
  lockDurationHours: 3,
};
```

Bu ✅ bor va ishlaydi. **Lekin:**

| Xususiyat | Holat |
|---|---|
| Hisob bo'yicha lock | ✅ 5 urinish / 1 soat → 3 soat lock |
| Konfiguratsiya `RATE_LIMIT_*` dan | ❌ **Hardkod** (`auth.service.ts:232-236`) |
| **IP bo'yicha** chegara | ❌ **YO'Q** |
| Global HTTP chegara | ❌ **YO'Q** |
| `/api/auth/refresh` chegarasi | ❌ **YO'Q** |
| Fayl yuklash chegarasi | ❌ **YO'Q** (§4.6 — RAM DoS) |
| Og'ir endpoint (`ranking`, `$executeRaw`) chegarasi | ❌ **YO'Q** |

**Natija — uchta real hujum:**

1. **Parol spraying (§1.3):** 60 ta ma'lum guardian login × 4 urinish = 240 so'rov.
   Lock **ishga tushmaydi** (har hisobda 5 dan kam). Hech narsa to'xtatmaydi.
2. **Lockout DoS (§1.3):** 300 so'rov → 60 ota-ona 3 soatga bloklanadi.
3. **Resurs DoS:** `POST /api/staff/files/upload` × 20 parallel × 25 MB = 500 MB RAM
   → Render free plan (512 MB) → OOM → **butun tizim o'chadi**.

### 9.3. Talab — RATE-01

```bash
npm i @nestjs/throttler
```

```ts
// apps/api/src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: Number(process.env.RATE_LIMIT_TTL || 60) * 1000,   // ms
          limit: Number(process.env.RATE_LIMIT_MAX || 100),
        },
      ],
      // Render sits behind a proxy: req.ip is the proxy without trust proxy.
      // Fall back to the first X-Forwarded-For hop, matching how
      // auth.service.ts:130 and files.controller.ts:56 already read the IP.
      getTracker: (req) =>
        String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() || req.ip,
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

Va login uchun **qattiqroq** chegara:

```ts
// apps/api/src/modules/auth/auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Post('login')
@Throttle({ default: { limit: 10, ttl: 60_000 } })   // IP'dan 10/daqiqa
login(...) { ... }
```

⚠️ **Muhim — `trust proxy`:** Render reverse proxy ortida turadi. `main.ts` ga
qo'shilishi kerak:

```ts
app.set('trust proxy', 1);
```

Aks holda `req.ip` **hamma uchun bir xil** bo'ladi (proksi IP'si) va throttler
**butun dunyoni bitta foydalanuvchi** deb hisoblaydi — ya'ni bitta hujumchi hamma
uchun chegarani tugatadi. Bu throttler'ni DoS vositasiga aylantiradi.

⚠️ **Ikkinchi eslatma:** `X-Forwarded-For` — bu **mijoz yubora oladigan** header.
`trust proxy` to'g'ri sozlanmasa, hujumchi har so'rovda soxta IP yuborib chegarani
aylanib o'tadi. `app.set('trust proxy', 1)` — "faqat **bitta** proksiga ishon"
degani, ya'ni Express oxirgi hop'ni oladi. Bu Render uchun to'g'ri.

⚠️ **Uchinchi:** ThrottlerModule standart holda **xotirada** hisoblaydi. Bir nechta
instansiyada har biri alohida hisoblaydi. Loyihada **Redis allaqachon bor**
(`cache-manager-redis-store`), shuning uchun `@nest-lab/throttler-storage-redis`
ishlatilsin — aks holda gorizontal skalada chegara instansiya soniga ko'payadi.

### 9.4. Talab — RATE-02: lock konfiguratsiyasi env'ga

`auth.service.ts:232-236` dagi hardkod `.env` ga chiqarilsin. Aks holda §3.3
muammosi qoladi: `.env.example` da bir raqam, kodda boshqasi.

---

## 10. Xatoliklardan ma'lumot sizishi

### 10.1. `all-exceptions.filter.ts` — ✅ TO'G'RI YOZILGAN

**Savol: production'da stack trace qaytaradimi?**

**Javob: YO'Q.** `all-exceptions.filter.ts:36-45`:

```ts
const body: ErrorBody = {
  statusCode,
  message,
  error,
  code,
  path: req?.originalUrl || req?.url,
  timestamp: new Date().toISOString(),
};

res.status(statusCode).json(body);
```

`ErrorBody` tipida (`:14-21`) `stack` maydoni **umuman yo'q**. Noma'lum xato
(`:110-113`):

```ts
return new InternalServerErrorException({
  message: 'INTERNAL',
  code: 'INTERNAL',
});
```

Faqat `"INTERNAL"`. ✅

**Savol: Prisma xatosi jadval nomini oshkor qiladimi?**

**Javob: YO'Q.** `:66-94`:

```ts
if (exception instanceof Prisma.PrismaClientKnownRequestError) {
  switch (exception.code) {
    case 'P2002': return new ConflictException({ message: 'ALREADY_EXISTS', code: 'ALREADY_EXISTS' });
    case 'P2003': return new BadRequestException({ message: 'INVALID_REFERENCE', code: 'INVALID_REFERENCE' });
    case 'P2025': return new NotFoundException({ message: 'NOT_FOUND', code: 'NOT_FOUND' });
    case 'P2000': return new BadRequestException({ message: 'INVALID_DATA', code: 'INVALID_DATA' });
    default:      return new InternalServerErrorException({ message: 'DB_ERROR', code: 'DB_ERROR' });
  }
}
```

Bu **muhim detal**. Prisma'ning `P2002` xatosi standart holda `meta.target` ni
o'z ichiga oladi — ya'ni **ustun nomini**:

```json
{ "code": "P2002", "meta": { "target": ["tenant_id", "username"] } }
```

Bu kod `exception.meta` ni **umuman uzatmaydi** — faqat `'ALREADY_EXISTS'`. Ya'ni
schema oshkor bo'lmaydi. ✅

`PrismaClientValidationError` (`:96-101`) — bu xato **butun so'rov obyektini**
matn sifatida o'z ichiga oladi (ya'ni potensial `password_hash` kabi maydonlar).
U ham `'INVALID_DATA'` ga aylantiriladi. ✅ **Bu yaxshi yozilgan.**

`PrismaClientInitializationError` → `'DB_UNAVAILABLE'` — DB URL sizmaydi ✅

### 10.2. ⚠️ Uchta muammo

**Muammo 1 — `@Catch()` hamma narsani ushlaydi, hech narsa loglanmaydi.**

Filtr `console.error` **umuman chaqirmaydi**. Ya'ni production'da 500 xato
sodir bo'lsa:

- Mijoz `{"statusCode":500,"message":"INTERNAL"}` oladi ✅
- **Server hech qayerda hech narsa yozmaydi** ❌

Ya'ni **xatolar ko'rinmaydi**. Bu xavfsizlik teshigi emas, lekin bu — hujumni
aniqlash imkoniyatining nolga tushishi. §1.2 H4 (insider) uchun bu muhim.

**Talab — ERR-01:**

```ts
// all-exceptions.filter.ts
import { Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // ... mavjud kod ...

    // The client gets a generic body; the server keeps the detail.
    if (statusCode >= 500) {
      this.logger.error(
        `${req?.method} ${req?.originalUrl} → ${statusCode} (tenant=${req?.user?.tenantId ?? '-'}, user=${req?.user?.userId ?? '-'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(statusCode).json(body);
  }
}
```

⚠️ Log'ga **so'rov body'si yozilmasin** — u yerda parol bo'lishi mumkin.

**Muammo 2 — `path` javobga qaytadi** (`:41`):

```ts
path: req?.originalUrl || req?.url,
```

`originalUrl` **query string'ni ham** o'z ichiga oladi. Agar biror endpoint
maxfiy ma'lumotni query'da qabul qilsa, u xato javobida qaytadi. Hozir bunday
endpoint topilmadi, lekin bu kelajak xavfi. Past ustuvorlik.

**Muammo 3 — ValidationPipe xato tafsiloti** (`main.ts:110-120`):

```ts
exceptionFactory: (errors) => {
  if (isDev) console.warn('Validation errors:', JSON.stringify(errors, null, 2));
  return new BadRequestException(errors);
},
validationError: { target: false, value: false },
```

`validationError: { target: false, value: false }` — ✅ **to'g'ri**. Bu yuborilgan
**qiymatni** javobdan olib tashlaydi (aks holda noto'g'ri parol xato javobida
qaytardi). Va `console.warn` faqat dev'da.

⚠️ Lekin `new BadRequestException(errors)` — `errors` bu `ValidationError[]`
massivi, ya'ni javobda **maydon nomlari va constraint nomlari** qaytadi:

```json
{"statusCode":400,"message":[{"property":"birth_date","constraints":{"isDate":"..."}}]}
```

Bu DTO strukturasini oshkor qiladi. Lekin Swagger allaqachon ochiq (§7.3) — ya'ni
bu ma'lumot baribir ochiq. SWAG-01 dan keyin bu qayta ko'rib chiqilsin. Past ustuvorlik.

### 10.3. Boshqa sizish kanallari

| Kanal | Holat |
|---|---|
| `X-Powered-By: Express` | ❌ **YUBORILADI** — §8.2 `app.disable('x-powered-by')` |
| Swagger — butun API xaritasi | ❌ **OCHIQ** — §7.3 |
| Login xatosi — "user not found" vs "wrong password" farqi | ❓ **TEKSHIRILMAGAN** — §15 |
| `console.log` da token/parol | ❓ **TEKSHIRILMAGAN** |
| Seed logi | ✅ Faqat loginlar (`seed.ts:1271-1280`) |

---

## 11. Ma'lumot maxfiyligi (bolalar) — ⚠️ yurist savoli

> ⚠️ **Bu bo'lim yuridik maslahat EMAS.** Bu — veb-qidiruv bilan tekshirilgan
> faktlar va **yuristga beriladigan savollar** ro'yxati. Har bir band yurist bilan
> tasdiqlanishi shart. Sanalar va raqamlar birlamchi manbadan (lex.uz) qayta
> tekshirilsin.

### 11.1. ⚠️ MUHIM: qonun 2026-yil mart oyida O'ZGARDI

Kanon (§10) va bu topshiriqning dastlabki farazi — *"ma'lumot O'zbekistonda
saqlanishi shart, Render esa AQSh/Yevropada, ya'ni muvofiqlik muammosi"* — **eskirgan**.

Veb-qidiruv natijasi (2026-07-15 holatiga):

| Sana | Hujjat | Nima qildi |
|---|---|---|
| 2019-07-02 | **ZRU-547** "Shaxsga doid ma'lumotlar to'g'risida" | Asosiy qonun. Kuchga kirdi: 2019-10-01 |
| 2021-01-14 | **ZRU-666** | **27¹-modda** qo'shdi — **lokalizatsiya**. Kuchga kirdi: 2021-aprel |
| 2021-09-29 | **ZRU-726** | Javobgarlikni kuchaytirdi (ma'muriy + jinoiy) |
| **2026-03-26** | **O'RQ-1125** | ⭐ **Umumiy lokalizatsiya talabini BEKOR QILDI.** Kuchga kirdi: **2026-03-27** |

**Ya'ni bugungi holat (2026-07-15):**

- ❌ **Barcha ma'lumot O'zbekistonda saqlanishi SHART EMAS** — bu talab olib tashlandi
- ✅ **Faqat O'zbekistonda saqlanishi shart:**
  - **Biometrik ma'lumot** (barmoq izi, **yuz tasviri**, iris, ovoz)
  - **Genetik ma'lumot** (DNK profili)
  - O'zbekistondagi telekom operatorlari foydalanuvchilari ma'lumoti
- ✅ **Qolgani chet elda saqlanishi mumkin**, agar shartlardan biri bajarilsa:
  - chet davlat yetarli himoya ta'minlasa, **yoki**
  - operator vakolatli organ tasdiqlagan **standart shartnoma shartlari (SCC)** yoki
    **majburiy korporativ qoidalar (BCR)** qabul qilsa, **yoki**
  - tan olingan xalqaro ma'lumot himoyasi standartlariga muvofiq bo'lsa

O'zgarish sababi ochiq e'lon qilingan: **Apple Pay, Google Pay, PayPal** uchun yo'l
ochish (manba: gazeta.uz, kun.uz, 2026-03-27/28).

**Manbalar:**
- Asosiy qonun: https://lex.uz/docs/4831939
- 2026 o'zgarishi: https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems
- https://www.gazeta.uz/oz/2026/03/28/personal-data/

### 11.2. ⚠️ MathAcademy uchun asosiy savol: surat = biometrik ma'lumotmi?

Bu **eng muhim ochiq savol** va u yurist uchun.

Vaziyat:
- Yangi qonun **yuz tasviri**ni biometrik ma'lumot sifatida **hali ham** O'zbekistonda
  saqlashni talab qiladi
- `files` moduli `purpose=STUDENT_PHOTO` bilan **o'quvchi suratlarini** saqlaydi
- `render.yaml` — Render, ya'ni **AQSh/Yevropa serverlari**

**Nozik nuqta:** ko'p yurisdiksiyada (masalan, GDPR Art. 9) oddiy fotosurat
**biometrik ma'lumot hisoblanmaydi** — u faqat **biometrik identifikatsiya
maqsadida texnik qayta ishlansa** biometrik bo'ladi. MathAcademy suratlarni
identifikatsiya uchun **ishlatmaydi** — ular shunchaki profil rasmi
(`files.service.ts:422` — `STUDENT_PHOTO` bitta rasm qoidasi).

⚠️ **Lekin O'zbekiston qonunida bu farq qanday qo'yilganini men tasdiqlay olmadim.**
Bu — **yurist savoli**, va u **hal qiluvchi**:

- Agar surat **biometrik emas** → Render'da saqlash mumkin (SCC/BCR sharti bilan)
- Agar surat **biometrik** → suratlar **O'zbekistondagi serverga ko'chirilishi shart**

Ikkinchi holat arxitekturaga jiddiy ta'sir qiladi: `files` moduli hozir lokal diskka
yozadi (`files.storage.ts`), ya'ni u **API bilan bir joyda**. Ajratish kerak bo'lsa —
bu §4.3 dagi "boshqa origin" tavsiyasi bilan **mos keladi**: fayllarni alohida
saqlash xizmatiga chiqarish ikkala muammoni ham hal qiladi.

### 11.3. Voyaga yetmaganlar — ota-ona roziligi

Tasdiqlangan: voyaga yetmaganlar (18 yoshgacha) uchun **yozma rozilik** —
elektron hujjat shaklida ham — **ota-ona (vasiy, homiy)** tomonidan beriladi,
ular bo'lmasa — vasiylik va homiylik organlari tomonidan.

⚠️ Modda raqamini tasdiqlab bo'lmadi.

**Tizimda hozir nima bor:**

| Element | Holat |
|---|---|
| `student_accounts` — ota-ona hisobi | ✅ **BOR** (`profile_relation`: OTA/ONA) |
| Rozilik yozuvi (qachon, nimaga, kim) | ❌ **YO'Q** — bunday jadval yo'q |
| Roziligni qaytarib olish mexanizmi | ❌ **YO'Q** |
| Ma'lumotni o'chirish (right to erasure) | ⚠️ Qisman — `files.delete` bor, o'quvchi uchun to'liq oqim yo'q |
| Ma'lumotni eksport qilish | ❌ **YO'Q** |
| Saqlash muddati (retention) siyosati | ❌ **YO'Q** — bitirgan o'quvchi ma'lumoti abadiy qoladi |

**Ochiq savol:** akademiya hozir roziligni **qog'ozda** olayotgan bo'lishi mumkin
(shartnoma bilan). Agar shunday bo'lsa — bu qonuniy bo'lishi mumkin va tizimga
rozilik moduli **kerak emas**. Buni **aniqlash kerak** — bu texnik emas, tashkiliy
savol.

### 11.4. Davlat reyestri va javobgarlik

| Element | Holat |
|---|---|
| Ma'lumotlar bazalari **Davlat reyestri**da ro'yxatdan o'tish | ❓ **NOMA'LUM** — akademiya ro'yxatdan o'tganmi? |
| Reyestrni yurituvchi organ | **Adliya vazirligi huzuridagi Personallashtirish agentligi** (2023-01-01 dan) |
| Nazorat | **"Uzkomnazorat"** davlat inspeksiyasi |
| Ro'yxatdan o'tish tartibi | Vazirlar Mahkamasining 2020-02-08 dagi **71-son** qarori |

**Javobgarlik** (ZRU-726, 2021-09-29):
- Ma'muriy (Ma'muriy javobgarlik kodeksi **46¹-modda**): fuqarolarga **7 BHM**gacha,
  mansabdor shaxslarga **50 BHM**gacha
- Jinoiy (ma'muriy jazodan keyin takrorlansa): **100-150 BHM**, yoki huquqdan
  mahrum qilish, yoki 3 yilgacha axloq tuzatish ishlari
- Guruh bo'lib sodir etilsa: **3 yilgacha ozodlikdan mahrum qilish**
- **Bloklash:** buzuvchilar maxsus reyestrga kiritiladi → milliy internet segmentida
  faoliyati cheklanadi

⚠️ **Bu real qo'llanilgan** (nazariy emas):
- 2021-07-02 — **TikTok, Twitter, VKontakte, Skype, WeChat** bloklandi
- 2021-11 — Facebook, Instagram, LinkedIn, Telegram, YouTube ga kengaytirildi.
  Bu siyosiy jihatdan **teskari natija** berdi — Prezident IT vazirini va
  Uzkomnazorat rahbarini ishdan bo'shatdi
- 2022-08-01 — ko'pchiligi blokdan chiqarildi

**Ochiq savol:** MathAcademy ma'lumotlar bazasi Davlat reyestrida ro'yxatdan
o'tganmi? Bu — **ha/yo'q** savoli va javob shu hujjatga yozilishi kerak.
2026 o'zgarishi ro'yxatdan o'tish talabini ham o'zgartirganmi — **tasdiqlanmagan**.

### 11.5. Yuristga beriladigan savollar ro'yxati

1. **O'quvchi surati (`purpose=STUDENT_PHOTO`) O'RQ-1125 (2026-03-26) bo'yicha
   "biometrik ma'lumot" hisoblanadimi**, agar u biometrik identifikatsiya uchun
   ishlatilmasa? — ⭐ **Eng muhim savol.** Javob arxitekturani belgilaydi (§11.2)
2. Render (AQSh/Yevropa) yangi rejimda maqbulmi? Qaysi mexanizm kerak — "yetarli
   himoya" ro'yxatimi, SCC'mi, BCR'mi? ⚠️ "Yetarli himoya" davlatlar ro'yxati
   **hech qachon tasdiqlanmagan** edi — yangi rejimda mavjudmi?
3. Akademiyaning ma'lumotlar bazasi Davlat reyestrida ro'yxatdan o'tishi shartmi?
   O'tganmi?
4. Ota-ona roziligi qog'ozdagi shartnoma orqali olinsa — bu yetarlimi, yoki tizimda
   elektron rozilik yozuvi kerakmi?
5. Bitirgan o'quvchi ma'lumoti **qancha muddat** saqlanishi mumkin/kerak?
   `discipline_actions` va `student_risk_scores` uchun alohida muddat bormi?
6. `student_risk_scores` (bola haqida psixologik/akademik baholash) alohida
   toifaga kiradimi?
7. Buzilish sodir bo'lsa — **kimga, qancha muddatda** xabar berish shart?
   (§13 runbook uchun aniq raqam kerak)
8. Ko'p ijarachilik (multi-tenant) — har bir akademiya alohida "operator"mi,
   yoki MathAcademy operatormi, akademiyalar — "qayta ishlovchi"mi? Bu SaaS'ga
   o'tishda hal qiluvchi (kanon §7)

---

## 12. Zaxira (backup) va tiklash

### 12.1. 🔴 Eng jiddiy topilma: yuklangan fayllar EFEMER

`render.yaml:37-38`:

```yaml
- key: UPLOAD_DIR
  value: /tmp/uploads
```

Render'da (ayniqsa free plan'da) **disk efemer**. `/tmp` — konteyner ichida.
Deploy, restart, yoki avtomatik uyqudan uyg'onish — **fayllar yo'q bo'ladi**.

**Natija:**

```
1. Xodim o'quvchi suratini yuklaydi
2. files.storage.ts → /tmp/uploads/tenant_1/STUDENT/42/STUDENT_PHOTO/...jpg
3. DB'da yozuv yaratiladi: files.url = '/uploads/tenant_1/...'   ← DB'da QOLADI
4. Render deploy / restart / uyqu
5. /tmp tozalanadi — FAYL YO'Q
6. DB yozuvi hali ham bor va URL'ni ko'rsatadi
7. Frontend rasm so'raydi → 404
```

Ya'ni **baza yolg'on gapiradi**: `files` jadvalida yozuv bor, diskda fayl yo'q.
`files.service.ts:526-528` da o'chirish `safeDeleteLocalFile` ni chaqiradi, u
xatoni **jimgina yutadi** (`files.storage.ts:108-110`) — ya'ni bu holat hech qayerda
ko'rinmaydi.

⚠️ Bu **backup muammosi emas** — bu **ma'lumot yo'qotish muammosi**. Backup olishning
ham ma'nosi yo'q, chunki zaxiralaydigan narsa yo'q.

**Talab — BAK-01 (Kritik):** fayllar **doimiy saqlashga** ko'chirilsin. Uch variant:

| Variant | Ijobiy | Salbiy |
|---|---|---|
| Render Persistent Disk | Eng oson o'zgarish (`UPLOAD_DIR=/data/uploads`) | Pullik plan; bitta instansiyaga bog'laydi; **backup baribir qo'lda** |
| S3-mos obyekt saqlash | Doimiy, versiyalangan, backup avtomatik, §4.3 origin muammosini ham hal qiladi | `files.storage.ts` qayta yozilishi kerak |
| O'zbekistondagi provayder | §11.2 biometrik savolini oldindan yopadi | Integratsiya ishi |

⚠️ **§11.2 bilan bog'liq:** agar yurist "surat = biometrik" desa, uchinchi variant
**yagona** to'g'ri javob bo'ladi. Shuning uchun §11.5 dagi 1-savol **BAK-01 dan
oldin** hal qilinsin — aks holda ish ikki marta qilinadi.

### 12.2. Ma'lumotlar bazasi zaxirasi

`render.yaml:54-58`:

```yaml
databases:
  - name: mathacademy-db
    databaseName: mathacademy
    user: mathacademy
    plan: free
```

⚠️ **`plan: free`.** Render'ning bepul PostgreSQL plani:
- **Avtomatik zaxira YO'Q** (bu pullik plan xususiyati)
- Ma'lum muddatdan keyin **butunlay o'chiriladi** (Render siyosati — tasdiqlansin)

**Ya'ni hozir:**

| Savol | Javob |
|---|---|
| Avtomatik zaxira bormi? | ❌ **YO'Q** |
| Qo'lda zaxira olinganmi? | ❓ **NOMA'LUM** — ochiq savol |
| Zaxiradan tiklash sinab ko'rilganmi? | ❌ **Deyarli aniq YO'Q** |
| Point-in-time recovery? | ❌ **YO'Q** |

**Nega bu bolalar tizimi uchun alohida jiddiy:** o'quvchi yozuvi — bu **qayta
tiklab bo'lmaydigan** ma'lumot. Baho, davomat, intizom tarixi, kirish natijasi —
bularni "yana bir marta kiritish" mumkin emas. Ular **sodir bo'lgan voqealar**.
`attendance_marks` da 8 haftalik yozuv bor — uni hech kim eslay olmaydi.

### 12.3. Talab — BAK-02: RPO / RTO

⚠️ **Halol eslatma:** quyidagi raqamlar **taklif**, o'lchov emas. Ular akademiya
bilan kelishilishi kerak — chunki RPO/RTO texnik emas, **biznes** qarori.

| Ma'lumot | Taklif RPO | Taklif RTO | Sabab |
|---|---|---|---|
| `students`, `users`, `student_accounts` | **1 soat** | **4 soat** | Yadro. Yo'qolsa tizim ishlamaydi |
| `assessment_scores`, `attendance_marks` | **1 soat** | **4 soat** | Qayta tiklab bo'lmaydi |
| `audit_logs` | **0** (yo'qotish mumkin emas) | 24 soat | Nizoda yagona isbot. §1.2 H4 |
| `files` (bolalar surati) | **24 soat** | 24 soat | Qayta yuklash mumkin, lekin og'riqli |
| `announcements`, `displays` | 24 soat | 72 soat | Qayta yaratish oson |

**Minimal amaliy reja:**

1. Render PostgreSQL **pullik planga** ko'chirilsin → avtomatik kunlik zaxira
2. Undan tashqari — **haftalik `pg_dump`** boshqa provayderga (bir savatga
   ishonmaslik):
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --no-owner \
     | gzip > "mathacademy-$(date +%F).dump.gz"
   ```
3. ⭐ **Tiklashni sinab ko'rish** — kvartalda bir marta, bo'sh bazaga.
   ⚠️ **Sinalmagan zaxira — zaxira emas.** Bu yagona muhim band; qolganlari
   shusiz ma'nosiz
4. Zaxira **shifrlangan** bo'lsin (u bolalar ma'lumotini o'z ichiga oladi — ya'ni
   zaxira nusxasi **birlamchi baza bilan bir xil himoyaga** muhtoj)
5. Zaxira **qayerda** saqlanadi — §11.2 savoliga bog'liq

---

## 13. Bog'liqliklar (dependencies)

### 13.1. Holat

| Element | Holat |
|---|---|
| `npm audit` CI'da | ❌ **CI YO'Q** (`.github/` mavjud emas) |
| Dependabot | ❌ **YO'Q** |
| `package-lock.json` | ✅ Bor (`render.yaml:6` — `npm ci`) |
| SBOM | ❌ **YO'Q** |

### 13.2. ⚠️ `multer@1.4.5-lts.1`

`package.json:42`. Multer 1.x **eskirgan** va 2.x chiqqan. 1.x uchun ma'lum
zaifliklar mavjud (DoS naqshlari).

Bu §4.6 (xotirada saqlash) va §9 (rate limit yo'q) bilan birgalikda — real DoS yo'li.

**Talab — DEP-01:** `npm audit` ishga tushirilsin va natija shu hujjatga yozilsin.
⚠️ Bu **hali qilinmagan** — men uni bajarmadim, chunki bu kod o'zgartirishi.

### 13.3. Talab — DEP-02: CI

```yaml
# .github/workflows/security.yml — §3.4 dagi 'secrets' job bilan bir faylda
jobs:
  audit:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: apps/api/package-lock.json
      - run: npm ci
      - run: npm audit --audit-level=high     # high/critical bloklaydi
```

⚠️ `--audit-level=high` — `moderate` emas. Sabab: `moderate` transitive
dependency'larda doim shovqin beradi va jamoa CI'ni **e'tiborsiz qoldirishni**
o'rganadi. Bloklaydigan CI — **bloklashi kerak bo'lganda** bloklasin. Yashil
bo'lishi mumkin bo'lgan CI'dan foydali.

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /apps/api
    schedule: { interval: weekly }
    groups:
      # Group patch/minor so the PR queue stays reviewable.
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: npm
    directory: /apps/web
    schedule: { interval: weekly }
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: monthly }
```

⚠️ **Ogohlantirish:** avtomatik yangilanish **testlarsiz xavfli**. Kanon §3 ga
ko'ra loyihada amalda **0 ta test** bor. Ya'ni Dependabot PR'ini "yashil CI" asosida
merge qilish — bu **hech narsani tekshirmaslik**. Dependabot §14 dagi test ishidan
**keyin** yoqilsin, yoki har PR qo'lda tekshirilsin.

---

## 14. Xavfsizlik nazorat ro'yxati (production'ga chiqishdan oldin)

Ustuvorlik bo'yicha tartiblangan. Yuqoridagilar quyidagilardan **muhimroq**.

### 🔴 Bloklovchi — bularsiz chiqmaslik

- [ ] **RS-01** — Seed parollari **rotatsiya** qilingan (§2.5). Git tarixida
      `MathAdmin@20XX!` qoldi — bu **hozir** hal qilinadi, keyin emas
- [ ] **RS-01b** — `auth_attempts` tekshirilgan: `admin` hisobiga begona
      muvaffaqiyatli login bo'lganmi? Javob hujjatga yozilgan
- [ ] 🔴 **PWD-01** — `Math.random()` → `crypto.randomInt()` (§2.9).
      **Uchala fayl:** `students.service.ts:43`, `auth.service.ts:1483`,
      `users.service.ts:28`. Bitta qolsa — teshik ochiq
- [ ] 🔴 **PWD-02** — Mavjud `Math.random()` parollari rotatsiya qilingan yoki
      `must_change_password: true` (§2.9). PWD-01 siz ma'nosi yo'q
- [ ] **SWAG-01** — Swagger production'da **yopiq** (§7.3). `main.ts:137` shartsiz.
      3 qatorlik tuzatish
- [ ] **FILE-02** — `/uploads` da `Content-Disposition: attachment` + CSP sandbox
      (§4.3). Stored XSS zanjirini uzadi
- [ ] **BAK-01** — Yuklangan fayllar **efemer emas** (§12.1). `UPLOAD_DIR=/tmp/uploads`
      — bolalar suratlari har deploy'da yo'q bo'ladi
- [ ] **BAK-02** — DB zaxirasi mavjud **va tiklash sinab ko'rilgan** (§12.2).
      `plan: free` — avtomatik zaxira yo'q
- [ ] **RATE-01** — `@nestjs/throttler` o'rnatilgan, `trust proxy` sozlangan (§9.3)
- [ ] **SEC-01** — Production'da zaif JWT siri bilan ishga tushmaydi (§3.2)

### 🟠 Yuqori — birinchi oyda

- [ ] **FILE-01** — MIME **magic bytes** bilan tekshiriladi; kengaytma allow-list'dan
      (§4.2). `.html` diskka tushmaydi
- [ ] **FILE-03** — `/uploads` static o'rniga guard ostidagi endpoint (§4.4).
      Migratsiya 5 bosqichda
- [ ] **HDR-01** — `helmet` o'rnatilgan; CSP, HSTS, `frame-ancestors 'none'`;
      `x-powered-by` o'chirilgan (§8.2)
- [ ] **CORS-01** — Production'da wildcard origin **taqiqlangan** (§7.2)
- [ ] **SEC-03** — 11 ta o'lik env kaliti: **ishlatilsin yoki o'chirilsin** (§3.3)
- [ ] **ERR-01** — 5xx xatolar serverda loglanadi (§10.2). Hozir **hech qayerda**
- [ ] **DEP-01** — `npm audit` ishga tushirilgan, natija hujjatlashtirilgan (§13.2)
- [ ] `.github/workflows/security.yml` — gitleaks (`fetch-depth: 0`!) + npm audit (§3.4, §13.3)
- [ ] ⭐ **Tenant izolyatsiya testi** — "A tenanti B'ni o'qiy olmaydi". Kanon §6 ga
      ko'ra bu tizimning **eng muhim testi** va u **yo'q**
- [ ] **RBAC-01** — `teacher_group_subjects` modeli (§1.6). Hozir har qanday
      o'qituvchi butun tenantga baho qo'yadi. Migratsiya 4 bosqichda (3-bosqich —
      **faqat log**, darhol bloklash real ishni buzadi)
- [ ] **ENUM-01/02** — `TENANT_NOT_FOUND` → `INVALID_CREDENTIALS` + vaqt tekislash
      (§1.4). Slug tire bag'i bilan **birga** tuzatilsin
- [ ] **ISO-01** — `service['prisma']` naqshi olib tashlangan (4 joy) va ESLint
      bilan taqiqlangan (§1.7)
- [ ] **ISO-02** — `$extends` rejasi 18 ta `tenant_id` siz modelni hisobga oladi
      (§1.7). Ular avtomatik himoyadan tashqarida — `assessment_scores` ham
- [ ] §11.5 dagi savollar **yuristga berilgan** — ayniqsa 1-savol (surat = biometrik?)

### 🟡 O'rta

- [ ] **RATE-02** — Lock konfiguratsiyasi hardkod emas (§9.3)
- [ ] **SEC-02** — `.env.example:23` → `ACCESS_TOKEN_TTL="15m"` (§3.2)
- [ ] **SQL-01** — ESLint `$queryRawUnsafe` ni taqiqlaydi (§6). 0 ta ishlatilishi
      bor — arzon g'alaba
- [ ] **PWD-03** — ESLint `Math.random()` ni taqiqlaydi (§2.9). PWD-01 dan keyin
      0 ta ishlatilishi qoladi — arzon g'alaba
- [ ] **XSS-01** — `ChartConfig` API javobidan qurilmaydi (review checklist) (§5.2)
- [ ] `safeSegment` `..` ni rad etadi (§4.1)
- [ ] `guardian-files.controller.ts:93` → `ForbiddenException` (§4.5)
- [ ] Login xato xabari — "user not found" va "wrong password" **farq qilmaydi**
- [ ] Audit log **append-only** (DB trigger) — insider o'chira olmasin (§1.2 H4)
- [ ] `WEB_ORIGINS` `render.yaml` da (§7.2)
- [ ] Fayl o'qish auditga tushadi (FILE-03 bilan birga)
- [ ] Multer 2.x ga ko'chirish (§13.2)

### 🟢 Past

- [ ] `forbidNonWhitelisted: true` — ⚠️ testlardan **keyin** (§5.3)
- [ ] Redis-backed throttler storage (§9.3)
- [ ] `security.txt`
- [ ] Ommaviy o'qishni aniqlash alert'i (§1.2 H4)
- [ ] Frontend CSP (`vercel.json` / `_headers`)
- [ ] Retention siyosati — bitirgan o'quvchi ma'lumoti (§11.3)
- [ ] Pentest — MVP prod'dan oldin

---

## 15. Ochiq savollar

**Kritik — javob arxitekturaga ta'sir qiladi:**

1. ⭐ **O'quvchi surati "biometrik ma'lumot"mi?** (§11.2, §11.5-1) Agar ha — suratlar
   O'zbekistondagi serverga ko'chirilishi shart va BAK-01 ning yechimi o'zgaradi.
   **BAK-01 dan oldin javob kerak**, aks holda ish ikki marta qilinadi
2. **Production DB mavjudmi va unda `admin` hisobi `MathAdmin@20XX!` parolibilanmi?**
   (§2.5) Bu — ha/yo'q savoli. RS-01 shunga bog'liq
3. **Teshik ishlatilganmi?** `auth_attempts` da `admin` uchun begona IP'dan
   muvaffaqiyatli login bormi? Bu — hodisa **yuz berganmi yoki yo'qmi** degan
   savolga yagona javob manbai

4. **`Math.random()` parollari qancha hisobda ishlatilgan?** (§2.6) Ya'ni PWD-02
   rotatsiyasi nechta hisobni qamraydi — barchasinimi yoki faqat avtomatik
   yaratilganlarnimi? `students.service.ts:380,1330,1451` orqali yaratilgan har bir
   hisob ta'sirlangan. Bu — **son bilan javob beriladigan** savol

**Texnik — tekshirilishi kerak:**

5. ~~**Resource-level RBAC bormi?**~~ — ✅ **JAVOB TOPILDI (§1.6): YO'Q va sxemada
   majburlab bo'lmaydi.** `teacher_user_id` butun sxemada bitta joyda
   (`schema.prisma:1080`, `timetable_lessons`). O'qituvchi↔guruh bog'lanishi
   **mavjud emas**. Ya'ni `assessments.write` ruxsatli har qanday o'qituvchi butun
   tenant bo'ylab baho qo'yadi. **RBAC-01** buni hal qiladi
6. **`WEB_ORIGINS` production'da qanday o'rnatilgan?** `render.yaml` da yo'q (§7.2).
   Render dashboard'da qo'ldami? Agar ha — `render.yaml` haqiqatni aks ettirmaydi
6. **`npm audit` natijasi?** (§13.2) Bajarilmagan
7. **`console.log` da token/parol bormi?** Butun kodbaza grep qilinmagan (§10.3)
8. **Audit log o'chirilishi mumkinmi?** DB darajasida trigger bormi? (§1.2 H4)
9. **Redis parol bilan himoyalanganmi?** `.env.example:40` — `REDIS_PASSWORD=` bo'sh.
   `render.yaml` da Redis **umuman yo'q** — ya'ni production'da Redis bormi?
   `cache-manager-redis-store` dependency bor. Agar Redis yo'q bo'lsa —
   `auth.service.ts` dagi cache nima qilyapti?

**Tashkiliy:**

10. **Ota-ona roziligi hozir qanday olinadi?** Qog'ozdami? Agar ha — tizimga rozilik
    moduli kerak emas bo'lishi mumkin (§11.3)
11. **Akademiya Davlat reyestrida ro'yxatdan o'tganmi?** (§11.4)
12. **Buzilishda kimga xabar beriladi va qancha muddatda?** (§11.5-7) Bu raqam
    yuristdan olinadi va incident runbook'ga yoziladi. Runbook hozir **yo'q**
13. **RPO/RTO** — §12.3 dagi raqamlar **taklif**. Akademiya bilan kelishilsin
14. **Ko'p ijarachilikda kim "operator"?** SaaS'ga o'tishda hal qiluvchi (§11.5-8)

---

## Bog'liq hujjatlar

- `00-vision-and-market.md` — mahsulot vizyoni, bozor konteksti
- CANON §3 — o'lchangan holat (62 783 qator, 51 commit, **0 test**)
- CANON §5.1 — tenant izolyatsiyasi (845 qo'lda nuqta) — §1.2 H1 ning ildizi
- CANON §5.3 — RBAC — §1.2 H2 ning ildizi
- CANON §5.4 — mavjud xavfsizlik + `seed.ts` hodisasi (§2)
- CANON §6 — nima yo'q (test, CI, observability)
- `README.md:235` — `seed.ts` hodisasining ommaviy tavsifi
