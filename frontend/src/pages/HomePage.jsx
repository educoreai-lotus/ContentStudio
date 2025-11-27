import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

// AI & Human Collaboration Illustration Component
// Abstract minimalist design: Two connected circles/elements representing Human + AI collaboration
const AiHumanCollabIllustration = ({ isDark }) => {
  const accent = isDark ? '#34d399' : '#059669'; // Emerald
  const accentLight = isDark ? '#6ee7b7' : '#10b981'; // Light emerald
  const accentGlow = isDark ? '#fbbf24' : '#f59e0b'; // Amber
  const stroke = isDark ? '#475569' : '#64748b';
  const bg = isDark ? '#1e293b' : '#ffffff';

  return (
    <div 
      className="mt-12 mb-10 flex justify-center"
      style={{
        animation: 'fadeInUp 0.8s ease-out',
      }}
    >
      <div
        className={[
          'w-full max-w-4xl rounded-3xl px-8 py-12 md:px-12 md:py-16',
          'transition-all duration-300',
          isDark ? 'bg-slate-900/50' : 'bg-white',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 800 300"
          className="w-full h-auto"
        >
          <defs>
            <linearGradient id="humanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={accentGlow} stopOpacity="0.2" />
              <stop offset="100%" stopColor={accentGlow} stopOpacity="0.05" />
            </linearGradient>
            <radialGradient id="connectionGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accentLight} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accentLight} stopOpacity="0" />
            </radialGradient>
            <style>{`
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes drawPath {
                from {
                  stroke-dashoffset: 500;
                }
                to {
                  stroke-dashoffset: 0;
                }
              }
              @keyframes pulse {
                0%, 100% {
                  opacity: 0.5;
                  transform: scale(1);
                }
                50% {
                  opacity: 0.8;
                  transform: scale(1.05);
                }
              }
              @keyframes rotate {
                from {
                  transform: rotate(0deg);
                }
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </defs>

          {/* Human Element - Left circle with creative symbol */}
          <g transform="translate(200, 150)" style={{ animation: 'fadeInUp 0.8s ease-out' }}>
            <circle
              cx="0"
              cy="0"
              r="60"
              fill="url(#humanGradient)"
              stroke={accent}
              strokeWidth="3"
            />
            {/* Creative symbol inside - lightbulb/idea */}
            <path
              d="M 0 -25 L -8 -15 L -5 -15 L -5 5 L 5 5 L 5 -15 L 8 -15 Z"
              fill={accent}
              opacity="0.6"
            />
            <circle cx="0" cy="10" r="8" fill={accent} opacity="0.4" />
            {/* Label */}
            <text
              x="0"
              y="90"
              textAnchor="middle"
              fill={isDark ? '#cbd5e1' : '#475569'}
              fontSize="16"
              fontWeight="600"
            >
              Human
            </text>
          </g>

          {/* Connection - flowing path between elements */}
          <g transform="translate(400, 150)">
            {/* Glow effect at center */}
            <circle
              cx="0"
              cy="0"
              r="40"
              fill="url(#connectionGlow)"
              style={{
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            {/* Flowing connection path */}
            <path
              d="M -200 0 Q 0 -30 200 0"
              fill="none"
              stroke={accentLight}
              strokeWidth="4"
              strokeDasharray="10 8"
              opacity="0.6"
              style={{
                animation: 'drawPath 1.5s ease-out 0.3s forwards',
                strokeDashoffset: 500,
              }}
            />
            {/* Plus symbol in center */}
            <line x1="-15" y1="0" x2="15" y2="0" stroke={accent} strokeWidth="3" strokeLinecap="round" />
            <line x1="0" y1="-15" x2="0" y2="15" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* AI Element - Right circle with tech symbol */}
          <g transform="translate(600, 150)" style={{ animation: 'fadeInUp 0.8s ease-out 0.4s both' }}>
            <circle
              cx="0"
              cy="0"
              r="60"
              fill="url(#aiGradient)"
              stroke={accentGlow}
              strokeWidth="3"
            />
            {/* Tech/AI symbol inside - circuit/neural network */}
            <g opacity="0.7">
              <circle cx="-15" cy="-15" r="4" fill={accentGlow} />
              <circle cx="15" cy="-15" r="4" fill={accentGlow} />
              <circle cx="0" cy="0" r="4" fill={accentGlow} />
              <circle cx="-15" cy="15" r="4" fill={accentGlow} />
              <circle cx="15" cy="15" r="4" fill={accentGlow} />
              <line x1="-15" y1="-15" x2="0" y2="0" stroke={accentGlow} strokeWidth="1.5" />
              <line x1="15" y1="-15" x2="0" y2="0" stroke={accentGlow} strokeWidth="1.5" />
              <line x1="-15" y1="15" x2="0" y2="0" stroke={accentGlow} strokeWidth="1.5" />
              <line x1="15" y1="15" x2="0" y2="0" stroke={accentGlow} strokeWidth="1.5" />
            </g>
            {/* Label */}
            <text
              x="0"
              y="90"
              textAnchor="middle"
              fill={isDark ? '#cbd5e1' : '#475569'}
              fontSize="16"
              fontWeight="600"
            >
              AI
            </text>
          </g>

          {/* Result/Collaboration - Center document/card */}
          <g transform="translate(400, 250)" style={{ animation: 'fadeInUp 0.8s ease-out 0.6s both' }}>
            <rect
              x="-80"
              y="-25"
              width="160"
              height="50"
              rx="8"
              fill={bg}
              stroke={accent}
              strokeWidth="2"
              opacity="0.9"
            />
            <line x1="-60" y1="0" x2="60" y2="0" stroke={accent} strokeWidth="1.5" opacity="0.4" />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fill={accent}
              fontSize="14"
              fontWeight="600"
            >
              Collaboration
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};



const HomePage = () => {
  const navigate = useNavigate();
  const { theme } = useApp();
  const isDark = theme !== 'day-mode';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#1e293b]' : 'bg-gray-50'} transition-colors duration-300`}>
      {/* Hero Section */}
      <section className={`hero py-20 ${
        isDark ? 'bg-[#1e293b]' : 'bg-gradient-to-br from-emerald-50 to-teal-50'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hero-content text-center">
            <h1
              className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Content Studio
            </h1>
            <p className="subtitle text-xl mb-8" style={{ color: isDark ? 'rgba(226, 232, 240, 0.8)' : 'var(--text-secondary)' }}>
              Create, manage, and publish educational content with AI assistance
            </p>
            <p className="text-lg mb-8" style={{ color: isDark ? 'rgba(148, 163, 184, 0.85)' : 'var(--text-muted)' }}>
              Transform your teaching with intelligent content generation,
              interactive lessons, and automated workflows
            </p>
          </div>

          {/* Action Buttons */}
          <div className="hero-actions flex gap-6 justify-center flex-wrap" style={{ marginTop: 'var(--spacing-xl)' }}>
            <button
              onClick={() => navigate('/courses')}
              className={`btn btn-primary px-6 py-3 rounded-xl text-lg font-semibold text-white border-none cursor-pointer transition-all duration-300 relative overflow-hidden ${
                isDark 
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:shadow-lg hover:-translate-y-0.5' 
                  : 'bg-gradient-to-r from-emerald-700 to-emerald-800 hover:shadow-lg hover:-translate-y-0.5'
              }`}
            >
              <i className="fas fa-graduation-cap mr-2"></i>
              Browse Courses
            </button>
            <button
              onClick={() => navigate('/topics')}
              className={`btn btn-secondary px-6 py-3 rounded-xl text-lg font-semibold cursor-pointer transition-all duration-300 relative overflow-hidden ${
                isDark 
                  ? 'bg-transparent text-slate-50 border-2 border-white/20 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 hover:text-white hover:border-transparent hover:-translate-y-0.5 hover:shadow-lg' 
                  : 'bg-transparent text-gray-900 border-2 border-teal-600 hover:bg-gradient-to-r hover:from-emerald-700 hover:to-emerald-800 hover:text-white hover:border-transparent hover:-translate-y-0.5 hover:shadow-lg'
              }`}
            >
              <i className="fas fa-book mr-2"></i>
              View Lessons
            </button>
          </div>

          <AiHumanCollabIllustration isDark={isDark} />
        </div>
      </section>

      {/* Features Section */}
      <section className={`microservices-section py-20 ${isDark ? 'bg-[#1e293b]' : 'bg-gray-50'} transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="section-title text-center text-4xl font-bold mb-12"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Content Studio Features
          </h2>
          <div className="microservices-grid grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginTop: 'var(--spacing-2xl)' }}>
            {[
              {
                icon: 'fa-robot',
                title: 'AI Content Generation',
                text: 'Generate educational content, quizzes, and interactive materials with advanced AI assistance.',
              },
              {
                icon: 'fa-video',
                title: 'Multi-Format Support',
                text: 'Create videos, presentations, mind maps, and interactive content in multiple formats.',
              },
              {
                icon: 'fa-language',
                title: 'Multilingual Support',
                text: 'Generate and manage content in multiple languages with automatic translation and localization.',
              },
              {
                icon: 'fa-chart-line',
                title: 'Analytics & Insights',
                text: 'Track content performance, learner engagement, and generate detailed analytics reports.',
              },
              {
                icon: 'fa-users',
                title: 'Collaborative Workspace',
                text: 'Work together with your team to create, review, and publish educational content efficiently.',
              },
              {
                icon: 'fa-shield-alt',
                title: 'Secure & Reliable',
                text: 'Enterprise-grade security with encrypted storage and reliable backup systems.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className={`feature-card p-6 rounded-xl border transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-800/50 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-slate-800/70'
                    : 'bg-white border-emerald-200 hover:border-emerald-400 hover:shadow-lg'
                }`}
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
                }}
              >
                <div
                  className="text-4xl mb-4"
                  style={{
                    color: isDark ? '#34d399' : '#059669',
                  }}
                >
                  <i className={`fas ${feature.icon}`}></i>
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
