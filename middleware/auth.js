function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.redirect('/login?error=auth_required');
}

function ensureGuest(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/editor');
  return next();
}

function ensureOwner(req, res, next) {
  if (
    req.isAuthenticated &&
    req.isAuthenticated() &&
    req.user &&
    (req.user.email === 'nr750001@gmail.com' || req.user.role === 'admin')
  ) {
    return next();
  }
  return res.status(403).render('error', {
    title: 'Access Denied',
    error: 'Not authorized'
  });
}

module.exports = { ensureAuth, ensureGuest, ensureOwner };