/**
 * Test script to verify HeyGen API v2 endpoint behavior
 * Tests if we can send a request WITHOUT voice_id and have HeyGen auto-select voice
 * 
 * ⚠️ This is a TEST ONLY - does not modify production code
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_URL = 'https://api.heygen.com';

/**
 * Test 1: Minimal payload with title, prompt, avatar_id - NO voice_id
 * This tests if HeyGen can auto-select voice
 */
async function testMinimalPayloadWithoutVoiceId() {
  console.log('\n🧪 TEST 1: Minimal payload WITHOUT voice_id');
  console.log('=' .repeat(60));
  
  if (!HEYGEN_API_KEY) {
    console.error('❌ ERROR: HEYGEN_API_KEY not found in environment variables');
    console.log('⚠️  Set HEYGEN_API_KEY in .env file to run this test');
    console.log('\n📋 TEST REQUEST STRUCTURE (would be sent):');
    console.log('Endpoint:', `${BASE_URL}/v2/video/generate`);
    console.log('Method: POST');
    console.log('Payload:', JSON.stringify(minimalPayload, null, 2));
    return null;
  }

  // Minimal payload - only title, prompt, and avatar_id
  // NO voice_id, NO video_inputs structure
  const minimalPayload = {
    title: 'EduCore Lesson',
    prompt: 'Constructors in OOP',
    avatar_id: 'sophia-public'
  };

  console.log('\n📤 REQUEST:');
  console.log('Endpoint:', `${BASE_URL}/v2/video/generate`);
  console.log('Method: POST');
  console.log('Headers:', {
    'X-Api-Key': HEYGEN_API_KEY ? '[REDACTED]' : 'MISSING',
    'Content-Type': 'application/json'
  });
  console.log('Payload:', JSON.stringify(minimalPayload, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/v2/video/generate`,
      minimalPayload,
      {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('\n✅ SUCCESS - Status Code:', response.status);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      statusCode: response.status,
      responseBody: response.data
    };

  } catch (error) {
    console.log('\n❌ ERROR:');
    console.log('Status Code:', error.response?.status || 'N/A');
    console.log('Status Text:', error.response?.statusText || 'N/A');
    console.log('Error Message:', error.message);
    
    if (error.response?.data) {
      console.log('Error Response Body:', JSON.stringify(error.response.data, null, 2));
    }

    return {
      success: false,
      statusCode: error.response?.status || null,
      statusText: error.response?.statusText || null,
      errorMessage: error.message,
      errorResponseBody: error.response?.data || null
    };
  }
}

/**
 * Test 2: v2 format with video_inputs but NO voice_id in voice object
 * Tests if voice_id can be omitted from voice object
 */
async function testV2FormatWithoutVoiceId() {
  console.log('\n\n🧪 TEST 2: v2 format WITHOUT voice_id in voice object');
  console.log('=' .repeat(60));

  if (!HEYGEN_API_KEY) {
    console.error('❌ ERROR: HEYGEN_API_KEY not found');
    console.log('\n📋 TEST REQUEST STRUCTURE (would be sent):');
    console.log('Endpoint:', `${BASE_URL}/v2/video/generate`);
    console.log('Method: POST');
    console.log('Payload:', JSON.stringify(v2PayloadWithoutVoiceId, null, 2));
    return null;
  }

  // v2 format but without voice_id
  const v2PayloadWithoutVoiceId = {
    title: 'EduCore Lesson',
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: 'sophia-public',
          avatar_style: 'normal'
        },
        voice: {
          type: 'text',
          input_text: 'Constructors in OOP',
          // NO voice_id - testing if HeyGen auto-selects
          speed: 1.0
        }
      }
    ],
    dimension: {
      width: 1280,
      height: 720
    }
  };

  console.log('\n📤 REQUEST:');
  console.log('Endpoint:', `${BASE_URL}/v2/video/generate`);
  console.log('Method: POST');
  console.log('Payload:', JSON.stringify(v2PayloadWithoutVoiceId, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/v2/video/generate`,
      v2PayloadWithoutVoiceId,
      {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('\n✅ SUCCESS - Status Code:', response.status);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      statusCode: response.status,
      responseBody: response.data
    };

  } catch (error) {
    console.log('\n❌ ERROR:');
    console.log('Status Code:', error.response?.status || 'N/A');
    console.log('Status Text:', error.response?.statusText || 'N/A');
    console.log('Error Message:', error.message);
    
    if (error.response?.data) {
      console.log('Error Response Body:', JSON.stringify(error.response.data, null, 2));
    }

    return {
      success: false,
      statusCode: error.response?.status || null,
      statusText: error.response?.statusText || null,
      errorMessage: error.message,
      errorResponseBody: error.response?.data || null
    };
  }
}

// Run tests
async function runTests() {
  console.log('\n🔬 HeyGen API Endpoint Test Suite');
  console.log('Testing if HeyGen can auto-select voice without voice_id');
  console.log('=' .repeat(60));

  const test1Result = await testMinimalPayloadWithoutVoiceId();
  const test2Result = await testV2FormatWithoutVoiceId();

  console.log('\n\n📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  if (test1Result) {
    console.log('Test 1 (Minimal payload):', test1Result.success ? '✅ PASSED' : '❌ FAILED');
    if (!test1Result.success) {
      console.log('  Status:', test1Result.statusCode, test1Result.statusText);
      console.log('  Error:', test1Result.errorMessage);
    }
  } else {
    console.log('Test 1 (Minimal payload): ⚠️ SKIPPED (API key not found)');
  }
  
  if (test2Result) {
    console.log('Test 2 (v2 format without voice_id):', test2Result.success ? '✅ PASSED' : '❌ FAILED');
    if (!test2Result.success) {
      console.log('  Status:', test2Result.statusCode, test2Result.statusText);
      console.log('  Error:', test2Result.errorMessage);
    }
  } else {
    console.log('Test 2 (v2 format without voice_id): ⚠️ SKIPPED (API key not found)');
  }

  console.log('\n' + '=' .repeat(60));
}

// Execute
runTests().catch(console.error);

