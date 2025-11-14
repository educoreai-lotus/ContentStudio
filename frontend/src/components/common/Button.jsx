import React from 'react';
import { useApp } from '../../context/AppContext.jsx';

/**
 * Button Component
 * @param {Object} props
 * @param {string} props.variant - 'primary' | 'secondary' | 'danger' | 'outline'
 * @param {string} props.size - 'small' | 'medium' | 'large'
 * @param {boolean} props.disabled
 * @param {Function} props.onClick
 * @param {React.ReactNode} props.children
 */
export const Button = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  children,
  type = 'button',
  className = '',
  ...props
}) => {
  const { theme } = useApp();
  const isDark = theme === 'night-mode';
  
  const baseClasses = 'font-medium rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: isDark 
      ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: isDark
      ? 'bg-transparent text-slate-50 border-2 border-white/20 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 hover:text-white hover:border-transparent'
      : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    outline: isDark
      ? 'border border-white/20 hover:border-white/40 text-slate-50'
      : 'border border-gray-300 hover:border-gray-400 text-gray-700',
  };
  
  const sizeClasses = {
    small: 'py-1 px-2 text-sm',
    medium: 'py-2 px-4 text-base',
    large: 'py-3 px-6 text-lg',
  };

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};


