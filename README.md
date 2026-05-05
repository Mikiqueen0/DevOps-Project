# Daily PnL Dashboard (DevOps Project)

Dark minimal web app for tracking **daily PnL** with secure authentication and rich visual analytics.

## Stack

- Next.js + React + Tailwind CSS
- Prisma + SQLite
- Containerization: Docker (`Dockerfile` + `.dockerignore`)
- Auth: Register/Login with bcrypt password hashing + httpOnly JWT cookie
- Visualization:
  - Chart.js via `react-chartjs-2`
  - Custom month/year heatmap grid with tooltips
- CI: GitHub Actions
- CD: Render.com

## Core Features

- Secure register/login/logout flow
- Daily PnL upsert (one entry per day)
- Day / Month / Year PnL summary filters
- Clickable calendar heatmap with tooltip
- Multiple visualizations:
  - Cumulative PnL trend (line chart)
  - Monthly PnL comparison (bar chart)
  - Win/Loss/Flat day distribution (doughnut)

## Security Notes

- Passwords are hashed with `bcrypt` before DB storage
- Session token is stored as `httpOnly` cookie
- Input validation uses `zod` on auth and PnL APIs
- Prisma ORM prevents raw string SQL concatenation patterns
- Basic API rate limiting is applied to auth endpoints

## Local Setup

1. Install dependencies
2. Configure env file
3. Run migration
4. Seed sample data (optional)
5. Start app

```bash
npm install
```

Create `.env` from `.env.example`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-long-secret"
```

Then:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Demo seed credentials:

- Username: `demo`
- Password: `DemoPass123!`

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### PnL

- `GET /api/pnl`
- `POST /api/pnl` (upsert by date)
- `DELETE /api/pnl/:id`

## Database Model

- `User`
  - `username` (unique)
  - `passwordHash`
- `PnlEntry`
  - `userId` (FK -> User)
  - `date`
  - `amount`
  - unique constraint: `(userId, date)`

## CI Pipeline

File: `.github/workflows/ci.yml`

- Install dependencies
- Generate Prisma Client
- Run migrations on SQLite file (`file:./ci.db`)
- Lint
- Build

## Render Deployment

1. Create a new Web Service on Render and connect this repository.
2. Set runtime/language to Docker (or deploy via Blueprint using `render.yaml`).
3. Render will build from `Dockerfile` in the repo root.
4. Set Render environment variables:
   - `JWT_SECRET` = long random secret
5. Deploy.

`DATABASE_URL` is already set in `render.yaml` as `file:./dev.db`.

This repo includes:

- `Dockerfile` for containerized deploy
- `.dockerignore` for lean image builds
- `build.sh` as a course-style build helper script

Important note for SQLite on Render free plan:

- SQLite file lives inside container filesystem and may reset after redeploy/restart.

Optional CI-triggered deploy hook:

- This repo includes `.github/workflows/cd-render.yml`
- Add `RENDER_DEPLOY_HOOK_URL` in GitHub repository secrets
