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
  });
})();

// Voice Dynamic Island UI
(function(){
  const peers = new Map(); // peerId -> { hasAudio }
  let voiceActive = false;
  let localMuted = false;
  function short(id){ return id ? id.slice(0,6) : 'peer'; }

  function updateLocalLabel() {
    const mic = document.getElementById('voiceIslandMic');
    const label = document.getElementById('voiceIslandLabel');
    if (!mic || !label) return;
    if (!voiceActive) {
      label.textContent = 'Join Voice';
      mic.style.opacity = '0.5';
    } else {
      label.textContent = localMuted ? 'Muted' : 'Mic On';
      mic.style.opacity = localMuted ? '0.5' : '1';
    }
  }

  function renderIsland() {
    let island = document.getElementById('voiceIsland');
    if (!island) {
      island = document.createElement('div');
      island.id = 'voiceIsland';
      island.className = 'voice-island';
      // local area
      const local = document.createElement('div'); local.className = 'local';
      const mic = document.createElement('div'); mic.className = 'mic-icon'; mic.title='Local mic';
      mic.innerHTML = '🎤';
      mic.id = 'voiceIslandMic';
      local.appendChild(mic);
      const label = document.createElement('div'); label.className='local-label'; label.id='voiceIslandLabel'; label.textContent='Voice';
      local.appendChild(label);
      island.appendChild(local);
      const peersWrap = document.createElement('div'); peersWrap.className='peers'; peersWrap.id='voiceIslandPeers';
      island.appendChild(peersWrap);
      const mount = document.getElementById('voiceIslandMount') || document.body;
      mount.appendChild(island);

      // click mic: if voice off, enable; else toggle mute
      mic.addEventListener('click', () => {
        if (!voiceActive) {
          if (window.voiceChat && window.voiceChat.enableVoice) window.voiceChat.enableVoice();
          return;
        }
        if (window.voiceChat && window.voiceChat.toggleMute) window.voiceChat.toggleMute();
      });
      // click label: toggle voice session on/off
      label.addEventListener('click', () => {
        if (!voiceActive) {
          if (window.voiceChat && window.voiceChat.enableVoice) window.voiceChat.enableVoice();
        } else if (window.voiceChat && window.voiceChat.disableVoice) {
          window.voiceChat.disableVoice();
        }
      });
    }
    // update peers
    const peersWrap = document.getElementById('voiceIslandPeers');
    peersWrap.innerHTML = '';
    for (const [pid, st] of peers.entries()){
      const chip = document.createElement('div'); chip.className = 'peer-chip' + (st.muted ? ' muted' : '');
      const dot = document.createElement('span'); dot.className='dot'; chip.appendChild(dot);
      const name = document.createElement('span'); name.textContent = short(pid); chip.appendChild(name);
      peersWrap.appendChild(chip);
    }
    updateLocalLabel();
  }

  // Event listeners
  window.addEventListener('voice:peer-created', (e) => {
    const peerId = e.detail && e.detail.peerId;
    if (!peerId) return;
    peers.set(peerId, { hasAudio:false, muted:false });
    renderIsland();
  });
  window.addEventListener('voice:peer-audio', (e) => {
    const peerId = e.detail && e.detail.peerId; if (!peerId) return;
    const st = peers.get(peerId) || { hasAudio:false, muted:false };
    st.hasAudio = true; peers.set(peerId, st); renderIsland();
  });
  window.addEventListener('voice:peer-left', (e) => {
    const peerId = e.detail && e.detail.peerId; if (!peerId) return;
    peers.delete(peerId); renderIsland();
  });
  window.addEventListener('voice:peer-muted', (e) => {
    const peerId = e.detail && e.detail.peerId; const muted = e.detail && e.detail.muted;
    if (!peerId) return;
    const st = peers.get(peerId) || { hasAudio:false, muted:false };
    st.muted = !!muted;
    peers.set(peerId, st);
    renderIsland();
  });
  window.addEventListener('voice:local-muted', (e) => {
    localMuted = !!(e.detail && e.detail.muted);
    updateLocalLabel();
  });
  window.addEventListener('voice:enabled', () => { voiceActive = true; renderIsland(); });
  window.addEventListener('voice:disabled', () => { voiceActive = false; peers.clear(); renderIsland(); });

  // create island if voice is ready (or wait)
  window.addEventListener('DOMContentLoaded', () => {
    // create placeholder island (hidden until peers)
    renderIsland();
    const mic = document.getElementById('voiceIslandMic'); if (mic) mic.style.opacity = '0.6';
  });
})();
