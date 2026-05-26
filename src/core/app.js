// =============================================================
//  SeeDS — app.js
//  The top-level orchestrator. Instantiates every module,
//  wires them together, and handles the two things that need
//  to cross module boundaries:
//    1. DS switching (load JSON → build structure → reset playback)
//    2. Raycasting (mouse move → tooltip, click → focus camera)
//
//  Import order matters here — constants and eventBus first,
//  then renderer, then structures, then UI.
// =============================================================

import eventBus           from './eventBus.js';
import { EVENTS, DS_TYPES, APP } from './constants.js';

import SceneManager       from '../renderer/SceneManager.js';
import AnimationLoop      from '../renderer/AnimationLoop.js';
import PlaybackController from '../renderer/PlaybackController.js';

import LinkedList         from '../structures/LinkedList.js';
import BinaryTree         from '../structures/BinaryTree.js';
import ArrayStructure     from '../structures/Array.js';
import SortRace           from '../structures/SortRace.js';

import Toolbar            from '../ui/Toolbar.js';
import PlaybackBar        from '../ui/PlaybackBar.js';
import InfoTooltip        from '../ui/InfoTooltip.js';
import ErrorPanel         from '../ui/ErrorPanel.js';

import * as THREE         from '../../vendor/three/three.module.js';


class App {
  constructor() {
    // Core
    this._scene      = null;
    this._loop       = null;
    this._controller = null;

    // Active structure instance
    this._activeStructure = null;
    this._activeType      = null;

    // UI
    this._toolbar    = null;
    this._playbar    = null;
    this._tooltip    = null;
    this._errorPanel = null;

    // Raycasting
    this._raycaster  = new THREE.Raycaster();
    this._mouse      = new THREE.Vector2(-9999, -9999);
    this._hoveredNode = null;

    this._init();
  }


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
    this._errorPanel = new ErrorPanel(document.getElementById('error-panel'));

    // 5. Register per-frame tick
    this._loop.register('app', (delta, elapsed) => this._tick(delta, elapsed));

    // 6. Bind all cross-module events
    this._bindEvents();

    // 7. Mouse events for raycasting
    this._bindMouse();

    // 8. Start the loop
    this._loop.start();

    console.log(`%c SeeDS v${APP.VERSION} — Phase ${APP.PHASE} `, 'background:#1a3a6e;color:#7db3ff;padding:4px 8px;border-radius:4px;');
  }


  // -----------------------------------------------------------
  //  Per-frame tick
  // -----------------------------------------------------------
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
  }


  // -----------------------------------------------------------
  //  Event wiring
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

    // Camera reset
    eventBus.on('camera:reset', () => {
      this._scene.resetCamera();
    });

    // Error panel click → focus camera on node
    eventBus.on(EVENTS.ERROR_SELECTED, ({ error }) => {
      if (!error.nodeId || !this._activeStructure) return;
      const nodeMesh = this._activeStructure._nodes?.get(error.nodeId);
      if (nodeMesh) {
        this._scene.focusOn(nodeMesh.position.clone(), 6);
      }
    });
  }


  // -----------------------------------------------------------
  //  Load and build a structure from JSON data
  // -----------------------------------------------------------
  _loadStructure(type, data) {
    this._lastData  = data;
    this._activeType = type;

    // Reset playback first
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
      default:
        console.warn('[App] Unknown DS type:', type);
        return;
    }

    this._activeStructure.build(data);

    // Wire playback: controller calls executor on each step
    this._controller.load(data, (op) => this._activeStructure.execute(op));

    // Reset camera — sort race needs a wider view than other DS types
    if (type === DS_TYPES.SORT_RACE) {
      this._scene.setCameraPosition(0, 8, 46);
    } else {
      this._scene.resetCamera();
    }
  }


  // -----------------------------------------------------------
  //  Mouse events
  // -----------------------------------------------------------
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


  // -----------------------------------------------------------
  //  Raycast every frame for hover detection
  // -----------------------------------------------------------
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


// Boot the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window._seedsApp = new App();
});