const express = require('express');
const router = express.Router();
const EditorSession = require('../../models/EditorSession');
const ensureAuth = require('../../middleware/ensureAuth');
const schedule = require('node-schedule');

// Record activity period (start or end)
router.post('/activity', ensureAuth, async (req, res) => {
  try {
    const { action } = req.body; // 'start' or 'end'
    const googleId = req.user.googleId;
    const now = new Date();
    // Get IST date string
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = istNow.toISOString().slice(0,10);
    if (action === 'start') {
      await EditorSession.create({ googleId, start: now, date: dateStr });
      return res.json({ status: 'started' });
    } else if (action === 'end') {
      // Find latest open session for today
      const session = await EditorSession.findOne({ googleId, date: dateStr, end: { $exists: false } }).sort({ start: -1 });
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
    const googleId = req.user.googleId;
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateStr = istNow.toISOString().slice(0,10);
    const sessions = await EditorSession.find({ googleId, date: dateStr });
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
schedule.scheduleJob('0 0 * * *', async () => {
  // Runs at 00:00 IST (server time must be UTC or IST)
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dateStr = istNow.toISOString().slice(0,10);
  await EditorSession.deleteMany({ date: { $ne: dateStr } });
  console.log('EditorSession cleanup done for', dateStr);
});

module.exports = router;
