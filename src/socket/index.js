const { Server } = require('socket.io');
const { createRoomState, applyServerOperation } = require('../lib/ot');

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
  const roomDocs = new Map(); // roomId -> { serverDoc, serverVersion, history }
  const roomBoards = new Map(); // roomId -> Array of whiteboard items
  const roomChats = new Map(); // roomId -> Array of chat messages { userId, name, text, time, color }

  // Room Owner System
  const roomOwners = new Map();    // roomId -> ownerId (first user to join)
  const roomSettings = new Map();  // roomId -> { readOnly: boolean }
  const roomBlockList = new Map(); // roomId -> Set<userId>


  function cloneBoardSnapshot(input) {
    try {
      return JSON.parse(JSON.stringify(input || []));
    } catch (err) {
      return [];
    }
  }

  function getRoomState(roomId) {
    if (!roomDocs.has(roomId)) {
      roomDocs.set(roomId, createRoomState(''));
    }
    return roomDocs.get(roomId);
  }

  function emitRoomSync(roomId, targetSocket) {
    const state = getRoomState(roomId);
    state.syncSeq = (state.syncSeq || 0) + 1;
    const payload = {
      roomId,
      doc: state.serverDoc,
      version: state.serverVersion,
      syncId: state.syncSeq
    };
    if (targetSocket) {
      targetSocket.emit('ot-sync', payload);
    } else {
      io.to(roomId).emit('ot-sync', payload);
    }
  }

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

  function getBoardState(roomId) {
    if (!roomBoards.has(roomId)) {
      roomBoards.set(roomId, []);
    }
    return roomBoards.get(roomId);
  }

  // --- Presence Avatars/Cursors ---
  // Map: roomId -> { userId: { id, name, color, position } }
  const roomUserPresence = new Map();

  function getUserInfo(user, color, socketId) {
    return {
      id: user.username || (user._id ? String(user._id) : null),
      socketId: socketId || null,
      name: user.displayName || user.username || 'User',
      email: user.email,
      avatar: user.avatar,
      username: user.username,
      color: color,
      position: null
    };
  }

  io.on('connection', (socket) => {
    const user = socket.user;
    // Helper to get unique user ID for this socket
    function getSocketUserId() {
      return user?.username || (user?._id ? String(user._id) : null) || socket.id;
    }
    // Share resolved user id with client immediately so OT acks match
    try {
      socket.emit('whoami', { userId: getSocketUserId(), socketId: socket.id });
    } catch (err) {
      console.warn('[socket] whoami emit failed', err.message);
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

    socket.on('join-room', (roomId) => {
      if (!roomId) return;
      // Use username as unique id
      const uniqueId = getSocketUserId();

      // Check if user is blocked from this room
      if (roomBlockList.has(roomId) && roomBlockList.get(roomId).has(uniqueId)) {
        socket.emit('room-blocked', { roomId, message: 'You have been blocked from this room.' });
        return;
      }

      socket.join(roomId);
      addPresence(roomId, uniqueId);

      // Assign owner if this is the first user in the room
      if (!roomOwners.has(roomId)) {
        roomOwners.set(roomId, uniqueId);
        console.log('[Room] Owner assigned:', uniqueId, 'for room', roomId);
      }

      // Initialize room settings if not present
      if (!roomSettings.has(roomId)) {
        roomSettings.set(roomId, { readOnly: false });
      }

      // Add to presence map
      if (!roomUserPresence.has(roomId)) roomUserPresence.set(roomId, {});
      // Patch user object for downstream use and store socket id for mapping
      const userInfo = Object.assign({}, user, { id: uniqueId });
      const isOwner = roomOwners.get(roomId) === uniqueId;
      roomUserPresence.get(roomId)[uniqueId] = { ...getUserInfo(userInfo, undefined, socket.id), isOwner };
      assignColors(roomId);

      // Emit room owner info to the joining user
      socket.emit('room-owner', {
        roomId,
        ownerId: roomOwners.get(roomId),
        isOwner,
        settings: roomSettings.get(roomId)
      });

      io.to(roomId).emit('presence-update', roomUserPresence.get(roomId));
      // Emit current users array to the room (clients expect an array of user info)
      io.to(roomId).emit('user-name', Object.values(roomUserPresence.get(roomId)));

      emitRoomSync(roomId, socket);

      // Send chat history to the joining user
      if (roomChats.has(roomId)) {
        socket.emit('chat-history', { messages: roomChats.get(roomId) });
      }


      // --- Emit all carets to all users in the room ---
      const allCaretsMap = roomUserPresence.get(roomId);
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients) {
        for (const clientId of clients) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (!clientSocket) continue;
          const clientUser = clientSocket.user;
          const clientUserId = clientUser?.username || (clientUser?._id ? String(clientUser._id) : null) || clientSocket.id;
          const allCarets = Object.entries(allCaretsMap)
            .filter(([uid, u]) => typeof u.caretOffset === 'number' && uid !== clientUserId)
            .map(([uid, u]) => ({ userId: uid, offset: u.caretOffset }));
          clientSocket.emit('remote-caret', { allCarets });
        }
      }
    });

    socket.on('leave-room', (roomId) => {
      if (!roomId) return;
      socket.leave(roomId);
      const uniqueId = getSocketUserId();
      removePresence(roomId, uniqueId);

      if (roomUserPresence.has(roomId)) {
        delete roomUserPresence.get(roomId)[uniqueId];
        if (!Object.keys(roomUserPresence.get(roomId)).length) {
          roomUserPresence.delete(roomId);
        } else {
          assignColors(roomId);
        }
      }

      const presenceSnapshot = roomUserPresence.has(roomId) ? roomUserPresence.get(roomId) : {};
      io.to(roomId).emit('presence-update', presenceSnapshot);
      io.to(roomId).emit('user-name', Object.values(presenceSnapshot));
    });

    socket.on('ot-request-state', ({ roomId }) => {
      if (!roomId) return;
      emitRoomSync(roomId, socket);
    });

    socket.on('ot-reset-doc', ({ roomId, doc }) => {
      if (!roomId || typeof doc !== 'string') return;
      const state = getRoomState(roomId);
      state.serverDoc = doc;
      state.serverVersion = 0;
      state.history = [];
      emitRoomSync(roomId);
    });

    socket.on('ot-operation', ({ roomId, operation }) => {
      if (!roomId || !operation) return;

      // Block editing if room is read-only (unless user is owner)
      const settings = roomSettings.get(roomId);
      const senderId = getSocketUserId();
      const isOwner = roomOwners.get(roomId) === senderId;
      if (settings && settings.readOnly && !isOwner) {
        socket.emit('room-readonly-error', { message: 'Room is in read-only mode. Only the owner can edit.' });
        return;
      }

      const state = getRoomState(roomId);
      const sanitized = {
        type: operation.type === 'delete' ? 'delete' : 'insert',
        pos: Math.max(0, Number(operation.pos) || 0),
        text: operation.type === 'insert' ? String(operation.text || '') : undefined,
        length: operation.type === 'delete' ? Math.max(0, Number(operation.length) || 0) : undefined,
        clientVersion: Number(operation.clientVersion) || 0,
        userId: getSocketUserId()
      };
      if (sanitized.type === 'insert' && !sanitized.text) return;
      if (sanitized.type === 'delete' && !sanitized.length) return;

      // If the client claims a base version in the future, don't apply it.
      // This prevents doc corruption when clients use a wrong local counter.
      if (sanitized.clientVersion > state.serverVersion) {
        emitRoomSync(roomId, socket);
        return;
      }

      const applied = applyServerOperation(state, sanitized);
      io.to(roomId).emit('ot-operation', { roomId, operation: applied, version: state.serverVersion });
    });

    socket.on('active-file', ({ roomId, filename, language }) => {
      if (!roomId || !filename) return;
      socket.to(roomId).emit('active-file', { filename, language });
    });

    socket.on('cursor-update', ({ roomId, cursor }) => {
      if (!roomId || !cursor) return;
      socket.to(roomId).emit('cursor-update', { userId: getSocketUserId(), cursor });
    });

    socket.on('presence-cursor', ({ position }) => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        if (!roomUserPresence.has(roomId)) continue;
        const uid = getSocketUserId();
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

    // --- Event-driven collaborative whiteboard (no interval) ---
    // Stroke lifecycle: start -> point batches -> end
    socket.on('whiteboard:stroke-start', ({ roomId, strokeId, color, size, tool }) => {
      if (!roomId || !strokeId) return;
      socket.to(roomId).emit('whiteboard:stroke-start', { strokeId, color, size, tool });
    });

    socket.on('whiteboard:stroke-point', ({ roomId, strokeId, points }) => {
      if (!roomId || !strokeId || !Array.isArray(points)) return;
      // Broadcast point batch to other clients
      socket.to(roomId).emit('whiteboard:stroke-point', { strokeId, points });
    });

    socket.on('whiteboard:stroke-end', ({ roomId, strokeId, points }) => {
      if (!roomId || !strokeId) return;
      // Broadcast end event
      socket.to(roomId).emit('whiteboard:stroke-end', { strokeId, points });
      // Store completed stroke for reconnection (optional, implement if needed)
    });

    // Shape/text objects (instant complete)
    socket.on('whiteboard:shape', ({ roomId, shape }) => {
      if (!roomId || !shape) return;
      socket.to(roomId).emit('whiteboard:shape', { shape });
    });

    socket.on('whiteboard:text', ({ roomId, text }) => {
      if (!roomId || !text) return;
      socket.to(roomId).emit('whiteboard:text', { text });
    });

    // Update events for moved/edited objects
    socket.on('whiteboard:update-stroke', ({ roomId, strokeId, points }) => {
      if (!roomId || !strokeId || !Array.isArray(points)) return;
      socket.to(roomId).emit('whiteboard:update-stroke', { strokeId, points });
    });

    socket.on('whiteboard:update-shape', ({ roomId, shape }) => {
      if (!roomId || !shape) return;
      socket.to(roomId).emit('whiteboard:update-shape', { shape });
    });

    socket.on('whiteboard:update-text', ({ roomId, text }) => {
      if (!roomId || !text) return;
      socket.to(roomId).emit('whiteboard:update-text', { text });
    });

    socket.on('whiteboard:draw', ({ roomId, stroke }) => {
      if (!roomId || !stroke) return;
      socket.to(roomId).emit('whiteboard:draw', { stroke });
    });

    socket.on('whiteboard:overwrite', ({ roomId, board }) => {
      if (!roomId || !Array.isArray(board)) return;
      const snapshot = cloneBoardSnapshot(board);
      roomBoards.set(roomId, snapshot);
      socket.to(roomId).emit('whiteboard:overwrite', { board: cloneBoardSnapshot(snapshot) });
    });

    socket.on('whiteboard:clear', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('whiteboard:clear');
      roomBoards.set(roomId, []);
    });

    // Reconnection: send full stroke history
    socket.on('whiteboard:request-sync', ({ roomId }) => {
      if (!roomId) return;
      const board = cloneBoardSnapshot(getBoardState(roomId));
      socket.emit('whiteboard:sync', { board });
    });

    // --- Chat persistence ---
    socket.on('chat-history-request', ({ roomId }) => {
      if (!roomId) return;
      if (roomChats.has(roomId)) {
        socket.emit('chat-history', { messages: roomChats.get(roomId) });
      }
    });

    socket.on('chat-message', ({ roomId, text }) => {
      if (!roomId || !text || !String(text).trim()) return;

      const senderId = getSocketUserId();
      // Ensure we have user info
      if (!roomUserPresence.has(roomId)) roomUserPresence.set(roomId, {});
      let uInfo = roomUserPresence.get(roomId)[senderId];
      if (!uInfo) {
        // Fallback if not tracked yet
        uInfo = getUserInfo(user, undefined, socket.id);
        roomUserPresence.get(roomId)[senderId] = uInfo;
        assignColors(roomId);
      } else if (!uInfo.color) {
        assignColors(roomId);
      }

      const msg = {
        userId: senderId,
        name: uInfo.name,
        text: String(text).trim(),
        time: Date.now(),
        color: uInfo.color
      };

      if (!roomChats.has(roomId)) roomChats.set(roomId, []);
      const history = roomChats.get(roomId);
      history.push(msg);
      // Limit history to last 50 messages
      if (history.length > 50) history.shift();

      io.to(roomId).emit('chat-message', msg);
    });

    socket.on('chat-clear', ({ roomId }) => {
      if (!roomId) return;
      // Optional: authorize who can clear? For now, anyone in room.
      if (roomChats.has(roomId)) {
        roomChats.set(roomId, []); // Clear memory
      }
      io.to(roomId).emit('chat-clear'); // Broadcast to all
    });

    // --- ROOM OWNER CONTROLS ---

    // Toggle read-only mode
    socket.on('room-settings', ({ roomId, readOnly }) => {
      if (!roomId) return;
      const senderId = getSocketUserId();
      const ownerId = roomOwners.get(roomId);
      if (senderId !== ownerId) {
        socket.emit('room-error', { message: 'Only the room owner can change settings.' });
        return;
      }
      if (!roomSettings.has(roomId)) {
        roomSettings.set(roomId, { readOnly: false });
      }
      roomSettings.get(roomId).readOnly = !!readOnly;
      console.log('[Room] Settings updated:', roomId, roomSettings.get(roomId));
      io.to(roomId).emit('room-settings-update', { roomId, settings: roomSettings.get(roomId) });
    });

    // Kick a member from the room
    socket.on('room-kick', ({ roomId, targetUserId }) => {
      if (!roomId || !targetUserId) return;
      const senderId = getSocketUserId();
      const ownerId = roomOwners.get(roomId);
      if (senderId !== ownerId) {
        socket.emit('room-error', { message: 'Only the room owner can kick members.' });
        return;
      }
      if (targetUserId === ownerId) {
        socket.emit('room-error', { message: 'You cannot kick yourself.' });
        return;
      }
      // Find target socket and disconnect from room
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients) {
        for (const clientId of clients) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (!clientSocket) continue;
          const clientUser = clientSocket.user;
          const clientUserId = clientUser?.username || (clientUser?._id ? String(clientUser._id) : null) || clientSocket.id;
          if (clientUserId === targetUserId) {
            clientSocket.emit('room-kicked', { roomId, message: 'You have been kicked from this room by the owner.' });
            clientSocket.leave(roomId);
            // Remove from presence
            if (roomUserPresence.has(roomId)) {
              delete roomUserPresence.get(roomId)[targetUserId];
            }
            removePresence(roomId, targetUserId);
            console.log('[Room] Kicked:', targetUserId, 'from', roomId);
            break;
          }
        }
      }
      // Broadcast updated presence
      const presenceSnapshot = roomUserPresence.has(roomId) ? roomUserPresence.get(roomId) : {};
      io.to(roomId).emit('presence-update', presenceSnapshot);
      io.to(roomId).emit('user-name', Object.values(presenceSnapshot));
    });

    // Block a member from the room (permanent until server restart)
    socket.on('room-block', ({ roomId, targetUserId }) => {
      if (!roomId || !targetUserId) return;
      const senderId = getSocketUserId();
      const ownerId = roomOwners.get(roomId);
      if (senderId !== ownerId) {
        socket.emit('room-error', { message: 'Only the room owner can block members.' });
        return;
      }
      if (targetUserId === ownerId) {
        socket.emit('room-error', { message: 'You cannot block yourself.' });
        return;
      }
      // Add to block list
      if (!roomBlockList.has(roomId)) {
        roomBlockList.set(roomId, new Set());
      }
      roomBlockList.get(roomId).add(targetUserId);
      console.log('[Room] Blocked:', targetUserId, 'from', roomId);

      // Kick the user if they are currently in the room
      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients) {
        for (const clientId of clients) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (!clientSocket) continue;
          const clientUser = clientSocket.user;
          const clientUserId = clientUser?.username || (clientUser?._id ? String(clientUser._id) : null) || clientSocket.id;
          if (clientUserId === targetUserId) {
            clientSocket.emit('room-blocked', { roomId, message: 'You have been blocked from this room by the owner.' });
            clientSocket.leave(roomId);
            if (roomUserPresence.has(roomId)) {
              delete roomUserPresence.get(roomId)[targetUserId];
            }
            removePresence(roomId, targetUserId);
            break;
          }
        }
      }
      // Broadcast updated presence
      const presenceSnapshot = roomUserPresence.has(roomId) ? roomUserPresence.get(roomId) : {};
      io.to(roomId).emit('presence-update', presenceSnapshot);
      io.to(roomId).emit('user-name', Object.values(presenceSnapshot));
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
          const clientUserId = clientUser?.username || (clientUser?._id ? String(clientUser._id) : null) || clientSocket.id;
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

    socket.on('selection-update', ({ roomId, selection }) => {
      if (!roomId) return;
      const senderId = getSocketUserId();
      if (!roomUserPresence.has(roomId)) roomUserPresence.set(roomId, {});
      if (!roomUserPresence.get(roomId)[senderId]) {
        roomUserPresence.get(roomId)[senderId] = getUserInfo(user, undefined, socket.id);
      }
      const entry = roomUserPresence.get(roomId)[senderId];
      if (selection && typeof selection.start === 'number' && typeof selection.end === 'number' && selection.start !== selection.end) {
        const start = Math.min(selection.start, selection.end);
        const end = Math.max(selection.start, selection.end);
        entry.selection = { start, end };
      } else {
        delete entry.selection;
      }
      assignColors(roomId);
      const selections = Object.entries(roomUserPresence.get(roomId))
        .filter(([, info]) => info.selection && typeof info.selection.start === 'number' && typeof info.selection.end === 'number' && info.selection.start !== info.selection.end)
        .map(([uid, info]) => ({ userId: uid, start: info.selection.start, end: info.selection.end, color: info.color }));
      io.to(roomId).emit('remote-selection', { selections });
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
    });
  });

  return io;
}

module.exports = { initSocket };