# Публикация лендинга в Яндекс Облаке (Object Storage)

Схема: статические файлы лежат в **бакете Object Storage**, бакет включён как
**хостинг статического сайта**, доступ — по адресу
`https://<имя-бакета>.storage.yandexcloud.net/`. Домен `storage.yandexcloud.net`
доступен в РФ без VPN.

Готовый архив для загрузки: [`site.zip`](site.zip) (только `index.html`, `style.css`,
`script.js`, `img/` — без git-истории и служебных файлов).

---

## 0. Что понадобится

- Аккаунт Яндекс Облака и **платёжный аккаунт** (без него нельзя создать бакет).
- Каталог (folder) в облаке, например `landing`.
- Имя бакета: латиница в нижнем регистре, цифры и дефис, **уникальное в мире**.
  Пример: `sourcecraft-test-landing`.
- AWS CLI (только для варианта Б) или доступ к веб-консоли.

---

## Вариант А. Через веб-консоль (без установки программ)

1. Откройте <https://console.yandex.cloud> и создайте каталог, если его нет.
2. Перейдите в **Object Storage → Создать бакет**.
   - Имя: `sourcecraft-test-landing` (или своё уникальное).
   - Регион: `ru-central1`.
   - Класс хранения: **Стандартное**.
   - Максимальный размер: 1 ГБ (с запасом).
3. Откройте созданный бакет → вкладка **Настройки**:
   - **Публичный доступ** → включите **Чтение объектов** (`allUsers: view`).
     Без этого сайт будет отдавать `403 Access Denied`.
   - **Хостинг статического сайта** → включите.
     - Главная страница: `index.html`
     - Страница ошибки: `index.html`
4. Вкладка **Объекты** → **Загрузить объекты** → перетащите:
   - `index.html`, `style.css`, `script.js` — в корень бакета;
   - папку `img` целиком — **сохранив структуру** (`img/logo.svg` и т. д.).
5. Проверьте: <https://sourcecraft-test-landing.storage.yandexcloud.net/>
   Должен открыться лендинг, стили и картинки — подгрузиться.
6. Если браузер скачивает `index.html` вместо отображения — значит не включён
   «Хостинг статического сайта» (шаг 3).

---

## Вариант Б. Через AWS CLI (быстрее при обновлениях)

### Б.1. Получить ключи

1. В консоли: **Сервисные аккаунты → Создать сервисный аккаунт**.
2. Роль: `storage.editor` (для загрузки и настройки бакета).
3. В сервисном аккаунте: **Создать статический ключ доступа** → сохраните
   `Access key` и `Secret key` (секрет показывается один раз).

### Б.2. Настроить CLI

```bash
aws configure
# AWS Access Key ID:     <access key>
# AWS Secret Access Key: <secret key>
# Default region name:   ru-central1
# Default output format: json
```

Все команды выполняются с `--endpoint-url https://storage.yandexcloud.net`.

### Б.3. Создать бакет и включить сайт

```bash
BUCKET=sourcecraft-test-landing

aws --endpoint-url https://storage.yandexcloud.net s3 mb s3://$BUCKET

aws --endpoint-url https://storage.yandexcloud.net s3 website s3://$BUCKET \
  --index-document index.html \
  --error-document index.html
```

### Б.4. Разрешить публичное чтение

```bash
aws --endpoint-url https://storage.yandexcloud.net s3api put-bucket-policy \
  --bucket $BUCKET \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::'"$BUCKET"'/*"]
    }]
  }'
```

### Б.5. Загрузить файлы

Из папки `SimpleWebPage`:

```bash
aws --endpoint-url https://storage.yandexcloud.net s3 sync . s3://$BUCKET \
  --exclude ".git/*" \
  --exclude ".github/*" \
  --exclude "README.md" \
  --exclude "DEPLOY-YANDEX.md" \
  --exclude ".gitignore" \
  --exclude "site.zip" \
  --acl public-read
```

`sync` сам выставит `Content-Type` по расширению (`.svg` → `image/svg+xml`,
`.css` → `text/css`, `.js` → `application/javascript`).

### Б.6. Проверить

```bash
curl -I https://$BUCKET.storage.yandexcloud.net/
# ожидаем HTTP/2 200 и content-type: text/html
```

---

## Свой домен (необязательно)

Object Storage не принимает произвольный домен напрямую — нужен **Cloud CDN**:

1. **Certificate Manager** → запросить сертификат Let's Encrypt на ваш домен,
   подтвердить владение (CNAME/HTTP-проверка), дождаться статуса «Выпущен».
2. **Cloud CDN** → создать ресурс:
   - Источник: **Бакет**, ваш бакет, включить «Использовать хостинг статического сайта».
   - Доменное имя: `landing.example.ru`.
   - Сертификат: созданный в Certificate Manager.
3. В DNS вашего домена: `CNAME landing.example.ru → <домен CDN-ресурса>`.
4. Через 15–60 минут сайт откроется по `https://landing.example.ru`.

Пока домен не настроен, сайт полностью работоспособен на
`https://<bucket>.storage.yandexcloud.net/`.

---

## Обновление сайта

1. Внесите правки в `index.html` / `style.css` / `script.js` / `img/`.
2. Пересоберите архив (если публикуете через консоль):
   `powershell -NoProfile -Command "Compress-Archive -Path index.html,style.css,script.js,img -DestinationPath site.zip -Force"`
3. Загрузите изменённые файлы (консоль) или повторите `s3 sync` (CLI).
4. Если подключён Cloud CDN — сбросьте кэш ресурса ( purge ), иначе браузеры
   могут показывать старую версию до истечения TTL.

---

## Стоимость и лимиты

- Хранение такого сайта — единицы рублей в месяц, основной расход — исходящий трафик.
- У нового аккаунта обычно есть стартовый грант; проверьте актуальные тарифы
  в калькуляторе Яндекс Облака.
- Рекомендуется сразу задать бюджетное ограничение (Billing → Бюджеты), чтобы
  не получить неожиданный счёт при всплеске трафика.

---

## Чек-лист

- [ ] Бакет создан в `ru-central1`
- [ ] Включён публичный доступ на чтение объектов
- [ ] Включён хостинг статического сайта, главная — `index.html`
- [ ] Загружены `index.html`, `style.css`, `script.js`, папка `img/`
- [ ] `https://<bucket>.storage.yandexcloud.net/` открывается без VPN
- [ ] Стили и SVG загружаются (нет 403/404 в консоли браузера)
- [ ] Проверены мобильный вид и переключение темы
- [ ] (опционально) подключён свой домен через Cloud CDN
- [ ] Задан бюджет и уведомления в Billing

---

## Типовые проблемы

| Симптом | Причина | Решение |
|---|---|---|
| `403 Access Denied` | нет публичного чтения объектов | включить «Чтение объектов» или bucket policy |
| Браузер скачивает файл | не включён хостинг статического сайта | включить и указать `index.html` |
| Сайт без стилей | неверный `Content-Type` или не загружена папка `img` | проверить объекты и метаданные |
| `404` на внутренних путях | файлы загружены с лишней вложенной папкой | структура должна быть плоской: `index.html` в корне бакета |
| Старая версия после правок | кэш CDN/браузера | purge кэша + жёсткая перезагрузка |
