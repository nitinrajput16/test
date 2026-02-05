// puter-chat.js
// Right-panel AI chat powered by the app backend (/api/ai/chat).
// This avoids client-side 3rd party auth tokens in localStorage.
(function () {
  const CHAT_ENDPOINT = '/api/ai/chat';

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

  async function callServerChat(messages, signal) {
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    }
    return data;
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

  function extractServerAnswer(res) {
    if (!res) return '';
    if (typeof res.message === 'string') return res.message;
    if (typeof res.text === 'string') return res.text;
    return '';
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
        // Check if aborted before making the request
        if (thisAbortController.signal.aborted) {
          throw new Error('Request cancelled');
        }

        const res = await callServerChat(history, thisAbortController.signal);
        
        // Check if aborted after request completes
        if (thisAbortController.signal.aborted) {
          throw new Error('Request cancelled');
        }
        
        const answer = (extractServerAnswer(res) || extractAssistantText(res)).trim();
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
