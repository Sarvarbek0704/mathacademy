# 12 — Frontend texnik spetsifikatsiyasi

> **Hujjat maqomi:** Qoralama · **Oxirgi yangilanish:** 2026-07-15
> **Egasi:** Sarvarbek Sodiqov
> **Loyiha:** MathAcademy Digital Campus · github.com/Sarvarbek0704/mathacademy

---

> ## ⚠️ Bu hujjat DIZAYN haqida EMAS
>
> Ushbu spetsifikatsiya **faqat texnik** qatlamni qamraydi: arxitektura, holat
> boshqaruvi, ishlash (performance), ochiqlik (accessibility), xatolik ishlash,
> testlar.
>
> **Rang, shrift, layout, bo'shliq, komponent ko'rinishi — bu hujjatda QAROR
> QILINMAYDI.** Bularning hammasi 14-bo'limda **ochiq savol** sifatida qoldirilgan
> va muallif tomonidan alohida muhokama qilinadi.
>
> Agar quyida `bg-success/10` yoki `text-2xl` kabi class ko'rsangiz — bu **mavjud
> kodni tasvirlash**, tavsiya emas.

---

## 0. Ushbu hujjatdagi raqamlar qayerdan olingan

Kanon qoidasi: *"Halol bo'l. Raqam to'qima."* Shuning uchun quyidagi jadval har bir
texnik da'voni **qanday tekshirilganini** ko'rsatadi.

| Da'vo | Tekshirish usuli | Natija |
|---|---|---|
| Frontend hajmi | `find src -name "*.tsx" -o -name "*.ts" \| xargs wc -l` | **25 489** qator — kanonga **mos** |
| Sahifalar soni | `ls pages/staff` (36) + `ls pages/guardian` (12) | **48** — kanonga **mos** |
| Bundle hajmi | `npm run build` — real ishga tushirilgan | quyida, 8-bo'lim |
| Code splitting | `grep "lazy(" src/App.tsx` | **48/48 sahifa lazy** |
| BigInt xavfsizligi | regex grep ID koersiyasi bo'yicha | **0 natija** — toza |
| **Fan roli indeksdan o'qiladi** | `AssessmentsPage.tsx:185-189` + `schema.prisma` | ⚠️ **Tasdiqlandi — bag** |
| `group_subjects` da rol/tartib ustuni | `grep -A8 "model group_subjects" schema.prisma` | **Ikkalasi ham yo'q** |
| `group_subjects` `ORDER BY` | `groups.service.ts:183` | ⚠️ **Bor** — `subject_id ASC` (xabar qilinganidan farq) |
| Framer Motion | `grep -rn "framer-motion" src/` | **0 natija** — ishlatilmaydi |
| i18n | `grep -rn "i18next\|useTranslation" src/` | **0 natija** — yo'q |
| `aria-label` | `grep -ro "aria-label" pages/ components/` | **1 ta** |
| Refresh cookie | `apps/api/src/modules/auth/auth.service.ts:114-115` | `httpOnly: true` — **to'g'ri** |

> **Metodologik izoh:** quyida ikkita joyda men **dastlabki gipotezani rad etdim**
> (BigInt bagi va guardian jadval overflow'i). Ikkalasi ham grep bilan tekshirilganda
> **muammo yo'q** chiqdi. Halollik shuni talab qiladi: bo'lmagan bagni "topdim" deb
> yozish — bor bagni o'tkazib yuborishdan kam zarar emas.
>
> ⚠️ **Uchinchi holat — teskarisi.** 5.1-bo'limdagi bag menga tashqaridan
> (`07-dtm` agentidan) yetkazildi. Men uni **tasdiqladim**, lekin **mexanizmi
> boshqacha** chiqdi: menga *"`ORDER BY` yo'q, PostgreSQL tartibni kafolatlamaydi"*
> deyilgandi — aslida `groups.service.ts:183` da **`ORDER BY` bor**. Bag **real**,
> lekin sababi boshqa — va **yomonroq** (5.1.3). Berilgan xulosani tekshirmasdan
> qabul qilish — o'zim to'qib chiqarish bilan **bir xil xato**.

---

## 1. Hozirgi arxitektura

### 1.1. Stack (kanon bo'yicha, `package.json` bilan tasdiqlangan)

| Qatlam | Texnologiya | Versiya (`package.json`) |
|---|---|---|
| UI kutubxona | React | **18.3.1** (pin qilingan, `^` yo'q) |
| Build | Vite | **^5.4.19** (build log: `vite v5.4.21`) |
| Til | TypeScript | **^5.8.3** ⚠️ kanon 5.7 deydi |
| Stillar | Tailwind CSS | **^3.4.17** |
| Komponentlar | shadcn/ui (Radix primitivlari) | 26 ta `@radix-ui/*` paket |
| Server holati | TanStack Query | **^5.83.0** |
| HTTP | axios | **^1.13.5** |
| Routing | react-router-dom | **^6.30.3** |
| Grafiklar | Recharts | **^2.15.4** |
| Animatsiya | Framer Motion | **^12.34.3** ⚠️ **ishlatilmaydi** — 6.4-bo'limga qarang |
| Formalar | react-hook-form + zod | ^7.61.1 / ^3.25.76 |
| Sana | dayjs (12 fayl) + date-fns (**0 fayl**) | ^1.11.19 / ^3.6.0 |
| Toast | sonner | ^1.7.4 |
| Test | Vitest + Testing Library | ^3.2.4 / ^16.0.0 |

> ⚠️ **Kichik ziddiyat (kanon vs kod):** kanon TypeScript **5.7** deydi, `package.json:88`
> da `"typescript": "^5.8.3"`. Bu buzuvchi farq emas, lekin kanon yangilanishi kerak.
> Ushbu hujjat **kodni** haqiqat manbai deb oladi.

### 1.2. Papka strukturasi (real, `ls` bilan olingan)

```
apps/web/src/
├── App.tsx                 # Router + provider'lar + 48 lazy route
├── main.tsx                # ReactDOM.createRoot
├── index.css               # Tailwind direktivalari + CSS o'zgaruvchilar
├── components/
│   ├── ui/                 # shadcn/ui primitivlari (table.tsx, sheet.tsx, …)
│   ├── layout/             # StaffLayout.tsx, GuardianLayout.tsx
│   └── shared/             # 11 ta umumiy komponent ↓
│       ├── AppLogo.tsx         ConfirmDialog.tsx    PageHeader.tsx
│       ├── AvatarUpload.tsx    DataTable.tsx        PageSkeleton.tsx
│       ├── Breadcrumbs.tsx     FormModal.tsx        SlideOver.tsx
│       ├── StatCard.tsx        StatusBadge.tsx
├── hooks/
│   ├── useCrud.ts          # ⬅️ poydevor — 2-bo'lim
│   ├── use-mobile.tsx      # useIsMobile() — faqat ui/sidebar.tsx da ishlatiladi
│   └── use-toast.ts
├── lib/
│   ├── api.ts              # axios instance + interceptor'lar
│   ├── auth.tsx            # AuthProvider + useAuth (React Context)
│   ├── theme.tsx           # ThemeProvider (light/dark)
│   └── utils.ts            # faqat cn() — 6 qator
├── pages/
│   ├── staff/              # 36 sahifa
│   ├── guardian/           # 12 sahifa
│   └── NotFound.tsx
└── test/
    ├── example.test.ts     # ⬅️ yagona test — placeholder
    └── setup.ts            # matchMedia mock
```

**Kuzatuv — struktura sog'lom.** Qatlamlar aniq ajratilgan: `lib/` (infratuzilma) →
`hooks/` (mantiq) → `components/shared/` (qayta ishlatiladigan UI) → `pages/`
(kompozitsiya). Bu **buzilmasin**.

⚠️ **`package.json:2` — `"name": "vite_react_shadcn_ts"`.** Bu Lovable shablonining
qoldiq nomi. Shuningdek `devDependencies` da `lovable-tagger` bor va `vite.config.ts`
da development rejimida ulanadi. Production'ga ta'siri yo'q (faqat `mode === "development"`),
lekin **repo public** — bu nom mahsulot jiddiyligi haqida noto'g'ri signal beradi.
Tuzatish arzon: `"name": "@mathacademy/web"`.

---

## 2. `useCrud` — poydevor

### 2.1. To'liq kod (`apps/web/src/hooks/useCrud.ts`, 94 qator)

Bu hook **21 ta sahifada** ishlatiladi (`grep -rl "useCrud" pages/ | wc -l` = 21).

```ts
export function useCrud<T = any>({ endpoint, queryParams = {}, autoFetch = true }: UseCrudOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  // Stable ref to avoid stale closure issues with queryParams
  const queryParamsRef = useRef(queryParams);
  useEffect(() => { queryParamsRef.current = queryParams; });

  const fetchData = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const currentPage = p ?? page;
      const res = await api.get(endpoint, {
        params: { page: currentPage, limit, search: search || undefined, ...queryParamsRef.current },
      });
      const result = res.data;
      if (Array.isArray(result)) {                    // shakl 1: [] 
        setData(result); setTotal(result.length);
      } else if (result?.data) {                      // shakl 2: { data, total|meta.total }
        setData(result.data); setTotal(result.total ?? result.meta?.total ?? result.data.length);
      } else if (result?.items) {                     // shakl 3: { items, total }
        setData(result.items); setTotal(result.total ?? result.items.length);
      } else { setData([]); setTotal(0); }
    } catch {
      // errors handled by api interceptor
    } finally { setLoading(false); }
  }, [endpoint, page, search]);                       // queryParams handled via ref
  // …create / update / remove
}
```

### 2.2. Nima qiladi

| Imkoniyat | Amalga oshirilishi |
|---|---|
| **Pagination** | `page` state + qattiq kodlangan `limit = 20`; `totalPages = Math.ceil(total / limit)` |
| **Search** | `search` state → `params.search`; bo'sh satr `undefined` ga aylanadi (query'ga tushmaydi) |
| **Create** | `POST {endpoint}` → toast → `fetchData()` |
| **Update** | `PATCH {endpoint}/{id}` → toast → `fetchData()` |
| **Delete** | `DELETE {endpoint}/{id}` → toast → `fetchData()` |
| **Javob normalizatsiyasi** | 3 xil API javob shaklini bitta `T[]` ga keltiradi |

### 2.3. ⬅️ Bu YAXSHI qaror — nega

Kanon `useCrud` ni poydevor deb belgilaydi. **Bu to'g'ri va himoya qilinishi kerak.**

Sabab — **arifmetika, did emas.** Agar 21 sahifa CRUD mantiqini qo'lda yozganida:

- **21 ta pagination hisobi.** `Math.ceil(total / limit)` — bittasida `Math.floor`
  yozilsa, oxirgi sahifa yo'qoladi. Jimgina.
- **21 ta javob-shakli tekshiruvi.** Backend'da `{data, total}`, `{items, total}` va
  yalang'och `[]` — **uchala shakl ham mavjud** (shuning uchun hook'da 3 ta tarmoq bor).
  Har sahifa buni mustaqil hal qilsa, 21 ta biroz boshqacha `if` zanjiri paydo bo'ladi.
- **21 ta xato ishlash yo'li.** Hozir `catch {}` bo'sh — chunki `api.ts` interceptor'i
  toast'ni **markazda** ko'rsatadi. 21 sahifa buni takrorlasa — foydalanuvchi bitta
  xatoga 2 ta toast ko'radi yoki hech nima ko'rmaydi.

Ya'ni: **hook 21 ta xato joyini 1 ta xato joyiga siqadi.** Bag paydo bo'lsa — bitta
faylda tuzatiladi va 21 sahifa birdan tuzaladi. Bu abstraksiya **narxini oqlaydi**.

> **TZ qoidasi:** `useCrud` ni **o'chirmang va qayta yozmang**. Quyidagi 2.4 dagi
> baglar hook **ichida** tuzatiladi — chaqiruvchi 21 sahifa tegilmaydi. Aynan shu
> abstraksiyaning qiymati.

### 2.4. ⚠️ `useCrud` dagi uchta real bag

Kanon: *"Mavjud kodni tanqid qilganda — aniq fayl va qator ko'rsat."*

---

#### Bag №1 — qidiruv sahifani qayta o'rnatmaydi (`useCrud.ts:56`)

```ts
const fetchData = useCallback(async (p?: number) => {
  const currentPage = p ?? page;   // ⬅️ page ESKI qiymatda qoladi
  …
}, [endpoint, page, search]);      // ⬅️ search o'zgarsa qayta yaratiladi, lekin page saqlanadi
```

**Ssenariy:** foydalanuvchi o'quvchilar ro'yxatida **5-sahifaga** o'tadi → qidiruvga
`Ali` yozadi → so'rov `?page=5&search=Ali` ketadi → `Ali` bo'yicha atigi 3 ta natija
bor, 5-sahifa **bo'sh** → ekranda *"Ma'lumot topilmadi"*.

Foydalanuvchi xulosasi: *"Ali yo'q ekan."* Aslida Ali bor. **Bu jimgina noto'g'ri
javob** — eng yomon turdagi bag, chunki xato xabari yo'q.

**Tuzatish** (hook ichida, sahifalarga tegmasdan):

```ts
const setSearch = (q: string) => {
  setSearchState(q);
  setPageState(1);   // qidiruv o'zgarsa — 1-sahifaga qayt
};
```

---

#### Bag №2 — debounce yo'q, har harfga bitta so'rov

`grep -rn "debounce\|useDeferredValue" src/` → **0 natija**.

`DataTable.tsx:89` da `onChange` **to'g'ridan-to'g'ri** `onSearch` ni chaqiradi:

```tsx
onChange={(e) => handleSearch(e.target.value)}   // har bosilgan tugma = 1 HTTP so'rov
```

`Ali Valiyev` (11 belgi) yozish = **11 ta so'rov**. Bu — server yuki + ota-ona mobil
trafigi.

---

#### Bag №3 — poyga holati (race condition), bekor qilish yo'q

`grep -rn "AbortController\|signal:" src/` → **0 natija**.

№2 bilan birga bu **ma'lumot to'g'riligi** muammosiga aylanadi:

```
t=0ms   "Al"  → so'rov A ketdi
t=50ms  "Ali" → so'rov B ketdi
t=300ms          so'rov B qaytdi → setData(Ali natijalari)   ✅
t=400ms          so'rov A qaytdi → setData(Al natijalari)    ❌ ESKI javob YANGISINI bosdi
```

Natija: qidiruv maydonida `Ali` yozilgan, jadvalda `Al` natijalari. **Ekrandagi
ma'lumot qidiruvga mos kelmaydi.** Sekin tarmoqda (ota-ona 3G'da) ehtimollik yuqori.

**Tuzatish — ikkalasi bitta joyda:**

```ts
const fetchData = useCallback(async (p?: number) => {
  abortRef.current?.abort();               // oldingi so'rovni bekor qil
  const ctrl = new AbortController();
  abortRef.current = ctrl;
  try {
    const res = await api.get(endpoint, { params: {…}, signal: ctrl.signal });
    …
  } catch (e) {
    if (axios.isCancel(e)) return;         // bekor qilingan — state'ga tegma
  }
}, [endpoint, page, search]);
```

> ✅ `api.ts:146,148` da `error.code !== 'ERR_CANCELED'` **allaqachon tekshirilgan** —
> ya'ni interceptor bekor qilingan so'rovga toast ko'rsatmaydi. Infratuzilma
> `AbortController` uchun **tayyor**, faqat `useCrud` uni ishlatmaydi.

---

#### Kichik kuzatuv — `limit = 20` qattiq kodlangan (`useCrud.ts:17`)

```ts
const limit = 20;   // sozlab bo'lmaydi
```

`UseCrudOptions` da `limit` yo'q. 21 sahifaning hammasi 20 ta yozuv ko'rsatishga
majbur. Sahifa "50 tadan ko'rsat" xohlasa — hook'ni chetlab o'tishi kerak.
Bu 3.1-bo'limdagi ikkilanishning bir sababi bo'lishi mumkin.

---

## 3. Umumiy komponentlar

`components/shared/` — 11 ta fayl. TZ 4 tasini talab qiladi:

### 3.1. `DataTable.tsx` (163 qator)

**Nima qiladi:** ustun konfiguratsiyasi (`Column<T>[]`) asosida jadval chizadi;
skeleton loading, bo'sh holat, qidiruv maydoni va pagination boshqaruvini o'z ichiga
oladi.

```ts
export interface Column<T> {
  key: string;
  title: string;
  render?: (item: T) => ReactNode;   // maxsus render — ixtiyoriy
  className?: string;
}
```

**Yaxshi tomonlari:**
- `loading` → `SkeletonRows` (`DataTable.tsx:40-59`) — bo'sh ekran emas, shakl ko'rsatiladi
- `rows = Array.isArray(data) ? data : []` (`:73`) — mudofaaviy, API kutilmagan narsa
  qaytarsa qulamaydi
- `pagination.totalPages > 1` (`:135`) — bitta sahifa bo'lsa boshqaruv ko'rsatilmaydi

⚠️ **Muammo — ikki nusxadagi qidiruv holati.** `DataTable.tsx:72` da:

```tsx
const [search, setSearch] = useState('');   // ⬅️ DataTable O'ZINING search state'i
```

Lekin `useCrud` da **ham** `search` state bor. `SimpleCrudPage.tsx:35` da ikkalasi
ulanadi: `onSearch={setSearch}` — ya'ni **bitta qiymat ikki joyda saqlanadi**.
DataTable — nazorat qilinuvchi (controlled) emas: `value` prop qabul qilmaydi.

Oqibati: `useCrud.setSearch('')` ni dasturiy chaqirsangiz, **input maydoni tozalanmaydi** —
DataTable o'z ichki `search` ini bilaveradi. Hozir buni hech kim chaqirmaydi, shuning
uchun bag ko'rinmaydi — **latent**. Bag №1 tuzatilganda (qidiruvda `setPage(1)`) bu
yuzaga chiqishi mumkin.

**Yechim:** `DataTable` ga ixtiyoriy `searchValue?: string` prop qo'shib, controlled
qilish. `searchValue` berilmasa — hozirgi ichki holat ishlaydi (orqaga moslik saqlanadi).

⚠️ **`key={item.id || i}` (`:121`).** `item.id` bo'lmasa indeksga qaytadi. Indeks key —
ro'yxat tartibi o'zgarganda React'ni chalg'itadi. Barcha entity'da `id` bor, shuning
uchun amalda ishlaydi; lekin `||` `id === 0` yoki `id === ''` da ham indeksga o'tadi.
`??` xavfsizroq (BigInt string'lar uchun `'0'` — truthy, shuning uchun hozir xavf yo'q).

### 3.2. `SlideOver.tsx` (46 qator)

Radix `Sheet` ustidagi yupqa qobiq. Yon panelda forma/tafsilot ko'rsatadi.
`size` prop: `sm | md | lg | xl | full`.

**Texnik ahamiyati:** Radix `Dialog` primitivi ustida qurilgani uchun **fokus qamovi
(focus trap), `Esc` bilan yopish, `aria-modal`, fonni inert qilish** — hammasi
**tekin keladi**. Bu 10-bo'lim (a11y) uchun muhim.

⚠️ `SheetContent className="overflow-y-auto overflow-x-visible"` (`:37`) — bir vaqtda
`overflow-y: auto` va `overflow-x: visible` **CSS spetsifikatsiyasi bo'yicha mumkin emas**:
bir o'q `auto` bo'lsa, ikkinchisidagi `visible` brauzer tomonidan `auto` ga aylantiriladi.
Ya'ni `overflow-x-visible` **ta'sirsiz**. Zararsiz, lekin niyat bajarilmayapti — agar
maqsad dropdown'ni panel chetidan chiqarish bo'lsa, u ishlamaydi (Radix `Portal` kerak).

### 3.3. `StatCard.tsx` (52 qator)

Dashboard'dagi ko'rsatkich kartasi: `title`, `value`, `icon`, ixtiyoriy `description`,
`trend` va `onClick`.

```tsx
{trend && (
  <p className={cn("text-xs font-medium", trend.value >= 0 ? "text-success" : "text-destructive")}>
    {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
  </p>
)}
```

⚠️ **A11y muammosi — ma'no faqat rang va belgida.** O'sish/pasayish `text-success` /
`text-destructive` (rang) + `↑`/`↓` (Unicode belgi) orqali beriladi. Screen reader
`↑` ni turlicha o'qiydi (ba'zilari "yuqoriga o'q", ba'zilari umuman o'qimaydi).
Rang ko'rmaydigan foydalanuvchi uchun `↑ 5%` va `↓ 5%` farqi yo'qolishi mumkin.

**Yechim (texnik, dizaynga tegmaydi):** matnli muqobil qo'shish —
`<span className="sr-only">{trend.value >= 0 ? 'o\'sish' : 'pasayish'}</span>`.
Vizual ko'rinish **o'zgarmaydi**.

