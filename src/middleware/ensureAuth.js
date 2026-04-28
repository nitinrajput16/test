module.exports = function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};