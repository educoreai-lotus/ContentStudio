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
    const width = svg.clientWidth || 800;
    const height = Math.max(600, data.nodes.length * 50);

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

  // Calculate positions
  const width = 800;
  const height = 600;
  const levelHeight = height / (Math.max(...Object.values(levels)) + 1);

  const levelCounters = {};
  nodes.forEach((node) => {
    const level = levels[node.id] || 0;
    const nodesInLevel = childrenCount[level] || 1;
    const index = levelCounters[level] || 0;
    levelCounters[level] = index + 1;

    const x = (width / (nodesInLevel + 1)) * (index + 1);
    const y = levelHeight * (level + 0.5);

    positions[node.id] = { x, y, node };
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
  const radius = node.type === 'topic' ? 60 : node.type === 'subtopic' ? 50 : 40;

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

  // Text (label)
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', pos.x);
  text.setAttribute('y', pos.y);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', color.text);
  text.setAttribute('font-size', node.type === 'topic' ? '16' : '14');
  text.setAttribute('font-weight', node.type === 'topic' ? 'bold' : 'normal');
  text.setAttribute('pointer-events', 'none');

  // Wrap text if too long
  const words = node.label.split(' ');
  if (words.length > 2 && node.type !== 'topic') {
    // Multi-line text for long labels
    const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan1.setAttribute('x', pos.x);
    tspan1.setAttribute('dy', '-0.5em');
    tspan1.textContent = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    text.appendChild(tspan1);

    const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan2.setAttribute('x', pos.x);
    tspan2.setAttribute('dy', '1em');
    tspan2.textContent = words.slice(Math.ceil(words.length / 2)).join(' ');
    text.appendChild(tspan2);
  } else {
    text.textContent = node.label;
  }

  group.appendChild(circle);
  group.appendChild(text);
  svg.appendChild(group);
}