⚠️ `onClick` **`<Card>` (ya'ni `<div>`) ga** qo'yilgan (`:31`), `<button>` ga emas.
Natija: **klaviatura bilan bosib bo'lmaydi** (`Tab` fokus olmaydi, `Enter` ishlamaydi),
screen reader uni bosiladigan deb e'lon qilmaydi. 10-bo'limga qarang.

### 3.4. `StatusBadge.tsx` (52 qator)

Status kodini rangli nishonga aylantiradi. Ikki xarita: `statusStyles` (ko'rinish) va
`statusLabels` (o'zbekcha matn).

```tsx
{label || statusLabels[status] || status}   // :49 — uch bosqichli fallback
```

**Yaxshi tomoni — mudofaaviy fallback.** Noma'lum status kelsa, `statusStyles[status] ||
'bg-muted…'` (`:47`) neytral ko'rinish beradi va **xom kodni** ko'rsatadi. Qulamaydi.

⚠️ **Bag — `WARNING` kaliti mos kelmaydi.** `Status` tipida `'WARNING'` e'lon qilingan
(`:7`), lekin `statusStyles` da kalit **`WARNING_ACTION`** (`:27`). `statusLabels` da
esa `WARNING` **umuman yo'q**. Ya'ni:

```tsx
<StatusBadge status="WARNING" />   // → neytral kulrang + xom "WARNING" matni
```

Intizom modulida `WARNING` real status (kanon 4.2: `WARNING` / `RESTRICTION` /
`FINAL_NOTICE`). Demak ota-ona intizom sahifasida **inglizcha "WARNING"** ko'radi,
o'zbekcha "Ogohlantirish" emas — va rang ogohlantirish emas, kulrang.

**Tuzatish:** `WARNING_ACTION` → `WARNING` ga o'zgartirish + `statusLabels` ga
`WARNING: 'Ogohlantirish', RESTRICTION: 'Cheklov', FINAL_NOTICE: 'Oxirgi ogohlantirish'`
qo'shish.

⚠️ **`Status` tipi `| string` bilan tugaydi (`:9`)** — bu butun union'ni yeb yuboradi.
TypeScript uchun `Status` = `string`. Ya'ni `<StatusBadge status="TYPO" />` **kompilyatsiya
xatosi bermaydi**. Aynan shuning uchun yuqoridagi `WARNING` bagi kompilyatorda
tutilmagan. Agar `label` prop'i majburiy bo'lmagan holatlar uchun qat'iy tip kerak
bo'lsa — `| string` olib tashlanishi kerak (lekin bu chaqiruv joylarini sindirishi
mumkin — o'lchov bilan aniqlanadi).

---

## 4. Holat boshqaruvi

### 4.1. Umumiy manzara

| Holat turi | Vosita | Qayerda |
|---|---|---|
| **Server holati (A)** | TanStack Query | **41 sahifa** |
| **Server holati (B)** | `useCrud` (axios + `useState`) | **21 sahifa** |
| **Autentifikatsiya** | React Context (`AuthProvider`) | `lib/auth.tsx` |
| **Mavzu (theme)** | React Context (`ThemeProvider`) | `lib/theme.tsx` |
| **Lokal UI holati** | `useState` | sahifa ichida (modal ochiq/yopiq, forma) |
| **Global client holati** | **yo'q** — Zustand/Redux/Jotai **o'rnatilmagan** | — |

`package.json` da Zustand, Redux, Jotai, Recoil, MobX — **yo'q**. Bu **to'g'ri qaror**:
serverdan kelmaydigan, sahifalar orasida bo'lishiladigan holat amalda faqat `user` va
`theme` — ikkalasi ham Context uchun ideal (kamdan-kam o'zgaradi, shuning uchun Context'ning
qayta render muammosi yuzaga kelmaydi). Zustand qo'shish — **asossiz murakkablik**.

### 4.2. ⚠️ Izchilmi? — YO'Q. Ikkita raqobatdosh naqsh yonma-yon yashaydi

Bu bo'limning asosiy topilmasi. O'lchangan:

```bash
$ grep -rl "useCrud" pages/ | wc -l      # 21
$ grep -rl "useQuery" pages/ | wc -l     # 41
$ grep -rl "useCrud" pages/ | xargs grep -l "useQuery" | wc -l   # 16  ⬅️
```

**16 ta sahifa IKKALA naqshni bir vaqtda ishlatadi.**

Ya'ni bitta sahifada:
- Bir qism ma'lumot `useCrud` orqali — **`useState` da**, keshsiz
- Boshqa qism `useQuery` orqali — **QueryClient keshida**, `staleTime: 30s` bilan

**Nega bu texnik muammo (did emas):**

1. **Keshni bekor qilish (invalidation) ishlamaydi.** `useCrud.create()` (`useCrud.ts:66`)
   `fetchData()` chaqiradi — bu **faqat o'z `useState` ini** yangilaydi. Agar o'sha
   sahifadagi `useQuery` (masalan statistika) o'sha ma'lumotga tayansa — u **eskiligicha
   qoladi**, chunki `queryClient.invalidateQueries()` chaqirilmaydi.

   **Real oqibat:** xodim yangi o'quvchi qo'shadi → jadvalda ko'rinadi (useCrud yangilandi)
   → yuqoridagi "Jami o'quvchilar: 247" StatCard **246 da qoladi** (useQuery keshi tegilmadi).
   Xodim raqamga ishonmay qoladi.

2. **Ikki xil `loading`.** `useCrud.loading` va `useQuery.isLoading` — bitta sahifada
   ikkita mustaqil skeleton holati. Ular navbat bilan yonib o'chadi.

3. **`retry` va `staleTime` faqat yarmiga ta'sir qiladi.** `App.tsx:68-76` da:

   ```ts
   const queryClient = new QueryClient({
     defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
   });
   ```

   Bu siyosat `useCrud` ga **umuman tegishli emas** — u axios'ni to'g'ridan-to'g'ri
   chaqiradi. Ya'ni "tarmoq xatosida 1 marta qayta urin" qoidasi 41 sahifada bor,
   21 sahifada yo'q. Bir xil ko'rinadigan ikkita sahifa tarmoq uzilishida **boshqacha
   tutadi**.

4. **43 sahifa `api.get/post/patch/delete` ni to'g'ridan-to'g'ri chaqiradi**
   (`grep -rl "api\.\(get\|post\|patch\|delete\)" pages/ | wc -l` = 43) — ya'ni
   uchinchi yo'l ham mavjud.

### 4.3. Tavsiya — `useCrud` ni TanStack Query ustiga ko'chirish

**Muhim:** bu `useCrud` ni **o'chirish emas**. API (`data`, `loading`, `page`, `create`,
`update`, `remove`) **o'zgarishsiz qoladi** — faqat ichi almashadi. 21 sahifa
**tegilmaydi**.

```ts
export function useCrud<T = any>({ endpoint, queryParams = {}, autoFetch = true }: UseCrudOptions) {
  const [page, setPage] = useState(1);
  const [search, setSearchState] = useState('');
  const qc = useQueryClient();

  const key = [endpoint, { page, search, ...queryParams }];

  const { data: res, isLoading } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.get(endpoint, { params: {…}, signal }).then(r => r.data),
    enabled: autoFetch,
    placeholderData: keepPreviousData,   // sahifa almashganda jadval "sakramaydi"
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [endpoint] });
  // create/update/remove → useMutation({ onSuccess: invalidate })

  return { data: normalize(res), loading: isLoading, /* …o'sha interfeys */ };
}
```

**Bu bitta o'zgarish nimani hal qiladi:**

| Muammo | Qanday hal bo'ladi |
|---|---|
| Bag №2 (debounce yo'q) | `queryKey` kesh — bir xil kalit takroran so'ralmaydi (to'liq yechim uchun debounce baribir kerak) |
| Bag №3 (poyga holati) | TanStack `signal` beradi + eski javobni **o'zi tashlaydi** |
| 4.2 №1 (kesh eskirishi) | `invalidateQueries` **ikkala** naqshni yangilaydi — StatCard raqami tuzaladi |
| 4.2 №3 (`retry` yarmiga) | `useCrud` `QueryClient` siyosatiga **bo'ysunadi** |
| 4.2 №2 (ikki `loading`) | Bitta manba — bitta skeleton |

**Migratsiya yo'li (kanon 1-bo'lim: "ishlab turgan tizimni buzmasligi kerak"):**

1. `useCrud` ni Query ustiga qayta yozish + **`useCrud` uchun test yozish** (12-bo'lim)
2. Testlar o'tsa — **21 sahifa avtomatik ko'chadi**, kod o'zgarmaydi
3. Har sahifani qo'lda tekshirish emas — **shartnoma (interfeys) saqlangani** buni keraksiz qiladi
4. Keyin 16 ta aralash sahifada `queryKey` larni moslashtirish (bu **qo'lda**, sahifa-sahifa)

> **Xavf:** `create/update/remove` hozir `Promise` qaytaradi va sahifalar `await`
> qiladi (`SimpleCrudPage.tsx:58`). `useMutation` ga o'tishda `mutateAsync` ishlatilishi
> **shart**, aks holda `await` darhol qaytadi va modal ma'lumot kelishidan oldin yopiladi.

---

## 5. ⚠️ Frontend backend bilan kelishmagan joylar

> **Bu bo'lim hujjatning eng muhim texnik topilmasi.** Uchta alohida holat bir xil
> naqshdan kelib chiqadi va ular **bitta arxitektura muammosining** uch ko'rinishi.

### 5.0. Umumiy naqsh — **frontend savol bermaydi, taxmin qiladi**

Uchala holat ham bir jumla bilan tasvirlanadi:

> **Backend xom ma'lumot beradi. Frontend unga ma'no yuklaydi.**

| # | Holat | Backend beradi | Frontend **taxmin qiladi** | Natija |
|---|---|---|---|---|
| **1** | **Fan roli** (5.1) | Tartiblangan fanlar **ro'yxati** | *"birinchisi = asosiy"* | ⚠️ **Noto'g'ri ball** |
| **2** | **BigInt ID** (5.3-5.5) | `"id": "123"` — **string** | (hozir **to'g'ri** ishlaydi) | ✅ Toza, lekin **himoyasiz** |
| **3** | **189 ball qoidasi** (5.2) | `max_score: Decimal(8,2)` — **cheklovsiz** | *"BLOCK_TEST = 189"* | ⚠️ Qoida **UI'da yashaydi** |

**Ikkalasi (1 va 3 — ya'ni 5.1 va 5.2) bir xil kasallik:** domen bilimi **frontend'ga sizib chiqqan**.
Backend "nima" ni biladi, lekin "ma'nosi nima" ni **aytmaydi** — frontend uni
**qayta ixtiro qiladi**.

⚠️ **Nega bu multi-tenant mahsulot uchun jiddiy** (kanon 7): ikkinchi akademiya
qo'shilganda, ular **boshqa API klientidan** foydalanishi (mobil ilova, Telegram bot —
13-bo'lim, integratsiya) mumkin. **Har bir yangi klient bu taxminlarni qaytadan
ixtiro qilishi kerak** — va ularning har biri **boshqacha xato qiladi**.

---

### 5.1. ⚠️ **Fan roli massiv indeksidan o'qiladi** — noto'g'ri ball beradigan bag

> **Manba:** bu bagni `07-dtm` agenti topdi. **Men uni mustaqil tasdiqladim** —
> va mexanizmi **xabar qilinganidan farq qiladi** (quyida 5.5.3). DTM mantiqining
> **to'liq** tahlili → **`docs/07-dtm-assessment-engine.md`**. Bu yerda faqat
> **frontend arxitekturasi** burchagi.

#### 5.1.1. Bag — real kod

`apps/web/src/pages/staff/AssessmentsPage.tsx:185-189`:

```tsx
const scoringGroupSubjects: any[] = (scoringGroupRes?.data || scoringGroupRes)?.subjects || [];
// Map group subjects to block-test column roles by index
const mainSubject = scoringGroupSubjects[0];        // ⬅️ "birinchisi = ASOSIY (×3.1)"
const secondarySubject = scoringGroupSubjects[1];   // ⬅️ "ikkinchisi = QO'SHIMCHA (×2.1)"
const mandatorySubjects = scoringGroupSubjects.slice(2, 5);   // ⬅️ "qolgani = MAJBURIY (×1.1)"
```

Va bu indekslar **to'g'ridan-to'g'ri** ball hisobiga kiradi (`AssessmentsPage.tsx:72`):

```tsx
return Math.round((main * 3.1 + secondary * 2.1 + (m1 + m2 + m3) * 1.1) * 10) / 10;
```

**Ya'ni `×3.1` koeffitsiyenti — `subjects[0]` ga. Sababi: u massivda birinchi.**

#### 5.1.2. Haqiqat bazada bor — va e'tiborga olinmaydi

`apps/api/prisma/schema.prisma` — **rol aniq modellashtirilgan**:

```prisma
enum SubjectRole {
  MAIN
  SECONDARY
  MANDATORY
}

model track_subjects {
  id          BigInt       @id @default(autoincrement())
  tenant_id   BigInt
  track_id    BigInt
  subject_id  BigInt
  role        SubjectRole  @default(MANDATORY)   // ⬅️ HAQIQAT SHU YERDA
  …
}
```

⚠️ **Lekin `AssessmentsPage` `group_subjects` ni o'qiydi — va u yerda rol YO'Q:**

```prisma
model group_subjects {
  group_id   BigInt
  subject_id BigInt
  groups     groups   @relation(…)
  subjects   subjects @relation(…)

  @@id([group_id, subject_id])   // ⬅️ FAQAT ikki ustun. Rol yo'q. Tartib ustuni ham yo'q.
}
```

**`group_subjects` da:**
- ❌ `role` ustuni **yo'q**
- ❌ `order` / `position` / `sort_index` — **yo'q**

**Ya'ni frontend rol haqidagi ma'lumotni umuman O'Z ICHIGA OLMAGAN jadvaldan
o'qishga urinmoqda.** Rol `track_subjects` da, u esa **so'ralmaydi**.

⚠️ **Eng achinarlisi — frontend rolni O'QIY OLADI va boshqa joyda O'QIYDI:**

`TracksPage.tsx:52,58,423` — real kod:

```tsx
{ value: 'MAIN', label: 'Asosiy fan', desc: '30 savol × 3.1 ball = 93 ball', icon: Star },
// …
if (role === 'MAIN') return <Badge …>Asosiy</Badge>;
// …
{['MAIN', 'SECONDARY', 'MANDATORY'].map((roleKey) => { … })}
```

**`TracksPage` rolni to'g'ri o'qiydi va to'g'ri ko'rsatadi.** `AssessmentsPage` —
**o'sha ma'lumotni indeks bilan taxmin qiladi.** Ikki sahifa, bir domen, **ikki
xil haqiqat**.

#### 5.1.3. ⚠️ **Muhim tuzatish — mexanizm xabar qilinganidan FARQ qiladi**

Menga bu bag *"`ORDER BY` bo'lmagan `SELECT` da PostgreSQL tartibni kafolatlamaydi"*
deb yetkazildi. **Men buni tekshirdim — bu qism to'g'ri emas.**

`apps/api/src/modules/groups/groups.service.ts:181-184` — real kod:

```ts
group_subjects: {
  include: { subjects: true },
  orderBy: { subject_id: 'asc' },   // ⬅️ ORDER BY MAVJUD
},
```

**`ORDER BY` bor.** Tartib **deterministik** — `VACUUM`, plan turi yoki index-only
scan uni **o'zgartirmaydi**.

⚠️ **Lekin bu bagni yo'q qilmaydi — u bagni BOSHQACHA va YOMONROQ qiladi:**

Tartib — **`subject_id ASC`** bo'yicha. `subject_id` — bu `subjects` jadvalidagi
`BigInt @default(autoincrement())` PK. Ya'ni:

> **Massiv tartibi = fanlar bazaga QO'SHILGAN tartibi.**
> Bu fan **roli** bilan **hech qanday aloqasi yo'q**.

**Aniq ssenariy:**

```
Akademiya seed paytida fanlarni shu tartibda qo'shdi:
  subjects.id = 1  → Ingliz tili
  subjects.id = 2  → Matematika
  subjects.id = 3  → Fizika
  …

"Matematika-Fizika" yo'nalishidagi guruh (track_subjects):
  Matematika → role = MAIN        (×3.1 bo'lishi KERAK)
  Fizika     → role = SECONDARY   (×2.1 bo'lishi KERAK)
  Ingliz tili → role = MANDATORY  (×1.1 bo'lishi KERAK)

groups.service.ts:183 — orderBy: { subject_id: 'asc' } natijasi:
  subjects[0] = Ingliz tili   (id=1)  ⬅️ frontend: "ASOSIY" → ×3.1  ❌
  subjects[1] = Matematika    (id=2)  ⬅️ frontend: "QO'SHIMCHA" → ×2.1  ❌
  subjects[2] = Fizika        (id=3)  ⬅️ frontend: "MAJBURIY" → ×1.1  ❌
```

**O'quvchining ingliz tili bali `×3.1` bilan ko'paytiriladi. Matematika bali —
`×2.1`. Uchalasi ham noto'g'ri.**

⚠️ **Nega deterministik bo'lishi VAZIYATNI YOMONLASHTIRADI, yaxshilamaydi:**

| Agar tartib **tasodifiy** bo'lsa | Agar tartib **deterministik-noto'g'ri** bo'lsa (hozirgi holat) |
|---|---|
| Ballar **sakraydi** — xodim sezadi | Ballar **barqaror** — hech kim shubhalanmaydi |
| Bag **tez topiladi** | Bag **yillar** yashirinishi mumkin |
| Sinovda **yiqiladi** | Sinovda **o'tadi** |

**Deterministik xato — jimgina xato.** Va xodim uchun bu shunchaki *"tizim shunday
hisoblaydi"* bo'lib ko'rinadi.

⚠️ **Yana bir qatlam:** bag **tenant'ga bog'liq**. Bir akademiyada fanlar
"tasodifan" to'g'ri tartibda qo'shilgan bo'lishi mumkin (matematika birinchi) →
**hamma narsa ishlaydi**. Ikkinchi akademiya ingliz tilini birinchi qo'shadi →
**barcha ballari noto'g'ri**.

**Kanon 7-bo'lim maqsadi — ko'p akademiya.** Ya'ni bu bag **aynan mahsulotga
o'tish paytida** portlaydi. Va birinchi akademiya (hozirgi mijoz) buni **hech qachon
sezmagan** bo'lishi mumkin.

#### 5.1.4. ⚠️ Qo'shimcha topilma — ball tafsiloti `teacher_comment` ichida JSON

Bu bagni tekshirayotib **boshqa narsani** topdim. `AssessmentsPage.tsx:278-284`:

```tsx
return {
  studentId: s.id,
  score: total,
  teacherComment: JSON.stringify({        // ⬅️ ⚠️
    main: parseFloat(b.main) || 0,
    secondary: parseFloat(b.secondary) || 0,
    m1: parseFloat(b.m1) || 0,
    m2: parseFloat(b.m2) || 0,
    m3: parseFloat(b.m3) || 0,
  }),
};
```

Va o'qishda (`AssessmentsPage.tsx:211-222`):

```tsx
try {
  const parsed = JSON.parse(s.teacherComment);
  if (parsed && typeof parsed === 'object' && 'main' in parsed) { … }
} catch {}      // ⬅️ jim yutish
```

**Schema** (`assessment_scores`):

```prisma
model assessment_scores {
  assessment_id      BigInt
  student_id         BigInt
  score              Decimal     @db.Decimal(8, 2)
  teacher_comment    String?     // ⬅️ "o'qituvchi izohi" — ERKIN MATN maydoni
  …
}
```

⚠️ **Blok test ballarining tarkibi — `teacher_comment` degan erkin matn maydonida
JSON sifatida saqlanadi.**

**Nega bu jiddiy:**

1. **Maydon nomi yolg'on gapiradi.** `teacher_comment` — o'qituvchi izohi uchun.
   Unda **strukturaviy ma'lumot** yashiringan. Backend buni **bilmaydi**
2. **Validatsiya yo'q.** DB uchun bu — `String?`. Har qanday narsa yozilishi mumkin
3. **So'rov qilib bo'lmaydi.** *"Matematika bo'yicha o'rtacha ball qancha?"* —
   `String` ichidagi JSON'ni parse qilmasdan **javob berib bo'lmaydi**. Kanon 4.2:
   `grade_snapshots` **tarixiy kuzatuv uchun** — bu ma'lumot u yerga **tushmaydi**
4. **O'qituvchi izohi bilan to'qnashuv.** Agar o'qituvchi **haqiqiy izoh** yozsa
   (`"Yaxshi ishladi"`), `JSON.parse` **throw qiladi** → `catch {}` **jim yutadi**
   → blok test tafsiloti **yo'qoladi**. `score` (jami) qoladi, tarkibi **yo'q bo'ladi**
5. ⚠️ **Aksincha ham:** frontend JSON yozadi → **o'qituvchi izohini yozolmaydi**.
   Ikkalasi **bitta maydon** uchun kurashadi

**Bu 5.5 bagining bir oilasidan:** domen tuzilmasi (blok test = 5 ta fan bali)
**modellashtirilmagan**, shuning uchun frontend uni **mavjud maydonga tiqishtirgan**.

> ⚠️ **Bu — schema qarori, frontend qarori emas.** To'g'ri yechim
> (`assessment_score_parts` jadvali yoki `assessments.type` ga bog'liq strukturaviy
> maydon) — **`07-dtm-assessment-engine.md` qamrovida**. Bu yerda faqat
> **frontend'ning nima uchun bunday qilishga majbur bo'lgani** qayd etiladi.

#### 5.1.5. To'g'ri yechim — backend ma'no qaytarsin

**Hozir:**

```
GET /staff/groups/:id
→ { subjects: [ {id, name}, {id, name}, {id, name} ] }     ⬅️ xom ro'yxat, subject_id ASC
                    ⬇️
              frontend TAXMIN QILADI: [0]=MAIN, [1]=SECONDARY, …
```

**Bo'lishi kerak:**

```
GET /staff/groups/:id
→ { subjects: [
      { id: "2", name: "Matematika",  role: "MAIN",      coefficient: 3.1, maxScore: 93 },
      { id: "3", name: "Fizika",      role: "SECONDARY", coefficient: 2.1, maxScore: 63 },
      { id: "1", name: "Ingliz tili", role: "MANDATORY", coefficient: 1.1, maxScore: 11 },
    ] }
                    ⬇️
              frontend FAQAT KO'RSATADI — taxmin qilmaydi
```

**Shunda:**

```tsx
// ❌ HOZIR — indeks taxmini
const mainSubject = scoringGroupSubjects[0];
const secondarySubject = scoringGroupSubjects[1];
const mandatorySubjects = scoringGroupSubjects.slice(2, 5);

// ✅ KEYIN — aniq rol
const mainSubject      = scoringGroupSubjects.find(s => s.role === 'MAIN');
const secondarySubject = scoringGroupSubjects.find(s => s.role === 'SECONDARY');
const mandatorySubjects = scoringGroupSubjects.filter(s => s.role === 'MANDATORY');
```

⚠️ **Va koeffitsiyent ham backend'dan kelsin.** Hozir `3.1`, `2.1`, `1.1` —
`AssessmentsPage.tsx:72` da **qattiq kodlangan**. Ular DTM qoidasi, ya'ni **domen
bilimi**. Backend qaytarsa — bir joyda o'zgaradi.

⚠️ **Frontend `find()` **`undefined`** qaytarishi mumkin** — bu **yaxshi**:

```tsx
if (!mainSubject) {
  return <ErrorState message="Bu guruh yo'nalishida asosiy fan belgilanmagan" />;
}
```

**Jimgina noto'g'ri ball o'rniga — aniq xato xabari.** Kanon `tracks.service.ts:280`
da MAIN/SECONDARY **yagonaligini** tekshiradi — ya'ni backend bu qoidani
**allaqachon biladi**. Frontend faqat **so'rashi** kerak.

#### 5.1.6. ⚠️ Migratsiya — ehtiyotkorlik talab qiladi

Kanon 1-bo'lim: *"ishlab turgan tizimni buzmasligi kerak"*.

⚠️ **Bu bag mavjud ma'lumotni ham buzgan bo'lishi mumkin.** Agar tizim **bir necha
oy** ishlagan bo'lsa, `assessment_scores` da **noto'g'ri koeffitsiyent bilan
hisoblangan** ballar bo'lishi mumkin.

**Ya'ni tuzatish ikki qismli:**

1. **Kod tuzatish** (yuqorida) — kelajakdagi ballar to'g'ri bo'ladi
2. ⚠️ **Mavjud ma'lumotni tekshirish** — *"qaysi guruhlarda `subject_id ASC` tartibi
   rolga mos kelmagan?"* Bu **SQL so'rovi** bilan aniqlanadi:

```sql
-- Qaysi guruhlarda birinchi (eng kichik subject_id) fan MAIN EMAS?
-- Bu guruhlarning barcha BLOCK_TEST ballari SHUBHALI.
SELECT g.id, g.name, s.name AS first_subject, ts.role AS actual_role
FROM groups g
JOIN group_subjects gs ON gs.group_id = g.id
JOIN subjects s ON s.id = gs.subject_id
JOIN track_subjects ts ON ts.subject_id = gs.subject_id AND ts.track_id = g.track_id
WHERE gs.subject_id = (SELECT MIN(subject_id) FROM group_subjects WHERE group_id = g.id)
  AND ts.role <> 'MAIN';
```

⚠️ **Natija bo'sh bo'lsa — omadimiz keldi**: fanlar tasodifan to'g'ri tartibda
qo'shilgan, hech qanday ball buzilmagan. **Natija bo'sh bo'lmasa** — o'sha guruhlarning
ballari **qayta hisoblanishi** kerak.

⚠️ **Bu — real o'quvchilarning real ballari** (kanon 0: *"real xodimlar va ota-onalar
tomonidan har kuni ishlatiladi"*). Kanon 4.2: `student_outcomes` — *"akademiyaning
**asosiy KPI'si**"*. Noto'g'ri ball → noto'g'ri reyting (`ranking`) → noto'g'ri xavf
skori (`risk`) → **noto'g'ri qaror o'quvchi haqida**.

> ⚠️ **Bu SQL — taklif, yakuniy emas.** `07-dtm-assessment-engine.md` bu
> migratsiyaning **egasi**. Bu yerda faqat **frontend tuzatishi yolg'iz yetarli
> emasligi** qayd etiladi.

---

### 5.2. ⚠️ 189 ball qoidasi frontend'da — arxitektura burchagi

> **To'liq tahlil → `docs/07-dtm-assessment-engine.md`.** Bu yerda **takrorlanmaydi** —
> faqat **frontend arxitekturasi** nuqtai nazaridan.

Kanon 4.1 buni allaqachon bayroqlagan:

> *"⚠️ **MUAMMO:** 189 ball qoidasi **faqat frontendda**
> (`AssessmentsPage.tsx:503,516,710,719,727`). … **API `BLOCK_TEST` ni
> `max_score: 500` bilan ham qabul qiladi**. DTM qoidasi domen qatlamida emas, UI'da yashaydi."*

**Frontend burchagidan tasdiqlangan** — real kod:

```tsx
// AssessmentsPage.tsx:72 — koeffitsiyentlar qattiq kodlangan
return Math.round((main * 3.1 + secondary * 2.1 + (m1 + m2 + m3) * 1.1) * 10) / 10;

// AssessmentsPage.tsx:710 — max_score ni FRONTEND o'rnatadi
maxScore: v === 'BLOCK_TEST' ? '189' : form.maxScore,

// AssessmentsPage.tsx:500-503 — qoida UI matnida
<span>Asosiy ×3.1 (maks 93)</span>
<span>Qo'shimcha ×2.1 (maks 63)</span>
<span>Majburiy ×1.1 (maks 11×3=33)</span>
<span className="font-black">Jami: 189 ball</span>
```

⚠️ **`AssessmentsPage.tsx:710` — eng aniq dalil.** `maxScore: '189'` **frontend
tomonidan** yuboriladi. Backend uni **shunchaki qabul qiladi** (`Decimal(8,2)`).

**Frontend arxitekturasi xulosasi (DTM mantiqi emas):**

> **`AssessmentsPage.tsx` — de-fakto DTM domen qatlami.** Uning ichida:
> koeffitsiyentlar (`3.1/2.1/1.1`), maksimal ballar (`93/63/33/189`), fan rollari
> (indeks orqali — 5.1), ball tarkibi (JSON — 5.1.4).
>
> **Bu bilim `apps/web` dan tashqarida MAVJUD EMAS.**

**Nima bo'ladi:**

| Ssenariy | Oqibat |
|---|---|
| Telegram bot ball ko'rsatsa (13.3) | ⚠️ 189 mantiqini **qaytadan yozadi** |
| Mobil ilova qurilsa (13.5) | ⚠️ **uchinchi nusxa** |
| API'ga to'g'ridan-to'g'ri `POST` | ⚠️ `max_score: 500` — **qabul qilinadi** |
| DTM qoidasi o'zgarsa (davlat o'zgartirsa) | ⚠️ **har klientda alohida** tuzatiladi |

⚠️ **Frontend'dan mantiqni olib tashlash — bu hujjatning tavsiyasi EMAS**, chunki
**backend uni qabul qilishi kerak** va bu `assessments` modulining ishi
(**`07-dtm-assessment-engine.md`**).

**Frontend'ning talabi aniq va cheklangan:**

> Backend `BLOCK_TEST` uchun **tuzilma va koeffitsiyentlarni** qaytarsin.
> Frontend `3.1` ni **bilmasin** — uni **so'rasin**.
> Frontend `189` ni **yubormasin** — backend uni **o'zi bilsin va majburlasin**.

Shunda `AssessmentsPage` **ko'rsatish qatlamiga** qaytadi — hozir u **domen qatlami**.

---

### 5.3. BigInt — xavf nimada

Kanon 5.2: ID'lar backend'da `BigInt`, JSON'da **string**. JavaScript `number` —
IEEE-754 double: **2⁵³ − 1** (`Number.MAX_SAFE_INTEGER` = 9007199254740991) dan katta
butun sonni aniq saqlay olmaydi.

```js
Number("9007199254740993")   // → 9007199254740992   ⬅️ oxirgi raqam O'ZGARDI
```

Agar frontend ID'ni `parseInt` qilsa, bu **jimgina** buziladi: xato yo'q, ogohlantirish
yo'q — shunchaki **boshqa o'quvchining yozuvi** ochiladi yoki o'chiriladi.

### 5.4. Grep natijasi — ✅ **TOZA**

```bash
$ grep -rnP "(parseInt|Number)\s*\(\s*[a-zA-Z_.\[\]']*([Ii]d|ID)\b" --include=*.tsx --include=*.ts src/
# 0 natija
$ grep -rn "BigInt\|bigint" src/
# 0 natija
```

**Hech qayerda ID `number` ga aylantirilmaydi.** ID'lar butun frontend bo'ylab **string**
sifatida oqadi:

- `lib/auth.tsx:47,48,58,59` — `String(u.userId)`, `String(u.tenantId)`,
  `String(u.studentAccountId)`, `String(u.studentId)` — **aniq `String()` ga o'raladi**
- `useCrud.ts:70,77` — `` `${endpoint}/${id}` `` — **shablon satri**, ID matn sifatida
  URL'ga qo'shiladi. Agar `id` string bo'lsa — bit-ma-bit saqlanadi
- `StaffUser` / `GuardianUser` interfeyslarida barcha ID maydonlari — **`string`**

`parseInt`/`Number` **43 ta joyda** ishlatiladi, lekin **hammasi ID emas**:
`GuardianBilling.tsx:100` (`paidAmount`), `RiskPage.tsx:95` (`score`),
`CohortsPage.tsx:237` (`graduationYear`), `DormsPage.tsx:236` (`capacity`) —
bularning hammasi **pul, ball, yil va sig'im**, ya'ni `number` bo'lishi **to'g'ri**.

> **Halol xulosa:** kanon 5.2 "BigInt intizomi to'g'ri qilingan — buzma" deydi.
> **Frontend ham shu intizomga amal qilgan.** Bu bag **yo'q**. TZ topshirig'i uni
> topishni so'ragan edi — men uni **topmadim** va to'qib chiqarmayman.

### 5.5. ⚠️ BigInt: himoya yo'q — latent xavf

Toza bo'lishi **tasodifiy emas**, lekin **majburlanmagan** ham. Uchta zaif nuqta:

**a) `useCrud.ts:69,76` — tip imzosi `number` ga RUXSAT BERADI:**

```ts
const update = async (id: string | number, body: any) => { … }
const remove = async (id: string | number) => { … }
```

`| number` — bu **ochiq eshik**. Ertaga kimdir `update(Number(row.id), form)` yozsa,
TypeScript **rozi bo'ladi**. Kanon backend'da `is-bigint-string.decorator.ts` bilan
buni majburlaydi; frontend'da **hech nima majburlamaydi**.

**Tuzatish (bir qatorli, xavfsiz):**

```ts
const update = async (id: string, body: any) => { … }   // | number olib tashlandi
const remove = async (id: string) => { … }
```

Agar biror sahifa `number` uzatayotgan bo'lsa — `tsc` **darhol xato beradi**. Ya'ni
bu o'zgarish **auditning o'zi**: kompilyator 21 sahifani tekshirib beradi.

**b) `id: any` — sahifalarda `item: any`.** `DataTable<T extends Record<string, any>>` —
`item.id` tipi `any`. `any` ustida `Number()` chaqirish — TypeScript uchun **qonuniy**.

**c) Backend `BigInt` ni `number` qaytarib qo'ysa — frontend bilmaydi.** Agar biror
controller `Number(entity.id)` qilsa, JSON'da `"id": 9007199254740992` (raqam) keladi
va frontend uni **shu holicha** ishlatadi. Bu backend bagi, lekin **frontend uni
tutmaydi**.

**Tavsiya — tip darajasida brand:**

```ts
// lib/types.ts
export type Id = string & { readonly __brand: 'BigIntId' };
export const toId = (v: unknown): Id => {
  if (typeof v !== 'string') throw new Error(`ID must be a string, got ${typeof v}: ${v}`);
  return v as Id;
};
```

Shunda `Number(id)` — `Id` ustida **tip xatosi**, va `toId()` backend raqam qaytarsa
**ishlash vaqtida qulaydi** (jimgina buzilishdan ko'ra tez qulash yaxshiroq).

> **Ustuvorlik:** (a) — **darhol** qilinsin, arzon va foydali. (Id brand) — ixtiyoriy,
> qiymati bor lekin 48 sahifaga tarqaladi. Ochiq savol: **arziydimi?** (14-bo'lim)

---

### 5.6. Bu uch holat uchun yagona yechim

**Umumiy sabab bitta:** ⬇️

> **API xom ma'lumot qaytaradi. Ma'no — klientda qayta qurilади.**

**Umumiy yechim bitta:**

> **API ma'no qaytarsin.** Rol — `role: 'MAIN'`. Koeffitsiyent — `coefficient: 3.1`.
> Chegara — `maxScore: 93`. ID — **doim string**. Klient **faqat ko'rsatsin**.

**Bu — "backend for frontend" emas, oddiy domen modellashtirish.** Kanon 5.1
tenant izolyatsiyasi uchun aynan shu xulosani chiqargan:

> *"kafolatni **intizomdan strukturaga** ko'chirish"*

**Bu yerda ham xuddi shunday:**

| | Intizom (hozir) | Struktura (kerak) |
|---|---|---|
| Fan roli | *"birinchisi asosiy bo'lishi kerak"* | `role: 'MAIN'` — **aniq** |
| Koeffitsiyent | *"3.1 ni eslab qol"* | `coefficient: 3.1` — **API'dan** |
| 189 chegarasi | *"frontend to'g'ri yuboradi"* | Backend **majburlaydi** |
| BigInt ID | *"`parseInt` qilma"* | Tip **ruxsat bermaydi** (5.5) |

**To'rttasi ham bir xil o'zgarish shakli: taxminni — shartnomaga aylantirish.**

---

---

## 6. Autentifikatsiya frontend'da

### 6.1. Token qayerda saqlanadi — o'lchangan

| Narsa | Qayerda | Fayl:qator |
|---|---|---|
| **Access token** | **`localStorage['access_token']`** | `api.ts:71,109` · `auth.tsx:95,136,158` |
| **Refresh token** | **`httpOnly` cookie** | `auth.service.ts:114-115` |
| **User profili** | **`localStorage['user']`** (JSON) | `auth.tsx:102,116,143,168` |

### 6.2. ✅ Refresh cookie — TO'G'RI qilingan

Backend tekshirildi (`apps/api/src/modules/auth/auth.service.ts:101-125`):

```ts
private cookieOptions(): { sameSite: 'none' | 'lax'; secure: boolean } {
  return {
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };
}
// …
res.cookie(this.cookieName(), token, {
  httpOnly: true,   // ⬅️ :115 — JS o'qiy olmaydi
  …
});
```

**`httpOnly: true` + `secure` (production'da) + `sameSite`** — uchtasi ham bor.
Refresh token **XSS orqali o'g'irlanmaydi**. Frontend tomonda `api.ts:51` da:

```ts
withCredentials: true, // refresh/logout cookie ishlashi uchun muhim
```

Bu **to'g'ri qaror** — buzilmasin.

⚠️ `sameSite: 'none'` production'da — bu frontend va API **turli domenda** degani.
`'none'` CSRF himoyasini o'chiradi, lekin `secure: true` bilan birga va refresh
endpoint'i **faqat cookie**ga tayangani uchun — CSRF hujumchisi refresh chaqira oladi,
**lekin javobdagi `accessToken` ni o'qiy olmaydi** (CORS bloklaydi). Ya'ni amaliy
xavf past. Agar frontend va API bitta domenga qo'yilsa — `sameSite: 'lax'` afzalroq
(ochiq savol, deployment topologiyasiga bog'liq).

### 6.3. ⚠️ Access token `localStorage` da — XSS'ga ochiq

**Fakt:** `localStorage` — **har qanday** JS koddan o'qiladi:

```js
localStorage.getItem('access_token')   // istalgan script buni bajara oladi
```

Agar sahifada XSS bo'lsa, hujumchi bir qatorda access token'ni oladi va uni
o'z serveriga yuboradi.

**Halol baholash — panika qilmaslik kerak, lekin yashirmaslik ham:**

| Omil | Baholash |
|---|---|
| React JSX **avtomatik ekran qiladi** (`{userInput}` xavfsiz) | XSS ehtimolini **sezilarli kamaytiradi** |
| `dangerouslySetInnerHTML` ishlatiladimi? | **Tekshirilishi kerak** — `chart.tsx` da shadcn shabloni bor bo'lishi mumkin |
| Token TTL | ⚠️ quyida — **eng katta muammo** |
| Refresh token himoyalangan | ✅ `httpOnly` — sessiya **butunlay** o'g'irlanmaydi |
| npm supply-chain hujumi | Zaif nuqta: **26 ta Radix + 40+ paket**. Bittasi buzilsa — token ketadi |

⚠️ **ENG KATTA MUAMMO — TTL ziddiyati (kanon 5.4 buni bayroqlagan, men tasdiqladim):**

```bash
$ grep -n "ACCESS_TOKEN_TTL" apps/api/.env.example
23:ACCESS_TOKEN_TTL="15h"                          # ⬅️ 15 SOAT

$ grep -rn "ACCESS_TOKEN_TTL\|expiresIn" apps/api/src/
common/config/env.validation.ts:54:  ACCESS_TOKEN_TTL: string = '15m';   # default 15 daqiqa
modules/auth/auth.module.ts:21:      expiresIn: '15m',
modules/auth/auth.service.ts:89:  return process.env.ACCESS_TOKEN_TTL || '15m';
```

**Ziddiyat tasdiqlandi.** Kod defaulti **15 daqiqa**, lekin `.env.example` —
`"15h"`. Va `auth.service.ts:89` `process.env` ni **ustun** qo'yadi. Ya'ni kim
`.env.example` dan nusxa ko'chirsa (**ya'ni hamma**) — **15 soatlik** token oladi.

**Nega bu `localStorage` bilan birga jiddiy:** o'g'irlangan token — hujumchi uchun
**15 soatlik to'liq kirish**. 15 daqiqa bo'lsa, zarar oynasi **60 barobar kichik**.

**Bu frontend bagi emas, lekin frontend qarorini (localStorage) 60 barobar
qimmatroq qiladi.** Tuzatish **arzon va shoshilinch**:

```diff
- ACCESS_TOKEN_TTL="15h"
+ ACCESS_TOKEN_TTL="15m"
```

Refresh oqimi **allaqachon ishlaydi** (`api.ts:85-130`, navbat bilan — quyida), shuning
uchun 15 daqiqa foydalanuvchini **umuman bezovta qilmaydi**: token muddati tugaydi →
401 → interceptor jimgina refresh qiladi → so'rov qaytariladi. Foydalanuvchi hech nima
sezmaydi. **15h ning hech qanday foydasi yo'q, faqat xavfi bor.**

### 6.4. ✅ Refresh interceptor — yaxshi yozilgan

`api.ts:55-130` — bu kodning **kuchli qismi**:

```ts
let isRefreshing = false;
let failedQueue: { resolve, reject }[] = [];

if (status === 401 && originalRequest.url !== '/auth/refresh') {
  if (isRefreshing) {
    return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); })
      .then((token) => { originalRequest.headers.Authorization = `Bearer ${token}`; return api(originalRequest); });
  }
  originalRequest._retry = true;
  isRefreshing = true;
  // …refresh → processQueue(null, accessToken) → qaytadan urin
}
```

**Nega bu to'g'ri:** dashboard bir vaqtda 5 ta so'rov yuborsa va token muddati tugagan
bo'lsa — **5 ta parallel refresh** bo'lmaydi. Birinchisi refresh qiladi, qolgan 4 tasi
navbatda kutadi (`failedQueue`) va yangi token bilan qayta urinadi. Refresh token
**rotatsiya** qilinsa (backend qiladi), parallel refresh **sessiyani buzardi**. Bu
naqsh muammoni oldini oladi.

Alohida `/auth/refresh` ning o'zi 401 bersa — `:131-137` da cheksiz sikl **oldi olinadi**:
localStorage tozalanadi va login sahifasiga yo'naltiriladi. Yo'nalish **kontekstga
qarab** (`:123-125`): `/guardian/*` → `/guardian/login`, aks holda `/staff/login`. To'g'ri.

⚠️ **Kichik bag — `_retry` o'rnatiladi, lekin O'QILMAYDI.** `api.ts:99` da
`originalRequest._retry = true` yoziladi, lekin hech qayerda `if (!originalRequest._retry)`
tekshiruvi **yo'q**. Ya'ni bu maydon **o'lik**. Amalda `isRefreshing` + `failedQueue`
himoyani ta'minlaydi, shuning uchun bag ko'rinmaydi. Lekin niyat bajarilmagan:
refresh **muvaffaqiyatli** bo'lib, qayta urinilgan so'rov **yana** 401 bersa
(masalan RBAC ruxsati yo'q, lekin backend 403 o'rniga 401 qaytarsa) — sikl boshlanadi.
`if (status === 401 && !originalRequest._retry && …)` qo'shilsin.

⚠️ **`isRefreshing` `finally` da tozalanadi (`:128-130`)** — `processQueue` dan **keyin**.
To'g'ri tartib.

### 6.5. ⚠️ `localStorage['user']` — ishonch chegarasi

`auth.tsx:102-109` — profil **keshdan** optimistik o'qiladi:

```ts
const savedUser = localStorage.getItem('user');
if (savedUser) { setUser(JSON.parse(savedUser)); }   // tez render uchun
// keyin serverdan tasdiqlanadi
const meRes = await api.get('/auth/me');
```

**Bu naqsh o'zi to'g'ri** (tez render, keyin tasdiqlash). Lekin `user` obyektida
**`roles` va `permissions`** bor (`auth.tsx:50-51`) — va foydalanuvchi ularni
**localStorage'da tahrirlashi mumkin**:

```js
// Brauzer konsolida — istalgan foydalanuvchi:
const u = JSON.parse(localStorage.getItem('user'));
u.roles.push('superadmin');
u.permissions.push('students.delete');
localStorage.setItem('user', JSON.stringify(u));
location.reload();
```

**Nima bo'ladi:** `/auth/me` javobi kelguncha (bir necha yuz ms) UI'da **superadmin
menyusi ko'rinadi**. `/auth/me` qaytgach — profil serverdan **qayta yoziladi** va
menyu yo'qoladi.

⚠️ **Lekin `auth.tsx:117-120` dagi `catch` muhim:**

```ts
} catch {
  // Token invalid — api interceptor handles redirect on 401
  // If not 401 (e.g. network error), keep cached user      ⬅️
}
```

**Tarmoq xatosida keshlangan (ya'ni soxtalashtirilgan) profil SAQLANADI.** Hujumchi
`/auth/me` ni bloklasa (offline rejim, DevTools network throttle, hosts fayl) —
soxta `superadmin` profili **muddatsiz** qoladi.

**Bu qanchalik jiddiy — halol javob:**

- ❌ **Ma'lumot o'g'irlash EMAS.** Backend har so'rovda **JWT'ni** tekshiradi
  (kanon 5.3: `access.guard.ts`, `roles.guard.ts`, `perms.guard.ts`). Soxta
  `permissions` **API'ga ta'sir qilmaydi** — `students.delete` bosilsa, backend
  **403** qaytaradi.
- ⚠️ **Lekin bu ishonch chegarasining noto'g'ri joylashuvi.** UI foydalanuvchiga
  bo'lmagan imkoniyatlarni ko'rsatadi. Xodim "o'chirish" tugmasini ko'rib bosadi,
  403 oladi, chalkashadi. Va agar **biror endpoint guard qo'yishni unutgan bo'lsa** —
  bu klient-side "himoya" uni **yashiradi**.

**Tavsiya:** `permissions` **hech qachon** localStorage'dan o'qilmasin — faqat
`/auth/me` javobidan. Kesh **faqat** ko'rinish uchun xavfsiz maydonlarni saqlasin
(`fullName`, `avatarUrl`). Tarmoq xatosida — **menyu cheklangan holatda** ko'rsatilsin,
kengaytirilganda emas (fail-closed, fail-open emas).

### 6.6. Xulosa — `localStorage` dan voz kechish kerakmi?

**Halol javob: shart emas, lekin TTL shoshilinch.**

| Variant | Xavfsizlik | Narx |
|---|---|---|
| **Hozirgi:** access `localStorage` + refresh `httpOnly` | XSS → 15h (yoki 15m) kirish | 0 — ishlaydi |
| **Access xotirada (`useState`)** + refresh cookie | XSS → sahifa yopilguncha | Har sahifa yangilanishida refresh kerak — ~200ms kechikish |
| **Ikkalasi ham `httpOnly` cookie** | XSS → token o'qib bo'lmaydi | Backend o'zgarishi + CSRF token kerak |

**Ustuvorlik tartibi (arzondan qimmatga):**

1. 🔴 **`ACCESS_TOKEN_TTL="15m"`** — bir qatorli o'zgarish, xavf oynasini **60×** kichraytiradi
2. 🟠 **`permissions` ni localStorage'dan olib tashlash** — 6.5-bo'lim
3. 🟡 **CSP header** (`Content-Security-Policy`) — XSS'ning **o'zini** qiyinlashtiradi. `index.html` da `<meta>` yoki server header'da. Bu `localStorage` dan voz kechishdan **arzonroq va foydaliroq**
4. ⚪ **Access token'ni xotiraga ko'chirish** — kattaroq ish, `AuthProvider` qayta yoziladi. **Ochiq savol: arziydimi?**

---

## 7. Guardian portali — 12 sahifa

### 7.1. Nega bu 12 sahifa alohida muomala talab qiladi

Kanon 0-bo'lim: *"real xodimlar va **ota-onalar** tomonidan har kuni ishlatiladi"*.

**Xodim** — ish stolida, doimiy Wi-Fi, katta ekran, kuniga soatlab.
**Ota-ona** — **telefonda**, mobil internet, kichik ekran, kuniga 1-2 daqiqa.

Bu ikki mutlaqo boshqa texnik profil. **12 guardian sahifasining eng muhim texnik
talabi — mobil ishlash.**

### 7.2. ✅ Layout darajasida mobil — YAXSHI qilingan

`components/layout/GuardianLayout.tsx` o'qildi. Kutilganidan **yaxshiroq**:

| Imkoniyat | Kod | Baholash |
|---|---|---|
| Mobil drawer (yon menyu) | `:84` — `mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"` | ✅ |
| Drawer backdrop | `:71-76` — bosilsa yopiladi | ✅ |
| **Pastki navigatsiya** (bottom nav) | `:215-246` — `fixed bottom-0 … lg:hidden` | ✅ **mobil uchun to'g'ri naqsh** |
| Bottom nav'da 5 ta asosiy + "Ko'proq" | `:31` — `navItems.slice(0, 5)` | ✅ |
| Kontent bottom nav ostida qolmaydi | `:209` — `pb-20 lg:pb-6` | ✅ **detalga e'tibor** |
| Navigatsiyada sahifa almashsa drawer yopiladi | `:63-65` — `handleNavClick` | ✅ |
| Desktop'da yig'iladigan sidebar | `:87` — `collapsed && "lg:w-[68px]"` | ✅ |

**Bu tasodifiy emas — ongli mobil ish.** `pb-20 lg:pb-6` kabi detal faqat **real
telefonda sinab ko'rgan** odam yozadi.

> **Halollik:** men bu bo'limga "mobil moslashuvchanlik bormi — shubhali" gipotezasi
> bilan kirdim. Kod buni **rad etdi**. Layout mobil uchun **to'g'ri qurilgan**.

### 7.3. ✅ Jadval overflow — muammo YO'Q (dastlabki gipoteza rad etildi)

Dastlab `grep -rn "overflow-x-auto" pages/guardian/` → **0 natija** ko'rib, "jadvallar
mobil ekranni yoradi" degan xulosaga kelgandim. **Noto'g'ri edi.**

`components/ui/table.tsx:5-11` tekshirilganda:

```tsx
const Table = React.forwardRef<HTMLTableElement, …>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">     {/* ⬅️ o'rovchi ALLAQACHON bor */}
    <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
));
```

Va `DataTable.tsx:95` da **qo'shimcha** o'rovchi: `<div className="rounded-xl border
overflow-x-auto">`.

