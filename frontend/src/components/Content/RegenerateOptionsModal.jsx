import React from 'react';
import PropTypes from 'prop-types';
import { useApp } from '../../context/AppContext.jsx';

export const RegenerateOptionsModal = ({
  open,
  onClose,
  onSelect,
  contentType,
}) => {
  const { theme } = useApp();

  if (!open || !contentType) return null;

  const options = [
    {
      id: 'ai',
      label: 'Generate with AI',
      description: 'Use the AI assistant to produce a new version automatically.',
      icon: 'fa-robot',
    },
    contentType.allowManual && {
      id: 'manual',
      label: 'Create manually',
      description: 'Open the manual editor to craft the content yourself.',
      icon: 'fa-pen-to-square',
    },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        className={`max-w-lg w-full rounded-2xl shadow-2xl border ${
          theme === 'day-mode'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] opacity-60">Regenerate</p>
            <h3 className="text-xl font-semibold mt-1">
              Choose how to recreate {contentType.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-3">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => onSelect?.(option.id)}
              className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${
                theme === 'day-mode'
                  ? 'bg-gray-50 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50'
                  : 'bg-slate-800 border-slate-700 hover:border-emerald-500/60 hover:bg-emerald-500/10'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${
                    theme === 'day-mode'
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : 'bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  <i className={`fas ${option.icon}`} />
                </div>
                <div>
                  <p className="font-semibold text-base">{option.label}</p>
                  <p className="text-sm opacity-70">{option.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-white/10 text-right">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              theme === 'day-mode'
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

RegenerateOptionsModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSelect: PropTypes.func,
  contentType: PropTypes.shape({
    name: PropTypes.string.isRequired,
    allowManual: PropTypes.bool,
  }),
};

