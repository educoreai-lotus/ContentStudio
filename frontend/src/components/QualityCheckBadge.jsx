import React from 'react';
import { useApp } from '../context/AppContext.jsx';

export const QualityCheckBadge = ({ qualityCheck }) => {
  const { theme } = useApp();

  if (!qualityCheck) return null;

  const getStatusColor = status => {
    switch (status) {
      case 'completed':
        return qualityCheck.is_acceptable ? 'green' : 'red';
      case 'processing':
        return 'yellow';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getQualityLevelColor = level => {
    switch (level) {
      case 'excellent':
        return 'emerald';
      case 'good':
        return 'green';
      case 'fair':
        return 'yellow';
      case 'poor':
        return 'red';
      default:
        return 'gray';
    }
  };

  const statusColor = getStatusColor(qualityCheck.status);
  const qualityColor = getQualityLevelColor(qualityCheck.quality_level);

  return (
    <div className="flex items-center gap-2">
      {qualityCheck.status === 'completed' && qualityCheck.score !== null && (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            theme === 'day-mode'
              ? `bg-${qualityColor}-100 text-${qualityColor}-700`
              : `bg-${qualityColor}-900/20 text-${qualityColor}-400`
          }`}
        >
          Score: {qualityCheck.score}/100
        </span>
      )}
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          theme === 'day-mode'
            ? `bg-${statusColor}-100 text-${statusColor}-700`
            : `bg-${statusColor}-900/20 text-${statusColor}-400`
        }`}
      >
        {qualityCheck.status === 'completed'
          ? qualityCheck.is_acceptable
            ? '✓ Approved'
            : '✗ Needs Review'
          : qualityCheck.status}
      </span>
      {qualityCheck.quality_level && (
        <span
          className={`px-2 py-1 rounded text-xs font-medium capitalize ${
            theme === 'day-mode'
              ? `bg-gray-100 text-gray-700`
              : `bg-gray-700 text-gray-300`
          }`}
        >
          {qualityCheck.quality_level}
        </span>
      )}
    </div>
  );
};



