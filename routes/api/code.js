const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { ensureAuth } = require('../../middleware/auth');
const CodeFile = require('../../models/CodeFile');

const router = express.Router();

// In-memory rate limiter
const WINDOW_MS = 60_000;
const MAX_REQ = 60;
const buckets = new Map();
function rateLimit(req, res, next) {
  const key = req.sessionID || req.ip;
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(ts => now - ts < WINDOW_MS);
  arr.push(now);
  buckets.set(key, arr);
  if (arr.length > MAX_REQ) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
}

// Save
router.post('/save', ensureAuth, async (req, res) => {
  try {
    const { code, filename, language, roomId } = req.body;
    if (!code || !filename) return res.status(400).json({ error: 'Code and filename required' });

    const safeFilename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    if (!safeFilename) return res.status(400).json({ error: 'Invalid filename' });

    const doc = await CodeFile.findOneAndUpdate(
      { filename: safeFilename },
      { code, language, roomId },
      { upsert: true, new: true }
    );

    res.json({ message: 'Saved', filename: doc.filename, updatedAt: doc.updatedAt });
  } catch (e) {
    console.error('[SAVE]', e.message);
    res.status(500).json({ error: 'Save failed' });
  }
});

// Load
router.get('/load', ensureAuth, async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ error: 'Filename required' });
    const doc = await CodeFile.findOne({ filename });
    if (!doc) return res.status(404).json({ error: 'File not found' });
    res.json({ code: doc.code, filename: doc.filename, language: doc.language });
  } catch (e) {
    console.error('[LOAD]', e.message);
    res.status(500).json({ error: 'Load failed' });
  }
});

// List
router.get('/list', ensureAuth, async (_req, res) => {
  try {
    const docs = await CodeFile.find({}, 'filename updatedAt').sort({ updatedAt: -1 });
    res.json({ files: docs.map(d => d.filename) });
  } catch (e) {
    console.error('[LIST]', e.message);
    res.status(500).json({ error: 'List failed' });
  }
});

// Judge0 run
const ALLOWED_LANGUAGE_IDS = new Set([
  63, // JavaScript (Node.js)
  71, // Python
  54, // C++
  62, // Java
  68, // PHP
  82, // SQL (MySQL)
  22, // Go
  80, // R
  73, // Rust
  50, // C
  72, // Ruby
  51, // C#
  78, // Kotlin
  74  // TypeScript
]); // Node, Python, C++, Java
router.post('/run', ensureAuth, rateLimit, async (req, res) => {
  const { source_code, language_id, stdin = '' } = req.body || {};
  if (!source_code || typeof source_code !== 'string') {
    return res.status(400).json({ error: 'source_code required' });
  }
  if (!language_id) return res.status(400).json({ error: 'language_id required' });
  if (!ALLOWED_LANGUAGE_IDS.has(language_id)) return res.status(400).json({ error: 'language_id not allowed' });
  if (source_code.length > 100 * 1024) return res.status(413).json({ error: 'source_code too large' });

  try {
    const hash = crypto.createHash('sha256').update(source_code).digest('hex').slice(0, 12);
    const url = `${process.env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`;

    const response = await axios.post(
      url,
      { source_code, language_id, stdin },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.JUDGE0_API_KEY
        },
        timeout: 15000
      }
    );

    const d = response.data || {};
    res.json({
      status: d.status,
      time: d.time,
      memory: d.memory,
      stdout: d.stdout,
      stderr: d.stderr,
      compile_output: d.compile_output,
      message: d.message,
      hash
    });
  } catch (e) {
    if (e.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Execution timeout' });
    }
    console.error('[RUN]', e.message);
    res.status(500).json({ error: 'Run failed' });
  }
});

module.exports = router;