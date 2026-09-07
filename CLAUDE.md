# SharkLog — Контекст проекта

Bet tracker app — мобильное (React Native + Expo) и десктопное (Tauri v2 + React) приложение для учёта ставок. Freemium: 199 ₽/мес или 990 ₽/год.

## Структура монорепо

```
apps/mobile/     — React Native + Expo 51 (iOS + Android)
apps/desktop/    — Tauri v2 + React + Vite (Win / Mac / Linux)
packages/core/   — Чистая TS бизнес-логика (типы, статистика, Kelly, форматтеры, билдер стратегий)
docs/            — ROADMAP.md, ANALYSIS.md, PRIVACY_POLICY.md
```

## Git-ветки

- `claude/busy-shannon-jQgRK` — **песочница, вся разработка здесь**
- `dev` — интеграционная, PR из feature-веток перед main
- `main` — продакшен, только когда CI зелёный
- `gh-pages` — лендинг, независимая ветка (только HTML/CSS)

**Никогда не пушить напрямую в `main`.**

## Ключевые соглашения

- Деньги — **копейки (integer)**. `1000 ₽ = 100_000`. `formatMoney()` для вывода, `parseMoneyInput()` для ввода.
- `formatMoney(kopecks, currency='₽', maxDecimals=2)` — третий аргумент управляет знаками после запятой.
- На мобилке использовать `useFormatMoney()` (из `utils/useFormatMoney.ts`) вместо прямого `formatMoney` — он учитывает `settings.roundAmounts`. Ссылка стабильна (`useCallback` по `roundAmounts`), поэтому её МОЖНО и НУЖНО класть в зависимости `useMemo`/`useCallback`: мемоизированный заголовок секции без неё замерзал на той настройке, с которой смонтировался.
- Ставки — **UUID v4** (не timestamp). На мобилке — `uuid()` с fallback на Math.random (crypto может быть unavailable на Hermes/Android).
- PRO-функции мобилки — `<ProGate feature="...">` компонент.
- `packages/core` — без зависимостей на React/RN/Browser.
- `exactOptionalPropertyTypes: true` — нельзя писать `prop={undefined}`, нужен spread `{...(x ? { prop: x } : {})}`.
- **refund ≠ cashout**: `refund` = букмекер вернул ставку (отмена матча); `cashout` = игрок сам выкупил досрочно. Это два разных `BetStatus`.
- **formatPercent()** уже добавляет `+` для положительных значений — не добавляй префикс вручную.
- **`parseMoneyInput`** сохраняет ведущий `-` и парсит много-групповые разделители (`1 000 000`, `1.000.000`). Отрицательные значения отбрасывай на уровне формы (`stake > 0`), а не в парсере.
- **Запись в стор сериализована** через `writeChain` (промис-цепочка) в обоих `betsStore` — не вызывай `saveData`/`setItem` напрямую в обход `persist()`.
- **Пути в обход `addBet` не ставят напоминания** (импорт CSV/JSON, восстановление бэкапа) — после них дёргай `syncBetResultReminders`. Выключение тумблера должно снимать уже поставленные (`cancelAllBetResultReminders`), а не только прекращать новые.
- **`clearAll`** чистит только данные (ставки/дневник/банк), но СОХРАНЯЕТ настройки и подписку (PRO/язык/букмекеры) — не сбрасывай `settings` к дефолтам.
- **Даты-строки `YYYY-MM-DD`** парсь как локальные (`new Date(\`${d}T00:00:00\`)`), bare-строка парсится как UTC и смещает день. На десктопе локаль для `toLocaleDateString` — через `dateLocale(lang)` из `i18n`.
- **Очистка опциональных полей на edit**: `updateBet` делает merge `{...bet, ...updates}`, поэтому пустое поле, просто *опущенное* из `updates`, НЕ стирает старое значение. Чтобы очистить (напр. `closingOdds`/`cashoutAmount`), передавай ключ явно как `undefined` (через `... as Partial<Bet>`), а не опускай его.
- **gifted-charts: `hideDataPoints` убивает `customDataPoint`** — маркеры на линии не отрисуются. Для линий с метками (депозиты/выводы) рисуй свой SVG (`components/BalanceChart.tsx`), а не борись с библиотекой.
- **Логотип**: `assets/icon.png` — НЕПРОЗРАЧНЫЙ тайл (тёмный фон + белый знак) только для лаунчера/сплэша; внутри приложения показывай `assets/adaptive-icon.png` (прозрачный белый знак), иначе на экране виден тёмный квадрат. Десктоп: `public/logo.png` — прозрачный знак для тёмного UI, `public/logo-512.png` — оригинальный лок-ап на белом для README/лендинга.
- **Палитра графиков — одна на всё приложение**: `theme/chartColors.ts` (`SERIES`: win/loss/pnl/balance/deposit/withdrawal). Не заводи цвета серий по месту.
- **Ландшафтный режим через rotate-трансформ** (`ExpandedDashboard`): экран поворачивается на 90° по часовой, поэтому отступы безопасной зоны надо ПЕРЕСТАВЛЯТЬ — `paddingRight ← insets.bottom` (там наэкранные кнопки), `paddingLeft ← insets.top`. Иначе контент лезет под системную навигацию.
- **Действия из уведомления применяй ТОЛЬКО после `isLoaded`** — на холодном старте стор ещё пуст, и `updateBet` по пустому массиву затем запишет пустой снапшот поверх реальных данных. В `App.tsx` действие буферизуется в ref и применяется в эффекте по `isLoaded`.
- **Уведомления: детерминированный id `bet-result-<betId>`** — планирование идемпотентно (повторное перезаписывает, а не дублирует), отмена O(1). Все записи сериализованы через `notifChain`, иначе отмена может обогнать планирование и напоминание запишется ПОСЛЕ закрытия ставки.
- **НИКОГДА `toISOString().split('T')[0]` для «дня»** — это UTC-день. В 00:00 по локальному времени восточнее UTC он даёт ВЧЕРА: ставка сохранялась прошлым числом, «Сегодня» в списке указывало на вчерашний день, дневник писался не в тот день. Единственный способ получить календарный день — `toYmd(date)` из core (и мобилка, и десктоп).
- **Даты только через `toYmd()`** — `toISOString().split('T')[0]` даёт UTC-день. Из-за этого ставка могла записаться завтрашним числом (и выпасть из статистики), а транзакции банкролла — попасть в другой день, чем текущий банк в шапке.
- **Напоминание о результате не должно приходить по закрытой ставке** — защита в три слоя: (1) `updateBet` снимает запланированное и убирает уже доставленное из шторки, (2) `syncBetResultReminders(bets, enabled)` сверяет расписание с реальностью при запуске и каждом возврате в приложение (отмена — fire-and-forget, её может «потерять» при убийстве процесса; импорт CSV тоже создаёт дрейф), (3) `setNotificationHandler` глушит показ в foreground через `setBetPendingResolver`.
- **Новую функцию в `utils/notifications.ts` добавляй и в мок** `src/__tests__/__mocks__/notifications.ts`, иначе падают тесты стора.
- **Банк считай только через core**: `currentBank(transactions, bets)` = `bankCash(transactions) + P&L`. Не пиши руками `deposit ? + : -` — транзакций ТРИ типа, и третий (`adjustment`) хранит знак В САМОЙ СУММЕ, а не в типе. Инлайн-редьюс молча его потеряет.
- **Банк в приложении ≠ баланс у букмекера**: букмекер списывает ставку сразу при постановке, приложение — только при расчёте. Поэтому `балансУБукмекера = currentBank − pendingExposure(bets)`. Это первое, что надо исключить при расхождении.
- **`adjustment`** — сверка с реальным балансом бука без фейкового депозита/вывода. Пользователь вводит реальный баланс, приложение само считает разницу и пишет её со знаком. Разницу считай от `currentBank − pendingExposure`, а НЕ от голого банка: у бука открытые ставки уже списаны, и сверка от банка запишет их как недостачу, которая не рассосётся после расчёта ставок. В `calcDailyBreakdown` у неё свой бакет `adjustments` — она двигает `balance`, но НЕ попадает во «Внесено/Выведено» и не рисует маркер депозита на графике.
- **CSV — один модуль на оба приложения**: `packages/core/utils/betsCsv` (`buildBetsCSV` / `importBetsFromCSV` / `importBetsFromRows`). Не заводи парсер или писатель по месту: раньше их было два, они разъехались, и выгрузка с телефона не открывалась на ПК.
- **Общий кэф экспресса — `combineExpressOdds()`**, округление до 2 знаков. Букмекер показывает и рассчитывает экспресс по округлённому коэффициенту (1.23 × 1.90 = 2.337 → платит по 2.34). Хранение сырого произведения давало «× 2.34» на экране и выплату по 2.337 — расхождение с реальным балансом росло с каждым экспрессом.
- **P&L одной ставки — только `betPnl()`**. Ручные `status === 'won' ? ... : ...` уже приводили к тому, что выкуп экспортировался нулём, а проигранный фрибет — полной потерей.
- **Кумулятивные кривые сортируй по `date + time`, не по `createdAt`** — ставка, занесённая задним числом, иначе прыгает в конец графика и расходится со списком ставок.
- **Для «читаемости результата за период» — `calcPnlBuckets`**, а не накопительная линия: на кумулятиве выигрышный день идёт вниз, если предыдущий проиграл больше, и это читается как баг.
- **В инсайтах «Лучший/Худший» — это РАНГ, а цвет — знак P&L**. Если все турниры в плюсе, «худший» всё равно красится зелёным: красная цифра на прибыли — вранье о единственном, что там важно.
- **Список лет строится из данных + текущий год** (`calcBetYears`): переключатель сам обзаводится новым годом, когда календарь его отдаёт — ничего релизить и настраивать не нужно.
- **Разбивка по годам живёт на ВСЕЙ истории**, а не на отфильтрованной периодом: пересечение «7 дней» с «2025 год» оставит пустой экран без видимой причины.
- **`calcByTournament(bets, { includeUntagged })`** добавляет группу ставок без турнира под пустым ключом. Для разбивки по годам это обязательно — иначе части перестают складываться в целое.
- **`calcByTournament`/`calcByTeam` отдают `discipline`** — доминирующую СРЕДИ esports-ставок группы (не среди всех): ставка, переведённая с киберспорта на футбол, сохраняет старую дисциплину, потому что форма опускает ключ, а `updateBet` мержит. «Киберспорт» — не ответ: CS2 и Dota это разные игры с разным преимуществом.
- **Фильтр списка ставок** — `BetsFilter { date?, tournament?, team?, from?, year?, noTournament? }`. Турнир сравнивай по `.trim()` с обеих сторон (группировка тримит), команду — через `betBacksTeam()` (то же правило, что у `calcByTeam`), иначе количество в списке не сойдётся с числом на плитке инсайтов.
- **Android «назад»** обрабатывается в `DrawerNavigator` (`BackHandler`): drawer → фильтр → Ставки → выход. Новый уровень навигации добавляй туда же.
- **`calcLuck` — точка отсчёта НОЛЬ, а не «сколько заработал»**: ставка по цене букмекера имеет нулевое матожидание по построению (`p = 1/odds`), поэтому вопрос не «в плюсе ли я», а «на сколько сигм результат отошёл от нуля». Дисперсия одной ставки — `p(1−p)(stake × odds)²`. Фрибеты, возвраты и выкупы в выборку не входят: модель описывает бинарный исход своими деньгами.
- **`calcPlanCompliance` меряет ставку от банка НА НАЧАЛО дня** (`balance − pnl + withdrawals − adjustments`): пополнения того дня уже учтены, результаты — ещё нет, потому что на момент ставки их не было. Не считай долю от текущего банка — задним числом выигрышный день занизит все доли того же дня.
- **Банк для плана строится по ВСЕЙ истории, судится — срез**: `calcPlanCompliance(allBets, txs, limit, { evaluate: filtered })`. Если восстановить банк из отфильтрованных по периоду ставок, весь P&L до окна пропадёт и появятся выдуманные нарушения (на реальных данных — 10% вместо 7.9%).
- **Действия над ставкой добавляй в `useBetActions`, а не в экран** — колесо показывают два экрана, и позиции секторов должны совпадать, иначе теряется мышечная память.
- **Состояние inline-выкупа держит родитель** (`useBetActions.cashoutFor`), а не карточка: так «две открытые карточки» физически непредставимы. Карточка с открытым полем игнорирует тап по телу, поэтому забытая открытая карточка читается как зависшая.
- **Поле выкупа НЕ привязано к статусу** — выигранную ставку тоже можно перевести в выкуп. По статусу гейтятся только быстрые чипы W/L/R/C.
- **`Alert.alert` после закрытия `Modal` откладывай на кадр** (`requestAnimationFrame`): алерт, показанный от размонтируемого контроллера, может уехать вместе с ним, и подтверждение удаления молча не покажется.
- **`duplicateOf` ≠ `betId`**: `AddBet` с `duplicateOf` заполняет форму из ставки, но сохраняет НОВУЮ — статус сбрасывается в `pending`, дата/время на текущие, `cashoutAmount`/`closingOdds` очищаются.
- **`Text` на мобилке импортируй как `import { AppText as Text } from '.../components/AppText'`**, не из `react-native`. Обёртка подставляет DM Sans и выбирает НАЧЕРТАНИЕ по `fontWeight` (кастомное семейство на Android — одно начертание, `fontWeight: '700'` рядом с `DMSans_400Regular` отрисуется регулярным), после чего снимает `fontWeight`, иначе Android поджирняет уже жирное. React 19 удалил `defaultProps` у функциональных компонентов, поэтому глобального дефолта нет и быть не может. `TextInput` как ТИП рефа по-прежнему берётся из `react-native` (`import type`). **Вложенный `<Text>` обязан задавать свой `fontWeight`**: обёртка пишет разрешённое семейство на КАЖДЫЙ `Text`, поэтому наследование стиля от родителя до вложенного больше не доходит — вложенный элемент с одним лишь `color` отрисуется регулярным рядом с жирным родителем.
- **Деньги, коэффициенты и проценты — со спредом `numeric`** из `theme/typography`: DM Mono, где ширина цифры одинакова по построению. В пропорциональном начертании «1» уже «8», и колонка сумм не выстраивается. `AppText` дополнительно ставит `fontVariant: ['tabular-nums']` по умолчанию. На десктопе то же делает `font-variant-numeric` на `body` в `index.html`.
- **Размеры — только токенами**: `SIZE` (текст: `micro 10 / caption 12 / body 14 / lead 16 / title 20 / hero 26 / display 34`) и `GLYPH` (эмодзи и знаки) из `theme/typography`; `RADIUS`, `SPACE`, `TOUCH`, `hitSlopFor()` из `theme/layout`. Числовой литерал в `fontSize`/`borderRadius` и отступ ≥ 4 мимо сетки 4 px **роняют тест** `__tests__/designTokens.test.ts` — конфига eslint в проекте нет, а jest гоняется в CI. Отступы 1–3 px разрешены: это оптические подгонки (`marginTop: 2` под значением), а не структура. Эмодзи берёт `GLYPH`, а не `SIZE`: смешение этих осей и расплодило 20 размеров.
- **Карточка — `cardSurface`** из `components/Card` (фон, радиус, рамка, тень) или целиком `<Card>`, если нужна шапка с рейлом. Тон накладывается ПОВЕРХ: `{ ...cardSurface, ...toneSurface('profit') }`. Не собирай оболочку руками — так уже появилось четыре радиуса у одного объекта. Уголок-акцент в `BetCard` считается от `RADIUS.lg − 1` (радиус минус рамка), не пиши число.
- **Зона нажатия ≥ 44 dp**: если элемент может вырасти — `minHeight: TOUCH`; если размер намеренный (квадратные степперы, чипы W/L/R/C) — `hitSlopFor(размер)`, он добирает ровно до 44. `justifyContent: 'center'` добавляй только НЕ-строчным контейнерам: у `flexDirection: 'row'` это горизонтальное распределение.
- **Шапка**: экран из drawer — `<ScreenHeader>` (крупный заголовок, гамбургер), запушенный экран — нативная шапка стека с `NAV_TITLE`. Оба начертания идут из одного места в `ScreenHeader.tsx`. `ScreenHeader` держи СНАРУЖИ `ScrollView` — уехавший вверх гамбургер забирает с собой единственный тап в меню.
- **`keyboardShouldPersistTaps="handled"` — на КАЖДОМ `ScrollView`/`FlatList`/`SectionList`**, а не только там, где поле ввода внутри списка. Дефолт RN — `"never"`: при поднятой клавиатуре тап внутри прокручиваемого тратится на её закрытие и до кнопки не доходит, пользователь видит мёртвый первый тап. Клавиатуру могло поднять на ДРУГОМ экране: шторка меню — свой `ScrollView`, и с сфокусированным поиском ставок первый тап по любому пункту не срабатывал. Правило исполняемое — `__tests__/scrollTaps.test.ts`. Плюс `openDrawer()` делает `Keyboard.dismiss()`: клавиатура под шторкой на всю высоту бессмысленна и сама по себе.

