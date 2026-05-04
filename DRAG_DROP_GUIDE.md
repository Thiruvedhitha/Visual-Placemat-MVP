# Drag-and-Drop Implementation Guide

## Overview
The Visual Placemat now supports hierarchical drag-and-drop functionality. When you drag a node and drop it under a new parent, it reorganizes the tree structure and renumbers all affected nodes automatically.

---

## How It Works

### Example Scenario
```
Before Drag:
├─ 1. Strategic Portfolio Management
│  ├─ 1.1 Demand Management
│  ├─ 1.2 Project Management
│  │  ├─ 1.2.1 Project Initiation
│  │  │  ├─ 1.2.1.1 Project Charter
│  │  │  └─ 1.2.1.2 Stakeholder Analysis
│  │  └─ 1.2.2 Project Planning
│  └─ 1.4 Portfolio Governance
│     ├─ 1.4.1 Governance Framework
│     └─ 1.4.2 Risk Review

Action: Drag 1.2.1 (Project Initiation) and drop under 1.4

After Drag:
├─ 1. Strategic Portfolio Management
│  ├─ 1.1 Demand Management
│  ├─ 1.2 Project Management
│  │  └─ 1.2.1 Project Planning  (was 1.2.2, renumbered)
│  └─ 1.4 Portfolio Governance
│     ├─ 1.4.1 Governance Framework
│     ├─ 1.4.2 Risk Review
│     └─ 1.4.3 Project Initiation  (was 1.2.1, moved & renumbered)
│        ├─ 1.4.3.1 Project Charter  (was 1.2.1.1, auto-renumbered)
│        └─ 1.4.3.2 Stakeholder Analysis  (was 1.2.1.2, auto-renumbered)
```

---

## Key Features

### ✅ What Happens
1. **Node and Subtree Move** — The dragged node and ALL its descendants move together
2. **Automatic Renumbering** — Hierarchical numbers (1.2.3) recalculate based on new positions
3. **Level Adjustment** — Node levels adjust (L0, L1, L2, L3) based on new parent
4. **Circular Dependency Prevention** — Cannot drop a parent under its own child
5. **Sort Order Maintained** — Nodes maintain visual ordering by updating `sort_order`
6. **Mark Dirty** — Changes are tracked as unsaved (triggers Apply button)

### ✅ User Experience
- **Grab Cursor** — Hovering over nodes shows `cursor: grab`
- **Drag Feedback** — Nodes can be dragged smoothly on the canvas
- **Drop Feedback** — (TODO) Visual indicator when hovering over valid drop target
- **Undo-friendly** — All changes go through Zustand store (supports future undo)

---

## Implementation Files

### 1. **Drag-Drop Handler** (`src/lib/canvas/dragDropHandler.ts`)
Core logic for tree reorganization:

```typescript
export function handleNodeDragDrop(
  draggedNodeId: string,           // Node being moved
  newParentId: string | null,      // New parent node (null = root)
  insertAfterNodeId: string | null, // Insert position (optional)
  capabilities: Capability[]        // Current tree
): DragDropResult
```

**Functions:**
- `handleNodeDragDrop()` — Main orchestration
- `getSubtree()` — Find all descendants of a node
- `calculateNewSortOrder()` — Determine position in new parent's children
- `isValidDrop()` — Prevent circular parent-child relationships
- `normalizeSortOrders()` — Reindex `sort_order` across affected nodes
- `getCapabilityNumber()` — Calculate hierarchical number (1.2.3.4)

### 2. **Dashboard Page** (`src/app/(routes)/dashboard/page.tsx`)
Canvas state and event handling:

```typescript
const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
const [dragMessage, setDragMessage] = useState<string | null>(null);

const onNodeDragStart = (event, node) => {
  setDraggedNodeId(node.id);
};

const onNodeDragStop = (event, node) => {
  // TODO: Implement drop detection and call handleNodeDragDrop
  setDraggedNodeId(null);
};
```

### 3. **Capability Node** (`src/components/canvas/CapabilityNode.tsx`)
Node styling with grab cursor:

```typescript
cursor: "grab"  // Shows draggable intent
```

---

## Current Status & TODO

### ✅ Implemented
- [x] Core drag-drop reorganization logic
- [x] Circular dependency validation
- [x] Automatic renumbering system
- [x] Sort order normalization
- [x] Zustand store integration
- [x] Node dragging enabled (nodesDraggable={true})
- [x] Node drag event handlers

### 🔄 In Progress
- [ ] Drop target detection (find which node is under mouse when released)
- [ ] Visual feedback for valid/invalid drop targets
- [ ] Insert position detection (between siblings)
- [ ] Database sync after drop

### 📋 TODO
1. **Drop Detection**
   - Use React Flow's `onNodeDrop` or coordinate detection
   - Identify target node and position
   - Call `handleNodeDragDrop()` with correct parameters

2. **Visual Feedback**
   - Highlight valid drop targets on hover during drag
   - Show "cannot drop here" for invalid targets
   - Display hierarchical number preview while dragging

3. **Confirmation Toast**
   - Show success message with old/new hierarchy numbers
   - Display number of descendants moved

4. **Database Persistence**
   - On drop success, mark capabilities as dirty
   - Include move operation in diff history

---

## Integration Steps

