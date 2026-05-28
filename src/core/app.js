// =============================================================
//  SeeDS — app.js
//  Main application entry point.
//  Orchestrates: Three.js scene, UI components,
//  theme switching, fullscreen mode, keyboard shortcuts.
// =============================================================

import eventBus           from './eventBus.js';
import { EVENTS, DS_TYPES, APP, THEME } from './constants.js';

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
    this._scene      = null;
    this._loop       = null;
    this._controller = null;
    this._activeStructure = null;
    this._activeType      = null;
    this._theme      = THEME.DARK;
    this._fullscreen = false;
    this._toolbar    = null;
    this._playbar    = null;
    this._codePanel  = null;
    this._statusBar  = null;
    this._errorPanel = null;
    this._tooltip    = null;
    this._raycaster  = new THREE.Raycaster();
    this._mouse      = new THREE.Vector2(-9999, -9999);
    this._hoveredNode = null;
    this._init();
  }

  _init() {
    const canvas = document.getElementById('seeds-canvas');
    if (!canvas) { showCrash('getElementById seeds-canvas', new Error('Canvas element missing')); return; }

    this._scene  = new SceneManager(canvas);
    this._loop = new AnimationLoop(this._scene);
    this._controller = new PlaybackController();
    this._toolbar    = new Toolbar(document.getElementById('toolbar'));
    this._playbar    = new PlaybackBar(document.getElementById('playback-bar'), this._controller);
    this._tooltip    = new InfoTooltip();
    this._statusBar  = new StatusBar();
    this._errorPanel = new ErrorPanel();
    this._loop.register('app', (delta, elapsed) => this._tick(delta, elapsed));
    this._codePanel  = new CodePanel();
    this._restoreTheme();
    this._bindEvents();
    this._bindMouse();
    this._setupDivider();
    this._bindKeyboard();
    this._hideLoading();
    this._loop.start();

    console.log(`%c SeeDS v${APP.VERSION} `, 'background:#1a3a6e;color:#7db3ff;padding:4px 8px;border-radius:4px;');
  }

  _tick(delta, elapsed) {
    this._controller.update(delta);
    if (this._activeStructure) {
      this._activeStructure.tick(delta, elapsed);
    }
    this._raycast();
    this._scene._tickFocus?.();
    this._statusBar?.tick();
  }

  _bindEvents() {
    eventBus.on(EVENTS.DS_LOADED, ({ type, data }) => {
      this._loadStructure(type, data);
    });
    eventBus.on(EVENTS.PLAYBACK_PLAY,  () => this._controller.play());
    eventBus.on(EVENTS.PLAYBACK_PAUSE, () => this._controller.pause());
    eventBus.on(EVENTS.PLAYBACK_STEP,  () => this._controller.step());
    eventBus.on(EVENTS.PLAYBACK_SPEED, ({ speed }) => this._controller.setSpeed(speed));
    eventBus.on(EVENTS.PLAYBACK_RESET, () => {
      this._controller.reset();
      if (this._activeStructure && this._lastData) {
        this._buildStructure(this._activeType, this._lastData);
      }
    });
    eventBus.on('camera:reset', () => { this._scene.resetCamera(); });
    eventBus.on('theme:set', ({ theme }) => this._setTheme(theme));
    eventBus.on('fullscreen:set', ({ enabled }) => this._setFullscreen(enabled));
    eventBus.on(EVENTS.ERROR_SELECTED, ({ error }) => {
      if (!error.nodeId || !this._activeStructure) return;
      const nodeMesh = this._activeStructure._nodes?.get(error.nodeId);
      if (nodeMesh) {
        this._scene.focusOn(nodeMesh.position.clone(), 6);
      }
    });
  }

  _loadStructure(type, data) {
    this._lastData  = data;
    this._activeType = type;
    this._controller.reset();
    if (this._activeStructure) {
      this._activeStructure.dispose();
      this._activeStructure = null;
    }
    this._scene.clearScene();
    this._buildStructure(type, data);
  }

  _buildStructure(type, data) {
    const scene  = this._scene.getScene();
    const camera = this._scene.getCamera();
    if (this._activeStructure) {
      this._activeStructure.dispose();
    }
    switch (type) {
      case DS_TYPES.LINKED_LIST:
        this._activeStructure = new LinkedList(scene, camera); break;
      case DS_TYPES.BINARY_TREE:
        this._activeStructure = new BinaryTree(scene, camera); break;
      case DS_TYPES.ARRAY:
        this._activeStructure = new ArrayStructure(scene, camera); break;
      case DS_TYPES.SORT_RACE:
        this._activeStructure = new SortRace(scene, camera); break;
      case DS_TYPES.STACK:
        this._activeStructure = new StackStructure(scene, camera); break;
      case DS_TYPES.QUEUE:
      case DS_TYPES.CIRCULAR_QUEUE:
      case DS_TYPES.DEQUEUE:
        this._activeStructure = new QueueStructure(scene, camera); break;
      case DS_TYPES.GRAPH:
        this._activeStructure = new GraphStructure(scene, camera); break;
      case DS_TYPES.HASH_TABLE:
        this._activeStructure = new HashTableStructure(scene, camera); break;
      case DS_TYPES.HEAP:
        this._activeStructure = new HeapStructure(scene, camera); break;
      case DS_TYPES.AVL_TREE:
        this._activeStructure = new AVLTreeStructure(scene, camera); break;
      case DS_TYPES.DOUBLY_LIST:
      case DS_TYPES.CIRCULAR_LIST:
        this._activeStructure = new LinkedList(scene, camera); break;
      default:
        console.warn('[App] Unknown DS type:', type);
        return;
    }
    this._activeStructure.build(data);
    this._controller.load(data, (op) => this._activeStructure.execute(op));
    this._scene.resetCamera();
    if (data._autoPlay && this._controller.total > 0) {
      this._controller.play();
    }
  }

  _setTheme(theme) {
    this._theme = theme;
    document.body.classList.toggle('light-theme', theme === THEME.LIGHT);
    localStorage.setItem(THEME.STORAGE_KEY, theme);
    if (theme === THEME.LIGHT) {
      this._scene.setBackground(THEME.LIGHT_BG, THEME.LIGHT_FOG);
    } else {
      this._scene.setBackground(THEME.DARK_BG, THEME.DARK_FOG);
    }
  }

  _restoreTheme() {
    const saved = localStorage.getItem(THEME.STORAGE_KEY);
    if (saved === THEME.LIGHT || saved === THEME.DARK) {
      this._setTheme(saved);
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      this._setTheme(prefersLight ? THEME.LIGHT : THEME.DARK);
    }
  }


  _setFullscreen(enabled) {
    this._fullscreen = enabled;
    document.body.classList.toggle('fullscreen-mode', enabled);

    if (enabled) {
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

    window.dispatchEvent(new Event('resize'));
  }


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


  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
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


  _hideLoading() {
    const overlay = document.getElementById('app-loading');
    if (overlay) {
      overlay.classList.add('app-loading--hidden');
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 200);
    }
  }


  _bindMouse() {
    const canvas = document.getElementById('seeds-canvas');
    canvas.addEventListener('mousemove', (e) => {
      this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    canvas.addEventListener('mouseleave', () => {
      this._mouse.x = -9999;
      this._mouse.y = -9999;
    });
    canvas.addEventListener('click', () => {
      if (this._hoveredNode) {
        this._scene.focusOn(this._hoveredNode.position.clone(), 6);
      }
    });
  }


  _raycast() {
    if (!this._activeStructure) return;
    const camera = this._scene.getCamera();
    this._raycaster.setFromCamera(this._mouse, camera);
    const meshes = [];
    if (this._activeStructure._nodes) {
      for (const node of this._activeStructure._nodes.values()) {
        if (node.mesh) meshes.push(node.mesh);
      }
    }
    const intersects = this._raycaster.intersectObjects(meshes);
    const prevHover = this._hoveredNode;
    this._hoveredNode = intersects.length > 0 ? intersects[0].object : null;
    if (prevHover !== this._hoveredNode) {
      if (prevHover) {
        prevHover.material.emissive.setHex(prevHover.userData.origEmissive || 0x000000);
      }
      if (this._hoveredNode) {
        if (!this._hoveredNode.userData.origEmissive) {
          this._hoveredNode.userData.origEmissive = this._hoveredNode.material.emissive.getHex();
        }
        this._hoveredNode.material.emissive.setHex(0x334466);

        // Get mouse position for tooltip
        const rect = this._scene.getRenderer()?.domElement.getBoundingClientRect();
        const mouseX = (this._mouse.x * 0.5 + 0.5) * (rect?.width || window.innerWidth);
        const mouseY = (-this._mouse.y * 0.5 + 0.5) * (rect?.height || window.innerHeight);
        this._tooltip.show(mouseX, mouseY, this._hoveredNode.userData.nodeData);
      } else {
        this._tooltip.hide();
      }
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  window._seedsApp = new App();
  // Fix initial viewport: SceneManager._onResize ran before CodePanel was built
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
});
