// =============================================================
//  SeeDS — opGenerator.js
//  Generates animation operations from parsed C code.
//  Maps detected data structure type to appropriate
//  visualization operations (traverse, highlight, etc.)
//  and synthesizes node data for the renderers.
// =============================================================

import { OP_TYPES, DS_TYPES, ERROR_TYPES } from '../core/constants.js';


class OpGenerator {
  constructor(parseResult, structDetectResult, errors) {
    this._parseResult   = parseResult;
    this._structResult  = structDetectResult;
    this._errors        = errors || [];
    this._operations    = [];
  }


  /**
   * Generate the complete visualization data.
   * @returns {{ type, nodes, head|root|slots, operations, errors, label }}
   */
  generate() {
    const type = this._structResult?.type || DS_TYPES.LINKED_LIST;
    const nodeData = this._buildNodeData(type);
    this._operations = [];
    this._generateOps(type, nodeData);
    const errorData = this._generateErrorData(nodeData);

    return {
      type,
      label: this._generateLabel(type),
      schemaVersion: '1.0.0',
      ...nodeData,
      operations: this._operations,
      errors: errorData,
    };
  }


  // -----------------------------------------------------------
  //  Build node data from parsed structs
  // -----------------------------------------------------------
  _buildNodeData(type) {
    const { structs } = this._parseResult;
    const errors = this._errors;
    const nodeCount = this._estimateNodeCount();

    switch (type) {
      case DS_TYPES.LINKED_LIST:
        return this._buildLinkedListData(nodeCount, errors);

      case DS_TYPES.STACK:
        return this._buildStackData(nodeCount, errors);

      case DS_TYPES.QUEUE:
        return this._buildQueueData(nodeCount, errors);

      case DS_TYPES.BINARY_TREE:
      case DS_TYPES.AVL_TREE:
        return this._buildTreeData(nodeCount, errors);

      case DS_TYPES.ARRAY:
        return this._buildArrayData(nodeCount, errors);

      case DS_TYPES.HASH_TABLE:
        return this._buildHashTableData(nodeCount, errors);

      case DS_TYPES.GRAPH:
        return this._buildGraphData(nodeCount, errors);

      case DS_TYPES.HEAP:
        return this._buildHeapData(nodeCount, errors);

      case DS_TYPES.SORT_RACE:
        return this._buildSortRaceData(errors);

      default:
        return this._buildLinkedListData(nodeCount, errors);
    }
  }


  _estimateNodeCount() {
    const { functions, mallocs } = this._parseResult;
    const mallocEstimate = Math.min(8, Math.max(3, mallocs.length + 2));
    const funcEstimate = Math.min(8, Math.max(3, functions.length + 2));
    return Math.min(8, Math.max(mallocEstimate, funcEstimate));
  }


  _generateSampleNodes(count, errors, ptrField) {
    const nodes = [];
    const errorMap = new Map();
    for (const err of errors) {
      if (err.nodeId) errorMap.set(err.nodeId, err.type);
    }

    for (let i = 0; i < count; i++) {
      const id = `n${i + 1}`;
      const isLast = i === count - 1;
      let error = errorMap.get(id) || null;

      const node = {
        id,
        value: this._generateValue(i),
        address: `0x${(0x1000 + i * 0x100).toString(16)}`,
        error,
      };

      if (isLast) {
        node[ptrField] = 'null';
      } else {
        node[ptrField] = `n${i + 2}`;
      }
      nodes.push(node);
    }

    nodes.push({
      id: 'null',
      value: null,
      address: null,
      [ptrField]: null,
      error: null,
    });

    return nodes;
  }


  _generateValue(index) {
    const values = [12, 37, 59, 81, 94, 26, 43, 68];
    return values[index % values.length];
  }


