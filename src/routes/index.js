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

// Optional dashboard (EJS UI if you still want it)
router.get('/dashboard', ensureAuth, (req, res) => {
  const CodeFile = require('../models/CodeFile');
  const EditorSession = require('../models/EditorSession');
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dateStr = istNow.toISOString().slice(0,10);
  Promise.all([
    CodeFile.find({ googleId: req.user.googleId }, 'filename language updatedAt size').sort({ updatedAt: -1 }).lean(),
    CodeFile.countDocuments({ googleId: req.user.googleId }),
    EditorSession.find({ googleId: req.user.googleId, date: dateStr }),
    EditorSession.find({ googleId: req.user.googleId }).distinct('date')
  ]).then(([files, codeCount, sessions, allDates]) => {
    let total = 0;
    sessions.forEach(s => {
      if (s.end && s.start) {
        total += (s.end - s.start) / 1000;
      } else if (s.start) {
        total += (now - s.start) / 1000;
      }
    });
    // Format as Hh Mm
    let editorTime = '0m';
    if (total > 0) {
      const h = Math.floor(total/3600);
      const m = Math.floor((total%3600)/60);
      editorTime = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    // Calculate streak
    let streak = 0;
    if (allDates && allDates.length) {
      // Sort dates descending
      const sorted = allDates.sort((a,b) => b.localeCompare(a));
      let current = dateStr;
      for (let i=0; i<sorted.length; i++) {
        if (sorted[i] === current) {
          streak++;
          // Move to previous day
          const prev = new Date(current);
          prev.setDate(prev.getDate()-1);
          current = prev.toISOString().slice(0,10);
        } else {
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
  }).catch(() => {
    res.render('dashboard', {
      title: 'Dashboard - Edit',
      user: req.user,
      fileList: [],
      codeCount: 0,
      editorTime: '0m',
      streak: 0
    });
  });
});

router.get('/profile', ensureAuth, (req, res) => {
  const CodeFile = require('../models/CodeFile');
  CodeFile.countDocuments({ googleId: req.user.googleId }).then(codeCount => {
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
  const fallbackId = (req.user && (req.user.googleId || (req.user._id ? String(req.user._id) : null))) || 'shared-room';
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