// =============================================================
//  SeeDS — SortRace.js
//  Renders N sorting algorithms side-by-side as bar charts.
//  JSON shape: { initialValues[], sorters[] }
//  Each sorter: { id, label, complexity, steps[] }
//  Each step: { type: compare|swap|sorted|done|pivot|merge|split, ... }
//
//  Each sorter gets its own column of bars. Steps are consumed
//  round-robin so all sorters advance at the same pace.
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { LAYOUT, VISUAL } from '../core/constants.js';
import LabelSprite from '../renderer/LabelSprite.js';


class SortRace {
  constructor(scene, camera) {
    this._scene   = scene;
    this._camera  = camera;

    // sorter id → { bars: Mesh[], stepIndex, values[], labels[] }
    this._sorters = new Map();
    this._data    = null;
  }


  // -----------------------------------------------------------
  //  Build — create bar charts for each sorter
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
      const centreX = startX + si * LAYOUT.SORT_RACE_SPACING;
      const bars    = [];
      const labels  = [];

      // Build the bars
      const barStep = LAYOUT.BAR_WIDTH + LAYOUT.BAR_GAP;
      const barsW   = n * barStep - LAYOUT.BAR_GAP;
      const barsStartX = centreX - barsW / 2 + LAYOUT.BAR_WIDTH / 2;

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
        mesh.position.set(barsStartX + i * barStep, h / 2, si * 0.1); // slight z offset per sorter
        mesh.castShadow = true;
        this._scene.add(mesh);
        bars.push(mesh);

        const lbl = LabelSprite.create(String(vals[i]), this._scene);
        lbl.setPosition(barsStartX + i * barStep, h + 0.5, si * 0.1);
        labels.push(lbl);
      }

      // Sorter title
      const title = LabelSprite.create(`${sorter.label}  ${sorter.complexity}`, this._scene);
      title.setPosition(centreX, -1.2, 0);
      labels.push(title);

      this._sorters.set(sorter.id, {
        bars,
        labels,
        stepIndex: 0,
        values: [...vals],
        centreX,
        barsStartX,
        barStep,
        maxV,
      });
    });
  }


  // -----------------------------------------------------------
  //  Execute — steps are passed per-sorter from PlaybackController.
  //  The JSON operations array is flat, so we dispatch by sorter id.
  //  But sort-race JSON uses a nested steps[] per sorter, not a flat
  //  operations array. So execute() here receives the flat op from
  //  PlaybackController, which for sort-race we store as a
  //  round-robin step reference.
  //
  //  Since the data format uses per-sorter steps[], we override the
  //  execute contract: each call to execute() advances ALL sorters
  //  by one step simultaneously.
  // -----------------------------------------------------------
  execute(op) {
    // op is unused for sort-race — we advance each sorter ourselves
    for (const [id, sorter] of this._sorters) {
      const sorterDef = this._data.sorters.find(s => s.id === id);
      if (!sorterDef) continue;
      if (sorter.stepIndex >= sorterDef.steps.length) continue;

      const step = sorterDef.steps[sorter.stepIndex];
      sorter.stepIndex++;

      this._applyStep(sorter, step);
    }
  }

  _applyStep(sorter, step) {
    const { bars, values, barsStartX, barStep, maxV } = sorter;

    // Reset all colours first (except sorted ones)
    bars.forEach((b) => {
      if (!b.userData.sorted) {
        b.material.color.setHex(VISUAL.BAR_COLOR_DEFAULT);
        b.material.emissiveIntensity = 0.2;
      }
    });

    switch (step.type) {
      case 'compare':
        if (bars[step.i]) bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
        if (bars[step.j]) bars[step.j].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
        break;

      case 'pivot':
        if (bars[step.i]) bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_PIVOT);
        break;

      case 'swap':
        if (step.state) this._rebuildBars(sorter, step.state);
        break;

      case 'merge':
        if (step.state) this._rebuildBars(sorter, step.state);
        if (step.indices) {
          for (const i of step.indices) {
            if (bars[i]) bars[i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
          }
        }
        break;

      case 'sorted':
        if (step.state) this._rebuildBars(sorter, step.state);
        if (bars[step.i] !== undefined) {
          bars[step.i].material.color.setHex(VISUAL.BAR_COLOR_SORTED);
          bars[step.i].material.emissiveIntensity = 0.5;
          bars[step.i].userData.sorted = true;
        }
        break;

      case 'done':
        if (step.state) this._rebuildBars(sorter, step.state);
        bars.forEach(b => {
          b.material.color.setHex(VISUAL.BAR_COLOR_SORTED);
          b.material.emissiveIntensity = 0.5;
          b.userData.sorted = true;
        });
        break;

      case 'split':
        // Highlight the indices being split
        if (step.left)  for (const i of step.left)  if (bars[i]) bars[i].material.color.setHex(VISUAL.BAR_COLOR_COMPARING);
        if (step.right) for (const i of step.right) if (bars[i]) bars[i].material.color.setHex(VISUAL.BAR_COLOR_PIVOT);
        break;
    }
  }

  // Rebuild bar heights from a new state array
  _rebuildBars(sorter, state) {
    const { bars, labels, barsStartX, barStep, maxV } = sorter;

    state.forEach((val, i) => {
      if (!bars[i]) return;
      const h = (val / maxV) * LAYOUT.SORT_BAR_MAX_HEIGHT;

      // Replace geometry (height changes)
      bars[i].geometry.dispose();
      bars[i].geometry = new THREE.BoxGeometry(LAYOUT.BAR_WIDTH, h, LAYOUT.BAR_WIDTH);
      bars[i].position.y = h / 2;

      // Update value label
      if (labels[i]) labels[i].setPosition(barsStartX + i * barStep, h + 0.5, 0);
    });

    sorter.values = [...state];
  }

  tick(delta, elapsed) {
    // Subtle idle pulse on default bars
    const pulse = (Math.sin(elapsed * 1.5) + 1) / 2;
    for (const { bars } of this._sorters.values()) {
      bars.forEach(b => {
        if (!b.userData.sorted && b.material.color.getHex() === VISUAL.BAR_COLOR_DEFAULT) {
          b.material.emissiveIntensity = 0.1 + pulse * 0.15;
        }
      });
    }
  }

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