  _buildLinkedListData(count, errors) {
    // Separate off-chain errors (special visualization) from on-chain errors
    const offChainTypes = new Set([
      ERROR_TYPES.MEMORY_LEAK,
      ERROR_TYPES.DANGLING_POINTER,
    ]);
    const onChainErrors = errors.filter(e => !offChainTypes.has(e.type));
    const offChainErrors = errors.filter(e => offChainTypes.has(e.type));
    const cycleError = errors.find(e => e.type === ERROR_TYPES.CYCLE);

    const nodes = [];
    const errorMap = new Map();
    for (const err of onChainErrors) {
      if (err.nodeId) errorMap.set(err.nodeId, err.type);
    }

    // Main chain nodes (without off-chain errors)
    const mainCount = Math.max(3, count);
    for (let i = 0; i < mainCount; i++) {
      const id = `n${i + 1}`;
      const isLast = i === mainCount - 1;
      let error = errorMap.get(id) || null;

      const node = {
        id,
        value: this._generateValue(i),
        address: `0x${(0x1000 + i * 0x100).toString(16)}`,
        error,
      };

      if (isLast) {
        node.next = null;
      } else {
        node.next = `n${i + 2}`;
      }
      nodes.push(node);
    }

    // NULL terminator
    nodes.push({
      id: 'null',
      value: null,
      address: null,
      next: null,
      error: null,
    });

    // Off-chain nodes (memory leaks, dangling pointers) — NOT linked to main chain
    for (let idx = 0; idx < offChainErrors.length; idx++) {
      const err = offChainErrors[idx];
      const id = err.nodeId || `off_${idx + 1}`;
      nodes.push({
        id,
        value: this._generateValue(mainCount + idx),
        address: `0x${(0x2000 + idx * 0x100).toString(16)}`,
        next: null, // not reachable from head — off-chain
        error: err.type,
      });
    }

    return {
      nodes,
      head: 'n1',
      ...(cycleError ? { cycleEntry: `n${Math.min(3, mainCount)}` } : {}),
    };
  }


  _buildTreeData(count, errors) {
    const values = [40, 20, 60, 10, 30, 50, 70];
    const nodeCount = Math.min(count, values.length);
    const nodes = [];
    const errorMap = new Map();
    for (const err of errors) {
      if (err.nodeId) errorMap.set(err.nodeId, err.type);
    }

    for (let i = 0; i < nodeCount; i++) {
      const id = `n${i + 1}`;
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;
      nodes.push({
        id,
        value: values[i],
        address: `0x${(0x2a00 + i * 0x10).toString(16)}`,
        left: leftIdx < nodeCount ? `n${leftIdx + 1}` : null,
        right: rightIdx < nodeCount ? `n${rightIdx + 1}` : null,
        error: errorMap.get(id) || null,
      });
    }

    return { nodes, root: 'n1' };
  }


