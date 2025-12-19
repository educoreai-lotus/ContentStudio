import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Header from './components/Header.jsx';
import { SharedSidebar } from './components/SharedSidebar.jsx';
import HomePage from './pages/HomePage.jsx';
import { CourseList } from './pages/Courses/CourseList.jsx';
import { CourseForm } from './pages/Courses/CourseForm.jsx';
import { CourseDetail } from './pages/Courses/CourseDetail.jsx';
import { TopicList } from './pages/Topics/TopicList.jsx';
import { TopicForm } from './pages/Topics/TopicForm.jsx';
import { ManualContentForm } from './pages/Content/ManualContentForm.jsx';
import { AIContentForm } from './pages/Content/AIContentForm.jsx';
import { AIContentPreview } from './pages/Content/AIContentPreview.jsx';
import { ContentViewer } from './pages/Content/ContentViewer.jsx';
import { SearchResults } from './pages/Search/SearchResults.jsx';
import { TemplateList } from './pages/Templates/TemplateList.jsx';
import { TemplateForm } from './pages/Templates/TemplateForm.jsx';
import LessonView from './pages/Lessons/LessonView.jsx';
import LessonViewWithLanguage from './pages/Lessons/LessonViewWithLanguage.jsx';
import TopicContentManager from './pages/Topics/TopicContentManager.jsx';
import LanguageStatsPage from './pages/Multilingual/LanguageStatsPage.jsx';

function AppContent() {
  const { theme, sidebarState } = useApp();
  
  // Calculate margin-left for main content based on sidebar state
  // Add extra space for the toggle button (40px button + 16px gap = 56px) so content doesn't overlap
  const mainContentMargin = sidebarState.isOpen
    ? sidebarState.isCollapsed
      ? 'ml-30' // 64px sidebar + 56px (40px button + 16px gap) = 120px
      : 'ml-[344px]' // 288px sidebar + 56px (40px button + 16px gap) = 344px
    : '';
  
  return (
    <>
      <Router>
        <div className="min-h-screen transition-colors duration-300 bg-[#f8fafc] dark:bg-[#1e293b] text-gray-900 dark:text-[#f8fafc]">
            <Header />
            <SharedSidebar />
            <div className={`pt-20 transition-all duration-300 ${mainContentMargin}`}>
              {/* Routes */}
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/courses" element={<CourseList />} />
                <Route path="/courses/new" element={<CourseForm />} />
                <Route path="/courses/:id" element={<CourseDetail />} />
                <Route path="/courses/:id/edit" element={<CourseForm />} />
            <Route path="/topics" element={<TopicList />} />
            <Route path="/lessons" element={<TopicList />} />
            <Route path="/topics/new" element={<TopicForm />} />
            <Route path="/topics/:id/edit" element={<TopicForm />} />
            <Route path="/topics/:topicId/content/new" element={<ManualContentForm />} />
            <Route path="/topics/:topicId/content/manual-create" element={<ManualContentForm />} />
            <Route path="/topics/:topicId/content/ai-generate" element={<AIContentForm />} />
            <Route path="/topics/:topicId/content/preview" element={<AIContentPreview />} />
            <Route path="/topics/:topicId/content/view" element={<ContentViewer />} />
            <Route path="/topics/:topicId/content" element={<TopicContentManager />} />
            <Route path="/lessons/:topicId/view" element={<LessonView />} />
            <Route path="/lessons/:topicId/language" element={<LessonViewWithLanguage />} />
            <Route path="/languages/stats" element={<LanguageStatsPage />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/templates" element={<TemplateList />} />
            <Route path="/templates/new" element={<TemplateForm />} />
            <Route path="/templates/:id/edit" element={<TemplateForm />} />
              </Routes>
            </div>
          </div>
        </Router>
        
        {/* RAG Bot Container - Floating widget for all pages (outside Router for proper positioning) */}
        <div 
          id="edu-bot-container" 
          style={{ 
            position: 'fixed', 
            bottom: '20px', 
            right: '20px', 
            zIndex: 99999,
            minWidth: '400px',
            minHeight: '400px',
            border: '2px solid red', // Temporary for debugging
            backgroundColor: 'rgba(255, 0, 0, 0.1)' // Temporary for debugging
          }}
        ></div>
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
