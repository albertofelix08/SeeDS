// =============================================================
//  SeeDS — parser.js
//  Lightweight C parser. Extracts:
//    - Struct definitions (with field names, types, pointer info)
//    - Function signatures (name, params, return type)
//    - malloc/free calls
//    - Pointer assignments (next = ...)
//  All nodes carry source line numbers from tokens.
// =============================================================

import { TOKEN } from './tokenizer.js';


/**
 * Parse a stream of tokens into a structured result.
 * @param {Array} tokens — from tokenizer
 * @returns {{ structs, functions, mallocs, frees, pointerAssigns, lines, errors }}
 */
export function parse(tokens) {
  const result = {
    structs: [],          // { name, fields[], line }
    functions: [],        // { name, returnType, params[], bodyLines, line, calls[] }
    mallocs: [],          // { line, variable }
    frees: [],            // { line, variable }
    pointerAssigns: [],   // { target, source, line }
    lines: [],            // tokens grouped by line
    errors: [],           // parse errors
    allTokens: tokens,
  };

  let i = 0;

  // Helper: skip whitespace/newline/filtered tokens
  function skipSkippable() {
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === TOKEN.PREPROC || t.type === TOKEN.COMMENT) {
        i++;
      } else {
        break;
      }
    }
  }

  function peek(offset = 0) {
    let idx = i + offset;
    while (idx < tokens.length) {
      const t = tokens[idx];
      if (t.type === TOKEN.PREPROC || t.type === TOKEN.COMMENT) {
        idx++;
      } else {
        break;
      }
    }
    const t = tokens[idx];
    return t || { type: TOKEN.EOF, value: '' };
  }

  function advance() {
    skipSkippable();
    if (i >= tokens.length) return { type: TOKEN.EOF, value: '', line: -1, col: -1 };
    return tokens[i++];
  }



  // Check if current token matches a type or value
  function match(typeOrValue) {
    const t = peek();
    return t.type === typeOrValue || t.value === typeOrValue;
  }

  // Skip tokens until we hit a semicolon or brace (with nesting)
  function skipToSemicolon() {
    let depth = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === TOKEN.LBRACE) depth++;
      if (t.type === TOKEN.RBRACE) {
        if (depth === 0) break;
        depth--;
      }
      if (t.type === TOKEN.SEMI && depth === 0) { i++; break; }
      i++;
    }
  }

  // Collect tokens until a given delimiter (with brace nesting)
  function collectUntil(delimType) {
    const collected = [];
    let depth = 0;
    skipSkippable();
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === TOKEN.LBRACE) depth++;
      if (t.type === TOKEN.RBRACE) {
        if (depth === 0) break;
        depth--;
      }
      if (t.type === delimType && depth === 0) break;
      collected.push(t);
      i++;
    }
    return collected;
  }

  // Read a type specifier (e.g., "struct Node*" → { baseType, isPointer, typeTokens })
  function readTypeSpec() {
    const typeTokens = [];
    let isPointer = false;
    let line = peek().line;

    // struct keyword
    if (match(TOKEN.STRUCT)) {
      typeTokens.push(advance());
      // struct name
      if (match(TOKEN.IDENTIFIER)) {
        typeTokens.push(advance());
      }
    } else if (match(TOKEN.INT) || match(TOKEN.CHAR) || match(TOKEN.FLOAT) ||
               match(TOKEN.DOUBLE) || match(TOKEN.VOID) || match(TOKEN.BOOL) ||
               match(TOKEN.SIZE_T)) {
      typeTokens.push(advance());
    } else if (match(TOKEN.IDENTIFIER)) {
      // Could be a typedef'd type
      typeTokens.push(advance());
    }

    // Check for const
    if (match(TOKEN.CONST)) {
      typeTokens.push(advance());
    }

    // Pointer stars — ** means pointer to pointer, still isPointer = true
    while (match(TOKEN.STAR)) {
      typeTokens.push(advance());
      isPointer = true; // any number of * means it's a pointer type
    }

    const typeStr = typeTokens.map(t => t.value).join(' ');
    const baseName = typeTokens.find(t => t.type === TOKEN.IDENTIFIER ||
                                           t.type === TOKEN.STRUCT ||
                                           t.type === TOKEN.INT ||
                                           t.type === TOKEN.CHAR ||
                                           t.type === TOKEN.FLOAT ||
                                           t.type === TOKEN.DOUBLE ||
                                           t.type === TOKEN.VOID);

    return {
      typeTokens,
      typeStr,
      isPointer,
      baseType: baseName ? baseName.value : typeStr,
      line,
    };
  }

  // Read a function parameter list: (param1, param2, ...)
  function readParamList() {
    const params = [];
    if (!match(TOKEN.LPAREN)) return params;
    advance(); // skip (

    let depth = 1;
    let currentParam = [];

    while (i < tokens.length && depth > 0) {
      const t = tokens[i];
      if (t.type === TOKEN.LPAREN) { depth++; currentParam.push(t); i++; }
      else if (t.type === TOKEN.RPAREN) {
        depth--;
        if (depth === 0) break;
        currentParam.push(t); i++;
      } else if (t.type === TOKEN.COMMA && depth === 1) {
        params.push(currentParam.map(t => t.value).join(' ').trim());
        currentParam = [];
        i++;
      } else {
        currentParam.push(t);
        i++;
      }
    }

    if (currentParam.length > 0) {
      params.push(currentParam.map(t => t.value).join(' ').trim());
    }

    if (i < tokens.length && tokens[i].type === TOKEN.RPAREN) {
      advance(); // skip )
    }

    return params;
  }

  // Check if a token is a type keyword
  function isTypeToken(tok) {
    return tok.type === TOKEN.STRUCT || tok.type === TOKEN.INT ||
           tok.type === TOKEN.CHAR || tok.type === TOKEN.FLOAT ||
           tok.type === TOKEN.DOUBLE || tok.type === TOKEN.VOID ||
           tok.type === TOKEN.BOOL || tok.type === TOKEN.SIZE_T ||
           tok.type === TOKEN.CONST || tok.value === 'unsigned' ||
           tok.value === 'signed' || tok.value === 'static' ||
           tok.value === 'extern' || tok.value === 'inline' ||
           tok.value === 'long' || tok.value === 'short';
  }

  // === MAIN PARSE LOOP ===
  while (i < tokens.length) {
    const tok = peek();
    if (tok.type === TOKEN.EOF) break;
    if (tok.type === TOKEN.PREPROC || tok.type === TOKEN.COMMENT) { i++; continue; }

    // --- Function detection must come BEFORE struct detection ---
    // This is critical: struct-as-return-type (e.g. "struct Node* func()") would
    // otherwise be consumed by the struct-detection branch which skips to semicolon
    if (tok.type === TOKEN.IDENTIFIER || tok.type === TOKEN.STAR ||
        tok.type === TOKEN.INT || tok.type === TOKEN.CHAR || tok.type === TOKEN.VOID ||
        tok.type === TOKEN.FLOAT || tok.type === TOKEN.DOUBLE || tok.type === TOKEN.BOOL ||
        tok.type === TOKEN.SIZE_T || tok.type === TOKEN.STRUCT || tok.value === 'static' ||
        tok.value === 'extern' || tok.value === 'inline' || tok.value === 'unsigned' ||
        tok.value === 'signed' || tok.value === 'long' || tok.value === 'short') {

      // Check if we're inside a struct body (brace depth > 0)
      // function detection inside struct bodies is invalid
      const savePos = i;

      // Read return type
      const returnType = readTypeSpec();

      // Check for function name (identifier)
      if (match(TOKEN.IDENTIFIER)) {
        const funcNameTok = advance();
        const funcName = funcNameTok.value;

        // Skip whitespace/comments
        skipSkippable();

        // Must be followed by (
        if (match(TOKEN.LPAREN)) {
          // This is a function!
          const funcLine = funcNameTok.line;
          const params = readParamList();

          // Collect body tokens
          let bodyTokens = [];
          let bodyLine = funcLine;
          let calls = [];

          skipSkippable();

          if (match(TOKEN.LBRACE)) {
            // Has a body
            let depth = 1;
            i++; // skip {
            bodyLine = peek().line;

            while (i < tokens.length && depth > 0) {
              const bt = tokens[i];
              if (bt.type === TOKEN.LBRACE) depth++;
              else if (bt.type === TOKEN.RBRACE) depth--;

              if (depth > 0) {
                bodyTokens.push(bt);

                // Detect malloc/free calls inside body
                if (bt.type === TOKEN.MALLOC || bt.value === 'malloc') {
                  for (let bi = bodyTokens.length - 2; bi >= 0; bi--) {
                    const pt = bodyTokens[bi];
                    if (pt.type === TOKEN.ASSIGN) {
                      const varToken = bodyTokens[bi - 1];
                      if (varToken && varToken.type === TOKEN.IDENTIFIER) {
                        result.mallocs.push({ line: bt.line, variable: varToken.value });
                      }
                      break;
                    }
                  }
                }
                if (bt.type === TOKEN.FREE || bt.value === 'free') {
                  for (let bi = i + 1; bi < Math.min(i + 5, tokens.length); bi++) {
                    const pt = tokens[bi];
                    if (pt.type === TOKEN.IDENTIFIER) {
                      result.frees.push({ line: bt.line, variable: pt.value });
                      break;
                    }
                    if (pt.type === TOKEN.RPAREN) break;
                  }
                }

                // Detect function calls
                if (bt.type === TOKEN.IDENTIFIER && i + 1 < tokens.length && tokens[i + 1].type === TOKEN.LPAREN) {
                  calls.push({ name: bt.value, line: bt.line });
                }
              }
              i++;
            }

            // Skip trailing semicolon if any
            if (match(TOKEN.SEMI)) advance();

            result.functions.push({
              name: funcName,
              returnType: returnType.typeStr,
              params,
              bodyTokens,
              bodyLength: bodyTokens.length,
              line: funcLine,
              calls,
            });
          } else {
            // Function declaration (prototype) — no body, skip to ;
            skipToSemicolon();

            result.functions.push({
              name: funcName,
              returnType: returnType.typeStr,
              params,
              bodyTokens: [],
              bodyLength: 0,
              line: funcLine,
              calls: [],
              declaration: true,
            });
          }

          continue;
        }
      }

      // Not a function — restore position
      i = savePos;
    }

    // Struct definition
    if (tok.type === TOKEN.STRUCT) {
      const structLine = tok.line;
      advance(); // skip 'struct'

      let name = null;
      if (match(TOKEN.IDENTIFIER)) {
        name = advance().value;
      }

      // Check for typedef before the struct
      if (name === 'typedef') {
        // typedef struct { ... } Name; — skip for now
        while (i < tokens.length && tokens[i].type !== TOKEN.SEMI &&
               tokens[i].type !== TOKEN.RBRACE) {
          if (tokens[i].type === TOKEN.LBRACE) {
            // Skip the struct body
            let depth = 1;
            i++;
            while (i < tokens.length && depth > 0) {
              if (tokens[i].type === TOKEN.LBRACE) depth++;
              if (tokens[i].type === TOKEN.RBRACE) depth--;
              if (depth > 0) i++;
            }
          }
          i++;
        }
        if (i < tokens.length) i++; // skip ;
        continue;
      }

      if (match(TOKEN.LBRACE)) {
        advance(); // skip {
        const fields = [];

        while (i < tokens.length && !match(TOKEN.RBRACE)) {
          skipSkippable();
          // End of struct
          if (match(TOKEN.RBRACE)) break;

          const fieldLine = peek().line;
          const fieldTypeInfo = readTypeSpec();
          const fieldTokens = [];

          // Read field name(s) — may have multiple comma-separated
          const fieldNames = [];

          // Read the field declaration up to ;
          let semiFound = false;
          let localDepth = 0;

          while (i < tokens.length) {
            const t = tokens[i];
            if (t.type === TOKEN.LBRACE) localDepth++;
            if (t.type === TOKEN.RBRACE) { if (localDepth === 0) break; localDepth--; }
            if (t.type === TOKEN.SEMI && localDepth === 0) { semiFound = true; i++; break; }
            fieldTokens.push(t);
            i++;
          }

          // Extract field name(s) from fieldTokens
          let currentName = null;

          for (let ti = 0; ti < fieldTokens.length; ti++) {
            const ft = fieldTokens[ti];
            if (ft.type === TOKEN.IDENTIFIER && !isTypeToken(ft)) {
              const next = fieldTokens[ti + 1];
              if (next && (next.value === '[' || next.value === ',' || next.value === ';' || ti === fieldTokens.length - 1)) {
                currentName = ft.value;
              } else if (next && next.type === TOKEN.SEMI) {
                currentName = ft.value;
              } else if (next && next.value === '=') {
                currentName = ft.value;
              } else if (!next || (next.type !== TOKEN.IDENTIFIER && next.value !== '*' &&
                         next.type !== TOKEN.STAR)) {
                currentName = ft.value;
              }
            }
            if (ft.type === TOKEN.STAR && fieldTokens[ti + 1] && fieldTokens[ti + 1].type === TOKEN.IDENTIFIER) {
              currentName = fieldTokens[ti + 1].value;
            }
          }

          if (currentName) {
            fieldNames.push(currentName);
          }

          if (fieldNames.length === 0) {
            for (let ti = fieldTokens.length - 1; ti >= 0; ti--) {
              const ft = fieldTokens[ti];
              if (ft.type === TOKEN.IDENTIFIER && !isTypeToken(ft)) {
                fieldNames.push(ft.value);
                break;
              }
            }
          }

          fields.push({
            type: fieldTypeInfo.typeStr,
            typeTokens: fieldTypeInfo.typeTokens,
            isPointer: fieldTypeInfo.isPointer,
            name: fieldNames[0] || 'unknown',
            names: fieldNames,
            line: fieldLine,
          });
        }

        if (match(TOKEN.RBRACE)) {
          advance(); // skip }
        }

        // Skip optional struct variable name(s) after }
        while (match(TOKEN.IDENTIFIER) || match(TOKEN.STAR) || match(TOKEN.COMMA) || match(TOKEN.LBRACKET) ||
               match(TOKEN.RBRACKET)) {
          i++;
        }
        if (match(TOKEN.SEMI)) advance(); // skip ;

        const selfRefFields = fields.filter(f =>
          f.isPointer && (f.type.includes(name) || (f.type.includes('struct') && name && f.type.includes(name)))
        );
        const ptrToSelf = selfRefFields.length;

        result.structs.push({
          name,
          fields,
          ptrToSelf,
          selfRefFields: selfRefFields.map(f => f.name),
          line: structLine,
        });

        continue;
      }

      // struct keyword without body? skip just this token (not to semicolon — that could eat a function body)
      // Just advance and let it be handled as a regular token
      continue;
    }

    // Typedef (simplified)
    if (tok.type === TOKEN.TYPEDEF) {
      skipToSemicolon();
      continue;
    }

    // Global variable/array declarations (like 'int stack[MAX];' or 'int top = -1;')
    if (tok.type === TOKEN.INT || tok.type === TOKEN.CHAR || tok.type === TOKEN.FLOAT ||
        tok.type === TOKEN.DOUBLE || tok.type === TOKEN.BOOL || tok.value === 'unsigned' ||
        tok.value === 'signed' || tok.value === 'long' || tok.value === 'short' ||
        tok.value === 'static' || tok.value === 'extern' || tok.value === 'const') {
      const savePos = i;
      const varType = readTypeSpec();

      // If next token is identifier, this could be a global var
      if (match(TOKEN.IDENTIFIER)) {
        const varNameTok = advance();
        const varName = varNameTok.value;

        // Check if followed by [ (array), = (assignment), or ; (simple decl)
        if (match(TOKEN.LBRACKET)) {
          // Array declaration: int stack[MAX]; — skip to ;
          skipToSemicolon();
          continue;
        } else if (match(TOKEN.ASSIGN)) {
          // int top = -1; — skip to ;
          skipToSemicolon();
          continue;
        } else if (match(TOKEN.SEMI)) {
          // int count; — consume ;
          advance();
          continue;
        }
      }

      // Not a global var declaration, restore position
      i = savePos;
    }

    // Global pointer assignments (like head = createNode();)
    if (tok.type === TOKEN.IDENTIFIER && peek(1) && peek(1).type === TOKEN.ASSIGN) {
      const varName = advance().value; // identifier
      advance(); // skip =
      // Collect RHS
      const rhsTokens = collectUntil(TOKEN.SEMI);
      if (i < tokens.length && tokens[i].type === TOKEN.SEMI) i++;

      const rhsStr = rhsTokens.map(t => t.value).join('');
      // Check for malloc
      if (rhsStr.includes('malloc') || rhsStr.includes('calloc')) {
        result.mallocs.push({ line: tok.line, variable: varName });
      }
      // Check for NULL
      if (rhsStr === 'NULL') {
        result.pointerAssigns.push({ target: varName, source: 'NULL', line: tok.line });
      }
      continue;
    }

    // Skip anything we don't understand (advance 1)
    i++;
  }

  return result;
}


/**
 * Get source code line for error context.
 */
export function getLine(source, lineNum) {
  const lines = source.split('\n');
  if (lineNum >= 1 && lineNum <= lines.length) {
    return lines[lineNum - 1].trim();
  }
  return '';
}
