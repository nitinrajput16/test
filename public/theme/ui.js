(() => {
  'use strict';
  if (!window.CodeplatTheme) return;
  const active = new Map();
  const actions = {
    '/api/code/run': ['#runButton', 'Running code'],
    '/api/code/save': ['#saveButton', 'Saving file'],
    '/api/code/list': ['#fileList', 'Loading files'],
    '/api/code/load': ['#editor-container', 'Loading file'],
    '/api/code/create-folder': ['#fileList', 'Creating folder'],
    '/api/code/rename': ['#fileList', 'Renaming file'],
    '/api/code/delete': ['#fileList', 'Deleting file'],
    '/api/ai/chat': ['.ai-chat-panel', 'Asking AI'],
    '/api/ai/inline': ['#ai-hint', 'Getting suggestion'],
    '/api/dashboard': ['.stats-grid', 'Loading activity'],
    '/profile/check-username': ['#pf_checkBtn', 'Checking username'],
    '/profile/update': ['#pf_saveBtn', 'Saving profile'],
    '/profile/credentials': ['#credentialsForm', 'Updating credentials'],
    '/profile/account': ['#deleteAccountBtn', 'Deleting account'],
    '/profile/friends/add': ['#addFriendBtn', 'Adding friend'],
    '/profile/friends/remove': ['#friendList', 'Removing friend']
  };
  let clearTimer;
  function announce(message, kind = 'info') {
    const box = document.querySelector('[data-cp-status]');
    if (!box) return;
    box.textContent = message;
    box.dataset.kind = kind;
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => { box.textContent = ''; }, kind === 'error' ? 10000 : 4500);
  }
  async function readJson(response) {
    if (response.redirected && /\/login(?:\?|$)/.test(new URL(response.url, location.href).pathname)) {
      throw new Error('Your session has expired. Sign in again to continue.');
    }
    const text = await response.text();
    if (!text.trim()) return {};
    try { return JSON.parse(text); } catch {
      if (response.ok) throw new Error('The server returned an unexpected response. Please try again.');
      // Avoid displaying HTML error pages or development stack traces as markup.
      return {error: response.status === 429 ? 'Too many requests. Please wait and try again.' : `Request failed (${response.status}). Please try again.`};
    }
  }
  function pending(selector) {
    const elements = [...document.querySelectorAll(selector)];
    elements.forEach(element => {
      const entry = active.get(element) || {count: 0, previous: element.getAttribute('aria-busy')};
      entry.count++; active.set(element, entry);
      element.dataset.cpPending = ''; element.setAttribute('aria-busy', 'true');
    });
    return () => elements.forEach(element => {
      const entry = active.get(element); if (!entry || --entry.count > 0) return;
      delete element.dataset.cpPending;
      if (entry.previous === null) element.removeAttribute('aria-busy'); else element.setAttribute('aria-busy', entry.previous);
      active.delete(element);
    });
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, options) {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, location.href); } catch { return originalFetch(input, options); }
    const tracked = url.origin === location.origin && (/^\/api\//.test(url.pathname) || /^\/profile\//.test(url.pathname) || url.pathname === '/auth/status');
    if (!tracked) return originalFetch(input, options);
    const quiet = ['/api/editor/activity', '/api/editor/today', '/api/ai/inline', '/profile/check-username'].includes(url.pathname);
    const action = actions[url.pathname];
    const done = action ? pending(action[0]) : () => {};
    try {
      const response = await originalFetch(input, options);
      const sessionExpired = response.redirected && new URL(response.url, location.href).pathname === '/login';
      if (!quiet && sessionExpired) announce('Your session has expired. Sign in again to continue.', 'error');
      else if (!quiet && !response.ok) {
        const message = response.status === 429 ? 'Too many requests. Please wait before trying again.' : response.status === 403 ? 'You do not have permission for that action.' : `${action ? action[1] : 'Request'} failed. Please try again.`;
        announce(message, 'error');
      } else if (url.pathname === '/api/code/save' && response.ok) announce('File saved.', 'success');
      return response; // Preserve response, status, body and redirects for existing consumers.
    } catch(error) {
      if (!quiet && error.name !== 'AbortError') announce('Connection lost. Your changes remain in the workspace; try again when connected.', 'error');
      throw error;
    } finally { done(); }
  };
  document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => {
    if (event.defaultPrevented) return;
    // Native forms retain their payload and browser validation; annotate only.
    form.setAttribute('aria-busy','true');
    setTimeout(() => form.removeAttribute('aria-busy'), 15000);
  }));
  document.querySelectorAll('.alert-box,.pf-banner').forEach(box => { box.setAttribute('role','status');box.setAttribute('aria-live','polite'); });
  document.querySelectorAll('.table-wrap').forEach(table => { table.setAttribute('tabindex','0');table.setAttribute('aria-label','Scrollable data table'); });
  window.addEventListener('offline', () => announce('You are offline. Keep your work open until you reconnect.', 'error'));
  const socketBound = new WeakSet();
  function bindSocket(socket) {
    if (!socket || !socket.on || socketBound.has(socket)) return;
    socketBound.add(socket);
    let badge = document.querySelector('[data-cp-connection]');
    if (!badge) { badge = document.createElement('span');badge.className='cp-connection';badge.dataset.cpConnection='';badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');(document.querySelector('.navbar,.wb-header') || document.body).append(badge); }
    const set = state => {badge.dataset.state=state;badge.textContent=state==='connected'?'● Connected':state==='offline'?'○ Reconnecting':'○ Connecting';};
    set(socket.connected?'connected':'connecting');
    socket.on('connect',()=>set('connected'));socket.on('disconnect',()=>set('offline'));socket.on('connect_error',()=>set('offline'));
  }
  window.CodeplatUI = {readJson, announce, bindSocket};
  if (window.socket) bindSocket(window.socket);
})();