**Ya'ni har bir jadval ikki qavat overflow himoyasi bilan o'ralgan.** Guardian sahifalari
xom `<table>` **ishlatmaydi** — hammasi `DataTable` yoki `ui/table` orqali. Muammo **yo'q**.

### 7.4. ⚠️ Sahifa darajasida — nomutanosiblik

Bu **real** topilma. Har guardian sahifasidagi responsive utilita soni:

```bash
$ for f in pages/guardian/*.tsx; do echo "$(basename $f): $(grep -o 'sm:\|md:\|lg:\|xl:' $f | wc -l)"; done
```

| Sahifa | Responsive utilita | |
|---|---|---|
| GuardianDashboard.tsx | **11** | ✅ |
| GuardianStudent.tsx | **7** | ✅ |
| GuardianTimetable.tsx | **6** | ✅ |
| GuardianAttendance.tsx | 3 | 🟡 |
| GuardianBilling.tsx | 3 | 🟡 |
| GuardianGrades.tsx | 3 | 🟡 |
| GuardianLogin.tsx | 3 | 🟡 |
| **GuardianAnnouncements.tsx** | **0** | ⚠️ |
| **GuardianCertificates.tsx** | **0** | ⚠️ |
| **GuardianDiscipline.tsx** | **0** | ⚠️ |
| **GuardianEvents.tsx** | **0** | ⚠️ |
| **GuardianNotifications.tsx** | **0** | ⚠️ |

