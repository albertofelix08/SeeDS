// =============================================================
//  SeeDS — Graph.js
//  Renders a Graph with vertices as 3D spheres and edges as
//  line segments. Supports BFS/DFS traversal highlighting.
//  JSON shape: { vertices[], edges[], directed, operations[] }
//  Each vertex: { id, label, visited, error }
//  Each edge: { from, to, weight, visited }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, VISUAL, OP_TYPES } from '../core/constants.js';
import LabelSprite from '../renderer/LabelSprite.js';


class GraphStructure {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    this._vertices  = new Map();   // id → { mesh, label, data }
    this._edges     = new Map();   // "from→to" → { line, arrow, label }
    this._extra     = [];
    this._data      = null;
    this._activeVert = null;
  }


  // -----------------------------------------------------------
  //  Build
  // -----------------------------------------------------------
  build(data) {
    this._data = data;
    const verts = data.vertices || [];
    const edges = data.edges   || [];
    const n = verts.length;
    const radius = LAYOUT.GRAPH_RADIUS;

    // Arrange vertices in a circle if no positions given
    for (let i = 0; i < n; i++) {
      const v = verts[i];
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = (v.x !== undefined) ? v.x : radius * Math.cos(angle);
      const z = (v.z !== undefined) ? v.z : radius * Math.sin(angle);
      const y = (v.y !== undefined) ? v.y : 0;

      const geo = new THREE.SphereGeometry(VISUAL.GRAPH_VERTEX_RADIUS, 24, 24);
      const isVisited = !!v.visited;
      const isError = !!v.error;
      const mat = new THREE.MeshStandardMaterial({
        color:     isError ? VISUAL.ERROR_COLOR :
                   isVisited ? VISUAL.GRAPH_VISITED_COLOR :
                               VISUAL.GRAPH_VERTEX_COLOR,
        emissive:  isError ? VISUAL.ERROR_EMISSIVE :
                   isVisited ? 0x1a5c38 :
                               VISUAL.GRAPH_VERTEX_EMISSIVE,
        emissiveIntensity: isVisited ? 0.5 : 0.3,
        roughness: 0.3,
        metalness: 0.4,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.userData.graphData = v;
      this._scene.add(mesh);
      this._vertices.set(v.id, { mesh, data: v });

      // Label
      const label = LabelSprite.create(v.label || String(v.id), this._scene);
      label.setPosition(x, y + VISUAL.GRAPH_VERTEX_RADIUS + 0.6, z);
    }

    // Draw edges
    for (const e of edges) {
      const from = this._vertices.get(e.from);
      const to   = this._vertices.get(e.to);
      if (!from || !to) continue;

      const fPos = from.mesh.position;
      const tPos = to.mesh.position;

      // Direction vector for offsetting from sphere surfaces
      const dir = new THREE.Vector3().subVectors(tPos, fPos).normalize();
      const start = fPos.clone().addScaledVector(dir, VISUAL.GRAPH_VERTEX_RADIUS + 0.05);
      const end   = tPos.clone().addScaledVector(dir, -(VISUAL.GRAPH_VERTEX_RADIUS + 0.05));

      // Edge line
      const points = [start, end];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color:    e.visited ? VISUAL.GRAPH_VISITED_COLOR : VISUAL.GRAPH_EDGE_DEFAULT,
        linewidth: 1,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      this._scene.add(line);
      this._extra.push(line);

      // Arrowhead for directed graphs
      if (data.directed) {
        const arrowLen = 0.35;
        const arrowDir = new THREE.Vector3().subVectors(end, start).normalize();
        const arrowPos = end.clone().sub(arrowDir.clone().multiplyScalar(0.1));

        const coneGeo = new THREE.ConeGeometry(0.12, arrowLen, 6);
        const coneMat = new THREE.MeshStandardMaterial({
          color: e.visited ? VISUAL.GRAPH_VISITED_COLOR : VISUAL.GRAPH_EDGE_DEFAULT,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.copy(arrowPos);
        // Rotate cone to point along direction
        const up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(arrowDir.dot(up)) < 0.999) {
          cone.quaternion.setFromUnitVectors(up, arrowDir);
        } else {
          cone.rotation.set(arrowDir.y < 0 ? Math.PI : 0, 0, 0);
        }
        this._scene.add(cone);
        this._extra.push(cone);
      }

      // Weight label
      if (e.weight !== undefined && e.weight !== null) {
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const wLabel = LabelSprite.create(String(e.weight), this._scene);
        wLabel.setPosition(mid.x, mid.y + 0.4, mid.z);
        this._extra.push(wLabel);
      }

      this._edges.set(`${e.from}→${e.to}`, { line, data: e });
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
      case 'visit_vertex':
        this._visitVertex(op.nodeId);
        break;
      case 'traverse_edge':
        this._traverseEdge(op.from, op.to);
        break;
      case 'bfs_step':
      case 'dfs_step':
        if (op.nodeId) this._visitVertex(op.nodeId);
        if (op.edgeFrom && op.edgeTo) this._traverseEdge(op.edgeFrom, op.edgeTo);
        break;
      case 'flag_error':
        this._flagError(op.nodeId, op.errorType);
        break;
      default:
        if (op.nodeId) this._highlight(op.nodeId);
    }
  }

  _highlight(vertId) {
    this._clearActive();
    const v = this._vertices.get(vertId);
    if (v) {
      v.mesh.material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      v.mesh.material.emissiveIntensity = 0.7;
      v.mesh.scale.setScalar(1.15);
      this._activeVert = vertId;
    }
  }

  _visitVertex(vertId) {
    const v = this._vertices.get(vertId);
    if (v && !v.data.visited) {
      v.data.visited = true;
      v.mesh.material.color.setHex(VISUAL.GRAPH_VISITED_COLOR);
      v.mesh.material.emissive.setHex(0x1a5c38);
      v.mesh.material.emissiveIntensity = 0.5;
      v.mesh.scale.setScalar(1.1);
    }
    this._activeVert = vertId;
  }

  _traverseEdge(fromId, toId) {
    const edge = this._edges.get(`${fromId}→${toId}`);
    if (edge) {
      edge.line.material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      edge.line.material.opacity = 1.0;
      edge.data.visited = true;
    }
  }

  _flagError(vertId, errorType) {
    const v = this._vertices.get(vertId);
    if (v) {
      v.mesh.material.color.setHex(VISUAL.ERROR_COLOR);
      v.mesh.material.emissive.setHex(VISUAL.ERROR_EMISSIVE);
      v.mesh.material.emissiveIntensity = 0.6;
    }
  }

  _clearActive() {
    if (this._activeVert) {
      const prev = this._vertices.get(this._activeVert);
      if (prev && !prev.data.visited) {
        prev.mesh.material.color.setHex(VISUAL.GRAPH_VERTEX_COLOR);
        prev.mesh.material.emissiveIntensity = 0.3;
        prev.mesh.scale.setScalar(1.0);
      }
      this._activeVert = null;
    }
  }


  tick(delta, elapsed) {
    if (this._activeVert) {
      const v = this._vertices.get(this._activeVert);
      if (v) {
        const pulse = (Math.sin(elapsed * 3) + 1) / 2;
        v.mesh.material.emissiveIntensity = 0.4 + pulse * 0.4;
      }
    }
  }


  dispose() {
    for (const { mesh } of this._vertices.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._scene.remove(mesh);
    }
    this._vertices.clear();

    for (const obj of this._extra) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      if (obj.dispose) obj.dispose();
      this._scene.remove(obj);
    }
    this._extra = [];
    this._edges.clear();
    this._activeVert = null;
  }
}


export default GraphStructure;
