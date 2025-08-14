// middleware/auth.js
// Safe, minimal, side-effect free auth middleware

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/login?error=auth_required');
}

function ensureGuest(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('editor');
  }
  return next();
}

function ensureOwner(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && (
      req.user.email === 'nitinrajput16@gmail.com' ||
      req.user.email === 'nr750001@gmail.com' ||
      req.user.email === 'nr750001@something.com'
    )) {
    return next();
  }
  return res.status(403).render('error', {
    title: 'Access Denied',
    error: 'You do not have permission to access this resource.'
  });
}

module.exports = { ensureAuth, ensureGuest, ensureOwner };