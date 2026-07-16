# 15 — Kuzatuvchanlik (Observability)

> **Hujjat maqomi:** Qoralama · **Oxirgi yangilanish:** 2026-07-15
> **Egasi:** Sarvarbek Sodiqov
> **Loyiha:** MathAcademy Digital Campus · github.com/Sarvarbek0704/mathacademy

**Bog'liq hujjatlar:**
- [00-vision-and-market.md](./00-vision-and-market.md) — loyihaning o'lchangan holati

> **Byudjet cheklovi (butun hujjatning asosi):** loyiha muallifi talaba, marketing
> byudjeti **$0**. Shuning uchun bu hujjatdagi **har bir taklif uchun narx aytiladi**
> va bepul chegara tashqi manba bilan tasdiqlanadi. Narx aytilmagan taklif — taklif emas.

---

## 1. ⚠️ Hozirgi holat — halol

### 1.1. Bitta jumlada

**Production'da nimadir buzilsa — bilib bo'lmaydi.**

Bu majoz emas, o'lchangan fakt. Quyida — kod bo'yicha tekshirilgani.

### 1.2. Nima bor va nima yo'q — fayl darajasida

| Nima | Holat | Dalil |
|---|---|---|
| Structured logging | **Yo'q** | `apps/api/package.json` — `pino` ham, `winston` ham yo'q |
| Nest'ning `Logger` klassi | **Yo'q** | `grep "new Logger("` butun `apps/api/src` bo'yicha — **0 natija** |
| Metrics | **Yo'q** | `prom-client` yo'q, `/metrics` endpoint yo'q |
| Tracing | **Yo'q** | `@opentelemetry/*` yo'q |
| Error tracking | **Yo'q** | `@sentry/*` yo'q |
| Health check | **Yo'q** | `@nestjs/terminus` yo'q, `/health` route yo'q |
| Request ID | **Yo'q** | So'rovlarni bir-biridan ajratib bo'lmaydi |
| `console.*` | **18 ta chaqiruv, 3 faylda** | pastda |

