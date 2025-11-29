import { QualityCheckService as IQualityCheckService } from '../../domain/services/QualityCheckService.js';
import { QualityCheck } from '../../domain/entities/QualityCheck.js';
import { OpenAIClient } from '../external-apis/openai/OpenAIClient.js';
import { pushStatus } from '../../application/utils/StatusMessages.js';
import { FileTextExtractor } from '../../services/FileTextExtractor.js';

/**
 * Quality Check Service Implementation
 * Uses OpenAI GPT-4o for quality checks (more accurate plagiarism detection)
 * 
 * IMPORTANT: Always uses GPT-4o for manual content quality checks to ensure:
 * - Accurate plagiarism detection from official documentation
 * - Better understanding of technical content
 * - Reliable JSON response parsing
 */
export class QualityCheckService extends IQualityCheckService {
  // Always use GPT-4o for quality checks - required for accurate plagiarism detection
  static QUALITY_CHECK_MODEL = 'gpt-4o';
  
  constructor({ openaiApiKey, qualityCheckRepository, contentRepository, topicRepository, courseRepository }) {
    super();
    this.openaiClient = openaiApiKey ? new OpenAIClient({ apiKey: openaiApiKey }) : null;
    this.qualityCheckRepository = qualityCheckRepository;
    this.contentRepository = contentRepository;
    this.topicRepository = topicRepository;
    this.courseRepository = courseRepository;
  }

  /**
   * Validate content quality BEFORE saving to DB
   * This performs the quality check without saving content to DB first
   * @param {Object} content - Content object to validate (not yet saved to DB)
   * @param {number} topicId - Topic ID for context
   * @param {Array} statusMessages - Optional status messages array
   * @returns {Promise<Object>} Quality check results if validation passes
   * @throws {Error} If quality check fails
   */
  async validateContentQualityBeforeSave(content, topicId, statusMessages = null) {
    console.log('[QualityCheckService] 🔍 Validating content quality BEFORE saving to DB:', {
      topic_id: topicId,
      content_type_id: content.content_type_id,
    });
    
    if (!this.openaiClient) {
      console.error('[QualityCheckService] ❌ OpenAI client not configured');
      throw new Error('OpenAI client not configured');
    }

    console.log('[QualityCheckService] ✅ OpenAI client is configured, proceeding with quality check');
    
    if (statusMessages) {
      pushStatus(statusMessages, 'Examining content originality...');
    }

    try {
      const contentText = await this.extractTextFromContent(content);
      if (!contentText || contentText.trim().length === 0) {
        console.error('[QualityCheckService] ❌ Content text is empty or not found', {
          topicId,
          contentTypeId: content.content_type_id,
          contentDataKeys: content.content_data ? Object.keys(content.content_data) : [],
        });
        throw new Error('Content text not found or empty');
      }
      
      console.log('[QualityCheckService] ✅ Extracted content text for quality check', {
        topicId,
        contentTypeId: content.content_type_id,
        textLength: contentText.length,
        textPreview: contentText.substring(0, 100),
      });

      // Get topic and course information for evaluation
      const topic = await this.topicRepository?.findById(topicId);
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
        statusMessages: statusMessages,
      });

      // Validate scores - reject if relevance/difficulty/consistency < 60, originality < 75
      // CRITICAL: Check relevance first - this is the most important check
      // IMPORTANT: Originality threshold is 75 (not 60) to catch content that resembles official documentation
      // CRITICAL: Use nullish coalescing (??) instead of || to handle 0 values correctly
      // 0 is a valid score and should not be treated as falsy
      // CRITICAL: If relevance_score is undefined, we cannot proceed - must reject
      const relevanceScore = evaluationResult.relevance_score ?? evaluationResult.relevance;
      
      console.log('[QualityCheckService] 🔍 Relevance score validation (validateContentQualityBeforeSave):', {
        evaluationResult_relevance_score: evaluationResult.relevance_score,
        evaluationResult_relevance: evaluationResult.relevance,
        relevanceScore,
        type: typeof relevanceScore,
        isUndefined: relevanceScore === undefined,
        isNull: relevanceScore === null,
        isLessThan60: typeof relevanceScore === 'number' ? relevanceScore < 60 : 'N/A',
        willReject: relevanceScore === undefined || relevanceScore === null || (typeof relevanceScore === 'number' && relevanceScore < 60),
      });
      
