# Authentication Architecture Diagnostic Report

## SYSTEM ARCHITECTURE

### Component Structure
```
layout.tsx (Server Component)
├── GoogleOAuthProvider
└── AuthProvider (Client Component)
    └── {children}
        ├── page.tsx (Home - Client Component)
        ├── login/page.tsx (Client Component)
        ├── register/page.tsx (Client Component)
        └── [schoolSlug]/[recitalSlug]/page.tsx (Mixed Server/Client)
```

### Authentication Flow

#### 1. **Layout Initialization** (layout.tsx)
- Wraps app with `GoogleOAuthProvider` and `AuthProvider`
- AuthProvider is a Client Component marked with `'use client'`

#### 2. **AuthProvider Initialization** (AuthContext.tsx)
```javascript
useEffect(() => {
  if (typeof window === 'undefined') {
    setLoading(false);
    return;
  }

  const token = sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token');

  if (token) {
    // Verify token with backend
    auth.me()
      .then((data) => {
        setUser(data.user);
        localStorage.setItem('sf_user', JSON.stringify(data.user));
        persistSchool(data.school);
      })
      .catch(() => {
        // Token is invalid or expired, clear everything
        sessionStorage.removeItem('sf_token');
        localStorage.removeItem('sf_token');
        localStorage.removeItem('sf_user');
        localStorage.removeItem('sf_school');
        setUser(null);
        persistSchool(null);
      })
      .finally(() => {
        setLoading(false);
      });
  } else {
    // No token, so user is not authenticated
    setLoading(false);
  }
}, []);
```

#### 3. **Page Redirect Logic** (page.tsx)
```javascript
useEffect(() => {
  if (!loading && !user && !redirected) {
    setRedirected(true);
    window.location.href = '/login';
  }
}, [loading, user, redirected]);
```

#### 4. **Login Page Protection** (login/page.tsx)
```javascript
useEffect(() => {
  if (user && !authLoading) {
    router.push('/');
  }
}, [user, authLoading, router]);
```

---

## IDENTIFIED ISSUES & ROOT CAUSES

### Issue 1: Race Condition Between Server and Client
**Problem**: The layout.tsx is a Server Component that wraps the AuthProvider (Client Component).
- Server components execute before client components hydrate
- This means the layout renders server-side, but AuthProvider doesn't initialize until client-side
- On initial page load, the app shell renders with `loading: true` state
- The frontend code relies on client-side context initialization

**Impact**: Initial page load always shows "Redirecting to login..." briefly before auth check completes

---

### Issue 2: AuthContext Always Starts with loading=true
**Current State**:
```javascript
const [user, setUser] = useState<User | null>(null);
const [school, setSchoolState] = useState<School | null>(null);
const [loading, setLoading] = useState(true);  // <-- Always true initially
```

**Flow**:
1. Component renders with `loading: true, user: null`
2. page.tsx sees: `!loading (false) && !user (true) && !redirected (false)` = **false**
3. Doesn't redirect yet
4. After auth check completes: `loading: false`
5. page.tsx sees: `!loading (true) && !user (true) && !redirected (false)` = **true**
6. Now redirects to /login

**Expected behavior**: Should work correctly IF auth.me() completes successfully

---

### Issue 3: API Client Interceptor Has Server/Client Problem
**In lib/api/client.ts**:
```javascript
if (typeof window !== 'undefined') {
  api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    res => res.data,
    err => {
      if (err.response?.status === 401) {
        sessionStorage.removeItem('sf_token');
        localStorage.removeItem('sf_token');
        localStorage.removeItem('sf_user');
        window.location.href = '/login';  // <-- Forces a full page reload!
      }
      return Promise.reject(err.response?.data || err);
    }
  );
}
```

**Problem**: The response interceptor calls `window.location.href = '/login'` which:
- Causes a full page reload
- Bypasses React's routing
- Could cause infinite redirects if auth.me() immediately fails on the new page load
- Not handling the error properly for the AuthContext initialization flow

---

## ACTUAL BEHAVIOR WHEN ACCESSING http://localhost:3000

### Scenario A: No Token Stored (Fresh User)
1. Browser requests GET /
2. Next.js Server renders layout.tsx (server-side)
3. Next.js sends HTML with AuthProvider (client component marker)
4. Browser hydrates and runs AuthContext useEffect
5. No token found → Sets loading: false, user: null
6. page.tsx effect runs → Sees !loading && !user → Sets redirected: true
7. page.tsx calls window.location.href = '/login'
8. Browser navigates to /login (full page reload)
9. Login page renders with form
**Result**: ✓ Correct - User sees login page

