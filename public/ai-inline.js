/**
 * AI Inline Suggestions (improved refresh logic).
 *
 * Improvements:
 *  - Periodic refresh even if prefix hash unchanged (configurable).
 *  - Keyboard shortcut Ctrl/Cmd + Alt + R to force a new suggestion.
 *  - Optional disabling of lastKey gating for debugging.
 *  - Lower default MIN_PREFIX_CHARS to 6 (was 12).
 *  - onDidType sets a flag to permit next request bypass.
 */
(function () {
  const CONFIG = {
    ENDPOINT: '/ai/inline',
    DEBOUNCE_MS: 5000,
    MAX_PREFIX_CHARS: 6000,
    MIN_PREFIX_CHARS: 6,
    CACHE_LIMIT: 400,
    UPDATE_MONACO_MODEL_LANGUAGE: true,

    // New refresh controls
    ALLOW_SAME_PREFIX_REFRESH: true,         // If true, can re-fetch on same hash
    RETRY_SAME_PREFIX_MS: 8000,              // Time after which same prefix triggers new request
    BYPASS_AFTER_TYPE: true,                 // First debounce after actual typing ignores lastKey gate

    DEBUG: false
  };

  const LANGUAGE_CODE_MAP = {
    63: { code: 63, display: 'JavaScript', monacoId: 'javascript' },
    71: { code: 71, display: 'Python',     monacoId: 'python' },
    54: { code: 54, display: 'C++',        monacoId: 'cpp' },
    62: { code: 62, display: 'Java',       monacoId: 'java' },
    68: { code: 68, display: 'PHP',        monacoId: 'php' },
    82: { code: 82, display: 'SQL',        monacoId: 'sql' },
    22: { code: 22, display: 'Go',         monacoId: 'go' },
    80: { code: 80, display: 'R',          monacoId: 'r' },
    73: { code: 73, display: 'Rust',       monacoId: 'rust' },
    50: { code: 50, display: 'C',          monacoId: 'c' },
    72: { code: 72, display: 'Ruby',       monacoId: 'ruby' },
    51: { code: 51, display: 'C#',         monacoId: 'csharp' },
    78: { code: 78, display: 'Kotlin',     monacoId: 'kotlin' },
    74: { code: 74, display: 'TypeScript', monacoId: 'typescript' }
  };

  // ---------- State ----------
  let debounceTimer = null;
  let lastKey = '';
  let lastKeyTime = 0;
  let activeAbort = null;
  let requestCounter = 0;
  let currentLangInfo = null;
  let typedSinceLastSuggestion = false;

  const cache = new Map();

  function log(...a){ if (CONFIG.DEBUG) console.log('[AIInline]', ...a); }

  function getSelect() {
    return document.getElementById('language');
  }

  function readSelectedLangInfo() {
    const sel = getSelect();
    if (!sel) return null;
    return LANGUAGE_CODE_MAP[Number(sel.value)] || null;
  }

  function setCurrentLang(editor, triggerSchedule = true) {
    const info = readSelectedLangInfo();
    if (!info) return;
    if (currentLangInfo && currentLangInfo.code === info.code) return;
    currentLangInfo = info;
    lastKey = '';
    lastKeyTime = 0;
    log('Language changed →', info.display);

    if (CONFIG.UPDATE_MONACO_MODEL_LANGUAGE && window.monaco && editor?.getModel()) {
      try {
        monaco.editor.setModelLanguage(editor.getModel(), info.monacoId);
      } catch(e) {
        log('setModelLanguage error (maybe extension missing):', e);
      }
    }

    const sel = getSelect();
    if (sel) {
      sel.dispatchEvent(new CustomEvent('aiinline:languageChange', {
        detail: { code: info.code, display: info.display, monacoId: info.monacoId }
      }));
    }

    if (triggerSchedule) schedule(editor, true);
  }

  function hash(str) {
    let h=0,i=0;
    while(i<str.length) h=(h*31 + str.charCodeAt(i++))|0;
    return h.toString();
  }

  function getPrefix(model, pos) {
    return model.getValueInRange({
      startLineNumber:1,startColumn:1,
      endLineNumber:pos.lineNumber,endColumn:pos.column
    });
  }

  function trimPrefix(prefix) {
    if (prefix.length <= CONFIG.MAX_PREFIX_CHARS) return prefix;
    let slice = prefix.slice(-CONFIG.MAX_PREFIX_CHARS);
    const nl = slice.indexOf('\n');
    if (nl !== -1 && nl < 100) slice = slice.slice(nl+1);
    return slice;
  }

  async function requestSuggestion(editor, force=false) {
    if (!currentLangInfo) setCurrentLang(editor,false);
    if (!currentLangInfo) return;

    const model = editor.getModel();
    if (!model) return;
    const pos = editor.getPosition();
    if (!pos) return;

    let rawPrefix = getPrefix(model,pos);
    if (rawPrefix.length < CONFIG.MIN_PREFIX_CHARS) {
      log('Prefix too short:', rawPrefix.length);
      return;
    }
    const prefix = trimPrefix(rawPrefix);
    const key = currentLangInfo.code + '::' + hash(prefix);

    const now = Date.now();
    const sameKey = (key === lastKey);
    const timeElapsed = now - lastKeyTime;

    const canRefreshSame =
      force ||
      (CONFIG.ALLOW_SAME_PREFIX_REFRESH && timeElapsed >= CONFIG.RETRY_SAME_PREFIX_MS) ||
      (CONFIG.BYPASS_AFTER_TYPE && typedSinceLastSuggestion);

    if (sameKey && !canRefreshSame) {
      // Show cached suggestion if exists
      if (cache.has(key)) {
        log('Same prefix hash, showing cached suggestion (elapsed ms:', timeElapsed, ')');
        editor.trigger('ai-inline','editor.action.triggerSuggest',{});
      } else {
        log('Same prefix hash, no cache (no request).');
      }
      return;
    }

    lastKey = key;
    lastKeyTime = now;
    typedSinceLastSuggestion = false;

    if (activeAbort) {
      try { activeAbort.abort(); } catch {}
    }
    const controller = new AbortController();
    activeAbort = controller;
    const thisReq = ++requestCounter;

    try {
      log(force ? 'FORCE POST' : 'POST', CONFIG.ENDPOINT, { lang: currentLangInfo.display, prefixLen: prefix.length, sameKey, force });
      const res = await fetch(CONFIG.ENDPOINT, {
        method:'POST',
        signal: controller.signal,
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          prefix,
          language_code: currentLangInfo.code,
          language: currentLangInfo.display,
          language_id: currentLangInfo.monacoId
        })
      });
      if (!res.ok) {
        log('Non-200:', res.status);
        return;
      }
      const data = await res.json().catch(()=> ({}));
      if (thisReq !== requestCounter) {
        log('Stale response ignored');
        return;
      }
      const suggestion = (data.suggestion || '').trim();
      if (!suggestion) {
        log('Empty suggestion');
        return;
      }
      cache.set(key, suggestion);
      if (cache.size > CONFIG.CACHE_LIMIT) {
        const first = cache.keys().next().value;
        cache.delete(first);
      }
      editor.trigger('ai-inline','editor.action.triggerSuggest',{});
      log('Suggestion cached length:', suggestion.length);
    } catch (e) {
      if (e.name !== 'AbortError') log('Fetch error:', e);
    }
  }

  function schedule(editor, force=false) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => requestSuggestion(editor, force), CONFIG.DEBOUNCE_MS);
  }

  function registerProviders() {
    const monacoIds = [...new Set(Object.values(LANGUAGE_CODE_MAP).map(v=>v.monacoId))];
    monacoIds.forEach(id => {
      monaco.languages.registerCompletionItemProvider(id, {
        triggerCharacters: [],
        provideCompletionItems: (model, position) => {
          if (!currentLangInfo) return { suggestions: [] };
          if (model.getLanguageId() !== currentLangInfo.monacoId) return { suggestions: [] };
          const raw = getPrefix(model, position);
          const trimmed = trimPrefix(raw);
          const key = currentLangInfo.code + '::' + hash(trimmed);
          const sug = cache.get(key);
          if (!sug) return { suggestions: [] };
          return {
            suggestions: [{
              label: sug,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: sug,
              sortText: '\u0000AI',
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              }
            }]
          };
        }
      });
    });
  }

  function attachEditor(editor) {
    editor.onDidChangeModelContent(() => schedule(editor));
    if (editor.onDidType) {
      editor.onDidType(() => {
        typedSinceLastSuggestion = true;
      });
    }
    editor.onDidChangeModel(() => {
      lastKey = '';
      lastKeyTime = 0;
      if (currentLangInfo && CONFIG.UPDATE_MONACO_MODEL_LANGUAGE) {
        try { monaco.editor.setModelLanguage(editor.getModel(), currentLangInfo.monacoId); } catch {}
      }
      schedule(editor, true);
    });

    const sel = getSelect();
    if (sel) {
      sel.addEventListener('change', () => setCurrentLang(editor, true));
    }

    // Keyboard shortcut: Ctrl/Cmd + Alt + R to force new suggestion
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        log('Force refresh shortcut');
        requestSuggestion(editor, true);
      }
    });

    setCurrentLang(editor,false);
    schedule(editor,true);
  }

  function init(attempt=0) {
    if (window.monaco && window.editor) {
      log('Initializing AI Inline (improved)');
      registerProviders();
      attachEditor(window.editor);
      window.AIInline = {
        force: () => requestSuggestion(window.editor,true),
        forceRefresh: () => requestSuggestion(window.editor,true),
        clearCache: () => cache.clear(),
        enableDebug: () => { CONFIG.DEBUG = true; },
        disableDebug: () => { CONFIG.DEBUG = false; },
        stats: () => ({
          cacheSize: cache.size,
          lastKey,
          lastKeyAgeMs: Date.now() - lastKeyTime,
          currentLangInfo,
          typedSinceLastSuggestion
        }),
        config: CONFIG
      };
    } else if (attempt < 150) {
      setTimeout(() => init(attempt+1), 100);
    } else {
      console.warn('[AIInline] Monaco editor not found.');
    }
  }

  init();
})();