## Цветовая система

**Лестница поверхностей** (шаги специально различимы — старые `#080810/#0E0E1C/#12121E` сливались):
```
colors.bg          = '#06070D'  // страница
colors.bgCard      = '#131522'  // карточка
colors.bgElevated  = '#1C1F2E'  // плитка внутри карточки
colors.bgSunken    = '#0B0C14'  // «колодцы»: инпуты, поле графика
colors.border      = '#282C3F'  // видимый хайрлайн
colors.borderStrong= '#3A3F57'
```

**Тона карточек** — чтобы соседние блоки читались как отдельные объекты, а не одно тёмное полотно.
`<Card title="..." tone="profit">` из `components/Card.tsx` даёт тонированный фон (accent 7%),
границу (accent 32%), скругление 18 и цветной рейл у заголовка.
Тона: `neutral | profit | loss | warn | info | violet | pink`.
Хелперы: `alpha(hex, 0..1)`, `toneSurface(tone)`, `TONE_ACCENT`. На десктопе — `toneCard(tone)`.

```
colors.accent   = '#22D3A0'  // teal  — победы, положительные значения
colors.purple   = '#5B6AF0'  // purple — CTA-кнопки, активные состояния, таб-бар
colors.won      = '#22D3A0'
colors.lost     = '#F4455A'
colors.pending  = '#F59E0B'
colors.refund   = '#A78BFA'  // используется и для cashout
colors.gold     = '#F59E0B'  // PRO badge
```

