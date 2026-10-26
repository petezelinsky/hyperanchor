# Hyperanchor

Минималистичный планировщик задач — [hyperanchor.app](https://hyperanchor.app).

Интерфейс — минимализм с одним цветом: нейтральные серые, чёрные основные кнопки и один акцент (синий по умолчанию; в настройках можно выбрать оранжевый или зелёный). Тема — светлая, тёмная или «Авто» (по системе): переключается в настройках приложения (меню аккаунта → Settings, клавиша `,`) и в подвале сайта; выбор запоминается на устройстве и применяется до первой отрисовки, без мигания. Акцент означает одно и то же везде: сегодня, выполнено и прогресс (отметка задачи, кольцо, графики, серия дней). Выбранный день, если это не сегодня, — чёрный, как в Календаре. Красный — только для удаления и спада, зелёный — для роста в аналитике. Поверхности сплошные: светлый холст и белый лист контента; полупрозрачное стекло — только у плавающих элементов (шапка при прокрутке, нижняя панель вкладок на телефоне). Живые микровзаимодействия: отметка задачи с анимацией, конфетти, когда день закрыт полностью, плавно скользящее выделение. Логотип — название с акцентной точкой, `hyperanchor.`. Системный шрифт SF Pro (Inter на остальных платформах).

- **Day** — список задач выбранного дня: сверху «To do», ниже сворачиваемая группа «Completed» (выполненная задача сначала отмечается с анимацией, затем плавно переезжает вниз; состояние группы запоминается). Правка названия и заметки прямо в строке, сортировка (порядок добавления, новые сверху, по имени), фильтр, меню строки (правый клик или ⋯): перенести на сегодня / завтра / следующую неделю, удалить с возможностью отменить. Компактная лента недели в шапке с точкой-статусом каждого дня (акцентная — всё сделано, серая — что-то осталось); для прошедшего дня — «Move to Today» для невыполненного
- **Focus** — режим «одно дело за раз» (`F` или кнопка Focus): крупно только следующая задача, «Done» и «Not now» (отложить в конец очереди), одной строкой — что дальше, полоска прогресса; мысль, пришедшую по ходу, можно записать «на потом», не выходя из режима (`N`). Сделано с оглядкой на людей с СДВГ: меньше выбора и шума, один очевидный следующий шаг
- На «Сегодня» собираются задачи, оставшиеся открытыми за прошлую неделю, — одной кнопкой «Move to Today» (с отменой); во вкладке браузера видно, сколько осталось на сегодня
- **Week** — те же задачи за неделю, по дням; выполненные опускаются под невыполненные
- **Month** — календарная сетка; клик по дню открывает поповер: отметить задачи, добавить новую на эту дату, открыть день
- **Analytics** — неделя / месяц / год: плитки «выполнено», «процент выполнения», «среднее в день» с изменением к прошлому периоду, мини-графиком и шкалой, плюс серия дней подряд; график по дням или месяцам (выполнено / не выполнено) со средней линией и подсказками, тепловая карта года, разбивка по дням недели, список невыполненного с переносом на сегодня, сортируемая история — табличное представление всех цифр
- Вход через Google или Apple (Auth.js; разные способы входа — разные аккаунты, по email не склеиваются); удаление аккаунта в настройках; минималистичный анимированный лендинг (двухтонный заголовок со сменяющимся словом — без цветного текста, список задач, который сам себя отмечает, анимированные иллюстрации возможностей, включая фокус-режим) и страницы `/privacy` и `/terms`

Клавиатура: `N` — новая задача, `↑ ↓` — выбор строки, `Space` — готово, `Enter` — правка, `⌫` — удалить, `Esc` — отмена, `← →` — предыдущий/следующий день, неделя, месяц или период, `T` — сегодня, `D` `W` `M` `A` — разделы, `F` — фокус, `,` — настройки, `?` — шпаргалка по сочетаниям клавиш. На телефоне подсказки про клавиши скрыты.

Стек: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Auth.js v5 (Google, Apple, JWT-сессии) · Postgres (`postgres.js`) · `jose` (проверка токенов входа iOS-приложения).

Нативное приложение для iPhone и iPad — в `ios/` (см. `ios/README.md`); оно работает с тем же API и теми же задачами.

## Локальный запуск

```bash
npm install
cp .env.example .env.local   # заполнить переменные
npm run db:migrate           # создать таблицу tasks
npm run dev                  # http://localhost:3000
```

Для локального входа добавьте в Google OAuth-клиент redirect URI `http://localhost:3000/api/auth/callback/google`.

## Переменные окружения

| Переменная | Что это |
|---|---|
| `AUTH_SECRET` | случайная строка: `openssl rand -base64 32`; ею же подписываются токены iOS-приложения (ключ выводится через HKDF) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth-клиент Google (тип «Web application») |
| `GOOGLE_IOS_CLIENT_ID` | OAuth-клиент Google типа «iOS» (Bundle ID `app.hyperanchor`): допустимый `aud` Google-токенов из приложения |
| `APPLE_BUNDLE_ID` | Bundle ID приложения, `aud` Apple-токенов из приложения (по умолчанию `app.hyperanchor`) |
| `AUTH_APPLE_ID` | *необязательно:* Services ID для Sign in with Apple на сайте; без него на сайте только Google |
| `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | *необязательно:* ключ Sign in with Apple (`.p8`, можно одной строкой с `\n`): из него сервер сам подписывает client secret для сайта и для отзыва токенов при удалении аккаунта |
| `AUTH_APPLE_SECRET` | *необязательно, вместо ключа:* готовый client secret для сайта (`npx auth add apple`, действует до 6 месяцев) |
| `DATABASE_URL` | Supabase → Connect → Transaction pooler (порт `6543`), с паролем БД и `?sslmode=require` в конце |

## Деплой на hyperanchor.app (Vercel)

1. **База данных (Supabase).** Выполните `db/schema.sql` в Supabase → SQL Editor
   (или `DATABASE_URL=... npm run db:migrate`). Миграция идемпотентна и включает RLS на `tasks`:
   публичный Data API Supabase (`anon`/`authenticated`) таблицу не видит, а приложение подключается
   владельцем таблицы (`postgres`) и RLS не затрагивается. Доступ к чужим задачам закрыт в API по `user_id`.
   Код рассчитан на transaction pooler (порт 6543): `prepare: false`, одно соединение на serverless-инстанс.
2. **Google Cloud Console** → APIs & Services:
   - *OAuth consent screen*: имя приложения Hyperanchor, домен `hyperanchor.app`,
     Home page `https://hyperanchor.app`, Privacy policy `https://hyperanchor.app/privacy`,
     Terms `https://hyperanchor.app/terms`, scopes: `openid`, `email`, `profile`.
   - *Credentials* → OAuth client ID (Web application):
     Authorized JavaScript origin `https://hyperanchor.app`,
     Authorized redirect URI `https://hyperanchor.app/api/auth/callback/google`.
   - Для iOS-приложения — ещё один OAuth client ID типа **iOS** с Bundle ID `app.hyperanchor`: его ID — в `GOOGLE_IOS_CLIENT_ID`
     на сервере и в `ios/Config/Local.xcconfig` в приложении (см. `ios/Config/App.xcconfig`).
3. **Apple Developer** → Certificates, Identifiers & Profiles:
   - App ID `app.hyperanchor` с возможностью *Sign in with Apple* (основной, Primary App ID).
   - Для сайта: Services ID (например, `app.hyperanchor.web`) с *Sign in with Apple*, сгруппированный с этим App ID;
     домен `hyperanchor.app`, Return URL `https://hyperanchor.app/api/auth/callback/apple`. Его ID — в `AUTH_APPLE_ID`.
     Благодаря группировке Apple выдаёт сайту и приложению один и тот же `sub`, и задачи у них общие.
   - Keys → новый ключ с *Sign in with Apple* для этого App ID: `APPLE_KEY_ID`, содержимое `.p8` — в `APPLE_PRIVATE_KEY`,
     Team ID — в `APPLE_TEAM_ID`.
4. **Vercel**: импортируйте репозиторий, добавьте переменные окружения из таблицы выше, задеплойте.
5. **Домен**: Vercel → Project → Settings → Domains → `hyperanchor.app`, затем пропишите у регистратора
   DNS-записи, которые покажет Vercel (A-запись на apex-домен и/или CNAME для `www`).

Подойдёт и любой другой Node-хостинг: `npm run build && npm start` (Node ≥ 20.9).

## API

Все запросы к задачам требуют входа: cookie-сессии сайта или заголовка `Authorization: Bearer <token>` (iOS-приложение). Задачи доступны только их владельцу; идентификатор пользователя — `google:<sub>` или `apple:<sub>`, одинаковый на сайте и в приложении.

| Метод | Путь | Тело / параметры |
|---|---|---|
| `GET` | `/api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` | диапазон до 800 дней (год аналитики + предыдущий для сравнения) |
| `POST` | `/api/tasks` | `{ id (uuid), title, description?, date, done? }` |
| `PATCH` | `/api/tasks/:id` | любые из `title`, `description`, `date`, `done` |
| `DELETE` | `/api/tasks/:id` | — |
| `POST` | `/api/auth/mobile` | `{ provider: "google" \| "apple", idToken, nonce?, name? }` → `{ token, user: { name, email, image } }`: проверяет ID-токен провайдера по его JWKS (Google: `aud` — iOS- или веб-клиент; Apple: `aud` — Bundle ID; `nonce` — сырой, у Apple сверяется его SHA-256) и выдаёт собственный JWT сервера на 90 дней |
| `DELETE` | `/api/account` | `{ authorizationCode? }` → `{ deleted, revoked }`: удаляет все задачи пользователя; для Apple ещё и отзывает токен (приложение присылает свежий `authorizationCode`, сайт хранит refresh-токен Apple в зашифрованной сессии) |

Даты хранятся как локальные `YYYY-MM-DD` пользователя, неделя начинается с понедельника. Клиент обновляет данные оптимистично, ввод сохраняется с задержкой 600 мс, запросы по одной задаче идут строго по порядку; при ошибке видимый диапазон перезагружается с сервера.

## Структура

```
design/tokens.json       дизайн-токены (цвета светлой/тёмной темы, три акцента, радиусы, тени) — общие для веба и iOS;
                         `npm run tokens` пишет из них блок переменных в src/app/globals.css и ios/…/Design/Tokens.swift
db/schema.sql            схема Postgres
scripts/migrate.mjs      применяет схему
src/auth.ts              Auth.js (Google, Apple)
src/app/api/tasks        REST API задач
src/app/api/auth/mobile  вход iOS-приложения (ID-токен Google/Apple → bearer-токен)
src/app/api/account      удаление аккаунта
src/lib/identity.ts      проверка токенов Google/Apple, client secret и отзыв токенов Apple
src/lib/mobileToken.ts   bearer-токены iOS-приложения
src/app/page.tsx         экран входа или приложение
src/components/          UI: TaskApp (состояние, клавиатура), Sidebar, DayView, FocusPanel, WeekView, MonthView, SettingsSheet, ui.tsx (примитивы)
src/components/prefs.ts  тема и акцент: сохранение и скрипт, применяющий их до первой отрисовки
src/components/table     список задач: To do / Completed, строки, правка, сортировка, меню
src/components/analytics аналитика: KPI, графики, тепловая карта, история
src/lib/stats.ts         расчёты аналитики
src/app/privacy, terms   юридические страницы
```
