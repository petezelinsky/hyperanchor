# Hyperanchor в App Store

Всё, что нужно для первой версии: тексты карточки (их вставляют в App Store Connect как есть), ответы на анкеты,
скриншоты и порядок шагов. Скриншоты в `Screenshots/` сняты тестом `ScreenshotTour` на симуляторах нужных размеров
(iPhone 6.9″ — 1320×2868, iPad 13″ — 2064×2752, время 9:41); переснять — см. `ios/README.md`.

## Карточка (App Store Connect → App Information / Version)

| Поле | Значение |
|---|---|
| Name (≤30) | Hyperanchor — Daily Planner |
| Subtitle (≤30) | Own your day, week and month |
| Bundle ID | app.hyperanchor |
| SKU | hyperanchor-ios |
| Primary category | Productivity |
| Secondary category | Lifestyle |
| Price | Free |
| Support URL | https://hyperanchor.app/support |
| Marketing URL | https://hyperanchor.app |
| Privacy Policy URL | https://hyperanchor.app/privacy |
| Copyright | 2026 Hyperanchor |
| Age rating | 4+ (во всех вопросах анкеты — None / No) |

**Promotional text (≤170):**
Plan the day, focus on one thing at a time, and see your week and month at a glance. Free, no ads, and the same tasks on iPhone, iPad and the web.

**Keywords (≤100):**
planner,to do,todo,tasks,daily,weekly,focus,checklist,productivity,habit,calendar,list,organizer

**Description:**

Hyperanchor is a calm, fast planner for your day, week and month.

TODAY
Write down what matters, check it off, move the rest to tomorrow with a swipe. Tasks left open on earlier days wait for you in one tap.

FOCUS
One task at a time. Done lifts it away and the next one rises; Not now sends it to the back. Jot down a stray thought without leaving.

WEEK AND MONTH
See the whole week day by day, and the month as a calendar with what's planned and what's done.

ANALYTICS
Completion rate, daily average, your streak, the best day of the week and a year of activity — so you can see your progress, not just your list.

EVERYWHERE YOU ARE
The same tasks on iPhone, iPad and hyperanchor.app. Changes you make offline are kept and sent when you're back online. A Today widget shows what's left at a glance.

MADE TO FEEL RIGHT
Light and dark, three accent colors, Dynamic Type and VoiceOver, keyboard shortcuts on iPad, and a count of today's open tasks on the app icon if you want it.

Free. No ads. No tracking. Sign in with Apple or Google.

## App Privacy (анкета «Data Collection»)

Do you or your third-party partners collect data from this app? — **Yes**. Ни одна категория не используется для трекинга.

| Категория | Тип | Связано с пользователем | Цель |
|---|---|---|---|
| Contact Info | Name | Yes | App Functionality |
| Contact Info | Email Address | Yes | App Functionality |
| Identifiers | User ID | Yes | App Functionality |
| User Content | Other User Content (задачи) | Yes | App Functionality |

Всё остальное — Not collected. Это совпадает с `PrivacyInfo.xcprivacy` в приложении и с Privacy Policy на сайте.

## Export Compliance

`ITSAppUsesNonExemptEncryption = NO` уже в Info.plist — вопросов про шифрование при загрузке не будет.

## App Review Information

- Sign-in required: **Yes**. Demo account не нужен — Notes for review:
  > Sign in with Apple works with any Apple ID; there is no separate account to create. Google sign-in is also offered.
  > Account deletion: Settings → Delete Account (also revokes Sign in with Apple).
- Contact: имя, телефон и email человека, с которым Apple свяжется при вопросах.

## Порядок шагов

1. **Сервер** (сделано): вход для приложения работает на hyperanchor.app (`/api/auth/mobile`).
2. **Ключ Sign in with Apple** (нужен для отзыва доступа при удалении аккаунта — требование 5.1.1(v)):
   developer.apple.com → Certificates, Identifiers & Profiles → Keys → «+» → Sign in with Apple → Configure →
   Primary App ID `app.hyperanchor` → Continue → Register → скачать `.p8` (скачивается один раз).
   В Vercel → Settings → Environment Variables (Production) добавить: `APPLE_TEAM_ID = 68NMPH3BZ4`,
   `APPLE_KEY_ID` = Key ID ключа, `APPLE_PRIVATE_KEY` = содержимое `.p8`. Затем Redeploy.
3. **Вход через Google** (iOS-клиент): Google Cloud Console → проект с веб-клиентом сайта (номер 531124428771) →
   APIs & Services → Credentials → Create Credentials → OAuth client ID → iOS, Bundle ID `app.hyperanchor`,
   Team ID `68NMPH3BZ4`. Его Client ID — в `GOOGLE_IOS_CLIENT_ID` в `ios/Config/App.xcconfig` и в Vercel (Production),
   затем Redeploy. Экран OAuth consent должен быть «In production».
4. **Почта поддержки**: убедиться, что `support@hyperanchor.app` и `privacy@hyperanchor.app` принимают письма.
5. **App Store Connect** → Apps → «+» → New App: iOS, имя и SKU из таблицы, Bundle ID `app.hyperanchor`.
6. **Сборка**: в Xcode схема Hyperanchor, устройство «Any iOS Device (arm64)» → Product → Archive →
   Distribute App → App Store Connect → Upload. Номер сборки (`CURRENT_PROJECT_VERSION`) для каждой следующей
   загрузки увеличивать на 1.
7. **TestFlight**: сборка появится через 10–30 минут; поставить себе через приложение TestFlight и пройти вход,
   добавление задачи, удаление аккаунта.
8. **Карточка**: тексты и скриншоты из этого файла (6.9″ iPhone и 13″ iPad), App Privacy, возраст, цена.
9. **Submit for Review**. Проверка обычно занимает 1–2 дня.
