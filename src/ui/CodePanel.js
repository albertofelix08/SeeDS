// =============================================================
//  SeeDS — CodePanel.js
//  Code Analyzer panel. Custom syntax highlighting — no Ace,
//  no Monaco, no drama. Pure DOM + regex tokenizer.
//  Features:
//    - Minimize/expand toggle (proper CSS — doesn't vanish)
//    - Template selector dropdown
//    - Syntax-highlighted C code editor (contenteditable overlay)
//    - Analyze & Visualize button
//    - Results panel (errors, summary, confidence)
//    - File upload (drag & drop + button)
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS } from '../core/constants.js';
import { analyze, getTemplates } from '../analyzer/index.js';

const LEFT_PANEL_ID = 'code-panel';

const DS_TO_TEMPLATE = {
  linked_list:    'linked_list',
  stack:          'stack',
  queue:          'queue',
  binary_tree:    'binary_tree',
  avl_tree:       'avl_tree',
  heap:           'heap',
  hash_table:     'hash_table',
  graph:          'graph',
  doubly_list:    'doubly_list',
  circular_list:  'linked_list',
  circular_queue: 'circular_queue',
  dequeue:        'dequeue',
  array:          'array_ops',
  sort_race:      'sorting',
};

// ── C Syntax tokeniser ────────────────────────────────────────
const C_KEYWORDS = new Set([
  'auto','break','case','char','const','continue','default','do',
  'double','else','enum','extern','float','for','goto','if','inline',
  'int','long','register','restrict','return','short','signed','sizeof',
  'static','struct','switch','typedef','union','unsigned','void',
  'volatile','while','NULL','true','false','nullptr',
]);

const C_TYPES = new Set([
  'int','char','float','double','long','short','unsigned','signed',
  'void','bool','size_t','uint8_t','uint16_t','uint32_t','uint64_t',
  'int8_t','int16_t','int32_t','int64_t','ptrdiff_t','wchar_t',
]);

/**
 * Tokenise one line of C source into an HTML string with
 * <span class="hl-*"> wrappers. Pure regex — no AST needed.
 */