**12 sahifadan 5 tasida bitta ham responsive breakpoint yo'q.**

⚠️ **Diqqat — bu avtomatik "buzuq" degani EMAS.** Tailwind'da default'lar **mobil-birinchi**:
`flex flex-col`, `w-full`, `space-y-4` — breakpoint'siz ham telefonda to'g'ri ishlaydi.
Va bu 5 sahifaning 4 tasi (`Certificates`, `Discipline`, `Notifications`, `Events`)
asosan `DataTable` ishlatadi — u **o'zi** overflow'ni hal qiladi.

**Lekin nol breakpoint shuni anglatadi:** bu sahifalar mobil uchun **maxsus
o'ylanmagan** — desktop uchun yozilib, mobil'da "shunchaki ishlab ketgan".

**Texnik talab (dizayn emas):** bu 5 sahifa **360px kenglikda** (O'zbekistonda keng
tarqalgan Android ekran) sinovdan o'tkazilsin. Mezon:

- ✅ Gorizontal skroll **yo'q** (jadvallardan tashqari — ular o'z konteynerida skroll qiladi)
- ✅ Bosiladigan element **≥ 44×44px** (Apple HIG / Material minimal)
- ✅ Matn **≥ 16px** (kichikroq bo'lsa iOS Safari input'da avtomatik zoom qiladi)
- ✅ Kontent bottom nav (~64px) ostida qolmaydi

Qanday tuzatish — **dizayn savoli**, bu hujjatda hal qilinmaydi.

### 7.5. ⚠️ `GuardianLogin.tsx` — mobil kirish tajribasi

Bu **ota-onaning tizim bilan birinchi to'qnashuvi**. Ishlamasa — qolgan 11 sahifa
ahamiyatsiz.

```tsx
// GuardianLogin.tsx:80-81
<Input id="studentId" placeholder="mathacademy-MA-0001" value={studentId}
  onChange={e => setStudentId(e.target.value)} disabled={loading} />
```

⚠️ **`autoComplete` YO'Q.** Butun `src/` da `autoComplete` + `inputMode` jami
**2 ta** (`grep -rn "autoComplete\|inputMode\|type=\"tel\"" src/ | wc -l` → 2).

**Nima yo'qoladi:**

| Yo'q narsa | Ota-ona uchun oqibati |
|---|---|
| `autoComplete="username"` | Brauzer/telefon **ID'ni eslab qolmaydi** — har safar `mathacademy-MA-0001` ni **qo'lda** teradi |
| `autoComplete="current-password"` | Parol menejeri **ishlamaydi** — parol har safar qo'lda |
| `autoCapitalize="none"` | ⚠️ **Android klaviaturasi birinchi harfni KATTA qiladi** → `Mathacademy-MA-0001` → login **muvaffaqiyatsiz** |
| `spellCheck={false}` | Klaviatura ID'ni "tuzatishga" urinadi |

⚠️ **`autoCapitalize` — bu eng jiddiy.** Kanon 4.2: guardian login formati
`<tenant-slug>-<student-id>`, **birinchi tire bo'yicha ajratiladi**. Backend `mathacademy`
slug'ini qidiradi. Android avtomatik `Mathacademy` yuborsa va backend slug'ni
**katta-kichik harfga sezgir** solishtirsa — *"Student ID yoki parol noto'g'ri"*
(`GuardianLogin.tsx:37`).

Ota-ona ID'ni **to'g'ri** yozgan, telefon uni buzgan, xato xabari esa **parolni**
ayblaydi. Ota-ona qo'ng'iroq qiladi. Xodim vaqti ketadi.

**Tuzatish — bir qatorli, bag'oyat arzon:**

```tsx
<Input
  id="studentId"
  placeholder="mathacademy-MA-0001"
  autoComplete="username"
  autoCapitalize="none"      // ⬅️ Android katta harf muammosini hal qiladi
  autoCorrect="off"
  spellCheck={false}
  value={studentId}
  onChange={e => setStudentId(e.target.value)}
  disabled={loading}
/>
<Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" … />
```

⚠️ **Qo'shimcha mudofaa (tekshirilsin):** backend slug'ni katta-kichik harfga
**sezgir** solishtiradimi? Agar ha — frontend `studentId.trim()` dan tashqari
**`.toLowerCase()` ham** qilishi kerakmi? Bu **backend savoli** — slug'lar doim
kichik harfda bo'lsa, backend `lower(slug)` bo'yicha qidirishi to'g'riroq.
`login('GUARDIAN', { studentId, password })` (`:33`) — hozir `trim()` **ham
qilinmaydi** (`:27` da faqat bo'shligi tekshiriladi). Nusxa-ko'chirishda tushgan
bo'sh joy → login muvaffaqiyatsiz.

### 7.6. ⚠️ Mobil trafik — guardian bundle hisobi

8-bo'limdagi o'lchovlarga asoslangan. Ota-ona `/guardian/dashboard` ochganda **nima
yuklanadi**:

| Chunk | gzip |
|---|---|
| `index-Dkt-zvjn.js` (React + Router + Query + axios + Radix asosi) | **144.29 kB** |
| `index-D6cQjnW7.css` | **16.72 kB** |
| `GuardianDashboard-0D8LXdSz.js` | 5.32 kB |
| `generateCategoricalChart-SP7SAlRO.js` (**Recharts**) | ⚠️ **98.44 kB** |
| `PieChart` / `AreaChart` / `YAxis` va boshqalar | ~20 kB |
| **JAMI (taxminan)** | **~285 kB gzip** |

⚠️ **Recharts (98 kB gzip) — dashboard'dagi bir-ikki grafik uchun.** Bu guardian
yukining **~35%**.

**2G'da (~50 kbit/s real tezlik) 285 kB ≈ 45+ soniya.** 3G'da (~1 Mbit/s) ≈ 3-4 soniya.

Kanon 0-bo'lim: bu **real ota-onalar** ishlatadi. O'zbekistonda viloyatlarda 3G hali
keng tarqalgan. **Ota-ona 45 soniya kutmaydi — yopadi.**

---

## 8. Ishlash (performance) — o'lchangan, taxmin emas

### 8.1. ✅ Code splitting — BOR va to'liq

TZ topshirig'i "48 sahifa bitta bundle bo'lsa" xavfidan ogohlantirgan edi. **Bunday emas.**

`App.tsx:19-65` — **48/48 sahifa `React.lazy`**:

```tsx
const StaffDashboard    = lazy(() => import('./pages/staff/StaffDashboard'));
const StudentsPage      = lazy(() => import('./pages/staff/StudentsPage'));
// … 48 ta
const GuardianDashboard = lazy(() => import('./pages/guardian/GuardianDashboard'));
```

Va `App.tsx:86` — `<Suspense fallback={<RouteFallback />}>`. `RouteFallback`
(`PageSkeleton.tsx:174`) — *"minimal shimmer matching the layout shape"*.

**Layout va login sahifalari ataylab lazy EMAS** (`App.tsx:11-16`):

```tsx
// ─── Layouts & Auth pages (NOT lazy — needed immediately) ────────────────────
import { StaffLayout } from './components/layout/StaffLayout';
import GuardianLogin from './pages/guardian/GuardianLogin';
```

**Bu to'g'ri qaror** — login **birinchi ekran**; uni lazy qilish qo'shimcha round-trip
qo'shadi va hech nima yutmaydi. Kommentda sabab ham yozilgan. ✅

### 8.2. Real build natijasi (`npm run build` ishga tushirildi)

```
vite v5.4.21 building for production...
✓ 3497 modules transformed.
✓ built in 6.83s
```

**Eng katta chunk'lar:**

| Fayl | Xom | gzip |
|---|---|---|
| `index-Dkt-zvjn.js` (**entry**) | 457.61 kB | **144.29 kB** |
| `generateCategoricalChart-SP7SAlRO.js` (**Recharts**) | 350.11 kB | **98.44 kB** |
| `StudentsPage-d-VjwkxJ.js` | 79.78 kB | 23.34 kB |
| `PieChart` | 25.97 kB | 7.04 kB |
| `CohortsPage` | 25.78 kB | 6.98 kB |
| `TimetablePage` | 25.20 kB | 6.59 kB |
| `YAxis` | 24.42 kB | 6.26 kB |
| `select` (Radix) | 22.56 kB | 7.87 kB |
| `DormsPage` | 22.27 kB | 5.82 kB |
| `index-D6cQjnW7.css` | 99.69 kB | **16.72 kB** |
| **`dist/` jami** | **1.8 MB** | **~428 kB** (barcha JS gzip) |

**Baholash — o'rtacha yaxshi:**

- ✅ Sahifa chunk'lari **kichik** (2-25 kB) — splitting **ishlayapti**
- ✅ Radix primitivlari **alohida chunk'larga** ajralgan (`select`, `tabs`, `checkbox`,
  `scroll-area`) — faqat kerakli sahifa yuklaydi
- ✅ Lucide ikonkalari **alohida** (`search-DDxew9uN.js` — 0.34 kB) — tree-shaking **ideal**
- ⚠️ **Entry 144 kB gzip** — katta, lekin React+Router+Query+axios uchun **normal**
- ⚠️ **Recharts 98 kB gzip** — **eng katta muammo**
- ⚠️ `StudentsPage` 23.34 kB gzip — sahifa uchun katta (eng murakkab sahifa, kutilgan)

### 8.3. ⚠️ Framer Motion — o'rnatilgan, ISHLATILMAYDI

```bash
$ grep -rn "framer-motion\|from 'motion" src/
# 0 natija
$ grep -l "framer" dist/assets/*.js
# 0 natija
```

**`package.json:53` da `"framer-motion": "^12.34.3"` bor, lekin `src/` da bitta ham
import yo'q.**

