// =============================================================
//  SeeDS — constants.js
//  Single source of truth for the entire app.
//  Every magic string, number, and config value lives here.
//  If you find yourself typing a raw string elsewhere — it
//  probably belongs here instead.
// =============================================================


// -------------------------------------------------------------
//  DATA STRUCTURE TYPES
//  Used by: Toolbar, analyzer, structure renderers
// -------------------------------------------------------------
export const DS_TYPES = {
  LINKED_LIST:    'linked_list',
  BINARY_TREE:    'binary_tree',
  ARRAY:          'array',
  SORT_RACE:      'sort_race',

  // Phase 3 — stubs, not used in P1
  STACK:          'stack',
  QUEUE:          'queue',
  GRAPH:          'graph',
  HASH_TABLE:     'hash_table',
  AVL_TREE:       'avl_tree',
  HEAP:           'heap',

  // Linked list variants
  DOUBLY_LIST:    'doubly_list',
  CIRCULAR_LIST:  'circular_list',

  // Queue variants
  CIRCULAR_QUEUE: 'circular_queue',
  DEQUEUE:        'dequeue',
};


// -------------------------------------------------------------
//  ERROR / BUG TYPES
//  These are the failure modes SeeDS can visualize.
//  Used by: ErrorHighlight, ErrorPanel, JSON data files
// -------------------------------------------------------------
export const ERROR_TYPES = {
  // Linked List
  DANGLING_POINTER:   'dangling_pointer',   // node with no incoming edge, floating
  CYCLE:              'cycle',              // loop detected, glows red after N steps
  MISSING_NULL:       'missing_null',       // last node doesn't point to NULL
  MEMORY_LEAK:        'memory_leak',        // removed node still in memory, behind camera

  // Tree
  BST_VIOLATION:      'bst_violation',      // left child > parent, or right child < parent
  MISSING_CHILD:      'missing_child',      // expected child pointer is NULL unexpectedly

  // Array
  OUT_OF_BOUNDS:      'out_of_bounds',      // access beyond array length
  UNINITIALIZED:      'uninitialized',      // slot accessed before being written

  // General
  NULL_DEREFERENCE:   'null_dereference',   // following a NULL pointer
  DOUBLE_FREE:        'double_free',        // freeing already-freed memory
  BUFFER_OVERFLOW:    'buffer_overflow',    // write past end of allocated block

  // Phase 3 extras — stubs
  STACK_OVERFLOW:     'stack_overflow',
  QUEUE_UNDERFLOW:    'queue_underflow',
  INVALID_ROTATION:   'invalid_rotation',
  HEAP_VIOLATION:     'heap_violation',
  HASH_COLLISION:     'hash_collision',
  DISCONNECTED:       'disconnected',
  INVALID_EDGE:       'invalid_edge',
};


// -------------------------------------------------------------
//  ANIMATION / PLAYBACK STATES
//  Used by: PlaybackController, AnimationLoop
// -------------------------------------------------------------
export const PLAYBACK_STATES = {
  IDLE:    'idle',      // nothing loaded yet
  PLAYING: 'playing',   // animation running
  PAUSED:  'paused',    // mid-animation, frozen
  STEPPED: 'stepped',   // advanced one operation manually
  DONE:    'done',      // animation finished all steps
};

export const PLAYBACK_SPEEDS = {
  SLOWEST: 0.1,
  SLOW:    0.5,
  NORMAL:  1.0,
  FAST:    2.0,
  FASTEST: 5.0,
  DEFAULT: 1.0,
};


