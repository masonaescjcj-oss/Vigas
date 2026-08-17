# 🚀 DEPLOY.md — استقرار بک‌اند روی Supabase ابری

**وضعیت کشف‌شده (۱۴ اوت ۲۰۲۶):**
- ✅ همهٔ مایگریشن‌ها (۱۱ جدول + RPCها) روی پروژهٔ ابری اعمال شده‌اند — نیازی به `db push` نیست.
- ⚠️ هر ۱۳ فانکشن deploy شده‌اند ولی **نسخهٔ قدیمی جولای‌اند** (بدون فیکس readonly، compaction، قالب‌ها، kill سندباکس و cacheControl) → همه باید redeploy شوند.
- ❌ فانکشن جدید `project-files` (پیش‌نمایش) هنوز deploy نشده.

این مراحل به **access token شخصی** نیاز دارند و فقط از دست صاحب حساب برمی‌آیند:

## ۱. ورود و لینک

```bash
npx supabase@latest login
```

```bash
npx supabase@latest link --project-ref qnrsiukutehcqjhmpuze
```

## ۲. ست کردن Secrets

⚠️ اول یک سکرت جدید برای ورکر بساز (قبلی در مستندات لو رفته بود):

```bash
openssl rand -hex 32
```

سپس (کلید apimaster خودت را جایگزین کن):

```bash
npx supabase@latest secrets set OPENAI_API_KEY=sk-... OPENAI_BASE_URL=https://api.apimaster.ai/v1 OPENAI_MODEL=gpt-5.6-luna QUEUE_WORKER_SECRET=<خروجی-openssl>
```

اختیاری (وقتی حساب‌هایش را ساختی): `E2B_API_KEY`، `SENTRY_DSN`، `REVENUECAT_API_KEY`، `REVENUECAT_WEBHOOK_AUTH`.

> ☠️ **هرگز `LOCAL_DEV_BYPASS` را روی ابر ست نکن** — بایپس کامل احراز هویت است و فقط مال `.env` محلی است.

## ۳. Deploy فانکشن‌ها

```bash
npx supabase@latest functions deploy agent-run agent-resume agent-fork agent-ask provider-keys admin share projects-create projects-list projects-update projects-delete usage-check checkpoint-create checkpoint-restore revenuecat-webhook revenuecat-sync project-files user-delete
```

```bash
npx supabase@latest functions deploy queue-worker --no-verify-jwt
```

(`--no-verify-jwt` عمداً است: pg_cron کاربر Auth نیست و ورکر خودش bearer خودش را چک می‌کند.)

## ۳.۵ سکرت رمزنگاری کلیدهای کاربران

قابلیت «ارائه‌دهندهٔ خودت» کلید API کاربران را رمزنگاری‌شده ذخیره می‌کند. کلید
رمزنگاری باید در سکرت‌های edge باشد، **نه** در دیتابیس — تا یک دامپ دیتابیس
به‌تنهایی چیزی جز ciphertext نباشد:

```bash
npx supabase@latest secrets set PROVIDER_KEY_SECRET="$(openssl rand -base64 48)"
```

⚠️ اگر این را عوض کنی، کلیدهای ذخیره‌شدهٔ قبلی دیگر باز نمی‌شوند و کاربران باید
دوباره اضافه‌شان کنند. جای امنی نگهش دار.

## ۳.۶ خودت را ادمین کن

پنل ادمین با یک پرچم در دیتابیس باز می‌شود، نه با هیچ endpointی — عمداً هیچ
راهی برای *دادن* این دسترسی از داخل اپ وجود ندارد:

```sql
update public.profiles set is_admin = true where email = 'YOUR@EMAIL';
```

## ۴. Vault برای cron ورکر (SQL Editor داشبورد)

