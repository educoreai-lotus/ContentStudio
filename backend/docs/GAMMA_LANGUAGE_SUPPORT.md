# Gamma Language Support Documentation

## Overview

Gamma in Content Studio supports all languages with automatic RTL (Right-to-Left) detection and language rules injection to ensure:

1. **No Translation**: Content remains in the exact original language
2. **Correct Text Direction**: RTL languages (Arabic, Hebrew, Persian, Urdu) use RIGHT-TO-LEFT layout
3. **Content Preservation**: Trainer/learner content is never modified or translated

## Implementation

### RTL Language Detection

```javascript
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];
const isRTL = (language) => RTL_LANGUAGES.includes(normalizeLanguage(language));
```

### Language Rules Injection

Every Gamma API request includes language rules before the actual content:

```
IMPORTANT — LANGUAGE RULES:

1) Do NOT translate the text. Keep all content in the exact original language.

2) The presentation MUST be fully written in {language}.

3) If {language} is an RTL language, you MUST use {RIGHT-TO-LEFT|LEFT-TO-RIGHT} layout.

4) All elements (titles, bullets, paragraphs, tables) MUST follow the selected language direction.

5) Do NOT mix English words unless they are programming syntax or technical names.

6) The tone must stay educational and clear, suitable for teaching.

---

{original_content}
```

## Supported Languages

### RTL Languages
- **Arabic** (`ar`, `ar-SA`, `ar-EG`, `Arabic`)
- **Hebrew** (`he`, `he-IL`, `Hebrew`)
- **Persian/Farsi** (`fa`, `fa-IR`, `Persian`, `Farsi`)
- **Urdu** (`ur`, `ur-PK`, `Urdu`)

### LTR Languages
- **English** (`en`, `en-US`, `en-GB`, `English`)
- **Spanish** (`es`, `es-ES`, `es-MX`, `Spanish`)
- **French** (`fr`, `fr-FR`, `French`)
- **German** (`de`, `de-DE`, `German`)
- **Italian** (`it`, `it-IT`, `Italian`)
- **Japanese** (`ja`, `ja-JP`, `Japanese`)
- **Chinese** (`zh`, `zh-CN`, `zh-TW`, `Chinese`)
- **Korean** (`ko`, `ko-KR`, `Korean`)

### Unknown Languages
- Defaults to LTR layout
- Language rules still injected to prevent translation

## Usage

```javascript
const language = config.language || 'en';
const isRTL = RTL_LANGUAGES.includes(language.toLowerCase());

// Language rules are automatically injected in GammaClient.generatePresentation()
const result = await gammaClient.generatePresentation(inputText, {
  topicName: 'My Topic',
  language: language, // e.g., 'he', 'ar', 'en', 'es'
  audience: 'students',
});
```

## Testing

All language scenarios are tested:

- ✅ RTL language detection (`ar`, `he`, `fa`, `ur`)
- ✅ LTR language detection (`en`, `es`, `fr`, `de`, `it`, `ja`, `zh`, `ko`)
- ✅ Language normalization (variants like `he-IL` → `he`)
- ✅ Language rules injection for all languages
- ✅ Content preservation (no translation)
- ✅ Unknown language handling (defaults to LTR)

## Summary

**Gamma in Content Studio supports all languages. The system enforces exact content (no translation), applies the correct text direction (RTL/LTR), and maintains the educator's original tone and language.**