### Scenario B: Valid Token Stored (User was logged in)
1. Browser requests GET /
2. AuthContext useEffect runs on client
3. Finds token in localStorage
4. Calls auth.me() with token
5. API client adds Authorization header
6. Backend returns 200 with user data
7. AuthContext sets user state → loading: false
8. page.tsx effect runs → Sees loading: false && user: exists → Condition is false
9. page.tsx doesn't redirect
10. User sees home page with "Redirecting to login..." message
**Result**: ✗ WRONG - Shows loading message instead of home content

---

## ROOT CAUSE

### The Real Problem
The home page (page.tsx) is **NOT A PROTECTED ROUTE** - it's just a client component that:
1. Checks if user is logged in
2. If not, redirects to /login
3. If yes, shows the "Redirecting to login..." message and does NOTHING ELSE

**Missing**: The home page should actually show content when user IS logged in!

### Current page.tsx Implementation
```javascript
export default function Home() {
  const { user, loading } = useAuth();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (!loading && !user && !redirected) {
      setRedirected(true);
      window.location.href = '/login';
    }
  }, [loading, user, redirected]);

  return (
    <div>
      <p>Redirecting to login...</p>
    </div>
  );
}
```

**Problem**: This page only has 2 states:
- Loading state: Shows "Redirecting to login..."
- Authenticated state: Shows "Redirecting to login..." (blank page!)

**It never shows dashboard content!**

---

## Backend API Status

### ✓ Working Endpoints
- `POST /api/auth/login` - Returns token + user
- `GET /api/auth/me` - Returns authenticated user (requires Bearer token)
- `POST /api/auth/google` - Google OAuth login
- Token validation works correctly
- 401 responses work for invalid tokens

### Token Behavior
- Tokens are 7 days expiry by default
- Backend properly validates and returns 401 for invalid tokens

---

## ARCHITECTURAL PROBLEMS

### Problem 1: Client-Side Only Authentication
- No Next.js middleware to protect routes
- All auth logic is in React context (client-side)
- Page routing depends entirely on client-side state checks
- No server-side verification of authentication state

### Problem 2: Dual Rendering Issue
- layout.tsx is a Server Component
- AuthProvider is a Client Component wrapping Server/Client children
- Creates hydration and timing issues
- Initial server render doesn't have auth context

### Problem 3: Missing Dashboard/Home Content
- page.tsx doesn't have actual dashboard content
- Only has redirect logic
- User who IS authenticated still sees blank page with message

### Problem 4: Inconsistent Redirect Mechanisms
- page.tsx uses `window.location.href` (full reload)
- login.tsx uses `router.push()` (React routing)
- API interceptor uses `window.location.href` (full reload)
- No consistent pattern

### Problem 5: No Page Protection
- All pages are Client Components with `'use client'`
- No middleware.ts file for route-level protection
- No server-side session verification
- Protection only happens after client hydrates and auth context initializes

---

## EXPECTED vs ACTUAL BEHAVIOR

### Expected Behavior (What Should Happen)
```
1. User visits http://localhost:3000
2. System checks authentication (either server or early client-side)
3. If authenticated: Show dashboard/home content
4. If not authenticated: Show login page
```

### Actual Behavior (What Happens Now)
```
1. User visits http://localhost:3000
2. Server renders layout + page.tsx (with loading message)
3. Client hydrates AuthProvider
4. Client checks for token and calls auth.me()
5a. If authenticated:
    → Sets user state
    → page.tsx sees user exists
    → page.tsx still shows "Redirecting to login..." message
    → User sees blank page ✗

5b. If not authenticated:
    → Sets user: null
    → page.tsx sees !user && !loading
    → page.tsx redirects to /login (full page reload)
    → User sees login page ✓
```

---

## RECOMMENDATIONS FOR PROPER FIX

### Option 1: Next.js Middleware (Recommended)
- Create middleware.ts in root
- Check authorization at edge/middleware level
- Redirect before component rendering
- No flash of loading state
- Works for both authenticated and protected routes

### Option 2: Proper Page Content
- Add actual dashboard/home content to page.tsx
- Only show content if `user && !loading`
- Show loading spinner if `loading`
- Show error if no user
- Use `router.push()` consistently for client-side redirects

### Option 3: Layout-Level Protection
- Move auth check to layout.tsx
- Use React Suspense for async auth
- Wrap children with proper loading boundary

### Option 4: Server Component Architecture
- Use Next.js 13+ Server Components properly
- Put auth check in layout or middleware
- No need for client-side context for basic protection

---

## SUMMARY

The architecture has conflicting patterns:
1. **Server rendering** (layout) + **Client auth** (context) = Timing issues
2. **Home page** shows loading message instead of content
3. **No middleware** means no server-side protection
4. **Redirect logic** scattered across multiple places (page.tsx, api client, login.tsx)
5. **Backend API works fine** - the problem is client-side architecture

The redirect loops and blank pages result from:
- Home page not having content for authenticated users
- Auth initialization delay causing loading state on initial render
- No consistent redirect strategy
