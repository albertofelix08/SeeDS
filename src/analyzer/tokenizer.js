// =============================================================
//  SeeDS — tokenizer.js
//  C language tokenizer with full line-number tracking.
//  Produces a flat array of tokens { type, value, line, col }.
// =============================================================

// Token types
export const TOKEN = {
  // Keywords
  STRUCT:     'struct',
  TYPEDEF:    'typedef',
  IF:         'if',
  ELSE:       'else',
  FOR:        'for',
  WHILE:     'while',
  DO:         'do',
  RETURN:     'return',
  BREAK:      'break',
  CONTINUE:   'continue',
  SIZEOF:     'sizeof',
  MALLOC:     'malloc',
  CALLOC:     'calloc',
  FREE:       'free',
  NULL:       'null_kw',
  CONST:      'const',

  // Primitive types
  INT:        'int',
  CHAR:       'char',
  FLOAT:      'float',
  DOUBLE:     'double',
  VOID:       'void',
  BOOL:       'bool',
  SIZE_T:     'size_t',

  // Operators / punctuation
  SEMI:       ';',
  LBRACE:     '{',
  RBRACE:     '}',
  LPAREN:     '(',
  RPAREN:     ')',
  LBRACKET:   '[',
  RBRACKET:   ']',
  COMMA:      ',',
  DOT:        '.',
  ARROW:      '->',
  STAR:       '*',
  AMPERSAND:  '&',
  ASSIGN:     '=',
  EQ:         '==',
  NEQ:        '!=',
  LT:         '<',
  GT:         '>',
  LE:         '<=',
  GE:         '>=',
  PLUS:       '+',
  MINUS:      '-',
  INC:        '++',
  DEC:        '--',
  DIV:        '/',
  MOD:        '%',
  NOT:        '!',
  AND:        '&&',
  OR:         '||',
  BIT_AND:    '&',
  BIT_OR:     '|',
  BIT_XOR:    '^',
  BIT_NOT:    '~',

  // Literals
  IDENTIFIER: 'identifier',
  NUMBER:     'number',
  STRING:     'string',
  CHAR_LIT:   'char_lit',

  // Special
  COMMENT:    'comment',
  PREPROC:    'preprocessor',
  WHITESPACE: 'whitespace',
  NEWLINE:    'newline',
  EOF:        'eof',
  UNKNOWN:    'unknown',
};

// Single-character token map
const SINGLE_CHAR_TOKENS = {
  ';': TOKEN.SEMI,
  '{': TOKEN.LBRACE,
  '}': TOKEN.RBRACE,
  '(': TOKEN.LPAREN,
  ')': TOKEN.RPAREN,
  '[': TOKEN.LBRACKET,
  ']': TOKEN.RBRACKET,
  ',': TOKEN.COMMA,
  '.': TOKEN.DOT,
  '~': TOKEN.BIT_NOT,
};

// Keywords that map to specific token types
const KEYWORD_MAP = {
  'struct':   TOKEN.STRUCT,
  'typedef':  TOKEN.TYPEDEF,
  'if':       TOKEN.IF,
  'else':     TOKEN.ELSE,
  'for':      TOKEN.FOR,
  'while':    TOKEN.WHILE,
  'do':       TOKEN.DO,
  'return':   TOKEN.RETURN,
  'break':    TOKEN.BREAK,
  'continue': TOKEN.CONTINUE,
  'sizeof':   TOKEN.SIZEOF,
  'malloc':   TOKEN.MALLOC,
  'calloc':   TOKEN.CALLOC,
  'free':     TOKEN.FREE,
  'NULL':     TOKEN.NULL,
  'const':    TOKEN.CONST,
  'int':      TOKEN.INT,
  'char':     TOKEN.CHAR,
  'float':    TOKEN.FLOAT,
  'double':   TOKEN.DOUBLE,
  'void':     TOKEN.VOID,
  'bool':     TOKEN.BOOL,
  'size_t':   TOKEN.SIZE_T,
};

