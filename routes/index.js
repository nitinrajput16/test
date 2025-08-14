const express = require('express');
const path = require('path');
const { ensureAuth, ensureGuest, ensureOwner } = require('../middleware/auth');

const router = express.Router();

// Root logic
router.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/editor');
  return res.redirect('/login');
});

// Login
router.get('/login', ensureGuest, (req, res) => {
  res.render('login', {
    title: 'Login - Edit',
    error: req.query.error || null,
    message: req.query.message || null
  });
});

// Optional dashboard (EJS UI if you still want it)
router.get('/dashboard', ensureAuth, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard - Edit',
    user: req.user
  });
});

// Protected static SPA editor
router.get('/editor', ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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