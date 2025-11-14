import React from 'react';

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
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    // Primary: gradient #0d9488 → #059669 with white text
    primary: 'bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-600 dark:to-emerald-700 text-white shadow-lg hover:from-emerald-700 hover:to-emerald-800 dark:hover:from-emerald-700 dark:hover:to-emerald-800 hover:shadow-xl active:scale-95 focus:ring-emerald-500',
    // Secondary: transparent + border white/20, text #f8fafc
    secondary: 'bg-transparent dark:bg-transparent text-gray-900 dark:text-[#f8fafc] border-2 border-gray-300 dark:border-white/20 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 dark:hover:from-emerald-600 dark:hover:to-emerald-700 hover:text-white hover:border-transparent active:scale-95 focus:ring-emerald-500',
    // Ghost: soft hover using #334155
    ghost: 'bg-transparent dark:bg-transparent text-gray-700 dark:text-[#cbd5e1] hover:bg-gray-100 dark:hover:bg-[#334155] active:scale-95 focus:ring-emerald-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl active:scale-95 focus:ring-red-500',
    outline: 'border border-gray-300 dark:border-white/20 text-gray-700 dark:text-[#f8fafc] hover:bg-gray-50 dark:hover:bg-[#334155] active:scale-95 focus:ring-emerald-500',
  };
  
  const sizeClasses = {
    small: 'py-1.5 px-3 text-sm',
    medium: 'py-2.5 px-5 text-base',
    large: 'py-3.5 px-7 text-lg',
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


