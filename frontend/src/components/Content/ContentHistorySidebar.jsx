import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { contentService } from '../../services/content.js';
import { useApp } from '../../context/AppContext.jsx';
import { MindMapViewer } from '../MindMapViewer.jsx';

const SECTION_DEFINITIONS = [
  { id: 'text_audio', label: 'Text & Audio', icon: 'fa-file-audio', typeId: 1 },
  { id: 'slides', label: 'Slides', icon: 'fa-slideshare', typeId: 3 },
  { id: 'mind_map', label: 'Mind Map', icon: 'fa-project-diagram', typeId: 5 },
  { id: 'code', label: 'Code', icon: 'fa-code', typeId: 2 },
  { id: 'avatar_video', label: 'Avatar Video', icon: 'fa-video', typeId: 6 },
];

const formatPreview = (sectionId, entry) => {
  if (!entry) return '';
  const data = entry.content_data || entry;

  switch (sectionId) {
    case 'text_audio': {
      const text = data.text || data.body || '';
      return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    }
    case 'slides': {
      const title = data.presentation?.title || data.title || 'Slide deck';
      const count = data.slide_count || data.slides?.length;
      return `${title}${count ? ` (${count} slides)` : ''}`;
    }
    case 'mind_map': {
      if (Array.isArray(data.nodes)) {
        return `Mind map with ${data.nodes.length} nodes`;
      }
      return 'Mind map structure';
    }
    case 'code': {
      const snippet = data.code || data.snippet || '';
      return snippet.length > 120 ? `${snippet.slice(0, 117)}...` : snippet;
    }
    case 'avatar_video': {
      return data.videoUrl || data.storageUrl || 'Avatar video';
    }
    default:
      return typeof data === 'string' ? data : JSON.stringify(data).slice(0, 120);
  }
};

