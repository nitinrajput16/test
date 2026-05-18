const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../../models/users');
const CodeFile = require('../../models/CodeFile');
const EditorSession = require('../../models/EditorSession');
const ensureAuth = require('../../middleware/ensureAuth');

function logProfileError(context, err) {
  console.error(`[Profile] ${context}`, err && err.stack ? err.stack : err);
}

function sendProfileError(res, status, message, details) {
  const payload = { error: message };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  return res.status(status).json(payload);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

// ── Username availability check ──────────────────────────────────────────────
// GET /profile/check-username?username=foo
router.get('/check-username', ensureAuth, async (req, res) => {
  try {
    const raw = String(req.query.username || '').trim().toLowerCase();

    // Validate format
    if (!raw) return res.json({ available: false, error: 'Username is required.' });
    if (raw.length < 3) return res.json({ available: false, error: 'Must be at least 3 characters.' });
    if (raw.length > 20) return res.json({ available: false, error: 'Must be 20 characters or less.' });
    if (!/^[a-z0-9_]+$/.test(raw)) return res.json({ available: false, error: 'Only letters, numbers and underscores allowed.' });

    // Same username as current user → always valid (no change)
    if (raw === req.user.username) return res.json({ available: true, same: true });

    const existing = await User.findOne({ username: raw }).lean();
    if (existing) return res.json({ available: false, error: 'Username is already taken.' });

    return res.json({ available: true });
  } catch (err) {
    logProfileError('check-username error', err);
    return sendProfileError(res, 500, 'Server error. Try again.');
  }
});

// ── Update own profile ───────────────────────────────────────────────────────
// PUT /profile/update
router.put('/update', ensureAuth, async (req, res) => {
  try {
    const { displayName, username, avatar } = req.body || {};
    const updates = {};
    const previousUsername = req.user.username;

    // Display name
    const newDisplayName = String(displayName || '').trim();
    if (newDisplayName.length > 0) {
      if (newDisplayName.length > 50) return res.status(400).json({ error: 'Display name must be 50 characters or less.' });
      updates.displayName = newDisplayName;
    }

    // Avatar URL (basic safety check - allow empty to clear)
    if (typeof avatar === 'string') {
      const trimmedAvatar = avatar.trim();
      if (trimmedAvatar && !/^https?:\/\//i.test(trimmedAvatar)) {
        return res.status(400).json({ error: 'Avatar must be an https:// URL.' });
      }
      updates.avatar = trimmedAvatar;
    }

    // Username (must have been pre-checked)
    if (typeof username === 'string' && username.trim()) {
      const newUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
        return res.status(400).json({ error: 'Invalid username format.' });
      }
      // Double-check availability server-side
      if (newUsername !== req.user.username) {
        const taken = await User.findOne({ username: newUsername }).lean();
        if (taken) return res.status(409).json({ error: 'Username is already taken.' });
      }
      updates.username = newUsername;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'User not found.' });

    if (updates.username && updates.username !== previousUsername) {
      await Promise.all([
        CodeFile.updateMany({ userId: previousUsername }, { $set: { userId: updates.username } }),
        EditorSession.updateMany({ userId: previousUsername }, { $set: { userId: updates.username } }),
        User.updateMany(
          { friends: previousUsername },
          { $set: { 'friends.$[friendName]': updates.username } },
          { arrayFilters: [{ friendName: previousUsername }] }
        )
      ]);
    }

    // Refresh the session user object so the UI reflects the new data immediately
    Object.assign(req.user, updates);

    return res.json({ success: true, message: 'Profile updated successfully!', user: { displayName: updated.displayName, username: updated.username, avatar: updated.avatar } });
  } catch (err) {
    logProfileError('update error', err);
    return sendProfileError(res, 500, 'Server error. Could not update profile.');
  }
});