## Хранилище данных

| Платформа | Хранилище | Ключ |
|-----------|-----------|------|
| Mobile    | AsyncStorage | `@sharklog/data` |
| Desktop (в браузере) | localStorage | `sharklog-data` |
| Desktop (в Tauri) | SQLite `sharklog.db` таблица `kv` | `sharklog-data` |

Абстракция: `apps/desktop/src/storage/storageService.ts` — `loadData()` / `saveData()`.
Детекция Tauri: `window.__TAURI_INTERNALS__`.

## Бизнес-правила

- Free лимит: **50 ставок** (`FREE_LIMITS.MAX_BETS`)
- Тилт-алерт: **3 поражения подряд** (Free, фикс) / **N** (PRO, настраивается)
- Дневной лимит: только PRO, 0 = без лимита
- 7 дней бесплатного Pro для новых пользователей
- Freemium: 199 ₽/мес, 990 ₽/год
- Инсайты/команды (PRO): только команды с ≥10 ставок показываются в "Любимые команды"

## Локализация (i18n)

Поддерживаются 4 языка: **ru** (русский), **en** (English), **kz** (қазақша), **by** (беларуская).

Файлы переводов:
- Desktop: `apps/desktop/src/i18n/locales/{ru,en,kz,by}.json`
- Mobile: `apps/mobile/src/i18n/locales/{ru,en,kz,by}.json`

