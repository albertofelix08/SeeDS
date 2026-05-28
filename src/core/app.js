// =============================================================
//  SeeDS — app.js
<<<<<<< HEAD
//  The top-level orchestrator. Instantiates every module,
//  wires them together, and handles the two things that need
//  to cross module boundaries:
//    1. DS switching (load JSON → build structure → reset playback)
//    2. Raycasting (mouse move → tooltip, click → focus camera)
//
//  Import order matters here — constants and eventBus first,
//  then renderer, then structures, then UI.
=======
//  Main application entry point.
//  Orchestrates: Three.js scene, Monaco Editor, UI components,
//  theme switching, fullscreen mode, keyboard shortcuts.
>>>>>>> e2e4ba9 (updated files)
// =============================================================

import eventBus           from './eventBus.js';
import { EVENTS, DS_TYPES, APP, THEME, VISUAL } from './constants.js';

import SceneManager       from '../renderer/SceneManager.js';
import AnimationLoop      from '../renderer/AnimationLoop.js';
import PlaybackController from '../renderer/PlaybackController.js';

import LinkedList         from '../structures/LinkedList.js';
import BinaryTree         from '../structures/BinaryTree.js';
import ArrayStructure     from '../structures/Array.js';
import SortRace           from '../structures/SortRace.js';
import StackStructure     from '../structures/Stack.js';
import QueueStructure     from '../structures/Queue.js';
import GraphStructure     from '../structures/Graph.js';
import HashTableStructure from '../structures/HashTable.js';
import HeapStructure      from '../structures/Heap.js';
import AVLTreeStructure   from '../structures/AVLTree.js';

import Toolbar            from '../ui/Toolbar.js';
import CodePanel          from '../ui/CodePanel.js';
import PlaybackBar        from '../ui/PlaybackBar.js';
import InfoTooltip        from '../ui/InfoTooltip.js';
import StatusBar          from '../ui/StatusBar.js';
import ErrorPanel         from '../ui/ErrorPanel.js';

import * as THREE         from '../../vendor/three/three.module.js';


function showCrash(step, err) {
  console.error(`[SeeDS] CRASH at: ${step}`, err);
  const overlay = document.getElementById('app-loading');
  if (overlay) {
    overlay.innerHTML = `
      <div style="max-width:600px;text-align:left;padding:32px">
        <h2 style="color:#ff3b3b;font-family:monospace;margin-bottom:16px">💥 Crashed at: <code>${step}</code></h2>
        <pre style="background:#111;border:1px solid #333;padding:16px;border-radius:8px;color:#ff8888;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow:auto">${err?.stack || err}</pre>
        <p style="color:#5b8ff7;font-family:monospace;margin-top:16px;font-size:13px">Also check F12 → Console for full details.</p>
      </div>
    `;
  }
}


class App {
  constructor() {
    // Core
    this._scene      = null;
    this._loop       = null;
    this._controller = null;

    // Active structure instance
    this._activeStructure = null;
    this._activeType      = null;
<<<<<<< HEAD

    // UI
=======
    this._editor     = null;           // Monaco editor instance
    this._theme      = THEME.DARK;
    this._fullscreen = false;
>>>>>>> e2e4ba9 (updated files)
    this._toolbar    = null;
    this._playbar    = null;
    this._codePanel  = null;
    this._statusBar  = null;
    this._errorPanel = null;
<<<<<<< HEAD

    // Raycasting
=======
    this._tooltip    = null;
>>>>>>> e2e4ba9 (updated files)
    this._raycaster  = new THREE.Raycaster();
    this._mouse      = new THREE.Vector2(-9999, -9999);
    this._hoveredNode = null;

    this._init();
  }

<<<<<<< HEAD
=======