const VersionRow = ({
  version,
  isCurrent,
  onPreview,
  onRestore,
  theme,
}) => {
  const baseClasses = theme === 'day-mode'
    ? 'bg-gray-50 border-gray-200 text-gray-700'
    : 'bg-slate-800/40 border-slate-700 text-slate-200';
  const activeClasses = theme === 'day-mode'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200';

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-3 transition-all ${
        isCurrent ? activeClasses : baseClasses
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {isCurrent ? 'Active Version' : 'Saved Version'}
          </p>
          <p className="text-xs opacity-70">
            Saved on: {new Date(version.updated_at || version.created_at).toLocaleString()}
          </p>
        </div>
        {!isCurrent && (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-900/20 dark:bg-white/10">
            Historical
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed max-h-16 overflow-hidden">
        {version.preview || 'No preview available'}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPreview(version)}
          className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <i className="fas fa-eye mr-2"></i>
          Preview
        </button>
        {!isCurrent && (
          <button
            onClick={() => onRestore(version)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <i className="fas fa-history mr-2"></i>
            Restore
          </button>
        )}
      </div>
    </div>
  );
};

VersionRow.propTypes = {
  version: PropTypes.object.isRequired,
  isCurrent: PropTypes.bool,
  onPreview: PropTypes.func.isRequired,
  onRestore: PropTypes.func,
  theme: PropTypes.string.isRequired,
};

export function ContentHistorySidebar({ existingContent = [], onHistoryChanged }) {
  const { theme } = useApp();
  const [openSections, setOpenSections] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [previewState, setPreviewState] = useState(null);

  const contentByType = useMemo(() => {
    const map = new Map();
    existingContent.forEach(item => {
      map.set(item.content_type_id, item);
    });
    return map;
  }, [existingContent]);

  const handleToggleSection = async section => {
    setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }));
    const contentItem = contentByType.get(section.typeId);
    if (!contentItem) return;

    if (!historyData[contentItem.content_id]) {
      await loadHistory(section, contentItem.content_id);
    }
  };

  const loadHistory = async (section, contentId) => {
    try {
      setLoadingMap(prev => ({ ...prev, [section.id]: true }));
      setErrorMap(prev => ({ ...prev, [section.id]: null }));
      const historyResponse = await contentService.getHistory(contentId);

      const currentPreview = formatPreview(section.id, {
        content_data: historyResponse.current?.content_data,
      });

      const normalized = {
        ...historyResponse,
        current: {
          ...historyResponse.current,
          preview: historyResponse.current?.preview || currentPreview,
        },
        versions: (historyResponse.versions || []).map(entry => ({
          ...entry,
          preview: entry.preview || formatPreview(section.id, entry),
        })),
      };

      setHistoryData(prev => ({ ...prev, [contentId]: normalized }));
    } catch (error) {
      setErrorMap(prev => ({
        ...prev,
        [section.id]: error?.response?.data?.error?.message || error.message || 'Failed to load history',
      }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [section.id]: false }));
    }
  };

  const handleRestore = async (section, version) => {
    if (!window.confirm('Restore this version? The current content will be archived.')) {
      return;
    }

    try {
      await contentService.restoreVersion(version.history_id);
      if (onHistoryChanged) {
        await onHistoryChanged();
      }
      const contentItem = contentByType.get(section.typeId);
      if (contentItem) {
        await loadHistory(section, contentItem.content_id);
      }
    } catch (error) {
      alert(error?.response?.data?.error?.message || 'Failed to restore version');
    }
  };

  const renderSectionBody = section => {
    const contentItem = contentByType.get(section.typeId);
    if (!contentItem) {
      return (
        <p className="text-sm opacity-70">
          No content created yet.
        </p>
      );
    }

    const history = historyData[contentItem.content_id];
    if (loadingMap[section.id]) {
      return (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <i className="fas fa-circle-notch fa-spin"></i>
          Loading history...
        </div>
      );
    }

    if (errorMap[section.id]) {
      return (
        <div className="text-sm text-red-500">
          {errorMap[section.id]}
        </div>
      );
    }

    if (!history) {
      return (
        <button
          onClick={() => loadHistory(section, contentItem.content_id)}
          className="px-3 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <i className="fas fa-history mr-2"></i>
          Load history
        </button>
      );
    }

    const entries = [
      { ...history.current, history_id: 'current', isCurrent: true },
      ...history.versions.map(entry => ({ ...entry, isCurrent: false })),
    ];

    return (
      <div className="flex flex-col gap-3">
        {entries.length === 0 ? (
          <p className="text-sm opacity-70">No versions recorded yet.</p>
        ) : (
          entries.map(entry => (
            <VersionRow
              key={`${entry.history_id}`}
              version={{
                ...entry,
                created_at: entry.created_at || history.current?.updated_at,
              }}
              isCurrent={entry.isCurrent}
              onPreview={version =>
                setPreviewState({
                  sectionId: section.id,
                  sectionLabel: section.label,
                  version,
                })
              }
              onRestore={version => handleRestore(section, version)}
              theme={theme}
            />
          ))
        )}
      </div>
    );
  };

  const activeSections = SECTION_DEFINITIONS.filter(section => {
    if (section.id === 'avatar_video') {
      const avatarContent = contentByType.get(section.typeId);
      return Boolean(avatarContent);
    }
    return true;
  });

  useEffect(() => {
    // Close sections when content removed
    setHistoryData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(contentId => {
        const stillExists = existingContent.some(item => `${item.content_id}` === `${contentId}`);
        if (!stillExists) {
          delete next[contentId];
        }
      });
      return next;
    });
  }, [existingContent]);

  return (
    <aside
      className={`pr-4 py-4 pl-0 h-full overflow-y-auto ${
        theme === 'day-mode'
          ? 'bg-white text-gray-900'
          : 'bg-slate-900 text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <i className="fas fa-archive"></i>
          Version History
        </h2>
        <span className="text-xs uppercase tracking-widest opacity-60">Content Studio</span>
      </div>

      <div className="space-y-4">
        {activeSections.map(section => {
          const isOpen = openSections[section.id];
          const hasContent = Boolean(contentByType.get(section.typeId));

          return (
            <div key={section.id} className="border rounded-2xl overflow-hidden">
              <button
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${
                  theme === 'day-mode'
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                } ${!hasContent ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => hasContent && handleToggleSection(section)}
                disabled={!hasContent}
              >
                <div className="flex items-center gap-3">
                  <i className={`fas ${section.icon}`}></i>
                  <span className="font-semibold text-sm uppercase tracking-wide">
                    {section.label}
                  </span>
                </div>
                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
              </button>

              {isOpen && (
                <div className="px-4 py-4 bg-black/5 dark:bg-white/5">
                  {renderSectionBody(section)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {previewState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className={`max-w-2xl w-full mx-4 rounded-2xl shadow-2xl border p-6 relative ${
              theme === 'day-mode'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            <button
              className="absolute top-4 right-4 text-xl opacity-60 hover:opacity-100"
              onClick={() => setPreviewState(null)}
            >
              <i className="fas fa-times"></i>
            </button>

            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-eye"></i>
              {previewState.sectionLabel || 'Version Preview'}
            </h3>

            <div className="max-h-[70vh] overflow-auto pr-1 space-y-4">
              {renderPreviewContent(previewState.sectionId, previewState.version, theme)}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

ContentHistorySidebar.propTypes = {
  existingContent: PropTypes.array,
  onHistoryChanged: PropTypes.func,
};

function renderPreviewContent(sectionId, version, theme) {
  const data = version?.content_data || version || {};

  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <p className="text-sm opacity-70">No data available for this version.</p>;
  }

  switch (sectionId) {
    case 'text_audio':
      return (
        <div className="space-y-4">
          {data.text && (
            <div className="whitespace-pre-wrap leading-relaxed text-sm">
              {data.text}
            </div>
          )}
          {data.audioUrl && (
            <div className="space-y-2">
              <audio controls className="w-full" src={data.audioUrl}>
                Your browser does not support the audio element.
              </audio>
              <div className="text-xs opacity-70 flex flex-wrap gap-3">
                {data.audioVoice ? <span>Voice: {data.audioVoice}</span> : null}
                {data.audioDuration ? (
                  <span>Duration: {Math.round(data.audioDuration)}s</span>
                ) : null}
                {data.audioFormat ? <span>Format: {data.audioFormat}</span> : null}
              </div>
            </div>
          )}
        </div>
      );

    case 'slides': {
      const title =
        data.presentation?.title ||
        data.title ||
        data.fileName ||
        'Presentation Deck';
      const slides = data.presentation?.slides || data.slides || [];
      const googleUrl =
        data.googleSlidesUrl ||
        data.presentation?.publicUrl ||
        data.presentation?.url ||
        data.storageUrl ||
        data.fileUrl;

      const summaryItems = [
        data.slide_count ? `${data.slide_count} total slides` : null,
        data.presentation?.createdBy ? `Author: ${data.presentation.createdBy}` : null,
        data.presentation?.subject ? `Subject: ${data.presentation.subject}` : null,
        // Language removed - stored in topics table, not in content_data
      ].filter(Boolean);

      return (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center text-2xl">
                <i className="fas fa-file-powerpoint"></i>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-semibold leading-tight">{title}</h4>
              {summaryItems.length > 0 && (
                <ul className="text-xs opacity-70 space-y-1">
                  {summaryItems.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {googleUrl && (
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  <i className="fas fa-external-link-alt"></i>
                  Open presentation
                </a>
              )}
            </div>
          </div>

          {slides.length > 0 ? (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold opacity-80">Slide Outline</h5>
              <ol className="space-y-2 text-sm">
                {slides.slice(0, 8).map((slide, index) => (
                  <li
                    key={slide.slide_number || index}
                    className="border-l-2 border-purple-400 pl-3"
                  >
                    <p className="font-medium">{slide.title || `Slide ${index + 1}`}</p>
                    {Array.isArray(slide.content) && slide.content.length > 0 && (
                      <ul className="list-disc list-inside opacity-80">
                        {slide.content.slice(0, 4).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                        {slide.content.length > 4 && <li>…</li>}
                      </ul>
                    )}
                  </li>
                ))}
                {slides.length > 8 && (
                  <li className="opacity-60">… {slides.length - 8} more slides</li>
                )}
              </ol>
            </div>
          ) : (
            <div
              className={`p-4 rounded-lg border ${
                theme === 'day-mode'
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-purple-900/20 border-purple-500/30'
              }`}
            >
              <p className="text-sm opacity-80">
                Slide outline not available for this version, but you can open the deck using the link
                above.
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'mind_map':
      if (data.nodes?.length && data.edges?.length) {
        return (
          <div className="border rounded-xl p-3 bg-white/40 dark:bg-slate-800/60">
            <MindMapViewer data={data} />
          </div>
        );
      }
      return <p className="text-sm opacity-70">Mind map data not available.</p>;

    case 'code': {
      const code = data.code || data.snippet || data.text;
      const language = data.language || data.languageLabel || 'code';
      return code ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest opacity-60">{language}</div>
          <pre
            className={`rounded-lg p-4 overflow-auto text-sm ${
              theme === 'day-mode'
                ? 'bg-gray-900 text-green-100'
                : 'bg-slate-800 text-emerald-100'
            }`}
          >
            {code}
          </pre>
        </div>
      ) : (
        <p className="text-sm opacity-70">No code snippet available.</p>
      );
    }

    case 'avatar_video': {
      const videoUrl = data.videoUrl || data.storageUrl || data.cloudUrl;
      return videoUrl ? (
        <div className="space-y-3">
          <video
            controls
            src={videoUrl}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700"
          >
            <track kind="captions" />
          </video>
          <div className="text-xs opacity-70">
            <div>Voice: {data.voice || data.audioVoice || 'Unknown'}</div>
            {data.duration && <div>Duration: {Math.round(data.duration)}s</div>}
          </div>
        </div>
      ) : (
        <p className="text-sm opacity-70">Video URL missing for this version.</p>
      );
    }

    default:
      return (
        <pre className="max-h-[60vh] overflow-auto text-sm whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}
