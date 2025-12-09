const express = require('express');
const router = express.Router();
const User = require('../../models/users');
const ensureAuth = require('../../middleware/ensureAuth');

// View another user's profile by email or ID
router.get('/:key', ensureAuth, async (req, res) => {
  try {
    let user;
    if (req.params.key.includes('@')) {
      user = await User.findOne({ email: req.params.key }).lean();
    } else {
      user = await User.findById(req.params.key).lean();
    }
    if (!user) return res.status(404).send('User not found');
    if (req.user && user._id.toString() === req.user._id.toString()) {
      return res.redirect('/profile');
    }
  res.render('profile', { user, viewingOther: true, title: `${user.displayName}'s Profile`, sessionActive: false });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).send('Error loading profile');
  }
});

module.exports = router;
