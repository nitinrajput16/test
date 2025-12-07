// Usage: Call UIUserPresence.init(socket, editor) after both are initialized.

const UIUserPresence = (function() {
  let editor = null;
  let socket = null;
  let userId = null;
  let userColor = null;
  let presenceMap = {};
  const COLORS = [
    '#4fd89b', '#f39c12', '#e74c3c', '#8e44ad', '#3498db', '#e67e22', '#1abc9c', '#2ecc71', '#e84393', '#fdcb6e'
  ];

  function getColorForId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  function renderCursors() {
    if (!editor || !window.monaco) return;
    let decorations = [];
    Object.values(presenceMap).forEach(p => {
      if (p.id !== userId && p.position) {
        decorations.push({
          range: new monaco.Range(p.position.lineNumber, p.position.column, p.position.lineNumber, p.position.column),
          options: {
            className: 'remote-cursor',
            afterContentClassName: 'remote-cursor-label',
            after: {
              content: p.name ? ` ${p.name}` : '',
              inlineClassName: 'remote-cursor-label',
              color: p.color || '#f39c12',
              backgroundColor: p.color || '#f39c12',
              border: `2px solid ${p.color || '#f39c12'}`
            },
            inlineClassName: 'remote-cursor',
            beforeContentClassName: '',
            stickiness: 1
          }
        });
      }
    });
    editor.deltaDecorations(editor._remoteCursorDecorations || [], decorations);
    editor._remoteCursorDecorations = decorations;
  }

  function onPresenceUpdate(data) {
    presenceMap = data;
    renderCursors();
  }


  function init(_socket, _editor, _userId, _userName) {
    socket = _socket;
    editor = _editor;
    userId = _userId;
    userColor = getColorForId(userId);
    if (!editor || !socket) return;

    socket.on('presence-update', onPresenceUpdate);

  }

  return { init };
})();

// Add styles for remote cursors
(function addPresenceStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .remote-cursor {
      border-left: 2px solid #f39c12;
      margin-left: -1px;
      pointer-events: none;
      z-index: 10;
    }
    .remote-cursor-label {
      font-size: 11px;
      background: #222c;
      color: #fff;
      border-radius: 3px;
      padding: 0 4px;
      margin-left: 2px;
      pointer-events: none;
      z-index: 10;
    }
  `;
  document.head.appendChild(style);
})();

// AI Hint Badge Toggle
(function() {
  window.addEventListener('DOMContentLoaded', () => {
    const aiHint = document.getElementById('ai-hint');
    if (!aiHint) return;

    let isExpanded = false;
    let hideTimeout = null;

    // Toggle on click
    aiHint.addEventListener('click', (e) => {
      e.stopPropagation();
      isExpanded = !isExpanded;
      
      if (isExpanded) {
        aiHint.classList.add('expanded');
        clearTimeout(hideTimeout);
      } else {
        aiHint.classList.remove('expanded');
      }
    });

    // Auto-hide after hover away
    aiHint.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
    });

    aiHint.addEventListener('mouseleave', () => {
      if (isExpanded) {
        hideTimeout = setTimeout(() => {
          isExpanded = false;
          aiHint.classList.remove('expanded');
        }, 3000);
      }
    });

    // Close when clicking outside
    document.addEventListener('click', () => {
      if (isExpanded) {
        isExpanded = false;
        aiHint.classList.remove('expanded');
      }
    });
  });
})();

// Voice chat bootstrap
(function(){
  window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('voiceAudios');
    if (!container) return;
    if (!window.AudioChat || !window.socket) return;
    const roomIdProvider = () => window.currentRoom;
    const chat = window.AudioChat.init({
      socket: window.socket,
      roomIdProvider,
      ui: {
        enableBtn: null,
        muteBtn: null,
        statusEl: null,
        containerEl: container
      }
    });
    window.voiceChat = chat;
    // Wire up explicit voice control buttons if present (Join, Mic Toggle, Leave)
    const joinBtn = document.getElementById('voiceJoinBtn');
    const micToggleBtn = document.getElementById('voiceMicToggleBtn');
    const leaveBtn = document.getElementById('voiceLeaveBtn');
    let localMuted = false;

    function setMicIcon(isMuted) {
      if (!micToggleBtn) return;
      const icon = micToggleBtn.querySelector('i');
      if (!icon) return;
      icon.classList.toggle('fa-microphone', !isMuted);
      icon.classList.toggle('fa-microphone-slash', !!isMuted);
    }

    function updateVoiceButtons(enabled, muted){
      localMuted = !!muted;
      if (joinBtn) joinBtn.disabled = !!enabled;
      if (leaveBtn) leaveBtn.disabled = !enabled;
      if (micToggleBtn) micToggleBtn.disabled = !enabled;
      // visual active state and icon
      if (micToggleBtn) micToggleBtn.classList.toggle('active', enabled && muted === false);
      setMicIcon(muted === true);
    }

    if (joinBtn) joinBtn.addEventListener('click', () => { if (window.voiceChat && window.voiceChat.enableVoice) window.voiceChat.enableVoice(); });
    if (leaveBtn) leaveBtn.addEventListener('click', () => { if (window.voiceChat && window.voiceChat.disableVoice) window.voiceChat.disableVoice(); });
    if (micToggleBtn) micToggleBtn.addEventListener('click', () => {
      if (!window.voiceChat) return;
      // if not joined yet, enable voice (will also enable mic)
      if (joinBtn && !joinBtn.disabled) {
        if (window.voiceChat.enableVoice) window.voiceChat.enableVoice();
        return;
      }
      // Prefer toggleMute if available
      if (window.voiceChat.toggleMute) {
        window.voiceChat.toggleMute();
        return;
      }
      // Fallback: setMicEnabled to opposite of current muted state
      if (window.voiceChat.setMicEnabled) window.voiceChat.setMicEnabled(localMuted === true);
    });

    // Listen to voice events to update button states
    window.addEventListener('voice:enabled', () => updateVoiceButtons(true, false));
    window.addEventListener('voice:disabled', () => updateVoiceButtons(false, false));
    window.addEventListener('voice:local-muted', (e) => { const muted = !!(e.detail && e.detail.muted); updateVoiceButtons(true, muted); });
    // initialize states
    updateVoiceButtons(false, false);
  });
})();

// Voice Dynamic Island UI removed — explicit voice controls remain in the UI.