### Step 1: Implement Drop Target Detection
```typescript
// In dashboard page onNodeDragStop or via onNodeDrop
const onNodeDrop = useCallback((event: DragEvent, node: Node) => {
  if (!draggedNodeId) return;
  
  // Call handler
  const result = handleNodeDragDrop(
    draggedNodeId,
    node.id,        // new parent
    null,           // insert after (TODO: calculate from Y position)
    capabilities
  );
  
  // Update state
  if (result.message.includes("Moved")) {
    setCapabilities(result.updatedCapabilities);
    setDragMessage(result.message);
    setTimeout(() => setDragMessage(null), 3000);
  } else {
    setDragMessage("❌ " + result.message);
  }
}, [draggedNodeId, capabilities]);
```

### Step 2: Add Visual Feedback
```typescript
// In CapabilityNode or overlay component
const isDropTarget = draggedNodeId && canDropHere(draggedNodeId, nodeId);

<div style={{
  boxShadow: isDropTarget 
    ? "inset 0 0 0 2px #10b981" 
    : selected ? "0 0 0 2.5px #f59e0b" : "default"
}}>
  {/* Node content */}
</div>
```

### Step 3: Add to History
```typescript
// After successful drop
const diffEntry = {
  action: "MOVE",
  nodeId: draggedNodeId,
  fromParentId: oldParentId,
  toParentId: newParentId,
  timestamp: new Date()
};

// Store in diff history
```

---

## API Reference

### `handleNodeDragDrop()`

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `draggedNodeId` | `string` | ID of node being dragged |
| `newParentId` | `string \| null` | ID of new parent (null = root) |
| `insertAfterNodeId` | `string \| null` | Position hint (optional) |
| `capabilities` | `Capability[]` | Current tree |

**Returns:**
```typescript
{
  updatedCapabilities: Capability[];  // New tree with moved nodes
  message: string;                     // Success or error message
}
```

**Example:**
```typescript
const result = handleNodeDragDrop(
  "cap-123",           // Drag this
  "cap-456",           // Under this
  "cap-458",           // After this sibling
  capabilities
);

console.log(result.message);
// "Moved "Project Initiation" from Project Management to Portfolio Governance (and 2 descendants)"

setCapabilities(result.updatedCapabilities);
```

---

## Algorithm Details

### Subtree Extraction
```
Start with node 1.2.1
├─ Add 1.2.1 to subtree
├─ Find children: 1.2.1.1, 1.2.1.2
├─ Add them to subtree
├─ Find children of 1.2.1.1: (none)
└─ Subtree = [1.2.1, 1.2.1.1, 1.2.1.2]
```

### Sort Order Calculation
```
If inserting between 1.4.2 (sort_order=1.5) and 1.4.3 (sort_order=2.0)
→ New sort_order = (1.5 + 2.0) / 2 = 1.75

Normalization step renumbers all siblings:
1.4.1 → sort_order = 0
1.4.2 → sort_order = 1
1.4.3 (moved here) → sort_order = 2
1.4.4 → sort_order = 3
```

### Level Adjustment
```
Original: 1.2.1 (level 2) with child 1.2.1.1 (level 3)
New parent: 1.4 (level 1)

New levels:
1.4.3 → level 2 (parent.level + 1 = 1 + 1 = 2)
1.4.3.1 → level 3 (maintains relative depth)
```

---

## Testing Checklist

- [ ] Drag and drop node into different parent
- [ ] Verify numbers recalculate (1.2.1 → 1.4.5)
- [ ] Verify children move with parent (1.2.1.1 → 1.4.5.1)
- [ ] Try to drop parent under child (should reject)
- [ ] Try to drop at root level
- [ ] Verify Apply button shows unsaved changes
- [ ] Test with deep hierarchies (L0→L3)
- [ ] Verify sort_order prevents gaps
- [ ] Check localStorage stores changes
- [ ] Test database persistence on Apply

---

## Future Enhancements

1. **Bulk Operations**
   - Select multiple nodes and move together
   - Copy subtree to new location

2. **Undo/Redo**
   - Track drag operations in history
   - Restore previous tree state

3. **Advanced Positioning**
   - Drag between specific L3 nodes
   - Visual line indicator for insertion point
   - Snap-to-grid alignment

4. **Constraints**
   - Prevent moves beyond max level (L3)
   - Disallow L0 children becoming L1 (level constraints)

5. **Animations**
   - Smooth node transition to new position
   - Highlight affected nodes briefly

---

## Troubleshooting

### Dragging not working
- Check `nodesDraggable={true}` in ReactFlow
- Verify CSS `cursor: grab` is applied
- Check browser console for errors

### Numbers not updating
- Verify `normalizeSortOrders()` is called
- Check `sort_order` values in database after Apply
- Ensure `handleNodeDragDrop()` is called on drop

### Circular parent error
- User tried to drop parent under descendant
- System should prevent this (isValidDrop check)
- Show error message and cancel operation

---

## Code Example

**Complete drag-drop flow:**
```typescript
// 1. User drags node 1.2.1
onNodeDragStart = (event, node) => {
  setDraggedNodeId(node.id);
};

// 2. User drops on node 1.4
onNodeDrop = (event, node) => {
  const result = handleNodeDragDrop(
    draggedNodeId,  // "node-1.2.1"
    node.id,        // "node-1.4"
    null,
    capabilities
  );
  
  if (result.message.includes("Moved")) {
    setCapabilities(result.updatedCapabilities); // Update state
    markDirty();                                   // Track change
    setDragMessage(result.message);              // Show feedback
  }
  
  setDraggedNodeId(null);
};

// 3. User clicks Apply
onApply = async () => {
  await fetch("/api/catalogs/save", {
    method: "POST",
    body: JSON.stringify({ capabilities })
  });
  // Capabilities persisted to database
};
```