```typescript
// Desktop — в компонентах
import { useTranslation } from 'react-i18next';
const { t, i18n } = useTranslation();
t('status.won')           // → 'Победа' / 'Won' / 'Жеңді' / 'Выйграў'
t('discipline.tiltBannerTitle', { count: 3 })  // интерполяция

// Смена языка (десктоп — через SettingsPage)
i18n.changeLanguage('en');
updateSettings({ language: 'en' });

// Mobile — через applyLanguage() в SettingsScreen
import i18n from '../i18n';
i18n.changeLanguage(lang);

// Локаль для дат
const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
new Date(str).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
```

Ключевые пространства имён в JSON-файлах:
`nav`, `status`, `bet`, `dashboard`, `analytics`, `insights`, `bankroll`, `discipline`, `settings`, `common`

Соглашения:
- `formatPercent()` не трогать — уже добавляет `+`; в переводах знак `+` тоже не ставить
- Валюта `₽` захардкожена в `formatMoney()` — не переводить
- Все числовые суммы идут через `formatMoney()`, не вставлять в строки вручную
- При добавлении нового UI-текста — добавлять ключ во все 4 файла сразу

## Команды

```bash
# Тесты
cd packages/core && npx vitest run        # 208 unit-тестов core
cd apps/desktop  && npm test              # 40 smoke-тестов desktop (Vitest)
cd apps/mobile   && npm test              # 34 smoke-теста mobile (Jest)

# Type-check
cd apps/mobile  && npx tsc --noEmit
cd apps/desktop && npx tsc --noEmit

# Запуск
cd apps/mobile  && npx expo start
cd apps/desktop && npm run dev            # браузер localhost:1420
cd apps/desktop && npx tauri dev          # нативное окно (требует Rust)

# Git
git push -u origin claude/busy-shannon-jQgRK
```

