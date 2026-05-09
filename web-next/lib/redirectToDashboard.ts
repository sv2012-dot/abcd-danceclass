/**
 * After login, redirect the user to the CRA dashboard app with their token.
 * The CRA app has an /auth-bridge route that stores the token and sends them home.
 *
 * In development: CRA runs on port 3002, Next.js on 3000.
 * In production: set NEXT_PUBLIC_DASHBOARD_URL to the deployed CRA app URL.
 */
export function redirectToDashboard(token: string, user: any, school: any) {
  const isDev = process.env.NODE_ENV === 'development';
  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL
    || (isDev ? 'http://localhost:3002' : '');

  if (!dashboardBase) {
    // Fallback: stay on Next.js home (for when everything is migrated)
    window.location.href = '/';
    return;
  }

  const params = new URLSearchParams();
  params.set('sf_token', token);
  if (user) params.set('sf_user', encodeURIComponent(JSON.stringify(user)));
  if (school) params.set('sf_school', encodeURIComponent(JSON.stringify(school)));

  window.location.href = `${dashboardBase}/auth-bridge?${params.toString()}`;
}
