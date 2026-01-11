const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ensureAuth } = require('../../middleware/auth');

const router = express.Router();
const DEFAULT_MODEL = 'gemma-3-27b';
const configuredModel = process.env.GEMINI_INLINE_MODEL || DEFAULT_MODEL;
const envFallbacks = (process.env.GEMINI_FALLBACK_MODELS || '')
  .split(',')
  .map(str => str.trim())
  .filter(Boolean);
const FALLBACK_MODELS = Array.from(new Set([
  configuredModel,
  ...envFallbacks,
  // prefer flash (lower-latency) models where available
  'gemini-2.5-flash-lite',
  DEFAULT_MODEL,
  'gemma-3-27b'
].filter(Boolean)));
const modelCache = new Map();

function getModel(targetModel) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  // Normalize model name: trim and lowercase to avoid accidental casing/format issues
  const name = String(targetModel || DEFAULT_MODEL).trim().toLowerCase();
  if (!modelCache.has(name)) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    modelCache.set(name, genAI.getGenerativeModel({ model: name }));
  }
  return modelCache.get(name);
}

function isModelUnavailableError(err = {}) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('model') && (msg.includes('not found') || msg.includes('permission') || msg.includes('unavailable'));
}

function shouldRetryWithAlternate(err = {}) {
  if (!err) return false;
  if (isModelUnavailableError(err)) return true;
  if (typeof err.status === 'number' && err.status === 429) return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit');
}

function extractFence(raw){
  if(!raw) return '';
  const fenceBlocks = [...raw.matchAll(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g)].map(m=>m[1].trim());
  if (fenceBlocks.length === 1) return fenceBlocks[0];
  if (fenceBlocks.length > 1) return fenceBlocks.join('\n').trim();
  return raw.replace(/```/g,'').trim();
}

router.post('/inline', ensureAuth, async (req, res) => {
  try {
    const { prefix, language = 'JavaScript' } = req.body || {};
    if (!prefix) return res.status(400).json({ error: 'prefix required' });

    const truncated = prefix.slice(-8000);
    const instruction = `You are a ${language} code autocomplete engine.
  Continue directly after the snippet.
  Return ONLY the continuation wrapped in a fenced code block with the language tag (for example: \`\`\`javascript ... \`\`\`).`;

    async function requestCompletion(modelName) {
      const model = getModel(modelName);
      return model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `${instruction}\n\n<CODE>\n${truncated}\n</CODE>\nContinuation:` }]
        }],
        // increase tokens to allow longer continuations
        generationConfig: { maxOutputTokens: 256, temperature: 0.18 }
      });
    }

    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
      try {
        const result = await requestCompletion(modelName);
        // extract raw text robustly (SDK may expose .text as function or string, or use candidates)
        let raw = '';
        const resp = result.response;
        if (resp) {
          try {
            if (typeof resp.text === 'function') {
              const t = await resp.text();
              if (typeof t === 'string') raw = t;
              else if (t && typeof t.text === 'string') raw = t.text;
              else raw = JSON.stringify(t || '');
            } else if (typeof resp.text === 'string') {
              raw = resp.text;
            } else if (Array.isArray(resp.candidates) && resp.candidates[0]) {
              const cand = resp.candidates[0];
              if (cand.content && Array.isArray(cand.content.parts)) {
                raw = cand.content.parts.map(p => p.text || '').join('');
              } else {
                raw = JSON.stringify(cand || '');
              }
            }
          } catch (ex) {
            console.warn('[AI] failed to extract raw response', modelName, ex && ex.message);
          }
        }
        // log raw for diagnostics (shorten to first 2000 chars)
        let cleaned = extractFence(raw || '');
        if (!cleaned && raw && String(raw).trim()) {
          cleaned = String(raw).trim();
        }
        if (!cleaned) {
          console.warn('[AI] inline empty suggestion from model', modelName);
          cleaned = '/* no suggestion */';
        }
        return res.json({ suggestion: cleaned });
      } catch (err) {
        lastError = err;
        if (!shouldRetryWithAlternate(err)) {
          throw err;
        }
        console.warn('[AI] Inline model retry', modelName, err.message);
      }
    }
    if (lastError) throw lastError;
  } catch (e) {
    console.error('[AI] inline completion failed', e && e.stack ? e.stack : e);
    if (process.env.NODE_ENV !== 'production') {
      // In development return the full error to help debugging
      res.status(500).json({ error: 'inline completion failed', message: e && e.message, stack: e && e.stack });
    } else {
      res.status(500).json({ error: 'inline completion failed: ' + (e && e.message) });
    }
  }
});

module.exports = router;

// DEV-only debug route: returns raw model response + cleaned suggestion
if (process.env.NODE_ENV !== 'production') {
  router.post('/debug-inline', async (req, res) => {
    try {
      const { prefix, language = 'JavaScript', model: modelName } = req.body || {};
      if (!prefix) return res.status(400).json({ error: 'prefix required' });

      const truncated = prefix.slice(-8000);
      const instruction = `You are a ${language} code autocomplete engine.\nContinue directly after the snippet.\nReturn ONLY the continuation. If you return code, fences are allowed.`;
      const model = getModel(modelName || configuredModel);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${instruction}\n\n<CODE>\n${truncated}\n</CODE>\nContinuation:` }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.18 }
      });
      // extract raw like above
      let raw = '';
      const resp = result.response;
      if (resp) {
        try {
          if (typeof resp.text === 'function') {
            const t = await resp.text();
            if (typeof t === 'string') raw = t;
            else if (t && typeof t.text === 'string') raw = t.text;
            else raw = JSON.stringify(t || '');
          } else if (typeof resp.text === 'string') {
            raw = resp.text;
          } else if (Array.isArray(resp.candidates) && resp.candidates[0]) {
            const cand = resp.candidates[0];
            if (cand.content && Array.isArray(cand.content.parts)) {
              raw = cand.content.parts.map(p => p.text || '').join('');
            } else {
              raw = JSON.stringify(cand || '');
            }
          }
        } catch (ex) {
          console.warn('[AI] failed to extract raw response (debug-inline)', ex && ex.message);
        }
      }
      const cleaned = extractFence(raw || '');
      return res.json({ raw: String(raw || ''), cleaned });
    } catch (e) {
      console.error('[AI] debug-inline failed', e);
      return res.status(500).json({ error: e.message });
    }
  });
}