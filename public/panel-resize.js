// panel-resize.js: Resizer + collapse for left/right panels
function applyWorkspaceResizeEffects() {
  window.dispatchEvent(new Event('resize'));
  window.editor?.layout?.();
}

(function () {
  const left = document.getElementById('panelLeft');
  const right = document.getElementById('panelRight');
  const center = document.getElementById('panelCenter');
  const resizerLeft = document.getElementById('resizerLeft');
  const resizerRight = document.getElementById('resizerRight');
  const collapseLeft = document.getElementById('collapseLeft');
  const collapseRight = document.getElementById('collapseRight');

  if (!left || !right || !center) return;

  // store last sizes so we can restore after collapse
  const DEFAULT_LEFT = 260;
  const DEFAULT_RIGHT = 320;
  let lastLeft = left.getBoundingClientRect().width || DEFAULT_LEFT;
  let lastRight = right.getBoundingClientRect().width || DEFAULT_RIGHT;

  const MIN_PANEL = 48;
  const MAX_PANEL = 600;

  function startDrag(resizer, side) {
    let dragging = true;
    const workspaceRect = document.querySelector('.workspace').getBoundingClientRect();

    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX;
      const panel = side === 'left' ? left : right;
      const newW = Math.max(MIN_PANEL, Math.min(MAX_PANEL, 
        side === 'left' ? x - workspaceRect.left : workspaceRect.right - x));
      panel.style.flex = `0 0 ${newW}px`;
      panel.style.width = `${newW}px`;
      if (side === 'left') lastLeft = newW; else lastRight = newW;
      applyWorkspaceResizeEffects();
    };

    function onUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  resizerLeft.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(resizerLeft, 'left'); });
  resizerLeft.addEventListener('dblclick', () => resetWidth('left'));
  resizerRight.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(resizerRight, 'right'); });
  resizerRight.addEventListener('dblclick', () => resetWidth('right'));
  collapseLeft.addEventListener('click', () => toggleCollapse(left, 'left'));
  collapseRight.addEventListener('click', () => toggleCollapse(right, 'right'));

  function toggleCollapse(panel, side) {
    const isLeft = (side === 'left');
    if (panel.classList.contains('collapsed')) {
      // restore
      panel.classList.remove('collapsed');
      let width = isLeft ? (lastLeft || DEFAULT_LEFT) : (lastRight || DEFAULT_RIGHT);
      if (width < MIN_PANEL + 10) width = isLeft ? DEFAULT_LEFT : DEFAULT_RIGHT;
      panel.style.flex = '0 0 ' + width + 'px';
      panel.style.width = width + 'px';
      updateHandle(side, false);
      // Force show content
      panel.querySelectorAll('.file-toolbar, .tree-toolbar, .file-list, .resizer-vertical, .users-section, .panel-header').forEach(el => el.style.display = '');
    } else {
      // collapse
      panel.classList.add('collapsed');
      // store current
      const rect = panel.getBoundingClientRect();
      if (isLeft) lastLeft = rect.width;
      else lastRight = rect.width;
      panel.style.flex = '0 0 40px';
      panel.style.width = '40px';
      updateHandle(side, true);
      // Force hide content
      panel.querySelectorAll('.file-toolbar, .tree-toolbar, .file-list, .resizer-vertical, .users-section, .panel-header').forEach(el => el.style.display = 'none');
    }
    applyWorkspaceResizeEffects();
    // update toolbar room visibility when right panel collapses/restores
    try { updateToolbarRoomVisibility(); } catch (e) { }
  }

  function resetWidth(side) {
    const isLeft = (side === 'left');
    const panel = isLeft ? left : right;
    if (panel.classList.contains('collapsed')) {
      toggleCollapse(panel, side);
      return;
    }
    const target = isLeft ? DEFAULT_LEFT : DEFAULT_RIGHT;
    if (isLeft) {
      lastLeft = target;
      left.style.flex = '0 0 ' + target + 'px';
      left.style.width = target + 'px';
    } else {
      lastRight = target;
      right.style.flex = '0 0 ' + target + 'px';
      right.style.width = target + 'px';
    }
    applyWorkspaceResizeEffects();
  }

  // initialize attributes for accessibility
  [collapseLeft, collapseRight].forEach(btn => {
    if (!btn) return;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') btn.click(); });
  });

  // Clicking icon rail expands to default size; clicking individual icons can trigger actions
  document.querySelectorAll('.collapsed-icons').forEach(container => {
    const side = container.dataset.panel;
    if (!side) return;
    const panel = side === 'left' ? left : right;

    // clicking outside specific icons toggles expansion
    container.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.collapsed-icon')) {
        // let button-specific handlers run
        return;
      }
      if (panel.classList.contains('collapsed')) toggleCollapse(panel, side);
    });

    // wire individual icon actions
    container.querySelectorAll('.collapsed-icon').forEach(btn => {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        const action = btn.dataset.action;
        // expand first if needed
        if (panel.classList.contains('collapsed')) toggleCollapse(panel, side);
        // small timeout to allow expand animation/layout; then call action
        setTimeout(() => {
          if (action === 'new-file') {
            if (window.createNewFile) window.createNewFile();
          } else if (action === 'search-files') {
            if (window.focusFileSearch) window.focusFileSearch();
          } else if (action === 'open-files') {
            // no-op, expansion already done
          }
        }, 120);
      });
    });
  });

  function updateHandle(side, collapsed) {
    if (side === 'left') {
      collapseLeft.textContent = collapsed ? '▶' : '◀';
    } else {
      collapseRight.textContent = collapsed ? '◀' : '▶';
    }
  }

  // Hide toolbar room display when right panel is collapsed (desktop UI)
  function updateToolbarRoomVisibility() {
    try {
      const toolbarRoom = document.getElementById('toolbarRoomDisplay');
      if (!toolbarRoom) return;
      if (right.classList.contains('collapsed')) toolbarRoom.style.display = 'none';
      else toolbarRoom.style.display = '';
    } catch (e) { }
  }

  // Mobile nav integration: listen for mobile-nav-select events
  window.addEventListener('mobile-nav-select', function (e) {
    const target = e.detail && e.detail.target;
    if (!target) return;
    handleMobileSelect(target);
  });

  function handleMobileSelect(target) {
    // Clear active states
    document.querySelectorAll('.panel.mobile-active').forEach(p => p.classList.remove('mobile-active'));
    document.querySelectorAll('.mobile-bottom-nav button').forEach(b => b.classList.remove('active'));
    const navBtn = document.querySelector('.mobile-bottom-nav button[data-target="' + target + '"]');
    if (navBtn) navBtn.classList.add('active');

    if (target === 'panelLeft') {
      // show files panel
      left.classList.add('mobile-active');
    } else if (target === 'panelCenter') {
      center.classList.add('mobile-active');
      // ensure editor resizes
      applyWorkspaceResizeEffects();
      // focus editor on mobile so keyboard opens and layout stabilizes
      if (window.editor && typeof window.editor.focus === 'function') {
        try { window.editor.focus(); } catch (e) { }
      }
    } else if (target === 'output') {
      // show right panel, but reveal only io card
      right.classList.add('mobile-active');
      // show IO card and hide others
      right.querySelectorAll('.collab-card').forEach(card => card.style.display = 'none');
      const io = right.querySelector('.io-card'); if (io) io.style.display = 'flex';
    } else if (target === 'users') {
      right.classList.add('mobile-active');
      right.querySelectorAll('.collab-card').forEach(card => card.style.display = 'none');
      const users = right.querySelector('.users-card'); if (users) users.style.display = 'flex';
    } else if (target === 'voice') {
      right.classList.add('mobile-active');
      right.querySelectorAll('.collab-card').forEach(card => card.style.display = 'none');
      const voice = right.querySelector('.voice-card'); if (voice) voice.style.display = 'flex';
    }
    // small delay for layout
    setTimeout(applyWorkspaceResizeEffects, 80);
  }

  // If page loads on mobile, default to editor
  if (window.matchMedia && window.matchMedia('(max-width:580px)').matches) {
    setTimeout(() => handleMobileSelect('panelCenter'), 200);
  }

  // Force-mobile mode: can be enabled by URL param ?mobile=1 or by calling window.setForceMobile(true)
  function applyForceMobile(enabled) {
    if (enabled) document.documentElement.classList.add('force-mobile');
    else document.documentElement.classList.remove('force-mobile');
    // when forcing mobile, initialize mobile view
    if (enabled) setTimeout(() => handleMobileSelect('panelCenter'), 120);
  }

  // expose setter
  window.setForceMobile = applyForceMobile;

  // check URL param
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mobile') === '1') applyForceMobile(true);
  } catch (e) { }

})();

