# 06 — Autentifikatsiya va RBAC

> Bu hujjat MathAcademy'ning **kim tizimga kiradi** (autentifikatsiya) va **kim nimaga
> ruxsatli** (avtorizatsiya) qatlamlarini tavsiflaydi. Har bir xavfsizlik da'vosi
> mavjud kod bilan tasdiqlangan — fayl va qator ko'rsatilgan. Faraz qilinmagan.
>
> **Kontekst:** bu demo emas. Tizim real akademiyada, real xodimlar va real ota-onalar
> tomonidan har kuni ishlatiladi. Ma'lumot — voyaga yetmagan o'quvchilar haqida.
> Shu sababli quyidagi topilmalarning bir nechtasi "keyinroq tuzatamiz" toifasiga
> kirmaydi.

---

## Mundarija

1. [Autentifikatsiya oqimi](#1-autentifikatsiya-oqimi)
2. [⚠️ ZIDDIYAT — access token TTL](#2-ziddiyat--access-token-ttl)
3. [Refresh token rotatsiyasi](#3-refresh-token-rotatsiyasi)
4. [Sessiyalar](#4-sessiyalar)
5. [Brute-force himoyasi](#5-brute-force-himoyasi)
6. [Guardian autentifikatsiyasi](#6-guardian-autentifikatsiyasi)
7. [RBAC — permission-based](#7-rbac--permission-based-role-based-emas)
8. [⚠️ Resource-level authorization](#8-resource-level-authorization--eng-muhim-savol)
9. [Rollar va ruxsat to'plamlari](#9-rollar-va-ruxsat-toplamlari)
10. [⚠️ Superadmin va cross-tenant](#10-superadmin-va-cross-tenant)
11. [Parol siyosati](#11-parol-siyosati)
12. [Audit log](#12-audit-log)
13. [Yetishmayotgan narsalar](#13-yetishmayotgan-narsalar)
14. [Ochiq savollar](#14-ochiq-savollar)

---

## 0. Xulosa — nima topildi

Tekshiruv natijasi. Har bir qator quyida kod bilan isbotlangan.

### Yaxshi qilingan narsalar (avval — chunki ular ko'p)

Tanqid uchun tanqid qilinmaydi. Quyidagilar **to'g'ri** va o'zgartirilmaydi:

| Nima | Nega to'g'ri | Isbot |
|---|---|---|
| **RBAC izchil qo'llangan** | `@RequirePermissions` — **234 ta** joyda. `PermissionsGuard` ostida ruxsat e'lon qilmagan **bitta ham route yo'q**. RBAC dekorativ emas | grep: 234 |
| Refresh token — JWT emas, `randomBytes(48)` | Ichida ma'lumot yo'q, DB'da bekor qilinadi | `auth.service.ts:319` |
| Refresh token DB'da SHA-256 xesh holida | DB oqsa, tokenlar tiklanmaydi | `auth.service.ts:40-42` |
| Cookie `httpOnly` + `path: '/api/auth/refresh'` | XSS o'qiy olmaydi; cookie 100+ endpoint'ga umuman bormaydi | `auth.service.ts:114-119` |
| STAFF va GUARDIAN — alohida jadvallar | Ota-onaga xodim huquqini berish **strukturaviy imkonsiz** | `auth.service.ts:25` |
| **Brute-force — PostgreSQL'da, Redis'da emas** | Lock restart'dan omon qoladi va instance'lar orasida to'g'ri ishlaydi. Ko'p loyiha buni Redis'ga qo'yib, restart'da barcha lock'ni yo'qotadi | `auth.service.ts:187, 269, 297` |
| Refresh'da rol/ruxsat DB'dan qayta o'qiladi | Eski token'dan ko'chirilmaydi | `auth.service.ts:664-666` |
| Parol o'zgarganda barcha sessiyalar bekor qilinadi | To'g'ri refleks | `auth.service.ts:1058-1061` |

### Topilgan muammolar

| # | Topilma | Jiddiylik | Fayl |
|---|---|---|---|
| 1 | ~~`.env.example` da `ACCESS_TOKEN_TTL="15h"`~~ — **TUZATILDI** (`15m`) | ✅ Yopilgan | `.env.example:22` |
| 2 | `auth.module.ts:21` da `expiresIn: '15m'` hardkod — TTL uchun **ikkinchi manba**, ishlatilmaydi | 🟡 Past | `auth.module.ts:21` |
| 3 | `ACCESS_TOKEN_TTL` formati validatsiya qilinmaydi (`@IsString()`), `as any` TypeScript'ni o'chiradi | 🟠 O'rta | `env.validation.ts:54`, `auth.service.ts:316` |
| 4 | Login'da berilgan access token'da `sessionId` yo'q → **logout access token'ni bekor qilmaydi** | 🔴 Kritik | `auth.service.ts:473-479`, `jwt-request.util.ts:72-80` |
| 5 | Refresh token rotatsiya qilinadi, lekin **reuse detection yo'q** | 🟠 O'rta | `auth.service.ts:696-708` |
| 6 | Refresh'da `expires_at` har safar +30 kun → **cheksiz sessiya** | 🟠 O'rta | `auth.service.ts:702` |
| 7 | `MAX_SESSIONS_PER_USER`, `SESSION_INACTIVITY_TIMEOUT` — **o'lik konfiguratsiya** | 🟠 O'rta | `.env.example:45-46` |
| 8 | **Redis umuman ishlatilmaydi** — `.env.example` mavjud bo'lmagan infratuzilmani va'da qiladi | 🟠 O'rta | `.env.example:38-40`, `auth.module.ts:11` |
| 9 | Ruxsat keshi **in-memory** → ikkinchi instance'da bekor qilingan ruxsat 5 daqiqa yashaydi | 🟠 O'rta (bugun) 🔴 (masshtablansa) | `auth.module.ts:11`, `auth.service.ts:397` |
| 10 | Lock faqat `username` bo'yicha, IP o'lchovi yo'q → **account lockout DoS** | 🔴 Yuqori | `auth.service.ts:226-290` |
| 11 | Rate limiting umuman yo'q, `RATE_LIMIT_*` — o'lik config | 🔴 Yuqori | grep: 0 natija |
| 12 | `X-Forwarded-For` shartsiz ishoniladi → IP spoofing | 🔴 Yuqori | `auth.service.ts:130-137` |
| 13 | **Tenant slug'da tire → o'sha akademiyaning BIRORTA ota-onasi kira olmaydi** | 🔴 Kritik (vizyonni to'sadi) | `create-tenant.dto.ts:24`, `auth.service.ts:62-72` |
| 14 | Login xato xabari tenant mavjudligini oshkor qiladi (`TENANT_NOT_FOUND`) | 🟡 Past | `auth.service.ts:144` |
| 15 | **Resource-level authorization yo'q — va hozirgi sxemada majburlab BO'LMAYDI** | 🔴 Kritik | `schema.prisma`, `assessments.service.ts:48-61, 417-466` |
| 16 | `permissions` jadvali global (tenant_id yo'q) → tenant chegarasidan chiqadi | 🟠 O'rta | `schema.prisma:720-725` |
| 17 | `MIN_PASSWORD_LENGTH=6`, `PASSWORD_COMPLEXITY=true` — **o'lik config**, kodda hardkod `< 6` | 🔴 Yuqori | `auth.service.ts:910, 1031` |
| 18 | **O'quvchi paroli `Math.random()` bilan** — CSPRNG emas, bashorat qilinadi | 🔴 Yuqori | `students.service.ts:37-47`, `auth.service.ts:1478-1486` |
| 19 | O'quvchi ID formati **uch xil** — seed `MA-0001`, real kod `000123`, DTO uchinchisi | 🟠 O'rta | `students.service.ts:48-50`, `seed.ts:622`, `guardian-login.dto.ts:16-25` |
| 20 | `audit_logs` — **faqat yoziladi, o'qish API'si yo'q** | 🟠 O'rta | grep: 0 ta controller |
| 21 | Baho o'zgarishida `beforeData` yozilmaydi → "90 dan 40 ga kim tushirdi" javobsiz | 🟠 O'rta | `assessments.service.ts:498-516` |
| 22 | `auth_sessions`/`auth_attempts` da index yo'q — full scan | 🟡 Past | `schema.prisma:122-161` |

### Umumiy mavzu — `.env.example` noto'g'ri hujjat

Bu hujjatda takrorlanadigan naqsh. `.env.example` — bu **hujjat**: yangi dasturchi
tizim nima qila oladi deb undan o'qiydi. Hozir u **yolg'on gapiradi**:

| `.env.example` va'dasi | Haqiqat |
|---|---|
| `REDIS_HOST/PORT/PASSWORD` | Kod Redis'ga **umuman ulanmaydi** |
| `RATE_LIMIT_TTL/MAX` | Rate limiting **yo'q** |
| `MAX_SESSIONS_PER_USER=10` | Chegara **majburlanmaydi** |
| `SESSION_INACTIVITY_TIMEOUT` | Timeout **yo'q** |
| `MIN_PASSWORD_LENGTH=6` | Kodda hardkod `< 6`, env **o'qilmaydi** |
| `PASSWORD_COMPLEXITY=true` | Complexity tekshiruvi **yo'q** |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | `NODE_ENV` dan xulosa qilinadi, env **o'qilmaydi** |
| `JWT_REFRESH_SECRET` | Refresh token JWT emas — sir **ishlatilmaydi** (lekin majburiy) |

Sakkiztadan bittasi ham ishlamaydi. Yangi dasturchi Redis ko'taradi, ulaydi va u
**hech narsa qilmaydi**. Kanon 5.1 dagi `tenant.util.ts` bilan bir xil kasallik:
**himoyaga o'xshagan o'lik narsa — himoyasizlikdan yomonroq**, chunki u tekshirishni
to'xtatadi.

**Qoida bo'lishi kerak:** `.env.example` dagi har bir o'zgaruvchi yo kodda o'qilsin,
yo o'chirilsin. Uchinchi variant yo'q. Buni CI'da tekshirish mumkin (13-bo'lim).

---

## 1. Autentifikatsiya oqimi

### 1.1. Umumiy tasvir

Tizimda **ikki xil hisob turi** bor va ular butunlay alohida jadvallarda yashaydi:

| Tur | Jadval | Login identifikatori | Kim ishlatadi |
|---|---|---|---|
| `STAFF` | `users` | `username` + `tenantSlug` | Xodimlar (admin, o'qituvchi) |
| `GUARDIAN` | `student_accounts` | `<tenant-slug>-<student-login-id>` | Ota-onalar |

Bu ajratish `auth.service.ts:25` da tip darajasida qat'iylashtirilgan:

```ts
// apps/api/src/modules/auth/auth.service.ts:25
type AccountType = 'STAFF' | 'GUARDIAN';
```

Bu **to'g'ri qaror**. Ota-ona va xodim bir jadvalda bo'lganida, "faqat xodimlar"
tekshiruvini bir joyda unutish ota-onaga xodim endpoint'ini ochib berardi. Alohida
jadval — bu xatoni **strukturaviy imkonsiz** qiladi (ota-onaning `users.id` si yo'q,
demak `user_roles` ga bog'lana olmaydi).

### 1.2. Token modeli

Ikki token ishlatiladi va ular **tabiatan har xil**:

```ts
// apps/api/src/modules/auth/auth.service.ts:308-324
private async issueTokens(payload: Record<string, any>): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}> {
  const accessToken = await this.jwt.signAsync(payload, {
    secret: requireEnv('JWT_ACCESS_SECRET'),
    expiresIn: this.accessTtl() as any,
  });

  const refreshToken = randomBytes(48).toString('hex');
  const refreshTokenHash = sha256Hex(refreshToken);
  const refreshExpiresAt = addDays(now(), this.refreshDays());

  return { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt };
}
```

**Diqqat qilingan detallar (to'g'ri qilingan):**

1. **Access token — JWT (stateless).** Ichida `tenantId`, `type`, `userId`, `roles`,
   `permissions` bor. Har so'rovda DB'ga bormaslik uchun.
2. **Refresh token — JWT EMAS.** `randomBytes(48)` — 48 bayt (384 bit) tasodifiy
   qiymat. Bu **muhim**: refresh token'da hech qanday ma'lumot yo'q, u shunchaki
   DB'dagi qatorga ko'rsatkich. Demak uni "o'qib" ma'lumot olib bo'lmaydi va uni
   bekor qilish — DB'dagi bitta qatorni o'zgartirish.
3. **Refresh token DB'da xesh holida saqlanadi.** `sha256Hex(refreshToken)` —
   `auth.service.ts:40-42`. DB o'g'irlansa, refresh tokenlar tiklanmaydi.

   ```ts
   // apps/api/src/modules/auth/auth.service.ts:40-42
   function sha256Hex(v: string): string {
     return createHash('sha256').update(v).digest('hex');
   }
   ```

   > **Nega bcrypt emas, SHA-256?** To'g'ri qaror. Refresh token — 384 bit tasodifiy
   > qiymat, unda "zaif parol" tushunchasi yo'q. Bcrypt'ning sekinligi lug'at
   > hujumiga qarshi; 384-bit entropiyaga lug'at hujumi qo'llanilmaydi. SHA-256
   > yetarli va tez.

4. **Access va refresh secret'lari alohida.** `.env.example:19-21` da bu aniq
   izohlangan:

   ```
   # Access and refresh secrets MUST differ — otherwise an access token can be
   # replayed as a refresh token.
   JWT_ACCESS_SECRET="jwt_access"
   JWT_REFRESH_SECRET="jwt_secret"
   ```

   ⚠️ **Lekin:** `JWT_REFRESH_SECRET` amalda **hech qayerda ishlatilmaydi** —
   refresh token JWT emas, `randomBytes`. Ya'ni bu env o'zgaruvchi ham o'lik.
   Zararli emas, lekin `env.validation.ts:50-51` uni **majburiy** qiladi:

   ```ts
   // apps/api/src/common/config/env.validation.ts:50-51
   @IsString()
   JWT_REFRESH_SECRET: string;
   ```

   Ya'ni ishlatilmaydigan sir majburiy talab qilinadi. Buni yo ishlatish, yo
   olib tashlash kerak — bu "himoyaga o'xshagan o'lik kod" toifasi.

### 1.3. Staff login — to'liq oqim

```ts
// apps/api/src/modules/auth/auth.service.ts:403-506 (qisqartirilgan)
async staffLogin(dto: StaffLoginDto, req: Request, res: Response) {
  const tenantSlug = String(dto.tenantSlug || '').trim();
  const tenantId = await this.getTenantIdBySlugOrThrow(tenantSlug);   // 1

  const username = String(dto.username || '').trim();
  if (!username) throw new UnauthorizedException('INVALID_CREDENTIALS');

  await this.ensureNotLocked(tenantId, 'STAFF', username);            // 2

  const user = await this.prisma.users.findFirst({
    where: { tenant_id: tenantId, username },                         // 3
    select: { id: true, password_hash: true, is_active: true,
              full_name: true, username: true },
  });

  if (!user || !user.is_active) {
    await this.logAttempt(tenantId, 'STAFF', username, false, req);   // 4
    await this.maybeLock(tenantId, 'STAFF', username, req);
    throw new UnauthorizedException('INVALID_CREDENTIALS');
  }

  const passwordMatch = await bcrypt.compare(String(dto.password), user.password_hash);
  if (!passwordMatch) {
    await this.logAttempt(tenantId, 'STAFF', username, false, req);
    await this.maybeLock(tenantId, 'STAFF', username, req);
    throw new UnauthorizedException('INVALID_CREDENTIALS');
  }

  await this.logAttempt(tenantId, 'STAFF', username, true, req);      // 5
  await this.clearLock(tenantId, 'STAFF', username);

  await this.auditLog({ tenantId, actorType: 'STAFF', actorUserId: user.id,
                        action: 'LOGIN', entityType: 'users', entityId: user.id,
                        ipAddress: ip || undefined });                 // 6

  const { roles, permissions } = await this.getStaffRolesPermissions(user.id);  // 7

  const payload = {
    tenantId: tenantId.toString(),
    type: 'STAFF',
    userId: user.id.toString(),
    roles,
    permissions,
  };                                                                   // 8

  const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
    await this.issueTokens(payload);

  await this.createSession({ tenantId, accountType: 'STAFF', userId: user.id,
                             studentAccountId: null, refreshTokenHash,
                             refreshExpiresAt, req });                 // 9

  this.setRefreshCookie(res, refreshToken, refreshExpiresAt);          // 10

  return { accessToken, staff: {...}, roles, permissions, tenantId: tenantId.toString() };
}
```

**Qadamlar:**

1. `tenantSlug` → `tenant_id`. **Tenant slug'dan aniqlanadi va JWT'ga yoziladi.**
   Bundan keyin tenant hech qachon mijozdan olinmaydi (03-multi-tenancy).
2. Lock tekshiruvi — **parolni tekshirishdan oldin**. To'g'ri tartib.
3. `findFirst({ tenant_id, username })` — foydalanuvchi **tenant ichida** izlanadi.
   `users.username` global unique emas: `mathacademy` dagi `admin` va `boshqa-akademiya`
   dagi `admin` — ikki xil odam.
4. Muvaffaqiyatsiz urinish qayd qilinadi va lock hisoblanadi.
5. Muvaffaqiyatda lock tozalanadi.
6. Audit log.
7. Rol/ruxsatlar Redis cache'dan yoki DB'dan olinadi.
8. **⚠️ Bu payload'da `sessionId` YO'Q.** Bu 2-bo'limdagi eng jiddiy topilmaning
   ildizi — pastda batafsil.
9. Sessiya yozuvi yaratiladi.
10. Refresh token cookie'ga yoziladi.

### 1.4. Timing attack — mavjud kamchilik

`auth.service.ts:434-448` da:

```ts
if (!user || !user.is_active) {
  await this.logAttempt(...);
  await this.maybeLock(...);
  throw new UnauthorizedException('INVALID_CREDENTIALS');
}

const passwordMatch = await bcrypt.compare(String(dto.password), user.password_hash);
```

Foydalanuvchi topilmasa — `bcrypt.compare` **umuman chaqirilmaydi**. Bcrypt cost 12 —
bu ~250-400ms. Ya'ni:

- Mavjud username → javob ~300ms
- Mavjud bo'lmagan username → javob ~10ms

Hujumchi **javob vaqtiga qarab** qaysi username mavjudligini aniqlaydi. Xato xabari
bir xil (`INVALID_CREDENTIALS`) bo'lsa ham, **vaqt oshkor qiladi**.

**Yechim** — foydalanuvchi topilmasa ham dummy hash bilan taqqoslash:

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

/**
 * Constant-time login: a bcrypt comparison always runs, whether or not the
 * user exists. Without this, response latency (~300ms with hash vs ~10ms
 * without) tells an attacker which usernames are real.
 *
 * The dummy hash is generated once at boot from a random value — it can never
 * match a real password.
 */
private readonly dummyHash: string = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  Number(process.env.BCRYPT_ROUNDS || '12'),
);

private async verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  // Always burn the same CPU, even for a non-existent user.
  const ok = await bcrypt.compare(plain, hash || this.dummyHash);
  return hash ? ok : false;
}
```

Va login'da:

```ts
const user = await this.prisma.users.findFirst({ where: { tenant_id: tenantId, username }, ... });

const passwordMatch = await this.verifyPassword(String(dto.password), user?.password_hash);

if (!user || !user.is_active || !passwordMatch) {
  await this.logAttempt(tenantId, 'STAFF', username, false, req);
  await this.maybeLock(tenantId, 'STAFF', username, req);
  throw new UnauthorizedException('INVALID_CREDENTIALS');
}
```

Endi ikkala yo'l ham bir xil vaqt sarflaydi va bitta joyda `INVALID_CREDENTIALS`
qaytariladi.

### 1.5. Cookie sozlamalari

```ts
// apps/api/src/modules/auth/auth.service.ts:101-120
private cookieOptions(): { sameSite: 'none' | 'lax'; secure: boolean } {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  };
}

private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(this.cookieName(), token, {
    httpOnly: true,
    ...this.cookieOptions(),
    path: '/api/auth/refresh',
    expires: expiresAt,
  });
}
```

**To'g'ri qilingan:**

- `httpOnly: true` — JavaScript cookie'ni o'qiy olmaydi. XSS bo'lsa ham refresh
  token o'g'irlanmaydi.
- `path: '/api/auth/refresh'` — **juda yaxshi detal.** Cookie faqat refresh
  endpoint'iga yuboriladi. Boshqa 100+ endpoint'ga u umuman bormaydi. Bu CSRF
  yuzasini keskin kichraytiradi va tasodifiy log'ga tushishini kamaytiradi.
- `secure: isProd` — productionda faqat HTTPS.

**⚠️ Muammo — `sameSite: 'none'` productionda:**

`sameSite: 'none'` degani cookie **har qanday** saytdan yuborilgan so'rovga
qo'shiladi. Bu cross-origin deploy (API `api.example.uz`, web `app.example.uz`)
uchun kerak bo'lishi mumkin, lekin CSRF himoyasini o'chiradi.

Bu yerda `path` cheklovi qutqaradi: `sameSite: 'none'` bo'lsa ham, cookie faqat
`/api/auth/refresh` ga boradi. Hujumchi sayt `POST /api/auth/refresh` ni chaqira
oladi va yangi access token generatsiya qilinadi — **lekin javobni o'qiy olmaydi**
(CORS to'sadi). Ya'ni amaliy zarar: refresh token rotatsiya bo'lib ketadi
(foydalanuvchi sessiyasi buziladi) — DoS, lekin ma'lumot o'g'irligi emas.

**Tavsiya:**

```ts
/**
 * SameSite policy.
 *
 * 'none' is only correct when the SPA and the API live on different
 * registrable domains. When they share one (api.example.uz + app.example.uz
 * under example.uz), 'lax' is both sufficient and strictly safer, because it
 * stops a third-party page from triggering refresh-token rotation at all.
 *
 * Driven by COOKIE_SAME_SITE so a deployment can pick the right one instead of
 * inferring it from NODE_ENV.
 */
private cookieOptions(): {
  sameSite: 'none' | 'lax' | 'strict';
  secure: boolean;
  domain?: string;
} {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAME_SITE || (isProd ? 'lax' : 'lax')) as
    | 'none'
    | 'lax'
    | 'strict';

  // SameSite=None is invalid without Secure — browsers drop the cookie.
  if (sameSite === 'none' && !isProd) {
    throw new InternalServerErrorException('COOKIE_SAME_SITE_NONE_REQUIRES_SECURE');
  }

  return {
    sameSite,
    secure: isProd,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}
```

> `.env.example:30-31` da `COOKIE_SECURE="false"` va `COOKIE_SAME_SITE="lax"` bor —
> **lekin kod ularni o'qimaydi**, `NODE_ENV` dan xulosa qiladi. Yana o'lik config.
> Bu hujjatda takrorlanadigan naqsh: `.env.example` "biz buni sozlashimiz mumkin"
> deb va'da beradi, kod esa uni ko'rmaydi.

### 1.6. Access token qanday tekshiriladi

```ts
// apps/api/src/common/auth/jwt-request.util.ts:52-91
export async function ensureUser(
  req: Request,
  jwt: JwtService,
  prisma?: PrismaService,
): Promise<RequestUser> {
  const existing = (req as any).user as RequestUser | undefined;
  if (existing) return existing;

  const token = extractAccessToken(req);
  if (!token) throw new UnauthorizedException('NO_ACCESS_TOKEN');

  const secret = String(process.env.JWT_ACCESS_SECRET || '').trim();
  if (!secret) throw new InternalServerErrorException('JWT_ACCESS_SECRET_MISSING');

  try {
    const payload = await jwt.verifyAsync<RequestUser>(token, { secret });

    if (!payload?.type) throw new UnauthorizedException('INVALID_ACCESS_TOKEN');

    if (prisma && payload.sessionId) {            // ⚠️ SHARTLI
      const sid = safeBigIntFromDigits(payload.sessionId);
      if (!sid) throw new UnauthorizedException('INVALID_ACCESS_TOKEN');

      const session = await prisma.auth_sessions.findFirst({
        where: { id: sid, revoked_at: null, expires_at: { gt: new Date() } },
      });
      if (!session) throw new UnauthorizedException('SESSION_REVOKED');
    }

    (req as any).user = payload;
    return payload;
  } catch (e: any) {
    const name = String(e?.name || '');
    if (name === 'TokenExpiredError') {
      throw new UnauthorizedException('ACCESS_TOKEN_EXPIRED');
    }
    throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
  }
}
```

🔴 **KRITIK TOPILMA — logout access token'ni bekor qilmaydi.**

Sessiya bekor qilinganini tekshirish `if (prisma && payload.sessionId)` shartiga
bog'langan. Endi payload'larga qarang:

| Token qayerda beriladi | `sessionId` bormi? | Fayl:qator |
|---|---|---|
| `staffLogin` | ❌ **YO'Q** | `auth.service.ts:473-479` |
| `guardianLogin` | ❌ **YO'Q** | `auth.service.ts:592-597` |
| `staffChangePassword` | ❌ **YO'Q** | `auth.service.ts:1080-1086` |
| `guardianChangePassword` | ❌ **YO'Q** | `auth.service.ts:956-961` |
| `refresh` (STAFF) | ✅ bor | `auth.service.ts:667-674` |
| `refresh` (GUARDIAN) | ✅ bor | `auth.service.ts:687-693` |

Ya'ni **login'dan olingan access token hech qachon sessiyaga qarshi tekshirilmaydi.**
Faqat `refresh` dan keyingi token tekshiriladi.

**Amaliy oqibat:**

```
1. O'qituvchi login qiladi        → access token (sessionId YO'Q), 15h amal qiladi
2. O'qituvchi "Chiqish" bosadi    → logout(): auth_sessions.revoked_at = now()
3. O'sha access token bilan so'rov → ensureUser(): payload.sessionId yo'q
                                    → sessiya tekshiruvi O'TKAZIB YUBORILADI
                                    → ✅ RUXSAT BERILADI
4. Bu 15 soat davom etadi.
```

`logout` (`auth.service.ts:718-759`), `revokeSession` (`:1539-1597`),
`revokeAllSessions` (`:1599-1642`) — **uchalasi ham** faqat `auth_sessions` ni
o'zgartiradi. Access token'ga hech qanday ta'sir qilmaydi.

Xuddi shu narsa parol o'zgartirishda ham:
`staffChangePassword` (`:1058-1061`) barcha sessiyalarni bekor qiladi —
lekin o'g'irlangan access token yana 15 soat ishlaydi. **Ya'ni "parolimni kimdir
bildi, tezda o'zgartiraman" — bu hujumchini chiqarib tashlamaydi.**

**Yechim — `sessionId` ni har payload'ga kiritish va tekshiruvni shartsiz qilish.**

Bu ikki qadamli o'zgarish, chunki tovuq-tuxum muammosi bor: `sessionId` sessiya
yaratilgandan keyin ma'lum bo'ladi, token esa undan oldin imzolanadi.

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

/**
 * Issue tokens for a brand-new session.
 *
 * The session row is created FIRST (with the refresh hash), then the access
 * token is signed with the resulting sessionId embedded. Without sessionId in
 * the payload, ensureUser() cannot check revocation and logout becomes a no-op
 * for the access token.
 */
private async issueSessionTokens(args: {
  tenantId: bigint;
  accountType: AccountType;
  userId?: bigint | null;
  studentAccountId?: bigint | null;
  basePayload: Record<string, any>;
  req: Request;
}): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date }> {
  const refreshToken = randomBytes(48).toString('hex');
  const refreshTokenHash = sha256Hex(refreshToken);
  const refreshExpiresAt = addDays(now(), this.refreshDays());

  const sessionId = await this.createSession({
    tenantId: args.tenantId,
    accountType: args.accountType,
    userId: args.userId ?? null,
    studentAccountId: args.studentAccountId ?? null,
    refreshTokenHash,
    refreshExpiresAt,
    req: args.req,
  });

  const accessToken = await this.jwt.signAsync(
    { ...args.basePayload, sessionId: sessionId.toString() },
    { secret: requireEnv('JWT_ACCESS_SECRET'), expiresIn: this.accessTtl() as any },
  );

  return { accessToken, refreshToken, refreshExpiresAt };
}
```

Va `jwt-request.util.ts` da tekshiruvni **majburiy** qilish:

```ts
// apps/api/src/common/auth/jwt-request.util.ts — taklif

const payload = await jwt.verifyAsync<RequestUser>(token, { secret });
if (!payload?.type) throw new UnauthorizedException('INVALID_ACCESS_TOKEN');

// A token without sessionId cannot be checked against revocation. Reject it
// rather than trusting it — this is the difference between logout working and
// logout being decorative.
if (!payload.sessionId) throw new UnauthorizedException('INVALID_ACCESS_TOKEN');

const sid = safeBigIntFromDigits(payload.sessionId);
if (!sid) throw new UnauthorizedException('INVALID_ACCESS_TOKEN');

const session = await prisma.auth_sessions.findFirst({
  where: { id: sid, revoked_at: null, expires_at: { gt: new Date() } },
  select: { id: true },
});
if (!session) throw new UnauthorizedException('SESSION_REVOKED');
```

⚠️ **Migratsiya ogohlantirishi:** bu o'zgarish **barcha mavjud access token'larni
bekor qiladi** — hamma qaytadan login qilishi kerak. Bu qabul qilinadigan narx
(bir marta, kechqurun deploy), lekin foydalanuvchilarga oldindan aytilishi kerak.

⚠️ **Ishlash narxi:** endi har so'rov `auth_sessions` ga bitta `findFirst` qiladi.
`auth_sessions` da **hech qanday index yo'q** (`schema.prisma:147-161`) — bu jadval
o'sgan sari sekinlashadi. Index majburiy (4-bo'limga qarang).

---

## 2. ⚠️ ZIDDIYAT — access token TTL

> **Holat: HAL QILINDI.** Ziddiyat tekshirildi, sababi aniqlandi va `.env.example`
> tuzatildi (`15h` → `15m`, sabab izohi bilan). Quyida — nima bo'lgani, nega
> muhimligi va **hali ochiq qolgan ikkita quyruq**.

### 2.1. Ziddiyat nima edi va kim haq edi

O'lchangan zanjir:

```
common/config/env.validation.ts:54    ACCESS_TOKEN_TTL: string = '15m';   ← kod default
modules/auth/auth.module.ts:21        expiresIn: '15m',                    ← JwtModule default (hardkod)
modules/auth/auth.service.ts:89       return process.env.ACCESS_TOKEN_TTL || '15m';
modules/auth/auth.service.ts:316      expiresIn: this.accessTtl() as any,  ← BU G'OLIB
```

`signAsync` opsiyasi modul default'ini bosadi, ya'ni **amalda ishlaydigan qiymat —
`auth.service.ts:316`**, u esa env'dan oladi va env yo'q bo'lsa `15m` ga tushadi.

**Xulosa — kim haq edi:**

| Manba | Qiymat | Baho |
|---|---|---|
| Kod default (`auth.service.ts:89`) | `15m` | ✅ **To'g'ri edi** |
| `env.validation.ts:54` default | `15m` | ✅ **To'g'ri edi** |
| README:248 "15-minute access" | 15m | ✅ **To'g'ri edi** |
| **`render.yaml:21-22`** | **`15m`** | ✅ **To'g'ri edi — production shu bilan ishlagan** |
| **`.env.example:22`** | **`"15h"`** | ❌ **Yagona xato shu yerda edi** |

### 2.2. ⚠️ Production HECH QACHON 15 soat bo'lmagan — halol aniqlik

Bu muhim va uni to'g'ri aytish kerak. Deploy konfiguratsiyasi:

```yaml
# render.yaml:8-30
envVars:
  - key: NODE_ENV
    value: production
  - key: JWT_ACCESS_SECRET
    generateValue: true        # ⬅️ har deploy'da tasodifiy sir — yaxshi
  - key: ACCESS_TOKEN_TTL
    value: 15m                 # ⬅️ 15 DAQIQA
  - key: REFRESH_TOKEN_DAYS
    value: 30
  - key: COOKIE_SECURE
    value: true
  - key: BCRYPT_ROUNDS
    value: 12
  - key: ENABLE_SWAGGER
    value: false               # ⬅️ productionda Swagger yopiq — yaxshi
```

**`render.yaml` `.env.example` ni umuman o'qimaydi.** Render env o'zgaruvchilarni
shu fayldan oladi. Ya'ni:

> **Deploy qilingan servis har doim 15 daqiqalik access token ishlatgan.**
> "Productionda 15 soat edi" degan gap — **noto'g'ri** bo'lardi.

`15h` faqat **bitta auditoriyaga** tegardi: `cp .env.example .env` qilgan
**lokal dasturchiga**. Bu — real muammo (dasturchi mashinasida 15 soatlik token,
va u yerda ham real ma'lumot bo'lishi mumkin), lekin **real xodimlar va ota-onalar
hech qachon ta'sirlanmagan**.

Kanon "Halol bo'l. Raqam to'qima" deydi. Shu sababli bu bo'lim **jiddiylikni
oshirmaydi**: bu **potensial** xavf edi, sodir bo'lgan hodisa emas.

`render.yaml` da yana ikkita yaxshi qaror bor va ular tan olinadi:

| Qator | Nima | Nega to'g'ri |
|---|---|---|
| `:17-20` | `generateValue: true` | JWT sirlari har deploy'da Render tomonidan generatsiya qilinadi — repoda ham, `.env` da ham yo'q |
| `:31-32` | `ENABLE_SWAGGER: false` | Productionda API sxemasi ochiq emas |
| `:27-28` | `COOKIE_SECURE: true` | HTTPS majburiy |

### 2.3. Nega aynan `.env.example` — eng xavfli joy

Xato **eng ko'p nusxalanadigan** faylda edi. Faylning o'zi 4-qatorida shunday deydi:

```
# apps/api/.env.example:4
#  Usage:  cp .env.example .env   then fill in the real values.
```

Ya'ni **hujjat aytgan yo'l bilan borgan har bir dasturchi 15 soatlik access token
olardi.** Kod default'ining `15m` bo'lishi tasalli emas — u hech qachon
qo'llanilmaydi, chunki `.env` da qiymat bor.

Va eng yomoni: **hech narsa buzilmaydi.** Ogohlantirish yo'q, log yo'q, test
yiqilmaydi. Tizim mukammal ishlaydi — shunchaki refresh token'ning butun ma'nosi
jimgina yo'qoladi. Bu — eng qiyin toifadagi bag: **muvaffaqiyatga o'xshab
ko'rinadigan muvaffaqiyatsizlik.**

### 2.4. Nega 15 soat — jiddiy xavfsizlik muammosi

**1. Refresh token'ning butun ma'nosi yo'qoladi.**

Access + refresh arxitekturasining yagona sababi shu: access token qisqa umr
ko'radi, shuning uchun uni tekshirishda DB'ga borish shart emas. Uzoq umr —
refresh — DB'da yashaydi va istalgan payt bekor qilinadi.

TTL 15 soat bo'lsa bu savdo yo'qoladi. Sizda **15 soat davomida bekor qilib
bo'lmaydigan** token bor. Refresh token 30 kun — lekin u 15 soatga nisbatan
faqat 48 barobar uzoq. Ya'ni siz stateless token'ning xavfini olib, stateful
token'ning foydasini olmayapsiz.

**2. O'g'irlangan token 15 soat amal qiladi.**

Access token `localStorage` yoki xotirada yashaydi (frontend). XSS, umumiy
kompyuter, brauzer kengaytmasi, ochiq qolgan DevTools — bularning har biri token
oshkorligi. 15 daqiqada hujumchi ulgurmasligi mumkin. 15 soatda — **butun ish
kuni**.

Bu akademiyada real ta'sir: o'qituvchi kompyuterida qolgan token bilan
kimdir **baho o'zgartiradi**, o'quvchi ma'lumotlarini eksport qiladi,
intizom yozuvi qo'shadi.

**3. 2-bo'limdagi topilma bilan birgalikda — falokat.**

`sessionId` yo'qligi + 15 soat = **logout 15 soat davomida hech narsa qilmaydi.**
"Chiqdim" tugmasi yolg'on gapiradi. Umumiy kompyuterda o'qituvchi chiqdi deb
o'ylaydi, keyingi odam esa hali ham uning tokeni bilan ishlay oladi (agar u tokenni
qo'lga kiritsa).

**4. Rol o'zgarishi 15 soat kutadi.**

`roles` va `permissions` **token ichida** (`auth.service.ts:473-479`). Guard'lar
ularni token'dan o'qiydi (`perms.guard.ts:31-34`). Ya'ni:

```
09:00  O'qituvchi ishdan bo'shatildi, ADMIN uning rollarini olib tashladi
09:00  user_roles dan qator o'chdi, cache tozalandi
09:01  O'qituvchi eski token bilan so'rov yuboradi
       → perms.guard: user.permissions token'dan o'qiladi
       → 'assessments.write' hali ham bor
       → ✅ RUXSAT
23:00  Token muddati tugaydi. Endi ruxsat yo'q.
```

**14 soatlik "ishdan bo'shatilgan xodim hali ham baho qo'yadi" oynasi.**

Diqqat: `getStaffRolesPermissions` da 5 daqiqalik cache bor
(`auth.service.ts:393`) va `invalidateUserCache` chaqiriladi — lekin **bu
ahamiyatsiz**, chunki ruxsatlar token'da, DB'da emas. Cache faqat yangi token
berilganda o'qiladi.

⚠️ Yana yomoni: `user-roles.service.ts:73-74` da cache invalidatsiyasi
**izohga olingan**:

```ts
// apps/api/src/modules/rbac/user-roles.service.ts:73-74
// Invalidate cache for user's roles/permissions (optional)
// await this.invalidateUserCache(target_user_id);
```

Ya'ni RBAC moduli orqali rol o'zgartirilsa, cache **umuman tozalanmaydi**. Endi
oyna 15 soat emas, 15 soat + keyingi login'gacha bo'lgan cache.

### 2.5. To'g'ri qiymat va asoslash

**Tavsiya: `ACCESS_TOKEN_TTL="15m"`, `REFRESH_TOKEN_DAYS=30`.**

**Nega aynan 15 daqiqa:**

| Mezon | Izoh |
|---|---|
| **Bekor qilish oynasi** | Logout/rol o'zgarishi eng ko'pi bilan 15 daqiqada kuchga kiradi. Bu maktab kontekstida qabul qilsa bo'ladigan kechikish |
| **O'g'irlik oynasi** | O'g'irlangan token 15 daqiqada o'ladi. Hujumchi refresh cookie'ni ham olishi kerak — u `httpOnly` va `path`-cheklangan, ya'ni XSS orqali olinmaydi |
| **Server yuki** | 15 daqiqada bir marta refresh = foydalanuvchi boshiga soatiga 4 ta so'rov. 200 foydalanuvchi = soatiga 800 so'rov = ~0.2 RPS. **Hech qanday yuk emas** |
| **UX** | Foydalanuvchi buni sezmaydi — refresh fonda avtomatik ketadi (`path: '/api/auth/refresh'` cookie bunga tayyor) |
| **Sanoat amaliyoti** | 5-30 daqiqa — keng tarqalgan oraliq. 15m — o'rtasi |

**Nega 30 kun refresh:**

| Mezon | Izoh |
|---|---|
| **UX** | Ota-ona oyiga bir-ikki marta kiradi. 30 kun bo'lmasa u har safar parol yozadi → parolni unutadi → admin reset qiladi → admin yuki |
| **Xavf** | Refresh token DB'da, xesh holida, `httpOnly` cookie'da, `path`-cheklangan. Uni bekor qilish — bitta `UPDATE`. Ya'ni uzoq TTL nazorat ostida |
| **Chegara** | `env.validation.ts:57-59` allaqachon `@Max(30)` qo'ygan — bu to'g'ri va saqlanadi |

**Migratsiya — holat:**

| Qadam | Holat |
|---|---|
| `.env.example:22` → `ACCESS_TOKEN_TTL="15m"` + sabab izohi | ✅ **Bajarildi** |
| README:248 | ✅ Allaqachon to'g'ri edi, tegilmadi |
| Real `.env` fayllarni tekshirish | ⚠️ **Qo'lda ish** — kod buni ko'rmaydi. Deploy'da tekshirilsin |
| `env.validation.ts` ga format validatsiyasi | ❌ **Ochiq** — 2.5 |
| `auth.module.ts:21` hardkodini olib tashlash | ❌ **Ochiq** — 2.6 |

⚠️ **Diqqat:** `.env.example` tuzatilishi **mavjud deploy'larni tuzatmaydi.**
Kimningdir `.env` da hali ham `15h` turishi mumkin — va kod bu haqda hech narsa
demaydi. Shu sababli 2.5 dagi validatsiya shunchaki "yaxshi bo'lardi" emas: u
tuzatishni **majburlashning yagona yo'li**.

### 2.6. Ochiq quyruq #1 — format validatsiya qilinmaydi

```ts
// apps/api/src/common/config/env.validation.ts:53-54
@IsString()
ACCESS_TOKEN_TTL: string = '15m';
```

`@IsString()` — bu "satr bo'lsin" deydi, xolos. `"15h"`, `"15 yil"`, `"banana"` —
**hammasi validatsiyadan o'tadi.** Kanon 5.4 da "`env.validation.ts` — noto'g'ri
konfiguratsiyada ishga tushmaydi" deyilgan; **bu da'vo TTL uchun to'g'ri emas.**

Va TypeScript ham yordam bermaydi:

```ts
// apps/api/src/modules/auth/auth.service.ts:314-317
const accessToken = await this.jwt.signAsync(payload, {
  secret: requireEnv('JWT_ACCESS_SECRET'),
  expiresIn: this.accessTtl() as any,      // ⬅️ as any
});
```

`@nestjs/jwt` `expiresIn` uchun `ms` kutubxonasining `StringValue` shablon turini
kutadi (`\`${number}${'s'|'m'|'h'|'d'|...}\`` kabi), oddiy `string` emas.
`accessTtl()` esa `string` qaytaradi — turlar mos kelmaydi, va `as any` bu
nomuvofiqlikni **o'chiradi**.

Natijada `ACCESS_TOKEN_TTL="banana"` uchun:

- ❌ `env.validation.ts` ushlamaydi (`@IsString()` o'tkazadi)
- ❌ TypeScript ushlamaydi (`as any` o'chirgan)
- ❌ Boot'da yiqilmaydi — `signAsync` faqat **birinchi login'da** chaqiriladi
- 💥 **Birinchi login'da `jsonwebtoken` xato tashlaydi** (u `expiresIn` ni `ms()`
  orqali parse qiladi; parse qilinmasa `"expiresIn" should be a number of seconds
  or string representing a timespan` deb yiqiladi) → `catch` bloki
  (`auth.service.ts:507-517`) uni `InternalServerErrorException('AUTH_STAFF_LOGIN_FAILED')`
  ga aylantiradi

Ya'ni: **API muvaffaqiyatli ishga tushadi, health check yashil, va hech kim tizimga
kira olmaydi** — sababi esa 500 xato ostida yashiringan. Bu deploy paytida topiladigan
eng yomon nosozlik turi.

> ⚠️ `jsonwebtoken` ning aniq xatti-harakati versiyaga bog'liq. Muhimi shu:
> **bu boot'da emas, birinchi login'da chiqadi** — versiyadan qat'i nazar.

**Yechim — boot'da to'xtatish:

Kanon 5.4: "`env.validation.ts` — noto'g'ri konfiguratsiyada ishga tushmaydi".
Bu va'dani TTL uchun **haqiqiy** qilish kerak:

```ts
// apps/api/src/common/config/env.validation.ts — taklif

import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Access-token TTL must be short.
 *
 * Access tokens are stateless: once signed, nothing can withdraw them before
 * they expire. Everything that makes revocation work — logout, role changes,
 * session revocation — is capped by this number. A long TTL does not make the
 * system "more convenient", it makes revocation decorative.
 *
 * 30 minutes is the hard ceiling. Refresh runs in the background; the user
 * never sees the boundary.
 */
export function IsShortAccessTtl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isShortAccessTtl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const m = /^(\d+)(s|m|h|d)$/.exec(String(value || '').trim());
          if (!m) return false;

          const amount = Number(m[1]);
          const unit = m[2];
          const seconds =
            unit === 's' ? amount
            : unit === 'm' ? amount * 60
            : unit === 'h' ? amount * 3600
            : amount * 86400;

          // Floor of 1 minute keeps refresh traffic sane; ceiling of 30
          // minutes keeps the revocation window meaningful.
          return seconds >= 60 && seconds <= 30 * 60;
        },
        defaultMessage(args: ValidationArguments) {
          return (
            `ACCESS_TOKEN_TTL="${args.value}" is invalid. ` +
            `Use a duration between 1m and 30m (e.g. "15m"). ` +
            `Long-lived access tokens cannot be revoked — logout, role changes ` +
            `and session revocation all silently stop working.`
          );
        },
      },
    });
  };
}

class EnvironmentVariables {
  // ...

  @IsShortAccessTtl()
  ACCESS_TOKEN_TTL: string = '15m';

  @IsInt()
  @Min(1)
  @Max(30)
  REFRESH_TOKEN_DAYS: number = 30;

  // ⚠️ Bug: current file has @Min(4) @Max(15) with default 10 while
  // .env.example says 12 and the service hardcodes a 12 fallback
  // (auth.service.ts:920, 1041). Cost 4 is trivially brute-forceable.
  @IsInt()
  @Min(12)
  @Max(15)
  BCRYPT_ROUNDS: number = 12;
}
```

Endi `ACCESS_TOKEN_TTL="15h"` bilan **API umuman ishga tushmaydi** va xato xabari
sababni tushuntiradi. Bu — "intizomdan strukturaga" naqshining aynan o'zi
(kanon 5.1 dagi tenant muammosi bilan bir xil falsafa).

**Va `as any` ni yo'q qilish:**

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

import type { StringValue } from 'ms';

/**
 * Validated at boot by IsShortAccessTtl, so the cast is a statement of fact
 * rather than a way to silence the compiler: nothing that fails the ms()
 * grammar can reach this point.
 */
private accessTtl(): StringValue {
  return (process.env.ACCESS_TOKEN_TTL || '15m') as StringValue;
}
```

Cast baribir qoladi (env `string` bo'lib keladi, buni aylanib o'tib bo'lmaydi),
lekin endi u **`as any` emas** — tur toraytirildi va boot validatsiyasi uni
qo'llab-quvvatlaydi. Farq: `as any` "tekshirmang" deydi, `as StringValue`
"tekshirildi" deydi.

### 2.7. Ochiq quyruq #2 — TTL uchun ikkita manba

```ts
// apps/api/src/modules/auth/auth.module.ts:16-23
JwtModule.register({
  global: true,
  secret: process.env.JWT_ACCESS_SECRET || 'default-secret-change-in-production',
  signOptions: {
    expiresIn: '15m', // String emas, StringValue sifatida
  },
}),
```

Bu qiymat **hech qachon ishlatilmaydi** — `signAsync` opsiyasi
(`auth.service.ts:316`) uni har safar bosadi. Ya'ni TTL uchun ikkita manba bor,
bittasi o'lik.

**Nega bu muhim:** kelajakda kimdir TTL ni o'zgartirmoqchi bo'ladi, `auth.module.ts`
ni ochadi (mantiqiy joy — konfiguratsiya modulda bo'lishi kerak), `15m` ni
`5m` ga o'zgartiradi, deploy qiladi — va **hech narsa o'zgarmaydi**. Keyin bir
soat "nega ishlamayapti" deb izlaydi. Bu — xavfsizlik bagi emas, lekin **bag
yaratadigan tuzilma**.

Yana ikkita muammo shu blokda:

1. **`secret` fallback: `'default-secret-change-in-production'`.** Agar
   `JWT_ACCESS_SECRET` yo'q bo'lsa, JwtModule **jimgina** ommaviy ma'lum satrni
   ishlatadi. Bu yerda `env.validation.ts:47-48` qutqaradi (secret majburiy →
   boot yiqiladi), ya'ni amalda erishib bo'lmaydigan yo'l. Lekin
   `auth.service.ts:315` **to'g'ri** qilgan — `requireEnv('JWT_ACCESS_SECRET')`,
   ya'ni fallback yo'q. Ikki xil falsafa bir xil narsa uchun.
2. Izoh `// String emas, StringValue sifatida` — bu 2.5 dagi tur muammosining
   izi. Kimdir tur bilan kurashgan va izoh qoldirgan.

**Yechim — yagona manba:**

```ts
// apps/api/src/modules/auth/auth.module.ts — taklif

import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

@Module({
  imports: [
    CacheModule.register({ ttl: 300_000, max: 100 }),

    /**
     * Single source of truth for JWT signing.
     *
     * registerAsync + ConfigService means the TTL and the secret are read from
     * validated config in exactly one place. Previously the module hardcoded
     * expiresIn: '15m' while auth.service.ts passed its own value per call —
     * the module's value was dead, and anyone editing it to change the TTL
     * would have seen no effect.
     *
     * No secret fallback: a missing JWT_ACCESS_SECRET must stop the boot, not
     * quietly sign tokens with a string that is published in the repository.
     */
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('ACCESS_TOKEN_TTL') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

Va `auth.service.ts:314-317` dan `expiresIn` **butunlay olib tashlanadi** —
modul default'i endi to'g'ri va yagona:

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif
// expiresIn comes from the module's signOptions — one source, validated at boot.
const accessToken = await this.jwt.signAsync(payload, {
  secret: requireEnv('JWT_ACCESS_SECRET'),
});
```

⚠️ **Ehtiyot:** `JwtModule` `global: true` va **butun ilova bo'ylab** ishlatiladi
(`ensureUser` da `verifyAsync`). `signOptions` ni o'zgartirish barcha
imzolashga ta'sir qiladi. Hozir `signAsync` faqat `auth.service.ts` da chaqiriladi,
ya'ni xavf past — lekin bu **tekshirilishi kerak** o'zgarishdan oldin.

---

## 3. Refresh token rotatsiyasi

### 3.1. Rotatsiya bormi? — HA

```ts
// apps/api/src/modules/auth/auth.service.ts:633-716
async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
  const token = String(req.cookies?.[this.cookieName()] || '');
  if (!token) throw new UnauthorizedException('NO_REFRESH_TOKEN');

  const hash = sha256Hex(token);

  const session = await this.prisma.auth_sessions.findFirst({
    where: { refresh_token_hash: hash },
    select: { id: true, tenant_id: true, account_type: true, user_id: true,
              student_account_id: true, expires_at: true, revoked_at: true },
  });

  if (!session) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
  if (session.revoked_at) throw new UnauthorizedException('SESSION_REVOKED');
  if (session.expires_at <= now()) throw new UnauthorizedException('SESSION_EXPIRED');

  // ... payload quriladi (roles/permissions DB'dan qayta o'qiladi) ...

  const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
    await this.issueTokens(payload);

  await this.prisma.auth_sessions.update({
    where: { id: session.id },
    data: {
      refresh_token_hash: refreshTokenHash,   // ⬅️ ESKI XESH USTIGA YOZILADI
      expires_at: refreshExpiresAt,           // ⬅️ MUDDAT UZAYADI
      device_info: this.getIpUa(req).ua || undefined,
    },
  });

  this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

  return { accessToken };
}
```

**Javoblar:**

| Savol | Javob | Isbot |
|---|---|---|
| Har refresh'da yangi token beriladimi? | ✅ **HA** | `issueTokens()` → `randomBytes(48)`, `:319` |
| Eski token bekor qilinadimi? | ✅ **HA** — lekin bilvosita | `:702` — xesh ustiga yoziladi, eski xesh yo'qoladi |
| Reuse detection bormi? | ❌ **YO'Q** | Pastda |

**Bir yaxshi detal:** refresh'da `roles`/`permissions` **DB'dan qayta o'qiladi**
(`:664-666`), eski token'dan ko'chirilmaydi. Ya'ni rol o'zgarishi keyingi
refresh'da kuchga kiradi. TTL 15m bo'lganida bu 15 daqiqalik oynani anglatadi —
maqbul. TTL 15h bo'lganida — 15 soat.

### 3.2. ⚠️ Reuse detection yo'q — nega bu muhim

**Reuse detection nima:** refresh token bir marta ishlatiladi. Agar **allaqachon
ishlatilgan** token qayta kelsa — bu ikkitadan biri:

1. Tarmoq xatosi/qayta urinish (kamdan-kam), yoki
2. **Token o'g'irlangan.** Chunki endi ikki nusxa bor: qonuniy foydalanuvchida
   va hujumchida. Ikkalasi ham refresh qiladi. Bittasi eskirgan tokenni yuboradi.

Ikkinchi holat — **o'g'irlikni aniqlashning yagona ishonchli signali.** Refresh
token `httpOnly` cookie'da, ya'ni u o'g'irlansa — bu jiddiy hodisa (DB oqishi,
XSS emas balki server tomonidagi muammo, MITM).

**Hozirgi kodda nima bo'ladi:**

```
1. Foydalanuvchi refresh qiladi, token T1 → T2 ga almashadi.
   auth_sessions.refresh_token_hash = sha256(T2).  sha256(T1) YO'QOLDI.

2. Hujumchi T1 ni o'g'irlagan edi. U T1 bilan refresh qiladi.
   findFirst({ refresh_token_hash: sha256(T1) })  →  null
   throw UnauthorizedException('INVALID_REFRESH_TOKEN')

3. Tizim uchun bu — oddiy yaroqsiz token. "Kimdir tasodifiy satr yubordi" bilan
   BIR XIL. Hech qanday signal yozilmaydi, hech kim xabardor qilinmaydi,
   qonuniy sessiya ochiq qoladi.
```

Ya'ni: eski token **ishlamaydi** (bu yaxshi), lekin **o'g'irlik fakti aniqlanmaydi**
(bu yomon). Va teskari senariy yanada yomon:

```
1. Hujumchi T1 ni o'g'irlaydi va BIRINCHI bo'lib refresh qiladi.
   T1 → T2'. Hujumchida T2' bor. auth_sessions da sha256(T2').

2. Qonuniy foydalanuvchi T1 bilan refresh qiladi → INVALID_REFRESH_TOKEN
   → frontend uni login sahifasiga uloqtiradi.

3. Foydalanuvchi "nimadir buzildi" deb qayta login qiladi. YANGI sessiya.
   ESKI sessiya (hujumchiniki) OCHIQ QOLADI — 30 kun.

4. Hujumchi har 15 daqiqada refresh qilib, sessiyani CHEKSIZ uzaytiradi (3.3).
```

Foydalanuvchi bir marta "tizim g'alati ishladi" deb o'yladi. Hujumchi esa doimiy
kirish oldi. **Hech qayerda hech qanday iz yo'q.**

### 3.3. ⚠️ Cheksiz sessiya — `expires_at` sirpanadi

```ts
// apps/api/src/modules/auth/auth.service.ts:699-706
await this.prisma.auth_sessions.update({
  where: { id: session.id },
  data: {
    refresh_token_hash: refreshTokenHash,
    expires_at: refreshExpiresAt,        // ⬅️ addDays(now(), 30)
    ...
  },
});
```

`refreshExpiresAt = addDays(now(), this.refreshDays())` — ya'ni **hozirdan +30 kun**,
sessiya boshlanganidan emas.

Oqibat: har 15 daqiqada refresh qiladigan sessiya **hech qachon tugamaydi.**
30 kunlik chegara — bu "30 kun harakatsizlikdan keyin" degani, "30 kunlik sessiya"
emas. README:248 "30-day refresh" deydi — bu **noto'g'ri**, u aslida "30 kunlik
harakatsizlik timeout'i".

Bu o'z-o'zidan halokatli emas (harakatsizlik timeout'i ham foydali), lekin
**absolute lifetime yo'q** — hujumchi bir marta kirsa, abadiy qoladi.

### 3.4. Boshqa topilmalar

**a) Sessiya qidiruvi tenant bilan cheklanmagan:**

```ts
// auth.service.ts:640-641
const session = await this.prisma.auth_sessions.findFirst({
  where: { refresh_token_hash: hash },   // tenant_id YO'Q
```

Bu **xavfsizlik teshigi emas** — 384-bit tasodifiy token to'qnashuvi amalda nol,
va tenant sessiya qatoridan o'qiladi (`:670`), mijozdan emas. Lekin kanon 5.1
dagi "845 ta qo'lda tenant nuqtasi" naqshining bir qismi. Prisma extension
kelganida bu joy **maxsus istisno** bo'lishi kerak (refresh oqimida tenant hali
noma'lum) — buni 03-multi-tenancy hujjatida eslatib o'tish kerak.

**b) `auth_sessions` da index umuman yo'q:**

```prisma
// apps/api/prisma/schema.prisma:147-161
model auth_sessions {
  id                 BigInt    @id @default(autoincrement())
  tenant_id          BigInt
  account_type       String    @db.VarChar(20)
  user_id            BigInt?
  student_account_id BigInt?
  refresh_token_hash String
  device_info        String?
  ip_address         String?
  expires_at         DateTime  @db.Timestamptz(6)
  revoked_at         DateTime? @db.Timestamptz(6)
  created_at         DateTime  @default(now()) @db.Timestamptz(6)
  tenants            tenants   @relation(...)
  users              users?    @relation(...)
}
// @@unique yo'q. @@index yo'q. Hech narsa yo'q.
```

`findFirst({ where: { refresh_token_hash: hash } })` — **sequential scan**. Har
15 daqiqada har foydalanuvchi uchun. Sessiyalar hech qachon o'chirilmaydi (faqat
`revoked_at` qo'yiladi), ya'ni jadval **cheksiz o'sadi**.

**c) `refresh_token_hash` unique emas** — ya'ni DB darajasida ikki sessiya bir xil
xeshga ega bo'lishi mumkin. Amalda bo'lmaydi, lekin `findFirst` o'rniga
`findUnique` ishlatib bo'lmaydi va to'qnashuv jim o'tadi.

### 3.5. Yechim — token family bilan reuse detection

**Sxema o'zgarishi:**

```prisma
// apps/api/prisma/schema.prisma — taklif

model auth_sessions {
  id                 BigInt    @id @default(autoincrement())
  tenant_id          BigInt
  account_type       String    @db.VarChar(20)
  user_id            BigInt?
  student_account_id BigInt?
  refresh_token_hash String
  device_info        String?
  ip_address         String?
  expires_at         DateTime  @db.Timestamptz(6)
  revoked_at         DateTime? @db.Timestamptz(6)
  created_at         DateTime  @default(now()) @db.Timestamptz(6)

  // ── new ────────────────────────────────────────────────────────────────
  /// Hash of the immediately preceding refresh token. A request carrying this
  /// hash means someone replayed a rotated token — that is a theft signal, not
  /// an ordinary invalid token.
  prev_token_hash    String?

  /// Hard ceiling. Unlike expires_at (which slides forward on every refresh
  /// and therefore acts as an inactivity timeout), this never moves. A stolen
  /// session cannot be kept alive forever by refreshing it.
  absolute_expires_at DateTime @db.Timestamptz(6)

  /// Set when the session is revoked because a rotated token was replayed.
  reuse_detected_at  DateTime? @db.Timestamptz(6)

  /// Sliding inactivity marker, updated on every authenticated request
  /// (throttled — see SESSION_INACTIVITY_TIMEOUT).
  last_seen_at       DateTime  @default(now()) @db.Timestamptz(6)

  tenants            tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users              users?    @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  // ── indexes ────────────────────────────────────────────────────────────
  @@unique([refresh_token_hash])
  @@index([prev_token_hash])
  @@index([user_id, revoked_at])
  @@index([student_account_id, revoked_at])
  @@index([tenant_id, created_at])
  @@index([expires_at])
}
```

**Servis kodi:**

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
  const token = String(req.cookies?.[this.cookieName()] || '');
  if (!token) throw new UnauthorizedException('NO_REFRESH_TOKEN');

  const hash = sha256Hex(token);

  const session = await this.prisma.auth_sessions.findUnique({
    where: { refresh_token_hash: hash },
    select: {
      id: true, tenant_id: true, account_type: true, user_id: true,
      student_account_id: true, expires_at: true, absolute_expires_at: true,
      revoked_at: true,
    },
  });

  if (!session) {
    // Not found under the current hash. Before calling this an ordinary bad
    // token, check whether it is a *rotated* token being replayed. If it is,
    // two copies of this session exist — the legitimate one and a thief's.
    // We cannot tell which is which, so we kill the whole family and force a
    // re-login. Losing one session beats leaving a stolen one alive.
    await this.handlePossibleReuse(hash, req);
    this.clearRefreshCookie(res);
    throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
  }

  if (session.revoked_at) {
    this.clearRefreshCookie(res);
    throw new UnauthorizedException('SESSION_REVOKED');
  }
  if (session.expires_at <= now()) {
    this.clearRefreshCookie(res);
    throw new UnauthorizedException('SESSION_EXPIRED');
  }
  if (session.absolute_expires_at <= now()) {
    // The hard ceiling. No amount of refreshing extends past this.
    await this.prisma.auth_sessions.update({
      where: { id: session.id },
      data: { revoked_at: now() },
    });
    this.clearRefreshCookie(res);
    throw new UnauthorizedException('SESSION_MAX_LIFETIME_REACHED');
  }

  const payload = await this.buildSessionPayload(session);

  const newToken = randomBytes(48).toString('hex');
  const newHash = sha256Hex(newToken);
  const newExpiresAt = addDays(now(), this.refreshDays());

  // Conditional update: `refresh_token_hash: hash` in the WHERE clause makes
  // this a compare-and-swap. Two concurrent refreshes with the same token
  // cannot both succeed — the loser gets P2025 and is treated as a replay.
  try {
    await this.prisma.auth_sessions.update({
      where: { id: session.id, refresh_token_hash: hash },
      data: {
        refresh_token_hash: newHash,
        prev_token_hash: hash,
        expires_at: newExpiresAt,
        last_seen_at: now(),
        device_info: this.getIpUa(req).ua || undefined,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      await this.handlePossibleReuse(hash, req);
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }
    throw e;
  }

  const accessToken = await this.jwt.signAsync(
    { ...payload, sessionId: session.id.toString() },
    { secret: requireEnv('JWT_ACCESS_SECRET'), expiresIn: this.accessTtl() as any },
  );

  this.setRefreshCookie(res, newToken, newExpiresAt);
  return { accessToken };
}

/**
 * A refresh token that is not current might still be the one we rotated away
 * from. That is the only reliable signal we have that a refresh token leaked:
 * two parties are holding the same session.
 *
 * Response: revoke the session and audit it loudly. Silence here is how a
 * stolen session survives for 30 days.
 */
private async handlePossibleReuse(hash: string, req: Request): Promise<void> {
  const victim = await this.prisma.auth_sessions.findFirst({
    where: { prev_token_hash: hash, revoked_at: null },
    select: {
      id: true, tenant_id: true, account_type: true,
      user_id: true, student_account_id: true, ip_address: true,
    },
  });

  if (!victim) return; // Genuinely just an invalid token.

  const { ip, ua } = this.getIpUa(req);

  await this.prisma.auth_sessions.update({
    where: { id: victim.id },
    data: { revoked_at: now(), reuse_detected_at: now() },
  });

  await this.auditLog({
    tenantId: victim.tenant_id,
    actorType: 'SYSTEM',
    actorUserId: victim.user_id ?? undefined,
    actorStudentAccountId: victim.student_account_id ?? undefined,
    action: 'OTHER',
    entityType: 'auth_sessions',
    entityId: victim.id,
    beforeData: { revoked: false, sessionIp: victim.ip_address },
    afterData: {
      revoked: true,
      reason: 'REFRESH_TOKEN_REUSE_DETECTED',
      replayFromIp: ip,
      replayFromUa: ua,
      detectedAt: now(),
    },
    ipAddress: ip || undefined,
  });

  // TODO(notifications): this should also reach a human. A reuse event means
  // a refresh token left the browser it was issued to.
}
```

**Nima o'zgardi:**

| Oldin | Keyin |
|---|---|
| Eski token → `INVALID_REFRESH_TOKEN`, jim | Eski token → sessiya o'ldiriladi + audit |
| `expires_at` cheksiz sirpanadi | `absolute_expires_at` qat'iy shift |
| Ikkita parallel refresh — ikkalasi ham o'tishi mumkin | Compare-and-swap, faqat bittasi |
| `findFirst` full scan | `findUnique` + index |

⚠️ **Yon ta'sir:** `prev_token_hash` faqat **bitta** qadam orqaga ko'radi. Agar
hujumchi ikki marta refresh qilsa, birinchi token endi `prev` emas — aniqlanmaydi.
To'liq yechim — alohida `token_family_id` va butun zanjirni saqlash. Bu murakkabroq.
Bir qadamlik detection **ko'p hollarni ushlaydi** va arzon; buni birinchi bosqich
qilib, family'ni keyingi bosqichga qoldirish maqsadga muvofiq.

⚠️ **Tarmoq qayta urinishi:** mobil tarmoqda refresh so'rovi javob yetib bormay
qayta yuborilishi mumkin → noto'g'ri reuse signali → foydalanuvchi chiqib ketadi.
Bu real xavf. Yumshatish: `prev_token_hash` bo'yicha topilgan sessiya **oxirgi
10 soniya ichida** rotatsiya bo'lgan bo'lsa — grace period berish. Bu qo'shimcha
`rotated_at` ustunini talab qiladi. Bu **o'lchov bilan aniqlanadi** — real
foydalanuvchilarda qancha yolg'on signal borligini ko'rmasdan grace oynasini
tanlash mumkin emas.

---

## 4. Sessiyalar

### 4.1. `auth_sessions` — nima saqlanadi

```prisma
// apps/api/prisma/schema.prisma:147-161
model auth_sessions {
  id                 BigInt    @id @default(autoincrement())
  tenant_id          BigInt
  account_type       String    @db.VarChar(20)   // 'STAFF' | 'GUARDIAN'
  user_id            BigInt?                     // STAFF bo'lsa
  student_account_id BigInt?                     // GUARDIAN bo'lsa
  refresh_token_hash String                      // sha256(refreshToken)
  device_info        String?                     // User-Agent
  ip_address         String?
  expires_at         DateTime  @db.Timestamptz(6)
  revoked_at         DateTime? @db.Timestamptz(6)
  created_at         DateTime  @default(now()) @db.Timestamptz(6)
  tenants            tenants   @relation(...)
  users              users?    @relation(...)
}
```

Yaratilishi:

```ts
// apps/api/src/modules/auth/auth.service.ts:326-352
private async createSession(args: {...}): Promise<bigint> {
  const { ip, ua } = this.getIpUa(args.req);

  const s = await this.prisma.auth_sessions.create({
    data: {
      tenant_id: args.tenantId,
      account_type: args.accountType,
      user_id: args.userId ?? null,
      student_account_id: args.studentAccountId ?? null,
      refresh_token_hash: args.refreshTokenHash,
      device_info: ua,
      ip_address: ip,
      expires_at: args.refreshExpiresAt,
    },
    select: { id: true },
  });

  return s.id;
}
```

⚠️ `createSession` **`bigint` qaytaradi** — ya'ni `sessionId` allaqachon mavjud va
ishlatilishi mumkin edi. Lekin `staffLogin:484` da qaytgan qiymat **e'tiborsiz
qoldiriladi**:

```ts
// apps/api/src/modules/auth/auth.service.ts:484-492
await this.createSession({          // ⬅️ qaytgan sessionId olinmaydi
  tenantId,
  accountType: 'STAFF',
  userId: user.id,
  ...
});
```

Token allaqachon `:481-482` da imzolangan, ya'ni `sessionId` ni unga qo'shib
bo'lmaydi. Bu — 2-bo'limdagi kritik topilmaning **mexanik sababi**: tartib
noto'g'ri. Yechim (1.6) tartibni almashtiradi.

`schema.prisma:151-152` — `user_id` va `student_account_id` **ikkalasi ham
nullable**, va DB darajasida "bittasi to'lgan bo'lsin" cheklovi yo'q. Ya'ni
ikkalasi ham `null` bo'lgan sessiya yozilishi mumkin. Kod buni to'g'ri qiladi,
lekin bu — intizom, struktura emas.

```sql
-- Taklif: migratsiyada CHECK constraint
ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_actor_xor CHECK (
    (account_type = 'STAFF'    AND user_id IS NOT NULL AND student_account_id IS NULL)
    OR
    (account_type = 'GUARDIAN' AND student_account_id IS NOT NULL AND user_id IS NULL)
  );
```

### 4.2. ⚠️ `MAX_SESSIONS_PER_USER=10` — MAJBURLANMAYDI

```
# apps/api/.env.example:45-46
MAX_SESSIONS_PER_USER=10
SESSION_INACTIVITY_TIMEOUT=86400
```

**Grep natijasi — butun `apps/` bo'yicha:**

```
apps\api\.env.example:45:MAX_SESSIONS_PER_USER=10
apps\api\.env.example:46:SESSION_INACTIVITY_TIMEOUT=86400
```

**Ikkita natija. Ikkalasi ham `.env.example` ning o'zi.** Kodda birorta ham
`process.env.MAX_SESSIONS_PER_USER` yo'q. `env.validation.ts` da ham yo'q
(`:18-68` — ro'yxatda umuman ko'rinmaydi).

**Ya'ni:**

| Va'da | Haqiqat |
|---|---|
| `MAX_SESSIONS_PER_USER=10` | ❌ Chegara yo'q. Foydalanuvchi 10 000 ta sessiya ochishi mumkin |
| `SESSION_INACTIVITY_TIMEOUT=86400` (24 soat) | ❌ Harakatsizlik timeout'i yo'q. Faqat `expires_at` (30 kun, sirpanadigan) |

Bu kanon 5.1 dagi `tenant.util.ts` bilan **bir xil naqsh**: "himoyaga o'xshagan
o'lik kod — himoyasizlikdan yomonroq". Konfiguratsiyani o'qigan odam
"sessiyalar cheklangan" deb ishonadi. Ular cheklanmagan.

`getActiveSessions` da `take: 20` bor (`auth.service.ts:1509, 1518`) — lekin bu
**ko'rsatish chegarasi**, majburlash emas. 50 ta sessiya bo'lsa, foydalanuvchi
20 tasini ko'radi, qolgan 30 tasi ishlayveradi va UI'da ko'rinmaydi — ya'ni
**ularni bekor qilib ham bo'lmaydi**.

### 4.3. Yechim — sessiya chegarasi va harakatsizlik

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

private maxSessionsPerUser(): number {
  const n = Number(process.env.MAX_SESSIONS_PER_USER || '10');
  return Number.isFinite(n) && n > 0 ? n : 10;
}

private sessionInactivitySeconds(): number {
  const n = Number(process.env.SESSION_INACTIVITY_TIMEOUT || '86400');
  return Number.isFinite(n) && n > 0 ? n : 86400;
}

/**
 * Cap concurrent sessions per account.
 *
 * Without a cap, a leaked credential can be used to open unlimited sessions,
 * and the session list UI (which shows 20) silently hides the rest — meaning
 * the user cannot even see, let alone revoke, what is running as them.
 *
 * Oldest-first eviction: the session a user actually uses gets refreshed and
 * therefore stays young.
 */
private async enforceSessionLimit(args: {
  tenantId: bigint;
  accountType: AccountType;
  userId?: bigint | null;
  studentAccountId?: bigint | null;
}): Promise<void> {
  const max = this.maxSessionsPerUser();

  const where: Prisma.auth_sessionsWhereInput = {
    tenant_id: args.tenantId,
    revoked_at: null,
    expires_at: { gt: now() },
    ...(args.accountType === 'STAFF'
      ? { user_id: args.userId! }
      : { student_account_id: args.studentAccountId! }),
  };

  const active = await this.prisma.auth_sessions.findMany({
    where,
    select: { id: true },
    orderBy: { last_seen_at: 'asc' },
  });

  // -1 because we are about to create one more.
  const excess = active.length - (max - 1);
  if (excess <= 0) return;

  const doomed = active.slice(0, excess).map((s) => s.id);

  await this.prisma.auth_sessions.updateMany({
    where: { id: { in: doomed } },
    data: { revoked_at: now() },
  });

  await this.auditLog({
    tenantId: args.tenantId,
    actorType: 'SYSTEM',
    actorUserId: args.userId ?? undefined,
    actorStudentAccountId: args.studentAccountId ?? undefined,
    action: 'LOGOUT',
    entityType: 'auth_sessions',
    afterData: {
      reason: 'MAX_SESSIONS_EXCEEDED',
      limit: max,
      evicted: doomed.map(String),
    },
  });
}
```

`enforceSessionLimit` **`createSession` dan oldin** chaqiriladi — `staffLogin`,
`guardianLogin`, ikkala `changePassword` da.

**Harakatsizlik timeout'i** — `ensureUser` da tekshiriladi:

```ts
// apps/api/src/common/auth/jwt-request.util.ts — taklif

const inactivityMs = Number(process.env.SESSION_INACTIVITY_TIMEOUT || '86400') * 1000;

const session = await prisma.auth_sessions.findFirst({
  where: { id: sid, revoked_at: null, expires_at: { gt: new Date() } },
  select: { id: true, last_seen_at: true },
});
if (!session) throw new UnauthorizedException('SESSION_REVOKED');

if (Date.now() - session.last_seen_at.getTime() > inactivityMs) {
  await prisma.auth_sessions.update({
    where: { id: session.id },
    data: { revoked_at: new Date() },
  });
  throw new UnauthorizedException('SESSION_INACTIVE');
}

// Throttle the write: updating last_seen_at on every single request would turn
// a read path into a write path. Once a minute is enough resolution for a
// 24-hour timeout.
if (Date.now() - session.last_seen_at.getTime() > 60_000) {
  await prisma.auth_sessions.update({
    where: { id: session.id },
    data: { last_seen_at: new Date() },
  });
}
```

⚠️ **Ishlash e'tibori:** `last_seen_at` yozuvi throttle qilinmasa, har GET so'rov
DB yozuvi bo'ladi. 1 daqiqalik throttle 24 soatlik timeout uchun yetarli
aniqlik beradi. Yuqori yukda buni Redis'ga ko'chirish kerak bo'lishi mumkin —
**o'lchov bilan aniqlanadi.**

### 4.4. Eskirgan sessiyalarni tozalash

Hozir sessiyalar **hech qachon o'chirilmaydi**. `revoked_at` qo'yiladi va qator
abadiy qoladi. Har login = yangi qator. 200 xodim × kuniga 2 login × 250 ish kuni
= yiliga 100 000 qator, index'siz.

```ts
// apps/api/src/modules/auth/auth-cleanup.service.ts — taklif (yangi fayl)

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * auth_sessions, auth_attempts and auth_locks are append-only in practice —
 * nothing ever deletes from them. Left alone they grow without bound, and every
 * refresh does a scan over the result.
 *
 * Retention is deliberately longer than the security window: auth_attempts is
 * evidence, not just rate-limit state.
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    const now = new Date();
    const d = (days: number) => new Date(now.getTime() - days * 86400_000);

    // Sessions: gone 7 days after they stopped being usable.
    const sessions = await this.prisma.auth_sessions.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: d(7) } },
          { revoked_at: { lt: d(7) } },
        ],
      },
    });

    // Attempts: 90 days. This is the audit trail for "was this account being
    // attacked in March" — do not shorten it to match the 1-hour lock window.
    const attempts = await this.prisma.auth_attempts.deleteMany({
      where: { created_at: { lt: d(90) } },
    });

    // Locks: useless once expired.
    const locks = await this.prisma.auth_locks.deleteMany({
      where: { locked_until: { lt: d(1) } },
    });

    this.logger.log(
      `auth cleanup: sessions=${sessions.count} attempts=${attempts.count} locks=${locks.count}`,
    );
  }
}
```

⚠️ Bu `@nestjs/schedule` ni talab qiladi. Agar loyihada u yo'q bo'lsa — bu yangi
bog'liqlik. Muqobil: DB tomonida `pg_cron`, yoki tashqi cron → himoyalangan
endpoint. Qaysi biri — **infratuzilma qaroriga bog'liq, ochiq savol.**

---

## 5. Brute-force himoyasi

### 5.1. Qanday ishlaydi — real mexanizm

Uch qismdan iborat:

**a) Har urinish yoziladi:**

```ts
// apps/api/src/modules/auth/auth.service.ts:205-224
private async logAttempt(
  tenantId: bigint,
  accountType: AccountType,
  usernameOrId: string,
  success: boolean,
  req: Request,
): Promise<void> {
  const { ip, ua } = this.getIpUa(req);

  await this.prisma.auth_attempts.create({
    data: {
      tenant_id: tenantId,
      account_type: accountType,
      username_or_id: usernameOrId,
      success,
      ip_address: ip,      // ⬅️ IP YOZILADI...
      user_agent: ua,
    },
  });
}
```

**b) Chegara oshsa lock qo'yiladi:**

```ts
// apps/api/src/modules/auth/auth.service.ts:226-290
private async maybeLock(
  tenantId: bigint,
  accountType: AccountType,
  usernameOrId: string,
  req: Request,
): Promise<void> {
  const lockConfig = {
    windowHours: 1,          // ⬅️ HARDKOD
    maxAttempts: 5,          // ⬅️ HARDKOD
    lockDurationHours: 3,    // ⬅️ HARDKOD
  };

  const since = addHours(now(), -lockConfig.windowHours);

  const recentFails = await this.prisma.auth_attempts.count({
    where: {
      tenant_id: tenantId,
      account_type: accountType,
      username_or_id: usernameOrId,     // ⬅️ ...LEKIN FILTRDA IP YO'Q
      success: false,
      created_at: { gte: since },
    },
  });

  if (recentFails >= lockConfig.maxAttempts) {
    const lockedUntil = addHours(now(), lockConfig.lockDurationHours);
    const { ip } = this.getIpUa(req);

    await this.auditLog({ /* LOCK_ACCOUNT */ });

    await this.prisma.auth_locks.upsert({
      where: {
        tenant_id_account_type_username_or_id: {
          tenant_id: tenantId,
          account_type: accountType,
          username_or_id: usernameOrId,
        },
      },
      create: { tenant_id: tenantId, account_type: accountType,
                username_or_id: usernameOrId, locked_until: lockedUntil,
                reason: 'TOO_MANY_ATTEMPTS' },
      update: { locked_until: lockedUntil, reason: 'TOO_MANY_ATTEMPTS' },
    });
  }
}
```

**c) Login boshida lock tekshiriladi:**

```ts
// apps/api/src/modules/auth/auth.service.ts:182-203
private async ensureNotLocked(
  tenantId: bigint,
  accountType: AccountType,
  usernameOrId: string,
): Promise<void> {
  const lock = await this.prisma.auth_locks.findUnique({
    where: {
      tenant_id_account_type_username_or_id: {
        tenant_id: tenantId,
        account_type: accountType,
        username_or_id: usernameOrId,
      },
    },
    select: { locked_until: true, reason: true },
  });

  if (lock?.locked_until && lock.locked_until > now()) {
    throw new ForbiddenException(
      `ACCOUNT_LOCKED: ${lock.reason || 'Too many attempts'}`,
    );
  }
}
```

### 5.2. Chegaralar

| Parametr | Qiymat | Sozlanadimi? |
|---|---|---|
| Oyna | 1 soat | ❌ Hardkod (`:234`) |
| Maks urinish | 5 | ❌ Hardkod (`:235`) |
| Lock davomiyligi | 3 soat | ❌ Hardkod (`:236`) |

Uchalasi ham `maybeLock` ichida literal obyekt. `.env.example` da ular uchun
o'zgaruvchi ham yo'q. Ya'ni akademiya "bizda 5 ta kam, 10 qilinglar" desa —
kod o'zgarishi va deploy kerak.

**3 soatlik lock — juda uzun.** Ota-ona parolini uch marta xato yozdi, to'rtinchi
va beshinchisida ham xato qildi → **3 soat kira olmaydi**. Unlock UI yo'q
(13-bo'lim). U administratorga qo'ng'iroq qiladi, administrator... nima qiladi?
`UNLOCK_ACCOUNT` audit action tipi mavjud (`auth.service.ts:31`), lekin
**uni chaqiradigan metod yo'q** — grep bo'yicha `UNLOCK_ACCOUNT` faqat tip
ta'rifida va `audit.util.ts:15` da. Ya'ni unlock qilishning **yagona yo'li —
DB'ga qo'lda kirish yoki 3 soat kutish.**

### 5.3. Redis umuman ishlatilmaydi — va Postgres tanlovi TO'G'RI

Kanon 5.4 da "`auth_attempts`, `auth_locks`, `auth_sessions` — brute-force himoyasi
**+ Redis**" deyilgan. **Bu noto'g'ri edi va kanon tuzatildi.**

O'lchangan fakt:

| Nima izlandi | Natija |
|---|---|
| `redisStore` / `ioredis` importi | **0 ta** |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` kodda o'qilishi | **0 ta** — faqat `.env.example:38-40` da e'lon qilingan |
| `cache-manager-redis-store` (`package.json:37` da **o'rnatilgan**) importi | **0 ta** |
| Yagona kesh | `auth.module.ts:11` — `CacheModule.register({ ttl: 300000, max: 100 })` |

```ts
// apps/api/src/modules/auth/auth.module.ts:11-14
CacheModule.register({
  ttl: 300000, // 5 minutes in milliseconds
  max: 100,
}),
```

**`store` parametri yo'q** → `@nestjs/cache-manager` default'i → **in-memory LRU**.
Ya'ni `cacheManager` — bu Node process xotirasidagi 100 ta yozuvli Map, Redis emas.

Brute-force yo'lida esa (`ensureNotLocked:187`, `maybeLock:269`, `clearLock:297`)
`cacheManager` **umuman chaqirilmaydi** — u sof PostgreSQL.

#### Bu — to'g'ri qaror. Halol tan olinadi.

Lock holatini Postgres'da saqlash **ataylab to'g'ri**, va sabablari jiddiy:

| Sabab | Izoh |
|---|---|
| **Restart'dan omon qoladi** | Redis'da TTL bilan yotgan lock — Redis qayta ishga tushsa **yo'qoladi**. Hujumchi 3 soatlik lock oldi, Redis restart bo'ldi, lock yo'q. Postgres'da lock joyida qoladi |
| **Instance'lar orasida to'g'ri** | Bitta haqiqat manbai. Ikkita API instance bir xil lock holatini ko'radi |
| **Ikkinchi infratuzilma qismi kerak emas** | Redis o'chsa — login **butunlay ishlamay qolmaydi**. Postgres allaqachon kritik bog'liqlik, u ham o'chsa baribir hech narsa ishlamaydi. Ya'ni yangi nosozlik nuqtasi qo'shilmaydi |
| **Bu evidence, faqat holat emas** | `auth_attempts` — "mart oyida bu hisobga hujum bo'lganmi?" savoliga javob. Bu Redis'da 1 soatlik TTL bilan yashamasligi kerak |

Ko'p loyiha buni Redis'ga qo'yadi va **restart'da barcha lock'ni yo'qotadi**. Bu
yerda yo'qolmaydi. **Bu ayb emas, xizmat.**

#### Muammo — `.env.example` yolg'on gapiryapti

```
# apps/api/.env.example:38-40
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

Bu uch qator **mavjud bo'lmagan infratuzilmani va'da qiladi**. Yangi dasturchi
Redis konteynerini ko'taradi, ulaydi, `.env` ni to'ldiradi — va u **hech narsa
qilmaydi**. `package.json:37` dagi `cache-manager-redis-store` bog'liqligi bu
illyuziyani kuchaytiradi: paket bor, demak ishlatilyapti deb o'ylash tabiiy.

Bu — `RATE_LIMIT_*` (5.5) bilan **bir xil naqsh** va 0-bo'limdagi umumiy mavzuning
bir qismi: **sozlama bor, majburlash yo'q.**

**Qaror kerak** — ikkitadan biri, uchinchisi yo'q:

| Variant | Nima qilinadi | Qachon to'g'ri |
|---|---|---|
| **A. Redis'ni olib tashlash** | `.env.example:38-40` va `package.json:37` o'chiriladi. Kesh in-memory qoladi | Agar bitta instance abadiy yetarli bo'lsa |
| **B. Redis'ni haqiqatan ulash** | `CacheModule.registerAsync` + `redisStore`; rate limiting uchun ham (5.6) | Agar gorizontal masshtablash rejada bo'lsa |

**Tavsiya: B** — lekin brute-force lock'lari **Postgres'da qoldiriladi**. Redis
faqat ikki narsa uchun: (1) ruxsat keshi (5.4 dagi muammoni hal qiladi),
(2) rate limiting counter'lari (5.6). Ya'ni Redis — **tezlik uchun**, haqiqat
uchun emas. Yo'qolsa, xavfsizlik buzilmaydi.

#### ⚠️ In-memory kesh — yashirin masshtablash sharti

`invalidateUserCache` (`auth.service.ts:397-399`) ruxsat keshini tozalaydi:

```ts
private async invalidateUserCache(userId: bigint): Promise<void> {
  await this.cacheManager.del(`user:${userId}:roles_perms`);
}
```

Kesh **in-memory** ekan, bu **faqat o'z process'ida** tozalaydi.

**Oqibat — ikkinchi instance ko'tarilgan kuni:**

```
Instance A: admin xodimning huquqini olib tashlaydi
            → user_roles dan o'chdi
            → invalidateUserCache() → A ning xotirasi tozalandi

Instance B: xodimning keshi HALI HAM ESKI (5 daqiqagacha)
            → xodim load balancer orqali B ga tushadi
            → yangi token oladi — ESKI ruxsatlar bilan
            → 5 daqiqa + 15 daqiqa (token TTL) ishlayveradi
```

Bu **eng yomon vaqtda** bo'ladi: kimnidir **shoshilinch bloklash** kerak bo'lganda —
ya'ni xavfsizlik hodisasi paytida.

**Hozir bag emas** — bitta instance ishlayapti. Lekin bu **yashirin shart**:
"tizim gorizontal masshtablanmaydi" degan gap **hech qayerda yozilmagan**, va
masshtablangan kuni bu **jimgina** buziladi. Hech kim buni bog'lay olmaydi.

**Yechim** — B variantidagi Redis kesh:

```ts
// apps/api/src/modules/auth/auth.module.ts — taklif
import { redisStore } from 'cache-manager-redis-store';

/**
 * Redis-backed, not in-memory.
 *
 * invalidateUserCache() only clears the process it runs in. With one instance
 * that is invisible; with two, revoking someone's permissions leaves them live
 * on the other instance for up to `ttl` — precisely when you are trying to cut
 * someone off in a hurry.
 *
 * Redis here is a speed layer, not a source of truth: if it is down, roles are
 * read from Postgres. Auth locks deliberately stay in Postgres — they must
 * survive a Redis restart.
 */
CacheModule.registerAsync({
  isGlobal: false,
  useFactory: async () => ({
    store: await redisStore({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    }),
    ttl: 300_000,
  }),
}),
```

⚠️ Va `user-roles.service.ts:73-74` dagi **izohga olingan** invalidatsiya
tiklanishi shart — aks holda Redis kesh ham noto'g'ri qoladi (7-bo'lim).

#### Index yo'qligi

`auth_attempts` da **index yo'q** (`schema.prisma:122-132`). `maybeLock:240-248`
dagi `count` — **har muvaffaqiyatsiz login'da full scan**, va jadval hech qachon
tozalanmaydi (4.4). Ya'ni brute-force himoyasining o'zi vaqt o'tishi bilan
brute-force hujumini **qimmatlashtiradi... serverga**. Indexlar 5.6 da.

### 5.4. 🔴 Lock user bo'yicha, IP bo'yicha emas — account lockout DoS

**Javob: faqat user bo'yicha.** `auth_locks` unique kaliti:

```prisma
// apps/api/prisma/schema.prisma:144
@@unique([tenant_id, account_type, username_or_id])
```

IP bu kalitda yo'q. `maybeLock:240-248` dagi `count` filtrida ham IP yo'q,
garchi `logAttempt:219` uni **yozib qo'ygan** bo'lsa ham. Ya'ni ma'lumot bor,
lekin ishlatilmaydi.

**Hujum 1 — maqsadli DoS:**

```
Hujumchi biladi: tenant = "mathacademy", username = "admin"
(username'lar taxmin qilinadigan: seed.ts:456-465 → teacher.azimov,
 teacher.rahimova, ... — familiya asosida. Akademiya sayti o'qituvchilar
 ro'yxatini chop etsa, username'lar ham ma'lum bo'ladi.)

POST /api/auth/staff/login {tenantSlug: "mathacademy", username: "admin",
                            password: "x"}  × 5

→ auth_locks: admin, locked_until = now + 3h
→ ADMIN 3 SOAT KIRA OLMAYDI.
```

Hujumchi **parolni bilishi shart emas.** Bir necha so'rov — va odam ishlay olmaydi.
Takrorlash mumkin: har 3 soatda 5 ta so'rov = **doimiy blok.**

**Hujum 2 — butun akademiyani o'chirish:**

`seed.ts:455-466` da username naqshi aniq: `teacher.<familiya>`. 10 ta o'qituvchi.
Skript:

```
for user in [admin, teacher.azimov, teacher.rahimova, ..., demo.teacher]:
    for i in 1..5:
        POST /api/auth/staff/login {username: user, password: "x"}
```

**~60 ta so'rov → butun xodimlar tarkibi 3 soat kira olmaydi.** Imtihon kuni,
baho qo'yish kuni, ota-onalar yig'ilishi kuni.

**Hujum 3 — ota-onalar:**

Guardian login ID formati oshkor: `mathacademy-MA-0001`. `MA-0001` dan
`MA-9999` gacha — **ketma-ket** (`student_id_sequences`, kanon 4.2).

```
for n in 1..500:
    for i in 1..5:
        POST /api/auth/guardian/login {studentId: f"mathacademy-MA-{n:04d}",
                                        password: "x"}
```

**2500 so'rov → 500 ta ota-ona 3 soat kira olmaydi.** Va rate limiting yo'q
(5.5), ya'ni bu 2500 so'rovni **bir necha soniyada** yuborsa bo'ladi.

**Va teskari tomon — lock hujumchini to'xtatmaydi:**

Lock user bo'yicha bo'lgani uchun, hujumchi **bir userga 5 ta parol** o'rniga
**1000 userga 5 tadan parol** sinaydi (password spraying). Har user o'z
chegarasida qoladi, lock hech qachon ishlamaydi, hujumchi soatiga **5000
urinish** qiladi. Eng ommabop parollar (`123456`, `parol123`, `Ustoz@20XX!`)
bilan — `MIN_PASSWORD_LENGTH=6` va complexity yo'qligini hisobga olsak
(11-bo'lim) — bu hujum **ishlaydi**.

Ya'ni hozirgi lock: **qonuniy foydalanuvchini bloklashda samarali, hujumchini
to'xtatishda samarasiz.** Bu — eng yomon kombinatsiya.

### 5.5. 🔴 Rate limiting umuman yo'q

```
# .env.example:34-35
RATE_LIMIT_TTL="60"
RATE_LIMIT_MAX="100"
```

**Grep — butun `apps/api/src`:**

```
Pattern: Throttler|@nestjs/throttler|RATE_LIMIT
No matches found
```

**Nol natija.** `@nestjs/throttler` o'rnatilmagan yoki ishlatilmagan.
`RATE_LIMIT_TTL` va `RATE_LIMIT_MAX` — yana **o'lik config**.

Ya'ni **hech qanday endpoint'da hech qanday so'rov chegarasi yo'q.** Login
endpoint'iga soniyasiga 10 000 so'rov yuborish mumkin. Yagona himoya —
account lock, u esa (5.4) hujumchini emas, qurbonni to'xtatadi.

⚠️ Bu bcrypt bilan birga **CPU DoS** ham beradi: har login urinishi cost-12
bcrypt = ~300ms CPU. 100 parallel so'rov → server band. Autentifikatsiyasiz.

### 5.6. Yechim — ikki o'lchovli chegaralash

**Tamoyil:** ikki xil chegara kerak, chunki ikki xil hujum bor.

| Hujum | Nima kerak | Nima qiladi |
|---|---|---|
| Bir userga ko'p parol | **User-scoped lock** | Hozir bor |
| Ko'p userga bir parol (spraying) | **IP-scoped limit** | Yo'q |
| Bir userga DoS | **IP-scoped limit + user lock'ni yumshatish** | Yo'q |

**a) Sxema — IP o'lchovi:**

```prisma
// apps/api/prisma/schema.prisma — taklif

model auth_locks {
  id             BigInt   @id @default(autoincrement())
  tenant_id      BigInt
  account_type   String   @db.VarChar(20)
  username_or_id String
  locked_until   DateTime @db.Timestamptz(6)
  reason         String?
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  /// Scope of the lock.
  ///
  /// 'USER' locks an account regardless of source — the classic behaviour, and
  /// the one an attacker can weaponise to lock a real person out. Kept, but
  /// short.
  ///
  /// 'IP' locks a source address regardless of which account it targets. This
  /// is what actually stops password spraying: an attacker cycling through 500
  /// student IDs stays under every per-user limit but trips this one.
  lock_scope     String   @default("USER") @db.VarChar(10)

  /// Set for lock_scope = 'IP'. Null for 'USER'.
  ip_address     String?

  tenants        tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([tenant_id, account_type, username_or_id, lock_scope, ip_address])
  @@index([tenant_id, ip_address, locked_until])
  @@index([locked_until])
}

model auth_attempts {
  id             BigInt   @id @default(autoincrement())
  tenant_id      BigInt
  account_type   String   @db.VarChar(20)
  username_or_id String
  success        Boolean
  ip_address     String?
  user_agent     String?
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  tenants        tenants  @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  // maybeLock() counts by (tenant, type, username, success, created_at) on
  // every failed login. Without these it is a sequential scan over a table
  // that only grows.
  @@index([tenant_id, account_type, username_or_id, created_at])
  @@index([tenant_id, ip_address, created_at])
}
```

**b) Servis:**

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

/**
 * Brute-force thresholds.
 *
 * Two dimensions, because there are two different attacks:
 *
 *  - USER scope stops "many passwords against one account". It is also the
 *    dimension an attacker abuses to lock a real person out, so the lock is
 *    deliberately SHORT (15m, not 3h) and the failure count is generous.
 *
 *  - IP scope stops "one password against many accounts" (spraying), which the
 *    user-scoped lock cannot see at all: 500 accounts × 4 attempts each never
 *    trips a per-user limit.
 *
 * Numbers below are a starting point, not a measured optimum. They must be
 * tuned against real traffic — see "Ochiq savollar".
 */
private lockPolicy() {
  return {
    user: {
      windowMinutes: Number(process.env.LOCK_USER_WINDOW_MIN || '15'),
      maxAttempts: Number(process.env.LOCK_USER_MAX_ATTEMPTS || '10'),
      lockMinutes: Number(process.env.LOCK_USER_DURATION_MIN || '15'),
    },
    ip: {
      windowMinutes: Number(process.env.LOCK_IP_WINDOW_MIN || '15'),
      maxAttempts: Number(process.env.LOCK_IP_MAX_ATTEMPTS || '30'),
      lockMinutes: Number(process.env.LOCK_IP_DURATION_MIN || '60'),
    },
  };
}

private async ensureNotLocked(
  tenantId: bigint,
  accountType: AccountType,
  usernameOrId: string,
  req: Request,
): Promise<void> {
  const { ip } = this.getIpUa(req);

  const locks = await this.prisma.auth_locks.findMany({
    where: {
      tenant_id: tenantId,
      account_type: accountType,
      locked_until: { gt: now() },
      OR: [
        { lock_scope: 'USER', username_or_id: usernameOrId },
        ...(ip ? [{ lock_scope: 'IP', ip_address: ip }] : []),
      ],
    },
    select: { lock_scope: true, locked_until: true, reason: true },
  });

  if (locks.length === 0) return;

  // Do not tell the caller which dimension tripped. "Your IP is blocked" tells
  // an attacker to rotate IPs; "this account is locked" confirms the account
  // exists. One opaque message for both.
  throw new ForbiddenException('ACCOUNT_LOCKED: Too many attempts');
}

private async maybeLock(
  tenantId: bigint,
  accountType: AccountType,
  usernameOrId: string,
  req: Request,
): Promise<void> {
  const policy = this.lockPolicy();
  const { ip } = this.getIpUa(req);

  // ── USER dimension ────────────────────────────────────────────────────
  const userSince = new Date(now().getTime() - policy.user.windowMinutes * 60_000);
  const userFails = await this.prisma.auth_attempts.count({
    where: {
      tenant_id: tenantId,
      account_type: accountType,
      username_or_id: usernameOrId,
      success: false,
      created_at: { gte: userSince },
    },
  });

  if (userFails >= policy.user.maxAttempts) {
    await this.upsertLock({
      tenantId, accountType, usernameOrId,
      scope: 'USER', ipAddress: null,
      lockedUntil: new Date(now().getTime() + policy.user.lockMinutes * 60_000),
      reason: 'TOO_MANY_ATTEMPTS_USER',
      attempts: userFails,
      actorIp: ip,
    });
  }

  // ── IP dimension ──────────────────────────────────────────────────────
  if (!ip) return;

  const ipSince = new Date(now().getTime() - policy.ip.windowMinutes * 60_000);
  const ipFails = await this.prisma.auth_attempts.count({
    where: {
      tenant_id: tenantId,
      ip_address: ip,
      success: false,
      created_at: { gte: ipSince },
      // Deliberately NOT filtered by username — counting across accounts is
      // the entire point.
    },
  });

  if (ipFails >= policy.ip.maxAttempts) {
    await this.upsertLock({
      tenantId, accountType, usernameOrId: '*',
      scope: 'IP', ipAddress: ip,
      lockedUntil: new Date(now().getTime() + policy.ip.lockMinutes * 60_000),
      reason: 'TOO_MANY_ATTEMPTS_IP',
      attempts: ipFails,
      actorIp: ip,
    });
  }
}
```

**c) Rate limiting — Redis backed:**

```ts
// apps/api/src/app.module.ts — taklif

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

@Module({
  imports: [
    /**
     * Rate limiting is the layer that must hold BEFORE account locking is even
     * reached. Without it, an attacker can issue thousands of login attempts
     * per second — and because each one runs a cost-12 bcrypt (~300ms of CPU),
     * that alone is a denial-of-service against the API.
     *
     * Redis-backed, not in-memory: an in-memory counter resets on deploy and
     * is per-process, i.e. useless behind more than one instance.
     */
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: Number(process.env.RATE_LIMIT_TTL || 60) * 1000,
          limit: Number(process.env.RATE_LIMIT_MAX || 100) },
      ],
      storage: new ThrottlerStorageRedisService({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

Va login endpoint'lariga qattiqroq chegara:

```ts
// apps/api/src/modules/auth/auth.controller.ts — taklif

import { Throttle } from '@nestjs/throttler';

/**
 * 10 attempts per minute per IP. Well above what a human typing a password
 * needs, well below what a credential-stuffing script wants.
 */
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Post('staff/login')
staffLogin(@Body() dto: StaffLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
  return this.auth.staffLogin(dto, req, res);
}
```

⚠️ **`X-Forwarded-For` ishonchi.** `getIpUa` (`auth.service.ts:130-137`)
header'ni **shartsiz** ishonadi:

```ts
const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
const ip = xf || req.ip || null;
```

Hujumchi `X-Forwarded-For: 1.2.3.4` yuborib **har so'rovda boshqa IP** ko'rsatishi
mumkin → IP-scoped chegara **butunlay chetlab o'tiladi**. Va yomoni: u
`X-Forwarded-For: <qurbonning IP'si>` yuborib **qurbonni bloklaydi**.

**Bu IP-scoped chegarani joriy qilishdan OLDIN tuzatilishi shart:**

```ts
// apps/api/src/main.ts — taklif

/**
 * Trust X-Forwarded-For only from our own proxy.
 *
 * Express does not validate this header. Without `trust proxy` scoped to the
 * real proxy, any client can claim any IP — which turns IP-based rate limiting
 * from a defence into a weapon (spoof the victim's IP, get them blocked).
 *
 * The number is the count of proxies in front of the app. Set it to match the
 * actual deployment; guessing here is how the spoof gets through.
 */
app.set('trust proxy', Number(process.env.TRUSTED_PROXY_HOPS || 1));
```

va `getIpUa` ni `req.ip` ga o'tkazish (Express `trust proxy` bilan XFF'ni
o'zi to'g'ri parse qiladi):

```ts
private getIpUa(req: Request): { ip: string | null; ua: string | null } {
  // req.ip already honours `trust proxy`. Reading X-Forwarded-For by hand
  // bypasses that check and trusts whatever the client sent.
  return {
    ip: req.ip || null,
    ua: (req.headers['user-agent'] as string) || null,
  };
}
```

⚠️ `TRUSTED_PROXY_HOPS` ni to'g'ri qo'yish — **deploy topologiyasiga bog'liq**
(nginx? Cloudflare? ikkalasi?). Noto'g'ri qiymat himoyani buzadi. Bu — ochiq
savol.

---

## 6. Guardian autentifikatsiyasi

### 6.1. Format va parsing

Ota-ona tizimga **o'quvchi identifikatori** bilan kiradi. Format:

```
mathacademy-MA-0001
└────┬────┘ └──┬──┘
   tenant    o'quvchi
```

Parsing kodi:

```ts
// apps/api/src/modules/auth/auth.service.ts:62-72
function parseGuardianLogin(
  studentId: string,
): { tenantSlug: string; loginId: string; raw: string } | null {
  const s = String(studentId || '').trim();
  const idx = s.indexOf('-');                    // ⬅️ BIRINCHI tire
  if (idx <= 0 || idx === s.length - 1) return null;
  const tenantSlug = s.slice(0, idx).trim().toLowerCase();
  const loginId = s.slice(idx + 1).trim();
  if (!tenantSlug || !loginId) return null;
  return { tenantSlug, loginId, raw: s };
}
```

**`indexOf('-')` — birinchi tire bo'yicha ajratish.** Kanon 4.2 buni "real bag edi"
deb qayd etadi va **to'g'ri qayd etadi**: `mathacademy-MA-0001` ni **oxirgi** tire
bo'yicha ajratsangiz `tenantSlug = "mathacademy-MA"`, `loginId = "0001"` chiqadi —
tenant topilmaydi. Ya'ni birinchi tire — `MA-0001` kabi ID uchun **yagona to'g'ri
tanlov**.

Chegara tekshiruvlari ham to'g'ri:

| Kirish | `idx` | Natija |
|---|---|---|
| `-MA-0001` | `0` | ❌ `idx <= 0` → `null` (bo'sh slug) |
| `mathacademy-` | oxirgi belgi | ❌ `idx === s.length - 1` → `null` (bo'sh ID) |
| `mathacademyMA0001` | `-1` | ❌ `idx <= 0` → `null` (tire yo'q) |

### 6.2. 🔴 VIZYONNI TO'SUVCHI BAG — slug'da tire

Kanon 7: vizyon — "bitta akademiya uchun SIS" → "**O'zbekiston tayyorlov
akademiyalari uchun mahsulot**". Ya'ni ko'p tenant. Endi tenant qanday
yaratilishiga qaraymiz:

```ts
// apps/api/src/modules/tenants/dto/create-tenant.dto.ts:17-27
@ApiProperty({
  example: 'mathacademy',
  description: 'Unique slug (lowercase, numbers, hyphens)',
})
@IsString()
@MinLength(2)
@MaxLength(50)
@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: 'slug must be lowercase, numbers, and hyphens only',
})
slug!: string;
```

**Regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` — tire RUXSAT ETADI.** Va tavsif buni ochiq
aytadi: *"lowercase, numbers, **hyphens**"*.

Endi ikkalasini birlashtiring:

```
1. Superadmin yangi akademiya qo'shadi:
   POST /api/system/tenants  { name: "Math Academy", slug: "math-academy" }
   → create-tenant.dto.ts:24 regex: ✅ O'TADI
   → tenants jadvaliga yoziladi. Hammasi joyida ko'rinadi.

2. O'sha akademiyaning ota-onasi kirmoqchi:
   POST /api/auth/guardian/login { studentId: "math-academy-MA-0001", ... }

3. parseGuardianLogin("math-academy-MA-0001"):
   idx = s.indexOf('-')  →  4        ("math" dan keyingi tire)
   tenantSlug = "math"               ⬅️ ❌ NOTO'G'RI
   loginId    = "academy-MA-0001"    ⬅️ ❌ NOTO'G'RI

4. getTenantIdBySlugOrThrow("math")
   → tenants.findUnique({ where: { slug: "math" } })  →  null
   → throw UnauthorizedException('TENANT_NOT_FOUND')

5. NATIJA: o'sha akademiyaning BIRORTA HAM ota-onasi
   HECH QACHON tizimga kira olmaydi.
```

**Bu — vizyonni to'sadigan bag.** Bitta tenant (`mathacademy` — tiresiz) bilan u
**ko'rinmaydi**. Ikkinchi akademiya qo'shilgan kuni — agar uning slug'ida tire
bo'lsa — **butun guardian portali o'sha tenant uchun o'lik**. Va xato xabari
(`TENANT_NOT_FOUND`) sababni **umuman ko'rsatmaydi**: administrator "tenant bor-ku,
nega topilmayapti?" deb qoladi.

⚠️ **Va DTO buni ushlamaydi:**

```ts
// apps/api/src/modules/auth/dto/guardian-login.dto.ts:23-25
@Matches(/^[a-z][a-z0-9]*-[A-Za-z0-9][A-Za-z0-9-]*$/, {
  message: 'studentId must be like mathacademy-MA-0001',
})
studentId!: string;
```

`math-academy-MA-0001` ni bu regex bilan tekshiring:

| Qism | Regex bo'lagi | Moslik |
|---|---|---|
| `math` | `[a-z][a-z0-9]*` | ✅ |
| `-` | `-` | ✅ |
| `academy-MA-0001` | `[A-Za-z0-9][A-Za-z0-9-]*` | ✅ |

**Regex O'TADI.** Ya'ni DTO validatsiyasi hech narsa demaydi, so'rov
`parseGuardianLogin` ga yetib boradi va **jimgina noto'g'ri ajratiladi**.
Validatsiya qatlami bu yerda **himoya emas, illyuziya**.

#### Nega bu bagni tuzatish qiyin — haqiqiy dilemma

Muammoning ildizi: **`<slug>-<id>` formatida ikkala tomon ham tire ishlatishi
mumkin**, va tire — ajratuvchi. Bu — **ikki ma'noli grammatika**.

| Yechim | `mathacademy-MA-0001` | `math-academy-MA-0001` | Baho |
|---|---|---|---|
| Birinchi tire (hozirgi) | ✅ | ❌ slug=`math` | Slug'da tire bo'lmasa ishlaydi |
| Oxirgi tire | ❌ slug=`mathacademy-MA` | ❌ slug=`math-academy-MA` | **Yomonroq** |

Ya'ni "oxirgi tire bo'yicha ajratamiz" — bu **yechim emas**, kanon 4.2 dagi
bagning teskarisi. Hozirgi kod ikki yomondan **yaxshiroq**ini tanlagan.

#### Yechim variantlari

**Variant A — slug'da tireni taqiqlash** (eng arzon):

```ts
// apps/api/src/modules/tenants/dto/create-tenant.dto.ts — taklif

@ApiProperty({
  example: 'mathacademy',
  description: 'Unique slug (lowercase letters and numbers, no hyphens)',
})
@IsString()
@MinLength(2)
@MaxLength(50)
/**
 * No hyphens — deliberately.
 *
 * Guardian logins are "<slug>-<studentLoginId>" and are split on the FIRST
 * hyphen (auth.service.ts:62-72), because student IDs themselves contain one
 * ("MA-0001"). If the slug may also contain a hyphen the format is ambiguous:
 * "math-academy-MA-0001" splits into slug "math", which does not exist, and
 * every guardian of that tenant is locked out permanently.
 *
 * Splitting on the last hyphen does not fix this — it breaks "MA-0001" instead.
 * The only robust fix at this layer is to keep the separator out of the slug.
 */
@Matches(/^[a-z0-9]+$/, {
  message:
    'slug must contain only lowercase letters and numbers — no hyphens. ' +
    'Hyphens break guardian login (<slug>-<studentId>).',
})
slug!: string;
```

- ✅ Bir qatorlik o'zgarish, migratsiya deyarli yo'q
- ✅ Bag **strukturaviy imkonsiz** bo'ladi
- ⚠️ Mavjud tenantlarni tekshirish kerak
- ❌ `math-academy` xohlagan akademiya `mathacademy` bilan kelishadi — UX cheklovi

**Variant B — ajratuvchini o'zgartirish** (`mathacademy_MA-0001`):

- ✅ Slug'da tire erkin
- ❌ **Buzuvchi o'zgarish** — barcha mavjud ota-onalar formatni qayta o'rganadi
- ❌ `_` telefon klaviaturasida noqulay

**Variant C — tenant'ni login'dan butunlay olib tashlash:**

Subdomain (`mathacademy.app.uz`) yoki login sahifasida tenant tanlash. Ota-ona
faqat `MA-0001` yozadi.

- ✅ Format bir ma'noli bo'ladi
- ✅ Tenant enumeration muammosi ham yo'qoladi (6.3)
- ✅ Eng toza arxitektura
- ❌ Frontend + deploy o'zgarishi (subdomain routing, DNS, sertifikat) — eng qimmat

**Tavsiya: A hozir + C keyin.**

**A** — chunki bu **bir qatorlik** o'zgarish va bagni **darhol** yopadi. Vizyon
(ko'p akademiya) A'siz **ishlamaydi**: A'ni qilmasdan ikkinchi tenant qo'shish —
vaqt bombasi.

**C** — chunki uzoq muddatda `<slug>-<id>` formati baribir noqulay: ota-ona
akademiya slug'ini yodlashi kerak, va u tenant enumeration yuzasini ochadi.
Lekin C **vizyonni to'smaydi**, ya'ni shoshilinch emas.

⚠️ **A'ni joriy qilishdan oldin majburiy tekshiruv:**

```sql
-- Mavjud tenantlarda tire bormi? Agar bo'lsa, ular ALLAQACHON buzilgan
-- (o'sha tenantning ota-onalari kira olmayapti) va migratsiya kerak.
SELECT id, slug, name FROM tenants WHERE slug LIKE '%-%';
```

Natija bo'sh bo'lsa — A'ni xotirjam qo'llash mumkin. Bo'sh bo'lmasa — o'sha
tenantlar uchun slug o'zgartirish + ota-onalarga xabar kerak. **Bu SQL o'zgarish
kiritishdan oldin ishga tushirilsin.**

### 6.3. Tenant enumeration — hujumchi akademiyalar ro'yxatini tuza oladimi?

**Javob: HA.** Xato xabarlari farq qiladi:

```ts
// apps/api/src/modules/auth/auth.service.ts:139-146
private async getTenantIdBySlugOrThrow(tenantSlug: string): Promise<bigint> {
  const t = await this.prisma.tenants.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!t) throw new UnauthorizedException('TENANT_NOT_FOUND');   // ⬅️ ORACLE
  return t.id;
}
```

Taqqoslang:

| So'rov | Javob |
|---|---|
| `{ studentId: "yoqakademiya-MA-0001" }` | `401 TENANT_NOT_FOUND` |
| `{ studentId: "mathacademy-MA-9999" }` | `401 INVALID_CREDENTIALS` |

**Ikki xil xabar = oracle.** Hujumchi lug'at bilan yuguradi va
`INVALID_CREDENTIALS` qaytargan har bir slug — **mavjud akademiya**. Rate limiting
yo'qligi (5.5) buni **cheksiz tez** qiladi. Xuddi shu narsa staff login'da ham
(`auth.service.ts:416`).

**Bu qanchalik jiddiy?** Halol baho: **past**.

- Tenant slug'lari **sir emas** — akademiya nomi ommaviy, u marketing qiladi
- Slug login sahifasida yoziladi, ya'ni har bir ota-ona uni biladi

Ya'ni bu **maxfiylik buzilishi emas**. Lekin ikkita real oqibati bor:

1. **Hujum yuzasini xaritalash.** Hujumchi qaysi akademiyalar tizimda ekanini
   biladi → 5.4 dagi account lockout DoS uchun **nishonlar ro'yxati** tayyor
2. **Biznes ma'lumoti oqishi.** Raqobatchi `mathacademy` mahsulotidan qaysi
   akademiyalar foydalanayotganini bir skript bilan biladi — SaaS uchun bu
   **mijozlar ro'yxati**

**Yechim — xabarlarni birlashtirish:**

```ts
// apps/api/src/modules/auth/auth.service.ts — taklif

/**
 * Resolve a tenant slug, or null.
 *
 * Deliberately does NOT throw a distinguishable error. Returning
 * TENANT_NOT_FOUND for an unknown slug and INVALID_CREDENTIALS for a known one
 * turns the login endpoint into a tenant-enumeration oracle: a dictionary run
 * maps out every academy on the platform — both a customer list and a target
 * list for the account-lockout DoS.
 *
 * Callers must fold this into the same INVALID_CREDENTIALS path — and must
 * still burn the same bcrypt time (see verifyPassword), or timing re-opens the
 * oracle that the message change just closed.
 */
private async findTenantIdBySlug(tenantSlug: string): Promise<bigint | null> {
  if (!tenantSlug) return null;
  const t = await this.prisma.tenants.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  return t?.id ?? null;
}
```

Va login'da:

```ts
const tenantId = await this.findTenantIdBySlug(tenantSlug);

// No early return. An unknown tenant must cost the same as a wrong password —
// same message, same latency.
const user = tenantId
  ? await this.prisma.users.findFirst({
      where: { tenant_id: tenantId, username },
      select: { id: true, password_hash: true, is_active: true, full_name: true, username: true },
    })
  : null;

const passwordMatch = await this.verifyPassword(String(dto.password), user?.password_hash);

if (!tenantId || !user || !user.is_active || !passwordMatch) {
  if (tenantId) {
    await this.logAttempt(tenantId, 'STAFF', username, false, req);
    await this.maybeLock(tenantId, 'STAFF', username, req);
  }
  throw new UnauthorizedException('INVALID_CREDENTIALS');
}
```

⚠️ **Diqqat — bu 1.4 dagi timing tuzatishisiz ishlamaydi.** Xabarni birlashtirib,
lekin `bcrypt.compare` ni o'tkazib yuborsangiz, oracle **vaqt orqali** qoladi:
noma'lum tenant ~5ms, ma'lum tenant ~300ms. Ikkalasi **birga** qilinadi.

⚠️ **Yon ta'sir — noma'lum tenant uchun lock yozib bo'lmaydi.** `auth_attempts`
va `auth_locks` da `tenant_id` **majburiy** (`schema.prisma:124, 136`) va tenant'ga
FK bilan bog'langan. Ya'ni noma'lum tenant'ga urinishlar **hech qayerda qayd
qilinmaydi** — ular rate limiting (5.5) bilan ushlanadi, lock bilan emas. Bu —
qabul qilinadigan cheklov, lekin **bilib turilsin**.

### 6.4. ⚠️ O'quvchi ID formati — to'rtta har xil haqiqat

Kanon 4.2 `mathacademy-MA-0001` deydi. Kod nima deydi?

```ts
// apps/api/src/modules/students/students.service.ts:48-50
function generateStudentLoginId(lastSeq: number): string {
  return String(lastSeq).padStart(6, '0');       // ⬅️ "000123"
}
```

```ts
// apps/api/prisma/seed.ts — seed esa boshqacha
// student_login_id: `MA-${String(n).padStart(4, '0')}`   →  "MA-0001"
```

```ts
// apps/api/src/modules/auth/dto/guardian-login.dto.ts:15-25
@ApiProperty({
  example: 'mathacademy-000123',                        // ⬅️ 1-format: raqamlar
  description: 'StudentID format: <tenantSlug>-<studentLoginId>',
  pattern: '^[a-z0-9-]+-\\d+$',                         // ⬅️ 2-format: FAQAT raqam
})
@Matches(/^[a-z][a-z0-9]*-[A-Za-z0-9][A-Za-z0-9-]*$/, { // ⬅️ 3-format: harf ham
  message: 'studentId must be like mathacademy-MA-0001',// ⬅️ 4-format: MA-0001
})
studentId!: string;
```

**Bitta DTO ichida to'rtta bir-biriga zid ta'rif:**

| Manba | `mathacademy-000123`? | `mathacademy-MA-0001`? |
|---|---|---|
| `example` | ✅ ko'rsatilgan | — |
| Swagger `pattern` `^[a-z0-9-]+-\d+$` | ✅ | ❌ **rad etadi** |
| `@Matches` regex | ✅ | ✅ |
| `@Matches` message | — | ✅ ko'rsatilgan |

Swagger `pattern` va `@Matches` **kelishmaydi**. Amalda `@Matches` ishlaydi
(`pattern` — faqat hujjat), ya'ni ikkalasi ham o'tadi. Lekin Swagger'dan kod
generatsiya qilgan mijoz `MA-0001` ni **rad etadi**.

**Va eng muhimi — real o'quvchilar qaysi formatda?**

- **Seed'dan kelgan demo ma'lumot:** `mathacademy-MA-0001`
- **API orqali yaratilgan real o'quvchi:** `mathacademy-000123`

Kanon 4.2 **seed formatini** kanon deb e'lon qilgan, lekin **real kod boshqa
format ishlab chiqaradi**. Bu — hujjat bilan kod orasidagi ziddiyat, va u
`.env.example` ziddiyati bilan **bir xil toifada**.

⚠️ **Amaliy oqibat:** frontend login sahifasida placeholder `mathacademy-MA-0001`
bo'lsa, real ota-ona `mathacademy-000123` yozishi kerak — va u nima yozishni
bilmaydi. Bu — **qo'llab-quvvatlashga qo'ng'iroq**.

**Kerak:** bitta format tanlansin va **yagona funksiyada** jamlansin:

```ts
// apps/api/src/common/utils/student-id.util.ts — taklif (yangi fayl)

/**
 * Single source of truth for student login IDs.
 *
 * Today there are three: students.service.ts generates "000123",
 * prisma/seed.ts generates "MA-0001", and guardian-login.dto.ts documents a
 * fourth thing in its Swagger `pattern`. A parent cannot be told which one to
 * type, because it depends on whether their record came from the seed or the
 * API.
 *
 * The prefix stays configurable per tenant (some academies will want their own),
 * but the FORMAT is fixed here and nowhere else.
 */
export const STUDENT_ID_PREFIX_DEFAULT = 'MA';

export function formatStudentLoginId(seq: number, prefix = STUDENT_ID_PREFIX_DEFAULT): string {
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/** Must match formatStudentLoginId. Used by the guardian-login DTO. */
export const STUDENT_LOGIN_ID_PATTERN = /^[A-Z]{2,6}-\d{4,6}$/;
```

⚠️ **Migratsiya — bu yerda ehtiyot shart.** Agar productionda allaqachon
`000123` formatidagi o'quvchilar bo'lsa, formatni o'zgartirish **ularning
loginini buzadi**. Variantlar: (a) ikkala formatni ham qabul qilish (regex `|`
bilan), (b) mavjudlarini migratsiya qilish + ota-onalarga xabar. Qaysi biri —
**productionda qaysi format borligiga bog'liq. Bu tekshirilsin:**

```sql
SELECT student_login_id FROM student_accounts LIMIT 20;
```

---

## 7. RBAC — permission-based, role-based emas

### 7.1. Struktura

To'rtta jadval, **ataylab alohida**:

```prisma
// apps/api/prisma/schema.prisma:720-746, 1091-1098

model permissions {
  id               BigInt             @id @default(autoincrement())
  code             String             @unique      // 'assessments.write'
  description      String?
  role_permissions role_permissions[]
  // ⚠️ tenant_id YO'Q — global katalog. 7.5 ga qarang
}

model roles {
  id               BigInt             @id @default(autoincrement())
  tenant_id        BigInt                          // ⬅️ tenant'ga tegishli
  name             String                          // 'TEACHER'
  created_at       DateTime           @default(now()) @db.Timestamptz(6)
  role_permissions role_permissions[]
  tenants          tenants            @relation(...)
  user_roles       user_roles[]

  @@unique([tenant_id, name])                      // ⬅️ har tenantda o'z rollari
}

model role_permissions {
  role_id       BigInt
  permission_id BigInt
  permissions   permissions @relation(...)
  roles         roles       @relation(...)

  @@id([role_id, permission_id])
}

model user_roles {
  user_id BigInt
  role_id BigInt
  roles   roles  @relation(...)
  users   users  @relation(...)

  @@id([user_id, role_id])
}
```

Bog'lanish: `users` → `user_roles` → `roles` → `role_permissions` → `permissions`.

### 7.2. ✅ RBAC izchil qo'llangan — bu kuchli tomon

O'lchangan fakt:

| Nima | Soni |
|---|---|
| `@RequirePermissions(...)` ishlatilishi | **234 ta** |
| `@RequireRoles(...)` ishlatilishi | **6 ta** |
| `PermissionsGuard` ostida **ruxsat e'lon qilmagan** route | **0 ta** |

**Bu — jiddiy yutuq va halol tan olinadi.** 28 modul, 37 controller, 234 ta
himoyalangan route — va **birorta ham unutilmagan**. Ko'p loyihada RBAC "bor",
lekin yarim route'da dekorator qo'yilmagan bo'ladi va guard **jimgina** hammani
o'tkazadi (`perms.guard.ts:26` — `if (!required) return true`).

Bu yerda unday emas. Nisbat 234:6 — ya'ni tizim **haqiqatan ruxsat asosida**
ishlaydi, rol asosida emas. `@RequireRoles` faqat 6 ta joyda va ular o'rinli:
`tenants.controller.ts:33` (`SUPERADMIN`), `users.controller.ts:33`.

Dekoratorlar:

```ts
// apps/api/src/common/decorators/perms.decorator.ts
export const PERMS_KEY = 'perms';
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMS_KEY, perms);

// apps/api/src/common/decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

> ⚠️ **Nomlar haqida:** kanon 5.3 `@Roles` va `@Perms` deydi. Real nomlar —
> **`@RequireRoles`** va **`@RequirePermissions`**. Fayl nomlari `roles.decorator.ts`
> / `perms.decorator.ts` (shu sababli chalkashlik). **Kanon tuzatilsin — kod emas:**
> `RequirePermissions` aniqroq nom va 234 joyda ishlatilgan.

### 7.3. Guard qanday ishlaydi

```ts
// apps/api/src/common/guards/perms.guard.ts:21-38
async canActivate(ctx: ExecutionContext): Promise<boolean> {
  const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
    ctx.getHandler(),
    ctx.getClass(),
  ]);
  if (!required || required.length === 0) return true;       // 1

  const req = ctx.switchToHttp().getRequest();
  const user = await ensureUser(req, this.jwt, this.prisma);  // 2

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (roles.includes('SUPERADMIN')) return true;              // 3 ⚠️ 10-bo'lim

  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const ok = required.every((p) => perms.includes(p));        // 4
  if (!ok) throw new ForbiddenException('FORBIDDEN_PERMISSION');
  return true;
}
```

1. Dekorator yo'q → **o'tkazadi**. Ya'ni himoya **dekoratorga bog'liq** — 7.2 dagi
   "0 ta himoyasiz route" fakti aynan shu sababli muhim
2. Token tekshiriladi (`ensureUser`)
3. **SUPERADMIN — to'liq chetlab o'tish** (10-bo'lim)
4. `every` — **barcha** talab qilingan ruxsatlar shart (AND, OR emas). To'g'ri,
   qat'iyroq tanlov

### 7.4. ⚠️ Ruxsatlar JWT ichida — keshning ma'nosi yo'qoladi

Muhim detal: `roles` va `permissions` **token ichiga solinadi**:

```ts
// apps/api/src/modules/auth/auth.service.ts:473-479
const payload = {
  tenantId: tenantId.toString(),
  type: 'STAFF',
  userId: user.id.toString(),
  roles,           // ⬅️ token ichida
  permissions,     // ⬅️ token ichida
};
```

Va guard ularni **token'dan** o'qiydi (`perms.guard.ts:31, 34`) — DB'dan emas.

**Oqibat:** ruxsat o'zgarishi **token muddati tugagunicha** kuchga kirmaydi.
`getStaffRolesPermissions` dagi 5 daqiqalik kesh (`auth.service.ts:393`) — bu
muammoni **hal qilmaydi**, chunki kesh faqat **yangi token berilayotganda**
o'qiladi:

```
Ruxsat olib tashlandi
  → user_roles dan o'chdi                     (darhol)
  → kesh tozalandi                             (darhol, agar chaqirilsa)
  → LEKIN xodimning qo'lidagi token o'zgarmadi
  → u 15 daqiqagacha eski ruxsat bilan ishlaydi
  → keyingi refresh'da (auth.service.ts:664-666) DB'dan qayta o'qiladi → tuzaladi
```

15 daqiqa — **maqbul** (2-bo'limdagi TTL to'g'ri bo'lgani uchun). `15h` bo'lganida
bu 15 soat bo'lardi. **TTL ning qiymati aynan shu yerda ko'rinadi.**

⚠️ **Lekin RBAC moduli keshni umuman tozalamaydi:**

```ts
// apps/api/src/modules/rbac/user-roles.service.ts:72-74
      // Invalidate cache for user's roles/permissions (optional)
      // await this.invalidateUserCache(target_user_id);
```

**Izohga olingan.** Va `// (optional)` deb belgilangan — **u optional emas.**

Ya'ni `POST /api/rbac/users/:userId/roles` orqali rol o'zgartirilsa:

```
1. user_roles yangilandi                              ✅
2. kesh TOZALANMADI                                   ❌ (izohda)
3. Xodim refresh qiladi
   → getStaffRolesPermissions() → keshdan ESKI qiymat (5 daqiqagacha)
   → YANGI token ESKI ruxsatlar bilan beriladi        ⬅️ muammo
4. Oyna: 15 daqiqa (token) + 5 daqiqa (kesh) = 20 daqiqagacha
```

Refresh **tuzatish** o'rniga muammoni **uzaytiradi** — eski ruxsatlar yangi
token'ga ko'chiriladi.

Va `RbacModule` (`rbac.module.ts:10-14`) `AuthModule` ni import qilmaydi, ya'ni
`invalidateUserCache` ni **chaqirib ham bo'lmaydi** — shuning uchun izohga
olingan bo'lsa kerak. Ya'ni bu — **arxitektura muammosi**, dangasalik emas.

**Yechim — keshni alohida servisga chiqarish:**

```ts
// apps/api/src/common/auth/permission-cache.service.ts — taklif (yangi fayl)

import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Roles/permissions cache, shared by AuthService and the RBAC module.
 *
 * It lives here rather than inside AuthService because RbacModule must be able
 * to invalidate it: user-roles.service.ts changes a user's roles and then
 * cannot clear the cache, because AuthService is not reachable from there. The
 * invalidation call is currently commented out and marked "(optional)" — it is
 * not optional. Without it, a refresh after a role change re-issues a token
 * carrying the OLD permissions, so revoking access makes it last LONGER.
 */
@Injectable()
export class PermissionCacheService {
  private static readonly TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private key(userId: bigint): string {
    return `user:${userId}:roles_perms`;
  }

  async get(userId: bigint): Promise<{ roles: string[]; permissions: string[] }> {
    const cached = await this.cache.get<{ roles: string[]; permissions: string[] }>(
      this.key(userId),
    );
    if (cached) return cached;

    const ur = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: { roles: { include: { role_permissions: { include: { permissions: true } } } } },
    });

    const result = {
      roles: ur.map((x) => x.roles.name),
      permissions: Array.from(
        new Set(ur.flatMap((x) => x.roles.role_permissions.map((rp) => rp.permissions.code))),
      ),
    };

    await this.cache.set(this.key(userId), result, PermissionCacheService.TTL_MS);
    return result;
  }

  /** Must be called by EVERY path that changes user_roles. */
  async invalidate(userId: bigint): Promise<void> {
    await this.cache.del(this.key(userId));
  }

  /**
   * A role's permissions changed — every holder of that role is now stale.
   * roles.service.ts:272-278 (assignPermissions) currently clears nothing, so
   * adding or removing a permission on a role leaves every user holding it on
   * the old set until their cache entry ages out.
   */
  async invalidateRole(roleId: bigint): Promise<void> {
    const holders = await this.prisma.user_roles.findMany({
      where: { role_id: roleId },
      select: { user_id: true },
    });
    await Promise.all(holders.map((h) => this.invalidate(h.user_id)));
  }
}
```

### 7.5. ⚠️ `permissions` global — tenant chegarasidan chiqadi

`roles` da `tenant_id` bor, `permissions` da **yo'q**. Ya'ni ruxsat katalogi —
**butun platforma uchun bitta**.

**Bu qisman to'g'ri:** `assessments.write` — bu kod konstantasi, har akademiyada
bir xil ma'noni anglatadi. Uni tenant bo'yicha ko'paytirish ortiqcha.

**Lekin API buni o'zgartirishga ruxsat beradi:**

```ts
// apps/api/src/modules/rbac/permissions.service.ts:179-205 (delete)
async delete(args: { tenantId: string; permissionId: string; ... }) {
  const tenant_id = toBigInt(args.tenantId, 'tenantId');   // ⬅️ faqat audit uchun
  const id = toBigInt(args.permissionId, 'permissionId');

  const permission = await this.prisma.permissions.findUnique({ where: { id } });
  //                                                            ⬅️ tenant filtri YO'Q
  if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');
  ...
  await this.prisma.permissions.delete({ where: { id } });   // ⬅️ GLOBAL O'CHIRISH
}
```

`tenantId` argument sifatida **olinadi**, lekin **faqat audit logga yoziladi** —
so'rovni filtrlamaydi. `permissions.service.ts:77-103` (`list`) da esa `tenantId`
umuman **qabul qilinmaydi**.

**Ya'ni:** `permissions.manage` ruxsatiga ega **istalgan tenantdagi** xodim
**barcha tenantlar uchun** ruxsat katalogini o'zgartira/o'chira oladi.

**Bu qanchalik xavfli?** Halol baho: **hozir past, keyin yuqori**.

- `permissions.manage` faqat `SUPERADMIN` da (`seed.ts:100-101` — `ADMIN` dan
  **ataylab olib tashlangan**). Bu **to'g'ri qaror**
- **Lekin** `roles.manage` ega bo'lgan tenant admin yangi rol yaratib, unga
  `permissions.manage` biriktira oladimi? `roles.service.ts:255-269` —
  `assignPermissions` **istalgan** permission kodini qabul qiladi, "bu ruxsatni
  berish mumkinmi" degan tekshiruv **yo'q**. Ya'ni **privilege escalation yo'li**:
  `roles.manage` → yangi rol + `permissions.manage` → global katalogni buzish

⚠️ `roles.manage` ham `ADMIN` dan olib tashlangan (`seed.ts:101`), ya'ni bu yo'l
hozir yopiq. **Himoya bitta seed qatoriga tayanadi** — bu intizom, struktura emas.

**Yechim — ruxsat katalogini kod konstantasi qilish:**

```ts
// apps/api/src/common/auth/permissions.const.ts — taklif (yangi fayl)

/**
 * The permission catalogue is code, not data.
 *
 * permissions.code is globally unique with no tenant_id, and
 * permissions.service.ts mutates it without any tenant filter — so a tenant
 * holding 'permissions.manage' can delete a permission code out from under
 * every other tenant. Today only SUPERADMIN holds it (seed.ts:100-101), which
 * means the isolation of the whole platform rests on one line of a seed script.
 *
 * Permission codes are referenced by @RequirePermissions in 234 places; they are
 * compile-time facts. Deleting one at runtime silently disables the endpoints
 * that require it. There is no legitimate reason to create or delete them
 * through an API — so the API should not exist.
 */
export const PERMISSIONS = [
  'academic_years.delete', 'academic_years.read', 'academic_years.write',
  'assessments.read', 'assessments.write',
  // ... seed.ts:125-154 dagi ALL_PERMS ro'yxati
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];
```

Va:

- `POST /rbac/permissions` va `DELETE /rbac/permissions/:id` — **o'chiriladi**
- `GET` qoladi (UI rol tahrirlashda ro'yxatni ko'rsatadi)
- Katalog migratsiya orqali `PERMISSIONS` dan sinxronlanadi
- `assignPermissions` faqat `PermissionCode` qabul qiladi → **noto'g'ri kod
  kompilyatsiyada ushlanadi**, runtime'da emas

⚠️ **Buzuvchi o'zgarish:** agar kimdir API orqali maxsus ruxsat yaratgan bo'lsa,
u yo'qoladi. Tekshirish:

```sql
-- Kodda e'lon qilinmagan ruxsat bormi?
SELECT code FROM permissions ORDER BY code;
```

### 7.6. Nega permission-based — va nega bu YETARLI EMAS

**Rol-based nima demoqchi:**

```ts
@RequireRoles('TEACHER')
create(...) {}
```

**Permission-based:**

```ts
@RequirePermissions('assessments.write')
create(...) {}
```

**Farq — o'zgarishga chidamlilik.** Akademiya "zavuch ham baho qo'ya olsin" desa:

| Yondashuv | Nima qilinadi |
|---|---|
| Rol-based | **Kodni o'zgartirish**: `@RequireRoles('TEACHER', 'HEAD_TEACHER')` → deploy |
| Permission-based | **DB'da bitta qator**: `HEAD_TEACHER` roliga `assessments.write` → deploy yo'q |

Ya'ni permission-based'da **rollar — ma'lumot, ruxsatlar — kod**. Akademiya o'z
tashkiliy tuzilmasini kodga tegmasdan ifodalaydi. Kanon 7 dagi vizyon (ko'p
akademiya) uchun bu **majburiy**: har akademiyaning o'z rol nomlari bo'ladi
("zavuch", "metodist", "tarbiyachi"), lekin `assessments.write` — hammada bir xil.

`roles` da `tenant_id` bor, `permissions` da yo'q — **bu ajratish aynan shuni
ifodalaydi** va u to'g'ri.

#### ⚠️ LEKIN — ruxsat modelining chegarasi

Ikkita qoidani solishtiring:

| Qoida | Ruxsat bilan ifodalanadimi? |
|---|---|
| "O'qituvchi baho qo'yadi" | ✅ **Ha** — `assessments.write` |
| "O'qituvchi **FAQAT O'Z GURUHIGA** baho qo'yadi" | ❌ **YO'Q** |

**Nega yo'q?** Chunki `assessments.write` — bu **fe'l**, u obyektni bilmaydi.
`perms.guard.ts:34-35` shunday tekshiradi:

```ts
const perms = Array.isArray(user?.permissions) ? user.permissions : [];
const ok = required.every((p) => perms.includes(p));
```

Bu — **massivda satr bormi** degan tekshiruv. Guard qaysi guruh haqida gap
ketayotganini **bilmaydi va bila olmaydi**: `groupId` — so'rov tanasida
(`CreateAssessmentDto`), guard esa faqat token'ni ko'radi.

Ya'ni RBAC **printsipial ravishda** "kim nima qila oladi" degan savolga javob
beradi. "**Kim qaysi narsaga** nima qila oladi" — bu **boshqa savol**, va u
**resource-level authorization** deb ataladi.

**Bu — 8-bo'lim.**

---

## 8. ⚠️ Resource-level authorization — ENG MUHIM SAVOL

### 8.1. Savol va javob

**Savol:** `@RequirePermissions('assessments.write')` o'qituvchiga baho qo'yish
huquqini beradi. Lekin u **BOSHQA guruhning** o'quvchisiga baho qo'ya oladimi?

> ## **JAVOB: HA, QO'YA OLADI.**
>
> **Va bu RBAC bagi emas.** Hozirgi ma'lumot modelida bu tekshiruvni
> **majburlab BO'LMAYDI** — chunki "o'qituvchining guruhi" degan tushuncha
> sxemada **umuman yo'q**.

Bu — muhim farq. "Tekshiruvni qo'shishni unutishgan" degani **emas**. Tekshiruvni
yozmoqchi bo'lsangiz — **yozadigan narsangiz yo'q**.

### 8.2. Isbot — kod

**Baho yaratish** (`assessments.service.ts:46-61`):

```ts
return await this.prisma.$transaction(async (tx) => {
  // 1. Group exists and belongs to tenant
  const group = await tx.groups.findFirst({
    where: {
      id: group_id,
      tenant_id,           // ⬅️ FAQAT tenant tekshiriladi
    },
    select: {
      id: true,
      academic_year_id: true,
    },
  });

  if (!group) {
    throw new NotFoundException('GROUP_NOT_FOUND');
  }
  // ... created_by_user_id yoziladi, LEKIN tekshirilmaydi
```

**Ball qo'yish** (`assessments.service.ts:415-466`):

```ts
return await this.prisma.$transaction(async (tx) => {
  // 1. Assessment exists and belongs to tenant
  const assessment = await tx.assessments.findFirst({
    where: {
      id: assessment_id,
      tenant_id,           // ⬅️ FAQAT tenant
    },
    select: { id: true, title: true, max_score: true, group_id: true },
  });

  if (!assessment) throw new NotFoundException('ASSESSMENT_NOT_FOUND');

  // 2. Get all students in this group
  const groupStudents = await tx.students.findMany({
    where: { tenant_id, current_group_id: assessment.group_id, ... },
  });

  const groupStudentIds = new Set(groupStudents.map((s) => s.id.toString()));

  // 3. Validate all student IDs belong to this group
  for (const item of args.dto.scores) {
    if (!groupStudentIds.has(item.studentId)) {
      throw new BadRequestException(`STUDENT_NOT_IN_GROUP: ${item.studentId}`);
    }
    if (Number(item.score) > Number(assessment.max_score)) {
      throw new BadRequestException(`SCORE_EXCEEDS_MAX: ...`);
    }
  }
```

⚠️ **`STUDENT_NOT_IN_GROUP` tekshiruvi bor** — lekin u **butunlay boshqa narsani**
tekshiradi: "bu o'quvchi shu **baho tegishli** guruhdami?". U **"bu o'qituvchi shu
guruhga tegishlimi?"** degan savolni **so'ramaydi**.

Bu — chalg'ituvchi. Kodni o'qigan odam "tekshiruv bor" deb o'ylaydi. Tekshiruv
**ma'lumot yaxlitligi** uchun, **avtorizatsiya** uchun emas.

**Hujum — to'liq ishlaydigan:**

```
Azimov — 10-A guruhining o'qituvchisi. Uning roli: TEACHER.
TEACHER da assessments.write bor (seed.ts:165).

POST /api/staff/assessments
Authorization: Bearer <azimov_token>
{ "groupId": "7",           ⬅️ 11-B — Azimovga UMUMAN aloqasi yo'q
  "subjectId": "3",
  "type": "BLOCK_TEST",
  "title": "Nazorat",
  "heldAt": "2026-07-10T10:00:00+05:00" }

→ perms.guard: azimov.permissions.includes('assessments.write')  ✅
→ service: groups.findFirst({ id: 7, tenant_id })  ✅ (11-B shu tenantda)
→ 201 CREATED

POST /api/staff/assessments/<id>/scores
{ "scores": [{ "studentId": "412", "score": 12 }] }   ⬅️ 11-B o'quvchisi

→ STUDENT_NOT_IN_GROUP? Yo'q — 412 haqiqatan 11-B da  ✅
→ SCORE_EXCEEDS_MAX?    Yo'q — 12 < 100               ✅
→ 200 OK. BAHO QO'YILDI.
```

**Hech qanday tekshiruv buni to'smaydi.** Va bu — real ta'sir: DTM ballari
(kanon 4.1) o'quvchining kelajagini belgilaydi.

⚠️ **Bu faqat `assessments` muammosi emas.** `TEACHER_PERMS` (`seed.ts:160-173`)
da `attendance.write`, `discipline.write`, `timetable.write`, `events.write`,
`files.write` bor — **hammasi** bir xil holatda. Ya'ni har qanday o'qituvchi
istalgan guruhning **davomatini** belgilashi, istalgan o'quvchiga **intizom
choralari** yozishi mumkin.

### 8.3. 🔴 Ildiz sabab — ma'lumot modeli bo'shlig'i

**Bu eng muhim xulosa.** "Tekshiruv qo'shamiz" deb servis kodini ochsangiz,
shunday yozishingiz kerak bo'lardi:

```ts
// Bunday yozib bo'lmaydi — "o'qituvchining guruhlari" degan narsa yo'q
const teachesThisGroup = await tx.???.findFirst({
  where: { teacher_user_id: actorUserId, group_id: group_id },
});
```

`???` o'rniga qo'yadigan jadval **yo'q**. O'lchangan holat:

| Jadval:qator | Ustun | Ma'nosi | Avtorizatsiya uchun yaraydimi? |
|---|---|---|---|
| `groups:509` | `curator_user_id BigInt?` | Guruh **kuratori** (sinf rahbari) | ❌ Kurator ≠ fan o'qituvchisi. Bitta guruhda 1 kurator, 8-10 fan o'qituvchisi |
| `assessments:64` | `created_by_user_id BigInt?` | Bahoni **kim yaratgan** | ❌ Bu **natija**, shart emas. Yaratgandan **keyin** yoziladi |
| `timetable_lessons:1080` | `teacher_user_id BigInt?` | Darsni **kim o'tadi** | 🟡 **Yagona nomzod** — lekin muammoli |

**`teacher_user_id` butun sxemada FAQAT BITTA joyda** — `schema.prisma:1080`.

Nega u ham yetarli emas:

```prisma
// apps/api/prisma/schema.prisma:1074-1089
model timetable_lessons {
  id              BigInt    @id @default(autoincrement())
  timetable_id    BigInt                    // ⬅️ group_id EMAS — timetable orqali
  day_of_week     Int       @db.SmallInt
  period_no       Int       @db.SmallInt
  subject_id      BigInt
  teacher_user_id BigInt?                   // ⬅️ NULLABLE
  room            String?
  starts_at       DateTime? @db.Time(6)
  ends_at         DateTime? @db.Time(6)
  subjects        subjects  @relation(...)
  users           users?    @relation(...)
  timetable       timetable @relation(...)

  @@unique([timetable_id, day_of_week, period_no])
  // ⚠️ tenant_id YO'Q — timetable orqali bilvosita
}
```

Muammolar:

1. **`nullable`** — dars jadvalida o'qituvchi ko'rsatilmasligi mumkin. Ya'ni
   `teacher_user_id IS NULL` bo'lgan darslar bor, va ular uchun tekshiruv nima
   qaytaradi?
2. **Bilvosita bog'lanish** — `group_id` yo'q. Guruhga yetish uchun:
   `timetable_lessons → timetable → group_id`. Har avtorizatsiya tekshiruvi — **JOIN**
3. **Semantik nomuvofiqlik** — dars jadvali "**qachon** kim o'tadi" ni ifodalaydi,
   "**kim mas'ul**" ni emas. Jadval o'zgarsa (almashtirish, vaqtinchalik
   o'qituvchi), avtorizatsiya ham o'zgaradi. Bu — **noto'g'ri bog'lanish**:
   o'qituvchi kasal bo'lib bir dars almashtirilsa, u guruhga baho qo'yish
   huquqini **yo'qotmasligi** kerak
4. **`timetable` optional** — `assessments.service.ts:96-98` da
   `NO_TIMETABLE_FOR_GROUP` xatosi bor, ya'ni jadvalsiz guruhlar **mavjud
   bo'lishi mumkin**. Ular uchun avtorizatsiya **umuman ishlamaydi**

**Xulosa:** `assessments.create` ga tekshiruv qo'shish uchun avval **"bu o'qituvchi
bu guruhda bu fanni o'qitadi"** degan faktni saqlaydigan joy kerak. U yo'q.

> **Shuning uchun bu — TZ vazifasi, bag tuzatish emas.** Kanon 5.3 dagi
> "Ochiq savol: qanday majburlanadi?" savolining javobi: **hozircha hech qanday,
> va avval sxema o'zgarishi kerak.**

### 8.4. Yechim — 1-qadam: sxema

```prisma
// apps/api/prisma/schema.prisma — taklif

/// Which teacher is responsible for which subject in which group.
///
/// This is the fact that authorization needs and that the schema currently
/// cannot express. Today the only teacher→group links are:
///   - groups.curator_user_id          — the form tutor, not the subject teacher
///   - assessments.created_by_user_id  — written AFTER the fact, useless as a check
///   - timetable_lessons.teacher_user_id — nullable, keyed by timetable+slot, and
///     semantically "who teaches this period", not "who is responsible". A one-off
///     substitution would silently grant or revoke grading rights.
///
/// Assignment must be an explicit, durable statement, independent of the
/// timetable. Follows the group_subjects composite-PK convention.
model group_subject_teachers {
  tenant_id       BigInt
  group_id        BigInt
  subject_id      BigInt
  teacher_user_id BigInt

  /// Assignments are scoped to a year: a teacher who taught 10-A last year must
  /// not still be able to grade it. groups already carries academic_year_id, but
  /// storing it here keeps the check a single indexed lookup with no join.
  academic_year_id BigInt

  assigned_at         DateTime  @default(now()) @db.Timestamptz(6)
  assigned_by_user_id BigInt?

  /// Soft end. Deleting the row would erase the record of who could grade what
  /// and when — which is exactly what a grade dispute needs to reconstruct.
  unassigned_at       DateTime? @db.Timestamptz(6)

  tenants        tenants        @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  groups         groups         @relation(fields: [group_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  subjects       subjects       @relation(fields: [subject_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users          users          @relation(fields: [teacher_user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  academic_years academic_years @relation(fields: [academic_year_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([group_id, subject_id, teacher_user_id, academic_year_id])
  /// The authorization hot path: "can this user act on this group+subject".
  @@index([tenant_id, teacher_user_id, unassigned_at])
  @@index([tenant_id, group_id, subject_id])
}
```

### 8.5. Yechim — 2-qadam: tekshiruv servisi

```ts
// apps/api/src/common/auth/resource-access.service.ts — taklif (yangi fayl)

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from './jwt-request.util';

/**
 * Resource-level authorization: "can this actor act on THIS object".
 *
 * RBAC answers "can this actor grade at all" (assessments.write). It cannot
 * answer "can this actor grade THIS group", because @RequirePermissions only
 * sees the token — the groupId lives in the request body. That second question
 * has no answer anywhere in the codebase today: any TEACHER can grade any group
 * in their tenant (assessments.service.ts:48-61, 417-466).
 *
 * Deliberately a SERVICE, not a guard.
 *
 * A guard would have to dig the resource id out of params/body/query, which
 * differs per endpoint, and it would run before the service loads the row —
 * meaning two lookups and a TOCTOU gap. Services already load the row inside a
 * transaction; the check belongs there, on data that is already fetched and
 * locked. Guards stay for coarse RBAC; this handles ownership.
 */
@Injectable()
export class ResourceAccessService {
  private readonly logger = new Logger(ResourceAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SUPERADMIN and ADMIN act across the whole tenant by design (see §9, §10). */
  private isTenantWide(user: RequestUser): boolean {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    return roles.includes('SUPERADMIN') || roles.includes('ADMIN');
  }

  /**
   * Assert that `user` may act on (group, subject).
   *
   * `tx` is required: the caller has already loaded the group inside a
   * transaction, and this check must see the same snapshot. Reading it on a
   * separate connection would let an assignment be revoked between the check
   * and the write.
   */
  async assertCanActOnGroupSubject(
    tx: PrismaService | any,
    user: RequestUser,
    args: { tenantId: bigint; groupId: bigint; subjectId: bigint; academicYearId: bigint },
  ): Promise<void> {
    if (user.type !== 'STAFF' || !user.userId) throw new ForbiddenException('NOT_STAFF');
    if (this.isTenantWide(user)) return;

    const assignment = await tx.group_subject_teachers.findFirst({
      where: {
        tenant_id: args.tenantId,
        group_id: args.groupId,
        subject_id: args.subjectId,
        academic_year_id: args.academicYearId,
        teacher_user_id: BigInt(user.userId),
        unassigned_at: null,
      },
      select: { teacher_user_id: true },
    });

    if (!assignment) {
      // Same message whether the group exists, the subject exists, or the
      // teacher simply is not assigned. Distinguishing them tells a teacher
      // which groups and subjects exist in other campuses.
      this.deny('not_assigned_to_group_subject', {
        userId: String(user.userId),
        groupId: String(args.groupId),
        subjectId: String(args.subjectId),
      });
    }
  }

  /** Curator-scoped actions (discipline, leaves) key off the group, not a subject. */
  async assertCanActOnGroup(
    tx: PrismaService | any,
    user: RequestUser,
    args: { tenantId: bigint; groupId: bigint },
  ): Promise<void> {
    if (user.type !== 'STAFF' || !user.userId) throw new ForbiddenException('NOT_STAFF');
    if (this.isTenantWide(user)) return;

    const userId = BigInt(user.userId);

    const [curated, taught] = await Promise.all([
      tx.groups.findFirst({
        where: { id: args.groupId, tenant_id: args.tenantId, curator_user_id: userId },
        select: { id: true },
      }),
      tx.group_subject_teachers.findFirst({
        where: {
          tenant_id: args.tenantId,
          group_id: args.groupId,
          teacher_user_id: userId,
          unassigned_at: null,
        },
        select: { teacher_user_id: true },
      }),
    ]);

    if (!curated && !taught) {
      this.deny('not_curator_or_teacher_of_group', {
        userId: String(userId),
        groupId: String(args.groupId),
      });
    }
  }

  /**
   * Shadow mode.
   *
   * group_subject_teachers is populated by INFERENCE (from timetable rows and
   * past assessments), not by a statement of fact. Turning enforcement on
   * directly would lock out every teacher the inference missed — mid-term, with
   * no warning, on a system real staff use daily.
   *
   * So: run the check, log what WOULD have been denied, deny nothing. When the
   * deny log goes quiet for a full grading cycle, flip RESOURCE_ACCESS_ENFORCE
   * to true. Until then this is a MEASUREMENT, not a defence — and it must not
   * be mistaken for one.
   */
  private enforcing(): boolean {
    return String(process.env.RESOURCE_ACCESS_ENFORCE || 'false') === 'true';
  }

  private deny(reason: string, ctx: Record<string, unknown>): void {
    if (this.enforcing()) throw new ForbiddenException('FORBIDDEN_RESOURCE');
    this.logger.warn({ msg: 'resource_access.would_deny', reason, ...ctx });
  }
}
```

### 8.6. Yechim — 3-qadam: servisga ulash

```ts
// apps/api/src/modules/assessments/assessments.service.ts — taklif

async create(args: {
  tenantId: string;
  createdByUserId: string;
  actor: RequestUser;            // ⬅️ YANGI — controller req.user ni uzatadi
  dto: CreateAssessmentDto;
  ipAddress?: string;
}) {
  const tenant_id = toBigInt(args.tenantId, 'tenantId');
  const group_id = toBigInt(args.dto.groupId, 'groupId');
  const subject_id = toBigInt(args.dto.subjectId, 'subjectId');

  return await this.prisma.$transaction(async (tx) => {
    const group = await tx.groups.findFirst({
      where: { id: group_id, tenant_id },
      select: { id: true, academic_year_id: true },
    });
    if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

    const subject = await tx.subjects.findFirst({
      where: { id: subject_id, tenant_id },
      select: { id: true, name: true },
    });
    if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

    // ── Resource-level authorization ────────────────────────────────────
    // RBAC established that this user may create assessments at all
    // (@RequirePermissions('assessments.write')). It said nothing about THIS
    // group. Without this call any teacher can grade any group in the tenant.
    //
    // Inside the transaction, after the group is loaded: the academic year
    // comes from the row we just read, so an assignment cannot be revoked
    // between the check and the insert.
    await this.resourceAccess.assertCanActOnGroupSubject(tx, args.actor, {
      tenantId: tenant_id,
      groupId: group_id,
      subjectId: subject_id,
      academicYearId: group.academic_year_id,
    });
    // ────────────────────────────────────────────────────────────────────

    // ... qolgan kod o'zgarmaydi
  });
}
```

Va `upsertScores` — **muhimroq**, chunki haqiqiy ball shu yerda yoziladi:

```ts
// apps/api/src/modules/assessments/assessments.service.ts — taklif

async upsertScores(args: {
  tenantId: string;
  assessmentId: string;
  enteredByUserId: string;
  actor: RequestUser;            // ⬅️ YANGI
  dto: UpsertAssessmentScoresDto;
  ipAddress?: string;
}) {
  const tenant_id = toBigInt(args.tenantId, 'tenantId');
  const assessment_id = toBigInt(args.assessmentId, 'assessmentId');

  return await this.prisma.$transaction(async (tx) => {
    const assessment = await tx.assessments.findFirst({
      where: { id: assessment_id, tenant_id },
      select: {
        id: true, title: true, max_score: true,
        group_id: true,
        subject_id: true,           // ⬅️ YANGI — tekshiruv uchun kerak
        academic_year_id: true,     // ⬅️ YANGI
      },
    });
    if (!assessment) throw new NotFoundException('ASSESSMENT_NOT_FOUND');

    // The check that matters most: this is where a number that decides a
    // student's DTM score actually gets written.
    await this.resourceAccess.assertCanActOnGroupSubject(tx, args.actor, {
      tenantId: tenant_id,
      groupId: assessment.group_id,
      subjectId: assessment.subject_id,
      academicYearId: assessment.academic_year_id,
    });

    // ... STUDENT_NOT_IN_GROUP va SCORE_EXCEEDS_MAX tekshiruvlari o'z joyida
    //     qoladi — ular ma'lumot yaxlitligi uchun, avtorizatsiya uchun emas
  });
}
```

Controller:

```ts
// apps/api/src/modules/assessments/assessments.controller.ts — taklif
@Post()
@RequirePermissions('assessments.write')
create(@Req() req: any, @Body() dto: CreateAssessmentDto) {
  return this.svc.create({
    tenantId: this.tenantId(req),
    createdByUserId: this.userId(req),
    actor: req.user,               // ⬅️ YANGI
    dto,
    ipAddress: this.ip(req),
  });
}
```

### 8.7. Migratsiya yo'li — 845 nuqta muammosining kichik ukasi

⚠️ **Bu o'zgarishni bir kunda qilib bo'lmaydi**, va uni noto'g'ri qilish **ishlab
turgan tizimni sindiradi**: `group_subject_teachers` bo'sh bo'lsa, **hech bir
o'qituvchi hech narsa qila olmaydi**.

**Bosqichlar:**

| # | Qadam | Xavf |
|---|---|---|
| 1 | Sxema + migratsiya. Jadval **bo'sh** | Yo'q — hech kim o'qimaydi |
| 2 | **Ma'lumot to'ldirish** — mavjud holatdan xulosa (pastda) | Yo'q — faqat yozish |
| 3 | Admin UI: o'qituvchi↔guruh↔fan biriktirish | Yo'q |
| 4 | **Shadow mode** — tekshiruv ishlaydi, faqat **log** yozadi | Yo'q — bloklamaydi |
| 5 | Loglarni o'lchash: nechta so'rov rad etilardi? | — |
| 6 | `RESOURCE_ACCESS_ENFORCE=true` | 🔴 Yuqori |

**2-qadam — mavjud ma'lumotdan biriktirishlarni chiqarish:**

```sql
-- Kim aslida nima o'qitgan? Ikki manbadan xulosa:
--   (a) dars jadvali — teacher_user_id (nullable, shuning uchun to'liq emas)
--   (b) o'tmishdagi baholar — created_by_user_id (kim baho qo'ygan bo'lsa,
--       demak u o'qitgan)
--
-- Bu XULOSA, fakt emas. Natija admin tomonidan KO'RIB CHIQILISHI shart —
-- avtomatik ishonch bermaydi.
INSERT INTO group_subject_teachers
  (tenant_id, group_id, subject_id, teacher_user_id, academic_year_id, assigned_at)
SELECT DISTINCT
  t.tenant_id, t.group_id, tl.subject_id, tl.teacher_user_id,
  g.academic_year_id, now()
FROM timetable_lessons tl
JOIN timetable t ON t.id = tl.timetable_id
JOIN groups g    ON g.id = t.group_id
WHERE tl.teacher_user_id IS NOT NULL

UNION

SELECT DISTINCT
  a.tenant_id, a.group_id, a.subject_id, a.created_by_user_id,
  a.academic_year_id, now()
FROM assessments a
WHERE a.created_by_user_id IS NOT NULL

ON CONFLICT DO NOTHING;
```

⚠️ **Shadow mode'ning xavfi:** u **himoya emas**. Agar u yoqilgan holda unutilib
qolsa — teshik ochiq, lekin log to'la va hamma "himoya bor" deb o'ylaydi. Bu —
kanon 5.1 dagi `tenant.util.ts` kasalligining aynan o'zi. Shuning uchun:
**5-qadamga muddat qo'yilsin** va `RESOURCE_ACCESS_ENFORCE=false` productionda
**boot'da ogohlantirish** chiqarsin.

### 8.8. Nima uchun guard emas — qaror asoslash

Topshiriqda "resource ownership guard **yoki** servis darajasida tekshiruv"
deyilgan. **Tanlov: servis darajasida.** Sabab:

| Mezon | Guard | Servis |
|---|---|---|
| Resurs ID'ni topish | `params`? `body`? `query`? — **har endpoint'da boshqacha** | Servis uni allaqachon oladi |
| DB o'qish | Guard o'qiydi → servis **yana** o'qiydi | Bir marta |
| TOCTOU | Guard tekshirdi → servis yozguncha holat o'zgarishi mumkin | Tranzaksiya ichida — **imkonsiz** |
| Tranzaksiya | Guard tranzaksiyadan **tashqarida** | Ichida, bir xil snapshot |
| Murakkab qoida | `assessment → group → subject` — guard'da JOIN | Servis obyektni allaqachon yuklagan |

Guard **coarse** tekshiruv uchun to'g'ri ("umuman baho qo'ya oladimi?") — va u
allaqachon shuni qiladi. **Fine-grained** ("bu guruhga qo'ya oladimi?") — servis
ishi, chunki faqat servis **qaysi obyekt** haqida gap ketayotganini biladi.

⚠️ **Bu qarorning narxi — intizom.** Servis tekshiruvi **unutilishi mumkin**
(kanon 5.1 dagi 845 nuqta bilan bir xil muammo). Yumshatish:

- `actor: RequestUser` ni **majburiy argument** qilish → unutgan kod
  **kompilyatsiya bo'lmaydi**
- Har `*.write` ruxsatli servis metodi uchun **test** (hozir testlar amalda nol —
  kanon 3)
- Kelajakda: tekshiruvni Prisma extension'ga ko'chirish (03-multi-tenancy dagi
  yondashuv bilan bir xil falsafa)
