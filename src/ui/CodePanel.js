// =============================================================
//  SeeDS — CodePanel.js
//  Code Analyzer panel — takes up 40% of screen width.
//  Features:
//    - Minimize/expand toggle
//    - Template selector dropdown
//    - Code textarea with line numbers
//    - Analyze button
//    - Results panel with errors (type, line, message, fix)
//    - File upload (drag & drop + button)
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS } from '../core/constants.js';
import { analyze, getTemplates } from '../analyzer/index.js';

const LEFT_PANEL_ID = 'code-panel';


class CodePanel {
  constructor() {
    this._minimized = false;
    this._result    = null;

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
    this._minimizeBtn.innerHTML = '▸';
    this._minimizeBtn.title = 'Minimize panel';
    this._minimizeBtn.addEventListener('click', () => this._toggleMinimize());

    headerRight.appendChild(this._minimizeBtn);
    header.appendChild(brand);
    header.appendChild(headerRight);
    container.appendChild(header);

    // === Body (all content) ===
    this._body = document.createElement('div');
    this._body.className = 'code-panel__body';
    container.appendChild(this._body);

    // --- Template selector ---
    const templateRow = document.createElement('div');
    templateRow.className = 'code-panel__template-row';

    const templateLabel = document.createElement('label');
    templateLabel.className = 'code-panel__label';
    templateLabel.textContent = 'Template:';
    templateRow.appendChild(templateLabel);

    this._templateSelect = document.createElement('select');
    this._templateSelect.className = 'code-panel__select';

    const templates = getTemplates();
    for (const tpl of templates) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.label;
      this._templateSelect.appendChild(opt);
    }

    this._templateSelect.addEventListener('change', () => this._loadTemplate());

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'code-panel__upload-btn';
    uploadBtn.textContent = '📂 Upload .c';
    uploadBtn.title = 'Upload a .c file';
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

    // --- Code textarea ---
    const codeLabel = document.createElement('div');
    codeLabel.className = 'code-panel__code-label';
    codeLabel.textContent = 'C Source Code:';
    this._body.appendChild(codeLabel);

    const codeWrap = document.createElement('div');
    codeWrap.className = 'code-panel__code-wrap';

    this._lineNumbers = document.createElement('div');
    this._lineNumbers.className = 'code-panel__line-numbers';

    this._codeArea = document.createElement('textarea');
    this._codeArea.className = 'code-panel__textarea';
    this._codeArea.spellcheck = false;
    this._codeArea.placeholder = '// Paste your C code here, or select a template above...\n\nstruct Node {\n    int data;\n    struct Node* next;\n};';

    // Sync line numbers on input
    this._codeArea.addEventListener('input', () => this._syncLineNumbers());
    this._codeArea.addEventListener('scroll', () => {
      this._lineNumbers.scrollTop = this._codeArea.scrollTop;
    });

    codeWrap.appendChild(this._lineNumbers);
    codeWrap.appendChild(this._codeArea);
    this._body.appendChild(codeWrap);

