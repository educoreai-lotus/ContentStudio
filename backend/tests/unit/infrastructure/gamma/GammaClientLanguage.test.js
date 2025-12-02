/**
 * Test suite for Gamma Client Language Support
 * Validates RTL/LTR detection, language rules injection, and translation prevention
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GammaClient, isRTL, normalizeLanguage, RTL_LANGUAGES, buildLanguageRules } from '../../../../src/infrastructure/gamma/GammaClient.js';

// Mock axios module - use module-level variables that are accessible
let mockAxiosPost;
let mockAxiosGet;

// Mock axios before importing GammaClient
// IMPORTANT: axios is imported as default, so we need to mock both default and named exports
jest.mock('axios', () => {
  // Create new mocks for each test run
  const mockPost = jest.fn();
  const mockGet = jest.fn();
  
  // Store references in module scope
  mockAxiosPost = mockPost;
  mockAxiosGet = mockGet;
  
  return {
    __esModule: true,
    default: {
      post: (...args) => mockPost(...args),
      get: (...args) => mockGet(...args),
    },
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
  };
});

// Get references to the mocked functions
const getMockAxiosPost = () => {
  if (!mockAxiosPost) {
    throw new Error('mockAxiosPost not initialized - jest.mock may not have run');
  }
  return mockAxiosPost;
};

const getMockAxiosGet = () => {
  if (!mockAxiosGet) {
    throw new Error('mockAxiosGet not initialized - jest.mock may not have run');
  }
  return mockAxiosGet;
};

describe('GammaClient Language Support', () => {
  let gammaClient;
  let mockStorageClient;

  beforeEach(() => {
    // Reset mocks FIRST - before creating new client
    jest.clearAllMocks();
    
    // Setup default mocks BEFORE creating client
    // IMPORTANT: Set up mocks BEFORE any async operations
    const mockPost = getMockAxiosPost();
    const mockGet = getMockAxiosGet();
    
    mockPost.mockResolvedValue({
      data: {
        generationId: 'test-generation-id',
      },
    });

    mockGet
      .mockResolvedValueOnce({
        data: {
          status: 'completed',
          result: {
            exportUrl: 'https://gamma.app/export/test.pptx',
            gammaUrl: 'https://gamma.app/test',
          },
        },
      })
      .mockResolvedValueOnce({
        data: Buffer.from('fake-pptx-content'),
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        },
      });
    
    // Mock storage client
    mockStorageClient = {
      isConfigured: jest.fn(() => true),
      uploadFile: jest.fn().mockResolvedValue({
        url: 'https://storage.supabase.co/presentations/test.pptx',
        path: 'presentations/test.pptx',
      }),
    };

    // Create client AFTER mocks are set up
    gammaClient = new GammaClient({
      apiKey: 'test-api-key',
      storageClient: mockStorageClient,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RTL Language Detection', () => {
    it('should detect RTL languages correctly', () => {
      expect(isRTL('ar')).toBe(true);
      expect(isRTL('he')).toBe(true);
      expect(isRTL('fa')).toBe(true);
      expect(isRTL('ur')).toBe(true);
      expect(isRTL('he-IL')).toBe(true);
      expect(isRTL('ar-SA')).toBe(true);
      expect(isRTL('fa-IR')).toBe(true);
    });

    it('should detect LTR languages correctly', () => {
      expect(isRTL('en')).toBe(false);
      expect(isRTL('es')).toBe(false);
      expect(isRTL('fr')).toBe(false);
      expect(isRTL('de')).toBe(false);
      expect(isRTL('it')).toBe(false);
      expect(isRTL('ja')).toBe(false);
      expect(isRTL('zh')).toBe(false);
      expect(isRTL('ko')).toBe(false);
    });

    it('should handle case-insensitive language codes', () => {
      expect(isRTL('AR')).toBe(true);
      expect(isRTL('He')).toBe(true);
      expect(isRTL('FA')).toBe(true);
      expect(isRTL('EN')).toBe(false);
    });

    it('should handle unknown languages as LTR', () => {
      expect(isRTL('xx')).toBe(false);
      expect(isRTL('unknown')).toBe(false);
      expect(isRTL(null)).toBe(false);
      expect(isRTL('')).toBe(false);
    });
  });

  describe('Language Normalization', () => {
    it('should normalize common language variants', () => {
      expect(normalizeLanguage('en')).toBe('en');
      expect(normalizeLanguage('English')).toBe('en');
      expect(normalizeLanguage('EN-US')).toBe('en');
      expect(normalizeLanguage('ar')).toBe('ar');
      expect(normalizeLanguage('Arabic')).toBe('ar');
      expect(normalizeLanguage('he-IL')).toBe('he');
      expect(normalizeLanguage('Hebrew')).toBe('he');
      expect(normalizeLanguage('fa')).toBe('fa');
      expect(normalizeLanguage('Persian')).toBe('fa');
      expect(normalizeLanguage('ur')).toBe('ur');
      expect(normalizeLanguage('Urdu')).toBe('ur');
    });

    it('should normalize LTR languages', () => {
      expect(normalizeLanguage('es')).toBe('es');
      expect(normalizeLanguage('Spanish')).toBe('es');
      expect(normalizeLanguage('fr')).toBe('fr');
      expect(normalizeLanguage('French')).toBe('fr');
      expect(normalizeLanguage('de')).toBe('de');
      expect(normalizeLanguage('German')).toBe('de');
      expect(normalizeLanguage('it')).toBe('it');
      expect(normalizeLanguage('Italian')).toBe('it');
      expect(normalizeLanguage('ja')).toBe('ja');
      expect(normalizeLanguage('Japanese')).toBe('ja');
      expect(normalizeLanguage('zh')).toBe('zh');
      expect(normalizeLanguage('Chinese')).toBe('zh');
      expect(normalizeLanguage('ko')).toBe('ko');
      expect(normalizeLanguage('Korean')).toBe('ko');
    });

    it('should default to English for unknown languages', () => {
      expect(normalizeLanguage('xx')).toBe('xx'); // 2-3 char codes used directly
      expect(normalizeLanguage('unknown-language-code')).toBe('en');
      expect(normalizeLanguage(null)).toBe('en');
      expect(normalizeLanguage('')).toBe('en');
    });
  });

  describe('Language Rules Building', () => {
    it('should build language rules for RTL languages', () => {
      const rules = buildLanguageRules('he');
      
      expect(rules).toContain('IMPORTANT — LANGUAGE RULES');
      expect(rules).toContain('Do NOT translate the text');
      expect(rules).toContain('RIGHT-TO-LEFT');
      expect(rules).toContain('he');
    });

    it('should build language rules for LTR languages', () => {
      const rules = buildLanguageRules('en');
      
      expect(rules).toContain('IMPORTANT — LANGUAGE RULES');
      expect(rules).toContain('Do NOT translate the text');
      expect(rules).toContain('LEFT-TO-RIGHT');
      expect(rules).toContain('en');
    });
  });

  describe('Language Rules Injection (Integration)', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      
      // Setup default successful API responses for all integration tests
      // IMPORTANT: Set up mocks BEFORE any async operations
      const mockPost = getMockAxiosPost();
      const mockGet = getMockAxiosGet();
      
      mockPost.mockResolvedValue({
        data: { generationId: 'test-id' },
      });
      mockGet
        .mockResolvedValueOnce({
          data: { status: 'completed', result: { exportUrl: 'https://test.com/file.pptx' } },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('test'),
          headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
        });
    });

    it('should inject language rules for RTL languages', async () => {
      const inputText = 'This is the trainer content. Do not translate.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'he',
        audience: 'students',
      });

      // Verify mock was called
      const mockPost = getMockAxiosPost();
      expect(mockPost).toHaveBeenCalled();
      
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      // Verify language rules are injected
      expect(sentText).toContain('IMPORTANT — LANGUAGE RULES');
      expect(sentText).toContain('Do NOT translate the text');
      expect(sentText).toContain('RIGHT-TO-LEFT');
      expect(sentText).toContain('he');
      expect(sentText).toContain(inputText); // Original content preserved
    });

    it('should inject language rules for LTR languages', async () => {
      const inputText = 'This is the trainer content. Do not translate.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'en',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      // Verify language rules are injected
      expect(sentText).toContain('IMPORTANT — LANGUAGE RULES');
      expect(sentText).toContain('Do NOT translate the text');
      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('en');
      expect(sentText).toContain(inputText); // Original content preserved
    });

    it('should inject language rules for Arabic (RTL)', async () => {
      const inputText = 'هذا هو محتوى المدرب. لا تترجم.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'ar',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('RIGHT-TO-LEFT');
      expect(sentText).toContain('ar');
      expect(sentText).toContain(inputText); // Original Arabic content preserved
    });

    it('should inject language rules for Hebrew (RTL)', async () => {
      const inputText = 'זהו תוכן המאמן. אל תתרגם.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'he',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('RIGHT-TO-LEFT');
      expect(sentText).toContain('he');
      expect(sentText).toContain(inputText); // Original Hebrew content preserved
    });

    it('should inject language rules for Persian/Farsi (RTL)', async () => {
      const inputText = 'این محتوای مربی است. ترجمه نکنید.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'fa',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('RIGHT-TO-LEFT');
      expect(sentText).toContain('fa');
      expect(sentText).toContain(inputText); // Original Persian content preserved
    });

    it('should inject language rules for Urdu (RTL)', async () => {
      const inputText = 'یہ ٹرینر کا مواد ہے۔ ترجمہ نہ کریں۔';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'ur',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('RIGHT-TO-LEFT');
      expect(sentText).toContain('ur');
      expect(sentText).toContain(inputText); // Original Urdu content preserved
    });

    it('should inject language rules for Spanish (LTR)', async () => {
      const inputText = 'Este es el contenido del entrenador. No traduzcas.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'es',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('es');
      expect(sentText).toContain(inputText); // Original Spanish content preserved
    });

    it('should inject language rules for French (LTR)', async () => {
      const inputText = 'Ceci est le contenu du formateur. Ne traduisez pas.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'fr',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('fr');
      expect(sentText).toContain(inputText); // Original French content preserved
    });

    it('should inject language rules for Japanese (LTR)', async () => {
      const inputText = 'これはトレーナーのコンテンツです。翻訳しないでください。';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'ja',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('ja');
      expect(sentText).toContain(inputText); // Original Japanese content preserved
    });

    it('should inject language rules for Chinese (LTR)', async () => {
      const inputText = '这是培训师的内容。不要翻译。';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'zh',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('zh');
      expect(sentText).toContain(inputText); // Original Chinese content preserved
    });

    it('should inject language rules for Korean (LTR)', async () => {
      const inputText = '이것은 트레이너 콘텐츠입니다. 번역하지 마세요.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'ko',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('ko');
      expect(sentText).toContain(inputText); // Original Korean content preserved
    });

    it('should inject language rules for unknown languages (defaults to LTR)', async () => {
      const inputText = 'This is the trainer content.';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test Topic',
        language: 'xx',
        audience: 'students',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('LEFT-TO-RIGHT');
      expect(sentText).toContain('xx');
      expect(sentText).toContain(inputText); // Original content preserved
    });
  });

  describe('Content Preservation (No Translation)', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      
      // Setup default successful API responses
      // IMPORTANT: Set up mocks BEFORE any async operations
      const mockPost = getMockAxiosPost();
      const mockGet = getMockAxiosGet();
      
      mockPost.mockResolvedValue({
        data: { generationId: 'test-id' },
      });
      mockGet
        .mockResolvedValueOnce({
          data: { status: 'completed', result: { exportUrl: 'https://test.com/file.pptx' } },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('test'),
          headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
        });
    });

    it('should preserve trainer content exactly for RTL languages', async () => {
      const exactContent = 'זהו תוכן מדויק של המאמן. אל תשנה אותו.';
      
      await gammaClient.generatePresentation(exactContent, {
        topicName: 'Test',
        language: 'he',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      // Verify exact content is preserved (after language rules)
      expect(sentText).toContain(exactContent);
    });

    it('should preserve trainer content exactly for LTR languages', async () => {
      const exactContent = 'This is exact trainer content. Do not modify it.';
      
      await gammaClient.generatePresentation(exactContent, {
        topicName: 'Test',
        language: 'en',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      // Verify exact content is preserved (after language rules)
      expect(sentText).toContain(exactContent);
    });

    it('should include "Do NOT translate" rule in all requests', async () => {
      const inputText = 'Test content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test',
        language: 'en',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      expect(sentText).toContain('Do NOT translate the text');
      expect(sentText).toContain('Keep all content in the exact original language');
    });
  });

  describe('Language Rules Structure', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();
      
      // Setup default successful API responses
      // IMPORTANT: Set up mocks BEFORE any async operations
      const mockPost = getMockAxiosPost();
      const mockGet = getMockAxiosGet();
      
      mockPost.mockResolvedValue({
        data: { generationId: 'test-id' },
      });
      mockGet
        .mockResolvedValueOnce({
          data: { status: 'completed', result: { exportUrl: 'https://test.com/file.pptx' } },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('test'),
          headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
        });
    });

    it('should include all required language rules', async () => {
      const inputText = 'Test content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test',
        language: 'en',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      // Verify all 6 required rules are present
      expect(sentText).toContain('1) Do NOT translate the text');
      expect(sentText).toContain('2) The presentation MUST be fully written in');
      expect(sentText).toContain('3) If');
      expect(sentText).toContain('is an RTL language, you MUST use');
      expect(sentText).toContain('4) All elements (titles, bullets, paragraphs, tables)');
      expect(sentText).toContain('5) Do NOT mix English words unless they are programming syntax');
      expect(sentText).toContain('6) The tone must stay educational and clear');
    });

    it('should place language rules before content', async () => {
      const inputText = 'Test content';
      
      await gammaClient.generatePresentation(inputText, {
        topicName: 'Test',
        language: 'en',
      });

      const mockPost = getMockAxiosPost();
      const callArgs = mockPost.mock.calls[0];
      const payload = callArgs[1];
      const sentText = payload.inputText;

      // Language rules should come before the content separator
      const rulesIndex = sentText.indexOf('IMPORTANT — LANGUAGE RULES');
      const separatorIndex = sentText.indexOf('---');
      const contentIndex = sentText.indexOf(inputText);

      expect(rulesIndex).toBeLessThan(separatorIndex);
      expect(separatorIndex).toBeLessThan(contentIndex);
    });
  });

  describe('RTL_LANGUAGES Constant', () => {
    it('should export RTL_LANGUAGES array', () => {
      expect(Array.isArray(RTL_LANGUAGES)).toBe(true);
      expect(RTL_LANGUAGES).toContain('ar');
      expect(RTL_LANGUAGES).toContain('he');
      expect(RTL_LANGUAGES).toContain('fa');
      expect(RTL_LANGUAGES).toContain('ur');
    });

    it('should allow extension of RTL_LANGUAGES in the future', () => {
      // This test documents that the list can be extended
      expect(RTL_LANGUAGES.length).toBeGreaterThanOrEqual(4);
    });
  });
});

