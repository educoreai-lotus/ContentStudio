import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables (optional - won't crash if .env doesn't exist)
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/voices';
const OUTPUT_FILE = path.join(__dirname, '../config/heygen-voices.json');

// Keywords to exclude from voice selection
const EXCLUDED_KEYWORDS = [
  'whisper',
  'robotic',
  'dramatic',
  'child',
  'seductive',
  'narration',
  'narrative',
  'storytelling',
  'theater',
  'theatrical',
  'cartoon',
  'character',
  'fantasy',
  'monster',
  'alien',
];

// Keywords that indicate natural/neutral/educational voices
const PREFERRED_KEYWORDS = [
  'natural',
  'neutral',
  'professional',
  'clear',
  'conversational',
  'friendly',
  'warm',
  'calm',
  'gentle',
];

/**
 * Check if a voice should be excluded based on name/description
 */
function shouldExcludeVoice(voice) {
  const searchText = `${voice.name || ''} ${voice.description || ''} ${voice.style || ''}`.toLowerCase();
  
  return EXCLUDED_KEYWORDS.some(keyword => searchText.includes(keyword));
}

/**
 * Check if a voice is preferred (natural/neutral/educational)
 */
function isPreferredVoice(voice) {
  const searchText = `${voice.name || ''} ${voice.description || ''} ${voice.style || ''}`.toLowerCase();
  
  return PREFERRED_KEYWORDS.some(keyword => searchText.includes(keyword));
}

/**
 * Extract language code from voice locale/language
 */
function extractLanguageCode(voice) {
  // Try locale first (e.g., "en_US" -> "en")
  if (voice.locale) {
    const parts = voice.locale.split('_');
    if (parts.length > 0) {
      return parts[0].toLowerCase();
    }
  }
  
  // Try language field (e.g., "en-US" -> "en")
  if (voice.language) {
    const parts = voice.language.split('-');
    if (parts.length > 0) {
      return parts[0].toLowerCase();
    }
  }
  
  // Fallback: try to extract from name or other fields
  if (voice.name) {
    // Some voices might have language in name
    const langMatch = voice.name.match(/\b(en|ar|he|fr|es|de|it|pt|ja|ko|zh)\b/i);
    if (langMatch) {
      return langMatch[1].toLowerCase();
    }
  }
  
  return null;
}

/**
 * Filter voices by gender (female or neutral)
 */
function isSuitableGender(voice) {
  const gender = (voice.gender || '').toLowerCase();
  return gender === 'female' || gender === 'neutral' || gender === '';
}

/**
 * Score a voice for suitability (higher = better)
 */
function scoreVoice(voice) {
  let score = 0;
  
  // Base score
  score += 10;
  
  // Preferred keywords boost
  if (isPreferredVoice(voice)) {
    score += 20;
  }
  
  // Gender suitability
  if (isSuitableGender(voice)) {
    score += 10;
  }
  
  // Penalty for excluded keywords (shouldn't reach here, but just in case)
  if (shouldExcludeVoice(voice)) {
    score -= 100;
  }
  
  return score;
}

/**
 * Fetch voices from HeyGen API
 */
async function fetchVoices() {
  if (!HEYGEN_API_KEY) {
    console.log('⚠️  HEYGEN_API_KEY not found. Avatar detection will be skipped locally.');
    console.log('   Set HEYGEN_API_KEY in .env file or environment variables to fetch voices.');
    return null;
  }

  try {
    console.log('🔍 Fetching voices from HeyGen API...');
    
    const response = await axios.get(HEYGEN_API_URL, {
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    if (response.data?.data?.voices) {
      return response.data.data.voices;
    } else if (response.data?.voices) {
      return response.data.voices;
    } else {
      console.error('❌ Unexpected response structure:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to fetch voices from HeyGen API:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Process voices and select one default per language
 */
function selectDefaultVoices(voices) {
  if (!voices || voices.length === 0) {
    console.log('⚠️  No voices found in API response');
    return {};
  }

  console.log(`\n📊 Processing ${voices.length} voices...`);

  // Group voices by language
  const voicesByLanguage = {};
  
  voices.forEach(voice => {
    const langCode = extractLanguageCode(voice);
    if (!langCode) {
      return; // Skip voices without language info
    }

    if (!voicesByLanguage[langCode]) {
      voicesByLanguage[langCode] = [];
    }

    // Only include voices that pass filters
    if (!shouldExcludeVoice(voice) && isSuitableGender(voice)) {
      voicesByLanguage[langCode].push(voice);
    }
  });

  // Select one voice per language
  const defaultVoices = {};
  const languagesSupported = [];
  const languagesSkipped = [];

  Object.keys(voicesByLanguage).sort().forEach(langCode => {
    const langVoices = voicesByLanguage[langCode];
    
    if (langVoices.length === 0) {
      languagesSkipped.push(langCode);
      defaultVoices[langCode] = null;
      return;
    }

    // Sort by score (preferred voices first)
    langVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));

    // Select the first (highest scored) voice
    const selectedVoice = langVoices[0];
    defaultVoices[langCode] = selectedVoice.voice_id;
    languagesSupported.push({
      code: langCode,
      voice_id: selectedVoice.voice_id,
      name: selectedVoice.name || 'Unknown',
      gender: selectedVoice.gender || 'unknown',
      locale: selectedVoice.locale || selectedVoice.language || 'unknown',
    });
  });

  // Summary
  console.log(`\n✅ Languages with voices selected: ${languagesSupported.length}`);
  languagesSupported.forEach(lang => {
    console.log(`   ${lang.code.toUpperCase()}: ${lang.name} (${lang.voice_id})`);
  });

  if (languagesSkipped.length > 0) {
    console.log(`\n⚠️  Languages skipped (no suitable voices): ${languagesSkipped.length}`);
    languagesSkipped.forEach(lang => {
      console.log(`   ${lang.toUpperCase()}`);
    });
  }

  return defaultVoices;
}

/**
 * Save default voices to JSON file
 */
function saveDefaultVoices(defaultVoices) {
  const output = {
    defaultVoices,
    generatedAt: new Date().toISOString(),
    source: 'HeyGen API v2',
    endpoint: HEYGEN_API_URL,
  };

  const jsonOutput = JSON.stringify(output, null, 2);

  // Ensure config directory exists
  const configDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`📁 Created config directory: ${configDir}`);
  }

  // Save to file
  fs.writeFileSync(OUTPUT_FILE, jsonOutput, 'utf8');
  console.log(`\n💾 Saved default voices to: ${OUTPUT_FILE}`);

  // Also output to console for easy copying from Railway logs
  console.log('\n' + '='.repeat(50));
  console.log('📋 JSON OUTPUT (copy this to save locally):');
  console.log('='.repeat(50));
  console.log(jsonOutput);
  console.log('='.repeat(50));
}

/**
 * Main execution
 */
async function main() {
  console.log('🎯 HeyGen Voices Fetcher');
  console.log('=' .repeat(50));

  const voices = await fetchVoices();
  
  if (!voices) {
    console.log('\n⚠️  Cannot proceed without voices data.');
    process.exit(0);
  }

  console.log(`✅ Fetched ${voices.length} voices from HeyGen API`);

  const defaultVoices = selectDefaultVoices(voices);
  
  if (Object.keys(defaultVoices).length === 0) {
    console.log('\n⚠️  No suitable voices found after filtering.');
    process.exit(1);
  }

  saveDefaultVoices(defaultVoices);

  console.log('\n✅ Voice selection completed successfully!');
  console.log(`   Total languages configured: ${Object.keys(defaultVoices).length}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});

