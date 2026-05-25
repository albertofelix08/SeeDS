// =============================================================
//  SeeDS — structDetector.js
//  Analyzes parsed struct definitions and functions to
//  determine the most likely data structure type.
//  Returns the best match with a confidence breakdown.
// =============================================================

import { DS_TYPES } from '../core/constants.js';


// Scoring weights
const WEIGHTS = {
  STRUCT_MATCH:   30,   // struct has pointer-to-self fields
  FUNC_MATCH:     20,   // function name matches a DS pattern
  FIELD_NAME:     15,   // field name hints (next, prev, left, right)
  MALLOC_PATTERN: 10,   // heap allocation patterns
  PARAM_PATTERN:  10,   // parameter types in functions
  COMPLEXITY:      5,   // layout complexity (tree > list)
};

// Function name patterns for each data structure type
const FUNC_PATTERNS = {
  [DS_TYPES.LINKED_LIST]: [
    /insert.*(head|node|list)/i, /delete.*(head|node|list)/i,
    /(search|find).*list/i, /reverse/i, /print.*list/i,
    /create.*list/i, /add.*node/i, /remove.*node/i,
    /push.*front/i, /pop.*front/i, /insert.*end/i,
  ],
  [DS_TYPES.STACK]: [
    /push/i, /pop/i, /peek/i, /is_empty/i, /is_full/i,
    /stack.*init/i, /stack.*push/i, /stack.*pop/i,
  ],
  [DS_TYPES.QUEUE]: [
    /enqueue/i, /dequeue/i, /front/i, /rear/i,
    /queue.*init/i, /circular.*queue/i,
  ],
  [DS_TYPES.BINARY_TREE]: [
    /insert.*(node|tree)/i, /search.*(node|tree)/i,
    /inorder/i, /preorder/i, /postorder/i,
    /level.*order/i, /tree.*(insert|delete|search)/i,
    /bst/i, /find.*(min|max)/i,
  ],
  [DS_TYPES.AVL_TREE]: [
    /rotate/i, /balance/i, /avl/i,
    /left.*rotate/i, /right.*rotate/i,
    /update.*height/i, /height/i,
  ],
  [DS_TYPES.HEAP]: [
    /heapify/i, /heap.*(insert|delete|sort)/i,
    /sift.*(up|down)/i, /bubble.*(up|down)/i,
    /max.*heap/i, /min.*heap/i,
    /extract.*(min|max)/i,
  ],
  [DS_TYPES.GRAPH]: [
    /bfs/i, /dfs/i, /dijkstra/i, /prim/i, /kruskal/i,
    /add.*edge/i, /remove.*edge/i, /graph/i,
    /topological/i, /shortest.*path/i,
    /minimum.*spanning/i, /mst/i,
  ],
  [DS_TYPES.HASH_TABLE]: [
    /hash/i, /insert.*hash/i, /search.*hash/i,
    /delete.*hash/i, /rehash/i, /chaining/i,
  ],
  [DS_TYPES.SORT_RACE]: [
    /bubble.?sort/i, /selection.?sort/i, /insertion.?sort/i,
    /merge.?sort/i, /quick.?sort/i, /shell.?sort/i,
    /sort/i, /compare/i, /swap/i,
  ],
};

// Field name patterns for self-referencing structs
const FIELD_PATTERNS = {
  next:   { type: DS_TYPES.LINKED_LIST, weight: 15 },
  prev:   { type: DS_TYPES.LINKED_LIST, weight: 10 }, // doubly linked
  left:   { type: DS_TYPES.BINARY_TREE, weight: 15 },
  right:  { type: DS_TYPES.BINARY_TREE, weight: 15 },
  key:    { type: DS_TYPES.BINARY_TREE, weight: 5 },
  data:   { type: DS_TYPES.LINKED_LIST, weight: 3 },
  head:   { type: DS_TYPES.LINKED_LIST, weight: 5 },
  top:    { type: DS_TYPES.STACK,       weight: 10 },
  bottom: { type: DS_TYPES.STACK,       weight: 5 },
  front:  { type: DS_TYPES.QUEUE,       weight: 10 },
  rear:   { type: DS_TYPES.QUEUE,       weight: 10 },
  edge:   { type: DS_TYPES.GRAPH,       weight: 8 },
  adj:    { type: DS_TYPES.GRAPH,       weight: 10 },
  vertex: { type: DS_TYPES.GRAPH,       weight: 8 },
  table:  { type: DS_TYPES.HASH_TABLE,  weight: 8 },
  bucket: { type: DS_TYPES.HASH_TABLE,  weight: 8 },
  height: { type: DS_TYPES.AVL_TREE,    weight: 8 },
  priority: { type: DS_TYPES.HEAP,      weight: 10 },
  array:  { type: DS_TYPES.ARRAY,       weight: 5 },
};


/**
 * Detect data structure type from parsed source code.
 * @param {Object} parseResult — from parser.parse()
 * @returns {{ type: string, confidence: number, breakdown: Object, metadata: Object }}
 */
