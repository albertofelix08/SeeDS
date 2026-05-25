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


// Canvas dimensions — bigger = higher quality text, still power-of-two for GPU
const CANVAS_W = 512;
const CANVAS_H = 128;


/**
 * Polyfill roundRect for older browsers (Chrome < 99, Firefox < 112).
 */
function roundRect(ctx, x, y, w, h, r) {
  if (typeof CanvasRenderingContext2D.prototype.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}


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
  //  Draw the canvas (used by _build and setText)
  // -----------------------------------------------------------
  _draw(ctx, text) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle semi-transparent glow behind text for readability without the heavy pill
    // Strong text shadow for crisp readability
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const fontSize = VISUAL.LABEL_FONT_SIZE ?? 52;
    ctx.font         = `bold ${fontSize}px "Inter", "Segoe UI", "Arial", sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw subtle dark glow behind text (multiple layers for glow effect)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 20;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    
    // Main text - crisp white with shadow
    ctx.shadowBlur = 6;
    ctx.fillStyle  = '#ffffff';
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    ctx.restore();

    // Remove the pill/background
  }


  // -----------------------------------------------------------
  //  Build the canvas texture + sprite
  // -----------------------------------------------------------
  _build() {
    const canvas  = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    const ctx = canvas.getContext('2d');
    this._draw(ctx, this._text);

    this._texture = new THREE.CanvasTexture(canvas);
    this._texture.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map:             this._texture,
      transparent:     true,
      depthWrite:      false,
      sizeAttenuation: true,
      depthTest:       true,
      blending:        THREE.NormalBlending,
    });

    this._sprite = new THREE.Sprite(mat);

    // Scale sprite to appropriate world-unit size. 512:128 = 4:1 ratio
    this._sprite.scale.set(3.0, 0.75, 1);
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
    this._draw(ctx, text);

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