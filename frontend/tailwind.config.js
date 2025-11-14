/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors
        'primary-blue': '#065f46',
        'primary-purple': '#047857',
        'primary-cyan': '#0f766e',
        'accent-gold': '#d97706',
        'accent-green': '#047857',
        'accent-orange': '#f59e0b',
        // Light mode backgrounds
        'bg-primary': '#f8fafc',
        'bg-secondary': '#e2e8f0',
        'bg-tertiary': '#cbd5e1',
        'bg-card': '#ffffff',
        // Light mode text
        'text-primary': '#1e293b',
        'text-secondary': '#475569',
        'text-muted': '#64748b',
        'text-accent': '#334155',
        // Dark mode backgrounds (from palette)
        'dark-bg-primary': '#0f172a',
        'dark-bg-secondary': '#1e293b',
        'dark-bg-tertiary': '#334155',
        'dark-bg-card': '#1e293b',
        // Dark mode text (from palette)
        'dark-text-primary': '#f8fafc',
        'dark-text-secondary': '#cbd5e1',
        'dark-text-muted': '#94a3b8',
        'dark-text-accent': '#e2e8f0',
        // Emerald brand (for gradients)
        emerald: {
          600: '#0d9488',
          700: '#059669',
        },
        // Utility colors
        'xp-color': '#f59e0b',
        'level-color': '#047857',
        'badge-color': '#10b981',
        'streak-color': '#ef4444',
      },
      backgroundImage: {
        // Light mode gradients
        'gradient-primary': 'linear-gradient(135deg, #065f46, #047857)',
        'gradient-secondary': 'linear-gradient(135deg, #0f766e, #047857)',
        'gradient-accent': 'linear-gradient(135deg, #d97706, #f59e0b)',
        'gradient-card': 'linear-gradient(145deg, #ffffff, #f0fdfa)',
        // Dark mode gradients (from palette)
        'gradient-primary-dark': 'linear-gradient(135deg, #0d9488, #059669)',
        'gradient-secondary-dark': 'linear-gradient(135deg, #14b8a6, #10b981)',
        'gradient-accent-dark': 'linear-gradient(135deg, #d97706, #f59e0b)',
        'gradient-card-dark': 'linear-gradient(145deg, #1e293b, #334155)',
      },
      boxShadow: {
        // Light mode shadows
        glow: '0 0 30px rgba(6, 95, 70, 0.3)',
        card: '0 10px 40px rgba(0, 0, 0, 0.1)',
        hover: '0 20px 60px rgba(6, 95, 70, 0.2)',
        // Dark mode shadows (from palette)
        'glow-dark': '0 0 30px rgba(13, 148, 136, 0.4)',
        'card-dark': '0 10px 40px rgba(0, 0, 0, 0.6)',
        'hover-dark': '0 20px 60px rgba(13, 148, 136, 0.3)',
      },
      fontFamily: {
        'space-grotesk': ['Space Grotesk', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      spacing: {
        'spacing-xs': '0.5rem',
        'spacing-sm': '0.75rem',
        'spacing-md': '1rem',
        'spacing-lg': '1.5rem',
        'spacing-xl': '2rem',
        'spacing-2xl': '3rem',
      },
    },
  },
  plugins: [],
};

