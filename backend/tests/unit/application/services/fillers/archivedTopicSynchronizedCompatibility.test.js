import { describe, it, expect } from '@jest/globals';
import {
  evaluateArchivedTopicSynchronizedCompatibility,
  isArchivedTopicCompatibleWithSynchronizedNarration,
} from '../../../../../src/application/services/fillers/archivedTopicSynchronizedCompatibility.js';
import { decideArchivedTopicReuseForPersonalized } from '../../../../../src/application/services/fillers/fillCourseBuilderService.js';

function buildSyncCompatibleTopic(overrides = {}) {
  const topic = {
    topic_id: 101,
    topic_name: 'Synced Lesson',
    contents: [
      {
        content_type: 'text',
        content_data: {
          text: 'Lesson text',
          audioUrl: 'https://cdn.example/a.mp3',
          audioFormat: 'mp3',
          audioDuration: 12,
        },
      },
      {
        content_type: 'code',
        content_data: { code: 'console.log(1)', language: 'javascript' },
      },
      {
        content_type: 'presentation',
        content_data: {
          presentationUrl: 'https://cdn.example/p.pdf',
          storagePath: 'presentations/p.pdf',
          format: 'gamma',
        },
      },
      {
        content_type: 'mind_map',
        content_data: { nodes: [{ id: '1' }], edges: [] },
      },
      {
        content_type: 'avatar_video',
        content_data: {
          videoMode: 'presentation_narration',
          videoUrl: 'https://cdn.example/v.mp4',
          fileUrl: 'https://cdn.example/v.mp4',
          duration_seconds: 12,
          script: 'Lesson text',
        },
      },
    ],
  };

  if (overrides.replaceContents) {
    topic.contents = overrides.replaceContents;
  }
  if (overrides.patchAvatar) {
    const avatar = topic.contents.find((c) => c.content_type === 'avatar_video');
    Object.assign(avatar.content_data, overrides.patchAvatar);
  }
  if (overrides.patchText) {
    const text = topic.contents.find((c) => c.content_type === 'text');
    Object.assign(text.content_data, overrides.patchText);
  }
  if (overrides.removeTypes) {
    topic.contents = topic.contents.filter(
      (c) => !overrides.removeTypes.includes(c.content_type)
    );
  }
  return topic;
}

function buildLegacyHeyGenTopic() {
  return {
    topic_id: 64,
    topic_name: 'Introduction to Errors and Synchronous Exception Management',
    contents: [
      {
        content_type: 'text',
        content_data: { text: 'old', audioUrl: 'https://cdn.example/old.mp3' },
      },
      {
        content_type: 'code',
        content_data: { code: 'x' },
      },
      {
        content_type: 'mind_map',
        content_data: { nodes: [{ id: '1' }], edges: [] },
      },
      {
        content_type: 'avatar_video',
        content_data: {
          videoId: 'hg-legacy',
          videoUrl: 'https://cdn.example/heygen.mp4',
          // no videoMode presentation_narration
        },
      },
    ],
  };
}

describe('archivedTopicSynchronizedCompatibility', () => {
  it('accepts a fully compatible synchronized archived topic', () => {
    const topic = buildSyncCompatibleTopic();
    const result = evaluateArchivedTopicSynchronizedCompatibility(topic);
    expect(result.compatible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(isArchivedTopicCompatibleWithSynchronizedNarration(topic)).toBe(true);
  });

  it('rejects legacy HeyGen avatar video', () => {
    const topic = buildLegacyHeyGenTopic();
    const result = evaluateArchivedTopicSynchronizedCompatibility(topic);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes('presentation_narration'))).toBe(true);
  });

  it('rejects missing presentation', () => {
    const topic = buildSyncCompatibleTopic({ removeTypes: ['presentation'] });
    const result = evaluateArchivedTopicSynchronizedCompatibility(topic);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes('presentation'))).toBe(true);
  });

  it('rejects presentation_narration video with status failed', () => {
    const topic = buildSyncCompatibleTopic({
      patchAvatar: { status: 'failed', error: 'boom' },
    });
    const result = evaluateArchivedTopicSynchronizedCompatibility(topic);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes('failed'))).toBe(true);
  });

  it('rejects presentation_narration video without fileUrl/videoUrl', () => {
    const topic = buildSyncCompatibleTopic({
      patchAvatar: { videoUrl: null, fileUrl: null },
    });
    const result = evaluateArchivedTopicSynchronizedCompatibility(topic);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes('fileUrl/videoUrl'))).toBe(true);
  });

  it('rejects missing/empty synchronized text audioUrl', () => {
    const topic = buildSyncCompatibleTopic({
      patchText: { audioUrl: '' },
    });
    const result = evaluateArchivedTopicSynchronizedCompatibility(topic);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes('audioUrl'))).toBe(true);
  });
});

describe('decideArchivedTopicReuseForPersonalized', () => {
  it('FLAG OFF + legacy HeyGen topic → reuse exactly as before', () => {
    const existingTopic = buildLegacyHeyGenTopic();
    const decision = decideArchivedTopicReuseForPersonalized({
      existingTopic,
      synchronizedMode: false,
    });
    expect(decision.reuse).toBe(true);
    expect(decision.topic).toBe(existingTopic);
    expect(decision.rejectedForSync).toBeUndefined();
    // not mutated
    expect(existingTopic.contents.find((c) => c.content_type === 'avatar_video').content_data.videoId).toBe(
      'hg-legacy'
    );
  });

  it('FLAG ON + compatible synchronized topic → reuse', () => {
    const existingTopic = buildSyncCompatibleTopic();
    const decision = decideArchivedTopicReuseForPersonalized({
      existingTopic,
      synchronizedMode: true,
    });
    expect(decision.reuse).toBe(true);
    expect(decision.topic).toBe(existingTopic);
  });

  it('FLAG ON + legacy HeyGen → reject (fresh generation path)', () => {
    const existingTopic = buildLegacyHeyGenTopic();
    const snapshot = JSON.stringify(existingTopic);
    const decision = decideArchivedTopicReuseForPersonalized({
      existingTopic,
      synchronizedMode: true,
    });
    expect(decision.reuse).toBe(false);
    expect(decision.topic).toBeNull();
    expect(decision.rejectedForSync).toBe(true);
    expect(decision.reasons.length).toBeGreaterThan(0);
    // rejected archived topic is NOT mutated
    expect(JSON.stringify(existingTopic)).toBe(snapshot);
  });

  it('FLAG ON + missing presentation → reject', () => {
    const existingTopic = buildSyncCompatibleTopic({ removeTypes: ['presentation'] });
    const decision = decideArchivedTopicReuseForPersonalized({
      existingTopic,
      synchronizedMode: true,
    });
    expect(decision.reuse).toBe(false);
    expect(decision.rejectedForSync).toBe(true);
  });

  it('null existing topic → no reuse', () => {
    expect(
      decideArchivedTopicReuseForPersonalized({
        existingTopic: null,
        synchronizedMode: true,
      })
    ).toEqual({ reuse: false, topic: null });
  });
});