      // CRITICAL: Check if relevance_score is missing, null, or less than 60
      if (relevanceScore === undefined || relevanceScore === null || (typeof relevanceScore === 'number' && relevanceScore < 60)) {
        const actualScore = relevanceScore ?? 0;
        const errorMsg = `Content failed quality check: Content is not relevant to the lesson topic (Relevance: ${actualScore}/100). ${evaluationResult.feedback_summary || 'The content does not match the lesson topic. Please ensure your content is directly related to the topic.'}`;
        console.error('[QualityCheckService] ❌ REJECTING CONTENT - Relevance check failed (validateContentQualityBeforeSave):', {
          actualScore,
          relevanceScore,
          errorMsg,
        });
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }
      
      console.log('[QualityCheckService] ✅ Relevance check passed (validateContentQualityBeforeSave):', { relevanceScore });

      if (statusMessages) {
        pushStatus(statusMessages, 'Checking difficulty alignment...');
      }

      // Reject content if originality score is below 75 (stricter threshold to catch content that resembles official documentation)
      // CRITICAL: Use nullish coalescing to handle 0 values correctly
      // CRITICAL: If originality_score is undefined, we cannot proceed - must reject
      const originalityScore = evaluationResult.originality_score;
      if (originalityScore === undefined || originalityScore === null || (typeof originalityScore === 'number' && originalityScore < 75)) {
        const actualScore = originalityScore ?? 0;
        const errorMsg = `Content failed quality check: Content appears to be copied or plagiarized (Originality: ${actualScore}/100). ${evaluationResult.feedback_summary || 'Please rewrite the content in your own words. Copying from official sources or other materials is not allowed. Content that closely resembles official documentation will be rejected.'}`;
        console.error('[QualityCheckService] ❌ REJECTING CONTENT - Originality check failed:', { actualScore, originalityScore });
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      // CRITICAL: Use nullish coalescing to handle 0 values correctly
      // CRITICAL: If difficulty_alignment_score is undefined, we cannot proceed - must reject
      const difficultyScore = evaluationResult.difficulty_alignment_score;
      if (difficultyScore === undefined || difficultyScore === null || (typeof difficultyScore === 'number' && difficultyScore < 60)) {
        const actualScore = difficultyScore ?? 0;
        const errorMsg = `Content failed quality check: Difficulty level mismatch (${actualScore}/100). ${evaluationResult.feedback_summary || 'Please adjust the difficulty level to match the target skills.'}`;
        console.error('[QualityCheckService] ❌ REJECTING CONTENT - Difficulty check failed:', { actualScore, difficultyScore });
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      if (statusMessages) {
        pushStatus(statusMessages, 'Checking structure and consistency...');
      }

      // CRITICAL: Use nullish coalescing to handle 0 values correctly
      // CRITICAL: If consistency_score is undefined, we cannot proceed - must reject
      const consistencyScore = evaluationResult.consistency_score;
      if (consistencyScore === undefined || consistencyScore === null || (typeof consistencyScore === 'number' && consistencyScore < 60)) {
        const actualScore = consistencyScore ?? 0;
        const errorMsg = `Content failed quality check: Low consistency score (${actualScore}/100). ${evaluationResult.feedback_summary || 'Please improve the structure and coherence of your content.'}`;
        console.error('[QualityCheckService] ❌ REJECTING CONTENT - Consistency check failed:', { actualScore, consistencyScore });
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      // Calculate overall score (average of all four scores, with relevance weighted more)
      const overallScore = Math.round(
        (relevanceScore * 0.4 + // Relevance is most important (40% weight)
          originalityScore * 0.2 +
          difficultyScore * 0.2 +
          consistencyScore * 0.2)
      );

      // Return quality check results (will be saved after content is saved to DB)
      const results = {
        relevance_score: relevanceScore,
        originality_score: originalityScore,
        difficulty_alignment_score: difficultyScore,
        consistency_score: consistencyScore,
        overall_score: overallScore,
        feedback_summary: evaluationResult.feedback_summary,
      };

      console.log('[QualityCheckService] ✅ Quality check validation passed:', {
        topicId,
        relevance_score: relevanceScore,
        originality_score: originalityScore,
        difficulty_alignment_score: difficultyScore,
        consistency_score: consistencyScore,
        overallScore,
      });

      return results;
    } catch (error) {
      if (statusMessages) {
        pushStatus(statusMessages, `Quality check failed: ${error.message}`);
      }
      console.error('[QualityCheckService] ❌ Quality check validation failed:', error.message);
      throw error;
    }
  }

  async triggerQualityCheck(contentId, checkType = 'full', statusMessages = null) {
    console.log(`[QualityCheckService] 🔍 Triggering quality check for content: ${contentId}, type: ${checkType}`);
    
    if (!this.openaiClient) {
      console.error('[QualityCheckService] ❌ OpenAI client not configured');
      throw new Error('OpenAI client not configured');
    }

    console.log('[QualityCheckService] ✅ OpenAI client is configured, proceeding with quality check');
    
    if (statusMessages) {
      pushStatus(statusMessages, 'Examining content originality...');
    }

    // Create quality check record
    const qualityCheck = new QualityCheck({
      content_id: contentId,
      check_type: checkType,
      status: 'processing',
    });

    console.log('[QualityCheckService] 📝 Creating quality check record in database');
    const savedCheck = await this.qualityCheckRepository.create(qualityCheck);
    console.log('[QualityCheckService] ✅ Quality check record created:', savedCheck.quality_check_id);

    try {
      // Get content for checking
      const content = await this.contentRepository.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      const contentText = await this.extractTextFromContent(content);
      if (!contentText || contentText.trim().length === 0) {
        console.error('[QualityCheckService] ❌ Content text is empty or not found', {
          contentId,
          contentTypeId: content.content_type_id,
          contentDataKeys: content.content_data ? Object.keys(content.content_data) : [],
        });
        throw new Error('Content text not found or empty');
      }
      
      console.log('[QualityCheckService] ✅ Extracted content text for quality check', {
        contentId,
        contentTypeId: content.content_type_id,
        textLength: contentText.length,
        textPreview: contentText.substring(0, 100),
      });

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
        statusMessages: statusMessages,
      });

      // Validate scores - reject if relevance/difficulty/consistency < 60, originality < 75
      // CRITICAL: Check relevance first - this is the most important check
      // IMPORTANT: Originality threshold is 75 (not 60) to catch content that resembles official documentation
      // CRITICAL: Use nullish coalescing (??) instead of || to handle 0 values correctly
      // 0 is a valid score and should not be treated as falsy
      // CRITICAL: If relevance_score is undefined, we cannot proceed - must reject
      const relevanceScore = evaluationResult.relevance_score ?? evaluationResult.relevance;
      
      // CRITICAL: Check if relevance_score is missing, null, or less than 60
      if (relevanceScore === undefined || relevanceScore === null || relevanceScore < 60) {
        const actualScore = relevanceScore ?? 0;
        const errorMsg = `Content failed quality check: Content is not relevant to the lesson topic (Relevance: ${actualScore}/100). ${evaluationResult.feedback_summary || 'The content does not match the lesson topic. Please ensure your content is directly related to the topic.'}`;
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      if (statusMessages) {
        pushStatus(statusMessages, 'Checking difficulty alignment...');
      }

      // Reject content if originality score is below 75 (stricter threshold to catch content that resembles official documentation)
      // CRITICAL: Use nullish coalescing to handle 0 values correctly
      // CRITICAL: If originality_score is undefined, we cannot proceed - must reject
      const originalityScore = evaluationResult.originality_score;
      if (originalityScore === undefined || originalityScore === null || originalityScore < 75) {
        const actualScore = originalityScore ?? 0;
        const errorMsg = `Content failed quality check: Content appears to be copied or plagiarized (Originality: ${actualScore}/100). ${evaluationResult.feedback_summary || 'Please rewrite the content in your own words. Copying from official sources or other materials is not allowed. Content that closely resembles official documentation will be rejected.'}`;
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      // CRITICAL: Use nullish coalescing to handle 0 values correctly
      // CRITICAL: If difficulty_alignment_score is undefined, we cannot proceed - must reject
      const difficultyScore = evaluationResult.difficulty_alignment_score;
      if (difficultyScore === undefined || difficultyScore === null || difficultyScore < 60) {
        const actualScore = difficultyScore ?? 0;
        const errorMsg = `Content failed quality check: Difficulty level mismatch (${actualScore}/100). ${evaluationResult.feedback_summary || 'Please adjust the difficulty level to match the target skills.'}`;
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      if (statusMessages) {
        pushStatus(statusMessages, 'Checking structure and consistency...');
      }

      // CRITICAL: Use nullish coalescing to handle 0 values correctly
      // CRITICAL: If consistency_score is undefined, we cannot proceed - must reject
      const consistencyScore = evaluationResult.consistency_score;
      if (consistencyScore === undefined || consistencyScore === null || consistencyScore < 60) {
        const actualScore = consistencyScore ?? 0;
        const errorMsg = `Content failed quality check: Low consistency score (${actualScore}/100). ${evaluationResult.feedback_summary || 'Please improve the structure and coherence of your content.'}`;
        if (statusMessages) {
          pushStatus(statusMessages, `Quality check failed: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

      // Store results in the format expected by QualityCheck entity
      // Use the validated scores (already checked above)
      const results = {
        relevance_score: relevanceScore,
        originality_score: originalityScore,
        difficulty_alignment_score: difficultyScore,
        consistency_score: consistencyScore,
        feedback_summary: evaluationResult.feedback_summary,
      };

      // Calculate overall score (average of all four scores, with relevance weighted more)
      const overallScore = Math.round(
        (relevanceScore * 0.4 + // Relevance is most important (40% weight)
          originalityScore * 0.2 +
          difficultyScore * 0.2 +
          consistencyScore * 0.2)
      );

      // Update quality check
      savedCheck.markCompleted(results, overallScore);
      await this.qualityCheckRepository.update(savedCheck.quality_check_id, {
        status: savedCheck.status,
        results: savedCheck.results,
        score: savedCheck.score,
        completed_at: savedCheck.completed_at,
      });

      // CRITICAL: Update content quality_check_status to 'approved' if check passed
      // This ensures content is marked as approved before proceeding
      await this.contentRepository.update(contentId, {
        quality_check_status: 'approved',
        quality_check_data: {
          quality_check_id: savedCheck.quality_check_id,
          relevance_score: relevanceScore,
          originality_score: originalityScore,
          difficulty_alignment_score: difficultyScore,
          consistency_score: consistencyScore,
          overall_score: overallScore,
          feedback_summary: evaluationResult.feedback_summary,
        },
      });

      console.log('[QualityCheckService] Quality check completed and content status updated:', {
        contentId,
        relevance_score: relevanceScore,
        originality_score: originalityScore,
        difficulty_alignment_score: difficultyScore,
        consistency_score: consistencyScore,
        overallScore,
        quality_check_status: 'approved',
      });

      return savedCheck;
    } catch (error) {
      if (statusMessages) {
        pushStatus(statusMessages, `Quality check failed: ${error.message}`);
      }
      savedCheck.markFailed(error.message);
      await this.qualityCheckRepository.update(savedCheck.quality_check_id, {
        status: savedCheck.status,
        error_message: savedCheck.error_message,
        completed_at: savedCheck.completed_at,
      });

      // CRITICAL: Update content quality_check_status to 'rejected' if check failed
      // This marks the content as rejected before it gets deleted
      try {
        await this.contentRepository.update(contentId, {
          quality_check_status: 'rejected',
          quality_check_data: {
            quality_check_id: savedCheck.quality_check_id,
            error_message: error.message,
            status: 'failed',
          },
        });
        console.log('[QualityCheckService] Content marked as rejected:', contentId);
      } catch (updateError) {
        console.error('[QualityCheckService] Failed to update content status to rejected:', updateError.message);
        // Continue to throw original error even if status update fails
      }

      throw error;
    }
  }

  async evaluateContentWithOpenAI({ courseName, topicName, skills, contentText, statusMessages = null }) {
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

- If plagiarism is detected OR content closely resembles official documentation → originality_score < 75

- If text feels trainer-written → originality_score 75–100

- When unsure → prefer higher originality (avoid false positives)

- Content that closely resembles official documentation should receive originality_score < 75 (reject)

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

3. For CODE content: Check if the code is copied from official documentation, tutorials, or other sources. Code that closely matches official examples should receive originality_score < 75.

4. Using standard terminology is NOT plagiarism.

5. Score originality high if writing feels original even if technical.

6. Assign difficulty based on skills.

7. Return JSON only.`;

    try {
      console.log('[QualityCheckService] Running quality check evaluation with GPT-4o');
      console.log('[QualityCheckService] Content preview:', {
        topicName,
        courseName,
        contentLength: contentText.length,
        skillsCount: skills?.length || 0,
      });

      // Always use GPT-4o for quality checks - required for accurate plagiarism detection
      const model = QualityCheckService.QUALITY_CHECK_MODEL;
      console.log(`[QualityCheckService] Using model: ${model} for quality check (required for manual content)`);
      
      const response = await this.openaiClient.generateText(userPrompt, {
        systemPrompt,
        model, // Always GPT-4o - required for accurate plagiarism detection
        temperature: 0.25,
        max_tokens: 350,
      });

      console.log('🔥 [QualityCheckService] OpenAI RAW RESPONSE:', response);
      console.log('🔥 [QualityCheckService] Response length:', response?.length || 0);

      const cleaned = response.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('❌ [QualityCheckService] No JSON match found in response:', cleaned);
        throw new Error("Invalid JSON returned by OpenAI");
      }

      console.log('✅ [QualityCheckService] JSON match found, length:', jsonMatch[0].length);

      const result = JSON.parse(jsonMatch[0]);

      console.log('✅ [QualityCheckService] Parsed evaluation result:', {
        relevance_score: result.relevance_score ?? result.relevance,
        originality_score: result.originality_score,
        difficulty_alignment_score: result.difficulty_alignment_score,
        consistency_score: result.consistency_score,
        hasFeedback: !!result.feedback_summary,
      });

      // CRITICAL: Use nullish coalescing (??) instead of || to handle 0 values correctly
      // 0 is a valid score and should not be treated as falsy
      const evaluationResult = {
        relevance_score: result.relevance_score ?? result.relevance ?? undefined, // Don't default to 100 - let validation handle it
        originality_score: result.originality_score ?? undefined, // Don't default - let validation handle it
        difficulty_alignment_score: result.difficulty_alignment_score ?? undefined, // Don't default - let validation handle it
        consistency_score: result.consistency_score ?? undefined, // Don't default - let validation handle it
        feedback_summary: result.feedback_summary ?? 'Evaluation completed.',
      };

      console.log('✅ [QualityCheckService] Final evaluation result:', evaluationResult);
      console.log('[QC] AI RESPONSE:', evaluationResult);

      return evaluationResult;
    } catch (err) {
      console.error("❌ [QualityCheckService] Evaluation failed:", {
        error: err.message,
        stack: err.stack,
      });
      throw new Error("Evaluation failed: " + err.message);
    }
  }

  async extractTextFromContent(content) {
    // Extract text from content_data for quality check
    // This method handles all content types: text (1), code (2), presentation (3), mind_map (5), avatar_video (6)
    
    if (typeof content.content_data === 'string') {
      try {
        const parsed = JSON.parse(content.content_data);
        // For code content, include both code and explanation
        if (parsed.code) {
          const codeText = parsed.code;
          const explanationText = parsed.explanation || '';
          return explanationText ? `${codeText}\n\n${explanationText}` : codeText;
        }
        // For presentation, extract metadata text if available
        if (parsed.metadata) {
          const metadataText = [
            parsed.metadata.title,
            parsed.metadata.description,
            parsed.metadata.lessonTopic,
          ].filter(Boolean).join('\n');
          if (metadataText) return metadataText;
        }
        return parsed.text || JSON.stringify(parsed);
      } catch {
        return content.content_data;
      }
    }
    
    // Type 1: Text & Audio - extract text field
    if (content.content_data?.text) {
      return content.content_data.text;
    }
    
    // Type 2: Code - include both code and explanation for originality check
    if (content.content_data?.code) {
      const codeText = content.content_data.code;
      const explanationText = content.content_data.explanation || '';
      // Combine code and explanation for originality check
      // This ensures we check both the code itself and any explanatory text
      return explanationText ? `${codeText}\n\n${explanationText}` : codeText;
    }
    
    // Type 3: Presentation - extract text from slides if available, otherwise from metadata
    if (content.content_type_id === 3 || content.content_type_id === '3' || content.content_type_id === 'presentation') {
      // First, try to extract from slides array (for presentations with structured data)
      if (content.content_data?.slides && Array.isArray(content.content_data.slides)) {
        const slideTexts = content.content_data.slides
          .map(slide => slide.text || slide.title || slide.content || slide.body || '')
          .filter(Boolean)
          .join('\n');
        if (slideTexts.trim().length > 0) {
          return slideTexts;
        }
      }
      
      // Check for nested presentation.slides
      if (content.content_data?.presentation?.slides && Array.isArray(content.content_data.presentation.slides)) {
        const slideTexts = content.content_data.presentation.slides
          .map(slide => slide.text || slide.title || slide.content || slide.body || '')
          .filter(Boolean)
          .join('\n');
        if (slideTexts.trim().length > 0) {
          return slideTexts;
        }
      }
      
      // For manual presentations (fileUrl only, no slides), try to extract text from the file
      if (content.content_data?.fileUrl || content.content_data?.presentationUrl) {
        const fileUrl = content.content_data?.fileUrl || content.content_data?.presentationUrl;
        const ext = fileUrl.toLowerCase();
        
        // Check if it's a supported file type
        if (ext.endsWith('.pptx') || ext.endsWith('.ppt') || ext.endsWith('.pdf')) {
          try {
            console.log('[QualityCheckService] Attempting to extract text from presentation file for quality check:', {
              fileUrl: fileUrl.substring(0, 100) + '...',
              extension: ext.substring(ext.lastIndexOf('.')),
            });
            
            // Download and extract text from file (pass content_data and openaiClient for Vision fallback)
            const fileText = await FileTextExtractor.extractTextFromUrl(fileUrl, content.content_data, this.openaiClient);
            
            if (fileText && fileText.trim().length >= 10) {
              console.log('[QualityCheckService] ✅ Successfully extracted text from presentation file:', {
                textLength: fileText.length,
                preview: fileText.substring(0, 100),
              });
              return fileText; // Real text extracted => proceed with quality check
            } else {
              console.warn('[QualityCheckService] Presentation file has no extractable text (empty or too short), falling back to metadata');
              // Fall through to metadata extraction below
            }
          } catch (error) {
            console.warn('[QualityCheckService] Failed to extract text from presentation file, falling back to metadata:', {
              error: error.message,
              fileUrl: fileUrl.substring(0, 100) + '...',
            });
            // Fall through to metadata extraction below
          }
        } else {
          console.warn('[QualityCheckService] Presentation file URL has unsupported extension, using metadata only');
          // Fall through to metadata extraction below
        }
      }
    }
    
    // Extract metadata text (for presentations without slides, or as fallback)
    if (content.content_data?.metadata) {
      const metadataText = [
        content.content_data.metadata.title,
        content.content_data.metadata.description,
        content.content_data.metadata.lessonTopic,
      ].filter(Boolean).join('\n');
      if (metadataText) return metadataText;
    }
    
    // Type 5: Mind Map - extract text from nodes if available
    if (content.content_data?.nodes && Array.isArray(content.content_data.nodes)) {
      const nodeTexts = content.content_data.nodes
        .map(node => node.data?.label || node.label || node.text || '')
        .filter(Boolean);
      if (nodeTexts.length > 0) {
        return nodeTexts.join('\n');
      }
    }
    
    // Type 6: Avatar Video - extract text/script if available
    if (content.content_data?.text) {
      return content.content_data.text;
    }
    if (content.content_data?.script) {
      return content.content_data.script;
    }
    
    // Fallback: stringify the entire content_data
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

