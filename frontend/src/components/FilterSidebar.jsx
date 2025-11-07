import React from 'react';
import { useApp } from '../context/AppContext.jsx';

export const FilterSidebar = ({ filters, onFilterChange, onClearFilters }) => {
  const { theme } = useApp();

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div
      className={`rounded-2xl shadow-lg p-6 ${
        theme === 'day-mode'
          ? 'bg-white border border-gray-200'
          : 'bg-gray-800 border border-gray-700'
      }`}
      style={{
        background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3
          className="text-lg font-semibold"
          style={{
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Filters
        </h3>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className={`text-sm ${
              theme === 'day-mode' ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Type Filter */}
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            Type
          </label>
          <select
            value={filters.type || ''}
            onChange={e => handleFilterChange('type', e.target.value || undefined)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
              theme === 'day-mode'
                ? 'border-gray-300 bg-white text-gray-900'
                : 'border-gray-600 bg-gray-700 text-white'
            }`}
          >
            <option value="">All Types</option>
            <option value="course">Courses</option>
            <option value="topic">Topics/Lessons</option>
            <option value="content">Content Items</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={e => handleFilterChange('status', e.target.value || undefined)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
              theme === 'day-mode'
                ? 'border-gray-300 bg-white text-gray-900'
                : 'border-gray-600 bg-gray-700 text-white'
            }`}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Content Type Filter */}
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            Content Type
          </label>
          <select
            value={filters.content_type_id || ''}
            onChange={e => handleFilterChange('content_type_id', e.target.value || undefined)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
              theme === 'day-mode'
                ? 'border-gray-300 bg-white text-gray-900'
                : 'border-gray-600 bg-gray-700 text-white'
            }`}
          >
            <option value="">All Types</option>
            <option value="text">Text</option>
            <option value="code">Code</option>
            <option value="presentation">Presentation</option>
            <option value="audio">Audio</option>
            <option value="mind_map">Mind Map</option>
            <option value="avatar_video">Avatar Video</option>
          </select>
        </div>

        {/* Generation Method Filter */}
        <div>
          <label
            className={`block text-sm font-medium mb-2 ${
              theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            Generation Method
          </label>
          <select
            value={filters.generation_method_id || ''}
            onChange={e => handleFilterChange('generation_method_id', e.target.value || undefined)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
              theme === 'day-mode'
                ? 'border-gray-300 bg-white text-gray-900'
                : 'border-gray-600 bg-gray-700 text-white'
            }`}
          >
            <option value="">All Methods</option>
            <option value="manual">Manual</option>
            <option value="ai_assisted">AI-Assisted</option>
            <option value="video_to_lesson">Video to Lesson</option>
          </select>
        </div>
      </div>
    </div>
  );
};



