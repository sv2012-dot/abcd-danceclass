require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const patchTables = require('./helpers/patchTables');

const app = express();

// We sit behind Railway's edge proxy in production, which sets
// X-Forwarded-For. Tell Express to trust exactly one upstream hop so
// express-rate-limit can read the real client IP without the
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warning. Limiting to 1 (not `true`)
// avoids the security warning about over-trusting proxy headers.
app.set('trust proxy', 1);

// Security
app.use(helmet());

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://abcd-danceclass.vercel.app',
  'https://manchq.com',
  'https://www.manchq.com',
  'https://app.manchq.com',
  // Additional origins from env (comma-separated)
  ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

// Vercel preview deploys land on auto-generated subdomains like
// `abcd-danceclass-git-<branch>-<team>.vercel.app` or
// `abcd-danceclass-<deploy-hash>.vercel.app`. Hardcoding each one in
// ALLOWED_ORIGINS is unworkable, so allow anything that looks like a
// preview URL belonging to either of this project's known Vercel
// project names (abcd-danceclass = repo name, manchq = brand).
const VERCEL_PREVIEW_RX = /^https:\/\/(abcd-danceclass|manchq)[-a-z0-9]*\.vercel\.app$/i;

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin) return cb(null, true);
    // Allow any localhost origin for local development
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Allow Vercel preview deploys of this project (see regex above)
    if (VERCEL_PREVIEW_RX.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
// Stripe webhook MUST receive the raw body (for signature verification).
// Mount it BEFORE the JSON parser so the signed payload isn't mutated.
app.use('/api/billing/webhook', require('./routes/billingWebhook'));

app.use(express.json({ limit: '15mb' }));
app.use(morgan('dev'));

// Rate limiting
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 200 }));

// Routes
app.use('/api', require('./routes/index'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 StudioFlow API running on port ${PORT}`);
  await patchTables();
});