// =============================================================
//  SeeDS — Queue.js
//  Renders a Queue as horizontal 3D slots with front/rear
//  pointer arrows. Supports enqueue/dequeue animation.
//  JSON shape: { slots[], front, rear, length, operations[] }
//  Each slot: { id, index, value, empty, error }
// =============================================================

import * as THREE  from '../../vendor/three/three.module.js';
import eventBus    from '../core/eventBus.js';
import { EVENTS, LAYOUT, VISUAL } from '../core/constants.js';
import LabelSprite from '../renderer/LabelSprite.js';


class QueueStructure {
  constructor(scene, camera) {
    this._scene  = scene;
    this._camera = camera;

    this._slots     = new Map();   // id → { mesh, label, idxLabel }
    this._active    = null;
    this._data      = null;
    this._frontPtr  = null;        // LabelSprite for "front" arrow
    this._rearPtr   = null;        // LabelSprite for "rear" arrow
    this._frontIdx  = 0;
    this._rearIdx   = -1;
  }


  // -----------------------------------------------------------
  //  Build
  // -----------------------------------------------------------
  build(data) {
    this._data = data;
    this._frontIdx = data.front ?? 0;
    this._rearIdx  = data.rear  ?? (data.slots?.length - 1);

    const W   = VISUAL.QUEUE_SLOT_SIZE;
    const H   = VISUAL.QUEUE_SLOT_HEIGHT;
    const D   = VISUAL.QUEUE_SLOT_SIZE;
    const gap = VISUAL.QUEUE_GAP;
    const step = W + gap;
    const slots = data.slots || [];
    const totalW = slots.length * step - gap;
    const startX = -totalW / 2 + W / 2;
    const y = LAYOUT.QUEUE_Y;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const x = startX + i * step;

      const isFront = (i === this._frontIdx);
      const isRear  = (i === this._rearIdx);
      const geo = new THREE.BoxGeometry(W, H, D);
      const isError = !!slot.error;
      const mat = new THREE.MeshStandardMaterial({
        color:     isError ? VISUAL.ERROR_COLOR :
                   isFront ? 0x5da8ff :
                   isRear  ? 0xffc44d :
                             VISUAL.NODE_COLOR,
        emissive:  isError ? VISUAL.ERROR_EMISSIVE : 0x1a3a6e,
        emissiveIntensity: (isFront || isRear) ? 0.5 : 0.2,
        roughness: 0.3,
        metalness: 0.4,
        transparent: slot.empty,
        opacity:     slot.empty ? 0.3 : 1.0,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      mesh.castShadow = true;
      mesh.userData.slotData = slot;
      this._scene.add(mesh);

      // Value label — above the slot (moved higher to avoid adjacent slot overlap)
      const label = LabelSprite.create(
        slot.empty ? '' : String(slot.value),
        this._scene
      );
      label.setPosition(x, y + H/2 + 1.5, 0);

      // Index label below the slot — moved further down
      const idxLabel = LabelSprite.create(`[${slot.index}]`, this._scene);
      idxLabel.setPosition(x, y - H/2 - 1.3, 0);

      this._slots.set(slot.id, { mesh, label, idxLabel, data: slot });
    }

    // Front pointer arrow — moved higher
    if (this._frontIdx >= 0 && this._frontIdx < slots.length) {
      const fSlot = slots[this._frontIdx];
      const fBox = this._slots.get(fSlot.id);
      if (fBox) {
        this._frontPtr = LabelSprite.create('▼ FRONT', this._scene);
        this._frontPtr.setPosition(fBox.mesh.position.x, y + H/2 + 2.8, 0);
      }
    }

    // Rear pointer arrow — moved lower
    if (this._rearIdx >= 0 && this._rearIdx < slots.length) {
      const rSlot = slots[this._rearIdx];
      const rBox = this._slots.get(rSlot.id);
      if (rBox) {
        this._rearPtr = LabelSprite.create('▲ REAR', this._scene);
        this._rearPtr.setPosition(rBox.mesh.position.x, y - H/2 - 2.8, 0);
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
      case 'enqueue':
        this._enqueue(op.slotId, op.value);
        break;
      case 'dequeue':
        this._dequeue(op.slotId);
        break;
      case 'highlight':
        this._highlight(op.nodeId ?? op.slotId);
        break;
      case 'front':
        this._highlightFront();
        break;
      case 'flag_error':
        this._flagError(op.slotId, op.errorType);
        break;
      default:
        if (op.nodeId || op.slotId) this._highlight(op.nodeId ?? op.slotId);
    }
  }

  _enqueue(slotId, value) {
    this._clearActive();
    const box = this._slots.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(0xffc44d);
      box.mesh.material.emissiveIntensity = 0.7;
      box.mesh.material.opacity = 1.0;
      box.label.setText(String(value));
      this._active = slotId;

      // Move rear pointer
      if (this._rearPtr) {
        this._rearPtr.setPosition(box.mesh.position.x, box.mesh.position.y - VISUAL.QUEUE_SLOT_HEIGHT/2 - 2.8, 0);
      }
    }
  }

  _dequeue(slotId) {
    const box = this._slots.get(slotId);
    if (box) {
      // Fade out dequeued element
      box.mesh.material.transparent = true;
      box.mesh.material.opacity = 0.2;
      box.mesh.material.color.setHex(0x555a70);
      box.label.setText('');

      // Move front pointer
      if (this._frontPtr) {
        // Advance front pointer to next slot
        const newFrontX = box.mesh.position.x + VISUAL.QUEUE_SLOT_SIZE + VISUAL.QUEUE_GAP;
        this._frontPtr.setPosition(
          newFrontX,
          box.mesh.position.y + VISUAL.QUEUE_SLOT_HEIGHT/2 + 2.8,
          0
        );
      }
    }
  }

  _highlight(slotId) {
    this._clearActive();
    const box = this._slots.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(VISUAL.NODE_HOVER_COLOR);
      box.mesh.material.emissiveIntensity = 0.6;
      this._active = slotId;
    }
  }

  _highlightFront() {
    const slots = this._data?.slots || [];
    if (this._frontIdx >= 0 && this._frontIdx < slots.length) {
      this._highlight(slots[this._frontIdx].id);
    }
  }

  _flagError(slotId, errorType) {
    const box = this._slots.get(slotId);
    if (box) {
      box.mesh.material.color.setHex(VISUAL.ERROR_COLOR);
      box.mesh.material.emissive.setHex(VISUAL.ERROR_EMISSIVE);
      box.mesh.material.emissiveIntensity = 0.6;
    }
  }

  _clearActive() {
    if (this._active) {
      const prev = this._slots.get(this._active);
      if (prev) {
        prev.mesh.material.color.setHex(VISUAL.NODE_COLOR);
        prev.mesh.material.emissiveIntensity = 0.2;
      }
      this._active = null;
    }
  }


  tick(delta, elapsed) {
    if (this._active) {
      const box = this._slots.get(this._active);
      if (box) {
        const pulse = (Math.sin(elapsed * 4) + 1) / 2;
        box.mesh.material.emissiveIntensity = 0.4 + pulse * 0.4;
      }
    }
  }


  dispose() {
    for (const { mesh, label, idxLabel } of this._slots.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._scene.remove(mesh);
      label.dispose();
      if (idxLabel) idxLabel.dispose();
    }
    this._slots.clear();
    if (this._frontPtr) this._frontPtr.dispose();
    if (this._rearPtr)  this._rearPtr.dispose();
    this._active = null;
  }
}


export default QueueStructure;
