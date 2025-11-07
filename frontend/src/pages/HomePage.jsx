import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

const HomePage = () => {
  const navigate = useNavigate();
  const { theme } = useApp();

  return (
    <div className={`min-h-screen ${theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'}`}>
      {/* Hero Section */}
      <section className={`hero py-20 ${
        theme === 'day-mode' 
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50' 
          : 'bg-gradient-to-br from-gray-800 to-gray-900'
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
            <p
              className="subtitle text-xl mb-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              Create, manage, and publish educational content with AI assistance
            </p>
            <p
              className="text-lg mb-8"
              style={{ color: 'var(--text-muted)' }}
            >
              Transform your teaching with intelligent content generation,
              interactive lessons, and automated workflows
            </p>
          </div>

          {/* Action Buttons */}
          <div
            className="hero-actions flex gap-6 justify-center flex-wrap"
            style={{ marginTop: 'var(--spacing-xl)' }}
          >
            <button
              onClick={() => navigate('/courses')}
              className="btn btn-primary"
              style={{
                background: 'var(--gradient-primary)',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
                padding: 'var(--spacing-md) var(--spacing-xl)',
                borderRadius: '12px',
                border: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = 'var(--shadow-hover)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'var(--shadow-glow)';
              }}
            >
              <i className="fas fa-graduation-cap mr-2"></i>
              Browse Courses
            </button>
            <button
              onClick={() => navigate('/topics')}
              className="btn btn-secondary"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '2px solid var(--primary-cyan)',
                padding: 'var(--spacing-md) var(--spacing-xl)',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.target.style.background = 'var(--gradient-primary)';
                e.target.style.color = 'white';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = 'var(--shadow-hover)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'transparent';
                e.target.style.color = 'var(--text-primary)';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <i className="fas fa-book mr-2"></i>
              View Lessons
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        className={`microservices-section py-20 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-gray-900'
        }`}
      >
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
          <div
            className="microservices-grid grid grid-cols-1 md:grid-cols-3 gap-6"
            style={{ marginTop: 'var(--spacing-2xl)' }}
          >
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
                  background: 'var(--gradient-card)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: 'var(--spacing-xl)',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-card)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                  e.currentTarget.style.borderColor = 'var(--primary-cyan)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {/* Hover Effect Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'var(--gradient-primary)',
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
                      color: 'var(--text-primary)',
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
                      color: 'var(--text-secondary)',
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

