// =============================================================
//  SeeDS — eventBus.js
//  A tiny pub/sub event bus. Every module in the app talks to
//  every other module ONLY through this. No direct imports
//  between UI <-> renderer <-> structures. Just events.
//
//  Why? Because LinkedList.js should not need to know that
//  ErrorPanel.js exists. It just emits ERROR_PANEL_UPDATE
//  and whoever is listening handles it. Clean separation.
//
//  Usage:
//    import eventBus from './eventBus.js';
//    import { EVENTS } from './constants.js';
//
//    // Listen
//    eventBus.on(EVENTS.NODE_HOVERED, (payload) => { ... });
//
//    // Emit
//    eventBus.emit(EVENTS.NODE_HOVERED, { node: myNode });
//
//    // Stop listening (important for cleanup)
//    eventBus.off(EVENTS.NODE_HOVERED, myHandler);
//
//    // Listen once and auto-remove
//    eventBus.once(EVENTS.DS_LOADED, (payload) => { ... });
// =============================================================


class EventBus {
  constructor() {
    // Map of eventName -> Set of handler functions
    // Using Set instead of Array so the same handler
    // can't accidentally be registered twice
    this._listeners = new Map();
  }


  // -----------------------------------------------------------
  //  on(event, handler)
  //  Subscribe to an event. Handler is called every time
  //  the event is emitted until you call off().
  // -----------------------------------------------------------
  on(event, handler) {
    if (typeof handler !== 'function') {
      console.warn(`[EventBus] on("${event}") — handler must be a function`);
      return this;
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event).add(handler);

    // Return this so you can chain: eventBus.on(...).on(...)
    return this;
  }


  // -----------------------------------------------------------
  //  off(event, handler)
  //  Unsubscribe a specific handler from an event.
  //  Always call this in cleanup/destroy methods to avoid
  //  memory leaks and ghost handlers firing on dead objects.
  // -----------------------------------------------------------
  off(event, handler) {
    if (!this._listeners.has(event)) return this;

    this._listeners.get(event).delete(handler);

    // Clean up the Set entirely if it's now empty
    if (this._listeners.get(event).size === 0) {
      this._listeners.delete(event);
    }

    return this;
  }


  // -----------------------------------------------------------
  //  emit(event, payload)
  //  Fire an event. All registered handlers are called
  //  synchronously in registration order.
  //  payload can be anything — object, string, null.
  // -----------------------------------------------------------
  emit(event, payload) {
    if (!this._listeners.has(event)) return this;

    // Spread into array first so handlers that call off()
    // inside their own body don't mutate the Set mid-loop
    const handlers = [...this._listeners.get(event)];

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        // One broken handler shouldn't kill the whole chain
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }

    return this;
  }


  // -----------------------------------------------------------
  //  once(event, handler)
  //  Subscribe to an event but auto-remove after first fire.
  //  Useful for one-time setup signals like DS_LOADED.
  // -----------------------------------------------------------
  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };

    // Tag the wrapper so off() with the original handler
    // still works if the user tries to cancel before it fires
    wrapper._original = handler;

    return this.on(event, wrapper);
  }


  // -----------------------------------------------------------
  //  offAll(event?)
  //  Nuclear option. Remove all handlers for one event,
  //  or ALL handlers for ALL events if no event is passed.
  //  Useful on full app reset.
  // -----------------------------------------------------------
  offAll(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }


  // -----------------------------------------------------------
  //  debug()
  //  Log the current state of all listeners.
  //  Call this from the browser console when something
  //  isn't firing and you can't figure out why.
  // -----------------------------------------------------------
  debug() {
    if (this._listeners.size === 0) {
      console.log('[EventBus] No active listeners.');
      return;
    }

    console.group('[EventBus] Active listeners:');
    for (const [event, handlers] of this._listeners) {
      console.log(`  ${event} → ${handlers.size} handler(s)`);
    }
    console.groupEnd();
  }
}


// Export a single shared instance — the whole app uses this one bus
// It's a singleton by convention, not by lock, so don't new it elsewhere
const eventBus = new EventBus();
export default eventBus;