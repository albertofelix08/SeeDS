// =============================================================
//  SeeDS — StatusBar.js
//  A thin bar below the toolbar showing current DS type,
//  operations count, error count, FPS, and a live indicator.
//  Listens for: EVENTS.DS_LOADED, EVENTS.PLAYBACK_STATE
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS } from '../core/constants.js';

class StatusBar {
  constructor() {
    this._fps = 0;
    this._frameCount = 0;
    this._lastFpsTime = performance.now();
    this._dsType = '—';
    this._opCount = 0;
    this._errorCount = 0;

    this._build();
    this._bindEvents();
  }

  _build() {
    let container = document.getElementById('status-bar');
    if (!container) {
      container = document.createElement('div');
      container.id = 'status-bar';
      document.body.appendChild(container);
    }
    container.className = 'status-bar';
    container.innerHTML = '';

    // Left: DS type badge
    this._dsEl = document.createElement('span');
    this._dsEl.className = 'status-bar__item';
    this._dsEl.innerHTML = `Type: <span class="status-bar__value status-bar__badge">—</span>`;
    container.appendChild(this._dsEl);

    // Operations count
    this._opsEl = document.createElement('span');
    this._opsEl.className = 'status-bar__item';
    this._opsEl.innerHTML = `Ops: <span class="status-bar__value">0</span>`;
    container.appendChild(this._opsEl);

    // Errors count
    this._errEl = document.createElement('span');
    this._errEl.className = 'status-bar__item';
    this._errEl.innerHTML = `Errors: <span class="status-bar__value">0</span>`;
    container.appendChild(this._errEl);

    // Right: FPS + live indicator
    const right = document.createElement('div');
    right.className = 'status-bar__right';

    this._fpsEl = document.createElement('span');
    this._fpsEl.className = 'status-bar__fps';
    this._fpsEl.textContent = '— FPS';
    right.appendChild(this._fpsEl);

    const indicator = document.createElement('span');
    indicator.className = 'status-bar__indicator';
    indicator.title = 'Active';
    right.appendChild(indicator);

    container.appendChild(right);
  }

  _bindEvents() {
    eventBus.on(EVENTS.DS_LOADED, ({ type, data }) => {
      this._dsType = type || '—';
      this._opCount = data?.operations?.length || 0;
      this._errorCount = data?.errors?.length || 0;
      this._sync();
    });

    eventBus.on(EVENTS.PLAYBACK_STATE, ({ state, index, total }) => {
      if (index !== undefined) {
        this._opCount = total || this._opCount;
      }
    });
  }

  _sync() {
    // DS type badge
    const badgeClass = `status-bar__badge status-bar__badge--${this._dsType}`;
    this._dsEl.innerHTML = `Type: <span class="status-bar__value ${badgeClass}">${this._dsType.replace(/_/g, ' ')}</span>`;
    this._opsEl.innerHTML = `Ops: <span class="status-bar__value">${this._opCount}</span>`;
    this._errEl.innerHTML = `Errors: <span class="status-bar__value">${this._errorCount}</span>`;
  }

  /**
   * Call every frame from the app's tick loop.
   */
  tick() {
    this._frameCount++;
    const now = performance.now();
    const dt = now - this._lastFpsTime;

    if (dt >= 500) {
      this._fps = Math.round(this._frameCount / (dt / 1000));
      this._frameCount = 0;
      this._lastFpsTime = now;
      this._fpsEl.textContent = `${this._fps} FPS`;
    }
  }

  dispose() {
    const container = document.getElementById('status-bar');
    if (container) container.innerHTML = '';
  }
}

export default StatusBar;
