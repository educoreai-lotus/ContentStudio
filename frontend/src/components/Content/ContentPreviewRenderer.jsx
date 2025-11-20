import React from 'react';
import { MindMapViewer } from '../MindMapViewer.jsx';

/**
 * Shared component for rendering content preview
 * Used by ContentHistorySidebar, SharedSidebar, and other components
 * 
 * @param {string} sectionId - Content section ID ('text_audio', 'code', 'slides', 'mind_map', 'avatar_video')
 * @param {Object} version - Version object with content_data
 * @param {string} theme - Theme mode ('day-mode' or 'dark-mode')
 */
export function ContentPreviewRenderer({ sectionId, version, theme }) {
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
      const presentationUrl =
        data.presentationUrl ||
        data.googleSlidesUrl ||
        data.presentation?.publicUrl ||
        data.presentation?.url ||
        data.storageUrl ||
        data.fileUrl;
      
      const gammaUrl = data.metadata?.gamma_raw_response?.result?.gammaUrl || 
                       data.metadata?.gamma_raw_response?.gammaUrl ||
                       data.gamma_raw_response?.result?.gammaUrl ||
                       data.gamma_raw_response?.gammaUrl ||
                       data.gammaUrl;

      const summaryItems = [
        data.slide_count ? `${data.slide_count} total slides` : null,
        data.presentation?.createdBy ? `Author: ${data.presentation.createdBy}` : null,
        data.presentation?.subject ? `Subject: ${data.presentation.subject}` : null,
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
              {(gammaUrl || presentationUrl) && (
                <div className="flex flex-wrap gap-2">
                  {gammaUrl && (
                    <a
                      href={gammaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <i className="fas fa-external-link-alt"></i>
                      View
                    </a>
                  )}
                  {presentationUrl && (
                    <a
                      href={presentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <i className="fas fa-download"></i>
                      Download
                    </a>
                  )}
                </div>
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

