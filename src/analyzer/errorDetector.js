// =============================================================
//  SeeDS — errorDetector.js
//  Analyzes parsed C code for common bugs.
//  Each detected error includes: type, message, line number,
//  and suggested fix.
// =============================================================

import { ERROR_TYPES } from '../core/constants.js';
import { TOKEN, getSourceLine } from './tokenizer.js';


/**
 * Detect errors in C source code.
 * @param {Object} parseResult — from parser.parse()
 * @param {string} source — raw source code (for line extraction)
 * @returns {Array} — [{ type, nodeId, message, line, sourceLine, fix }]
 */
export function detectErrors(parseResult, source) {
  const errors = [];
  const { structs, functions, mallocs, frees, pointerAssigns } = parseResult;

  // Track allocated variables for leak detection
  const allocated = new Map(); // variable → { line, freed: false, used: false }
  const freed = new Set();     // variable names that have been freed

  // ---- 1. Detect malloc without free (memory leaks) ----
  for (const m of mallocs) {
    allocated.set(m.variable, { line: m.line, freed: false, used: false });
  }

  // Mark frees
  for (const f of frees) {
    freed.add(f.variable);
    if (allocated.has(f.variable)) {
      allocated.get(f.variable).freed = true;
    } else {
      // Free without malloc — potential double free or invalid free
      const srcLine = getSourceLine(source, f.line);
      errors.push({
        type: ERROR_TYPES.DOUBLE_FREE,
        nodeId: null,
        message: `Calling free() on '${f.variable}' which was never allocated with malloc. This could be a double-free bug.`,
        line: f.line,
        sourceLine: srcLine,
        fix: 'Ensure free() is only called once on pointers returned by malloc(). Set pointer to NULL after freeing.',
        severity: 'high',
      });
    }
  }

  // Check for unfreed allocations
  for (const [varName, info] of allocated) {
    if (!info.freed) {
      const srcLine = getSourceLine(source, info.line);
      errors.push({
        type: ERROR_TYPES.MEMORY_LEAK,
        nodeId: null,
        message: `Memory leak: '${varName}' is allocated with malloc() on line ${info.line} but never freed with free().`,
        line: info.line,
        sourceLine: srcLine,
        fix: 'Call free() on this pointer when it is no longer needed to avoid memory leaks.',
        severity: 'medium',
      });
    }
  }

  // ---- 2. Check for double free ----
  // Already handled above for frees without matching alloc

  // ---- 3. Detect dangling pointers ----
  // A dangling pointer occurs when memory is freed but the pointer
  // is still used. We detect functions that call free() and then
  // try to access fields of the freed struct.
  for (const fn of functions) {
    if (fn.bodyTokens && fn.bodyTokens.length > 0) {
      const body = fn.bodyTokens.map(t => t.value).join(' ');
      const freedVars = [...freed];

      for (const fv of freedVars) {
        // Check if the freed variable is accessed after free in the same function
        const freeIndex = fn.bodyTokens.findIndex(t =>
          (t.type === 'free' || t.value === 'free') &&
          fn.bodyTokens.slice(Math.max(0, fn.bodyTokens.indexOf(t) - 5), fn.bodyTokens.indexOf(t) + 5)
            .some(tt => tt.value === fv)
        );

        if (freeIndex >= 0) {
          // Check for access after the free call
          const afterFree = fn.bodyTokens.slice(freeIndex + 5);
          const accessAfterFree = afterFree.find(t => t.value === fv);

          if (accessAfterFree) {
            const srcLine = getSourceLine(source, accessAfterFree.line);
            errors.push({
              type: ERROR_TYPES.DANGLING_POINTER,
              nodeId: null,
              message: `Dangling pointer: '${fv}' is used on line ${accessAfterFree.line} after being freed. This accesses invalid memory.`,
              line: accessAfterFree.line,
              sourceLine: srcLine,
              fix: `After calling free(${fv}), set ${fv} = NULL to prevent dangling pointer access.`,
              severity: 'high',
            });
          }
        }
      }
    }
  }

  // ---- 4. Detect NULL pointer dereference ----
  for (const fn of functions) {
    if (!fn.bodyTokens) continue;
    const body = fn.bodyTokens.map(t => t.value).join(' ');

    // Check for patterns like: ptr->field without checking ptr == NULL first
    // Simplified: look for -> access right after malloc or NULL assignment
    for (let ti = 0; ti < fn.bodyTokens.length - 2; ti++) {
      const t = fn.bodyTokens[ti];
      const t1 = fn.bodyTokens[ti + 1];

      // Check for -> or . access after pointer
      if ((t1 && (t1.value === '->' || t1.type === TOKEN?.ARROW)) && t.type === 'identifier') {
        const ptrName = t.value;

        // Check if this pointer could be NULL (just been freed, or assigned NULL)
        const beforeSlice = fn.bodyTokens.slice(Math.max(0, ti - 15), ti);
        const beforeStr = beforeSlice.map(t => t.value).join(' ');

        // Check if there's a NULL check before the access
        const hasNullCheck = beforeStr.includes('NULL') &&
          (beforeStr.includes('if') || beforeStr.includes('==') || beforeStr.includes('!='));

        if (!hasNullCheck) {
          // Check if this pointer was recently freed
          const isRecentFree = beforeStr.includes('free(') && beforeStr.includes(ptrName);

          if (isRecentFree) {
            const srcLine = getSourceLine(source, t.line);
            errors.push({
              type: ERROR_TYPES.NULL_DEREFERENCE,
              nodeId: null,
              message: `NULL pointer dereference: accessing '${ptrName}->' on line ${t.line} after it was freed without reassignment.`,
              line: t.line,
              sourceLine: srcLine,
              fix: `Check if ${ptrName} is NULL before accessing its members, or reassign it after freeing.`,
              severity: 'critical',
            });
          }
        }
      }
    }
  }

  // ---- 5. Missing NULL termination in linked structures ----
  for (const st of structs) {
    for (const field of st.fields) {
      if (field.name === 'next' && field.isPointer) {
        // Check if functions that create nodes set next to NULL
        for (const fn of functions) {
          if (fn.bodyTokens && fn.bodyTokens.length > 0) {
            const bodyStr = fn.bodyTokens.map(t => t.value).join(' ');

            // Check for create/insert functions that don't NULL-terminate
            if (/(create|new|insert|add).*(node|list)/i.test(fn.name)) {
              // Look for next = NULL pattern
              const hasNullTermination = /next\s*=\s*NULL/i.test(bodyStr) ||
                /next\s*=\s*nullptr/i.test(bodyStr);

              if (!hasNullTermination && fn.bodyTokens.length > 10) {
                const srcLine = getSourceLine(source, fn.line);
                errors.push({
                  type: ERROR_TYPES.NULL_DEREFERENCE,
                  nodeId: null,
                  message: `Missing NULL termination: In '${fn.name}', new node's 'next' pointer is not set to NULL. This can cause traversal issues.`,
                  line: fn.line,
                  sourceLine: srcLine,
                  fix: 'Add `newNode->next = NULL;` after allocating the new node to ensure it is properly terminated.',
                  severity: 'low',
                });
              }
            }
          }
        }
      }
    }
  }

  // ---- 6. Buffer overflow detection (simplified) ----
  for (const fn of functions) {
    if (!fn.bodyTokens) continue;

    for (let ti = 0; ti < fn.bodyTokens.length - 3; ti++) {
      const t = fn.bodyTokens[ti];
      const t1 = fn.bodyTokens[ti + 1];
      const t2 = fn.bodyTokens[ti + 2];
      const t3 = fn.bodyTokens[ti + 3];

      // Pattern: arr[i] where i might be out of bounds
      if (t1 && t1.value === '[' && t3 && t3.value === ']' && t.type === 'identifier') {
        const arrName = t.value;
        const indexStr = t2.value;

        // Check for literal index that could be out of bounds
        if (!isNaN(Number(indexStr))) {
          const index = Number(indexStr);
          if (index > 100) { // Heuristic: any literal index > 100 is suspicious
            const srcLine = getSourceLine(source, t.line);
            errors.push({
              type: ERROR_TYPES.BUFFER_OVERFLOW,
              nodeId: null,
              message: `Potential buffer overflow: accessing '${arrName}[${index}]' on line ${t.line}. Index ${index} may exceed the array bounds.`,
              line: t.line,
              sourceLine: srcLine,
              fix: 'Ensure array index is within bounds. Use a constant or check index < array_size before accessing.',
              severity: 'high',
            });
          }
        }
      }
    }
  }

  // ---- 7. Use-after-free detection ----
  // Combined with dangling pointer detection above

  return errors;
}


/**
 * Generate an error badge/icon based on severity.
 */
export function getErrorSeverity(error) {
  const sev = error.severity || 'medium';
  switch (sev) {
    case 'critical': return { icon: '🔴', color: '#ff2222', label: 'Critical' };
    case 'high':     return { icon: '🟠', color: '#ff6b35', label: 'High' };
    case 'medium':   return { icon: '🟡', color: '#ffc44d', label: 'Medium' };
    case 'low':      return { icon: '🔵', color: '#4f8ef7', label: 'Low' };
    default:         return { icon: '⚪', color: '#8890aa', label: 'Info' };
  }
}
