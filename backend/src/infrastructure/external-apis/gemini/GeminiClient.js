import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Client
 * Handles communication with Google Gemini API
 * Used for mind map generation
 */
export class GeminiClient {
  constructor({ apiKey, googleClientId, googleClientSecret, googleProjectId }) {
    // Support both direct API key and Google OAuth credentials
    if (!apiKey && !googleProjectId) {
      throw new Error('Gemini API key or Google Project ID is required');
    }
    
    // Use API key if provided (simpler, preferred)
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      // For OAuth, we still need an API key for Generative AI
      // Note: Google Generative AI SDK primarily uses API keys
      // OAuth is typically for other Google APIs (like Slides)
      throw new Error('Gemini API key is required. Google OAuth credentials are for other Google APIs.');
    }
  }

  /**
   * Generate content using Gemini
   * @param {string} prompt - Generation prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated content
   */
  async generate(prompt, options = {}) {
    try {
      // Use gemini-pro (most widely available free model)
      const model = options.model || 'gemini-pro';
      const genModel = this.genAI.getGenerativeModel({ model });

      const generationConfig = {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.max_tokens || 2000,
      };

      const result = await genModel.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      });

      const response = await result.response;
      return response.text() || '';
    } catch (error) {
      throw new Error(`Failed to generate with Gemini: ${error.message}`);
    }
  }

  /**
   * Generate mind map structure
   * @param {string} topicText - Topic text to analyze (legacy support)
   * @param {Object} options - Generation options
   * @param {string} options.topic_title - Topic title
   * @param {Array<string>} options.skills - List of skills (for understanding only)
   * @param {string} options.trainer_prompt - Trainer's specific prompt/description
   * @returns {Promise<Object>} Mind map JSON structure
   */
  async generateMindMap(topicText, options = {}) {
    // Extract variables from options or use topicText as fallback
    const topic_title = options.topic_title || topicText || 'Untitled Topic';
    const skills = Array.isArray(options.skills) ? options.skills : [];
    const trainer_prompt = options.trainer_prompt || options.lessonDescription || '';

    const prompt = `You are an expert educational Knowledge-Graph MindMap Generator.

Your task is to convert:
• the topic_title: "${topic_title}"
• the list of skills (for understanding only): ${JSON.stringify(skills)}
• the trainer_prompt: "${trainer_prompt}"

into a clear, professional conceptual MindMap.

IMPORTANT:
This is NOT a tree and NOT a hierarchy.
This is a radial knowledge map with conceptual clusters and semantic connections.

===============================
     OUTPUT FORMAT (JSON)
===============================

Return ONLY valid JSON:

{
  "nodes": [
    {
      "id": "string",
      "type": "concept",
      "data": {
        "label": "Concept Name",
        "description": "Short, accurate educational definition",
        "group": "core | primary | secondary | related | advanced"
      },
      "position": { "x": 0, "y": 0 },
      "style": {
        "backgroundColor": "HEX",
        "borderRadius": 12
      }
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "node_id",
      "target": "node_id",
      "type": "smoothstep",
      "label": "explains | relates-to | depends-on | part-of | similar-to | leads-to",
      "animated": true
    }
  ]
}

===============================
     RULES (NOT A TREE!)
===============================

1. Place the topic_title in the center (group: core).

2. Create conceptual clusters, NOT levels:
   - primary concepts (closest to the core)
   - secondary concepts (expansions of primary)
   - related concepts (side-connections)
   - advanced concepts (deep insight)

3. No hierarchy. No parent-child.
   Use semantic connections only.

4. Colors by group:
   - core: "#E3F2FD"
   - primary: "#FFF3E0"
   - secondary: "#E8F5E9"
   - related: "#F3E5F5"
   - advanced: "#FCE4EC"

5. Every connection (edge) must have meaning:
   explains / relates-to / part-of / similar-to / depends-on / leads-to

6. Return 12–20 total concepts.

7. Skills are used only to help interpret the topic, never included in the JSON.

8. Output JSON ONLY (no text, no markdown).

Generate a radial non-hierarchical MindMap as described above.
Return ONLY the JSON.`;

    try {
      const response = await this.generate(prompt, {
        temperature: 0.3, // Lower temperature for more structured output
        max_tokens: 4000, // Increased for more concepts
      });

      // Parse JSON response
      const cleanedResponse = response.trim();
      // Remove markdown code blocks if present
      const jsonMatch = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                       cleanedResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                       cleanedResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonText);
      }

      throw new Error('Invalid JSON response from Gemini');
    } catch (error) {
      throw new Error(`Failed to generate mind map: ${error.message}`);
    }
  }
}

