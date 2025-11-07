import React from 'react';
import LanguageStatsDashboard from '../../components/LanguageStatsDashboard';
import { useApp } from '../../context/AppContext';

/**
 * Language Statistics Page
 * Displays comprehensive language usage statistics
 */
export default function LanguageStatsPage() {
  const { theme } = useApp();

  return (
    <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1
            className="text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Language Statistics
          </h1>
          <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
            Monitor language usage, popularity, and caching status
          </p>
        </div>

        <LanguageStatsDashboard />
      </div>
    </div>
  );
}



