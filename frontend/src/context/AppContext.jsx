import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [theme, setTheme] = useState('day-mode');
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'day-mode';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'night-mode');
  }, []);

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


