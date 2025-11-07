import React, { useState, useEffect } from 'react';
import { multilingualService } from '../services/multilingual';
import { useApp } from '../context/AppContext';

/**
 * Language Statistics Dashboard
 * Displays language usage statistics and popularity
 */
export default function LanguageStatsDashboard() {
  const { theme } = useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await multilingualService.getLanguageStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load language stats:', err);
      setError('Failed to load language statistics');
    } finally {
      setLoading(false);
    }
  };

  const languageNames = {
    en: 'English',
    he: 'Hebrew',
    ar: 'Arabic',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-lg ${
        theme === 'day-mode' ? 'bg-red-50 text-red-700' : 'bg-red-900/20 text-red-300'
      }`}>
        <i className="fas fa-exclamation-circle mr-2"></i>
        {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className={`p-6 rounded-lg ${
      theme === 'day-mode' ? 'bg-white border border-gray-200' : 'bg-gray-800 border border-gray-700'
    }`}>
      <h2
        className="text-2xl font-bold mb-6"
        style={{
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Language Statistics
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-blue-50' : 'bg-blue-900/20'
        }`}>
          <div className={`text-sm font-medium mb-1 ${
            theme === 'day-mode' ? 'text-blue-700' : 'text-blue-300'
          }`}>
            Total Languages
          </div>
          <div className={`text-2xl font-bold ${
            theme === 'day-mode' ? 'text-blue-900' : 'text-blue-100'
          }`}>
            {stats.total_languages || 0}
          </div>
        </div>

        <div className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-emerald-50' : 'bg-emerald-900/20'
        }`}>
          <div className={`text-sm font-medium mb-1 ${
            theme === 'day-mode' ? 'text-emerald-700' : 'text-emerald-300'
          }`}>
            Frequent Languages
          </div>
          <div className={`text-2xl font-bold ${
            theme === 'day-mode' ? 'text-emerald-900' : 'text-emerald-100'
          }`}>
            {stats.frequent_count || 0}
          </div>
        </div>

        <div className={`p-4 rounded-lg ${
          theme === 'day-mode' ? 'bg-purple-50' : 'bg-purple-900/20'
        }`}>
          <div className={`text-sm font-medium mb-1 ${
            theme === 'day-mode' ? 'text-purple-700' : 'text-purple-300'
          }`}>
            Non-Frequent
          </div>
          <div className={`text-2xl font-bold ${
            theme === 'day-mode' ? 'text-purple-900' : 'text-purple-100'
          }`}>
            {stats.non_frequent_count || 0}
          </div>
        </div>
      </div>

      {/* Frequent Languages */}
      {stats.frequent_languages && stats.frequent_languages.length > 0 && (
        <div className="mb-6">
          <h3 className={`text-lg font-semibold mb-3 ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
          }`}>
            <i className="fas fa-star text-yellow-500 mr-2"></i>
            Frequent Languages (Cached)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.frequent_languages.map((lang) => (
              <div
                key={lang.language_code}
                className={`p-3 rounded-lg border ${
                  theme === 'day-mode'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-emerald-900/20 border-emerald-700'
                }`}
              >
                <div className={`font-medium ${
                  theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                }`}>
                  {languageNames[lang.language_code] || lang.language_code.toUpperCase()}
                </div>
                <div className={`text-sm mt-1 ${
                  theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {lang.total_requests || 0} requests
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular Languages */}
      {stats.popular_languages && stats.popular_languages.length > 0 && (
        <div>
          <h3 className={`text-lg font-semibold mb-3 ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
          }`}>
            <i className="fas fa-chart-line text-blue-500 mr-2"></i>
            Popular Languages
          </h3>
          <div className="space-y-2">
            {stats.popular_languages.slice(0, 10).map((lang, index) => (
              <div
                key={lang.language_code}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    theme === 'day-mode' ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-900/30 text-emerald-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className={`font-medium ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}>
                      {languageNames[lang.language_code] || lang.language_code.toUpperCase()}
                    </div>
                    <div className={`text-xs ${
                      theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {lang.total_lessons || 0} lessons
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {lang.total_requests || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