## Owner mode (десктоп)

Создать `apps/desktop/.env.local` (в .gitignore):
```
VITE_OWNER_PRO=true
```
При этом PRO включается автоматически навсегда, без клика "Попробовать Pro".

## Важные паттерны

```typescript
// Деньги
const kopecks = parseMoneyInput('1000');  // → 100000
formatMoney(100000);                       // → '1 000 ₽'
formatMoney(100000, '₽', 0);              // → '1 000 ₽' (без копеек, округлённо)

// На мобилке — форматирование с учётом roundAmounts (хук)
const fmt = useFormatMoney();
fmt(100000);  // '1 000 ₽' или '1 000,00 ₽' в зависимости от настройки

// Optional props с exactOptionalPropertyTypes
<Component {...(value ? { prop: value } : {})} />

// clearAll — сброс всех данных пользователя
useBetsStore(s => s.clearAll)()

// PRO-gate (mobile)
<ProGate feature="Описание фичи">
  <ActualContent />
</ProGate>

// Детекция Tauri
const IS_TAURI = !!(window as any).__TAURI_INTERNALS__;

// Парсинг команд из event string
import { parseEventTeams } from '@sharklog/core';
parseEventTeams('NaVi vs Astralis');   // → ['NaVi', 'Astralis']

// Статистика по турнирам / командам
import { calcByTournament, calcByTeam } from '@sharklog/core';
const tournamentStats = calcByTournament(bets);     // все турниры
const teamStats = calcByTeam(bets, 10);             // команды с ≥10 ставок

// Билдер стратегий
import { STRATEGY_QUESTIONS, buildStrategy } from '@sharklog/core';
const strategy = buildStrategy(answers);            // → GeneratedStrategy
// Сохранить: updateSettings({ generatedStrategy: strategy })
```

