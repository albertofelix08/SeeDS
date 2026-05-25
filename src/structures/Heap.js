// =============================================================
//  SeeDS — Heap.js
//  Renders a Binary Heap as both a tree structure and an
//  underlying array. Supports sift-up/sift-down animation.
//  JSON shape: { values[], operations[], heapType }
//  heapType: 'min' or 'max'
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, VISUAL } from '../core/constants.js';
import NodeMesh    from '../renderer/NodeMesh.js';
import EdgeMesh    from '../renderer/EdgeMesh.js';
import LabelSprite from '../renderer/LabelSprite.js';


class HeapStructure {
  constructor(scene, camera) {
    this._scene  = scene;
    this._camera = camera;

    this._nodes     = new Map();   // index → { mesh, label, data }
    this._edges     = new Map();   // "parentIdx→childIdx" → EdgeMesh
    this._slotMeshes = [];         // array view boxes
    this._slotLabels = [];
    this._data      = null;
    this._active    = null;
  }


  // -----------------------------------------------------------
  //  Build — tree view + array view
  // -----------------------------------------------------------
  build(data) {
    this._data = data;
    const values = data.values || [];
    const heapType = data.heapType || 'min';
    const n = values.length;

    if (n === 0) return;

    // === Tree view (left side) ===
    const nodeMap = new Map();
    const positions = new Map();
    this._layoutHeapNodes(values, 0, 0, 0, 1, positions);

    for (let i = 0; i < n; i++) {
      const pos = positions.get(i);
      if (!pos) continue;

      const nodeId = `h${i}`;
      const isRoot = i === 0;
      const isError = data.errors?.some(e => e.nodeId === nodeId);

      const nodeData = {
        id: nodeId,
        value: values[i],
        address: `idx[${i}]`,
        error: isError ? 'heap_violation' : null,
      };

      const mesh = NodeMesh.create(nodeData, this._scene);
      mesh.setPosition(pos.x, pos.y, 0);

      // Color by heap type
      if (isRoot) {
        const rootColor = heapType === 'min' ? VISUAL.HEAP_MIN_COLOR : VISUAL.HEAP_MAX_COLOR;
        mesh.mesh.material.color.setHex(rootColor);
        mesh.mesh.material.emissive.setHex(0x1a5c38);
      }

      this._nodes.set(i, { mesh, data: nodeData });

      const label = LabelSprite.create(String(values[i]), this._scene);
      label.setPosition(pos.x, pos.y + 1.6, 0);
      this._slotLabels.push(label);

      // Array index label in tree view — moved further down
      const idxLabel = LabelSprite.create(`[${i}]`, this._scene);
      idxLabel.setPosition(pos.x, pos.y - 1.5, 0);
      this._slotLabels.push(idxLabel);

      // Balance / BF label for non-leaf nodes
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;
      if (leftIdx < values.length || rightIdx < values.length) {
        // Empty, could add heap property marker here
      }
    }

    // Draw tree edges
    for (let i = 0; i < n; i++) {
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;
      const from = this._nodes.get(i);

      if (leftIdx < n && from) {
        const to = this._nodes.get(leftIdx);
        if (to) {
          const edge = EdgeMesh.create(from.mesh.position, to.mesh.position, this._scene);
          this._edges.set(`${i}→${leftIdx}`, edge);
        }
      }
      if (rightIdx < n && from) {
        const to = this._nodes.get(rightIdx);
        if (to) {
          const edge = EdgeMesh.create(from.mesh.position, to.mesh.position, this._scene);
          this._edges.set(`${i}→${rightIdx}`, edge);
        }
      }
    }

    // === Array view (below tree) ===
    const W = 0.9;
    const H = 0.6;
    const D = 0.3;
    const gap = 0.2;
    const step = W + gap;
    const totalW = n * step - gap;
    const startX = -totalW / 2 + W / 2;
    const arrY = positions.get(0)?.y - 8 || -10;

    const labelTitle = LabelSprite.create('Array representation:', this._scene);
    labelTitle.setPosition(0, arrY + 1.5, 0);
    this._slotLabels.push(labelTitle);

    for (let i = 0; i < n; i++) {
      const x = startX + i * step;
      const isActive = i === 0;

      const geo = new THREE.BoxGeometry(W, H, D);
      const mat = new THREE.MeshStandardMaterial({
        color:     isActive ? VISUAL.NODE_HOVER_COLOR : VISUAL.NODE_COLOR,
        emissive:  0x1a3a6e,
        emissiveIntensity: isActive ? 0.6 : 0.15,
        roughness: 0.3,
        metalness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, arrY, 0);
      mesh.castShadow = true;
      this._scene.add(mesh);
      this._slotMeshes.push(mesh);

      // Value label


      const label = LabelSprite.create(String(values[i]), this._scene);
      label.setPosition(x, arrY + H/2 + 0.8, 0);
      this._slotLabels.push(label);

      // Index label with more offset
      const idxLabel = LabelSprite.create(`[${i}]`, this._scene);
      idxLabel.setPosition(x, arrY - H/2 - 0.8, 0);
      this._slotLabels.push(idxLabel);
    }

    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Recursive layout for heap-as-tree
  // -----------------------------------------------------------
  _layoutHeapNodes(values, idx, level, xOffset, spread, positions) {
    if (idx >= values.length) return;

    const x = xOffset;
    const y = -level * LAYOUT.HEAP_LEVEL_HEIGHT;
    positions.set(idx, { x, y });

    const half = spread * LAYOUT.HEAP_H_SPREAD;
    const leftIdx = 2 * idx + 1;
    const rightIdx = 2 * idx + 2;

    if (leftIdx < values.length) {
      this._layoutHeapNodes(values, leftIdx, level + 1, x - half, half, positions);
    }
    if (rightIdx < values.length) {
      this._layoutHeapNodes(values, rightIdx, level + 1, x + half, half, positions);
    }
  }


  // -----------------------------------------------------------
  //  Execute
  // -----------------------------------------------------------
  execute(op) {
    switch (op.type) {
      case 'highlight':
        this._highlight(op.idx ?? op.nodeId);
        break;
      case 'sift_up':
        this._siftUp(op.idx);
        break;
      case 'sift_down':
        this._siftDown(op.idx);
        break;
      case 'swap':
        this._swapNodes(op.idx1, op.idx2);
        break;
      case 'flag_error':
        this._flagError(op.nodeId, op.errorType);
        break;
      default:
        if (op.idx !== undefined) this._highlight(op.idx);
        else if (op.nodeId) this._highlight(op.nodeId);
    }
  }

  _highlight(idx) {
    this._clearActive();
    const node = this._nodes.get(idx);
    if (node) {
      node.mesh.setActive(true);
      this._active = idx;
    }
    // Also highlight array slot
    if (this._slotMeshes[idx]) {
      this._slotMeshes[idx].material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      this._slotMeshes[idx].material.emissiveIntensity = 0.6;
    }
  }

  _siftUp(idx) {
    this._highlight(idx);
  }

  _siftDown(idx) {
    this._highlight(idx);
  }

  _swapNodes(idx1, idx2) {
    const n1 = this._nodes.get(idx1);
    const n2 = this._nodes.get(idx2);
    if (n1 && n2) {
      n1.mesh.setActive(true);
      n2.mesh.setActive(true);
    }
  }

  _flagError(nodeId, errorType) {
    // Try parsing nodeId as index
    const idx = parseInt(nodeId?.replace('h', '') || '0');
    const node = this._nodes.get(idx);
    if (node) node.mesh.setError(errorType);
  }

  _clearActive() {
    if (this._active !== null) {
      const prev = this._nodes.get(this._active);
      if (prev) prev.mesh.setActive(false);
      // Reset array slot
      if (this._slotMeshes[this._active]) {
        this._slotMeshes[this._active].material.color.setHex(VISUAL.NODE_COLOR);
        this._slotMeshes[this._active].material.emissiveIntensity = 0.15;
      }
      this._active = null;
    }
  }


  tick(delta, elapsed) {
    for (const node of this._nodes.values()) {
      node.mesh.tick(delta, elapsed);
    }
  }


  dispose() {
    for (const node of this._nodes.values()) node.mesh.dispose();
    this._nodes.clear();
    for (const edge of this._edges.values()) edge.dispose();
    this._edges.clear();
    for (const mesh of this._slotMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._scene.remove(mesh);
    }
    this._slotMeshes = [];
    for (const label of this._slotLabels) label.dispose();
    this._slotLabels = [];
    this._active = null;
  }
}


export default HeapStructure;
