# Coordinator Fix: Parse JSON string in response.answer before mapping

## Problem Description

When `devlab-service` returns a response, it sends the answer as a JSON stringified object in `response.answer`:

```javascript
{
  requester_service: "content-studio",
  payload: {...},
  response: {
    answer: `{"success":true,"request_id":"...","data":{"html":"...","questions":[...]},"metadata":{...}}`
  }
}
```

The Coordinator's `mapResponseToTemplate` function currently treats `response.answer` as a plain string and maps it directly to `data.answer` in the final response. However, when `response.answer` is a JSON string (not a plain string), the Coordinator should parse it first to extract the actual answer content.

Currently, when the Coordinator cannot find the expected field structure, it falls back to using the requester service name (`"content-studio"`) as the answer, which is incorrect.

## Solution: Backward Compatible JSON Parsing

Modify the `mapResponseToTemplate` function in the Coordinator to:

1. **Check if `response.answer` is a JSON string** (starts with `{` or `[`)
2. **Parse it if it's JSON** and extract the actual answer content
3. **Fall back to original behavior** if parsing fails or if it's not JSON (backward compatible)

## Implementation Details

### Location
File: The file containing `mapResponseToTemplate` function (likely in the routing/mapping logic)

### Code Changes

In the `mapResponseToTemplate` function, when processing `response.answer`:

```javascript
// Find the section where responseTemplate.answer is being mapped
// It should look something like:
// mappedResponse.answer = targetResponse.response?.answer || responseTemplate.answer;

// Replace with:
let answerValue = targetResponse.response?.answer;

// NEW: If answer is a JSON string, parse it and extract the actual content
if (answerValue && typeof answerValue === 'string') {
  // Check if it looks like JSON (starts with { or [)
  const trimmed = answerValue.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(answerValue);
      
      // Extract the actual answer based on common devlab-service response structure
      // devlab-service returns: { success: true, data: { html: "...", questions: [...] }, metadata: {...} }
      if (parsed.data?.html && typeof parsed.data.html === 'string') {
        // Priority 1: Use HTML if available (this is the rendered exercise code)
        answerValue = parsed.data.html;
      } else if (parsed.data && typeof parsed.data === 'object') {
        // Priority 2: Use the data object as JSON string (contains questions, etc.)
        answerValue = JSON.stringify(parsed.data);
      } else if (parsed.success !== undefined) {
        // Priority 3: Use the entire parsed object as JSON string
        answerValue = JSON.stringify(parsed);
      }
      // If none of the above, answerValue remains the original string (fallback)
    } catch (parseError) {
      // If JSON parsing fails, keep the original value (backward compatible)
      // This ensures existing services that send plain strings continue to work
      // Log the error for debugging but don't throw
      console.warn('[Coordinator] Failed to parse response.answer as JSON, using as-is:', parseError.message);
    }
  }
  // If it doesn't look like JSON, answerValue remains unchanged (backward compatible)
}

// Use the processed answerValue
mappedResponse.answer = answerValue || responseTemplate.answer;
```

## Backward Compatibility

This solution is **fully backward compatible** because:

1. **Existing services that return plain strings** - The code only attempts JSON parsing if the string starts with `{` or `[`. Plain strings remain unchanged.

2. **Existing services that return objects** - If `response.answer` is already an object (not a string), the `typeof` check prevents parsing, and the original logic continues.

3. **Parse failures** - If JSON parsing fails, the original string value is used, ensuring no breaking changes.

4. **No changes to response structure** - The final response structure remains the same: `{ success: true, data: { answer: "..." }, metadata: {...} }`

## Testing Requirements

After implementing this fix, test with:

1. **devlab-service** - Should now correctly extract HTML from JSON stringified answer
2. **Other services with plain string answers** - Should continue working as before
3. **Other services with object answers** - Should continue working as before
4. **Invalid JSON strings** - Should fall back to using the string as-is

## Expected Behavior

**Before fix:**
- devlab-service sends: `response.answer = '{"success":true,"data":{"html":"..."}}'`
- Coordinator maps: `data.answer = '{"success":true,"data":{"html":"..."}}'` (or falls back to "content-studio")
- Content Studio receives: `"content-studio"` ❌

**After fix:**
- devlab-service sends: `response.answer = '{"success":true,"data":{"html":"..."}}'`
- Coordinator parses JSON and extracts: `data.answer = "..."` (the HTML content)
- Content Studio receives: The actual HTML code ✅

## Additional Notes

- This fix only affects the mapping logic, not the routing or signature verification
- All existing microservices will continue to work without changes
- The fix is defensive and handles edge cases gracefully
- Consider adding logging to track when JSON parsing is used for monitoring

