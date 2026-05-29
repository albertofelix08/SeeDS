// =============================================================
//  SeeDS — ErrorPanel.js
//  A collapsible right-side panel that lists all detected
//  errors in the current data structure.
//  Clicking an error highlights the relevant node in the scene.
//
//  Listens for: EVENTS.ERROR_PANEL_UPDATE
//  Emits:       EVENTS.ERROR_SELECTED
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS } from '../core/constants.js';


// Friendly names and icons for each error type
const ERROR_META = {
  dangling_pointer: { icon: '⤳',  label: 'Dangling Pointer',  color: '#ff6b6b' },
  cycle:            { icon: '↺',  label: 'Cycle Detected',    color: '#ff9f43' },
  memory_leak:      { icon: '⛁',  label: 'Memory Leak',       color: '#feca57' },
  missing_null:     { icon: '∅',  label: 'Missing NULL',      color: '#ff6b6b' },
  bst_violation:    { icon: '⚖',  label: 'BST Violation',     color: '#ff6b6b' },
  null_dereference: { icon: '✕',  label: 'NULL Dereference',  color: '#ff6b6b' },
  double_free:      { icon: '⊗',  label: 'Double Free',       color: '#ee5a24' },
  out_of_bounds:    { icon: '⤢',  label: 'Out of Bounds',     color: '#ff6b6b' },
  buffer_overflow:  { icon: '▶▶', label: 'Buffer Overflow',   color: '#ee5a24' },
};

const DEFAULT_META = { icon: '⚠', label: 'Error', color: '#ff6b6b' };


class ErrorPanel {
  constructor(containerEl) {
    this._errors    = [];
    this._items     = [];
    this._collapsed = false;

    // If no container passed, create one (app.js calls new ErrorPanel() without args)
    if (containerEl) {
      this._container = containerEl;
    } else {
      this._container = document.getElementById('error-panel');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.id = 'error-panel';
        document.body.appendChild(this._container);
      }
    }

    this._build();
    this._bindEvents();
  }


  // -----------------------------------------------------------
  //  Build the panel shell
  // -----------------------------------------------------------
  _build() {
    this._container.innerHTML = '';
    this._container.className = 'error-panel';

    // Header row
    const header = document.createElement('div');
    header.className = 'error-panel__header';

    this._titleEl = document.createElement('span');
    this._titleEl.className   = 'error-panel__title';
    this._titleEl.textContent = 'Errors (0)';

    const collapseBtn = document.createElement('button');
    collapseBtn.className   = 'error-panel__collapse';
    collapseBtn.textContent = '▾';
    collapseBtn.title       = 'Toggle error panel';
    collapseBtn.addEventListener('click', () => this._toggleCollapse(collapseBtn));

    header.appendChild(this._titleEl);
    header.appendChild(collapseBtn);
    this._container.appendChild(header);

    // Body — scrollable list of errors
    this._body = document.createElement('div');
    this._body.className = 'error-panel__body';
    this._container.appendChild(this._body);

    // Empty state
    this._emptyEl = document.createElement('div');
    this._emptyEl.className   = 'error-panel__empty';
    this._emptyEl.textContent = 'No errors detected ✓';
    this._body.appendChild(this._emptyEl);
  }


  // -----------------------------------------------------------
  //  React to new data being loaded
  // -----------------------------------------------------------
  _bindEvents() {
    eventBus.on(EVENTS.ERROR_PANEL_UPDATE, ({ errors }) => {
      this._setErrors(errors ?? []);
    });
  }


  // -----------------------------------------------------------
  //  Populate panel with errors array
  // -----------------------------------------------------------
  _setErrors(errors) {
    this._errors = errors;
    this._body.innerHTML = '';
    this._items = [];

    // Update title
    this._titleEl.textContent = `Errors (${errors.length})`;

    if (errors.length === 0) {
      this._body.appendChild(this._emptyEl);
      this._container.classList.remove('error-panel--has-errors');
      return;
    }

    this._container.classList.add('error-panel--has-errors');

    for (const err of errors) {
      const meta = ERROR_META[err.type] ?? DEFAULT_META;
      const item = document.createElement('div');
      item.className = 'error-panel__item';
      item.style.setProperty('--err-color', meta.color);

      item.innerHTML = `
        <div class="error-panel__item-header">
          <span class="error-panel__item-icon">${meta.icon}</span>
          <span class="error-panel__item-label">${meta.label}</span>
          ${err.nodeId ? `<span class="error-panel__item-node">${err.nodeId}</span>` : ''}
        </div>
        <div class="error-panel__item-msg">${err.message}</div>
        ${err.line ? `<div class="error-panel__item-line">Line ${err.line}</div>` : ''}
      `;

      item.addEventListener('click', () => {
        // Deselect all
        for (const i of this._items) i.classList.remove('error-panel__item--selected');
        item.classList.add('error-panel__item--selected');

        // Tell the scene to highlight this error's node
        eventBus.emit(EVENTS.ERROR_SELECTED, { error: err });
      });

      this._body.appendChild(item);
      this._items.push(item);
    }
  }


  // -----------------------------------------------------------
  //  Collapse / expand
  // -----------------------------------------------------------
  _toggleCollapse(btn) {
    this._collapsed = !this._collapsed;
    this._body.style.display  = this._collapsed ? 'none' : '';
    btn.textContent            = this._collapsed ? '▸' : '▾';
    this._container.classList.toggle('error-panel--collapsed', this._collapsed);
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    eventBus.off(EVENTS.ERROR_PANEL_UPDATE, () => {});
    this._container.innerHTML = '';
  }
}


export default ErrorPanel;