**Halol baholash:** bu **bundle'ga tushmaydi** — Vite tree-shaking uni butunlay tashlab
ketgan (`dist/` da "framer" so'zi topilmadi). Ya'ni **foydalanuvchi buni yuklamaydi**.

⚠️ **Lekin narxi bor:**
- `npm install` vaqti va `node_modules` hajmi (CI'da har build'da)
- **Supply-chain yuzasi** — ishlatilmaydigan paket ham buzilishi mumkin
- Chalkashlik — kanon Framer Motion'ni stack'da sanaydi, lekin u **o'lik**

**Animatsiyalar qayerda?** `Tailwind` + `tailwindcss-animate` (`package.json:66`) va
CSS class'lar (`animate-fade-in` — `DataTable.tsx:82`, `StatCard.tsx:28`).
**CSS animatsiya JS animatsiyadan arzonroq** — bu **yaxshi qaror**.

**Tavsiya:** `framer-motion` **`package.json` dan olib tashlansin**. Va kanon
yangilansin — Framer Motion stack'da **emas**.

⚠️ **Boshqa shubhali paketlar** (har biri atigi **1 ta** faylda — ehtimol shunchaki
shadcn shabloni bilan kelgan `components/ui/*` fayli, sahifalarda ishlatilmaydi):

```bash
$ for p in embla-carousel-react input-otp react-resizable-panels vaul cmdk react-day-picker date-fns; do
    echo "$p: $(grep -rl "$p" src/ | wc -l) fayl"; done
embla-carousel-react: 1     # ui/carousel.tsx — sahifalarda ishlatilmaydi?
input-otp: 1                # ui/input-otp.tsx
react-resizable-panels: 1   # ui/resizable.tsx
vaul: 1                     # ui/drawer.tsx
cmdk: 1                     # ui/command.tsx
react-day-picker: 1         # ui/calendar.tsx
date-fns: 0                 # ⬅️ HECH QAYERDA — to'liq o'lik
```

**`date-fns` — 0 fayl.** Loyiha `dayjs` ishlatadi (**12 fayl**). `date-fns`
`react-day-picker` ning peer dependency'si bo'lishi mumkin — **tekshirilsin**.
Ikkita sana kutubxonasi — agar ikkalasi ham bundle'ga tushsa, bu **behuda kilobaytlar**.

Bular **bundle'ga tushmaydi** (ishlatilmagan `ui/*` fayllari import qilinmaydi →
tree-shake). **Shoshilinch emas**, lekin tozalash `node_modules` va CI vaqtini kamaytiradi.

### 8.4. ⚠️ `vite.config.ts` — `manualChunks` yo'q

```ts
export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: { dedupe: ["react", "react-dom"], alias: { "@": path.resolve(__dirname, "./src") } },
}));
```

- ✅ `dedupe: ["react", "react-dom"]` — React ikki nusxada bo'lmasligi kafolatlangan
- ✅ `componentTagger` faqat `mode === "development"` — production'ga tushmaydi
- ⚠️ **`build.rollupOptions.output.manualChunks` yo'q** — chunk'lar Rollup'ning
  avtomatik evristikasiga qoldirilgan. U **yaxshi ishlagan** (8.2), lekin **kafolat yo'q**:
  yangi sahifa qo'shilsa, chunk chegaralari **kutilmaganda o'zgarishi** mumkin.
- ⚠️ **`build.sourcemap` sozlanmagan** — default `false`. Production'da xato izlash
  qiyin (11-bo'limga qarang: Sentry sourcemap'siz foydasiz).

### 8.5. Tavsiyalar — ustuvorlik bo'yicha

**🔴 1. Recharts'ni guardian yo'lidan chiqarish**

Recharts **8 faylda** ishlatiladi (`grep -rl "recharts" src/ | wc -l` = 8), lekin
`generateCategoricalChart` chunk'i (98 kB gzip) **grafik bor har qanday sahifa** bilan
yuklanadi — shu jumladan `GuardianDashboard`.

**Yechim — grafiklarni komponent darajasida lazy qilish:**

```tsx
// GuardianDashboard.tsx
const AttendanceChart = lazy(() => import('./charts/AttendanceChart'));

<Suspense fallback={<ChartSkeleton />}>
  <AttendanceChart data={data} />
</Suspense>
```

Shunda ota-ona **avval raqamlarni** (StatCard) ko'radi — **darhol**, grafik esa
**keyinroq** keladi. Muhim ma'lumot (*"To'lov qarzi: 1 200 000 so'm"*) 98 kB kutmaydi.

⚠️ **Alternativa — Recharts'ni butunlay almashtirish.** Guardian dashboard'dagi
grafiklar oddiy bo'lsa, ular **SVG + Tailwind** bilan chizilishi mumkin — **0 kB
kutubxona**. Bu **qisman dizayn savoli** (grafik qanchalik murakkab bo'lishi kerak) —
14-bo'limga qo'yildi.

**🟠 2. `manualChunks` bilan chegaralarni qat'iylashtirish**

```ts
build: {
  sourcemap: true,   // Sentry uchun (11-bo'lim)
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'query-vendor': ['@tanstack/react-query', 'axios'],
        'charts': ['recharts'],     // ⬅️ aniq izolyatsiya
      },
    },
  },
},
```

`react-vendor` **kamdan-kam o'zgaradi** → brauzer keshida **uzoq** yashaydi. Sahifa
kodini yangilaganda foydalanuvchi React'ni **qayta yuklamaydi**.

**🟡 3. Route prefetch**

Ota-ona `/guardian/dashboard` da turganda `/guardian/grades` chunk'ini **oldindan**
yuklash (`link hover` yoki `requestIdleCallback`). Sekin tarmoqda sezilarli.

**🟡 4. Bundle byudjeti — CI'da**

O'lchash yaxshi, **regressiyani ushlash** — undan yaxshiroq:

```
Guardian yo'li (entry + CSS + dashboard + grafiklar): ≤ 200 kB gzip
Entry chunk: ≤ 150 kB gzip
```

Oshsa — CI **yiqilsin**. Aks holda bundle **asta-sekin** shishadi va hech kim sezmaydi.

⚠️ **Byudjet raqamlari — boshlang'ich taklif, o'lchov bilan aniqlanadi.** Hozirgi
guardian yo'li ~285 kB, ya'ni **200 kB byudjeti darhol yiqiladi**. To'g'ri tartib:
avval Recharts lazy qilinsin → qayta o'lchansin → **erishilgan qiymatdan biroz yuqori**
byudjet qo'yilsin.

---

## 9. ⚠️ Til (i18n)

### 9.1. Hozirgi holat — o'lchangan

```bash
$ grep -rn "i18next\|react-intl\|FormattedMessage\|useTranslation\|@lingui" src/
# 0 natija
```

**i18n kutubxonasi YO'Q. Barcha matn — o'zbek tilida, kodga qattiq yozilgan (hardcoded).**

Misollar (real kod):

| Fayl:qator | Matn |
|---|---|
| `useCrud.ts:64` | `toast.success('Muvaffaqiyatli yaratildi')` |
| `useCrud.ts:72` | `toast.success('Muvaffaqiyatli yangilandi')` |
| `useCrud.ts:79` | `toast.success("Muvaffaqiyatli o'chirildi")` |
| `api.ts:7` | `return "Noma'lum xato"` |
| `api.ts:139` | `toast.error("Ruxsat yo'q", { description: msg })` |
| `api.ts:145` | `"Server xatosi"` / `"Iltimos, keyinroq qayta urinib ko'ring"` |
| `DataTable.tsx:66` | `searchPlaceholder = 'Qidirish...'` |
| `DataTable.tsx:69` | `emptyMessage = "Ma'lumot topilmadi"` |
| `DataTable.tsx:104` | `<TableHead>Amallar</TableHead>` |
| `DataTable.tsx:137` | `Jami: {pagination.total} ta` |
| `StatusBadge.tsx:36-40` | `statusLabels` — **butun xarita** o'zbekcha |
| `GuardianLayout.tsx:17-27` | `navItems` — 11 ta menyu nomi |
| `GuardianLayout.tsx:173` | `<p>Ota-ona</p>` |
| `GuardianLogin.tsx:73-74` | `"Ota-ona kirishi"`, `"O'quvchi ID va parolingizni kiriting"` |
| `SimpleCrudPage.tsx:34,57,58,61` | `"Yangi qo'shish"`, `"Bekor qilish"`, `"Saqlash"`, `"O'chirish"` |

**Miqyos — taxminiy o'lchov:**

```bash
$ grep -rn "Qidirish\|Yaratildi\|Saqlash\|Bekor qilish\|O'chirish\|Tahrirlash" --include=*.tsx src/ | wc -l
118        # ⬅️ FAQAT 6 ta keng tarqalgan so'z bo'yicha
```

118 — bu **atigi 6 ta so'zning** uchrashi. Butun interfeysdagi matn satrlari soni
**bir necha yuz**, ehtimol **1000+** (48 sahifa × o'rtacha 20-30 matn). **Aniq son
o'lchov bilan aniqlanadi** (masalan `i18next-parser --dry-run` bilan).

⚠️ **Backend ham o'zbekcha xato qaytaradi.** `api.ts:44` — `extractErrorMessage(data?.message)` —
ya'ni server xabari **to'g'ridan-to'g'ri** foydalanuvchiga ko'rsatiladi. i18n qilinsa,
**backend ham** qamralishi kerak (yoki backend xato **kodini** qaytarsin, matnini emas).
Bu i18n ishini **sezilarli kattalashtiradi**.

### 9.2. Rus tili kerakmi — halol tahlil

**Kanon 7-bo'lim:** maqsad — *"O'zbekiston tayyorlov akademiyalari uchun mahsulot"*.
Ko'p tenant = ko'p akademiya = **turli til talablari**.

**Rus tili foydasiga (kontekst, o'lchangan bozor ma'lumoti emas):**
- O'zbekistonda rus tili biznes va ta'limda keng ishlatiladi
- Toshkentdagi ba'zi xususiy akademiyalarda ma'muriy til — rus tili
- Raqiblar (kanon 7: WeWork, EducationCRM) ko'p tilli interfeys taklif qilishi **mumkin** —
  ⚠️ **tekshirilmagan**, tasdiqlansin

**Rus tili qarshisiga:**
- **Hozirgi mijoz — bitta akademiya, o'zbek tilida ishlaydi.** Hech kim so'ramagan
- i18n **hozir** qo'shish — **hozirgi mijoz uchun 0 qiymat**, katta ish
- ⚠️ **Bozor hajmi noma'lum** (kanon 7): nechta akademiya bor, ulardan nechtasi rus
  tilini so'raydi — **ma'lumot yo'q**. Talabsiz qurish — spekulyatsiya

**Halol xulosa:**

> **i18n HOZIR kerak emas.** Lekin **ikkinchi tenant rus tilini so'raganda** kerak
> bo'ladi — va **o'shanda kech bo'ladi**: 1000+ satrni 48 sahifadan ajratib olish
> **haftalar** oladi va **regressiya xavfi yuqori** (testlar yo'q — 12-bo'lim).

### 9.3. Tavsiya — "i18n-ready", i18n emas

**Bu farq muhim.** To'liq i18n qilmasdan, **kelajakni arzonlashtirish** mumkin.

**a) 🔴 Yangi kodda matnni ajratish — HOZIR boshlansin**

Mavjud 48 sahifaga **tegilmaydi**. Faqat **yangi** kod uchun qoida:

```ts
// lib/strings.ts — kutubxona YO'Q, oddiy obyekt
export const uz = {
  common: { save: 'Saqlash', cancel: 'Bekor qilish', delete: "O'chirish", search: 'Qidirish...' },
  crud:   { created: 'Muvaffaqiyatli yaratildi', updated: 'Muvaffaqiyatli yangilandi' },
} as const;
```

Narxi — **deyarli nol**. Foydasi — yangi kod **allaqachon tayyor**.

**b) 🟠 Umumiy komponentlarni birinchi ko'chirish**

`useCrud.ts` (3 ta satr), `api.ts` (~8 ta satr), `DataTable.tsx` (~4 ta satr),
`StatusBadge.tsx` (`statusLabels` — 20 ta satr).

⚠️ **Bu ~35 satr butun 48 sahifada ko'rinadi.** Ya'ni **eng katta qamrov / eng kam
ish** nisbati. `StatusBadge.statusLabels` — allaqachon **xarita**, ya'ni **yarim yo'l
bosib bo'lingan**: uni `strings.ts` ga ko'chirish — **mexanik ish**.

**c) 🟡 To'liq i18n — faqat talab paydo bo'lganda**

Mezon aniq: **birinchi tenant rus (yoki ingliz) tilini so'raganda.** Undan oldin — yo'q.

O'shanda `i18next` + `react-i18next` (~15 kB gzip). ⚠️ Va **backend xatolari** ham
qamralsin (9.1 oxiri).

⚠️ **Muhim texnik nuance — o'zbek tilida ko'plik.** Ingliz tilida 2 shakl
(`1 item` / `2 items`), o'zbek tilida **son shaklga ta'sir qilmaydi** (`1 ta` / `2 ta`),
rus tilida **3 shakl** (`1 запись` / `2 записи` / `5 записей`). `DataTable.tsx:137`
da `Jami: {total} ta` — o'zbek uchun to'g'ri, **rus uchun ishlamaydi**. i18next'ning
plural qoidalari buni hal qiladi — lekin **satrlar shunga mos yozilishi** kerak.
Hozirgi hardcode uslubi buni **hisobga olmaydi**.

---

## 10. Ochiqlik (a11y)

### 10.1. ✅ Radix asosi — bu katta yutuq

`package.json` da **26 ta `@radix-ui/*` paket**. Radix primitivlari a11y'ni
**qutidan tashqari** beradi:

| Imkoniyat | Qayerda tekin keladi |
|---|---|
| Fokus qamovi (focus trap) | `SlideOver` (`Sheet` = Dialog), `FormModal`, `ConfirmDialog` |
| `Esc` bilan yopish | shu komponentlar |
| `aria-modal`, `role="dialog"` | avtomatik |
| Fon `inert` (orqada tab bosilmaydi) | avtomatik |
| Klaviatura navigatsiyasi (`Select`, `Tabs`, `DropdownMenu`) | `↑↓`, `Home/End`, harf bilan qidirish — avtomatik |
| `aria-expanded`, `aria-controls`, `aria-selected` | avtomatik |
| Fokus qaytishi (modal yopilgach ochgan tugmaga) | avtomatik |

**Bu poydevor to'g'ri tanlangan.** Buni qo'lda yozish — **oylar**. Modal/select/tabs
uchun a11y'ni **buzish qiyin**, chunki Radix boshqaradi.

> **Shuning uchun quyidagi kamchiliklar — poydevor xatosi emas, balki poydevor
> qamramaydigan joylarda.**

### 10.2. ⚠️ `aria-label` — butun ilovada 1 ta

```bash
$ grep -ro "aria-label" --include=*.tsx pages/ components/shared/ components/layout/ | wc -l
1
$ grep -ro 'size="icon"' --include=*.tsx pages/ components/ | wc -l
77
```

**77 ta ikonkali tugma, 1 ta `aria-label`.**

`size="icon"` — bu **faqat ikonka, matnsiz** tugma. Screen reader uchun u **nomsiz**:

```tsx
// SimpleCrudPage.tsx:39-40 — real kod
<Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
  <Pencil className="h-4 w-4" />
</Button>
<Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true); }}>
  <Trash2 className="h-4 w-4 text-destructive" />
</Button>
```

**Screen reader nima o'qiydi:** *"tugma"* … *"tugma"*. Ikkalasi bir xil.

**Foydalanuvchi holati:** ko'rmaydigan xodim jadvalda o'quvchi qatorida ikkita
**bir xil nomsiz** tugmani topadi. Biri **tahrirlaydi**, biri **o'chiradi**. Farqi —
**faqat ikonka shakli** (`Pencil` vs `Trash2`) va **rang** (`text-destructive`).
Ikkalasi ham screen reader'ga **ko'rinmaydi**.

⚠️ **Bu shunchaki noqulaylik emas — bu ma'lumot yo'qotish xavfi.** `ConfirmDialog`
bor (`:61`), ya'ni tasodifan o'chirish oldini oladi — **lekin dialog ham nima
o'chirilayotganini** aytishi kerak.

**Tuzatish — mexanik, dizaynga ta'sir qilmaydi:**

```tsx
<Button variant="ghost" size="icon" aria-label={`${item.name} — tahrirlash`} onClick={…}>
  <Pencil className="h-4 w-4" aria-hidden="true" />
</Button>
<Button variant="ghost" size="icon" aria-label={`${item.name} — o'chirish`} onClick={…}>
  <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
</Button>
```

**Vizual ko'rinish 0% o'zgaradi.** `aria-label` — faqat screen reader uchun.

⚠️ **Lucide ikonkalari `aria-hidden` qo'shadimi?** Tekshirilsin. Agar yo'q bo'lsa,
SVG'lar ham e'lon qilinishi va shovqin qo'shishi mumkin.

**Miqyos:** 77 ta joy. **Bir kunlik ish**, lekin `grep 'size="icon"'` bilan
ro'yxat **allaqachon tayyor**.

### 10.3. ⚠️ Klaviatura — bosiladigan `<div>`

**`StatCard.tsx:26-32`** — eng aniq misol:

```tsx
<Card
  className={cn("stat-card …", onClick && "cursor-pointer hover:shadow-md …")}
  onClick={onClick}       // ⬅️ <div> ga onClick
>
```

`Card` — bu `<div>`. Natijada:

- ❌ `Tab` bilan **fokus olmaydi** (`tabIndex` yo'q)
- ❌ `Enter` / `Space` **ishlamaydi**
- ❌ Screen reader uni **bosiladigan deb e'lon qilmaydi** (`role` yo'q)
- ❌ Fokus halqasi (focus ring) **yo'q**

**Ya'ni faqat sichqoncha bilan bosiladi.** Klaviatura foydalanuvchisi (ko'rmaydigan
yoki qo'l harakati cheklangan) uchun **StatCard umuman mavjud emas**.

**Tuzatish:**

```tsx
<Card
  {...(onClick && {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    },
  })}
  className={cn("stat-card …", onClick && "cursor-pointer … focus-visible:ring-2 focus-visible:ring-ring")}
>
```

⚠️ **`GuardianLogin.tsx:89` — `tabIndex={-1}` parol ko'rsatish tugmasida:**

```tsx
<button type="button" onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 …" tabIndex={-1}>
```

`tabIndex={-1}` — tugma **Tab navigatsiyasidan chiqarilgan**. Bu **ongli qaror**
bo'lishi mumkin (parol maydonidan `Tab` bosganda darhol "Kirish" tugmasiga o'tsin).
**Lekin klaviatura foydalanuvchisi parolini ko'ra olmaydi.**

Parolni terishda xato qilgan ota-ona (mobil klaviaturada — **oson**) uni **tekshira
olmaydi**, agar sichqoncha ishlatmasa. Bu ⚠️ **munozarali** — `aria-label="Parolni
ko'rsatish"` + `tabIndex` olib tashlash afzalroq bo'lishi mumkin. **Ochiq savol.**

⚠️ **Global tekshirish kerak:** `grep -rn "onClick" --include=*.tsx src/ | grep -v "Button\|button"`
— boshqa `<div onClick>` holatlarini topish. Bu hujjatda **to'liq sanalmagan**.

### 10.4. ⚠️ Kontrast — o'lchanmagan

**Halol:** kontrast **tekshirilmadi**, chunki bu **rang qarori** bilan chambarchas
bog'liq va bu hujjat **dizaynga tegmaydi**.

Lekin **texnik xavf nuqtalari** ko'rsatiladi — mavjud koddagi naqsh:

```tsx
// StatusBadge.tsx:12 — real
ACTIVE: 'bg-success/10 text-success border-success/20',
```

⚠️ **`/10` — 10% shaffoflik.** Ya'ni fon **deyarli oq**, matn — **to'yingan rang**.
Bu odatda **yaxshi** kontrast beradi. **Lekin:**

