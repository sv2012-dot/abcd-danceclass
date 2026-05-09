# ManchQ: CRA → Next.js Migration

## What's Done (Phase 1)

### 🎯 Critical Path Complete: Public Recital Page with OG Metadata

This solves the **WhatsApp/Facebook preview** problem immediately.

```
✅ Next.js 16.2.6 with TypeScript
✅ API client (Axios) configured
✅ Dynamic route: [schoolSlug]/[recitalSlug]
✅ generateMetadata() for OG tags (WhatsApp, Facebook, Twitter)
✅ Responsive UI with Tailwind CSS
✅ RSVP stats and event details display
```

### How `generateMetadata()` Works (The Magic)

When Facebook/WhatsApp crawls `manchq.com/flyingswan-to-delete/annual-day-showcase`:

1. **Next.js runs `generateMetadata()` on the SERVER** (not in browser)
2. Fetches recital data from backend: title, poster image, description
3. Returns proper `<meta>` tags in `<head>`:
   ```html
   <meta property="og:title" content="Annual Day Showcase — FlyingSwan" />
   <meta property="og:image" content="https://res.cloudinary.com/..." />
   <meta property="og:description" content="..." />
   ```
4. Bot sees full, rich preview ✅
5. Human user sees `Respond to Invitation` button ✅

### File Structure

```
web-next/
├── app/
│   ├── [schoolSlug]/
│   │   └── [recitalSlug]/
│   │       └── page.tsx          ← **The OG magic happens here**
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx                  ← (placeholder home page)
├── lib/
│   └── api/
│       ├── client.ts             ← Axios instance
│       └── index.ts              ← API endpoints
├── package.json                  ← Dependencies added
├── next.config.ts                ← Vercel config
├── tsconfig.json                 ← TypeScript config
└── .env.local                    ← Dev environment
```

## Phase 2: Migrate Remaining Pages (TODO)

Priority order:
1. `/login` + `/register` (auth flow)
2. `/` (dashboard landing)
3. Other authenticated pages (/schedule, /recitals, etc.)

## Phase 3: Testing & Deployment

1. `npm install` (in web-next/)
2. `npm run build` (test production build)
3. `npm run dev` (test locally)
4. Test with Facebook Sharing Debugger + LinkedIn Post Inspector
5. Deploy new Next.js build to Vercel

## Key Differences from CRA

| Feature | CRA | Next.js |
|---------|-----|---------|
| OG metadata | ❌ None (SPA limitation) | ✅ `generateMetadata()` |
| Routing | React Router (client) | File-based (native) |
| API calls in metadata | ❌ Not possible | ✅ Server-side `generateMetadata()` |
| Deployment | Static HTML→Vercel | Server rendering→Vercel |
| Auth context | ✅ Works | ✅ Works (as Client Component) |

## Environment Variables

**Development** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

**Production** (Vercel dashboard):
```
NEXT_PUBLIC_API_URL=https://abcd-danceclass-production.up.railway.app/api
```

---

**Status:** ✅ Ready to test Phase 1 locally
