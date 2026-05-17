// =============================================================
//  SeeDS — InfoTooltip.js
//  A floating HTML tooltip that appears when the user hovers
//  over a node in the 3D scene.
//  Shows: value, memory address, connected node ids, error type.
//
//  Raycasting happens in app.js — this just reacts to events.
//  Listens for: EVENTS.TOOLTIP_SHOW, EVENTS.TOOLTIP_HIDE
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS } from '../core/constants.js';


class InfoTooltip {
  constructor() {
    this._el      = null;
    this._visible = false;
    this._build();
    this._bindEvents();
  }


  // -----------------------------------------------------------
  //  Build the tooltip DOM element (appended to body)
  // -----------------------------------------------------------
  _build() {
    this._el = document.createElement('div');
    this._el.className = 'info-tooltip';
    this._el.style.display = 'none';
    document.body.appendChild(this._el);
  }


  // -----------------------------------------------------------
  //  Listen for show/hide events from app.js raycaster
  // -----------------------------------------------------------
  _bindEvents() {
    eventBus.on(EVENTS.TOOLTIP_SHOW, ({ x, y, node }) => {
      this._show(x, y, node);
    });

    eventBus.on(EVENTS.TOOLTIP_HIDE, () => {
      this._hide();
    });
  }


  // -----------------------------------------------------------
  //  Render tooltip content from node data
  // -----------------------------------------------------------
  _show(x, y, nodeData) {
    if (!nodeData) { this._hide(); return; }

    const rows = [];

    // Value
    rows.push(this._row(
      'Value',
      nodeData.value !== null && nodeData.value !== undefined
        ? String(nodeData.value)
        : 'NULL'
    ));

    // Address
    if (nodeData.address) {
      rows.push(this._row('Address', nodeData.address));
    }

    // Next pointer (linked list)
    if (nodeData.next !== undefined) {
      rows.push(this._row('next →', nodeData.next ?? 'NULL'));
    }

    // Left / right (tree)
    if (nodeData.left !== undefined) {
      rows.push(this._row('left →',  nodeData.left  ?? 'NULL'));
    }
    if (nodeData.right !== undefined) {
      rows.push(this._row('right →', nodeData.right ?? 'NULL'));
    }

    // Error badge
    if (nodeData.error) {
      rows.push(`<div class="info-tooltip__error">⚠ ${nodeData.error.replace(/_/g, ' ')}</div>`);
    }

    this._el.innerHTML = rows.join('');

    // Position tooltip near cursor, keep inside viewport
    const tw = 200;
    const th = this._el.offsetHeight || 120;
    let   tx = x + 16;
    let   ty = y + 12;

    if (tx + tw > window.innerWidth  - 12) tx = x - tw - 12;
    if (ty + th > window.innerHeight - 12) ty = y - th - 12;

    this._el.style.left    = `${tx}px`;
    this._el.style.top     = `${ty}px`;
    this._el.style.display = 'block';
    this._visible = true;
  }

  _hide() {
    this._el.style.display = 'none';
    this._visible = false;
  }

  _row(label, value) {
    return `
      <div class="info-tooltip__row">
        <span class="info-tooltip__label">${label}</span>
        <span class="info-tooltip__value">${value}</span>
      </div>`;
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    eventBus.off(EVENTS.TOOLTIP_SHOW, () => {});
    eventBus.off(EVENTS.TOOLTIP_HIDE, () => {});
    document.body.removeChild(this._el);
    this._el = null;
  }
}


export default InfoTooltip;