const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { sanitizeReturnPath } = require('../middleware/auth');
const User = require('../models/users');
const router = express.Router();

// Validation rules
const signupValidation = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match')
];

const loginValidation = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
];

function finishOAuthLogin(req, res, next, user) {
  if (!user || !user._id) {
    console.error('[AUTH] Invalid user object in OAuth callback');
    return res.redirect('/login?error=auth_failed');
  }

  const stored = req.session?.returnTo;
  const safeStored = sanitizeReturnPath(stored);
  const safeState = (() => {
    if (typeof req.query.state !== 'string') return null;
    try { return sanitizeReturnPath(decodeURIComponent(req.query.state)); } catch { return null; }
  })();
  const safePath = safeStored || safeState || '/editor';

  if (!req.session || !req.session.regenerate) {
    console.warn('[AUTH] Session regeneration not available, proceeding with caution');
    return req.login(user, (err) => {
      if (err) return next(err);
      if (req.session) delete req.session.returnTo;
      res.redirect(safePath);
    });
  }

  req.session.regenerate((regenErr) => {
    if (regenErr) {
      console.error('[AUTH] Session regeneration failed:', regenErr);
      return next(regenErr);
    }
    
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('[AUTH] Login failed:', loginErr);
        return next(loginErr);
      }
      
      delete req.session.returnTo;
      console.log('[AUTH] User authenticated:', user.username || user._id);
      res.redirect(safePath);
    });
  });
}

// ---------- LOCAL AUTH ROUTES ----------

// Signup page
router.get('/signup', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/editor');
  }
  res.render('signup', {
    title: 'Sign Up',
    error: req.query.error || null,
    next: req.query.next || null
  });
});

// Signup POST
router.post('/signup', signupValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMsg = errors.array()[0].msg;
      return res.redirect(`/auth/signup?error=${encodeURIComponent(errorMsg)}`);
    }
    
    const { email, password, displayName } = req.body;
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.redirect('/auth/signup?error=Email already registered');
    }
    
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const username = await User.generateUsername(email);
    
    const newUser = await User.create({
      username,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split('@')[0],
      provider: 'local'
    });
    
    console.log('[AUTH] New local user created:', newUser.email, '→', username);
    
    req.login(newUser, (err) => {
      if (err) return next(err);
      const nextPath = sanitizeReturnPath(req.query.next) || '/editor';
      res.redirect(nextPath);
    });
    
  } catch (err) {
    console.error('[AUTH] Signup error:', err.message);
    res.redirect('/auth/signup?error=Server error, please try again');
  }
});

// Login POST
router.post('/login', loginValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array()[0].msg;
    return res.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
  }
  
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    
    if (!user) {
      const message = info?.message || 'Authentication failed';
      return res.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
    
    finishOAuthLogin(req, res, next, user);
  })(req, res, next);
});

// ---------- OAUTH ROUTES ----------

router.get('/google', (req, res, next) => {
  const nextPath = sanitizeReturnPath(req.query.next || req.session?.returnTo);
  if (nextPath && req.session) req.session.returnTo = nextPath;
  const authOptions = { scope: ['profile', 'email'] };
  if (nextPath) authOptions.state = encodeURIComponent(nextPath);
  passport.authenticate('google', authOptions)(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect('/login?error=oauth_failed');
    finishOAuthLogin(req, res, next, user);
  })(req, res, next);
});

router.get('/github', (req, res, next) => {
  const nextPath = sanitizeReturnPath(req.query.next || req.session?.returnTo);
  if (nextPath && req.session) req.session.returnTo = nextPath;
  const authOptions = { scope: ['user:email'] };
  if (nextPath) authOptions.state = encodeURIComponent(nextPath);
  passport.authenticate('github', authOptions)(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect('/login?error=oauth_failed');
    finishOAuthLogin(req, res, next, user);
  })(req, res, next);
});

// Status JSON (debug)
router.get('/status', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated && req.isAuthenticated(),
    user: req.user || null
  });
});

// Logout
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    const sid = req.sessionID;
    req.session.destroy(() => {
      res.clearCookie('editSessionId');
      console.log('[LOGOUT] session destroyed', sid);
      res.redirect('/login?message=logged_out');
    });
  });
});

module.exports = router;