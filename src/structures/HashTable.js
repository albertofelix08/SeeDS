// =============================================================
//  SeeDS — HashTable.js
//  Renders a Hash Table as rows of bucket slots with chain
//  overlay. Supports insert/search/delete highlighting.
//  JSON shape: { buckets[], tableSize, operations[] }
//  Each bucket: { index, chain[] }
//  Each chain node: { id, key, value, next, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, VISUAL } from '../core/constants.js';
import NodeMesh    from '../renderer/NodeMesh.js';
import EdgeMesh    from '../renderer/EdgeMesh.js';
import LabelSprite from '../renderer/LabelSprite.js';


class HashTableStructure {
  constructor(scene, camera) {
    this._scene  = scene;
    this._camera = camera;

    this._buckets   = new Map();   // bucketIndex → { mesh, label, chain nodes }
    this._chainMeshes = new Map(); // nodeId → NodeMesh
    this._chainEdges  = new Map(); // "from→to" → EdgeMesh
    this._extra     = [];
    this._data      = null;
    this._active    = null;
  }


  // -----------------------------------------------------------
  //  Build
  // -----------------------------------------------------------
  build(data) {
    this._data = data;
    const buckets = data.buckets || [];
    const tableSize = data.tableSize || buckets.length;
    const startX = LAYOUT.HT_START_X;
    const startY = LAYOUT.HT_START_Y;
    const W = VISUAL.HT_BUCKET_WIDTH;
    const H = VISUAL.HT_BUCKET_HEIGHT;
    const gap = VISUAL.HT_BUCKET_GAP;

    for (let bi = 0; bi < tableSize; bi++) {
      const bucketData = buckets.find(b => b.index === bi);
      const chain = bucketData?.chain || [];
      const x = startX;
      const y = startY + bi * LAYOUT.HT_ROW_STEP_Y;

      // Bucket box
      const geo = new THREE.BoxGeometry(W, H, 0.4);
      const mat = new THREE.MeshStandardMaterial({
        color:     chain.length > 0 ? VISUAL.HT_BUCKET_COLOR : VISUAL.HT_EMPTY_COLOR,
        emissive:  chain.length > 0 ? 0x3a2a5e : 0x111118,
        emissiveIntensity: chain.length > 0 ? 0.3 : 0.1,
        roughness: 0.4,
        metalness: 0.3,
        transparent: chain.length === 0,
        opacity:     chain.length === 0 ? 0.5 : 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      mesh.castShadow = true;
      this._scene.add(mesh);

      // Bucket index label
      const idxLabel = LabelSprite.create(`[${bi}]`, this._scene);
      idxLabel.setPosition(x - W/2 - 0.3, y, 0);

      // "null" label for empty buckets
      if (chain.length === 0) {
        const nullLabel = LabelSprite.create('∅ empty', this._scene);
        nullLabel.setPosition(x + 0.8, y, 0);
        // store for cleanup
        this._extra.push(nullLabel);
      }

      this._buckets.set(bi, { mesh, label: idxLabel, data: bucketData });

      // Build chain nodes horizontally to the right
      // Increased spacing to prevent label overlap
      let prevNodeId = null;
      for (let ci = 0; ci < chain.length; ci++) {
        const node = chain[ci];
        const nx = x + W/2 + 1.0 + ci * 3.8;
        const ny = y;

        const nodeMesh = NodeMesh.create(node, this._scene);
        nodeMesh.setPosition(nx, ny, 0);
        this._chainMeshes.set(node.id, nodeMesh);

        // Better formatted label: key = value — position further above to avoid overlap
        const valLabel = LabelSprite.create(
          `${node.key}:${node.value}`,
          this._scene
        );
        valLabel.setPosition(nx, ny + 2.2, 0);
        this._extra.push(valLabel);

        // Arrow edge from previous chain node
        if (prevNodeId) {
          const from = this._chainMeshes.get(prevNodeId);
          if (from) {
            const edge = EdgeMesh.create(from.position, nodeMesh.position, this._scene);
            this._chainEdges.set(`${prevNodeId}→${node.id}`, edge);
          }
        }

        prevNodeId = node.id;
      }

      // Arrow label from bucket to first chain node — placed to the side to avoid overlap
      if (chain.length > 0) {
        const firstNode = this._chainMeshes.get(chain[0].id);
        if (firstNode) {
          const midX = (x + W/2) + (firstNode.position.x - (x + W/2)) / 2;
          const arrowLabel = LabelSprite.create('→', this._scene);
          arrowLabel.setPosition(midX, y + 0.6, 0);
          this._extra.push(arrowLabel);
        }
      }

      // NULL terminator at end of chain — move below to avoid overlap
      if (chain.length > 0 && prevNodeId) {
        const nullLabel = LabelSprite.create('NULL', this._scene);
        const lastMesh = this._chainMeshes.get(prevNodeId);
        if (lastMesh) {
          nullLabel.setPosition(lastMesh.position.x + 1.5, lastMesh.position.y - 0.3, 0);
          this._extra.push(nullLabel);
        }
      }
    }

    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Execute
  // -----------------------------------------------------------
  execute(op) {
    switch (op.type) {
      case 'highlight':
        this._highlight(op.nodeId);
        break;
      case 'insert':
        this._highlight(op.nodeId);
        break;
      case 'search':
        this._highlight(op.nodeId);
        break;
      case 'delete':
        this._fadeOut(op.nodeId);
        break;
      case 'flag_error':
        this._flagError(op.nodeId, op.errorType);
        break;
      default:
        if (op.nodeId) this._highlight(op.nodeId);
    }
  }

  _highlight(nodeId) {
    this._clearActive();
    const mesh = this._chainMeshes.get(nodeId);
    if (mesh) {
      mesh.setActive(true);
      this._active = nodeId;
    }
  }

  _fadeOut(nodeId) {
    const mesh = this._chainMeshes.get(nodeId);
    if (mesh) {
      mesh.mesh.material.transparent = true;
      mesh.mesh.material.opacity = 0.2;
    }
  }

  _flagError(nodeId, errorType) {
    const mesh = this._chainMeshes.get(nodeId);
    if (mesh) mesh.setError(errorType);
  }

  _clearActive() {
    if (this._active) {
      const prev = this._chainMeshes.get(this._active);
      if (prev) prev.setActive(false);
      this._active = null;
    }
  }


  tick(delta, elapsed) {
    for (const mesh of this._chainMeshes.values()) {
      mesh.tick(delta, elapsed);
    }
  }


  dispose() {
    for (const { mesh, label } of this._buckets.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._scene.remove(mesh);
      label.dispose();
    }
    this._buckets.clear();

    for (const mesh of this._chainMeshes.values()) mesh.dispose();
    this._chainMeshes.clear();

    for (const edge of this._chainEdges.values()) edge.dispose();
    this._chainEdges.clear();

    for (const obj of this._extra) {
      if (obj.dispose) obj.dispose();
      else if (obj.geometry) { obj.geometry.dispose(); obj.material.dispose(); this._scene.remove(obj); }
      else this._scene.remove(obj);
    }
    this._extra = [];
    this._active = null;
  }
}


export default HashTableStructure;
