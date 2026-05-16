// =============================================================
//  SeeDS — AnimationLoop.js
//  Owns the requestAnimationFrame loop. Every module that
//  needs per-frame updates registers a tick function here.
//  Nobody calls rAF themselves — it all flows through this.
//
//  Usage:
//    loop.register('myModule', (delta, elapsed) => { ... });
//    loop.unregister('myModule');
//    loop.start();
//    loop.stop();
// =============================================================

class AnimationLoop {
  constructor(sceneManager) {
    this._sceneManager = sceneManager;
    this._ticks        = new Map();   // name → fn(delta, elapsed)
    this._running      = false;
    this._rafId        = null;
    this._lastTime     = 0;
    this._elapsed      = 0;
  }


  // -----------------------------------------------------------
  //  Register a per-frame callback
  //  name   — unique string key, used to unregister later
  //  fn     — called every frame with (delta, elapsed)
  //           delta   = seconds since last frame (e.g. 0.016)
  //           elapsed = total seconds since loop started
  // -----------------------------------------------------------
  register(name, fn) {
    if (typeof fn !== 'function') {
      console.warn(`[AnimationLoop] register("${name}") — fn must be a function`);
      return;
    }
    if (this._ticks.has(name)) {
      console.warn(`[AnimationLoop] "${name}" is already registered — overwriting`);
    }
    this._ticks.set(name, fn);
  }


  // -----------------------------------------------------------
  //  Unregister a per-frame callback
  // -----------------------------------------------------------
  unregister(name) {
    this._ticks.delete(name);
  }


  // -----------------------------------------------------------
  //  Start the loop
  // -----------------------------------------------------------
  start() {
    if (this._running) return;
    this._running  = true;
    this._lastTime = performance.now();
    this._tick(this._lastTime);
  }


  // -----------------------------------------------------------
  //  Stop the loop entirely (not the same as pausing playback)
  //  Used only for cleanup / unmounting
  // -----------------------------------------------------------
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }


  // -----------------------------------------------------------
  //  Core tick — called by rAF every frame
  // -----------------------------------------------------------
  _tick(now) {
    if (!this._running) return;

    this._rafId = requestAnimationFrame((t) => this._tick(t));

    // Delta time in seconds, clamped to avoid huge jumps
    // (e.g. when tab is backgrounded and then focused again)
    const raw   = (now - this._lastTime) / 1000;
    const delta = Math.min(raw, 0.1);   // max 100ms jump
    this._elapsed  += delta;
    this._lastTime  = now;

    // Run all registered tick functions
    for (const [name, fn] of this._ticks) {
      try {
        fn(delta, this._elapsed);
      } catch (err) {
        console.error(`[AnimationLoop] Error in tick "${name}":`, err);
      }
    }

    // Scene update (orbit controls damping) and render
    this._sceneManager.update();
    this._sceneManager.render();
  }


  // -----------------------------------------------------------
  //  Getters
  // -----------------------------------------------------------
  get elapsed() { return this._elapsed; }
  get running() { return this._running; }
}


export default AnimationLoop;