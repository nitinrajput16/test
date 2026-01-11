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

    // Helper: Format timestamp (e.g. 10:45 AM)
    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Helper: Create message element
    function createMessageEl(msg, isMine) {
        const el = document.createElement('div');
        el.className = 'chat-msg ' + (isMine ? 'mine' : 'others');

        // Header: Name + Time
        const header = document.createElement('div');
        header.className = 'chat-msg-header';

        const nameSpan = document.createElement('div');
        nameSpan.className = 'chat-msg-name';
        nameSpan.textContent = msg.name || 'User';
        if (msg.color && !isMine) nameSpan.style.color = msg.color;

        const timeSpan = document.createElement('div');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = formatTime(msg.time || Date.now());

        header.appendChild(nameSpan);
        header.appendChild(timeSpan);
        el.appendChild(header);

        // Body: Text
        const textDiv = document.createElement('div');
        textDiv.className = 'chat-msg-text';
        textDiv.textContent = msg.text || '';
        el.appendChild(textDiv);

        return el;
    }

    function appendMessage(msg) {
        // Check if it's mine
        let isMine = false;
        if (window.socket && window.socket.id) {
            // Ideally we match by userId if available, else socket.id fallback
            // msg.userId comes from server
            if (window.socket.userId === msg.userId) isMine = true;
            // Fallback: match by socket.id explicitly if userId didn't match
            else if (window.socket.id === msg.userId) isMine = true;
        }

        const item = createMessageEl(msg, isMine);
        historyEl.appendChild(item);
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    // --- Socket Events ---
    // Wait for socket to be available (script.js initializes it)

    function initChatSocket() {
        if (!window.socket) {
            setTimeout(initChatSocket, 500);
            return;
        }

        // Listen for incoming messages
        window.socket.on('chat-message', (msg) => {
            console.log('[Chat] Received:', msg);
            appendMessage(msg);
        });

        // Listen for history sync
        window.socket.on('chat-history', (data) => {
            console.log('[Chat] History sync:', data);
            if (data && Array.isArray(data.messages)) {
                historyEl.innerHTML = '';
                data.messages.forEach(m => appendMessage(m));
            }
        });

        // Whoami override to ensure we know our ID for styling 'mine' messages
        window.socket.on('whoami', (data) => {
            window.socket.userId = data.userId;
        });

        // Explicitly request history to handle race conditions
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
            note.style.textAlign = 'center';
            note.style.margin = '10px 0';
            note.textContent = 'Chat history cleared';
            historyEl.appendChild(note);
        });
    }

    initChatSocket();

    // --- UI Actions ---
    function sendMessage() {
        const text = inputEl.value.trim();
        if (!text) return;

        // Emit to server
        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (window.socket && roomId) {
            console.log('[Chat] Sending to', roomId, text);
            window.socket.emit('chat-message', {
                roomId: roomId,
                text: text
            });
        } else {
            console.error('[Chat] Cannot send: socket or roomId missing', { socket: !!window.socket, roomId });
        }

        inputEl.value = '';
        inputEl.focus();
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // --- Clear Chat ---
    const clearBtn = document.getElementById('usersChatClearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const confirmed = confirm('Are you sure you want to clear the chat for everyone?');
            if (!confirmed) return;

            const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
            if (window.socket && roomId) {
                window.socket.emit('chat-clear', { roomId });
            }
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
