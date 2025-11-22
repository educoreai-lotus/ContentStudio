/**
 * Fetch and select a suitable HeyGen avatar
 * Selects a female, natural/neutral/professional, public avatar
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_AVATAR_API_URL = 'https://api.heygen.com/v1/avatar.list';
const CONFIG_PATH = path.join(__dirname, '../config/heygen-avatar.json');

/**
 * Fetch available avatars from HeyGen API
 */
async function fetchAvatars() {
  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching avatars from HeyGen API...');
    const response = await axios.get(HEYGEN_AVATAR_API_URL, {
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    // Handle different response structures
    let avatars = [];
    if (response.data?.data?.avatars) {
      avatars = response.data.data.avatars;
    } else if (response.data?.data) {
      avatars = Array.isArray(response.data.data) ? response.data.data : [];
    } else if (response.data?.avatars) {
      avatars = response.data.avatars;
    } else if (Array.isArray(response.data)) {
      avatars = response.data;
    } else {
      console.error('❌ Unexpected response structure:', JSON.stringify(response.data, null, 2));
      return null;
    }

    console.log(`✅ Found ${avatars.length} avatars`);
    return avatars;
  } catch (error) {
    console.error('❌ Failed to fetch avatars:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Select the best avatar based on criteria
 * Criteria: female, natural/neutral/professional, public
 */
function selectAvatar(avatars) {
  if (!avatars || avatars.length === 0) {
    return null;
  }

  // Filter for public avatars
  const publicAvatars = avatars.filter(avatar => {
    // Check if avatar is public (not premium/private)
    // Common indicators: is_public, public, access_level, etc.
    const isPublic = 
      avatar.is_public === true ||
      avatar.public === true ||
      avatar.access_level === 'public' ||
      avatar.access_level === 'free' ||
      (avatar.premium === false && avatar.private === false) ||
      // If no access indicators, assume public if not explicitly marked as premium/private
      (!avatar.premium && !avatar.private && !avatar.is_premium && !avatar.is_private);
    
    return isPublic;
  });

  console.log(`📊 Found ${publicAvatars.length} public avatars`);

  // Filter for female avatars
  const femaleAvatars = publicAvatars.filter(avatar => {
    const gender = (avatar.gender || avatar.sex || '').toLowerCase();
    return gender === 'female' || gender === 'f' || gender === 'woman' || gender === 'girl';
  });

  console.log(`👩 Found ${femaleAvatars.length} female public avatars`);

  // If no female avatars, use all public avatars
  const candidates = femaleAvatars.length > 0 ? femaleAvatars : publicAvatars;

  if (candidates.length === 0) {
    console.warn('⚠️ No suitable avatars found matching criteria');
    return null;
  }

  // Score avatars based on style keywords (natural, neutral, professional)
  const styleKeywords = ['natural', 'neutral', 'professional', 'normal', 'standard'];
  const scoredAvatars = candidates.map(avatar => {
    let score = 0;
    const name = (avatar.name || avatar.avatar_name || '').toLowerCase();
    const style = (avatar.style || avatar.avatar_style || '').toLowerCase();
    const description = (avatar.description || '').toLowerCase();
    const combined = `${name} ${style} ${description}`;

    // Check for style keywords
    styleKeywords.forEach(keyword => {
      if (combined.includes(keyword)) {
        score += 2;
      }
    });

    // Prefer avatars with neutral/professional in name
    if (name.includes('neutral') || name.includes('professional')) {
      score += 3;
    }

    // Prefer avatars with 'natural' in name
    if (name.includes('natural')) {
      score += 2;
    }

    return { avatar, score };
  });

  // Sort by score (highest first)
  scoredAvatars.sort((a, b) => b.score - a.score);

  // Select the highest scored avatar
  const selected = scoredAvatars[0].avatar;

  console.log(`✅ Selected avatar: ${selected.name || selected.avatar_name || selected.avatar_id}`);
  console.log(`   ID: ${selected.avatar_id || selected.id}`);
  console.log(`   Gender: ${selected.gender || selected.sex || 'unknown'}`);
  console.log(`   Style: ${selected.style || selected.avatar_style || 'unknown'}`);

  return {
    avatar_id: selected.avatar_id || selected.id,
    name: selected.name || selected.avatar_name || selected.avatar_id,
    gender: selected.gender || selected.sex || 'unknown',
    style: selected.style || selected.avatar_style || 'unknown',
    score: scoredAvatars[0].score,
  };
}

/**
 * Save selected avatar to config file
 */
function saveAvatarConfig(selectedAvatar) {
  if (!selectedAvatar) {
    console.error('❌ No avatar selected, cannot save config');
    return false;
  }

  const config = {
    avatar_id: selectedAvatar.avatar_id,
    name: selectedAvatar.name,
    gender: selectedAvatar.gender,
    style: selectedAvatar.style,
    selectedAt: new Date().toISOString(),
    source: 'HeyGen API v1/avatar.list',
  };

  // Ensure config directory exists
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write config file
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  console.log(`💾 Saved avatar config to: ${CONFIG_PATH}`);
  console.log(JSON.stringify(config, null, 2));

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 HeyGen Avatar Selection Script\n');

  const avatars = await fetchAvatars();
  if (!avatars) {
    console.error('❌ Failed to fetch avatars');
    process.exit(1);
  }

  const selectedAvatar = selectAvatar(avatars);
  if (!selectedAvatar) {
    console.error('❌ Failed to select suitable avatar');
    process.exit(1);
  }

  const saved = saveAvatarConfig(selectedAvatar);
  if (!saved) {
    console.error('❌ Failed to save avatar config');
    process.exit(1);
  }

  console.log('\n✅ Avatar selection completed successfully!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { fetchAvatars, selectAvatar, saveAvatarConfig };

