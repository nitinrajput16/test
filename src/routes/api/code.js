const express = require('express');
const router = express.Router();
const CodeFile = require('../../models/CodeFile');
const ensureAuth = require('../../middleware/ensureAuth');

const FILENAME_REGEX = /^[\w.\- ]{1,100}$/;
// Run code using Judge0 API
const fetch = require('node-fetch');
const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true';
const JUDGE0_HEADERS = {
  'Content-Type': 'application/json',
  'X-RapidAPI-Key': process.env.JUDGE0_API_KEY || '', // Set your RapidAPI key in env
  'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
};

router.post('/run', ensureAuth, async (req, res) => {
  try {
    const { source_code, language_id, stdin } = req.body || {};
    if (!source_code || !language_id) return res.status(400).json({ error: 'source_code and language_id required' });
    // Sanitize source_code: remove Markdown code fences if pasted into the editor
    function stripCodeFences(s) {
      if (!s) return s;
      // Replace fenced blocks like ```lang\n...code...\n``` with the inner code
      return s.replace(/```[\s\S]*?```/g, (m) => {
        // remove the opening fence and optional language tag
        return m.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      });
    }
    const sanitizedSource = stripCodeFences(source_code);
    // Encode source_code and stdin in base64
    function toBase64(str) {
      return Buffer.from(str || '', 'utf8').toString('base64');
    }
    const body = {
      source_code: toBase64(sanitizedSource),
      language_id,
      stdin: toBase64(stdin || ''),
      base64_encoded: true
    };
    // Update Judge0 URL to match base64_encoded=true
    const judgeRes = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true', {
      method: 'POST',
      headers: JUDGE0_HEADERS,
      body: JSON.stringify(body)
    });
    const data = await judgeRes.json();
    // Decode base64 stdout/stderr if present
    function decodeBase64(str) {
      if (!str) return '';
      return Buffer.from(str, 'base64').toString('utf8');
    }
    if (data.stdout) data.stdout = decodeBase64(data.stdout);
    if (data.stderr) data.stderr = decodeBase64(data.stderr);
    // Judge0 may return compile_output as base64 when base64_encoded=true
    if (data.compile_output) data.compile_output = decodeBase64(data.compile_output);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to run code' });
  }
});

// List files for current user
router.get('/list', ensureAuth, async (req, res) => {
  try {
    const docs = await CodeFile.find(
      { userId: req.user.username },
      'filename parentPath type language updatedAt size'
    ).sort({ type: 1, filename: 1 }).lean(); // Sort folders first if we want, or handle in client
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ files: docs });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Load file
router.get('/load', ensureAuth, async (req, res) => {
  try {
    const { filename, parentPath } = req.query;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    // Default to root if not provided (backward compatibility)
    const pPath = parentPath || '/';

    const doc = await CodeFile.findOne({ userId: req.user.username, filename, parentPath: pPath });
    if (!doc) return res.status(404).json({ error: 'File not found' });

    const codeValue = typeof doc.code === 'string'
      ? doc.code
      : (Buffer.isBuffer(doc.code)
        ? doc.code.toString('utf8')
        : (doc.code && typeof doc.code.toString === 'function'
          ? doc.code.toString()
          : ''));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      filename: doc.filename,
      parentPath: doc.parentPath,
      code: codeValue,
      language: doc.language,
      updatedAt: doc.updatedAt
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load file' });
  }
});

// Save (create/update)
router.post('/save', ensureAuth, async (req, res) => {
  try {
    let { filename, parentPath, code, language, roomId } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });
    if (!FILENAME_REGEX.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const pPath = parentPath || '/';
    code = code || '';
    language = language || 'plaintext';
    const now = new Date();

    const doc = await CodeFile.findOneAndUpdate(
      { userId: req.user.username, filename, parentPath: pPath },
      {
        $set: {
          code,
          language,
          size: code.length,
          updatedAt: now,
          type: 'file'
        },
        $setOnInsert: {
          userId: req.user.username,
          filename,
          parentPath: pPath,
          createdAt: now
        }
      },
      { new: true, upsert: true }
    );
    res.json({ filename: doc.filename, parentPath: doc.parentPath, updatedAt: doc.updatedAt });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Duplicate filename in this folder' });
    }
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Create Folder
router.post('/create-folder', ensureAuth, async (req, res) => {
  try {
    let { filename, parentPath } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'Folder name required' });
    if (!FILENAME_REGEX.test(filename)) return res.status(400).json({ error: 'Invalid folder name' });

    const pPath = parentPath || '/';
    const now = new Date();

    const doc = await CodeFile.create({
      userId: req.user.username,
      filename,
      parentPath: pPath,
      type: 'directory',
      code: '',
      language: '',
      createdAt: now,
      updatedAt: now
    });

    res.json({ filename: doc.filename, parentPath: doc.parentPath, type: 'directory' });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Folder already exists' });
    }
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Delete
router.delete('/delete', ensureAuth, async (req, res) => {
  try {
    const { filename, parentPath, type } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });

    const pPath = parentPath || '/';

    if (type === 'directory') {
      // Recursive delete: find all files that start with proper path prefix
      // Folder path is: parentPath + filename + '/'
      // e.g. parentPath='/', filename='src' -> prefix='/src/'
      // e.g. parentPath='/src', filename='comp' -> prefix='/src/comp/'

      const folderFullPath = (pPath === '/' ? '' : pPath) + '/' + filename;
      const regex = new RegExp('^' + folderFullPath + '(/|$)');

      // Delete the folder itself
      await CodeFile.deleteOne({ userId: req.user.username, filename, parentPath: pPath, type: 'directory' });

      // Delete children
      await CodeFile.deleteMany({ userId: req.user.username, parentPath: regex });

    } else {
      await CodeFile.deleteOne({ userId: req.user.username, filename, parentPath: pPath });
    }

    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Rename (and Move)
router.post('/rename', ensureAuth, async (req, res) => {
  try {
    const { oldName, newName, oldParentPath, newParentPath, type } = req.body || {};
    if (!oldName || !newName) return res.status(400).json({ error: 'oldName & newName required' });
    if (!FILENAME_REGEX.test(newName)) {
      return res.status(400).json({ error: 'Invalid new filename' });
    }

    const oPath = oldParentPath || '/';
    const nPath = newParentPath || oPath; // Default to same path if not moving

    // Check target existence
    const existing = await CodeFile.findOne({ userId: req.user.username, filename: newName, parentPath: nPath });
    if (existing) return res.status(409).json({ error: 'Target already exists' });

    const file = await CodeFile.findOne({ userId: req.user.username, filename: oldName, parentPath: oPath });
    if (!file) return res.status(404).json({ error: 'Original file not found' });

    file.filename = newName;
    file.parentPath = nPath;
    await file.save();

    // If directory, move/rename children
    if (type === 'directory') {
      const oldFullPath = (oPath === '/' ? '' : oPath) + '/' + oldName;
      const newFullPath = (nPath === '/' ? '' : nPath) + '/' + newName;

      // Find all children
      const regex = new RegExp('^' + oldFullPath + '(/|$)');
      const children = await CodeFile.find({ userId: req.user.username, parentPath: regex });

      for (const child of children) {
        // Replace prefix in parentPath
        // e.g. /old/path/child -> /new/path/child
        child.parentPath = child.parentPath.replace(oldFullPath, newFullPath);
        await child.save();
      }
    }

    res.json({ renamed: true, filename: newName, parentPath: nPath });
  } catch (e) {
    res.status(500).json({ error: 'Failed to rename/move' });
  }
});

module.exports = router;