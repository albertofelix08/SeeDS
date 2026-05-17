// =============================================================
//  SeeDS — SortRace.js
//  Renders N sorting algorithms side-by-side as bar charts.
//  JSON shape: { initialValues[], sorters[] }
//  Each sorter: { id, label, complexity, steps[] }
//  Each step: { type: compare|swap|sorted|done|pivot|merge|split, ... }
//
//  All sorters advance simultaneously — one step each per tick.
//  build() synthesises a flat operations[] list (round-robin across
//  sorters) so PlaybackController can drive it normally.
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { LAYOUT, VISUAL } from '../core/constants.js';
import LabelSprite from '../renderer/LabelSprite.js';


class SortRace {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    // sorter id → { bars[], labels[], stepIndex, values[], ... }
    this._sorters    = new Map();
    this._data       = null;
    this.operations  = [];   // synthesised flat list — read by app.js after build()
  }


  // -----------------------------------------------------------
  //  Build — create bar charts for each sorter, synthesise ops
  // -----------------------------------------------------------
  build(data) {
    this._data = data;
    const vals = data.initialValues;
    const maxV = Math.max(...vals);
    const n    = vals.length;

    const sorterCount = data.sorters.length;
    const totalSpan   = (sorterCount - 1) * LAYOUT.SORT_RACE_SPACING;
    const startX      = -totalSpan / 2;

    data.sorters.forEach((sorter, si) => {
      const centreX    = startX + si * LAYOUT.SORT_RACE_SPACING;
      const barStep    = LAYOUT.BAR_WIDTH + LAYOUT.BAR_GAP;
      const barsW      = n * barStep - LAYOUT.BAR_GAP;
      const barsStartX = centreX - barsW / 2 + LAYOUT.BAR_WIDTH / 2;

      const bars   = [];
      const labels = [];

      // Build the bars
      for (let i = 0; i < n; i++) {
        const h   = (vals[i] / maxV) * LAYOUT.SORT_BAR_MAX_HEIGHT;
        const geo = new THREE.BoxGeometry(LAYOUT.BAR_WIDTH, h, LAYOUT.BAR_WIDTH);
        const mat = new THREE.MeshStandardMaterial({
          color:    VISUAL.BAR_COLOR_DEFAULT,
          emissive: 0x1a3a6e,
          emissiveIntensity: 0.2,
          roughness: 0.4,
          metalness: 0.3,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(barsStartX + i * barStep, h / 2, si * 0.1);
        mesh.castShadow = true;
        this._scene.add(mesh);
        bars.push(mesh);

        const lbl = LabelSprite.create(String(vals[i]), this._scene);
        lbl.setPosition(barsStartX + i * barStep, h + 0.5, si * 0.1);
        labels.push(lbl);
      }

      // Sorter title below the bars
      const title = LabelSprite.create(`${sorter.label}  ${sorter.complexity}`, this._scene);
      title.setPosition(centreX, -1.5, 0);
      labels.push(title);

      this._sorters.set(sorter.id, {
        bars,
        labels,
        stepIndex: 0,
        values:    [...vals],
        centreX,
        barsStartX,
        barStep,
        maxV,
      });
    });

    // -----------------------------------------------------------
    //  Synthesise a flat operations array for PlaybackController.
    //  Round-robin: take one step from each sorter per "tick"
    //  until all sorters are exhausted.
    // -----------------------------------------------------------
    const maxSteps = Math.max(...data.sorters.map(s => s.steps.length));
    this.operations = [];
    for (let round = 0; round < maxSteps; round++) {
      this.operations.push({ type: '_sort_race_tick', round });
    }

    // Patch data so PlaybackController.load() picks them up
    data.operations = this.operations;
  }


  // -----------------------------------------------------------
  //  Execute — called once per tick by PlaybackController.
  //  Advances every sorter by one step simultaneously.
  // -----------------------------------------------------------
  execute(op) {
    for (const [id, sorter] of this._sorters) {
      const sorterDef = this._data.sorters.find(s => s.id === id);
      if (!sorterDef) continue;
      if (sorter.stepIndex >= sorterDef.steps.length) continue;

      const step = sorterDef.steps[sorter.stepIndex];
      sorter.stepIndex++;

      this._applyStep(sorter, step);
    }
  }


  // -----------------------------------------------------------
  //  Apply a single step to one sorter's bars
  // -----------------------------------------------------------
  _applyStep(sorter, step) {
    const { bars, barsStartX, barStep } = sorter;

    // Reset all non-sorted bar colours
    bars.forEach(b => {
      if (!b.userData.sorted) {
        b.material.color.setHex(VISUAL.BAR_COLOR_DEFAULT);
        b.material.emissiveIntensity = 0.2;
      }
    });

    switch (step.type) {

      case 'compare':
        if (bars[step.i]) {
          bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
          bars[step.i].material.emissiveIntensity = 0.6;
        }
        if (bars[step.j] !== undefined) {
          bars[step.j].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
          bars[step.j].material.emissiveIntensity = 0.6;
        }
        break;

      case 'pivot':
        if (bars[step.i]) {
          bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_PIVOT);
          bars[step.i].material.emissiveIntensity = 0.7;
        }
        break;

      case 'swap':
        if (step.state) this._rebuildBars(sorter, step.state);
        // Briefly highlight the swapped positions
        if (bars[step.i]) bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
        if (bars[step.j] !== undefined) bars[step.j].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
        break;

      case 'merge':
        if (step.state) this._rebuildBars(sorter, step.state);
        if (step.indices) {
          for (const i of step.indices) {
            if (bars[i]) {
              bars[i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
              bars[i].material.emissiveIntensity = 0.5;
            }
          }
        }
        break;

      case 'split':
        if (step.left)  for (const i of step.left)  if (bars[i]) bars[i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
        if (step.right) for (const i of step.right) if (bars[i]) bars[i].material.color.setHex(VISUAL.BAR_COLOR_PIVOT);
        break;

      case 'sorted':
        if (step.state) this._rebuildBars(sorter, step.state);
        if (step.i !== undefined && bars[step.i]) {
          bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_SORTED);
          bars[step.i].material.emissiveIntensity = 0.6;
          bars[step.i].userData.sorted = true;
        }
        break;

      case 'done':
        if (step.state) this._rebuildBars(sorter, step.state);
        bars.forEach(b => {
          b.material.color.setHex(VISUAL.BAR_COLOR_SORTED);
          b.material.emissiveIntensity = 0.6;
          b.userData.sorted = true;
        });
        break;
    }
  }


  // -----------------------------------------------------------
  //  Rebuild bar heights + label positions from a state array
  // -----------------------------------------------------------
  _rebuildBars(sorter, state) {
    const { bars, labels, barsStartX, barStep, maxV } = sorter;

    state.forEach((val, i) => {
      if (!bars[i]) return;
      const h = (val / maxV) * LAYOUT.SORT_BAR_MAX_HEIGHT;

      bars[i].geometry.dispose();
      bars[i].geometry = new THREE.BoxGeometry(LAYOUT.BAR_WIDTH, h, LAYOUT.BAR_WIDTH);
      bars[i].position.y = h / 2;

      // Update label position and text
      if (labels[i]) {
        labels[i].setPosition(barsStartX + i * barStep, h + 0.5, 0);
        labels[i].setText(String(val));
      }
    });

    sorter.values = [...state];
  }


  // -----------------------------------------------------------
  //  Per-frame tick
  // -----------------------------------------------------------
  tick(delta, elapsed) {
    // Subtle idle pulse on unsorted bars
    const pulse = (Math.sin(elapsed * 1.5) + 1) / 2;
    for (const { bars } of this._sorters.values()) {
      bars.forEach(b => {
        if (!b.userData.sorted && b.material.color.getHex() === VISUAL.BAR_COLOR_DEFAULT) {
          b.material.emissiveIntensity = 0.1 + pulse * 0.15;
        }
      });
    }
  }


  // -----------------------------------------------------------
  //  Dispose
  // -----------------------------------------------------------
  dispose() {
    for (const { bars, labels } of this._sorters.values()) {
      for (const b of bars) {
        b.geometry.dispose();
        b.material.dispose();
        this._scene.remove(b);
      }
      for (const l of labels) l.dispose();
    }
    this._sorters.clear();
  }
}


export default SortRace;