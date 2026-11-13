# Hyperanchor for iPhone and iPad

Нативное приложение (SwiftUI, iOS 17+, Swift 6) с тем же функционалом и видом, что и [hyperanchor.app](https://hyperanchor.app):
Home (Day · Week · Month), Progress, Goals и Agent (пока «Soon»), режим Focus, поиск, голос, вход через Apple и Google,
общие с сайтом задачи. Сторонних зависимостей нет.

## Запуск

Xcode лежит в `~/Downloads/Xcode.app`, поэтому команды — с `DEVELOPER_DIR`:

```bash
export DEVELOPER_DIR=~/Downloads/Xcode.app/Contents/Developer
open ios/Hyperanchor.xcodeproj                      # или из командной строки:
xcodebuild -project ios/Hyperanchor.xcodeproj -scheme Hyperanchor -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild -project ios/Hyperanchor.xcodeproj -scheme Hyperanchor -destination 'platform=iOS Simulator,name=iPhone 17' test
```

Аргументы запуска (Scheme → Run → Arguments) для работы без сервера и аккаунта:

| Аргумент | Что делает |
|---|---|
| `-demo` | вход уже выполнен, пример задач на четыре недели, сервер в памяти |
| `-uitest` | то же, но настройки каждый раз сбрасываются (для UI-тестов) |
| `-signedOut` | вместе с `-demo`/`-uitest`: экран входа с кнопками-заглушками |
| `-offline` | демо-сервер «без сети»: изменения копятся в очереди |
| `-today 2026-10-22` | фиксирует «сегодня» (скриншоты, тесты) |
| `-appearance light\|dark`, `-accent graphite\|blue\|orange\|green`, `-tab day\|week\|month\|analytics\|goals\|agent` | внешний вид и страница при запуске |

Скриншоты всех экранов в светлой и тёмной теме (для проверки дизайна и для App Store) снимает `ScreenshotTour`;
по умолчанию он пропускается:

```bash
TEST_RUNNER_SCREENSHOTS=1 xcodebuild test -project ios/Hyperanchor.xcodeproj -scheme Hyperanchor \
  -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:HyperanchorUITests/ScreenshotTour -resultBundlePath Tour.xcresult
xcrun xcresulttool export attachments --path Tour.xcresult --output-path Screenshots
```

## Каркас: шапка, сайдбар, панель аккаунта

Как на сайте (`Sidebar.tsx`, `TaskApp.tsx`), от края до края, без таб-бара. Страницы (`PageContent` в `App/MainView.swift`)
рисуют только содержимое — без своих навигационных панелей и заголовков; Goals и Agent — страницы-анонсы «Soon»
(`Features/Soon/ComingSoon.swift`, как `ComingSoon.tsx` на сайте).

- **iPhone** — шапка в две строки. Первая: `hyperanchor` текстом, переключатель Day / Week / Month (на Progress — Week /
  Month / Year), аватар. Вторая: стрелки ‹ ›, название и дата («Today Fri, Nov 13»), иконка возврата к сегодня (только
  вдали от него), «Saving…» / «Offline · 3 waiting», кольцо со счётом дня «2/5» и Focus (только знак). Первая строка
  стоит на месте, вторая уезжает вместе со страницей, и у первой появляется линия снизу, только когда под ней что-то
  есть (iOS 18+, `onScrollGeometryChange`; на iOS 17 обе строки стоят). Шапка, как системные панели iOS, растёт с
  размером текста только до предела (первая строка не растёт вовсе), а при самых крупных размерах долгое нажатие
  показывает кнопку крупно (Large Content Viewer); подписи переключателя никогда не обрезаются.
- **iPad** — слева сайдбар во всю высоту: название, Home / Progress / Goals «Soon» / Agent «Soon», статус сохранения,
  аккаунт с «⋮». Прячется кнопкой в его шапке или клавишей `[`, выбор запоминается (`prefs.sidebarHidden`). Справа одна
  строка в три части: стрелки, название и полная дата («Today Friday, November 13», а если не влезает — короткая);
  переключатель в середине; счёт дня и Focus справа. Когда места мало (портрет рядом с сайдбаром, узкое окно),
  переключатель сужается и встаёт рядом с Focus, а Focus — только знаком, чтобы дата осталась хотя бы короткой.
- **Название дня и недели** — кнопка: месяц, чтобы выбрать день (на iPhone — лист снизу, на iPad — поповер): сегодня —
  залитая плитка, выбранный день — с обводкой, дни с незакрытыми задачами — тёмные.
- **Панель аккаунта** (аватар на iPhone, строка аккаунта в сайдбаре на iPad): кто вошёл, «Tokens left today» с полосой
  (только если сервер предлагает AI, `GET /api/usage`), на iPhone — страницы с точкой у текущей, Settings, на iPad —
  Keyboard shortcuts, последней строкой — Sign out.
- **Settings** — лист (iPhone) / окно (iPad): General — Appearance, Accent (в iOS остаётся выбор: Graphite по умолчанию,
  Blue, Orange, Green), Week starts on, Task order, Sounds, бейдж на иконке, Keyboard shortcuts (iPad); Voice — язык речи
  (Automatic или конкретный; раздел есть, только если сервер предлагает голос); Your data — выгрузка всех задач в CSV
  (`GET /api/export` → «Сохранить в Файлы»); Account — уровнем ниже: имя, почта, чем вошли, и в самом конце удаление
  аккаунта в два шага. Внизу Privacy · Terms · Support и Sign out (не влезают в строку — Sign out под ссылками; при
  размерах текста для универсального доступа они в конце страницы, а не прикреплены), в конце — версия.
- **Поиск** (`/` и ⌘K с клавиатуры, как на сайте; кнопки в интерфейсе у сайта нет — у приложения тоже): поле сразу с
  фокусом, результаты по дням (сегодня и вперёд, потом прошлое), совпадения выделены, выполненные — тихие; ↑ ↓ и Return
  или касание открывают день с выбранной задачей. Без сети — «You’re offline» вместо «No tasks match».
- **Клавиатура** (`App/AppCommands.swift`, видно при удержании ⌘): N, V, F, `/`, ⌘K, T, ← →, D W M, A, `[`, ⌘Z, ↑ ↓,
  ⌥↑ ⌥↓, Space, Return, ⌫, Esc, `,`, `?`. Пока печатаешь в поле, клавиши без ⌘ уходят в поле, а ⌘Z отменяет набор.
- **Отмена**: ⌘Z и встряхивание iPhone (после вопроса, как везде в iOS) отменяют последнее действие (`store.undoLast`),
  тост говорит, что вернулось. Тост — один за раз: новый сразу занимает место старого, ушедший тает за 110 мс.

Идентификаторы для UI-тестов: `viewSwitch`, `periodSwitch`, `bar.title`, `bar.back`, `bar.count`, `focus`,
`syncStatus`, `account`, `sidebar.hide`, `sidebar.show`, `page.home|progress|goals|agent`, `settings` (строка в панели),
`account.tokens`, `account.shortcuts`, `account.signOut`, `dayPicker`, `day.YYYY-MM-DD`, `settings.close|appearance|accent|
weekStart|order|sounds|badge|shortcuts|language|export|account|version|signOut|privacy|terms|support|delete|delete.cancel|
delete.confirm|delete.error`, `search.field|cancel|result|note`, `toast`, `toast.action`, `signin.apple|google|error`.

## Логотип, иконка и экран запуска

Логотипа в интерфейсе нет, как на сайте: везде название `hyperanchor` текстом (`Wordmark`). Иконка приложения — как
иконка сайта на домашнем экране: знак «hy» (h, перетекающая в y, `src/app/icon.svg`) цвета #111111 на белом, высотой 60%
плитки; тёмная — белый знак на почти чёрном; tinted — серый вариант, iOS 18+ выбирает сама. Экран запуска — знак 44 pt
по центру цвета страницы (белый / #141414); приложение рисует ту же картинку на том же месте и растворяет её, а экран
под ней (вход или планировщик) проявляется. Всё это рисует `swift ios/scripts/render-icon.swift` (из корня репозитория)
прямо по пути знака из `src/app/icon.svg` — сайт остаётся единственным источником, в веб скрипт ничего не пишет. В
симуляторе iOS кэширует экран запуска: после его изменения сотрите симулятор (`xcrun simctl erase`), на устройстве —
удалите и поставьте приложение заново.

Экран входа в приложении намеренно не повторяет лендинг сайта: один экран без прокрутки — `hyperanchor`, заголовок
«Own your day.» (последнее слово один раз проходит day / week / month), «Hyperanchor is a calm, fast planner. Sign in to
get started.», кнопки Apple и Google и юридическая строка в две строки, как на сайте.

## Настройка для настоящего входа

Значения для своего аккаунта кладутся в `ios/Config/Local.xcconfig` (в git не попадает), см. `ios/Config/App.xcconfig`:

```
HA_DEVELOPMENT_TEAM = ABCDE12345
GOOGLE_IOS_CLIENT_ID = 1234567890-abc123.apps.googleusercontent.com
API_BASE_URL = http:/$()/localhost:3000     // по умолчанию https://hyperanchor.app
```

1. **Apple Developer:** App ID `app.hyperanchor` с Sign in with Apple и App Groups (`group.app.hyperanchor` — для виджета).
   Team ID — в `HA_DEVELOPMENT_TEAM`. Сервер проверяет Apple-токены по `APPLE_BUNDLE_ID` (см. корневой README).
2. **Google Cloud:** OAuth client ID типа *iOS* с Bundle ID `app.hyperanchor`; его ID — в `GOOGLE_IOS_CLIENT_ID`
   здесь и на сервере. Вход идёт через системный `ASWebAuthenticationSession` (OAuth 2.0 + PKCE), без SDK.
3. Удаление аккаунта (Settings → Account → Delete account…) для Apple-пользователей просит подтвердить вход через Apple:
   свежий `authorizationCode` нужен серверу, чтобы отозвать токен (требование App Store 5.1.1(v)).

## Как устроено

```
Config/                  xcconfig, Info.plist, entitlements (приложение и виджет)
Hyperanchor/
  App/                   точка входа, AppModel, Router (навигация и запросы от клавиатуры), шорткаты, встряхивание
  App/Shell/             шапка (BarModel, AppBar), сайдбар, панель аккаунта, выбор дня, кусочки шапки
  Auth/                  экран входа (один экран, проявляется из экрана запуска), Sign in with Apple, Google OAuth + PKCE
  Data/                  Backend (HTTP с Bearer-токеном и демо в памяти), TaskStore, кэш на диске, Keychain, сессия
  Design/                Tokens.swift (генерируется), тема, чекбокс, кольцо, конфетти, кнопки, тосты
  Model/                 DayKey, даты, сортировка, аналитика — порт src/lib с проверкой против веба
  Features/              Day, Focus, Week, Month, Analytics (Progress), Search, Settings, Soon (Goals и Agent), Voice,
                         общие строки задач
  Resources/             иконка, цвета, PrivacyInfo.xcprivacy
Shared/                  снимок «на сегодня» для виджета (App Group)
HyperanchorWidget/       виджет Today (small, medium)
HyperanchorTests/        unit-тесты: даты/сортировка/аналитика против веба, TaskStore
HyperanchorUITests/      основные сценарии на демо-аккаунте
scripts/render-icon.swift  знак «hy» из src/app/icon.svg: иконка (светлая, тёмная, tinted) и знак экрана запуска
```

**Данные.** `TaskStore` повторяет веб-`useTasks`: изменения применяются сразу, запросы по одной задаче идут строго
по очереди, ввод сохраняется через 600 мс тишины, задачу с несохранёнными изменениями данные с сервера не
перезаписывают, при отказе сервера — тост и перезагрузка загруженных диапазонов. Сверх веба: очередь изменений
хранится на диске вместе с кэшем задач — приложение открывается сразу с сохранённым, а сделанное без сети уходит,
когда сеть появляется (несохранённые операции по одной задаче склеиваются).

**Паритет с вебом.** Расчёты аналитики, даты и сортировка — порт `src/lib/*.ts`. `node scripts/ios-fixtures.mjs`
прогоняет настоящий TypeScript веба на сгенерированных задачах и пишет эталоны в
`HyperanchorTests/Fixtures/web-fixtures.json`; `WebParityTests` требует точного совпадения (включая округление
JavaScript). Цвета, радиусы и тени — из `design/tokens.json` (`npm run tokens`).

**Проект.** `Hyperanchor.xcodeproj` использует синхронизированные с диском папки (Xcode 16+): новые файлы в
`Hyperanchor/`, `Shared/`, тестах и виджете подхватываются без правки проекта.
