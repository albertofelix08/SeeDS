// =============================================================
//  SeeDS — LinkedList.js
//  Builds and animates a singly linked list in 3D.
//  Reads the JSON shape: { nodes[], head, operations[] }
//  Each node has: { id, value, next, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, OP_TYPES, ERROR_TYPES } from '../core/constants.js';
import NodeMesh    from '../renderer/NodeMesh.js';
import EdgeMesh    from '../renderer/EdgeMesh.js';
import LabelSprite from '../renderer/LabelSprite.js';


class LinkedList {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    this._nodes   = new Map();   // id → NodeMesh
    this._edges   = new Map();   // "fromId→toId" → EdgeMesh
    this._labels  = new Map();   // id → LabelSprite
    this._data    = null;
    this._activeNode = null;
    this._activeEdge = null;
  }


  // -----------------------------------------------------------
  //  Build — called once when the DS is loaded
  // -----------------------------------------------------------
  build(data) {
    this._data = data;

    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
    const count   = data.nodes.filter(n => n.id !== 'null').length;
    const startX  = -((count - 1) * LAYOUT.LL_NODE_SPACING) / 2;

    let xIdx = 0;
    // Walk the list in order starting from head
    let curId = data.head;
    const visited = new Set();

    while (curId && !visited.has(curId)) {
      visited.add(curId);
      const node = nodeMap.get(curId);
      if (!node) break;

      const isNull = node.id === 'null' || node.value === null;
      const x = startX + xIdx * LAYOUT.LL_NODE_SPACING;
      const y = isNull ? LAYOUT.LL_Y : LAYOUT.LL_Y;

      const mesh = NodeMesh.create(node, this._scene);
      mesh.setPosition(x, y, 0);
      this._nodes.set(node.id, mesh);

      const label = LabelSprite.create(
        isNull ? 'NULL' : String(node.value),
        this._scene
      );
      label.setPosition(x, y + 1.1, 0);
      this._labels.set(node.id, label);

      xIdx++;
      curId = node.next;
    }

    // Draw edges
    for (const node of data.nodes) {
      if (!node.next || node.next === null) continue;
      const fromMesh = this._nodes.get(node.id);
      const toMesh   = this._nodes.get(node.next);
      if (!fromMesh || !toMesh) continue;

      const edge = EdgeMesh.create(
        fromMesh.position,
        toMesh.position,
        this._scene,
        { isError: node.error === ERROR_TYPES.DANGLING_POINTER }
      );
      this._edges.set(`${node.id}→${node.next}`, edge);
    }

    // Emit errors to ErrorPanel
    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Execute — called by PlaybackController for each step
  // -----------------------------------------------------------
  execute(op) {
    switch (op.type) {
      case OP_TYPES.HIGHLIGHT:
        this._highlight(op.nodeId);
        break;
      case OP_TYPES.TRAVERSE:
        this._traverse(op.from, op.to);
        break;
      case OP_TYPES.FLAG_ERROR:
        this._flagError(op.nodeId, op.errorType);
        break;
      default:
        console.warn('[LinkedList] Unknown op type:', op.type);
    }
  }


  // -----------------------------------------------------------
  //  Operation handlers
  // -----------------------------------------------------------
  _highlight(nodeId) {
    this._clearActive();
    const mesh = this._nodes.get(nodeId);
    if (mesh) {
      mesh.setActive(true);
      this._activeNode = mesh;
    }
  }

  _traverse(fromId, toId) {
    this._clearActive();

    const from = this._nodes.get(fromId);
    const to   = this._nodes.get(toId);
    if (from) { from.setActive(true);  this._activeNode = from; }

    const edgeKey = `${fromId}→${toId}`;
    const edge    = this._edges.get(edgeKey);
    if (edge) { edge.setActive(true); this._activeEdge = edge; }

    if (to) {
      // Brief highlight on destination after a tiny delay via flag
      setTimeout(() => {
        if (this._activeNode === from) {
          from?.setActive(false);
          edge?.setActive(false);
          to.setActive(true);
          this._activeNode = to;
          this._activeEdge = null;
        }
      }, 400);
    }
  }

  _flagError(nodeId, errorType) {
    const mesh = this._nodes.get(nodeId);
    if (mesh) mesh.setError(errorType);
  }

  _clearActive() {
    if (this._activeNode) { this._activeNode.setActive(false); this._activeNode = null; }
    if (this._activeEdge) { this._activeEdge.setActive(false); this._activeEdge = null; }
  }


  // -----------------------------------------------------------
  //  Per-frame tick
  // -----------------------------------------------------------
  tick(delta, elapsed) {
    for (const mesh of this._nodes.values()) {
      mesh.tick(delta, elapsed);
    }
  }


  // -----------------------------------------------------------
  //  Dispose — free all Three.js objects
  // -----------------------------------------------------------
  dispose() {
    for (const mesh  of this._nodes.values())  mesh.dispose();
    for (const edge  of this._edges.values())  edge.dispose();
    for (const label of this._labels.values()) label.dispose();
    this._nodes.clear();
    this._edges.clear();
    this._labels.clear();
    this._activeNode = null;
    this._activeEdge = null;
  }
}


export default LinkedList;