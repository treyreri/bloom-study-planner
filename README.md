# 🌷 Bloom — a cute study planner

Diploma project for the course *Python Base · SQL Database · Django MVT · Django REST Framework*.
The full specification is in [`TZ Bloom Planner.md`](TZ%20Bloom%20Planner.md).

Bloom is a web planner for students: a monthly plan with a calendar, to-do tasks with pixel-heart
checkboxes, subjects / deadlines / timetable, a habit tracker, a Pomodoro timer with statistics and a
weekly reflection diary. **The main feature is the garden:** every finished task waters the flower of
the month (🌱 → 🌿 → 🌷 → 💐) and finished months are kept as bouquets in "My garden".

![Today dashboard](docs/screenshots/today.png)

| Month | Tasks | Habits |
|---|---|---|
| ![Month](docs/screenshots/month.png) | ![Tasks](docs/screenshots/tasks.png) | ![Habits](docs/screenshots/habits.png) |
| **Focus** | **Diary** | **Garden** |
| ![Focus](docs/screenshots/focus.png) | ![Diary](docs/screenshots/diary.png) | ![Garden](docs/screenshots/garden.png) |

---

## Architecture

```
            ┌──────────────────────┐   :80 (the only published port)
 Browser ──▶│    nginx-frontend    │── /, /today/, /month/ … ──▶ React build (index.html, /assets/)
            │ (frontend/Dockerfile)│
            └──────────┬───────────┘
                       │ /api/  /admin/  /static/  /media/
                       ▼
            ┌──────────────────────┐
            │    nginx-backend     │── /static/ (admin, Swagger)  /media/ (avatars) from volumes
            │ (nginx/backend.conf) │
            └──────────┬───────────┘
                       │ /api/  /admin/
                       ▼
            ┌──────────────────────┐        ┌──────────────┐
            │ gunicorn + Django/DRF│───────▶│ PostgreSQL 16│
            │     (Dockerfile)     │        └──────────────┘
            └──────────────────────┘
```

- **Frontend** — React (Vite, JSX) in `frontend/`: a page per route, talks to the API with `fetch`.
- **Backend** — Django + DRF: only `/api/v1/…`, the API docs (`/api/docs/`) and `/admin/`.

## Features

| Module | What it does |
|---|---|
| Accounts | Registration, login, logout; profile with name, avatar, accent colour (pink / lavender / peach) and semester goal |
| Month plan | Title, main goal, up to 3 focus goals; calendar with a heart per task; click a day to see/add its tasks; progress shown as a growing vine |
| Tasks | Title, description, date, priority 🌸/🌷/🌹, optional subject; heart checkbox with a "pulse" animation, ✕ to delete, click to edit, "→" moves to tomorrow; filters today / week / overdue / subject / priority, search, sorting, "show more" pagination; confetti when all tasks of the day are done |
| Study | Subjects (colour, teacher, room), deadlines (exam / test / coursework / homework) with countdown "До экзамена по SQL осталось 12 дней 🌷", Mon–Sat timetable |
| Habits | Month grid of heart checkboxes, streak "🔥 7 дней подряд!", archive and delete |
| Focus | Pomodoro 25/5 (configurable), linked to a subject, sessions saved to the database, doughnut chart of time per subject (week / month), demo mode of 10 seconds |
| Diary | Weekly reflection: mood (5 emoji), "proud of", "didn't work", "carry over"; diary-style feed |
| Garden | Flower stage of every month; finished months are locked as bouquets |
| Today | Greeting + quote of the day, today's tasks, nearest deadline, today's habits, month flower, "Start pomodoro" |
| Admin | Django Admin for users, profiles, all records and the quote list |

## Technologies

- Backend: Python 3.13, **Django 6.1**, Django REST Framework 3.18, `djangorestframework-simplejwt`
  (JWT + refresh-token blacklist), `django-filter`, `drf-spectacular` + `drf-spectacular-sidecar`,
  `python-decouple` (`.env`), `Pillow`, gunicorn, PostgreSQL (SQLite in development)
