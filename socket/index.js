const { Server } = require('socket.io');
const crypto = require('crypto');

/**
 * Initialize Socket.IO with session sharing & basic collaboration events.
 * @param {http.Server} server
 * @param {object} deps
 * @param {function} deps.sessionMiddleware
 */
function initSocket(server, { sessionMiddleware }) {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Attach express-session to socket
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  // Auth gate
  io.use((socket, next) => {
    const sess = socket.request.session;
    if (!sess || !sess.passport || !sess.passport.user) {
      return next(new Error('Unauthorized (no session user)'));
    }
    socket.user = sess.passport.user;
    next();
  });

  const roomPresence = new Map(); // roomId -> Set<userId>
  const lastUpdateHash = new Map(); // roomId -> hash

  function addPresence(room, uid) {
    if (!roomPresence.has(room)) roomPresence.set(room, new Set());
    roomPresence.get(room).add(uid);
  }
  function removePresence(room, uid) {
    if (!roomPresence.has(room)) return;
    const set = roomPresence.get(room);
    set.delete(uid);
    if (!set.size) roomPresence.delete(room);
  }
  function listPresence(room) {
    return roomPresence.has(room) ? Array.from(roomPresence.get(room)) : [];
  }

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log('[SOCKET] connected:', user.email);

    socket.on('join-room', (roomId) => {
      if (!roomId) return;
      socket.join(roomId);
      addPresence(roomId, user.id);
      io.to(roomId).emit('presence:update', { users: listPresence(roomId) });
    });

    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      removePresence(roomId, user.id);
      io.to(roomId).emit('presence:update', { users: listPresence(roomId) });
    });

    socket.on('code-update', ({ roomId, content }) => {
      if (!roomId || typeof content !== 'string') return;
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      if (lastUpdateHash.get(roomId) === hash) return;
      lastUpdateHash.set(roomId, hash);
      socket.to(roomId).emit('code-update', { content, from: user.id });
    });

    socket.on('cursor-update', ({ roomId, cursor }) => {
      if (!roomId || !cursor) return;
      socket.to(roomId).emit('cursor-update', { userId: user.id, cursor });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        removePresence(room, user.id);
        io.to(room).emit('presence:update', { users: listPresence(room) });
      }
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] disconnected:', user.email);
    });
  });

  return io;
}

module.exports = { initSocket };