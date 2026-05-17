// =============================================================
//  SeeDS — PlaybackController.js
//  Manages the step-by-step animation of operations loaded
//  from a JSON data file. Supports play, pause, step, reset,
//  and variable speed. Calls the structure's execute(op)
//  on each step automatically when playing.
//
//  The controller knows nothing about Three.js — it just
//  owns a queue of operations and a timer.
// =============================================================

import eventBus from '../core/eventBus.js';
import { EVENTS, PLAYBACK_STATES, PLAYBACK_SPEEDS } from '../core/constants.js';


class PlaybackController {
  constructor() {
    this._ops       = [];       // flat array of operation objects
    this._index     = 0;        // current position in _ops
    this._state     = PLAYBACK_STATES.IDLE;
    this._speed     = PLAYBACK_SPEEDS.DEFAULT;
    this._executor  = null;     // fn(op) — called by app.js via load()
    this._timer     = 0;        // accumulated seconds since last step
    this._interval  = 1.0;      // seconds between auto-steps (derived from speed)
  }


  // -----------------------------------------------------------
  //  Load a dataset and wire the executor callback
  //  Called by App every time a new DS is selected or reset
  // -----------------------------------------------------------
  load(data, executor) {
    this._ops      = data.operations ?? [];
    this._executor = executor;
    this._index    = 0;
    this._timer    = 0;
    this._setState(PLAYBACK_STATES.IDLE);
  }


  // -----------------------------------------------------------
  //  Controls — called by App in response to eventBus events
  // -----------------------------------------------------------
  play() {
    if (this._state === PLAYBACK_STATES.DONE) return;
    if (!this._ops.length) return;
    this._setState(PLAYBACK_STATES.PLAYING);
  }

  pause() {
    if (this._state !== PLAYBACK_STATES.PLAYING) return;
    this._setState(PLAYBACK_STATES.PAUSED);
  }

  step() {
    if (this._state === PLAYBACK_STATES.DONE) return;
    this._setState(PLAYBACK_STATES.PAUSED);
    this._executeNext();
  }

  reset() {
    this._index = 0;
    this._timer = 0;
    this._setState(PLAYBACK_STATES.IDLE);
  }

  setSpeed(speed) {
    this._speed    = speed;
    this._interval = 0.9 / speed;
  }


  // -----------------------------------------------------------
  //  Per-frame update — called every frame by App._tick()
  // -----------------------------------------------------------
  update(delta) {
    if (this._state !== PLAYBACK_STATES.PLAYING) return;
    if (this._index >= this._ops.length) {
      this._setState(PLAYBACK_STATES.DONE);
      return;
    }

    this._timer += delta;

    if (this._timer >= this._interval) {
      this._timer = 0;
      this._executeNext();
    }
  }


  // -----------------------------------------------------------
  //  Execute the current op and advance the index
  // -----------------------------------------------------------
  _executeNext() {
    if (this._index >= this._ops.length) {
      this._setState(PLAYBACK_STATES.DONE);
      return;
    }

    const op = this._ops[this._index];
    this._index++;

    if (typeof this._executor === 'function') {
      try {
        this._executor(op);
      } catch (err) {
        console.error('[PlaybackController] executor threw on op:', op, err);
      }
    }

    if (this._index >= this._ops.length) {
      this._setState(PLAYBACK_STATES.DONE);
    }
  }


  // -----------------------------------------------------------
  //  State management
  // -----------------------------------------------------------
  _setState(state) {
    this._state = state;
    eventBus.emit(EVENTS.PLAYBACK_STATE, { state });
  }


  // -----------------------------------------------------------
  //  Getters
  // -----------------------------------------------------------
  get state()    { return this._state; }
  get index()    { return this._index; }
  get total()    { return this._ops.length; }
  get progress() { return this._ops.length ? this._index / this._ops.length : 0; }
  get isDone()   { return this._state === PLAYBACK_STATES.DONE; }
}


export default PlaybackController;