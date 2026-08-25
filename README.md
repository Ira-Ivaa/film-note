# Film Note

Блокнот для фильмов, сериалов, дорам и аниме: список желаемого, оценки просмотренного и
библиотеки друзей.

- **Фронт и бэк:** Next.js 16 (React 19) + TypeScript, один деплой на Vercel
- **База:** Neon — serverless Postgres, бесплатный тариф
- **Метаданные:** TMDB API (поиск по фильмам, сериалам, дорамам)
- **Постеры:** фото с устройства → Vercel Blob
- **Вход:** email + пароль, серверные сессии в httpOnly-куке

## Возможности

- Добавить фильм/сериал в список: «Хочу посмотреть», «Смотрю», «Отложено», «Просмотрено», «Брошено»
- Оценка 1–10, заметка, прогресс (`S2E5`), даты начала и окончания, избранное
- Поиск по TMDB; чего там нет — добавляется вручную с фотографией постера
- Друзья по логину: заявка → подтверждение → просмотр списка друга
- Настройка приватности: список видят только я / друзья / все

## Локальный запуск

```bash
npm install
cp .env.example .env.local   # заполнить DATABASE_URL, AUTH_SECRET, TMDB_ACCESS_TOKEN
npm run db:push              # создать таблицы
npm run dev                  # http://localhost:3000
```

Минимально нужны только `DATABASE_URL` и `AUTH_SECRET`. Без ключа TMDB приложение работает,
но поиск ищет лишь по уже добавленным названиям — новые придётся заводить вручную.

`AUTH_SECRET` сгенерировать:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

В разработке `STORAGE_DRIVER=local` — постеры складываются в `public/uploads/` (папка в
`.gitignore`).

## Что где лежит

| Путь | Что там |
| --- | --- |
| `src/db/schema.ts` | таблицы, енумы, типы — источник истины по данным |
| `src/lib/` | доступ к данным, аутентификация, TMDB, загрузка файлов, валидация |
| `src/app/api/` | REST-эндпоинты |
| `src/app/(auth)/`, `src/app/(app)/` | страницы: вход и авторизованная часть |
| `src/components/` | React-компоненты |
| `CLAUDE.md` | контракт проекта для ИИ-агентов |

## Деплой (всё бесплатно)

1. **Neon** → новый проект → строка подключения **Pooled** → `DATABASE_URL`.
2. Применить схему: `npm run db:generate && npm run db:migrate`.
3. **TMDB** → Settings → API → «API Read Access Token» (v4) → `TMDB_ACCESS_TOKEN`.
4. **Vercel** → Import Git Repository, Next.js определится сам.
5. Vercel → Storage → **Blob** → создать store и подключить к проекту (токен подставится
   автоматически), затем задать `STORAGE_DRIVER=vercel-blob`.
6. Добавить `AUTH_SECRET` в Environment Variables.
7. Deploy.

Лимиты, о которых стоит знать: Neon засыпает при простое (первый запрос после паузы
медленный), у Vercel Blob на бесплатном тарифе 1 ГБ хранилища, у TMDB — рейт-лимит на
запросы (метаданные кешируются на сутки).

Если Vercel не подходит: Cloudflare Workers (`@opennextjs/cloudflare`), Netlify, Render.
Вместо Neon: Supabase, Xata, Aiven. Вместо Vercel Blob: Cloudflare R2, Supabase Storage,
Cloudinary.

## Проверки

```bash
npm run typecheck
npm run build
```
