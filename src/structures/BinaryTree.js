// =============================================================
//  SeeDS — BinaryTree.js
//  Builds and animates a binary tree in 3D.
//  JSON shape: { nodes[], root, operations[] }
//  Each node: { id, value, left, right, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, OP_TYPES } from '../core/constants.js';
import NodeMesh    from '../renderer/NodeMesh.js';
import EdgeMesh    from '../renderer/EdgeMesh.js';
import LabelSprite from '../renderer/LabelSprite.js';


class BinaryTree {
  constructor(scene, camera) {
    this._scene  = scene;
    this._camera = camera;

    this._nodes  = new Map();   // id → NodeMesh
    this._edges  = new Map();   // "parentId→childId" → EdgeMesh
    this._labels = new Map();   // id → LabelSprite
    this._data   = null;
    this._activeNode = null;
    this._activeEdge = null;
  }


  // -----------------------------------------------------------
  //  Build
  // -----------------------------------------------------------
  build(data) {
    this._data = data;
    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

    // Compute positions with a recursive layout pass
    const positions = new Map();
    this._layoutNode(data.root, 0, 0, 1, nodeMap, positions);

    // Create meshes
    for (const [id, pos] of positions) {
      const node = nodeMap.get(id);
      const mesh = NodeMesh.create(node, this._scene);
      mesh.setPosition(pos.x, pos.y, 0);
      this._nodes.set(id, mesh);

      const label = LabelSprite.create(String(node.value), this._scene);
      label.setPosition(pos.x, pos.y + 1.1, 0);
      this._labels.set(id, label);
    }

    // Draw edges
    for (const node of data.nodes) {
      for (const childKey of ['left', 'right']) {
        const childId = node[childKey];
        if (!childId) continue;
        const from = this._nodes.get(node.id);
        const to   = this._nodes.get(childId);
        if (!from || !to) continue;
        const edge = EdgeMesh.create(from.position, to.position, this._scene);
        this._edges.set(`${node.id}→${childId}`, edge);
      }
    }

    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Recursive position layout
  //  level   — depth (0 = root)
  //  xOffset — horizontal centre of this subtree
  //  spread  — half-width of the subtree at this level
  // -----------------------------------------------------------
  _layoutNode(id, level, xOffset, spread, nodeMap, positions) {
    if (!id || !nodeMap.has(id)) return;
    const node = nodeMap.get(id);

    const x = xOffset;
    const y = -level * LAYOUT.TREE_LEVEL_HEIGHT;
    positions.set(id, { x, y });

    const half = spread * LAYOUT.TREE_H_SPREAD;
    if (node.left)  this._layoutNode(node.left,  level + 1, x - half, half, nodeMap, positions);
    if (node.right) this._layoutNode(node.right, level + 1, x + half, half, nodeMap, positions);
  }


  // -----------------------------------------------------------
  //  Execute
  // -----------------------------------------------------------
  execute(op) {
    switch (op.type) {
      case 'highlight': this._highlight(op.nodeId); break;
      case 'traverse':  this._traverse(op.from, op.to); break;
      default: console.warn('[BinaryTree] Unknown op:', op.type);
    }
  }

  _highlight(nodeId) {
    this._clearActive();
    const mesh = this._nodes.get(nodeId);
    if (mesh) { mesh.setActive(true); this._activeNode = mesh; }
  }

  _traverse(fromId, toId) {
    this._clearActive();
    const from = this._nodes.get(fromId);
    const to   = this._nodes.get(toId);
    const edge = this._edges.get(`${fromId}→${toId}`);

    if (from) { from.setActive(true); this._activeNode = from; }
    if (edge) { edge.setActive(true); this._activeEdge = edge; }

    if (to) {
      setTimeout(() => {
        from?.setActive(false);
        edge?.setActive(false);
        to.setActive(true);
        this._activeNode = to;
        this._activeEdge = null;
      }, 400);
    }
  }

  _clearActive() {
    if (this._activeNode) { this._activeNode.setActive(false); this._activeNode = null; }
    if (this._activeEdge) { this._activeEdge.setActive(false); this._activeEdge = null; }
  }

  tick(delta, elapsed) {
    for (const mesh of this._nodes.values()) mesh.tick(delta, elapsed);
  }

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


export default BinaryTree;