- Frontend: React 19, React Router 7, Vite 6, `chart.js` 4.4.4 + `react-chartjs-2`, ESLint; plain CSS
  (`frontend/src/css/bloom.css`), Google Fonts Patrick Hand / Neucha / Quicksand with system fallbacks
- Deployment: Docker Compose, two nginx servers

## Project structure

```
DRF PROJECT/
├── config/                 # settings (base / dev / prod), urls, wsgi
├── accounts/               # Profile, registration, JWT auth, website login/register forms
├── planner/                # MonthPlan, Task, Quote, garden rules (services.py), filters,
│   ├── management/commands/    close_months.py, seed_demo.py
│   └── fixtures/demo.json
├── study/                  # Subject, Deadline, ScheduleSlot
├── habits/                 # Habit, HabitCheck, streak (services.py)
├── focus/                  # PomodoroSession, statistics
├── diary/                  # WeeklyReflection
├── api/                    # router, IsOwner permission, dashboard and server-date views
├── frontend/               # React app (Vite)
│   ├── src/api/client.js       # fetch wrapper: /api/v1, JWT header, refresh on 401
│   ├── src/auth.jsx            # current user (profile), protected routes
│   ├── src/components/         # layout, task row + edit dialog, heart checkbox, flower…
│   ├── src/pages/              # Home, Login, Register, Today, Month, Tasks, Study,
│   │                           # Habits, Focus, Diary, Garden, Profile
│   ├── src/css/bloom.css       # design system
│   ├── src/img/hearts/         # pixel heart stickers
│   └── Dockerfile              # npm ci && npm run build → nginx
├── nginx/                  # frontend.conf, backend.conf, proxy_django.inc
├── Dockerfile              # backend image (gunicorn)
├── docker-compose.yml      # db, backend, nginx-backend, nginx-frontend
├── requirements.txt        # Python packages (+ requirements-prod.txt: gunicorn, psycopg)
└── docs/screenshots/
```

---

## Running with Docker (two nginx servers)

```powershell
copy .env.example .env          # then put a long random value after SECRET_KEY=
docker compose up --build -d    # builds and starts db, backend, nginx-backend, nginx-frontend
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py loaddata demo.json   # optional demo data
```

Open **http://localhost** (or set `HTTP_PORT` in `.env` if port 80 is taken):

| URL | What |
|---|---|
| http://localhost/ | The website (React) |
| http://localhost/api/docs/ | Swagger UI |
| http://localhost/api/schema/ | OpenAPI schema |
| http://localhost/admin/ | Django Admin |

`docker compose down` stops everything; the database, static files and avatars stay in Docker volumes
(`docker compose down -v` deletes them too).

## Local development (Windows, PowerShell in VS Code)

Two terminals: Django on :8000 and the Vite dev server on :5173 (Vite forwards `/api`, `/admin`,
`/static` and `/media` to Django, so the browser only talks to :5173).

```powershell
# terminal 1 — backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
copy .env.example .env                # set SECRET_KEY
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo            # demo user "demo" / "bloom-demo-2026", dates around today
python manage.py runserver

# terminal 2 — frontend
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

Demo data: `python manage.py seed_demo` creates it with dates around today (recommended for a
presentation); `python manage.py loaddata demo.json` loads the same data with fixed dates
(November 2026). Both use the user **demo** / **bloom-demo-2026**.

### Environment variables (`.env`)

| Variable | Used by | Meaning |
|---|---|---|
| `SECRET_KEY` | all | Django secret key (required by Docker and production) |
| `DEBUG` | dev | `True` / `False` |
| `TIME_ZONE` | all | Default `Europe/Moscow`; "today", streaks and `done_at` depend on it |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Docker / prod | PostgreSQL (Docker defaults: `bloom`) |
| `DB_HOST`, `DB_PORT` | prod without Docker | PostgreSQL address |
| `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | Docker / prod | Comma-separated host names / origins |
| `SECURE_SSL_REDIRECT`, `SECURE_COOKIES` | Docker / prod | `False` for local http, `True` behind HTTPS |
| `HTTP_PORT` | Docker | Published port of nginx-frontend (default 80) |
| `EMAIL_*`, `SECURE_HSTS_SECONDS` | prod | SMTP settings, HSTS |