    // --- Analyze button ---
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
      this._codeArea.value = '';
      this._syncLineNumbers();
      this._clearResults();
    });

    actionRow.appendChild(this._analyzeBtn);
    actionRow.appendChild(clearBtn);
    this._body.appendChild(actionRow);

    // --- Results area ---
    this._resultsEl = document.createElement('div');
    this._resultsEl.className = 'code-panel__results';
    this._body.appendChild(this._resultsEl);

    // Drag & drop zone
    this._setupDragDrop(container);

    // Load default template
    this._loadTemplate();
  }


  // -----------------------------------------------------------
  //  Drag & drop support
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
      if (files.length > 0) {
        this._readFile(files[0]);
      }
    });
  }


  // -----------------------------------------------------------
  //  File upload handling
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
      this._codeArea.value = e.target.result;
      this._syncLineNumbers();

      // Auto-detect template from filename
      const fname = file.name.toLowerCase();
      const templates = getTemplates();
      const match = templates.find(t =>
        fname.includes(t.id) || fname.includes(t.label.toLowerCase())
      );
      if (match) {
        this._templateSelect.value = match.id;
      }

      // Clear old results
      this._clearResults();
    };
    reader.onerror = () => {
      this._showError('Failed to read file');
    };
    reader.readAsText(file);
  }


  // -----------------------------------------------------------
  //  Template loading
  // -----------------------------------------------------------
  _loadTemplate() {
    const id = this._templateSelect.value;
    const templates = getTemplates();
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      this._codeArea.value = tpl.code;
      this._syncLineNumbers();
      this._clearResults();
    }
  }


  // -----------------------------------------------------------
  //  Line number sync
  // -----------------------------------------------------------
  _syncLineNumbers() {
    const lines = this._codeArea.value.split('\n');
    const lineCount = lines.length;
    let html = '';
    for (let i = 1; i <= lineCount; i++) {
      html += `<span>${i}</span>`;
    }
    this._lineNumbers.innerHTML = html;
  }


  // -----------------------------------------------------------
  //  Run analysis
  // -----------------------------------------------------------
  _runAnalysis() {
    const code = this._codeArea.value.trim();
    if (!code) {
      this._showError('Please enter or select C source code to analyze.');
      return;
    }

    // Show loading state
    this._analyzeBtn.disabled = true;
    this._analyzeBtn.textContent = '⏳ Analyzing...';
    this._clearResults();

    // Run analysis (synchronous)
    setTimeout(() => {
      try {
        const result = analyze(code);
        this._result = result;
        this._displayResults(result);

        // If successful, emit event to load visualization
        if (result.success && result.data) {
          eventBus.emit(EVENTS.DS_LOADED, {
            type: result.type,
            data: result.data,
          });
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
      this._resultsEl.innerHTML = `
        <div class="code-panel__error-msg">
          <span class="code-panel__error-icon">✕</span>
          Analysis failed: ${result.error || 'Unknown error'}
        </div>
      `;
      return;
    }

    // Confidence bar
    const { confidence } = result;
    const confPercent = confidence?.percent || 0;
    const confLevel = confidence?.level || 'unknown';
    const confColor = confPercent >= 80 ? '#4fc97e' : confPercent >= 50 ? '#ffc44d' : '#ff6b6b';

    // Build HTML
    let html = '';

    // === Analysis Summary ===
    html += `
      <div class="code-panel__section">
        <div class="code-panel__section-title">Analysis Summary</div>
        <div class="code-panel__summary-grid">
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Data Structure</span>
            <span class="code-panel__summary-value code-panel__ds-badge">${result.type.replace(/_/g, ' ')}</span>
          </div>
          <div class="code-panel__summary-item">
            <span class="code-panel__summary-label">Confidence</span>
            <span class="code-panel__summary-value" style="color:${confColor}">
              ${confPercent}% (${confLevel})
            </span>
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

    // === Errors Section ===
    const errors = result.errors || [];
    html += `
      <div class="code-panel__section">
        <div class="code-panel__section-title">
          ${errors.length > 0 ? `Errors (${errors.length})` : 'Errors'}
          ${errors.length > 0
            ? `<span class="code-panel__error-count-badge">${errors.length}</span>`
            : '<span class="code-panel__ok-badge">✓ No errors</span>'}
        </div>
    `;

    if (errors.length === 0) {
      html += `<div class="code-panel__no-errors">No bugs detected in this code.</div>`;
    } else {
      html += `<div class="code-panel__error-list">`;
      for (const err of errors) {
        const sevIcon = err.severity === 'critical' ? '🔴' :
                        err.severity === 'high' ? '🟠' :
                        err.severity === 'medium' ? '🟡' : '🔵';
        html += `
          <div class="code-panel__error-item" data-node-id="${err.nodeId || ''}">
            <div class="code-panel__error-header">
              <span class="code-panel__error-sev">${sevIcon}</span>
              <span class="code-panel__error-type">${this._formatErrorType(err.type)}</span>
              ${err.line ? `<span class="code-panel__error-line">Line ${err.line}</span>` : ''}
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

    // Parse errors (if any)
    const parseErrors = result.parseErrors || [];
    if (parseErrors.length > 0) {
      html += `
        <div class="code-panel__section">
          <div class="code-panel__section-title">Parse Warnings (${parseErrors.length})</div>
          <div class="code-panel__parse-errors">
      `;
      for (const pe of parseErrors) {
        html += `<div class="code-panel__parse-item">Line ${pe.line}: ${pe.message}</div>`;
      }
      html += `</div></div>`;
    }

    this._resultsEl.innerHTML = html;

    // Click on error item focuses camera on the node
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
  //  Clear results
  // -----------------------------------------------------------
  _clearResults() {
    this._result = null;
    if (this._resultsEl) this._resultsEl.innerHTML = '';
  }


  // -----------------------------------------------------------
  //  Show an error message in results
  // -----------------------------------------------------------
  _showError(msg) {
    this._resultsEl.innerHTML = `
      <div class="code-panel__error-msg">
        <span class="code-panel__error-icon">⚠</span>
        ${this._escapeHtml(msg)}
      </div>
    `;
  }


  // -----------------------------------------------------------
  //  Toggle minimize
  // -----------------------------------------------------------
  _toggleMinimize() {
    this._minimized = !this._minimized;
    const panel = document.getElementById(LEFT_PANEL_ID);
    if (panel) {
      panel.classList.toggle('code-panel--minimized', this._minimized);
    }
    this._minimizeBtn.innerHTML = this._minimized ? '◂' : '▸';
    this._minimizeBtn.title = this._minimized ? 'Expand panel' : 'Minimize panel';

    // Resize canvas on toggle
    window.dispatchEvent(new Event('resize'));
  }


  // -----------------------------------------------------------
  //  Events
  // -----------------------------------------------------------
  _bindEvents() {
    // Resize line numbers when panel toggles
    window.addEventListener('resize', () => {
      setTimeout(() => this._syncLineNumbers(), 100);
    });
  }


  // -----------------------------------------------------------
  //  Helpers
  // -----------------------------------------------------------
  _formatErrorType(type) {
    if (!type) return 'Unknown';
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    const container = document.getElementById(LEFT_PANEL_ID);
    if (container) container.innerHTML = '';
  }
}


export default CodePanel;
