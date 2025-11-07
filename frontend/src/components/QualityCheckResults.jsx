import React, { useState, useEffect } from 'react';
import { qualityChecksService } from '../services/quality-checks.js';
import { useApp } from '../context/AppContext.jsx';
import { QualityCheckBadge } from './QualityCheckBadge.jsx';

export const QualityCheckResults = ({ contentId, onTrigger }) => {
  const { theme } = useApp();
  const [qualityChecks, setQualityChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (contentId) {
      loadQualityChecks();
    }
  }, [contentId]);

  const loadQualityChecks = async () => {
    try {
      setLoading(true);
      setError(null);
      const checks = await qualityChecksService.getQualityChecks(contentId);
      setQualityChecks(checks);
    } catch (err) {
      setError(err.error?.message || 'Failed to load quality checks');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCheck = async checkType => {
    try {
      setLoading(true);
      setError(null);
      await qualityChecksService.triggerQualityCheck(contentId, checkType);
      // Reload after triggering
      setTimeout(() => {
        loadQualityChecks();
      }, 2000);
      if (onTrigger) {
        onTrigger();
      }
    } catch (err) {
      setError(err.error?.message || 'Failed to trigger quality check');
    } finally {
      setLoading(false);
    }
  };

  const latestCheck = qualityChecks.length > 0 ? qualityChecks[0] : null;

  if (!contentId) return null;

  return (
    <div
      className={`rounded-lg p-4 border ${
        theme === 'day-mode'
          ? 'bg-white border-gray-200'
          : 'bg-gray-800 border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className={`text-lg font-semibold ${
            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
          }`}
        >
          Quality Check
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleTriggerCheck('quick')}
            disabled={loading}
            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
              loading
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'day-mode'
                ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                : 'bg-blue-900/20 hover:bg-blue-900/30 text-blue-400'
            }`}
          >
            Quick Check
          </button>
          <button
            onClick={() => handleTriggerCheck('full')}
            disabled={loading}
            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
              loading
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'day-mode'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            Full Check
          </button>
        </div>
      </div>

      {error && (
        <div
          className={`mb-4 border px-3 py-2 rounded ${
            theme === 'day-mode'
              ? 'bg-red-100 border-red-400 text-red-700'
              : 'bg-red-900/20 border-red-500 text-red-300'
          }`}
        >
          {error}
        </div>
      )}

      {loading && qualityChecks.length === 0 && (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
          <span className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
            Checking quality...
          </span>
        </div>
      )}

      {latestCheck && (
        <div>
          <QualityCheckBadge qualityCheck={latestCheck} />

          {latestCheck.status === 'completed' && latestCheck.results && (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                {latestCheck.results.clarity !== undefined && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        Clarity
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                        }`}
                      >
                        {latestCheck.results.clarity}/100
                      </span>
                    </div>
                    <div
                      className={`w-full rounded-full h-2 ${
                        theme === 'day-mode' ? 'bg-gray-200' : 'bg-gray-700'
                      }`}
                    >
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{ width: `${latestCheck.results.clarity}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {latestCheck.results.structure !== undefined && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        Structure
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                        }`}
                      >
                        {latestCheck.results.structure}/100
                      </span>
                    </div>
                    <div
                      className={`w-full rounded-full h-2 ${
                        theme === 'day-mode' ? 'bg-gray-200' : 'bg-gray-700'
                      }`}
                    >
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${latestCheck.results.structure}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {latestCheck.results.originality !== undefined && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span
                        className={`text-sm ${
                          theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                        }`}
                      >
                        Originality
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                        }`}
                      >
                        {latestCheck.results.originality}/100
                      </span>
                    </div>
                    <div
                      className={`w-full rounded-full h-2 ${
                        theme === 'day-mode' ? 'bg-gray-200' : 'bg-gray-700'
                      }`}
                    >
                      <div
                        className="h-2 rounded-full bg-purple-600"
                        style={{ width: `${latestCheck.results.originality}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {latestCheck.results.plagiarism_detected && (
                <div
                  className={`mt-3 p-3 rounded border ${
                    theme === 'day-mode'
                      ? 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-red-900/20 border-red-500 text-red-300'
                  }`}
                >
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Plagiarism detected in content
                </div>
              )}
            </div>
          )}

          {latestCheck.status === 'failed' && latestCheck.error_message && (
            <div
              className={`mt-3 p-3 rounded border ${
                theme === 'day-mode'
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : 'bg-red-900/20 border-red-500 text-red-300'
              }`}
            >
              Error: {latestCheck.error_message}
            </div>
          )}
        </div>
      )}

      {qualityChecks.length === 0 && !loading && (
        <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
          No quality checks yet. Trigger a check to get started.
        </p>
      )}
    </div>
  );
};



