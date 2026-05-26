// app-v2.js — Real App with try/catch around _init() to surface the crash

import eventBus           from './eventBus.js';
import { EVENTS, DS_TYPES, APP } from './constants.js';

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
  // Replace loading screen with error info
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
    this._toolbar    = null;
    this._playbar    = null;
    this._tooltip    = null;
    this._errorPanel = null;
    this._raycaster  = new THREE.Raycaster();
    this._mouse      = new THREE.Vector2(-9999, -9999);
    this._hoveredNode = null;

    try {
      this._init();
    } catch(e) {
      showCrash('_init()', e);
    }
  }

  _init() {
    let step = 'getElementById seeds-canvas';
    const canvas = document.getElementById('seeds-canvas');

    step = 'new SceneManager(canvas)';
    this._scene  = new SceneManager(canvas);

    step = 'new AnimationLoop(scene)';
    this._loop = new AnimationLoop(this._scene);

    step = 'new PlaybackController()';
    this._controller = new PlaybackController();

    step = 'new Toolbar()';
    this._toolbar    = new Toolbar(document.getElementById('toolbar'));

    step = 'new PlaybackBar()';
    this._playbar    = new PlaybackBar(document.getElementById('playback-bar'), this._controller);

    step = 'new InfoTooltip()';
    this._tooltip    = new InfoTooltip();

    step = 'new StatusBar()';
    this._statusBar  = new StatusBar();

    step = 'new ErrorPanel()';
    this._errorPanel = new ErrorPanel(document.getElementById('error-panel'));

    step = 'loop.register()';
    this._loop.register('app', (delta, elapsed) => this._tick(delta, elapsed));

    step = 'new CodePanel()';
    this._codePanel = new CodePanel();

    step = '_bindEvents()';
    this._bindEvents();

    step = '_bindMouse()';
    this._bindMouse();

    step = '_hideLoading()';
    this._hideLoading();

    step = 'loop.start()';
    this._loop.start();

    // Fire initial resize so canvas fills the right column correctly
    window.dispatchEvent(new Event('resize'));

    console.log(`%c SeeDS v${APP.VERSION} booted OK `, 'background:#1a3a6e;color:#7db3ff;padding:4px 8px;border-radius:4px;');
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
      case DS_TYPES.LINKED_LIST:    this._activeStructure = new LinkedList(scene, camera); break;
      case DS_TYPES.BINARY_TREE:    this._activeStructure = new BinaryTree(scene, camera); break;
      case DS_TYPES.ARRAY:          this._activeStructure = new ArrayStructure(scene, camera); break;
      case DS_TYPES.SORT_RACE:      this._activeStructure = new SortRace(scene, camera); break;
      case DS_TYPES.STACK:          this._activeStructure = new StackStructure(scene, camera); break;
      case DS_TYPES.QUEUE:
      case DS_TYPES.CIRCULAR_QUEUE:
      case DS_TYPES.DEQUEUE:        this._activeStructure = new QueueStructure(scene, camera); break;
      case DS_TYPES.GRAPH:          this._activeStructure = new GraphStructure(scene, camera); break;
      case DS_TYPES.HASH_TABLE:     this._activeStructure = new HashTableStructure(scene, camera); break;
      case DS_TYPES.HEAP:           this._activeStructure = new HeapStructure(scene, camera); break;
      case DS_TYPES.AVL_TREE:       this._activeStructure = new AVLTreeStructure(scene, camera); break;
      case DS_TYPES.DOUBLY_LIST:
      case DS_TYPES.CIRCULAR_LIST:  this._activeStructure = new LinkedList(scene, camera); break;
      default: console.warn('[App] Unknown DS type:', type); return;
    }
    this._activeStructure.build(data);
    this._controller.load(data, (op) => this._activeStructure.execute(op));
    this._scene.resetCamera();
    if (data._autoPlay && this._controller.total > 0) {
      this._controller.play();
    }
  }

  _hideLoading() {
    const overlay = document.getElementById('app-loading');
    if (overlay) {
      setTimeout(() => {
        overlay.classList.add('app-loading--hidden');
        setTimeout(() => overlay.remove(), 400);
      }, 200);
    }
  }

  _bindMouse() {
    const canvas = document.getElementById('seeds-canvas');
    canvas.addEventListener('mousemove', (e) => {
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
      if (this._hoveredNode) {
        this._scene.focusOn(this._hoveredNode.position.clone(), 6);
      }
    });
  }

  _raycast() {
    if (!this._activeStructure) return;
    const camera = this._scene.getCamera();
    const scene  = this._scene.getScene();
    this._raycaster.setFromCamera(this._mouse, camera);
    const intersects = this._raycaster.intersectObjects(scene.children, false);
    let hitNode = null;
    for (const hit of intersects) {
      if (hit.object.userData?.nodeData) {
        hitNode = hit.object.userData.nodeMesh;
        break;
      }
    }
    if (hitNode !== this._hoveredNode) {
      if (this._hoveredNode) {
        this._hoveredNode.setHovered(false);
        eventBus.emit(EVENTS.TOOLTIP_HIDE);
      }
      if (hitNode) {
        hitNode.setHovered(true);
        eventBus.emit(EVENTS.TOOLTIP_SHOW, {
          x: this._lastMouseX ?? 0,
          y: this._lastMouseY ?? 0,
          node: hitNode.data,
        });
      }
      this._hoveredNode = hitNode;
    } else if (hitNode && (this._lastMouseX !== this._prevMouseX)) {
      eventBus.emit(EVENTS.TOOLTIP_SHOW, {
        x: this._lastMouseX ?? 0,
        y: this._lastMouseY ?? 0,
        node: hitNode.data,
      });
      this._prevMouseX = this._lastMouseX;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window._seedsApp = new App();
});