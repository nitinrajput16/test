const express = require('express');
const path = require('path');
const { ensureAuth, ensureGuest, sanitizeReturnPath } = require('../middleware/auth');

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

router.use('/', require('./dashboard'));
router.use('/', require('./admin'));

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


module.exports = router;