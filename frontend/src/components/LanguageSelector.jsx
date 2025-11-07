import React, { useState, useEffect } from 'react';
import { multilingualService } from '../services/multilingual';

/**
 * Language Selector Component
 * Allows trainer/learner to select preferred language
 */
export default function LanguageSelector({ 
  selectedLanguage, 
  onLanguageChange,
  theme = 'day-mode',
  showStats = false 
}) {
  const [languages, setLanguages] = useState([
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'he', name: 'עברית', flag: '🇮🇱' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
  ]);

  const [languageStats, setLanguageStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showStats) {
      loadLanguageStats();
    }
  }, [showStats]);

  const loadLanguageStats = async () => {
    try {
      setLoading(true);
      const response = await multilingualService.getLanguageStats();
      setLanguageStats(response.data);
    } catch (err) {
      console.error('Failed to load language stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLanguageInfo = (code) => {
    return languages.find(lang => lang.code === code) || { code, name: code.toUpperCase(), flag: '🌐' };
  };

  const isFrequentLanguage = (code) => {
    if (!languageStats) return false;
    return languageStats.frequent_languages?.some(lang => lang.language_code === code);
  };

  return (
    <div className={`relative ${theme === 'day-mode' ? 'bg-white' : 'bg-gray-800'}`}>
      <div className="flex items-center gap-2">
        <label className={`text-sm font-medium ${theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'}`}>
          Language:
        </label>
        <select
          value={selectedLanguage || 'en'}
          onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
          className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            theme === 'day-mode'
              ? 'bg-white border-gray-300 text-gray-900'
              : 'bg-gray-700 border-gray-600 text-white'
          }`}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        {showStats && isFrequentLanguage(selectedLanguage) && (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              theme === 'day-mode'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-emerald-900/30 text-emerald-300'
            }`}
            title="Frequently used language - cached in storage"
          >
            <i className="fas fa-star mr-1"></i>
            Cached
          </span>
        )}
      </div>

      {showStats && languageStats && (
        <div className={`mt-2 text-xs ${theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'}`}>
          {languageStats.total_languages} languages available
        </div>
      )}
    </div>
  );
}



