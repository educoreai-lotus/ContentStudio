/**
 * Compatibility check for reusing an archived topic when
 * PERSONALIZED_NARRATED_PRESENTATION_ENABLED=true.
 *
 * Does not mutate the topic. Pure inspection of persisted contents[].
 */

function findContent(topic, typeNames) {
  const contents = Array.isArray(topic?.contents) ? topic.contents : [];
  const wanted = new Set(typeNames.map((t) => String(t).toLowerCase()));
  return contents.find((c) => wanted.has(String(c?.content_type || '').toLowerCase())) || null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUsableUrl(...candidates) {
  return candidates.some((u) => isNonEmptyString(u));
}

/**
 * @param {Object} topic - Archived topic with contents[]
 * @returns {{ compatible: boolean, reasons: string[] }}
 */
export function evaluateArchivedTopicSynchronizedCompatibility(topic) {
  const reasons = [];

  if (!topic || typeof topic !== 'object') {
    return { compatible: false, reasons: ['topic is missing'] };
  }

  const text = findContent(topic, ['text', 'text_audio']);
  const code = findContent(topic, ['code']);
  const presentation = findContent(topic, ['presentation']);
  const mindMap = findContent(topic, ['mind_map']);
  const avatar = findContent(topic, ['avatar_video']);

  if (!text?.content_data) {
    reasons.push('missing text/text_audio content');
  } else {
    if (!isNonEmptyString(text.content_data.text)) {
      reasons.push('text/text_audio missing non-empty text');
    }
    if (!hasUsableUrl(text.content_data.audioUrl)) {
      reasons.push('text/text_audio missing usable audioUrl');
    }
  }

  if (!code?.content_data) {
    reasons.push('missing code content');
  } else if (!isNonEmptyString(code.content_data.code)) {
    reasons.push('code content missing usable code');
  }

  if (!presentation?.content_data) {
    reasons.push('missing presentation content');
  } else if (
    !hasUsableUrl(
      presentation.content_data.presentationUrl,
      presentation.content_data.fileUrl,
      presentation.content_data.url
    )
  ) {
    reasons.push('presentation missing usable presentationUrl/fileUrl');
  }

  if (!mindMap?.content_data) {
    reasons.push('missing mind_map content');
  } else {
    const nodes = mindMap.content_data.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      reasons.push('mind_map missing usable nodes');
    }
  }

  if (!avatar?.content_data) {
    reasons.push('missing avatar_video content');
  } else {
    const data = avatar.content_data;
    if (data.videoMode !== 'presentation_narration') {
      reasons.push(
        `avatar_video.videoMode is not presentation_narration (got: ${data.videoMode ?? 'undefined'})`
      );
    }
    if (data.status === 'failed') {
      reasons.push('avatar_video status is failed');
    }
    if (!hasUsableUrl(data.fileUrl, data.videoUrl)) {
      reasons.push('avatar_video missing usable fileUrl/videoUrl');
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons,
  };
}

/**
 * @param {Object} topic
 * @returns {boolean}
 */
export function isArchivedTopicCompatibleWithSynchronizedNarration(topic) {
  return evaluateArchivedTopicSynchronizedCompatibility(topic).compatible;
}
