import React from 'react';
import { useApp } from '../../context/AppContext.jsx';

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
  const { theme } = useApp();
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium mb-1 ${
            theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
          }`}
        >
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
          error 
            ? 'border-red-600' 
            : theme === 'day-mode' 
              ? 'border-gray-300 bg-white text-gray-900' 
              : 'border-gray-600 bg-gray-700 text-white'
        } ${className}`}
        placeholder={props.placeholder}
        style={{
          ...(theme === 'day-mode' 
            ? {} 
            : { 
                color: '#ffffff',
                backgroundColor: '#374151',
                borderColor: '#4b5563'
              }
          )
        }}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className={`mt-1 text-sm ${
            theme === 'day-mode' ? 'text-red-600' : 'text-red-400'
          }`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};


