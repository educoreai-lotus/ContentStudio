import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { contentService } from '../../services/content.js';
import { useApp } from '../../context/AppContext.jsx';
import { StatusStream } from '../../components/StatusStream.jsx';
import { PopupModal } from '../../components/PopupModal.jsx';
import { usePopup } from '../../hooks/usePopup.js';
import { useStatusStream, isImportant } from '../../hooks/useStatusStream.js';

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
      
      // Add initial status message
      addMessage({ message: 'Starting content creation...', timestamp: new Date().toISOString() });

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

      // Add message before API call
      addMessage({ message: 'Saving content...', timestamp: new Date().toISOString() });

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

      // Process status messages: show popups for important events, add others to stream
      statusMessagesFromBackend.forEach((msg) => {
        const messageText = typeof msg === 'string' ? msg : (msg.message || '');
        const timestamp = typeof msg === 'object' ? msg.timestamp : new Date().toISOString();
        
        if (isImportant(messageText)) {
          // Show popup for important events
          const lowerMessage = messageText.toLowerCase();
          let popupType = 'info';
          let popupTitle = '';
          let popupMessage = '';
          let popupDetails = '';
          let popupReason = '';

          if ((lowerMessage.includes('quality check') && lowerMessage.includes('completed successfully')) || 
              (lowerMessage.includes('quality check') && lowerMessage.includes('passed'))) {
            popupType = 'success';
            popupTitle = 'Quality Check Passed';
            popupMessage = 'Quality Check Completed Successfully!';
            popupDetails = 'Your content has passed all evaluation steps. Audio is being generated now...';
          } else if (lowerMessage.includes('quality check') && lowerMessage.includes('failed')) {
            popupType = 'error';
            popupTitle = 'Quality Check Failed';
            popupMessage = 'Quality Check Failed';
            // Extract reason from message
            const reasonMatch = messageText.match(/Quality check failed: (.+)/i);
            if (reasonMatch) {
              popupReason = reasonMatch[1];
            } else {
              popupReason = messageText.replace(/Quality check failed:?/i, '').trim();
            }
            popupDetails = 'Please rewrite the content in your own words.';
          } else if (lowerMessage.includes('audio generation') && lowerMessage.includes('failed')) {
            popupType = 'error';
            popupTitle = 'Audio Generation Failed';
            popupMessage = 'Audio Generation Failed';
            const reasonMatch = messageText.match(/Audio generation failed: (.+)/i);
            if (reasonMatch) {
              popupReason = reasonMatch[1];
            } else {
              popupReason = messageText.replace(/Audio generation failed:?/i, '').trim();
            }
          } else if (lowerMessage.includes('audio generation') && lowerMessage.includes('completed')) {
            popupType = 'success';
            popupTitle = 'Audio Generated';
            popupMessage = 'Audio Generation Completed Successfully!';
            popupDetails = 'Your audio is ready.';
          } else if (lowerMessage.includes('content saved') || lowerMessage.includes('successfully')) {
            popupType = 'success';
            popupTitle = 'Content Saved Successfully';
            popupMessage = 'Content Saved Successfully!';
            popupDetails = 'Your text and audio are now ready.';
          } else if (lowerMessage.includes('rejected')) {
            popupType = 'error';
            popupTitle = 'Content Rejected';
            popupMessage = 'Content Rejected';
            popupReason = messageText.replace(/Content rejected:?/i, '').trim();
          }

          showPopup({
            type: popupType,
            title: popupTitle || messageText,
            message: popupMessage || messageText,
            details: popupDetails,
            reason: popupReason,
          });
        } else {
          // Add to status stream for non-important messages
          addMessage({ message: messageText, timestamp });
        }
      });

      // If no status messages but we have a success message, show popup
      if (statusMessagesFromBackend.length === 0 && message.includes('successfully')) {
        showPopup({
          type: 'success',
          title: 'Content Saved Successfully',
          message: 'Content Saved Successfully!',
          details: 'Your text and audio are now ready.',
        });
      }

      // Navigate back to content manager with quality check info
      navigate(`/topics/${topicId}/content`, {
        state: { 
          message,
          qualityCheck: qualityCheckInfo,
          statusMessages: statusMessagesFromBackend,
        },
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to create content';
      setError(errorMessage);
      
      // Show error popup
      showPopup({
        type: 'error',
        title: 'Error',
        message: 'Content Creation Failed',
        reason: errorMessage,
      });
      
      // Add error to status stream
      addMessage({ message: errorMessage, timestamp: new Date().toISOString() });
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

        {/* Status Messages Stream */}
        {messages.length > 0 && (
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
