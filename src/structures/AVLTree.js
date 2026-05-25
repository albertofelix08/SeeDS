// =============================================================
//  SeeDS — AVLTree.js
//  Extends BinaryTree with AVL-specific visualization:
//    - Balance factor displayed next to each node
//    - Rotation animation markers
//    - Height labels on nodes
//  JSON shape same as BinaryTree + extra fields for balance factors
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, OP_TYPES, VISUAL } from '../core/constants.js';
import BinaryTree  from './BinaryTree.js';
import LabelSprite from '../renderer/LabelSprite.js';


class AVLTree extends BinaryTree {
  constructor(scene, camera) {
    super(scene, camera);
    this._balanceLabels = new Map();  // nodeId → LabelSprite
    this._heightLabels  = new Map();  // nodeId → LabelSprite
    this._rotationIndicators = [];    // THREE objects for rotation visualization
  }


  // -----------------------------------------------------------
  //  Build — super.build() then add AVL overlays
  // -----------------------------------------------------------
  build(data) {
    // Let BinaryTree build the base
    super.build(data);

    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

    // Add balance factor and height labels
    for (const [id, pos] of this._getPositions?.() || []) {
      // Use positions from the parent's layout
      if (!this._nodes.has(id)) continue;
      const mesh = this._nodes.get(id);
      const node = nodeMap.get(id);
      if (!node || !mesh) continue;

      const bf = node.balanceFactor;
      if (bf !== undefined && bf !== null) {
        const bfStr = bf > 0 ? `+${bf}` : String(bf);
        const bfColor = Math.abs(bf) > 1 ? '#ff6b6b' :
                        Math.abs(bf) === 1 ? '#ffc44d' : '#4fc97e';

        const bfLabel = LabelSprite.create(`bf=${bfStr}`, this._scene);
        const pos = mesh.position;
        bfLabel.setPosition(pos.x + 1.2, pos.y + 0.6, 0);
        this._balanceLabels.set(id, bfLabel);
      }

      // Height label
      if (node.height !== undefined && node.height !== null) {
        const hLabel = LabelSprite.create(`h=${node.height}`, this._scene);
        const pos = mesh.position;
        hLabel.setPosition(pos.x - 1.2, pos.y + 0.6, 0);
        this._heightLabels.set(id, hLabel);
      }
    }

    // Rotation markers in data
    if (data.rotation) {
      this._showRotation(data.rotation);
    }

    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Rotation visualization — arc + label showing rotation type
  // -----------------------------------------------------------
  _showRotation(rotation) {
    const { type, pivot, child } = rotation;
    const pivotMesh = this._nodes.get(pivot);
    const childMesh = this._nodes.get(child);
    if (!pivotMesh || !childMesh) return;

    const pPos = pivotMesh.position;
    const cPos = childMesh.position;

    // Draw a curved arc between pivot and child
    const mid = new THREE.Vector3().addVectors(pPos, cPos).multiplyScalar(0.5);
    const arcHeight = 2.0;
    mid.y += arcHeight;

    const segments = 20;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      pts.push(new THREE.Vector3(
        mt * mt * pPos.x + 2 * mt * t * mid.x + t * t * cPos.x,
        mt * mt * pPos.y + 2 * mt * t * mid.y + t * t * cPos.y,
        0
      ));
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, segments, 0.04, 6, false);
    const rotColor = type === 'left' ? 0x4fc97e : 0xffc44d;
    const tubeMat = new THREE.MeshStandardMaterial({
      color: rotColor,
      emissive: rotColor,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.7,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    this._scene.add(tube);
    this._rotationIndicators.push(tube);

    // Rotation type label
    const rotLabel = LabelSprite.create(
      type === 'left' ? '↩ Left Rotate' : '↪ Right Rotate',
      this._scene
    );
    rotLabel.setPosition(mid.x, mid.y + 0.5, 0);
    this._rotationIndicators.push(rotLabel);
  }


  // -----------------------------------------------------------
  //  Execute — same as BinaryTree, plus AVL-specific ops
  // -----------------------------------------------------------
  execute(op) {
    switch (op.type) {
      case 'highlight':
        this._highlight(op.nodeId);
        break;
      case 'rotate':
        if (op.pivot && op.child) {
          this._showRotation({ type: op.rotationType || 'left', pivot: op.pivot, child: op.child });
        }
        this._highlight(op.pivot);
        break;
      case 'update_balance':
        if (op.nodeId) this._highlight(op.nodeId);
        break;
      case 'flag_error':
        this._flagError(op.nodeId, op.errorType);
        break;
      default:
        super.execute(op);
    }
  }


  _getPositions() {
    // Return positions computed by BinaryTree's layout
    // We need to read the node map that BinaryTree creates internally
    const positions = new Map();
    for (const [id, mesh] of this._nodes) {
      positions.set(id, { x: mesh.position.x, y: mesh.position.y });
    }
    return positions;
  }


  dispose() {
    // Remove AVL overlays first
    for (const label of this._balanceLabels.values()) label.dispose();
    this._balanceLabels.clear();
    for (const label of this._heightLabels.values()) label.dispose();
    this._heightLabels.clear();
    for (const obj of this._rotationIndicators) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      if (obj.dispose) obj.dispose();
      this._scene.remove(obj);
    }
    this._rotationIndicators = [];

    super.dispose();
  }
}


export default AVLTree;
