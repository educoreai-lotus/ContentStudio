import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';

export const SearchBar = ({ onSearch, placeholder = 'Search courses, lessons, content...' }) => {
  const { theme } = useApp();
  const [query, setQuery] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer for debounced search
    const timer = setTimeout(() => {
      if (onSearch) {
        onSearch(query);
      }
    }, 300); // 300ms debounce

    setDebounceTimer(timer);

    // Cleanup
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [query]);

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <i className={`fas fa-search ${theme === 'day-mode' ? 'text-gray-400' : 'text-gray-500'}`}></i>
      </div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
          theme === 'day-mode'
            ? 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
            : 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
        }`}
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          className={`absolute inset-y-0 right-0 flex items-center pr-3 ${
            theme === 'day-mode' ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <i className="fas fa-times"></i>
        </button>
      )}
    </div>
  );
};



