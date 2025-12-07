import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Lazy initialization to avoid setState in effect
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme') || 'day-mode';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', savedTheme === 'night-mode');
    }
    return savedTheme;
  });
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState(null);
  const [sidebarState, setSidebarState] = useState({
    isOpen: false,
    isCollapsed: false,
  });

  const toggleTheme = () => {
    const newTheme = theme === 'day-mode' ? 'night-mode' : 'day-mode';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'night-mode');
  };

  const handleNewLesson = () => {
    // This will be handled by the component that uses it
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        lessons,
        setLessons,
        error,
        setError,
        handleNewLesson,
        sidebarState,
        setSidebarState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};


