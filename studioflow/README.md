# 🩰 StudioFlow — Full Stack Dance School Management

## Architecture
```
studioflow/
├── backend/     Node.js + Express + MySQL REST API
├── web/         React web application
└── mobile/      React Native (Expo) iOS + Android app
```

## Quick Start

### 1. Backend (Deploy to Railway)
```bash
cd backend
cp .env.example .env        # Fill in your Railway MySQL credentials
npm install
npm run migrate             # Creates all DB tables
npm run seed                # Seeds 2 demo schools
npm start
```

**Demo Accounts after seed:**
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@studioflow.app | ChangeMe123! |
| School Admin (NYC) | priya@rhythmgrace.com | Admin123! |
| School Admin (LA) | marcus@urbangroove.com | Admin123! |
| Parent | meera@email.com | Parent123! |

### 2. Web App (Deploy to Netlify)
```bash
cd web
cp .env.example .env        # Set REACT_APP_API_URL to your Railway URL
npm install
npm run build               # Production build → /build folder
```
Upload the `/build` folder to Netlify (drag & drop or GitHub CI).

### 3. Mobile App (Expo)
```bash
cd mobile
cp .env.example .env        # Set EXPO_PUBLIC_API_URL
npm install
npx expo start              # Scan QR with Expo Go app on your phone
```

**To publish to App Store & Play Store:**
```bash
npx expo install expo-dev-client
npx eas build --platform all
npx eas submit
```

## API Endpoints

### Auth
- `POST /api/auth/login` — Login, returns JWT
- `GET  /api/auth/me` — Get current user

### Schools (Super Admin)
- `GET  /api/schools` — List all schools
- `POST /api/schools` — Create school + admin account

### Per-School Resources
All routes prefixed with `/api/schools/:schoolId/`

| Resource | Methods |
|----------|---------|
| students | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| batches  | GET, POST, GET/:id, PUT/:id, DELETE/:id, PUT/:id/enroll |
| schedules | GET, POST, PUT/:id, DELETE/:id |
| recitals | GET, POST, GET/:id, PUT/:id, DELETE/:id |
| recitals/:id/tasks | POST, PUT/:taskId/toggle, DELETE/:taskId |
| fees/plans | GET, POST |
| fees | GET, POST, PUT/:feeId/status |
| fees/summary | GET |
| users | GET, POST, PUT/:id |

### Parent Routes
- `GET /api/parent/students` — Their children
- `GET /api/parent/schedule` — School schedule
- `GET /api/parent/recitals` — Upcoming recitals

## User Roles
| Role | Access |
|------|--------|
| `superadmin` | All schools, create/manage schools |
| `school_admin` | Full access to their school |
| `teacher` | Read access + students/batches |
| `parent` | Read-only: schedule + recitals + their children |

## Deployment Checklist
- [ ] Create Railway project → Add MySQL plugin → Add Node service
- [ ] Set all env vars in Railway dashboard
- [ ] Run `npm run migrate` then `npm run seed` via Railway console
- [ ] Change `SUPERADMIN_PASSWORD` immediately after seeding
- [ ] Deploy web to Netlify, set `REACT_APP_API_URL`
- [ ] Set `EXPO_PUBLIC_API_URL` in mobile `.env`
- [ ] Run `npx eas build` for App Store submission
