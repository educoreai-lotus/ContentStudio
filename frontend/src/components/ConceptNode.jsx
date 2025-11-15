import { Handle, Position } from 'reactflow';
import { useApp } from '../context/AppContext';
import { useState } from 'react';

/**
 * ConceptNode Component
 * Custom node component for React Flow displaying concepts with tooltip
 */
export const ConceptNode = ({ data, selected, style: nodeStyle }) => {
  const { theme } = useApp();
  const [showTooltip, setShowTooltip] = useState(false);

  // Extract node properties with fallbacks
  const label = data?.label || data?.text || 'Untitled';
  const description = data?.description || '';
  // Support both 'category' (legacy) and 'group' (new format)
  const category = data?.category || data?.group || 'default';
  const skills = Array.isArray(data?.skills) ? data.skills : [];
  
  // Get background color from node style (React Flow passes it directly) or use default based on category/group
  const backgroundColor = nodeStyle?.backgroundColor || 
    (theme === 'day-mode' 
      ? getDefaultColor(category, 'day')
      : getDefaultColor(category, 'dark'));

  const isDark = theme === 'night-mode';
  const textColor = isDark ? '#f8fafc' : '#1e293b';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <div
      className={`concept-node relative ${selected ? 'ring-2 ring-offset-2' : ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        minWidth: '120px',
        minHeight: '80px',
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        boxShadow: selected 
          ? `0 8px 16px rgba(13, 148, 136, 0.3)`
          : `0 4px 8px rgba(0, 0, 0, 0.1)`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {/* Input Handle */}
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

      {/* Node Content */}
      <div className="node-content">
        <div
          className="node-label font-semibold text-center mb-1"
          style={{
            fontSize: '14px',
            lineHeight: '1.4',
            wordWrap: 'break-word',
            color: textColor,
          }}
        >
          {label}
        </div>

        {category !== 'default' && (
          <div
            className="node-category text-xs text-center opacity-75"
            style={{ color: textColor }}
          >
            {category}
          </div>
        )}
      </div>

      {/* Output Handle */}
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

      {/* Tooltip */}
      {showTooltip && (description || skills.length > 0) && (
        <div
          className="tooltip absolute z-50 p-3 rounded-lg shadow-xl max-w-xs"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#1e293b',
            border: `1px solid ${borderColor}`,
            pointerEvents: 'none',
          }}
        >
          {description && (
            <div className="tooltip-description mb-2 text-sm">
              {description}
            </div>
          )}
          {skills.length > 0 && (
            <div className="tooltip-skills">
              <div className="text-xs font-semibold mb-1 opacity-75">Skills:</div>
              <div className="flex flex-wrap gap-1">
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="skill-badge px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: isDark ? '#334155' : '#e2e8f0',
                      color: isDark ? '#cbd5e1' : '#475569',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Get default color based on category/group and theme
 * Supports both legacy categories and new group format
 */
function getDefaultColor(categoryOrGroup, theme) {
  // New format colors (from prompt specification)
  const dayColors = {
    core: '#E3F2FD', // Light blue
    primary: '#FFF3E0', // Light orange
    secondary: '#E8F5E9', // Light green
    related: '#F3E5F5', // Light purple
    advanced: '#FCE4EC', // Light pink
    // Legacy support
    topic: '#F3E5F5', // Light purple
    subtopic: '#E8F5E9', // Light green
    detail: '#FFF3E0', // Light orange
    default: '#F5F5F5', // Light gray
  };

  const darkColors = {
    core: '#1e3a5f', // Dark blue
    primary: '#4a3a1a', // Dark orange
    secondary: '#1a4a1a', // Dark green
    related: '#4a1a4a', // Dark purple
    advanced: '#4a1a2a', // Dark pink
    // Legacy support
    topic: '#4a1a4a', // Dark purple
    subtopic: '#1a4a1a', // Dark green
    detail: '#4a3a1a', // Dark orange
    default: '#334155', // Dark gray
  };

  return theme === 'dark' 
    ? (darkColors[categoryOrGroup] || darkColors.default)
    : (dayColors[categoryOrGroup] || dayColors.default);
}

