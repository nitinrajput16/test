// puter-chat.js
// Right-panel AI chat powered by the app backend (/api/ai/chat).
// This avoids client-side 3rd party auth tokens in localStorage.
(function () {
  const CHAT_ENDPOINT = '/api/ai/chat';

  const $ = (id) => document.getElementById(id);
  const safeText = (v) => v == null ? '' : String(v);

  function appendMessage(container, role, text, opts) {
    const msg = document.createElement('div');
    msg.className = `ai-chat-msg ai-chat-msg--${role === 'user' ? 'user' : 'assistant'}${opts?.pending ? ' ai-chat-msg--pending' : ''}`;
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
    if (typeof res.text === 'string') return res.text;
    if (typeof res.message === 'string') return res.message;
    if (res.message?.content) return res.message.content;
    if (res.output) return res.output;
    if (res.choices?.[0]) {
      const c0 = res.choices[0];
      if (c0.message?.content) return c0.message.content;
      if (c0.text) return c0.text;
    }
    try { return JSON.stringify(res); } catch { return String(res); }
  }

  const extractServerAnswer = (res) => res?.message || res?.text || '';

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

    const updateSendButton = () => {
      if (!sendBtn) return;
      sendBtn.innerHTML = isGenerating ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-paper-plane"></i>';
      sendBtn.disabled = false;
      sendBtn.setAttribute('aria-label', isGenerating ? 'Stop generation' : 'Send message');
    };

    const autoResizeInput = () => {
      if (!inputEl) return;
      inputEl.style.height = 'auto';
      inputEl.style.height = inputEl.scrollHeight + 'px';
    };

    const setStatus = (t) => statusEl && (statusEl.textContent = safeText(t));

    function openChatPanel() {
      document.querySelector('.panel-right')?.classList.add('ai-expanded');
      chatPanel?.setAttribute('aria-hidden', 'false');
      if (openBtn) openBtn.disabled = true;
      if (!greeted && messagesEl && !messagesEl.childElementCount) {
        appendMessage(messagesEl, 'assistant', 'Hi! Ask me anything about your code, room, or errors.');
        greeted = true;
      }
      inputEl?.focus();
      autoResizeInput();
    }

    function closeChatPanel() {
      document.querySelector('.panel-right')?.classList.remove('ai-expanded');
      chatPanel?.setAttribute('aria-hidden', 'true');
      if (openBtn) openBtn.disabled = false;
    }

    function clearChat() {
      currentAbortController?.abort();
      currentAbortController = null;
      if (messagesEl) messagesEl.innerHTML = '';
      history.length = 0;
      setStatus('');
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
