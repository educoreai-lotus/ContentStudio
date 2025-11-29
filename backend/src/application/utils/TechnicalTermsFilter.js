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
  const words = text.split(/(\s+|[.,;:!?()\[\]{}'"`])/);
  
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
  
  // Count characters by script
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  // Calculate percentages
  const hebrewPercent = totalChars > 0 ? hebrewChars / totalChars : 0;
  const arabicPercent = totalChars > 0 ? arabicChars / totalChars : 0;
  
  // Determine dominant language
  if (hebrewPercent > 0.1) { // More than 10% Hebrew characters
    return {
      dominantLanguage: 'he',
      confidence: hebrewPercent,
      hasTechnicalTerms,
    };
  }
  
  if (arabicPercent > 0.1) { // More than 10% Arabic characters
    return {
      dominantLanguage: 'ar',
      confidence: arabicPercent,
      hasTechnicalTerms,
    };
  }
  
  // Default to English
  return {
    dominantLanguage: 'en',
    confidence: 1 - Math.max(hebrewPercent, arabicPercent),
    hasTechnicalTerms,
  };
}

