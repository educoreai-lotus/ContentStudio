/**
 * Technical Terms Filter
 * Filters out common technical/programming terms from text before language detection
 * This prevents technical English terms from affecting language detection in non-English content
 */

// Common technical terms in programming/development (case-insensitive)
const TECHNICAL_TERMS = [
  // Programming keywords
  'if', 'else', 'for', 'while', 'function', 'class', 'const', 'let', 'var',
  'return', 'import', 'export', 'async', 'await', 'promise', 'callback',
  'try', 'catch', 'throw', 'finally', 'switch', 'case', 'break', 'continue',
  'true', 'false', 'null', 'undefined', 'this', 'super', 'extends', 'implements',
  
  // Technologies & Frameworks
  'docker', 'kubernetes', 'react', 'vue', 'angular', 'node', 'express',
  'api', 'rest', 'graphql', 'json', 'xml', 'html', 'css', 'javascript',
  'typescript', 'python', 'java', 'csharp', 'php', 'ruby', 'go', 'rust',
  'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis',
  'git', 'github', 'gitlab', 'npm', 'yarn', 'webpack', 'babel',
  
  // Common technical terms
  'server', 'client', 'database', 'backend', 'frontend', 'fullstack',
  'devops', 'ci', 'cd', 'deployment', 'production', 'staging', 'development',
  'http', 'https', 'tcp', 'udp', 'ip', 'dns', 'ssl', 'tls',
  'oauth', 'jwt', 'token', 'authentication', 'authorization',
  'algorithm', 'data structure', 'array', 'object', 'string', 'number',
  'boolean', 'integer', 'float', 'double', 'char', 'byte',
  
  // Common abbreviations
  'ui', 'ux', 'dom', 'ajax', 'cors', 'csp', 'xss', 'csrf',
  'crud', 'mvc', 'mvp', 'mvvm', 'orm', 'odm',
  
  // Common commands/patterns
  'npm install', 'git push', 'git pull', 'git commit', 'git clone',
  'docker run', 'docker build', 'docker compose',
];

/**
 * Remove technical terms from text before language detection
 * @param {string} text - Text to filter
 * @returns {string} Filtered text with technical terms removed
 */
export function filterTechnicalTerms(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Split text into words (preserve punctuation and spacing)
  const words = text.split(/(\s+|[.,;:!?()[\]{}'"`])/);
  
  const filteredWords = words.map(word => {
    // Check if word (case-insensitive) is a technical term
    const wordLower = word.toLowerCase().trim();
    
    // Check exact match
    if (TECHNICAL_TERMS.includes(wordLower)) {
      return ''; // Remove technical term
    }
    
    // Check if word contains technical term (for cases like "docker-compose", "if-else")
    const containsTechnicalTerm = TECHNICAL_TERMS.some(term => {
      // Remove punctuation and check
      const cleanWord = wordLower.replace(/[^a-z0-9]/g, '');
      return cleanWord === term || cleanWord.includes(term) || term.includes(cleanWord);
    });
    
    if (containsTechnicalTerm && wordLower.length <= 20) {
      // Only remove if it's a short word (likely a technical term, not a regular word containing it)
      return '';
    }
    
    return word; // Keep the word
  });
  
  // Join back and clean up multiple spaces
  return filteredWords.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Check if text is primarily in a non-English language despite technical terms
 * Uses character-based detection to find dominant language
 * @param {string} text - Text to analyze
 * @returns {Object} { dominantLanguage: string, confidence: number, hasTechnicalTerms: boolean }
 */
export function analyzeLanguageWithTechnicalTerms(text) {
  if (!text || typeof text !== 'string') {
    return { dominantLanguage: 'en', confidence: 0, hasTechnicalTerms: false };
  }

  // Filter out technical terms
  const filteredText = filterTechnicalTerms(text);
  const hasTechnicalTerms = filteredText.length < text.length * 0.8; // If more than 20% was filtered
  
  // Count characters by script for all supported languages
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const persianChars = (text.match(/[\u06A0-\u06FF]/g) || []).length;
  const cyrillicChars = (text.match(/[\u0400-\u04FF]/g) || []).length; // Russian, Bulgarian, etc.
  const chineseChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length; // Chinese
  const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length; // Japanese
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length; // Korean
  
  // Count non-whitespace, non-punctuation characters for better accuracy
  const allChars = text.replace(/[\s\W]/g, '');
  const totalChars = allChars.length;
  
  // Calculate percentages based on actual characters
  const hebrewPercent = totalChars > 0 ? hebrewChars / totalChars : 0;
  const arabicPercent = totalChars > 0 ? arabicChars / totalChars : 0;
  const persianPercent = totalChars > 0 ? persianChars / totalChars : 0;
  const cyrillicPercent = totalChars > 0 ? cyrillicChars / totalChars : 0;
  const chinesePercent = totalChars > 0 ? chineseChars / totalChars : 0;
  const japanesePercent = totalChars > 0 ? japaneseChars / totalChars : 0;
  const koreanPercent = totalChars > 0 ? koreanChars / totalChars : 0;
  
  // Very low threshold for detection - if we see ANY non-Latin characters, prioritize them
  // This is critical because technical terms can dominate the character count
  // Even 1-2 characters in a different script should be detected
  // Check in order of specificity (more specific patterns first)
  
  // For Arabic/Hebrew/Persian: Even 1 character is enough if it's clearly Arabic script
  if (arabicChars >= 1 || (arabicPercent > 0.01 && arabicChars > 0)) {
    return {
      dominantLanguage: 'ar',
      confidence: Math.max(arabicPercent, 0.6), // Higher confidence for Arabic
      hasTechnicalTerms,
    };
  }
  
  if (hebrewChars >= 1 || (hebrewPercent > 0.01 && hebrewChars > 0)) {
    return {
      dominantLanguage: 'he',
      confidence: Math.max(hebrewPercent, 0.6), // Higher confidence for Hebrew
      hasTechnicalTerms,
    };
  }
  
  if (persianChars >= 1 || (persianPercent > 0.01 && persianChars > 0)) {
    return {
      dominantLanguage: 'fa',
      confidence: Math.max(persianPercent, 0.6),
      hasTechnicalTerms,
    };
  }
  
  if (chineseChars >= 1 || (chinesePercent > 0.01 && chineseChars > 0)) {
    return {
      dominantLanguage: 'zh',
      confidence: Math.max(chinesePercent, 0.5),
      hasTechnicalTerms,
    };
  }
  
  if (japaneseChars >= 1 || (japanesePercent > 0.01 && japaneseChars > 0)) {
    return {
      dominantLanguage: 'ja',
      confidence: Math.max(japanesePercent, 0.5),
      hasTechnicalTerms,
    };
  }
  
  if (koreanChars >= 1 || (koreanPercent > 0.01 && koreanChars > 0)) {
    return {
      dominantLanguage: 'ko',
      confidence: Math.max(koreanPercent, 0.5),
      hasTechnicalTerms,
    };
  }
  
  if (cyrillicChars >= 1 || (cyrillicPercent > 0.01 && cyrillicChars > 0)) {
    return {
      dominantLanguage: 'ru',
      confidence: Math.max(cyrillicPercent, 0.5),
      hasTechnicalTerms,
    };
  }
  
  // Default to English only if no non-Latin characters detected
  return {
    dominantLanguage: 'en',
    confidence: 1 - Math.max(hebrewPercent, arabicPercent, persianPercent, cyrillicPercent, chinesePercent, japanesePercent, koreanPercent),
    hasTechnicalTerms,
  };
}

