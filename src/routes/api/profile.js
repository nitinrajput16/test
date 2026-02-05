const express = require('express');
const router = express.Router();
const User = require('../../models/users');
const ensureAuth = require('../../middleware/ensureAuth');

// View another user's profile by username or email
router.get('/:key', ensureAuth, async (req, res) => {
  try {
    let user;
    if (req.params.key.includes('@')) {
      // Search by email
      user = await User.findOne({ email: req.params.key }).lean();
    } else {
      // Search by username
      user = await User.findOne({ username: req.params.key }).lean();
    }
    if (!user) return res.status(404).send('User not found');
    if (req.user && user.username === req.user.username) {
      return res.redirect('/profile');
    }
  res.render('profile', { user, viewingOther: true, title: `${user.displayName}'s Profile`, sessionActive: false, codeCount: 0 });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).send('Error loading profile');
  }
});

module.exports = router;
