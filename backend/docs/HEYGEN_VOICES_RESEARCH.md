# HeyGen Voices API Research - Educational Voice Shortlist

## Research Date
November 22, 2025

## API Endpoint
```
GET https://api.heygen.com/v2/voices
```

## Documentation Source
- Official API Reference: https://docs.heygen.com/reference/list-voices-v2
- Developer Guide: https://docs.heygen.com/docs/create-video

---

## Research Findings

### API Response Structure
The `/v2/voices` endpoint returns a list of available AI voices. However, the **exact response schema with voice characteristics (gender, language, style) is not visible in the public documentation**.

### Voice Selection Criteria (Required)
Based on requirements, we need voices that are:
- ✅ **Gender:** Female or Neutral
- ✅ **Language:** English (US or UK, neutral for learning)
- ✅ **Style:** Natural, educational-suitable
- ❌ **Exclude:** Whisper, robotic, dramatic, child, seductive, narrative styles

---

## Documentation Limitations

**⚠️ IMPORTANT:** The official HeyGen API documentation does not publicly display:
- Complete response schema with all voice fields
- Voice characteristics (gender, style, emotion)
- Filtering capabilities by language/gender/style
- Example response with actual voice listings

**What IS documented:**
- Endpoint: `GET /v2/voices`
- Authentication: `X-Api-Key` header required
- Response: JSON array of voice objects
- Each voice has: `voice_id`, `name`, and other properties (not fully specified)

---

## Recommended Approach

Since the documentation doesn't provide the complete voice list with characteristics, we need to:

1. **Make a live API call** to `/v2/voices` to retrieve the actual voice list
2. **Parse the response** to extract voice characteristics
3. **Filter programmatically** based on criteria:
   - Gender: `female` OR `neutral`
   - Language: `en-US` OR `en-GB` OR `en` (English)
   - Style: Exclude keywords like "whisper", "robotic", "dramatic", "child", "seductive", "narrative"
   - Select voices with natural, educational-suitable characteristics

---

## Expected Response Structure (Inferred)

Based on standard API patterns and HeyGen's structure, the response likely contains:

```json
{
  "data": [
    {
      "voice_id": "string",
      "name": "string",
      "language": "string",        // e.g., "en-US", "en-GB"
      "locale": "string",          // e.g., "en_US", "en_GB"
      "gender": "string",          // e.g., "female", "male", "neutral"
      "style": "string",           // e.g., "natural", "narrative", etc.
      "age": "string",             // e.g., "adult", "child"
      "accent": "string",          // e.g., "american", "british"
      // ... other properties
    }
  ]
}
```

**Note:** This structure is inferred and needs to be confirmed via actual API call.

---

## Filtering Logic (To Be Implemented)

After retrieving voices from API, filter using:

```javascript
// Pseudo-code for filtering
const suitableVoices = voices.filter(voice => {
  // Gender check
  const isFemaleOrNeutral = 
    voice.gender?.toLowerCase() === 'female' || 
    voice.gender?.toLowerCase() === 'neutral';
  
  // Language check
  const isEnglish = 
    voice.language?.toLowerCase().startsWith('en') ||
    voice.locale?.toLowerCase().startsWith('en');
  
  // Style exclusion
  const excludedStyles = ['whisper', 'robotic', 'dramatic', 'child', 'seductive', 'narrative'];
  const hasExcludedStyle = excludedStyles.some(style => 
    voice.style?.toLowerCase().includes(style) ||
    voice.name?.toLowerCase().includes(style)
  );
  
  return isFemaleOrNeutral && isEnglish && !hasExcludedStyle;
});
```

---

## Next Steps

1. **Make API call** to `/v2/voices` with valid API key
2. **Inspect response structure** to understand all available fields
3. **Apply filtering logic** based on criteria
4. **Create shortlist** of suitable voices
5. **Select ONE default voice** for EduCore implementation

---

## Alternative: List All Locales Endpoint

HeyGen also provides:
```
GET https://api.heygen.com/v1/voices/locales
```

This endpoint may provide locale/language information that could help filter voices.

---

## Conclusion

**The actual voice shortlist cannot be generated from documentation alone.** A live API call is required to:
1. See the complete response structure
2. Access voice characteristics (gender, language, style)
3. Filter and create the educational voice shortlist

**Recommendation:** Implement a one-time API call during application initialization to:
- Retrieve all voices
- Filter based on criteria
- Cache the selected default voice_id for all video generations

---

## References
- List Voices API: https://docs.heygen.com/reference/list-voices-v2
- Create Video Guide: https://docs.heygen.com/docs/create-video

