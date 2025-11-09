-- Seed default templates with mandatory format order (text + audio paired)
INSERT INTO templates (template_name, template_type, created_by, format_order)
SELECT 'Foundational Learning Flow', 'ready_template', 'system',
       '["text","audio","presentation","code","mind_map"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_name = 'Foundational Learning Flow'
);

INSERT INTO templates (template_name, template_type, created_by, format_order)
SELECT 'Hands-On Coding Sprint', 'ready_template', 'system',
       '["text","audio","code","presentation","mind_map"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_name = 'Hands-On Coding Sprint'
);

INSERT INTO templates (template_name, template_type, created_by, format_order)
SELECT 'Visual Storytelling Journey', 'ready_template', 'system',
       '["text","audio","mind_map","presentation","code"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_name = 'Visual Storytelling Journey'
);

INSERT INTO templates (template_name, template_type, created_by, format_order)
SELECT 'Workshop Collaboration Loop', 'ready_template', 'system',
       '["text","audio","presentation","mind_map","code"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_name = 'Workshop Collaboration Loop'
);

INSERT INTO templates (template_name, template_type, created_by, format_order)
SELECT 'Assessment Ready Sequence', 'ready_template', 'system',
       '["text","audio","code","mind_map","presentation"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_name = 'Assessment Ready Sequence'
);

INSERT INTO templates (template_name, template_type, created_by, format_order)
SELECT 'Immersive Video Kickoff', 'ready_template', 'system',
       '["text","audio","avatar_video","presentation","code","mind_map"]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_name = 'Immersive Video Kickoff'
);

