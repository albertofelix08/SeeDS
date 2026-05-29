// =============================================================
//  SeeDS — AceWrapper.js
//  Wraps Ace Editor (loaded via CDN <script> tags).
//  Exposes the same API surface as the old MonacoWrapper:
//    mount(containerEl), getValue(), setValue(),
//    onChange(cb), layout(), focus(), isReady(), dispose()
//
//  Ace loads synchronously via plain <script> tags in index.html
//  so window.ace is available immediately — no AMD, no workers,
//  no async config dance needed.
// =============================================================

// SeeDS custom Ace theme — injected as a dynamic theme definition
// so we don't need a separate theme CDN file beyond tomorrow_night base
const SEEDS_THEME_CSS = `
.ace-seeds-dark .ace_gutter {
  background: #0a0a10;
  color: #2e3150;
  border-right: 1px solid rgba(255,255,255,0.04);
}
.ace-seeds-dark .ace_gutter-active-line {
  background: #14141f;
  color: #5b8ff7;
}
.ace-seeds-dark {
  background: #0d0d14;
  color: #e8ecf8;
}
.ace-seeds-dark .ace_cursor {
  color: #5b8ff7;
}
.ace-seeds-dark .ace_marker-layer .ace_selection {
  background: rgba(91,143,247,0.25);
}
.ace-seeds-dark .ace_marker-layer .ace_active-line {
  background: #14141f;
}
.ace-seeds-dark .ace_line-gutter-selected {
  background: #14141f;
}
.ace-seeds-dark .ace_string        { color: #ffc44d; }
.ace-seeds-dark .ace_comment       { color: #3a4060; font-style: italic; }
.ace-seeds-dark .ace_keyword       { color: #7c9ef0; font-weight: bold; }
.ace-seeds-dark .ace_keyword.ace_control { color: #a78bfa; }
.ace-seeds-dark .ace_storage       { color: #a78bfa; }
.ace-seeds-dark .ace_storage.ace_type { color: #4fc97e; }
.ace-seeds-dark .ace_constant.ace_numeric { color: #ff9f7e; }
.ace-seeds-dark .ace_variable      { color: #e8ecf8; }
.ace-seeds-dark .ace_support.ace_function { color: #85b5ff; }
.ace-seeds-dark .ace_paren         { color: #7c9ef0; }
.ace-seeds-dark .ace_punctuation   { color: #5a5f7a; }
.ace-seeds-dark .ace_scrollbar-v,
.ace-seeds-dark .ace_scrollbar-h   { background: transparent; }
.ace-seeds-dark .ace_scrollbar-v .ace_scrollbar-inner,
.ace-seeds-dark .ace_scrollbar-h .ace_scrollbar-inner {
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
}
`;

const ACE_OPTIONS = {
  mode:              'ace/mode/c_cpp',
  theme:             'ace/theme/seeds_dark',
  fontSize:          12,
  fontFamily:        "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
  tabSize:           4,
  useSoftTabs:       true,
  showPrintMargin:   false,
  showGutter:        true,
  highlightActiveLine: true,
  highlightSelectedWord: true,
  wrap:              false,
  scrollPastEnd:     0.2,
  animatedScroll:    true,
  showLineNumbers:   true,
  fixedWidthGutter:  true,
  enableBasicAutocompletion: false,
  enableLiveAutocompletion:  false,
  enableSnippets:    false,
  behavioursEnabled: true,
  wrapBehavioursEnabled: true,
};


class AceWrapper {
  constructor() {
    this._editor     = null;
    this._ready      = false;
    this._onChangeCb = null;
    this._pendingValue = null;
  }


  // -----------------------------------------------------------
  //  mount(containerEl)
  //  Synchronous — Ace loads via plain <script> so window.ace
  //  is available immediately. Returns a resolved Promise to
  //  keep the API compatible with async callers.
  // -----------------------------------------------------------
  mount(containerEl) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window.ace === 'undefined') {
          throw new Error('[AceWrapper] window.ace not found. Check that ace.min.js loaded.');
        }

        // Inject SeeDS theme CSS once
        this._injectTheme();

        // Create editor
        this._editor = window.ace.edit(containerEl, ACE_OPTIONS);

        // Set pending value if setValue was called before mount
        if (this._pendingValue !== null) {
          this._editor.setValue(this._pendingValue, -1); // -1 = cursor to start
          this._pendingValue = null;
        }

        // Wire onChange
        this._editor.session.on('change', () => {
          if (this._onChangeCb) {
            this._onChangeCb(this._editor.getValue());
          }
        });

        this._ready = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }


  // -----------------------------------------------------------
  //  getValue() → string
  // -----------------------------------------------------------
  getValue() {
    if (!this._editor) return this._pendingValue ?? '';
    return this._editor.getValue();
  }


  // -----------------------------------------------------------
  //  setValue(code)
  // -----------------------------------------------------------
  setValue(code) {
    if (!this._editor) {
      this._pendingValue = code;
      return;
    }
    this._editor.setValue(code, -1); // -1 moves cursor to start
  }


  // -----------------------------------------------------------
  //  onChange(cb)
  // -----------------------------------------------------------
  onChange(cb) {
    this._onChangeCb = cb;
  }


  // -----------------------------------------------------------
  //  layout()
  //  Ace auto-resizes via CSS — this is a no-op kept for
  //  API compatibility. Call resize() if explicitly needed.
  // -----------------------------------------------------------
  layout() {
    if (this._editor) {
      this._editor.resize();
    }
  }


  // -----------------------------------------------------------
  //  focus()
  // -----------------------------------------------------------
  focus() {
    if (this._editor) this._editor.focus();
  }


  // -----------------------------------------------------------
  //  isReady()
  // -----------------------------------------------------------
  isReady() {
    return this._ready;
  }


  // -----------------------------------------------------------
  //  dispose()
  // -----------------------------------------------------------
  dispose() {
    if (this._editor) {
      this._editor.destroy();
      this._editor = null;
    }
    this._ready = false;
  }


  // -----------------------------------------------------------
  //  _injectTheme()
  //  Registers the SeeDS dark theme with Ace's theme system
  //  and injects the CSS into <head> once.
  // -----------------------------------------------------------
  _injectTheme() {
    // Only inject once
    if (document.getElementById('ace-seeds-dark-theme')) return;

    // Inject CSS
    const style = document.createElement('style');
    style.id = 'ace-seeds-dark-theme';
    style.textContent = SEEDS_THEME_CSS;
    document.head.appendChild(style);

    // Register theme with Ace
    window.ace.define('ace/theme/seeds_dark', ['require', 'exports', 'module'], (require, exports) => {
      exports.isDark    = true;
      exports.cssClass  = 'ace-seeds-dark';
      exports.cssText   = SEEDS_THEME_CSS;
    });
  }
}


export default AceWrapper;