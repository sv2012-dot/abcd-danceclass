require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const patchTables = require('./helpers/patchTables');

const app = express();

// Security
app.use(helmet());

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://abcd-danceclass.vercel.app',
  'https://manchq.com',
  'https://www.manchq.com',
  // Additional origins from env (comma-separated)
  ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin) return cb(null, true);
    // Allow any localhost origin for local development
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
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