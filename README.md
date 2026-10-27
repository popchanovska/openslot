# TeamLift Office Hours

Instructor publishes time slots, clients book them with name and email. No double bookings.

## Project structure

```
teamlift-office-hours/
├─ apps/
│  ├─ api/                 Backend (NestJS)
│  │  ├─ drizzle/          Database migrations
│  │  └─ src/
│  │     ├─ db/            Tables, migrate, seed
│  │     ├─ slots/         Slots API
│  │     ├─ bookings/      Bookings API
│  │     ├─ admin/         Instructor API
│  │     ├─ calendar/      Google Calendar
│  │     └─ ai/            Gemini
│  └─ web/                 Frontend (React)
│     └─ src/
│        ├─ pages/         Book a session, Instructor
│        ├─ components/    UI
│        └─ api/           Calls to the backend
├─ packages/shared/        Types and validation used by both
├─ docker-compose.yml      Local PostgreSQL
└─ render.yaml             Hosting on Render
```

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| AI | Gemini API (Google AI Studio, free tier) |
| Calendar | Google Calendar API (OAuth, read-only) |
| Hosting | Render (app + database) |

## Run it

Needs Node 20+ and Docker Desktop.

```bash
npm install --include=dev
docker compose up -d
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173 and http://localhost:5173/instructor

Optional: add `GEMINI_API_KEY` and the `GOOGLE_*` keys to `apps/api/.env`, then restart.

## What to improve

1. Login for the instructor page
2. Confirmation emails with a cancel link
3. Add bookings to Google Calendar
4. Automated tests
5. Paid hosting (no sleeping, no database expiry)
