function sanitizeReturnPath(value) {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch (_) {
    decoded = value;
  }
  if (typeof decoded !== 'string') return null;
  if (!decoded.startsWith('/')) return null;
  return decoded;
}

function rememberReturnPath(req, explicitPath) {
  if (!req || !req.session) return;
  const target = sanitizeReturnPath(explicitPath || req.originalUrl || req.url);
  if (target) {
    req.session.returnTo = target;
  }
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  rememberReturnPath(req);
  const target = (req.session && req.session.returnTo) || '/editor';
  const loginUrl = `/login?error=auth_required&next=${encodeURIComponent(target)}`;
  return res.redirect(loginUrl);
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
    (req.user.role === 'admin' || req.user.email === process.env.ADMIN_EMAIL)
  ) {
    return next();
  }
  return res.status(403).render('error', {
    title: 'Access Denied',
    message: 'Administrator access required',
    error: { status: 403 }
  });
}

module.exports = { ensureAuth, ensureGuest, ensureOwner, rememberReturnPath, sanitizeReturnPath };