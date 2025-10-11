// ui.js
// User Presence Avatars and Cursors for Collaborative Editor

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

  function sendCursorPosition() {
    // (disabled)
  }

  function init(_socket, _editor, _userId, _userName) {
    socket = _socket;
    editor = _editor;
    userId = _userId;
    userColor = getColorForId(userId);
    if (!editor || !socket) return;

    // Listen for presence updates
    socket.on('presence-update', onPresenceUpdate);

    // (disabled) Send cursor position on change
    // editor.onDidChangeCursorPosition(sendCursorPosition);

    // (disabled) Send initial presence
    // sendCursorPosition();
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
        }, 3000); // Hide after 3 seconds of no interaction
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
