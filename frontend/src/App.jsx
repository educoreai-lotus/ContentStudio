import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AccessDeniedPage from './pages/AccessDeniedPage.jsx';
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
  
  // Calculate margin-left for main content based on sidebar state (desktop only - mobile uses overlay)
  // Add extra space for the toggle button (40px button + 16px gap = 56px) so content doesn't overlap
  const mainContentMargin = sidebarState.isOpen
    ? sidebarState.isCollapsed
      ? 'md:ml-30' // 64px sidebar + 56px (40px button + 16px gap) = 120px
      : 'md:ml-[344px]' // 288px sidebar + 56px (40px button + 16px gap) = 344px
    : '';
  
  return (
    <>
      <Router>
        <div className="min-h-screen overflow-x-hidden transition-colors duration-300 bg-[#f8fafc] dark:bg-[#1e293b] text-gray-900 dark:text-[#f8fafc]" dir="ltr">
            <Header />
            <SharedSidebar />
            <div className={`pt-20 transition-all duration-300 ${mainContentMargin}`}>
              <Routes>
                <Route path="/access-denied" element={<AccessDeniedPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <HomePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses"
                  element={
                    <ProtectedRoute>
                      <CourseList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/new"
                  element={
                    <ProtectedRoute>
                      <CourseForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:id"
                  element={
                    <ProtectedRoute>
                      <CourseDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:id/edit"
                  element={
                    <ProtectedRoute>
                      <CourseForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics"
                  element={
                    <ProtectedRoute>
                      <TopicList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lessons"
                  element={
                    <ProtectedRoute>
                      <TopicList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/new"
                  element={
                    <ProtectedRoute>
                      <TopicForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:id/edit"
                  element={
                    <ProtectedRoute>
                      <TopicForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:topicId/content/new"
                  element={
                    <ProtectedRoute>
                      <ManualContentForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:topicId/content/manual-create"
                  element={
                    <ProtectedRoute>
                      <ManualContentForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:topicId/content/ai-generate"
                  element={
                    <ProtectedRoute>
                      <AIContentForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:topicId/content/preview"
                  element={
                    <ProtectedRoute>
                      <AIContentPreview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:topicId/content/view"
                  element={
                    <ProtectedRoute>
                      <ContentViewer />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics/:topicId/content"
                  element={
                    <ProtectedRoute>
                      <TopicContentManager />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lessons/:topicId/view"
                  element={
                    <ProtectedRoute>
                      <LessonView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lessons/:topicId/language"
                  element={
                    <ProtectedRoute>
                      <LessonViewWithLanguage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/languages/stats"
                  element={
                    <ProtectedRoute>
                      <LanguageStatsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <SearchResults />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/templates"
                  element={
                    <ProtectedRoute>
                      <TemplateList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/templates/new"
                  element={
                    <ProtectedRoute>
                      <TemplateForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/templates/:id/edit"
                  element={
                    <ProtectedRoute>
                      <TemplateForm />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </div>
        </Router>
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppProvider>
  );
}

export default App;
