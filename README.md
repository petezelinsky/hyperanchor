# Hyperanchor

Минималистичный планировщик задач — [hyperanchor.app](https://hyperanchor.app).

- Вход через Google (Auth.js), меню аккаунта, выход
- **Day** — компактная лента недели и задачи выбранного дня крупными карточками; прошедшие дни оформлены спокойно: выполненное выделено, невыполненное приглушено
- **Calendar** — сетка месяца; клик по дню с задачами открывает поповер со списком и кнопкой «Open day»
- **Analytics** — выполненные задачи по дням за неделю или месяц (столбчатый график с поповером при наведении) и история по дням
- Создание и редактирование задач прямо в карточках, без модальных окон: изменения сохраняются по мере ввода
- Отметка «готово», удаление
- Страницы `/privacy` и `/terms`

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
| `GET` | `/api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` | диапазон до 62 дней |
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
src/components/          UI: Header, DayView (inline-карточки), CalendarView, AnalyticsView, …
src/app/privacy, terms   юридические страницы
```
