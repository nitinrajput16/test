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
    let currentAbortController = null;
    let isGenerating = false;

    function updateSendButton() {
      if (!sendBtn) return;
      if (isGenerating) {
        sendBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        sendBtn.disabled = false;
        sendBtn.setAttribute('aria-label', 'Stop generation');
      } else {
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        sendBtn.disabled = false;
        sendBtn.setAttribute('aria-label', 'Send message');
      }
    }

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
      // Cancel any ongoing AI request first
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      
      if (!messagesEl) return;
      messagesEl.innerHTML = '';
      history.length = 0;
      setStatus('');
      
      // Re-enable inputs if they were disabled during a request
      isGenerating = false;
      updateSendButton();
      if (inputEl) inputEl.disabled = false;
    }

    async function send(overrideText) {
      const text = (overrideText != null ? String(overrideText) : inputEl.value).trim();
      if (!text) return;

      // Cancel any previous ongoing request
      if (currentAbortController) {
        currentAbortController.abort();
      }

      // Create new abort controller for this request
      currentAbortController = new AbortController();
      const thisAbortController = currentAbortController;

      inputEl.value = '';
      autoResizeInput();
      appendMessage(messagesEl, 'user', text);
      history.push({ role: 'user', content: text });
      // keep history bounded
      if (history.length > 20) history.splice(0, history.length - 20);

      isGenerating = true;
      updateSendButton();
      inputEl.disabled = true;
      setStatus('Thinking…');
      const pendingNode = appendMessage(messagesEl, 'assistant', 'Thinking', { pending: true });
      
      // Store reference for stopGeneration to access
      send.currentPendingNode = pendingNode;

      try {
        const puter = await ensurePuter(statusEl);
        
        // Check if aborted before making the request
        if (thisAbortController.signal.aborted) {
          throw new Error('Request cancelled');
        }
        
        const res = await callPuterChat(puter, history);
        
        // Check if aborted after request completes
        if (thisAbortController.signal.aborted) {
          throw new Error('Request cancelled');
        }
        
        const answer = extractAssistantText(res).trim();
        pendingNode.classList.remove('ai-chat-msg--pending');
        pendingNode.textContent = answer || 'No response.';
        history.push({ role: 'assistant', content: answer || 'No response.' });
        if (history.length > 20) history.splice(0, history.length - 20);
        setStatus('');
      } catch (e) {
        // Don't show error if request was intentionally cancelled
        if (thisAbortController.signal.aborted || e.message === 'Request cancelled') {
          if (pendingNode) {
            pendingNode.classList.remove('ai-chat-msg--pending');
            pendingNode.textContent = 'Response cancelled.';
            pendingNode.style.opacity = '0.7';
            pendingNode.style.fontStyle = 'italic';
          }
          setStatus('');
        } else {
          pendingNode.classList.remove('ai-chat-msg--pending');
          pendingNode.textContent = 'AI error: ' + (e && e.message ? e.message : String(e));
          setStatus('');
        }
      } finally {
        // Only clear the controller if it's still the current one
        if (currentAbortController === thisAbortController) {
          currentAbortController = null;
        }
        isGenerating = false;
        updateSendButton();
        inputEl.disabled = false;
        inputEl.focus();
        autoResizeInput();
        send.currentPendingNode = null;
      }
    }

    function stopGeneration() {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      
      // Replace "Thinking" message with "Cancelled"
      if (send.currentPendingNode) {
        send.currentPendingNode.classList.remove('ai-chat-msg--pending');
        send.currentPendingNode.textContent = 'Response cancelled by user.';
        send.currentPendingNode.style.opacity = '0.7';
        send.currentPendingNode.style.fontStyle = 'italic';
        send.currentPendingNode = null;
      }
      
      isGenerating = false;
      updateSendButton();
      inputEl.disabled = false;
      setStatus('');
    }

    sendBtn.addEventListener('click', () => {
      if (isGenerating) {
        stopGeneration();
      } else {
        send().catch(() => {});
      }
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
