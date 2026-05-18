const express = require('express');
const path = require('path');
const { ensureAuth } = require('../middleware/auth');
const { getIstDateParts } = require('../lib/time');

const router = express.Router();

function formatEditorTime(totalSeconds) {
  if (totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

async function loadWorkspaceSummary(username, { now, dateStr }) {
  const CodeFile = require('../models/CodeFile');
  const EditorSession = require('../models/EditorSession');

  const MIN_SESSION_SECONDS = 3;
  const MAX_SESSION_HOURS = 3;
  const OPEN_SESSION_TIMEOUT = 5 * 60;
  const MIN_DAILY_SECONDS = 60;

  const [files, codeCount, todaySessions, allSessions] = await Promise.all([
    CodeFile.find({ userId: username }, 'filename language updatedAt size').sort({ updatedAt: -1 }).lean(),
    CodeFile.countDocuments({ userId: username }),
    EditorSession.find({ userId: username, date: dateStr }).sort({ start: 1 }),
    EditorSession.find({ userId: username }).sort({ date: -1, start: 1 })
  ]);

  const processedSessions = [];
  for (const session of todaySessions) {
    let duration = 0;
    if (session.end && session.start) {
      duration = (session.end - session.start) / 1000;
    } else if (session.start) {
      const timeSinceStart = (now - session.start) / 1000;
      if (timeSinceStart <= OPEN_SESSION_TIMEOUT) duration = timeSinceStart;
    }

    if (duration >= MIN_SESSION_SECONDS) {
      processedSessions.push({
        start: session.start,
        end: session.end || now,
        duration: Math.min(duration, MAX_SESSION_HOURS * 3600)
      });
    }
  }

  const totalSeconds = processedSessions.reduce((sum, session) => sum + session.duration, 0);

  const dailyTotals = new Map();
  for (const session of allSessions) {
    if (!session.start || !session.date || !session.end) continue;
    let duration = (session.end - session.start) / 1000;
    if (duration < MIN_SESSION_SECONDS) continue;
    duration = Math.min(duration, MAX_SESSION_HOURS * 3600);
    dailyTotals.set(session.date, (dailyTotals.get(session.date) || 0) + duration);
  }

  let streak = 0;
  if (dailyTotals.size > 0) {
    const sortedDates = Array.from(dailyTotals.keys()).sort((a, b) => b.localeCompare(a));
    let expectedDate = dateStr;
    for (const date of sortedDates) {
      if (date === expectedDate && dailyTotals.get(date) >= MIN_DAILY_SECONDS) {
        streak++;
        const prev = new Date(expectedDate);
        prev.setDate(prev.getDate() - 1);
        expectedDate = prev.toISOString().slice(0, 10);
      } else if (date < expectedDate) {
        break;
      }
    }
  }

  return {
    files,
    codeCount,
    editorTime: formatEditorTime(totalSeconds),
    streak
  };
}

// Dashboard → redirect to merged profile page
router.get('/dashboard', ensureAuth, (req, res) => res.redirect('/profile'));

// Kept for internal/admin usage only — not linked from UI
router.get('/dashboard-legacy', ensureAuth, async (req, res) => {
  try {
    const { now, dateStr } = getIstDateParts();
    const { files, codeCount, editorTime, streak } = await loadWorkspaceSummary(req.user.username, { now, dateStr });

    res.render('dashboard', {
      title: 'Dashboard - Edit',
      user: req.user,
      fileList: files,
      codeCount,
      editorTime,
      streak
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', {
      title: 'Dashboard - Edit',
      user: req.user,
      fileList: [],
      codeCount: 0,
      editorTime: '0m',
      streak: 0
    });
  }
});

router.get('/api/dashboard', ensureAuth, async (req, res) => {
  try {
    const { now, dateStr } = getIstDateParts();
    const { files, codeCount, editorTime, streak } = await loadWorkspaceSummary(req.user.username, { now, dateStr });
    res.json({
      stats: {
        filesSaved: codeCount,
        todaysCoding: editorTime,
        streak
      },
      recentFiles: files.slice(0, 10)
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({ error: 'Could not load dashboard data.' });
  }
});

router.get('/profile', ensureAuth, async (req, res) => {
  const User = require('../models/users');

  try {
    const { now, dateStr } = getIstDateParts();
    const freshUser = await User.findById(req.user._id).lean();
    const profileUser = freshUser || req.user;
    const activeUsername = profileUser.username;
    const friendUsernames = profileUser && Array.isArray(profileUser.friends) ? profileUser.friends : [];

    const [{ files, codeCount, editorTime, streak }, friendsData] = await Promise.all([
      loadWorkspaceSummary(activeUsername, { now, dateStr }),
      User.find({ username: { $in: friendUsernames } }, 'username displayName avatar').lean()
    ]);

    res.render('profile', {
      title: 'Profile - Edit',
      user: profileUser,
      sessionActive: req.isAuthenticated && req.isAuthenticated(),
      codeCount,
      fileList: files,
      editorTime,
      streak,
      friendsData,
      hasPassword: Boolean(profileUser.passwordHash)
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.render('profile', {
      title: 'Profile - Edit',
      user: req.user,
      sessionActive: false,
      codeCount: 0,
      fileList: [],
      editorTime: '0m',
      streak: 0,
      friendsData: [],
      hasPassword: Boolean(req.user && req.user.passwordHash)
    });
  }
});

module.exports = router;