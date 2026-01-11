// Monaco Editor: Set language from ?template= param
function getTemplateFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('template');
}

function getMonacoLanguage(template) {
  const map = {
    js: 'javascript',
    python: 'python',
    cpp: 'cpp',
    java: 'java',
    php: 'php',
    sql: 'sql',
    go: 'go',
    r: 'r',
    rust: 'rust',
    c: 'c',
    ruby: 'ruby',
    csharp: 'csharp',
    kotlin: 'kotlin',
    typescript: 'typescript'
  };
  return map[template] || 'plaintext';
}

window.addEventListener('DOMContentLoaded', function () {
  // --- Editor Activity Tracking ---
  let activityStarted = false;
  let heartbeatInterval = null;
  function sendActivity(action) {
    fetch('/api/editor/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  }
  function startActivity() {
    if (!activityStarted) {
      sendActivity('start');
      activityStarted = true;
    }
    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(() => sendActivity('start'), 60000); // every 1 min
    }
  }
  function endActivity() {
    if (activityStarted) {
      sendActivity('end');
      activityStarted = false;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
  // Start activity on editor focus or user input
  window.addEventListener('focus', startActivity);
  window.addEventListener('keydown', startActivity);
  window.addEventListener('mousedown', startActivity);
  // End activity on blur or unload
  window.addEventListener('blur', endActivity);
  window.addEventListener('beforeunload', endActivity);
  if (window.monaco && window.editor) {
    const template = getTemplateFromURL();
    if (template) {
      const lang = getMonacoLanguage(template);
      monaco.editor.setModelLanguage(editor.getModel(), lang);
      // Optionally, set the language dropdown too:
      const langSelect = document.getElementById('language');
      if (langSelect) {
        for (const opt of langSelect.options) {
          if (opt.getAttribute('data-monaco') === lang) {
            langSelect.value = opt.value;
            break;
          }
        }
      }
    }
  }
});
(function () {

  // ---------------- CUSTOM MODAL FUNCTIONS ----------------
  function showModal({ title, message, input, buttons }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const box = document.createElement('div');
      box.className = 'modal-box';

      if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        box.appendChild(titleEl);
      }

      if (message) {
        const msgEl = document.createElement('div');
        msgEl.className = 'modal-message';
        msgEl.textContent = message;
        box.appendChild(msgEl);
      }

      let inputEl;
      if (input) {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'modal-input';
        inputEl.placeholder = input.placeholder || '';
        inputEl.value = input.defaultValue || '';
        box.appendChild(inputEl);
        setTimeout(() => inputEl.focus(), 100);
      }

      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'modal-buttons';

      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `modal-btn modal-btn-${btn.type || 'secondary'}`;
        button.textContent = btn.text;
        button.addEventListener('click', () => {
          const result = (typeof btn.value !== 'undefined')
            ? btn.value
            : (inputEl ? inputEl.value : null);
          document.body.removeChild(overlay);
          resolve(result);
        });
        buttonsDiv.appendChild(button);
      });

      box.appendChild(buttonsDiv);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Handle Enter key for input
      if (inputEl) {
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            document.body.removeChild(overlay);
            resolve(inputEl.value);
          }
        });
      }

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  function customPrompt(message, defaultValue = '') {
    return showModal({
      title: 'Input Required',
      message: message,
      input: { defaultValue },
      buttons: [
        { text: 'Cancel', type: 'secondary', value: null },
        { text: 'OK', type: 'primary' }
      ]
    });
  }

  function customConfirm(message) {
    return showModal({
      title: 'Confirm Action',
      message: message,
      buttons: [
        { text: 'Cancel', type: 'secondary', value: false },
        { text: 'Confirm', type: 'danger', value: true }
      ]
    });
  }

  function customAlert(message) {
    return showModal({
      title: 'Alert',
      message: message,
      buttons: [
        { text: 'OK', type: 'primary', value: true }
      ]
    });
  }

  // ---------------- DOM ELEMENTS ----------------
  const fileListDiv = document.getElementById('fileList');

  // If a static toolbar exists in HTML, bind to its elements; otherwise create dynamically
  let searchInput = document.getElementById('fileSearchInput');
  let newFileBtn = document.getElementById('newFileBtnToolbar');
  const existingToolbar = document.getElementById('fileToolbar');

  if (!existingToolbar) {
    // Add search container with icon and input (dynamic fallback)
    const searchContainer = document.createElement('div');
    searchContainer.classList.add('file-toolbar');
    searchContainer.style.display = 'flex';
    searchContainer.style.alignItems = 'center';
    searchContainer.style.gap = '6px';
    searchContainer.style.marginBottom = '6px';
    searchContainer.style.padding = '0 5px';

    const searchWrapper = document.createElement('div');
    searchWrapper.style.position = 'relative';
    searchWrapper.style.flex = '1';
    searchWrapper.style.display = 'flex';
    searchWrapper.style.alignItems = 'center';

    const searchIcon = document.createElement('span');
    searchIcon.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '8px';
    searchIcon.style.fontSize = '14px';
    searchIcon.style.pointerEvents = 'none';
    searchIcon.style.opacity = '0.7';

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search files...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '6px 8px 6px 30px';
    searchInput.style.background = '#ffffff11';
    searchInput.style.border = '1px solid #ffffff15';
    searchInput.style.color = '#fff';
    searchInput.style.borderRadius = '4px';
    searchInput.style.fontSize = '12px';
    searchInput.style.outline = 'none';

    searchInput.addEventListener('focus', () => {
      searchInput.style.borderColor = '#0a5';
      searchInput.style.background = '#ffffff18';
    });

    searchInput.addEventListener('blur', () => {
      searchInput.style.borderColor = '#ffffff15';
      searchInput.style.background = '#ffffff11';
    });

    searchInput.addEventListener('input', (e) => {
      filterFileList(e.target.value.toLowerCase());
    });

    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    searchContainer.appendChild(searchWrapper);

    // Add New File button
    newFileBtn = document.createElement('button');
    newFileBtn.textContent = '+';
    newFileBtn.title = 'New File';
    newFileBtn.id = 'newFileBtnToolbar';
    newFileBtn.style.background = '#0a5';
    newFileBtn.style.color = '#fff';
    newFileBtn.style.border = 'none';
    newFileBtn.style.padding = '6px 12px';
    newFileBtn.style.fontWeight = 'bold';
    newFileBtn.style.cursor = 'pointer';
    newFileBtn.style.borderRadius = '4px';
    newFileBtn.style.fontSize = '16px';
    newFileBtn.addEventListener('click', () => {
      setEditorValue('', true, 'toolbar-new-file');
      currentFilename = null;
      highlightActiveFile();
      logOutput('New blank file. Use Save to name and store it.');
      if (otApi) otApi.resetWithDocument('', true);
      markSavedSnapshot('');
      needFileListRefresh = false;
    });

    searchContainer.appendChild(newFileBtn);

    if (fileListDiv && fileListDiv.parentElement) {
      fileListDiv.parentElement.insertBefore(searchContainer, fileListDiv);
    }
  } else {
    // Bind search input behavior when using static toolbar
    if (searchInput) {
      searchInput.addEventListener('input', (e) => filterFileList(e.target.value.toLowerCase()));
      searchInput.addEventListener('focus', () => { searchInput.style.borderColor = '#0a5'; searchInput.style.background = '#ffffff18'; });
      searchInput.addEventListener('blur', () => { searchInput.style.borderColor = '#ffffff15'; searchInput.style.background = '#ffffff11'; });
    }
    if (newFileBtn) {
      newFileBtn.addEventListener('click', () => {
        setEditorValue('', true, 'toolbar-new-file');
        currentFilename = null;
        highlightActiveFile();
        logOutput('New blank file. Use Save to name and store it.');
        if (otApi) otApi.resetWithDocument('', true);
        markSavedSnapshot('');
        needFileListRefresh = false;
      });
    }
  }

  const bodyEl = document.body;
  const whiteboardPanel = document.getElementById('inlineWhiteboardPanel');
  const whiteboardToggleBtn = document.getElementById('whiteboardBtn');
  const whiteboardMinimizeBtn = document.getElementById('whiteboardMinimizeBtn');
  const whiteboardDetachBtn = document.getElementById('whiteboardDetachBtn');
  const whiteboardRoomLabel = document.getElementById('whiteboardRoomLabel');
  const inlineResizerHandle = document.getElementById('inlineResizer');
  const INLINE_PANEL_MIN = 320;
  const INLINE_PANEL_MAX = 900;
  let inlinePanelWidth = whiteboardPanel ? parseFloat(whiteboardPanel.dataset.width) || 420 : 420;

  function setInlinePanelWidth(width, options = {}) {
    if (!whiteboardPanel) return;
    const target = Math.max(INLINE_PANEL_MIN, Math.min(INLINE_PANEL_MAX, width || inlinePanelWidth || 420));
    inlinePanelWidth = target;
    whiteboardPanel.style.flex = `0 0 ${target}px`;
    whiteboardPanel.style.width = `${target}px`;
    whiteboardPanel.dataset.width = String(Math.round(target));
    if (!options.silent && bodyEl && bodyEl.classList.contains('whiteboard-open')) {
      requestAnimationFrame(() => {
        window.inlineWhiteboard && window.inlineWhiteboard.refreshSize && window.inlineWhiteboard.refreshSize();
      });
    }
  }

  window.setInlineWhiteboardWidth = function (width, options) {
    setInlinePanelWidth(width, options);
  };

  function updateWhiteboardRoomLabel(roomId) {
    if (whiteboardRoomLabel) {
      whiteboardRoomLabel.textContent = roomId ? `#${roomId}` : '—';
    }
  }

  function ensureShareRoomRefs() {
    if (!shareRoomLinkInput) shareRoomLinkInput = document.getElementById('shareRoomLink');
    if (!shareRoomButton) shareRoomButton = document.getElementById('shareRoomButton');
    if (!shareRoomIconBtn) shareRoomIconBtn = document.getElementById('shareRoomIconBtn');
    if (!shareRoomBtnLabel && shareRoomButton) {
      shareRoomBtnLabel = shareRoomButton.querySelector('.share-room-btn-label');
    }
    return Boolean(shareRoomLinkInput || shareRoomButton || shareRoomIconBtn);
  }

  function bindShareRoomEvents() {
    if (shareRoomEventsBound) return;
    if (!ensureShareRoomRefs()) return;
    if (shareRoomButton) {
      shareRoomButton.addEventListener('click', copyRoomInviteLink);
    }
    if (shareRoomIconBtn) {
      shareRoomIconBtn.addEventListener('click', copyRoomInviteLink);
    }
    if (shareRoomLinkInput) {
      const selectShareLink = () => {
        shareRoomLinkInput.focus();
        shareRoomLinkInput.select();
      };
      shareRoomLinkInput.addEventListener('focus', selectShareLink);
      shareRoomLinkInput.addEventListener('click', selectShareLink);
    }
    shareRoomEventsBound = true;
  }

  function getRoomIdFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('room');
      return raw ? raw.trim() : null;
    } catch (_err) {
      return null;
    }
  }

  function buildRoomInviteLink(roomId) {
    try {
      const url = new URL(window.location.href);
      if (roomId) {
        url.searchParams.set('room', roomId);
      } else {
        url.searchParams.delete('room');
      }
      url.hash = '';
      return url.toString();
    } catch (_err) {
      const base = window.location.origin + window.location.pathname;
      return roomId ? `${base}?room=${encodeURIComponent(roomId)}` : base;
    }
  }

  function updateRoomQueryParam(roomId) {
    if (!window.history || !window.history.replaceState) return;
    try {
      const invite = buildRoomInviteLink(roomId);
      const withHash = window.location.hash ? invite + window.location.hash : invite;
      window.history.replaceState({}, document.title, withHash);
    } catch (err) {
      console.warn('[ShareRoom] Unable to update URL', err);
    }
  }

  function updateShareRoomLink(roomId) {
    ensureShareRoomRefs();
    if (!shareRoomLinkInput) {
      pendingShareRoomId = roomId;
      return;
    }
    pendingShareRoomId = null;
    if (!roomId) {
      shareRoomLinkInput.value = 'Join or create a room to generate a link';
      shareRoomLinkInput.dataset.state = 'empty';
      return;
    }
    shareRoomLinkInput.dataset.state = 'ready';
    shareRoomLinkInput.value = buildRoomInviteLink(roomId);
  }

  let shareRoomResetTimer = null;

  function setShareRoomButtonState(state) {
    ensureShareRoomRefs();
    if (!shareRoomBtnLabel) return;
    const defaultText = shareRoomBtnLabel.dataset.default || 'Copy Link';
    const successText = shareRoomBtnLabel.dataset.success || 'Copied!';
    if (state === 'success') {
      shareRoomBtnLabel.textContent = successText;
      shareRoomBtnLabel.dataset.state = 'success';
      if (shareRoomResetTimer) clearTimeout(shareRoomResetTimer);
      shareRoomResetTimer = setTimeout(() => setShareRoomButtonState('default'), 1800);
    } else {
      shareRoomBtnLabel.textContent = defaultText;
      shareRoomBtnLabel.dataset.state = 'default';
    }
  }

  function fallbackCopyFromInput(text) {
    return new Promise((resolve, reject) => {
      ensureShareRoomRefs();
      if (!shareRoomLinkInput) {
        reject(new Error('share-room input missing'));
        return;
      }
      shareRoomLinkInput.select();
      shareRoomLinkInput.setSelectionRange(0, shareRoomLinkInput.value.length);
      try {
        const ok = document.execCommand && document.execCommand('copy');
        if (ok) {
          resolve();
        } else {
          reject(new Error('execCommand copy failed'));
        }
      } catch (err) {
        reject(err);
      } finally {
        shareRoomLinkInput.setSelectionRange(text.length, text.length);
      }
    });
  }

  function copyRoomInviteLink(event) {
    if (event) event.preventDefault();
    ensureShareRoomRefs();
    if (!shareRoomLinkInput) return;
    const link = (shareRoomLinkInput.value || '').trim();
    if (!link || shareRoomLinkInput.dataset.state === 'empty') return;
    const hasClipboardApi = navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
    let copyPromise;
    if (hasClipboardApi) {
      copyPromise = navigator.clipboard.writeText(link).catch(() => fallbackCopyFromInput(link));
    } else {
      copyPromise = fallbackCopyFromInput(link);
    }
    copyPromise
      .then(() => {
        setShareRoomButtonState('success');
      })
      .catch(err => {
        console.warn('[ShareRoom] Copy failed', err);
      });
  }

  function initShareRoomUI() {
    ensureShareRoomRefs();
    bindShareRoomEvents();
    if (pendingShareRoomId !== null) {
      updateShareRoomLink(pendingShareRoomId);
    } else {
      updateShareRoomLink(currentRoom);
    }
    setShareRoomButtonState('default');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareRoomUI);
  } else {
    initShareRoomUI();
  }
  function openInlineWhiteboard() {
    if (!whiteboardPanel || !bodyEl) return;
    setInlinePanelWidth(inlinePanelWidth, { silent: true });
    whiteboardPanel.classList.remove('collapsed');
    whiteboardPanel.setAttribute('aria-hidden', 'false');
    bodyEl.classList.add('whiteboard-open');
    if (inlineResizerHandle) {
      inlineResizerHandle.setAttribute('aria-hidden', 'false');
    }
    if (whiteboardToggleBtn) {
      whiteboardToggleBtn.setAttribute('aria-pressed', 'true');
    }
    // allow layout to settle before measuring canvas
    requestAnimationFrame(() => {
      window.inlineWhiteboard && window.inlineWhiteboard.refreshSize && window.inlineWhiteboard.refreshSize();
    });
  }

  function closeInlineWhiteboard() {
    if (!whiteboardPanel || !bodyEl) return;
    const rect = whiteboardPanel.getBoundingClientRect();
    if (rect && rect.width) {
      setInlinePanelWidth(rect.width, { silent: true });
    }
    whiteboardPanel.classList.add('collapsed');
    whiteboardPanel.setAttribute('aria-hidden', 'true');
    bodyEl.classList.remove('whiteboard-open');
    if (inlineResizerHandle) {
      inlineResizerHandle.setAttribute('aria-hidden', 'true');
    }
    if (whiteboardToggleBtn) {
      whiteboardToggleBtn.setAttribute('aria-pressed', 'false');
    }
  }

  function toggleInlineWhiteboard() {
    if (!bodyEl) return;
    if (bodyEl.classList.contains('whiteboard-open')) {
      closeInlineWhiteboard();
    } else {
      openInlineWhiteboard();
    }
  }

  (function bindInlineWhiteboardButtons() {
    if (whiteboardToggleBtn && !whiteboardToggleBtn.hasAttribute('aria-pressed')) {
      whiteboardToggleBtn.setAttribute('aria-pressed', 'false');
    }
    if (whiteboardToggleBtn) {
      whiteboardToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleInlineWhiteboard();
      });
    }
    if (whiteboardMinimizeBtn) {
      whiteboardMinimizeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeInlineWhiteboard();
      });
    }
    if (whiteboardDetachBtn) {
      whiteboardDetachBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        let room = window.currentRoom || window.WHITEBOARD_ROOM;
        if (!room) {
          try {
            const val = await customPrompt('Enter room id for whiteboard', '');
            if (!val) return;
            room = val.trim();
          } catch (_err) {
            return;
          }
        }
        if (room) {
          window.open(`/whiteboard?room=${encodeURIComponent(room)}`, '_blank');
        }
      });
    }
  })();

  // expose helper functions so other modules can trigger search/new actions
  window.createNewFile = function () {
    try { newFileBtn && newFileBtn.click(); } catch (e) { }
  };

  window.focusFileSearch = function () {
    try { searchInput && searchInput.focus(); } catch (e) { }
  };

  // Filter file list function
  function filterFileList(searchTerm) {
    searchTerm = (searchTerm || '').trim();
    // If we have the cached file list, filter at data-level so collapsed folders are searched too
    if (lastFetchedFiles && lastFetchedFiles.length) {
      if (!searchTerm) {
        // show all
        renderCachedFiles(lastFetchedFiles);
        return;
      }
      const term = searchTerm.toLowerCase();
      const filtered = lastFetchedFiles.filter(f => {
        const name = (f.filename || '').toLowerCase();
        const p = (f.parentPath || '').toLowerCase();
        if (name.includes(term) || p.includes(term)) return true;
        // match full path
        const full = ((f.parentPath === '/' ? '' : f.parentPath) + '/' + f.filename).toLowerCase();
        if (full.includes(term)) return true;
        return false;
      });
      // Expand folders that contain matches so results are visible
      filtered.forEach(f => {
        const p = f.parentPath || '/';
        if (p && p !== '/') {
          const parts = p.split('/').filter(Boolean);
          let acc = '';
          parts.forEach(part => {
            acc = acc + '/' + part;
            expandedFolders.add(acc);
          });
        }
      });
      renderCachedFiles(filtered);
      return;
    }

    // Fallback: simple DOM-based filter (limited to currently rendered nodes)
    const fileItems = fileListDiv.querySelectorAll('.file-item, .file-tree-item');
    fileItems.forEach(item => {
      const fileName = (item.textContent || '').toLowerCase();
      if (!searchTerm || fileName.includes(searchTerm.toLowerCase())) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }
  const runBtn = document.getElementById('runButton');
  const saveBtn = document.getElementById('saveButton');
  const langSelect = document.getElementById('language');
  const stdinInput = document.getElementById('stdinInput');
  const outputEl = document.getElementById('output');
  const stderrOutput = document.getElementById('stderrOutput');
  const outputTabs = document.querySelectorAll('.output-tab');
  const outputSections = document.querySelectorAll('.output-section');
  const clearOutputBtn = document.getElementById('clearOutputBtn');
  const roomInput = document.getElementById('roomInput');
  const roomButton = document.getElementById('RoomButton');
  const joinRoomButton = document.getElementById('JoinRoomButton');
  let shareRoomLinkInput = document.getElementById('shareRoomLink');
  let shareRoomButton = document.getElementById('shareRoomButton');
  let shareRoomIconBtn = document.getElementById('shareRoomIconBtn');
  let shareRoomBtnLabel = shareRoomButton ? shareRoomButton.querySelector('.share-room-btn-label') : null;
  let shareRoomEventsBound = false;
  let pendingShareRoomId = null;

  // -------------- STATE ----------------
  let editor;
  let socket;
  let currentRoom = 'default-room-' + Math.random().toString(36).slice(2, 10);
  const roomFromUrl = getRoomIdFromUrl();
  if (roomFromUrl) {
    currentRoom = roomFromUrl;
  }
  if (bodyEl) {
    if (!bodyEl.dataset.room) bodyEl.dataset.room = currentRoom;
  }
  window.currentRoom = currentRoom;
  window.WHITEBOARD_ROOM = currentRoom;
  let currentFilename = null;
  let pendingEditorValue = null;
  let pendingLanguageMonaco = null;
  let aiController = null;
  let otApi = null;
  const AUTOSAVE_INTERVAL_MS = 5000;
  let autosaveTimerId = null;
  let autosaveInFlight = false;
  let pendingAutosave = null;
  let lastSavedHash = null;
  let needFileListRefresh = false;
  let emptySaveWarningShown = false;

  // Judge0 language_id -> Monaco language id
  const judge0ToMonaco = {
    63: 'javascript',
    71: 'python',
    54: 'cpp',
    62: 'java',
    68: 'php',
    82: 'sql',
    22: 'go',
    80: 'r',
    73: 'rust',
    50: 'c',
    72: 'ruby',
    51: 'csharp',
    78: 'kotlin',
    74: 'typescript'
  };

  // Map file extensions to Monaco language ids
  const extToMonaco = {
    'js': 'javascript',
    'py': 'python',
    'cpp': 'cpp',
    'c': 'c',
    'java': 'java',
    'ts': 'typescript',
    'php': 'php',
    'sql': 'sql',
    'go': 'go',
    'r': 'r',
    'rs': 'rust',
    'rb': 'ruby',
    'cs': 'csharp',
    'kt': 'kotlin',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'md': 'markdown',
    'txt': 'plaintext'
  };

  function setActiveOutputTab(targetId) {
    if (!outputTabs || !outputTabs.length) return;
    outputTabs.forEach(btn => {
      const isActive = btn.dataset.target === targetId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    if (outputSections && outputSections.length) {
      outputSections.forEach(section => {
        const isActive = section.id === targetId;
        section.classList.toggle('active', isActive);
        section.setAttribute('aria-hidden', String(!isActive));
      });
    }
    if (targetId === 'stdinSection' && stdinInput) {
      stdinInput.focus();
      stdinInput.setSelectionRange(stdinInput.value.length, stdinInput.value.length);
    }
  }

  if (outputTabs && outputTabs.length) {
    outputTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target || 'outputSection';
        setActiveOutputTab(target);
      });
    });
  }

  const defaultOutputTab = document.querySelector('.output-tab.active');
  if (defaultOutputTab) {
    setActiveOutputTab(defaultOutputTab.dataset.target || 'outputSection');
  }

  function simpleHash(str = '') {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  const EMPTY_DOC_HASH = simpleHash('');

  function getCurrentMonacoLanguage() {
    if (!langSelect) return 'plaintext';
    const opt = langSelect.options[langSelect.selectedIndex];
    return (opt && opt.dataset && opt.dataset.monaco) ? opt.dataset.monaco : 'plaintext';
  }

  const OP_INSERT = 'insert';
  const OP_DELETE = 'delete';

  function getSelfUserId() {
    if (window.myServerUserId) return window.myServerUserId;
    if (window.user && (window.user._id || window.user.googleId || window.user.id)) {
      return window.user._id || window.user.googleId || window.user.id;
    }
    if (socket && socket.id) return socket.id;
    return 'me';
  }

  function createOtEngine() {
    const state = {
      localDoc: '',
      cursorOffset: 0
    };
    let socketRef = null;
    let editorRef = null;
    let suppressLocal = false;
    let pendingServerDoc = null;
    let pendingSyncDoc = null;
    let lastSyncId = 0;

    // IMPORTANT: This tracks the SERVER document version from `ot-sync` / server broadcasts.
    // Never use a local counter for clientVersion; that causes desync.
    state.serverVersion = 0;

    // Classic OT client: 1 outstanding op + a buffer of subsequent local ops.
    let outstandingOp = null;
    const bufferOps = [];
    let outstandingSent = false;
    let sendTimer = null;
    const SEND_DEBOUNCE_MS = 45;

    const cloneOp = (op) => {
      if (!op) return null;
      return op.type === OP_INSERT
        ? { type: OP_INSERT, pos: op.pos, text: op.text || '', clientVersion: op.clientVersion || 0, userId: op.userId }
        : { type: OP_DELETE, pos: op.pos, length: op.length || 0, clientVersion: op.clientVersion || 0, userId: op.userId };
    };

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const applyToDoc = (doc, op) => {
      if (!op) return doc;
      if (op.type === OP_INSERT) {
        const pos = clamp(op.pos, 0, doc.length);
        return doc.slice(0, pos) + (op.text || '') + doc.slice(pos);
      }
      const start = clamp(op.pos, 0, doc.length);
      const end = clamp(op.pos + op.length, 0, doc.length);
      return doc.slice(0, start) + doc.slice(end);
    };

    const transform = (op, against) => {
      if (!op || !against || op === against) return cloneOp(op);
      const result = cloneOp(op);
      if (against.type === OP_INSERT) {
        if (result.type === OP_INSERT) {
          if (against.pos < result.pos || (against.pos === result.pos && (against.userId || '') < (result.userId || ''))) {
            result.pos += (against.text || '').length;
          }
        } else {
          if (against.pos <= result.pos) {
            result.pos += (against.text || '').length;
          } else if (against.pos < result.pos + result.length) {
            result.length += (against.text || '').length;
          }
        }
        return result;
      }
      // against delete
      if (result.type === OP_INSERT) {
        const delStart = against.pos;
        const delEnd = against.pos + against.length;
        if (result.pos <= delStart) return result;
        if (result.pos >= delEnd) {
          result.pos -= against.length;
          return result;
        }
        result.pos = delStart;
        return result;
      }
      const resStart = result.pos;
      const resEnd = result.pos + result.length;
      const delStart = against.pos;
      const delEnd = against.pos + against.length;
      if (resEnd <= delStart) return result;
      if (resStart >= delEnd) {
        result.pos -= against.length;
        return result;
      }
      const overlapStart = Math.max(resStart, delStart);
      const overlapEnd = Math.min(resEnd, delEnd);
      const overlap = overlapEnd - overlapStart;
      result.length -= overlap;
      if (resStart >= delStart) {
        result.pos -= Math.min(against.length, resStart - delStart);
      }
      if (result.length < 0) result.length = 0;
      return result;
    };

    const adjustCursor = (cursor, op, userId) => {
      if (!op) return cursor;
      let pos = cursor;
      if (op.type === OP_INSERT) {
        if (op.pos < pos || (op.pos === pos && op.userId === userId)) {
          pos += (op.text || '').length;
        }
      } else if (op.pos < pos) {
        pos -= Math.min(op.length, pos - op.pos);
      }
      if (pos < 0) pos = 0;
      return pos;
    };

    const sendOutstanding = () => {
      if (!socketRef || !currentRoom) return;
      if (!outstandingOp) return;
      if (outstandingOp.type === OP_INSERT && !outstandingOp.text) return;
      if (outstandingOp.type === OP_DELETE && !outstandingOp.length) return;

      outstandingSent = true;

      // Base the op on the last known server version.
      const enriched = {
        ...cloneOp(outstandingOp),
        clientVersion: state.serverVersion,
        userId: getSelfUserId()
      };
      socketRef.emit('ot-operation', { roomId: currentRoom, operation: enriched });
    };

    const clearSendTimer = () => {
      if (sendTimer) {
        clearTimeout(sendTimer);
        sendTimer = null;
      }
    };

    const scheduleSendOutstanding = () => {
      if (!socketRef || !currentRoom || !outstandingOp) return;
      clearSendTimer();
      // Small debounce so rapid backspaces become a single delete op (reduces remote lag).
      sendTimer = setTimeout(() => {
        sendTimer = null;
        sendOutstanding();
      }, SEND_DEBOUNCE_MS);
    };

    const mapPosToOutstandingBase = (pos) => {
      if (!outstandingOp) return pos;
      if (outstandingOp.type === OP_INSERT) {
        const n = (outstandingOp.text || '').length;
        // Current doc includes the insert; map back to base doc.
        return pos >= outstandingOp.pos + n ? pos - n : pos;
      }
      // delete
      const n = outstandingOp.length || 0;
      return pos >= outstandingOp.pos ? pos + n : pos;
    };

    const tryMergeIntoOutstanding = (op) => {
      if (!outstandingOp || outstandingSent) return false;
      if (!op) return false;
      if (outstandingOp.type !== op.type) return false;

      if (op.type === OP_INSERT) {
        const outText = outstandingOp.text || '';
        const addText = op.text || '';
        if (!addText) return true;

        const basePos = mapPosToOutstandingBase(op.pos);
        // Merge simple "typing" inserts: append at end of outstanding insert.
        if (basePos === outstandingOp.pos + outText.length) {
          outstandingOp.text = outText + addText;
          return true;
        }
        return false;
      }

      // Merge adjacent/overlapping deletes into a single larger delete.
      const baseStart = mapPosToOutstandingBase(op.pos);
      const baseEnd = baseStart + (op.length || 0);
      const outStart = outstandingOp.pos;
      const outEnd = outstandingOp.pos + (outstandingOp.length || 0);

      const newStart = Math.min(outStart, baseStart);
      const newEnd = Math.max(outEnd, baseEnd);

      // Only merge if the ranges touch/overlap.
      if (baseStart <= outEnd && baseEnd >= outStart) {
        outstandingOp.pos = newStart;
        outstandingOp.length = Math.max(0, newEnd - newStart);
        return true;
      }
      return false;
    };

    const queueLocalOp = (op) => {
      if (!op) return;
      // Apply optimistically to local doc first.
      state.localDoc = applyToDoc(state.localDoc, op);

      if (!outstandingOp) {
        outstandingOp = cloneOp(op);
        outstandingSent = false;
        scheduleSendOutstanding();
        return;
      }

      if (tryMergeIntoOutstanding(op)) {
        scheduleSendOutstanding();
        return;
      }

      bufferOps.push(cloneOp(op));
    };

    const transformIncomingThroughLocal = (incomingOp) => {
      let incoming = cloneOp(incomingOp);
      if (!incoming) return null;

      if (outstandingOp) {
        const out0 = cloneOp(outstandingOp);
        const in0 = cloneOp(incoming);
        outstandingOp = transform(out0, in0);
        incoming = transform(in0, out0);
      }

      for (let i = 0; i < bufferOps.length; i += 1) {
        const buf0 = cloneOp(bufferOps[i]);
        const in0 = cloneOp(incoming);
        bufferOps[i] = transform(buf0, in0);
        incoming = transform(in0, buf0);
      }

      return incoming;
    };

    const applyRemoteOperation = (op) => {
      if (!op) return;

      // Drop no-op deletes produced by transforms.
      if (op.type === OP_DELETE && (!op.length || op.length <= 0)) {
        return;
      }

      if (!editorRef || typeof monaco === 'undefined') {
        state.localDoc = applyToDoc(state.localDoc, op);
        state.cursorOffset = adjustCursor(state.cursorOffset, op, getSelfUserId());
        pendingSyncDoc = state.localDoc;
        return;
      }
      const model = editorRef.getModel();
      if (!model) {
        state.localDoc = applyToDoc(state.localDoc, op);
        state.cursorOffset = adjustCursor(state.cursorOffset, op, getSelfUserId());
        pendingSyncDoc = state.localDoc;
        return;
      }

      // Use the real current cursor offset (prevents stale offsets -> jumps).
      try {
        const curPos = editorRef.getPosition && editorRef.getPosition();
        if (curPos) state.cursorOffset = model.getOffsetAt(curPos);
      } catch (_e) { }

      suppressLocal = true;

      // Helper to apply edits even if read-only
      const applyEditsForce = (edits) => {
        const wasReadOnly = editorRef.getOption(monaco.editor.EditorOption.readOnly);
        if (wasReadOnly) {
          editorRef.updateOptions({ readOnly: false });
        }
        editorRef.executeEdits('ot-remote', edits);
        if (wasReadOnly) {
          editorRef.updateOptions({ readOnly: true });
        }
      };

      if (op.type === OP_INSERT) {
        const insertionOffset = clamp(op.pos, 0, model.getValueLength());
        const pos = model.getPositionAt(insertionOffset);
        applyEditsForce([
          {
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: op.text,
            forceMoveMarkers: true
          }
        ]);
      } else {
        const startOffset = clamp(op.pos, 0, model.getValueLength());
        const endOffset = clamp(op.pos + op.length, 0, model.getValueLength());

        // If delete collapses to nothing after clamping, ignore it.
        if (endOffset <= startOffset) {
          suppressLocal = false;
          return;
        }

        const startPos = model.getPositionAt(startOffset);
        const endPos = model.getPositionAt(endOffset);
        applyEditsForce([
          {
            range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
            text: '',
            forceMoveMarkers: true
          }
        ]);
      }
      suppressLocal = false;
      state.localDoc = applyToDoc(state.localDoc, op);

      // Let Monaco manage the cursor/selection; avoid forcing a new position (prevents cursor jumps).
      try {
        const newPos = editorRef.getPosition && editorRef.getPosition();
        if (newPos) state.cursorOffset = model.getOffsetAt(newPos);
      } catch (_e) { }
    };

    const handleLocalChange = (event) => {
      if (suppressLocal || !socketRef || !currentRoom) return;
      if (!event || !event.changes || !event.changes.length) return;
      const ordered = [...event.changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
      let offsetDelta = 0;
      ordered.forEach(change => {
        const actualOffset = change.rangeOffset + offsetDelta;
        if (change.rangeLength > 0) {
          const delOp = {
            type: OP_DELETE,
            pos: actualOffset,
            length: change.rangeLength
          };
          queueLocalOp(delOp);
          offsetDelta -= change.rangeLength;
        }
        if (change.text) {
          const insOp = {
            type: OP_INSERT,
            pos: actualOffset,
            text: change.text
          };
          queueLocalOp(insOp);
          offsetDelta += change.text.length;
        }
      });
    };

    const handleServerOp = ({ roomId, operation, version }) => {
      if (!operation || roomId !== currentRoom) return;
      const nextVersion = typeof version === 'number' ? version : null;

      // If we receive a huge version jump, prefer resync over trying to apply.
      if (nextVersion !== null && nextVersion > state.serverVersion + 5 && !outstandingOp && bufferOps.length === 0) {
        socketRef.emit('ot-request-state', { roomId: currentRoom });
        return;
      }

      if (operation.userId === getSelfUserId()) {
        // Server echo for our outstanding op.
        if (nextVersion !== null) state.serverVersion = nextVersion;
        outstandingOp = null;
        outstandingSent = false;
        clearSendTimer();

        if (bufferOps.length) {
          outstandingOp = bufferOps.shift();
          outstandingSent = false;
          scheduleSendOutstanding();
        }
        return;
      }

      const incoming = transformIncomingThroughLocal(operation);
      // If transforms produced an invalid delete, resync rather than corrupting state.
      if (incoming && incoming.type === OP_DELETE && (!incoming.length || incoming.length < 0)) {
        socketRef.emit('ot-request-state', { roomId: currentRoom });
        return;
      }
      applyRemoteOperation(incoming);
      if (nextVersion !== null) state.serverVersion = nextVersion;
    };

    const handleSync = ({ roomId, doc, version, syncId }) => {
      if (roomId !== currentRoom) return;
      if (typeof syncId === 'number') {
        if (syncId <= lastSyncId) {
          return;
        }
        lastSyncId = syncId;
      }
      const nextDoc = typeof doc === 'string' ? doc : '';
      state.localDoc = nextDoc;
      state.serverVersion = typeof version === 'number' ? version : 0;
      outstandingOp = null;
      outstandingSent = false;
      clearSendTimer();
      bufferOps.length = 0;
      pendingSyncDoc = nextDoc;
      if (!editorRef) return;
      suppressLocal = true;
      editorRef.setValue(nextDoc);
      suppressLocal = false;
      pendingSyncDoc = null;
    };

    const updateCursorOffset = () => {
      if (!editorRef) return;
      const model = editorRef.getModel();
      if (!model) return;
      const pos = editorRef.getPosition();
      if (!pos) return;
      state.cursorOffset = model.getOffsetAt(pos);
    };

    const attachSocket = (sock) => {
      if (!sock) return;
      if (socketRef) {
        socketRef.off('ot-sync', handleSync);
        socketRef.off('ot-operation', handleServerOp);
      }
      socketRef = sock;
      socketRef.on('ot-sync', handleSync);
      socketRef.on('ot-operation', handleServerOp);
      if (pendingServerDoc !== null && currentRoom) {
        socketRef.emit('ot-reset-doc', { roomId: currentRoom, doc: pendingServerDoc });
        pendingServerDoc = null;
      }
    };

    const attachEditor = (ed) => {
      if (!ed) return;
      editorRef = ed;
      if (pendingSyncDoc !== null) {
        suppressLocal = true;
        editorRef.setValue(pendingSyncDoc);
        suppressLocal = false;
        state.localDoc = pendingSyncDoc;
        pendingSyncDoc = null;
      } else {
        state.localDoc = getEditorValue();
      }
      ed.onDidChangeModelContent(handleLocalChange);
      ed.onDidChangeCursorPosition(updateCursorOffset);
    };

    const requestState = (roomId) => {
      if (!socketRef || !roomId) return;
      socketRef.emit('ot-request-state', { roomId });
    };

    const resetWithDocument = (doc, pushToServer) => {
      state.localDoc = typeof doc === 'string' ? doc : '';
      state.serverVersion = 0;
      outstandingOp = null;
      outstandingSent = false;
      clearSendTimer();
      bufferOps.length = 0;
      if (!pushToServer) {
        lastSyncId = 0;
      }
      if (pushToServer) {
        if (socketRef && currentRoom) {
          socketRef.emit('ot-reset-doc', { roomId: currentRoom, doc: state.localDoc });
        } else {
          pendingServerDoc = state.localDoc;
        }
      }
    };

    const suspendLocalChanges = () => {
      suppressLocal = true;
    };

    const resumeLocalChanges = ({ syncDoc, resetPending } = {}) => {
      if (typeof syncDoc === 'string') {
        state.localDoc = syncDoc;
        if (resetPending) {
          state.serverVersion = 0;
          outstandingOp = null;
          bufferOps.length = 0;
        }
      }
      suppressLocal = false;
    };

    return {
      attachSocket,
      attachEditor,
      requestState,
      resetWithDocument,
      suspendLocalChanges,
      resumeLocalChanges
    };
  }

  otApi = createOtEngine();

  // ---------------- FILE UPLOAD (bind to static toolbar) ----------------
  (function () {
    const fileInput = document.getElementById('fileUploadInput');
    const uploadBtn = document.getElementById('uploadFileBtn');

    async function handleUploadFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function (ev) {
        const content = ev.target.result;
        const filename = file.name;
        const ext = (filename.split('.').pop() || '').toLowerCase();
        const monacoLang = extToMonaco[ext] || 'plaintext';
        try {
          const res = await api('POST', '/api/code/save', {
            filename,
            code: content,
            language: monacoLang,
            roomId: currentRoom
          });
          currentFilename = res.filename || filename;
          setEditorValue(content, true, 'upload-file');
          setEditorLanguageByFilename(currentFilename);
          highlightActiveFile();
          refreshFileList();
          logOutput('Uploaded: ' + currentFilename);
          if (otApi) otApi.resetWithDocument(content, true);
        } catch (err) {
          logOutput('Upload failed: ' + (err.message || err));
        }
      };
      reader.onerror = function () { logOutput('File read error'); };
      reader.readAsText(file, 'utf-8');
    }

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () {
        const f = fileInput.files && fileInput.files[0];
        if (!f) { fileInput.click(); return; }
        handleUploadFile(f);
      });
      fileInput.addEventListener('change', function () {
        const f = fileInput.files && fileInput.files[0];
        if (f) handleUploadFile(f);
      });
    }
  })();

  // -------------- UTILS ----------------
  function logOutput(msg) {
    if (!outputEl) return;
    outputEl.textContent += (outputEl.textContent ? '\n' : '') + msg;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function api(method, url, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      credentials: 'same-origin'
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts)
      .then(r => r.json().catch(() => ({}))
        .then(data => {
          if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
          return data;
        }));
  }

  function markSavedSnapshot(content) {
    const snapshot = typeof content === 'string' ? content : getEditorValue();
    lastSavedHash = simpleHash(snapshot || '');
  }

  async function persistDocumentContent(content, hash, { keepalive = false, allowEmptySave = false } = {}) {
    if (!currentFilename) return;
    const payload = {
      filename: currentFilename,
      parentPath: currentParentPath || '/',
      code: content,
      language: getCurrentMonacoLanguage(),
      roomId: currentRoom
    };
    const isEmptyPayload = hash === EMPTY_DOC_HASH;
    const previouslySavedNonEmpty = lastSavedHash !== null && lastSavedHash !== EMPTY_DOC_HASH;
    if (isEmptyPayload && previouslySavedNonEmpty && !allowEmptySave) {
      if (!emptySaveWarningShown) {
        // logOutput('Autosave skipped to avoid wiping non-empty file. Use Save to confirm if you intend to clear it.');
        emptySaveWarningShown = true;
      }
      return;
    }
    emptySaveWarningShown = false;
    if (keepalive && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/code/save', blob);
        lastSavedHash = hash;
        if (needFileListRefresh) {
          needFileListRefresh = false;
          refreshFileList();
        }
        return;
      } catch (_err) {
        // fall through to fetch keepalive
      }
    }
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (keepalive) opts.keepalive = true;
    const res = await fetch('/api/code/save', opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    lastSavedHash = hash;
    if (needFileListRefresh) {
      needFileListRefresh = false;
      refreshFileList();
    }
  }

  function autosaveInternal(reason, options = {}) {
    if (!editor || !currentFilename) return Promise.resolve();
    const content = getEditorValue();
    const hash = simpleHash(content);
    if (!options.force && hash === lastSavedHash) return Promise.resolve();
    return persistDocumentContent(content, hash, options)
      .catch(err => {
        console.warn('[Autosave]', reason, err.message || err);
        throw err;
      });
  }

  function queueAutosave(reason = 'interval', options = {}) {
    if (!editor || !currentFilename) return;
    if (autosaveInFlight) {
      pendingAutosave = { reason, options };
      return;
    }
    autosaveInFlight = true;
    autosaveInternal(reason, options).finally(() => {
      autosaveInFlight = false;
      if (pendingAutosave) {
        const next = pendingAutosave;
        pendingAutosave = null;
        queueAutosave(next.reason, next.options);
      }
    });
  }

  function startAutosaveLoop() {
    if (autosaveTimerId) clearInterval(autosaveTimerId);
    autosaveTimerId = setInterval(() => queueAutosave('interval'), AUTOSAVE_INTERVAL_MS);
  }

  function autosaveOnExit() {
    if (!editor || !currentFilename) return;
    const content = getEditorValue();
    const hash = simpleHash(content);
    persistDocumentContent(content, hash, { keepalive: true }).catch(() => { });
  }

  // -------------- FILE OPERATIONS (TREE VIEW) ----------------
  let currentParentPath = '/';
  const expandedFolders = new Set(['/']); // Keep root expanded by default
  let lastFetchedFiles = null; // Cache for file list
  // Pending inline create action: { type: 'file'|'folder', parentPath, defaultName }
  let pendingCreate = null;

  function refreshFileList(useCache = false) {
    if (useCache && lastFetchedFiles) {
      renderCachedFiles(lastFetchedFiles);
      return;
    }

    api('GET', '/api/code/list')
      .then(data => {
        lastFetchedFiles = data.files || [];
        renderCachedFiles(lastFetchedFiles);
      })
      .catch(e => logOutput('List error: ' + e.message));
  }

  function renderCachedFiles(files) {
    fileListDiv.innerHTML = '';
    // Build Tree Structure
    const tree = buildFileTree(files);
    // Render Tree
    renderTree(tree, fileListDiv);
  }

  function buildFileTree(files) {
    const root = { name: '', path: '/', type: 'directory', children: {} };

    files.forEach(f => {
      // Normalize paths
      const pPath = f.parentPath || '/';
      const fullPath = (pPath === '/' ? '' : pPath) + '/' + f.filename;

      // Determine if it's a file or directory
      const isDir = f.type === 'directory';

      // Find parent node in tree
      let current = root;
      if (pPath !== '/') {
        const parts = pPath.split('/').filter(Boolean);
        parts.forEach(part => {
          if (!current.children[part]) {
            // Implicit folder if not found
            current.children[part] = {
              name: part,
              path: (current.path === '/' ? '' : current.path) + '/' + part,
              type: 'directory',
              children: {}
            };
          }
          current = current.children[part];
        });
      }

      // Add text/folder node
      if (isDir) {
        if (!current.children[f.filename]) {
          current.children[f.filename] = {
            name: f.filename,
            path: fullPath,
            type: 'directory',
            children: {},
            ...f
          };
        } else {
          // Merge if implicit node existed
          Object.assign(current.children[f.filename], f, { type: 'directory' });
        }
      } else {
        current.children[f.filename] = {
          name: f.filename,
          path: fullPath,
          type: 'file',
          ...f
        };
      }
    });

    return root;
  }


  function highlightActiveFile() {
    // Re-render from cache to update active class in tree
    refreshFileList(true);
  }

  function renderTree(node, container, depth = 0) {
    // Sort children: folders first, then files
    const children = Object.values(node.children).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const ul = document.createElement('div');
    ul.className = 'file-tree-list';

    // If creating directly under this node, show the inline input at top
    if (pendingCreate && node.path === pendingCreate.parentPath) {
      const inlineRowTop = createInlineCreateRow(pendingCreate);
      ul.appendChild(inlineRowTop);
    }

    children.forEach(child => {
      // If there's a pending create and it targets this node's path and we're rendering the parent container,
      // we'll insert the inline input row before rendering actual children. We handle insertion when child is the first.
      const item = document.createElement('div');
      item.className = 'file-tree-item';

      const row = document.createElement('div');
      row.className = 'file-tree-row';
      row.dataset.path = child.path;
      row.style.paddingLeft = (depth * 12 + 8) + 'px'; // Indentation

      // 1. Chevron (for folders only)
      if (child.type === 'directory') {
        const chevron = document.createElement('i');
        chevron.className = 'fa-solid fa-chevron-right tree-chevron';
        if (expandedFolders.has(child.path)) {
          chevron.classList.add('expanded');
        }
        row.appendChild(chevron);
      } else {
        // Spacer for files to align with folders
        const spacer = document.createElement('span');
        spacer.className = 'tree-chevron spacer'; // Use same width
        row.appendChild(spacer);
      }

      // 2. Icon (Folder / File Type)
      const icon = document.createElement('i');
      icon.className = 'fa-solid tree-icon';
      if (child.type === 'directory') {
        icon.classList.add(expandedFolders.has(child.path) ? 'fa-folder-open' : 'fa-folder', 'folder');
      } else {
        icon.className = 'fa-solid tree-icon ' + getFileIconClass(child.name);
      }
      row.appendChild(icon);

      // 3. Label
      const label = document.createElement('span');
      label.textContent = child.name;
      label.className = 'file-tree-label';
      row.appendChild(label);

      // 3-Dot Menu Button
      const menuBtn = document.createElement('button');
      menuBtn.className = 'three-dot-btn';
      menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
      menuBtn.title = 'More actions';
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        showDropdownMenu(e, child, menuBtn);
      };
      row.appendChild(menuBtn);

      // Event Listeners
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (child.type === 'directory') {
          toggleFolder(child.path);
        } else {
          loadFile(child.name, child.parentPath);
        }
      });

      // (No contextmenu listener anymore)

      item.appendChild(row);

      // Render Children if expanded
      if (child.type === 'directory' && expandedFolders.has(child.path)) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'file-tree-children';
        renderTree(child, childrenContainer, depth + 1);
        item.appendChild(childrenContainer);
      }

      ul.appendChild(item);
    });

    container.appendChild(ul);
  }

  function getFileIconClass(filename) {
    if (filename.endsWith('.js')) return 'fa-brands fa-js js';
    if (filename.endsWith('.html')) return 'fa-brands fa-html5 html';
    if (filename.endsWith('.css')) return 'fa-brands fa-css3-alt css';
    if (filename.endsWith('.py')) return 'fa-brands fa-python py';
    if (filename.endsWith('.json')) return 'fa-solid fa-file-code default';
    return 'fa-solid fa-file default';
  }

  function createInlineCreateRow(pending) {
    const wrapper = document.createElement('div');
    wrapper.className = 'file-tree-item inline-create';

    const row = document.createElement('div');
    row.className = 'file-tree-row';
    row.style.paddingLeft = '24px';

    const spacer = document.createElement('span');
    spacer.className = 'tree-chevron spacer';
    row.appendChild(spacer);

    const input = document.createElement('input');
    input.className = 'inline-create-input';
    input.placeholder = pending.type === 'file' ? 'New file name (e.g. main.js)' : 'New folder name';
    input.value = pending.defaultName || '';
    input.style.flex = '1';
    input.style.marginRight = '6px';
    row.appendChild(input);

    const okBtn = document.createElement('button');
    okBtn.className = 'inline-create-icon-btn';
    okBtn.setAttribute('title', 'Create');
    okBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const doCreate = async () => {
      const name = input.value && input.value.trim();
      if (!name) return;
      try {
        if (pending.type === 'file') {
          await api('POST', '/api/code/save', { filename: name, parentPath: pending.parentPath, code: '', language: getLanguageFromFilename(name) });
          expandedFolders.add(pending.parentPath);
          loadFile(name, pending.parentPath);
        } else {
          await api('POST', '/api/code/create-folder', { filename: name, parentPath: pending.parentPath });
          expandedFolders.add(pending.parentPath);
        }
        if (window.socket) window.socket.emit('filelist-changed');
      } catch (err) {
        logOutput('Error: ' + (err.message || err));
      }
      cleanup();
    };
    okBtn.addEventListener('click', doCreate);
    row.appendChild(okBtn);

    wrapper.appendChild(row);
    // focus input after insertion
    setTimeout(() => input.focus(), 60);

    // Cleanup helper
    const cleanup = () => {
      pendingCreate = null;
      removeOutsideListener();
      refreshFileList();
    };

    // Click-outside handler to cancel
    const outsideHandler = (ev) => {
      if (!wrapper.contains(ev.target)) {
        cleanup();
      }
    };

    const removeOutsideListener = () => {
      document.removeEventListener('click', outsideHandler);
    };

    // Attach outside click listener (delay to avoid immediate trigger)
    setTimeout(() => document.addEventListener('click', outsideHandler), 50);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doCreate();
      if (e.key === 'Escape') cleanup();
    });
    return wrapper;
  }

  function toggleFolder(path) {
    if (expandedFolders.has(path)) {
      expandedFolders.delete(path);
    } else {
      expandedFolders.add(path);
    }
    refreshFileList(true);
  }

  // --- 3-Dot Dropdown Logic ---
  let dropdownEl = null;
  let activeMenuBtn = null;

  function showDropdownMenu(e, node, btn) {
    if (!dropdownEl) createDropdown();

    // Close if clicking same button
    if (activeMenuBtn === btn && dropdownEl.style.display === 'block') {
      hideDropdown();
      return;
    }

    activeMenuBtn = btn;
    btn.classList.add('active');

    const menu = dropdownEl;
    menu.innerHTML = '';

    const actions = [];
    if (node.type === 'directory') {
      actions.push({ label: 'New File', icon: 'fa-file-circle-plus', action: () => createNewFileIn(node.path) });
      actions.push({ label: 'New Folder', icon: 'fa-folder-plus', action: () => createNewFolderIn(node.path) });
      actions.push({ separator: true });
    }
    // Rename/Delete for BOTH files and folders now
    actions.push({ label: 'Rename', icon: 'fa-pen', action: () => handleRename(node) });
    actions.push({ label: 'Delete', icon: 'fa-trash', action: () => handleDelete(node) });

    actions.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'tree-dropdown-separator';
        menu.appendChild(sep);
      } else {
        const div = document.createElement('div');
        div.className = 'tree-dropdown-item';
        div.innerHTML = `<i class="fa-solid ${item.icon}" style="width:16px"></i> ${item.label}`;
        div.onclick = () => {
          hideDropdown();
          item.action();
        };
        menu.appendChild(div);
      }
    });

    menu.style.display = 'block';

    // Position near button
    const btnRect = btn.getBoundingClientRect();
    let top = btnRect.bottom + 2;
    let left = btnRect.right - 140; // Align right edge roughly

    // Adjust if offscreen
    if (left < 10) left = 10;
    if (top + menu.offsetHeight > window.innerHeight) {
      top = btnRect.top - menu.offsetHeight - 2; // Show above
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // Click outside to close
    setTimeout(() => {
      const closeMenu = (ev) => {
        if (dropdownEl.contains(ev.target)) return;
        hideDropdown();
        document.removeEventListener('click', closeMenu);
      };
      document.addEventListener('click', closeMenu);
    }, 10);
  }

  function hideDropdown() {
    if (dropdownEl) dropdownEl.style.display = 'none';
    if (activeMenuBtn) {
      activeMenuBtn.classList.remove('active');
      activeMenuBtn = null;
    }
  }

  function createDropdown() {
    dropdownEl = document.createElement('div');
    dropdownEl.className = 'tree-dropdown';
    document.body.appendChild(dropdownEl);
  }

  async function createNewFileIn(parentPath) {
    // show inline input in the file tree instead of modal
    pendingCreate = { type: 'file', parentPath, defaultName: '' };
    expandedFolders.add(parentPath);
    refreshFileList();
  }

  async function createNewFolderIn(parentPath) {
    // show inline input in the file tree instead of modal
    pendingCreate = { type: 'folder', parentPath, defaultName: '' };
    expandedFolders.add(parentPath);
    refreshFileList();
  }

  async function handleRename(node) {
    // Inline rename: replace the label with an input in-place
    const selector = `.file-tree-row[data-path="${node.path}"]`;
    let row = document.querySelector(selector);
    if (!row) {
      // If the row isn't present (collapsed or not rendered), expand parent and refresh then try again
      if (node.parentPath) expandedFolders.add(node.parentPath);
      refreshFileList();
      // try to find after a short delay
      await new Promise(r => setTimeout(r, 80));
      row = document.querySelector(selector);
      if (!row) return; // give up
    }

    // Prevent multiple rename inputs
    if (document.querySelector('.file-tree-item.inline-rename')) return;

    const label = row.querySelector('.file-tree-label');
    if (!label) return;

    const originalText = label.textContent;
    const container = row.parentElement || row;

    // Create inline input
    const renameWrapper = document.createElement('div');
    renameWrapper.className = 'file-tree-item inline-rename';
    const renameRow = document.createElement('div');
    renameRow.className = 'file-tree-row';
    renameRow.style.paddingLeft = row.style.paddingLeft || '24px';

    const spacer = document.createElement('span');
    spacer.className = 'tree-chevron spacer';
    renameRow.appendChild(spacer);

    const input = document.createElement('input');
    input.className = 'inline-rename-input';
    input.value = node.name || '';
    input.style.flex = '1';
    input.style.marginRight = '6px';
    renameRow.appendChild(input);

    const okBtn = document.createElement('button');
    okBtn.className = 'inline-create-icon-btn';
    okBtn.setAttribute('title', 'Rename');
    okBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h4l10-10a2.828 2.828 0 000-4l-2-2a2.828 2.828 0 00-4 0L6 14v4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    renameRow.appendChild(okBtn);

    renameWrapper.appendChild(renameRow);

    // Insert rename row right after the target row's parent container's node
    const item = row.closest('.file-tree-item') || row;
    item.parentNode.insertBefore(renameWrapper, item.nextSibling);

    // focus
    setTimeout(() => input.focus(), 40);

    const cleanup = () => {
      if (renameWrapper && renameWrapper.parentNode) renameWrapper.parentNode.removeChild(renameWrapper);
      document.removeEventListener('click', outsideHandler);
      // ensure pendingCreate unaffected
    };

    const doRename = async () => {
      const newName = input.value && input.value.trim();
      if (!newName || newName === node.name) { cleanup(); return; }
      try {
        await api('POST', '/api/code/rename', {
          oldName: node.name,
          newName,
          oldParentPath: node.parentPath,
          newParentPath: node.parentPath,
          type: node.type
        });
        if (currentFilename === node.name && currentParentPath === node.parentPath) {
          currentFilename = newName;
        }
        if (window.socket) window.socket.emit('filelist-changed');
      } catch (err) {
        logOutput('Rename error: ' + (err.message || err));
      }
      cleanup();
      refreshFileList();
    };

    okBtn.addEventListener('click', doRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRename();
      if (e.key === 'Escape') cleanup();
    });

    const outsideHandler = (ev) => {
      if (!renameWrapper.contains(ev.target)) cleanup();
    };

    setTimeout(() => document.addEventListener('click', outsideHandler), 30);
  }

  async function handleDelete(node) {
    const msg = node.type === 'directory'
      ? 'Delete folder "' + node.name + '" and ALL its contents?'
      : 'Delete file "' + node.name + '"?';

    if (!await customConfirm(msg)) return;

    api('DELETE', '/api/code/delete', {
      filename: node.name,
      parentPath: node.parentPath,
      type: node.type
    })
      .then(() => {
        if (currentFilename === node.name && currentParentPath === node.parentPath) {
          currentFilename = null;
          currentParentPath = '/';
          setEditorValue('', true, 'delete-file');
        }
        if (window.socket) window.socket.emit('filelist-changed');
        refreshFileList();
      })
      .catch(e => logOutput('Delete error: ' + e.message));
  }

  // Inject Toolbar
  function injectToolbar() {
    const container = fileListDiv.parentElement;
    if (container && !container.querySelector('#treeActions')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'treeActions';
      toolbar.className = 'tree-toolbar';
      toolbar.innerHTML = `
            <button id="newFileBtn" title="New File"><i class="fa-solid fa-file-circle-plus"></i></button>
            <button id="newFolderBtn" title="New Folder"><i class="fa-solid fa-folder-plus"></i></button>
        `;
      container.insertBefore(toolbar, fileListDiv);

      document.getElementById('newFileBtn').onclick = createNewFile;
      document.getElementById('newFolderBtn').onclick = createNewFolder;
    }
  }
  // Call it immediately if strict placement isn't an issue, or call in refresh
  setTimeout(injectToolbar, 500);

  async function createNewFile() {
    // Toolbar button - create inline at root
    pendingCreate = { type: 'file', parentPath: '/', defaultName: '' };
    expandedFolders.add('/');
    refreshFileList();
  }

  async function createNewFolder() {
    // Toolbar button - create inline at root
    pendingCreate = { type: 'folder', parentPath: '/', defaultName: '' };
    expandedFolders.add('/');
    refreshFileList();
  }

  function getLanguageFromFilename(name) {
    const ext = name.split('.').pop();
    return extToMonaco[ext] || 'plaintext';
  }

  function highlightActiveFile() {
    refreshFileList();
  }

  function setLanguageSelectByMonaco(monacoLang) {
    if (!langSelect) return;
    for (let i = 0; i < langSelect.options.length; i++) {
      if (langSelect.options[i].dataset.monaco === monacoLang) {
        langSelect.selectedIndex = i;
        return;
      }
    }
  }

  function setEditorLanguageByFilename(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const lang = extToMonaco[ext] || 'plaintext';
    if (!editor || !window.monaco) {
      pendingLanguageMonaco = lang;
      return;
    }
    const model = editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, lang);
    setLanguageSelectByMonaco(lang);
    pendingLanguageMonaco = null;
  }

  function loadFile(name, parentPath = '/') {
    const pPath = parentPath || '/';

    api('GET', `/api/code/load?filename=${encodeURIComponent(name)}&parentPath=${encodeURIComponent(pPath)}`)
      .then(data => {
        currentFilename = data.filename;
        currentParentPath = data.parentPath || '/';

        setEditorValue(data.code || '', true, 'load-file');
        setEditorLanguageByFilename(data.filename);

        if (otApi) otApi.resetWithDocument(data.code || '', false);
        lastSavedHash = simpleHash(data.code || '');

        logOutput(`Loaded: ${currentFilename}`);
        refreshFileList(); // Re-highlight active

        markSavedSnapshot(data.code);
        needFileListRefresh = false;

        if (window.socket) {
          window.socket.emit('active-file', { roomId: currentRoom, filename: currentFilename, parentPath: currentParentPath, language: data.language });
        }
      })
      .catch(e => {
        logOutput('Load error: ' + e.message);
      });
  }

  async function saveFile() {
    if (!currentFilename) {
      const proposed = 'file' + Date.now() + '.js';
      const name = await customPrompt('Enter filename (with extension):', proposed);
      if (!name) return;
      currentFilename = name.trim();
      currentParentPath = '/'; // Default for quick save? Or ask?
    }
    const content = getEditorValue();
    const hash = simpleHash(content);
    persistDocumentContent(content, hash).then(() => {
      logOutput('Saved ' + currentFilename);
    });
  }


  // -------------- RUN CODE ----------------
  function runCode() {
    if (!langSelect) {
      logOutput('Language select missing');
      return;
    }
    runBtn.disabled = true;
    logOutput('Running...');
    if (stderrOutput) stderrOutput.textContent = 'Waiting for stderr...';
    api('POST', '/api/code/run', {
      source_code: getEditorValue(),
      language_id: parseInt(langSelect.value, 10),
      stdin: stdinInput.value
    })
      .then(d => {
        // If there are compilation errors or stderr, show them in the Errors tab
        const hasStderr = d && typeof d.stderr === 'string' && d.stderr.trim();
        const hasCompile = d && typeof d.compile_output === 'string' && d.compile_output.trim();
        if (hasStderr || hasCompile) {
          updateErrorPanel(d);
          // switch to Errors tab so user sees the problem
          setActiveOutputTab('errorsSection');
          // Only show stdout in the Output tab (if present) as a short note
          if (d.stdout) {
            logOutput('STDOUT:\n' + d.stdout);
          } else {
            logOutput('Run completed with errors. See Errors tab for details.');
          }
        } else {
          // No errors: show usual output
          setActiveOutputTab('outputSection');
          logOutput(formatRunResult(d));
        }
      })
      .catch(e => {
        // Runtime failure (network / server error) - show concise note and switch to Errors
        updateErrorPanel({ stderr: e.message || 'Run error' });
        setActiveOutputTab('errorsSection');
        logOutput('Run failed. See Errors tab for details.');
      })
      .finally(() => runBtn.disabled = false);
  }

  function formatRunResult(d) {
    const lines = [];
    // if(d.status) lines.push('Status: '+(d.status.description || d.status.id));
    if (d.stdout) lines.push('STDOUT:\n' + d.stdout);
    if (d.stderr) lines.push('STDERR:\n' + d.stderr);
    if (d.compile_output) lines.push('COMPILER:\n' + d.compile_output);
    if (!d.stdout && !d.stderr && !d.compile_output) lines.push('(no output)');
    return lines.join('\n\n');
  }

  function updateErrorPanel(result) {
    if (!stderrOutput) return;
    const segments = [];
    if (result && typeof result.stderr === 'string' && result.stderr.trim()) {
      segments.push('STDERR\n' + result.stderr.trim());
    }
    if (result && typeof result.compile_output === 'string' && result.compile_output.trim()) {
      segments.push('COMPILER\n' + result.compile_output.trim());
    }
    stderrOutput.textContent = segments.length ? segments.join('\n\n') : 'No stderr output.';
  }

  // -------------- SOCKET / COLLAB ----------------
  function initSocket() {
    if (typeof io === 'undefined') {
      console.error('[Socket] io not loaded.');
      return;
    }
    socket = io();
    window.socket = socket;
    socket.on('whoami', (payload) => {
      if (payload && payload.userId) {
        window.myServerUserId = payload.userId;
      }
      if (payload && payload.socketId) {
        window.mySocketId = payload.socketId;
      }
    });
    if (otApi) otApi.attachSocket(socket);
    socket.on('connect', () => {
      joinRoom(currentRoom);
    });
    socket.on('filelist-changed', () => {
      refreshFileList();
    });
    socket.on('active-file', ({ filename, language }) => {
      if (!filename || currentFilename) return;
      currentFilename = filename;
      setLanguageSelectByMonaco(language || 'plaintext');
      logOutput('Active file shared: ' + filename);
      needFileListRefresh = true;
    });
    // Receive current users in room (array or single) and render with mute controls
    socket.on('user-name', (users) => {
      const usersListDiv = document.getElementById('usersList');
      if (!usersListDiv) return;
      usersListDiv.innerHTML = '';
      const renderUser = (user) => {
        const uid = user.socketId || user.id || user._id || user.googleId || user.socket || (user.name && ('user-' + user.name));
        const normalizedUserId = user.id || user._id || user.googleId || uid;
        const isCurrentSocket = !!(user.socketId && window.socket && user.socketId === window.socket.id);
        if (isCurrentSocket && normalizedUserId) {
          window.myServerUserId = normalizedUserId;
        }
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.peerId = uid;
        if (user.socketId) userItem.dataset.socketId = user.socketId;

        // audio dot (activity)
        const dot = document.createElement('div');
        dot.className = 'audio-dot';
        userItem.appendChild(dot);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.name || user.displayName || user.googleId || uid || 'Unknown';
        nameSpan.style.flex = '1';
        if (user.email) nameSpan.title = user.email;
        if (user.color) nameSpan.style.color = user.color;
        userItem.appendChild(nameSpan);

        // Mute controls are provided by owner-controls module to avoid duplication.
        // owner-controls.js will augment existing user items with mute/menu buttons when needed.

        usersListDiv.appendChild(userItem);
      };

      if (Array.isArray(users)) {
        users.forEach(renderUser);
      } else {
        renderUser(typeof users === 'string' ? { name: users } : users || {});
      }
    });

    // Update user list mute button state when peers announce mute status
    window.addEventListener('voice:peer-muted', (e) => {
      const { peerId, muted } = e.detail || {};
      if (!peerId) return;
      const usersListDiv = document.getElementById('usersList');
      if (!usersListDiv) return;
      const item = usersListDiv.querySelector(`.user-item[data-peer-id="${peerId}"]`);
      if (item) {
        const btn = item.querySelector('.user-action-btn.mute, .user-mute-btn');
        if (btn) {
          const isMe = btn.dataset && btn.dataset.isMe;
          // Use icon-only buttons (no text) for mute state
          if (isMe) {
            btn.innerHTML = muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
            btn.title = muted ? 'Muted (you)' : 'Unmuted (you)';
          } else {
            if (btn.dataset.muted !== '1') {
              btn.innerHTML = muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
              btn.title = muted ? 'Muted' : 'Unmuted';
            }
          }
        }
        item.classList.toggle('muted', !!muted);
      }
    });

    // Also update local entry when local mute changes
    window.addEventListener('voice:local-muted', (e) => {
      const muted = e.detail && e.detail.muted;
      const usersListDiv = document.getElementById('usersList');
      if (!usersListDiv) return;
      const myId = (window.socket && window.socket.id) || (window.user && (window.user._id || window.user.googleId)) || 'me';
      const item = usersListDiv.querySelector(`.user-item[data-peer-id="${myId}"]`);
      if (item) {
        const btn = item.querySelector('.user-action-btn.mute, .user-mute-btn');
        if (btn) {
          btn.innerHTML = muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
          btn.title = muted ? 'Muted (you)' : 'Unmuted (you)';
        }
        item.classList.toggle('muted', !!muted);
      }
    });

    // Show which peer has audio (speaking/active stream) in users list
    // Mark when a peer has an active audio stream (attached) - keep separate from speaking
    window.addEventListener('voice:peer-audio', (e) => {
      const peerId = e.detail && e.detail.peerId;
      if (!peerId) return;
      const usersListDiv = document.getElementById('usersList'); if (!usersListDiv) return;
      const item = usersListDiv.querySelector(`.user-item[data-peer-id="${peerId}"]`);
      if (item) {
        item.classList.add('has-audio');
      }
    });

    // Speaking VAD events: add/remove 'speaking' class while user is actively speaking
    window.addEventListener('voice:peer-speaking', (e) => {
      const peerId = e.detail && e.detail.peerId;
      if (!peerId) return;
      const usersListDiv = document.getElementById('usersList'); if (!usersListDiv) return;
      // Try multiple matching strategies
      let item = usersListDiv.querySelector(`.user-item[data-socket-id="${peerId}"]`);
      if (!item) item = usersListDiv.querySelector(`.user-item[data-peer-id="${peerId}"]`);
      // Fallback: check all items manually
      if (!item) {
        const items = usersListDiv.querySelectorAll('.user-item');
        for (const it of items) {
          if (it.dataset.socketId === peerId || it.dataset.peerId === peerId) {
            item = it;
            break;
          }
        }
      }
      if (item) {
        item.classList.add('speaking');
      } else {
        console.warn('[VOICE] Speaking peer not found:', peerId);
        console.log('[VOICE] Available users:', Array.from(usersListDiv.querySelectorAll('.user-item')).map(i => ({ socketId: i.dataset.socketId, peerId: i.dataset.peerId })));
      }
    });
    window.addEventListener('voice:peer-stopped', (e) => {
      const peerId = e.detail && e.detail.peerId;
      if (!peerId) return;
      const usersListDiv = document.getElementById('usersList'); if (!usersListDiv) return;
      // Try multiple matching strategies
      let item = usersListDiv.querySelector(`.user-item[data-socket-id="${peerId}"]`);
      if (!item) item = usersListDiv.querySelector(`.user-item[data-peer-id="${peerId}"]`);
      // Fallback: check all items manually
      if (!item) {
        const items = usersListDiv.querySelectorAll('.user-item');
        for (const it of items) {
          if (it.dataset.socketId === peerId || it.dataset.peerId === peerId) {
            item = it;
            break;
          }
        }
      }
      if (item) {
        item.classList.remove('speaking');
      }
    });

    // Clear speaking/muted state when peer leaves
    window.addEventListener('voice:peer-left', (e) => {
      const peerId = e.detail && e.detail.peerId; if (!peerId) return;
      const usersListDiv = document.getElementById('usersList'); if (!usersListDiv) return;
      // Try multiple matching strategies
      let item = usersListDiv.querySelector(`.user-item[data-socket-id="${peerId}"]`);
      if (!item) item = usersListDiv.querySelector(`.user-item[data-peer-id="${peerId}"]`);
      // Fallback: check all items manually
      if (!item) {
        const items = usersListDiv.querySelectorAll('.user-item');
        for (const it of items) {
          if (it.dataset.socketId === peerId || it.dataset.peerId === peerId) {
            item = it;
            break;
          }
        }
      }
      if (item) {
        item.classList.remove('speaking');
        item.classList.remove('muted');
      }
    });
    socket.on('connect_error', err => {
      if (err && /Unauthorized/i.test(err.message)) {
        window.location = '/login?error=auth_required';
      }
    });
  }
  const outputPanel = document.getElementById('panelOutput');
  if (outputPanel) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    const edgeThreshold = 6; // pixels from top edge

    // Change cursor when near the top edge
    outputPanel.addEventListener('mousemove', (e) => {
      const rect = outputPanel.getBoundingClientRect();
      if (e.clientY <= rect.top + edgeThreshold) {
        outputPanel.style.cursor = 'ns-resize';
      } else {
        outputPanel.style.cursor = 'default';
      }
    });

    // Start resizing when mousedown on top edge
    outputPanel.addEventListener('mousedown', (e) => {
      const rect = outputPanel.getBoundingClientRect();
      if (e.clientY <= rect.top + edgeThreshold) {
        isResizing = true;
        startY = e.clientY;
        startHeight = rect.height;
        document.body.style.userSelect = 'none'; // prevent text selection
      }
    });

    // Handle dragging
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const deltaY = startY - e.clientY; // note the minus for top dragging
      const newHeight = startHeight + deltaY;
      outputPanel.style.height = Math.max(150, Math.min(800, newHeight)) + 'px';
    });

    // Stop resizing on mouseup
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = 'auto';
        outputPanel.style.cursor = 'default';
        if (typeof applyWorkspaceResizeEffects === 'function') applyWorkspaceResizeEffects();
      }
    });
  }


  function joinRoom(roomId) {
    currentRoom = roomId;
    window.currentRoom = currentRoom;
    window.WHITEBOARD_ROOM = roomId;
    if (bodyEl) {
      bodyEl.dataset.room = roomId;
    }
    updateWhiteboardRoomLabel(roomId);
    updateShareRoomLink(roomId);
    updateRoomQueryParam(roomId);
    setShareRoomButtonState('default');
    if (window.inlineWhiteboard && window.inlineWhiteboard.setRoom) {
      window.inlineWhiteboard.setRoom(roomId);
    }
    if (roomInput) roomInput.value = '';
    if (!socket) return;
    if (otApi) otApi.resetWithDocument(getEditorValue(), false);
    socket.emit('join-room', roomId);
    if (otApi) otApi.requestState(roomId);
    logOutput('Joined room: ' + roomId);

    // Update mobile top bar with room ID
    const mobileRoomDisplay = document.getElementById('mobileRoomDisplay');
    if (mobileRoomDisplay) {
      mobileRoomDisplay.textContent = 'Room ID: ' + roomId;
    }
    // Update toolbar room display in left panel
    const toolbarRoomId = document.getElementById('toolbarRoomId');
    if (toolbarRoomId) {
      toolbarRoomId.textContent = '' + roomId;
    }
    // 'user-name' is handled centrally in initSocket; don't re-register here to avoid duplicates
    // Send caret position immediately after joining
    setTimeout(() => {
      if (editor && socket && currentRoom) {
        const pos = editor.getPosition();
        const model = editor.getModel();
        const offset = model.getOffsetAt(pos);
        socket.emit('caret-position', { roomId: currentRoom, offset });
      }
    }, 200);
  }

  // --- PRESENCE: Send cursor position on change and on room join ---
  function sendCursorPositionToRoom() {
    if (!editor || !socket || !currentRoom) return;
    const pos = editor.getPosition();
    socket.emit('presence-cursor', { position: pos });
  }

  // Send cursor position on change
  function setupPresenceCursor() {
    if (!editor || !socket) return;
    editor.onDidChangeCursorPosition(sendCursorPositionToRoom);
    // Also send on room join
    socket.on('connect', sendCursorPositionToRoom);
    socket.on('joined-room', sendCursorPositionToRoom);
  }

  // Call this after socket and editor are ready
  setupPresenceCursor();

  // --- COLLABORATIVE CARET SHARING ---
  (function () {
    let remoteCaretDecorations = {};
    let remoteCaretOffsets = {};
    let remoteSelectionDecorations = {};
    let remoteSelectionRanges = {};
    function getMyUserId() {
      if (window.myServerUserId) return window.myServerUserId;
      return (window.user && (window.user._id || window.user.googleId || window.user.id))
        || (window.__CC_DEBUG__ && window.__CC_DEBUG__.userId)
        || (socket && socket.id)
        || 'me';
    }
    function hexToRgba(hex, alpha) {
      if (!hex) return `rgba(79, 216, 155, ${alpha})`;
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
      const bigint = parseInt(h, 16);
      if (Number.isNaN(bigint)) return `rgba(79, 216, 155, ${alpha})`;
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    function applyRemoteSelections() {
      if (!editor || typeof monaco === 'undefined') return;
      const model = editor.getModel();
      if (!model) return;
      Object.keys(remoteSelectionRanges).forEach(userId => {
        const data = remoteSelectionRanges[userId];
        if (!data || typeof data.start !== 'number' || typeof data.end !== 'number' || data.start === data.end) {
          if (remoteSelectionDecorations[userId]) {
            remoteSelectionDecorations[userId] = editor.deltaDecorations(remoteSelectionDecorations[userId] || [], []);
            delete remoteSelectionDecorations[userId];
          }
          delete remoteSelectionRanges[userId];
          return;
        }
        const docLen = model.getValueLength();
        const start = Math.max(0, Math.min(data.start, docLen));
        const end = Math.max(0, Math.min(data.end, docLen));
        if (start === end) {
          if (remoteSelectionDecorations[userId]) {
            remoteSelectionDecorations[userId] = editor.deltaDecorations(remoteSelectionDecorations[userId] || [], []);
            delete remoteSelectionDecorations[userId];
          }
          delete remoteSelectionRanges[userId];
          return;
        }
        const startPos = model.getPositionAt(start);
        const endPos = model.getPositionAt(end);
        const selectionClass = `remote-selection-color-${userId}`;
        const styleId = `${selectionClass}-style`;
        const color = data.color || '#4fd89b';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          const bg = hexToRgba(color, 0.25);
          const border = hexToRgba(color, 0.55);
          style.innerHTML = `.monaco-editor .${selectionClass} { background-color: ${bg}; border-bottom: 1px solid ${border}; border-radius: 2px; }`;
          document.head.appendChild(style);
        }
        remoteSelectionDecorations[userId] = editor.deltaDecorations(remoteSelectionDecorations[userId] || [], [
          {
            range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
            options: {
              inlineClassName: selectionClass,
              stickiness: 1
            }
          }
        ]);
      });
      Object.keys(remoteSelectionDecorations).forEach(userId => {
        if (!remoteSelectionRanges[userId]) {
          remoteSelectionDecorations[userId] = editor.deltaDecorations(remoteSelectionDecorations[userId] || [], []);
          delete remoteSelectionDecorations[userId];
        }
      });
    }
    function sendCaretPosition() {
      if (!editor || !socket || !currentRoom) return;
      const pos = editor.getPosition();
      const model = editor.getModel();
      const offset = model.getOffsetAt(pos);
      socket.emit('caret-position', { roomId: currentRoom, offset });
    }
    function setupCaretSharing() {
      if (!editor || !socket) return;
      editor.onDidChangeCursorPosition(sendCaretPosition);
      let selectionDebounce;
      let lastSelectionSignature = null;
      function emitSelectionUpdate() {
        if (!editor || !socket || !currentRoom) return;
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection) return;
        const startOffset = model.getOffsetAt(selection.getStartPosition());
        const endOffset = model.getOffsetAt(selection.getEndPosition());
        const start = Math.min(startOffset, endOffset);
        const end = Math.max(startOffset, endOffset);
        if (start === end) {
          if (lastSelectionSignature !== 'none') {
            lastSelectionSignature = 'none';
            socket.emit('selection-update', { roomId: currentRoom, selection: null });
          }
          return;
        }
        const signature = `${start}:${end}`;
        if (signature === lastSelectionSignature) return;
        lastSelectionSignature = signature;
        socket.emit('selection-update', { roomId: currentRoom, selection: { start, end } });
      }
      editor.onDidChangeCursorSelection(() => {
        clearTimeout(selectionDebounce);
        selectionDebounce = setTimeout(emitSelectionUpdate, 80);
      });
      emitSelectionUpdate();
      socket.on('remote-caret', (payload) => {
        if (!editor) return;
        const myId = getMyUserId();
        // If payload contains allCarets, update all remote carets
        if (Array.isArray(payload.allCarets)) {
          // Remove all previous remote caret decorations for users not in the new list
          const newUserIds = new Set(payload.allCarets.map(c => c.userId));
          Object.keys(remoteCaretDecorations).forEach(userId => {
            if (!newUserIds.has(userId)) {
              remoteCaretDecorations[userId] = editor.deltaDecorations(remoteCaretDecorations[userId], []);
              delete remoteCaretDecorations[userId];
              delete remoteCaretOffsets[userId];
            }
          });
          const model = editor.getModel();
          payload.allCarets.forEach(({ userId, offset, color }) => {
            if (!userId || userId === myId || typeof offset !== 'number') return;
            const pos = model.getPositionAt(Math.min(offset, model.getValue().length));
            remoteCaretOffsets[userId] = offset;
            // Generate a unique class for this user's caret color if not already present
            const caretClass = `remote-caret-color-${userId}`;
            if (color && !document.getElementById(caretClass)) {
              const style = document.createElement('style');
              style.id = caretClass;
              style.innerHTML = `.${caretClass} { border-left: 2px solid ${color} !important; margin-left: -1px; pointer-events: none; z-index: 10; animation: caret-blink 1s steps(1) infinite; }`;
              document.head.appendChild(style);
            }
            remoteCaretDecorations[userId] = editor.deltaDecorations(remoteCaretDecorations[userId] || [], [
              {
                range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                options: {
                  className: `remote-caret-blink ${caretClass}`,
                  stickiness: 1
                }
              }
            ]);
          });
        } else if (typeof payload.offset === 'number' && payload.userId && payload.userId !== myId) {
          // Single remote caret update (for new/changed caret)
          const { userId, offset } = payload;
          const model = editor.getModel();
          const pos = model.getPositionAt(Math.min(offset, model.getValue().length));
          remoteCaretOffsets[userId] = offset;
          if (remoteCaretDecorations[userId]) {
            remoteCaretDecorations[userId] = editor.deltaDecorations(remoteCaretDecorations[userId], []);
          }
          remoteCaretDecorations[userId] = editor.deltaDecorations([], [
            {
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
              options: {
                className: 'remote-caret-blink',
                stickiness: 1
              }
            }
          ]);
        }
      });
      socket.on('remote-selection', (payload) => {
        if (!editor) return;
        const myId = getMyUserId();
        const selections = Array.isArray(payload && payload.selections) ? payload.selections : [];
        const keep = new Set();
        selections.forEach(({ userId, start, end, color }) => {
          if (!userId || userId === myId) return;
          if (typeof start === 'number' && typeof end === 'number' && start !== end) {
            remoteSelectionRanges[userId] = { start: Math.min(start, end), end: Math.max(start, end), color };
            keep.add(userId);
          } else {
            delete remoteSelectionRanges[userId];
          }
        });
        Object.keys(remoteSelectionRanges).forEach(userId => {
          if (!keep.has(userId)) {
            delete remoteSelectionRanges[userId];
          }
        });
        applyRemoteSelections();
      });
      // Re-apply remote carets after content changes
      editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        Object.keys(remoteCaretOffsets).forEach(userId => {
          const offset = remoteCaretOffsets[userId];
          if (typeof offset === 'number') {
            const pos = model.getPositionAt(Math.min(offset, model.getValue().length));
            if (remoteCaretDecorations[userId]) {
              remoteCaretDecorations[userId] = editor.deltaDecorations(remoteCaretDecorations[userId], []);
            }
            remoteCaretDecorations[userId] = editor.deltaDecorations([], [
              {
                range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                options: {
                  className: 'remote-caret-blink',
                  stickiness: 1
                }
              }
            ]);
          }
        });
        applyRemoteSelections();
      });
    }
    // Wait for both editor and socket to be ready
    function tryInit() {
      if (typeof editor !== 'undefined' && typeof socket !== 'undefined' && editor && socket) {
        setupCaretSharing();
      } else {
        setTimeout(tryInit, 300);
      }
    }
    tryInit();
  })();

  // -------------- MONACO INIT ----------------
  function initMonaco() {
    if (typeof require === 'undefined') {
      console.error('[Monaco] AMD loader not found. Ensure loader script is included.');
      return;
    }
    if (!window.MONACO_BASE_URL) {
      console.warn('[Monaco] MONACO_BASE_URL not defined; using CDN fallback.');
      window.MONACO_BASE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min';
    }

    require.config({ paths: { vs: window.MONACO_BASE_URL + '/vs' } });

    require(['vs/editor/editor.main'], () => {

      // Custom theme (optional)
      monaco.editor.defineTheme('collabDark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '4b6f59' },
          { token: 'string', foreground: 'c38b72' },
          { token: 'keyword', foreground: '3fae76' },
          { token: 'number', foreground: '6fbf96' }
        ],
        colors: {
          'editor.background': '#04100c',
          'editorLineNumber.foreground': '#1e4c39',
          'editorCursor.foreground': '#4fd89b',
          'editorBracketMatch.border': '#0a5',
          'editor.lineHighlightBackground': '#ffffff10'
        }
      });

      // Get template from URL
      function getTemplateFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('template');
      }
      function getMonacoLanguage(template) {
        const map = {
          js: 'javascript',
          python: 'python',
          cpp: 'cpp',
          java: 'java',
          php: 'php',
          sql: 'sql',
          go: 'go',
          r: 'r',
          rust: 'rust',
          c: 'c',
          ruby: 'ruby',
          csharp: 'csharp',
          kotlin: 'kotlin',
          typescript: 'typescript'
        };
        return map[template] || null;
      }
      let initialLang = (langSelect && judge0ToMonaco[parseInt(langSelect.value, 10)]) || 'javascript';
      const template = getTemplateFromURL();
      if (template) {
        const langFromTemplate = getMonacoLanguage(template);
        if (langFromTemplate) {
          initialLang = langFromTemplate;
          // Set dropdown to match
          if (langSelect) {
            for (const opt of langSelect.options) {
              if (opt.getAttribute('data-monaco') === langFromTemplate) {
                langSelect.value = opt.value;
                break;
              }
            }
          }
        }
      }

      editor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: initialLang,
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 16,
        theme: 'collabDark',
        fontFamily: 'JetBrains Mono, Menlo, Consolas, "Courier New", monospace',
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection'
      });

      // ----- Ask AI on selection (small bubble near selected code) -----
      (function setupAskAiSelection() {
        if (!editor) return;

        const askEl = document.createElement('button');
        askEl.type = 'button';
        askEl.className = 'ai-selection-ask';
        askEl.textContent = 'Ask AI';
        askEl.setAttribute('aria-hidden', 'true');
        askEl.setAttribute('aria-label', 'Ask AI to explain selected code');
        document.body.appendChild(askEl);

        let lastSelectedText = '';
        let updateTimer = null;

        function hideAsk() {
          askEl.setAttribute('aria-hidden', 'true');
        }

        function showAskAt(pos) {
          const domNode = editor.getDomNode();
          if (!domNode) return hideAsk();
          const editorRect = domNode.getBoundingClientRect();
          const visible = editor.getScrolledVisiblePosition(pos);
          if (!visible) return hideAsk();

          // Place in viewport coordinates; bubble is position:fixed
          const left = editorRect.left + visible.left;
          const top = editorRect.top + visible.top + visible.height + 8;
          const maxLeft = Math.max(8, (window.innerWidth || 0) - 100);
          const maxTop = Math.max(8, (window.innerHeight || 0) - 44);
          askEl.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
          askEl.style.top = Math.max(8, Math.min(top, maxTop)) + 'px';
          askEl.setAttribute('aria-hidden', 'false');
        }

        function computeSelectedText() {
          const model = editor.getModel();
          if (!model) return '';
          const sel = editor.getSelection();
          if (!sel || sel.isEmpty()) return '';
          return model.getValueInRange(sel);
        }

        function updateAskUi() {
          const model = editor.getModel();
          if (!model) return hideAsk();
          const sel = editor.getSelection();
          if (!sel || sel.isEmpty()) {
            lastSelectedText = '';
            return hideAsk();
          }

          const selected = computeSelectedText();
          // Avoid showing for tiny selections (like a single char)
          if (!selected || selected.trim().length < 3) {
            lastSelectedText = '';
            return hideAsk();
          }

          // keep a safe cap so we don't send megabytes accidentally
          lastSelectedText = selected.length > 6000 ? selected.slice(0, 6000) : selected;
          showAskAt(sel.getEndPosition());
        }

        editor.onDidChangeCursorSelection(() => {
          if (updateTimer) clearTimeout(updateTimer);
          updateTimer = setTimeout(updateAskUi, 50);
        });

        editor.onDidScrollChange(() => {
          // Hide while scrolling; do NOT clear lastSelectedText (click can happen during focus transitions).
          hideAsk();
        });

        editor.onDidBlurEditorWidget(() => {
          // Clicking the bubble blurs the editor; don't clear lastSelectedText here.
          hideAsk();
        });

        // Hide if the editor node is removed/replaced
        window.addEventListener('resize', hideAsk);

        async function handleAskAi(e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }

          // Re-read current selection first (more reliable than cached text)
          const current = computeSelectedText();
          const code = (current && current.trim().length >= 3 ? current : lastSelectedText || '').trim();
          if (!code) return;

          hideAsk();

          const langId = (editor.getModel && editor.getModel()) ? editor.getModel().getLanguageId() : '';
          const fencedLang = langId ? langId : '';
          const prompt =
            'Explain this selected code snippet consizely.\n' +
            'If you suggest changes, provide the updated code too.\n\n' +
            '```' + fencedLang + '\n' + code + '\n```';

          // Open AI panel and prefill input so user can edit before sending
          try {
            if (window.aiChat && typeof window.aiChat.open === 'function') {
              window.aiChat.open();
            } else {
              const openBtn = document.getElementById('aiOpenBtn');
              if (openBtn) openBtn.click();
            }
          } catch (_err) {
            const openBtn = document.getElementById('aiOpenBtn');
            if (openBtn) openBtn.click();
          }

          const input = document.getElementById('aiChatInput');
          if (input) {
            input.value = prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
          }
        }

        // Use pointerdown so we capture before editor blur clears anything
        askEl.addEventListener('pointerdown', (e) => {
          handleAskAi(e).catch(() => { });
        });

        // Keep click for keyboard activation (Enter/Space)
        askEl.addEventListener('click', (e) => {
          handleAskAi(e).catch(() => { });
        });
      })();

      // Theme toggle icon logic
      const themeToggleBtn = document.getElementById('themeToggleBtn');
      const themeToggleIcon = document.getElementById('themeToggleIcon');
      let currentTheme = 'collabDark';
      if (themeToggleBtn && themeToggleIcon) {
        themeToggleBtn.addEventListener('click', function () {
          if (currentTheme === 'collabDark') {
            monaco.editor.setTheme('vs');
            currentTheme = 'vs';
            themeToggleIcon.textContent = '☀️';
          } else {
            monaco.editor.setTheme('collabDark');
            currentTheme = 'collabDark';
            themeToggleIcon.textContent = '🌙';
          }
        });
        // Set initial icon
        themeToggleIcon.textContent = currentTheme === 'collabDark' ? '🌙' : '☀️';
      }

      // Expose globally for debugging (optional)
      window.editor = editor;

      if (otApi) otApi.attachEditor(editor);

      if (pendingEditorValue !== null) {
        const pendingDoc = pendingEditorValue;
        pendingEditorValue = null;
        setEditorValue(pendingDoc, true, 'pending-buffer');
      }
      if (pendingLanguageMonaco) {
        const model = editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, pendingLanguageMonaco);
        setLanguageSelectByMonaco(pendingLanguageMonaco);
        pendingLanguageMonaco = null;
      }

      // After creating editor:
      window.editor = editor;
      if (window.AIGhostWidget) {
        window.aiController = window.AIGhostWidget.init(editor);
        // window.aiController.enableDebug();
      } else {
        console.warn('[AI-WIDGET] AIGhostWidget module missing');
      }

    }, err => {
      logOutput('Monaco load error: ' + err.message);
      console.error(err);
    });
  }

  function getEditorValue() {
    return editor ? editor.getValue() : '';
  }

  function setEditorValue(val, suppressOt = true, source = 'unknown') {
    const safeVal = typeof val === 'string' ? val : '';
    if (!editor) {
      pendingEditorValue = safeVal;
      return;
    }
    if (suppressOt && otApi) otApi.suspendLocalChanges();
    editor.setValue(safeVal);
    if (suppressOt && otApi) otApi.resumeLocalChanges({ syncDoc: safeVal, resetPending: true });
    pendingEditorValue = null;
  }

  // -------------- LANGUAGE CHANGE ----------------
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      if (!editor || !window.monaco) return;
      const langId = parseInt(langSelect.value, 10);
      const newLang = judge0ToMonaco[langId] || 'javascript';
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, newLang);
        if (aiController && aiController.force) {
          aiController.force();
        }
      }
    });
  }

  // -------------- ROOM HANDLING ----------------
  // Create Room button: generate unique string, show in output, and join
  if (roomButton) {
    roomButton.addEventListener('click', () => {
      // Generate a unique room string (8 chars, alphanumeric)
      const roomId = 'room-' + Math.random().toString(36).slice(2, 10);
      roomInput.value = roomId;
      logOutput('Room created: ' + roomId);
      joinRoom(roomId);
    });
  }

  // Join Room button: join the room in the input
  if (joinRoomButton) {
    joinRoomButton.addEventListener('click', async () => {
      const roomId = (roomInput.value || '').trim();
      if (!roomId) {
        await customAlert('Enter a room ID');
        return;
      }
      joinRoom(roomId);
      // logOutput('Joined room: ' + roomId);
    });
  }

  // -------------- BUTTON EVENTS ----------------
  if (runBtn) runBtn.addEventListener('click', runCode);
  if (saveBtn) saveBtn.addEventListener('click', saveFile);

  if (clearOutputBtn && outputEl) {
    clearOutputBtn.addEventListener('click', () => {
      outputEl.textContent = '';
    });
  }

  // -------------- AUDIO VOLUME CONTROL ----------------
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeIcon = document.getElementById('volumeIcon');
  const volumeValue = document.getElementById('volumeValue');
  let currentVolume = 1.0; // Store current volume (0-1)

  // Initialize volume from localStorage
  const savedVolume = localStorage.getItem('outputVolume');
  if (savedVolume !== null) {
    const volume = parseFloat(savedVolume);
    if (!isNaN(volume) && volume >= 0 && volume <= 100) {
      volumeSlider.value = volume;
      currentVolume = volume / 100;
      updateVolumeDisplay(volume);
    }
  }

  function updateVolumeDisplay(value) {
    volumeValue.textContent = Math.round(value) + '%';

    // Update icon based on volume level
    if (value === 0) {
      volumeIcon.className = 'fa-solid fa-volume-xmark';
    } else if (value < 33) {
      volumeIcon.className = 'fa-solid fa-volume-off';
    } else if (value < 66) {
      volumeIcon.className = 'fa-solid fa-volume-low';
    } else {
      volumeIcon.className = 'fa-solid fa-volume-high';
    }
  }

  function applyVolumeToAllAudio() {
    // Apply to all audio elements in the page
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.volume = currentVolume;
    });

    // Apply to Web Audio API context if available
    if (window.audioContext && window.audioContext.destination) {
      // Check if a gain node is already set up
      if (!window.masterGainNode) {
        window.masterGainNode = window.audioContext.createGain();
        window.masterGainNode.connect(window.audioContext.destination);
      }
      window.masterGainNode.gain.value = currentVolume;
    }
  }

  function updateSliderFill() {
    if (!volumeSlider) return;
    const value = volumeSlider.value;
    const percentage = (value / 100) * 100;
    // Update the slider background to show filled portion (using actual hex color)
    volumeSlider.style.background = `linear-gradient(to right, #00aa55 0%, #00aa55 ${percentage}%, rgba(255, 255, 255, 0.15) ${percentage}%, rgba(255, 255, 255, 0.15) 100%)`;
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      currentVolume = value / 100;
      updateVolumeDisplay(value);
      updateSliderFill();
      applyVolumeToAllAudio();

      // Save to localStorage
      localStorage.setItem('outputVolume', value);
    });

    // Apply initial volume and fill
    updateSliderFill();
    applyVolumeToAllAudio();
  }

  // -------------- INIT SEQUENCE ----------------
  // Initialize mobile room display with initial room ID
  const mobileRoomDisplay = document.getElementById('mobileRoomDisplay');
  if (mobileRoomDisplay) {
    mobileRoomDisplay.textContent = 'Room ID: #' + currentRoom;
  }
  // Initialize toolbar room display (left panel) with initial room ID
  const toolbarRoomId = document.getElementById('toolbarRoomId');
  if (toolbarRoomId) toolbarRoomId.textContent = '#' + currentRoom;
  updateWhiteboardRoomLabel(currentRoom);
  updateShareRoomLink(currentRoom);
  updateRoomQueryParam(currentRoom);
  setShareRoomButtonState('default');

  initSocket();
  initMonaco();
  refreshFileList();
  startAutosaveLoop();
  window.addEventListener('beforeunload', autosaveOnExit);
  window.addEventListener('pagehide', autosaveOnExit);

  // -------------- DEBUG HELPERS ----------------
  window.__CC_DEBUG__ = {
    joinRoom,
    saveFile,
    runCode,
    forceAI: () => aiController && aiController.force && aiController.force(),
    aiState: () => aiController && aiController.state && aiController.state()
  };

})();