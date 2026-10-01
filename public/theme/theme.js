(() => {
  'use strict';
  const root = document.documentElement;
  let mode = 'dark';
  try { if (localStorage.getItem('codeplat-theme') === 'light') mode = 'light'; } catch {}
  function set(next) {
    mode = next === 'light' ? 'light' : 'dark';
    root.dataset.codeplatTheme = mode;
    try { localStorage.setItem('codeplat-theme', mode); } catch {}
    document.querySelectorAll('[data-cp-theme-toggle]').forEach(button => {
      button.textContent = mode === 'dark' ? 'Light theme' : 'Dark theme';
      button.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`);
      button.setAttribute('aria-pressed', String(mode === 'light'));
    });
    window.dispatchEvent(new CustomEvent('codeplat:theme', {detail: {mode}}));
  }
  window.CodeplatTheme = {get: () => mode, set, toggle: () => set(mode === 'dark' ? 'light' : 'dark')};
  root.dataset.codeplatTheme = mode;
  document.addEventListener('DOMContentLoaded', () => {
    set(mode);
    document.querySelectorAll('[data-cp-theme-toggle]').forEach(button => button.addEventListener('click', window.CodeplatTheme.toggle));
  });
  window.addEventListener('storage', event => { if (event.key === 'codeplat-theme') set(event.newValue); });
})();