  _init() {
    let step = 'getElementById seeds-canvas';
    const canvas = document.getElementById('seeds-canvas');
>>>>>>> e2e4ba9 (updated files)

  // -----------------------------------------------------------
  //  INIT — runs once on page load
  // -----------------------------------------------------------
  _init() {
    // 1. Scene + renderer
    const canvas = document.getElementById('seeds-canvas');
    this._scene  = new SceneManager(canvas);

    // 2. Animation loop
    this._loop = new AnimationLoop(this._scene);

    // 3. Playback controller
    this._controller = new PlaybackController();

    // 4. UI components
    this._toolbar    = new Toolbar(document.getElementById('toolbar'));
    this._playbar    = new PlaybackBar(document.getElementById('playback-bar'), this._controller);
    this._tooltip    = new InfoTooltip();
    this._statusBar  = new StatusBar();
<<<<<<< HEAD
    this._errorPanel = new ErrorPanel(document.getElementById('error-panel'));
=======

    step = 'new ErrorPanel()';
    this._errorPanel = new ErrorPanel();
>>>>>>> e2e4ba9 (updated files)

    // 5. Register per-frame tick
    this._loop.register('app', (delta, elapsed) => this._tick(delta, elapsed));

<<<<<<< HEAD
    // 6. Wire the code analyzer panel
    this._codePanel = new CodePanel();
=======
    step = 'new CodePanel()';
    this._codePanel  = new CodePanel();

    step = '_restoreTheme()';
    this._restoreTheme();
>>>>>>> e2e4ba9 (updated files)

    // 7. Bind all cross-module events
    this._bindEvents();

    // 8. Mouse events for raycasting
    this._bindMouse();

<<<<<<< HEAD
    // 9. Hide loading overlay
=======
    step = '_setupDivider()';
    this._setupDivider();

    step = '_bindKeyboard()';
    this._bindKeyboard();

    step = '_hideLoading()';
>>>>>>> e2e4ba9 (updated files)
    this._hideLoading();

    // 10. Start the loop
    this._loop.start();

    console.log(`%c SeeDS v${APP.VERSION} — Phase ${APP.PHASE} `, 'background:#1a3a6e;color:#7db3ff;padding:4px 8px;border-radius:4px;');
  }


<<<<<<< HEAD
  // -----------------------------------------------------------
  //  Per-frame tick
  // -----------------------------------------------------------
=======
>>>>>>> e2e4ba9 (updated files)
  _tick(delta, elapsed) {
    // Advance playback timer — fires execute(op) when its time
    this._controller.update(delta);

    // Tick the active structure (node animations, error effects)
    if (this._activeStructure) {
      this._activeStructure.tick(delta, elapsed);
    }

    // Raycast for hover tooltips every frame
    this._raycast();

    // Camera focus animation
    this._scene._tickFocus?.();

    // Update FPS counter
    this._statusBar?.tick();
  }


  // -----------------------------------------------------------
<<<<<<< HEAD
  //  Event wiring
=======
  //  Events
>>>>>>> e2e4ba9 (updated files)
  // -----------------------------------------------------------
  _bindEvents() {
    // New DS loaded from toolbar
    eventBus.on(EVENTS.DS_LOADED, ({ type, data }) => {
      this._loadStructure(type, data);
    });

    // Playback controls → controller
    eventBus.on(EVENTS.PLAYBACK_PLAY,  () => this._controller.play());
    eventBus.on(EVENTS.PLAYBACK_PAUSE, () => this._controller.pause());
    eventBus.on(EVENTS.PLAYBACK_STEP,  () => this._controller.step());
    eventBus.on(EVENTS.PLAYBACK_SPEED, ({ speed }) => this._controller.setSpeed(speed));

    eventBus.on(EVENTS.PLAYBACK_RESET, () => {
      this._controller.reset();
      // Rebuild the active structure from scratch
      if (this._activeStructure && this._lastData) {
        this._buildStructure(this._activeType, this._lastData);
      }
    });
<<<<<<< HEAD

    // Camera reset
    eventBus.on('camera:reset', () => {
      this._scene.resetCamera();
    });

    // Error panel click → focus camera on node
=======
    eventBus.on('camera:reset', () => { this._scene.resetCamera(); });
    eventBus.on('theme:set', ({ theme }) => this._setTheme(theme));
    eventBus.on('fullscreen:set', ({ enabled }) => this._setFullscreen(enabled));
>>>>>>> e2e4ba9 (updated files)
    eventBus.on(EVENTS.ERROR_SELECTED, ({ error }) => {
      if (!error.nodeId || !this._activeStructure) return;
      const nodeMesh = this._activeStructure._nodes?.get(error.nodeId);
      if (nodeMesh) {
        this._scene.focusOn(nodeMesh.position.clone(), 6);
      }
    });
  }


<<<<<<< HEAD
  // -----------------------------------------------------------
  //  Load and build a structure from JSON data
  // -----------------------------------------------------------
=======
>>>>>>> e2e4ba9 (updated files)
  _loadStructure(type, data) {
    this._lastData  = data;
    this._activeType = type;

<<<<<<< HEAD
    // Reset playback first
=======
    // Visual loading indicator
    const vizArea = document.getElementById('visualizer-area');
    if (vizArea) {
      vizArea.classList.remove('ds-loading');
      // Force reflow to restart animation
      void vizArea.offsetWidth;
      vizArea.classList.add('ds-loading');
    }

>>>>>>> e2e4ba9 (updated files)
    this._controller.reset();

    // Dispose previous structure
    if (this._activeStructure) {
      this._activeStructure.dispose();
      this._activeStructure = null;
    }

    // Clear scene objects (keeps lights)
    this._scene.clearScene();

    // Build new structure
    this._buildStructure(type, data);
  }


  _buildStructure(type, data) {
    const scene  = this._scene.getScene();
    const camera = this._scene.getCamera();

    // Dispose and recreate (used on reset too)
    if (this._activeStructure) {
      this._activeStructure.dispose();
    }

    switch (type) {
      case DS_TYPES.LINKED_LIST:
        this._activeStructure = new LinkedList(scene, camera);
        break;
      case DS_TYPES.BINARY_TREE:
        this._activeStructure = new BinaryTree(scene, camera);
        break;
      case DS_TYPES.ARRAY:
        this._activeStructure = new ArrayStructure(scene, camera);
        break;
      case DS_TYPES.SORT_RACE:
        this._activeStructure = new SortRace(scene, camera);
        break;

      // Stack & Queue — dedicated renderers
      case DS_TYPES.STACK:
        this._activeStructure = new StackStructure(scene, camera);
        break;
      case DS_TYPES.QUEUE:
      case DS_TYPES.CIRCULAR_QUEUE:
      case DS_TYPES.DEQUEUE:
        this._activeStructure = new QueueStructure(scene, camera);
        break;
      case DS_TYPES.GRAPH:
        this._activeStructure = new GraphStructure(scene, camera);
        break;
      case DS_TYPES.HASH_TABLE:
        this._activeStructure = new HashTableStructure(scene, camera);
        break;
      case DS_TYPES.HEAP:
        this._activeStructure = new HeapStructure(scene, camera);
        break;
      case DS_TYPES.AVL_TREE:
        this._activeStructure = new AVLTreeStructure(scene, camera);
        break;

      // Doubly-linked & circular lists use extended LinkedList
      case DS_TYPES.DOUBLY_LIST:
      case DS_TYPES.CIRCULAR_LIST:
        this._activeStructure = new LinkedList(scene, camera);
        break;

      default:
        console.warn('[App] Unknown DS type:', type);
        return;
    }

    this._activeStructure.build(data);

    // Wire playback: controller calls executor on each step
    this._controller.load(data, (op) => this._activeStructure.execute(op));

    // Reset camera to default so each DS starts with a clean view
    this._scene.resetCamera();

    // Auto-play for SortRace and other structures that set _autoPlay
    if (data._autoPlay && this._controller.total > 0) {
      this._controller.play();
    }
  }


  // -----------------------------------------------------------
<<<<<<< HEAD
  //  Hide loading overlay
=======
  //  Theme
  // -----------------------------------------------------------
  _setTheme(theme) {
    this._theme = theme;
    document.body.classList.toggle('light-theme', theme === THEME.LIGHT);
    localStorage.setItem(THEME.STORAGE_KEY, theme);

    // Update Three.js scene colors
    if (theme === THEME.LIGHT) {
      this._scene.setBackground(THEME.LIGHT_BG, THEME.LIGHT_FOG);
    } else {
      this._scene.setBackground(THEME.DARK_BG, THEME.DARK_FOG);
    }

    // Notify UI components — the eventBus handler in _bindEvents already
    // called _setTheme, so we don't re-emit here to avoid recursive loop.
    // Toolbar/other components receive this event from their own listeners.
  }

  _restoreTheme() {
    const saved = localStorage.getItem(THEME.STORAGE_KEY);
    if (saved === THEME.LIGHT || saved === THEME.DARK) {
      this._setTheme(saved);
    } else {
      // Check system preference
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      this._setTheme(prefersLight ? THEME.LIGHT : THEME.DARK);
    }
    // Notify UI components (Toolbar icon, CodePanel Monaco theme, LabelSprite colors)
    eventBus.emit('theme:set', { theme: this._theme });
  }


  // -----------------------------------------------------------
  //  Fullscreen
  // -----------------------------------------------------------
  _setFullscreen(enabled) {
    this._fullscreen = enabled;
    document.body.classList.toggle('fullscreen-mode', enabled);

    if (enabled) {
      // Add exit button
      const exitBtn = document.createElement('button');
      exitBtn.className = 'fullscreen-exit-btn';
      exitBtn.textContent = '✕ Exit Fullscreen';
      exitBtn.id = 'fullscreen-exit-btn';
      exitBtn.addEventListener('click', () => {
        eventBus.emit('fullscreen:set', { enabled: false });
      });
      document.body.appendChild(exitBtn);
    } else {
      const exitBtn = document.getElementById('fullscreen-exit-btn');
      if (exitBtn) exitBtn.remove();
    }

    // Resize canvas
    window.dispatchEvent(new Event('resize'));

    // Toolbar/other components receive the original 'fullscreen:set' event
    // from their own listeners. We don't re-emit here to avoid recursion.
  }


  // -----------------------------------------------------------
  //  Panel divider (draggable resize)
  // -----------------------------------------------------------
  _setupDivider() {
    const divider = document.getElementById('panel-divider');
    if (!divider) return;
    let dragging = false;

    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      divider.id = 'panel-divider--dragging';
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const editor = document.getElementById('code-panel');
      if (!editor) return;
      const pct = (e.clientX / window.innerWidth) * 100;
      // Clamp between 15% and 60%
      const clamped = Math.min(60, Math.max(15, pct));
      editor.style.width = `${clamped}%`;
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        divider.id = 'panel-divider';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.dispatchEvent(new Event('resize'));
      }
    });
  }


  // -----------------------------------------------------------
  //  Keyboard shortcuts
  // -----------------------------------------------------------
  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't capture if typing in editor
      if (e.target.tagName === 'TEXTAREA' || e.target.closest('.monaco-editor')) return;

      switch (e.key) {
        case 'Escape':
          if (this._fullscreen) {
            eventBus.emit('fullscreen:set', { enabled: false });
          }
          break;
        case ' ':
          e.preventDefault();
          eventBus.emit(this._controller.state === 'playing' ? EVENTS.PLAYBACK_PAUSE : EVENTS.PLAYBACK_PLAY);
          break;
        case 'ArrowRight':
          e.preventDefault();
          eventBus.emit(EVENTS.PLAYBACK_STEP);
          break;
        case 'r':
        case 'R':
          eventBus.emit(EVENTS.PLAYBACK_RESET);
          break;
        case 'f':
        case 'F':
          eventBus.emit('fullscreen:set', { enabled: !this._fullscreen });
          break;
        case 't':
        case 'T':
          const next = this._theme === THEME.DARK ? THEME.LIGHT : THEME.DARK;
          eventBus.emit('theme:set', { theme: next });
          break;
      }
    });
  }


  // -----------------------------------------------------------
  //  Loading
