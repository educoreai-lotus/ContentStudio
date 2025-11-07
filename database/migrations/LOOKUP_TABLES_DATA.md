# Lookup Tables - Complete Data

## content_types Table

| type_id | type_name | display_name | description | is_mandatory | sort_order | requires_ai | requires_external_api | external_api_provider |
|---------|-----------|--------------|-------------|--------------|------------|-------------|----------------------|----------------------|
| 1 | text | Text Content | Written text content for lessons, explanations, and educational material | TRUE | 1 | TRUE | FALSE | NULL |
| 2 | code | Code Example | Programming code examples, snippets, and demonstrations | TRUE | 2 | TRUE | FALSE | NULL |
| 3 | presentation | Presentation | Slide presentations and visual content (Google Slides integration) | TRUE | 3 | TRUE | TRUE | google_slides |
| 4 | audio | Audio Narration | Audio recordings, narration, and spoken content (must be with text) | TRUE | 4 | TRUE | FALSE | NULL |
| 5 | mind_map | Mind Map | Visual mind maps and concept diagrams (Gemini AI generation) | TRUE | 5 | TRUE | TRUE | gemini |
| 6 | avatar_video | Avatar Video | AI-generated avatar videos for lessons (HeyGen integration, optional) | FALSE | 6 | TRUE | TRUE | heygen |

## generation_methods Table

| method_id | method_name | display_name | description | requires_video_input | requires_ai | requires_manual_input | is_active |
|-----------|-------------|--------------|-------------|---------------------|-------------|----------------------|-----------|
| 1 | manual | Manual Creation | Content created manually by trainer without AI assistance | FALSE | FALSE | TRUE | TRUE |
| 2 | ai_assisted | AI-Assisted | Content generated with AI assistance (OpenAI, Gemini) | FALSE | TRUE | FALSE | TRUE |
| 3 | video_to_lesson | Video to Lesson | Content automatically generated from video input using transcription and AI | TRUE | TRUE | FALSE | TRUE |

## Notes

- **Mandatory Content Types**: text, code, presentation, audio, mind_map (5 types)
- **Optional Content Types**: avatar_video
- **Audio Rule**: Audio must always be with text (before or immediately after)
- **All Active**: All generation methods are currently active

## Adding New Types

To add a new content type:
```sql
INSERT INTO content_types (type_name, display_name, description, is_mandatory, sort_order, requires_ai, requires_external_api, external_api_provider) 
VALUES ('new_type', 'New Type', 'Description', FALSE, 7, TRUE, FALSE, NULL);
```

To add a new generation method:
```sql
INSERT INTO generation_methods (method_name, display_name, description, requires_video_input, requires_ai, requires_manual_input, is_active) 
VALUES ('new_method', 'New Method', 'Description', FALSE, TRUE, FALSE, TRUE);
```

