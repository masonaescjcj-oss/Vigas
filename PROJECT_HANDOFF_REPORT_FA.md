# گزارش جامع و به‌روزرسانی نهایی پروژه Retro Code Pro (Issac / Builder)

**تاریخ به‌روزرسانی گزارش:** ۲۵ ژوئیهٔ ۲۰۲۶  
**مسیر اصلی پروژه (Workspace):** `C:\Users\asiac\OneDrive\Desktop\Builder`  
**پروژه سوپابیس (Supabase Ref):** `qnrsiukutehcqjhmpuze`  
**آدرس مرورگر محلی:** `http://localhost:8081`  
**لینک عمومی تانل (TryCloudflare Live URL):** `https://switching-invisible-folk-texts.trycloudflare.com`

---

## ۱. هدف و چشم‌انداز پروژه (Project Vision)

**Retro Code Pro** یک فریم‌ورک و ایجنت کدنویسی خودمختار چندمرحله‌ای (Autonomous AI Agent Coding Platform) است که برای ساخت برنامه‌های وب و موبایل بر پایه React Native (Expo)، React، و Deno طراحی شده است. 

ویژگی‌های متمایز پروژه:
- **تشخیص اتوماتیک تم سیستم‌عامل (System Color Scheme Auto-Detection)**: پشتیبانی هوشمند از حالت روشن (Pure Crisp White #FFFFFF) و حالت تاریک (Obsidian Black #000000).
- **موتور استدلال ReAct و Plan Mode**: امکان برنامه‌ریزی گام‌به‌گام (`implementation_plan.md`) قبل از دست زدن به کدها و چرخه تصحیح خودکار خطاها (`Plan Verifier / Goal Loop`).
- **اجرای موازی ساب‌ایجنت‌ها (Bounded Parallel Subagents)**: تقسیم کارهای سنگین بین ۳ ساب‌ایجنت موازی در محیط‌های ایزوله.
- **تایم‌لاین چک‌پوینت‌ها (VCS Snapshots & Rollback)**: ذخیره خودکار Snapshots جهت بازگردانی ۱-کلیکه فایل‌ها بدون دستکاری مخزن اصلی Git.
- **اکوسیستم Skills.sh**: پشتیبانی از بیش از ۱,۰۰۰ اسکیل متن‌باز (قوانین UI، تست‌سازهای Jest و Playwright).

---

## ۲. وضعیت کلی فرانت‌اند و بک‌اند (Overall System Architecture)

### 📱 بخش فرانت‌اند (Frontend Stack):
- **فریم‌ورک اصلی:** React Native / Expo Web (مستقر روی پورت `8081`).
- **مدیریت تم و استیت:** Zustand Store (`useThemeStore.ts`) + `ThemeProvider.tsx` متصل به `Appearance.getColorScheme()` سیستم‌عامل.
- **تعداد صفحات تکمیلی:** ۳۰ صفحه مستقل + ۱۱ شیت کشویی (Modal Sheets) در ۱۱ ماژول اصلی شامل (Auth, Chat, Projects, Files, Checkpoints, Settings, Subscription, Legal, Search, Notifications, Home).
- **چیدمان و زبان:** ۱۰۰٪ زبان انگلیسی با چیدمان استاندار LTR.

### ⚙️ بخش بک‌اند (Backend Stack):
- **موتور ایجنت (Agent Core):** مستقر در `src/core/agent/` شامل ۴۹ تست واحد با Vitest.
- **سرور گیت‌وی محلی (Local API Gateway):** اجرا روی Deno (`local-api-server.ts` در پورت `54321`).
- **ورکر پس‌زمینه (Queue Worker):** `run-local-worker.ts` جهت پردازش کارهای سنگین ایجنت.
- **تانل زنده:** اتصال فعال `npx cloudflared` روی `http://localhost:8081`.

---

## ۳. نقشه کامل صفحات و شیت‌های فرانت‌اند (Frontend Inventory)

### 🔑 جریان احراز هویت (Auth Flow):
1. `SplashScreen.tsx`: لودینگ اولیه با اسپینر روان.
2. `OnboardingScreen.tsx`: اسلایدر معرفی ۳‌مرحله‌ای (سازگار با Light/Dark).
3. `WelcomeScreen.tsx`: لندینگ اصلی شامل اکوسیستم Skills.sh، دکمه‌های ورود، ثبت‌نام و **Instant Guest Mode** (سازگار با Light/Dark).
4. `LoginScreen.tsx` & `SignUpScreen.tsx`: ورود و ثبت‌نام با سیستم ارزیابی لایو قدرت رمزعبور (سازگار با Light/Dark).
5. `ForgotPasswordScreen.tsx` / `ResetPasswordScreen.tsx` / `EmailVerificationPendingScreen.tsx`: بازیابی رمز و تایید ایمیل.

### 💬 چت و ایجنت کدنویسی (`AgentChatScreen.tsx` & Modals):
- **Top Header Bar**: دکمه پروفایل، سوییچر Chat/Build با حاشیه `#E2E8F0` و اولویت کلیک `zIndex: 50`.
- **Watermark Center**: لوگو و تایتل `retro code pro` دقیقا در مرکز عمودی.
- **Bottom Input Composer**: باک تعاملی پائین شامل پاپ‌آپ‌های `@` و `/` و دکمه‌های سفید خالص `#FFFFFF`.
- **شیت نیم‌صفحه انتخاب مدل‌ها (Models Selector Modal)**: ارتفاع فشرده ۵۲٪ با مدل‌های Gemini 3.1 Pro، Sonnet 3.5، Opus 5، GPT-5.6، Grok 4.5 و سوئیچ Thinking Mode.
- **نمایشگر لایو کدهای تغییریافته (Code Diff Viewer Modal)**: نمایش تغییرات سبز `+` و قرمز `-` با امکان Reject/Accept.
- **سایر شیت‌ها:** Add to Chat Sheet، Drawer History Sheet، Master Profile Settings Sheet، Connectors & Skills Sheet، Projects Selector Sheet، File Tree Sheet.

---

## ۴. نقشه بک‌اند و هسته ایجنت (`src/core/agent`)

```
src/core/agent/
├── index.ts               createAgentRuntime (نقطه ورود اصلی)
├── loop.ts                حلقه استدلال ReAct و امنیت ابزارها
├── toolRegistry.ts        ثبت ابزارهای خواندن/نوشتن/دستورات/ripgrep
├── systemPrompt.ts        پرامپت‌های شفاف سیستم
├── checkpoint.ts          ذخیره‌سازی و بازگردانی Snapshots
├── workspace/             مدیریت فایل‌ها محصور به PathGuard
├── sandbox/               پروفایل‌های امنیتی ایزوله
├── permissions/           موتور بررسی قوانین دسترسی
├── session/               ذخیره‌سازی و چشرده‌سازی سشن‌ها
├── plan/                  Plan Mode (تولید پلن، اجرا و تایید با Goal Loop)
└── subagent/              اجرای همزمان ساب‌ایجنت‌ها با الگوریتم ادغام ایمن
```

---

## ۵. دستورالعمل اجرا و راه‌اندازی (Execution Guide)

### ۱. اجرای سرور فرانت‌اند (Expo Web):
```bash
cd frontend
npx expo start --web --clear
```

### ۲. اجرای سرور بک‌اند و ورکر Deno:
```bash
npx deno run --allow-all local-api-server.ts
npx deno run --allow-all run-local-worker.ts
```

### ۳. اجرای تانل کلودفلر (TryCloudflare):
```bash
npx cloudflared tunnel --url http://localhost:8081
```

---

## ۶. اقدامات پیشنهادی برای فاز بعدی (Next Phase Roadmap)

1. **اتصال استریم زنده Server-Sent Events (SSE):** اتصال مستقیم پیام‌های ایجنت از بک‌اند Deno به UI فرانت‌اند تا کلمه‌ها زنده رندر شوند.
2. **اتصال iframe پیش‌نمایش کامپوننت‌ها (Live Canvas):** لود مستقیم خروجی وب در `showPreviewModal`.
3. **تکمیل مایگریشن‌های دیتابیس Supabase:** اجرای کامل جداول `projects` و `agent_sessions` روی دیتابیس ابری.

---
*گزارش فوق ۱۰۰٪ مطابقت با آخرین تغییرات سورس‌کد پروژه دارد.*
