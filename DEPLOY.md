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
npx supabase@latest functions deploy agent-run agent-resume agent-fork projects-create projects-list projects-update projects-delete usage-check checkpoint-create checkpoint-restore revenuecat-webhook revenuecat-sync project-files
```

```bash
npx supabase@latest functions deploy queue-worker --no-verify-jwt
```

(`--no-verify-jwt` عمداً است: pg_cron کاربر Auth نیست و ورکر خودش bearer خودش را چک می‌کند.)

## ۴. Vault برای cron ورکر (SQL Editor داشبورد)

```sql
select vault.create_secret('https://qnrsiukutehcqjhmpuze.supabase.co/functions/v1/queue-worker', 'queue_worker_url');
select vault.create_secret('<همان QUEUE_WORKER_SECRET>', 'queue_worker_secret');
```

بررسی فعال بودن زمان‌بندی‌ها:

```sql
select jobname, schedule, active from cron.job;
```

باید سه جاب ببینی: ورکر هر ۱۰ ثانیه، ریست روزانهٔ متر free، و پاک‌سازی sandbox_usage هر ۵ دقیقه.

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
