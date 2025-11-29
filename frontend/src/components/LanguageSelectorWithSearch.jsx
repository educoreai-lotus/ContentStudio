import React, { useState, useMemo } from 'react';

/**
 * Language Selector with Search and Scroll
 * Supports all languages from HeyGen voices config
 */
export const LanguageSelectorWithSearch = ({ 
  value, 
  onChange, 
  required = false,
  theme = 'day-mode',
  className = '',
  error = null,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // All languages from HeyGen voices config (mapped to ISO 639-1 codes)
  // Only includes languages that have voice_id in heygen-voices.json (excluding null values)
  const allLanguages = useMemo(() => [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'fa', name: 'Persian/Farsi', nativeName: 'فارسی' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'bn', name: 'Bangla', nativeName: 'বাংলা' },
    { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
    { code: 'ca', name: 'Catalan', nativeName: 'Català' },
    { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
    { code: 'da', name: 'Danish', nativeName: 'Dansk' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
    { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
    { code: 'tl', name: 'Filipino', nativeName: 'Filipino' },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
    { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'sw', name: 'Kiswahili', nativeName: 'Kiswahili' },
    { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
    { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română' },
    { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
    { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  ].sort((a, b) => a.name.localeCompare(b.name)), []); // Sort alphabetically by name

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      return allLanguages;
    }
    const query = searchQuery.toLowerCase();
    return allLanguages.filter(lang => 
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
    );
  }, [searchQuery, allLanguages]);

  // Get selected language display name
  const selectedLanguage = allLanguages.find(lang => lang.code === value) || allLanguages[0];

  const handleSelect = (languageCode) => {
    onChange({ target: { name: 'language', value: languageCode } });
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Custom Select Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-left flex items-center justify-between ${
          error
            ? 'border-red-600'
            : theme === 'day-mode'
            ? 'border-gray-300 bg-white text-gray-900'
            : 'border-gray-600 bg-gray-700 text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span>
          {selectedLanguage.name} {selectedLanguage.nativeName && `(${selectedLanguage.nativeName})`}
        </span>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} ml-2 text-sm`}></i>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
          ></div>

          {/* Dropdown Panel */}
          <div
            className={`absolute z-20 w-full mt-1 rounded-lg shadow-lg border ${
              theme === 'day-mode'
                ? 'bg-white border-gray-200'
                : 'bg-gray-800 border-gray-700'
            }`}
            style={{ maxHeight: '300px', minHeight: '200px' }}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-inherit">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Search language..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    theme === 'day-mode'
                      ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      : 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  }`}
                  autoFocus
                />
              </div>
            </div>

            {/* Language List with Scroll */}
            <div className="overflow-y-auto" style={{ maxHeight: '250px' }}>
              {filteredLanguages.length === 0 ? (
                <div className={`p-4 text-center text-sm ${
                  theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  No languages found
                </div>
              ) : (
                filteredLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full px-4 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ${
                      value === lang.code
                        ? theme === 'day-mode'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-900/30 text-emerald-200'
                        : theme === 'day-mode'
                        ? 'text-gray-900'
                        : 'text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{lang.name}</div>
                        {lang.nativeName && (
                          <div className="text-xs opacity-70">{lang.nativeName}</div>
                        )}
                      </div>
                      {value === lang.code && (
                        <i className="fas fa-check text-emerald-600 dark:text-emerald-400"></i>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Hidden select for form validation */}
      <select
        name="language"
        value={value || ''}
        onChange={onChange}
        required={required}
        className="hidden"
        disabled={disabled}
      >
        {allLanguages.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default LanguageSelectorWithSearch;

