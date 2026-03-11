# 🩰 StudioFlow — Dance School Management

A full-stack web application for managing dance studios: students, batches, schedules, recitals, and fees.

---

## Tech Stack

| Layer    | Technology                                  |
|----------|---------------------------------------------|
| Backend  | Node.js · Express · MySQL (mysql2)          |
| Auth     | JWT (jsonwebtoken) · bcryptjs               |
| Frontend | React (CRA) · React Router v6               |
| Data     | TanStack React Query · Axios                |
| Styling  | Inline CSS (CSS custom properties)          |
| Mobile   | React Native (Expo) — separate app          |

---

## Project Structure

```
studioflow/
├── backend/          # Express API server
│   ├── config/       # Database connection pool
│   ├── database/     # Schema + seed script
│   └── src/
│       ├── controllers/
│       ├── middleware/   # JWT auth
│       └── routes/
├── web/              # React frontend (CRA)
│   └── src/
│       ├── api/          # Axios client + resource helpers
│       ├── components/   # Shared UI components
│       ├── context/      # AuthContext
│       └── pages/        # Route-level page components
└── mobile/           # React Native (Expo) app
```

---

## Prerequisites

- **Node.js** v18+
- **MySQL** v8+ running locally (or a remote host)
- **npm** v9+

---

## Setup

### 1. Clone

```bash
git clone https://github.com/sv2012-dot/abcd-danceclass.git
cd abcd-danceclass/studioflow
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in your database credentials and a strong `JWT_SECRET`:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=studioflow
DB_USER=root
DB_PASS=your_password
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:3000
```

**Create & seed the database:**

```bash
node database/setup.js
```

This creates all tables and inserts demo data including users, students, batches, schedules, recitals, and fee records.

**Start the backend:**

```bash
npm run dev      # development (nodemon)
npm start        # production
```

Backend runs on `http://localhost:5000`.

---

### 3. Web App

```bash
cd ../web
npm install
cp .env.example .env   # already points to http://localhost:5000/api
npm start
```

App runs on `http://localhost:3000`.

---

## Demo Accounts

| Role          | Email                       | Password     |
|---------------|-----------------------------|--------------|
| Super Admin   | admin@studioflow.app        | ChangeMe123! |
| School Admin  | priya@rhythmgrace.com       | School123!   |
| School Admin  | marcus@urbangroove.com      | School123!   |
| Teacher       | teacher@rhythmgrace.com     | Teacher123!  |
| Parent        | parent@rhythmgrace.com      | Parent123!   |

> Passwords are set during `database/setup.js`. Change them in production.

---

## Features by Role

| Feature            | Super Admin | School Admin | Teacher | Parent |
|--------------------|:-----------:|:------------:|:-------:|:------:|
| Manage Schools     | ✅          |              |         |        |
| Manage Students    | ✅          | ✅           | ✅      |        |
| Manage Batches     | ✅          | ✅           | ✅      |        |
| View Schedule      | ✅          | ✅           | ✅      | ✅     |
| Manage Recitals    | ✅          | ✅           | ✅      |        |
| View Recitals      | ✅          | ✅           | ✅      | ✅     |
| Manage Fees        | ✅          | ✅           |         |        |
| Manage Users       | ✅          | ✅           |         |        |
| Parent Portal      |             |              |         | ✅     |

---

## API Overview

All endpoints are prefixed with `/api`.

| Resource   | Endpoints                                                              |
|------------|------------------------------------------------------------------------|
| Auth       | `POST /auth/login`                                                     |
| Students   | `GET/POST /students` · `PUT/DELETE /students/:id`                      |
| Batches    | `GET/POST /batches` · `GET/PUT/DELETE /batches/:id`                    |
|            | `POST /batches/:id/enroll`                                             |
| Schedules  | `GET/POST /schedules` · `PUT/DELETE /schedules/:id`                    |
| Recitals   | `GET/POST /recitals` · `GET/PUT/DELETE /recitals/:id`                  |
|            | `POST /recitals/:id/tasks` · `PATCH /recitals/:id/tasks/:taskId`       |
| Fees       | `GET/POST /fees` · `PUT/DELETE /fees/:id`                              |
| Users      | `GET/POST /users` · `PUT/DELETE /users/:id`                            |
| Schools    | `GET/POST /schools` · `PUT/DELETE /schools/:id`                        |
| Parent     | `GET /parent/dashboard`                                                |

All authenticated endpoints require an `Authorization: Bearer <token>` header.

---

## Mobile App

```bash
cd ../mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your backend
npx expo start
```

---

## Deployment Notes

- Set `NODE_ENV=production` and `CORS_ORIGINS` to your frontend domain in backend `.env`
- Web app: set `REACT_APP_API_URL` to your backend URL in web `.env`
- Use a reverse proxy (nginx / Caddy) or deploy backend to Railway / Render
- Deploy web to Netlify / Vercel — set env vars in the platform dashboard
