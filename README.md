# Hyperanchor

Минималистичный планировщик задач — [hyperanchor.app](https://hyperanchor.app).

Интерфейс — монохромный и типографичный («quiet ink»): Instrument Sans + Fragment Mono, один сигнальный оранжевый акцент для «сегодня», светлая и тёмная тема (по системной настройке), сдержанная анимация (прорисовка галочки, зачёркивание, плавные переходы; уважает `prefers-reduced-motion`).

- **Day** — приветствие и состояние дня одной фразой, линия прогресса, лента недели со скользящей плашкой, **быстрое добавление с распознаванием дат** («Call mom tomorrow», «Report fri», «Dentist oct 28», «Review in 3 days»), таблица задач: правка в ячейке, сортировка, фильтр, меню строки (перенести, дублировать, удалить с Undo); для прошедшего дня — перенос невыполненного на сегодня
- **Week** — таблица недели, сгруппированная по дням
- **Month** — календарная сетка; клик по дню открывает карточку: отметить задачи, добавить новую на эту дату, открыть день
- **Analytics** — неделя / месяц / год: итог одной фразой, ключевые показатели со сравнением с предыдущим периодом, график по дням или месяцам со средней линией, тепловая карта года, разбивка по дням недели, список невыполненного с переносом на сегодня, сортируемая история
- Индикатор сохранения («Saving…» / «All changes saved»), лист горячих клавиш (`?`)
- Лендинг с живой демонстрацией, вход через Google (Auth.js), страницы `/privacy` и `/terms`

Клавиатура: `N` — новая задача, `↑ ↓` — выбор строки, `Space` — готово, `Enter` — правка, `⌫` — удалить, `Esc` — отмена, `← →` — предыдущий/следующий день, неделя, месяц или период, `T` — сегодня, `D` `W` `M` `A` — разделы, `?` — все сочетания.

Стек: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Auth.js v5 (Google, JWT-сессии) · Postgres (`postgres.js`).

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
| `AUTH_SECRET` | случайная строка: `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth-клиент Google (тип «Web application») |
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
3. **Vercel**: импортируйте репозиторий, добавьте переменные окружения из таблицы выше, задеплойте.
4. **Домен**: Vercel → Project → Settings → Domains → `hyperanchor.app`, затем пропишите у регистратора
   DNS-записи, которые покажет Vercel (A-запись на apex-домен и/или CNAME для `www`).

Подойдёт и любой другой Node-хостинг: `npm run build && npm start` (Node ≥ 20.9).

## API

Все запросы требуют сессии; задачи доступны только их владельцу.

| Метод | Путь | Тело / параметры |
|---|---|---|
| `GET` | `/api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` | диапазон до 800 дней (год аналитики + предыдущий для сравнения) |
| `POST` | `/api/tasks` | `{ id (uuid), title, description?, date, done? }` |
| `PATCH` | `/api/tasks/:id` | любые из `title`, `description`, `date`, `done` |
| `DELETE` | `/api/tasks/:id` | — |

Даты хранятся как локальные `YYYY-MM-DD` пользователя, неделя начинается с понедельника. Клиент обновляет данные оптимистично, ввод сохраняется с задержкой 600 мс, запросы по одной задаче идут строго по порядку; при ошибке видимый диапазон перезагружается с сервера.

## Структура

```
db/schema.sql            схема Postgres
scripts/migrate.mjs      применяет схему
src/auth.ts              Auth.js (Google)
src/app/api/tasks        REST API задач
src/app/page.tsx         экран входа или приложение
src/components/          UI: TaskApp (состояние, клавиатура), Sidebar, DayView, WeekView, MonthView, QuickAdd, LiveDemo, ui.tsx (примитивы)
src/components/table     таблица задач: строки, правка в ячейках, меню
src/components/analytics аналитика: KPI, графики, тепловая карта, история
src/lib/stats.ts         расчёты аналитики
src/lib/parseDate.ts     распознавание дат в быстром добавлении
src/app/privacy, terms   юридические страницы
```
