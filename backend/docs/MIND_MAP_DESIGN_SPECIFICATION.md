# Mind Map Design Specification for External Microservice

## Overview
This document provides a complete design specification for rendering mind maps that must match the exact visual design, colors, and styling used in EduCore Content Studio's Mind Map component. The specification covers both **Day Mode (Light)** and **Night Mode (Dark)** themes.

## Technology Stack
- **Library**: React Flow v11.11.4
- **Import**: `import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge } from 'reactflow'`
- **CSS**: `import 'reactflow/dist/style.css'` (required for React Flow base styles)
- **Custom Node Type**: `concept` (uses custom `ConceptNode` component)

---

## Container & Layout

### Container Specifications
- **Height**: `600px` (fixed, minimum)
- **Border Radius**: `12px`
- **Border Width**: `1px solid`
- **Padding**: None (content fills container)

### Background Colors
- **Day Mode**: `#f8fafc` (very light slate)
- **Night Mode**: `#0f172a` (very dark slate)

### Border Colors
- **Day Mode**: `rgba(0, 0, 0, 0.1)` (10% black opacity)
- **Night Mode**: `rgba(255, 255, 255, 0.1)` (10% white opacity)

---

## Background Pattern (Dots Grid)

### Specifications
- **Pattern Type**: Dots (not lines or grid)
- **Gap Between Dots**: `20px`
- **Dot Size**: `1px`
- **Dot Colors**:
  - **Day Mode**: `#cbd5e1` (light slate)
  - **Night Mode**: `#334155` (medium slate)

---

## Node Design (Concept Nodes)

### Node Container
- **Min Width**: `120px`
- **Min Height**: `80px`
- **Padding**: `12px 16px` (vertical horizontal)
- **Border Radius**: `12px`
- **Border Width**: `2px solid`
- **Box Shadow (Default)**: `0 4px 8px rgba(0, 0, 0, 0.1)`
- **Box Shadow (Selected)**: `0 8px 16px rgba(13, 148, 136, 0.3)` (teal glow)
- **Transform (Selected)**: `scale(1.05)`
- **Transform (Default)**: `scale(1)`
- **Transition**: `all 0.2s ease`
- **Cursor**: `pointer`

### Node Border Colors
- **Day Mode**: `rgba(0, 0, 0, 0.1)` (10% black opacity)
- **Night Mode**: `rgba(255, 255, 255, 0.2)` (20% white opacity)

### Node Text Colors
- **Day Mode**: `#1e293b` (dark slate)
- **Night Mode**: `#f8fafc` (very light slate)

### Node Background Colors by Category/Group

#### Day Mode (Light Theme)
- **core**: `#E3F2FD` (light blue)
- **primary**: `#FFF3E0` (light orange)
- **secondary**: `#E8F5E9` (light green)
- **related**: `#F3E5F5` (light purple)
- **advanced**: `#FCE4EC` (light pink)
- **default** (fallback): `#F5F5F5` (light gray)

#### Night Mode (Dark Theme)
- **core**: `#1e3a5f` (dark blue)
- **primary**: `#4a3a1a` (dark orange)
- **secondary**: `#1a4a1a` (dark green)
- **related**: `#4a1a4a` (dark purple)
- **advanced**: `#4a1a2a` (dark pink)
- **default** (fallback): `#334155` (dark gray)

### Node Content Typography
- **Label Font Size**: `14px`
- **Label Font Weight**: `600` (semibold)
- **Label Line Height**: `1.4`
- **Label Text Align**: `center`
- **Label Margin Bottom**: `4px`
- **Category Font Size**: `12px` (0.75rem)
- **Category Opacity**: `0.75`
- **Category Text Align**: `center`
- **Word Wrap**: `break-word`

### Node Handles (Connection Points)

#### Input Handle (Top)
- **Position**: Top center
- **Background Color**: `#0d9488` (teal)
- **Width**: `10px`
- **Height**: `10px`
- **Border**: `2px solid white`
- **Border Radius**: `50%` (circle)

#### Output Handle (Bottom)
- **Position**: Bottom center
- **Background Color**: `#059669` (green)
- **Width**: `10px`
- **Height**: `10px`
- **Border**: `2px solid white`
- **Border Radius**: `50%` (circle)

