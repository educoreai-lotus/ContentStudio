import React from 'react';

/**
 * Badge Component
 * @param {Object} props
 * @param {string} props.variant - 'default' | 'success' | 'warning' | 'error' | 'info'
 * @param {string} props.size - 'small' | 'medium' | 'large'
 * @param {React.ReactNode} props.children
 */
export const Badge = ({
  variant = 'default',
  size = 'medium',
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center rounded-full font-medium';
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };
  
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-2.5 py-0.5 text-xs',
    large: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};


