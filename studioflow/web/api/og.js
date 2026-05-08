/**
 * Vercel Serverless Function — OG preview proxy
 *
 * All /:school/:recital requests (without ?_h=1) land here.
 * - Bots  → fetch OG HTML from backend and return it (rich WhatsApp/Telegram card)
 * - Humans → redirect to same URL with ?_h=1, which skips this function and
 *            hits the /(.*) → index.html rewrite so the React SPA loads normally
 */

const BOT_UA = /facebot|facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|yandexbot|applebot|ia_archiver|pinterest|tumblr|vkshare/i;

const BACKEND_URL =
  process.env.REACT_APP_API_URL?.replace('/api', '') ||
  'https://abcd-danceclass-production.up.railway.app';

module.exports = async function handler(req, res) {
  const { school, recital } = req.query;
  const ua = req.headers['user-agent'] || '';

  // Human browser — bounce back to the same URL with ?_h=1 so Vercel skips
  // this function on the second hit and serves index.html instead
  if (!BOT_UA.test(ua)) {
    res.redirect(302, `/${school}/${recital}?_h=1`);
    return;
  }

  // Bot — proxy to the backend OG endpoint and return the preview HTML
  try {
    const upstream = await fetch(`${BACKEND_URL}/api/public/${school}/${recital}/og`);
    const html = await upstream.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    res.status(upstream.status).send(html);
  } catch {
    // On error fall back to the SPA
    res.redirect(302, `/${school}/${recital}?_h=1`);
  }
};
