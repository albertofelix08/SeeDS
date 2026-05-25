// =============================================================
//  SeeDS — analyzer/index.js
//  Main entry point for the C code analyzer.
//
//  Pipeline:
//    source code -> tokenizer -> parser -> structDetector -> errorDetector -> opGenerator
//
//  Usage:
//    import { analyze } from './analyzer/index.js';
//    const result = analyze(sourceCode);
//    eventBus.emit(EVENTS.DS_LOADED, { type: result.type, data: result.data });
// =============================================================

import { tokenize } from './tokenizer.js';
import { parse } from './parser.js';
import { detect } from './structDetector.js';
import { detectErrors } from './errorDetector.js';
import { generate } from './opGenerator.js';
import { score } from './confidenceScorer.js';

import { DS_TYPES } from '../core/constants.js';


/**
 * Analyze C source code - full pipeline.
 * @param {string} source - C source code to analyze
 * @returns {Object} analysis result
 */
export function analyze(source) {
  try {
    // Step 1: Tokenize
    const tokenResult = tokenize(source);
    if (!tokenResult.success) {
      return {
        success: false,
        type: DS_TYPES.LINKED_LIST,
        error: 'Tokenization failed',
        data: null,
        errors: [],
        confidence: { score: 0, percent: 0, level: 'failed' },
        tokenCount: 0,
        errorCount: 0,
        operCount: 0,
      };
    }

    // Filter out preprocessor directives and comments for parsing
    const meaningfulTokens = tokenResult.tokens.filter(t =>
      t.type !== 'preprocessor' && t.type !== 'comment' && t.type !== 'eof'
    );

    // Step 2: Parse
    const parseResult = parse(meaningfulTokens);

    // Step 3: Detect data structure
    const structResult = detect(parseResult);

    // Step 4: Detect errors
    const errors = detectErrors(parseResult, source);

    // Step 5: Generate visualization data
    const visualizationData = generate(parseResult, structResult, errors);

    // Step 6: Score confidence
    const confidence = score(tokenResult, parseResult, structResult);

    return {
      success: true,
      type: structResult.type,
      confidence,
      tokenCount: tokenResult.tokens.length,
      errorCount: errors.length,
      operCount: visualizationData.operations?.length || 0,
      data: visualizationData,
      errors,
      parseErrors: parseResult.errors,
      metrics: {
        functions: parseResult.functions.length,
        structs: parseResult.structs.length,
        mallocs: parseResult.mallocs.length,
        frees: parseResult.frees.length,
      },
      raw: { tokenResult, parseResult, structResult },
    };

  } catch (err) {
    console.error('[Analyzer] Fatal error:', err);
    return {
      success: false,
      type: DS_TYPES.LINKED_LIST,
      error: err.message || 'Unknown analyzer error',
      data: null,
      errors: [],
      confidence: { score: 0, percent: 0, level: 'error' },
      tokenCount: 0,
      errorCount: 0,
      operCount: 0,
    };
  }
}


/**
 * Get template C code samples for common data structures.
 */
