/**
 * AI Inline Widget (Multiline Preview)
 * - Displays up to MAX_PREVIEW_LINES of the suggestion
 * - Shows truncation footer if more lines exist
 * - Toggle full/condensed preview: Ctrl/Cmd + Alt + ;
 * - Accept full suggestion: Tab
 * - Force refresh: Ctrl/Cmd + Alt + R
 */
(function (global) {
  const CFG = {
    endpoint: '/api/ai/inline',
    debounceMs: 900,
    minChars: 6,
    maxPrefix: 6000,

    // Preview controls
    MAX_PREVIEW_LINES: 6,
    MAX_PREVIEW_CHARS: 800,
    FOOTER_THRESHOLD_LINES: 6,
    SHOW_PLACEHOLDER: true,
    placeholder: '…',

    // Formatting
    TRIM_TRAILING_EMPTY: true,
    NORMALIZE_INDENT: true,

    // Behavior
    debug: false
  };

  function log(...a){ if (CFG.debug) console.log('[AI-WIDGET]', ...a); }
  function tail(s,n){ return s.length <= n ? s : s.slice(-n); }

  function normalizeIndent(text, baseCol) {
    if (!CFG.NORMALIZE_INDENT) return text;
    const lines = text.split('\n');
    // Detect minimal indent among non-empty lines after first
    let minIndent = Infinity;
    for (let i=1;i<lines.length;i++){
      const ln = lines[i];
      if (!ln.trim()) continue;
      const m = ln.match(/^(\s+)/);
      if (m) minIndent = Math.min(minIndent, m[1].length);
      else { minIndent = 0; break; }
    }
    if (minIndent === Infinity) minIndent = 0;
    if (minIndent === 0) return text;
    const trimmed = [lines[0], ...lines.slice(1).map(l => l.startsWith(' '.repeat(minIndent)) ? l.slice(minIndent) : l)].join('\n');
    // Re-indent relative to cursor column
    if (baseCol > 1) {
      const pad = ' '.repeat(baseCol - 1);
      const relines = trimmed.split('\n');
      for (let i=1;i<relines.length;i++){
        if (relines[i].length) relines[i] = pad + relines[i];
      }
      return relines.join('\n');
    }
    return trimmed;
  }

  function buildPreview(full, cursorCol) {
    let raw = full;
    if (CFG.TRIM_TRAILING_EMPTY) {
      raw = raw.replace(/\s+$/, '');
    }
    raw = raw.slice(0, CFG.MAX_PREVIEW_CHARS);

    // Re-indent continuation relative to cursor column
    raw = normalizeIndent(raw, cursorCol);

    const lines = raw.split('\n');
    const truncated = lines.length > CFG.MAX_PREVIEW_LINES;
    const shownLines = truncated ? lines.slice(0, CFG.MAX_PREVIEW_LINES) : lines;
    let display = shownLines.join('\n');

    if (truncated) {
      const more = lines.length - CFG.MAX_PREVIEW_LINES;
      display += `\n… (+${more} more line${more>1?'s':''})`;
    }
    return { display, truncated };
  }

  function init(editor) {
    if (!editor || !global.monaco) {
      console.warn('[AI-WIDGET] Monaco not ready');
      return null;
    }

    let fullSuggestion = '';
    let widgetNode = null;
    let widgetVisible = false;
    let aborter = null;
    let debounceTimer = null;
    let lastFetchId = 0;
    let expanded = false; // if user toggled full view when truncated

    const widget = {
      getId: () => 'ai-inline-ghost-widget',
      getDomNode: () => {
        if (!widgetNode) {
          widgetNode = document.createElement('div');
          widgetNode.className = 'ai-ghost-block';
          widgetNode.textContent = '';
        }
        return widgetNode;
      },
      getPosition: () => {
        if (!widgetVisible) return null;
        return {
          position: editor.getPosition(),
          preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
        };
      }
    };
    editor.addContentWidget(widget);
          // After editor.addContentWidget(widget);
      widget.getDomNode().addEventListener('click', () => {
        if (fullSuggestion) {
          accept();
        }
      });
      // Optionally: a second tap to expand if truncated:
      // widget.getDomNode().addEventListener('dblclick', toggleExpanded);

    function updateWidgetText(text, placeholder=false) {
      const node = widget.getDomNode();
      if (!text) {
        node.textContent = '';
        widgetVisible = false;
        editor.layoutContentWidget(widget);
        return;
      }
      node.className = 'ai-ghost-block';
      if (placeholder) node.classList.add('ai-ghost-block--placeholder');
      node.textContent = ' ' + text; // leading space
      widgetVisible = true;
      editor.layoutContentWidget(widget);
    }

    function clearWidget() {
      fullSuggestion = '';
      expanded = false;
      updateWidgetText('');
    }

    function getLang() {
      const s = document.getElementById('language');
      if (!s) return 'Code';
      const o = s.options[s.selectedIndex];
      return (o && o.textContent) || 'Code';
    }

    function getPrefix() {
      const model = editor.getModel();
      if (!model) return '';
      return tail(model.getValue(), CFG.maxPrefix);
    }

    function scheduleFetch() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchSuggestion, CFG.debounceMs);
    }

    function fetchSuggestion(force=false) {
      const model = editor.getModel();
      if (!model) return;
      const all = model.getValue();
      if (all.length < CFG.minChars) {
        clearWidget();
        return;
      }

      const prefix = getPrefix();
      if (aborter) {
        try { aborter.abort(); } catch {}
      }
      aborter = new AbortController();
      const fid = ++lastFetchId;

      clearWidget();
      if (CFG.SHOW_PLACEHOLDER) updateWidgetText(CFG.placeholder, true);

      const lang = getLang();
      log('POST', CFG.endpoint, { bytes: prefix.length, lang, fid, force });

      fetch(CFG.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prefix, language: lang }),
        signal: aborter.signal
      })
        .then(async r => {
          let data;
          try { data = await r.json(); } catch {
            throw new Error('Non-JSON ' + r.status);
          }
          if (!r.ok) throw new Error(data.error || ('HTTP '+r.status));
          return data;
        })
        .then(data => {
          if (fid !== lastFetchId) {
            log('Stale response ignored fid=', fid);
            return;
          }
            const raw = (data.suggestion || '').replace(/\r/g,'');
          log('RAW LEN', raw.length, 'PREVIEW', JSON.stringify(raw.slice(0,120)));
          const trimmed = raw.trim();
          if (!trimmed) {
            clearWidget();
            log('Empty trimmed');
            return;
          }
          fullSuggestion = trimmed;
          renderPreview();
        })
        .catch(e => {
          if (e.name === 'AbortError') {
            log('Aborted');
            return;
          }
          log('Fetch error:', e.message);
          clearWidget();
        });
    }

    function renderPreview() {
      if (!fullSuggestion) {
        clearWidget();
        return;
      }
      const pos = editor.getPosition();
      const col = pos ? pos.column : 1;

      if (expanded) {
        // Show full (bounded by MAX_PREVIEW_CHARS for safety)
        const bounded = fullSuggestion.slice(0, CFG.MAX_PREVIEW_CHARS);
        updateWidgetText(bounded, false);
        return;
      }

      const { display, truncated } = buildPreview(fullSuggestion, col);
      updateWidgetText(display, false);
      if (truncated) {
        // Add hint class
        const node = widget.getDomNode();
        node.classList.add('ai-ghost-block--truncated');
      }
    }

    function toggleExpanded() {
      if (!fullSuggestion) return;
      expanded = !expanded;
      renderPreview();
    }

    function accept() {
      if (!fullSuggestion) {
        editor.trigger('keyboard','tab',{});
        editor.trigger('keyboard','type',{ text: '\n' });
        return;
      }
      const insert = fullSuggestion;
      clearWidget();
      editor.executeEdits('ai-inline', [{
        range: editor.getSelection(),
        text: insert
      }]);
      scheduleFetch();
    }

    // Events
    editor.onDidChangeModelContent(() => {
      clearWidget();
      scheduleFetch();
    });

    editor.onDidChangeCursorPosition(() => {
      // Keep widget; just re-layout (maybe not needed)
      if (widgetVisible) editor.layoutContentWidget(widget);
    });

    editor.addCommand(monaco.KeyCode.Tab, accept);

    // Toggle preview size: Ctrl/Cmd + Alt + ;
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === ';') {
        e.preventDefault();
        toggleExpanded();
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        force();
      }
    });

    const ls = document.getElementById('language');
    if (ls) {
      ls.addEventListener('change', () => {
        clearWidget();
        scheduleFetch();
      });
    }

    function force() {
      clearWidget();
      fetchSuggestion(true);
    }

    // Public API
          const api = {
        force,
        trigger: force,
        enableDebug: () => { CFG.debug = true; log('Debug ON'); },
        disableDebug: () => { CFG.debug = false; log('Debug OFF'); },
        state: () => ({
          hasSuggestion: !!fullSuggestion,
          previewSample: fullSuggestion.slice(0,100),
          widgetVisible,
          expanded
        }),
        expand: () => { expanded = true; renderPreview(); },
        collapse: () => { expanded = false; renderPreview(); },
        toggle: toggleExpanded,
      };

    // Alias for earlier expectations
    global.__AIGHOST_STATE__ = api;

    // Initialize
    scheduleFetch();

    return api;
  }

  // Export (widget version)
  global.AIGhostWidget = { init };
  // Backward-compatible alias
  if (!global.AIGhost) global.AIGhost = { init };

})(window);