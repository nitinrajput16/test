const express = require('express');
const router = express.Router();
const EditorSession = require('../../models/EditorSession');
const ensureAuth = require('../../middleware/ensureAuth');
const schedule = require('node-schedule');

// Record activity period (start or end)
router.post('/activity', ensureAuth, async (req, res) => {
  try {
    const { action } = req.body; // 'start' or 'end'
    const userId = req.user.username;
    const now = new Date();
    // Get IST date string
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = istNow.toISOString().slice(0,10);
    if (action === 'start') {
      await EditorSession.create({ userId, start: now, date: dateStr });
      return res.json({ status: 'started' });
    } else if (action === 'end') {
      // Find latest open session for today
      const session = await EditorSession.findOne({ userId, date: dateStr, end: { $exists: false } }).sort({ start: -1 });
      if (session) {
        session.end = now;
        await session.save();
      }
      return res.json({ status: 'ended' });
    }
    res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record activity' });
  }
});

// Get total time spent today (in seconds)
router.get('/today', ensureAuth, async (req, res) => {
  try {
    const userId = req.user.username;
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = istNow.toISOString().slice(0,10);
    const sessions = await EditorSession.find({ userId, date: dateStr });
    let total = 0;
    sessions.forEach(s => {
      if (s.end && s.start) {
        total += (s.end - s.start) / 1000;
      } else if (s.start) {
        total += (now - s.start) / 1000;
      }
    });
    res.json({ seconds: Math.round(total) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get time' });
  }
});

// Cleanup old sessions at 00:00 IST
// Scheduled cleanup: delete finished sessions older than retention, but keep open sessions (no 'end')
const RETENTION_DAYS = parseInt(process.env.EDITOR_SESSION_RETENTION_DAYS || '7', 10);
schedule.scheduleJob('5 3 * * *', async () => {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    // Only delete sessions that have an 'end' timestamp older than cutoff.
    const res = await EditorSession.deleteMany({ end: { $exists: true, $lt: cutoff } });
    console.log('[EditorSession] cleanup: removed', res.deletedCount, 'sessions older than', RETENTION_DAYS, 'days');
  } catch (err) {
    console.warn('[EditorSession] scheduled cleanup failed:', err && err.message);
  }
});

module.exports = router;