- `text-muted-foreground` **kichik matnda** (`text-xs` — `StatCard.tsx:38,40`;
  `GuardianLayout.tsx:232` — **`text-[10px]`** bottom nav'da) — ⚠️ **shubhali**
- ⚠️ **`text-[10px]`** — WCAG "kichik matn" chegarasi 18.66px (yoki 14px qalin).
  10px matn **4.5:1** kontrast talab qiladi, `text-muted-foreground` odatda **~4:1**
- Qorong'i rejim (`ThemeProvider`) — **ikki xil kontrast**, ikkalasi ham tekshirilishi kerak
- `GuardianLogin.tsx:57` — `color: 'rgba(255,255,255,0.7)'` gradient ustida — ⚠️ **inline
  style**, Tailwind tizimidan tashqarida, **tekshirilmagan**

**Texnik talab (rang qarori EMAS):**

> Tanlangan palitra (**qaysi bo'lishidan qat'i nazar**) **WCAG 2.1 AA** dan o'tsin:
> oddiy matn **4.5:1**, katta matn (≥18.66px yoki ≥14px qalin) **3:1**, UI komponent
> chegaralari **3:1**. **Light va dark rejim — alohida.**
>
> Bu **rangni tanlamaydi** — tanlangan rangga **mezon** qo'yadi.

**Vosita:** `axe-core` yoki Lighthouse CI — kontrastni **avtomatik** o'lchaydi.
12-bo'limga qarang.

### 10.5. ⚠️ Boshqa tekshirilishi kerak bo'lgan joylar

| Nuqta | Holat |
|---|---|
| `<img alt="">` | `grep -rn "<img" src/` → **1 ta**. Ikonkalar SVG, rasmlar kam — **xavf past** |
| Forma `<Label htmlFor>` | ✅ `GuardianLogin.tsx:79,84` — **to'g'ri bog'langan** |
| Xato xabarlari `aria-live` | ⚠️ **`sonner` toast** — `aria-live` beradimi? **Tekshirilsin.** Bermasa, screen reader **xato haqida bilmaydi** |
| Skeleton `aria-busy` | ⚠️ `DataTable` skeleton (`:108`) — screen reader'ga *"yuklanmoqda"* deyilmaydi |
| Sahifa `<h1>` | ⚠️ `PageHeader` `<h1>` ishlatadimi — **tekshirilsin** |
| Sahifa `<title>` | ⚠️ SPA — route almashganda `document.title` **yangilanadimi**? Screen reader sahifa nomini shundan oladi |
| "Skip to content" havolasi | ⚠️ **Yo'q.** Har sahifada 11-36 ta nav havolasidan `Tab` bilan o'tish kerak |
| `prefers-reduced-motion` | ⚠️ `animate-fade-in`, `hover:scale-[1.02]` — vestibulyar buzilishi bor foydalanuvchi uchun. Tekshirilsin |

⚠️ **`aria-live` — eng jiddiy.** `useCrud.ts:64,72,79` da **barcha** muvaffaqiyat
xabari toast orqali. `api.ts:139-149` da **barcha** xato xabari toast orqali.
Agar `sonner` `aria-live="polite"` bermasa — **ko'rmaydigan foydalanuvchi
o'chirish muvaffaqiyatli bo'ldimi yoki yo'qmi bilmaydi.**

### 10.6. Xulosa — a11y holati

| | |
|---|---|
| **Poydevor (Radix)** | ✅ **Yaxshi** — modal, select, tabs a11y'si **tayyor** |
| **`aria-label`** | ⚠️ **Yomon** — 77 nomsiz tugma |
| **Klaviatura** | ⚠️ **Qisman** — Radix qamragan joylar ✅, `<div onClick>` ❌ |
| **Kontrast** | ⚠️ **Noma'lum** — o'lchanmagan (dizayn savoli) |
| **Screen reader** | ⚠️ **Noma'lum** — `aria-live`, `document.title` tekshirilmagan |

**Kanon konteksti:** bu tizimni **real xodimlar** ishlatadi. Agar akademiyada
ko'rish qobiliyati cheklangan xodim bo'lsa (yoki **bo'lsa** — ishga olishda to'siq
bo'lmasin), a11y — **funksional talab**, "yaxshi bo'lardi" emas.

---

## 11. Xatolik ishlash

### 11.1. ✅ Markazlashgan API xato ishlash — yaxshi

`api.ts:6-46` — `extractErrorMessage()` **rekursiv** funksiya. Bu **o'ylab yozilgan**:

```ts
function extractErrorMessage(input: unknown): string {
  if (!input) return "Noma'lum xato";
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) { … .map(extractErrorMessage).filter(Boolean).join('\n'); }
  if (typeof input === 'object') {
    const obj = input as Record<string, any>;
    // Nest ValidationError format: { property, children, constraints }
    if (obj.constraints && typeof obj.constraints === 'object') {
      const values = Object.values(obj.constraints).filter((v) => typeof v === 'string');
      if (values.length) return values.join(', ');
    }
    if (obj.message) return extractErrorMessage(obj.message);
    if (obj.error)   return extractErrorMessage(obj.error);
    try { return JSON.stringify(obj); } catch { return "Noma'lum xato"; }
  }
  return String(input);
}
```

**Nega bu yaxshi:** NestJS `class-validator` xatolari **ichma-ich** keladi
(`{ property, constraints: { isNotEmpty: "..." }, children: [...] }`). Bu funksiya
uni **ochib**, foydalanuvchiga o'qiladigan matn beradi. Kanon 128 ta DTO haqida
gapiradi — ya'ni validatsiya xatolari **tez-tez** bo'ladi. Bu kod ularni to'g'ri
ishlaydi.

⚠️ Oxirgi fallback — `JSON.stringify(obj)`. Foydalanuvchi `{"statusCode":500,...}`
ko'rishi mumkin. Kamdan-kam, lekin **chirkin**. Yaxshiroq: kutilmagan shaklda
umumiy xabar + `console.error` bilan asl obyekt.

**Status kodlari bo'yicha ishlash** (`api.ts:138-150`):

| Status | Ishlov | Baholash |
|---|---|---|
| **401** | Refresh → qayta urin → bo'lmasa login | ✅ **Toast yo'q** — to'g'ri, foydalanuvchi bilmasligi kerak |
| **403** | `toast.error("Ruxsat yo'q")` | ✅ |
| **400** | `toast.error("Xato", { description: msg })` | ✅ Server xabari ko'rsatiladi |
| **404** | `toast.error("Topilmadi")` | ✅ |
| **≥500** | `toast.error("Server xatosi", "Iltimos, keyinroq…")` | ✅ **Server tafsiloti yashiriladi** — to'g'ri |
| **Tarmoq yo'q** | `toast.error("Tarmoq xatosi")` | ✅ Muhim — mobil uchun |
| **`ERR_CANCELED`** | **jim** | ✅ To'g'ri |

**Bu jadval — kuchli tomon.** Har status uchun **mos** javob. 500'da server tafsiloti
**ko'rsatilmaydi** (xavfsizlik). Bekor qilingan so'rovga toast **yo'q**.

### 11.2. ⚠️ Error Boundary — YO'Q

```bash
$ grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" src/
# 0 natija
```

**React'da render paytidagi qulash `try/catch` bilan ushlanmaydi.** Faqat Error
Boundary ushlaydi. Boundary bo'lmasa — React **butun daraxtni unmount qiladi**.

**Foydalanuvchi ko'radigan narsa: butunlay OQ EKRAN.** Menyu yo'q, xato xabari yo'q,
"qayta urinish" yo'q. Faqat oq.

**Qanchalik ehtimolli — real ssenariylar:**

```tsx
// StatCard.tsx:41 — trend.value undefined bo'lsa
{Math.abs(trend.value)}          // Math.abs(undefined) → NaN — qulamaydi, "NaN%" ko'rsatadi

// DataTable.tsx:124 — item[col.key] obyekt bo'lsa
{col.render ? col.render(item) : item[col.key]}
// ⬅️ agar item[col.key] = { id: 1, name: 'x' } bo'lsa:
// "Objects are not valid as a React child" → QULASH
```

⚠️ **Ikkinchisi real xavf.** `DataTable` `render` **ixtiyoriy** (`:19`). Agar
`Column.key = 'student'` va backend `student: { id, fullName }` (nested obyekt)
qaytarsa — `render` yozilmagan bo'lsa **qulash**. Backend javob shakli
o'zgarsa (masalan `include` qo'shilsa) — **oq ekran**.

Kanon: **testlar amalda nol**. Ya'ni bunday regressiya **CI'da tutilmaydi** —
foydalanuvchi topadi.

**Kerakli — ikki daraja:**

```tsx
// components/shared/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // TODO: Sentry.captureException(error, { contexts: { react: info } });
  }
  render() {
    if (this.state.error) return this.props.fallback ?? <DefaultErrorFallback onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
```

**Joylashuvi — ikki daraja muhim:**

```tsx
// App.tsx
<ErrorBoundary>                               {/* 1) global — oxirgi to'siq */}
  <QueryClientProvider client={queryClient}>
    …
      <BrowserRouter …>
        <ErrorBoundary key={location.pathname}>   {/* 2) route — sahifa qulasa, LAYOUT qoladi */}
          <Suspense fallback={<RouteFallback />}>
            <Routes>…</Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
  </QueryClientProvider>
</ErrorBoundary>
```

⚠️ **`key={location.pathname}` muhim** — Error Boundary xatodan **avtomatik
tiklanmaydi**. Key almashsa — boundary **qayta yaratiladi**, ya'ni foydalanuvchi
**boshqa sahifaga o'tib qutulishi** mumkin. Aks holda u **qamalib qoladi**.

**Route darajasidagi boundary — nega muhim:** `GuardianGrades` qulasa, ota-ona
**menyuni ko'rib turadi** va `/guardian/billing` ga o'ta oladi. Global boundary
bo'lsa — **hamma narsa** yo'qoladi.

⚠️ **`lazy()` chunk yuklanmasa ham qulaydi.** 48 sahifa lazy (8.1). Deploy paytida
foydalanuvchi ochiq sahifada tursa, eski chunk hash'lari **yo'qoladi** →
`ChunkLoadError` → **oq ekran**. Boundary buni ushlab, *"Yangilanish mavjud,
sahifani yangilang"* deyishi kerak — bu **mobil'da tez-tez** bo'ladi (uzoq ochiq
turgan tab).

### 11.3. ⚠️ `useCrud` da xatolar **yutiladi**

```ts
// useCrud.ts:51-53
} catch {
  // errors handled by api interceptor
}
```

**Kommentda aytilgani — qisman to'g'ri.** Interceptor toast ko'rsatadi. **Lekin:**

1. **`data` eski holatda qoladi.** Xato bo'lsa `setData` chaqirilmaydi — jadval
   **eski ma'lumotni** ko'rsatishda davom etadi. Foydalanuvchi toast'ni o'tkazib
   yuborsa (5 soniyada yo'qoladi), u **eski ma'lumotga ishonadi**. Bu — **jimgina
   noto'g'ri ma'lumot**, ayniqsa filtr o'zgarganda.
2. **Xato holati yo'q.** `useCrud` `error` qaytarmaydi. Sahifa *"yuklab bo'lmadi,
   qayta urinish"* ko'rsata **olmaydi** — chunki xato bo'lganini **bilmaydi**.
3. **Qayta urinish yo'q.** `QueryClient.retry: 1` — `useCrud` ga **tegishli emas** (4.2).

**Tuzatish** — 4.3-dagi TanStack Query migratsiyasi buni **avtomatik hal qiladi**
(`isError`, `error`, `refetch`, `retry`). Yana bir sabab.

⚠️ **`create/update/remove` da `try/catch` YO'Q** (`:62-80`) — bu **to'g'ri**:
xato yuqoriga **ko'tariladi** va chaqiruvchi `await create(form)` da uni tutadi.
`SimpleCrudPage.tsx:58` da:

```tsx
onClick={async () => { if (editing) await update(editing.id, form); else await create(form); setModalOpen(false); }}
```

⚠️ **Bag:** `await create(form)` **throw qilsa** — `setModalOpen(false)` **bajarilmaydi**
(to'g'ri, modal ochiq qoladi). **Lekin** `onClick` **`async`** va `Promise` **hech kim
tutmaydi** → **unhandled rejection**. Konsolda ogohlantirish. Interceptor toast'ni
ko'rsatgani uchun foydalanuvchi xabar oladi — **lekin** kelajakda global
`unhandledrejection` handler qo'shilsa, bu **soxta xato hisoboti** beradi.

### 11.4. ⚠️ Xato kuzatuvi (error tracking) — yo'q

Kanon 6-bo'lim: *"Observability yo'q — structured logging, metrics, tracing"*.
**Frontend'da ham xuddi shunday.**

Hozir: foydalanuvchi oq ekran ko'radi → hech kim **bilmaydi** → ota-ona qo'ng'iroq
qiladi → xodim *"qayta kiring"* deydi → **sabab hech qachon topilmaydi**.

**Kerakli:**

```ts
// main.tsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // ⚠️ MUHIM: bolalar ma'lumoti. Kanon 10-bo'lim.
    // O'quvchi ismi/ID/telefon Sentry'ga TUSHMASLIGI kerak.
    return scrubPII(event);
  },
});
```

⚠️ **Kanon 10-bo'lim: *"yuridik maslahat (… ayniqsa bolalar ma'lumoti: bu maktab,
o'quvchilar voyaga yetmagan)"*.**

**Bu yerda to'qnashuv bor:** xato hisoboti **kontekst** talab qiladi (qaysi
foydalanuvchi, qaysi ma'lumot), lekin **o'quvchi ma'lumoti — voyaga yetmaganlarniki**.
Sentry'ga o'quvchi ismi/ID'si yuborilsa — bu **shaxsiy ma'lumotni uchinchi tomon
serveriga** (odatda **AQSh/EI**) uzatish.

**Bu — yurist savoli** (kanon 10). Texnik javob:
- `beforeSend` da **PII tozalash** (ismlar, ID'lar, telefon, URL'dagi `/students/123`)
- Yoki **self-hosted** Sentry — ma'lumot **mamlakatdan chiqmaydi**
- ⚠️ **Ochiq savol:** O'zbekiston shaxsiy ma'lumotlar to'g'risidagi qonuni
  (lokalizatsiya talabi) — **yurist tasdiqlasin**

⚠️ **`vite.config.ts` da `sourcemap` yo'q** (8.4). Sourcemap'siz Sentry stack trace'i
`a.b.c is not a function` ko'rinishida — **foydasiz**. `sourcemap: true` + sourcemap'larni
**Sentry'ga yuklash** (public'ga **emas** — aks holda kod ochiladi).

### 11.5. Xulosa

| | |
|---|---|
| API xato → toast | ✅ **Yaxshi** — markazlashgan, status bo'yicha to'g'ri |
| 401 → refresh → qayta urin | ✅ **Yaxshi** — navbat bilan |
| Validatsiya xatosini ochish | ✅ **Yaxshi** — rekursiv `extractErrorMessage` |
| Render qulashi | ❌ **Oq ekran** — Error Boundary **yo'q** |
| `useCrud` xato holati | ❌ **Yutiladi** — sahifa xato bo'lganini bilmaydi |
| Chunk yuklash xatosi | ❌ **Oq ekran** |
| Xato kuzatuvi | ❌ **Yo'q** — hech kim bilmaydi |
| Sourcemap | ❌ **Yo'q** |

---

## 12. Testlar

### 12.1. Hozirgi holat

Kanon: *"**1 ta** — `apps/web/src/test/example.test.ts` (placeholder). Ya'ni amalda **NOL**"*.

**Tasdiqlandi:**

```ts
// src/test/example.test.ts — TO'LIQ fayl
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

✅ **Yaxshi xabar — infratuzilma TAYYOR.** `vitest.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",           // ✅ DOM bor
    globals: true,                  // ✅ describe/it/expect global
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },   // ✅ @ alias ishlaydi
});
```

Va `src/test/setup.ts` da `matchMedia` **mock qilingan** (`use-mobile.tsx` va
`next-themes` uchun kerak) + `@testing-library/jest-dom` ulangan.

`@testing-library/react` **^16.0.0** — `package.json:76`.

> **Ya'ni to'siq texnik emas.** Hamma narsa sozlangan. `npm test` ishlaydi.
> **Faqat testlar yozilmagan.** Bu — **eng arzon boshlanish nuqtasi**.

### 12.2. Nima test qilinadi — ustuvorlik bo'yicha

**Tanlov mezoni:** *bag paydo bo'lsa, qancha joyni buzadi?* × *jimgina buziladimi?*

---

#### 🔴 1. `useCrud` mantiqi — **eng yuqori ustuvorlik**

**Nega birinchi:** **21 sahifa** shu hook ustida. Bitta bag — 21 joyda. Va 4.3-dagi
TanStack Query migratsiyasi **shu testlarsiz xavfli** — 21 sahifani qo'lda tekshirish
kerak bo'ladi.

```ts
// src/hooks/useCrud.test.ts
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCrud } from './useCrud';
import api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('useCrud — javob shakli normalizatsiyasi', () => {
  beforeEach(() => vi.resetAllMocks());

  it('yalang\'och massivni ishlaydi: []', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: '1' }, { id: '2' }] });
    const { result } = renderHook(() => useCrud({ endpoint: '/students' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.total).toBe(2);
  });

  it('{ data, total } shaklini ishlaydi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: '1' }], total: 57 } });
    const { result } = renderHook(() => useCrud({ endpoint: '/students' }));
    await waitFor(() => expect(result.current.total).toBe(57));
    expect(result.current.totalPages).toBe(3);   // ceil(57/20)
  });

  it('{ data, meta: { total } } shaklini ishlaydi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: '1' }], meta: { total: 41 } } });
    const { result } = renderHook(() => useCrud({ endpoint: '/students' }));
    await waitFor(() => expect(result.current.total).toBe(41));
  });

  it('{ items, total } shaklini ishlaydi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [{ id: '1' }], total: 5 } });
    const { result } = renderHook(() => useCrud({ endpoint: '/x' }));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('kutilmagan shaklda QULAMAYDI', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { unexpected: true } });
    const { result } = renderHook(() => useCrud({ endpoint: '/x' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

describe('useCrud — pagination', () => {
  it('totalPages ni TO\'G\'RI hisoblaydi (ceil, floor emas)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 21 } });
    const { result } = renderHook(() => useCrud({ endpoint: '/x' }));
    await waitFor(() => expect(result.current.totalPages).toBe(2));   // 21/20 → 2, 1 EMAS
  });

  it('total=0 da totalPages=1', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 0 } });
    const { result } = renderHook(() => useCrud({ endpoint: '/x' }));
    await waitFor(() => expect(result.current.totalPages).toBe(1));
  });
});

describe('useCrud — BigInt ID xavfsizligi ⬅️ 5.3-5.5-bo'lim', () => {
  it('ID ni URL ga STRING sifatida uzatadi — precision yo\'qolmaydi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCrud({ endpoint: '/students' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const bigId = '9007199254740993';   // MAX_SAFE_INTEGER + 2
    await act(async () => { await result.current.update(bigId, { name: 'x' }); });

    // Number(bigId) → 9007199254740992 bo'lardi. String — aniq saqlanadi.
    expect(api.patch).toHaveBeenCalledWith('/students/9007199254740993', { name: 'x' });
  });

  it('katta ID ni o\'chirishda ham precision saqlanadi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useCrud({ endpoint: '/students' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.remove('9223372036854775807'); });  // BigInt max
    expect(api.delete).toHaveBeenCalledWith('/students/9223372036854775807');
  });
});

describe('useCrud — REGRESSIYA testlari (2.4-bo\'limdagi baglar)', () => {
  it('⚠️ HOZIR YIQILADI: qidiruv sahifani 1 ga qaytaradi (Bag №1)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], total: 100 } });
    const { result } = renderHook(() => useCrud({ endpoint: '/students' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setPage(5); });
    await waitFor(() => expect(result.current.page).toBe(5));

    act(() => { result.current.setSearch('Ali'); });
    await waitFor(() => expect(result.current.page).toBe(1));   // ⬅️ hozir 5 qaytaradi
  });
});
```

> ⚠️ **Oxirgi test ataylab yiqiladi** — u Bag №1 ni **hujjatlashtiradi**. Tuzatilgach
> yashil bo'ladi va **qaytib kelishini** oldini oladi. Bu **TDD emas** — bu
> **bagni qulflash**.

---

#### 🔴 2. Guardian login formati parsing — **eng yuqori ustuvorlik**

**Nega:** kanon 4.2 buni **aniq belgilaydi**:

> *"Guardian login formati: `<tenant-slug>-<student-id>`, masalan `mathacademy-MA-0001`.
> ⚠️ **Birinchi tire bo'yicha ajratiladi** (oxirgisi bo'yicha emas) — **bu real bag edi**"*

**Kanon buni "real bag edi" deb belgilagan.** Ya'ni bu **bir marta buzilgan**.
Tuzatilgan, lekin **test yo'q** → **yana buzilishi mumkin** va hech kim sezmaydi.

**Nega bu bag qaytishi oson — mantiq:**

```ts
// ❌ NOTO'G'RI (oxirgi tire bo'yicha) — "real bag edi"
const i = input.lastIndexOf('-');
// "mathacademy-MA-0001" → slug = "mathacademy-MA", studentId = "0001"   ❌