> ☠️ **تلهٔ شمارهٔ یک (این‌جا واقعاً گیر کردیم):** فانکشن ورکر **اول** `QUEUE_WORKER_SECRET_V2` را می‌خواند و فقط اگر نبود `QUEUE_WORKER_SECRET`. اگر یک `_V2` قدیمی از جولای در Secrets ابری مانده باشد، مقدار جدیدی که در `QUEUE_WORKER_SECRET` گذاشتی **نادیده گرفته می‌شود** و cron با ۴۰۱ رد می‌شود (jobها ابدی pending می‌مانند).
>
> **این سه مقدار باید عیناً یکی باشند:** (۱) سکرت ابری فانکشن، (۲) سکرت Vault به نام `queue_worker_secret`، (۳) `.env` محلی. ساده‌ترین راه: `QUEUE_WORKER_SECRET_V2` را در ابر هم روی همان مقدار ست کن.

```sql
select vault.create_secret('https://qnrsiukutehcqjhmpuze.supabase.co/functions/v1/queue-worker', 'queue_worker_url');
select vault.create_secret('<همان QUEUE_WORKER_SECRET>', 'queue_worker_secret');
```

اگر قبلاً ساخته شده و باید مقدارش را عوض کنی (`create_secret` روی نام تکراری خطا می‌دهد):

```sql
select vault.update_secret((select id from vault.secrets where name = 'queue_worker_secret'), '<مقدار-جدید>');
```

## ۴.۵. تست سلامت خودکار (بعد از هر deploy اجرا کن)

```bash
npx deno run --allow-all --env-file=.env scripts/cloud-check.ts
```

هر چهار بخش را چک می‌کند: deploy بودن ۱۴ فانکشن، کار کردن cron→pg_net→worker، پذیرش سکرت توسط ورکر، و نبودِ job گیرکرده.

بررسی فعال بودن زمان‌بندی‌ها:

```sql
select jobname, schedule, active from cron.job;
```

باید سه جاب ببینی: ورکر هر ۱۰ ثانیه، ریست روزانهٔ متر free، و پاک‌سازی sandbox_usage هر ۵ دقیقه.

## ۴.۷. فعال‌سازی ورود ناشناس (لازم برای حالت مهمان)

داشبورد → **Authentication → Providers → Anonymous sign-ins** را روشن کن. بدون آن دکمهٔ «Continue as Guest» خطای صادقانه می‌دهد (قبلاً یک سشن جعلی می‌ساخت که هیچ درخواستی به بک‌اند با آن کار نمی‌کرد).

## ۴.۸. ساخت اپ موبایل (EAS)

`app.json` و `eas.json` و آیکون/اسپلش آماده‌اند (`assets/` — هنر جای‌گزین‌شدنی است). یک‌بار:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

کلید عمومی Supabase را به‌عنوان EAS secret بده (بدون آن، اپِ ساخته‌شده احراز هویت نمی‌کند):

```bash
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
```

خروجی نصبی اندروید برای تست:

```bash
npx eas-cli@latest build -p android --profile preview
```

نسخهٔ iOS روی ابر ساخته می‌شود (مک لازم نیست) و با `eas submit` به TestFlight می‌رود.

## ۵. سوییچ فرانت‌اند به production

در build نهایی، `EXPO_PUBLIC_API_URL` را حذف کن (پیش‌فرض کد، آدرس فانکشن‌های ابری است) — یا صریح بگذار:

```
EXPO_PUBLIC_API_URL=https://qnrsiukutehcqjhmpuze.supabase.co/functions/v1
```

## ۶. تست دود بعد از deploy

از ریشهٔ پروژه (با یک کاربر واقعی ثبت‌نام‌شده، نه guest):
1. اپ وب را بدون `EXPO_PUBLIC_API_URL` اجرا کن، لاگین واقعی، یک پروژه با قالب بساز → پیش‌نمایش باید باز شود.
2. یک پرامپت بفرست → باید ظرف ~۱۰ ثانیه (cron ابری) job اجرا شود.
3. `select status, attempts from job_queue order by created_at desc limit 3;` — باید completed ببینی.
