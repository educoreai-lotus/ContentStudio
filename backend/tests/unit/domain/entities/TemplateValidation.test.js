import { describe, it, expect } from '@jest/globals';
import { Template } from '../../../../src/domain/entities/Template.js';

describe('Template Validation - Mandatory Formats', () => {
  it('should require all 5 mandatory formats', () => {
    expect(() => {
      new Template({
        template_id: 1,
        template_name: 'Test Template',
        format_order: ['text', 'code'], // Missing presentation, audio, mind_map
        created_by: 'trainer1',
      });
    }).toThrow('Template must include all 5 mandatory formats');
  });

  it('should accept template with all 5 mandatory formats', () => {
    const template = new Template({
      template_id: 1,
      template_name: 'Complete Template',
      format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
      created_by: 'trainer1',
    });

    expect(template.format_order).toHaveLength(5);
    expect(template.format_order).toContain('text');
    expect(template.format_order).toContain('code');
    expect(template.format_order).toContain('presentation');
    expect(template.format_order).toContain('audio');
    expect(template.format_order).toContain('mind_map');
  });

  it('should require audio to be with text (text before audio)', () => {
    const template = new Template({
      template_id: 1,
      template_name: 'Valid Template',
      format_order: ['text', 'code', 'presentation', 'audio', 'mind_map'],
      created_by: 'trainer1',
    });

    expect(template.format_order.indexOf('text')).toBeLessThan(
      template.format_order.indexOf('audio')
    );
  });

  it('should require audio to be with text (text immediately after audio)', () => {
    const template = new Template({
      template_id: 1,
      template_name: 'Valid Template',
      format_order: ['code', 'presentation', 'audio', 'text', 'mind_map'],
      created_by: 'trainer1',
    });

    const audioIndex = template.format_order.indexOf('audio');
    const textIndex = template.format_order.indexOf('text');
    expect(textIndex).toBe(audioIndex + 1);
  });

  it('should reject audio without text nearby', () => {
    expect(() => {
      new Template({
        template_id: 1,
        template_name: 'Invalid Template',
        format_order: ['code', 'audio', 'presentation', 'mind_map', 'text'], // text too far from audio
        created_by: 'trainer1',
      });
    }).toThrow('Audio format must always be with text');
  });

  it('should allow avatar_video as optional format', () => {
    const template = new Template({
      template_id: 1,
      template_name: 'Template with Avatar',
      format_order: ['avatar_video', 'text', 'code', 'presentation', 'audio', 'mind_map'],
      created_by: 'trainer1',
    });

    expect(template.format_order).toContain('avatar_video');
    expect(template.format_order).toContain('text');
    expect(template.format_order).toContain('code');
    expect(template.format_order).toContain('presentation');
    expect(template.format_order).toContain('audio');
    expect(template.format_order).toContain('mind_map');
  });
});



