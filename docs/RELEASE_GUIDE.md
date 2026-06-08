# SharkLog — Инструкция по релизу

Пошаговое руководство по выпуску новой версии.

---

## Что и где менять при каждом релизе

| Файл | Поле | Пример |
|---|---|---|
| `apps/mobile/app.json` | `version` | `"1.1.0"` |
| `apps/mobile/app.json` | `android.versionCode` | `2` (целое, +1 каждый раз) |
| `apps/mobile/app.json` | `ios.buildNumber` | `"2"` (строка, +1 каждый раз) |
| `apps/mobile/src/screens/SettingsScreen/index.tsx:108` | `APP_VERSION` | `'1.1.0'` |
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

**`apps/mobile/src/screens/SettingsScreen/index.tsx` — строка 108**
```ts
const APP_VERSION = '1.1.0';
```

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
        apps/mobile/src/screens/SettingsScreen/index.tsx \
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
# Android
eas build -p android --profile production
eas submit -p android

# iOS
eas build -p ios --profile production
eas submit -p ios
```

Или вручную: **Actions → EAS Build → Run workflow** → выбери платформу и профиль.

**OTA-обновление** (только JS-изменения, без нативного кода):
```bash
eas update --branch production --message "Fix: описание"
```

> OTA не работает при изменениях в `app.json` (новые плагины, permissions) — нужна полная пересборка.

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

- [ ] Apple Developer аккаунт → App ID для `app.sharklog`
- [ ] Google Play Console → новое приложение
- [ ] RevenueCat проект → iOS / Android API keys в EAS Secrets
- [ ] `EXPO_TOKEN` в GitHub Secrets
- [ ] Privacy Policy опубликована: `https://hoxitoo.github.io/Sharklog/privacy.html`
- [ ] Скриншоты: 6.5" iPhone, 12.9" iPad, Pixel 7
- [ ] Описания: краткое (80 символов) + полное (4000 символов)
- [ ] Иконка: 1024×1024 PNG без прозрачности (App Store)

---

## Ветки и теги

```
main                    — всегда содержит код последнего релиза
claude/busy-shannon-jQgRK — активная разработка
v1.0.0, v1.1.0, ...    — git-теги на коммиты в main
```
