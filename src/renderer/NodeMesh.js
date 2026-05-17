// =============================================================
//  SeeDS — NodeMesh.js
//  Factory for creating Three.js meshes that represent DS nodes.
//  Each node in a JSON data file gets one NodeMesh instance.
//  Handles normal nodes, NULL nodes, and error-state nodes.
//
//  Usage:
//    const mesh = NodeMesh.create(nodeData, scene);
//    mesh.setHovered(true);
//    mesh.setError(true);
//    mesh.tick(delta, elapsed);   // call every frame for animations
//    mesh.dispose();              // cleanup when clearing scene
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { VISUAL, ERROR_TYPES } from '../core/constants.js';


// Shared geometry and materials across all nodes for performance
// Created once, reused by every node instance
const _sharedGeo = {
  sphere: null,
  null:   null,
};

function _getSphereGeo() {
  if (!_sharedGeo.sphere) {
    _sharedGeo.sphere = new THREE.SphereGeometry(
      VISUAL.NODE_RADIUS,
      VISUAL.NODE_SEGMENTS,
      VISUAL.NODE_SEGMENTS
    );
  }
  return _sharedGeo.sphere;
}

function _getNullGeo() {
  if (!_sharedGeo.null) {
    // NULL node is a slightly smaller, flattened sphere
    _sharedGeo.null = new THREE.SphereGeometry(
      VISUAL.NODE_RADIUS * 0.6,
      16,
      16
    );
  }
  return _sharedGeo.null;
}


class NodeMesh {
  constructor(nodeData, scene) {
    this._data    = nodeData;   // the raw JSON node object
    this._scene   = scene;
    this._mesh    = null;
    this._isNull  = nodeData.value === null || nodeData.id === 'null';
    this._isError = !!nodeData.error;
    this._hovered = false;

    // Animation state
    this._pulsePhase    = Math.random() * Math.PI * 2; // randomize so nodes don't pulse in sync
    this._floatOffset   = 0;
    this._baseY         = 0;

    this._build();
  }


  // -----------------------------------------------------------
  //  Build the Three.js mesh
  // -----------------------------------------------------------
  _build() {
    const geo = this._isNull ? _getNullGeo() : _getSphereGeo();
    const mat = this._buildMaterial();

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.castShadow    = true;
    this._mesh.receiveShadow = false;

    // Attach the node data to the mesh so raycasting can
    // identify which node was clicked/hovered
    this._mesh.userData.nodeData = this._data;
    this._mesh.userData.nodeMesh = this; // back-reference

    this._scene.add(this._mesh);
  }

  _buildMaterial() {
    if (this._isNull) {
      return new THREE.MeshStandardMaterial({
        color:        VISUAL.NODE_NULL_COLOR,
        emissive:     0x111118,
        roughness:    0.8,
        metalness:    0.1,
        transparent:  true,
        opacity:      0.7,
      });
    }

    if (this._isError) {
      return new THREE.MeshStandardMaterial({
        color:        VISUAL.ERROR_COLOR,
        emissive:     VISUAL.ERROR_EMISSIVE,
        emissiveIntensity: 0.5,
        roughness:    0.3,
        metalness:    0.4,
      });
    }

    return new THREE.MeshStandardMaterial({
      color:        VISUAL.NODE_COLOR,
      emissive:     VISUAL.NODE_EMISSIVE,
      emissiveIntensity: 0.3,
      roughness:    0.3,
      metalness:    0.5,
    });
  }


  // -----------------------------------------------------------
  //  Per-frame tick — handles pulse and float animations
  //  for error nodes. Called by the structure (LinkedList etc)
  //  which is called by AnimationLoop.
  // -----------------------------------------------------------
  tick(delta, elapsed) {
    if (!this._mesh) return;

    if (this._isError) {
      this._tickErrorAnimations(elapsed);
    }
  }

  _tickErrorAnimations(elapsed) {
    const mat = this._mesh.material;

    // Pulse emissive intensity
    const pulse = (Math.sin(
      elapsed * VISUAL.ERROR_PULSE_SPEED * Math.PI * 2 + this._pulsePhase
    ) + 1) / 2; // 0 → 1

    mat.emissiveIntensity = 0.3 + pulse * 0.7;

    // Float animation for dangling pointers
    if (this._data.error === ERROR_TYPES.DANGLING_POINTER) {
      const floatY = Math.sin(
        elapsed * VISUAL.ERROR_FLOAT_SPEED * Math.PI * 2 + this._pulsePhase
      ) * VISUAL.ERROR_FLOAT_AMPLITUDE;

      this._mesh.position.y = this._baseY + floatY;
    }
  }


  // -----------------------------------------------------------
  //  PUBLIC API
  // -----------------------------------------------------------

  // Place the node at a world position
  setPosition(x, y, z) {
    this._mesh.position.set(x, y, z);
    this._baseY = y; // remember base so float animation works correctly
  }

  // Highlight on hover
  setHovered(hovered) {
    if (this._hovered === hovered) return;
    this._hovered = hovered;

    if (this._isError) return; // error color takes priority

    this._mesh.material.color.setHex(
      hovered ? VISUAL.NODE_HOVER_COLOR : VISUAL.NODE_COLOR
    );
    this._mesh.material.emissiveIntensity = hovered ? 0.6 : 0.3;
  }

  // Transition this node to error state (used by FLAG_ERROR op)
  setError(errorType) {
    this._isError = true;
    this._data.error = errorType;
    this._mesh.material.color.setHex(VISUAL.ERROR_COLOR);
    this._mesh.material.emissive.setHex(VISUAL.ERROR_EMISSIVE);
    this._mesh.material.emissiveIntensity = 0.5;
  }

  // Highlight this node as "active" during traversal animation
  setActive(active) {
    if (this._isError) return;
    this._mesh.material.emissiveIntensity = active ? 0.8 : 0.3;
    // Scale up slightly when active
    const scale = active ? 1.18 : 1.0;
    this._mesh.scale.setScalar(scale);
  }

  // Mark as sorted (for sort race — turns green)
  setSorted(sorted) {
    if (sorted) {
      this._mesh.material.color.setHex(0x4fc97e);
      this._mesh.material.emissive.setHex(0x1a5c38);
    }
  }

  get position()  { return this._mesh.position; }
  get mesh()      { return this._mesh; }
  get data()      { return this._data; }
  get isNull()    { return this._isNull; }
  get isError()   { return this._isError; }


  // -----------------------------------------------------------
  //  Cleanup — call when clearing the scene
  // -----------------------------------------------------------
  dispose() {
    if (!this._mesh) return;
    // Don't dispose shared geometry
    this._mesh.material.dispose();
    this._scene.remove(this._mesh);
    this._mesh = null;
  }


  // -----------------------------------------------------------
  //  Static factory — the main way to create nodes
  // -----------------------------------------------------------
  static create(nodeData, scene) {
    return new NodeMesh(nodeData, scene);
  }
}


export default NodeMesh;