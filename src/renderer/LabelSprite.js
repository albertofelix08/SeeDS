// =============================================================
//  SeeDS — LabelSprite.js
//  Renders a text label as a billboard sprite in 3D space.
//  Uses a canvas texture so the label always faces the camera.
//
//  Usage:
//    const label = LabelSprite.create('42', scene);
//    label.setPosition(x, y + 1.1, z);
//    label.dispose();
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { VISUAL }  from '../core/constants.js';


// Canvas dimensions — power-of-two is friendliest for GPU
const CANVAS_W = 256;
const CANVAS_H = 64;


class LabelSprite {
  constructor(text, scene) {
    this._scene   = scene;
    this._text    = text;
    this._sprite  = null;
    this._texture = null;

    this._build();
    this._scene.add(this._sprite);
  }


  // -----------------------------------------------------------
  //  Build the canvas texture + sprite
  // -----------------------------------------------------------
  _build() {
    const canvas  = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    const ctx = canvas.getContext('2d');

    // Transparent background
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Text style
    const fontSize = VISUAL.LABEL_FONT_SIZE ?? 48;
    ctx.font         = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Subtle drop-shadow for legibility against the dark scene
    ctx.shadowColor   = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur    = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = VISUAL.LABEL_COLOR ?? '#ffffff';
    ctx.fillText(this._text, CANVAS_W / 2, CANVAS_H / 2);

    this._texture = new THREE.CanvasTexture(canvas);
    this._texture.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map:             this._texture,
      transparent:     true,
      depthWrite:      false,   // sprites behind geometry still readable
      sizeAttenuation: true,    // scale with distance (perspective-correct)
    });

    this._sprite = new THREE.Sprite(mat);

    // Scale sprite to a reasonable world-unit size.
    // Aspect ratio matches the canvas (256:64 = 4:1), height ~0.6 units.
    this._sprite.scale.set(2.4, 0.6, 1);
  }


  // -----------------------------------------------------------
  //  Position the label in world space
  // -----------------------------------------------------------
  setPosition(x, y, z) {
    if (this._sprite) {
      this._sprite.position.set(x, y, z);
    }
  }


  // -----------------------------------------------------------
  //  Update the displayed text (rebuilds texture in-place)
  // -----------------------------------------------------------
  setText(text) {
    if (text === this._text) return;
    this._text = text;

    const canvas = this._texture.image;
    const ctx    = canvas.getContext('2d');

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const fontSize = VISUAL.LABEL_FONT_SIZE ?? 48;
    ctx.font         = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 6;
    ctx.fillStyle    = VISUAL.LABEL_COLOR ?? '#ffffff';
    ctx.fillText(this._text, CANVAS_W / 2, CANVAS_H / 2);

    this._texture.needsUpdate = true;
  }


  // -----------------------------------------------------------
  //  Visibility toggle (handy for animations)
  // -----------------------------------------------------------
  setVisible(visible) {
    if (this._sprite) this._sprite.visible = visible;
  }


  // -----------------------------------------------------------
  //  Passthrough to the underlying THREE.Sprite position
  // -----------------------------------------------------------
  get position() {
    return this._sprite ? this._sprite.position : new THREE.Vector3();
  }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    if (this._texture) this._texture.dispose();
    if (this._sprite) {
      this._sprite.material.dispose();
      this._scene.remove(this._sprite);
    }
    this._texture = null;
    this._sprite  = null;
  }


  // -----------------------------------------------------------
  //  Static factory — matches the call pattern in all structures:
  //    LabelSprite.create(text, scene)
  // -----------------------------------------------------------
  static create(text, scene) {
    return new LabelSprite(text, scene);
  }
}


export default LabelSprite;