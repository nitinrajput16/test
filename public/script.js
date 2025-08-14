let lastValue = "";
const socket = io();
let roomId = localStorage.getItem('roomId') || '';

let editor;
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor/min/vs' } });
require(['vs/editor/editor.main'], function () {
  monaco.editor.defineTheme('my-dark', {
    base: 'vs-dark',
    inherit: true,
    colors: {
      "editor.background": '#ffffff04',
      "minimap.background": '#ffffff04'
    },
    rules: []
  });
  monaco.editor.setTheme('my-dark');
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '// Write your code here...',
    language: 'javascript'
  });
  window.editor = editor;

  function checkAndUpdateCode() {
    const content = editor.getValue();
    if (content === lastValue) return;
    socket.emit('code-update', { roomId, content });
    lastValue = content;
  }
  setInterval(checkAndUpdateCode, 500);
});

document.getElementById('RoomButton').addEventListener('click', () => {
  const inputRoomId = document.getElementById('roomInput').value.trim();
  if (inputRoomId) {
    roomId = inputRoomId;
    localStorage.setItem('roomId', roomId);
    socket.emit('join-room', roomId);
    alert(`Room created and joined: ${roomId}`);
  } else {
    alert('Please enter a Room ID to create or join.');
  }
});

if (!roomId) {
  document.getElementById('roomInput').placeholder = 'Create or enter room ID';
} else {
  socket.emit('join-room', roomId);
}

socket.on('code-update', (content) => {
  if (!editor) return;
  const currentContent = editor.getValue();
  if (currentContent !== content) {
    lastValue = content;
    const selection = editor.getSelection();
    editor.setValue(content);
    editor.setSelection(selection);
  }
});

document.getElementById('saveButton').addEventListener('click', async () => {
  if (!editor) return;
  const code = editor.getValue();
  const filename = prompt('Enter a filename to save the code:', 'code.txt');
  if (!filename) return alert('Filename is required.');
  try {
    const response = await fetch('/save-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, filename })
    });
    const result = await response.json();
    alert(result.message || 'Code saved successfully!');
    loadFileList();
  } catch (error) {
    console.error('Error saving code:', error);
    alert('Failed to save code.');
  }
});

async function loadFileList() {
  try {
    const response = await fetch('/list-data');
    const result = await response.json();
    const fileListContainer = document.getElementById('fileList');
    fileListContainer.innerHTML = '';
    if (result.files && result.files.length > 0) {
      result.files.forEach(filename => {
        const listItem = document.createElement('li');
        listItem.textContent = filename;
        listItem.addEventListener('click', () => loadFile(filename));
        fileListContainer.appendChild(listItem);
      });
    } else {
      fileListContainer.innerHTML = '<p>No files found</p>';
    }
  } catch (error) {
    console.error('Error loading file list:', error);
    document.getElementById('fileList').innerHTML = '<p>Error loading files</p>';
  }
}

async function loadFile(filename) {
  try {
    const response = await fetch(`/load-code?filename=${encodeURIComponent(filename)}`);
    const result = await response.json();
    if (result.code && editor) {
      editor.setValue(result.code);
    } else {
      alert('Failed to load the file.');
    }
  } catch (error) {
    console.error('Error loading code:', error);
    alert('Failed to load code.');
  }
}

(async () => {
  await loadFileList();
})();

document.getElementById('language').addEventListener("change", function (e) {
  if (!editor) return;
  const sel = e.target;
  const lang = sel.options[sel.selectedIndex].text.toLowerCase();
  monaco.editor.setModelLanguage(editor.getModel(), lang);
});

async function runCode() {
  if (!editor) return;
  const editorContent = monaco.editor.getModels()[0].getValue();
  const languageId = document.getElementById('language').value;
  const stdin = document.getElementById('stdinInput').value;
  const payload = { source_code: editorContent, language_id: languageId, stdin };
  try {
    const response = await fetch('/editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    const output = result.stdout || result.stderr || result.message;
    document.getElementById('output').textContent = output;
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('output').textContent = 'Error running code.';
  }
}

document.getElementById('runButton').addEventListener('click', runCode);