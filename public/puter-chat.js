// puter-chat.js
// Minimal right-panel AI chat powered by Puter.js (client-side).
(function () {
  const PUTER_SCRIPT_CANDIDATES = [
    'https://js.puter.com/v2/',
    'https://js.puter.com/puter.js',
    'https://js.puter.com/v1/'
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function safeText(v) {
    return (v == null ? '' : String(v));
  }

  function appendMessage(container, role, text, opts) {
    const msg = document.createElement('div');
    msg.className = 'ai-chat-msg ' + (role === 'user' ? 'ai-chat-msg--user' : 'ai-chat-msg--assistant');
    if (opts && opts.pending) msg.classList.add('ai-chat-msg--pending');
    msg.textContent = safeText(text);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensurePuter(statusEl) {
    if (window.puter && window.puter.ai) return window.puter;

    for (const src of PUTER_SCRIPT_CANDIDATES) {
      try {
        if (statusEl) statusEl.textContent = 'Loading AI…';
        // If puter is already present, don't inject again.
        if (!(window.puter && window.puter.ai)) {
          await loadScript(src);
        }
        if (window.puter && window.puter.ai) return window.puter;
      } catch (e) {
        // try next
      }
    }

    throw new Error('Puter.js not available');
  }

  function extractAssistantText(res) {
    if (typeof res === 'string') return res;
    if (!res) return '';

    // Common shapes
    if (typeof res.text === 'string') return res.text;
    if (typeof res.message === 'string') return res.message;
    if (res.message && typeof res.message.content === 'string') return res.message.content;
    if (res.output && typeof res.output === 'string') return res.output;

    // OpenAI-like
    if (Array.isArray(res.choices) && res.choices[0]) {
      const c0 = res.choices[0];
      if (c0.message && typeof c0.message.content === 'string') return c0.message.content;
      if (typeof c0.text === 'string') return c0.text;
    }

    try {
      return JSON.stringify(res);
    } catch {
      return String(res);
    }
  }

  async function callPuterChat(puter, messages) {
    const ai = puter && puter.ai;
    if (!ai || typeof ai.chat !== 'function') {
      throw new Error('Puter AI chat API not found');
    }

    // Try a few likely signatures.
    try {
      return await ai.chat({ messages });
    } catch (e1) {
      try {
        return await ai.chat(messages);
      } catch (e2) {
        const prompt = messages
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
        return await ai.chat(prompt);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const messagesEl = $('aiChatMessages');
    const inputEl = $('aiChatInput');
    const sendBtn = $('aiChatSendBtn');
    const statusEl = $('aiChatStatus');
    const openBtn = $('aiOpenBtn');
    const backBtn = $('aiChatBackBtn');
    const newBtn = $('aiChatNewBtn');
    const chatPanel = document.getElementById('aiChatPanel');

    if (!messagesEl || !inputEl || !sendBtn) return;

    const history = [];
    let greeted = false;

    function autoResizeInput() {
      if (!inputEl) return;
      // Let CSS control the max-height; we only set an inline height that tracks content.
      inputEl.style.height = 'auto';
      inputEl.style.height = inputEl.scrollHeight + 'px';
    }

    function setStatus(t) {
      if (statusEl) statusEl.textContent = safeText(t);
    }

    function openChatPanel() {
      const panelRight = document.querySelector('.panel-right');
      if (panelRight) panelRight.classList.add('ai-expanded');
      if (chatPanel) chatPanel.setAttribute('aria-hidden', 'false');
      if (openBtn) openBtn.disabled = true;
      // Add a lightweight greeting once, like most AI chat panels
      if (!greeted && messagesEl && !messagesEl.childElementCount) {
        appendMessage(messagesEl, 'assistant', 'Hi! Ask me anything about your code, room, or errors.');
        greeted = true;
      }
      if (inputEl) inputEl.focus();
      autoResizeInput();
    }

    function closeChatPanel() {
      const panelRight = document.querySelector('.panel-right');
      if (panelRight) panelRight.classList.remove('ai-expanded');
      if (chatPanel) chatPanel.setAttribute('aria-hidden', 'true');
      if (openBtn) openBtn.disabled = false;
    }

    function clearChat() {
      if (!messagesEl) return;
      messagesEl.innerHTML = '';
      history.length = 0;
      setStatus('');
    }

    async function send(overrideText) {
      const text = (overrideText != null ? String(overrideText) : inputEl.value).trim();
      if (!text) return;

      inputEl.value = '';
      autoResizeInput();
      appendMessage(messagesEl, 'user', text);
      history.push({ role: 'user', content: text });
      // keep history bounded
      if (history.length > 20) history.splice(0, history.length - 20);

      sendBtn.disabled = true;
      inputEl.disabled = true;
      setStatus('Thinking…');
      const pendingNode = appendMessage(messagesEl, 'assistant', 'Thinking', { pending: true });

      try {
        const puter = await ensurePuter(statusEl);
        const res = await callPuterChat(puter, history);
        const answer = extractAssistantText(res).trim();
        pendingNode.classList.remove('ai-chat-msg--pending');
        pendingNode.textContent = answer || 'No response.';
        history.push({ role: 'assistant', content: answer || 'No response.' });
        if (history.length > 20) history.splice(0, history.length - 20);
        setStatus('');
      } catch (e) {
        pendingNode.classList.remove('ai-chat-msg--pending');
        pendingNode.textContent = 'AI error: ' + (e && e.message ? e.message : String(e));
        setStatus('');
      } finally {
        sendBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
        autoResizeInput();
      }
    }

    sendBtn.addEventListener('click', () => {
      send().catch(() => {});
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send().catch(() => {});
      }
    });

    inputEl.addEventListener('input', () => {
      autoResizeInput();
    });

    setStatus('');
    if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); openChatPanel(); });
    if (backBtn) backBtn.addEventListener('click', (e) => { e.preventDefault(); closeChatPanel(); });
    if (newBtn) newBtn.addEventListener('click', (e) => { e.preventDefault(); clearChat(); if (inputEl) { inputEl.focus(); autoResizeInput(); } });

    // Initial sizing for first paint
    autoResizeInput();

    // Public API for other UI (e.g., "Explain selection")
    window.aiChat = window.aiChat || {};
    window.aiChat.open = openChatPanel;
    window.aiChat.close = closeChatPanel;
    window.aiChat.clear = clearChat;
    window.aiChat.sendPrompt = async function (prompt, opts) {
      const options = opts || {};
      if (options.open !== false) openChatPanel();
      await send(prompt);
    };
  });
})();
