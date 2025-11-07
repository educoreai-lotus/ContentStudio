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
  const baseClasses = 'bg-white border rounded-lg shadow-sm p-6';
  const hoverClasses = hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : '';
  const selectedClasses = selected ? 'border-blue-600 border-2' : 'border-gray-200';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${selectedClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};


