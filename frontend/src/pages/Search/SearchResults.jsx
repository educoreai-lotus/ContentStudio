import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService } from '../../services/search.js';
import { useApp } from '../../context/AppContext.jsx';
import { SearchBar } from '../../components/SearchBar.jsx';
import { FilterSidebar } from '../../components/FilterSidebar.jsx';

export const SearchResults = () => {
  const navigate = useNavigate();
  const { theme } = useApp();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0,
  });

  const performSearch = async (searchQuery = query, currentFilters = filters, page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const searchResults = await searchService.search({
        q: searchQuery,
        filters: currentFilters,
        pagination: { page, limit: pagination.limit },
      });

      setResults(searchResults.results || []);
      setPagination({
        page: searchResults.page || 1,
        limit: searchResults.limit || 10,
        total: searchResults.total || 0,
        total_pages: searchResults.total_pages || 0,
      });
    } catch (err) {
      setError(err.error?.message || 'Failed to search');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial search with empty query (shows all)
    performSearch('', filters, 1);
  }, []);

  const handleSearch = searchQuery => {
    setQuery(searchQuery);
    setPagination(prev => ({ ...prev, page: 1 }));
    performSearch(searchQuery, filters, 1);
  };

  const handleFilterChange = newFilters => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    performSearch(query, newFilters, 1);
  };

  const handleClearFilters = () => {
    const clearedFilters = {};
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    performSearch(query, clearedFilters, 1);
  };

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, page: newPage }));
    performSearch(query, filters, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTypeIcon = type => {
    switch (type) {
      case 'course':
        return 'fa-graduation-cap';
      case 'topic':
        return 'fa-book';
      case 'content':
        return 'fa-file-alt';
      default:
        return 'fa-circle';
    }
  };

  const getTypeColor = type => {
    switch (type) {
      case 'course':
        return 'emerald';
      case 'topic':
        return 'blue';
      case 'content':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const handleResultClick = result => {
    if (result.type === 'course') {
      navigate(`/courses/${result.id}`);
    } else if (result.type === 'topic') {
      navigate(`/topics/${result.id}`);
    } else if (result.type === 'content') {
      navigate(`/topics/${result.topic_id}`);
    }
  };

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 md:p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Search Content
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Search across courses, lessons, and content items
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {error && (
              <div
                className={`mb-4 border px-4 py-3 rounded-lg ${
                  theme === 'day-mode'
                    ? 'bg-red-100 border-red-400 text-red-700'
                    : 'bg-red-900/20 border-red-500 text-red-300'
                }`}
              >
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`animate-pulse rounded-2xl shadow-lg p-6 h-32 ${
                      theme === 'day-mode'
                        ? 'bg-white border border-gray-200'
                        : 'bg-gray-800 border border-gray-700'
                    }`}
                  ></div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div
                className={`rounded-2xl shadow-lg p-8 text-center ${
                  theme === 'day-mode'
                    ? 'bg-white border border-gray-200'
                    : 'bg-gray-800 border border-gray-700'
                }`}
                style={{
                  background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <p className={theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'}>
                  No results found
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p
                    className={`text-sm ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    Found {pagination.total} result{pagination.total !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-4">
                  {results.map(result => (
                    <div
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className={`rounded-2xl shadow-lg p-6 transition-all cursor-pointer ${
                        theme === 'day-mode'
                          ? 'bg-white border border-gray-200 hover:border-emerald-400'
                          : 'bg-gray-800 border border-gray-700 hover:border-emerald-500'
                      }`}
                      style={{
                        background: theme === 'day-mode' ? 'var(--gradient-card)' : undefined,
                        boxShadow: 'var(--shadow-card)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            theme === 'day-mode'
                              ? `bg-${getTypeColor(result.type)}-100`
                              : `bg-${getTypeColor(result.type)}-900/20`
                          }`}
                        >
                          <i
                            className={`fas ${getTypeIcon(result.type)} text-${getTypeColor(result.type)}-600`}
                          ></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3
                              className={`text-xl font-semibold ${
                                theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                              }`}
                            >
                              {result.title}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                theme === 'day-mode'
                                  ? `bg-${getTypeColor(result.type)}-100 text-${getTypeColor(result.type)}-700`
                                  : `bg-${getTypeColor(result.type)}-900/20 text-${getTypeColor(result.type)}-400`
                              }`}
                            >
                              {result.type}
                            </span>
                          </div>
                          {result.description && (
                            <p
                              className={`text-sm mb-2 ${
                                theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                              }`}
                            >
                              {result.description}
                            </p>
                          )}
                          <div
                            className={`flex items-center gap-4 text-xs ${
                              theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                            }`}
                          >
                            {result.status && (
                              <span>Status: {result.status}</span>
                            )}
                            {result.content_type_id && (
                              <span>Type: {result.content_type_id}</span>
                            )}
                            {result.generation_method_id && (
                              <span>Method: {result.generation_method_id}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <div className="mt-6 flex justify-center gap-2">
                    <button
                      disabled={pagination.page === 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        pagination.page === 1
                          ? 'opacity-50 cursor-not-allowed'
                          : theme === 'day-mode'
                          ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      Previous
                    </button>
                    <span
                      className={`flex items-center px-4 text-sm ${
                        theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                      }`}
                    >
                      Page {pagination.page} of {pagination.total_pages}
                    </span>
                    <button
                      disabled={pagination.page === pagination.total_pages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        pagination.page === pagination.total_pages
                          ? 'opacity-50 cursor-not-allowed'
                          : theme === 'day-mode'
                          ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



