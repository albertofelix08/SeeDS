// =============================================================
//  SeeDS — Stack.js
//  Renders a Stack as vertical 3D boxes with push/pop/peek
//  animation. Each element is a flat box stacked upward.
//  JSON shape: { slots[], top, operations[] }
//  Each slot: { id, index, value, empty, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, VISUAL } from '../core/constants.js';
import LabelSprite from '../renderer/LabelSprite.js';


class StackStructure {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    this._boxes   = new Map();   // id → { mesh, label }
    this._active  = null;
    this._data    = null;
    this._topPtr  = null;        // LabelSprite for "top" arrow
    this._animating = false;
  }


  // -----------------------------------------------------------
  //  Build
  // -----------------------------------------------------------
  build(data) {
    this._data = data;

    const W   = VISUAL.STACK_BOX_SIZE;
    const D   = VISUAL.STACK_BOX_SIZE;
    const H   = VISUAL.STACK_BOX_HEIGHT;
    const gap = VISUAL.STACK_OFFSET_Y;
    const cx  = LAYOUT.STACK_CENTER_X;
    const baseY = LAYOUT.STACK_BASE_Y;

    const slots = data.slots || [];
    const totalHeight = slots.length * (H + gap) - gap;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const y = baseY + i * (H + gap);

      const geo = new THREE.BoxGeometry(W, H, D);
      const isError = !!slot.error;
      const isTop = (i === slots.length - 1);
      const mat = new THREE.MeshStandardMaterial({
        color:     isError ? VISUAL.ERROR_COLOR :
                   isTop   ? 0x5da8ff :
                             VISUAL.NODE_COLOR,
        emissive:  isError ? VISUAL.ERROR_EMISSIVE : 0x1a3a6e,
        emissiveIntensity: isTop ? 0.6 : 0.2,
        roughness: 0.3,
        metalness: 0.4,
        transparent: slot.empty,
        opacity:     slot.empty ? 0.3 : 1.0,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, y, 0);
      mesh.castShadow = true;
      mesh.userData.slotData = slot;
      this._scene.add(mesh);

      // Value label — placed higher above box to avoid overlap with next box
      const label = LabelSprite.create(
        slot.empty ? '' : String(slot.value),
        this._scene
      );
      label.setPosition(cx, y + H/2 + 1.8, 0);

      // Index label on the left side of the box — slightly below center
      const idxLabel = LabelSprite.create(`[${slot.index}]`, this._scene);
      idxLabel.setPosition(cx - W/2 - 1.4, y - 0.1, 0);

      this._boxes.set(slot.id, { mesh, label, idxLabel, data: slot });
    }

    // "TOP" pointer arrow at the top — higher position to avoid overlap
    if (slots.length > 0) {
      const topSlot = slots[slots.length - 1];
      const box = this._boxes.get(topSlot.id);
      if (box) {
        const topY = box.mesh.position.y + H/2;
        this._topPtr = LabelSprite.create('▼ TOP', this._scene);
        this._topPtr.setPosition(cx, topY + 3.0, 0);
      }
    }

    // Base label
    const baseLabel = LabelSprite.create('___', this._scene);
    baseLabel.setPosition(cx, baseY - H/2 - 0.5, 0);

    if (data.errors?.length) {
      eventBus.emit(EVENTS.ERROR_PANEL_UPDATE, { errors: data.errors });
    }
  }


  // -----------------------------------------------------------
  //  Execute
  // -----------------------------------------------------------
  execute(op) {
    switch (op.type) {
      case 'push':
        this._push(op.slotId, op.value);
        break;
      case 'pop':
        this._pop(op.slotId);
        break;
      case 'highlight':
        this._highlight(op.nodeId ?? op.slotId);
        break;
      case 'peek':
        this._peek(op.slotId);
        break;
      case 'flag_error':
        this._flagError(op.slotId, op.errorType);
        break;
      default:
        // Try highlight as fallback
        if (op.nodeId || op.slotId) this._highlight(op.nodeId ?? op.slotId);
    }
  }

  _push(slotId, value) {
    // Highlight the new top
    this._clearActive();
    const box = this._boxes.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(0x5da8ff);
      box.mesh.material.emissiveIntensity = 0.7;
      this._active = slotId;
    }
    // Move TOP pointer
    if (this._topPtr && box) {
      this._topPtr.setPosition(
        box.mesh.position.x,
        box.mesh.position.y + VISUAL.STACK_BOX_HEIGHT/2 + 2.5,
        0
      );
    }
  }

  _pop(slotId) {
    const box = this._boxes.get(slotId);
    if (box) {
      // Fade out the popped element
      box.mesh.material.transparent = true;
      box.mesh.material.opacity = 0.2;
      box.mesh.material.color.setHex(0x555a70);
      box.label.setText('');
    }
  }

  _peek(slotId) {
    this._clearActive();
    const box = this._boxes.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      box.mesh.material.emissiveIntensity = 0.8;
      box.mesh.scale.setScalar(1.05);
      this._active = slotId;
    }
  }

  _highlight(slotId) {
    this._clearActive();
    const box = this._boxes.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      box.mesh.material.emissiveIntensity = 0.6;
      box.mesh.scale.setScalar(1.05);
      this._active = slotId;
    }
  }

  _flagError(slotId, errorType) {
    const box = this._boxes.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(VISUAL.ERROR_COLOR);
      box.mesh.material.emissive.setHex(VISUAL.ERROR_EMISSIVE);
      box.mesh.material.emissiveIntensity = 0.6;
    }
  }

  _clearActive() {
    if (this._active) {
      const prev = this._boxes.get(this._active);
      if (prev) {
        prev.mesh.material.color.setHex(VISUAL.NODE_COLOR);
        prev.mesh.material.emissiveIntensity = 0.2;
        prev.mesh.scale.setScalar(1.0);
      }
      this._active = null;
    }
  }


  tick(delta, elapsed) {
    if (this._active) {
      const box = this._boxes.get(this._active);
      if (box) {
        const pulse = (Math.sin(elapsed * 4) + 1) / 2;
        box.mesh.material.emissiveIntensity = 0.4 + pulse * 0.4;
      }
    }
  }


  dispose() {
    for (const { mesh, label, idxLabel } of this._boxes.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._scene.remove(mesh);
      label.dispose();
      if (idxLabel) idxLabel.dispose();
    }
    this._boxes.clear();
    if (this._topPtr) this._topPtr.dispose();
    this._active = null;
  }
}


export default StackStructure;
