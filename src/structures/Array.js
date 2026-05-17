// =============================================================
//  SeeDS — Array.js
//  Renders a flat array as a row of 3D box slots.
//  JSON shape: { slots[], length, operations[] }
//  Each slot: { id, index, value, empty, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, VISUAL } from '../core/constants.js';
import LabelSprite from '../renderer/LabelSprite.js';


class ArrayStructure {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    // id → { mesh, label, data }
    this._slots   = new Map();
    this._active  = null;
    this._data    = null;
  }


  // -----------------------------------------------------------
  //  Build
  // -----------------------------------------------------------
  build(data) {
    this._data = data;

    const W   = LAYOUT.ARRAY_SLOT_WIDTH;
    const H   = LAYOUT.ARRAY_SLOT_HEIGHT;
    const D   = LAYOUT.ARRAY_SLOT_DEPTH;
    const GAP = LAYOUT.ARRAY_GAP;
    const step = W + GAP;
    const totalW = data.slots.length * step - GAP;
    const startX = -totalW / 2 + W / 2;

    for (const slot of data.slots) {
      const x = startX + slot.index * step;

      // Box geometry for each slot
      const geo = new THREE.BoxGeometry(W, H, D);
      const isError = !!slot.error;
      const mat = new THREE.MeshStandardMaterial({
        color:     isError ? VISUAL.ERROR_COLOR : VISUAL.NODE_COLOR,
        emissive:  isError ? VISUAL.ERROR_EMISSIVE : VISUAL.NODE_EMISSIVE,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.4,
        transparent: slot.empty,
        opacity:     slot.empty ? 0.3 : 1.0,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0, 0);
      mesh.castShadow = true;
      mesh.userData.slotData = slot;
      this._scene.add(mesh);

      // Value label (inside box)
      const label = LabelSprite.create(
        slot.empty ? '' : String(slot.value),
        this._scene
      );
      label.setPosition(x, 0, D / 2 + 0.05);

      // Index label (below box)
      const idxLabel = LabelSprite.create(`[${slot.index}]`, this._scene);
      idxLabel.setPosition(x, -H / 2 - 0.5, 0);

      this._slots.set(slot.id, { mesh, label, idxLabel, data: slot });
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
      case 'highlight': this._highlight(op.slotId ?? op.nodeId); break;
      case 'flag_error': this._flagError(op.slotId, op.errorType); break;
      default: console.warn('[Array] Unknown op:', op.type);
    }
  }

  _highlight(slotId) {
    // Clear previous
    if (this._active) {
      const prev = this._slots.get(this._active);
      if (prev) {
        prev.mesh.material.emissiveIntensity = 0.3;
        prev.mesh.scale.setScalar(1.0);
      }
    }

    this._active = slotId;
    const slot = this._slots.get(slotId);
    if (slot) {
      slot.mesh.material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      slot.mesh.material.emissiveIntensity = 0.7;
      slot.mesh.scale.setScalar(1.08);
    }
  }

  _flagError(slotId, errorType) {
    const slot = this._slots.get(slotId);
    if (slot) {
      slot.mesh.material.color.setHex(VISUAL.ERROR_COLOR);
      slot.mesh.material.emissive.setHex(VISUAL.ERROR_EMISSIVE);
      slot.mesh.material.emissiveIntensity = 0.6;
    }
  }

  tick(delta, elapsed) {
    // Pulse active slot
    if (this._active) {
      const slot = this._slots.get(this._active);
      if (slot) {
        const pulse = (Math.sin(elapsed * 4) + 1) / 2;
        slot.mesh.material.emissiveIntensity = 0.4 + pulse * 0.4;
      }
    }
  }

  dispose() {
    for (const { mesh, label, idxLabel } of this._slots.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._scene.remove(mesh);
      label.dispose();
      idxLabel.dispose();
    }
    this._slots.clear();
    this._active = null;
  }
}


export default ArrayStructure;