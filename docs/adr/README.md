# Arxitektura qarorlari (ADR)

**ADR** — Architecture Decision Record. Har bir muhim texnik qaror shu yerda
yoziladi: **nima** qaror qilindi, **nega**, va **nima evaziga**.

## Nega ADR yoziladi

Olti oydan keyin siz (yoki loyihaga qo'shilgan yangi odam) "nega bu shunday
qilingan?" deb so'raysiz. ADR bo'lmasa javob yo'q — va odam qarorni "yomon" deb
hisoblab, o'zgartirib qo'yadi. Keyin o'sha muammoga qaytadan duch keladi.

ADR **niyatni** saqlaydi, kod esa faqat **natijani** saqlaydi.

Ziyo uchun bu ayniqsa muhim, chunki loyiha **allaqachon ishlaydi** va
**real xodimlar bilan real ma'lumot ustida** ishlaydi. Bu yerdagi ADR'larning
bir qismi yangi qaror emas — **mavjud, ammo hech qachon aytilmagan qarorni**
rasmiylashtiradi. Ular ikki xil:

- **Tasdiqlovchi** — mavjud amaliyot to'g'ri, ADR uni yozib qo'yadi va **narxini**
  qayd qiladi (0001, 0003, 0005, 0007)
- **Tuzatuvchi** — mavjud amaliyot va e'lon qilingan niyat **zid**, ADR farqni
  ochadi va yo'l ko'rsatadi (0002, 0004, 0006, 0008)

## Format

Har bir ADR quyidagilarni beradi:

| Bo'lim | Nima uchun |
|---|---|
| **Kontekst** | Qanday sharoitda bu savol tug'ildi |
| **Qaror** | Nima qilindi — aniq va qisqa |
| **Sabablar** | Nega aynan shu. Alternativalar nega rad etildi |
| **Oqibatlar** | Ijobiy **va salbiy**. Salbiysiz ADR — reklama |
| **Qachon qayta ko'riladi** | Qaysi signal bu qarorni bekor qiladi |

**Salbiy oqibatlar bo'limi majburiy.** Har qaror narxga ega. Narxi ko'rsatilmagan
qaror — o'ylanmagan qaror.

**Rad etilgan alternativaning ustunligi ham yoziladi.** Aks holda bu qaror emas,
o'zini oqlash.

Shakl: [TEMPLATE.md](./TEMPLATE.md).

## Holat

- **Taklif** — muhokamada, hali amalda emas
- **Qabul qilingan** — amalda
- **Bekor qilingan** — endi amal qilmaydi, lekin **o'chirilmaydi** (tarix qimmatli)
- **Almashtirilgan** — yangi ADR bilan (havola bilan)

ADR **o'zgartirilmaydi**. Qaror o'zgarsa — yangi ADR yoziladi va eskisi
"Almashtirilgan" deb belgilanadi. Bu tarixni saqlaydi.

⚠️ **"Taklif" — bu "yozilgan, lekin hali bajarilmagan" degani.** Quyidagi
ro'yxatda to'rtta Taklif bor va ular **ish rejasi**, tavsif emas.

## Ro'yxat

| # | Qaror | Holat | Nima evaziga |
|---|---|---|---|
| [0001](./0001-shared-database-multi-tenancy.md) | Ko'p ijarachilik: yagona database + har jadvalda `tenant_id` | Qabul qilingan | Izolyatsiya kafolati kodda, bazada emas → bitta unutilgan filtr = ma'lumot sizishi |
| [0002](./0002-prisma-extension-for-tenant-isolation.md) | Tenant izolyatsiyasi Prisma client extension (`$extends`) bilan avtomatik | Taklif | **845 ta** qo'lda nuqta migratsiya qilinadi; `tenant_id` siz 18 model uchun extension nested filtr talab qiladi — muammo yo'qolmaydi, ko'chadi |
| [0003](./0003-bigint-primary-keys.md) | Birlamchi kalitlar: `BigInt @default(autoincrement())` | Qabul qilingan | JSON serializatsiya qo'lda; API'da ID string; ketma-ket ID sanoqni oshkor qiladi |
| [0004](./0004-dtm-scoring-in-domain-layer.md) | DTM 189 ball qoidasi domen qatlamida majburlanadi, frontendda emas | Taklif | Domen qoidasi kodga qattiq bog'lanadi; mavjud yaroqsiz ma'lumot migratsiya talab qiladi |
| [0005](./0005-permission-based-rbac.md) | RBAC ruxsat darajasida, rol darajasida emas (`@RequirePermissions` 234 ta) | Qabul qilingan | Ruxsat "nima qilish mumkin"ni ayta oladi, "qaysi resursga"ni **yo'q** — bu ma'lumot modeli bo'shlig'i; guard fail-open |
| [0006](./0006-money-decimal-in-db-string-at-api.md) | Pul: bazada `Decimal(12,2)`, API chegarasida string. `Number()` hech qachon | Taklif | `Decimal` noqulay va `a > b` jimgina noto'g'ri ishlaydi; muammo mijozga ko'chadi (`parseFloat`) |
| [0007](./0007-postgres-as-only-datastore.md) | PostgreSQL — yagona ma'lumot ombori. Redis qo'shilmaydi | Qabul qilingan | Kesh bekor qilinishi faqat o'z process'ida → **"1 instance" yashirin shartga aylanadi** |
| [0008](./0008-migrations-as-source-of-truth.md) | Migratsiya tarixi — sxemaning yagona haqiqat manbai. `db push` hech qachon | Taklif | Tuzatish nozik (`migrate resolve --applied`); CI bo'lmasa drift **qaytadi** — niyat allaqachon bir marta ishlamagan |

## O'qish tartibi

Agar birinchi marta o'qiyotgan bo'lsangiz:

1. **[0001](./0001-shared-database-multi-tenancy.md)** — loyihaning o'zagi. Qolgan
   hamma narsa shundan kelib chiqadi
2. **[0002](./0002-prisma-extension-for-tenant-isolation.md)** — 0001 ning eng
   katta narxi va uni qanday to'lash
3. **[0008](./0008-migrations-as-source-of-truth.md)** — ⚠️ **ishlar ketma-ketligida
   birinchi**. CI, staging, test — hammasi shunga tayanadi

⚠️ **0008 nega birinchi:** hozir toza bazada `prisma migrate deploy` ishga
tushirilsa, ilova **ko'tarilmaydi** (migratsiyada 68 jadval, sxemada 69 model —
`track_subjects` va `SubjectRole` yo'q). Ya'ni [0002](./0002-prisma-extension-for-tenant-isolation.md)
talab qiladigan **tenant izolyatsiya testini yozib bo'lmaydi**, chunki test
ishga tushadigan baza qurilmaydi. Test yozishdan oldin — baza.

## O'zaro bog'liqliklar

Bu ADR'lar mustaqil emas:

- **0001 → 0002** — shared database izolyatsiya mexanizmini **talab qiladi**
- **0005 → 0007** — ruxsat modeli keshni **talab qiladi**, kesh esa "1 instance"
  farazi ustida turibdi
- **0008 → 0002, 0004, 0006** — hammasi migratsiya ishonchli bo'lishini kutadi.
  Xususan [0006](./0006-money-decimal-in-db-string-at-api.md) dagi BigInt
  alternativasi 0008 hal bo'lmaguncha **texnik jihatdan mumkin emas**
- **0003 ↔ 0006** — bitta naqsh: **aniqligi muhim son API chegarasida string**

## Yangi ADR qachon yoziladi

Qaror **qaytarish qimmat** bo'lsa:

- Ma'lumotlar bazasi yoki asosiy framework tanlash
- Ma'lumot modelining tuzilmaviy qarori (PK tipi, pul ifodasi, `tenant_id` joylashuvi)
- Domen qoidasi qayerda yashashi (DTM 189 — domen qatlamimi, UI'mi)
- Xavfsizlik mexanizmi (hash, token strategiyasi, avtorizatsiya modeli)
- Modul chegarasini o'zgartirish
- Tashqi bog'liqlik qo'shish (yangi servis, yangi infra — masalan Redis)

**ADR kerak emas:** kutubxona versiyasini yangilash, papka nomini o'zgartirish,
kod uslubi (bular linter ishi).

Shubha bo'lsa — yozing. Yozilmagan ADR ning narxi yozilganidan yuqori.

⚠️ **Va yozilgan ADR ham yetarli emas.** Kanon "Migration majburiy, `db push`
hech qachon" deb **allaqachon** yozgan edi — drift baribir sodir bo'ldi
([0008](./0008-migrations-as-source-of-truth.md)). Qaror **majburlanmasa**
(CI, ESLint, test) — u faqat umid. Har ADR o'zining majburlash mexanizmini
ko'rsatishi kerak.

## Yangi ADR yaratish

```bash
cp docs/adr/TEMPLATE.md docs/adr/00XX-qisqa-nom.md
```

Raqam ketma-ket. Nom `kebab-case`, **qaror mazmunini** bildirsin
(`0009-teacher-group-scope.md`, `0009-new-decision.md` emas).
