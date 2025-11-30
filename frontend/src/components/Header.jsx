import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme, handleNewLesson } = useApp();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const logoUrl = `${API_BASE_URL}/api/logo/${theme === 'day-mode' ? 'light' : 'dark'}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full h-20 backdrop-blur-md bg-white/95 dark:bg-[#0f172a]/95 border-b border-gray-200 dark:border-white/10 shadow-lg">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* EDUCORE AI Logo */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 h-20 w-auto relative">
              <img
                src={logoUrl}
                alt="EDUCORE AI Logo"
                className="h-full w-auto object-contain transition-all duration-300"
                onError={e => {
                  // Fallback if image doesn't exist
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col justify-center"></div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className={`transition-all duration-300 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                location.pathname === '/'
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20'
                  : 'text-gray-600 dark:text-[#cbd5e1] hover:text-emerald-600 dark:hover:text-[#f8fafc] hover:bg-emerald-50 dark:hover:bg-[#334155] hover:underline hover:decoration-emerald-400'
              }`}
            >
              <i className={`fas fa-home w-4 h-4 flex-shrink-0 ${
                location.pathname === '/'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-[#cbd5e1]'
              }`}></i>
              <span>Home</span>
            </button>
            <button
              onClick={() => navigate('/courses')}
              className={`transition-all duration-300 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                location.pathname.startsWith('/courses')
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20'
                  : 'text-gray-600 dark:text-[#cbd5e1] hover:text-emerald-600 dark:hover:text-[#f8fafc] hover:bg-emerald-50 dark:hover:bg-[#334155] hover:underline hover:decoration-emerald-400'
              }`}
            >
              <i className={`fas fa-graduation-cap w-4 h-4 flex-shrink-0 ${
                location.pathname.startsWith('/courses')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-[#cbd5e1]'
              }`}></i>
              <span>Courses</span>
            </button>
            <button
              onClick={() => navigate('/topics')}
              className={`transition-all duration-300 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                location.pathname === '/topics' || location.pathname === '/lessons'
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20'
                  : 'text-gray-600 dark:text-[#cbd5e1] hover:text-emerald-600 dark:hover:text-[#f8fafc] hover:bg-emerald-50 dark:hover:bg-[#334155] hover:underline hover:decoration-emerald-400'
              }`}
            >
              <i className={`fas fa-book w-4 h-4 flex-shrink-0 ${
                location.pathname === '/topics' || location.pathname === '/lessons'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-[#cbd5e1]'
              }`}></i>
              <span>Lessons</span>
            </button>
      
          </nav>

          {/* Language Selector */}
          <div className="hidden md:flex items-center">
            {/* Removed LanguageSelector */}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-10 h-10 border rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-100 dark:bg-[#1e293b] border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#f8fafc] hover:bg-emerald-100 dark:hover:bg-[#334155]"
            title="Toggle Theme"
          >
            <i className={`fas ${theme === 'day-mode' ? 'fa-moon' : 'fa-sun'} text-sm`}></i>
          </button>

          {/* Header Controls */}
          <div className="flex items-center gap-6">
            {/* Create Course Button */}
            <button
              onClick={() => navigate('/courses/new')}
              className="px-4 py-2 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-600 dark:to-emerald-700 text-white border-none hover:from-emerald-700 hover:to-emerald-800 dark:hover:from-emerald-700 dark:hover:to-emerald-800 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-plus w-4 h-4"></i>
              Create Course
            </button>

            {/* Create Lesson Button */}
            <button
              onClick={() => {
                navigate('/topics/new');
                handleNewLesson();
              }}
              className="px-4 py-2 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-600 dark:to-emerald-700 text-white border-none hover:from-emerald-700 hover:to-emerald-800 dark:hover:from-emerald-700 dark:hover:to-emerald-800 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-plus w-4 h-4"></i>
              Create Lesson
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

