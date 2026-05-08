/**
 * Vercel Edge Middleware — Open Graph bot detection
 *
 * When WhatsApp / Telegram / Slack / Twitter crawlers fetch a public recital
 * URL (/:schoolSlug/:recitalSlug), they don't execute JavaScript, so the
 * React SPA's blank index.html gives no preview. This middleware intercepts
 * those bot requests and proxies them to the backend OG endpoint, which
 * returns a minimal HTML page with proper <meta og:*> tags and then
 * immediately redirects human browsers onward to the React app.
 */

// WhatsApp uses both "WhatsApp/x.x" and "facebookexternalhit" (Facebook's link-preview crawler)
const BOT_UA = /facebot|facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|yandexbot|applebot|pinterest|tumblr|vkshare|w3c_validator|curl\/|python-requests|wget|ia_archiver/i;

// Known first-path segments that are definitely not school slugs
const SKIP_PATHS = new Set([
  'api', 'og', 'login', 'admin', 'pricing', 'static', 'favicon.ico',
  'manifest.json', 'robots.txt', '_next', 'health', 'public',
]);

const BACKEND_URL =
  process.env.REACT_APP_API_URL?.replace('/api', '') ||
  'https://abcd-danceclass-production.up.railway.app';

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) return; // let Vercel serve index.html normally

  const { pathname } = new URL(request.url);
  const parts = pathname.split('/').filter(Boolean);

  // Must be exactly /:schoolSlug/:recitalSlug
  if (parts.length !== 2 || SKIP_PATHS.has(parts[0])) return;

  const [schoolSlug, recitalSlug] = parts;
  const ogUrl = `${BACKEND_URL}/api/public/${schoolSlug}/${recitalSlug}/og`;

  try {
    const res = await fetch(ogUrl);
    const html = await res.text();
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    });
  } catch {
    return; // fall through to React app on error
  }
}

export const config = {
  matcher: ['/((?!_next|static|favicon|manifest|robots|api).*)'],
};
