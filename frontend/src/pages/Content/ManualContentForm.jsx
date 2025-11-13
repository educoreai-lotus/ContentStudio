import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { useApp } from '../../context/AppContext.jsx';
import { StatusStream } from '../../components/StatusStream.jsx';
import { PopupModal } from '../../components/PopupModal.jsx';
import { usePopup } from '../../hooks/usePopup.js';
import { useStatusStream, isImportant } from '../../hooks/useStatusStream.js';
import { 
  normalizeStatusMessage, 
  extractErrorReason, 
  getFriendlyGuidance 
} from '../../utils/statusMessageNormalizer.js';

const MAX_TEXT_LENGTH = 4000;

export const ManualContentForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { topicId } = useParams();
  const { theme } = useApp();
  
  const { contentType, contentTypeId, existingContent } = location.state || {};

  const initialFormData = useMemo(() => {
    const contentData = existingContent?.content_data || existingContent || {};

    if (contentType === 'text') {
      return {
        text: contentData.text || '',
        code: '',
        explanation: '',
        presentationFile: null,
      };
    }

    if (contentType === 'code') {
      return {
        text: '',
        code: contentData.code || '',
        explanation: contentData.explanation || '',
        presentationFile: null,
      };
    }

    return {
      text: '',
      code: '',
      explanation: '',
      presentationFile: null,
    };
  }, [contentType, existingContent]);
  
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null); // Current status message for spinner
  
  // Use hooks for popup and status stream
  const { showPopup, hidePopup, popupData } = usePopup();
  const { messages, addMessage, clearMessages } = useStatusStream();

  const handleInputChange = (field, value) => {
    if (field === 'text') {
      const trimmedValue = value.slice(0, MAX_TEXT_LENGTH);
      setFormData(prev => ({
        ...prev,
        text: trimmedValue,
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid presentation file (PDF, PPT, PPTX)');
        return;
      }
      setFormData(prev => ({
        ...prev,
        presentationFile: file,
      }));
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      clearMessages(); // Clear previous messages
      setCurrentStatus('Saving content…');

      let content_data = {};

      // Build content_data based on content type
      if (contentType === 'text') {
        if (!formData.text.trim()) {
          setError('Please enter text content');
          return;
        }
        if (formData.text.length > MAX_TEXT_LENGTH) {
          setError(`Text content cannot exceed ${MAX_TEXT_LENGTH} characters`);
          return;
        }
        content_data = {
          text: formData.text,
          metadata: {
            lessonTopic: 'Manual Entry',
            language: 'en',
            createdManually: true,
          },
        };
      } else if (contentType === 'code') {
        if (!formData.code.trim()) {
          setError('Please enter code');
          return;
        }
        content_data = {
          code: formData.code,
          explanation: formData.explanation,
          metadata: {
            lessonTopic: 'Manual Entry',
            language: 'en',
            createdManually: true,
          },
        };
      } else if (contentType === 'presentation') {
        if (!formData.presentationFile) {
          setError('Please upload a presentation file');
          return;
        }
        
        // Upload to backend (which will upload to Supabase Storage)
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.presentationFile);

        const uploadResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/upload/presentation`, {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          setError('Failed to upload presentation: ' + (errorData.error?.message || 'Unknown error'));
          return;
        }

        const uploadResult = await uploadResponse.json();

        content_data = {
          ...uploadResult.data,
          metadata: {
            lessonTopic: 'Manual Entry',
            language: 'en',
            createdManually: true,
          },
        };
      }

      // Message already added above

      // Save to database
      const response = await contentService.approve({
        topic_id: parseInt(topicId),
        content_type_id: contentTypeId,
        content_data,
        was_edited: false, // Manual creation, not edited
        original_content_data: null,
        generation_method_id: 'manual',
      });

      // Build message with quality check results
      let message = response.message || 'Content created successfully!';
      let qualityCheckInfo = response.qualityCheck || null;
      const statusMessagesFromBackend = response.status_messages || [];

      // Process status messages: normalize and route to popup or stream
      for (const msg of statusMessagesFromBackend) {
        const rawMessage = typeof msg === 'string' ? msg : (msg.message || '');
        const normalizedMessage = normalizeStatusMessage(rawMessage);
        const timestamp = typeof msg === 'object' ? msg.timestamp : new Date().toISOString();
        
        // Update current status for spinner (only for process steps, not results)
        if (!isImportant(normalizedMessage)) {
          setCurrentStatus(normalizedMessage);
        }
        
        if (isImportant(normalizedMessage)) {
          // Show popup for important events
          const lowerMessage = normalizedMessage.toLowerCase();
          let popupType = 'info';
          let popupTitle = '';
          let popupMessage = '';
          let popupReason = '';
          let popupGuidance = '';
          let popupFeedback = null;
          let shouldShowPopupNow = true;

          if (lowerMessage.includes('quality check passed') || 
              lowerMessage.includes('quality check') && lowerMessage.includes('passed')) {
            popupType = 'success';
            popupTitle = 'Quality Check Passed';
            popupMessage = 'Quality check passed — generating audio…';
          } else if (lowerMessage.includes('quality check failed')) {
            popupType = 'error';
            popupTitle = 'Quality Check Failed';
            popupMessage = 'Quality check failed';
            
            // Extract detailed reason and feedback from error message
            // Format: "Content failed quality check: reason (Score: X/100). feedback_summary"
            const reasonMatch = rawMessage.match(/Content failed quality check:\s*(.+)/i);
            if (reasonMatch) {
              const fullReason = reasonMatch[1].trim();
              // Try to extract main reason and feedback (remove scores)
              const scoreMatch = fullReason.match(/(.+?)\s*\([^)]+\)\s*(.+)?/);
              if (scoreMatch) {
                const mainReason = scoreMatch[1].trim();
                const feedback = scoreMatch[2] ? scoreMatch[2].trim() : '';
                // Remove score from reason - just show the main reason
                popupReason = mainReason;
                // Use feedback as detailed feedback if it's long enough, otherwise as guidance
                if (feedback && feedback.length > 100) {
                  popupFeedback = feedback;
                  popupGuidance = getFriendlyGuidance(rawMessage);
                } else if (feedback) {
                  popupGuidance = feedback;
                } else {
                  popupGuidance = getFriendlyGuidance(rawMessage);
                }
              } else {
                // No scores found, use full reason but remove any score patterns
                popupReason = fullReason.replace(/\s*\([^)]*score[^)]*\)/gi, '').trim();
                popupGuidance = getFriendlyGuidance(rawMessage);
              }
            } else {
              // Fallback if pattern doesn't match
              const extractedReason = extractErrorReason(rawMessage);
              // Remove scores from extracted reason
              popupReason = (extractedReason || rawMessage.replace(/quality check failed:?/i, '').trim() || 'Content did not meet quality standards')
                .replace(/\s*\([^)]*score[^)]*\)/gi, '').trim();
              popupGuidance = getFriendlyGuidance(rawMessage);
            }
          } else if (lowerMessage.includes('audio generated successfully') || 
                     lowerMessage.includes('audio generation completed')) {
            popupType = 'success';
            popupTitle = 'Audio Generated';
            popupMessage = 'Audio generated successfully';
          } else if (lowerMessage.includes('audio generation failed')) {
            popupType = 'error';
            popupTitle = 'Audio Generation Failed';
            popupMessage = 'Audio generation failed';
            const extractedReason = extractErrorReason(rawMessage);
            popupReason = extractedReason || rawMessage.replace(/audio generation failed:?/i, '').trim() || 'Audio generation encountered an error';
            popupGuidance = getFriendlyGuidance(rawMessage);
          } else if (lowerMessage.includes('content saved successfully')) {
            popupType = 'success';
            popupTitle = 'Content Saved';
            popupMessage = 'Content saved successfully';
          } else if (lowerMessage.includes('content rejected')) {
            popupType = 'error';
            popupTitle = 'Content Rejected';
            popupMessage = 'Content rejected';
            const extractedReason = extractErrorReason(rawMessage);
            popupReason = extractedReason || rawMessage.replace(/content rejected:?/i, '').trim() || 'Content did not meet requirements';
            popupGuidance = getFriendlyGuidance(rawMessage);
          } else {
            // Generic important message
            popupType = lowerMessage.includes('failed') || lowerMessage.includes('error') ? 'error' : 'success';
            popupTitle = normalizedMessage;
            popupMessage = normalizedMessage;
            if (popupType === 'error') {
              const extractedReason = extractErrorReason(rawMessage);
              popupReason = extractedReason || rawMessage;
              popupGuidance = getFriendlyGuidance(rawMessage) || 'Please review and try again.';
            }
          }

          if (shouldShowPopupNow) {
            showPopup({
              type: popupType,
              title: popupTitle,
              message: popupMessage,
              reason: popupReason,
              guidance: popupGuidance,
              feedback: popupFeedback,
            });
          }
        } else {
          // Add to status stream for non-important messages (already normalized)
          addMessage({ message: normalizedMessage, timestamp });
        }
      }

      // If no status messages but we have a success message, show popup
      if (statusMessagesFromBackend.length === 0 && message.includes('successfully')) {
        showPopup({
          type: 'success',
          title: 'Content Saved',
          message: 'Content saved successfully',
        });
      }

      // Clear status before navigation
      setCurrentStatus(null);
      
      // Navigate back to content manager with quality check info
      navigate(`/topics/${topicId}/content`, {
        state: { 
          message,
          qualityCheck: qualityCheckInfo,
          statusMessages: statusMessagesFromBackend,
        },
      });
    } catch (err) {
      // Clear status on error
      setCurrentStatus(null);
      
      // Check if error has status_messages from backend (quality check errors)
      // Note: apiClient interceptor returns error.response.data directly, so err is already the response data
      let errorMessage = 'Failed to create content';
      let statusMessagesFromError = null;
      
      // Handle axios error response structure
      // apiClient interceptor returns error.response.data, so err is already the backend response
      if (err && typeof err === 'object') {
        // Backend error structure: { success: false, error: { message: "...", code: "..." } }
        if (err.error && err.error.message) {
          errorMessage = err.error.message;
        }
        // Check for status_messages first (contains detailed error info)
        else if (err.status_messages && Array.isArray(err.status_messages) && err.status_messages.length > 0) {
          statusMessagesFromError = err.status_messages;
          // Find the failed message
          const failedMessage = err.status_messages.find(msg => {
            const msgText = typeof msg === 'string' ? msg : (msg.message || '');
            return msgText.toLowerCase().includes('failed') || msgText.toLowerCase().includes('error');
          });
          if (failedMessage) {
            errorMessage = typeof failedMessage === 'string' ? failedMessage : (failedMessage.message || errorMessage);
          }
        }
        // Fallback to other error fields
        else if (err.error && typeof err.error === 'string') {
          errorMessage = err.error;
        }
        else if (err.message) {
          errorMessage = err.message;
        }
      }
      // If error is thrown directly (not axios error) or has .message property
      else if (err && err.message) {
        errorMessage = err.message;
      }
      // If error is a string
      else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      
      // Extract user-friendly error info
      let reason = extractErrorReason(errorMessage);
      let guidance = getFriendlyGuidance(errorMessage);
      let feedback = null;
      
      // If error contains quality check failure, extract detailed info
      if (errorMessage.includes('quality check') && errorMessage.includes('failed')) {
        const reasonMatch = errorMessage.match(/Content failed quality check:\s*(.+)/i);
        if (reasonMatch) {
          const fullReason = reasonMatch[1].trim();
          // Pattern: "reason (Score: X/100). feedback" or "reason (Score: X/100) feedback"
          const scoreMatch = fullReason.match(/(.+?)\s*\([^)]+\)\s*(.+)?/);
          if (scoreMatch) {
            const mainReason = scoreMatch[1].trim();
            const feedbackText = scoreMatch[2] ? scoreMatch[2].trim() : '';
            // Remove score from reason - just show the main reason
            reason = mainReason;
            // If feedback is long, show it as detailed feedback
            if (feedbackText && feedbackText.length > 50) {
              feedback = feedbackText;
              guidance = getFriendlyGuidance(errorMessage);
            } else if (feedbackText) {
              guidance = feedbackText;
            } else {
              guidance = getFriendlyGuidance(errorMessage);
            }
          } else {
            // Remove any score patterns from reason
            reason = fullReason.replace(/\s*\([^)]*score[^)]*\)/gi, '').trim();
            guidance = getFriendlyGuidance(errorMessage);
          }
        } else {
          // Try extractErrorReason which should handle it
          reason = extractErrorReason(errorMessage);
          if (!reason || reason === errorMessage) {
            reason = 'Content did not meet quality standards';
          }
          guidance = getFriendlyGuidance(errorMessage);
        }
      } else {
        // If extractErrorReason didn't find specific reason, try to extract from generic message
        if (!reason || reason === errorMessage || reason === 'Failed to create content') {
          // Try to extract meaningful part
          const colonMatch = errorMessage.match(/:\s*(.+)/);
          if (colonMatch && colonMatch[1]) {
            reason = colonMatch[1].trim();
          } else if (errorMessage !== 'Failed to create content') {
            reason = errorMessage;
          } else {
            reason = 'An error occurred while creating content';
          }
        }
        guidance = guidance || 'Please review your content and try again.';
      }
      
      // Show error popup
      showPopup({
        type: 'error',
        title: 'Content Creation Failed',
        message: 'Content creation failed',
        reason: reason,
        guidance: guidance,
        feedback: feedback,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/topics/${topicId}/content`);
  };

  if (!contentType) {
    return (
      <div
        className={`min-h-screen p-8 ${
          theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div
            className={`p-6 rounded-lg border ${
              theme === 'day-mode'
                ? 'bg-red-50 border-red-200'
                : 'bg-red-900/20 border-red-500/30'
            }`}
          >
            <p
              className={`text-lg ${
                theme === 'day-mode' ? 'text-red-800' : 'text-red-300'
              }`}
            >
              Invalid content type
            </p>
            <button
              onClick={() => navigate(`/topics/${topicId}/content`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Content Manager
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-8 ${
        theme === 'day-mode' ? 'bg-gray-50' : 'bg-slate-900'
      }`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Create {contentType === 'text' && 'Text & Audio'}
            {contentType === 'code' && 'Code Example'}
            {contentType === 'presentation' && 'Presentation'}
          </h1>
          <p
            className={`text-lg ${
              theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            Manually create content for this lesson
          </p>
        </div>

        {error && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              theme === 'day-mode'
                ? 'bg-red-50 border-red-200'
                : 'bg-red-900/20 border-red-500/30'
            }`}
          >
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle mr-2 mt-1"></i>
              <div className="flex-1">
                <p className={`font-semibold mb-2 ${
                  theme === 'day-mode' ? 'text-red-800' : 'text-red-300'
                }`}>
                  Content Rejected - Quality Check Failed
                </p>
                <p className={`mb-2 ${
                  theme === 'day-mode' ? 'text-red-700' : 'text-red-300'
                }`}>
                  {error}
                </p>
                {(error.includes('not relevant') || error.includes('Relevance') || error.includes('does not match the lesson topic')) && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    theme === 'day-mode' ? 'bg-red-100' : 'bg-red-800/30'
                  }`}>
                    <strong>Relevance Issue:</strong> Your content is not relevant to the lesson topic. Please ensure your content directly addresses the topic and teaches concepts related to it.
                  </div>
                )}
                {(error.includes('originality') || error.includes('copied') || error.includes('plagiarized') || error.includes('plagiarism')) && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    theme === 'day-mode' ? 'bg-red-100' : 'bg-red-800/30'
                  }`}>
                    <strong>⚠️ Plagiarism Detected:</strong> Your content appears to be copied from official documentation, websites, or other sources. You must rewrite the content in your own words. Copying from official sources (like React docs, MDN, W3C, etc.) or any other materials is not allowed, even if the content is relevant to the topic.
                  </div>
                )}
                {error.includes('Difficulty') && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    theme === 'day-mode' ? 'bg-red-100' : 'bg-red-800/30'
                  }`}>
                    <strong>Difficulty Mismatch:</strong> Your content doesn't match the target skill level. Adjust the complexity to better align with the lesson's difficulty.
                  </div>
                )}
                {error.includes('consistency') && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    theme === 'day-mode' ? 'bg-red-100' : 'bg-red-800/30'
                  }`}>
                    <strong>Consistency Issue:</strong> Your content structure needs improvement. Ensure logical flow and clear organization.
                  </div>
                )}
                <p className={`mt-3 text-xs ${
                  theme === 'day-mode' ? 'text-red-600' : 'text-red-400'
                }`}>
                  <strong>What to do:</strong> Review your content, address the issues mentioned above, and try again. You can edit your content and resubmit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner - Centered with status message */}
        {loading && currentStatus && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 ${
              theme === 'day-mode'
                ? 'bg-white border border-gray-200'
                : 'bg-gray-800 border border-gray-700'
            }`}>
              <div className="flex flex-col items-center">
                {/* Spinner */}
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 border-4 border-transparent border-t-emerald-600 rounded-full animate-spin"></div>
                </div>
                {/* Status Message */}
                <p className={`text-center font-medium ${
                  theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {currentStatus}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages Stream - Only show when not loading or when there are completed messages */}
        {!loading && messages.length > 0 && (
          <StatusStream messages={messages} theme={theme} />
        )}

        {/* Popup Modal */}
        <PopupModal
          popupData={popupData}
          onClose={hidePopup}
          theme={theme}
          autoClose={popupData?.type === 'success'}
        />

        <form onSubmit={handleSubmit}>
          <div
            className={`rounded-2xl shadow-lg p-6 mb-6 ${
              theme === 'day-mode'
                ? 'bg-white border border-gray-200'
                : 'bg-gray-800 border border-gray-700'
            }`}
          >
            {/* Text & Audio Content */}
            {contentType === 'text' && (
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  Text & Audio *
                </label>
                <div className="mb-2 space-y-2">
                  <div className={`p-3 rounded-lg text-xs ${
                    theme === 'day-mode'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-blue-900/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    <i className="fas fa-info-circle mr-1"></i>
                    Audio will be automatically generated with AI after saving
                  </div>
                  <div className={`p-3 rounded-lg text-xs ${
                    theme === 'day-mode'
                      ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      : 'bg-yellow-900/20 text-yellow-300 border border-yellow-500/30'
                  }`}>
                    <i className="fas fa-check-circle mr-1"></i>
                    <strong>Quality Check:</strong> Your content will be automatically evaluated before audio generation:
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li><strong>Relevance to Topic</strong> - Verifies content is directly related to the lesson topic (MOST IMPORTANT)</li>
                      <li><strong>Originality</strong> - Ensures your content is unique and not copied from official documentation, websites, or other sources (CRITICAL)</li>
                      <li><strong>Difficulty Alignment</strong> - Verifies content matches the target skill level</li>
                      <li><strong>Consistency</strong> - Checks structure and coherence</li>
                    </ul>
                    <p className="mt-2 font-semibold">
                      ⚠️ Content with scores below 60 will be rejected. Audio will only be generated if quality check passes.
                    </p>
                    <p className="mt-2 text-xs italic">
                      ⛔ <strong>Important:</strong> Copying content from official documentation (React docs, MDN, W3C, etc.), websites, or any other sources is strictly prohibited, even if the content is relevant to the topic. You must write all content in your own words.
                    </p>
                  </div>
                </div>
                <textarea
                  value={formData.text}
                  onChange={(e) => handleInputChange('text', e.target.value)}
                  rows={15}
                  placeholder="Enter your lesson text here..."
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                  maxLength={MAX_TEXT_LENGTH}
                  required
                />
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>{formData.text.length} / {MAX_TEXT_LENGTH} characters</span>
                  <span>Audio auto-generates after save</span>
                </div>
              </div>
            )}

            {/* Code Example */}
            {contentType === 'code' && (
              <div className="space-y-4">
                <div className={`mb-2 p-3 rounded-lg text-xs ${
                  theme === 'day-mode'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-yellow-900/20 text-yellow-300 border border-yellow-500/30'
                }`}>
                  <i className="fas fa-check-circle mr-1"></i>
                  <strong>Quality Check:</strong> Your content will be automatically evaluated before saving:
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li><strong>Relevance to Topic</strong> - Verifies content is directly related to the lesson topic (MOST IMPORTANT)</li>
                      <li><strong>Originality</strong> - Ensures your content is unique and not copied from official documentation, websites, or other sources (CRITICAL)</li>
                      <li><strong>Difficulty Alignment</strong> - Verifies content matches the target skill level</li>
                      <li><strong>Consistency</strong> - Checks structure and coherence</li>
                    </ul>
                    <p className="mt-2 font-semibold">
                      ⚠️ Content with scores below 60 will be rejected.
                    </p>
                    <p className="mt-2 text-xs italic">
                      ⛔ <strong>Important:</strong> Copying content from official documentation, websites, or any other sources is strictly prohibited. You must write all content in your own words.
                    </p>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    Code *
                  </label>
                  <textarea
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    rows={15}
                    placeholder="Paste your code here..."
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
                      theme === 'day-mode'
                        ? 'border-gray-300 bg-white text-gray-900'
                        : 'border-gray-600 bg-gray-700 text-white'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    Explanation (Optional)
                  </label>
                  <textarea
                    value={formData.explanation}
                    onChange={(e) => handleInputChange('explanation', e.target.value)}
                    rows={5}
                    placeholder="Explain what this code does..."
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      theme === 'day-mode'
                        ? 'border-gray-300 bg-white text-gray-900'
                        : 'border-gray-600 bg-gray-700 text-white'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Presentation */}
            {contentType === 'presentation' && (
              <div>
                <div className={`mb-2 p-3 rounded-lg text-xs ${
                  theme === 'day-mode'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-yellow-900/20 text-yellow-300 border border-yellow-500/30'
                }`}>
                  <i className="fas fa-check-circle mr-1"></i>
                  <strong>Quality Check:</strong> Your content will be automatically evaluated before saving:
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                      <li><strong>Relevance to Topic</strong> - Verifies content is directly related to the lesson topic (MOST IMPORTANT)</li>
                      <li><strong>Originality</strong> - Ensures your content is unique and not copied from official documentation, websites, or other sources (CRITICAL)</li>
                      <li><strong>Difficulty Alignment</strong> - Verifies content matches the target skill level</li>
                      <li><strong>Consistency</strong> - Checks structure and coherence</li>
                    </ul>
                    <p className="mt-2 font-semibold">
                      ⚠️ Content with scores below 60 will be rejected.
                    </p>
                    <p className="mt-2 text-xs italic">
                      ⛔ <strong>Important:</strong> Copying content from official documentation, websites, or any other sources is strictly prohibited. You must write all content in your own words.
                    </p>
                </div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                  }`}
                >
                  Upload Presentation *
                </label>
                <input
                  type="file"
                  accept=".pdf,.ppt,.pptx"
                  onChange={handleFileChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    theme === 'day-mode'
                      ? 'border-gray-300 bg-white text-gray-900'
                      : 'border-gray-600 bg-gray-700 text-white'
                  }`}
                  required
                />
                {formData.presentationFile && (
                  <p
                    className={`mt-2 text-sm ${
                      theme === 'day-mode' ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    Selected: {formData.presentationFile.name} ({(formData.presentationFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p
                  className={`mt-2 text-xs ${
                    theme === 'day-mode' ? 'text-gray-500' : 'text-gray-500'
                  }`}
                >
                  Supported formats: PDF, PPT, PPTX
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                theme === 'day-mode'
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
