/**
 * Language Ratio Detector
 * Detects language based on character ratio (percentage of non-Latin characters)
 * This is especially effective for presentations and technical content where
 * English technical terms are mixed with another language
 */

/**
 * Detect language by character ratio
 * @param {string} text - Text to analyze
 * @returns {string|null} Detected language code or null if no clear language detected
 */
export function detectLanguageByRatio(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  // Remove whitespace and punctuation for more accurate ratio calculation
  const cleanText = text.replace(/[\s\W]/g, '');
  const total = cleanText.length;

  if (total === 0) {
    return null;
  }

  // Count characters by script
  const counts = {
    ar: (text.match(/[\u0600-\u06FF]/g) || []).length, // Arabic
    he: (text.match(/[\u0590-\u05FF]/g) || []).length, // Hebrew
    ru: (text.match(/[\u0400-\u04FF]/g) || []).length, // Cyrillic (Russian, Bulgarian, etc.)
    fa: (text.match(/[\u06A0-\u06FF]/g) || []).length, // Persian/Farsi
    zh: (text.match(/[\u4E00-\u9FFF]/g) || []).length, // Chinese
    ja: (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length, // Japanese
    ko: (text.match(/[\uAC00-\uD7AF]/g) || []).length, // Korean
  };

  // Calculate ratios (percentages)
  const ratios = {};
  for (const lang in counts) {
    ratios[lang] = total > 0 ? counts[lang] / total : 0;
  }

  // Rule 1: If any language has ≥ 5% of characters, return it immediately
  // This handles cases like presentations with 80% Arabic + 20% English technical terms
  for (const lang of Object.keys(ratios)) {
    if (ratios[lang] >= 0.05) {
      return lang;
    }
  }

  // Rule 2: If Arabic/Hebrew has ≥ 3 characters, still consider it as that language
  // This handles short texts with technical terms
  if (counts.ar >= 3) return 'ar';
  if (counts.he >= 3) return 'he';
  if (counts.fa >= 3) return 'fa';
  if (counts.ru >= 3) return 'ru';
  if (counts.zh >= 3) return 'zh';
  if (counts.ja >= 3) return 'ja';
  if (counts.ko >= 3) return 'ko';

  // Rule 3: If no clear non-Latin script detected, return null
  // This allows heuristic or AI detection to handle Latin-based languages
  return null;
}

/**
 * Get detailed language ratio analysis
 * @param {string} text - Text to analyze
 * @returns {Object} Detailed analysis with counts, ratios, and detected language
 */
export function getLanguageRatioAnalysis(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      detectedLanguage: null,
      counts: {},
      ratios: {},
      totalChars: 0,
    };
  }

  const cleanText = text.replace(/[\s\W]/g, '');
  const total = cleanText.length;

  const counts = {
    ar: (text.match(/[\u0600-\u06FF]/g) || []).length,
    he: (text.match(/[\u0590-\u05FF]/g) || []).length,
    ru: (text.match(/[\u0400-\u04FF]/g) || []).length,
    fa: (text.match(/[\u06A0-\u06FF]/g) || []).length,
    zh: (text.match(/[\u4E00-\u9FFF]/g) || []).length,
    ja: (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length,
    ko: (text.match(/[\uAC00-\uD7AF]/g) || []).length,
  };

  const ratios = {};
  for (const lang in counts) {
    ratios[lang] = total > 0 ? counts[lang] / total : 0;
  }

  const detectedLanguage = detectLanguageByRatio(text);

  return {
    detectedLanguage,
    counts,
    ratios,
    totalChars: total,
  };
}