---

## REST API

Base prefix: **`/api/v1/`**. Everything except registration and token endpoints requires
authentication. Every list is limited to the current user's own records; another user's object
returns **404** (it is filtered out of `get_queryset()`, and `IsOwner` checks objects again).

### Authentication

| Method | URL | Description |
|---|---|---|
| POST | `/auth/register/` | Register (`username`, `email`, `password`, `password2`) |
| POST | `/auth/token/` | Get JWT `access` + `refresh` (alias: `/auth/login/`) |
| POST | `/auth/token/refresh/` | New access token (alias: `/auth/refresh/`); refresh tokens rotate |
| POST | `/auth/logout/` | Blacklist a refresh token (`{"refresh": "…"}`) |
| POST | `/auth/form-login/`, `/auth/form-register/` | Used by the website: the same Django forms (and messages) as before, answer with a JWT pair |
| GET/PATCH | `/profile/` | Own profile, JSON or multipart (avatar) (alias: `/auth/profile/`) |
| GET | `/server-date/` | Today's date in the server time zone |

In Swagger: call `POST /api/v1/auth/token/`, press **Authorize** and paste the `access` value.

### Planner

| Method | URL | Description |
|---|---|---|
| GET/POST | `/months/` | Month plans (filters `year`, `month`); each has `progress` and `is_finished` |
| GET/PATCH/DELETE | `/months/{id}/` | One month (`year`/`month` cannot be changed) |
| GET | `/months/{id}/calendar/` | Tasks per day: `[{date, total, done}]` |
| GET | `/months/{id}/garden/` | `{total, done, percent, stage, emoji, is_final}` |
| GET/POST | `/tasks/` | Filters `date`, `date_from`, `date_to`, `overdue`, `subject`, `priority`, `is_done`, `month_plan`; `search` (title); `ordering` = `date`, `priority`, `created_at`; 20 per page |
| GET/PATCH/PUT/DELETE | `/tasks/{id}/` | One task |
| POST | `/tasks/{id}/toggle/` | Mark done / not done (sets / clears `done_at`) |
| POST | `/tasks/{id}/move-tomorrow/` | Move an unfinished task to the next day |
| GET | `/tasks/today/` | Today's tasks |
| GET | `/quotes/` | Quote list (read-only; edited in the admin) |

### Study, habits, focus, diary, dashboard

| Method | URL | Description |
|---|---|---|
| CRUD | `/subjects/` | Subjects |
| CRUD | `/deadlines/` | Deadlines, sorted by date, with `days_left` |
| GET | `/deadlines/upcoming/` | Next 3 deadlines with days left |
| CRUD | `/schedule/` | Timetable slots (weekday 0–5 = Mon–Sat) |
| CRUD | `/habits/` | Habits (with `checked_today`) |
| POST | `/habits/{id}/check/` | Check a day (`{"date": …}`, default today); calling again removes the check |
| GET | `/habits/{id}/streak/` | Current streak |
| GET | `/habits/grid/?year=&month=` | All habits with checked days of a month (for the tracker grid) |
| GET/POST/DELETE | `/habit-checks/` | Individual checks (filters `habit`, `date_from`, `date_to`) |
| GET/POST | `/pomodoro/` | Pomodoro sessions (`subject`, `duration_min`, optional `started_at`) |
| GET | `/pomodoro/stats/?period=week` | Minutes per subject and per day (`week` or `month`), computed with `Sum` / `TruncDate` |
| CRUD | `/reflections/` | Weekly reflections |
| GET | `/dashboard/` | Everything for the Today page in one request |

