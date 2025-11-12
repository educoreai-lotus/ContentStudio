import { QualityCheckService as IQualityCheckService } from '../../domain/services/QualityCheckService.js';
import { QualityCheck } from '../../domain/entities/QualityCheck.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';

/**
 * Quality Check Service Implementation
 * Uses OpenAI GPT-4o-mini for quality checks
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
    const systemPrompt = `You are an expert educational content evaluator.
Your job is to check the quality, originality, relevance, and skill alignment of trainer-written lessons.

CRITICAL: You must STRICTLY verify that the content is relevant to the lesson topic. Content that is unrelated to the topic should be REJECTED with a low relevance score.

Analyze the submitted text and evaluate it according to the following dimensions:

1. Relevance to Topic (0–100) - MOST IMPORTANT:
   - Check if the content is directly related to the lesson topic provided.
   - Content must teach or explain concepts related to the topic name.
   - If the content is about a completely different subject, give a score BELOW 60 (reject).
   - If the content only mentions the topic briefly but focuses on something else, give a score BELOW 60.
   - Higher score = content is highly relevant and directly addresses the topic.

2. Originality (0–100) - CRITICAL FOR PLAGIARISM DETECTION:
   - STRICTLY check if the content appears to be copied, plagiarized, or directly taken from official documentation, websites, or other sources.
   - Look for exact or near-exact matches of phrases, sentences, or entire paragraphs from known sources (especially official documentation like React docs, MDN, W3C, etc.).
   - Check if the writing style matches official documentation style (formal, structured, with specific terminology patterns).
   - If content appears to be copied from official sources (even if relevant), give a score BELOW 60 (reject).
   - If content has identical or very similar sentence structures to known documentation, reduce the score significantly.
   - If content uses exact terminology and phrasing patterns from official sources, treat it as potential plagiarism.
   - Higher score = completely original content written by the trainer in their own words.
   - Lower score = content that appears copied, even if it's from official/legitimate sources.

3. Difficulty Alignment (0–100):
   - Check if the text's difficulty level matches the provided skills.
   - If the skills are beginner-level but the text uses overly advanced terminology, reduce the score.

4. Consistency and Coherence (0–100):
   - Assess if the text is well-structured, logically consistent, and coherent.

5. Feedback Summary:
   - Write 2–3 short sentences describing:
     * Whether the content is relevant to the topic (CRITICAL).
     * Whether the content appears to be copied or plagiarized from official sources (CRITICAL).
     * Strengths of the content (if original).
     * Detected weaknesses or issues.
     * Any plagiarism, copying, mismatch, or irrelevance detected.
     * If plagiarism is detected, clearly state: "Content appears to be copied from [source type] and should be rewritten in the trainer's own words."

IMPORTANT RULES:
1. If the content is not relevant to the topic, you MUST:
   - Give relevance_score BELOW 60
   - Clearly state in feedback_summary that the content is not relevant to the topic
   - Explain what the content is about vs. what the topic should cover

2. If the content appears to be copied or plagiarized (even from official sources), you MUST:
   - Give originality_score BELOW 60 (reject for plagiarism)
   - Clearly state in feedback_summary that the content appears to be copied
   - Identify the type of source (official documentation, website, etc.) if detectable
   - Recommend that the trainer rewrite the content in their own words

Return ONLY a valid JSON object with this exact structure:
{
  "relevance_score": <number 0-100>,
  "originality_score": <number 0-100>,
  "difficulty_alignment_score": <number 0-100>,
  "consistency_score": <number 0-100>,
  "feedback_summary": "<2-3 sentences>"
}`;

    const userPrompt = JSON.stringify({
      courseName,
      topicName,
      skills,
      contentText: contentText.substring(0, 4000), // Limit text length for API
      instruction: `Evaluate the content above. The content MUST be:
1. Relevant to the topic "${topicName}" in the course "${courseName}". If the content is about something completely different, it should be rejected.
2. ORIGINAL and written by the trainer in their own words. If the content appears to be copied from official documentation (like React docs, MDN, W3C, etc.), websites, or any other source, it MUST be rejected for plagiarism, even if it's relevant to the topic.
3. Check carefully for exact or near-exact matches of phrases, sentences, or paragraphs from known sources.
4. If you detect copying or plagiarism, give originality_score BELOW 60 and clearly explain in feedback_summary.`
    });

    try {
      const response = await this.openaiClient.generateText(userPrompt, {
        systemPrompt,
        temperature: 0.3,
        max_tokens: 300,
      });

      // Parse JSON response
      const cleanedResponse = response.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        // Validate and normalize scores
        return {
          relevance_score: Math.max(0, Math.min(100, result.relevance_score || result.relevance || 100)), // Default to 100 for backward compatibility
          originality_score: Math.max(0, Math.min(100, result.originality_score || 75)),
          difficulty_alignment_score: Math.max(0, Math.min(100, result.difficulty_alignment_score || 75)),
          consistency_score: Math.max(0, Math.min(100, result.consistency_score || 75)),
          feedback_summary: result.feedback_summary || 'Evaluation completed.',
        };
      }

      // Fallback if JSON parsing fails
      throw new Error('Failed to parse OpenAI evaluation response');
    } catch (error) {
      console.error('[QualityCheckService] OpenAI evaluation failed:', error);
      throw new Error(`Quality evaluation failed: ${error.message}`);
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

