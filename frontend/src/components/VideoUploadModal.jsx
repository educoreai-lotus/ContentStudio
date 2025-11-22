import React, { useState, useRef } from 'react';
import { usePopup } from '../hooks/usePopup.js';
import { useStatusStream } from '../hooks/useStatusStream.js';
import { PopupModal } from './PopupModal.jsx';
import { StatusStream } from './StatusStream.jsx';
import apiClient from '../services/api.js';

/**
 * Video Upload Modal
 * Handles video upload (file or YouTube URL) and transcription
 */
export const VideoUploadModal = ({ open, onClose, topicId, theme = 'day-mode', onTranscriptionComplete }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const fileInputRef = useRef(null);

  const { showPopup, hidePopup, popupData } = usePopup();
  const { messages, addMessage, clearMessages } = useStatusStream();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-ms-wmv'];
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi|wmv|flv|mkv)$/i)) {
        showPopup({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please select a valid video file',
          reason: 'Supported formats: MP4, MOV, WEBM, AVI, WMV, FLV, MKV',
          guidance: 'Please select a different file.',
        });
        return;
      }

      // Validate file size (100MB max)
      if (file.size > 100 * 1024 * 1024) {
        showPopup({
          type: 'error',
          title: 'File Too Large',
          message: 'File size exceeds limit',
          reason: 'Maximum file size is 100MB',
          guidance: 'Please select a smaller file or compress your video.',
        });
        return;
      }

      setSelectedFile(file);
      setYoutubeUrl(''); // Clear YouTube URL when file is selected
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!youtubeUrl && !selectedFile) {
      showPopup({
        type: 'error',
        title: 'No Input Provided',
        message: 'Please provide either a YouTube URL or upload a video file',
        guidance: 'Enter a YouTube link or select a video file to continue.',
      });
      return;
    }

    try {
      setLoading(true);
      clearMessages();
      setCurrentStatus('Preparing transcription…');

      const formData = new FormData();

      // Add topic_id to formData (required for content generation)
      if (topicId) {
        formData.append('topic_id', topicId.toString());
      }

      if (youtubeUrl) {
        // Handle YouTube URL
        addMessage({ message: 'Extracting YouTube captions…', timestamp: new Date().toISOString() });
        setCurrentStatus('Extracting YouTube captions…');
        formData.append('youtubeUrl', youtubeUrl);
      } else if (selectedFile) {
        // Handle file upload
        addMessage({ message: 'Uploading video file…', timestamp: new Date().toISOString() });
        setCurrentStatus('Uploading video file…');
        formData.append('file', selectedFile);
      }

      // Call transcription API
      addMessage({ message: 'Transcribing video…', timestamp: new Date().toISOString() });
      setCurrentStatus('Transcribing video…');

      const response = await apiClient.post('/api/video-to-lesson/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const responseData = response.data.data || response.data;
      const { transcript, source, videoType, progress_events, content_formats, topic_id } = responseData;

      // Process progress events if available
      if (progress_events && Array.isArray(progress_events)) {
        progress_events.forEach(event => {
          addMessage({
            message: event.message,
            timestamp: event.timestamp || new Date().toISOString(),
          });
          setCurrentStatus(event.message);
        });
      }

      // Check if content generation completed
      const hasGeneratedContent = content_formats && Object.keys(content_formats).length > 0;
      
      if (hasGeneratedContent) {
        addMessage({
          message: 'All content formats generated successfully',
          timestamp: new Date().toISOString(),
        });
        setCurrentStatus(null);

        // Show success popup
        showPopup({
          type: 'success',
          title: 'Content Generation Completed',
          message: 'Video transcribed and all lesson formats generated successfully',
          reason: `Generated ${Object.keys(content_formats).length} content formats`,
        });
      } else {
        addMessage({
          message: 'Transcription completed successfully',
          timestamp: new Date().toISOString(),
        });
        setCurrentStatus(null);

        // Show success popup for transcription only
        showPopup({
          type: 'success',
          title: 'Video Transcription Completed',
          message: 'Video transcribed successfully',
          reason: `Source: ${source === 'youtube-captions' ? 'YouTube Captions' : 'Whisper'}`,
        });
      }

      // Call callback with full response data
      if (onTranscriptionComplete) {
        setTimeout(() => {
          onTranscriptionComplete({
            transcript,
            source,
            videoType,
            progress_events,
            content_formats,
            topic_id,
          });
          onClose();
        }, 2000);
      } else {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      setCurrentStatus(null);
      
      // Check if this is a quality check failure
      if (error?.errorCode === 'QUALITY_CHECK_FAILED' && error?.quality_check) {
        const qualityCheck = error.quality_check;
        const errorMessage = error?.error || 'Video transcript failed quality check';
        
        addMessage({
          message: 'Quality check failed',
          timestamp: new Date().toISOString(),
        });

        // Build detailed quality check message
        const qualityDetails = [
          `Relevance: ${qualityCheck.relevance_score}/100`,
          `Originality: ${qualityCheck.originality_score}/100`,
          `Difficulty Alignment: ${qualityCheck.difficulty_alignment_score}/100`,
          `Consistency: ${qualityCheck.consistency_score}/100`,
        ].join(' | ');

        showPopup({
          type: 'error',
          title: 'Quality Check Failed',
          message: errorMessage,
          reason: qualityCheck.feedback_summary || qualityDetails,
          guidance: 'Please ensure your video content is relevant to the lesson topic and original.',
        });
      } else {
        // Generic transcription error
        const errorMessage =
          error?.error || error?.error?.message || error?.message || 'Failed to transcribe video';
        
        addMessage({
          message: 'Transcription failed',
          timestamp: new Date().toISOString(),
        });

        showPopup({
          type: 'error',
          title: 'Transcription Failed',
          message: 'Failed to transcribe video',
          reason: errorMessage,
          guidance: 'Please try another video or check your internet connection.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setYoutubeUrl('');
      setSelectedFile(null);
      clearMessages();
      setCurrentStatus(null);
      onClose();
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Blurred background */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div
            className={`relative rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${
              theme === 'day-mode'
                ? 'bg-white border border-gray-200'
                : 'bg-gray-800 border border-gray-700'
            }`}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h2
                className={`text-2xl font-bold ${
                  theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                }`}
              >
                <i className="fas fa-video mr-2 text-blue-600 dark:text-blue-400"></i>
                Upload Lesson Video
              </h2>
              <button
                onClick={handleClose}
                disabled={loading}
                className={`text-2xl ${
                  theme === 'day-mode'
                    ? 'text-gray-500 hover:text-gray-700'
                    : 'text-gray-400 hover:text-gray-200'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <form onSubmit={handleSubmit}>
                {/* YouTube URL Input */}
                <div className="mb-6">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    <i className="fab fa-youtube mr-2 text-red-600"></i>
                    YouTube URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setSelectedFile(null); // Clear file when URL is entered
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={loading || !!selectedFile}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      theme === 'day-mode'
                        ? 'bg-white border-gray-300 text-gray-900'
                        : 'bg-gray-700 border-gray-600 text-white'
                    } ${loading || selectedFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  <p
                    className={`mt-2 text-xs ${
                      theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    Paste a YouTube video URL. We'll extract captions automatically if available.
                  </p>
                </div>

                {/* Divider */}
                <div className="flex items-center my-6">
                  <div
                    className={`flex-1 border-t ${
                      theme === 'day-mode' ? 'border-gray-300' : 'border-gray-600'
                    }`}
                  ></div>
                  <span
                    className={`px-4 text-sm ${
                      theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    OR
                  </span>
                  <div
                    className={`flex-1 border-t ${
                      theme === 'day-mode' ? 'border-gray-300' : 'border-gray-600'
                    }`}
                  ></div>
                </div>

                {/* File Upload */}
                <div className="mb-6">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                    }`}
                  >
                    <i className="fas fa-file-video mr-2 text-blue-600"></i>
                    Upload Video File (Optional)
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center ${
                      theme === 'day-mode'
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-gray-600 bg-gray-700/50'
                    } ${loading || youtubeUrl ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (!loading && !youtubeUrl && fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      disabled={loading || !!youtubeUrl}
                      className="hidden"
                    />
                    {selectedFile ? (
                      <div>
                        <i className="fas fa-check-circle text-4xl text-emerald-600 mb-2"></i>
                        <p
                          className={`font-medium ${
                            theme === 'day-mode' ? 'text-gray-900' : 'text-white'
                          }`}
                        >
                          {selectedFile.name}
                        </p>
                        <p
                          className={`text-sm mt-1 ${
                            theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="mt-2 text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                        <p
                          className={`font-medium ${
                            theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                          }`}
                        >
                          Click to upload or drag and drop
                        </p>
                        <p
                          className={`text-sm mt-1 ${
                            theme === 'day-mode' ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          MP4, MOV, WEBM, AVI, WMV (Max 100MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Stream */}
                {messages.length > 0 && (
                  <div className="mb-6">
                    <StatusStream messages={messages} theme={theme} />
                  </div>
                )}

                {/* Loading Spinner */}
                {loading && currentStatus && (
                  <div className="mb-6 flex items-center justify-center p-4">
                    <div className="relative w-12 h-12 mr-4">
                      <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                    <p
                      className={`font-medium ${
                        theme === 'day-mode' ? 'text-gray-700' : 'text-gray-300'
                      }`}
                    >
                      {currentStatus}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                      theme === 'day-mode'
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || (!youtubeUrl && !selectedFile)}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                      loading || (!youtubeUrl && !selectedFile)
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload mr-2"></i>
                        Transcribe Video
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Popup Modal */}
      <PopupModal
        popupData={popupData}
        onClose={hidePopup}
        theme={theme}
        autoClose={popupData?.type === 'success'}
      />
    </>
  );
};