⚠️ **Kanon (6-bo'lim) "console.log / Nest Logger" deydi. Haqiqat undan ham yomonroq:
Nest'ning `Logger` klassi ilova kodida umuman ishlatilmaydi.** Nest o'zining ichki
bootstrap xabarlarini (`[NestFactory] Starting Nest application...`) chiqaradi, xolos.
Ilova kodi yozgan har bir satr — `console`.

`console.*` taqsimoti:

| Fayl | Soni |
|---|---|
| `apps/api/src/modules/auth/auth.service.ts` | **14** |
| `apps/api/src/main.ts` | **3** |
| `apps/api/src/common/utils/audit.util.ts` | **1** |

### 1.3. Eng jiddiy topilma: `AllExceptionsFilter` **hech narsa loglamaydi**

`apps/api/src/common/filters/all-exceptions.filter.ts` — bu barcha xatolarni ushlaydigan
global filtr. Uning `catch()` metodi (25–46-qatorlar) quyidagini qiladi: xatoni HTTP
javobiga o'giradi va `res.status(statusCode).json(body)` (45-qator) bilan yuboradi.

**Va shu bilan tamom.** Faylda birorta ham logger chaqiruvi yo'q.

Eng og'ir oqibat — 110–113-qatorlar:

```typescript
return new InternalServerErrorException({
  message: 'INTERNAL',
  code: 'INTERNAL',
});
```

Bu — `map()` metodining oxirgi `return`i, ya'ni **tanib bo'lmagan har qanday xato**
shu yerga tushadi. Asl `exception` obyekti — stack trace, xato turi, sabab — shu
qatorda **butunlay tashlab yuboriladi**. Foydalanuvchi `500 INTERNAL` oladi,
dasturchi esa **hech narsa** olmaydi.

Ya'ni: production'da 500 xato chiqsa, uning nima ekanini bilishning **iloji yo'q**.

### 1.4. Ikkinchi topilma: xato konteksti `console.error` da yo'qoladi

`auth.service.ts` da 14 marta takrorlanadigan naqsh (615–629-qatorlar, guardian login):

```typescript
} catch (error) {
  if (
    error instanceof UnauthorizedException ||
    error instanceof ForbiddenException ||
    error instanceof BadRequestException
  ) {
    throw error;
  }
  console.error('Guardian login error:', error);          // ← 628-qator
  throw new InternalServerErrorException('AUTH_GUARDIAN_LOGIN_FAILED');
}
```

Bu `all-exceptions.filter.ts` dan yaxshiroq (xato hech bo'lmasa stdout'ga tushadi),
lekin uch muammosi bor:

1. **Kontekst yo'q.** `tenant_id`, `request_id`, `student_id` — hech qaysi biri yo'q.
   Log qatori: `Guardian login error: Error: ...`. **Qaysi akademiya? Qaysi
   o'quvchi?** — javob yo'q.
2. **JSON emas.** Filtrlash uchun regex kerak, regex format o'zgarganda jimgina
   buziladi.
3. **stdout'ga yozadi va u yerda qoladi.** Render protsessni qayta ishga tushirsa —
   log yo'qoladi.

### 1.5. Uchinchi topilma: audit yozuvining yiqilishi jimgina yutiladi

`apps/api/src/common/utils/audit.util.ts`, 63–65-qatorlar:

```typescript
} catch (error) {
  console.error('Audit logging failed:', error);
}
```

Audit yozuvi saqlanmasa — bu "kim nima qildi" izining yo'qolishi. Bu **jiddiy
hodisa**, `console.error` emas. Hozir u stdout'ga tushadi va hech kim ko'rmaydi.
(Batafsili — 2-bo'lim.)

### 1.6. Real misol: guardian login formati bagi

Kanon 4.2 da qayd etilgan: guardian login formati `<tenant-slug>-<student-id>`,
masalan `mathacademy-MA-0001`. **Birinchi tire bo'yicha ajratilishi kerak**, oxirgisi
bo'yicha emas — chunki `student_id` ning o'zida tire bor (`MA-0001`). Oxirgi tire
bo'yicha ajratilsa, tenant slug `mathacademy-MA` bo'lib chiqadi va u topilmaydi.

**Savol: bu bag qanday aniqlandi?**

Javob: **ota-ona qo'ng'iroq qildi.** "Kira olmayapman."

Bu — kuzatuvchanlik emas. Bu **kuzatuvchanlikning yo'qligi**. E'tibor bering,
tizim o'zini "to'g'ri" tutgan: `INVALID_CREDENTIALS` qaytargan, hech qanday xato
loglanmagan, hech qanday alert chiqmagan. Metrikada ko'rinmagan, chunki metrika yo'q.

Kuzatuvchanlik bo'lganda nima bo'lardi:

- `mathacademy_guardian_login_failures_total{tenant, reason="TENANT_NOT_FOUND"}`
  metrikasi **noldan sakrab chiqardi**
- Alert 5 daqiqada Telegram'ga tushardi
- Log'da `{"tenant_slug":"mathacademy-MA","reason":"TENANT_NOT_FOUND"}` ko'rinardi
  va sabab bir qarashda tushunilardi

Aniqlash vaqti: **kunlar → daqiqalar**.

⚠️ Va bu — **eng yaxshi holat**, chunki ota-ona qo'ng'iroq qila oldi. Kanon 5.1
dagi asosiy xavf — **tenant izolyatsiyasining buzilishi** (845 ta qo'lda
boshqariladigan nuqta, bittasi unutilsa) — bunday emas. Agar A akademiya B akademiyaning
o'quvchisini ko'rsa, **hech kim qo'ng'iroq qilmaydi**, chunki hech kim sezmaydi.
Xato yo'q, 500 yo'q, sekinlik yo'q. Ma'lumot jimgina oqadi.

**Aynan shuning uchun bu hujjat kerak: eng qimmat nosozliklar shovqin qilmaydi.**

### 1.7. Halol e'tirof: bu hujjat nimani hal QILMAYDI

Kuzatuvchanlik tenant izolyatsiyasini **tuzatmaydi**. Uni Prisma extension tuzatadi
(kanon 5.1). Kuzatuvchanlik faqat **ko'rsatadi**. Agar ikkisidan bittasini tanlash
kerak bo'lsa — extension birinchi. Bu hujjat ikkinchi.

---

## 2. Audit log ≠ observability

Loyihada `audit_logs` jadvali **bor** va u ishlaydi (`common/utils/audit.util.ts`).
Shuning uchun savol tug'iladi: "bizda log bor-ku?"

**Yo'q.** Bu ikkalasi turli narsa va biri ikkinchisini almashtirmaydi.

| Jihat | `audit_logs` (bor) | Observability (yo'q) |
|---|---|---|
| **Savol** | **Kim** nima qildi? | **Tizim** o'zini qanday tutyapti? |
| **Misol** | "Aziz 12-guruh bahosini o'zgartirdi" | "So'rov 3 soniya ketdi" |
| **Misol** | "Guardian MA-0001 tizimga kirdi" | "Prisma pool'da bo'sh ulanish qolmadi" |
| **Auditoriya** | Direktor, ota-ona, yurist | Dasturchi (ya'ni muallif) |
| **Manzil** | PostgreSQL `audit_logs` | stdout → log agregatori |
| **Saqlash** | **Yillar** | Kunlar (14–30) |
| **Namuna olish** | **Hech qachon** — 100% | Mumkin |
| **Yo'qolsa** | Nizoni hal qilib bo'lmaydi | Noqulay |

### 2.1. Farq nima uchun amaliy

Ota-ona keladi: "bolamning bahosi o'zgargan, kim o'zgartirdi?"
→ **`audit_logs`** javob beradi. Observability javob bermaydi.

Ota-ona keladi: "sayt kecha kechqurun ochilmadi."
→ **Observability** javob beradi. `audit_logs` javob bermaydi — u yerda faqat
muvaffaqiyatli operatsiyalar bor.

Ikkinchi savolga hozir **javob yo'q**.

### 2.2. Uchinchi holat: ikkalasi ham kerak

Kanon 5.1: "bir maktab ikkinchisining ma'lumotini ko'radi" — bu eng katta xavf.

- `audit_logs` yozadi: "user 42 `students.findMany` chaqirdi" — lekin u **qaysi
  tenantning** ma'lumoti qaytganini bilmaydi
- Observability yozadi: "so'rov 200 OK, 45 ms" — lekin u **noto'g'ri ma'lumot**
  qaytganini bilmaydi

Ikkalasi ham bu nosozlikni ko'rmaydi. Shuning uchun 5.4-bo'limda **maxsus** metrika
taklif qilinadi.

### 2.3. Amaliy qoida

`audit.util.ts:64` dagi `console.error('Audit logging failed:', error)` — aynan shu
farqning buzilishi. **Audit yozuvi yiqilishi — observability hodisasi**, va u
observability tizimiga (Sentry'ga) borishi kerak, stdout'ga emas:

```typescript
// audit.util.ts — tuzatilgan
} catch (error) {
  // Audit yozuvining yiqilishi — JIDDIY hodisa, chunki bu iz yo'qolishi.
  // U observability tizimiga boradi (Sentry), stdout'ga emas.
  this.logger.error(
    { err: error, tenant_id: tenantId.toString(), action, entity_type: entityType },
    'AUDIT_WRITE_FAILED',
  );
  Sentry.captureException(error, {
    tags: { subsystem: 'audit', action },
    extra: { tenant_id: tenantId.toString(), entity_type: entityType },
  });
}
```

⚠️ **Ochiq savol (13-bo'limga):** audit yozuvi hozir biznes operatsiyasi bilan
**bir tranzaksiyada emas** (`audit.util.ts:49` — alohida `create`). Ya'ni baho
o'zgarishi saqlanib, audit yozuvi yiqilishi mumkin — "o'zgarish bor, izi yo'q".
Bu observability muammosi emas, lekin shu yerda ko'rindi.

---

## 3. Structured logging — `pino`

### 3.1. Nega `pino`, nega `console` emas

| | `console.error` (hozir) | `pino` (taklif) |
|---|---|---|
| Format | Matn | **JSON** |
| Kontekst | Qo'lda, unutiladi | **Avtomatik** (tenant, request ID) |
| Filtrlash | `grep` + regex | Maydon bo'yicha |
| Redaction | Yo'q | **Konfiguratsiyada** |
| Tezlik | Sinxron, bloklaydi | Async, minimal overhead |
| Narx | $0 | **$0** (MIT litsenziya) |

Sabab oddiy: `console.error('Guardian login error:', error)` — bu **inson uchun**.
Mashina uchun emas. "Kecha 14:00 dan keyin `mathacademy` tenantida nechta login
xatosi bo'ldi?" savoliga javob berish uchun regex yozish kerak. JSON'da bu —
maydon bo'yicha filtr.

**Nega `winston` emas:** `winston` ham ishlaydi, lekin `pino` Node.js'da eng kam
overhead beradi va Nest bilan `nestjs-pino` orqali to'g'ridan-to'g'ri integratsiya
qilinadi (request kontekstini avtomatik oladi). Ikkalasi ham bepul; farq —
sozlash miqdorida.

### 3.2. O'rnatish

```bash
cd apps/api
npm install nestjs-pino pino-http pino
npm install --save-dev pino-pretty
```

**Narx: $0.** Barchasi MIT.

### 3.3. Konfiguratsiya — to'liq

```typescript
// apps/api/src/common/logging/logger.config.ts
import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * Log'ga HECH QACHON tushmasligi kerak bo'lgan maydonlar.
 *
 * DIQQAT: bu maktab tizimi. O'quvchilar VOYAGA YETMAGAN. Ularning ismi,
 * telefoni, manzili log'ga tushishi — bu shunchaki "yomon amaliyot" emas.
 * Yangi sezgir maydon qo'shilganda BU RO'YXATGA ham qo'shilishi SHART.
 */
const REDACT_PATHS = [
  // --- Autentifikatsiya ---
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.password_hash',
  '*.passwordHash',
  '*.currentPassword',
  '*.newPassword',
  '*.confirmPassword',
  '*.refreshToken',
  '*.accessToken',
  '*.refresh_token_hash',
  '*.token',

  // --- O'quvchi shaxsiy ma'lumoti (voyaga yetmagan!) ---
  '*.first_name',
  '*.last_name',
  '*.middle_name',
  '*.full_name',
  '*.phone',
  '*.phone_number',
  '*.guardian_phone',
  '*.address',
  '*.birth_date',
  '*.passport_number',
  '*.pinfl',           // O'zbekiston shaxsiy identifikatsiya raqami
  '*.photo_url',

  // --- Audit log tanasi ---
  // audit_logs.before_data / after_data — u yerda ISTALGAN maydon bo'lishi mumkin,
  // shu jumladan yuqoridagilarning hammasi. Butunlay bloklanadi.
  '*.before_data',
  '*.after_data',

  // --- Boshqa ---
  '*.secret',
  '*.apiKey',
];

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',

    // Redaction — pino darajasida, ilova darajasida EMAS.
    // Sabab: dasturchi unutadi, konfiguratsiya unutmaydi.
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
      remove: false, // maydon o'chirilmaydi — u BOR ekani ko'rinsin
    },

    // Correlation ID — har so'rovga bitta.
    // Reverse proxy bergan bo'lsa — o'shani ol, bo'lmasa yarat.
    genReqId: (req: Request, res: Response) => {
      const existing = req.headers['x-request-id'];
      const id = (typeof existing === 'string' && existing) || randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },

    customProps: (req: Request) => {
      // DIQQAT: customProps javob tugagach chaqiriladi, ya'ni guard'lar
      // (access.guard.ts) allaqachon ishlagan va req.user to'ldirilgan.
      // Shuning uchun bu yerda tenant_id mavjud bo'ladi.
      const user = (req as any).user;
      return {
        // ⚠️ ENG MUHIM MAYDON. Pastdagi 3.4-bo'limga qarang.
        tenant_id: user?.tenantId ?? null,
        actor_type: user?.type ?? null, // STAFF | GUARDIAN
        user_id: user?.userId ?? null,
        student_account_id: user?.studentAccountId ?? null,
      };
    },

    // Health check va metrics log'ni ko'mib tashlamasin.
    // Render har 30 soniyada /api/health ni uradi — kuniga ~2880 qator shovqin.
    autoLogging: {
      ignore: (req) =>
        req.url === '/api/health' ||
        req.url === '/api/ready' ||
        req.url === '/api/metrics',
    },

    serializers: {
      req: (req) => ({
        method: req.method,
        // ⚠️ url EMAS, route. Sabab: /api/students/12345 → har o'quvchi
        // alohida qiymat. Query stringda ham token bo'lishi mumkin.
        route: req.routeOptions?.url ?? String(req.url).split('?')[0],
        remoteAddress: req.remoteAddress,
        userAgent: req.headers?.['user-agent'],
      }),
      res: (res) => ({ statusCode: res.statusCode }),
      err: (err) => ({
        type: err.type,
        message: err.message,
        stack: err.stack,
        code: err.code,
      }),
    },

    // Dev'da o'qish uchun qulay, production'da toza JSON.
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
  },
};
```

### 3.4. ⚠️ Nega `tenant_id` har logga — bu shartsiz talab

Bu **ko'p ijarachilik tizim**. Kanon 5.1: shared database, har tenant-scoped
jadvalda `tenant_id`.

Shuning uchun:

```
"Xato bo'ldi"                    → foydasiz
"Tenant 5 da xato bo'ldi"        → foydali
```

Farq amaliy. Aytaylik, 3 ta akademiya xizmat qilinadi va `500` xatolari ko'paydi.

- `tenant_id` **bo'lmasa**: "tizimda xato bor". Nimadan boshlash kerak? Noma'lum.
- `tenant_id` **bo'lsa**: "xatolarning 100% i `tenant_id=5` da". Bu darhol
  javob beradi — bu tizim xatosi emas, bu **o'sha akademiyaning
  ma'lumotiga bog'liq** xato. Balki ular 500 o'quvchi import qilgan. Balki
  ularning akademik yili sozlanmagan.

Bu farq — tergovni **soatlardan daqiqalarga** qisqartiradi.

`tenant_id` JWT'dan olinadi (kanon 5.1: "Tenant JWT'dan olinadi, mijoz
parametridan hech qachon emas"). `customProps` da `req.user.tenantId` — bu
`auth.service.ts:593` da payload'ga qo'yilgan qiymatning aynan o'zi.

### 3.5. `main.ts` o'zgarishi

```typescript
// apps/api/src/main.ts
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  patchBigIntJson();

  const app = await NestFactory.create(AppModule, {
    // Nest'ning o'z bootstrap log'lari ham pino'ga o'tsin — buffer
    // qilinadi va logger tayyor bo'lgach chiqariladi.
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  // ... mavjud kod (CORS, ValidationPipe, Swagger) o'zgarmaydi ...

  // AllExceptionsFilter endi logger oladi — 3.6-bo'lim
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));

  await app.listen(port);

  // ⚠️ console.log O'RNIGA (hozirgi 142–143-qatorlar):
  const logger = app.get(Logger);
  logger.log(`API listening on port ${port}`);
}
```

`app.module.ts` ga:

```typescript
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './common/logging/logger.config';

@Module({
  imports: [
    LoggerModule.forRoot(loggerConfig),
    // ... mavjud 28 modul
  ],
})
export class AppModule {}
```

### 3.6. `AllExceptionsFilter` — 1.3-bo'limdagi eng jiddiy topilmaning tuzatilishi

Bu **eng muhim o'zgarish**. Hozir bu filtr xatoni jimgina yutadi.

```typescript
// apps/api/src/common/filters/all-exceptions.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException /* ... */ } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const mapped = this.map(exception);
    const statusCode = mapped.getStatus();
    const response = mapped.getResponse();
    const { message, error, code } = this.extractHttpResponse(response, mapped);

    // ⚠️ YANGI: asl xato bu yerda oxirgi marta ko'rinadi. Loglamasak —
    // u butunlay yo'qoladi (hozirgi holat).
    const logContext = {
      status_code: statusCode,
      error_code: code,
      // tenant_id pino customProps dan avtomatik keladi, lekin filtr
      // kontekstida ham aniq bo'lgani ma'qul — bu qo'lda tekshiriladi.
      tenant_id: req?.user?.tenantId ?? null,
      route: req?.route?.path ?? req?.originalUrl,
      method: req?.method,
      request_id: req?.id,
    };

    if (statusCode >= 500) {
      // 5xx — bu BIZNING xatomiz. Odam aralashuvi kerak.
      // err: asl exception, stack bilan — kesilmagan holda.
      this.logger.error({ ...logContext, err: exception }, 'Unhandled exception');
    } else if (statusCode === 401 || statusCode === 403) {
      // Autentifikatsiya/ruxsat rad etishi — normal ish. warn ham emas.
      // Aks holda alert fatigue (10.5-bo'lim).
      this.logger.log({ ...logContext }, 'Access denied');
    } else {
      // 4xx — foydalanuvchi xatosi. Bizga tuzatish kerak emas, lekin
      // trend muhim (masalan, 422 ko'paysa — API shartnomasi buzilgan).
      this.logger.warn({ ...logContext, reason: message }, 'Client error');
    }

    res.status(statusCode).json({
      statusCode,
      message,
      error,
      code,
      path: req?.originalUrl || req?.url,
      timestamp: new Date().toISOString(),
      // ⚠️ YANGI: foydalanuvchi bu ID ni aytadi, biz log'dan topamiz.
      // "Xato chiqdi" → "Xato chiqdi, ID: a3f2..." — bu tergovni o'zgartiradi.
      requestId: req?.id,
    });
  }

  // map() va extractHttpResponse() o'zgarishsiz qoladi.
}
```

⚠️ **`requestId` ni javobga qo'shish — kichik o'zgarish, katta samara.** Ota-ona
qo'ng'iroq qilganda "ekranda qanday raqam bor?" deb so'rash mumkin. 1.6-bo'limdagi
guardian login bagi shu bilan daqiqalarda topilardi.

### 3.7. `auth.service.ts` dagi 14 ta `console.error` — migratsiya

Naqsh bir xil (628-qator va 13 boshqa joy), shuning uchun o'zgarish mexanik:

```typescript
// OLDIN (auth.service.ts:628)
console.error('Guardian login error:', error);

// KEYIN — konstruktorga @InjectPinoLogger(AuthService.name) qo'shilgach:
this.logger.error(
  { err: error, tenant_id: tenantId?.toString(), tenant_slug: tenantSlug },
  'GUARDIAN_LOGIN_FAILED',
);
```

⚠️ Xom `usernameOrId` loglanmaydi — u `<tenant-slug>-<student-id>` (kanon 4.2),
faqat parse natijasi yoziladi.

**Ish hajmi:** 14 nuqta, bitta faylda. Bir o'tirishda bajariladi.

---

## 4. Nima loglanadi, nima yo'q

### 4.1. HECH QACHON log'ga tushmaydi

| Toifa | Misol | Nega |
|---|---|---|
| Parol | `password`, `password_hash` | Ochiq matn — halokat. Hash — offline brute-force materiali |
| Token | JWT, refresh token | Log'ni ko'rgan odam sessiyani o'g'irlaydi |
| **O'quvchi ismi** | `first_name`, `last_name` | **Voyaga yetmagan bola.** Kanon 10: yurist savoli |
| **O'quvchi aloqasi** | `phone`, `address`, `guardian_phone` | Yuqoridagidek |
| **PINFL / pasport** | `pinfl`, `passport_number` | Shaxsni to'liq identifikatsiya qiladi |
| Audit tanasi | `before_data`, `after_data` | U yerda **istalgan** maydon bo'lishi mumkin |
| To'liq `req.body` | `logger.info({ body: req.body })` | Bir qatorda yuqoridagilarning hammasi |

Oxirgi qator eng ko'p buziladigan qoida. **`req.body` hech qachon butunligicha
loglanmaydi.** Kerakli maydon aniq nomlanadi.

### 4.2. Log'ga tushishi KERAK

- `request_id` — bog'lash uchun
- **`tenant_id`** — 3.4-bo'lim
- `user_id` / `student_account_id` — **ID, ism EMAS**
- Domen ID'lari: `student_id`, `group_id`, `assessment_id` (bular ichki BigInt,
  o'zi PII emas)
- Qaror va sabab: `'GRADE_REJECTED'` + `reason: 'MAX_SCORE_EXCEEDED'`
- `duration_ms`, `status_code`, `route`

**Muhim ajratish:** `student_id: 12345` — bu **ID**, u o'zicha hech kimga hech
narsa demaydi. `first_name: "Aziz"` — bu **ma'lumot**. Birinchisi loglanadi,
ikkinchisi yo'q. Kerak bo'lsa, ID orqali bazadan qaraladi — va o'sha qarash
`audit_logs` ga tushadi.

### 4.3. Log darajalari

| Daraja | Qachon | Misol |
|---|---|---|
| `fatal` | Protsess davom eta olmaydi | `env.validation.ts` yiqildi, startda |
| `error` | **Odam aralashuvi kerak** | 5xx, audit yozuvi yiqildi |
| `warn` | G'ayrioddiy, lekin tizim eplaydi | 4xx trend, sekin so'rov |
| `info` | Muhim biznes hodisasi | Login, baho kiritildi, tenant yaratildi |
| `debug` | Diagnostika | Faqat vaqtinchalik |

**Qattiq qoida: `error` — bu "kimdir tuzatishi kerak" degani.** Foydalanuvchi
noto'g'ri parol kiritsa — bu `info`, `error` emas. Hozirgi kodda
`auth.service.ts` xato parolni `UnauthorizedException` qiladi va uni
`console.error` ga bermaydi — **bu to'g'ri**, saqlanadi.

### 4.4. `console.log` taqiqlanadi — lint bilan majburlanadi

Qoida hujjatda yozilsa — unutiladi. Linter'da yozilsa — unutilmaydi.

`apps/api/eslint.config.mjs` (hozir bu qoida **yo'q**):

```javascript
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    'prettier/prettier': ['error', { endOfLine: 'auto' }],

    // ⚠️ YANGI: console — xato, ogohlantirish emas.
    // Sabab: console strukturasiz, kontekstsiz va Render'da yo'qoladi.
    // O'rniga: PinoLogger inject qilinadi.
    'no-console': 'error',
  },
},
{
  // Istisno: seed va migration skriptlari — ular CLI, ularda logger yo'q
  // va bo'lishi ham shart emas.
  files: ['prisma/seed.ts', 'prisma/**/*.ts'],
  rules: { 'no-console': 'off' },
},
```

⚠️ **Migratsiya tartibi muhim.** Hozir 18 ta `console.*` bor — `no-console: 'error'`
ni birdan yoqish lint'ni **darhol sindiradi**. Tartib:

1. `no-console: 'warn'` qilib qo'shiladi — CI yiqilmaydi, lekin ko'rinadi
2. 3.5–3.7-bo'limlar bajariladi (18 nuqta tuzatiladi)
3. `no-console: 'error'` ga o'tkaziladi

⚠️ **Bu qoida faqat CI bo'lganda kuchga kiradi.** Kanon 6: "CI yo'q — `.github/`
yo'q". Lint qoidasi lokal `npm run lint` da ishlaydi, lekin uni **hech kim
majburlamaydi**. To'liq samara CI hujjati bilan birga keladi.

---

## 5. Metrics — nima o'lchanadi

### 5.1. Oltin signallar

| Signal | Savol | Metrika |
|---|---|---|
| **Latency** | Qancha vaqt oldi? | `http_request_duration_seconds` |
| **Traffic** | Qancha so'rov? | Yuqoridagining `_count` i |
| **Errors** | Nechtasi buzildi? | `status` label bo'yicha kesim |
| **Saturation** | Resurs to'ldimi? | `db_pool_*` |

Saturation aynan bu loyihada muhim: Prisma pool to'lganda **CPU past, xotira
normal**, lekin hamma so'rov kutadi. Faqat saturation buni ko'rsatadi.

### 5.2. O'rnatish va kod

```bash
npm install prom-client
```
**Narx: $0** (Apache-2.0).

```typescript
// apps/api/src/common/metrics/metrics.registry.ts
import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';

export const registry = new Registry();

// Node.js'ning o'zi haqida: event loop lag, heap, GC. Bepul va foydali.
collectDefaultMetrics({ register: registry, prefix: 'mathacademy_' });

// --------------- Texnik ---------------

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP so\'rov davomiyligi',
  // ⚠️ `route` — `/api/students/:id`. `path` EMAS.
  // /api/students/12345 label bo'lsa — har o'quvchi alohida seriya.
  // 5000 o'quvchi = 5000 seriya = Grafana free tier limiti (10k) portlaydi.
  labelNames: ['method', 'route', 'status_code', 'tenant_id'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const dbPoolWaiting = new Gauge({
  name: 'mathacademy_db_pool_waiting_count',
  help: 'Prisma pool ulanishini kutayotgan so\'rovlar (saturation)',
  registers: [registry],
});

// --------------- Domen ---------------

export const guardianLoginAttempts = new Counter({
  name: 'mathacademy_guardian_login_attempts_total',
  help: 'Guardian login urinishlari',
  // ⚠️ Bu metrika 1.6-bo'limdagi bagni ushlagan bo'lardi.
  // reason: SUCCESS | INVALID_CREDENTIALS | TENANT_NOT_FOUND | LOCKED | MALFORMED_LOGIN
  labelNames: ['tenant_id', 'reason'] as const,
  registers: [registry],
});

export const gradesEntered = new Counter({
  name: 'mathacademy_grades_entered_total',
  help: 'Kiritilgan baholar soni',
  labelNames: ['tenant_id'] as const,
  registers: [registry],
});

export const activeUsersDaily = new Gauge({
  name: 'mathacademy_active_users_daily',
  help: 'Kunlik faol foydalanuvchi (cron bilan hisoblanadi)',
  labelNames: ['tenant_id', 'actor_type'] as const, // STAFF | GUARDIAN
  registers: [registry],
});

/**
 * ⚠️ ENG MUHIM METRIKA (agar amalga oshirilsa).
 *
 * Tenant 845 ta Prisma chaqiruv nuqtasida QO'LDA boshqariladi. Bittasi unutilsa —
 * jimgina ma'lumot oqishi. 1.6-bo'lim: bunday nosozlikda hech kim qo'ng'iroq
 * qilmaydi.
 *
 * Prisma extension joriy qilinganda ($extends, kanon 5.1), extension
 * qaytgan yozuvlarning tenant_id sini so'rovchining tenant_id si bilan
 * solishtira oladi. Farq bo'lsa — bu counter oshadi.
 *
 * Bu HAR QANDAY nolga teng bo'lmagan qiymatda eng yuqori darajali alert.
 */
export const tenantIsolationViolations = new Counter({
  name: 'mathacademy_tenant_isolation_violations_total',
  help: 'Tenant izolyatsiyasi buzilishi (HECH QACHON > 0 bo\'lmasligi kerak)',
  labelNames: ['model'] as const,
  registers: [registry],
});
```

### 5.3. ⚠️ Tenant bo'yicha kesim — nega `tenant_id` bu yerda label bo'lishi MUMKIN

3.4-bo'limdagi mantiq metrikada ham amal qiladi, lekin **ehtiyot bilan**.

Prometheus'da seriya soni = label kombinatsiyalari ko'paytmasi. Shuning uchun
qoida: **label past kardinallikli bo'lishi shart**.

- `user_id` label sifatida — **yaroqsiz**. Minglab foydalanuvchi = minglab seriya.
- `student_id` — **yaroqsiz**. Xuddi shunday.
- `tenant_id` — **yaroqli**, chunki tenantlar **o'nlab**, minglab emas.

Hisob: `method` (5) × `route` (~150) × `status_code` (~8) × `tenant_id` (10) ×
bucket (11) ≈ **66 000 seriya**. ⚠️ Bu Grafana Cloud free tier'ning **10 000
active series** limitidan oshadi (11-bo'lim).

**Yechim — halol variantlar:**

1. `tenant_id` ni faqat **muhim** metrikalarga qo'y, `http_request_duration_seconds`
   ga qo'yma. Tenant kesimi kerak bo'lganda — **log'dan** ol (log'da `tenant_id`
   bor, 3.4-bo'lim). Bu kardinallikni ~6 600 ga tushiradi.
2. `route` ni guruhla: `/api/students/*` → `students`. ~150 → ~28 (modul soni).
3. O'lchab qara. **10 tenant bilan bu muammo emas. 100 tenant bilan muammo.**

**Taklif: 1-variant.** Sabab: `tenant_id` metrikaga ham, logga ham kerak degan
fikr chiroyli, lekin free tier'ni portlatadi. Log'da tenant bor — bu yetadi.
`tenant_id` label faqat domen metrikalarida qoladi (`guardian_login_attempts`,
`grades_entered`) — ular kam kardinallikli.

Bu qaror **o'lchov bilan qayta ko'riladi**: `/metrics` chiqishida seriya sonini
sanash mumkin.

### 5.4. Interceptor

```typescript
// apps/api/src/common/metrics/metrics.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { httpRequestDuration } from './metrics.registry';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = process.hrtime.bigint();
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const record = () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestDuration
        .labels({
          method: req.method,
          // ⚠️ Nest route path — `:id` bilan, real qiymat bilan emas.
          route: req.route?.path ?? 'unknown',
          status_code: String(res.statusCode),
        })
        .observe(seconds);
    };

    // tap ikkala tomonni ham ushlaydi: muvaffaqiyat va xato.
    // Xatoni ham o'lchash SHART — aks holda "errors" signali yo'q.
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
```

### 5.5. ⚠️ `/metrics` endpoint — himoyalangan bo'lishi SHART

Ochiq `/metrics` — bu ma'lumot oqishi. U yerda: tenantlar soni, route'lar
ro'yxati (butun API strukturasi), yuklama naqshi. **Repo public** (kanon 0) —
demak, endpoint URL'i ham ma'lum.

```typescript
// apps/api/src/common/metrics/metrics.controller.ts
import { Controller, ForbiddenException, Get, Header, Headers } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { registry } from './metrics.registry';
import { timingSafeEqual } from 'node:crypto';

@ApiExcludeController() // Swagger'da ko'rinmasin — u /api/docs da ochiq
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async scrape(@Headers('authorization') auth?: string): Promise<string> {
    const expected = process.env.METRICS_TOKEN;

    // ⚠️ Token sozlanmagan bo'lsa — endpoint YOPIQ.
    // "Default ochiq" — bu shu yerda xavfsizlik bagi bo'ladi.
    if (!expected) throw new ForbiddenException('METRICS_DISABLED');

    const provided = String(auth ?? '').replace(/^Bearer\s+/i, '');
    if (!this.safeEqual(provided, expected)) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return registry.metrics();
  }

  // Oddiy `===` timing attack'ga ochiq. Uzunlik ham tekshiriladi,
  // chunki timingSafeEqual turli uzunlikda otadi.
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
```

`METRICS_TOKEN` `env.validation.ts` ga qo'shiladi (kanon 5.4: "noto'g'ri
konfiguratsiyada ishga tushmaydi") — **ixtiyoriy**, lekin production'da talab
qilinadigan qilib.

---

## 6. Xatoliklarni kuzatish — Sentry

### 6.1. Nega Sentry va nega bu birinchi qadam

Metrika "5 ta 500 xato bo'ldi" deydi. Sentry "`students.service.ts:412` da
`undefined` ni o'qishga urindingiz, `a3f2` commit'idan boshlab, 5 marta,
3 xil tenant'da" deydi.

1.3-bo'limni eslang: hozir `AllExceptionsFilter` asl xatoni **tashlab
yuboradi**. Sentry — bu topilmaning eng tez yechimi.

### 6.2. Narx — tasdiqlangan

| Plan | Narx | Nima kiradi |
|---|---|---|
| **Developer (free)** | **$0/oy** | **5 000 xato/oy**, 1 foydalanuvchi, 30 kun saqlash, 5M span, 50 replay, 10 dashboard, **faqat email alert** |
| Team | $26/oy (yillik) | 50 000 xato |
| Business | $80/oy | 50 000 xato + kengaytirilgan |

Manba: [sentry.io/pricing](https://sentry.io/pricing/) (2026-07-15 da tekshirildi).

**5 000 xato/oy yetadimi?** Halol javob: **o'lchov bilan aniqlanadi.** Taxmin:
3 akademiya, ~200 foydalanuvchi, kuniga ~5 000 so'rov. Agar xato darajasi 0.1%
bo'lsa — kuniga 5 ta, oyiga 150 ta. Chegaradan **33 marta** pastda.

⚠️ **Xavf:** bitta takrorlanuvchi bag kvotani bir kunda yeydi. Masalan, cron har
daqiqada yiqilsa — 43 200 hodisa/oy. Shuning uchun:

```typescript
// Sentry'ning o'z rate limit'i ilova tomonda ham qo'yiladi
tracesSampleRate: 0, // tracing kerak emas (8-bo'lim) — kvotani tejaydi
```

Va Sentry loyiha sozlamalarida **spike protection** yoqiladi (bepul).

### 6.3. ⚠️ Nega Datadog / New Relic EMAS

Halol taqqoslash, o'ylab topilgan sabab emas:

| Vosita | Narx | Qaror |
|---|---|---|
| **Datadog** | Infra **$15/host/oy** + APM **$31/host/oy** + loglar **$0.10/GB** | ❌ API + Postgres + Redis = 3 host. Faqat infra+APM ≈ **$138/oy**. Byudjet $0 |
| **New Relic** | Free: **100 GB/oy ingest**, 1 to'liq foydalanuvchi. Keyin **$0.40/GB** | ⚠️ Free tier **haqiqatan bor** va u yaxshi. Lekin: 100 GB oshsa narx keskin ko'tariladi va u — "hamma narsa bitta joyda" platformasi, ya'ni undan chiqish qiyin. Bu loyihaga hozir **ortiqcha** |
| **Sentry free** | **$0** | ✅ **Tanlandi** |

Manbalar: [Datadog pricing](https://www.datadoghq.com/pricing/),
[New Relic free tier](https://newrelic.com/pricing/free-tier).

New Relic haqida halol bo'lish kerak: uni "qimmat" deb rad etish **noto'g'ri**
bo'lardi — uning free tier'i kengroq. Rad etish sababi boshqa: bu loyihaga
hozir kerak bo'lgan narsa — **xato kuzatuvi**, to'liq APM platformasi emas.
Sentry aynan shuni qiladi va u kichikroq.

### 6.4. Setup — PII scrubbing bilan

```bash
npm install @sentry/node
```

```typescript
// apps/api/src/common/sentry/sentry.config.ts
import * as Sentry from '@sentry/node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  // DSN yo'q bo'lsa — Sentry o'chiq. Dev'da bu normal.
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION ?? 'dev',

    // ⚠️ Free tier: 5 000 xato/oy (6.2). Tracing kvotani yeydi va
    // 8-bo'limga ko'ra hozir kerak emas.
    tracesSampleRate: 0,

    // ⚠️ MAJBURIY. Bu bo'lmasa Sentry IP, cookie va foydalanuvchi
    // ma'lumotini avtomatik yuboradi.
    sendDefaultPii: false,

    beforeSend(event) {
      // --- Header'lar ---
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      // --- So'rov tanasi BUTUNLAY olib tashlanadi ---
      // Sabab: u yerda parol, token va o'quvchi ismi bo'lishi mumkin.
      // "Kerakli maydonni qoldiraylik" — bu yondashuv har yangi DTU bilan
      // buziladi. 128 ta DTO bor (kanon 3). Hammasini tekshirib
      // bo'lmaydi → hech narsa yubormaymiz.
      if (event.request?.data) {
        event.request.data = '[REMOVED]';
      }

      // --- URL: query string tashlanadi ---
      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0];
      }

      // --- Foydalanuvchi: FAQAT ID va tenant ---
      // ⚠️ O'quvchi ismi Sentry'ga (AQSh serveri) ketmaydi.
      // Bu voyaga yetmagan bolalar ma'lumoti — kanon 10: yurist savoli.
      if (event.user) {
        event.user = {
          id: event.user.id,
          // ip_address, email, username — hammasi tashlanadi
        };
      }

      return event;
    },

    ignoreErrors: [
      // Klient uzilishi — bizning xatomiz emas, lekin kvotani yeydi
      'ECONNRESET',
      'EPIPE',
      'Client network socket disconnected',
    ],
  });
}
```

`AllExceptionsFilter` da (3.6-bo'lim) 5xx tarmog'iga:

```typescript
if (statusCode >= 500) {
  this.logger.error({ ...logContext, err: exception }, 'Unhandled exception');

  // ⚠️ Faqat 5xx. 4xx Sentry'ga bormaydi — u foydalanuvchi xatosi
  // va u 5 000 lik kvotani bir haftada yeb qo'yadi.
  Sentry.withScope((scope) => {
    scope.setTag('tenant_id', String(logContext.tenant_id ?? 'unknown'));
    scope.setTag('route', String(logContext.route));
    scope.setTag('error_code', String(logContext.error_code));
    scope.setContext('request', { request_id: logContext.request_id });
    Sentry.captureException(exception);
  });
}
```

⚠️ **`tenant_id` — tag, `extra` emas.** Sabab: Sentry'da tag bo'yicha filtrlash
va guruhlash mumkin, `extra` bo'yicha yo'q. "Bu xato faqat 5-tenantda"
degan xulosaga shu bilan kelinadi.

---

## 7. Health check — `/health` va `/ready`

### 7.1. Nega ikkita

Bu ikkalasi turli savolga javob beradi va ularni chalkashtirish — Render'da
**cheksiz restart tsikli** demakdir.

| Endpoint | Savol | Yiqilsa nima bo'ladi |
|---|---|---|
| `/api/health` (liveness) | Protsess **tirikmi**? | Konteyner **restart** qilinadi |
| `/api/ready` (readiness) | Trafik qabul qila **oladimi**? | Trafik **yuborilmaydi**, restart yo'q |

⚠️ **Muhim farq.** Agar `/health` Postgres'ni tekshirsa va Postgres bir daqiqaga
yiqilsa — Render ilovani restart qiladi. Restart Postgres'ni tuzatmaydi. Ilova
qayta ko'tariladi, `/health` yana yiqiladi, yana restart. **Cheksiz tsikl.**
Shuning uchun `/health` **hech narsani tekshirmaydi** — u faqat "protsess javob
beryapti" deydi.

### 7.2. Kod

```bash
npm install @nestjs/terminus
```
**Narx: $0** (MIT, Nest'ning rasmiy paketi).

```typescript
// apps/api/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@ApiExcludeController()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /**
   * LIVENESS. Hech narsani tekshirmaydi — ataylab.
   * "Event loop bloklanmagan va protsess javob beryapti" — shu yetadi.
   * DB tekshiruvi bu yerga QO'YILMAYDI (7.1-bo'lim).
   */
  @Get('health')
  @Public()
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  /**
   * READINESS. Bog'liqliklar tekshiriladi.
   * Render buni `healthCheckPath` sifatida ishlatadi.
   */
  @Get('ready')
  @Public()
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prisma.isHealthy('postgres'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
```

```typescript
// apps/api/src/modules/health/prisma.health.ts
@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const check = this.indicator.check(key);
    const start = Date.now();
    try {
      // Eng arzon so'rov. Jadval o'qilmaydi — faqat "ulanish bormi".
      await this.prisma.$queryRaw`SELECT 1`;
      return check.up({ duration_ms: Date.now() - start });
    } catch (err) {
      return check.down({ duration_ms: Date.now() - start, message: (err as Error).message });
    }
  }
}
```

`RedisHealthIndicator` — xuddi shu naqsh, `SELECT 1` o'rniga Redis `PING`.

⚠️ **`@Public()` shart.** Kanon 5.3: guard'lar (`access.guard.ts`) global. Health
check JWT'siz kelishi kerak — Render token bermaydi. Agar `@Public()` unutilsa,
`/ready` 401 qaytaradi va Render deploy'ni **muvaffaqiyatsiz** deb hisoblaydi.

### 7.3. Render sozlamasi

```yaml
# render.yaml
services:
  - type: web
    name: mathacademy-api
    healthCheckPath: /api/ready
```

Render `healthCheckPath` ni deploy paytida ishlatadi: yangi versiya `200`
qaytarmaguncha eski versiya trafikni ushlab turadi.

⚠️ **Render free tier haqiqati:** bepul web servis **15 daqiqa harakatsizlikdan
keyin o'chadi**, keyingi so'rov **1 daqiqagacha** kutadi. Bu — kanon 0 dagi
"real xodimlar va ota-onalar har kuni ishlatadi" bilan **mos kelmaydi**. Ota-ona
kechqurun kirsa, 1 daqiqa kutadi va "sayt ishlamayapti" deb o'ylaydi.

Bepul Postgres esa **30 kundan keyin o'chadi** va 1 GB bilan chegaralangan.

Manba: [render.com/pricing](https://render.com/pricing/) (2026-07-15).

**Xulosa:** production uchun Render'ning **$7/oy** web servis rejasi kerak
(512 MB RAM). Bu — bu hujjatdagi **yagona majburiy xarajat**, va u
observability xarajati emas, **hosting** xarajati. Bepul rejada uptime
monitoringning ma'nosi yo'q, chunki servis ataylab o'chadi.

⚠️ **Nozik nuqta:** Better Stack yoki UptimeRobot bilan har 3 daqiqada `/api/health`
ni urish free tier'ni "uyg'oq" tutadi. Bu ishlaydi, lekin: 750 instance-soat/oy
limiti bor va doimiy uyg'oq servis oyiga ~720 soat yeydi. Ya'ni **bitta** servis
uchun yetadi, ikkitasiga yetmaydi. Bu — vaqtinchalik yechim, strategiya emas.

---

## 8. Tracing — OpenTelemetry

### 8.1. ⚠️ Halol bo'l: hozir ERTA

Tracing chiroyli. Grafana Tempo free tier'da 50 GB beradi. Uni qo'shish
qiyin emas.

**Va shunga qaramay: hozir kerak emas.**

Sabab — tracing **tarmoq va servis chegaralarini** ko'rsatadi. Bu loyihada
chegara nechta?

| Komponent | Soni |
|---|---|
| Backend servis | **1** (monolit, NestJS) |
| Ma'lumotlar bazasi | **1** (PostgreSQL) |
| Cache | 1 (Redis) |
| Message queue | **0** |
| Tashqi API | **0** (kodda topilmadi) |

Trace ko'rsatadigan narsa: `HTTP → Prisma → HTTP`. Ikki span. Bu ma'lumotni
`duration_ms` (3-bo'lim) va sekin so'rov log'i (9-bo'lim) **allaqachon** beradi
— va ular bepul, sozlash talab qilmaydi.

⚠️ Bundan tashqari, tracing **byudjetni yeydi**: har span log hajmiga qo'shiladi,
Sentry'da kvota, Grafana'da GB. $0 byudjetda bu — 5 000 lik Sentry kvotasini
tracing'ga sarflash demak.

### 8.2. Qachon kerak bo'ladi — aniq chegara

Tracing quyidagilardan **kamida bittasi** ro'y berganda qo'shiladi:

1. **Ikkinchi deploy qilinadigan protsess paydo bo'lganda.** Masalan, alohida
   worker (hisobot generatsiyasi, `grade_snapshots` hisobi) yoki cron servisi.
   Shunda "so'rov qayerda qoldi" savoli haqiqiy bo'ladi.
2. **Message queue qo'shilganda** (BullMQ). Job HTTP so'rovdan uziladi va
   `request_id` u yerga o'z-o'zidan bormaydi.
3. **Tashqi API chaqiruvi paydo bo'lganda** — SMS (Eskiz), to'lov (Click/Payme).
   Ular sekin va ishonchsiz; ular qanchalik sekinligini bilish kerak.
4. **Bitta endpoint ichida 10 dan ortiq Prisma so'rovi bo'lganda** va qaysi biri
   sekinligini log'dan aniqlab bo'lmay qolganda. `students.service.ts` — **2079
   qator** (kanon 3), bu ehtimoldan uzoq emas.

Shu chegaralardan biri kesib o'tilgunga qadar — **tracing yozilmaydi**. Uni
"kelajak uchun" qo'shish — bu bugungi kvotani ertangi foyda uchun sarflash.

### 8.3. Ariza qoldirilmoqda

Agar 8.2 dagi shart bajarilsa, texnologiya tanlovi allaqachon ma'lum:
`@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`,
eksport Grafana Tempo'ga (free tier, 11-bo'lim). Sampling 10% dan
boshlanadi. Bu hujjat o'shanda kengaytiriladi.

---

## 9. Sekin so'rovlar — Prisma query logging

### 9.1. ⚠️ Nega bu loyihada alohida muhim

Tenant filtri **845 ta chaqiruv nuqtasida** — eng kattasi `findFirst`, 272 ta.

Endi savol: bu 845 ta so'rovning nechtasida **indeks** bor?

**Javob noma'lum.** Indeks auditi qilinmagan. Va bu tasodifiy emas —
`tenant_id` bo'yicha filtrlash **har doim** kompozit indeks talab qiladi:
`(tenant_id, <boshqa ustun>)`. Faqat `tenant_id` bo'yicha indeks yetarli emas,
chunki bitta tenantda minglab yozuv bo'ladi.

Nima bo'ladi indekssiz: 3 ta akademiya, har birida 500 o'quvchi = 1 500 qator.
Sequential scan 1 500 qatorda — **3 ms**. Hech kim sezmaydi. 50 akademiya,
25 000 qator — **50 ms**. Hali ham chidasa bo'ladi. 200 akademiya —
**200 ms har so'rovda**, va bitta sahifada 10 so'rov bo'lsa — 2 soniya.

⚠️ **Bu — jimgina degradatsiya.** U bir kunda kelmaydi, u asta-sekin keladi va
"sayt sekinlashdi" degan noaniq shikoyat bilan tugaydi. Metrika bo'lmasa,
qachondan boshlanganini ham bilib bo'lmaydi.

Bu — **eng katta o'sish xavfi**. Kanon 7: "O'zbekiston tayyorlov akademiyalari
uchun mahsulot". Mahsulot bo'lish = tenant soni o'sishi = bu muammoning kelishi.

### 9.2. Hozirgi holat

`apps/api/src/prisma/prisma.service.ts:26-28`:

```typescript
log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
```

Ya'ni: **so'rovlar umuman loglanmaydi**, na dev'da, na production'da. Sekin
so'rovni topishning **hech qanday yo'li yo'q**.

### 9.3. Yechim: davomiylik filtri bilan query logging

Muhim: **hamma so'rovni loglash yaroqsiz**. Kuniga 5 000 so'rov × 10 query =
50 000 log qatori/kun. Bu Grafana free tier'ni yeydi va shovqin yaratadi.

Shuning uchun — **faqat sekin so'rovlar**:

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

// Bu chegaradan sekin so'rov loglanadi. 200 ms — boshlang'ich taxmin,
// baseline o'lchangach tuzatiladi.
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 200);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @InjectPinoLogger(PrismaService.name) private readonly logger: PinoLogger,
  ) {
    const adapter = new PrismaPg({
      connectionString: requireEnv('DATABASE_URL'),
    });

    super({
      adapter,
      // ⚠️ O'ZGARISH: 'query' event sifatida chiqariladi (stdout'ga emas).
      // emit: 'event' bo'lmasa — Prisma o'zi console'ga bosadi va biz
      // filtrlay olmaymiz.
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    // ⚠️ FAQAT sekin so'rovlar. Hammasi emas.
    this.$on('query' as never, (e: any) => {
      if (e.duration < SLOW_QUERY_MS) return;

      this.logger.warn(
        {
          duration_ms: e.duration,
          // ⚠️ e.query — SQL matni. Unda `$1, $2` placeholder'lari bor,
          // real qiymatlar EMAS. Bu to'g'ri: e.params da o'quvchi ismi
          // bo'lishi mumkin va u LOGLANMAYDI (4.1-bo'lim).
          query: e.query,
          target: e.target,
        },
        'SLOW_QUERY',
      );
    });

    this.$on('error' as never, (e: any) => {
      this.logger.error({ target: e.target, message: e.message }, 'PRISMA_ERROR');
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

⚠️ **`e.params` HECH QACHON loglanmaydi.** U yerda `WHERE first_name = 'Aziz'`
ning `'Aziz'` qismi bo'ladi. Bu — 4.1-bo'lim qoidasi.

⚠️ **Tekshirilishi kerak:** Prisma **7.3** + `PrismaPg` driver adapter
kombinatsiyasida `$on('query')` hodisasi chiqishi **kod bilan tasdiqlanmagan**.
Driver adapter ishlatilganda query event'lari adapter darajasida chiqadi va
Prisma versiyalari orasida bu xatti-harakat o'zgargan. **Joriy qilishdan oldin
lokal muhitda bitta so'rov bilan tekshirilsin.** Ishlamasa — muqobil:
PostgreSQL'ning o'z `log_min_duration_statement` sozlamasi (Render'da
`pg_stat_statements` extension'i orqali).

### 9.4. Sekin so'rovdan indeksga — ish oqimi

Sekin so'rov log'i — bu **birinchi qadam**, oxirgisi emas:

1. Log ko'rsatadi: `SLOW_QUERY duration_ms=340 query="SELECT ... FROM students WHERE tenant_id = $1 AND ..."`
2. Qo'lda: `EXPLAIN ANALYZE` shu so'rov ustida
3. `Seq Scan on students` ko'rinsa — indeks yo'q
4. Migration: `CREATE INDEX CONCURRENTLY idx_students_tenant_group ON students(tenant_id, group_id);`

⚠️ `CONCURRENTLY` **shart** — u jadvalni bloklamaydi. Kanon 0: tizim **har kuni
ishlatiladi**. Oddiy `CREATE INDEX` katta jadvalda darsni to'xtatib qo'yishi
mumkin.

⚠️ **Bu bo'lim indeks auditining o'rnini BOSMAYDI.** Sekin so'rov log'i
muammoni **kelganda** ko'rsatadi. Indeks auditi uni **kelishidan oldin**
oldini oladi. Ikkalasi ham kerak; audit — ma'lumot modeli hujjatining ishi.

---

## 10. Ogohlantirish (alerting)

### 10.1. Prinsip: nima uchun uyg'onish kerak

Alert — bu "diqqat" emas. Alert — bu **"hozir tur va tuzat"**. Agar javob
"ha, biladi, o'zi tuzaladi" bo'lsa — bu alert emas, bu dashboard paneli.

Jamoa — **bir kishi** (kanon 0). "On-call rotatsiyasi" yo'q va uni bor deb
ko'rsatish yolg'on bo'lardi. Shuning uchun alert ro'yxati **qisqa**.

### 10.2. Alert ro'yxati — to'liq

| # | Alert | Chegara | Daraja | Nega |
|---|---|---|---|---|
| 1 | **Tenant izolyatsiya buzilishi** | `> 0` | 🔴 **Darhol** | Ma'lumot oqishi. Boshqa hamma narsadan muhim |
| 2 | Baza ulanmayapti | `/ready` 2 marta ketma-ket yiqildi | 🔴 Darhol | Tizim ishlamayapti |
| 3 | Xato darajasi | 5xx > **5%**, 10 daqiqa | 🔴 Darhol | Foydalanuvchi zarar ko'ryapti |
| 4 | API javob bermayapti | `/health` 3 marta yiqildi | 🔴 Darhol | Uptime |
| 5 | Audit yozuvi yiqildi | `> 0` | 🟡 Ish vaqtida | Iz yo'qolyapti (2.3-bo'lim) |
| 6 | Sekin so'rov trendi | p95 > 1s, 30 daqiqa | 🟡 Ish vaqtida | Degradatsiya (9-bo'lim) |

**Uchinchi daraja yo'q.** "Info alert" — bu dashboard.

### 10.3. ⚠️ 1-alert: tenant izolyatsiyasi

Bu — eng yuqori darajali alert va u alohida tushuntirishga loyiq.

1.6-bo'lim: guardian login bagini ota-ona topdi, chunki u **ko'rinardi**. Tenant
oqishi **ko'rinmaydi** — hech qanday xato yo'q, javob `200 OK`, ma'lumot
"to'g'ri" ko'rinadi. Faqat u **boshqa akademiyaning** ma'lumoti.

⚠️ **Halol e'tirof: hozir buni aniqlashning iloji YO'Q.** 845 ta qo'lda nuqta —
ularning to'g'riligini o'lchaydigan mexanizm mavjud emas.

Bu alert **faqat Prisma extension joriy qilingandan keyin** (kanon 5.1)
mumkin bo'ladi. Extension qaytgan yozuvlarni tekshira oladi:

```typescript
// Prisma extension ichida — TAXMINIY eskiz, extension hujjati bilan
// muvofiqlashtirilishi kerak
const result = await query(args);
const expected = getTenantIdFromContext();

// Har yozuvning tenant_id si so'rovchining tenant_id siga teng bo'lishi SHART
const leaked = toArray(result).filter(
  (row) => row?.tenant_id != null && row.tenant_id !== expected,
);

if (leaked.length > 0) {
  tenantIsolationViolations.labels({ model }).inc(leaked.length);
  // ⚠️ Bu bag emas, bu INSIDENT. Ma'lumot allaqachon qaytdi.
  logger.fatal({ model, expected: String(expected), leaked_count: leaked.length },
    'TENANT_ISOLATION_VIOLATION');
}
```

⚠️ **Bu tekshiruv narxi bor** — har natijani skanerlash. Uni faqat
`NODE_ENV !== 'production'` da yoki namuna (1%) bilan yoqish mumkin. Bu qaror
extension hujjatiga tegishli; bu yerda faqat **metrika va alert** talab
qilinayotgani qayd etiladi.

**Bog'liqlik:** bu alert 1-o'rinda, lekin u **extensionga bog'liq**. Extension
yo'q ekan — alert ham yo'q. Bu 12-bo'limdagi reja tartibini belgilaydi.

### 10.4. Kanal: Telegram bot

**Nega Telegram:**

| Kanal | Narx | Qaror |
|---|---|---|
| **Telegram bot** | **$0** — Bot API cheksiz va bepul | ✅ **Tanlandi** |
| Email (Sentry free) | $0 | ⚠️ Zaxira. Tunda email'ni hech kim ko'rmaydi |
| SMS (Eskiz) | ~50–100 so'm/SMS | ❌ Pulli va ortiqcha |
| PagerDuty | $21/foydalanuvchi/oy | ❌ Byudjet |
| Slack | $0 (free plan) | ❌ O'zbekistonda hech kim ishlatmaydi |

O'zbekistonda **hamma Telegram'da**. Bildirishnoma darhol keladi, ilova
allaqachon o'rnatilgan, sozlash 5 daqiqa. Bot API — **bepul, limitsiz**
(guruh chatga daqiqasiga ~20 xabar cheklovi bor — bizga yetadi).

```typescript
// apps/api/src/common/alerting/telegram.alerter.ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

type AlertSeverity = 'CRITICAL' | 'WARNING';

@Injectable()
export class TelegramAlerter {
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_ALERT_CHAT_ID;

  // ⚠️ Deduplikatsiya. Bu bo'lmasa: bitta bag daqiqasiga 100 xabar
  // yuboradi, Telegram bloklaydi, va (eng yomoni) siz o'qishni to'xtatasiz.
  // Bu — alert fatigue, va u himoya tizimini O'CHIRADI.
  private readonly lastSent = new Map<string, number>();
  private readonly COOLDOWN_MS = 15 * 60 * 1000; // 15 daqiqa

  constructor(
    @InjectPinoLogger(TelegramAlerter.name) private readonly logger: PinoLogger,
  ) {}

  async send(key: string, severity: AlertSeverity, text: string): Promise<void> {
    if (!this.token || !this.chatId) return; // sozlanmagan — jim

    const now = Date.now();
    const last = this.lastSent.get(key) ?? 0;
    if (now - last < this.COOLDOWN_MS) return;
    this.lastSent.set(key, now);

    const icon = severity === 'CRITICAL' ? '🔴' : '🟡';
    const env = process.env.NODE_ENV ?? 'dev';
    const body = `${icon} *${severity}* \\[${env}\\]\n\n${text}`;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: body,
            parse_mode: 'MarkdownV2',
          }),
          // ⚠️ Timeout SHART. Telegram javob bermasa, alert kodi
          // ilovani bloklamasligi kerak.
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!res.ok) {
        this.logger.warn({ status: res.status }, 'TELEGRAM_ALERT_REJECTED');
      }
    } catch (err) {
      // ⚠️ Alert yuborishning yiqilishi ilovani YIQITMAYDI.
      // Bu — eng oson qilinadigan xato: monitoring kodi production'ni buzadi.
      this.logger.warn({ err }, 'TELEGRAM_ALERT_FAILED');
    }
  }
}
```

Ishlatilishi (10.2 dagi 1-alert):

```typescript
await this.alerter.send(
  `tenant-isolation:${model}`,
  'CRITICAL',
  `Tenant izolyatsiyasi buzildi\\.\nModel: ${model}\nKutilgan tenant: ${expected}\nOqqan yozuv: ${leaked.length}`,
);
```

⚠️ **Chat privat bo'lsin.** Alert matnida `tenant_id`, route va xato kodi
bo'ladi. Bu — ichki ma'lumot. Va: **alert matniga o'quvchi ismi hech qachon
qo'yilmaydi** (4.1-bo'lim Telegram'ga ham amal qiladi).

### 10.5. Alert fatigue — eng xavfli nosozlik

Odam 20-chi yolg'on alert'dan keyin 21-chisiga qaramaydi. Va aynan u haqiqiy
bo'ladi.

**Qoidalar:**

1. Har alert **harakat** talab qilishi shart
2. Cooldown majburiy (10.4-bo'limdagi kod)
3. Har oy: qaysi alert chiqdi, nechtasi haqiqiy edi? Hech qachon harakat
   talab qilmagan alert — **o'chiriladi**
4. Alert soni **6 tadan oshmasin** (10.2). Yettinchisini qo'shish uchun
   bittasini o'chirish kerak

---

## 11. Dashboard

### 11.1. Grafana Cloud free tier — tasdiqlangan

| Resurs | Free tier | Pro |
|---|---|---|
| Active metric series | **10 000** | $6.50/1K seriya |
| Loglar (Loki) | **50 GB/oy** | — |
| Trace (Tempo) | **50 GB/oy** | — |
| **Saqlash (barchasi)** | **14 kun** | Metrika 13 oy, log 30 kun |
| Grafana foydalanuvchi | **3** | — |
| **Narx** | **$0** | **$19/oy** + iste'mol |

Manba: [grafana.com/pricing](https://grafana.com/pricing/) (2026-07-15).

**Yetadimi?** 5.3-bo'limdagi hisob: `tenant_id` label'siz ~6 600 seriya + default
metrikalar (~100) ≈ **6 700**. Chegara — 10 000. **Yetadi, lekin zaxira kam.**

⚠️ Bu — `tenant_id` ni HTTP metrikasidan olib tashlash qaroriga (5.3) yana bir
sabab. Uni qo'shsak, 10 tenant bilan 66 000 seriya — free tier'dan **6.6 marta**
oshadi.

⚠️ **14 kunlik saqlash** — muhim cheklov. "O'tgan oy sekinlashuv bo'lganmidi?"
savoliga javob bo'lmaydi. Bu qabul qilinadi: hozirgi holat (0 kun) bilan
taqqoslaganda 14 kun — cheksiz yaxshilanish.

### 11.2. Alternativa: Better Stack

| Resurs | Free tier |
|---|---|
| Uptime monitor | **10 ta** (3 daqiqalik interval) |
| Loglar | **3 GB, 3 kun** |
| Status page | **1 ta** |
| Narx | **$0** |

Manba: [betterstack.com/pricing](https://betterstack.com/pricing) (2026-07-15).

**Qaror:** Better Stack **uptime uchun** ishlatiladi (`/api/health` monitoringi
+ status page), Grafana **metrika va log uchun**. Ikkalasi ham bepul, ikkalasi
ham o'z ishida yaxshi. Better Stack'ning 3 GB / 3 kunlik log'i asosiy log
saqlash uchun kam.

⚠️ Status page — ota-onalar uchun qimmatli. "Sayt ishlamayapti" qo'ng'irog'i
o'rniga sahifa. Bepul.

### 11.3. Dashboard tarkibi

**Bitta dashboard.** Ikkitasi ham ko'p — chunki ularni bir kishi ko'radi.

| Panel | Savol |
|---|---|
| So'rov/daqiqa | Kimdir ishlatyaptimi? |
| **5xx ulushi** | Nimadir buzilyaptimi? |
| p50 / p95 latency | Sekinmi? |
| **Eng sekin 10 route** | Nimani tuzatish kerak? |
| **Tenant bo'yicha so'rov** (log'dan) | Qaysi akademiya faol? |
| **Tenant bo'yicha xato** (log'dan) | Qaysi akademiya muammoda? |
| Sekin so'rov soni | 9-bo'lim trendi |
| Guardian login: muvaffaqiyat/xato | 1.6-bo'limdagi bag qaytmasin |
| Kunlik faol foydalanuvchi | Mahsulot ishlayaptimi? |
| Baho kiritish soni | Domen tirikmi? |

**Qoidalar:**
- **Har panelda savol bo'lsin.** Sarlavha "CPU" emas, "CPU limitga yaqinmi?"
- **Bo'sh panel o'chiriladi.** "Balki kerak bo'lar" paneli — shovqin
- **Dashboard JSON git'da.** Qo'lda yasalgani birinchi qayta sozlashda yo'qoladi

---

## 12. Bosqichma-bosqich reja

### 12.1. Falsafa

Observability bir kunda qurilmaydi. Lekin **90% qiymat 10% ishdan** keladi.

### 12.2. Bosqich 0 — HOZIR ($0/oy)

| # | Ish | Nega birinchi | Kun |
|---|---|---|---|
| 1 | `AllExceptionsFilter` ga logging (3.6) | **1.3-bo'lim: hozir xato butunlay yo'qoladi.** Eng katta bo'shliq | 0.5 |
| 2 | `pino` + `nestjs-pino` + redaction (3.3) | Poydevor. Qolgan hamma narsa shunga tayanadi | 1 |
| 3 | `tenant_id` har logga (3.4) | Ko'p ijarachilik tizimda bu shartsiz | (2 ichida) |
| 4 | Sentry free (6.4) | Stack trace. $0, 5 000 xato/oy | 0.5 |
| 5 | `/health` + `/ready` (7.2) | Render buni talab qiladi | 0.5 |
| 6 | Better Stack uptime + status page (11.2) | $0, 5 daqiqa. Ota-ona uchun sahifa | 0.2 |
| 7 | Telegram alert (10.4) | $0. Alert kanali bo'lmasa monitoring ma'nosiz | 0.5 |
| 8 | `console.*` → logger, 18 nuqta (3.7) | 1-2 dan keyin mexanik ish | 0.5 |
| 9 | `no-console: 'warn'` → keyin `'error'` (4.4) | Qaytishning oldini oladi | 0.1 |

**Jami: ~4 kun. Narx: $0/oy.**

⚠️ **Bu 90% qiymatni beradi.** Sabab: hozirgi holatdan (hech narsa yo'q)
"xato ko'rinadi va Telegram'ga keladi" holatiga o'tish — bu eng katta sakrash.
Qolgan hamma narsa — nozik sozlash.

### 12.3. Bosqich 1 — Prisma extension bilan BIRGA ($0/oy)

Bu bosqich **kanon 5.1 dagi extensionga bog'liq** va undan oldin bo'lmaydi.

| # | Ish | Bog'liqlik |
|---|---|---|
| 1 | `tenant_isolation_violations` metrikasi (5.2) | Extension |
| 2 | Tenant izolyatsiya alerti (10.3) | 1-band |
| 3 | Sekin so'rov logging (9.3) | Mustaqil. ⚠️ Prisma 7.3 + adapter tekshirilsin |

**Narx: $0/oy.**

### 12.4. Bosqich 2 — o'sish boshlanganda ($0/oy)

Chegara: **5+ tenant** yoki **kuniga 10 000+ so'rov**.

| # | Ish |
|---|---|
| 1 | `prom-client` + `/metrics` (himoyalangan, 5.5) |
| 2 | Grafana Cloud free + dashboard (11) |
| 3 | Domen metrikalari: guardian login, baho, DAU |

**Narx: $0/oy** (Grafana free tier). ⚠️ Kardinallik kuzatilsin (5.3).

### 12.5. Bosqich 3 — kerak bo'lganda (narx o'zgaradi)

Bu bosqich **shartga bog'langan**, sanaga emas:

| Shart | Ish | Narx |
|---|---|---|
| 8.2 dagi chegara kesildi | OpenTelemetry + Tempo | $0 (Grafana free) |
| Sentry 5 000 kvota to'ldi | Sentry Team | **$26/oy** |
| Grafana 10k seriya to'ldi | Grafana Pro | **$19/oy** + iste'mol |
| Tenant soni 20+ | SLO va burn-rate alert | $0 |

### 12.6. Xarajat xulosasi — halol

| Bosqich | Observability narxi |
|---|---|
| 0 (hozir) | **$0/oy** |
| 1 | **$0/oy** |
| 2 | **$0/oy** |
| 3 | $19–45/oy (faqat chegara to'lganda) |

⚠️ **Buning tashqarisida:** Render **$7/oy** (7.3-bo'lim). Bu observability
xarajati emas, lekin usiz bepul rejada servis 15 daqiqada o'chadi va
monitoringning ma'nosi qolmaydi.

**Umumiy prinsip:** metrika kod bilan **birga** yoziladi, keyin emas. "Avval
ishlasin, keyin monitoring qo'shamiz" — bu "hech qachon" degani. Loyiha buni
allaqachon isbotladi: 62 783 qator kod, 51 commit, **0 qator observability**.

---

## 13. Ochiq savollar

1. **Prisma 7.3 + `PrismaPg` adapter'da `$on('query')` ishlaydimi?** (9.3)
   Driver adapter ishlatilganda query event'lari xatti-harakati Prisma
   versiyalari orasida o'zgargan. **Kod bilan tekshirilishi shart.** Ishlamasa —
   PostgreSQL `log_min_duration_statement` muqobili.

2. **Tenant izolyatsiya tekshiruvining narxi qancha?** (10.3) Har natijani
   skanerlash — bu overhead. Production'da 100% yoqiladimi, namuna (1%)
   bilanmi, yoki faqat staging'da? **O'lchov bilan aniqlanadi.**

3. **5 000 xato/oy (Sentry free) yetadimi?** (6.2) Hozirgi xato darajasi
   **noma'lum**, chunki xatolar loglanmaydi (1.3). Bu savolga javob
   Bosqich 0 dan **keyin** ma'lum bo'ladi. Tovuq va tuxum.

4. **Log qayerda saqlanadi — Bosqich 0 da?** Pino stdout'ga yozadi. Render
   log'ni ushlaydi, lekin faqat **oxirgi 7 kun** va qidiruv zaif. Grafana
   Loki Bosqich 2 da keladi. **Oradagi bo'shliq qabul qilinadimi?**

5. **`tenant_id` metrikada label bo'lsinmi?** (5.3) 10 tenant bilan yetadi,
   100 bilan yetmaydi. Hozir "yo'q" deb qaror qilindi (log'dan olinadi).
   **Tenant soni 20 ga yetganda qayta ko'rilsin.**

6. **⚠️ Yurist savoli: o'quvchi ma'lumoti Sentry serveriga (AQSh) borishi
   mumkinmi?** 6.4-bo'limdagi `beforeSend` PII ni tozalaydi, lekin: (a) stack
   trace ichida o'zgaruvchi qiymati bo'lishi mumkin, (b) O'zbekiston shaxsiy
   ma'lumotlar qonuni (2019, №547-son) ba'zi ma'lumotlar uchun **lokalizatsiya**
   talab qiladi. Bu **voyaga yetmagan bolalar ma'lumoti**. Kanon 10:
   **yurist savoli, bu hujjat javob bermaydi.**

7. **Better Stack heartbeat bilan Render free tier'ni uyg'oq tutish —
   siyosatga zid emasmi?** (7.3) Texnik jihatdan ishlaydi, lekin bu — platformani
   mo'ljallanganidan boshqacha ishlatish. **$7/oy to'lash halolroq.**

8. **`audit_logs` yozuvi biznes tranzaksiyasidan tashqarida** (`audit.util.ts:49`,
   2.3-bo'lim). Ya'ni baho o'zgarishi saqlanib, izi saqlanmasligi mumkin. Bu
   observability muammosi emas, lekin shu yerda ko'rindi. **Kimning ishi?**

9. **Kim alertga javob beradi?** Jamoa — bir kishi (kanon 0). Kechasi
   Telegram'ga alert kelsa va u uxlayotgan bo'lsa — nima bo'ladi? **Halol
   javob: hech narsa. Ertalab ko'radi.** Bu qabul qilinadimi? Agar yo'q bo'lsa —
   yechim avtomatik tiklanish, alert emas.
