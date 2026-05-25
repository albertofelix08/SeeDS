// =============================================================
//  SeeDS — LinkedList.js
//  Builds and animates a singly linked list in 3D.
//  Reads the JSON shape: { nodes[], head, operations[] }
//  Each node has: { id, value, next, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, OP_TYPES, ERROR_TYPES, VISUAL } from '../core/constants.js';
import NodeMesh    from '../renderer/NodeMesh.js';
import EdgeMesh    from '../renderer/EdgeMesh.js';
import LabelSprite from '../renderer/LabelSprite.js';


class LinkedList {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    this._nodes       = new Map();   // id → NodeMesh
    this._edges       = new Map();   // "fromId→toId" → EdgeMesh
    this._labels      = new Map();   // id → LabelSprite
    this._extraMeshes = [];          // THREE objects added directly (cycle arc, ghost edge, etc.)
    this._data        = null;
    this._activeNode  = null;
    this._activeEdge  = null;

    // Leak animation state
    this._leakMeshes  = [];          // { mesh, baseZ, label } for drifting ghost nodes
    this._elapsed     = 0;
  }


  // -----------------------------------------------------------
  //  Build — called once when the DS is loaded
  // -----------------------------------------------------------
  build(data) {
    this._data = data;

    const nodeMap   = new Map(data.nodes.map(n => [n.id, n]));
    const hasCycle  = data.nodes.some(n => n.error === ERROR_TYPES.CYCLE);
    const hasLeak   = data.nodes.some(n => n.error === ERROR_TYPES.MEMORY_LEAK);

    // Collect the "main chain" node ids (walk from head, stop at cycle or null)
    const mainChain = [];
    {
      let curId = data.head;
      const visited = new Set();
      while (curId && !visited.has(curId)) {
        visited.add(curId);
        const node = nodeMap.get(curId);
        if (!node) break;
        mainChain.push(node.id);
        curId = node.next;
      }
    }
    const mainChainSet = new Set(mainChain);

    // Layout: center the main chain horizontally
    const mainCount = mainChain.filter(id => id !== 'null').length;
    const startX    = -((mainCount - 1) * LAYOUT.LL_NODE_SPACING) / 2;

    // ---- Place main-chain nodes ----
    mainChain.forEach((id, xIdx) => {
      const node   = nodeMap.get(id);
      if (!node) return;
      const isNull = node.id === 'null' || node.value === null;
      const x      = startX + xIdx * LAYOUT.LL_NODE_SPACING;
      const y      = LAYOUT.LL_Y;

      const mesh = NodeMesh.create(node, this._scene);
      mesh.setPosition(x, y, 0);
      this._nodes.set(node.id, mesh);

      const label = LabelSprite.create(isNull ? 'NULL' : String(node.value), this._scene);
      label.setPosition(x, y + 1.1, 0);
      this._labels.set(node.id, label);
    });

    // ---- Place off-chain nodes (dangling / leaked) ----
    let offChainIdx = 0;
    for (const node of data.nodes) {
      if (mainChainSet.has(node.id)) continue;

      if (node.error === ERROR_TYPES.DANGLING_POINTER) {
        // Float high above the row, slightly offset horizontally
        const x = startX + offChainIdx * LAYOUT.LL_NODE_SPACING;
        const y = LAYOUT.LL_DANGLING_Y;          // defined in constants (3.5)

        const mesh = NodeMesh.create(node, this._scene);
        mesh.setPosition(x, y, 0);
        this._nodes.set(node.id, mesh);

        const label = LabelSprite.create(String(node.value), this._scene);
        label.setPosition(x, y + 1.1, 0);
        this._labels.set(node.id, label);

        // Broken edge stub — short dashed-style line pointing downward,
        // colored red to show "broken link"
        this._buildBrokenEdgeStub(x, y);

        // "UNREACHABLE" badge label below the node
        const badge = LabelSprite.create('UNREACHABLE', this._scene);
        badge.setPosition(x, y - 1.2, 0);
        this._labels.set(node.id + '_badge', badge);

        offChainIdx++;

      } else if (node.error === ERROR_TYPES.MEMORY_LEAK) {
        // Ghost node: drifts back in Z, faded orange
        this._buildLeakGhost(node, startX, mainCount);
      }
    }

    // ---- Draw normal edges for the main chain ----
    for (const node of data.nodes) {
      if (!node.next || node.next === null) continue;
      const fromMesh = this._nodes.get(node.id);
      const toMesh   = this._nodes.get(node.next);
      if (!fromMesh || !toMesh) continue;

      // Skip cycle back-edge — we draw the arc instead
      if (hasCycle && node.error === ERROR_TYPES.CYCLE) {
        const toNode = nodeMap.get(node.next);
        if (toNode && toNode.error === ERROR_TYPES.CYCLE) {
          // Check if this is the back-edge (pointing to an earlier node)
          const fromIdx = mainChain.indexOf(node.id);
          const toIdx   = mainChain.indexOf(node.next);
          if (toIdx < fromIdx) continue;  // this is the back-edge, skip straight arrow
        }
      }

      const edge = EdgeMesh.create(
        fromMesh.position,
        toMesh.position,
        this._scene,
        { isError: node.error === ERROR_TYPES.DANGLING_POINTER }
      );
      this._edges.set(`${node.id}→${node.next}`, edge);
    }

    // ---- Cycle: draw the arc back-edge ----
    if (hasCycle && data.cycleEntry) {
      this._buildCycleArc(data, mainChain);
    }

    // Emit errors to ErrorPanel
    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Cycle arc — a curved arrow looping back above the nodes
  // -----------------------------------------------------------
  _buildCycleArc(data, mainChain) {
    // Find the tail of the cycle (last node whose next = cycleEntry)
    const cycleNodes = data.nodes.filter(n => n.error === ERROR_TYPES.CYCLE);
    const tail = cycleNodes.find(n => n.next === data.cycleEntry);
    if (!tail) return;

    const fromMesh = this._nodes.get(tail.id);
    const toMesh   = this._nodes.get(data.cycleEntry);
    if (!fromMesh || !toMesh) return;

    const from = fromMesh.position.clone();
    const to   = toMesh.position.clone();

    // Arc rises above the nodes — the higher the arc the more obvious the loop
    const arcHeight = 4.5;
    const arcPoints = this._buildArcPoints(from, to, arcHeight, 40);

    // Tube along the arc
    const curve  = new THREE.CatmullRomCurve3(arcPoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 40, VISUAL.EDGE_THICKNESS * 1.4, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color:            VISUAL.ERROR_COLOR,
      emissive:         VISUAL.ERROR_EMISSIVE,
      emissiveIntensity: 0.6,
      roughness:        0.3,
      metalness:        0.3,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    this._scene.add(tube);
    this._extraMeshes.push(tube);

    // Arrowhead cone at the 'to' end, pointing in the arc's final direction
    const lastDir = new THREE.Vector3()
      .subVectors(arcPoints[arcPoints.length - 1], arcPoints[arcPoints.length - 3])
      .normalize();

    const headSize = VISUAL.ARROW_HEAD_SIZE * 1.6;
    const coneGeo  = new THREE.ConeGeometry(headSize, headSize * 2, 8);
    const coneMat  = new THREE.MeshStandardMaterial({
      color:            VISUAL.ERROR_COLOR,
      emissive:         VISUAL.ERROR_EMISSIVE,
      emissiveIntensity: 0.6,
      roughness:        0.3,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);

    // Position cone tip at the target node surface
    const tipPos = to.clone().addScaledVector(lastDir, -(VISUAL.NODE_RADIUS + 0.08));
    cone.position.copy(tipPos);

    // Rotate cone to align with arc direction
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(lastDir.dot(up)) < 0.999) {
      cone.setRotationFromQuaternion(
        new THREE.Quaternion().setFromUnitVectors(up, lastDir)
      );
    }

    this._scene.add(cone);
    this._extraMeshes.push(cone);

    // "CYCLE" label floating above the arc midpoint
    const midPt  = arcPoints[Math.floor(arcPoints.length / 2)];
    const cycleLabel = LabelSprite.create('⟳ CYCLE', this._scene);
    cycleLabel.setPosition(midPt.x, midPt.y + 0.7, midPt.z);
    this._labels.set('_cycle_label', cycleLabel);
  }

  // Build evenly-spaced arc points from `from` to `to` with a peak above both
  _buildArcPoints(from, to, height, segments) {
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mid.y += height;

    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t  = i / segments;
      // Quadratic bezier: B(t) = (1-t)²·from + 2(1-t)t·mid + t²·to
      const mt = 1 - t;
      pts.push(new THREE.Vector3(
        mt * mt * from.x + 2 * mt * t * mid.x + t * t * to.x,
        mt * mt * from.y + 2 * mt * t * mid.y + t * t * to.y,
        mt * mt * from.z + 2 * mt * t * mid.z + t * t * to.z,
      ));
    }
    return pts;
  }


  // -----------------------------------------------------------
  //  Dangling pointer — broken edge stub pointing downward
  //  Looks like a severed wire dangling under the floating node
  // -----------------------------------------------------------
  _buildBrokenEdgeStub(x, y) {
    const stubLen = 1.4;
    const pts = [
      new THREE.Vector3(x, y - VISUAL.NODE_RADIUS - 0.1, 0),
      new THREE.Vector3(x, y - VISUAL.NODE_RADIUS - stubLen, 0),
    ];
    const geo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts), 4, VISUAL.EDGE_THICKNESS, 6, false
    );
    const mat = new THREE.MeshStandardMaterial({
      color:            VISUAL.ERROR_COLOR,
      emissive:         VISUAL.ERROR_EMISSIVE,
      emissiveIntensity: 0.5,
      roughness:        0.4,
    });
    const stub = new THREE.Mesh(geo, mat);
    this._scene.add(stub);
    this._extraMeshes.push(stub);

    // Small X marker at the broken end
    const xSize = 0.22;
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const barGeo = new THREE.BoxGeometry(xSize * 2, xSize * 0.18, xSize * 0.18);
      const barMat = new THREE.MeshStandardMaterial({ color: VISUAL.ERROR_COLOR });
      const bar    = new THREE.Mesh(barGeo, barMat);
      bar.rotation.z = angle;
      bar.position.set(x, y - VISUAL.NODE_RADIUS - stubLen - 0.1, 0);
      this._scene.add(bar);
      this._extraMeshes.push(bar);
    }
  }


  // -----------------------------------------------------------
  //  Memory leak ghost — node drifts behind the scene in Z,
  //  rendered semi-transparent in an eerie amber/orange
  // -----------------------------------------------------------
  _buildLeakGhost(node, startX, mainCount) {
    const geo = new THREE.SphereGeometry(VISUAL.NODE_RADIUS, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color:        0xff8c00,   // amber-orange
      emissive:     0x7a3800,
      emissiveIntensity: 0.5,
      transparent:  true,
      opacity:      0.45,
      roughness:    0.6,
      metalness:    0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Position: off to the right, slightly above, pushed back in Z
    const baseX  = (mainCount * LAYOUT.LL_NODE_SPACING) / 2 + 1.5;
    const baseY  = 1.2;
    const baseZ  = -6;
    mesh.position.set(baseX, baseY, baseZ);
    this._scene.add(mesh);
    this._extraMeshes.push(mesh);

    // Value label on the ghost
    const label = LabelSprite.create(String(node.value), this._scene);
    label.setPosition(baseX, baseY + 1.4, baseZ);
    this._labels.set(node.id, label);

    // Address label below
    const addrLabel = LabelSprite.create(node.address ?? '???', this._scene);
    addrLabel.setPosition(baseX, baseY - 1.3, baseZ);
    this._labels.set(node.id + '_addr', addrLabel);

    // "LEAKED" badge
    const badge = LabelSprite.create('LEAKED', this._scene);
    badge.setPosition(baseX, baseY - 2.0, baseZ);
    this._labels.set(node.id + '_badge', badge);

    // Store for animation
    this._leakMeshes.push({ mesh, label, baseX, baseY, baseZ });
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
      case OP_TYPES.CYCLE_DETECT:
        // Nodes are already red; the arc is already drawn. Nothing extra needed.
        break;
      case OP_TYPES.LEAK_SHOW:
        // Ghost is already placed; could add a pulse here in future.
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
    this._elapsed = elapsed;

    for (const mesh of this._nodes.values()) {
      mesh.tick(delta, elapsed);
    }

    // Animate leaked ghost nodes — slow drift + gentle float
    for (const ghost of this._leakMeshes) {
      const drift = Math.sin(elapsed * 0.4) * 0.3;
      const bob   = Math.sin(elapsed * 0.9 + 1.2) * 0.15;
      ghost.mesh.position.z  = ghost.baseZ + drift;
      ghost.mesh.position.y  = ghost.baseY + bob;
      // Pulse opacity to reinforce "something is wrong here"
      ghost.mesh.material.opacity = 0.3 + Math.sin(elapsed * 1.1) * 0.15;
    }
  }


  // -----------------------------------------------------------
  //  Dispose — free all Three.js objects
  // -----------------------------------------------------------
  dispose() {
    for (const mesh  of this._nodes.values())  mesh.dispose();
    for (const edge  of this._edges.values())  edge.dispose();
    for (const label of this._labels.values()) label.dispose();
    for (const obj   of this._extraMeshes) {
      obj.geometry?.dispose();
      obj.material?.dispose();
      this._scene.remove(obj);
    }
    this._nodes.clear();
    this._edges.clear();
    this._labels.clear();
    this._extraMeshes = [];
    this._leakMeshes  = [];
    this._activeNode  = null;
    this._activeEdge  = null;
  }
}


export default LinkedList;