const express = require('express');
const router = express.Router();
const CodeFile = require('../../models/CodeFile');
const ensureAuth = require('../../middleware/ensureAuth');

const FILENAME_REGEX = /^[\w.\- ]{1,100}$/;

// List files for current user
router.get('/list', ensureAuth, async (req, res) => {
  try {
    console.log('[DEBUG][LIST] req.user._id:', req.user && req.user._id);
    const docs = await CodeFile.find(
    { googleId: req.user.googleId },
      'filename language updatedAt size'
    ).sort({ updatedAt: -1 }).lean();
    res.json({ files: docs });
  } catch (e) {
    console.error('[CODE][LIST]', e);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Load file
router.get('/load', ensureAuth, async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ error: 'filename required' });
    const doc = await CodeFile.findOne({ googleId: req.user.googleId, filename });
    if (!doc) return res.status(404).json({ error: 'File not found' });
    res.json({
      filename: doc.filename,
      code: doc.code,
      language: doc.language,
      updatedAt: doc.updatedAt
    });
  } catch (e) {
    console.error('[CODE][LOAD]', e);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

// Save (create/update)
router.post('/save', ensureAuth, async (req, res) => {
  try {
    console.log('[DEBUG][SAVE] req.user._id:', req.user && req.user._id);
    let { filename, code, language, roomId } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });
    if (!FILENAME_REGEX.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    code = code || '';
    language = language || 'plaintext';
    const now = new Date();
      const doc = await CodeFile.findOneAndUpdate(
        { googleId: req.user.googleId, filename },
      {
        $set: {
          code,
          language,
          size: code.length,
          updatedAt: now
        },
        $setOnInsert: {
            googleId: req.user.googleId,
          filename,
          createdAt: now
        }
      },
      { new: true, upsert: true }
    );
    res.json({ filename: doc.filename, updatedAt: doc.updatedAt });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Duplicate filename' });
    }
    console.error('[CODE][SAVE]', e);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Delete
router.delete('/delete', ensureAuth, async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });
    await CodeFile.deleteOne({ googleId: req.user.googleId, filename });
    res.json({ deleted: true });
  } catch (e) {
    console.error('[CODE][DELETE]', e);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Rename
router.post('/rename', ensureAuth, async (req, res) => {
  try {
    const { oldName, newName } = req.body || {};
    if (!oldName || !newName) return res.status(400).json({ error: 'oldName & newName required' });
    if (!FILENAME_REGEX.test(newName)) {
      return res.status(400).json({ error: 'Invalid new filename' });
    }
    const file = await CodeFile.findOne({ googleId: req.user.googleId, filename: oldName });
    if (!file) return res.status(404).json({ error: 'Original file not found' });
    const dupe = await CodeFile.findOne({ googleId: req.user.googleId, filename: newName });
    if (dupe) return res.status(409).json({ error: 'New filename already exists' });
    file.filename = newName;
    await file.save();
    res.json({ renamed: true, filename: newName });
  } catch (e) {
    console.error('[CODE][RENAME]', e);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

module.exports = router;