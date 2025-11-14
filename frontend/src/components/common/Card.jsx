import React from 'react';

/**
 * Card Component
 * @param {Object} props
 * @param {boolean} props.hoverable
 * @param {boolean} props.selected
 * @param {React.ReactNode} props.children
 */
export const Card = ({
  hoverable = false,
  selected = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-xl p-6 transition-all duration-300 ${
        // Background: #1e293b or gradient-card in dark mode
        'bg-white dark:bg-[#1e293b] dark:bg-gradient-to-br dark:from-[#1e293b] dark:to-[#334155]'
      } ${
        // Borders: rgba white(0.1) in dark mode
        'border border-gray-200 dark:border-white/10'
      } ${
        // Shadows
        'shadow-sm dark:shadow-[0_10px_40px_rgba(0,0,0,0.6)]'
      } ${
        hoverable 
          ? 'hover:shadow-xl dark:hover:shadow-[0_20px_60px_rgba(13,148,136,0.3)] hover:-translate-y-1 cursor-pointer hover:border-emerald-500/50 dark:hover:border-emerald-500/50' 
          : ''
      } ${
        selected 
          ? 'border-emerald-600 dark:border-emerald-500 border-2 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30' 
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};


