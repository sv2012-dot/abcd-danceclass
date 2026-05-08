/**
 * Vercel Serverless Function — OG preview proxy
 *
 * vercel.json routes /:school/:recital to this function ONLY when the
 * User-Agent matches a known link-preview bot (WhatsApp, Telegram, etc.).
 * Human browsers are never routed here — they hit the normal /(.*) → index.html rewrite.
 */

const BACKEND_URL =
  process.env.REACT_APP_API_URL?.replace('/api', '') ||
  'https://abcd-danceclass-production.up.railway.app';

module.exports = async function handler(req, res) {
  const { school, recital } = req.query;

  if (!school || !recital) {
    return res.status(400).send('Missing school or recital slug');
  }

  try {
    const ogUrl = `${BACKEND_URL}/api/public/${school}/${recital}/og`;
    const upstream = await fetch(ogUrl);
    const html = await upstream.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(500).send('Error generating preview');
  }
};