function highlightLine(line) {
  // Escape the raw text first so we can inject spans safely
  const esc = (s) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // We'll walk through the line character by character using a
  // small state machine so strings, chars and comments are handled
  // correctly before we apply keyword colouring.
  const tokens = []; // { type, text }
  let i = 0;
  const src = line;
  const len = src.length;

  while (i < len) {
    // --- Single-line comment
    if (src[i] === '/' && src[i+1] === '/') {
      tokens.push({ type: 'comment', text: src.slice(i) });
      i = len;
      continue;
    }
    // --- String literal
    if (src[i] === '"') {
      let j = i + 1;
      while (j < len && !(src[j] === '"' && src[j-1] !== '\\')) j++;
      j = Math.min(j + 1, len);
      tokens.push({ type: 'string', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // --- Char literal
    if (src[i] === "'") {
      let j = i + 1;
      while (j < len && !(src[j] === "'" && src[j-1] !== '\\')) j++;
      j = Math.min(j + 1, len);
      tokens.push({ type: 'string', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // --- Preprocessor directive (whole line)
    if (src[i] === '#' && tokens.length === 0) {
      tokens.push({ type: 'preproc', text: src.slice(i) });
      i = len;
      continue;
    }
    // --- Number literal
    if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i+1] || ''))) {
      let j = i;
      while (j < len && /[0-9a-fA-FxXuUlL._]/.test(src[j])) j++;
      tokens.push({ type: 'number', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // --- Identifier or keyword
    if (/[a-zA-Z_]/.test(src[i])) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      // Peek ahead for function call: ident followed by '('
      let k = j;
      while (k < len && src[k] === ' ') k++;
      const isFuncCall = src[k] === '(';
      let type = 'ident';
      if (C_KEYWORDS.has(word)) type = C_TYPES.has(word) ? 'type' : 'keyword';
      else if (isFuncCall)       type = 'func';
      else if (/^[A-Z_][A-Z0-9_]+$/.test(word)) type = 'macro'; // UPPER_CASE
      tokens.push({ type, text: word });
      i = j;
      continue;
    }
    // --- Operator / punctuation
    if (/[+\-*/%=<>!&|^~?:;,.()\[\]{}]/.test(src[i])) {
      tokens.push({ type: 'punct', text: src[i] });
      i++;
      continue;
    }
    // --- Anything else (spaces etc.)
    tokens.push({ type: 'plain', text: src[i] });
    i++;
  }

  // Render tokens to HTML
  return tokens.map(({ type, text }) => {
    const e = esc(text);
    switch (type) {
      case 'comment':  return `<span class="hl-comment">${e}</span>`;
      case 'string':   return `<span class="hl-string">${e}</span>`;
      case 'preproc':  return `<span class="hl-preproc">${e}</span>`;
      case 'number':   return `<span class="hl-number">${e}</span>`;
      case 'keyword':  return `<span class="hl-keyword">${e}</span>`;
      case 'type':     return `<span class="hl-type">${e}</span>`;
      case 'func':     return `<span class="hl-func">${e}</span>`;
      case 'macro':    return `<span class="hl-macro">${e}</span>`;
      default:         return e;
    }
  }).join('');
}

/** Convert plain code string → HTML with per-line highlighting */
function highlightCode(code) {
  return code.split('\n').map(highlightLine).join('\n');
}


// ── CodePanel class ───────────────────────────────────────────
class CodePanel {
  constructor() {
    this._minimized = false;
    this._result    = null;
    this._code      = '';        // current editor value

    this._build();
    this._bindEvents();
  }


  // -----------------------------------------------------------
  //  Build DOM
  // -----------------------------------------------------------
  _build() {
    const container = document.getElementById(LEFT_PANEL_ID);
    if (!container) return;
    container.innerHTML = '';

    // === Header ===
    const header = document.createElement('div');
    header.className = 'code-panel__header';

    const brand = document.createElement('div');
    brand.className = 'code-panel__brand';
    brand.innerHTML = `<span class="code-panel__logo">&lt;/&gt;</span> Code Analyzer`;

    const headerRight = document.createElement('div');
    headerRight.className = 'code-panel__header-right';

    this._minimizeBtn = document.createElement('button');
    this._minimizeBtn.className = 'code-panel__minimize';
    this._minimizeBtn.innerHTML = '◀';
    this._minimizeBtn.title = 'Minimize panel';
    this._minimizeBtn.addEventListener('click', () => this._toggleMinimize());

    headerRight.appendChild(this._minimizeBtn);
    header.appendChild(brand);
    header.appendChild(headerRight);
    container.appendChild(header);

    // === Body ===
    this._body = document.createElement('div');
    this._body.className = 'code-panel__body';
    container.appendChild(this._body);

    // --- Template row ---
    const templateRow = document.createElement('div');
    templateRow.className = 'code-panel__template-row';

    const templateLabel = document.createElement('label');
    templateLabel.className = 'code-panel__label';
    templateLabel.textContent = 'Template:';
    templateRow.appendChild(templateLabel);

    this._templateSelect = document.createElement('select');
    this._templateSelect.className = 'code-panel__select';
    for (const tpl of getTemplates()) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.label;
      this._templateSelect.appendChild(opt);
    }
    this._templateSelect.addEventListener('change', () => this._loadTemplate());

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'code-panel__upload-btn';
    uploadBtn.textContent = '📂 Upload .c';
    uploadBtn.title = 'Upload a .c or .h file';
    uploadBtn.addEventListener('click', () => this._fileInput.click());

    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = '.c,.h';
    this._fileInput.style.display = 'none';
    this._fileInput.addEventListener('change', (e) => this._handleFileUpload(e));

    templateRow.appendChild(this._templateSelect);
    templateRow.appendChild(uploadBtn);
    templateRow.appendChild(this._fileInput);
    this._body.appendChild(templateRow);

    // --- Editor label ---
    this._editorLabel = document.createElement('div');
    this._editorLabel.className = 'code-panel__editor-label';
    this._editorLabel.textContent = 'C Source Code:';
    this._body.appendChild(this._editorLabel);

    // --- Syntax editor ---
    const editorWrap = document.createElement('div');
    editorWrap.className = 'code-panel__editor-wrap';

    // Line numbers column
    this._lineNumbers = document.createElement('div');
    this._lineNumbers.className = 'code-panel__line-numbers';
    this._lineNumbers.setAttribute('aria-hidden', 'true');

    // Highlighted backdrop (read-only, sits behind textarea)
    this._highlight = document.createElement('pre');
    this._highlight.className = 'code-panel__highlight';
    this._highlight.setAttribute('aria-hidden', 'true');

    // Transparent textarea on top — captures actual typing
    this._textarea = document.createElement('textarea');
    this._textarea.className = 'code-panel__textarea';
    this._textarea.spellcheck = false;
    this._textarea.autocomplete = 'off';
    this._textarea.autocorrect = 'off';
    this._textarea.autocapitalize = 'off';
    this._textarea.placeholder = '// Paste C code here or pick a template…';

    this._textarea.addEventListener('input',  () => this._onEdit());
    this._textarea.addEventListener('scroll', () => this._syncScroll());
    this._textarea.addEventListener('keydown', (e) => this._onKeyDown(e));

    editorWrap.appendChild(this._lineNumbers);
    editorWrap.appendChild(this._highlight);
    editorWrap.appendChild(this._textarea);
    this._body.appendChild(editorWrap);

    // --- Action row ---
    const actionRow = document.createElement('div');
    actionRow.className = 'code-panel__action-row';

    this._analyzeBtn = document.createElement('button');
    this._analyzeBtn.className = 'code-panel__analyze-btn';
    this._analyzeBtn.textContent = '▶ Analyze & Visualize';
    this._analyzeBtn.addEventListener('click', () => this._runAnalysis());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'code-panel__clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      this._setCode('');
      this._clearResults();
    });

    actionRow.appendChild(this._analyzeBtn);
    actionRow.appendChild(clearBtn);
    this._body.appendChild(actionRow);

    // --- Results ---
    this._resultsEl = document.createElement('div');
    this._resultsEl.className = 'code-panel__results';
    this._body.appendChild(this._resultsEl);

    // Drag & drop
    this._setupDragDrop(container);

    // Load default template
    this._loadTemplate();
  }


  // -----------------------------------------------------------
  //  Editor helpers
  // -----------------------------------------------------------
  _setCode(code) {
    this._code = code;
    this._textarea.value = code;
    this._renderHighlight();
    this._renderLineNumbers();
  }

  _onEdit() {
    this._code = this._textarea.value;
    this._renderHighlight();
    this._renderLineNumbers();
  }

  _renderHighlight() {
    // The highlight pre must have identical scroll metrics to the textarea.
    // We append a trailing '\n ' so the last empty line takes up space.
    this._highlight.innerHTML = highlightCode(this._code) + '\n ';
  }

  _renderLineNumbers() {
    const lines = this._code.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += `<div>${i}</div>`;
    this._lineNumbers.innerHTML = html;
  }

  _syncScroll() {
    this._highlight.scrollTop  = this._textarea.scrollTop;
    this._highlight.scrollLeft = this._textarea.scrollLeft;
    this._lineNumbers.scrollTop = this._textarea.scrollTop;
  }

  /** Tab key → insert 4 spaces instead of focus-jumping */
  _onKeyDown(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta  = this._textarea;
    const s   = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    ta.value = val.slice(0, s) + '    ' + val.slice(end);
    ta.selectionStart = ta.selectionEnd = s + 4;
    this._onEdit();
  }


  // -----------------------------------------------------------
  //  Drag & drop
  // -----------------------------------------------------------
  _setupDragDrop(container) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('code-panel--drag-over');
    });
    container.addEventListener('dragleave', () => {
      container.classList.remove('code-panel--drag-over');
    });
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('code-panel--drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) this._readFile(files[0]);
    });
  }


  // -----------------------------------------------------------
  //  File upload
  // -----------------------------------------------------------
  _handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) this._readFile(file);
    event.target.value = '';
  }

  _readFile(file) {
    if (!file.name.endsWith('.c') && !file.name.endsWith('.h')) {
      this._showError(`Please upload a .c or .h file (got ${file.name})`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this._setCode(e.target.result);
      this._clearResults();
      this._editorLabel.textContent = `C Source Code: ${file.name}`;
      const fname = file.name.toLowerCase();
      const match = getTemplates().find(t =>
        fname.includes(t.id) || fname.includes(t.label.toLowerCase())
      );
      if (match) this._templateSelect.value = match.id;
    };
    reader.onerror = () => this._showError('Failed to read file');
    reader.readAsText(file);
  }


  // -----------------------------------------------------------
  //  Template loading
  // -----------------------------------------------------------
  _loadTemplate() {
    const id  = this._templateSelect.value;
    const tpl = getTemplates().find(t => t.id === id);
    if (tpl) {
      this._setCode(tpl.code);
      this._clearResults();
      this._editorLabel.textContent = 'C Source Code:';
    }
  }

  _loadTemplateForType(dsType) {
    const templateId = DS_TO_TEMPLATE[dsType];
    if (!templateId) return;
    if (this._templateSelect.value === templateId) return;
    const tpl = getTemplates().find(t => t.id === templateId);
    if (tpl) {
      this._templateSelect.value = templateId;
      this._setCode(tpl.code);
      this._clearResults();
    }
  }


  // -----------------------------------------------------------
  //  Run analysis
  // -----------------------------------------------------------
  _runAnalysis() {
    const code = this._code.trim();
    if (!code) {
      this._showError('Please enter or select C source code to analyze.');
      return;
    }
    this._analyzeBtn.disabled = true;
    this._analyzeBtn.textContent = '⏳ Analyzing…';
    this._clearResults();

    setTimeout(() => {
      try {
        const result = analyze(code);
        this._result = result;
        this._displayResults(result);
        if (result.success && result.data) {
          eventBus.emit(EVENTS.DS_LOADED, { type: result.type, data: result.data });
          setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        }
      } catch (err) {
        this._showError(`Analysis error: ${err.message}`);
      } finally {
        this._analyzeBtn.disabled = false;
        this._analyzeBtn.textContent = '▶ Analyze & Visualize';
      }
    }, 50);
  }


  // -----------------------------------------------------------
  //  Display results
  // -----------------------------------------------------------
  _displayResults(result) {
    this._resultsEl.innerHTML = '';
    if (!result.success) {
      this._showError(`Analysis failed: ${result.error || 'Unknown error'}`);
      return;
    }

    const { confidence } = result;
    const confPercent = confidence?.percent || 0;
    const confLevel   = confidence?.level   || 'unknown';
    const confColor   = confPercent >= 80 ? '#4fc97e'
                      : confPercent >= 50 ? '#ffc44d' : '#ff6b6b';
    let html = '';

    html += `
      <div class="code-panel__section">
        <div class="code-panel__section-title">Analysis Summary</div>
        <div class="code-panel__summary-grid">
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Data Structure</span>
            <span class="code-panel__summary-value code-panel__ds-badge">${result.type.replace(/_/g,' ')}</span>
          </div>
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Confidence</span>
            <span class="code-panel__summary-value" style="color:${confColor}">${confPercent}% (${confLevel})</span>
          </div>
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Tokens</span>
            <span class="code-panel__summary-value">${result.tokenCount}</span>
          </div>
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Functions</span>
            <span class="code-panel__summary-value">${result.metrics?.functions || 0}</span>
          </div>
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Structs</span>
            <span class="code-panel__summary-value">${result.metrics?.structs || 0}</span>
          </div>
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Operations</span>
            <span class="code-panel__summary-value">${result.operCount}</span>
          </div>
        </div>
        <div class="code-panel__confidence-bar">
          <div class="code-panel__confidence-fill" style="width:${confPercent}%;background:${confColor}"></div>
        </div>
      </div>
    `;

    const errors = result.errors || [];
    html += `
      <div class="code-panel__section">
        <div class="code-panel__section-title">
          Errors
          ${errors.length > 0
            ? `<span class="code-panel__error-count-badge">${errors.length}</span>`
            : `<span class="code-panel__ok-badge">✓ None</span>`}
        </div>
    `;
    if (errors.length === 0) {
      html += `<div class="code-panel__no-errors">✓ No bugs detected.</div>`;
    } else {
      html += `<div class="code-panel__error-list">`;
      for (const err of errors) {
        const sevIcon = err.severity === 'critical' ? '🔴'
                      : err.severity === 'high'     ? '🟠'
                      : err.severity === 'medium'   ? '🟡' : '🔵';
        html += `
          <div class="code-panel__error-item" data-node-id="${err.nodeId || ''}">
            <div class="code-panel__error-header">
              <span class="code-panel__error-sev">${sevIcon}</span>
              <span class="code-panel__error-type">${this._formatErrorType(err.type)}</span>
              ${err.line ? `<span class="code-panel__error-line">L${err.line}</span>` : ''}
              <span class="code-panel__error-sev-label">${err.severity || 'medium'}</span>
            </div>
            <div class="code-panel__error-msg">${err.message}</div>
            ${err.sourceLine ? `<div class="code-panel__error-source"><code>${this._escapeHtml(err.sourceLine)}</code></div>` : ''}
            ${err.fix ? `<div class="code-panel__error-fix">💡 ${err.fix}</div>` : ''}
          </div>
        `;
      }
      html += `</div>`;
    }
    html += `</div>`;

    const parseErrors = result.parseErrors || [];
    if (parseErrors.length > 0) {
      html += `
        <div class="code-panel__section">
          <div class="code-panel__section-title">Parse Warnings (${parseErrors.length})</div>
          <div class="code-panel__parse-errors">
            ${parseErrors.map(pe => `<div class="code-panel__parse-item">Line ${pe.line}: ${pe.message}</div>`).join('')}
          </div>
        </div>
      `;
    }

    this._resultsEl.innerHTML = html;

    this._resultsEl.querySelectorAll('.code-panel__error-item').forEach(el => {
      el.addEventListener('click', () => {
        const nodeId = el.dataset.nodeId;
        if (nodeId) {
          eventBus.emit(EVENTS.ERROR_SELECTED, {
            error: errors.find(e => e.nodeId === nodeId) || { nodeId },
          });
        }
      });
    });
  }


  // -----------------------------------------------------------
  //  Toggle minimize
  // -----------------------------------------------------------
  _toggleMinimize() {
    this._minimized = !this._minimized;
    const panel = document.getElementById(LEFT_PANEL_ID);
    if (panel) panel.classList.toggle('code-panel--minimized', this._minimized);
    this._minimizeBtn.innerHTML = this._minimized ? '▶' : '◀';
    this._minimizeBtn.title = this._minimized ? 'Expand panel' : 'Minimize panel';
    window.dispatchEvent(new Event('resize'));
  }


  // -----------------------------------------------------------
  //  Events
  // -----------------------------------------------------------
  _bindEvents() {
    eventBus.on(EVENTS.DS_LOADED, ({ type, source }) => {
      if (source === 'toolbar') this._loadTemplateForType(type);
    });
  }


  // -----------------------------------------------------------
  //  Helpers
  // -----------------------------------------------------------
  _clearResults() {
    this._result = null;
    if (this._resultsEl) this._resultsEl.innerHTML = '';
  }

  _showError(msg) {
    if (!this._resultsEl) return;
    this._resultsEl.innerHTML = `
      <div class="code-panel__error-msg-box">
        <span class="code-panel__error-icon">⚠</span>
        ${this._escapeHtml(msg)}
      </div>
    `;
  }

  _formatErrorType(type) {
    if (!type) return 'Unknown';
    return type.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  dispose() {
    const container = document.getElementById(LEFT_PANEL_ID);
    if (container) container.innerHTML = '';
  }
}

export default CodePanel;