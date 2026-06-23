import React from 'react';
import { useApp } from '../context/AppContext.jsx';

const AccessDeniedPage = () => {
  const { theme } = useApp();
  const isDark = theme !== 'day-mode';

  return (
    <div
      className={`min-h-[60vh] flex items-center justify-center px-4 ${
        isDark ? 'text-slate-100' : 'text-gray-900'
      }`}
    >
      <div
        className={`max-w-xl w-full rounded-xl border p-8 text-center ${
          isDark
            ? 'bg-slate-800/60 border-white/10'
            : 'bg-white border-gray-200 shadow-sm'
        }`}
      >
        <h1 className="text-2xl font-bold mb-3">Access denied</h1>
        <p className={isDark ? 'text-slate-300' : 'text-gray-600'}>
          Content Studio is available only to authenticated trainers. Open Content Studio from
          Directory using your trainer account.
        </p>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
