const express = require('express');
const passport = require('passport');
const { sanitizeReturnPath } = require('../middleware/auth');
const router = express.Router();

// Capture ?next param before starting OAuth so we can redirect there after login
router.get('/google', (req, res, next) => {
  const nextPath = sanitizeReturnPath(req.query.next || (req.session && req.session.returnTo));
  if (nextPath && req.session) {
    req.session.returnTo = nextPath;
  }
  const authOptions = { scope: ['profile', 'email'] };
  if (nextPath) {
    authOptions.state = encodeURIComponent(nextPath);
  }
  return passport.authenticate('google', authOptions)(req, res, next);
});

// Callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' }),
  (req, res) => {
    let stored = req.session && req.session.returnTo;
    if (req.session) delete req.session.returnTo;
    let safePath = sanitizeReturnPath(stored);
    if (!safePath) {
      let fromState = null;
      if (typeof req.query.state === 'string') {
        try {
          fromState = sanitizeReturnPath(decodeURIComponent(req.query.state));
        } catch (_err) {
          fromState = null;
        }
      }
      safePath = fromState || '/editor';
    }
    return res.redirect(safePath);
  }
);

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