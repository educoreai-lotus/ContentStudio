import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

// AI & Human Collaboration Illustration Component
const AiHumanCollabIllustration = ({ isDark }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const stroke = isDark ? '#e2e8f0' : '#0f172a';
  const accent = isDark ? '#34d399' : '#059669';
  const surface = isDark ? '#020617' : '#f8fafc';

  useEffect(() => {
    // Stroke drawing animation on mount
    const paths = svgRef.current?.querySelectorAll('path, line, rect, circle, ellipse, polygon');
    if (paths && paths.length > 0) {
      paths.forEach((element, index) => {
        const length = element.getTotalLength ? element.getTotalLength() : 0;
        if (length > 0) {
          element.style.strokeDasharray = length;
          element.style.strokeDashoffset = length;
          element.style.animation = `drawStroke 1.2s ease-out ${index * 0.05}s forwards`;
        } else {
          // For elements without path length, use fade-in
          element.style.opacity = '0';
          element.style.animation = `fadeIn 0.6s ease-out ${index * 0.05}s forwards`;
        }
      });
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="mt-12 mb-10 flex justify-center"
      style={{
        animation: 'fadeInUp 0.8s ease-out',
      }}
    >
      <div
        className={[
          'w-full max-w-3xl rounded-3xl border px-6 py-6 md:px-10 md:py-8',
          'shadow-lg shadow-emerald-900/10 backdrop-blur transition-all duration-300',
          isDark
            ? 'bg-slate-900/70 border-emerald-500/30 hover:border-emerald-500/50'
            : 'bg-white/90 border-emerald-500/15 hover:border-emerald-500/30',
        ].join(' ')}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02) translateY(-4px)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 20px 40px rgba(6, 95, 70, 0.25)'
            : '0 20px 40px rgba(16, 185, 129, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = isDark
            ? '0 10px 20px rgba(6, 95, 70, 0.1)'
            : '0 10px 20px rgba(16, 185, 129, 0.08)';
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 800 260"
          className="w-full h-auto"
          style={{
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
          }}
        >
          <defs>
            <linearGradient id="paperGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={isDark ? '#020617' : '#ffffff'} />
              <stop offset="100%" stopColor={isDark ? '#020617' : '#e2f3f0'} />
            </linearGradient>

            <linearGradient id="penGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>

            <style>{`
              @keyframes drawStroke {
                to {
                  stroke-dashoffset: 0;
                }
              }
              @keyframes fadeIn {
                to {
                  opacity: 1;
                }
              }
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
              @keyframes pulse {
                0%, 100% {
                  opacity: 0.45;
                }
                50% {
                  opacity: 0.65;
                }
              }
            `}</style>
          </defs>

          {/* עדין רקע */}
          <rect
            x="20"
            y="20"
            width="760"
            height="220"
            rx="32"
            fill={isDark ? '#020617' : '#ecfdf5'}
            opacity={0.85}
          />

          {/* דף עבודה במרכז */}
          <rect
            x="210"
            y="70"
            width="380"
            height="140"
            rx="18"
            fill="url(#paperGradient)"
            stroke={isDark ? '#22c55e33' : '#0f172a10'}
            strokeWidth="1.5"
          />
          {/* שורות על הדף */}
          {[0, 1, 2, 3].map((row) => (
            <line
              key={row}
              x1="235"
              x2="560"
              y1={110 + row * 22}
              y2={110 + row * 22}
              stroke={row === 0 ? accent : stroke}
              strokeWidth={row === 0 ? 2 : 1.1}
              strokeLinecap="round"
              opacity={row === 0 ? 0.95 : 0.4}
              style={{
                strokeDasharray: row === 0 ? 'none' : '3 3',
                animation: row === 0 
                  ? `drawStroke 1.5s ease-out ${0.8 + row * 0.1}s forwards`
                  : `fadeIn 0.8s ease-out ${1.2 + row * 0.1}s forwards`,
              }}
            />
          ))}

          {/* הילה סביב נקודת המפגש */}
          <circle
            cx="400"
            cy="155"
            r="38"
            fill="url(#glow)"
            style={{
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />

          {/* עט – באמצע, מוחזק ע"י שתיהן */}
          <g 
            transform="translate(400 155) rotate(-15)"
            style={{
              transition: 'transform 0.3s ease',
            }}
          >
            {/* גוף העט */}
            <rect
              x="-90"
              y="-3.5"
              width="180"
              height="7"
              rx="3.5"
              fill="url(#penGradient)"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              }}
            />
            {/* קצה העט */}
            <polygon
              points="90,-4 108,0 90,4"
              fill={stroke}
              opacity="0.9"
            />
            {/* טבעת קטנה באמצע (נקודת חיבור הידיים) */}
            <circle
              cx="0"
              cy="0"
              r="7"
              fill={surface}
              stroke={accent}
              strokeWidth="2"
              style={{
                filter: `drop-shadow(0 0 8px ${accent}40)`,
              }}
            />
          </g>

          {/* ✋ יד אנושית – משמאל, מעוצבת יפה */}
          <g 
            transform="translate(210 150)"
            style={{
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(210, 150) scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(210, 150) scale(1)';
            }}
          >
            {/* כף היד - בסיס */}
            <ellipse
              cx="-50"
              cy="15"
              rx="22"
              ry="18"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="2"
              opacity="0.95"
            />
            
            {/* פרק כף היד - חלק עליון */}
            <path
              d="M -72 20 Q -80 10 -85 0 Q -88 -10 -85 -20 Q -82 -28 -75 -32 Q -68 -35 -60 -32 Q -55 -30 -52 -25"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* אצבע קטנה (Pinky) */}
            <path
              d="M -40 -8 Q -45 -18 -48 -25 Q -50 -30 -48 -35 Q -46 -38 -42 -36"
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <ellipse
              cx="-42"
              cy="-36"
              rx="3"
              ry="4"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="1.5"
            />
            
            {/* אצבע טבעת (Ring) */}
            <path
              d="M -35 -2 Q -40 -12 -43 -20 Q -45 -26 -43 -32 Q -41 -36 -37 -34"
              fill="none"
              stroke={stroke}
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <ellipse
              cx="-37"
              cy="-34"
              rx="3.5"
              ry="4.5"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="1.5"
            />
            
            {/* אצבע אמצעית (Middle) */}
            <path
              d="M -30 2 Q -35 -8 -38 -16 Q -40 -22 -38 -28 Q -36 -32 -32 -30"
              fill="none"
              stroke={stroke}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <ellipse
              cx="-32"
              cy="-30"
              rx="4"
              ry="5"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="1.5"
            />
            
            {/* אצבע מורה (Index) */}
            <path
              d="M -25 5 Q -30 -5 -33 -13 Q -35 -19 -33 -25 Q -31 -29 -27 -27"
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <ellipse
              cx="-27"
              cy="-27"
              rx="3.5"
              ry="4.5"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="1.5"
            />
            
            {/* אגודל - מעוצב יפה */}
            <path
              d="M -50 20 Q -45 25 -38 28 Q -30 30 -22 28 Q -15 25 -10 18 Q -8 12 -10 6 Q -12 0 -15 -3"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <ellipse
              cx="-15"
              cy="-3"
              rx="4"
              ry="5"
              fill="#f4c7a1"
              stroke={stroke}
              strokeWidth="1.5"
            />
            
            {/* קווי כף היד - פרטים */}
            <path
              d="M -55 10 Q -58 5 -60 0"
              fill="none"
              stroke={stroke}
              strokeWidth="1"
              opacity="0.4"
            />
            <path
              d="M -45 12 Q -48 7 -50 2"
              fill="none"
              stroke={stroke}
              strokeWidth="1"
              opacity="0.4"
            />
            
            {/* חיבור לעט - חלק עליון */}
            <path
              d="M -20 8 Q -10 2 0 -5"
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* 🤖 יד רובוטית – מימין, מכנית מקצועית */}
          <g 
            transform="translate(590 150)"
            style={{
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(590, 150) scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(590, 150) scale(1)';
            }}
          >
            {/* בסיס מכני - מעוצב יפה */}
            <rect
              x="15"
              y="8"
              width="70"
              height="30"
              rx="10"
              fill={isDark ? '#0f172a' : '#e5f9f3'}
              stroke={accent}
              strokeWidth="2"
            />
            {/* קווי חיבור פנימיים */}
            <line
              x1="25"
              y1="23"
              x2="75"
              y2="23"
              stroke={accent}
              strokeWidth="1.5"
              opacity="0.3"
            />
            {/* נורות LED */}
            <circle
              cx="30"
              cy="23"
              r="3.5"
              fill={accent}
              opacity={0.9}
              style={{
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: '0s',
                filter: `drop-shadow(0 0 4px ${accent})`,
              }}
            />
            <circle
              cx="50"
              cy="23"
              r="3.5"
              fill={accent}
              opacity={0.7}
              style={{
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: '0.3s',
                filter: `drop-shadow(0 0 4px ${accent})`,
              }}
            />
            <circle
              cx="70"
              cy="23"
              r="3.5"
              fill={accent}
              opacity={0.5}
              style={{
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: '0.6s',
                filter: `drop-shadow(0 0 4px ${accent})`,
              }}
            />
            
            {/* זרוע עליונה - מקטע ראשון */}
            <rect
              x="15"
              y="20"
              width="12"
              height="6"
              rx="3"
              fill={isDark ? '#1e293b' : '#d1fae5'}
              stroke={accent}
              strokeWidth="1.5"
            />
            <line
              x1="15"
              y1="23"
              x2="-8"
              y2="12"
              stroke={stroke}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            
            {/* מפרק ראשון */}
            <circle
              cx="-8"
              cy="12"
              r="6"
              fill={surface}
              stroke={accent}
              strokeWidth="2"
            />
            <circle
              cx="-8"
              cy="12"
              r="3"
              fill={accent}
              opacity="0.3"
            />
            
            {/* זרוע תחתונה - מקטע שני */}
            <rect
              x="-15"
              y="8"
              width="10"
              height="5"
              rx="2.5"
              fill={isDark ? '#1e293b' : '#d1fae5'}
              stroke={accent}
              strokeWidth="1.5"
            />
            <line
              x1="-8"
              y1="12"
              x2="-32"
              y2="0"
              stroke={stroke}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            
            {/* מפרק שני */}
            <circle
              cx="-32"
              cy="0"
              r="6"
              fill={surface}
              stroke={accent}
              strokeWidth="2"
            />
            <circle
              cx="-32"
              cy="0"
              r="3"
              fill={accent}
              opacity="0.3"
            />
            
            {/* כף יד רובוטית - מעוצבת יפה */}
            <rect
              x="-50"
              y="-20"
              width="28"
              height="14"
              rx="5"
              fill={surface}
              stroke={stroke}
              strokeWidth="2.5"
            />
            {/* קווי חיבור בכף היד */}
            <line
              x1="-48"
              y1="-13"
              x2="-24"
              y2="-13"
              stroke={accent}
              strokeWidth="1"
              opacity="0.4"
            />
            
            {/* אצבע 1 - מעוצבת */}
            <g>
              <rect
                x="-48"
                y="-18"
                width="6"
                height="12"
                rx="3"
                fill={surface}
                stroke={stroke}
                strokeWidth="1.8"
              />
              <line
                x1="-45"
                y1="-12"
                x2="-18"
                y2="-22"
                stroke={stroke}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle
                cx="-18"
                cy="-22"
                r="3"
                fill={surface}
                stroke={accent}
                strokeWidth="1.5"
              />
            </g>
            
            {/* אצבע 2 */}
            <g>
              <rect
                x="-42"
                y="-16"
                width="6"
                height="10"
                rx="3"
                fill={surface}
                stroke={stroke}
                strokeWidth="1.8"
              />
              <line
                x1="-39"
                y1="-10"
                x2="-20"
                y2="-18"
                stroke={stroke}
                strokeWidth="2.3"
                strokeLinecap="round"
              />
              <circle
                cx="-20"
                cy="-18"
                r="2.5"
                fill={surface}
                stroke={accent}
                strokeWidth="1.5"
              />
            </g>
            
            {/* אצבע 3 - אמצעית */}
            <g>
              <rect
                x="-36"
                y="-14"
                width="6"
                height="8"
                rx="3"
                fill={surface}
                stroke={stroke}
                strokeWidth="1.8"
              />
              <line
                x1="-33"
                y1="-8"
                x2="-22"
                y2="-14"
                stroke={stroke}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle
                cx="-22"
                cy="-14"
                r="3"
                fill={surface}
                stroke={accent}
                strokeWidth="1.5"
              />
            </g>
            
            {/* אצבע 4 */}
            <g>
              <rect
                x="-30"
                y="-12"
                width="5"
                height="6"
                rx="2.5"
                fill={surface}
                stroke={stroke}
                strokeWidth="1.8"
              />
              <line
                x1="-27.5"
                y1="-6"
                x2="-24"
                y2="-10"
                stroke={stroke}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="-24"
                cy="-10"
                r="2"
                fill={surface}
                stroke={accent}
                strokeWidth="1.5"
              />
            </g>
            
            {/* אגודל רובוטי - מתחת לעט */}
            <g>
              <rect
                x="-38"
                y="-8"
                width="8"
                height="6"
                rx="3"
                fill={surface}
                stroke={accent}
                strokeWidth="2"
              />
              <line
                x1="-34"
                y1="-4"
                x2="-16"
                y2="4"
                stroke={accent}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <circle
                cx="-16"
                cy="4"
                r="3.5"
                fill={surface}
                stroke={accent}
                strokeWidth="2"
                style={{
                  filter: `drop-shadow(0 0 6px ${accent}60)`,
                }}
              />
            </g>
          </g>

          {/* קו "שולחן" עדין מתחת לדף */}
          <line
            x1="120"
            x2="680"
            y1="210"
            y2="210"
            stroke={isDark ? '#0f172a' : '#cbd5e1'}
            strokeWidth="1.2"
            opacity={0.7}
          />
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
                icon: 'fa-cogs',
                title: 'Smart Management',
                text: 'Organize courses, track progress, and manage educational resources efficiently.',
              },
            ].map(({ icon, title, text }, i) => (
              <div
                key={i}
                className="microservice-card"
                style={{
                  background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'var(--gradient-card)',
                  border: isDark ? '1px solid rgba(45, 212, 191, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: 'var(--spacing-xl)',
                  textAlign: 'center',
                  boxShadow: isDark ? '0 12px 40px rgba(6, 95, 70, 0.18)' : 'var(--shadow-card)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 18px 45px rgba(6, 95, 70, 0.28)'
                    : 'var(--shadow-hover)';
                  e.currentTarget.style.borderColor = 'var(--primary-cyan)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 12px 40px rgba(6, 95, 70, 0.18)'
                    : 'var(--shadow-card)';
                  e.currentTarget.style.borderColor = isDark
                    ? 'rgba(45, 212, 191, 0.25)'
                    : 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: isDark ? 'linear-gradient(135deg, rgba(6, 95, 70, 0.55), rgba(15, 118, 110, 0.35))' : 'var(--gradient-primary)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    borderRadius: '16px',
                  }}
                ></div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    className="service-icon"
                    style={{
                      background: 'var(--gradient-primary)',
                      width: '70px',
                      height: '70px',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto var(--spacing-lg)',
                      fontSize: '1.8rem',
                      color: 'white',
                      boxShadow: '0 8px 25px rgba(6, 95, 70, 0.3)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <i className={`fas ${icon}`}></i>
                  </div>
                  <h3
                    className="text-lg font-semibold mb-3"
                    style={{
                      color: isDark ? 'rgba(241, 245, 249, 0.95)' : 'var(--text-primary)',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      marginBottom: 'var(--spacing-md)',
                      textAlign: 'center',
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    className="text-sm"
                    style={{
                      color: isDark ? 'rgba(203, 213, 225, 0.85)' : 'var(--text-secondary)',
                      fontSize: '0.95rem',
                      lineHeight: '1.6',
                      fontWeight: '500',
                      textAlign: 'center',
                    }}
                  >
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

