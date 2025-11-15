import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ConceptNode } from './ConceptNode';
import { useApp } from '../context/AppContext';

/**
 * MindMap Component
 * Displays mind map using React Flow with custom nodes and edges
 */
export const MindMap = ({ data, className = '' }) => {
  const { theme } = useApp();

  // Define custom node types
  const nodeTypes = useMemo(
    () => ({
      concept: ConceptNode,
    }),
    []
  );

  // Transform backend data to React Flow format
  const transformedData = useMemo(() => {
    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
      console.warn('[MindMap] No valid data provided:', { data, hasNodes: !!data?.nodes, isArray: Array.isArray(data?.nodes) });
      return { nodes: [], edges: [] };
    }

    console.log('[MindMap] Transforming data:', { 
      nodesCount: data.nodes.length, 
      edgesCount: data.edges?.length || 0,
      firstNode: data.nodes[0] 
    });

    // Transform nodes
    // Note: We'll calculate fresh positions with proper spacing even if backend provides positions
    const nodes = data.nodes.map((node) => {
      // Position will be recalculated by calculateLayoutIfNeeded for proper spacing
      const position = { x: 0, y: 0 };

      // Determine node type
      const nodeType = node.type === 'concept' ? 'concept' : 'concept';

      // Prepare data object for the node
      // Support both 'category' (legacy) and 'group' (new format)
      const categoryOrGroup = node.category || node.data?.category || node.data?.group || 'default';
      const nodeData = {
        label: node.label || node.data?.label || node.id,
        description: node.description || node.data?.description || '',
        category: categoryOrGroup, // Use category for compatibility
        group: categoryOrGroup, // Also include group for new format
        skills: node.skills || node.data?.skills || [],
        ...(node.data || {}),
      };

      // Get style from node.style or node.data.style
      const style = node.style || node.data?.style || {};

      return {
        id: String(node.id),
        type: nodeType,
        position,
        data: nodeData,
        style: {
          backgroundColor: style.backgroundColor || undefined,
          ...style,
        },
      };
    });

    // Transform edges
    const edges = (data.edges || []).map((edge, index) => {
      const edgeId = edge.id || `edge-${edge.source}-${edge.target}-${index}`;
      
      return {
        id: String(edgeId),
        source: String(edge.source),
        target: String(edge.target),
        type: edge.type || 'smoothstep',
        label: edge.label || '',
        animated: edge.animated || false,
        style: {
          stroke: theme === 'night-mode' ? '#64748b' : '#94a3b8',
          strokeWidth: 2,
          ...(edge.style || {}),
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
      };
    });

    // If nodes have no positions, calculate a simple layout
    const nodesWithPositions = calculateLayoutIfNeeded(nodes, edges);

    const result = {
      nodes: nodesWithPositions,
      edges: edges,
    };
    
    console.log('[MindMap] Transformed result:', {
      nodesCount: result.nodes.length,
      edgesCount: result.edges.length,
      firstNode: result.nodes[0],
      firstEdge: result.edges[0],
    });
    
    return result;
  }, [data, theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState(transformedData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(transformedData.edges);

  // Update nodes and edges when data changes
  useEffect(() => {
    if (transformedData.nodes.length > 0 || transformedData.edges.length > 0) {
      console.log('[MindMap] Updating nodes and edges:', {
        nodesCount: transformedData.nodes.length,
        edgesCount: transformedData.edges.length,
      });
      setNodes(transformedData.nodes);
      setEdges(transformedData.edges);
    }
  }, [data, transformedData.nodes.length, transformedData.edges.length, setNodes, setEdges]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const isDark = theme === 'night-mode';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const nodeColor = isDark ? '#1e293b' : '#ffffff';

  return (
    <div
      className={`mind-map-container w-full ${className}`}
      style={{
        backgroundColor: bgColor,
        height: '600px',
        minHeight: '600px',
        borderRadius: '12px',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      }}
    >
      <ReactFlow
        key={`mindmap-${nodes.length}-${edges.length}`}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
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
          backgroundColor: bgColor,
        }}
      >
        <Background
          color={isDark ? '#334155' : '#cbd5e1'}
          gap={20}
          size={1}
          variant="dots"
        />
        <Controls
          style={{
            button: {
              backgroundColor: nodeColor,
              color: isDark ? '#f8fafc' : '#1e293b',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
            },
          }}
        />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor={isDark ? '#0d9488' : '#059669'}
          maskColor={isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.6)'}
          style={{
            backgroundColor: bgColor,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          }}
        />
      </ReactFlow>
    </div>
  );
};

/**
 * Calculate simple hierarchical layout if nodes don't have positions
 * For radial mind maps, we always calculate a fresh layout with proper spacing
 */
function calculateLayoutIfNeeded(nodes, edges) {
  // For radial mind maps, always calculate fresh layout for better spacing
  // Existing positions from backend might be too close together
  // We'll calculate a better layout with larger spacing

  // Calculate hierarchical layout
  const positions = {};
  const levels = {};
  const children = {};

  // Build adjacency list
  edges.forEach(edge => {
    if (!children[edge.source]) {
      children[edge.source] = [];
    }
    children[edge.source].push(edge.target);
  });

  // Find root nodes (nodes with no incoming edges)
  const nodeIds = new Set(nodes.map(n => n.id));
  const targets = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !targets.has(n.id));

  // If no root nodes, use first node
  const rootId = rootNodes.length > 0 ? rootNodes[0].id : nodes[0]?.id;

  if (!rootId) return nodes;

  // BFS to assign levels
  const queue = [{ id: rootId, level: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    levels[id] = level;

    if (children[id]) {
      children[id].forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }
  }

  // Group nodes by level
  const nodesByLevel = {};
  nodes.forEach(node => {
    const level = levels[node.id] || 0;
    if (!nodesByLevel[level]) {
      nodesByLevel[level] = [];
    }
    nodesByLevel[level].push(node.id);
  });

  // Calculate positions with balanced spacing - not too close, not too far
  const levelHeight = 320; // Balanced vertical spacing
  const nodeSpacing = 420; // Balanced horizontal spacing
  const startY = 180; // Balanced initial spacing

  Object.keys(nodesByLevel).forEach(level => {
    const levelNodes = nodesByLevel[level];
    const y = startY + parseInt(level) * levelHeight;
    const totalWidth = (levelNodes.length - 1) * nodeSpacing;
    const startX = -totalWidth / 2;

    levelNodes.forEach((nodeId, index) => {
      positions[nodeId] = {
        x: startX + index * nodeSpacing,
        y,
      };
    });
  });

  // Apply positions to nodes
  return nodes.map(node => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 },
  }));
}

