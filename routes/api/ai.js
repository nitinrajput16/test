const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ensureAuth } = require('../../middleware/auth');

const router = express.Router();
let modelInstance;
const modelName = process.env.GEMINI_INLINE_MODEL || 'gemini-1.5-flash-latest';

function getModel() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  if (!modelInstance) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    modelInstance = genAI.getGenerativeModel({ model: modelName });
  }
  return modelInstance;
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
Return ONLY the continuation (no explanations, no surrounding fences).`;

    const model = getModel();
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `${instruction}\n\n<CODE>\n${truncated}\n</CODE>\nContinuation:` }]
      }],
      generationConfig: { maxOutputTokens: 80, temperature: 0.25 }
    });

    const raw = result.response?.text?.() || '';
    const cleaned = extractFence(raw);
    res.json({ suggestion: cleaned });
  } catch (e) {
    res.status(500).json({ error: 'inline completion failed: ' + e.message });
  }
});

module.exports = router;