// ✅ TO'G'RI (birinchi tire bo'yicha)
const i = input.indexOf('-');
// "mathacademy-MA-0001" → slug = "mathacademy", studentId = "MA-0001"   ✅
```

**`indexOf` va `lastIndexOf` — bitta harf farqi.** Va o'quvchi ID'sining o'zida
**tire bor** (`MA-0001`) — aynan shu narsa bagni yuzaga keltirgan.

⚠️ **Muhim aniqlik:** hozir `GuardianLogin.tsx:33` da parsing **yo'q** — frontend
`studentId` ni **butunligicha** yuboradi:

```tsx
await login('GUARDIAN', { studentId, password });   // "mathacademy-MA-0001" — xom
```

**Ya'ni parsing BACKEND'da.** Bu **to'g'ri joy** (frontend'ga ishonmaslik kerak).
**Lekin:**

- Test **backend'da** (`apps/api`) bo'lishi kerak — **u yerda ham yo'q**
- Frontend **format validatsiyasini** qilishi mumkin (7.5-bo'lim) — **noto'g'ri
  formatni serverga yubormay**, ota-onaga darhol *"ID `akademiya-MA-0001` ko'rinishida
  bo'lishi kerak"* deyish. Bu **UX yaxshilanishi**, xavfsizlik emas

**Agar frontend'ga validatsiya qo'shilsa — test:**

```ts
// src/lib/guardianId.test.ts
import { parseGuardianId } from './guardianId';

