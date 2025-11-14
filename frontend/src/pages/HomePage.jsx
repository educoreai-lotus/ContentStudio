import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

const HomePage = () => {
  const navigate = useNavigate();
  const { theme } = useApp();
  const isDark = theme !== 'day-mode';

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] transition-colors duration-300">
      {/* Hero Section */}
      <section className="hero py-20 bg-[#e2e8f0] dark:bg-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hero-content text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight bg-gradient-to-r from-emerald-700 to-emerald-800 dark:from-emerald-600 dark:to-emerald-700 bg-clip-text text-transparent">
              Content Studio
            </h1>
            <p className="subtitle text-xl mb-8 text-gray-600 dark:text-[#cbd5e1]">
              Create, manage, and publish educational content with AI assistance
            </p>
            <p className="text-lg mb-8 text-gray-500 dark:text-[#94a3b8]">
              Transform your teaching with intelligent content generation,
              interactive lessons, and automated workflows
            </p>
          </div>

          {/* Action Buttons */}
          <div className="hero-actions flex gap-6 justify-center flex-wrap mt-8">
            <button
              onClick={() => navigate('/courses')}
              className="btn btn-primary px-6 py-3 rounded-xl text-lg font-semibold text-white border-none cursor-pointer transition-all duration-300 relative overflow-hidden bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-600 dark:to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 dark:hover:from-emerald-700 dark:hover:to-emerald-800 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <i className="fas fa-graduation-cap mr-2"></i>
              Browse Courses
            </button>
            <button
              onClick={() => navigate('/topics')}
              className="btn btn-secondary px-6 py-3 rounded-xl text-lg font-semibold cursor-pointer transition-all duration-300 relative overflow-hidden bg-transparent dark:bg-transparent text-gray-900 dark:text-[#f8fafc] border-2 border-teal-600 dark:border-white/20 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 dark:hover:from-emerald-600 dark:hover:to-emerald-700 hover:text-white hover:border-transparent hover:-translate-y-0.5 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <i className="fas fa-book mr-2"></i>
              View Lessons
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="microservices-section py-20 bg-[#e2e8f0] dark:bg-[#1e293b] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-center text-4xl font-bold mb-12 bg-gradient-to-r from-emerald-700 to-emerald-800 dark:from-emerald-600 dark:to-emerald-700 bg-clip-text text-transparent">
            Content Studio Features
          </h2>
          <div className="microservices-grid grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
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
                className="microservice-card rounded-2xl p-8 text-center cursor-pointer relative overflow-hidden backdrop-blur-sm transition-all duration-300 bg-white dark:bg-gradient-to-br dark:from-[#1e293b] dark:to-[#334155] border border-gray-200 dark:border-white/10 shadow-md dark:shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:-translate-y-2 hover:shadow-xl dark:hover:shadow-[0_20px_60px_rgba(13,148,136,0.3)] hover:border-emerald-500/50 dark:hover:border-emerald-500/50"
              >
                <div className="relative z-10">
                  <div className="service-icon w-[70px] h-[70px] rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl text-white bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-600 dark:to-emerald-700 shadow-lg">
                    <i className={`fas ${icon}`}></i>
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-[#f8fafc]">
                    {title}
                  </h3>
                  <p className="text-base leading-relaxed text-gray-600 dark:text-[#cbd5e1]">
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