// Two-char operators (longer ones checked first)
const MULTI_CHAR_OPS = {
  '->': TOKEN.ARROW,
  '==': TOKEN.EQ,
  '!=': TOKEN.NEQ,
  '<=': TOKEN.LE,
  '>=': TOKEN.GE,
  '++': TOKEN.INC,
  '--': TOKEN.DEC,
  '&&': TOKEN.AND,
  '||': TOKEN.OR,
};

// Character classification helpers
function isDigit(ch) { return ch >= '0' && ch <= '9'; }
function isAlpha(ch) { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'; }
function isAlphaNum(ch) { return isAlpha(ch) || isDigit(ch); }


/**
 * Tokenize C source code.
 * Returns: { tokens, success, error? }
 * Each token: { type, value, line, col }
 */
export function tokenize(source) {
  const tokens = [];
  const len = source.length;
  let pos = 0;
  let line = 1;
  let col = 1;

  function makeToken(type, value) {
    const t = { type, value, line, col };
    tokens.push(t);
    return t;
  }

  function advance() {
    if (pos >= len) return '\0';
    const ch = source[pos++];
    if (ch === '\n') { line++; col = 1; }
    else { col++; }
    return ch;
  }

  function peek(offset = 0) {
    const idx = pos + offset;
    return idx < len ? source[idx] : '\0';
  }

  function skipWhitespace() {
    while (pos < len) {
      const ch = source[pos];
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        advance();
      } else if (ch === '\n') {
        advance();
      } else {
        break;
      }
    }
  }

  function scanString(quote) {
    const startLine = line;
    const startCol = col;
    let value = '';
    advance(); // skip opening quote

    while (pos < len) {
      const ch = source[pos];
      if (ch === '\\') {
        value += advance();
        if (pos < len) value += advance();
      } else if (ch === quote) {
        advance(); // skip closing quote
        return makeToken(TOKEN.STRING, value);
      } else if (ch === '\n') {
        // unterminated string — recover
        return makeToken(TOKEN.STRING, value + '\n');
      } else {
        value += advance();
      }
    }

    return makeToken(TOKEN.STRING, value);
  }

  function scanChar() {
    const startLine = line;
    const startCol = col;
    advance(); // skip '
    let value = '';
    if (pos < len && source[pos] === '\\') {
      value += advance();
      if (pos < len) value += advance();
    } else if (pos < len) {
      value += advance();
    }
    if (pos < len && source[pos] === '\'') {
      advance(); // skip '
    }
    return makeToken(TOKEN.CHAR_LIT, value);
  }

  function scanIdentifierOrKeyword(startCh) {
    let value = startCh;
    while (isAlphaNum(peek())) {
      value += advance();
    }
    const type = KEYWORD_MAP[value] || TOKEN.IDENTIFIER;
    return makeToken(type, value);
  }

  function scanNumber(startCh) {
    let value = startCh;
    let isHex = false;
    let isFloat = false;

    // Hex
    if (startCh === '0' && (peek() === 'x' || peek() === 'X')) {
      value += advance(); // consume x
      while (isDigit(peek()) || (peek() >= 'a' && peek() <= 'f') || (peek() >= 'A' && peek() <= 'F')) {
        value += advance();
      }
      isHex = true;
    } else {
      while (isDigit(peek()) || peek() === '.') {
        if (peek() === '.') isFloat = true;
        value += advance();
      }
    }

    // Suffix (u, l, ul, f, etc.)
    if (peek() === 'f' || peek() === 'F' || peek() === 'u' || peek() === 'U' ||
        peek() === 'l' || peek() === 'L') {
      value += advance();
      isFloat = true;
    }

    return makeToken(TOKEN.NUMBER, value);
  }

  function scanLineComment() {
    let value = '//';
    advance(); advance(); // skip //
    while (pos < len && source[pos] !== '\n') {
      value += advance();
    }
    return makeToken(TOKEN.COMMENT, value);
  }

  function scanBlockComment() {
    let value = '/*';
    advance(); advance(); // skip /*
    while (pos < len) {
      if (source[pos] === '*' && peek(1) === '/') {
        value += advance();
        value += advance();
        break;
      }
      value += advance();
    }
    return makeToken(TOKEN.COMMENT, value);
  }

  function scanPreprocessor() {
    let value = '#';
    advance(); // skip #
    while (pos < len && source[pos] !== '\n') {
      // Handle line continuation
      if (source[pos] === '\\') {
        value += advance();
        if (pos < len && source[pos] === '\n') value += advance();
      } else {
        value += advance();
      }
    }
    return makeToken(TOKEN.PREPROC, value);
  }

  // Main tokenization loop
  while (pos < len) {
    const ch = source[pos];
    const startCol = col;

    // Skip whitespace (but don't emit tokens for it)
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      skipWhitespace();
      continue;
    }

    // Preprocessor directive
    if (ch === '#' && col === 1) {
      scanPreprocessor();
      continue;
    }

    // Comments
    if (ch === '/' && peek(1) === '/') {
      scanLineComment();
      continue;
    }
    if (ch === '/' && peek(1) === '*') {
      scanBlockComment();
      continue;
    }

    // String literals
    if (ch === '"') {
      scanString('"');
      continue;
    }

    // Char literals
    if (ch === '\'') {
      scanChar();
      continue;
    }

    // Multi-character operators (->, ==, !=, etc.)
    const twoChar = ch + peek(1);
    if (MULTI_CHAR_OPS[twoChar]) {
      advance(); advance();
      makeToken(MULTI_CHAR_OPS[twoChar], twoChar);
      continue;
    }

    // Single character punctuation
    if (SINGLE_CHAR_TOKENS[ch]) {
      advance();
      makeToken(SINGLE_CHAR_TOKENS[ch], ch);
      continue;
    }

    // Single char operators that could be confused with other things
    if (ch === '=') { advance(); makeToken(TOKEN.ASSIGN, '='); continue; }
    if (ch === '!') { advance(); makeToken(TOKEN.NOT, '!'); continue; }
    if (ch === '<') { advance(); makeToken(TOKEN.LT, '<'); continue; }
    if (ch === '>') { advance(); makeToken(TOKEN.GT, '>'); continue; }
    if (ch === '+') { advance(); makeToken(TOKEN.PLUS, '+'); continue; }
    if (ch === '-') { advance(); makeToken(TOKEN.MINUS, '-'); continue; }
    if (ch === '/') { advance(); makeToken(TOKEN.DIV, '/'); continue; }
    if (ch === '%') { advance(); makeToken(TOKEN.MOD, '%'); continue; }
    if (ch === '|') { advance(); makeToken(TOKEN.BIT_OR, '|'); continue; }
    if (ch === '^') { advance(); makeToken(TOKEN.BIT_XOR, '^'); continue; }
    if (ch === '&') { advance(); makeToken(TOKEN.AMPERSAND, '&'); continue; }
    if (ch === '?') { advance(); makeToken(TOKEN.UNKNOWN, '?'); continue; }
    if (ch === ':') { advance(); makeToken(TOKEN.UNKNOWN, ':'); continue; }

    // Numbers
    if (isDigit(ch)) {
      scanNumber(advance());
      continue;
    }

    // Identifiers and keywords
    if (isAlpha(ch)) {
      scanIdentifierOrKeyword(advance());
      continue;
    }

    // Star (could be pointer or multiply)
    if (ch === '*') {
      advance();
      makeToken(TOKEN.STAR, '*');
      continue;
    }

    // Unknown character
    advance();
    makeToken(TOKEN.UNKNOWN, ch);
  }

  makeToken(TOKEN.EOF, '');

  return {
    tokens,
    success: true,
    sourceLineCount: source.split('\n').length,
  };
}


/**
 * Get a specific line of source code for error reporting.
 */
export function getSourceLine(source, lineNum) {
  const lines = source.split('\n');
  if (lineNum >= 1 && lineNum <= lines.length) {
    return lines[lineNum - 1];
  }
  return null;
}


/**
 * Reconstruct line numbers from a token stream.
 * Returns a map: line number → list of tokens on that line
 */
export function groupTokensByLine(tokens) {
  const map = new Map();
  for (const tok of tokens) {
    if (!map.has(tok.line)) map.set(tok.line, []);
    map.get(tok.line).push(tok);
  }
  return map;
}