// -------------------------------------------------------------
//  VISUAL / RENDERER CONFIG
//  Tweak these to change how the 3D scene looks globally.
//  Used by: SceneManager, NodeMesh, EdgeMesh, ErrorHighlight
// -------------------------------------------------------------
export const VISUAL = {
  // Scene
  BACKGROUND_COLOR:       0x0f0f13,   // near-black, slightly warm
  FOG_COLOR:              0x0f0f13,
  FOG_NEAR:               30,
  FOG_FAR:                120,

  // Lighting
  AMBIENT_INTENSITY:      0.6,
  DIRECTIONAL_INTENSITY:  0.9,
  DIRECTIONAL_POS:        { x: 10, y: 20, z: 10 },

  // Nodes
  NODE_RADIUS:            0.6,
  NODE_SEGMENTS:          32,
  NODE_COLOR:             0x4f8ef7,   // default blue
  NODE_EMISSIVE:          0x1a3a6e,
  NODE_HOVER_COLOR:       0x7db3ff,
  NODE_NULL_COLOR:        0x2a2a3a,   // dark, muted — null sphere

  // Edges / arrows
  EDGE_COLOR:             0x7a8aaa,
  EDGE_THICKNESS:         0.04,
  ARROW_HEAD_SIZE:        0.18,

  // Labels
  LABEL_FONT_SIZE:        48,         // canvas px — rendered to texture
  LABEL_COLOR:            '#ffffff',
  LABEL_BG:               'rgba(0,0,0,0)',
  LABEL_OFFSET_Y:         1.1,        // units above node center

  // Error states
  ERROR_COLOR:            0xff3333,
  ERROR_EMISSIVE:         0x7a0000,
  ERROR_PULSE_SPEED:      2.0,        // Hz
  ERROR_FLOAT_AMPLITUDE:  0.18,       // units — how much a dangling node bobs
  ERROR_FLOAT_SPEED:      1.2,

  // Cycle detection
  CYCLE_GLOW_COLOR:       0xff2222,
  CYCLE_LOOP_THRESHOLD:   10,         // loops before we flag and pause

  // Stack
  STACK_BOX_SIZE:         1.8,    // width and depth of each stack slot box
  STACK_BOX_HEIGHT:       0.8,    // height of each stack slot box
  STACK_OFFSET_Y:         0.15,   // gap between stacked boxes

  // Queue
  QUEUE_SLOT_SIZE:        1.6,    // width and depth of each queue slot box
  QUEUE_SLOT_HEIGHT:      1.2,    // height of each queue slot box
  QUEUE_GAP:              0.2,    // horizontal gap between queue slots

  // Graph
  GRAPH_VERTEX_RADIUS:    0.55,   // sphere radius for graph vertices
  GRAPH_VERTEX_COLOR:     0x4f8ef7,  // default vertex color (matches NODE_COLOR)
  GRAPH_VERTEX_EMISSIVE:  0x1a3a6e,  // default vertex emissive
  GRAPH_VISITED_COLOR:    0x4fc97e,  // green — visited vertex/edge
  GRAPH_EDGE_DEFAULT:     0x7a8aaa,  // unvisited edge color (matches EDGE_COLOR)

  // Heap
  HEAP_MIN_COLOR:         0x5da8ff,  // blue — min-heap root
  HEAP_MAX_COLOR:         0xff6b6b,  // red-orange — max-heap root

  // Hash Table
  HT_BUCKET_WIDTH:        2.2,    // width of each bucket box
  HT_BUCKET_HEIGHT:       0.9,    // height of each bucket box
  HT_BUCKET_GAP:          0.25,   // vertical gap between bucket rows
  HT_BUCKET_COLOR:        0x4f8ef7,  // occupied bucket color
  HT_EMPTY_COLOR:         0x2a2a3a,  // empty bucket color (dark/muted)

  // Sorting race bars
  BAR_WIDTH:              0.9,
  BAR_GAP:                0.2,
  BAR_COLOR_DEFAULT:      0x4f8ef7,
  BAR_COLOR_COMPARING:    0xffc44d,   // amber — currently being compared
  BAR_COLOR_SORTED:       0x4fc97e,   // green — in final position
  BAR_COLOR_PIVOT:        0xff6b6b,   // red — quicksort pivot
};


// -------------------------------------------------------------
//  CAMERA CONFIG
//  Used by: SceneManager
// -------------------------------------------------------------
export const CAMERA = {
  FOV:          60,
  NEAR:         0.1,
  FAR:          200,
  DEFAULT_POS:  { x: 0, y: 6, z: 18 },
  MIN_DISTANCE: 3,
  MAX_DISTANCE: 60,
};


// -------------------------------------------------------------
//  LAYOUT CONFIG
//  Spacing rules for how DS nodes are arranged in 3D space.
//  Used by: LinkedList, BinaryTree, Array, SortRace
// -------------------------------------------------------------
export const LAYOUT = {
  // Linked list
  LL_NODE_SPACING:      2.8,    // horizontal gap between nodes
  LL_Y:                 0,      // y position of the list plane
  LL_DANGLING_Y:        3.5,    // how high a dangling node floats

  // Binary tree
  TREE_LEVEL_HEIGHT:    2.8,    // vertical gap between levels
  TREE_H_SPREAD:        1.6,    // horizontal spread multiplier per level

  // Array
  ARRAY_SLOT_WIDTH:     1.2,
  ARRAY_SLOT_HEIGHT:    1.2,
  ARRAY_SLOT_DEPTH:     0.3,
  ARRAY_GAP:            0.15,

  // Sort race
  SORT_RACE_SPACING:    14,      // horizontal distance between each sorter
  SORT_BAR_MAX_HEIGHT:  6,       // tallest bar height in units
  BAR_WIDTH:            0.9,     // individual sort bar width (also used by SortRace)
  BAR_GAP:              0.2,     // gap between sort bars

  // Stack
  STACK_CENTER_X:       0,       // center x position for the stack column
  STACK_BASE_Y:        -3,       // y position of the bottom stack slot

  // Queue
  QUEUE_Y:              0,       // y position of the queue row

  // Graph
  GRAPH_RADIUS:         5.5,     // radius of the circular vertex layout

  // Heap
  HEAP_LEVEL_HEIGHT:    2.8,     // vertical gap between heap levels
  HEAP_H_SPREAD:        1.6,     // horizontal spread multiplier per level

  // Hash Table
  HT_START_X:          -4.0,     // leftmost bucket x position
  HT_START_Y:           3.5,     // topmost bucket y position
  HT_ROW_STEP_Y:       -1.4,     // y step between bucket rows (negative = downward)
};