  _buildArrayData(count, errors) {
    const slotCount = Math.min(8, Math.max(4, count));
    const values = [12, 37, 59, 81, 94, 26, 43, 68];
    const errorMap = new Map();
    for (const err of errors) {
      if (err.nodeId) errorMap.set(err.nodeId, err.type);
    }

    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        id: `s${i}`,
        index: i,
        value: values[i % values.length],
        empty: false,
        error: errorMap.get(`s${i}`) || null,
      });
    }

    return { slots, length: slotCount };
  }


  _buildStackData(count, errors) {
    const slotCount = Math.min(6, Math.max(3, count));
    const values = [10, 20, 30, 40, 50, 60];
    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        id: `s${i}`,
        index: i,
        value: values[i % values.length],
        empty: false,
        error: null,
      });
    }
    return {
      slots,
      length: slotCount,
      top: slotCount - 1,
    };
  }


  _buildQueueData(count, errors) {
    const slotCount = Math.min(6, Math.max(3, count));
    const values = [5, 10, 15, 20, 25, 30];
    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        id: `s${i}`,
        index: i,
        value: values[i % values.length],
        empty: false,
        error: null,
      });
    }
    return {
      slots,
      length: slotCount,
      front: 0,
      rear: slotCount - 1,
    };
  }


  _buildHashTableData(count, errors) {
    const tableSize = 5;
    const buckets = [
      { index: 0, chain: [{ id: 'c0', key: 10, value: 42, next: 'c1' }, { id: 'c1', key: 25, value: 7, next: null }] },
      { index: 1, chain: [] },
      { index: 2, chain: [{ id: 'c2', key: 12, value: 99, next: null }] },
      { index: 3, chain: [] },
      { index: 4, chain: [{ id: 'c3', key: 8, value: 33, next: 'c4' }, { id: 'c4', key: 18, value: 55, next: null }] },
    ];
    return { buckets, tableSize };
  }


  _buildGraphData(count, errors) {
    const vertices = [
      { id: 'v1', label: 'A' },
      { id: 'v2', label: 'B' },
      { id: 'v3', label: 'C' },
      { id: 'v4', label: 'D' },
      { id: 'v5', label: 'E' },
    ];
    const edges = [
      { from: 'v1', to: 'v2', weight: 4 },
      { from: 'v1', to: 'v3', weight: 2 },
      { from: 'v2', to: 'v4', weight: 5 },
      { from: 'v3', to: 'v4', weight: 1 },
      { from: 'v3', to: 'v5', weight: 3 },
      { from: 'v4', to: 'v5', weight: 6 },
    ];
    return { vertices, edges, directed: false };
  }


  _buildHeapData(count, errors) {
    // Build a min-heap from values
    const values = [12, 20, 30, 40, 50, 35, 45];
    return {
      values,
      heapType: 'min',
      heapSize: values.length,
    };
  }


  _buildSortRaceData(errors) {
    const initialValues = [29, 10, 14, 37, 13, 33, 48, 22];
    const sorters = [
      {
        id: 'bubble',
        label: 'Bubble Sort',
        complexity: 'O(n²)',
        steps: this._generateSortSteps('bubble', initialValues),
      },
      {
        id: 'selection',
        label: 'Selection Sort',
        complexity: 'O(n²)',
        steps: this._generateSortSteps('selection', initialValues),
      },
      {
        id: 'insertion',
        label: 'Insertion Sort',
        complexity: 'O(n²)',
        steps: this._generateSortSteps('insertion', initialValues),
      },
      {
        id: 'merge',
        label: 'Merge Sort',
        complexity: 'O(n log n)',
        steps: this._generateSortSteps('merge', initialValues),
      },
      {
        id: 'shell',
        label: 'Shell Sort',
        complexity: 'O(n log² n)',
        steps: this._generateSortSteps('shell', initialValues),
      },
    ];
    return { initialValues, sorters };
  }


  _generateSortSteps(algorithm, values) {
    const n = values.length;
    const steps = [];

    switch (algorithm) {
      case 'bubble': {
        const arr = [...values];
        for (let i = 0; i < n - 1; i++) {
          for (let j = 0; j < n - i - 1; j++) {
            steps.push({ type: 'compare', i: j, j: j + 1 });
            if (arr[j] > arr[j + 1]) {
              [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
              steps.push({ type: 'swap', i: j, j: j + 1, state: [...arr] });
            }
          }
          steps.push({ type: 'sorted', i: n - i - 1, state: [...arr] });
        }
        steps.push({ type: 'done', state: [...arr] });
        break;
      }

      case 'selection': {
        const arr = [...values];
        for (let i = 0; i < n - 1; i++) {
          let minIdx = i;
          for (let j = i + 1; j < n; j++) {
            steps.push({ type: 'compare', i: minIdx, j });
            if (arr[j] < arr[minIdx]) minIdx = j;
          }
          if (minIdx !== i) {
            [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
            steps.push({ type: 'swap', i, j: minIdx, state: [...arr] });
          }
          steps.push({ type: 'sorted', i, state: [...arr] });
        }
        steps.push({ type: 'done', state: [...arr] });
        break;
      }

      case 'insertion': {
        const arr = [...values];
        for (let i = 1; i < n; i++) {
          const key = arr[i];
          let j = i - 1;
          steps.push({ type: 'compare', i, j });
          while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            steps.push({ type: 'swap', i: j, j: j + 1, state: [...arr] });
            j--;
          }
          arr[j + 1] = key;
          steps.push({ type: 'sorted', i, state: [...arr] });
        }
        steps.push({ type: 'done', state: [...arr] });
        break;
      }

      case 'merge': {
        const arr = [...values];
        // Generate merge sort steps
        const mergeSteps = [];
        const mergeArr = [...values];

        const merge = (left, mid, right) => {
          const leftArr = mergeArr.slice(left, mid + 1);
          const rightArr = mergeArr.slice(mid + 1, right + 1);
          let i = 0, j = 0, k = left;

          while (i < leftArr.length && j < rightArr.length) {
            mergeSteps.push({ type: 'compare', i: left + i, j: mid + 1 + j });
            if (leftArr[i] <= rightArr[j]) {
              mergeArr[k] = leftArr[i];
              i++;
            } else {
              mergeArr[k] = rightArr[j];
              j++;
            }
            mergeSteps.push({
              type: 'merge',
              indices: [left, right],
              state: [...mergeArr],
            });
            k++;
          }

          while (i < leftArr.length) {
            mergeArr[k] = leftArr[i];
            mergeSteps.push({
              type: 'merge',
              indices: [left, right],
              state: [...mergeArr],
            });
            i++; k++;
          }

          while (j < rightArr.length) {
            mergeArr[k] = rightArr[j];
            mergeSteps.push({
              type: 'merge',
              indices: [left, right],
              state: [...mergeArr],
            });
            j++; k++;
          }
        };

        const mergeSort = (left, right) => {
          if (left < right) {
            const mid = Math.floor((left + right) / 2);
            mergeSteps.push({ type: 'split', left: [left, mid], right: [mid + 1, right] });
            mergeSort(left, mid);
            mergeSort(mid + 1, right);
            merge(left, mid, right);
            for (let i = left; i <= right; i++) {
              mergeSteps.push({ type: 'sorted', i, state: [...mergeArr] });
            }
          }
        };

        mergeSort(0, n - 1);
        mergeSteps.push({ type: 'done', state: [...mergeArr] });

        // Limit steps to avoid overwhelming
        return mergeSteps.slice(0, 120);
      }

      case 'shell': {
        const arr = [...values];
        const steps = [];

        // Generate gaps sequence
        const gaps = [4, 2, 1];
        for (const gap of gaps) {
          for (let i = gap; i < n; i++) {
            const temp = arr[i];
            let j = i;
            steps.push({ type: 'compare', i, j: j - gap });
            while (j >= gap && arr[j - gap] > temp) {
              arr[j] = arr[j - gap];
              steps.push({ type: 'swap', i: j, j: j - gap, state: [...arr] });
              j -= gap;
            }
            arr[j] = temp;
            steps.push({ type: 'sorted', i, state: [...arr] });
          }
        }
        steps.push({ type: 'done', state: [...arr] });
        return steps;
      }
    }

    return steps;
  }


  _generateLabel(type) {
    const labels = {
      [DS_TYPES.LINKED_LIST]: 'Linked List — Analyzed from C Code',
      [DS_TYPES.BINARY_TREE]: 'Binary Tree — Analyzed from C Code',
      [DS_TYPES.AVL_TREE]:    'AVL Tree — Analyzed from C Code',
      [DS_TYPES.ARRAY]:       'Array — Analyzed from C Code',
      [DS_TYPES.STACK]:       'Stack — Analyzed from C Code',
      [DS_TYPES.QUEUE]:       'Queue — Analyzed from C Code',
      [DS_TYPES.GRAPH]:       'Graph — Analyzed from C Code',
      [DS_TYPES.HASH_TABLE]:  'Hash Table — Analyzed from C Code',
      [DS_TYPES.HEAP]:        'Heap — Analyzed from C Code',
      [DS_TYPES.SORT_RACE]:   'Sort Race — Analyzed from C Code',
    };
    return labels[type] || 'Data Structure — Analyzed from C Code';
  }


  _generateOps(type, nodeData) {
    switch (type) {
      case DS_TYPES.LINKED_LIST:
      case DS_TYPES.DOUBLY_LIST:
        this._generateLinearOps(nodeData);
        break;

      case DS_TYPES.STACK:
        this._generateStackOps(nodeData);
        break;

      case DS_TYPES.QUEUE:
        this._generateQueueOps(nodeData);
        break;

      case DS_TYPES.BINARY_TREE:
      case DS_TYPES.AVL_TREE:
        this._generateTreeOps(nodeData);
        break;

      case DS_TYPES.HEAP:
        this._generateHeapOps(nodeData);
        break;

      case DS_TYPES.ARRAY:
        this._generateArrayOps(nodeData);
        break;

      case DS_TYPES.GRAPH:
        this._generateGraphOps(nodeData);
        break;

      case DS_TYPES.HASH_TABLE:
        this._generateHashTableOps(nodeData);
        break;

      case DS_TYPES.SORT_RACE:
        break;

      default:
        this._generateLinearOps(nodeData);
    }

    this._appendErrorOps();
  }


  _generateLinearOps(nodeData) {
    const nodes = nodeData.nodes || [];
    const nodeMap = new Map(nodes.filter(n => n.id !== 'null').map(n => [n.id, n]));

    // Walk the main chain from head — excludes off-chain error nodes
    const mainNodes = [];
    let curId = nodeData.head;
    const visited = new Set();
    while (curId && !visited.has(curId)) {
      if (curId === 'null') break;
      visited.add(curId);
      const node = nodeMap.get(curId);
      if (!node) break;
      mainNodes.push(node);
      curId = node.next;
    }

    for (let i = 0; i < mainNodes.length; i++) {
      const node = mainNodes[i];
      this._operations.push({
        type: OP_TYPES.HIGHLIGHT,
        nodeId: node.id,
        message: `Visit node ${node.id} (value: ${node.value})`,
      });

      if (i < mainNodes.length - 1) {
        const next = mainNodes[i + 1];
        this._operations.push({
          type: OP_TYPES.TRAVERSE,
          from: node.id,
          to: next.id,
          message: `Traverse from ${node.id} to ${next.id}`,
        });
      }
    }
  }


  _generateTreeOps(nodeData) {
    const nodes = nodeData.nodes || [];
    const visited = new Set();

    const traverse = (rootId) => {
      const node = nodes.find(n => n.id === rootId);
      if (!node || visited.has(rootId)) return;

      if (node.left && node.left !== 'null') {
        this._operations.push({
          type: OP_TYPES.TRAVERSE,
          from: rootId,
          to: node.left,
          message: `Traverse left to ${node.left}`,
        });
        traverse(node.left);
      }

      if (!visited.has(rootId)) {
        visited.add(rootId);
        this._operations.push({
          type: OP_TYPES.HIGHLIGHT,
          nodeId: rootId,
          message: `Visit node ${rootId} (value: ${node.value})`,
        });
      }

      if (node.right && node.right !== 'null') {
        this._operations.push({
          type: OP_TYPES.TRAVERSE,
          from: rootId,
          to: node.right,
          message: `Traverse right to ${node.right}`,
        });
        traverse(node.right);
      }
    };

    const rootId = nodeData.root || 'n1';
    traverse(rootId);
  }


  _generateStackOps(nodeData) {
    const slots = nodeData.slots || [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (i === slots.length - 1) {
        this._operations.push({
          type: 'push',
          slotId: slot.id,
          value: slot.value,
          message: `Push ${slot.value} onto stack`,
        });
      } else {
        this._operations.push({
          type: 'push',
          slotId: slot.id,
          value: slot.value,
          message: `Push ${slot.value} onto stack`,
        });
      }
    }
    // Pop from top to bottom
    for (let i = slots.length - 1; i >= 0; i--) {
      this._operations.push({
        type: 'pop',
        slotId: slots[i].id,
        message: `Pop ${slots[i].value} from stack`,
      });
    }
  }

  _generateQueueOps(nodeData) {
    const slots = nodeData.slots || [];
    for (const slot of slots) {
      this._operations.push({
        type: 'enqueue',
        slotId: slot.id,
        value: slot.value,
        message: `Enqueue ${slot.value}`,
      });
    }
    for (const slot of slots) {
      this._operations.push({
        type: 'dequeue',
        slotId: slot.id,
        message: `Dequeue ${slot.value}`,
      });
    }
  }

  _generateHeapOps(nodeData) {
    const values = nodeData.values || [];
    for (let i = 0; i < values.length; i++) {
      this._operations.push({
        type: 'highlight',
        idx: i,
        nodeId: `h${i}`,
        message: `Heap element [${i}] = ${values[i]}`,
      });
    }
    // Sift up animation (bottom to top)
    for (let i = values.length - 1; i > 0; i--) {
      this._operations.push({
        type: 'sift_up',
        idx: i,
        message: `Sift up element at index ${i}`,
      });
    }
  }

  _generateGraphOps(nodeData) {
    const verts = nodeData.vertices || [];
    // BFS traversal
    for (const v of verts) {
      this._operations.push({
        type: 'visit_vertex',
        nodeId: v.id,
        message: `Visit vertex ${v.label || v.id}`,
      });
      // Traverse edges from this vertex
      const edges = nodeData.edges?.filter(e => e.from === v.id) || [];
      for (const e of edges) {
        this._operations.push({
          type: 'traverse_edge',
          from: e.from,
          to: e.to,
          message: `Traverse edge ${e.from} → ${e.to}`,
        });
      }
    }
  }

  _generateHashTableOps(nodeData) {
    const buckets = nodeData.buckets || [];
    for (const bucket of buckets) {
      const chain = bucket.chain || [];
      for (const node of chain) {
        this._operations.push({
          type: 'highlight',
          nodeId: node.id,
          message: `Hash table key ${node.key} → value ${node.value}`,
        });
      }
    }
  }

  _generateArrayOps(nodeData) {
    const slots = nodeData.slots || [];
    for (const slot of slots) {
      this._operations.push({
        type: OP_TYPES.HIGHLIGHT,
        nodeId: slot.id,
        message: `Access slot [${slot.index}] = ${slot.value}`,
      });
    }
  }


  _appendErrorOps() {
    for (const error of this._errors) {
      const nodeId = error.nodeId || 'n1';

      switch (error.type) {
        case ERROR_TYPES.MEMORY_LEAK:
          this._operations.push({
            type: OP_TYPES.LEAK_SHOW,
            nodeId,
            message: error.message,
          });
          break;

        case ERROR_TYPES.CYCLE:
          this._operations.push({
            type: OP_TYPES.CYCLE_DETECT,
            nodeId,
            message: error.message,
          });
          break;

        case ERROR_TYPES.DANGLING_POINTER:
        case ERROR_TYPES.NULL_DEREFERENCE:
        case ERROR_TYPES.DOUBLE_FREE:
        case ERROR_TYPES.BUFFER_OVERFLOW:
          this._operations.push({
            type: OP_TYPES.FLAG_ERROR,
            nodeId,
            errorType: error.type,
            message: error.message,
          });
          break;

        default:
          this._operations.push({
            type: OP_TYPES.FLAG_ERROR,
            nodeId,
            errorType: error.type,
            message: error.message,
          });
      }
    }
  }


  _generateErrorData(nodeData) {
    const allNodeIds = [];
    if (nodeData.nodes) {
      for (const n of nodeData.nodes) {
        if (n.id && n.id !== 'null') allNodeIds.push(n.id);
      }
    }
    if (nodeData.slots) {
      for (const s of nodeData.slots) allNodeIds.push(s.id);
    }

    return this._errors.map((err, idx) => {
      let nodeId = err.nodeId;

      // If error has no nodeId, try to find the best match
      if (!nodeId) {
        // For off-chain error types, look for nodes with matching error type
        if (err.type && allNodeIds.length > 0) {
          const matchingNode = nodeData.nodes?.find(n => n.error === err.type);
          if (matchingNode) {
            nodeId = matchingNode.id;
          }
        }
        // Fallback: assign by index
        if (!nodeId && allNodeIds.length > 0) {
          nodeId = allNodeIds[Math.min(idx, allNodeIds.length - 1)];
        }
      }
      if (!nodeId && nodeData.nodes && nodeData.nodes.length > 0) {
        nodeId = nodeData.nodes[Math.min(idx, nodeData.nodes.length - 1)].id;
      }
      if (!nodeId && nodeData.slots && nodeData.slots.length > 0) {
        nodeId = nodeData.slots[Math.min(idx, nodeData.slots.length - 1)].id;
      }

      return {
        type: err.type,
        nodeId: nodeId || 'n1',
        message: err.message,
        line: err.line || null,
        sourceLine: err.sourceLine || null,
        severity: err.severity || 'medium',
        fix: err.fix || null,
      };
    });
  }


  _nodeId(index) {
    return `n${index + 1}`;
  }
}


/**
 * Generate visualization data from analysis results.
 */
export function generate(parseResult, structDetectResult, errors) {
  const generator = new OpGenerator(parseResult, structDetectResult, errors);
  return generator.generate();
}
