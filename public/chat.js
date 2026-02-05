// chat.js
// Handles the "Group Chat" logic using existing Socket.IO connection.

(function () {
    const historyEl = document.getElementById('usersChatHistory');
    const inputEl = document.getElementById('usersChatInput');
    const sendBtn = document.getElementById('usersChatSendBtn');

    if (!historyEl || !inputEl || !sendBtn) {
        console.warn('[Chat] Elements not found, skipping init.');
        return;
    }

    const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    function createMessageEl(msg, isMine) {
        const el = document.createElement('div');
        el.className = `chat-msg ${isMine ? 'mine' : 'others'}`;

        const header = document.createElement('div');
        header.className = 'chat-msg-header';

        const nameSpan = document.createElement('div');
        nameSpan.className = 'chat-msg-name';
        nameSpan.textContent = msg.name || 'User';
        if (msg.color && !isMine) nameSpan.style.color = msg.color;

        const timeSpan = document.createElement('div');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = formatTime(msg.time || Date.now());

        header.append(nameSpan, timeSpan);

        const textDiv = document.createElement('div');
        textDiv.className = 'chat-msg-text';
        textDiv.textContent = msg.text || '';
        
        el.append(header, textDiv);
        return el;
    }

    function appendMessage(msg) {
        const isMine = window.myServerUserId && msg.userId === window.myServerUserId || 
                      window.socket?.id === msg.userId;
        historyEl.appendChild(createMessageEl(msg, isMine));
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    // --- Socket Events ---
    // Wait for socket to be available (script.js initializes it)

    function initChatSocket() {
        if (!window.socket) return setTimeout(initChatSocket, 500);

        window.socket.on('chat-message', (msg) => { console.log('[Chat] Received:', msg); appendMessage(msg); });
        window.socket.on('chat-history', (data) => {
            console.log('[Chat] History sync:', data);
            if (data?.messages) { historyEl.innerHTML = ''; data.messages.forEach(appendMessage); }
        });

        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (roomId) {
            console.log('[Chat] Requesting history for', roomId);
            window.socket.emit('chat-history-request', { roomId });
        }

        window.socket.on('chat-clear', () => {
            console.log('[Chat] Cleared by server');
            historyEl.innerHTML = '';
            const note = document.createElement('div');
            note.className = 'chat-msg-time';
            Object.assign(note.style, { textAlign: 'center', margin: '10px 0' });
            note.textContent = 'Chat history cleared';
            historyEl.appendChild(note);
        });
    }

    initChatSocket();

    function sendMessage() {
        const text = inputEl.value.trim();
        if (!text) return;
        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (window.socket && roomId) {
            console.log('[Chat] Sending to', roomId, text);
            window.socket.emit('chat-message', { roomId, text });
        } else {
            console.error('[Chat] Cannot send: socket or roomId missing', { socket: !!window.socket, roomId });
        }
        inputEl.value = '';
        inputEl.focus();
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => e.key === 'Enter' && sendMessage());

    const clearBtn = document.getElementById('usersChatClearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to clear the chat for everyone?')) return;
            const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
            if (window.socket && roomId) window.socket.emit('chat-clear', { roomId });
        });
    }



    // --- Expand/Collapse Chat ---
    const expandBtn = document.getElementById('usersChatExpandBtn');
    const backBtn = document.getElementById('usersChatBackBtn');
    const panelRight = document.getElementById('panelRight');

    if (expandBtn && backBtn && panelRight) {
        expandBtn.addEventListener('click', () => {
            panelRight.classList.add('chat-expanded');
            expandBtn.style.display = 'none';
            backBtn.style.display = 'inline-block';
        });

        backBtn.addEventListener('click', () => {
            panelRight.classList.remove('chat-expanded');
            expandBtn.style.display = 'inline-block';
            backBtn.style.display = 'none';
        });
    }

})();
