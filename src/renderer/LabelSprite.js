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
import eventBus    from '../core/eventBus.js';


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

    // Register for theme updates
    LabelSprite._instances.add(this);
  }


  // -----------------------------------------------------------
  //  Determine text color based on current theme
  // -----------------------------------------------------------
  _getTextColor() {
    return document.body.classList.contains('light-theme') ? '#222222' : '#ffffff';
  }

  _getGlowColor() {
    return document.body.classList.contains('light-theme')
      ? 'rgba(255,255,255,0.6)'
      : 'rgba(0,0,0,0.85)';
  }

  _getShadowColor() {
    return document.body.classList.contains('light-theme')
      ? 'rgba(255,255,255,0.3)'
      : 'rgba(0,0,0,0.3)';
  }


  // -----------------------------------------------------------
  //  Draw the canvas (used by _build and setText)
  // -----------------------------------------------------------
  _draw(ctx, text) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const textColor   = this._getTextColor();
    const glowColor   = this._getGlowColor();
    const shadowColor = this._getShadowColor();

    // Subtle glow/shadow behind text for crisp readability
    ctx.save();
    ctx.shadowColor   = glowColor;
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const fontSize = VISUAL.LABEL_FONT_SIZE ?? 52;
    ctx.font         = `bold ${fontSize}px "Inter", "Segoe UI", "Arial", sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw subtle glow behind text (multiple layers)
    ctx.fillStyle = shadowColor;
    ctx.shadowBlur = 20;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    
    // Main text - crisp with appropriate contrast for theme
    ctx.shadowBlur = 6;
    ctx.fillStyle  = textColor;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    ctx.restore();
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
  //  Redraw texture (called when theme changes)
  // -----------------------------------------------------------
  _redraw() {
    if (!this._texture) return;
    const canvas = this._texture.image;
    const ctx    = canvas.getContext('2d');
    this._draw(ctx, this._text);
    this._texture.needsUpdate = true;
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
    LabelSprite._instances.delete(this);
  }


  // -----------------------------------------------------------
  //  Static factory — matches the call pattern in all structures:
  //    LabelSprite.create(text, scene)
  // -----------------------------------------------------------
  static create(text, scene) {
    return new LabelSprite(text, scene);
  }
}


// ---------------------------------------------------------------
//  Static instance registry for theme-aware redrawing
// ---------------------------------------------------------------
/** @type {Set<LabelSprite>} */
LabelSprite._instances = new Set();

// Watch for theme changes and redraw all active labels.
// Uses setTimeout(0) to defer after app.js _setTheme() has toggled the CSS class,
// so _getTextColor() reads the correct theme state.
let _themeBound = false;
function _ensureThemeBinding() {
  if (_themeBound) return;
  _themeBound = true;
  eventBus.on('theme:set', () => {
    setTimeout(() => {
      for (const label of LabelSprite._instances) {
        label._redraw();
      }
    }, 0);
  });
}
_ensureThemeBinding();


export default LabelSprite;