export function getTemplates() {
  return [
    {
      id: 'linked_list',
      label: 'Linked List',
      code: `// Singly Linked List
#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;
};

struct Node* createNode(int value) {
    struct Node* newNode = (struct Node*)malloc(sizeof(struct Node));
    newNode->data = value;
    newNode->next = NULL;
    return newNode;
}

void insertAtHead(struct Node** head, int value) {
    struct Node* newNode = createNode(value);
    newNode->next = *head;
    *head = newNode;
}

void printList(struct Node* head) {
    struct Node* current = head;
    while (current != NULL) {
        printf("%d -> ", current->data);
        current = current->next;
    }
    printf("NULL\\n");
}
`,
    },
    {
      id: 'binary_tree',
      label: 'Binary Tree',
      code: `// Binary Search Tree
#include <stdio.h>
#include <stdlib.h>

struct TreeNode {
    int data;
    struct TreeNode* left;
    struct TreeNode* right;
};

struct TreeNode* createNode(int value) {
    struct TreeNode* newNode = (struct TreeNode*)malloc(sizeof(struct TreeNode));
    newNode->data = value;
    newNode->left = NULL;
    newNode->right = NULL;
    return newNode;
}

struct TreeNode* insert(struct TreeNode* root, int value) {
    if (root == NULL) {
        return createNode(value);
    }
    if (value < root->data) {
        root->left = insert(root->left, value);
    } else if (value > root->data) {
        root->right = insert(root->right, value);
    }
    return root;
}

void inorder(struct TreeNode* root) {
    if (root != NULL) {
        inorder(root->left);
        printf("%d ", root->data);
        inorder(root->right);
    }
}
`,
    },
    {
      id: 'array_ops',
      label: 'Array Operations',
      code: `// Array Operations
#include <stdio.h>

#define SIZE 10

int linearSearch(int arr[], int n, int key) {
    for (int i = 0; i < n; i++) {
        if (arr[i] == key) {
            return i;
        }
    }
    return -1;
}

void reverseArray(int arr[], int n) {
    int temp;
    for (int i = 0; i < n / 2; i++) {
        temp = arr[i];
        arr[i] = arr[n - 1 - i];
        arr[n - 1 - i] = temp;
    }
}
`,
    },
    {
      id: 'stack',
      label: 'Stack',
      code: `// Stack using Array
#include <stdio.h>
#include <stdlib.h>
#define MAX 100

struct Stack {
    int arr[MAX];
    int top;
};

void init(struct Stack* stack) {
    stack->top = -1;
}

void push(struct Stack* stack, int value) {
    if (stack->top >= MAX - 1) {
        printf("Stack Overflow!\\n");
        return;
    }
    stack->arr[++stack->top] = value;
}

int pop(struct Stack* stack) {
    if (stack->top < 0) {
        printf("Stack Underflow!\\n");
        return -1;
    }
    return stack->arr[stack->top--];
}
`,
    },
    {
      id: 'queue',
      label: 'Queue',
      code: `// Queue using Array
#include <stdio.h>
#include <stdlib.h>
#define MAX 100

struct Queue {
    int arr[MAX];
    int front;
    int rear;
};

void init(struct Queue* queue) {
    queue->front = -1;
    queue->rear = -1;
}

void enqueue(struct Queue* queue, int value) {
    if (queue->rear >= MAX - 1) {
        printf("Queue Overflow!\\n");
        return;
    }
    if (queue->front == -1) queue->front = 0;
    queue->arr[++queue->rear] = value;
}

int dequeue(struct Queue* queue) {
    if (queue->front == -1 || queue->front > queue->rear) {
        printf("Queue Underflow!\\n");
        return -1;
    }
    return queue->arr[queue->front++];
}
`,
    },
    {
      id: 'sorting',
      label: 'Sorting Algorithms',
      code: `// Sorting Algorithms
#include <stdio.h>

void bubbleSort(int arr[], int n) {
    int temp;
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

void selectionSort(int arr[], int n) {
    int minIdx, temp;
    for (int i = 0; i < n - 1; i++) {
        minIdx = i;
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIdx]) {
                minIdx = j;
            }
        }
        temp = arr[i];
        arr[i] = arr[minIdx];
        arr[minIdx] = temp;
    }
}
`,
    },
    {
      id: 'hash_table',
      label: 'Hash Table',
      code: `// Hash Table with Separate Chaining
#include <stdio.h>
#include <stdlib.h>

struct HashNode {
    int key;
    int value;
    struct HashNode* next;
};

struct HashTable {
    struct HashNode** buckets;
    int size;
};

struct HashTable* createTable(int size) {
    struct HashTable* table = (struct HashTable*)malloc(sizeof(struct HashTable));
    table->buckets = (struct HashNode**)calloc(size, sizeof(struct HashNode*));
    table->size = size;
    return table;
}

int hashFunction(int key, int size) {
    return key % size;
}

void insert(struct HashTable* table, int key, int value) {
    int index = hashFunction(key, table->size);
    struct HashNode* newNode = (struct HashNode*)malloc(sizeof(struct HashNode));
    newNode->key = key;
    newNode->value = value;
    newNode->next = table->buckets[index];
    table->buckets[index] = newNode;
}
`,
    },
    {
      id: 'graph',
      label: 'Graph',
      code: `// Graph using Adjacency List
#include <stdio.h>
#include <stdlib.h>

struct AdjNode {
    int vertex;
    struct AdjNode* next;
};

struct Graph {
    int numVertices;
    struct AdjNode** adjLists;
};

struct AdjNode* createNode(int v) {
    struct AdjNode* newNode = (struct AdjNode*)malloc(sizeof(struct AdjNode));
    newNode->vertex = v;
    newNode->next = NULL;
    return newNode;
}

struct Graph* createGraph(int vertices) {
    struct Graph* graph = (struct Graph*)malloc(sizeof(struct Graph));
    graph->numVertices = vertices;
    graph->adjLists = (struct AdjNode**)calloc(vertices, sizeof(struct AdjNode*));
    return graph;
}

void addEdge(struct Graph* graph, int src, int dest) {
    struct AdjNode* newNode = createNode(dest);
    newNode->next = graph->adjLists[src];
    graph->adjLists[src] = newNode;
}
`,
    },
    {
      id: 'doubly_list',
      label: 'Doubly Linked List',
      code: `// Doubly Linked List
#include <stdio.h>
#include <stdlib.h>

struct DNode {
    int data;
    struct DNode* prev;
    struct DNode* next;
};

struct DNode* createDNode(int value) {
    struct DNode* newNode = (struct DNode*)malloc(sizeof(struct DNode));
    newNode->data = value;
    newNode->prev = NULL;
    newNode->next = NULL;
    return newNode;
}

void insertFront(struct DNode** head, int value) {
    struct DNode* newNode = createDNode(value);
    if (*head != NULL) {
        (*head)->prev = newNode;
    }
    newNode->next = *head;
    *head = newNode;
}

void printForward(struct DNode* head) {
    struct DNode* cur = head;
    while (cur != NULL) {
        printf("%d <-> ", cur->data);
        cur = cur->next;
    }
    printf("NULL\\n");
}

void printBackward(struct DNode* tail) {
    struct DNode* cur = tail;
    while (cur != NULL) {
        printf("%d <-> ", cur->data);
        cur = cur->prev;
    }
    printf("NULL\\n");
}
`,
    },
    {
      id: 'avl_tree',
      label: 'AVL Tree',
      code: `// AVL Tree with balance factors
#include <stdio.h>
#include <stdlib.h>

struct AVLNode {
    int data;
    struct AVLNode* left;
    struct AVLNode* right;
    int height;
};

int height(struct AVLNode* n) {
    return n ? n->height : 0;
}

int max(int a, int b) {
    return a > b ? a : b;
}

int getBalance(struct AVLNode* n) {
    return n ? height(n->left) - height(n->right) : 0;
}

struct AVLNode* createAVLNode(int value) {
    struct AVLNode* node = (struct AVLNode*)malloc(sizeof(struct AVLNode));
    node->data = value;
    node->left = NULL;
    node->right = NULL;
    node->height = 1;
    return node;
}

struct AVLNode* rightRotate(struct AVLNode* y) {
    struct AVLNode* x = y->left;
    struct AVLNode* T2 = x->right;
    x->right = y;
    y->left = T2;
    y->height = max(height(y->left), height(y->right)) + 1;
    x->height = max(height(x->left), height(x->right)) + 1;
    return x;
}

struct AVLNode* leftRotate(struct AVLNode* x) {
    struct AVLNode* y = x->right;
    struct AVLNode* T2 = y->left;
    y->left = x;
    x->right = T2;
    x->height = max(height(x->left), height(x->right)) + 1;
    y->height = max(height(y->left), height(y->right)) + 1;
    return y;
}

struct AVLNode* insertAVL(struct AVLNode* node, int value) {
    if (node == NULL) return createAVLNode(value);
    if (value < node->data)
        node->left = insertAVL(node->left, value);
    else if (value > node->data)
        node->right = insertAVL(node->right, value);
    else return node;

    node->height = 1 + max(height(node->left), height(node->right));
    int balance = getBalance(node);

    if (balance > 1 && value < node->left->data)
        return rightRotate(node);
    if (balance < -1 && value > node->right->data)
        return leftRotate(node);
    if (balance > 1 && value > node->left->data) {
        node->left = leftRotate(node->left);
        return rightRotate(node);
    }
    if (balance < -1 && value < node->right->data) {
        node->right = rightRotate(node->right);
        return leftRotate(node);
    }
    return node;
}

void inorderAVL(struct AVLNode* root) {
    if (root != NULL) {
        inorderAVL(root->left);
        printf("%d(bf=%d) ", root->data, getBalance(root));
        inorderAVL(root->right);
    }
}
`,
    },
    {
      id: 'heap',
      label: 'Binary Heap',
      code: `// Min Heap using Array
#include <stdio.h>
#define MAX 100

struct MinHeap {
    int arr[MAX];
    int size;
};

void initHeap(struct MinHeap* heap) {
    heap->size = 0;
}

void swap(int* a, int* b) {
    int t = *a; *a = *b; *b = t;
}

void siftUp(struct MinHeap* heap, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (heap->arr[parent] <= heap->arr[idx]) break;
        swap(&heap->arr[parent], &heap->arr[idx]);
        idx = parent;
    }
}

void siftDown(struct MinHeap* heap, int idx) {
    int smallest = idx;
    int left = 2 * idx + 1;
    int right = 2 * idx + 2;
    if (left < heap->size && heap->arr[left] < heap->arr[smallest])
        smallest = left;
    if (right < heap->size && heap->arr[right] < heap->arr[smallest])
        smallest = right;
    if (smallest != idx) {
        swap(&heap->arr[idx], &heap->arr[smallest]);
        siftDown(heap, smallest);
    }
}

void insertHeap(struct MinHeap* heap, int value) {
    if (heap->size >= MAX) return;
    heap->arr[heap->size] = value;
    siftUp(heap, heap->size);
    heap->size++;
}

int extractMin(struct MinHeap* heap) {
    if (heap->size <= 0) return -1;
    int min = heap->arr[0];
    heap->arr[0] = heap->arr[heap->size - 1];
    heap->size--;
    siftDown(heap, 0);
    return min;
}

void heapSort(int arr[], int n) {
    struct MinHeap heap;
    initHeap(&heap);
    for (int i = 0; i < n; i++)
        insertHeap(&heap, arr[i]);
    for (int i = 0; i < n; i++)
        arr[i] = extractMin(&heap);
}
`,
    },
    {
      id: 'graph_bfs',
      label: 'Graph BFS/DFS',
      code: `// Graph with BFS and DFS
#include <stdio.h>
#include <stdlib.h>

struct AdjNode {
    int vertex;
    struct AdjNode* next;
};

struct Graph {
    int numVertices;
    struct AdjNode** adjLists;
    int* visited;
};

struct Queue {
    int items[100];
    int front, rear;
};

void initQueue(struct Queue* q) {
    q->front = -1; q->rear = -1;
}

void enq(struct Queue* q, int v) {
    if (q->rear == 99) return;
    if (q->front == -1) q->front = 0;
    q->items[++q->rear] = v;
}

int deq(struct Queue* q) {
    if (q->front == -1 || q->front > q->rear) return -1;
    return q->items[q->front++];
}

struct AdjNode* createAdjNode(int v) {
    struct AdjNode* n = (struct AdjNode*)malloc(sizeof(struct AdjNode));
    n->vertex = v; n->next = NULL; return n;
}

struct Graph* createGraph(int vertices) {
    struct Graph* g = (struct Graph*)malloc(sizeof(struct Graph));
    g->numVertices = vertices;
    g->adjLists = (struct AdjNode**)calloc(vertices, sizeof(struct AdjNode*));
    g->visited = (int*)calloc(vertices, sizeof(int));
    return g;
}

void addEdge(struct Graph* g, int src, int dest) {
    struct AdjNode* n = createAdjNode(dest);
    n->next = g->adjLists[src];
    g->adjLists[src] = n;
    n = createAdjNode(src);
    n->next = g->adjLists[dest];
    g->adjLists[dest] = n;
}

void BFS(struct Graph* g, int start) {
    struct Queue q;
    initQueue(&q);
    for (int i = 0; i < g->numVertices; i++) g->visited[i] = 0;
    g->visited[start] = 1;
    printf("BFS: %d ", start);
    enq(&q, start);
    while (q.front <= q.rear) {
        int curr = deq(&q);
        struct AdjNode* tmp = g->adjLists[curr];
        while (tmp) {
            int adj = tmp->vertex;
            if (!g->visited[adj]) {
                g->visited[adj] = 1;
                printf("%d ", adj);
                enq(&q, adj);
            }
            tmp = tmp->next;
        }
    }
    printf("\\n");
}

void DFS(struct Graph* g, int vertex) {
    g->visited[vertex] = 1;
    printf("%d ", vertex);
    struct AdjNode* tmp = g->adjLists[vertex];
    while (tmp) {
        int adj = tmp->vertex;
        if (!g->visited[adj]) {
            DFS(g, adj);
        }
        tmp = tmp->next;
    }
}
`,
    },
    {
      id: 'circular_queue',
      label: 'Circular Queue',
      code: `// Circular Queue
#include <stdio.h>
#include <stdlib.h>
#define MAX 5

struct CircularQueue {
    int arr[MAX];
    int front;
    int rear;
};

void initCQ(struct CircularQueue* q) {
    q->front = -1;
    q->rear = -1;
}

int isFull(struct CircularQueue* q) {
    return (q->front == 0 && q->rear == MAX - 1) ||
           (q->rear == (q->front - 1) % (MAX - 1));
}

int isEmpty(struct CircularQueue* q) {
    return q->front == -1;
}

void enqueueCQ(struct CircularQueue* q, int value) {
    if (isFull(q)) { printf("Queue Full!\\n"); return; }
    if (q->front == -1) q->front = 0;
    q->rear = (q->rear + 1) % MAX;
    q->arr[q->rear] = value;
    printf("Enqueued %d at rear=%d\\n", value, q->rear);
}

int dequeueCQ(struct CircularQueue* q) {
    if (isEmpty(q)) { printf("Queue Empty!\\n"); return -1; }
    int data = q->arr[q->front];
    if (q->front == q->rear) {
        q->front = -1;
        q->rear = -1;
    } else {
        q->front = (q->front + 1) % MAX;
    }
    return data;
}
`,
    },
    {
      id: 'dequeue',
      label: 'DeQueue (Double-Ended Queue)',
      code: `// DeQueue - Double Ended Queue
#include <stdio.h>
#define MAX 5

struct Deque {
    int arr[MAX];
    int front;
    int rear;
    int size;
};

void initDeque(struct Deque* dq) {
    dq->front = -1;
    dq->rear = 0;
    dq->size = 0;
}

int isFullDeque(struct Deque* dq) {
    return dq->size == MAX;
}

int isEmptyDeque(struct Deque* dq) {
    return dq->size == 0;
}

void insertFront(struct Deque* dq, int value) {
    if (isFullDeque(dq)) { printf("Deque Full!\\n"); return; }
    if (dq->front == -1) {
        dq->front = 0;
        dq->rear = 0;
    } else if (dq->front == 0) {
        dq->front = MAX - 1;
    } else {
        dq->front--;
    }
    dq->arr[dq->front] = value;
    dq->size++;
}

void insertRear(struct Deque* dq, int value) {
    if (isFullDeque(dq)) { printf("Deque Full!\\n"); return; }
    if (dq->front == -1) {
        dq->front = 0;
        dq->rear = 0;
    } else if (dq->rear == MAX - 1) {
        dq->rear = 0;
    } else {
        dq->rear++;
    }
    dq->arr[dq->rear] = value;
    dq->size++;
}

int deleteFront(struct Deque* dq) {
    if (isEmptyDeque(dq)) { printf("Deque Empty!\\n"); return -1; }
    int data = dq->arr[dq->front];
    if (dq->front == dq->rear) {
        dq->front = -1;
        dq->rear = -1;
    } else if (dq->front == MAX - 1) {
        dq->front = 0;
    } else {
        dq->front++;
    }
    dq->size--;
    return data;
}

int deleteRear(struct Deque* dq) {
    if (isEmptyDeque(dq)) { printf("Deque Empty!\\n"); return -1; }
    int data = dq->arr[dq->rear];
    if (dq->front == dq->rear) {
        dq->front = -1;
        dq->rear = -1;
    } else if (dq->rear == 0) {
        dq->rear = MAX - 1;
    } else {
        dq->rear--;
    }
    dq->size--;
    return data;
}
`,
    },
    {
      id: 'binary_search',
      label: 'Binary Search',
      code: `// Binary Search on Sorted Array
#include <stdio.h>

int binarySearch(int arr[], int low, int high, int key) {
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == key)
            return mid;
        if (arr[mid] < key)
            low = mid + 1;
        else
            high = mid - 1;
    }
    return -1;
}

int main() {
    int arr[] = {10, 20, 30, 40, 50, 60, 70, 80};
    int n = 8;
    int key = 50;
    int result = binarySearch(arr, 0, n - 1, key);
    printf("Found %d at index %d\\n", key, result);
    return 0;
}
`,
    },
    {
      id: 'merge_sort',
      label: 'Merge Sort',
      code: `// Merge Sort
#include <stdio.h>

void merge(int arr[], int left, int mid, int right) {
    int n1 = mid - left + 1;
    int n2 = right - mid;
    int L[n1], R[n2];
    for (int i = 0; i < n1; i++) L[i] = arr[left + i];
    for (int j = 0; j < n2; j++) R[j] = arr[mid + 1 + j];
    int i = 0, j = 0, k = left;
    while (i < n1 && j < n2) {
        if (L[i] <= R[j]) arr[k++] = L[i++];
        else arr[k++] = R[j++];
    }
    while (i < n1) arr[k++] = L[i++];
    while (j < n2) arr[k++] = R[j++];
}

void mergeSort(int arr[], int left, int right) {
    if (left < right) {
        int mid = left + (right - left) / 2;
        mergeSort(arr, left, mid);
        mergeSort(arr, mid + 1, right);
        merge(arr, left, mid, right);
    }
}

void printArray(int arr[], int n) {
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
}
`,
    },
    {
      id: 'shell_sort',
      label: 'Shell Sort',
      code: `// Shell Sort
#include <stdio.h>

void shellSort(int arr[], int n) {
    for (int gap = n / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < n; i++) {
            int temp = arr[i];
            int j;
            for (j = i; j >= gap && arr[j - gap] > temp; j -= gap) {
                arr[j] = arr[j - gap];
            }
            arr[j] = temp;
        }
    }
}

void printArray(int arr[], int n) {
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
}

int main() {
    int arr[] = {29, 10, 14, 37, 13, 33, 48, 22};
    int n = 8;
    shellSort(arr, n);
    printArray(arr, n);
    return 0;
}
`,
    },
    {
      id: 'buggy_list',
      label: 'Linked List (with bugs)',
      code: `// Buggy Linked List - memory leak + double free
#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;
};

struct Node* createNode(int value) {
    struct Node* newNode = (struct Node*)malloc(sizeof(struct Node));
    newNode->data = value;
    // BUG: newNode->next is never set to NULL!
    return newNode;
}

struct Node* createList() {
    struct Node* head = createNode(10);
    struct Node* second = createNode(20);
    head->next = second;
    // BUG: memory leak - createNode(30) never linked!
    struct Node* third = createNode(30);
    return head;
}

void badFree(struct Node* head) {
    free(head);
    free(head);  // BUG: double free!
}
`,
    },
    {
      id: 'expression_tree',
      label: 'Expression Tree',
      code: `// Expression Tree - Build & Evaluate
#include <stdio.h>
#include <stdlib.h>

struct ETNode {
    char value;
    struct ETNode* left;
    struct ETNode* right;
};

struct ETNode* createETNode(char val) {
    struct ETNode* n = (struct ETNode*)malloc(sizeof(struct ETNode));
    n->value = val; n->left = NULL; n->right = NULL;
    return n;
}

int isOperator(char c) {
    return c == '+' || c == '-' || c == '*' || c == '/';
}

void inorderET(struct ETNode* root) {
    if (root) {
        if (isOperator(root->value)) printf("(");
        inorderET(root->left);
        printf("%c ", root->value);
        inorderET(root->right);
        if (isOperator(root->value)) printf(")");
    }
}

int evaluate(struct ETNode* root) {
    if (!root) return 0;
    if (!isOperator(root->value))
        return root->value - '0';
    int L = evaluate(root->left);
    int R = evaluate(root->right);
    switch (root->value) {
        case '+': return L + R;
        case '-': return L - R;
        case '*': return L * R;
        case '/': return L / R;
        default: return 0;
    }
}

int main() {
    // Expression: (3 + 4) * 5
    struct ETNode* root = createETNode('*');
    root->left = createETNode('+');
    root->right = createETNode('5');
    root->left->left = createETNode('3');
    root->left->right = createETNode('4');
    inorderET(root); printf("\\n");
    printf("Result: %d\\n", evaluate(root));
    return 0;
}
`,
    },
    {
      id: 'topological_sort',
      label: 'Topological Sort',
      code: `// Topological Sort of DAG
#include <stdio.h>
#include <stdlib.h>

struct AdjNode {
    int vertex;
    struct AdjNode* next;
};

struct Graph {
    int V;
    struct AdjNode** adj;
};

struct AdjNode* createNode(int v) {
    struct AdjNode* n = (struct AdjNode*)malloc(sizeof(struct AdjNode));
    n->vertex = v; n->next = NULL; return n;
}

struct Graph* createGraph(int V) {
    struct Graph* g = (struct Graph*)malloc(sizeof(struct Graph));
    g->V = V;
    g->adj = (struct AdjNode**)calloc(V, sizeof(struct AdjNode*));
    return g;
}

void addEdge(struct Graph* g, int src, int dest) {
    struct AdjNode* n = createNode(dest);
    n->next = g->adj[src];
    g->adj[src] = n;
}

void topologicalSortUtil(struct Graph* g, int v, int visited[], int stack[], int* idx) {
    visited[v] = 1;
    struct AdjNode* tmp = g->adj[v];
    while (tmp) {
        if (!visited[tmp->vertex])
            topologicalSortUtil(g, tmp->vertex, visited, stack, idx);
        tmp = tmp->next;
    }
    stack[++(*idx)] = v;
}

void topologicalSort(struct Graph* g) {
    int* visited = (int*)calloc(g->V, sizeof(int));
    int* stack = (int*)malloc(g->V * sizeof(int));
    int idx = -1;
    for (int i = 0; i < g->V; i++)
        if (!visited[i])
            topologicalSortUtil(g, i, visited, stack, &idx);
    printf("Topological Order: ");
    for (int i = g->V - 1; i >= 0; i--)
        printf("%d ", stack[i]);
    printf("\\n");
    free(stack); free(visited);
}

int main() {
    struct Graph* g = createGraph(6);
    addEdge(g, 5, 2); addEdge(g, 5, 0);
    addEdge(g, 4, 0); addEdge(g, 4, 1);
    addEdge(g, 2, 3); addEdge(g, 3, 1);
    topologicalSort(g);
    return 0;
}
`,
    },
    {
      id: 'dijkstra',
      label: "Dijkstra's Algorithm",
      code: `// Dijkstra's Shortest Path Algorithm
#include <stdio.h>
#include <limits.h>
#define V 5

int minDistance(int dist[], int sptSet[]) {
    int min = INT_MAX, minIdx;
    for (int v = 0; v < V; v++)
        if (!sptSet[v] && dist[v] <= min)
            min = dist[v], minIdx = v;
    return minIdx;
}

void dijkstra(int graph[V][V], int src) {
    int dist[V];
    int sptSet[V] = {0};
    for (int i = 0; i < V; i++) dist[i] = INT_MAX;
    dist[src] = 0;
    for (int count = 0; count < V - 1; count++) {
        int u = minDistance(dist, sptSet);
        sptSet[u] = 1;
        for (int v = 0; v < V; v++)
            if (!sptSet[v] && graph[u][v] && dist[u] != INT_MAX
                && dist[u] + graph[u][v] < dist[v])
                dist[v] = dist[u] + graph[u][v];
    }
    printf("Vertex Distance from Source\\n");
    for (int i = 0; i < V; i++)
        printf("%d \\t %d\\n", i, dist[i]);
}

int main() {
    int graph[V][V] = {
        {0, 2, 0, 6, 0},
        {2, 0, 3, 8, 5},
        {0, 3, 0, 0, 7},
        {6, 8, 0, 0, 9},
        {0, 5, 7, 9, 0}
    };
    dijkstra(graph, 0);
    return 0;
}
`,
    },
    {
      id: 'prim_mst',
      label: "Prim's MST Algorithm",
      code: `// Prim's Minimum Spanning Tree
#include <stdio.h>
#include <limits.h>
#define V 5

int minKey(int key[], int mstSet[]) {
    int min = INT_MAX, minIdx;
    for (int v = 0; v < V; v++)
        if (!mstSet[v] && key[v] < min)
            min = key[v], minIdx = v;
    return minIdx;
}

void primMST(int graph[V][V]) {
    int parent[V];
    int key[V];
    int mstSet[V] = {0};
    for (int i = 0; i < V; i++) key[i] = INT_MAX;
    key[0] = 0; parent[0] = -1;
    for (int count = 0; count < V - 1; count++) {
        int u = minKey(key, mstSet);
        mstSet[u] = 1;
        for (int v = 0; v < V; v++)
            if (graph[u][v] && !mstSet[v] && graph[u][v] < key[v])
                parent[v] = u, key[v] = graph[u][v];
    }
    printf("Edge \\t Weight\\n");
    for (int i = 1; i < V; i++)
        printf("%d - %d \\t %d\\n", parent[i], i, graph[i][parent[i]]);
}

int main() {
    int graph[V][V] = {
        {0, 2, 0, 6, 0},
        {2, 0, 3, 8, 5},
        {0, 3, 0, 0, 7},
        {6, 8, 0, 0, 9},
        {0, 5, 7, 9, 0}
    };
    primMST(graph);
    return 0;
}
`,
    },
    {
      id: 'kruskal_mst',
      label: "Kruskal's MST Algorithm",
      code: `// Kruskal's Minimum Spanning Tree
#include <stdio.h>
#include <stdlib.h>
#define V 5
#define E 7

struct Edge {
    int src, dest, weight;
};

struct Subset {
    int parent, rank;
};

int find(struct Subset subsets[], int i) {
    if (subsets[i].parent != i)
        subsets[i].parent = find(subsets, subsets[i].parent);
    return subsets[i].parent;
}

void Union(struct Subset subsets[], int x, int y) {
    int xroot = find(subsets, x);
    int yroot = find(subsets, y);
    if (subsets[xroot].rank < subsets[yroot].rank)
        subsets[xroot].parent = yroot;
    else if (subsets[xroot].rank > subsets[yroot].rank)
        subsets[yroot].parent = xroot;
    else {
        subsets[yroot].parent = xroot;
        subsets[xroot].rank++;
    }
}

int cmp(const void* a, const void* b) {
    return ((struct Edge*)a)->weight - ((struct Edge*)b)->weight;
}

void kruskalMST(struct Edge edges[]) {
    qsort(edges, E, sizeof(edges[0]), cmp);
    struct Subset* subsets = (struct Subset*)malloc(V * sizeof(struct Subset));
    for (int v = 0; v < V; v++) {
        subsets[v].parent = v;
        subsets[v].rank = 0;
    }
    struct Edge result[V];
    int e = 0, i = 0;
    while (e < V - 1 && i < E) {
        struct Edge next = edges[i++];
        int x = find(subsets, next.src);
        int y = find(subsets, next.dest);
        if (x != y) {
            result[e++] = next;
            Union(subsets, x, y);
        }
    }
    printf("Edge \\t Weight\\n");
    for (i = 0; i < e; i++)
        printf("%d - %d \\t %d\\n", result[i].src, result[i].dest, result[i].weight);
    free(subsets);
}

int main() {
    struct Edge edges[E] = {
        {0, 1, 2}, {0, 3, 6}, {1, 2, 3},
        {1, 3, 8}, {1, 4, 5}, {2, 4, 7}, {3, 4, 9}
    };
    kruskalMST(edges);
    return 0;
}
`,
    },
    {
      id: 'radix_sort',
      label: 'Radix Sort',
      code: `// Radix Sort
#include <stdio.h>

int getMax(int arr[], int n) {
    int mx = arr[0];
    for (int i = 1; i < n; i++)
        if (arr[i] > mx) mx = arr[i];
    return mx;
}

void countSort(int arr[], int n, int exp) {
    int output[n];
    int count[10] = {0};
    for (int i = 0; i < n; i++)
        count[(arr[i] / exp) % 10]++;
    for (int i = 1; i < 10; i++)
        count[i] += count[i - 1];
    for (int i = n - 1; i >= 0; i--) {
        output[count[(arr[i] / exp) % 10] - 1] = arr[i];
        count[(arr[i] / exp) % 10]--;
    }
    for (int i = 0; i < n; i++)
        arr[i] = output[i];
}

void radixSort(int arr[], int n) {
    int m = getMax(arr, n);
    for (int exp = 1; m / exp > 0; exp *= 10)
        countSort(arr, n, exp);
}

int main() {
    int arr[] = {170, 45, 75, 90, 802, 24, 2, 66};
    int n = 8;
    radixSort(arr, n);
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}
`,
    },
    {
      id: 'open_addressing',
      label: 'Hash Table (Open Addressing)',
      code: `// Hash Table with Open Addressing (Linear Probing)
#include <stdio.h>
#include <stdlib.h>
#define SIZE 10

struct HashTable {
    int keys[SIZE];
    int values[SIZE];
    int occupied[SIZE];
};

void init(struct HashTable* ht) {
    for (int i = 0; i < SIZE; i++)
        ht->occupied[i] = 0;
}

int hash(int key) {
    return key % SIZE;
}

void insert(struct HashTable* ht, int key, int value) {
    int idx = hash(key);
    while (ht->occupied[idx]) {
        if (ht->keys[idx] == key) {
            ht->values[idx] = value;
            return;
        }
        idx = (idx + 1) % SIZE;  // Linear probing
    }
    ht->keys[idx] = key;
    ht->values[idx] = value;
    ht->occupied[idx] = 1;
    printf("Inserted (%d,%d) at index %d\\n", key, value, idx);
}

int search(struct HashTable* ht, int key) {
    int idx = hash(key);
    int start = idx;
    while (ht->occupied[idx]) {
        if (ht->keys[idx] == key)
            return ht->values[idx];
        idx = (idx + 1) % SIZE;
        if (idx == start) break;
    }
    return -1;
}

int main() {
    struct HashTable ht;
    init(&ht);
    insert(&ht, 42, 100);
    insert(&ht, 52, 200);  // Collides, linear probe
    insert(&ht, 62, 300);
    printf("Search 42: %d\\n", search(&ht, 42));
    printf("Search 52: %d\\n", search(&ht, 52));
    return 0;
}
`,
    },
  ];
}
