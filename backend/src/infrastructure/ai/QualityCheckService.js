import { QualityCheckService as IQualityCheckService } from '../../domain/services/QualityCheckService.js';
import { QualityCheck } from '../../domain/entities/QualityCheck.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';

/**
 * Quality Check Service Implementation
 * Uses OpenAI GPT-4o for quality checks (more accurate plagiarism detection)
 */
export class QualityCheckService extends IQualityCheckService {
  constructor({ openaiApiKey, qualityCheckRepository, contentRepository, topicRepository, courseRepository }) {
    super();
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    this.qualityCheckRepository = qualityCheckRepository;
    this.contentRepository = contentRepository;
    this.topicRepository = topicRepository;
    this.courseRepository = courseRepository;
  }

  async triggerQualityCheck(contentId, checkType = 'full') {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not configured');
    }

    // Create quality check record
    const qualityCheck = new QualityCheck({
      content_id: contentId,
      check_type: checkType,
      status: 'processing',
    });

    const savedCheck = await this.qualityCheckRepository.create(qualityCheck);

    try {
      // Get content for checking
      const content = await this.contentRepository.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      const contentText = this.extractTextFromContent(content);
      if (!contentText) {
        throw new Error('Content text not found');
      }

      // Get topic and course information for evaluation
      const topic = await this.topicRepository?.findById(content.topic_id);
      if (!topic) {
        throw new Error('Topic not found');
      }

      let courseName = null;
      if (topic.course_id && this.courseRepository) {
        const course = await this.courseRepository.findById(topic.course_id);
        courseName = course?.course_name || null;
      }

      // Extract skills from topic
      const skills = Array.isArray(topic.skills) ? topic.skills : (topic.skills ? [topic.skills] : []);

      // Perform OpenAI evaluation with new format
      const evaluationResult = await this.evaluateContentWithOpenAI({
        courseName: courseName || 'General Course',
        topicName: topic.topic_name || 'Untitled Topic',
        skills: skills,
        contentText: contentText,
      });

      // Validate scores - reject if any score < 60
      // CRITICAL: Check relevance first - this is the most important check
      const relevanceScore = evaluationResult.relevance_score || evaluationResult.relevance || 100; // Default to 100 if not provided (backward compatibility)
      if (relevanceScore < 60) {
        throw new Error(
          `Content failed quality check: Content is not relevant to the lesson topic (Relevance: ${relevanceScore}/100). ${evaluationResult.feedback_summary || 'The content does not match the lesson topic. Please ensure your content is directly related to the topic.'}`
        );
      }

      if (evaluationResult.originality_score < 60) {
        throw new Error(
          `Content failed quality check: Content appears to be copied or plagiarized (Originality: ${evaluationResult.originality_score}/100). ${evaluationResult.feedback_summary || 'Please rewrite the content in your own words. Copying from official sources or other materials is not allowed.'}`
        );
      }

      if (evaluationResult.difficulty_alignment_score < 60) {
        throw new Error(
          `Content failed quality check: Difficulty level mismatch (${evaluationResult.difficulty_alignment_score}/100). ${evaluationResult.feedback_summary || 'Please adjust the difficulty level to match the target skills.'}`
        );
      }

      if (evaluationResult.consistency_score < 60) {
        throw new Error(
          `Content failed quality check: Low consistency score (${evaluationResult.consistency_score}/100). ${evaluationResult.feedback_summary || 'Please improve the structure and coherence of your content.'}`
        );
      }

      // Store results in the format expected by QualityCheck entity
      const results = {
        relevance_score: relevanceScore,
        originality_score: evaluationResult.originality_score,
        difficulty_alignment_score: evaluationResult.difficulty_alignment_score,
        consistency_score: evaluationResult.consistency_score,
        feedback_summary: evaluationResult.feedback_summary,
      };

      // Calculate overall score (average of all four scores, with relevance weighted more)
      const overallScore = Math.round(
        (relevanceScore * 0.4 + // Relevance is most important (40% weight)
          evaluationResult.originality_score * 0.2 +
          evaluationResult.difficulty_alignment_score * 0.2 +
          evaluationResult.consistency_score * 0.2)
      );

      // Update quality check
      savedCheck.markCompleted(results, overallScore);
      await this.qualityCheckRepository.update(savedCheck.quality_check_id, {
        status: savedCheck.status,
        results: savedCheck.results,
        score: savedCheck.score,
        completed_at: savedCheck.completed_at,
      });

      console.log('[QualityCheckService] Quality check completed:', {
        contentId,
        relevance_score: relevanceScore,
        originality_score: evaluationResult.originality_score,
        difficulty_alignment_score: evaluationResult.difficulty_alignment_score,
        consistency_score: evaluationResult.consistency_score,
        overallScore,
      });

      return savedCheck;
    } catch (error) {
      savedCheck.markFailed(error.message);
      await this.qualityCheckRepository.update(savedCheck.quality_check_id, {
        status: savedCheck.status,
        error_message: savedCheck.error_message,
        completed_at: savedCheck.completed_at,
      });
      throw error;
    }
  }

  async evaluateContentWithOpenAI({ courseName, topicName, skills, contentText }) {
    const systemPrompt = `You are an educational content quality inspector.

Your evaluation must be STRICT, but ONLY based on the text itself.

You do NOT search the internet.

Detect plagiarism ONLY when the text contains:

- Clear copy/paste sentences

- Near-identical structure to known documentation

- Paragraphs that read like official docs word-for-word

Do NOT flag plagiarism for:

- Using standard terminology

- Being correct

- Having a structured or formal explanation

- Using concepts required for the topic

Scoring rules:

- If content is NOT relevant → relevance_score < 60

- If plagiarism is detected → originality_score < 60

- If text feels trainer-written → originality_score 70–100

- When unsure → prefer higher originality (avoid false positives)

Evaluate four dimensions: relevance, originality, difficulty alignment, consistency.

Return ONLY valid JSON:

{
  "relevance_score": number,
  "originality_score": number,
  "difficulty_alignment_score": number,
  "consistency_score": number,
  "feedback_summary": "2-3 short sentences"
}`;

    const userPrompt = `Evaluate the following educational content.

Topic: ${topicName}

Course: ${courseName}

Required skills: ${JSON.stringify(skills)}

Content:

"""
${contentText.substring(0, 4000)}
"""

Rules:

1. The content must be directly relevant to the topic.

2. Detect plagiarism ONLY if entire sentences/paragraphs appear copied.

3. Using standard terminology is NOT plagiarism.

4. Score originality high if writing feels original even if technical.

5. Assign difficulty based on skills.

6. Return JSON only.`;

    try {
      const response = await this.openaiClient.generateText(userPrompt, {
        systemPrompt,
        model: 'gpt-4o', // Use GPT-4o for better plagiarism detection accuracy
        temperature: 0.25,
        max_tokens: 350,
      });

      const cleaned = response.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("Invalid JSON returned by OpenAI");
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        relevance_score: Math.max(0, Math.min(100, result.relevance_score || result.relevance || 100)),
        originality_score: Math.max(0, Math.min(100, result.originality_score || 75)),
        difficulty_alignment_score: Math.max(0, Math.min(100, result.difficulty_alignment_score || 75)),
        consistency_score: Math.max(0, Math.min(100, result.consistency_score || 75)),
        feedback_summary: result.feedback_summary || 'Evaluation completed.',
      };
    } catch (err) {
      console.error("[QualityCheck] Evaluation failed:", err);
      throw new Error("Evaluation failed: " + err.message);
    }
  }

  extractTextFromContent(content) {
    // Extract text from content_data
    if (typeof content.content_data === 'string') {
      try {
        const parsed = JSON.parse(content.content_data);
        return parsed.text || parsed.code || JSON.stringify(parsed);
      } catch {
        return content.content_data;
      }
    }
    
    if (content.content_data?.text) {
      return content.content_data.text;
    }
    
    if (content.content_data?.code) {
      return content.content_data.code;
    }
    
    return JSON.stringify(content.content_data);
  }

  async checkClarity(contentText) {
    const prompt = `Evaluate the clarity of the following educational content on a scale of 0-100.
Consider: language clarity, sentence structure, explanation quality, and readability.

Content:
${contentText.substring(0, 3000)}

Return only a number between 0-100 representing the clarity score.`;

    try {
      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are an educational content quality evaluator. Return only numeric scores.',
        temperature: 0.3,
        max_tokens: 50,
      });

      const score = parseInt(response.trim());
      return isNaN(score) ? 75 : Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Clarity check failed:', error);
      return 75; // Default score
    }
  }

  async checkStructure(contentText) {
    const prompt = `Evaluate the structure of the following educational content on a scale of 0-100.
Consider: organization, logical flow, section headings, and coherence.

Content:
${contentText.substring(0, 3000)}

Return only a number between 0-100 representing the structure score.`;

    try {
      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are an educational content quality evaluator. Return only numeric scores.',
        temperature: 0.3,
        max_tokens: 50,
      });

      const score = parseInt(response.trim());
      return isNaN(score) ? 75 : Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Structure check failed:', error);
      return 75; // Default score
    }
  }

  async checkOriginality(contentText) {
    const prompt = `Check the originality of the following content. Analyze if it appears to be plagiarized or copied from other sources.
Consider: unique phrasing, original ideas, and distinctive writing style.

Content:
${contentText.substring(0, 3000)}

Return a JSON object with:
- "score": number (0-100, higher is more original)
- "plagiarism_detected": boolean
- "sources": array of potential source descriptions (if any)

Return only valid JSON.`;

    try {
      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt:
          'You are a plagiarism detection system. Return only valid JSON with score, plagiarism_detected, and sources fields.',
        temperature: 0.3,
        max_tokens: 200,
      });

      // Parse JSON response
      const cleanedResponse = response.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          score: result.score || 85,
          plagiarism_detected: result.plagiarism_detected || false,
          sources: result.sources || [],
        };
      }

      // Fallback if JSON parsing fails
      return {
        score: 85,
        plagiarism_detected: false,
        sources: [],
      };
    } catch (error) {
      console.error('Originality check failed:', error);
      return {
        score: 85,
        plagiarism_detected: false,
        sources: [],
      };
    }
  }

  async checkDifficultyMatch(contentText, targetDifficulty) {
    const prompt = `Evaluate if the following content matches the target difficulty level "${targetDifficulty}" on a scale of 0-100.
Consider: vocabulary complexity, concept depth, and explanation detail.

Content:
${contentText.substring(0, 3000)}

Target Difficulty: ${targetDifficulty}

Return only a number between 0-100 representing the difficulty match score.`;

    try {
      const response = await this.openaiClient.generateText(prompt, {
        systemPrompt: 'You are an educational content quality evaluator. Return only numeric scores.',
        temperature: 0.3,
        max_tokens: 50,
      });

      const score = parseInt(response.trim());
      return isNaN(score) ? 75 : Math.max(0, Math.min(100, score));
    } catch (error) {
      console.error('Difficulty match check failed:', error);
      return 75; // Default score
    }
  }

  calculateOverallScore(results) {
    const weights = {
      clarity: 0.3,
      structure: 0.25,
      originality: 0.25,
      difficulty_match: 0.2,
    };

    let totalScore = 0;
    let totalWeight = 0;

    if (results.clarity !== undefined) {
      totalScore += results.clarity * weights.clarity;
      totalWeight += weights.clarity;
    }

    if (results.structure !== undefined) {
      totalScore += results.structure * weights.structure;
      totalWeight += weights.structure;
    }

    if (results.originality !== undefined) {
      totalScore += results.originality * weights.originality;
      totalWeight += weights.originality;
    }

    if (results.difficulty_match !== undefined) {
      totalScore += results.difficulty_match * weights.difficulty_match;
      totalWeight += weights.difficulty_match;
    }

    // Penalize if plagiarism detected
    if (results.plagiarism_detected === true) {
      totalScore *= 0.5;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : null;
  }

}