>>>>>>> e2e4ba9 (updated files)
  // -----------------------------------------------------------
  _hideLoading() {
    const overlay = document.getElementById('app-loading');
    if (overlay) {
      setTimeout(() => {
        overlay.classList.add('app-loading--hidden');
        setTimeout(() => overlay.remove(), 400);
      }, 200);
    }
  }


<<<<<<< HEAD
  // -----------------------------------------------------------
  //  Mouse events
  // -----------------------------------------------------------
=======
>>>>>>> e2e4ba9 (updated files)
  _bindMouse() {
    const canvas = document.getElementById('seeds-canvas');

    canvas.addEventListener('mousemove', (e) => {
      // Normalize to -1..1 for raycaster
      this._mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
    });

    canvas.addEventListener('mouseleave', () => {
      this._mouse.set(-9999, -9999);
      eventBus.emit(EVENTS.TOOLTIP_HIDE);
      if (this._hoveredNode) {
        this._hoveredNode.setHovered(false);
        this._hoveredNode = null;
      }
    });

    canvas.addEventListener('dblclick', () => {
      // Double-click focuses camera on hovered node
      if (this._hoveredNode) {
        this._scene.focusOn(this._hoveredNode.position.clone(), 6);
      }
    });
  }


<<<<<<< HEAD
  // -----------------------------------------------------------
  //  Raycast every frame for hover detection
  // -----------------------------------------------------------
