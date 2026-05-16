// =============================================================
//  SeeDS — LabelSprite.js
//  Canvas-texture sprites that float above nodes.
//  We use THREE.Sprite with a canvas texture because:
//  - Always faces the camera (billboard)
//  - No CSS2DRenderer dependency
//  - Works cleanly with the 3D scene depth
//
//  Usage:
//    const label = LabelSprite.create('42', scene);
//    label.setPosition(x, y + VISUAL.LABEL_OFFSET_Y, z);
//    label.setText('99');   // update value
//    label.dispose();
// =============================================================

import * as THREE from '../../vendor/three/three.module.js';
import { VISUAL } from './constants.js';


// Canvas size for the texture — power of 2 for GPU
const CANVAS_W = 256;
const CANVAS_H = 128;


class LabelSprite {
  constructor(text, scene, options = {}) {
    this._scene   = scene;
    this._text    = String(text);
    this._options = {
      fontSize:   options.fontSize   ?? VISUAL.LABEL_FONT_SIZE,
      color:      options.color      ?? VISUAL.LABEL_COLOR,
      scale:      options.scale      ?? 1.4,    // world-space size of the sprite
      subText:    options.subText    ?? null,   // optional address line below value
    };

    this._canvas   = null;
    this._ctx      = null;
    this._texture  = null;
    this._sprite   = null;

    this._build();
    this._scene.add(this._sprite);
  }


  // -----------------------------------------------------------
  //  Build the canvas, texture and sprite
  // -----------------------------------------------------------
  _build() {
    this._canvas = document.createElement('canvas');
    this._canvas.width  = CANVAS_W;
    this._canvas.height = CANVAS_H;
    this._ctx = this._canvas.getContext('2d');

    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.SpriteMaterial({
      map:         this._texture,
      transparent: true,
      depthWrite:  false,   // don't occlude things behind the label
      sizeAttenuation: true,
    });

    this._sprite = new THREE.Sprite(mat);
    this._sprite.scale.setScalar(this._options.scale);

    this._render();
  }


  // -----------------------------------------------------------
  //  Draw text onto the canvas and update the texture
  // -----------------------------------------------------------
  _render() {
    const ctx = this._ctx;
    const w   = CANVAS_W;
    const h   = CANVAS_H;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Optional pill background for readability
    if (this._options.subText) {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.65)';
      const pad = 12;
      const bw  = w * 0.72;
      const bh  = h * 0.80;
      const bx  = (w - bw) / 2;
      const by  = (h - bh) / 2;
      const r   = 14;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + r, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();
    }

    // Main value text
    ctx.font         = `600 ${this._options.fontSize}px -apple-system, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = this._options.color;

    const mainY = this._options.subText ? h * 0.38 : h * 0.5;
    ctx.fillText(this._text, w / 2, mainY);

    // Sub text (address / type annotation)
    if (this._options.subText) {
      ctx.font      = `400 ${Math.round(this._options.fontSize * 0.46)}px monospace`;
      ctx.fillStyle = 'rgba(180, 200, 255, 0.75)';
      ctx.fillText(this._options.subText, w / 2, h * 0.68);
    }

    // Mark texture as needing GPU upload
    this._texture.needsUpdate = true;
  }


  // -----------------------------------------------------------
  //  PUBLIC API
  // -----------------------------------------------------------

  setText(text) {
    this._text = String(text);
    this._render();
  }

  setSubText(subText) {
    this._options.subText = subText;
    this._render();
  }

  setColor(color) {
    this._options.color = color;
    this._render();
  }

  setPosition(x, y, z) {
    this._sprite.position.set(x, y, z);
  }

  setVisible(visible) {
    this._sprite.visible = visible;
  }

  // Scale the sprite in world space
  setScale(s) {
    this._sprite.scale.setScalar(s);
  }

  get position() { return this._sprite.position; }
  get sprite()   { return this._sprite; }


  // -----------------------------------------------------------
  //  Cleanup
  // -----------------------------------------------------------
  dispose() {
    this._texture.dispose();
    this._sprite.material.dispose();
    this._scene.remove(this._sprite);
    this._sprite  = null;
    this._texture = null;
    this._canvas  = null;
    this._ctx     = null;
  }


  // -----------------------------------------------------------
  //  Static factory
  // -----------------------------------------------------------
  static create(text, scene, options) {
    return new LabelSprite(text, scene, options);
  }
}


export default LabelSprite;