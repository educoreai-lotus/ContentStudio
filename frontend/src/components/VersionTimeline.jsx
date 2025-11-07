import React, { useState, useEffect } from 'react';
import { versionsService } from '../services/versions.js';
import { useApp } from '../context/AppContext.jsx';

export const VersionTimeline = ({ contentId, onRestore }) => {
  const { theme } = useApp();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  useEffect(() => {
    if (contentId) {
      loadVersions();
    }
  }, [contentId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const versionsList = await versionsService.getVersions(contentId);
      setVersions(versionsList);
    } catch (err) {
      setError(err.error?.message || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async versionId => {
    if (
      !window.confirm(
        'Are you sure you want to restore this version? This will create a new version from the selected one.'
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await versionsService.restoreVersion(versionId);
      await loadVersions();
      if (onRestore) {
        onRestore();
      }
    } catch (err) {
      setError(err.error?.message || 'Failed to restore version');
    } finally {
      setLoading(false);
    }
  };

  const handleViewVersion = async versionId => {
    try {
      const version = await versionsService.getVersion(versionId);
      setSelectedVersion(version);
    } catch (err) {
      setError(err.error?.message || 'Failed to load version details');
    }
  };

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
          Version History
        </h3>
        <button
          onClick={loadVersions}
          disabled={loading}
          className={`px-3 py-1 rounded text-sm font-medium transition-all ${
            loading
              ? 'opacity-50 cursor-not-allowed'
              : theme === 'day-mode'
              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''} mr-1`}></i>
          Refresh
        </button>
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

      {loading && versions.length === 0 ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
          <span className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
            Loading versions...
          </span>
        </div>
      ) : versions.length === 0 ? (
        <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
          No versions yet. Versions are created automatically when content is updated.
        </p>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div
              key={version.version_id}
              className={`flex items-start gap-4 p-3 rounded-lg border ${
                version.is_current_version
                  ? theme === 'day-mode'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-emerald-900/20 border-emerald-500/30'
                  : theme === 'day-mode'
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-gray-700 border-gray-600'
              }`}
            >
              <div className="flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    version.is_current_version
                      ? 'bg-emerald-600 text-white'
                      : theme === 'day-mode'
                      ? 'bg-gray-300 text-gray-700'
                      : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {version.version_number}
                </div>
                {index < versions.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mx-auto ${
                      theme === 'day-mode' ? 'bg-gray-300' : 'bg-gray-600'
                    }`}
                  ></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-sm font-medium ${
                      theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    Version {version.version_number}
                  </span>
                  {version.is_current_version && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        theme === 'day-mode'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-900/20 text-emerald-400'
                      }`}
                    >
                      Current
                    </span>
                  )}
                </div>

                {version.change_description && (
                  <p
                    className={`text-sm mb-2 ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {version.change_description}
                  </p>
                )}

                <div
                  className={`flex items-center gap-4 text-xs ${
                    theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                  }`}
                >
                  <span>By: {version.created_by}</span>
                  <span>
                    {new Date(version.created_at).toLocaleDateString()}{' '}
                    {new Date(version.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleViewVersion(version.version_id)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                      theme === 'day-mode'
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    <i className="fas fa-eye mr-1"></i>
                    View
                  </button>
                  {!version.is_current_version && (
                    <button
                      onClick={() => handleRestore(version.version_id)}
                      disabled={loading}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        loading
                          ? 'opacity-50 cursor-not-allowed'
                          : theme === 'day-mode'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      <i className="fas fa-undo mr-1"></i>
                      Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVersion && (
        <div
          className={`mt-4 p-4 rounded-lg border ${
            theme === 'day-mode'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-blue-900/20 border-blue-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h4
              className={`font-semibold ${
                theme === 'day-mode' ? 'text-gray-900' : 'text-white'
              }`}
            >
              Version {selectedVersion.version_number} Details
            </h4>
            <button
              onClick={() => setSelectedVersion(null)}
              className={`text-sm ${
                theme === 'day-mode'
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <pre
            className={`text-xs overflow-auto max-h-40 p-2 rounded ${
              theme === 'day-mode'
                ? 'bg-white text-gray-900'
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            {JSON.stringify(selectedVersion.content_data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};