(function () {
  const inlineResizer = document.getElementById('inlineResizer');
  const inlinePanel = document.getElementById('inlineWhiteboardPanel');
  if (!inlineResizer || !inlinePanel) return;

  const MIN_WIDTH = 320;
  const MAX_WIDTH = 900;

  function clamp(width) {
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
  }

  inlineResizer.addEventListener('mousedown', function (e) {
    if (!document.body.classList.contains('whiteboard-open')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = inlinePanel.getBoundingClientRect().width || parseFloat(inlinePanel.dataset.width) || 420;

    function onMove(ev) {
      const delta = startX - ev.clientX;
      const width = clamp(startWidth + delta);
      if (typeof window.setInlineWhiteboardWidth === 'function') {
        window.setInlineWhiteboardWidth(width, { silent: true });
      } else {
        inlinePanel.style.flex = '0 0 ' + width + 'px';
        inlinePanel.style.width = width + 'px';
        inlinePanel.dataset.width = String(Math.round(width));
      }
      applyWorkspaceResizeEffects();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (window.inlineWhiteboard && typeof window.inlineWhiteboard.refreshSize === 'function') {
        window.inlineWhiteboard.refreshSize();
      }
      applyWorkspaceResizeEffects();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// Vertical resizer (Left Panel: Files vs Users)
(function () {
  const resizerVert = document.getElementById('resizerLeftVertical');
  const usersSection = document.getElementById('usersSection');
  const panelLeft = document.getElementById('panelLeft');

  if (!resizerVert || !usersSection || !panelLeft) return;

  const MIN_H = 100;

  function clamp(h, maxH) { return Math.max(MIN_H, Math.min(maxH - MIN_H, h)); }

  resizerVert.addEventListener('mousedown', function (e) {
    e.preventDefault();
    resizerVert.classList.add('active');
    const startY = e.clientY;
    const startHeight = usersSection.getBoundingClientRect().height;
    const panelHeight = panelLeft.getBoundingClientRect().height;

    function onMove(ev) {
      // Dragging UP increases user section height (since it's at bottom)
      const dy = startY - ev.clientY;
      const newH = clamp(startHeight + dy, panelHeight);

      usersSection.style.flex = '0 0 ' + newH + 'px';
      usersSection.style.height = newH + 'px';
      usersSection.style.maxHeight = 'none';
    }

    function onUp() {
      resizerVert.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// Horizontal resizer for center output panel
(function () {
  const resizerOut = document.getElementById('resizerOutput');
  const panelOutput = document.getElementById('panelOutput');
  const center = document.getElementById('panelCenter');
  const editorShell = document.querySelector('.editor-shell');
  if (!resizerOut || !panelOutput || !center) return;

  const MIN_HEIGHT = 80;
  const MAX_HEIGHT = window.innerHeight * 0.75;

  function clamp(h) { return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)); }

  resizerOut.addEventListener('mousedown', function (e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelOutput.getBoundingClientRect().height;

    function onMove(ev) {
      const dy = ev.clientY - startY;
      const newH = clamp(startHeight - dy);
      panelOutput.style.flex = '0 0 ' + Math.round(newH) + 'px';
      panelOutput.style.height = Math.round(newH) + 'px';
      applyWorkspaceResizeEffects();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

// (output panel is now placed permanently inside the editor shell in HTML)
