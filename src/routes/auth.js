const express = require('express');
const passport = require('passport');
const { sanitizeReturnPath } = require('../middleware/auth');
const router = express.Router();

function finishOAuthLogin(req, res, next, user) {
  // Preserve returnTo before regenerating the session
  const stored = req.session && req.session.returnTo;
  const safeStored = sanitizeReturnPath(stored);
  const safeState = (() => {
    if (typeof req.query.state !== 'string') return null;
    try {
      return sanitizeReturnPath(decodeURIComponent(req.query.state));
    } catch (_err) {
      return null;
    }
  })();
  const safePath = safeStored || safeState || '/editor';

  if (!req.session || typeof req.session.regenerate !== 'function') {
    return req.login(user, (err) => {
      if (err) return next(err);
      if (req.session) delete req.session.returnTo;
      return res.redirect(safePath);
    });
  }

  req.session.regenerate((regenErr) => {
    if (regenErr) return next(regenErr);
    // Restore returnTo is not necessary; we already computed safePath.
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      if (req.session) delete req.session.returnTo;
      return res.redirect(safePath);
    });
  });
}

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
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect('/login?error=oauth_failed');
    return finishOAuthLogin(req, res, next, user);
  })(req, res, next);
});

  // GitHub OAuth
  router.get('/github', (req, res, next) => {
    const nextPath = sanitizeReturnPath(req.query.next || (req.session && req.session.returnTo));
    if (nextPath && req.session) {
      req.session.returnTo = nextPath;
    }
    const authOptions = { scope: ['user:email'] };
    if (nextPath) {
      authOptions.state = encodeURIComponent(nextPath);
    }
    return passport.authenticate('github', authOptions)(req, res, next);
  });

  // GitHub callback
  router.get('/github/callback', (req, res, next) => {
    passport.authenticate('github', (err, user) => {
      if (err) return next(err);
      if (!user) return res.redirect('/login?error=oauth_failed');
      return finishOAuthLogin(req, res, next, user);
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