describe('parseGuardianId — kanon 4.2', () => {
  it('BIRINCHI tire bo\'yicha ajratadi (lastIndexOf EMAS)', () => {
    expect(parseGuardianId('mathacademy-MA-0001'))
      .toEqual({ tenantSlug: 'mathacademy', studentId: 'MA-0001' });
  });

  it('o\'quvchi ID sida bir nechta tire bo\'lsa ham ishlaydi', () => {
    expect(parseGuardianId('academy-X-MA-0001-B'))
      .toEqual({ tenantSlug: 'academy', studentId: 'X-MA-0001-B' });
  });

  it('slug da tire bo\'lsa — birinchi tire baribir ajratadi', () => {
    // ⚠️ Bu ATAYLAB: "new-academy" slug'i MUMKIN EMAS degan cheklovni hujjatlashtiradi
    expect(parseGuardianId('new-academy-MA-0001'))
      .toEqual({ tenantSlug: 'new', studentId: 'academy-MA-0001' });
  });

  it('tire yo\'q — rad etadi', () => {
    expect(() => parseGuardianId('mathacademy')).toThrow();
  });

  it('bo\'sh slug — rad etadi', () => {
    expect(() => parseGuardianId('-MA-0001')).toThrow();
  });

  it('bo\'sh student ID — rad etadi', () => {
    expect(() => parseGuardianId('mathacademy-')).toThrow();
  });
});
```

⚠️ **Uchinchi test — juda muhim va u ochiq savol ochadi.** `new-academy-MA-0001` →
slug `new`, ID `academy-MA-0001`. Bu **kanon qoidasining mantiqiy oqibati**.

**Ya'ni tenant slug'ida tire BO'LMASLIGI kerak** — aks holda login **ishlamaydi**.
Bu **hech qayerda hujjatlashtirilmagan** va **hech qayerda majburlanmagan**.

> ⚠️ **Ochiq savol (14-bo'limga):** tenant slug'i tire'ni **taqiqlaydimi**? Agar
> yo'q bo'lsa — `new-academy` degan akademiya qo'shilsa, uning **barcha ota-onalari
> tizimga kira olmaydi**. Bu **kanon 6-bo'limdagi "self-service onboarding"**
> uchun **bloklovchi**. Backend'da `tenants` slug validatsiyasi tekshirilsin.

---

#### 🟠 3. `DataTable` rendering

```ts
// src/components/shared/DataTable.test.tsx
describe('DataTable', () => {
  const columns: Column<any>[] = [
    { key: 'name', title: 'Ism' },
    { key: 'status', title: 'Holat', render: (i) => <StatusBadge status={i.status} /> },
  ];

  it('loading=true da skeleton ko\'rsatadi, ma\'lumot emas', () => {
    render(<DataTable columns={columns} data={[]} loading />);
    expect(screen.queryByText("Ma'lumot topilmadi")).not.toBeInTheDocument();
  });

  it('bo\'sh massivda bo\'sh xabar ko\'rsatadi', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Ma'lumot topilmadi")).toBeInTheDocument();
  });

  it('data massiv BO\'LMASA qulamaydi (:73 mudofaasi)', () => {
    expect(() => render(<DataTable columns={columns} data={null as any} />)).not.toThrow();
    expect(() => render(<DataTable columns={columns} data={undefined as any} />)).not.toThrow();
    expect(() => render(<DataTable columns={columns} data={{} as any} />)).not.toThrow();
  });

  it('render funksiyasini ishlatadi', () => {
    render(<DataTable columns={columns} data={[{ name: 'Ali', status: 'ACTIVE' }]} />);
    expect(screen.getByText('Faol')).toBeInTheDocument();   // StatusBadge tarjimasi
  });

  it('bitta sahifa bo\'lsa pagination YASHIRADI (:135)', () => {
    render(<DataTable columns={columns} data={[{ name: 'A' }]}
      pagination={{ page: 1, totalPages: 1, total: 1, onPageChange: vi.fn() }} />);
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('1-sahifada "oldingi" tugmasi o\'chirilgan', () => {
    render(<DataTable columns={columns} data={[{ name: 'A' }]}
      pagination={{ page: 1, totalPages: 3, total: 50, onPageChange: vi.fn() }} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
  });

  it('oxirgi sahifada "keyingi" tugmasi o\'chirilgan', () => {
    render(<DataTable columns={columns} data={[{ name: 'A' }]}
      pagination={{ page: 3, totalPages: 3, total: 50, onPageChange: vi.fn() }} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });
});
```

⚠️ **Uchinchi test (`data={null}`) — muhim.** `DataTable.tsx:73` da
`Array.isArray(data) ? data : []` mudofaasi bor. **Test uni qulflaydi** — kelajakda
kimdir bu qatorni "soddalashtirsa", test **yiqiladi**.

---

#### 🟠 4. `StatusBadge` — ma'lum bagni qulflash

```ts
describe('StatusBadge', () => {
  it('o\'zbekcha tarjima ko\'rsatadi', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Faol')).toBeInTheDocument();
  });

  it('noma\'lum statusda QULAMAYDI, xom kod ko\'rsatadi', () => {
    render(<StatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });

  it('⚠️ HOZIR YIQILADI: WARNING tarjima qilinadi (3.4-bo\'limdagi bag)', () => {
    render(<StatusBadge status="WARNING" />);
    expect(screen.getByText('Ogohlantirish')).toBeInTheDocument();   // hozir "WARNING" chiqadi
  });

  it('label prop tarjimadan ustun', () => {
    render(<StatusBadge status="ACTIVE" label="Maxsus" />);
    expect(screen.getByText('Maxsus')).toBeInTheDocument();
  });
});
```

---

#### 🟡 5. `api.ts` — `extractErrorMessage`

```ts
describe('getApiErrorMessage', () => {
  it('NestJS ValidationError ni ochadi', () => {
    const err = { response: { data: { message: [
      { property: 'email', constraints: { isEmail: 'email noto\'g\'ri', isNotEmpty: 'bo\'sh bo\'lmasin' } },
    ] } } };
    expect(getApiErrorMessage(err)).toBe("email noto'g'ri, bo'sh bo'lmasin");
  });

  it('ichma-ich message ni ochadi', () => {
    expect(getApiErrorMessage({ response: { data: { message: { message: 'ichkarida' } } } })).toBe('ichkarida');
  });

  it('massiv xabarlarni birlashtiradi', () => {
    expect(getApiErrorMessage({ response: { data: { message: ['bir', 'ikki'] } } })).toBe('bir\nikki');
  });

  it('null/undefined da fallback', () => {
    expect(getApiErrorMessage(null, 'zaxira')).toBe('zaxira');
  });
});
```

---

#### 🟡 6. `AuthProvider`

```ts
describe('AuthProvider', () => {
  it('/auth/me javobini profilga to\'g\'ri xaritalaydi', async () => { … });

  it('ID larni STRING sifatida saqlaydi (BigInt xavfsizligi)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { user: {
      type: 'STAFF', userId: 9007199254740993n.toString(), tenantId: '1', profile: {},
    } } });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.user!.userId).toBe('9007199254740993');
    expect(typeof result.current.user!.userId).toBe('string');
  });

  it('buzuq localStorage["user"] da QULAMAYDI (:105-108)', async () => {
    localStorage.setItem('access_token', 'x');
    localStorage.setItem('user', '{buzuq json');
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(localStorage.getItem('user')).toBeNull();   // tozalangan
  });

  it('logout localStorage ni tozalaydi', async () => { … });
});
```

---

### 12.3. ⚠️ Nima test QILINMAYDI (ataylab)

**Halol chegara** — testlar ham **xarajat**. Qaytim past joylarda yozilmasin:

| Test qilinmaydi | Nega |
|---|---|
| **48 sahifaning har biri** | Qimmat, mo'rt (dizayn o'zgarsa yiqiladi), qaytim past. Sahifalar — **kompozitsiya**, mantiq hook'da |
| **`ui/*` shadcn komponentlari** | Radix **o'zi test qilingan**. Uchinchi tomon kodini test qilish — behuda |
| **Snapshot testlari** | ⚠️ **Ayniqsa qochilsin.** Dizayn hali muhokama qilinmagan (14-bo'lim) — har o'zgarishda **yuzlab snapshot** yiqiladi. Odamlar `-u` bosishni o'rganadi va **snapshot ma'nosini yo'qotadi** |
| **Vizual regressiya** | Dizayn barqarorlashmaguncha — erta |

**Prinsip:** **mantiqni** test qil (`useCrud`, parsing, xato ishlash), **ko'rinishni**
emas.

### 12.4. CI — testsiz test yozish foydasiz

Kanon 6: *"**CI yo'q** — `.github/` yo'q"*.

⚠️ **Testlar yozilib, CI'da ishlamasa — ular o'ladi.** Bir hafta ichida kimdir
yiqilgan testni "keyin tuzataman" deb qoldiradi.

**Minimal `.github/workflows/web.yml`:**

```yaml
name: web
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint      --workspace=apps/web
      - run: npx tsc --noEmit  --project apps/web    # ⬅️ hozir HECH QAYERDA ishlamaydi
      - run: npm run test      --workspace=apps/web
      - run: npm run build     --workspace=apps/web
```

⚠️ **`tsc --noEmit` — eng arzon g'alaba.** `package.json:6-14` da **type-check
skripti yo'q**: `build` — `vite build`, va **Vite tiplarni tekshirmaydi** (esbuild
tiplarni **tashlab yuboradi**). Ya'ni **hozir tip xatosi bilan build o'tadi**.

Bu 5.5-bo'lim bilan bog'liq: `useCrud` dan `| number` olib tashlansa, `tsc --noEmit`
**xatolarni ko'rsatadi** — lekin **faqat kimdir uni ishga tushirsa**.

**Qo'shilsin:** `"typecheck": "tsc --noEmit"` → `package.json` skriptlariga.

### 12.5. Boshlanish tartibi

| # | Ish | Qamrov | Narx |
|---|---|---|---|
| 1 | `npm run typecheck` skripti + CI | **butun kod bazasi** | **1 soat** |
| 2 | `useCrud` testlari | **21 sahifa** | 1 kun |
| 3 | `DataTable` + `StatusBadge` | **48 sahifa** | 1 kun |
| 4 | `guardianId` parsing (**backend'da ham**) | **barcha ota-ona logini** | 0.5 kun |
| 5 | `api.ts` xato ishlash | **barcha xatolar** | 0.5 kun |
| 6 | `AuthProvider` | **butun auth** | 1 kun |

⚠️ **1-qadam eng arzon va eng foydali.** `tsc --noEmit` — **bir soatlik ish**,
**butun 25 489 qatorni** qamraydi.

> **Muhim:** kanon 6-bo'lim **eng muhim test** deb *"tenant izolyatsiyasi"* ni
> belgilaydi — bu **backend testi** (`apps/api`), ushbu hujjat qamrovidan tashqarida.
> Frontend testlari uni **almashtira olmaydi**. Frontend tenant'ni **JWT'dan**
> oladi va **hech qachon** parametr sifatida yubormaydi — bu **to'g'ri**, lekin
> kafolat **backend'da**.

---

## 13. Kelajak — mobil ilova, PWA, Telegram bot

### 13.1. Savolni to'g'ri qo'yish

Savol "mobil ilova kerakmi?" **emas**. To'g'ri savol:

> **Ota-ona farzandi haqidagi ma'lumotni eng kam ishqalanish bilan qanday oladi?**

Hozirgi javob: **brauzer ochadi → URL yozadi → `mathacademy-MA-0001` teradi →
parol teradi → ~285 kB yuklaydi (7.6) → ko'radi.**

Bu — **kuniga bir marta baho tekshirish** uchun **juda ko'p ishqalanish**. Ko'p
ota-ona **umuman kirmaydi**.

### 13.2. Uchta variant — texnik taqqoslash

| | **PWA** | **Mobil ilova** (RN/Flutter) | **Telegram bot** |
|---|---|---|---|
| Mavjud kodni qayta ishlatish | ✅ **~100%** | ❌ **~0%** (UI qayta yoziladi) | ⚠️ ~0% UI, ✅ **100% API** |
| Ishlab chiqish | **~1 hafta** | **~2-3 oy** | **~2 hafta** |
| Yangi stack | ❌ yo'q | ✅ RN/Flutter + 2 platforma | ⚠️ bot framework |
| Do'kon (store) | ❌ kerak emas | ⚠️ Apple $99/yil + Google $25 + **ko'rib chiqish** | ❌ kerak emas |
| Yangilanish | ✅ **darhol** | ❌ do'kon ko'rib chiqishi (kunlar) | ✅ darhol |
| **Push bildirishnoma** | ⚠️ **iOS 16.4+ faqat "Bosh ekranga qo'shilgan"da** | ✅ to'liq | ✅ **to'liq, hamma joyda** |
| Offline | ✅ Service Worker | ✅ | ❌ |
| **O'rnatish ishqalanishi** | ⚠️ "Bosh ekranga qo'shish" — **ota-ona bilmaydi** | ⚠️ do'kondan qidirib topish | ✅ **YO'Q — Telegram allaqachon o'rnatilgan** |
| **Login ishqalanishi** | ⚠️ ID + parol | ⚠️ ID + parol | ✅ **bir marta, keyin hech qachon** |

### 13.3. 🔴 Telegram bot — eng katta qiymat/narx nisbati

**Nega O'zbekistonda aynan Telegram:**

⚠️ **Halol chegara — kanon 2-bo'lim: "Raqam to'qima".** Men "O'zbekistonda Telegram
foydalanuvchisi **X million**" deb yoza olmayman — **o'lchangan ma'lumotim yo'q**.

**Lekin quyidagilar — tekshiriladigan kuzatuvlar, raqam emas:**

- Telegram O'zbekistonda **de-fakto** kommunikatsiya kanali — davlat idoralari,
  maktablar, do'konlar **rasmiy kanal** sifatida ishlatadi
- Ota-ona telefonida Telegram **allaqachon o'rnatilgan va kuniga ochiladi**
- **Yangi ilova o'rnatish shart emas. Yangi parol eslab qolish shart emas.**

**Texnik afzallik — ishqalanish nolga yaqin:**

```
HOZIR:   brauzer → URL → ID terish → parol terish → 285 kB → ko'rish
                                                     ⬆️ har safar

BOT:     Telegram (allaqachon ochiq) → bildirishnoma keldi → o'qish
                                        ⬆️ hech nima terilmaydi
```

**Va eng muhimi — yo'nalish teskari (push, pull emas):**

Hozir ota-ona **eslab, o'zi kirishi** kerak. Bot **o'zi xabar beradi**:

```
📊 Ali Valiyev — 15-iyul
Matematika: 85/93 ball (Blok test)
✅ Davomat: keldi
⚠️ To'lov: 1 200 000 so'm — muddati 20-iyul
```

**Bu ota-ona kirmasa ham yetib boradi.** Web ilova buni **hech qachon** qila olmaydi
(push cheklovlari — 13.4).

**Texnik arxitektura — mavjud tizimga mos:**

```
Telegram → bot (webhook) → mavjud NestJS API
                            ⬆️ o'sha auth, o'sha RBAC, o'sha tenant izolyatsiyasi
```

- ✅ **Yangi backend YO'Q.** Bot — mavjud API ustidagi **yupqa qatlam**
- ✅ Kanon 8-bo'limdagi `notifications` moduli **allaqachon mavjud** — bot **yangi
  kanal**, yangi tizim emas
- ⚠️ **Bog'lash (linking):** Telegram `chat_id` ↔ `student_account_id` jadvali kerak.
  Bir martalik: ota-ona botga `mathacademy-MA-0001` + parolni **bir marta** yuboradi
  → `chat_id` bog'lanadi → **boshqa hech qachon login qilmaydi**
- ⚠️ **Bu YANGI modul** demakmi? Kanon 8: *"yangi qo'shma, mavjudini o'zgartirma"*.
  ⚠️ **Ochiq savol:** bot `notifications` moduli **ichida** kanal sifatida
  (`TELEGRAM` kanali) qo'shilsinmi, yoki alohida modul? **Kanon egasi hal qilsin.**

⚠️ **Xavfsizlik — jiddiy va ko'p qirrali:**

1. **`chat_id` — autentifikatsiya EMAS.** U — **identifikator**. Telefon o'g'irlansa,
   Telegram ochiq bo'lsa — **bola ma'lumoti ochiq**. Yechim: sezgir amallar
   (to'lov qilish) uchun **botda emas, web'da** tasdiqlash
2. ⚠️ **Bolalar ma'lumoti uchinchi tomon serverida.** Kanon 10: *"ayniqsa bolalar
   ma'lumoti: bu maktab, o'quvchilar voyaga yetmagan"*. Telegram xabarlari —
   **Telegram serverlarida** (Dubay/hech qayerda). O'quvchi ismi, bahosi, davomati
   **u yerdan o'tadi**. ⚠️ **YURIST SAVOLI** — O'zbekiston shaxsiy ma'lumotlar
   qonuni (lokalizatsiya talabi) buni **taqiqlaydimi**?
3. **Bot token** — sizib ketsa, **barcha ota-onalar bilan yozishuv** hujumchi qo'lida
4. **Ota-onani tekshirish** — botga kim yozayotgani noma'lum. Bog'lash paytida
   **parol** talab qilinishi shart

⚠️ **Bu 2-nuqta — bloklovchi bo'lishi mumkin.** Texnik yechim oson, **yuridik yechim
noma'lum**. Yurist tasdiqlamaguncha — **qurilmasin**.

### 13.4. 🟠 PWA — arzon, lekin push cheklangan

**Nega jozibali:** mavjud kod **~100%** qayta ishlatiladi. Kerakli:

1. `vite-plugin-pwa` (~1 kun)
2. `manifest.json` — ikonka, nom, `display: standalone` (⚠️ **ikonka — dizayn savoli**)
3. Service Worker — **static asset** keshi (⚠️ o'quvchi ma'lumotini **keshlamaslik** —
   qurilma bo'lishilishi mumkin)
4. Offline fallback sahifasi

**Foyda:**
- ✅ Ota-ona bosh ekraniga ikonka — **brauzer emas, "ilova"** kabi ochiladi
- ✅ Takroriy tashriflar **keshdan** — 285 kB **faqat birinchi marta**
- ✅ Do'kon **kerak emas**

⚠️ **Muammo — o'rnatish ishqalanishi.** *"Bosh ekranga qo'shish"* — ota-ona
**bilmaydi va qilmaydi**. Android'da brauzer taklif qiladi, **iOS Safari'da —
faqat qo'lda** (Share → Add to Home Screen). ⚠️ Bu **jimgina to'siq**: PWA qurilib,
**hech kim o'rnatmasligi** mumkin.

⚠️ **Push — asosiy cheklov.** iOS 16.4+ (2023 mart) Web Push'ni qo'llaydi, **lekin
faqat PWA bosh ekranga qo'shilgan bo'lsa**. Ya'ni:

```
iOS ota-ona → PWA'ni bosh ekranga qo'shmaydi → push YO'Q → bildirishnoma YO'Q
```

**Telegram bot bu muammoni umuman ko'rmaydi** — Telegram push **allaqachon ishlaydi**.

### 13.5. ⚪ Mobil ilova (React Native / Flutter) — hozir asossiz

**Nega yo'q:**
- **2-3 oy ish** — 12 guardian sahifasi **noldan** qayta yoziladi
- **Ikkita platforma** — iOS + Android, ikkita build, ikkita do'kon
- **Do'kon ko'rib chiqishi** — Apple **rad etishi** mumkin (*"bu shunchaki veb-sayt"* —
  Guideline 4.2 Minimum Functionality)
- **Yangilanish sekin** — bag tuzatilsa, do'kon **kunlar** kutadi
- **Yangi stack** — kanon 8: *"yangi qo'shma"*. RN/Flutter — **katta qo'shimcha**

**Qachon mantiqiy bo'ladi:**
- Push **kritik** bo'lsa **va** Telegram yuridik sabablarga ko'ra **mumkin bo'lmasa**
- Qurilma imkoniyatlari kerak bo'lsa: **kamera** (QR bilan davomat), **geolokatsiya**,
  **offline yozish** (yotoqxona nazoratchisi internetsiz davomat qo'ysa)
- ⚠️ Ikkinchisi — **xodim ilovasi**, ota-ona ilovasi emas. **Boshqa mahsulot.**

### 13.6. Tavsiya etilgan ketma-ketlik

```
1. 🔴 Guardian yo'lini tezlashtirish  (~2 kun)   — Recharts lazy (8.5) → ~285→190 kB
2. 🔴 Login ishqalanishini kamaytirish (~1 soat)  — autoComplete/autoCapitalize (7.5)
3. 🟠 PWA                              (~1 hafta) — arzon, mavjud kod, kesh foydasi
4. 🔴 Telegram bot — YURIST tasdig'idan keyin (~2 hafta) — ⬅️ ENG KATTA QIYMAT
5. ⚪ Mobil ilova — faqat 3 va 4 yetmasa
```

⚠️ **1 va 2 — bir necha kunlik ish, darhol qiymat beradi.** Ular **hech qanday
strategik qaror talab qilmaydi** va Telegram/PWA qarori qanday bo'lishidan qat'i
nazar **foydali**.

⚠️ **Bot va PWA — raqib emas, to'ldiruvchi:**

```
Telegram bot  → PUSH: "Ali bugun kelmadi" · "To'lov muddati ertaga"
                 ⬇️ (chuqurroq ko'rish uchun havola)
PWA/web       → PULL: to'liq baho tarixi, jadval, hujjatlar, to'lov qilish
```

Bot — **ogohlantiradi**. Web — **tafsilot beradi**. Bu ikkalasi **birga** ishlaydi.

---

## 14. Ochiq savollar

> ⚠️ **Bu bo'lim — hujjatning eng muhim qismi.** Quyidagilar **ataylab hal
> qilinmagan**. Dizayn savollari **muallif tomonidan** hal qilinadi.

### 14.1. 🎨 DIZAYN — bu hujjatda QAROR QILINMAGAN

**Bu hujjat dizaynga umuman tegmadi.** Barcha dizayn savollari — bu yerda:

| # | Savol | Nega texnik hujjat javob bera olmaydi |
|---|---|---|
| D1 | **Rang palitrasi** qanday? Hozirgi `--primary`, `--success`, `--warning` CSS o'zgaruvchilari saqlanadimi? | Brend qarori |
| D2 | **Shrift** — hozir `@fontsource/plus-jakarta-sans` (`package.json:16`). Saqlanadimi? ⚠️ **O'zbek lotin alifbosidagi `ʻ` (tutuq) belgisini to'g'ri ko'rsatadimi**? Kirill kerak bo'lsa? | Tipografika qarori. ⚠️ **Lekin `ʻ` ni tekshirish — texnik**: shrift qo'llamasa, `oʻquvchi` buziladi |
| D3 | **Qorong'i rejim** (`ThemeProvider`) — qoladimi? Ikki palitra = **ikki barobar kontrast tekshiruvi** (10.4) | Mahsulot qarori |
| D4 | **Guardian dizayni staff'dan farq qilsinmi?** Hozir ikkalasi bir xil tizim | UX qarori |
| D5 | **Guardian dashboard'da grafik kerakmi?** ⚠️ **Texnik oqibati katta**: Recharts = **98 kB gzip** = guardian yukining 35% (7.6). Oddiy raqam yetsa — SVG bilan **0 kB** | Dizayn qarori, **lekin narxi texnik** |
| D6 | **Bo'sh holat, skeleton, yuklash** ko'rinishi | Dizayn |
| D7 | **Har tenant o'z brendini** (logo, rang) sozlay oladimi? ⚠️ **Texnik oqibati:** CSS o'zgaruvchilar **runtime'da** almashishi kerak, build vaqtida emas | Mahsulot qarori |
| D8 | **`StatCard` trend `↑`/`↓`** — matnli muqobil qo'shilsa (10.3), vizual **o'zgarmaydi**. Ma'qulmi? | Dizayn tasdig'i |
| D9 | **`text-[10px]`** bottom nav'da (`GuardianLayout.tsx:232`) — ⚠️ WCAG kontrast talabi 10px da **qattiqroq** (10.4). O'lcham oshirilsinmi? | Dizayn + a11y kesishmasi |

⚠️ **D5 va D7 — texnik oqibati eng katta.** D5 — bundle. D7 — butun theming arxitekturasi.

### 14.2. ⚠️ Xavfsizlik — qaror kerak

| # | Savol | Ustuvorlik |
|---|---|---|
| S1 | **`ACCESS_TOKEN_TTL="15h"` → `"15m"`** — `.env.example:23`. Kod defaulti allaqachon `15m` (6.3). Bu **shunchaki tuzatiladimi**, yoki 15h ning **men bilmagan sababi** bormi? | 🔴 **Shoshilinch** |
| S2 | **Access token `localStorage`'dan xotiraga** ko'chirilsinmi? Narx: har yangilanishda ~200ms refresh (6.6) | 🟡 |
| S3 | **CSP header** qo'shilsinmi? XSS'ning **o'zini** qiyinlashtiradi — `localStorage` dan voz kechishdan **arzonroq** | 🟠 |
| S4 | **`permissions` localStorage'dan olib tashlansinmi** (6.5)? Tarmoq xatosida **fail-closed** bo'lsinmi? | 🟠 |
| S5 | ⚠️ **Sentry + bolalar ma'lumoti** (11.4) — self-hosted kerakmi? **YURIST SAVOLI** | 🔴 |
| S6 | `sameSite: 'none'` production'da (6.2) — frontend va API **bitta domenda** bo'ladimi? Bo'lsa `'lax'` afzal | 🟡 |

### 14.3. ⚠️ Arxitektura — qaror kerak

| # | Savol |
|---|---|
| A1 | **`useCrud` TanStack Query ustiga ko'chirilsinmi** (4.3)? Men **ha** deb tavsiya qilaman — 5 ta muammoni hal qiladi. **Lekin bu 21 sahifaga ta'sir qiladi** va **testsiz xavfli**. Testlardan **keyin** qilinsinmi? |
| A2 | **16 ta aralash sahifa** (`useCrud` + `useQuery` birga) — ular **bittaga** keltirilsinmi? Bu **48 sahifani ko'rib chiqish** demak — **katta ish** |
| A3 | **`Id` brand tipi** (5.5) — qo'shilsinmi? Foyda: BigInt bagi **imkonsiz** bo'ladi. Narx: 48 sahifaga tarqaladi |
| A4 | **`limit = 20` qattiq kodlangan** (2.4) — sozlanadigan qilinsinmi? |
| A5 | ⚠️ **Tenant slug'ida tire bo'lishi mumkinmi?** (12.2) `new-academy-MA-0001` → slug `new` bo'lib **login buziladi**. Bu **onboarding uchun bloklovchi**. Backend'da validatsiya bormi — **TEKSHIRILSIN** |
| A6 | **`framer-motion`, `date-fns`** va 6 ta ishlatilmaydigan paket (8.3) — olib tashlansinmi? ⚠️ Kanon Framer Motion'ni stack'da sanaydi — **kanon yangilanishi** kerak |
| A7 | **Kanon TypeScript 5.7 deydi, kod 5.8.3** (1.1) — kanon yangilansinmi? |
| A8 | ⚠️ **Fan roli bagi** (5.1) — kod tuzatishi aniq (`find(s => s.role === 'MAIN')`), lekin **backend `role` ni qaytarishi kerak**. Bu `groups.service.ts` **detail** javobini o'zgartiradi. **Kim egasi — `07-dtm` yoki frontend?** Muvofiqlashtirilsin |
| A9 | ⚠️ **Mavjud ballar buzilganmi?** (5.1.6) SQL so'rovi ishga tushirilsin. Natija bo'sh bo'lmasa — **qayta hisoblash migratsiyasi** kerak. ⚠️ **Bu real o'quvchilarning real ballari** — kim qaror qiladi? |
| A10 | ⚠️ **Blok test tafsiloti `teacher_comment` da JSON** (5.1.4) — bu **schema qarori**. `assessment_score_parts` jadvali kerakmi? **`07-dtm-assessment-engine.md` qamrovida**, lekin frontend **javob kutadi** |
| A11 | **Koeffitsiyentlar (`3.1/2.1/1.1`) backend'dan kelsinmi** (5.2)? Frontend ularni **bilmasligi** kerak. Lekin bu `assessments` API shartnomasini o'zgartiradi |

### 14.4. ⚠️ Mahsulot — qaror kerak

| # | Savol |
|---|---|
| P1 | ⚠️ **Telegram bot — yuridik jihatdan mumkinmi?** (13.3) Bolalar ma'lumoti Telegram serverlaridan o'tadi. **YURIST SAVOLI.** ⚠️ Javob "yo'q" bo'lsa — **eng katta qiymatli funksiya yopiladi** |
| P2 | **Bot `notifications` moduli ichidami yoki alohida modul?** Kanon 8: *"yangi qo'shma, mavjudini o'zgartirma"* — **kanon egasi hal qilsin** |
| P3 | **Rus tili qachon kerak bo'ladi?** (9.2) Hozir **hech kim so'ramagan**. i18n-ready (9.3a) **hozir** boshlansinmi? |
| P4 | **Ota-onalar qanday qurilmada kiradi?** ⚠️ **O'lchanmagan** — Android/iOS nisbati, ekran o'lchami, tarmoq tezligi **noma'lum**. **Analitika kerak** (⚠️ lekin bolalar ma'lumoti — S5 bilan bir xil savol) |
| P5 | **PWA — arziydimi**, agar ota-ona *"Bosh ekranga qo'shish"* ni bilmasa (13.4)? |
| P6 | **Bundle byudjeti** (8.5) — qaysi raqam? Hozirgi guardian yo'li **~285 kB gzip**. Maqsad? |

### 14.5. ⚠️ Bu hujjat javob bera olmagan savollar

**Halollik — nimani tekshirmaganimni aytish:**

| # | Savol | Nega tekshirilmadi |
|---|---|---|
| N1 | **Kontrast nisbatlari** (10.4) | Rang qarori — dizayn muhokamasidan **keyin** o'lchanadi |
| N2 | **`sonner` `aria-live` beradimi** (10.5) | Kutubxona ichi tekshirilmadi. ⚠️ **Bermasa — ko'rmaydigan foydalanuvchi xatolarni bilmaydi** |
| N3 | **Real qurilmada mobil test** (7.4) | Fizik qurilma yo'q. **360px** da sinov **kerak** |
| N4 | **Backend slug'ni katta-kichik harfga sezgir solishtiradimi** (7.5) | Backend qamrovi. ⚠️ Android `autoCapitalize` bagi **shunga bog'liq** |
| N5 | **`dangerouslySetInnerHTML` bormi** (6.3) | To'liq grep qilinmadi. XSS yuzasini baholash uchun **kerak** |
| N6 | **`document.title` route almashganda yangilanadimi** (10.5) | Tekshirilmadi |
| N7 | **Real 3G'da yuklash vaqti** (7.6) | **Hisoblangan**, o'lchanmagan. Lighthouse throttling bilan **o'lchansin** |
| N8 | **`date-fns` bundle'ga tushadimi** (8.3) | `react-day-picker` peer dependency'si — **tekshirilsin** |
| N9 | **`<div onClick>` ning to'liq ro'yxati** (10.3) | `StatCard` topildi, **to'liq audit qilinmadi** |
| N10 | **Lucide ikonkalari `aria-hidden` qo'shadimi** (10.2) | Tekshirilmadi |

---

## 15. Xulosa — frontend holati

### 15.1. Umumiy baho

**Bu kod — o'ylab yozilgan.** Kutilganidan **yaxshiroq**:

| ✅ To'g'ri qilingan | Tasdiq |
|---|---|
| **`useCrud` poydevori** | 21 sahifani **1 ta xato joyiga** siqadi (2.3) |
| **Code splitting to'liq** | **48/48** sahifa lazy, login **ataylab emas** (8.1) |
| **BigInt intizomi** | **0 ta** ID koersiyasi — grep bilan tasdiqlangan (5.4) |
| **Refresh cookie `httpOnly`** | `auth.service.ts:114-115` (6.2) |
| **Refresh navbat bilan** | Parallel refresh **oldi olingan** (6.4) |
| **Markazlashgan xato ishlash** | Status bo'yicha to'g'ri, 500 tafsiloti **yashiriladi** (11.1) |
| **Guardian mobil layout** | Bottom nav, drawer, `pb-20 lg:pb-6` (7.2) |
| **Radix a11y poydevori** | 26 paket — modal/select/tabs **tayyor** (10.1) |
| **CSS animatsiya, JS emas** | Framer Motion **ishlatilmagan** — bu **yaxshi** (8.3) |
| **Test infratuzilmasi** | Vitest + RTL + jsdom + `@` alias — **tayyor** (12.1) |

### 15.2. Uchta eng shoshilinch ish

| # | Ish | Narx | Nega |
|---|---|---|---|
| 🔴 **0** | **Fan roli bagi** (5.1) — `AssessmentsPage.tsx:187` | ⚠️ **kod: ~2 soat, ma'lumot auditi: noma'lum** | ⚠️ **Real o'quvchilarga noto'g'ri ball qo'yadi.** Jimgina. Bu ro'yxatdagi **yagona** foydalanuvchi ma'lumotini **buzayotgan** bag |
| 🔴 **1** | **`ACCESS_TOKEN_TTL="15m"`** (`.env.example:23`) | **1 daqiqa** | Xavf oynasini **60×** kichraytiradi. Refresh oqimi **allaqachon ishlaydi** — foydalanuvchi **sezmaydi** |
| 🔴 **2** | **Error Boundary** (11.2) | **~2 soat** | Hozir render qulashi = **oq ekran**. Testlar **yo'q** → regressiyani **foydalanuvchi topadi** |
| 🔴 **3** | **`npm run typecheck` + CI** (12.4) | **~1 soat** | Vite tiplarni **tekshirmaydi** — hozir tip xatosi bilan **build o'tadi**. **25 489 qatorni** qamraydi |

**1-3 — bir kunlik ish.** Uchalasi ham **katta xavfni** yopadi.

⚠️ **0-band boshqacha — u shoshilinchdan ham yuqori.** Qolgan uchtasi **kelajakdagi**
xavfni yopadi. **0-band esa hozir, har kuni, real o'quvchi ballarini buzmoqda** —
va hech kim buni bilmaydi, chunki xato **barqaror** (5.1.3).

⚠️ **Va uning kod tuzatishi yolg'iz yetarli emas** — mavjud ma'lumot auditi kerak
(5.1.6). **Bu `07-dtm-assessment-engine.md` bilan muvofiqlashtirilsin.**

### 15.3. Uchta eng katta bo'shliq

| # | Bo'shliq | Ta'sir |
|---|---|---|
| **1** | ⚠️ **Frontend backend'ga savol bermaydi, taxmin qiladi** (5) | **Fan roli indeksdan** → noto'g'ri ball. **189 qoidasi UI'da** → API majburlamaydi. **Domen bilimi `apps/web` da yashaydi** — har yangi klient uni qayta ixtiro qiladi |
| **2** | **Testlar — amalda nol** | `useCrud` (21 sahifa), `DataTable` (48 sahifa) **himoyasiz**. Har refactor — **qo'lda tekshirish**. ⚠️ **1-bo'shliq aynan shuning uchun topilmagan edi** |
| **3** | **Ikki xil data-fetching** (4.2) | **16 sahifa** ikkalasini birga ishlatadi → kesh **eskiradi**, StatCard **noto'g'ri raqam** ko'rsatadi |
| **4** | **a11y — 77 nomsiz tugma** (10.2) | Radix poydevori **yaxshi**, lekin `aria-label` **1 ta**. Screen reader'da **tahrirlash va o'chirish farqsiz** |

### 15.4. Yakuniy izoh

Kanon 1-bo'lim: *"Loyiha **allaqachon ishlaydi**. TZ maqsadi — … **yetuklashtirish**."*

**Frontend uchun bu aniq to'g'ri.** Bu hujjat **hech qanday qayta yozishni**
taklif qilmadi. Barcha tavsiyalar — **qo'shimcha** yoki **mavjudni mustahkamlash**:

- `useCrud` — **saqlanadi**, ichi almashtiriladi (21 sahifa **tegilmaydi**)
- `DataTable`, `SlideOver`, `StatCard`, `StatusBadge` — **saqlanadi**, aniq baglar tuzatiladi
- Radix + shadcn — **saqlanadi**, `aria-label` qo'shiladi
- Code splitting — **allaqachon bor**, Recharts ajratiladi
- BigInt — **allaqachon toza**, tip bilan **qulflanadi**

⚠️ **Eng katta xavf — texnik emas.** Bu **48 sahifa, 25 489 qator, 1 ta placeholder
test.** Har o'zgarish — **ko'z bilan tekshirish**. Kanon 6-bo'lim buni *"845 ta
so'rovning to'g'riligi faqat ko'z bilan tekshirilgan"* deb backend uchun aytadi.
**Frontend'da ham xuddi shunday.**

**Testlarsiz bu hujjatdagi hech bir tavsiya xavfsiz bajarilmaydi.**
Shuning uchun 12-bo'lim — **birinchi**, qolganlari **keyin**.

---

## 16. Havolalar

**Frontend fayllar (bu hujjatda tahlil qilingan):**

| Fayl | Qator | Bo'lim |
|---|---|---|
| `apps/web/src/hooks/useCrud.ts` | 94 | **2** |
| `apps/web/src/lib/api.ts` | 156 | **6.4**, **11.1** |
| `apps/web/src/lib/auth.tsx` | 182 | **6** |
| `apps/web/src/lib/utils.ts` | 6 | 1.2 |
| `apps/web/src/App.tsx` | 153 | **4.1**, **8.1** |
| `apps/web/src/components/shared/DataTable.tsx` | 163 | **3.1** |
| `apps/web/src/components/shared/SlideOver.tsx` | 46 | **3.2** |
| `apps/web/src/components/shared/StatCard.tsx` | 52 | **3.3**, **10.3** |
| `apps/web/src/components/shared/StatusBadge.tsx` | 52 | **3.4** |
| `apps/web/src/components/ui/table.tsx` | — | **7.3** |
| `apps/web/src/components/layout/GuardianLayout.tsx` | 261 | **7.2** |
| `apps/web/src/pages/guardian/GuardianLogin.tsx` | 112 | **7.5** |
| `apps/web/src/pages/staff/SimpleCrudPage.tsx` | 65 | **2**, **10.2** |
| `apps/web/src/pages/staff/AssessmentsPage.tsx` | **72, 185-189, 211-222, 278-284, 500-503, 710** | ⚠️ **5.1**, **5.2** |
| `apps/web/src/pages/staff/TracksPage.tsx` | 52, 58, 423 | **5.1.2** (rolni **to'g'ri** o'qiydi) |
| `apps/web/src/test/example.test.ts` | 7 | **12.1** |
| `apps/web/vite.config.ts` | 20 | **8.4** |
| `apps/web/vitest.config.ts` | 16 | **12.1** |
| `apps/web/package.json` | 93 | **1.1**, **8.3** |

**Backend fayllar (tasdiqlash uchun o'qilgan):**

| Fayl | Qator | Bo'lim |
|---|---|---|
| `apps/api/src/modules/auth/auth.service.ts` | 101-125, 89, 316 | **6.2**, **6.3** |
| `apps/api/src/common/config/env.validation.ts` | 54 | **6.3** |
| `apps/api/src/modules/auth/auth.module.ts` | 21 | **6.3** |
| `apps/api/.env.example` | 23 | **6.3** ⚠️ |
| `apps/api/src/modules/groups/groups.service.ts` | **181-184** (`orderBy: { subject_id: 'asc' }`) | ⚠️ **5.1.3** |
| `apps/api/prisma/schema.prisma` | `group_subjects` (rol/tartib **yo'q**), `track_subjects.role`, `SubjectRole`, `assessment_scores.teacher_comment` | ⚠️ **5.1.2**, **5.1.4** |

**Aloqador hujjatlar:**

- **`docs/07-dtm-assessment-engine.md`** — ⚠️ **DTM 189 ball mantiqi, `assessments` domen qatlami, ball tuzilmasi va ma'lumot migratsiyasi.** 5.1 va 5.2-bo'limlar **shu hujjatga tayanadi** va uni **takrorlamaydi**
- `docs/00-vision-and-market.md` — vizyon va bozor
- [`CANON.md`](./CANON.md) — **kanon** (5.5: frontend; 5.2: BigInt; **4.1: DTM 189 ball**; 4.2: guardian login; 10: nimalar yozilmaydi)

---

> **Hujjat oxiri.** Dizayn savollari — **14.1**. Ular **ataylab** javobsiz.
