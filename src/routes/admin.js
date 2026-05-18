const express = require('express');
const { ensureAdmin } = require('../middleware/auth');

const router = express.Router();

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePage(value, fallback = 1) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildPagination(total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  return { total, totalPages, currentPage, limit, hasPrev: currentPage > 1, hasNext: currentPage < totalPages };
}

router.get('/admin', ensureAdmin, async (req, res, next) => {
  try {

    const [User, CodeFile, EditorSession] = [
      require('../models/users'),
      require('../models/CodeFile'),
      require('../models/EditorSession')
    ];

    const userSearch = String(req.query.userSearch || '').trim();
    const fileSearch = String(req.query.fileSearch || '').trim();
    const sessionSearch = String(req.query.sessionSearch || '').trim();

    const userPage = parsePage(req.query.userPage, 1);
    const filePage = parsePage(req.query.filePage, 1);
    const sessionPage = parsePage(req.query.sessionPage, 1);

    const pageSize = 10;

    const userFilter = userSearch
      ? {
          $or: [
            { username: new RegExp(escapeRegExp(userSearch), 'i') },
            { email: new RegExp(escapeRegExp(userSearch), 'i') },
            { displayName: new RegExp(escapeRegExp(userSearch), 'i') }
          ]
        }
      : {};

    const fileFilter = fileSearch
      ? {
          $or: [
            { filename: new RegExp(escapeRegExp(fileSearch), 'i') },
            { userId: new RegExp(escapeRegExp(fileSearch), 'i') },
            { parentPath: new RegExp(escapeRegExp(fileSearch), 'i') }
          ]
        }
      : {};

    const sessionFilter = sessionSearch
      ? {
          $or: [
            { userId: new RegExp(escapeRegExp(sessionSearch), 'i') },
            { date: new RegExp(escapeRegExp(sessionSearch), 'i') }
          ]
        }
      : {};

    const [userCount, fileCount, sessionCount] = await Promise.all([
      User.countDocuments(userFilter),
      CodeFile.countDocuments(fileFilter),
      EditorSession.countDocuments(sessionFilter)
    ]);

    const userPagination = buildPagination(userCount, userPage, pageSize);
    const filePagination = buildPagination(fileCount, filePage, pageSize);
    const sessionPagination = buildPagination(sessionCount, sessionPage, pageSize);

    const [users, files, sessions] = await Promise.all([
      User.find(userFilter, 'username email displayName provider role createdAt updatedAt').sort({ createdAt: -1 }).skip((userPagination.currentPage - 1) * pageSize).limit(pageSize).lean(),
      CodeFile.find(fileFilter, 'userId filename parentPath type language size updatedAt createdAt').sort({ updatedAt: -1 }).skip((filePagination.currentPage - 1) * pageSize).limit(pageSize).lean(),
      EditorSession.find(sessionFilter, 'userId start end date createdAt updatedAt').sort({ start: -1 }).skip((sessionPagination.currentPage - 1) * pageSize).limit(pageSize).lean()
    ]);

    const usersPage = users;
    const filesPage = files;
    const sessionsPage = sessions;

    return res.render('dashboard', {
      title: 'Admin Panel',
      user: req.user,
      admin: true,
      fileList: filesPage,
      codeCount: fileCount,
      editorTime: 'Admin view',
      streak: 0,
      adminStats: {
        userCount,
        fileCount,
        sessionCount
      },
      adminUsers: usersPage,
      adminFiles: filesPage,
      adminSessions: sessionsPage,
      adminQueries: {
        userSearch,
        fileSearch,
        sessionSearch
      },
      adminPagination: {
        users: userPagination,
        files: filePagination,
        sessions: sessionPagination
      }
    });
  } catch (error) {
    console.error('Admin panel error:', error);
    next(error);
  }
});

router.post('/admin/user/:id/role', ensureAdmin, async (req, res, next) => {
  try {

    const User = require('../models/users');
    const targetId = String(req.params.id || '').trim();
    const role = String(req.body.role || '').trim().toLowerCase();

    if (!targetId || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role update request.' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    target.role = role;
    await target.save();

    return res.redirect('/admin');
  } catch (error) {
    console.error('Admin role update error:', error);
    next(error);
  }
});

router.post('/admin/user/:id/delete', ensureAdmin, async (req, res, next) => {
  try {

    const User = require('../models/users');
    const CodeFile = require('../models/CodeFile');
    const EditorSession = require('../models/EditorSession');

    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'Invalid user id.' });
    if (String(req.user._id) === targetId) {
      return res.status(400).json({ error: 'You cannot delete your own account from the admin console.' });
    }

    const target = await User.findById(targetId).lean();
    if (!target) return res.status(404).json({ error: 'User not found.' });

    await Promise.all([
      CodeFile.deleteMany({ userId: target.username }),
      EditorSession.deleteMany({ userId: target.username }),
      User.updateMany({ friends: target.username }, { $pull: { friends: target.username } }),
      User.findByIdAndDelete(targetId)
    ]);

    return res.redirect('/admin');
  } catch (error) {
    console.error('Admin user delete error:', error);
    next(error);
  }
});

router.post('/admin/file/:id/delete', ensureAdmin, async (req, res, next) => {
  try {

    const CodeFile = require('../models/CodeFile');
    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'Invalid file id.' });

    const target = await CodeFile.findById(targetId).lean();
    if (!target) return res.status(404).json({ error: 'File not found.' });

    if (target.type === 'directory') {
      const fullPath = (target.parentPath === '/' ? '' : target.parentPath) + '/' + target.filename;
      const regex = new RegExp('^' + escapeRegExp(fullPath) + '(?:/|$)');
      await CodeFile.deleteMany({ userId: target.userId, $or: [{ _id: targetId }, { parentPath: regex }] });
    } else {
      await CodeFile.findByIdAndDelete(targetId);
    }

    return res.redirect('/admin');
  } catch (error) {
    console.error('Admin file delete error:', error);
    next(error);
  }
});

router.post('/admin/session/:id/delete', ensureAdmin, async (req, res, next) => {
  try {

    const EditorSession = require('../models/EditorSession');
    const targetId = String(req.params.id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'Invalid session id.' });

    const removed = await EditorSession.findByIdAndDelete(targetId);
    if (!removed) return res.status(404).json({ error: 'Session not found.' });

    return res.redirect('/admin');
  } catch (error) {
    console.error('Admin session delete error:', error);
    next(error);
  }
});

module.exports = router;