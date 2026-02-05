const express = require('express');
const passport = require('passport');
const router = express.Router();

// Start OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' }),
  (req, res) => {
    return res.redirect('/editor');
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