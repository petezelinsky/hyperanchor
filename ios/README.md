# Hyperanchor for iPhone and iPad

Нативное приложение (SwiftUI, iOS 17+, Swift 6) с тем же функционалом, что и [hyperanchor.app](https://hyperanchor.app):
Day · Week · Month · Analytics, режим Focus, вход через Apple и Google, общие с сайтом задачи. Сторонних зависимостей нет.

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
| `-appearance light\|dark`, `-accent blue\|orange\|green`, `-tab day\|week\|month\|analytics` | внешний вид и вкладка при запуске |

Скриншоты всех экранов в светлой и тёмной теме (для проверки дизайна и для App Store) снимает `ScreenshotTour`;
по умолчанию он пропускается:

```bash
TEST_RUNNER_SCREENSHOTS=1 xcodebuild test -project ios/Hyperanchor.xcodeproj -scheme Hyperanchor \
  -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:HyperanchorUITests/ScreenshotTour -resultBundlePath Tour.xcresult
xcrun xcresulttool export attachments --path Tour.xcresult --output-path Screenshots
```

## Логотип и экран запуска

Логотип — «h.»: строчная h и точка синего акцента (первая буква и точка из «hyperanchor.»). Иконка приложения
светлая (чёрная h на белом), тёмная (белая на чёрном) и tinted — iOS 18+ выбирает по оформлению. Экран запуска —
знак по центру на белом / почти чёрном фоне; первый экран приложения подхватывает его с того же места: на экране
входа знак переезжает на своё место, у вошедшего фон растворяется над вкладками. Всё это, вместе с `src/app/icon.svg`
сайта, рисует `swift ios/scripts/render-icon.swift` (из корня репозитория) по одной геометрии; в приложении тот же
знак рисует `BrandMark`. В симуляторе iOS кэширует экран запуска: после его изменения сотрите симулятор
(`xcrun simctl erase`), на устройстве — удалите и поставьте приложение заново.

Экран входа в приложении намеренно не повторяет лендинг сайта: один экран без прокрутки — знак, заголовок, строка о
приложении, кнопки Apple и Google.

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
3. Удаление аккаунта (Settings → Delete Account) для Apple-пользователей просит подтвердить вход через Apple:
   свежий `authorizationCode` нужен серверу, чтобы отозвать токен (требование App Store 5.1.1(v)).

## Как устроено

```
Config/                  xcconfig, Info.plist, entitlements (приложение и виджет)
Hyperanchor/
  App/                   точка входа, AppModel, Router (навигация и запросы от клавиатуры), шорткаты
  Auth/                  экран входа (один экран, знак переезжает с экрана запуска), Sign in with Apple, Google OAuth + PKCE
  Data/                  Backend (HTTP с Bearer-токеном и демо в памяти), TaskStore, кэш на диске, Keychain, сессия
  Design/                Tokens.swift (генерируется), тема, чекбокс, кольцо, конфетти, кнопки, тосты
  Model/                 DayKey, даты, сортировка, аналитика — порт src/lib с проверкой против веба
  Features/              Day, Focus, Week, Month, Analytics, Settings, общие строки задач
  Resources/             иконка, цвета, PrivacyInfo.xcprivacy
Shared/                  снимок «на сегодня» для виджета (App Group)
HyperanchorWidget/       виджет Today (small, medium)
HyperanchorTests/        unit-тесты: даты/сортировка/аналитика против веба, TaskStore
HyperanchorUITests/      основные сценарии на демо-аккаунте
scripts/render-icon.swift  логотип «h.»: иконка (светлая, тёмная, tinted), знак экрана запуска и src/app/icon.svg
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