## Структура desktop (apps/desktop/src/)

```
App.tsx                    — загрузка (logo.png), онбординг-роут, main layout
                             PAGE_ORDER: dashboard/bets/analytics/insights/strategy/bankroll/diary/settings
                             Ctrl+1..8 — навигация; Ctrl+N — новая ставка; Esc — закрыть модал
components/
  ErrorBoundary.tsx        — React class boundary, кнопки retry/reload
  ChecklistModal.tsx       — 5 вопросов перед ставкой (PRO)
  ConfirmModal.tsx         — подтверждение деструктивных действий
  Toaster.tsx              — toast уведомления
layouts/
  AppLayout.tsx            — sidebar: logo img, nav 8 пунктов (PRO badge на strategy), FREE_LIMITS прогресс-бар
pages/
  DashboardPage.tsx        — period filter, 6 KPI, W/L strip, heatmap, стратегия-плашка (→ 'strategy')
  BetsPage.tsx             — date-grouped sections, daily P&L, search/filter/sort; статусы refund + cashout
  AddBetModal.tsx          — форма с двумя полями команд (Команда 1 / Команда 2) + 1X2 picker
                             + Kelly calculator + ChecklistModal (PRO)
                             поле "Турнир / Лига" с <datalist> autocomplete
                             clipboard paste для pre-fill; статус cashout
                             event строится как `${team1} vs ${team2}`
  AnalyticsPage.tsx        — 7 срезов (PRO) + "Топ турниры" mini-cards
  BankrollPage.tsx         — equity curve, Kelly calc, транзакции с удалением, сверка с букмекером
  DiaryPage.tsx            — mood tracker, тилт-стата, дневник
  InsightsPage.tsx         — period filter; Лучший/Худший → топ-3 → раскрываемый остаток,
                             отдельно для турниров и команд (PRO);
                             клик по строке/карточке → BetsPage с фильтром (App держит BetsFilter)
  StrategyBuilderPage.tsx  — PRO: progress bar + 10 вопросов + ResultCard + disclaimer
  SettingsPage.tsx         — подписка, тилт-stepper, букмекеры, команды,
                             CSV/Excel/JSON import-export, проверка обновлений
  OnboardingPage.tsx       — 3-шаговый визард (welcome logo → букмекеры → go)
storage/
  storageService.ts        — SQLite (Tauri) / localStorage (browser) абстракция
store/
  betsStore.ts             — Zustand; load() async, persist() fire-and-forget
  toastStore.ts            — эфемерные toast-уведомления
utils/
  importBets.ts            — импорт CSV/XLSX с алиасами колонок, нормализацией дат, поддержка cashout
  clipboardParser.ts       — parseClipboard(text) → Partial<Bet> (pre-fill AddBetModal)
theme/
  colors.ts                — цветовая система
public/
  logo.png                 — официальный логотип (sidebar, loading screen)
  logo-512.png             — high-res версия
```

## Структура mobile (apps/mobile/src/)