=======
>>>>>>> e2e4ba9 (updated files)
  _raycast() {
    if (!this._activeStructure) return;

    const camera = this._scene.getCamera();
    const scene  = this._scene.getScene();

    this._raycaster.setFromCamera(this._mouse, camera);
    const intersects = this._raycaster.intersectObjects(scene.children, false);

    // Find first intersected object that has node data
    let hitNode = null;
    for (const hit of intersects) {
      if (hit.object.userData?.nodeData) {
        hitNode = hit.object.userData.nodeMesh;
        break;
      }
    }

    if (hitNode !== this._hoveredNode) {
      // Unhover previous
      if (this._hoveredNode) {
        this._hoveredNode.setHovered(false);
        eventBus.emit(EVENTS.TOOLTIP_HIDE);
      }

      // Hover new
      if (hitNode) {
        hitNode.setHovered(true);
        eventBus.emit(EVENTS.TOOLTIP_SHOW, {
          x:    this._lastMouseX ?? 0,
          y:    this._lastMouseY ?? 0,
          node: hitNode.data,
        });
      }

      this._hoveredNode = hitNode;
    } else if (hitNode && (this._lastMouseX !== this._prevMouseX)) {
      // Update tooltip position as mouse moves over same node
      eventBus.emit(EVENTS.TOOLTIP_SHOW, {
        x:    this._lastMouseX ?? 0,
        y:    this._lastMouseY ?? 0,
        node: hitNode.data,
      });
      this._prevMouseX = this._lastMouseX;
    }
  }
}


<<<<<<< HEAD
// Boot the app when DOM is ready
=======
>>>>>>> e2e4ba9 (updated files)
document.addEventListener('DOMContentLoaded', () => {
  window._seedsApp = new App();
});