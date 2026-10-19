# SharkLog — Инструкция по релизу

Пошаговое руководство по выпуску новой версии.

---

## Что и где менять при каждом релизе

| Файл | Поле | Пример |
|---|---|---|
| `apps/mobile/app.json` | `version` | `"1.1.0"` |
| `apps/mobile/app.json` | `android.versionCode` | `2` (целое, +1 каждый раз) |
| `apps/mobile/app.json` | `ios.buildNumber` | `"2"` (строка, +1 каждый раз) |
| `apps/desktop/src-tauri/tauri.conf.json` | `version` | `"1.1.0"` |
| `apps/desktop/package.json` | `version` | `"1.1.0"` |

---

## Полный чеклист релиза

### 1. Обновить версии в файлах

**`apps/mobile/app.json`**
```json
{
  "expo": {
    "version": "1.1.0",
    "android": { "versionCode": 2 },
    "ios":     { "buildNumber": "2" }
  }
}
```

Версию в приложении (строка «Версия» в Настройках, аналитика) отдельно менять не нужно:
`utils/appVersion.ts` читает её из `app.json`.

**`apps/desktop/src-tauri/tauri.conf.json`**
```json
{
  "version": "1.1.0"
}
```

**`apps/desktop/package.json`**
```json
{
  "version": "1.1.0"
}
```

---

### 2. Запустить тесты и type-check

```bash
cd packages/core && npx vitest run
cd apps/desktop  && npm test
cd apps/mobile   && npm test
cd apps/mobile   && npx tsc --noEmit
cd apps/desktop  && npx tsc --noEmit
```

Все должны быть зелёными. Если нет — чинить до коммита.

---

### 3. Закоммитить и запушить в main

```bash
git add apps/mobile/app.json \
        apps/desktop/src-tauri/tauri.conf.json \
        apps/desktop/package.json

git commit -m "chore: bump version to 1.1.0"
git push origin main
```

---

### 4. Создать GitHub Release (запускает сборку десктопа)

1. Открой **github.com/hoxitoo/Sharklog/releases/new**
2. Поле **"Choose a tag"** → введи `v1.1.0` → **"Create new tag: v1.1.0 on publish"**
3. **Title**: `SharkLog v1.1.0`
4. **Description**: список изменений
5. Нажми **Publish release**

→ GitHub Actions автоматически соберёт инсталлеры Win / Mac / Linux (~15–25 мин)

После сборки кнопка «Проверить обновления» в десктопном приложении начнёт находить новую версию.

---

### 5. Мобильная сборка через EAS (когда нужен стор)

```bash
# RuStore — APK, оплата через Робокассу (EXPO_PUBLIC_BILLING=robokassa)
eas build -p android --profile rustore
# готовый APK загрузить в консоль RuStore вручную

# Google Play (позже) — подписки через RevenueCat: задать EXPO_PUBLIC_BILLING=revenuecat
eas build -p android --profile production
eas submit -p android

# iOS
eas build -p ios --profile production
eas submit -p ios
```

Или вручную: **Actions → EAS Build → Run workflow** → выбери платформу и профиль.

**OTA-обновлений нет**: `expo-updates` не установлен, `eas update` ничего не доставит. Любое
изменение — новая сборка. Подключить OTA — отдельная задача (пакет, канал в `eas.json`, новая сборка).

---

## Ручной запуск сборки десктопа без тега

Через GitHub: **Actions → Release Desktop → Run workflow** → ветка `main` → `draft: true`

Это создаст черновик без публикации — удобно для тестирования сборок.

---

## Семантическое версионирование

```
v1.0.x  — только багфиксы
v1.1.0  — новые фичи, обратная совместимость
v2.0.0  — смена формата данных / major redesign
```

---

## Первый релиз в сторы — чеклист подготовки

Делается один раз:

**RuStore (первый релиз):**

- [ ] Аккаунт разработчика RuStore, приложение `app.sharklog.mobile`
- [ ] Робокасса: магазин прошёл модерацию, «Робочеки СМЗ» подключены
- [ ] Сервер лицензий развёрнут (README в папке Worker, хранится у автора, не в репозитории) — ДО сборки: его адрес и ключ вшиваются в APK
- [ ] EAS Environment variables (production): `EXPO_PUBLIC_LICENSE_URL`, `EXPO_PUBLIC_LICENSE_PUBKEY`, `EXPO_PUBLIC_SUPPORT_URL` (ссылка на бота)
- [ ] Свой Pro для тестовых сборок: EAS → Environment variables → `EXPO_PUBLIC_OWNER_PRO` = `true`, **только окружение `preview`** (не `production` — его берёт и `rustore`)
- [ ] Ключ подписи скачан и сохранён (`eas credentials` → Android → keystore): без него приложение в RuStore не обновить
- [ ] Тестовая оплата прошла на телефоне; затем `IS_TEST` убран, пароли боевые
- [ ] Политика: `https://hoxitoo.github.io/Sharklog/privacy.html`, почта поддержки `sharklog_help@mail.ru`
- [ ] Скриншоты телефона, описание, возрастной рейтинг 18+
- [ ] `EXPO_TOKEN` в GitHub Secrets (если сборка из Actions)

**Google Play / App Store (позже):**

- [ ] `targetSdkVersion` 36 (требование Google Play с 31.08.2026)
- [ ] Apple Developer → App ID `app.sharklog.mobile`; Google Play Console → новое приложение
- [ ] RevenueCat: продукты и ключи `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`, `EXPO_PUBLIC_BILLING=revenuecat`
- [ ] Пейвол подписок: ссылки на условия и политику, текст об автопродлении
- [ ] Скриншоты: 6.5" iPhone, Pixel (iPad не нужен — `supportsTablet: false`)
- [ ] Иконка: 1024×1024 PNG без прозрачности (App Store)

---

## Ветки и теги

```
main                    — всегда содержит код последнего релиза
claude/busy-shannon-jQgRK — активная разработка
v1.0.0, v1.1.0, ...    — git-теги на коммиты в main
```
