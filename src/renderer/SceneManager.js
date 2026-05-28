// =============================================================
//  SeeDS — SceneManager.js
//  Owns the Three.js scene, camera, renderer, lights and
//  orbit controls. Everything 3D lives inside this manager.
//  Other modules get the scene/camera by calling getScene()
//  and getCamera() — they never construct their own.
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/jsm/controls/OrbitControls.js';
import { VISUAL, CAMERA } from '../core/constants.js';


class SceneManager {
  constructor(canvas) {
    this._canvas   = canvas;
    this._scene    = null;
    this._camera   = null;
    this._renderer = null;
    this._controls = null;
    this._lights   = {};

    this._init();
  }


  // -----------------------------------------------------------
  //  INIT
  // -----------------------------------------------------------
  _init() {
    this._buildRenderer();
    this._buildScene();
    this._buildCamera();
    this._buildLights();
    this._buildControls();
    this._bindResize();
    // Run resize immediately so the viewport accounts for the code panel
    this._onResize();
  }

  _buildRenderer() {
    this._renderer = new THREE.WebGLRenderer({
      canvas:     this._canvas,
      antialias:  true,
      alpha:      false,
    });

    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Don't set CSS size here — CSS handles that via width:100%;height:100%
    // setSize(..., false) means "don't touch CSS styles"
    this._renderer.setSize(window.innerWidth, window.innerHeight, false);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    // Correct color rendering for modern Three.js
    this._renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this._renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.1;
  }

  _buildScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(VISUAL.BACKGROUND_COLOR);
    this._scene.fog = new THREE.Fog(
      VISUAL.FOG_COLOR,
      VISUAL.FOG_NEAR,
      VISUAL.FOG_FAR
    );
  }

  _buildCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this._camera = new THREE.PerspectiveCamera(
      CAMERA.FOV,
      aspect,
      CAMERA.NEAR,
      CAMERA.FAR
    );
    this._camera.position.set(
      CAMERA.DEFAULT_POS.x,
      CAMERA.DEFAULT_POS.y,
      CAMERA.DEFAULT_POS.z
    );
  }

  _buildLights() {
    // Soft ambient so nothing is pitch black
    const ambient = new THREE.AmbientLight(0xffffff, VISUAL.AMBIENT_INTENSITY);
    this._scene.add(ambient);
    this._lights.ambient = ambient;

    // Main directional — casts shadows
    const dir = new THREE.DirectionalLight(0xffffff, VISUAL.DIRECTIONAL_INTENSITY);
    dir.position.set(
      VISUAL.DIRECTIONAL_POS.x,
      VISUAL.DIRECTIONAL_POS.y,
      VISUAL.DIRECTIONAL_POS.z
    );
    dir.castShadow = true;
    dir.shadow.mapSize.width  = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near    = 0.5;
    dir.shadow.camera.far     = 100;
    this._scene.add(dir);
    this._lights.directional = dir;

    // Subtle fill from below — lifts shadow areas slightly
    const fill = new THREE.DirectionalLight(0x4466aa, 0.3);
    fill.position.set(-5, -10, -5);
    this._scene.add(fill);
    this._lights.fill = fill;
  }

  _buildControls() {
    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping    = true;
    this._controls.dampingFactor    = 0.07;
    this._controls.minDistance      = CAMERA.MIN_DISTANCE;
    this._controls.maxDistance      = CAMERA.MAX_DISTANCE;
    this._controls.enablePan        = true;
    this._controls.panSpeed         = 0.8;
    this._controls.rotateSpeed      = 0.6;
    this._controls.zoomSpeed        = 1.0;
    // Prevent flipping upside down
    this._controls.maxPolarAngle    = Math.PI * 0.85;
  }

  _bindResize() {
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const h = window.innerHeight;
    const fullW = window.innerWidth;

    // Account for code panel (40% width on the left when not minimized)
    const codePanel = document.getElementById('code-panel');
    const panelMinimized = codePanel?.classList.contains('code-panel--minimized');
    const panelWidth = (!panelMinimized && codePanel) ? codePanel.offsetWidth : 0;

    const w = fullW - panelWidth;

    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(fullW, h);
    this._renderer.setViewport(panelWidth, 0, w, h);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }


  // -----------------------------------------------------------
  //  PUBLIC API
  // -----------------------------------------------------------

  // Call this every frame from AnimationLoop
  update() {
    this._controls.update(); // needed for damping to work
  }

  // Call this every frame from AnimationLoop after update()
  render() {
    this._renderer.render(this._scene, this._camera);
  }

  // Fly camera smoothly to a target position + lookAt
  // Used when double-clicking a node to focus it
  focusOn(targetPos, distance = 8) {
    // Simple lerp — AnimationLoop calls this every frame until done
    this._focusTarget   = targetPos.clone();
    this._focusDistance = distance;
    this._focusing      = true;
  }

  // Called by AnimationLoop when _focusing is true
  _tickFocus() {
    if (!this._focusing) return;

    const dir = new THREE.Vector3()
      .subVectors(this._camera.position, this._focusTarget)
      .normalize()
      .multiplyScalar(this._focusDistance);

    const goal = this._focusTarget.clone().add(dir);
    this._camera.position.lerp(goal, 0.08);
    this._controls.target.lerp(this._focusTarget, 0.08);

    // Stop when close enough
    if (this._camera.position.distanceTo(goal) < 0.05) {
      this._focusing = false;
    }
  }

  // Reset camera to default position
  resetCamera() {
    this._camera.position.set(
      CAMERA.DEFAULT_POS.x,
      CAMERA.DEFAULT_POS.y,
      CAMERA.DEFAULT_POS.z
    );
    this._controls.target.set(0, 0, 0);
    this._controls.update();
    this._focusing = false;
  }

  // Clear all non-light objects from the scene
  // Called when loading a new data structure
  clearScene() {
    const toRemove = [];
    this._scene.traverse((obj) => {
      if (obj.isLight) return;
      if (obj === this._scene) return;
      toRemove.push(obj);
    });

    for (const obj of toRemove) {
      // Dispose geometry and material to free GPU memory
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      this._scene.remove(obj);
    }
  }

  // Getters — other modules use these, never instantiate their own
  getScene()    { return this._scene;    }
  getCamera()   { return this._camera;   }
  getRenderer() { return this._renderer; }
  getControls() { return this._controls; }
}


export default SceneManager;