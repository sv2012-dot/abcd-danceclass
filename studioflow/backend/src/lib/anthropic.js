// ── Anthropic client wrapper for Smart ManchQ features ────────────────────
// Single source of truth for: API client, model choice, JSON parsing,
// timeouts, and error normalisation. Routes call run() with a prompt;
// they never touch the SDK directly.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 2048;
const TIMEOUT_MS = 20000;

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
    });
  }
  return _client;
}

/**
 * Run a single Smart ManchQ prompt and return parsed JSON.
 * The model is instructed to ONLY return JSON; we strip code fences just
 * in case it wraps them anyway, then JSON.parse.
 *
 * @param {object} opts
 * @param {string} opts.system   - System prompt (role / rules)
 * @param {string} opts.user     - User prompt (the actual ask + data)
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{data:any, usage:{input_tokens:number, output_tokens:number}, latencyMs:number}>}
 */
async function runJson({ system, user, maxTokens = MAX_TOKENS }) {
  const start = Date.now();
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const latencyMs = Date.now() - start;

  const text = res.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
    .trim()
    // strip ```json ... ``` fences if model wrapped output despite instructions
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const e = new Error(`Smart ManchQ returned malformed JSON: ${err.message}`);
    e.raw = text.slice(0, 500);
    throw e;
  }

  return { data, usage: res.usage, latencyMs };
}

/**
 * Run a single Smart ManchQ prompt and return plain text (no JSON parsing).
 * Used for free-form output like message drafts.
 */
async function runText({ system, user, maxTokens = MAX_TOKENS }) {
  const start = Date.now();
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return {
    text: res.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim(),
    usage: res.usage,
    latencyMs: Date.now() - start,
  };
}

module.exports = { runJson, runText, MODEL };
