const express = require('express');
const path = require('path');
const { ensureAuth, ensureGuest, ensureOwner, sanitizeReturnPath } = require('../middleware/auth');

const router = express.Router();

// Root logic - Landing page
router.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/editor');
  return res.sendFile(path.join(__dirname, '../../public', 'landing.html'));
});

// Always serve landing page (even when authenticated)
router.get('/landing', (_req, res) => {
  return res.sendFile(path.join(__dirname, '../../public', 'landing.html'));
});

// Login
router.get('/login', ensureGuest, (req, res) => {
  const nextPath = sanitizeReturnPath(req.query.next);
  if (nextPath && req.session) {
    req.session.returnTo = nextPath;
  }
  res.render('login', {
    title: 'Login - Edit',
    error: req.query.error || null,
    message: req.query.message || null,
    next: nextPath || null
  });
});

// Signup
router.get('/signup', ensureGuest, (req, res) => {
  const nextPath = sanitizeReturnPath(req.query.next);
  if (nextPath && req.session) {
    req.session.returnTo = nextPath;
  }
  res.render('signup', {
    title: 'Sign Up - Codeplat',
    error: req.query.error || null,
    next: nextPath || null
  });
});

// Optional dashboard (EJS UI if you still want it)
router.get('/dashboard', ensureAuth, async (req, res) => {
  const CodeFile = require('../models/CodeFile');
  const EditorSession = require('../models/EditorSession');
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dateStr = istNow.toISOString().slice(0,10);
  
  try {
    const [files, codeCount, todaySessions, allSessions] = await Promise.all([
      CodeFile.find({ userId: req.user.username }, 'filename language updatedAt size').sort({ updatedAt: -1 }).lean(),
      CodeFile.countDocuments({ userId: req.user.username }),
      EditorSession.find({ userId: req.user.username, date: dateStr }).sort({ start: 1 }),
      EditorSession.find({ userId: req.user.username }).sort({ date: -1, start: 1 })
    ]);
    
    // ============ OPTIMAL CODING TIME CALCULATION ============
    // Constants for optimal session processing
    const MIN_SESSION_SECONDS = 3;        // Ignore micro-sessions (page loads)
    const MAX_SESSION_HOURS = 3;          // Cap individual sessions at 3 hours
    const OPEN_SESSION_TIMEOUT = 5 * 60;  // Consider open sessions inactive after 5 minutes
    const MERGE_GAP_SECONDS = 5 * 60;     // Merge sessions within 5 minutes into one block
    
    // Process today's sessions
    const processedSessions = [];
    
    for (const session of todaySessions) {
      let duration = 0;
      
      if (session.end && session.start) {
        // Closed session
        duration = (session.end - session.start) / 1000;
      } else if (session.start) {
        // Open session - only count if active within last 5 minutes
        const timeSinceStart = (now - session.start) / 1000;
        if (timeSinceStart <= OPEN_SESSION_TIMEOUT) {
          duration = timeSinceStart;
        }
      }
      
      // Filter out micro-sessions and cap max duration
      if (duration >= MIN_SESSION_SECONDS) {
        duration = Math.min(duration, MAX_SESSION_HOURS * 3600);
        processedSessions.push({
          start: session.start,
          end: session.end || now,
          duration
        });
      }
    }
    
    // Merge consecutive sessions within 5 minutes into coding blocks
    let totalSeconds = 0;
    if (processedSessions.length > 0) {
      totalSeconds = processedSessions[0].duration;
      
      for (let i = 1; i < processedSessions.length; i++) {
        const prevEnd = processedSessions[i - 1].end;
        const currStart = processedSessions[i].start;
        const gap = (currStart - prevEnd) / 1000;
        
        if (gap <= MERGE_GAP_SECONDS) {
          // Sessions are close together - just add current duration
          totalSeconds += processedSessions[i].duration;
        } else {
          // Gap is too large - add full duration
          totalSeconds += processedSessions[i].duration;
        }
      }
    }
    
    // Format as Hh Mm
    let editorTime = '0m';
    if (totalSeconds > 0) {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      editorTime = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    
    // ============ OPTIMAL STREAK CALCULATION ============
    // Group sessions by date and calculate daily totals
    const dailyTotals = new Map();
    
    for (const session of allSessions) {
      if (!session.start || !session.date) continue;
      
      let duration = 0;
      if (session.end && session.start) {
        duration = (session.end - session.start) / 1000;
      }
      
      // Only count sessions >= 3 seconds and cap at 3 hours
      if (duration >= MIN_SESSION_SECONDS) {
        duration = Math.min(duration, MAX_SESSION_HOURS * 3600);
        const current = dailyTotals.get(session.date) || 0;
        dailyTotals.set(session.date, current + duration);
      }
    }
    
    // Calculate streak - only count days with at least 1 minute of coding
    const MIN_DAILY_SECONDS = 60;
    let streak = 0;
    
    if (dailyTotals.size > 0) {
      const sortedDates = Array.from(dailyTotals.keys()).sort((a, b) => b.localeCompare(a));
      let expectedDate = dateStr;
      
      for (const date of sortedDates) {
        const dailyTotal = dailyTotals.get(date);
        
        if (date === expectedDate && dailyTotal >= MIN_DAILY_SECONDS) {
          streak++;
          // Move to previous day
          const prev = new Date(expectedDate);
          prev.setDate(prev.getDate() - 1);
          expectedDate = prev.toISOString().slice(0, 10);
        } else if (date < expectedDate) {
          // Gap in streak
          break;
        }
      }
    }
    
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

router.get('/profile', ensureAuth, (req, res) => {
  const CodeFile = require('../models/CodeFile');
  CodeFile.countDocuments({ userId: req.user.username }).then(codeCount => {
    res.render('profile', {
      title: 'Profile - Edit',
      user: req.user,
      sessionActive: req.isAuthenticated && req.isAuthenticated(),
      codeCount
    });
  });
});

// Protected static SPA editor
router.get('/editor', ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

router.get('/whiteboard', ensureAuth, (req, res) => {
  const fallbackId = (req.user && (req.user.username || (req.user._id ? String(req.user._id) : null))) || 'shared-room';
  const roomId = (req.query.room && String(req.query.room)) || fallbackId;
  res.render('whiteboard', {
    title: 'Whiteboard - Edit',
    user: req.user,
    roomId
  });
});

// Admin example (owner only)
router.get('/admin', ensureOwner, (req, res) => {
  res.render('dashboard', {
    title: 'Admin Panel',
    user: req.user,
    admin: true
  });
});

module.exports = router;