export function detect(parseResult) {
  const { structs, functions, mallocs } = parseResult;

  const scores = {};
  const breakdown = {};

  // Initialize scores for all DS types
  for (const type of Object.values(DS_TYPES)) {
    scores[type] = 0;
    breakdown[type] = { structScore: 0, funcScore: 0, fieldScore: 0, mallocScore: 0, total: 0 };
  }

  // ---- Score from struct definitions ----
  for (const st of structs) {
    for (const field of st.fields) {
      // Check field name hints
      const pattern = FIELD_PATTERNS[field.name];
      if (pattern) {
        scores[pattern.type] += pattern.weight;
        breakdown[pattern.type].fieldScore += pattern.weight;
      }

      // Check if this field is a pointer type (self-referencing struct)
      if (field.isPointer) {
        // Pointer field with type matching struct name → self-reference
        if (st.name && field.type.includes(st.name)) {
          scores[DS_TYPES.LINKED_LIST] += WEIGHTS.STRUCT_MATCH;
          breakdown[DS_TYPES.LINKED_LIST].structScore += WEIGHTS.STRUCT_MATCH;
        }
      }
    }

    // Count pointer-to-self fields
    if (st.ptrToSelf === 1) {
      // Singly linked / stack / queue
      scores[DS_TYPES.LINKED_LIST] += 5;
      breakdown[DS_TYPES.LINKED_LIST].structScore += 5;
    } else if (st.ptrToSelf >= 2) {
      // Doubly linked (next + prev) or tree (left + right)
      scores[DS_TYPES.LINKED_LIST] += 5;
      scores[DS_TYPES.BINARY_TREE] += 5;
      breakdown[DS_TYPES.LINKED_LIST].structScore += 5;
      breakdown[DS_TYPES.BINARY_TREE].structScore += 5;
    }

    // Struct size check: tiny struct (< 3 fields) suggests list node
    if (st.fields.length <= 3 && st.ptrToSelf >= 1) {
      scores[DS_TYPES.LINKED_LIST] += 5;
      breakdown[DS_TYPES.LINKED_LIST].structScore += 5;
    }
    // Larger struct with 2 pointers suggests tree
    if (st.ptrToSelf >= 2) {
      scores[DS_TYPES.BINARY_TREE] += 8;
      breakdown[DS_TYPES.BINARY_TREE].structScore += 8;
    }
  }

  // ---- Score from function names ----
  for (const fn of functions) {
    for (const [type, patterns] of Object.entries(FUNC_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(fn.name)) {
          scores[type] += WEIGHTS.FUNC_MATCH;
          breakdown[type].funcScore += WEIGHTS.FUNC_MATCH;
          break;
        }
      }
    }

    // Check parameters: if function takes a struct pointer, that's a hint
    for (const param of fn.params) {
      for (const st of structs) {
        if (st.name && param.includes(st.name)) {
          // Function operates on this struct type
          // Boost linked list and tree scores
          scores[DS_TYPES.LINKED_LIST] += 3;
          scores[DS_TYPES.BINARY_TREE] += 3;
          breakdown[DS_TYPES.LINKED_LIST].funcScore += 3;
          breakdown[DS_TYPES.BINARY_TREE].funcScore += 3;
        }
      }
      // Check for void* patterns (generic DS)
      if (param.includes('void*') || param.includes('void *')) {
        scores[DS_TYPES.LINKED_LIST] += 2;
        breakdown[DS_TYPES.LINKED_LIST].funcScore += 2;
      }
    }
  }

  // ---- Score from malloc patterns ----
  if (mallocs.length > 1) {
    // Multiple malloc calls suggest dynamic structure (list, tree)
    scores[DS_TYPES.LINKED_LIST] += WEIGHTS.MALLOC_PATTERN;
    breakdown[DS_TYPES.LINKED_LIST].mallocScore += WEIGHTS.MALLOC_PATTERN;
    scores[DS_TYPES.BINARY_TREE] += WEIGHTS.MALLOC_PATTERN;
    breakdown[DS_TYPES.BINARY_TREE].mallocScore += WEIGHTS.MALLOC_PATTERN;
  }

  // ---- Determine best match ----
  let bestType = DS_TYPES.LINKED_LIST;
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    breakdown[type].total = score;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // If no real pattern matched, default to array
  if (bestScore < 5) {
    bestType = DS_TYPES.ARRAY;
  }

  // Confidence: normalize against max possible score (~100)
  const confidence = Math.min(1.0, Math.round((bestScore / 100) * 100) / 100);

  // Extract metadata for the winning type
  const metadata = _extractMetadata(parseResult, bestType);

  return {
    type: bestType,
    confidence,
    score: bestScore,
    breakdown,
    metadata,
  };
}


/**
 * Extract metadata needed for visualization.
 */
function _extractMetadata(parseResult, dsType) {
  const { structs, functions, mallocs, frees } = parseResult;

  const meta = {
    structName: null,
    selfRefPtrs: [],
    functionCount: functions.length,
    functionNames: functions.map(f => f.name),
    mallocCount: mallocs.length,
    freeCount: frees.length,
    hasHeadPointer: false,
    hasRoot: false,
    nodeCount: 0,
  };

  if (structs.length > 0) {
    const mainStruct = structs[0];
    meta.structName = mainStruct.name;
    meta.selfRefPtrs = mainStruct.selfRefFields || [];
    meta.nodeCount = mainStruct.fields.length;

    // Check for head/root pointers
    meta.hasHeadPointer = functions.some(f =>
      /head|list|root/i.test(f.name) || f.params.some(p => /head|list|root/i.test(p))
    );
    meta.hasRoot = functions.some(f => /root|tree/i.test(f.name));
  }

  return meta;
}
