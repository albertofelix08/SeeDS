// =============================================================
//  SeeDS — PlaybackBar.js
//  Bottom bar playback controls UI.
//  Buttons emit events → PlaybackController reacts.
//  PlaybackController emits state events → this updates UI.
//
//  Controls:
//    ⏮ Reset   ⏭ Step   ▶/⏸ Play/Pause
//    Speed: 0.5x  1x  2x  5x
//    Progress bar
//    Step counter: "3 / 7"
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS, PLAYBACK_STATES, PLAYBACK_SPEEDS } from '../core/constants.js';


const SPEEDS = [
  { label: '0.5×', value: PLAYBACK_SPEEDS.SLOW    },
  { label: '1×',   value: PLAYBACK_SPEEDS.NORMAL  },
  { label: '2×',   value: PLAYBACK_SPEEDS.FAST    },
  { label: '5×',   value: PLAYBACK_SPEEDS.FASTEST },
];


class PlaybackBar {
  constructor(containerEl, playbackController) {
    this._container  = containerEl;
    this._controller = playbackController;
    this._state      = PLAYBACK_STATES.IDLE;

    this._playBtn    = null;
    this._stepBtn    = null;
    this._resetBtn   = null;
    this._progress   = null;
    this._counter    = null;
    this._speedBtns  = new Map();

    this._build();
    this._bindEvents();
  }


  // -----------------------------------------------------------
  //  Build DOM
  // -----------------------------------------------------------
  _build() {
    this._container.innerHTML = '';
    this._container.className = 'playback-bar';

    // Reset button
    this._resetBtn = this._makeBtn('⏮', 'Reset', () => {
      eventBus.emit(EVENTS.PLAYBACK_RESET);
    });

    // Step button
    this._stepBtn = this._makeBtn('⏭', 'Step forward one operation', () => {
      eventBus.emit(EVENTS.PLAYBACK_STEP);
    });

    // Play/Pause button
    this._playBtn = this._makeBtn('▶', 'Play', () => {
      if (this._state === PLAYBACK_STATES.PLAYING) {
        eventBus.emit(EVENTS.PLAYBACK_PAUSE);
      } else {
        eventBus.emit(EVENTS.PLAYBACK_PLAY);
      }
    });
    this._playBtn.classList.add('playback-bar__play');

    // Group controls together
    const controls = document.createElement('div');
    controls.className = 'playback-bar__controls';
    controls.appendChild(this._resetBtn);
    controls.appendChild(this._stepBtn);
    controls.appendChild(this._playBtn);
    this._container.appendChild(controls);

    // Progress area
    const progressWrap = document.createElement('div');
    progressWrap.className = 'playback-bar__progress-wrap';

    this._counter = document.createElement('span');
    this._counter.className   = 'playback-bar__counter';
    this._counter.textContent = '— / —';

    this._progress = document.createElement('div');
    this._progress.className = 'playback-bar__progress';
    const fill = document.createElement('div');
    fill.className = 'playback-bar__fill';
    this._progressFill = fill;
    this._progress.appendChild(fill);

    progressWrap.appendChild(this._counter);
    progressWrap.appendChild(this._progress);
    this._container.appendChild(progressWrap);

    // Speed buttons
    const speedGroup = document.createElement('div');
    speedGroup.className = 'playback-bar__speeds';

    const speedLabel = document.createElement('span');
    speedLabel.className   = 'playback-bar__speed-label';
    speedLabel.textContent = 'Speed';
    speedGroup.appendChild(speedLabel);

    for (const sp of SPEEDS) {
      const btn = document.createElement('button');
      btn.className   = 'playback-bar__speed-btn';
      btn.textContent = sp.label;
      if (sp.value === PLAYBACK_SPEEDS.NORMAL) btn.classList.add('playback-bar__speed-btn--active');

      btn.addEventListener('click', () => {
        eventBus.emit(EVENTS.PLAYBACK_SPEED, { speed: sp.value });
        for (const [, b] of this._speedBtns) b.classList.remove('playback-bar__speed-btn--active');
        btn.classList.add('playback-bar__speed-btn--active');
      });

      speedGroup.appendChild(btn);
      this._speedBtns.set(sp.value, btn);
    }

    this._container.appendChild(speedGroup);

    // Initial disabled state
    this._setDisabled(true);
  }


  // -----------------------------------------------------------
  //  React to playback state changes from the controller
  // -----------------------------------------------------------
  _bindEvents() {
    eventBus.on(EVENTS.PLAYBACK_STATE, ({ state }) => {
      this._state = state;
      this._syncUI();
    });

    // When a new DS is loaded, enable controls
    eventBus.on(EVENTS.DS_LOADED, () => {
      this._setDisabled(false);
      this._updateCounter(0, 0);
      this._updateProgress(0);
    });
  }


  // -----------------------------------------------------------
  //  Sync button appearances to current state
  // -----------------------------------------------------------
  _syncUI() {
    switch (this._state) {
      case PLAYBACK_STATES.IDLE:
        this._playBtn.textContent = '▶';
        this._playBtn.title = 'Play';
        this._setDisabled(false);
        break;

      case PLAYBACK_STATES.PLAYING:
        this._playBtn.textContent = '⏸';
        this._playBtn.title = 'Pause';
        this._stepBtn.disabled = true;
        break;

      case PLAYBACK_STATES.PAUSED:
      case PLAYBACK_STATES.STEPPED:
        this._playBtn.textContent = '▶';
        this._playBtn.title = 'Resume';
        this._stepBtn.disabled = false;
        break;

      case PLAYBACK_STATES.DONE:
        this._playBtn.textContent = '▶';
        this._playBtn.title = 'Done';
        this._playBtn.disabled = true;
        this._stepBtn.disabled = true;
        break;
    }

    // Update progress and counter from controller
    const ctrl = this._controller;
    this._updateCounter(ctrl.stepIndex, ctrl.totalSteps);
    this._updateProgress(ctrl.progress);
  }


  // -----------------------------------------------------------
  //  Update progress fill width
  // -----------------------------------------------------------
  _updateProgress(ratio) {
    this._progressFill.style.width = `${Math.round(ratio * 100)}%`;
  }

  _updateCounter(current, total) {
    this._counter.textContent = total > 0 ? `${current} / ${total}` : '— / —';
  }


  // -----------------------------------------------------------
  //  Enable / disable all controls
  // -----------------------------------------------------------
  _setDisabled(disabled) {
    this._playBtn.disabled  = disabled;
    this._stepBtn.disabled  = disabled;
    this._resetBtn.disabled = disabled;
  }


  // -----------------------------------------------------------
  //  Helper — make a button
  // -----------------------------------------------------------
  _makeBtn(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.className   = 'playback-bar__btn';
    btn.textContent = icon;
    btn.title       = title;
    btn.addEventListener('click', onClick);
    this._container.appendChild(btn);
    return btn;
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    eventBus.off(EVENTS.PLAYBACK_STATE, this._syncUI);
    eventBus.off(EVENTS.DS_LOADED,      () => {});
    this._container.innerHTML = '';
  }
}


export default PlaybackBar;