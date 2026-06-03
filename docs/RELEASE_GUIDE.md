# SharkLog — Инструкция по релизу

Пошаговое руководство по выпуску новой версии приложения.

---

## Desktop-релиз (автоматический через GitHub Actions)

### Как это работает

1. Ты создаёшь git-тег `v1.0.0` и пушишь его
2. GitHub Actions запускает `release-desktop.yml`
3. Параллельно собираются инсталлеры для Windows, macOS и Linux
4. Артефакты загружаются на GitHub Release (черновик)
5. Ты проверяешь черновик и публикуешь

### Шаги для каждого релиза

#### 1. Обнови версию в коде

```bash
# apps/desktop/src-tauri/tauri.conf.json — поле "version"
# apps/desktop/package.json — поле "version"
# apps/mobile/app.json — поля "version" и "ios.buildNumber" / "android.versionCode"
```

Также обнови `APP_VERSION` в коде, если есть хардкод:
```bash
grep -rn "APP_VERSION\|1\.0\.0" apps/desktop/src/ apps/mobile/src/ | grep -v node_modules
```

#### 2. Убедись что CI зелёный

```bash
# Запусти тесты локально перед тегом
cd packages/core && npx vitest run
cd apps/desktop && npm test
cd apps/desktop && npx playwright test
cd apps/mobile && npm test
```

#### 3. Создай тег и запусти сборку

```bash
# Коммить все изменения версии
git add apps/desktop/src-tauri/tauri.conf.json apps/desktop/package.json apps/mobile/app.json
git commit -m "chore: bump version to 1.0.1"

# Создай тег (семантическое версионирование)
git tag v1.0.1
git push origin claude/busy-shannon-jQgRK
git push origin v1.0.1
```

GitHub Actions немедленно запустится. Сборка всех трёх платформ занимает ~15–25 минут.

#### 4. Проверь GitHub Release

После успешного CI:
1. Открой https://github.com/hoxitoo/Sharklog/releases
2. Ты увидишь черновик релиза `SharkLog v1.0.1`
3. Проверь список артефактов — должны быть файлы для Win / Mac / Linux
4. Нажми **Edit** → проверь/дополни описание → нажми **Publish release**

После публикации кнопка «Проверить обновления» в десктопном приложении начнёт находить новую версию.

#### 5. Мерж в main

```bash
# После публикации релиза мержи в main через PR
# В GitHub: New pull request → claude/busy-shannon-jQgRK → main
```

---

## Ручной запуск desktop-сборки (без тега)

Через GitHub: Actions → **Release Desktop** → **Run workflow** → выбери `draft: true`  
Это создаст черновик без публикации — удобно для тестирования сборок.

---

## Mobile-релиз (EAS)

### Требования

- Expo аккаунт с активным проектом
- Apple Developer Program ($99/год) для iOS
- Google Play Console аккаунт ($25 единоразово) для Android
- `EXPO_TOKEN` добавлен в GitHub Secrets

### Шаги для Android

```bash
# 1. Обнови android.versionCode в app.json (инкремент: 1, 2, 3...)
# 2. Обнови version (semver: "1.0.0", "1.0.1"...)
# 3. Собери production APK/AAB
eas build -p android --profile production

# 4. Когда сборка завершится — опубликуй в Google Play
eas submit -p android
```

Или через GitHub Actions: Actions → **EAS Build** → Run workflow → `platform: android`, `profile: production`

### Шаги для iOS

```bash
# 1. Обнови ios.buildNumber в app.json (инкремент)
# 2. Собери IPA
eas build -p ios --profile production

# 3. Опубликуй в App Store Connect
eas submit -p ios
```

### OTA-обновления (без пересборки)

Для изменений только в JS/TypeScript (без нативного кода) можно сделать OTA-обновление:

```bash
eas update --branch production --message "Fix: описание изменений"
```

Пользователи получат обновление при следующем запуске приложения.  
**OTA не работает** при изменениях в `app.json` (новые permissions, plugins и т.д.) — нужна полная пересборка.

---

## Первый релиз v1.0.0 — чеклист

### Подготовка (делается один раз)

- [ ] Создать Apple Developer аккаунт → App ID для `app.sharklog`
- [ ] Создать Google Play Console → новое приложение
- [ ] Создать RevenueCat проект → добавить iOS / Android API keys в EAS Secrets
- [ ] Добавить `EXPO_TOKEN` в GitHub Secrets
- [ ] Опубликовать Privacy Policy на GitHub Pages (`gh-pages` ветка — уже создана)
- [ ] Добавить Privacy Policy URL в App Store Connect / Google Play Console
- [ ] Подготовить скриншоты: 6.5" iPhone, 12.9" iPad, Pixel 7
- [ ] Подготовить описания: краткое (80 символов) + полное (4000 символов)
- [ ] Подготовить иконку: 1024×1024 PNG без прозрачности (App Store)

### Публикация Android (Google Play)

1. `eas build -p android --profile production` → скачать AAB
2. Google Play Console → Создать новый релиз → загрузить AAB
3. Заполнить описание, скриншоты, тематику контента (18+, ставки)
4. Указать Privacy Policy URL: `https://hoxitoo.github.io/Sharklog/privacy.html`
5. Отправить на проверку (обычно 1–3 дня)

### Публикация iOS (App Store)

1. `eas build -p ios --profile production` → загружается автоматически в App Store Connect
2. App Store Connect → My Apps → Выбрать версию → заполнить метаданные
3. Указать Privacy Policy URL
4. Отправить на проверку (обычно 24–48 часов)

---

## Семантическое версионирование

```
v1.0.0  — первый публичный релиз
v1.0.1  — bugfix (нет новых фич)
v1.1.0  — новые фичи, обратная совместимость
v2.0.0  — breaking change (например, смена формата данных)
```

---

## Теги и ветки

```
main            — всегда содержит код последнего публичного релиза
v1.0.0          — git-тег, указывает на коммит в main
claude/...      — ветка разработки, мержится в main через PR перед релизом
```
