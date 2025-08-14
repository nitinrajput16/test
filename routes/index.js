const express = require('express');
const { ensureAuth, ensureGuest, ensureOwner } = require('../middleware/auth');
const router = express.Router();
const path=require('path');

// Root: redirect logic only, do NOT render login directly here.
router.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/editor');
  }
  return res.redirect('/login');
});

// Login page (guest only)
router.get('/login', ensureGuest, (req, res) => {
  res.render('login', {
    title: 'Edit - Code Editor | Login',
    error: req.query.error || null,
    message: req.query.message || null,
    currentTime: new Date().toISOString()
  });
});

// Dashboard (protected)
router.get('/dashboard', ensureAuth, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard - Edit Code Editor',
    user: req.user,
    currentTime: new Date().toISOString()
  });
});

// Profile (protected)
router.get('/profile', ensureAuth, (req, res) => {
  res.render('profile', {
    title: 'Your Profile - Edit',
    user: req.user,
    currentTime: new Date().toISOString()
  });
});

// Editor (protected)
router.get('/editor', ensureAuth, (req, res) => {
    res.render('editor', {
        title: 'Code Editor - Edit',
        user: req.user,
        currentTime: new Date().toISOString()
    });
});

// Admin (owner only)
router.get('/admin', ensureOwner, (req, res) => {
  res.render('admin', {
    title: 'Admin Panel - Edit',
    user: req.user,
    currentTime: new Date().toISOString()
  });
});

module.exports = router;