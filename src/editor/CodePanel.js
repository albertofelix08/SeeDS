// =============================================================
//  SeeDS — CodePanel.js  (Monaco edition)
//  Permanent left-side panel. Features:
//    - Monaco editor (C syntax, SeeDS dark theme)
//    - Template selector dropdown
//    - File upload (button + drag & drop)
//    - Analyze & Visualize button
//    - Results panel (errors, summary, confidence)
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS } from '../core/constants.js';
import { analyze, getTemplates } from '../analyzer/index.js';
import AceWrapper from '../editor/AceWrapper.js';

const PANEL_ID = 'code-panel';


class CodePanel {
  constructor() {
    this._result  = null;
    this._monaco  = new AceWrapper();

    this._build();
    this._bindEvents();
  }


  // -----------------------------------------------------------
  //  Build DOM
  // -----------------------------------------------------------
  _build() {
    const container = document.getElementById(PANEL_ID);
    if (!container) return;
    container.innerHTML = '';

    // === Header ===
    const header = document.createElement('div');
    header.className = 'code-panel__header';

    const brand = document.createElement('div');
    brand.className = 'code-panel__brand';
    brand.innerHTML = `<span class="code-panel__logo">&lt;/&gt;</span> Code Analyzer`;

    header.appendChild(brand);
    container.appendChild(header);

    // === Body ===
    this._body = document.createElement('div');
    this._body.className = 'code-panel__body';
    container.appendChild(this._body);

    // --- Template selector row ---
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
    const editorLabel = document.createElement('div');
    editorLabel.className = 'code-panel__editor-label';
    editorLabel.textContent = 'C Source Code:';
    this._body.appendChild(editorLabel);

    // --- Monaco container ---
    this._aceWrap = document.createElement('div');
    this._aceWrap.className = 'code-panel__monaco-wrap';

    const aceContainer = document.createElement('div');
    aceContainer.id = 'ace-editor-container';
    this._aceWrap.appendChild(aceContainer);
    this._body.appendChild(this._aceWrap);

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
      this._monaco.setValue('');
      this._clearResults();
    });

    actionRow.appendChild(this._analyzeBtn);
    actionRow.appendChild(clearBtn);
    this._body.appendChild(actionRow);

    // --- Results area ---
    this._resultsEl = document.createElement('div');
    this._resultsEl.className = 'code-panel__results';
    this._body.appendChild(this._resultsEl);

    // Drag & drop
    this._setupDragDrop(container);

    // Mount Ace (synchronous — window.ace is already available)
    this._mountAce();
  }


  // -----------------------------------------------------------
  //  Mount Ace (synchronous — no async needed)
  // -----------------------------------------------------------
  async _mountAce() {
    const container = document.getElementById('ace-editor-container');
    try {
      await this._monaco.mount(container);
      // Load default template into editor
      this._loadTemplate();
    } catch (err) {
      console.error('[CodePanel] Ace failed to mount:', err);
      // Fallback: show plain textarea
      container.innerHTML = `
        <textarea id="ace-fallback"
          style="width:100%;height:100%;background:#0d0d14;color:#e8ecf8;
                 font-family:monospace;font-size:12px;padding:8px;
                 border:none;outline:none;resize:none;"
          spellcheck="false"
          placeholder="// Paste C code here..."></textarea>
      `;
      // Patch getValue/setValue to use the textarea
      const ta = container.querySelector('#ace-fallback');
      this._monaco.getValue = () => ta.value;
      this._monaco.setValue = (v) => { ta.value = v; };
    }
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
      this._monaco.setValue(e.target.result);
      this._clearResults();

      // Auto-detect template from filename
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
      this._monaco.setValue(tpl.code);
      this._clearResults();
    }
  }


  // -----------------------------------------------------------
  //  Run analysis
  // -----------------------------------------------------------
  _runAnalysis() {
    const code = this._monaco.getValue().trim();
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
      this._showError(`Analysis failed: ${result.error || 'Unknown error'}`);
      return;
    }

    const { confidence } = result;
    const confPercent = confidence?.percent || 0;
    const confLevel   = confidence?.level   || 'unknown';
    const confColor   = confPercent >= 80 ? '#4fc97e'
                      : confPercent >= 50 ? '#ffc44d'
                      : '#ff6b6b';

    let html = '';

    // Summary section
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
          <div class="code-panel__confidence-fill"
               style="width:${confPercent}%;background:${confColor}"></div>
        </div>
      </div>
    `;

    // Errors section
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
            ${err.sourceLine
              ? `<div class="code-panel__error-source"><code>${this._escapeHtml(err.sourceLine)}</code></div>`
              : ''}
            ${err.fix ? `<div class="code-panel__error-fix">💡 ${err.fix}</div>` : ''}
          </div>
        `;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // Parse warnings
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

    // Click error → focus camera on node
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
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  //  Events
  // -----------------------------------------------------------
  _bindEvents() {
    // Re-layout Monaco when the window resizes
    window.addEventListener('resize', () => {
      this._monaco.layout();
    });
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    this._monaco.dispose();
    const container = document.getElementById(PANEL_ID);
    if (container) container.innerHTML = '';
  }
}


export default CodePanel;