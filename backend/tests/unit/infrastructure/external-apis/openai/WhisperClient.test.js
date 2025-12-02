import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WhisperClient } from '../../../../../src/infrastructure/external-apis/openai/WhisperClient.js';
import fs from 'fs';

describe('WhisperClient', () => {
  let whisperClient;
  let mockOpenAI;
  let mockReadStream;

  beforeEach(() => {
    mockOpenAI = {
      audio: {
        transcriptions: {
          create: jest.fn(),
        },
      },
    };

    // Mock fs.createReadStream
    mockReadStream = {
      pipe: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
    };
    jest.spyOn(fs, 'createReadStream').mockReturnValue(mockReadStream);

    // Mock OpenAI constructor
    jest.mock('openai', () => {
      return jest.fn().mockImplementation(() => mockOpenAI);
    });

    whisperClient = new WhisperClient({ apiKey: 'test-key' });
    whisperClient.openai = mockOpenAI;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('transcribe', () => {
    it('should transcribe audio file successfully', async () => {
      const mockResponse = {
        text: 'This is a test transcription',
        language: 'en',
        duration: 10.5,
        segments: [
          { start: 0, end: 5, text: 'This is a test' },
          { start: 5, end: 10.5, text: 'transcription' },
        ],
      };

      mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockResponse);

      const result = await whisperClient.transcribe('test-file.mp4', {
        language: 'en',
        response_format: 'verbose_json',
      });

      expect(result.text).toBe('This is a test transcription');
      expect(result.language).toBe('en');
      expect(result.duration).toBe(10.5);
      expect(result.segments).toHaveLength(2);
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    });

    it('should throw error if API key is missing', () => {
      expect(() => new WhisperClient({})).toThrow('OpenAI API key is required');
    });

    it('should handle transcription errors', async () => {
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(
        new Error('Transcription failed')
      );

      await expect(whisperClient.transcribe('test-file.mp4')).rejects.toThrow(
        'Whisper transcription failed'
      );
    });
  });

  describe('transcribeWithMetadata', () => {
    it('should transcribe with metadata', async () => {
      const mockResponse = {
        text: 'This is a test transcription with multiple words',
        language: 'en',
        duration: 5.0,
        segments: [],
      };

      mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockResponse);

      const result = await whisperClient.transcribeWithMetadata('test-file.mp4');

      expect(result.text).toBe('This is a test transcription with multiple words');
      expect(result.metadata).toHaveProperty('word_count');
      expect(result.metadata).toHaveProperty('character_count');
      expect(result.metadata).toHaveProperty('estimated_reading_time_minutes');
      expect(result.metadata.word_count).toBeGreaterThan(0);
    });
  });
});