// ── Update email and/or password ────────────────────────────────────────────
// PUT /profile/credentials
router.put('/credentials', ensureAuth, async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body || {};
    const nextEmail = String(email || '').trim().toLowerCase();
    const nextPassword = String(newPassword || '');
    const current = String(currentPassword || '');

    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ error: 'User not found.' });

    const emailChanged = nextEmail && nextEmail !== me.email;
    const passwordChanged = Boolean(nextPassword);

    if (!emailChanged && !passwordChanged) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    if (emailChanged) {
      if (!isValidEmail(nextEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }

      const taken = await User.findOne({ email: nextEmail, _id: { $ne: me._id } }).lean();
      if (taken) {
        return res.status(409).json({ error: 'Email is already in use.' });
      }
    }

    if (passwordChanged && !isStrongPassword(nextPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.' });
    }

    if (me.passwordHash && (emailChanged || passwordChanged)) {
      if (!current) {
        return res.status(400).json({ error: 'Current password is required.' });
      }

      const isMatch = await bcrypt.compare(current, me.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    if (emailChanged) {
      me.email = nextEmail;
      req.user.email = nextEmail;
    }

    if (passwordChanged) {
      me.passwordHash = await bcrypt.hash(nextPassword, 12);
      req.user.passwordHash = me.passwordHash;
    }

    await me.save();

    return res.json({
      success: true,
      message: passwordChanged && emailChanged ? 'Email and password updated.' : emailChanged ? 'Email updated.' : 'Password updated.',
      user: {
        email: me.email,
        hasPassword: Boolean(me.passwordHash)
      }
    });
  } catch (err) {
    logProfileError('credentials error', err);
    return sendProfileError(res, 500, 'Server error. Could not update credentials.');
  }
});

// ── Delete account ──────────────────────────────────────────────────────────
// DELETE /profile/account
router.delete('/account', ensureAuth, async (req, res, next) => {
  try {
    const { currentPassword, confirmText } = req.body || {};
    const confirmation = String(confirmText || '').trim().toUpperCase();
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm account removal.' });
    }

    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ error: 'User not found.' });

    if (me.passwordHash) {
      const password = String(currentPassword || '');
      if (!password) {
        return res.status(400).json({ error: 'Current password is required.' });
      }

      const isMatch = await bcrypt.compare(password, me.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const username = me.username;
    await Promise.all([
      CodeFile.deleteMany({ userId: username }),
      EditorSession.deleteMany({ userId: username }),
      User.updateMany({ friends: username }, { $pull: { friends: username } }),
      User.findByIdAndDelete(me._id)
    ]);

    req.logout((logoutErr) => {
      if (logoutErr) return next(logoutErr);
      const sid = req.sessionID;
      req.session.destroy(() => {
        res.clearCookie('editSessionId');
        console.log('[PROFILE] account deleted and session destroyed', sid);
        return res.json({ success: true, redirect: '/login?message=account_removed' });
      });
    });
  } catch (err) {
    logProfileError('delete-account error', err);
    return sendProfileError(res, 500, 'Server error. Could not remove account.');
  }
});

// ── Friends: add ────────────────────────────────────────────────────────────
// POST /profile/friends/add
router.post('/friends/add', ensureAuth, async (req, res) => {
  try {
    const target = String(req.body.username || '').trim().toLowerCase();
    if (!target) return res.status(400).json({ error: 'Username required.' });
    if (target === req.user.username) return res.status(400).json({ error: 'You cannot add yourself.' });

    const targetUser = await User.findOne({ username: target }, 'username displayName avatar').lean();
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ error: 'Session error.' });

    if ((me.friends || []).includes(target)) {
      return res.status(409).json({ error: 'Already in your friends list.' });
    }

    me.friends = [...(me.friends || []), target];
    await me.save();
    req.user.friends = me.friends;

    return res.json({ success: true, message: `${targetUser.displayName} added!`, friend: targetUser });
  } catch (err) {
    logProfileError('add-friend error', err);
    return sendProfileError(res, 500, 'Server error.');
  }
});

// ── Friends: remove ───────────────────────────────────────────────────────────
// DELETE /profile/friends/remove
router.delete('/friends/remove', ensureAuth, async (req, res) => {
  try {
    const target = String(req.body.username || '').trim().toLowerCase();
    if (!target) return res.status(400).json({ error: 'Username required.' });

    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: target } });
    req.user.friends = (req.user.friends || []).filter(u => u !== target);

    return res.json({ success: true, message: 'Friend removed.' });
  } catch (err) {
    logProfileError('remove-friend error', err);
    return sendProfileError(res, 500, 'Server error.');
  }
});

// ── View another user's profile by username or email ─────────────────────────
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
  res.render('profile', {
    user,
    viewingOther: true,
    title: `${user.displayName}'s Profile`,
    sessionActive: false,
    codeCount: 0,
    fileList: [],
    editorTime: '0m',
    streak: 0,
    friendsData: [],
    hasPassword: Boolean(user.passwordHash)
  });
  } catch (err) {
    logProfileError('view-profile error', err);
    return sendProfileError(res, 500, 'Error loading profile');
  }
});

module.exports = router;
