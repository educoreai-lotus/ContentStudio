import React from 'react';

/**
 * Input Component
 * @param {Object} props
 * @param {string} props.label
 * @param {boolean} props.required
 * @param {string} props.error
 */
export const Input = ({
  label,
  error,
  required = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium mb-1 text-gray-700 dark:text-[#f8fafc]"
        >
          {label}
          {required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors ${
          error 
            ? 'border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200' 
            : 'border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1e293b] text-gray-900 dark:text-[#f8fafc] placeholder-gray-500 dark:placeholder-[#94a3b8]'
        } ${className}`}
        placeholder={props.placeholder}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};