```
navigation/
  RootNavigator.tsx        — Stack: Drawer + AddBet (modal) + Bankroll + StrategyBuilder + Partners
  DrawerNavigator.tsx      — кастомный анимированный drawer (заменяет таббар с v2)
                             Animated.spring (открытие) / Animated.timing с callback (закрытие)
                             DrawerContext — openDrawer() доступен из любого экрана
                             FAB «+» — виден ТОЛЬКО на экране Ставок ({screen === 'Bets' && ...})
                             Разделы: Ставки | Дашборд | Инсайты | Аналитика | Дисциплина | Настройки
                             Вторичные: Банкролл | Стратегии (PRO) | Партнёры (teal-карточка)
screens/
  BetsScreen/              — SectionList + quick-result W/L/R/C (cashout)
                             ТАП по карточке = колесо действий (ActionWheel), НЕ редактирование
                             Панель фильтров лежит ПОВЕРХ списка и при листании вниз не
                             исчезает, а сворачивается в трей (пилюля вверху: лупа + банк +
                             «в игре» + точка, если фильтр статуса активен). Лупа = свёрнутая
                             форма поиска: разворачивает панель, везёт список наверх и ставит
                             фокус в поле (референс — Telegram). Тап по самой пилюле — просто
                             наверх. Два слоя на одном Animated.Value 0..1, оба на нативном
                             драйвере; невидимый слой обязан быть pointerEvents:'none', иначе
                             съедает тапы.
                             Свёртка считается по НАКОПЛЕННОМУ смещению (сброс при смене
                             направления, порог ±24), а не по дельте одного события: медленное
                             перетаскивание даёт 1–3 px за событие и порог не набирался — панель
                             висела полуубранной ещё семь строк.
                             Разворот жёстко привязан к позиции: при y < высоты панели она
                             ВСЕГДА развёрнута — список резервирует эту высоту в paddingTop,
                             и свёрнутая панель показала бы полосу пустой страницы.
                             Высота меряется onLayout → paddingTop + progressViewOffset.
                             body с overflow:'hidden', иначе спрятанный слой рисуется поверх
                             ScreenHeader. Статус и сортировка — не ленты чипов, а два
                             <FilterPicker> (кнопка + шит): шесть статусов и шесть сортировок
                             чипами уезжали за экран, и активный мог быть не виден
  AddBetScreen/            — форма с полем Турнир/Лига, статус cashout
                             collapsible доп. поля (стратегия, букмекер, дата, турнир, заметки, фрибет)
                             автораскрытие при edit если доп. поля заполнены
                             KeyboardAvoidingView: behavior='padding' iOS / 'height' Android
                             TournamentInput: onFocus → scrollRef.scrollToEnd (поле не перекрывается клавиатурой)
  DashboardScreen/         — ПЕРЕРАБОТАН (не дублирует аналитику): сверху оборот по периоду + банкролл;
                             главный блок — интерактивный график по дням (10 дней, тап → детали дня),
                             «Развернуть» → ландшафтная таблица с фильтрами (rotate-трансформ, без нативных зависимостей)
                             стратегия-плашка → navigate('StrategyBuilder')
                             тепловая карта за collapsible toggle
                             тилт-баннер с dismiss × (AsyncStorage @sharklog/tilt_dismiss_date)
                             haptic.warning() при первом определении тилта
  InsightsScreen/          — Лучший/Худший (2 карточки по P&L) → топ-3 → раскрываемый остаток;
                             внизу «По годам»: переключатель лет + расходящиеся полосы P&L
                             по турнирам года, включая «Без турнира» (YearBreakdown.tsx);
                             то же для команд (PRO); тап по строке → список ставок с фильтром
                             (период плитки переносится). У киберспорта показывается дисциплина
  AnalyticsScreen/         — РЕДИЗАЙН: hero-состояние сверху + collapsible «Расширенная статистика».
                             Hero: P&L + столбцы за период (PnlBars, тап по столбцу), серии, рекорды,
                             прошлый месяц с трендом, время ставок (донат 6 промежутков + топ-4 часа с P&L,
                             12h/24h через uses12HourClock()), CLV-карточка. Всё PRO via ProGate.
                             Расширенная (collapsible): sport/betType/bookmaker/strategy/odds/day срезы
  BankrollScreen/          — «Пополнить / Вывести / Сверить»; сверка = ввод реального баланса бука,
                             разница пишется как adjustment; в шапке «в игре» + баланс у бука
                             кривая банкролла = BalanceChart (свой SVG, подневная агрегация, читаемый тренд,
                             рабочие метки депозитов/выводов на линии);
                             маркеры депозита (зелёная точка) / вывода (красная точка) на кривой через customDataPoint;
                             Kelly (PRO)
  DisciplineScreen/        — mood, тилт, дневник
  SettingsScreen/          — PRO settings + "Билдер стратегий" кнопка
                             disableChecklist toggle (PRO) — отключить чек-лист перед ставкой
                             roundAmounts toggle (округление сумм)
                             "Проверить обновления" (GitHub latest release API)
                             7-tap Easter egg на строке "Подписка" → активация PRO (dev bypass)
  OnboardingScreen/        — logo Image + 3 шага
  StrategyBuilderScreen/   — PRO: WizardScreen + ResultScreen
components/
  ActionWheel.tsx          — радиальное меню (SVG-секторы, тап по сектору, центр = закрыть/назад)
  useBetActions.tsx        — ЕДИНЫЙ набор действий над ставкой для BetsScreen и PendingScreen:
                             pending → 7 секторов (W/L/Возврат/Выкуп/Копия/Изменить/Удалить),
                             settled → 4 (Результат ▸ / Копия / Изменить / Удалить),
                             «Результат» открывает второй уровень колеса
  StatusBadge.tsx          — бейджи: pending/won/lost/refund ("Возврат")/cashout ("Выкуп")
  ProGate.tsx              — RevenueCat paywall
  DrawerContext.tsx        — React Context: openDrawer() для всех экранов
  ScreenHeader.tsx         — заголовок с hamburger + rightAction; НЕ используется в stack-экранах (Bankroll, StrategyBuilder)
  FilterPicker.tsx         — фильтр как кнопка + нижний шит со списком опций.
                             Закрывается тапом мимо И свайпом вниз (PanResponder на ручке и
                             заголовке, порог 120 px или vy > 0.6); список опций при этом
                             продолжает скроллиться, потому что жест забирается только на
                             явном движении вниз (dy > 6 и |dy| > |dx|)
  ResponsibleGamblingBanner.tsx — коллапсируемый 18+ баннер (AsyncStorage @sharklog/responsible_expanded)
  AnimatedSplash.tsx       — анимация "Сигнал": 3 staggered scaleX-линии + "SharkLog" + слоган
                             + 12 строк × 4 коэффициента НА ВСЮ ВЫСОТУ экрана (процентные top-позиции 3%…93%,
                             массив rowOps в одном useRef; яркость 0→0.22→0 стаггером 170ms, волна сверху вниз)
                             2400ms фиксировано; onFinish() callback; все Animated — useNativeDriver:true
assets/
  icon.png                 — 1024×1024 на тёмном фоне
  adaptive-icon.png        — 1024×1024 прозрачный фон (Android)
  splash.png               — 1284×2778 по центру
```

