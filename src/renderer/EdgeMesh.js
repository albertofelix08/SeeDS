// =============================================================
//  SeeDS — EdgeMesh.js
//  Draws directed arrows (edges) between nodes.
//  Each edge = a cylinder shaft + a cone arrowhead.
//  Edges are rebuilt whenever node positions change.
//
//  Usage:
//    const edge = EdgeMesh.create(fromPos, toPos, scene);
//    edge.update(newFromPos, newToPos);  // reposition
//    edge.setError(true);                // turn red
//    edge.dispose();
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { VISUAL } from './constants.js';


class EdgeMesh {
  constructor(fromPos, toPos, scene, options = {}) {
    this._scene   = scene;
    this._fromPos = fromPos.clone();
    this._toPos   = toPos.clone();
    this._options = {
      color:     options.color     ?? VISUAL.EDGE_COLOR,
      thickness: options.thickness ?? VISUAL.EDGE_THICKNESS,
      isError:   options.isError   ?? false,
      isDashed:  options.isDashed  ?? false,   // future use
    };

    this._group = new THREE.Group();
    this._shaft = null;
    this._head  = null;

    this._build();
    this._scene.add(this._group);
  }


  // -----------------------------------------------------------
  //  Build shaft + arrowhead
  // -----------------------------------------------------------
  _build() {
    const from = this._fromPos;
    const to   = this._toPos;

    // Direction and length
    const dir    = new THREE.Vector3().subVectors(to, from);
    const length = dir.length();

    if (length < 0.001) return; // zero-length edge, skip

    const nodeR   = VISUAL.NODE_RADIUS;
    const headSize = VISUAL.ARROW_HEAD_SIZE;

    // Shorten both ends so the arrow doesn't overlap the spheres
    const shaftFrom = from.clone().addScaledVector(dir.clone().normalize(), nodeR + 0.05);
    const shaftTo   = to.clone().addScaledVector(dir.clone().normalize(), -(nodeR + headSize + 0.05));
    const shaftDir  = new THREE.Vector3().subVectors(shaftTo, shaftFrom);
    const shaftLen  = shaftDir.length();

    if (shaftLen < 0.01) return;

    const color = this._options.isError ? VISUAL.ERROR_COLOR : this._options.color;

    // -- Shaft (CylinderGeometry, oriented along Y, then rotated) --
    const shaftGeo = new THREE.CylinderGeometry(
      this._options.thickness,   // top radius
      this._options.thickness,   // bottom radius
      shaftLen,
      8,                         // radial segments — low poly is fine
      1
    );
    const shaftMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
    });
    this._shaft = new THREE.Mesh(shaftGeo, shaftMat);

    // Position at midpoint
    const mid = new THREE.Vector3().addVectors(shaftFrom, shaftTo).multiplyScalar(0.5);
    this._shaft.position.copy(mid);

    // Rotate to align with direction
    this._alignToDirection(this._shaft, shaftDir.clone().normalize());

    // -- Arrowhead (cone) --
    const headGeo = new THREE.ConeGeometry(headSize, headSize * 2, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.3,
    });
    this._head = new THREE.Mesh(headGeo, headMat);

    // Position at tip end (just before the target node surface)
    const headPos = to.clone().addScaledVector(dir.clone().normalize(), -(nodeR + 0.05));
    this._head.position.copy(headPos);
    this._alignToDirection(this._head, dir.clone().normalize());

    this._group.add(this._shaft);
    this._group.add(this._head);
  }

  // Rotate a mesh so its local Y axis points along `dir`
  _alignToDirection(mesh, dir) {
    const up = new THREE.Vector3(0, 1, 0);
    // Handle the case where dir is exactly parallel to up
    if (Math.abs(dir.dot(up)) > 0.999) {
      mesh.rotation.set(dir.y < 0 ? Math.PI : 0, 0, 0);
      return;
    }
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
    mesh.setRotationFromQuaternion(quaternion);
  }


  // -----------------------------------------------------------
  //  Rebuild the edge with new positions
  //  Called when a node moves (insert/delete animation)
  // -----------------------------------------------------------
  update(fromPos, toPos) {
    this._fromPos = fromPos.clone();
    this._toPos   = toPos.clone();

    // Remove old meshes
    if (this._shaft) {
      this._shaft.geometry.dispose();
      this._shaft.material.dispose();
      this._group.remove(this._shaft);
    }
    if (this._head) {
      this._head.geometry.dispose();
      this._head.material.dispose();
      this._group.remove(this._head);
    }

    this._shaft = null;
    this._head  = null;

    this._build();
  }


  // -----------------------------------------------------------
  //  Error state — turn the edge red
  // -----------------------------------------------------------
  setError(isError) {
    this._options.isError = isError;
    const color = isError ? VISUAL.ERROR_COLOR : this._options.color;
    if (this._shaft) this._shaft.material.color.setHex(color);
    if (this._head)  this._head.material.color.setHex(color);
  }


  // -----------------------------------------------------------
  //  Highlight — used during traversal animation
  //  A travelling packet will be separate, but the edge itself
  //  can glow to show the active path
  // -----------------------------------------------------------
  setActive(active) {
    if (this._options.isError) return;
    const color = active ? 0x7db3ff : this._options.color;
    const emissiveIntensity = active ? 0.5 : 0;
    if (this._shaft) {
      this._shaft.material.color.setHex(color);
      this._shaft.material.emissiveIntensity = emissiveIntensity;
    }
    if (this._head) {
      this._head.material.color.setHex(color);
      this._head.material.emissiveIntensity = emissiveIntensity;
    }
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    if (this._shaft) {
      this._shaft.geometry.dispose();
      this._shaft.material.dispose();
    }
    if (this._head) {
      this._head.geometry.dispose();
      this._head.material.dispose();
    }
    this._scene.remove(this._group);
    this._shaft = null;
    this._head  = null;
  }


  // -----------------------------------------------------------
  //  Static factory
  // -----------------------------------------------------------
  static create(fromPos, toPos, scene, options) {
    return new EdgeMesh(fromPos, toPos, scene, options);
  }
}


export default EdgeMesh;