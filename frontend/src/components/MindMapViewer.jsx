import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

/**
 * MindMapViewer Component
 * Displays mind map data with beautiful visual circles and colors
 */
export const MindMapViewer = ({ data }) => {
  const { theme } = useApp();
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data?.nodes || !data?.edges || !svgRef.current) return;

    // Clear previous content
    svgRef.current.innerHTML = '';

    // Calculate positions for nodes (hierarchical layout)
    const positions = calculateNodePositions(data.nodes, data.edges);

    // Create SVG elements
    const svg = svgRef.current;
    const width = 1200;
    
    // Calculate height based on levels
    const maxLevel = Math.max(...Object.values(
      data.edges.reduce((levels, edge) => {
        levels[edge.target] = (levels[edge.source] || 0) + 1;
        return levels;
      }, { [data.nodes[0].id]: 0 })
    ));
    const height = (maxLevel + 1) * 180 + 200;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Draw edges first (so they appear behind nodes)
    data.edges.forEach((edge) => {
      const sourcePos = positions[edge.source];
      const targetPos = positions[edge.target];
      if (sourcePos && targetPos) {
        drawEdge(svg, sourcePos, targetPos, theme);
      }
    });

    // Draw nodes
    data.nodes.forEach((node) => {
      const pos = positions[node.id];
      if (pos) {
        drawNode(svg, node, pos, theme);
      }
    });
  }, [data, theme]);

  return (
    <div
      className={`w-full rounded-lg border-2 p-4 ${
        theme === 'day-mode'
          ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200'
          : 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700'
      }`}
    >
      <svg
        ref={svgRef}
        className="w-full"
        style={{ minHeight: '600px' }}
      />
    </div>
  );
};

// Helper: Calculate node positions in hierarchical layout
function calculateNodePositions(nodes, edges) {
  const positions = {};
  const levels = {};
  const childrenCount = {};

  // Find root node (topic)
  const rootNode = nodes.find((n) => n.type === 'topic');
  if (!rootNode) return positions;

  // Build adjacency list
  const children = {};
  edges.forEach((edge) => {
    if (!children[edge.source]) children[edge.source] = [];
    children[edge.source].push(edge.target);
  });

  // Assign levels using BFS
  const queue = [{ id: rootNode.id, level: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    levels[id] = level;
    childrenCount[level] = (childrenCount[level] || 0) + 1;

    if (children[id]) {
      children[id].forEach((childId) => {
        queue.push({ id: childId, level: level + 1 });
      });
    }
  }

  // Calculate positions with better spacing
  const width = 1200; // Increased width
  const maxLevel = Math.max(...Object.values(levels));
  const levelHeight = 180; // Fixed spacing between levels
  const height = (maxLevel + 1) * levelHeight + 100;

  const levelCounters = {};
  const levelNodes = {};
  
  // Group nodes by level
  nodes.forEach((node) => {
    const level = levels[node.id] || 0;
    if (!levelNodes[level]) levelNodes[level] = [];
    levelNodes[level].push(node);
  });

  // Position nodes with better spacing
  Object.keys(levelNodes).forEach((level) => {
    const nodesInLevel = levelNodes[level];
    const spacing = Math.min(width / (nodesInLevel.length + 1), 150); // Max 150px spacing
    const totalWidth = spacing * (nodesInLevel.length + 1);
    const startX = (width - totalWidth) / 2 + spacing;

    nodesInLevel.forEach((node, index) => {
      const x = startX + spacing * index;
      const y = parseInt(level) * levelHeight + 100;

      positions[node.id] = { x, y, node };
    });
  });

  return positions;
}

// Helper: Draw edge (line connecting nodes)
function drawEdge(svg, sourcePos, targetPos, theme) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', sourcePos.x);
  line.setAttribute('y1', sourcePos.y);
  line.setAttribute('x2', targetPos.x);
  line.setAttribute('y2', targetPos.y);
  line.setAttribute('stroke', theme === 'day-mode' ? '#94a3b8' : '#475569');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-opacity', '0.6');
  svg.appendChild(line);
}

// Helper: Draw node (circle with label)
function drawNode(svg, node, pos, theme) {
  const colors = {
    topic: { fill: '#3b82f6', text: '#ffffff' }, // Blue
    subtopic: { fill: '#8b5cf6', text: '#ffffff' }, // Purple
    detail: { fill: '#10b981', text: '#ffffff' }, // Green
  };

  const color = colors[node.type] || colors.detail;
  
  // Calculate radius based on text length
  const labelLength = node.label.length;
  let radius;
  if (node.type === 'topic') {
    radius = Math.max(70, labelLength * 3);
  } else if (node.type === 'subtopic') {
    radius = Math.max(60, labelLength * 2.5);
  } else {
    radius = Math.max(45, labelLength * 2);
  }

  // Create group for node
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'mind-map-node');
  group.style.cursor = 'pointer';

  // Circle
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', pos.x);
  circle.setAttribute('cy', pos.y);
  circle.setAttribute('r', radius);
  circle.setAttribute('fill', color.fill);
  circle.setAttribute('stroke', theme === 'day-mode' ? '#1e293b' : '#e2e8f0');
  circle.setAttribute('stroke-width', '3');
  circle.setAttribute('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))');

  // Add hover effect
  group.addEventListener('mouseenter', () => {
    circle.setAttribute('r', radius + 5);
    circle.setAttribute('stroke-width', '4');
  });
  group.addEventListener('mouseleave', () => {
    circle.setAttribute('r', radius);
    circle.setAttribute('stroke-width', '3');
  });

  // Text (label) - wrap text intelligently
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', pos.x);
  text.setAttribute('y', pos.y);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', color.text);
  text.setAttribute('font-size', node.type === 'topic' ? '14' : '12');
  text.setAttribute('font-weight', node.type === 'topic' ? 'bold' : 'normal');
  text.setAttribute('pointer-events', 'none');

  // Wrap text to fit in circle
  const maxCharsPerLine = Math.floor(radius / 4);
  const words = node.label.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  // Limit to 3 lines max
  const displayLines = lines.slice(0, 3);
  if (lines.length > 3) {
    displayLines[2] = displayLines[2].substring(0, maxCharsPerLine - 3) + '...';
  }

  if (displayLines.length === 1) {
    text.textContent = displayLines[0];
  } else {
    const lineHeight = 1.2;
    const startY = -(displayLines.length - 1) * 0.5 * lineHeight;
    displayLines.forEach((line, i) => {
      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', pos.x);
      tspan.setAttribute('dy', i === 0 ? `${startY}em` : `${lineHeight}em`);
      tspan.textContent = line;
      text.appendChild(tspan);
    });
  }

  group.appendChild(circle);
  group.appendChild(text);
  svg.appendChild(group);
}