## Структура core (packages/core/src/)

```
types/bet.ts          — BetStatus: 'pending'|'won'|'lost'|'refund'|'cashout'
                        BankrollTxType: 'deposit'|'withdrawal'|'adjustment' (у последнего amount ЗНАКОВЫЙ)
                        Bet: + tournament?: string, + closingOdds?: number (для CLV)
                        AppSettings: + generatedStrategy?: GeneratedStrategy, + roundAmounts: boolean, + disableChecklist?: boolean
                        GeneratedStrategy: + rationale?, keyPrinciples?, recommendedApproaches?,
                        recommendedBetTypes?, betTypeRationale?, oddsRationale? (6 rich output fields)
                        StrategyAnswers, + 10 union types
constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, FREE_LIMITS, ODDS_RANGES
utils/
  stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek,
                        calcByHour, isInTilt, calcByTournament, calcByTeam, parseEventTeams, betPnl
                        betPnl(bet) — реализованный P&L одной ставки в копейках (общий хелпер)
                        getPickedTeams(event, pick) — внутренний хелпер: возвращает только команды,
                        на которые поставил игрок (П1/П2/Ф1/Ф2 и прямые имена); используется в calcByTeam
                        betBacksTeam(bet, team) — тот же предикат наружу, для фильтра списка ставок
                        bankCash(txs) / currentBank(txs, bets) / pendingExposure(bets) — банк (см. соглашения)
  daily.ts            — calcDailyBreakdown/summarizeDays/toYmd — подневная статистика для дашборда
                        (cumPnl/balance всегда по всей истории; toYmd — локальная дата, не toISOString)
                        DayStats.adjustments — сверки отдельным бакетом, вне «внесено/выведено»
  betsCsv.ts          — buildBetsCSV / importBetsFromCSV / importBetsFromRows / parseAmount
                        один импорт-экспорт на оба приложения: BOM, CRLF, `,`/`;`/таб, алиасы колонок
  analytics.ts        — calcStreaks (лучшая W / худшая L / текущая), calcExtremes (макс выигрыш/проигрыш),
                        calcLastFullMonth(bets, now) (прошлый полный месяц + тренд), calcCLV (closingOdds),
                        calcTimeStats(bets, use12h) (6 4-часовых промежутков для доната + топ-4 часа с P&L),
                        calcMaxDrawdown (пик→дно кумулятивного P&L), calcEdge (WR vs безубыток),
                        calcMonthlyPnl(bets, now, months), calcMonthResult(bets, y, m) — итог любого месяца, RELIABLE_SAMPLE_MIN=100
                        calcPnlBuckets(bets, 'day'|'week'|'month', count) — чистый P&L по периодам
                        (группировка по bet.date, пустые бакеты сохраняются)
                        calcLuck(bets) — сигма-отклонение результата от безубытка (везение vs решения)
                        calcPlanCompliance(bets, txs, limitPct) — доля ставок сверх лимита плана,
                        P&L в лимите / сверх него, топ отклонений
                        calcBetYears(bets, now) — годы из данных + текущий, новые первыми
                        betsInYear(bets, year) — срез по календарному году
  kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability
  formatters.ts       — formatMoney(kopecks, currency='₽', maxDecimals=2), parseMoneyInput, formatOdds, formatPercent (adds + prefix)
  strategyBuilder.ts  — STRATEGY_QUESTIONS (10 вопросов), buildStrategy(answers)
  migrations.ts       — migrate(raw); v3 округляет кэфы экспрессов до 2 знаков.
                        JSON-восстановление тоже гонится через migrate(), иначе старый бэкап
                        возвращает уже исправленные баги
```