---

## Tests and checks

```powershell
python manage.py test                                   # 93 tests
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py spectacular --validate --fail-on-warn --file "$env:TEMP\bloom-openapi.yml"
cd frontend; npm run lint; npm run build
```

The tests cover the specification's required cases (another user's tasks are invisible, `toggle`
changes `is_done` and `done_at`, flower stage at 24/25/49/50/79/80 %, streak with a skipped day,
no duplicate month) plus registration, JWT refresh/logout blacklisting, the website login/register
forms, IDOR on every resource, serializer validation, duplicate habit checks and reflections,
dashboard numbers, Pomodoro statistics and demo data.

---

## Decisions where the specification was open

| Topic | Decision |
|---|---|
| Django version | The project was started with Django 6.1 (spec says 5.x); it was kept to avoid a downgrade of a working environment. |
| Frontend | React (Vite + JSX) as required by the teacher; it is a 1:1 port of the earlier Django-template pages (same markup, CSS and texts). |
| Website authentication | JWT from `/api/v1/auth/`: the access and refresh tokens are kept in `localStorage`, the access token is renewed automatically on a 401, logout blacklists the refresh token. Trade-off: any XSS bug could read `localStorage`, so the app never puts API data into the page as HTML (React escapes all text). |
| `month_plan` of a task | Optional in the API: if omitted, the plan of the task's month is used (created automatically). A task date must lie inside its plan's month; changing the date moves the task to that month's plan. |
| Move to tomorrow | New date = max(task date, today) + 1 day, so overdue tasks go to tomorrow. Finished tasks are not moved. |
| Flower stage | `percent = done / total × 100`; < 25 seedling, < 50 stem, < 80 bud, otherwise bouquet; no tasks = 0 %. |
| End of month | `final_stage` is saved the first time the month list is requested after the month ended (and by `python manage.py close_months`, which can be scheduled). After that the bouquet no longer changes. |
| Streak | Days in a row ending today; if today is not checked yet, the streak ending yesterday still counts. |
| Week | Calendar week Monday–Sunday (Pomodoro statistics, reflections). A reflection's `week_start` must be a Monday. |
| Pomodoro demo mode | 10-second timer for the presentation; saved as a 1-minute session (the model stores whole minutes). Durations 1–180 min. |
| Priority sorting | Priorities are stored as `low/mid/high`; sorting uses a numeric rank (Case/When) so it is not alphabetical. |
| Quote of the day | Same quote all day: `quotes[day_number % count]`; a built-in quote is shown if the list is empty. |
| Admin reference data | Only `Quote` is a reference model (the spec's model list has no icon/flower models). |
| Language and fonts | Interface in Russian; headings use the spec's English titles ("To-do List 🌷", "My Month 🗓️", "Habits ✨"). Patrick Hand has no Cyrillic, so Neucha (Cyrillic handwriting) is the fallback; Quicksand for numbers. |
| Mobile menu | 5 icons: Today, Month, Tasks, Focus and "Ещё" (Study, Habits, Diary, Garden, Profile, Logout). |
| Pagination | Default page size 20 for all lists (the frontend follows `next` links where it needs everything). |

## Deployment notes

`docker compose up --build` runs the full production stack locally. On a real server:
put HTTPS in front of nginx-frontend (or terminate TLS in it), set `SECURE_SSL_REDIRECT=True`,
`SECURE_COOKIES=True`, a strong `SECRET_KEY` and `DB_PASSWORD`, the real `ALLOWED_HOSTS` /
`CSRF_TRUSTED_ORIGINS`, and optionally schedule `python manage.py close_months` daily.
Uploaded avatars live in the `media_files` volume — back it up together with `postgres_data`.
