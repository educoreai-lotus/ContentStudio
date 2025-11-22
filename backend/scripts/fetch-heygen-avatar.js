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
// Try multiple possible endpoints for avatar listing
const HEYGEN_AVATAR_API_URLS = [
  'https://api.heygen.com/v2/avatars',
  'https://api.heygen.com/v1/avatars',
  'https://api.heygen.com/v1/avatar.list',
  'https://api.heygen.com/v2/avatar.list',
];
const CONFIG_PATH = path.join(__dirname, '../config/heygen-avatar.json');

/**
 * Fetch available avatars from HeyGen API
 */
async function fetchAvatars() {
  if (!HEYGEN_API_KEY) {
    console.error('❌ HEYGEN_API_KEY environment variable is required');
    process.exit(1);
  }

  // Try multiple endpoints until one works
  let lastError = null;
  for (const url of HEYGEN_AVATAR_API_URLS) {
    try {
      console.log(`🔍 Trying endpoint: ${url}...`);
      const response = await axios.get(url, {
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
        console.warn(`⚠️ Unexpected response structure from ${url}, trying next endpoint...`);
        lastError = new Error('Unexpected response structure');
        continue;
      }

      if (avatars.length === 0) {
        console.warn(`⚠️ No avatars found from ${url}, trying next endpoint...`);
        lastError = new Error('No avatars in response');
        continue;
      }

      console.log(`✅ Found ${avatars.length} avatars from ${url}`);
      return avatars;
    } catch (error) {
      console.warn(`⚠️ Endpoint ${url} failed: ${error.response?.status || error.message}`);
      lastError = error;
      // Continue to next endpoint
      continue;
    }
  }

  // All endpoints failed
  console.error('\n❌ All avatar list endpoints failed');
  if (lastError?.response) {
    console.error('Last error status:', lastError.response.status);
    console.error('Last error data:', JSON.stringify(lastError.response.data, null, 2));
  }
  
  // If we get 403, suggest manual avatar selection
  if (lastError?.response?.status === 403) {
    console.error('\n💡 The avatar.list endpoint is not accessible (403 Forbidden).');
    console.error('   HeyGen may have restricted avatar listing access.');
    console.error('\n📝 Manual Avatar Setup Required:');
    console.error('   Since the API endpoint is not accessible, you need to manually set an avatar ID.');
    console.error('   Steps:');
    console.error('   1. Get a public avatar ID from HeyGen dashboard or contact HeyGen support');
    console.error('   2. Create config/heygen-avatar.json manually with this structure:');
    console.error('      {');
    console.error('        "avatar_id": "YOUR_AVATAR_ID_HERE",');
    console.error('        "name": "Avatar Name",');
    console.error('        "gender": "female",');
    console.error('        "style": "professional",');
    console.error('        "score": 0,');
    console.error('        "selectedAt": "' + new Date().toISOString() + '",');
    console.error('        "source": "manual",');
    console.error('        "criteria": {');
    console.error('          "mustBePublic": true,');
    console.error('          "mustBeFemaleOrNeutral": true,');
    console.error('          "mustBeProfessionalNeutralOrNatural": true,');
    console.error('          "mustNotBeChildCartoonFantasyRobotDramatic": true');
    console.error('        }');
    console.error('      }');
  }
  
  return null;
}

/**
 * Select the best avatar based on criteria
 * Criteria: public, female OR neutral, professional/neutral/natural, NOT child/cartoon/fantasy/robot/dramatic
 */
function selectAvatar(avatars) {
  if (!avatars || avatars.length === 0) {
    return null;
  }

  // Filter for public avatars
  const publicAvatars = avatars.filter(avatar => {
    // Check if avatar is public (not premium/private)
    const isPublic = 
      avatar.is_public === true ||
      avatar.public === true ||
      avatar.access_level === 'public' ||
      avatar.access_level === 'free' ||
      (avatar.premium === false && avatar.private === false) ||
      (!avatar.premium && !avatar.private && !avatar.is_premium && !avatar.is_private);
    
    return isPublic;
  });

  console.log(`📊 Found ${publicAvatars.length} public avatars`);

  if (publicAvatars.length === 0) {
    console.warn('⚠️ No public avatars found');
    return null;
  }

  // Score avatars based on new rules
  const scoredAvatars = publicAvatars.map(avatar => {
    let score = 0;
    const name = (avatar.name || avatar.avatar_name || '').toLowerCase();
    const style = (avatar.style || avatar.avatar_style || '').toLowerCase();
    const description = (avatar.description || '').toLowerCase();
    const category = (avatar.category || avatar.categories || '').toLowerCase();
    const gender = (avatar.gender || avatar.sex || '').toLowerCase();
    const combined = `${name} ${style} ${description} ${category}`;

    // ⭐ Avatar scoring rules:
    
    // +20 for professional / neutral / natural
    if (combined.includes('professional')) {
      score += 20;
    }
    if (combined.includes('neutral')) {
      score += 20;
    }
    if (combined.includes('natural')) {
      score += 20;
    }

    // +10 for female or neutral gender
    if (gender === 'female' || gender === 'f' || gender === 'woman' || gender === 'girl') {
      score += 10;
    }
    if (gender === 'neutral' || gender === 'n' || gender === 'unisex') {
      score += 10;
    }

    // -100 if child/cartoon/robot/character (disqualify)
    const disqualifiers = ['child', 'cartoon', 'fantasy', 'robot', 'dramatic', 'character', 'kid', 'baby', 'toddler'];
    disqualifiers.forEach(disqualifier => {
      if (combined.includes(disqualifier)) {
        score -= 100;
      }
    });

    return { avatar, score };
  });

  // Filter out disqualified avatars (score < 0)
  const qualifiedAvatars = scoredAvatars.filter(item => item.score >= 0);

  if (qualifiedAvatars.length === 0) {
    console.warn('⚠️ No avatars found matching all criteria (all were disqualified)');
    return null;
  }

  // Sort by score (highest first)
  qualifiedAvatars.sort((a, b) => b.score - a.score);

  // Select the highest scored avatar
  const selected = qualifiedAvatars[0].avatar;
  const selectedScore = qualifiedAvatars[0].score;

  console.log(`\n✅ Selected avatar:`);
  console.log(`   Name: ${selected.name || selected.avatar_name || selected.avatar_id}`);
  console.log(`   ID: ${selected.avatar_id || selected.id}`);
  console.log(`   Gender: ${selected.gender || selected.sex || 'unknown'}`);
  console.log(`   Style: ${selected.style || selected.avatar_style || 'unknown'}`);
  console.log(`   Score: ${selectedScore}`);

  return {
    avatar_id: selected.avatar_id || selected.id,
    name: selected.name || selected.avatar_name || selected.avatar_id,
    gender: selected.gender || selected.sex || 'unknown',
    style: selected.style || selected.avatar_style || 'unknown',
    score: selectedScore,
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
    score: selectedAvatar.score,
    selectedAt: new Date().toISOString(),
    source: 'HeyGen API v1/avatar.list',
    criteria: {
      mustBePublic: true,
      mustBeFemaleOrNeutral: true,
      mustBeProfessionalNeutralOrNatural: true,
      mustNotBeChildCartoonFantasyRobotDramatic: true,
    },
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
  console.log('\n📋 FINAL SELECTION:');
  console.log(`   Avatar Name: ${selectedAvatar.name}`);
  console.log(`   Avatar ID: ${selectedAvatar.avatar_id}`);
  console.log(`   Gender: ${selectedAvatar.gender}`);
  console.log(`   Style: ${selectedAvatar.style}`);
  console.log(`   Score: ${selectedAvatar.score}`);
  console.log(`\n💾 Config saved to: ${CONFIG_PATH}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { fetchAvatars, selectAvatar, saveAvatarConfig };