// -------------------------------------------------------------
//  EVENT NAMES
//  Used by: eventBus — all events flow through these strings.
//  If you add a new event, add it here first.
// -------------------------------------------------------------
export const EVENTS = {
  // Data loading
  DS_LOADED:          'ds:loaded',        // payload: { type, data }
  DS_CLEARED:         'ds:cleared',

  // Playback
  PLAYBACK_PLAY:      'playback:play',
  PLAYBACK_PAUSE:     'playback:pause',
  PLAYBACK_STEP:      'playback:step',
  PLAYBACK_RESET:     'playback:reset',
  PLAYBACK_SPEED:     'playback:speed',   // payload: { speed }
  PLAYBACK_STATE:     'playback:state',   // payload: { state } — emitted by controller

  // Interaction
  NODE_HOVERED:       'node:hovered',     // payload: { node } | null
  NODE_CLICKED:       'node:clicked',     // payload: { node }
  ERROR_SELECTED:     'error:selected',   // payload: { error }

  // UI
  TOOLTIP_SHOW:       'tooltip:show',     // payload: { x, y, content }
  TOOLTIP_HIDE:       'tooltip:hide',
  ERROR_PANEL_UPDATE: 'errorpanel:update',// payload: { errors[] }
};


// -------------------------------------------------------------
//  JSON SCHEMA — what every data file must look like
//  This is the CONTRACT between the analyzer and the renderer.
//  The renderer only reads these fields — nothing else.
//
//  Example shape (this is documentation, not live code):
//
//  {
//    "type": "linked_list",           // DS_TYPES value
//    "label": "My linked list",       // display name (optional)
//    "nodes": [
//      {
//        "id": "n1",                  // unique string
//        "value": 42,                 // displayed in label
//        "address": "0x1a2b",         // optional, shown in tooltip
//        "next": "n2",                // id of next node | "null" | null
//        "error": "dangling_pointer"  // ERROR_TYPES value | null
//      }
//    ],
//    "head": "n1",                    // id of head node
//    "operations": [                  // sequence of animation steps
//      {
//        "type": "traverse",          // operation type (see OP_TYPES)
//        "from": "n1",
//        "to": "n2"
//      }
//    ],
//    "errors": [                      // top-level error list for ErrorPanel
//      {
//        "type": "dangling_pointer",
//        "nodeId": "n1",
//        "message": "Node n1 has no incoming reference",
//        "line": null                 // line number in source code (P3+)
//      }
//    ]
//  }
// -------------------------------------------------------------
export const SCHEMA_VERSION = '1.0.0';


// -------------------------------------------------------------
//  OPERATION TYPES
//  The step-by-step operations inside a JSON "operations" array.
//  Used by: PlaybackController, structure renderers
// -------------------------------------------------------------
export const OP_TYPES = {
  // Traversal
  TRAVERSE:       'traverse',     // move pointer from node A to node B
  HIGHLIGHT:      'highlight',    // light up a specific node
  COMPARE:        'compare',      // compare two nodes (sorting, search)

  // Mutation
  INSERT:         'insert',       // add a new node
  DELETE:         'delete',       // remove a node
  SWAP:           'swap',         // swap two node values (sorting)
  UPDATE:         'update',       // change a node's value

  // Pointer ops
  SET_HEAD:       'set_head',     // move head pointer
  SET_NEXT:       'set_next',     // rewire a next pointer
  SET_NULL:       'set_null',     // set pointer to null

  // Error ops — triggered by error detection
  FLAG_ERROR:     'flag_error',   // mark a node as errored
  CYCLE_DETECT:   'cycle_detect', // pause and glow the cycle
  LEAK_SHOW:      'leak_show',    // float a leaked node behind camera
};


// -------------------------------------------------------------
//  MISC APP CONFIG
// -------------------------------------------------------------
export const APP = {
  NAME:             'SeeDS',
  VERSION:          '0.1.0',
  PHASE:            1,
  DATA_PATH:        './data/',    // relative path to JSON demo files
  DEFAULT_DS:       DS_TYPES.LINKED_LIST,
  DEFAULT_DEMO:     'linked-list-ok.json',
};