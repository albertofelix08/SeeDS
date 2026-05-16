// =============================================================
//  SeeDS — ErrorHighlight.js
//  Visual effects for error states. Wraps around NodeMesh
//  instances and adds:
//    - Pulsing red ring around error nodes
//    - Floating animation for dangling pointers
//    - Red glow halo for cycle nodes
//    - "Leaked" node that drifts behind the camera
//
//  Usage:
//    const eh = new ErrorHighlight(scene, camera);
//    eh.addDangling(nodeMesh);
//    eh.addCycle(nodeMeshArray);
//    eh.addLeak(nodeMesh);
//    eh.tick(delta, elapsed);   // call every frame
//    eh.clear();
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { VISUAL, ERROR_TYPES } from './constants.js';


class ErrorHighlight {
  constructor(scene, camera) {
    this._scene    = scene;
    this._camera   = camera;
    this._effects  = [];   // list of active effect objects
  }


  // -----------------------------------------------------------
  //  Add a pulsing ring around a dangling pointer node
  // -----------------------------------------------------------
  addDangling(nodeMesh) {
    const ring = this._makeRing(VISUAL.ERROR_COLOR, 1.1);
    ring.position.copy(nodeMesh.position);

    this._scene.add(ring);
    this._effects.push({
      type:      ERROR_TYPES.DANGLING_POINTER,
      ring,
      nodeMesh,
      phase:     Math.random() * Math.PI * 2,
    });
  }


  // -----------------------------------------------------------
  //  Add glow rings to all nodes in a cycle
  // -----------------------------------------------------------
  addCycle(nodeMeshArray) {
    for (const nodeMesh of nodeMeshArray) {
      const ring = this._makeRing(VISUAL.CYCLE_GLOW_COLOR, 1.15);
      ring.position.copy(nodeMesh.position);
      this._scene.add(ring);
      this._effects.push({
        type:     ERROR_TYPES.CYCLE,
        ring,
        nodeMesh,
        phase:    Math.random() * Math.PI * 2,
      });
    }
  }


  // -----------------------------------------------------------
  //  Add a "memory leaked" node that drifts off behind camera
  // -----------------------------------------------------------
  addLeak(nodeMesh) {
    // Start at node position, drift towards negative Z
    const startPos = nodeMesh.position.clone();
    this._effects.push({
      type:      ERROR_TYPES.MEMORY_LEAK,
      nodeMesh,
      startPos,
      elapsed:   0,
      phase:     0,
    });
  }


  // -----------------------------------------------------------
  //  Per-frame tick
  // -----------------------------------------------------------
  tick(delta, elapsed) {
    for (const effect of this._effects) {
      switch (effect.type) {
        case ERROR_TYPES.DANGLING_POINTER:
          this._tickDangling(effect, elapsed);
          break;
        case ERROR_TYPES.CYCLE:
          this._tickCycle(effect, elapsed);
          break;
        case ERROR_TYPES.MEMORY_LEAK:
          this._tickLeak(effect, delta);
          break;
      }
    }
  }

  _tickDangling(effect, elapsed) {
    // Pulse ring scale
    const pulse = 1.0 + 0.12 * Math.sin(
      elapsed * VISUAL.ERROR_PULSE_SPEED * Math.PI * 2 + effect.phase
    );
    effect.ring.scale.setScalar(pulse);

    // Pulse ring opacity
    const opacity = 0.4 + 0.5 * ((Math.sin(
      elapsed * VISUAL.ERROR_PULSE_SPEED * Math.PI * 2 + effect.phase
    ) + 1) / 2);
    effect.ring.material.opacity = opacity;

    // Keep ring position synced with node (node floats)
    effect.ring.position.copy(effect.nodeMesh.position);
  }

  _tickCycle(effect, elapsed) {
    // Slower, more ominous pulse for cycle nodes
    const pulse = 1.0 + 0.08 * Math.sin(
      elapsed * 1.5 * Math.PI * 2 + effect.phase
    );
    effect.ring.scale.setScalar(pulse);

    const opacity = 0.3 + 0.4 * ((Math.sin(
      elapsed * 1.5 * Math.PI * 2 + effect.phase
    ) + 1) / 2);
    effect.ring.material.opacity = opacity;
  }

  _tickLeak(effect, delta) {
    // Drift the leaked node slowly away from where it was
    effect.elapsed += delta;
    const node = effect.nodeMesh;

    // Drift backwards and down, fading out
    node.mesh.position.z -= delta * 0.6;
    node.mesh.position.y -= delta * 0.2;

    // Fade out the node material
    if (node.mesh.material.transparent !== true) {
      node.mesh.material.transparent = true;
    }
    node.mesh.material.opacity = Math.max(0, 1.0 - effect.elapsed * 0.3);
  }


  // -----------------------------------------------------------
  //  Build a torus ring mesh
  // -----------------------------------------------------------
  _makeRing(color, radiusMultiplier = 1.0) {
    const r   = VISUAL.NODE_RADIUS * radiusMultiplier;
    const geo = new THREE.TorusGeometry(r, 0.04, 8, 32);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity:     0.7,
      depthWrite:  false,
    });
    const ring = new THREE.Mesh(geo, mat);
    // Face the ring upward so it sits around the equator of the node
    ring.rotation.x = Math.PI / 2;
    return ring;
  }


  // -----------------------------------------------------------
  //  Remove all effects and clean up
  // -----------------------------------------------------------
  clear() {
    for (const effect of this._effects) {
      if (effect.ring) {
        effect.ring.geometry.dispose();
        effect.ring.material.dispose();
        this._scene.remove(effect.ring);
      }
    }
    this._effects = [];
  }


  get effectCount() { return this._effects.length; }
}


export default ErrorHighlight;