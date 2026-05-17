// =============================================================
//  SeeDS — Toolbar.js
//  Top bar UI. Handles:
//    - Data structure type selector
//    - Demo scenario buttons (ok, cycle, dangling, leak, etc.)
//    - Camera reset button
//  Communicates exclusively via eventBus — no direct imports
//  of renderer or structure files.
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS, DS_TYPES, APP } from '../core/constants.js';


// Maps each DS type to its available demo files
const DEMOS = {
  [DS_TYPES.LINKED_LIST]: [
    { label: '✓ Normal',          file: 'linked-list-ok.json'       },
    { label: '↺ Cycle',           file: 'linked-list-cycle.json'    },
    { label: '⚠ Dangling',        file: 'linked-list-dangling.json' },
    { label: '⛁ Memory Leak',    file: 'linked-list-leak.json'     },
  ],
  [DS_TYPES.BINARY_TREE]: [
    { label: '✓ BST Search',      file: 'binary-tree-ok.json'       },
  ],
  [DS_TYPES.ARRAY]: [
    { label: '✓ Linear Search',   file: 'array-search.json'         },
  ],
  [DS_TYPES.SORT_RACE]: [
    { label: '▶ Start Race',      file: 'sort-race.json'            },
  ],
};

const DS_LABELS = {
  [DS_TYPES.LINKED_LIST]: 'Linked List',
  [DS_TYPES.BINARY_TREE]: 'Binary Tree',
  [DS_TYPES.ARRAY]:       'Array',
  [DS_TYPES.SORT_RACE]:   'Sort Race',
};


class Toolbar {
  constructor(containerEl) {
    this._container  = containerEl;
    this._activeDS   = APP.DEFAULT_DS;
    this._activeDemo = null;

    this._dsButtons   = new Map();   // dsType → button el
    this._demoButtons = [];          // current demo button els

    this._build();
    this._bindEvents();
  }


  // -----------------------------------------------------------
  //  Build DOM
  // -----------------------------------------------------------
  _build() {
    this._container.innerHTML = '';
    this._container.className = 'toolbar';

    // Left group — branding
    const brand = document.createElement('div');
    brand.className   = 'toolbar__brand';
    brand.textContent = 'SeeDS';
    this._container.appendChild(brand);

    // Center group — DS type tabs
    const tabs = document.createElement('div');
    tabs.className = 'toolbar__tabs';

    for (const [type, label] of Object.entries(DS_LABELS)) {
      const btn = document.createElement('button');
      btn.className   = 'toolbar__tab';
      btn.textContent = label;
      btn.dataset.ds  = type;
      if (type === this._activeDS) btn.classList.add('toolbar__tab--active');

      btn.addEventListener('click', () => this._selectDS(type));
      tabs.appendChild(btn);
      this._dsButtons.set(type, btn);
    }

    this._container.appendChild(tabs);

    // Demo buttons group
    this._demoGroup = document.createElement('div');
    this._demoGroup.className = 'toolbar__demos';
    this._container.appendChild(this._demoGroup);

    // Right group — camera reset
    const right = document.createElement('div');
    right.className = 'toolbar__right';

    const resetBtn = document.createElement('button');
    resetBtn.className   = 'toolbar__btn toolbar__btn--icon';
    resetBtn.textContent = '⌖ Reset Camera';
    resetBtn.title       = 'Reset camera to default position';
    resetBtn.addEventListener('click', () => {
      eventBus.emit(EVENTS.PLAYBACK_RESET);
      // We emit a custom camera reset via a dedicated event
      eventBus.emit('camera:reset');
    });
    right.appendChild(resetBtn);
    this._container.appendChild(right);

    // Build initial demo buttons
    this._buildDemoButtons(this._activeDS);
  }


  // -----------------------------------------------------------
  //  Rebuild demo buttons when DS type changes
  // -----------------------------------------------------------
  _buildDemoButtons(dsType) {
    this._demoGroup.innerHTML = '';
    this._demoButtons = [];

    const demos = DEMOS[dsType] ?? [];
    for (const demo of demos) {
      const btn = document.createElement('button');
      btn.className   = 'toolbar__btn toolbar__btn--demo';
      btn.textContent = demo.label;
      btn.dataset.file = demo.file;

      btn.addEventListener('click', () => this._loadDemo(dsType, demo.file, btn));
      this._demoGroup.appendChild(btn);
      this._demoButtons.push(btn);
    }

    // Auto-load first demo of new DS type
    if (demos.length > 0) {
      this._loadDemo(dsType, demos[0].file, this._demoButtons[0]);
    }
  }


  // -----------------------------------------------------------
  //  Select a DS type tab
  // -----------------------------------------------------------
  _selectDS(type) {
    if (type === this._activeDS) return;

    // Update tab styles
    this._dsButtons.get(this._activeDS)?.classList.remove('toolbar__tab--active');
    this._dsButtons.get(type)?.classList.add('toolbar__tab--active');
    this._activeDS = type;

    this._buildDemoButtons(type);
  }


  // -----------------------------------------------------------
  //  Load a demo JSON file
  // -----------------------------------------------------------
  async _loadDemo(dsType, file, btnEl) {
    // Update active demo button style
    for (const b of this._demoButtons) b.classList.remove('toolbar__btn--active');
    btnEl?.classList.add('toolbar__btn--active');
    this._activeDemo = file;

    try {
      const res  = await fetch(`${APP.DATA_PATH}${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      eventBus.emit(EVENTS.DS_LOADED, { type: dsType, data });
    } catch (err) {
      console.error(`[Toolbar] Failed to load demo "${file}":`, err);
    }
  }


  // -----------------------------------------------------------
  //  React to external events
  // -----------------------------------------------------------
  _bindEvents() {
    // If playback finishes or resets, we don't need to do anything in toolbar
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    this._container.innerHTML = '';
    this._dsButtons.clear();
    this._demoButtons = [];
  }
}


export default Toolbar;