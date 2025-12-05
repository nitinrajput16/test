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
    const User = require('../models/users');
    let user = sess.passport.user;
    // If user is just an ID, fetch from DB
    if (typeof user === 'string' || (user._id && !user.displayName)) {
      User.findById(user._id || user).lean().then(fullUser => {
        socket.user = fullUser;
        next();
      }).catch(err => next(err));
    } else {
      socket.user = user;
      next();
    }
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

  // --- Presence Avatars/Cursors ---
  // Map: roomId -> { userId: { id, name, color, position } }
  const roomUserPresence = new Map();

  function getUserInfo(user, color, socketId) {
    return {
      id: user._id ? String(user._id) : (user.googleId ? String(user.googleId) : (user.id ? String(user.id) : null)),
      socketId: socketId || null,
      name: user.displayName || user.username || 'User',
      email: user.email,
      avatar: user.avatar,
      googleId: user.googleId,
      color: color,
      position: null
    };
  }

  io.on('connection', (socket) => {
    const user = socket.user;
    // Helper to get unique user ID for this socket
    function getSocketUserId() {
      return (user && (user._id ? String(user._id) : (user.googleId ? String(user.googleId) : (user.id ? String(user.id) : null)))) || socket.id;
    }

    // Helper to assign unique color per user in a room
    function assignColors(roomId) {
      const COLORS = [
        '#E74C3C', // Red
        '#3498DB', // Blue
        '#F1C40F', // Yellow
        '#9B59B6', // Purple
        '#1ABC9C', // Cyan
        '#E91E63', // Pink
        '#8D6E63', // Brown
        '#7F8C8D'  // Grey
      ];
      if (!roomUserPresence.has(roomId)) return;
      const userIds = Object.keys(roomUserPresence.get(roomId));
      userIds.forEach((uid, idx) => {
        roomUserPresence.get(roomId)[uid].color = COLORS[idx % COLORS.length];
      });
    }
    console.log('[SOCKET] connected:', user.email);

    socket.on('join-room', (roomId) => {
      if (!roomId) return;
      // Use _id or googleId as unique id
      const uniqueId = getSocketUserId();
      socket.join(roomId);
      addPresence(roomId, uniqueId);
      // Add to presence map
  if (!roomUserPresence.has(roomId)) roomUserPresence.set(roomId, {});
  // Patch user object for downstream use and store socket id for mapping
  const userInfo = Object.assign({}, user, { id: uniqueId });
  roomUserPresence.get(roomId)[uniqueId] = getUserInfo(userInfo, undefined, socket.id);
  assignColors(roomId);
  io.to(roomId).emit('presence-update', roomUserPresence.get(roomId));
  // Emit current users array to the room (clients expect an array of user info)
  io.to(roomId).emit('user-name', Object.values(roomUserPresence.get(roomId)));

      // --- Emit all carets to all users in the room ---
      const allCaretsMap = roomUserPresence.get(roomId);
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients) {
        for (const clientId of clients) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (!clientSocket) continue;
          const clientUser = clientSocket.user;
          const clientUserId = clientUser && (clientUser._id ? String(clientUser._id) : (clientUser.googleId ? String(clientUser.googleId) : (clientUser.id ? String(clientUser.id) : 'unknown')));
          const allCarets = Object.entries(allCaretsMap)
            .filter(([uid, u]) => typeof u.caretOffset === 'number' && uid !== clientUserId)
            .map(([uid, u]) => ({ userId: uid, offset: u.caretOffset }));
          clientSocket.emit('remote-caret', { allCarets });
        }
      }
    });

    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      removePresence(roomId, user._id ? String(user._id) : (user.googleId ? String(user.googleId) : (user.id ? String(user.id) : null)));
      // Send presence-update and user list to remaining clients in room
      io.to(roomId).emit('presence-update', { users: listPresence(roomId) });
      const usersArray = roomUserPresence.has(roomId) ? Object.values(roomUserPresence.get(roomId)) : [];
      io.to(roomId).emit('user-name', usersArray);
    });

    socket.on('code-update', ({ roomId, content }) => {
      if (!roomId || typeof content !== 'string') return;
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      if (lastUpdateHash.get(roomId) === hash) return;
      lastUpdateHash.set(roomId, hash);
      socket.to(roomId).emit('code-update', { content, from: user._id ? String(user._id) : (user.googleId ? String(user.googleId) : (user.id ? String(user.id) : null)) });
    });

    socket.on('cursor-update', ({ roomId, cursor }) => {
      if (!roomId || !cursor) return;
      socket.to(roomId).emit('cursor-update', { userId: user._id ? String(user._id) : (user.googleId ? String(user.googleId) : (user.id ? String(user.id) : null)), cursor });
    });

    socket.on('presence-cursor', ({ position }) => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        if (!roomUserPresence.has(roomId)) continue;
        const uid = user._id ? String(user._id) : (user.googleId ? String(user.googleId) : (user.id ? String(user.id) : null));
        if (!roomUserPresence.get(roomId)[uid]) continue;
        roomUserPresence.get(roomId)[uid].position = position;
        io.to(roomId).emit('presence-update', roomUserPresence.get(roomId));
        io.to(roomId).emit('user-name', Object.values(roomUserPresence.get(roomId)));
      }
    });

    // --- Voice chat signaling (P2P WebRTC over Socket.IO) ---
    socket.on('voice-join', ({ roomId }) => {
      if (!roomId) return;
      // Notify others in the room to initiate WebRTC toward this peer
      socket.to(roomId).emit('voice-peer-joined', { peerId: socket.id });
    });

    socket.on('voice-leave', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('voice-peer-left', { peerId: socket.id });
    });

    socket.on('voice-offer', ({ roomId, to, offer }) => {
      if (!roomId || !to || !offer) return;
      io.to(to).emit('voice-offer', { from: socket.id, offer });
    });

    socket.on('voice-answer', ({ roomId, to, answer }) => {
      if (!roomId || !to || !answer) return;
      io.to(to).emit('voice-answer', { from: socket.id, answer });
    });

    socket.on('voice-ice', ({ roomId, to, candidate }) => {
      if (!roomId || !to || !candidate) return;
      io.to(to).emit('voice-ice', { from: socket.id, candidate });
    });

    // Relay local mute status to other peers in the room
    socket.on('voice-mute-status', ({ roomId, muted }) => {
      if (!roomId) return;
      socket.to(roomId).emit('voice-mute-status', { peerId: socket.id, muted });
    });

    // --- BROADCAST ALL REMOTE CARET POSITIONS TO ALL USERS IN ROOM ---

    // Listen for filelist-changed and broadcast to all
    socket.on('filelist-changed', () => {
      socket.broadcast.emit('filelist-changed');
    });
    socket.on('caret-position', ({ roomId, offset }) => {
      if (!roomId || typeof offset !== 'number') return;
      const senderId = getSocketUserId();
      // Store the latest caret offset for this user in this room
      if (!roomUserPresence.has(roomId)) roomUserPresence.set(roomId, {});
      if (!roomUserPresence.get(roomId)[senderId]) {
        roomUserPresence.get(roomId)[senderId] = getUserInfo(user, undefined, socket.id);
      }
      assignColors(roomId);
      roomUserPresence.get(roomId)[senderId].caretOffset = offset;
      // Gather all carets in the room except for the requesting user
      const allCaretsMap = roomUserPresence.get(roomId);
      // For each socket in the room, send all other users' carets
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients) {
        for (const clientId of clients) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (!clientSocket) continue;
          // Get the userId for this socket
          const clientUser = clientSocket.user;
          const clientUserId = (clientUser && (clientUser._id ? String(clientUser._id) : (clientUser.googleId ? String(clientUser.googleId) : (clientUser.id ? String(clientUser.id) : null)))) || clientSocket.id;
          // Send all carets except this user's own, and include color
          const allCarets = Object.entries(allCaretsMap)
            .filter(([uid, u]) => typeof u.caretOffset === 'number' && uid !== clientUserId)
            .map(([uid, u]) => ({ userId: uid, offset: u.caretOffset, color: u.color }));
          clientSocket.emit('remote-caret', { allCarets });
        }
        // After updating carets, also broadcast the user list so clients can map ids -> display info
        io.to(roomId).emit('user-name', Object.values(allCaretsMap));
      }
    });

    socket.on('disconnecting', () => {
      const myId = getSocketUserId();
      for (const room of socket.rooms) {
        if (room === socket.id) continue;
        removePresence(room, myId);
        if (roomUserPresence.has(room)) {
          delete roomUserPresence.get(room)[myId];
          assignColors(room);
          io.to(room).emit('presence-update', roomUserPresence.get(room));
          io.to(room).emit('user-name', Object.values(roomUserPresence.get(room)));
          io.to(room).emit('voice-peer-left', { peerId: socket.id });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] disconnected:', user.email);
    });
  });

  return io;
}

module.exports = { initSocket };