### Node Selection State
- **Ring**: `2px` ring with `2px` offset
- **Ring Color**: Teal (`rgba(13, 148, 136, 0.3)`)
- **Scale**: `1.05` (5% larger)
- **Shadow**: Enhanced teal glow

---

## Edge Design (Connections Between Nodes)

### Edge Specifications
- **Type**: `smoothstep` (curved, stepped connections)
- **Stroke Width**: `2px`
- **Animated**: `false` (no animation by default)
- **Label Font Size**: `11px`
- **Label Font Weight**: `500` (medium)

### Edge Colors

#### Day Mode (Light Theme)
- **Stroke Color**: `#94a3b8` (medium slate)
- **Label Text Color**: `#475569` (darker slate)
- **Label Background**: `#ffffff` (white)
- **Label Background Opacity**: `0.9` (90% opacity)

#### Night Mode (Dark Theme)
- **Stroke Color**: `#64748b` (lighter slate)
- **Label Text Color**: `#cbd5e1` (light slate)
- **Label Background**: `#1e293b` (dark slate)
- **Label Background Opacity**: `0.9` (90% opacity)

---

## Tooltip Design (Node Hover)

### Tooltip Container
- **Position**: Above node, centered horizontally
- **Width**: `400px` (max `90vw` on mobile)
- **Padding**: `16px` (1rem)
- **Border Radius**: `8px` (0.5rem)
- **Box Shadow**: `xl` (extra large shadow)
- **Margin Bottom**: `8px` (from node)
- **Pointer Events**: `none` (doesn't block interactions)
- **Z-Index**: `50` (high, above other elements)

### Tooltip Colors

#### Day Mode (Light Theme)
- **Background**: `#ffffff` (white)
- **Text Color**: `#1e293b` (dark slate)
- **Border**: `1px solid rgba(0, 0, 0, 0.1)`

#### Night Mode (Dark Theme)
- **Background**: `#1e293b` (dark slate)
- **Text Color**: `#f8fafc` (very light slate)
- **Border**: `1px solid rgba(255, 255, 255, 0.2)`

### Tooltip Content Typography
- **Description Font Size**: `14px` (0.875rem)
- **Description Line Height**: `1.6`
- **Description Margin Bottom**: `12px` (0.75rem)
- **Skills Label Font Size**: `12px` (0.75rem)
- **Skills Label Font Weight**: `600` (semibold)
- **Skills Label Opacity**: `0.75`
- **Skills Label Margin Bottom**: `4px` (0.25rem)
- **Word Wrap**: `break-word`

### Skill Badges (in Tooltip)
- **Padding**: `4px 8px` (vertical horizontal)
- **Border Radius**: `4px` (0.25rem)
- **Font Size**: `12px` (0.75rem)
- **Gap Between Badges**: `4px` (0.25rem)
- **Display**: `flex` with `flex-wrap`

#### Skill Badge Colors

**Day Mode (Light Theme)**
- **Background**: `#e2e8f0` (light slate)
- **Text Color**: `#475569` (darker slate)

**Night Mode (Dark Theme)**
- **Background**: `#334155` (medium slate)
- **Text Color**: `#cbd5e1` (light slate)

---

## Controls (Zoom, Pan, Fit View)

### Control Buttons
- **Background Color**:
  - **Day Mode**: `#ffffff` (white)
  - **Night Mode**: `#1e293b` (dark slate)
- **Text Color**:
  - **Day Mode**: `#1e293b` (dark slate)
  - **Night Mode**: `#f8fafc` (very light slate)
- **Border**: `1px solid`
  - **Day Mode**: `rgba(0, 0, 0, 0.1)`
  - **Night Mode**: `rgba(255, 255, 255, 0.2)`

---

## MiniMap (Overview)

### MiniMap Container
- **Background Color**: Same as main container
  - **Day Mode**: `#f8fafc`
  - **Night Mode**: `#0f172a`
- **Border**: `1px solid`
  - **Day Mode**: `rgba(0, 0, 0, 0.1)`
  - **Night Mode**: `rgba(255, 255, 255, 0.1)`

### MiniMap Node Colors
- **Node Fill Color**: Same as control buttons
  - **Day Mode**: `#ffffff`
  - **Night Mode**: `#1e293b`
- **Node Stroke Color**:
  - **Day Mode**: `#059669` (green)
  - **Night Mode**: `#0d9488` (teal)

### MiniMap Mask
- **Mask Color**:
  - **Day Mode**: `rgba(248, 250, 252, 0.6)` (60% opacity of light background)
  - **Night Mode**: `rgba(15, 23, 42, 0.6)` (60% opacity of dark background)

---

## Viewport & Zoom Settings

### Fit View Options
- **Padding**: `0.3` (30% of viewport)
- **Max Zoom**: `1.2` (120%)
- **Min Zoom**: `0.3` (30%)
- **Fit View**: Enabled by default

---

## Data Structure

### Expected Input Format
```json
{
  "nodes": [
    {
      "id": "C1",
      "type": "concept",
      "data": {
        "label": "Main Topic",
        "description": "Detailed description text",
        "category": "core",
        "skills": ["skill1", "skill2"]
      },
      "position": { "x": 0, "y": 0 },
      "style": {
        "backgroundColor": "#E3F2FD"
      }
    }
  ],
  "edges": [
    {
      "id": "E1",
      "source": "C1",
      "target": "C2",
      "type": "smoothstep",
      "label": "explains",
      "animated": false
    }
  ]
}
```

### Node Properties
- **id**: Unique identifier (string)
- **type**: Always `"concept"` for concept nodes
- **data.label**: Main text displayed in node (required)
- **data.description**: Tooltip description (optional)
- **data.category**: Category/group for color mapping (`core`, `primary`, `secondary`, `related`, `advanced`, or `default`)
- **data.skills**: Array of skill strings (optional, displayed in tooltip)
- **position.x**: X coordinate (number)
- **position.y**: Y coordinate (number)
- **style.backgroundColor**: Override default category color (optional)

### Edge Properties
- **id**: Unique identifier (string)
- **source**: Source node ID (string)
- **target**: Target node ID (string)
- **type**: Always `"smoothstep"` for curved connections
- **label**: Text displayed on edge (optional)
- **animated**: Boolean (default: `false`)

---

## Theme Detection

### Theme Values
- **Day Mode**: `theme === 'day-mode'` or `theme === 'light'`
- **Night Mode**: `theme === 'night-mode'` or `theme === 'dark'`

### Color Application Rules
1. If `theme === 'night-mode'` or `theme === 'dark'`, use **Night Mode** colors
2. Otherwise, use **Day Mode** colors
3. All color values must match **exactly** (hex codes, rgba values)

---

## Critical Design Requirements

### Non-Negotiable Specifications
1. **Exact Color Matching**: All hex codes and rgba values must match exactly as specified
2. **Border Radius**: All rounded corners use `12px` (nodes, container)
3. **Border Width**: All borders use `2px` (nodes) or `1px` (container, tooltip)
4. **Spacing**: Padding, margins, and gaps must match exactly
5. **Typography**: Font sizes, weights, and line heights must match exactly
6. **Shadow Effects**: Box shadows must match opacity and blur values
7. **Handle Design**: Connection handles must be exactly `10px` circles with `2px` white borders
8. **Edge Style**: Must use `smoothstep` type with `2px` stroke width
9. **Background Pattern**: Must be dots (not lines) with `20px` gap and `1px` size
10. **Theme Support**: Must support both Day Mode and Night Mode with exact color switching

### Visual Consistency
- All visual elements must appear **identical** to the reference implementation
- No deviations in colors, spacing, typography, or effects
- Both themes must render with **exact** color parity (same visual hierarchy, different colors)

---

## Implementation Notes

## React Flow Implementation Details

### Required React Flow Components
```javascript
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
```

### React Flow Configuration

#### Main ReactFlow Component
```javascript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={{ concept: ConceptNode }}
  fitView
  fitViewOptions={{
    padding: 0.3,
    maxZoom: 1.2,
    minZoom: 0.3,
  }}
  proOptions={{ hideAttribution: true }}
  defaultEdgeOptions={{
    type: 'smoothstep',
    animated: false,
  }}
  style={{
    backgroundColor: bgColor, // Theme-dependent
  }}
>
  {/* Background, Controls, MiniMap components */}
</ReactFlow>
```

#### Background Component
```javascript
<Background
  color={isDark ? '#334155' : '#cbd5e1'}
  gap={20}
  size={1}
  variant="dots"
/>
```

#### Controls Component
```javascript
<Controls
  style={{
    button: {
      backgroundColor: nodeColor, // Theme-dependent
      color: isDark ? '#f8fafc' : '#1e293b',
      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
    },
  }}
/>
```

#### MiniMap Component
```javascript
<MiniMap
  nodeColor={nodeColor} // Theme-dependent
  nodeStrokeColor={isDark ? '#0d9488' : '#059669'}
  maskColor={isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.6)'}
  style={{
    backgroundColor: bgColor, // Theme-dependent
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
  }}
/>
```

### Custom Node Component (ConceptNode)

#### Node Structure
- **Component Type**: Custom React component
- **Node Type Registration**: `nodeTypes={{ concept: ConceptNode }}`
- **Props Received**: `{ data, selected, style: nodeStyle }`
- **React Flow Handle Components**: Uses `Handle` from `reactflow` with `Position.Top` and `Position.Bottom`

#### Node Styling (Inline Styles)
```javascript
style={{
  minWidth: '120px',
  minHeight: '80px',
  padding: '12px 16px',
  borderRadius: '12px',
  backgroundColor: backgroundColor, // From category or style prop
  color: textColor, // Theme-dependent
  border: `2px solid ${borderColor}`, // Theme-dependent
  boxShadow: selected 
    ? `0 8px 16px rgba(13, 148, 136, 0.3)`
    : `0 4px 8px rgba(0, 0, 0, 0.1)`,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  transform: selected ? 'scale(1.05)' : 'scale(1)',
}}
```

#### React Flow Handle Implementation
```javascript
// Input Handle (Top)
<Handle
  type="target"
  position={Position.Top}
  style={{
    background: '#0d9488',
    width: '10px',
    height: '10px',
    border: '2px solid white',
  }}
/>

// Output Handle (Bottom)
<Handle
  type="source"
  position={Position.Bottom}
  style={{
    background: '#059669',
    width: '10px',
    height: '10px',
    border: '2px solid white',
  }}
/>
```

### Edge Configuration

#### Edge Type
- **Type**: `'smoothstep'` (React Flow's built-in smoothstep edge type)
- **Default Configuration**: Set via `defaultEdgeOptions={{ type: 'smoothstep', animated: false }}`

#### Edge Styling
```javascript
{
  id: String(edgeId),
  source: String(edge.source),
  target: String(edge.target),
  type: 'smoothstep',
  label: edge.label || '',
  animated: false,
  style: {
    stroke: theme === 'night-mode' ? '#64748b' : '#94a3b8',
    strokeWidth: 2,
  },
  labelStyle: {
    fill: theme === 'night-mode' ? '#cbd5e1' : '#475569',
    fontWeight: 500,
    fontSize: '11px',
  },
  labelBgStyle: {
    fill: theme === 'night-mode' ? '#1e293b' : '#ffffff',
    fillOpacity: 0.9,
  },
}
```

### Node State Management
- Uses React Flow hooks: `useNodesState()` and `useEdgesState()`
- Updates nodes/edges when data changes via `useEffect`
- Supports drag-and-drop (React Flow default behavior)

### Layout Calculation
- Custom layout algorithm for hierarchical positioning
- Level height: `320px`
- Node spacing: `420px`
- Start Y: `180px`
- Calculates positions based on node hierarchy (BFS traversal)

### Alternative Libraries
If NOT using React Flow:
- Ensure `smoothstep`-style curved connections are supported
- Implement custom node rendering to match specifications exactly
- Support custom edge styling with labels
- Implement background dot pattern matching React Flow's `variant="dots"`
- Support theme switching
- Implement drag-and-drop functionality
- Support zoom and pan controls

---

## Color Reference Table

### Day Mode Colors
| Element | Color | Hex Code |
|---------|-------|----------|
| Container Background | Very Light Slate | `#f8fafc` |
| Container Border | Black 10% Opacity | `rgba(0, 0, 0, 0.1)` |
| Background Dots | Light Slate | `#cbd5e1` |
| Node Text | Dark Slate | `#1e293b` |
| Node Border | Black 10% Opacity | `rgba(0, 0, 0, 0.1)` |
| Edge Stroke | Medium Slate | `#94a3b8` |
| Edge Label Text | Darker Slate | `#475569` |
| Edge Label Background | White | `#ffffff` |
| Control Button Background | White | `#ffffff` |
| Control Button Text | Dark Slate | `#1e293b` |
| Control Button Border | Black 10% Opacity | `rgba(0, 0, 0, 0.1)` |
| MiniMap Node Stroke | Green | `#059669` |
| MiniMap Mask | Light Background 60% | `rgba(248, 250, 252, 0.6)` |
| Tooltip Background | White | `#ffffff` |
| Tooltip Text | Dark Slate | `#1e293b` |
| Tooltip Border | Black 10% Opacity | `rgba(0, 0, 0, 0.1)` |
| Skill Badge Background | Light Slate | `#e2e8f0` |
| Skill Badge Text | Darker Slate | `#475569` |

### Night Mode Colors
| Element | Color | Hex Code |
|---------|-------|----------|
| Container Background | Very Dark Slate | `#0f172a` |
| Container Border | White 10% Opacity | `rgba(255, 255, 255, 0.1)` |
| Background Dots | Medium Slate | `#334155` |
| Node Text | Very Light Slate | `#f8fafc` |
| Node Border | White 20% Opacity | `rgba(255, 255, 255, 0.2)` |
| Edge Stroke | Lighter Slate | `#64748b` |
| Edge Label Text | Light Slate | `#cbd5e1` |
| Edge Label Background | Dark Slate | `#1e293b` |
| Control Button Background | Dark Slate | `#1e293b` |
| Control Button Text | Very Light Slate | `#f8fafc` |
| Control Button Border | White 20% Opacity | `rgba(255, 255, 255, 0.2)` |
| MiniMap Node Stroke | Teal | `#0d9488` |
| MiniMap Mask | Dark Background 60% | `rgba(15, 23, 42, 0.6)` |
| Tooltip Background | Dark Slate | `#1e293b` |
| Tooltip Text | Very Light Slate | `#f8fafc` |
| Tooltip Border | White 20% Opacity | `rgba(255, 255, 255, 0.2)` |
| Skill Badge Background | Medium Slate | `#334155` |
| Skill Badge Text | Light Slate | `#cbd5e1` |

### Node Category Colors (Day Mode)
| Category | Color | Hex Code |
|----------|-------|----------|
| core | Light Blue | `#E3F2FD` |
| primary | Light Orange | `#FFF3E0` |
| secondary | Light Green | `#E8F5E9` |
| related | Light Purple | `#F3E5F5` |
| advanced | Light Pink | `#FCE4EC` |
| default | Light Gray | `#F5F5F5` |

### Node Category Colors (Night Mode)
| Category | Color | Hex Code |
|----------|-------|----------|
| core | Dark Blue | `#1e3a5f` |
| primary | Dark Orange | `#4a3a1a` |
| secondary | Dark Green | `#1a4a1a` |
| related | Dark Purple | `#4a1a4a` |
| advanced | Dark Pink | `#4a1a2a` |
| default | Dark Gray | `#334155` |

### Handle Colors
| Handle Type | Color | Hex Code |
|-------------|-------|----------|
| Input (Top) | Teal | `#0d9488` |
| Output (Bottom) | Green | `#059669` |

---

## Example Implementation Checklist

- [ ] Container: 600px height, 12px border radius, correct background and border colors for both themes
- [ ] Background Pattern: Dots with 20px gap, 1px size, correct colors for both themes
- [ ] Nodes: 120px min width, 80px min height, 12px border radius, 2px border, correct colors by category
- [ ] Node Text: 14px font size, 600 weight, center aligned, correct text colors for both themes
- [ ] Node Handles: 10px circles, 2px white borders, teal (top) and green (bottom)
- [ ] Edges: smoothstep type, 2px stroke width, correct colors for both themes
- [ ] Edge Labels: 11px font size, 500 weight, correct colors and backgrounds for both themes
- [ ] Tooltip: 400px width, correct colors and borders for both themes, proper typography
- [ ] Skill Badges: Correct padding, border radius, colors for both themes
- [ ] Controls: Correct button colors and borders for both themes
- [ ] MiniMap: Correct background, node colors, stroke colors, and mask for both themes
- [ ] Selection State: 2px ring, 1.05 scale, teal glow shadow
- [ ] Theme Switching: All colors switch correctly between Day Mode and Night Mode

---

## Final Notes

This specification must be followed **exactly** to ensure visual consistency across all microservices. Any deviation in colors, spacing, typography, or effects will result in an inconsistent user experience. Both Day Mode and Night Mode must render identically in terms of visual hierarchy and design, with only the color palette changing.

