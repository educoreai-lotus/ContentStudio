/**
 * Status Message Normalizer
 * Converts backend technical messages into user-friendly, short messages
 */

/**
 * Normalize a status message to be user-friendly
 * @param {string} message - Raw message from backend
 * @returns {string} Normalized, user-friendly message
 */
export function normalizeStatusMessage(message) {
  if (!message || typeof message !== 'string') {
    return message || '';
  }

  const lower = message.toLowerCase();

  // Quality Check messages
  if (lower.includes('starting quality check') || lower.includes('triggering quality check') ||
      lower.includes('quality check pending')) {
    return 'Running quality check…';
  }
  if (lower.includes('examining content originality') || lower.includes('checking originality') ||
      lower.includes('examining originality')) {
    return 'Checking originality…';
  }
  if (lower.includes('checking relevance to topic') || lower.includes('checking relevance') ||
      lower.includes('relevance to topic')) {
    return 'Checking relevance…';
  }
  if (lower.includes('checking difficulty alignment') || lower.includes('checking difficulty') ||
      lower.includes('difficulty alignment')) {
    return 'Checking difficulty alignment…';
  }
  if (lower.includes('checking structure and consistency') || lower.includes('checking consistency') ||
      lower.includes('checking structure')) {
    return 'Checking structure…';
  }
  if (lower.includes('quality check completed successfully') || 
      (lower.includes('quality check') && (lower.includes('passed') || lower.includes('completed')))) {
    return 'Quality check passed — generating audio…';
  }
  if (lower.includes('quality check failed')) {
    return 'Quality check failed';
  }

  // Audio messages
  if (lower.includes('generating audio') || lower.includes('uploading audio')) {
    return 'Generating audio…';
  }
  if (lower.includes('audio generation completed successfully') || 
      (lower.includes('audio') && lower.includes('completed')) ||
      (lower.includes('audio') && lower.includes('generated successfully'))) {
    return 'Audio generated successfully';
  }
  if (lower.includes('audio generation failed') || 
      (lower.includes('audio') && lower.includes('failed'))) {
    return 'Audio generation failed';
  }

  // Content messages
  if (lower.includes('saving content') || lower.includes('starting content creation') ||
      lower.includes('saving…')) {
    return 'Saving content…';
  }
  if (lower.includes('content saved successfully') || 
      (lower.includes('content') && lower.includes('saved') && lower.includes('successfully')) ||
      (lower.includes('content') && lower.includes('saved'))) {
    return 'Content saved successfully';
  }
  if (lower.includes('content rejected')) {
    return 'Content rejected';
  }

  // Return original if no match found
  return message;
}

/**
 * Extract error reason from error message
 * @param {string} errorMessage - Full error message
 * @returns {string} Short, user-friendly reason
 */
export function extractErrorReason(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return '';
  }

  const lower = errorMessage.toLowerCase();

  // Plagiarism detection
  if (lower.includes('plagiarized') || lower.includes('copied') || 
      lower.includes('originality') || lower.includes('resembles official')) {
    return 'Content appears copied from official documentation';
  }

  // Relevance issues
  if (lower.includes('not relevant') || lower.includes('relevance') || 
      lower.includes('does not match the lesson topic')) {
    return 'Content is not relevant to the lesson topic';
  }

  // Difficulty mismatch
  if (lower.includes('difficulty') || lower.includes('skill level')) {
    return 'Difficulty level does not match target skills';
  }

  // Consistency issues
  if (lower.includes('consistency') || lower.includes('structure')) {
    return 'Content structure needs improvement';
  }

  // Audio errors
  if (lower.includes('audio')) {
    return 'Audio generation encountered an error';
  }

  // Try to extract meaningful part from common error patterns
  // Pattern: "Error: reason" or "Failed: reason"
  let match = errorMessage.match(/(?:error|failed|failure):\s*(.+?)(?:\.|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Pattern: "Content failed quality check: reason (Score: X/100). feedback_summary"
  match = errorMessage.match(/Content failed quality check:\s*(.+)/i);
  if (match && match[1]) {
    // Extract the reason and feedback, but remove scores
    const fullReason = match[1].trim();
    // If it contains scores, extract main reason and feedback
    // Pattern: "reason (Score: X/100). feedback" or "reason (Score: X/100) feedback"
    const scoreMatch = fullReason.match(/(.+?)\s*\([^)]+\)\s*(.+)?/);
    if (scoreMatch) {
      const mainReason = scoreMatch[1].trim();
      const feedback = scoreMatch[2] ? scoreMatch[2].trim() : '';
      // Return just the main reason (without score), feedback will be shown separately
      return mainReason;
    }
    // Remove any score patterns
    return fullReason.replace(/\s*\([^)]*score[^)]*\)/gi, '').trim();
  }
  
  // Also check for "quality check" without "Content failed" prefix
  match = errorMessage.match(/quality check[^:]*:\s*(.+?)(?:\.|$)/i);
  if (match && match[1]) {
    const fullReason = match[1].trim();
    const scoreMatch = fullReason.match(/(.+?)\s*\([^)]+\)\s*(.+)?/);
    if (scoreMatch) {
      return scoreMatch[1].trim(); // Just the main reason
    }
    return fullReason.replace(/\s*\([^)]*score[^)]*\)/gi, '').trim();
  }

  // Pattern: "reason (Score: X/100)"
  match = errorMessage.match(/^(.+?)\s*\(.*score.*\)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  // If error message is generic, try to find any meaningful text after colon
  match = errorMessage.match(/:\s*(.+)/);
  if (match && match[1] && match[1].length > 10) {
    return match[1].trim();
  }

  // Return full message if it's short enough, otherwise truncate
  if (errorMessage.length <= 150) {
    return errorMessage;
  }

  return errorMessage.substring(0, 150) + '...';
}

/**
 * Get friendly guidance based on error type
 * @param {string} errorMessage - Error message
 * @returns {string} Friendly guidance text
 */
export function getFriendlyGuidance(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return '';
  }

  const lower = errorMessage.toLowerCase();

  if (lower.includes('plagiarized') || lower.includes('copied') || 
      lower.includes('originality') || lower.includes('resembles official')) {
    return 'Please rewrite the content in your own words.';
  }

  if (lower.includes('not relevant') || lower.includes('relevance') || 
      lower.includes('does not match the lesson topic')) {
    return 'Please ensure the text matches the lesson topic.';
  }

  if (lower.includes('difficulty') || lower.includes('skill level')) {
    return 'Please adjust the complexity.';
  }

  if (lower.includes('consistency') || lower.includes('structure')) {
    return 'Please improve the structure and coherence.';
  }

  if (lower.includes('audio')) {
    return 'Try saving again.';
  }

  return 'Please review and try again.';
}

/**
 * Check if message should show in popup (important events only)
 * @param {string} message - Message text
 * @returns {boolean} True if should show popup
 */
export function shouldShowPopup(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes('passed') ||
    lower.includes('failed') ||
    lower.includes('success') ||
    lower.includes('rejected') ||
    lower.includes('error') ||
    lower.includes('completed successfully')
  );
}

