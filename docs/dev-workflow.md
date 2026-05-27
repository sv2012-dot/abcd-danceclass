# Dev workflow

Practical notes on how to make + test + ship changes to ManchQ without
breaking prod.

The TL;DR: **never push straight to `master` again.** Use a feature
branch, get the auto-generated Vercel preview URL, click through the
[critical flows](#critical-flows-smoke-test), then merge to `master`.

---

## Stack at a glance

| Layer    | Where             | Notes                                    |
|----------|-------------------|------------------------------------------|
| Frontend | Vercel (Pro)      | Next.js 16 in `web-next/`. Auto-deploys on push to `master`. |
| Backend  | Railway           | Express + `mysql2`. In `studioflow/backend/`. |
| Database | Railway MySQL     | Seed in `studioflow/backend/database/setup.js` (local dev only). |
| Domain   | (your domain)     | DNS routed to Vercel.                     |

---

## Branch-based workflow (do this every time)

```bash
# 1. start clean from master
git checkout master
git pull

# 2. branch off
git checkout -b feat/<short-name>      # or fix/<short-name> or chore/<short-name>

# 3. make changes, sanity-check locally
cd web-next
npx tsc --noEmit                       # type check
npx next build                         # production build check (catches more than dev)
npm run dev                            # browse locally if backend is reachable

# 4. push the branch
git push -u origin feat/<short-name>
```

Vercel automatically deploys this branch to a preview URL like:

```
https://manchq-git-feat-<short-name>-<team>.vercel.app
```

The URL is also commented on the PR if you open one. **Click through
[the critical flows below](#critical-flows-smoke-test) on that preview
URL before merging.**

When the preview looks good:

```bash
# 5. merge + push to master → prod deploy
git checkout master
git pull                               # in case something else landed
git merge feat/<short-name>
git push                               # Vercel auto-deploys to prod

# 6. cleanup
git branch -d feat/<short-name>
git push origin --delete feat/<short-name>   # optional
```

---

## Critical flows smoke test

After every preview deploy, run through this checklist in ~2 minutes
before merging to `master`. If any of these break, the change isn't ready.

### As an authenticated school admin:

- [ ] `/home` loads — greeting + featured recital + stats tiles + Upcoming Classes + To-Dos all render
- [ ] `/home` — click **Create Event** in the FAB or sidebar — modal opens, every field accepts input, "Create Event" button enabled when required fields filled
- [ ] `/home` — click an existing event tile — Edit Event modal opens prefilled, "Save Changes" works
- [ ] `/schedule` — calendar renders, today highlighted, can switch month/week/list
- [ ] `/schedule` — click **+ Add Event** — form panel opens without error overlay
- [ ] `/schedule` — click an existing event — detail panel opens
- [ ] `/recitals` — list loads, click a recital — detail panel opens with hero + tabs + meta cells
- [ ] `/batches` — list loads, click a batch — detail panel opens with schedule + students + attendance
- [ ] `/team` — list loads
- [ ] Open AppShell's **Smart Add** — modal opens, type a prompt → click **Create Events** → preview rows render with the V3 collapsed layout
- [ ] Click a Smart Add row to expand — Time / Duration buttons + popovers work

### As an unauthenticated visitor:

- [ ] Public recital page (incognito) loads — RSVP form visible
- [ ] `/login` renders + magic-link form works (don't actually log in unless you need to)

### Cross-cutting:

- [ ] DevTools console — no red errors on any of the above
- [ ] DevTools network tab — no 500s or repeated 401s

---

## Pre-deploy sanity checks (local)

Before pushing a branch, run these from `web-next/`:

```bash
npx tsc --noEmit         # type check
npx next build           # production build — catches more than dev
```

`tsc --noEmit` passing is necessary but **not sufficient** — it doesn't
render any pages. `next build` catches more (server-component issues,
static-generation failures), but still doesn't exercise interactive
flows.

The two layers above (`tsc`, `next build`) catch maybe 60% of bugs
before they reach the preview URL. The preview URL smoke test catches
the rest — interactive bugs, runtime errors in panels and modals, auth
edge cases.

---

## Vercel project settings (Pro tier)

One-time settings to verify in the Vercel dashboard:

| Setting                    | Where                                | Value                                 |
|----------------------------|--------------------------------------|---------------------------------------|
| Production branch          | Settings → Git                        | `master`                              |
| Preview deployments        | Settings → Git                        | Enabled for all branches              |
| Deployment Protection      | Settings → Deployment Protection      | Standard Protection on **Preview** (Vercel auth or password); **Disabled** on Production |
| Function region            | Settings → Functions → Region         | Match the Railway DB region           |
| Speed Insights             | Speed Insights tab                    | Enabled                               |
| Web Analytics              | Analytics tab                         | Enabled                               |

---

## Environment variables

Set per-environment in **Vercel → Settings → Environment Variables**.
The same variable name can hold different values for Production, Preview,
and Development:

| Variable                     | Production                         | Preview                            | Development (local) |
|------------------------------|------------------------------------|------------------------------------|---------------------|
| `NEXT_PUBLIC_API_URL`        | `https://<prod>.railway.app/api`   | `https://<staging>.railway.app/api` (if staging exists; otherwise same as prod) | `http://localhost:5000/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | (prod OAuth client)              | (preview OAuth client or same as prod) | (same as prod, or local override) |

Notes:

- **No trailing newlines** in env values — they silently break OAuth.
- Without a staging backend, Preview env hits the **prod Railway DB**.
  That's fine for read-only / form-rendering tests; **avoid create /
  delete tests on preview** until staging exists.

---

## Optional next steps (in priority order)

### Staging Railway DB (~1 hour, no prod risk for previews)

1. In Railway, **Create new service → MySQL** in the same project (or a separate one).
2. Copy the production schema. Either:
   - Run `studioflow/backend/database/setup.js` against the staging DB (destructive: wipes + seeds), or
   - `mysqldump` from prod schema-only and load into staging.
3. Create a second Railway **backend** service that runs the same Express code but with the staging DB env vars.
4. Update Vercel's **Preview** environment to point `NEXT_PUBLIC_API_URL` at the staging backend.

After this, preview deploys are fully isolated from prod data.

### Playwright smoke tests (~1 day setup, catches regressions forever)

Wire up Playwright + GitHub Actions to run the [critical flows](#critical-flows-smoke-test)
automatically on every push. Yesterday's "schedule Create Event crash"
would have been caught in 30 seconds by a single Playwright test that
clicks **+ Add Event** on `/schedule`.

Starter test stub:

```ts
// tests/e2e/critical-flows.spec.ts
import { test, expect } from '@playwright/test';

test('Create Event on schedule does not crash', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/schedule');
  await page.click('button:has-text("Add Event")');
  // assert form rendered without error overlay
  await expect(page.locator('text=Event Type')).toBeVisible();
});
```

Run on every PR via GitHub Actions; block merges if any test fails.

### Docker stack (~2 hours, fully isolated local dev)

`docker-compose.yml` that brings up MySQL + backend + frontend with
seed data in one command. Useful if you ever want to test something
risky (schema migration, bulk delete logic) without touching any
network resource.

---

## What to do when prod breaks

If a deploy breaks prod and you need to revert immediately:

```bash
# Find the last-known-good commit
git log --oneline -10

# Option 1 — revert via Vercel UI (fastest, no code change)
# Vercel dashboard → Deployments → find the last good deployment →
# "..." → "Promote to Production"

# Option 2 — git revert (cleaner history)
git revert <bad-sha>
git push
```

Option 1 promotes an existing build — no rebuild, prod is back in ~10
seconds. Use this when you need to recover *now*.

---

*Last updated: 2026-05-26*
