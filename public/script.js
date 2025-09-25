(function () {

  // ---------------- DOM ELEMENTS ----------------
  const fileListDiv = document.getElementById('fileList');
  // Add New File button above file list
  const newFileBtn = document.createElement('button');
  newFileBtn.textContent = '+ New File';
  newFileBtn.style.width = '100%';
  newFileBtn.style.background = '#0a5';
  newFileBtn.style.color = '#fff';
  newFileBtn.style.border = 'none';
  newFileBtn.style.padding = '8px 0';
  newFileBtn.style.fontWeight = 'bold';
  newFileBtn.style.cursor = 'pointer';
  newFileBtn.style.marginBottom = '6px';
  newFileBtn.addEventListener('click', () => {
    setEditorValue('');
    currentFilename = null;
    highlightActiveFile();
    logOutput('New blank file. Use Save to name and store it.');
  });
  if (fileListDiv && fileListDiv.parentElement) {
    fileListDiv.parentElement.insertBefore(newFileBtn, fileListDiv);
  }
  const runBtn      = document.getElementById('runButton');
  const saveBtn     = document.getElementById('saveButton');
  const langSelect  = document.getElementById('language');
  const stdinInput  = document.getElementById('stdinInput');
  const outputEl    = document.getElementById('output');
  const clearOutputBtn = document.getElementById('clearOutputBtn');
  const roomInput   = document.getElementById('roomInput');
  const roomButton  = document.getElementById('RoomButton');
  const joinRoomButton = document.getElementById('JoinRoomButton');

  // -------------- STATE ----------------
  let editor;
  let socket;
  let currentRoom = 'default-room';
  let lastBroadcastHash = null;
  let suppressNextChange = false;
  let currentFilename = null;
  let aiController = null;

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

  // -------------- UTILS ----------------
  function simpleHash(str){
    let h=0, i=0;
    while(i<str.length){
      h = (Math.imul(31,h) + str.charCodeAt(i++)) | 0;
    }
    return h;
  }

  function logOutput(msg){
    if (!outputEl) return;
    outputEl.textContent += (outputEl.textContent ? '\n' : '') + msg;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function api(method, url, body){
    const opts = { method, headers: { 'Content-Type':'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts)
      .then(r => r.json().catch(()=>({}))
        .then(data => {
          if(!r.ok) throw new Error(data.error || ('HTTP '+r.status));
          return data;
        }));
  }

  // -------------- FILE OPERATIONS ----------------
  function refreshFileList() {
  api('GET','/api/code/list')
    .then(data => {
      fileListDiv.innerHTML = '';
      (data.files || []).forEach(f => {
        const name = f.filename || f;
        const div = document.createElement('div');
        div.className = 'file-item';

        // File name span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.flex = '1';
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => loadFile(name));
        div.appendChild(nameSpan);

        // Rename icon
        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename file';
        renameBtn.style.marginLeft = '8px';
        renameBtn.style.background = 'none';
        renameBtn.style.border = 'none';
        renameBtn.style.cursor = 'pointer';
        renameBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const newName = prompt('Enter new filename:', name);
          if (!newName || newName === name) return;
          api('POST', '/api/code/rename', { oldName: name, newName })
            .then(() => {
              if (currentFilename === name) currentFilename = newName;
              if (window.socket) window.socket.emit('filelist-changed');
              refreshFileList();
              logOutput('Renamed to: ' + newName);
            })
            .catch(e => logOutput('Rename error: ' + e.message));
        });
        div.appendChild(renameBtn);

        // Delete icon styled for file list
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️'; // trash can icon
        deleteBtn.title = 'Delete file';
        deleteBtn.className = 'file-delete-btn';
        deleteBtn.style.marginLeft = '4px';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm('Delete file: ' + name + '?')) return;
          api('DELETE', '/api/code/delete', { filename: name })
            .then(() => {
              if (currentFilename === name) {
                currentFilename = null;
                setEditorValue('');
              }
              if (window.socket) window.socket.emit('filelist-changed');
              refreshFileList();
              logOutput('Deleted: ' + name);
            })
            .catch(e => logOutput('Delete error: ' + e.message));
        });
        div.appendChild(deleteBtn);

        div.style.display = 'flex';
        div.style.alignItems = 'center';

        if (f.updatedAt || f.language || f.size != null) {
          div.title = [
            f.language,
            f.updatedAt && new Date(f.updatedAt).toLocaleString(),
            (f.size != null) && (f.size + ' chars')
          ].filter(Boolean).join(' \u2022 ');
        }
        if (name === currentFilename) div.classList.add('active');
        fileListDiv.appendChild(div);
      });
    })
    .catch(e => logOutput('List error: '+e.message));
}

  function highlightActiveFile(){
    [...fileListDiv.children].forEach(ch => {
      ch.classList.toggle('active', ch.textContent === currentFilename);
    });
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
    if (!editor || !window.monaco) return;
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const lang = extToMonaco[ext] || 'plaintext';
    const model = editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, lang);
    setLanguageSelectByMonaco(lang);
  }

  function loadFile(name){
    api('GET','/api/code/load?filename='+encodeURIComponent(name))
      .then(data => {
        currentFilename = data.filename;
        setEditorValue(data.code);
        setEditorLanguageByFilename(data.filename);
        highlightActiveFile();
        logOutput('Loaded: '+data.filename);
        lastBroadcastHash = null;
        scheduleBroadcast();
      })
      .catch(e => logOutput('Load error: '+e.message));
  }

  function saveFile(){
    if (!currentFilename){
      const proposed = 'file'+Date.now()+'.js';
      const name = prompt('Enter filename (with extension):', proposed);
      if (!name) return;
      currentFilename = name.trim();
    }
    api('POST','/api/code/save',{
      filename: currentFilename,
      code: getEditorValue(),
      language: langSelect && langSelect.options[langSelect.selectedIndex].dataset.monaco || 'plaintext',
      roomId: currentRoom
    })
      .then(d => {
        currentFilename = d.filename;
        highlightActiveFile();
        logOutput('Saved: '+d.filename);
        refreshFileList();
      })
      .catch(e => logOutput('Save error: '+e.message));
  }

  // -------------- RUN CODE ----------------
  function runCode(){
    if (!langSelect) {
      logOutput('Language select missing');
      return;
    }
    runBtn.disabled = true;
    logOutput('Running...');
    api('POST','/api/code/run',{
      source_code: getEditorValue(),
      language_id: parseInt(langSelect.value,10),
      stdin: stdinInput.value
    })
      .then(d => logOutput(formatRunResult(d)))
      .catch(e => logOutput('Run error: '+e.message))
      .finally(()=> runBtn.disabled = false);
  }

  function formatRunResult(d){
    const lines=[];
    // if(d.status) lines.push('Status: '+(d.status.description || d.status.id));
    if(d.stdout) lines.push('STDOUT:\n'+d.stdout);
    if(d.stderr) lines.push('STDERR:\n'+d.stderr);
    if(d.compile_output) lines.push('COMPILER:\n'+d.compile_output);
    if(!d.stdout && !d.stderr && !d.compile_output) lines.push('(no output)');
    return lines.join('\n\n');
  }

  // -------------- SOCKET / COLLAB ----------------
  function initSocket(){
    if (typeof io === 'undefined') {
      console.error('[Socket] io not loaded.');
      return;
    }
    socket = io();
    window.socket = socket;
    socket.on('connect', () => {
      joinRoom(currentRoom);
    });
    socket.on('code-update', ({ content }) => {
      if (getEditorValue() === content) return;
      suppressNextChange = true;
      setEditorValue(content);
    });
    socket.on('filelist-changed', () => {
      refreshFileList();
    });
    socket.on('connect_error', err => {
      if (err && /Unauthorized/i.test(err.message)) {
        window.location = '/login?error=auth_required';
      }
    });
  }

  function joinRoom(roomId){
    if (!socket) return;
    currentRoom = roomId;
    socket.emit('join-room', roomId);
    if (roomInput) roomInput.value = '';
    logOutput('Joined room: '+roomId);
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

  // -------------- BROADCAST EDITS ----------------
  let broadcastTimer;
  function scheduleBroadcast(){
    clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(()=>{
      const content = getEditorValue();
      const hash = simpleHash(content);
      if (hash !== lastBroadcastHash){
        lastBroadcastHash = hash;
        socket.emit('code-update',{ roomId: currentRoom, content });
      }
    }, 250);
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
  (function() {
    let remoteCaretDecorations = {};
    let remoteCaretOffsets = {};
    function getMyUserId() {
      return (window.user && (window.user._id || window.user.googleId || window.user.id))
        || (window.__CC_DEBUG__ && window.__CC_DEBUG__.userId)
        || (socket && socket.id)
        || 'me';
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
  function initMonaco(){
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
          { token: 'string',  foreground: 'c38b72' },
          { token: 'keyword', foreground: '3fae76' },
          { token: 'number',  foreground: '6fbf96' }
        ],
        colors: {
          'editor.background': '#04100c',
          'editorLineNumber.foreground':'#1e4c39',
          'editorCursor.foreground':'#4fd89b',
          'editorBracketMatch.border':'#0a5',
          'editor.lineHighlightBackground':'#ffffff10'
        }
      });

      const initialLang = (langSelect && judge0ToMonaco[parseInt(langSelect.value,10)]) || 'javascript';

      editor = monaco.editor.create(document.getElementById('editor'), {
        value: '',
        language: initialLang,
        minimap: { enabled:false },
        automaticLayout: true,
        fontSize:16,
        theme:'collabDark',
        fontFamily:'JetBrains Mono, Menlo, Consolas, "Courier New", monospace',
        scrollBeyondLastLine:false,
        renderWhitespace:'selection'
      });

  // Theme toggle icon logic
      const themeToggleBtn = document.getElementById('themeToggleBtn');
      const themeToggleIcon = document.getElementById('themeToggleIcon');
      let currentTheme = 'collabDark';
      if (themeToggleBtn && themeToggleIcon) {
        themeToggleBtn.addEventListener('click', function() {
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

      // Collaboration listener
      editor.onDidChangeModelContent(()=>{
        if (suppressNextChange){
          suppressNextChange = false;
          return;
        }
        scheduleBroadcast();
      });

      // After creating editor:
      window.editor = editor;
      if (window.AIGhostWidget) {
        window.aiController = window.AIGhostWidget.init(editor);
        // window.aiController.enableDebug();
      } else {
        console.warn('[AI-WIDGET] AIGhostWidget module missing');
      }

    }, err => {
      logOutput('Monaco load error: '+err.message);
      console.error(err);
    });
  }

  function getEditorValue(){
    return editor ? editor.getValue() : '';
  }

  function setEditorValue(val){
    if (editor) editor.setValue(val);
  }

  // -------------- LANGUAGE CHANGE ----------------
  if (langSelect){
    langSelect.addEventListener('change', () => {
      if (!editor || !window.monaco) return;
      const langId = parseInt(langSelect.value,10);
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
  if (roomButton){
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
    joinRoomButton.addEventListener('click', () => {
      const roomId = (roomInput.value || '').trim();
      if (!roomId) {
        alert('Enter a room ID');
        return;
      }
      joinRoom(roomId);
      // logOutput('Joined room: ' + roomId);
    });
  }

  // -------------- BUTTON EVENTS ----------------
  if (runBtn)  runBtn.addEventListener('click', runCode);
  if (saveBtn) saveBtn.addEventListener('click', saveFile);

  if (clearOutputBtn && outputEl) {
    clearOutputBtn.addEventListener('click', () => {
      outputEl.textContent = '';
    });
  }

  // -------------- INIT SEQUENCE ----------------
  initSocket();
  initMonaco();
  refreshFileList();

  // -------------- DEBUG HELPERS ----------------
  window.__CC_DEBUG__ = {
    joinRoom,
    saveFile,
    runCode,
    forceAI: () => aiController && aiController.force && aiController.force(),
    aiState: () => aiController && aiController.state && aiController.state()
  };

})();