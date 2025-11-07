export const authMockData = {
  token: 'mock-content-studio-token',
  token_type: 'Bearer',
  expires_in: 3600,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  trainer: {
    trainer_id: 'trainer-maya-levi',
    full_name: 'Maya Levi',
    email: 'maya.levi@educore.ai',
    company_id: 'company-innovate-001',
    company_name: 'Innovate Learning Ltd.',
    preferred_language: 'he',
    locale: 'he-IL',
    avatar_url: 'https://cdn.educore.ai/avatars/maya-levi.png',
    roles: ['trainer', 'content_creator'],
    timezone: 'Asia/Jerusalem',
  },
  permissions: {
    can_create_courses: true,
    can_generate_content: true,
    can_manage_templates: true,
    can_publish_lessons: true,
    can_view_analytics: true,
  },
  features: {
    ai_generation_enabled: true,
    multilingual_support: true,
    template_workflows: true,
  },
  source: 'mock',
};


