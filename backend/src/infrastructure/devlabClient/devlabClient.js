import { logger } from '../logging/Logger.js';
import { postToCoordinator } from '../coordinatorClient/coordinatorClient.js';
import { getLanguageName } from '../../utils/languageMapper.js';
import { verifyCoordinatorSignature } from '../utils/verifyCoordinatorSignature.js';

const SERVICE_NAME = process.env.SERVICE_NAME || 'content-studio';

/**
 * DevLab Client
 * Handles communication between Content Studio and DevLab microservice
 * Uses Stringified JSON Protocol over application/x-www-form-urlencoded
 * 
 * Protocol:
 * - Request: POST with serviceName="ContentStudio" and payload=JSON.stringify(object)
 * - Response: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
 */
export class DevlabClient {
  constructor() {
    // DevLab client now uses Coordinator for all requests
    // No direct URL needed - Coordinator handles routing
    logger.info('[DevlabClient] Initialized - using Coordinator for requests');
  }

  /**
   * Get rollback mock data when external request fails
   * @param {Object} payload - Original payload sent to DevLab
   * @returns {Object} Mock data matching expected structure
   */
  getRollbackMockData(payload) {
    return {
      question: payload.question || '',
      course_id: payload.course_id || '',
      trainer_id: payload.trainer_id || '',
      valid: false,
      message: 'DevLab unavailable – returned rollback',
      ajax: null,
    };
  }

  /**
   * Send request to DevLab microservice via Coordinator
   * @param {Object} payload - Payload object to send
   * @returns {Promise<Object>} Parsed response from DevLab or rollback mock data
   */
  async sendRequest(payload) {
    // Validate payload
    if (typeof payload !== 'object' || payload === null) {
      logger.warn('[DevlabClient] Invalid payload, using rollback mock data', {
        payloadType: typeof payload,
      });
      return this.getRollbackMockData(payload || {});
    }

    try {
      // Coordinator routes automatically based on action - no need for target_service
      // Remove target_service if it exists (should not be needed)
      if (payload.target_service) {
        delete payload.target_service;
      }

      // Build envelope for Coordinator (standard structure)
      const envelope = {
        requester_service: 'content-studio',
        payload: payload,
        response: {},
      };

      logger.info('[DevlabClient] Sending request to DevLab via Coordinator', {
        payloadKeys: Object.keys(payload),
      });

      // Log full request envelope (what we send to Coordinator)
      logger.info('[DevlabClient] Full request envelope to Coordinator (sendRequest)', {
        envelope: JSON.stringify(envelope, null, 2),
        envelopeKeys: Object.keys(envelope),
        payloadKeys: Object.keys(payload),
        fullPayload: JSON.stringify(payload, null, 2),
      });

      // Send request via Coordinator
      const coordinatorResponse = await postToCoordinator(envelope, {
        endpoint: '/api/fill-content-metrics',
        timeout: 180000, // 3 minutes timeout
      });

      // Extract response components
      const responseData = coordinatorResponse.data || coordinatorResponse; // Support both new and old format
      const rawBodyString = coordinatorResponse.rawBodyString || JSON.stringify(responseData);
      const responseHeaders = coordinatorResponse.headers || {};

      // Verify Coordinator signature
      const signature = responseHeaders['x-service-signature'] || responseHeaders['X-Service-Signature'];
      const signer = responseHeaders['x-service-name'] || responseHeaders['X-Service-Name'];
      const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY;

      logger.info('[DevlabClient] Verifying Coordinator signature (sendRequest)', {
        hasSignature: !!signature,
        hasSigner: !!signer,
        signer,
        hasPublicKey: !!coordinatorPublicKey,
        rawBodyLength: rawBodyString?.length || 0,
        rawBodyPreview: rawBodyString?.substring(0, 200) || '',
        allHeaders: Object.keys(responseHeaders),
      });

      if (!signature || !signer) {
        logger.error('[DevlabClient] Missing coordinator signature headers (sendRequest)', {
          hasSignature: !!signature,
          hasSigner: !!signer,
          allHeaders: Object.keys(responseHeaders),
        });
        throw new Error('Missing coordinator signature');
      }
      if (signer !== 'coordinator') {
        logger.error('[DevlabClient] Unexpected signer (sendRequest)', {
          expected: 'coordinator',
          received: signer,
        });
        throw new Error('Unexpected signer: ' + signer);
      }

      if (coordinatorPublicKey) {
        logger.info('[DevlabClient] Verifying signature with public key (sendRequest)', {
          signatureLength: signature?.length || 0,
          signaturePreview: signature?.substring(0, 50) || '',
          publicKeyLength: coordinatorPublicKey?.length || 0,
          publicKeyPreview: coordinatorPublicKey?.substring(0, 50) || '',
          rawBodyLength: rawBodyString?.length || 0,
        });
        
        const isValid = verifyCoordinatorSignature(coordinatorPublicKey, signature, rawBodyString);
        
        logger.info('[DevlabClient] Signature verification result (sendRequest)', {
          isValid,
          signatureLength: signature?.length || 0,
          rawBodyLength: rawBodyString?.length || 0,
        });
        
        if (!isValid) {
          logger.error('[DevlabClient] Invalid coordinator signature (sendRequest)', {
            signatureLength: signature?.length || 0,
            signaturePreview: signature?.substring(0, 100) || '',
            rawBodyLength: rawBodyString?.length || 0,
            rawBodyPreview: rawBodyString?.substring(0, 500) || '',
            publicKeyLength: coordinatorPublicKey?.length || 0,
            publicKeyPreview: coordinatorPublicKey?.substring(0, 100) || '',
          });
          throw new Error('Invalid coordinator signature');
        }
      } else {
        logger.warn('[DevlabClient] COORDINATOR_PUBLIC_KEY not set, skipping signature verification (sendRequest)');
      }

      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!responseData || typeof responseData !== 'object' || responseData === null) {
        logger.warn('[DevlabClient] Coordinator returned invalid response structure, using rollback mock data', {
          responseType: typeof responseData,
        });
        return this.getRollbackMockData(payload);
      }

      if (!responseData.payload || typeof responseData.payload !== 'string') {
        logger.warn('[DevlabClient] Coordinator response missing or invalid payload field, using rollback mock data', {
          payloadType: typeof responseData.payload,
          serviceName: responseData.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Parse payload string - Coordinator returns payload as stringified JSON
      let responsePayload;
      try {
        responsePayload = JSON.parse(responseData.payload);
      } catch (parseError) {
        logger.warn('[DevlabClient] Failed to parse payload from Coordinator response, using rollback mock data', {
          error: parseError.message,
          payload: responseData.payload.substring(0, 200),
          serviceName: responseData.serviceName,
        });
        return this.getRollbackMockData(payload);
      }

      // Validate that parsed payload is an object
      if (typeof responsePayload !== 'object' || responsePayload === null) {
        logger.warn('[DevlabClient] Coordinator returned invalid payload structure, using rollback mock data', {
          payloadType: typeof responsePayload,
        });
        return this.getRollbackMockData(payload);
      }

      logger.info('[DevlabClient] Successfully received response from DevLab via Coordinator', {
        payloadKeys: Object.keys(responsePayload),
        verified: responsePayload.verified,
        hasAnswer: !!responsePayload.answer,
        valid: responsePayload.valid, // backward compatibility
      });

      return responsePayload;
    } catch (error) {
      // All errors result in rollback - log warning and return mock data
      logger.warn('[DevlabClient] Coordinator request failed, using rollback mock data instead', {
        error: error.message,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      return this.getRollbackMockData(payload);
    }
  }

  /**
   * Generate AI exercises from Coordinator/DevLab
   * Used when trainer selects AI mode for exercise generation
   * 
   * IMPORTANT RULES:
   * - Code questions: Can be generated via AI OR manual (always 4 questions)
   * - Theoretical questions: ONLY AI (manual not allowed, always 4 questions)
   * - Theoretical questions require theoretical_question_type: "multiple_choice" or "open_ended"
   * 
   * @param {Object} exerciseRequest - Exercise generation request:
   *   {
   *     topic_id: string,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" | "theoretical",
   *     programming_language: string (required only for code questions),
   *     Language: string,
   *     amount: number (always 4 for both code and theoretical),
   *     theoretical_question_type: "multiple_choice" | "open_ended" (required only for theoretical questions)
   *   }
   * @returns {Promise<Object>} Response with exercises array and verified status:
   *   {
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string,
   *       solution: string,
   *       test_cases: any,
   *       difficulty: string,
   *       html_code: string (HTML code to display the exercise),
   *       ...other fields
   *     }>,
   *     verified: boolean,
   *     answer: "string" (code HTML/CSS/JS or error message) - NO devlab_exercises field!
   *   }
   */
  async generateAIExercises(exerciseRequest) {
    // Coordinator URL is now handled by postToCoordinator
    const endpoint = '/api/fill-content-metrics/';

    // Validate question type
    const questionType = exerciseRequest.question_type || 'code';
    if (questionType === 'theoretical') {
      // Theoretical questions are AI-only - this is enforced by the caller
      logger.info('[DevlabClient] Generating AI theoretical exercises', {
        topicId: exerciseRequest?.topic_id,
      });
    } else if (questionType === 'code') {
      // Code questions can be AI or manual, but programming_language is required
      if (!exerciseRequest.programming_language) {
        throw new Error('Programming language is required for code questions');
      }
      logger.info('[DevlabClient] Generating AI code exercises', {
        topicId: exerciseRequest?.topic_id,
        programmingLanguage: exerciseRequest.programming_language,
      });
    }

    try {
      // Validate exerciseRequest
      if (!exerciseRequest || typeof exerciseRequest !== 'object') {
        throw new Error('Invalid exercise request');
      }

      // Build payload with required fields
      // Protocol: { requester_service: "content-studio", payload: { action, ... }, response: { answer: "" } }
      // Coordinator routes automatically based on action - no need for target_service
      // For code questions: amount is always 4, programming_language is required
      // For theoretical questions: amount is always 4, theoretical_question_type is required (multiple_choice or open_ended)
      // theoretical_question_type determines if questions are multiple choice (closed) or open ended
      const payloadData = {
        action: 'generate-questions',
        topic_id: exerciseRequest.topic_id || '',
        topic_name: exerciseRequest.topic_name || '',
        question_type: questionType,
        skills: Array.isArray(exerciseRequest.skills) ? exerciseRequest.skills : [],
        humanLanguage: getLanguageName(exerciseRequest.language || 'en'), // Convert language code to full name
        amount: 4, // Always 4 for both code and theoretical
      };

      // Add programming_language only for code questions
      if (questionType === 'code') {
        payloadData.programming_language = exerciseRequest.programming_language || '';
      }

      // Add theoretical_question_type only for theoretical questions
      if (questionType === 'theoretical') {
        payloadData.theoretical_question_type = exerciseRequest.theoretical_question_type || 'multiple_choice';
      }

      // Build full request envelope for Coordinator
      const envelope = {
        requester_service: 'content-studio',
        payload: payloadData,
        response: {
          answer: '',
        },
      };

      logger.info('[DevlabClient] Sending AI exercise generation request to Coordinator', {
        topicId: payloadData.topic_id,
        topicName: payloadData.topic_name,
        questionType: payloadData.question_type,
        amount: payloadData.amount,
        programmingLanguage: payloadData.programming_language || 'N/A',
        theoreticalQuestionType: payloadData.theoretical_question_type || 'N/A',
      });

      // Log full request envelope (what we send to Coordinator)
      logger.info('[DevlabClient] Full request envelope to Coordinator (generateAIExercises)', {
        envelope: JSON.stringify(envelope, null, 2),
        envelopeKeys: Object.keys(envelope),
        payloadKeys: Object.keys(payloadData),
        fullPayload: JSON.stringify(payloadData, null, 2),
      });

      // Send request via Coordinator
      logger.info('[DevlabClient] About to send request to Coordinator', {
        endpoint,
        timeout: 180000,
        envelopePayloadKeys: Object.keys(envelope.payload),
        hasTargetService: !!envelope.payload.target_service,
        targetServiceValue: envelope.payload.target_service,
        actionValue: envelope.payload.action,
      });
      
      const coordinatorResponse = await postToCoordinator(envelope, {
        endpoint,
        timeout: 180000, // 3 minutes timeout for AI generation (passed to Coordinator via X-Request-Timeout header)
      });
      
      logger.info('[DevlabClient] Received response from Coordinator', {
        hasData: !!coordinatorResponse.data,
        hasRawBody: !!coordinatorResponse.rawBodyString,
        dataKeys: coordinatorResponse.data ? Object.keys(coordinatorResponse.data) : [],
        responsePreview: JSON.stringify(coordinatorResponse.data || coordinatorResponse).substring(0, 500),
      });

      // Extract response components
      const responseData = coordinatorResponse.data || coordinatorResponse; // Support both new and old format
      const rawBodyString = coordinatorResponse.rawBodyString || JSON.stringify(responseData);
      const responseHeaders = coordinatorResponse.headers || {};

      // Try to parse rawBodyString to see if it contains the actual response from devlab-service
      let parsedRawBody = null;
      try {
        parsedRawBody = JSON.parse(rawBodyString);
        logger.info('[DevlabClient] Parsed rawBodyString', {
          parsedKeys: parsedRawBody ? Object.keys(parsedRawBody) : [],
          hasResponse: !!parsedRawBody?.response,
          responseKeys: parsedRawBody?.response ? Object.keys(parsedRawBody.response) : [],
          hasResponseAnswer: !!parsedRawBody?.response?.answer,
          responseAnswerLength: parsedRawBody?.response?.answer?.length || 0,
        });
      } catch (parseError) {
        logger.warn('[DevlabClient] Failed to parse rawBodyString', {
          error: parseError.message,
        });
      }

      // Log full response structure to see what Coordinator actually returns
      logger.info('[DevlabClient] Full Coordinator response (before processing)', {
        responseDataType: typeof responseData,
        responseDataKeys: responseData ? Object.keys(responseData) : [],
        hasData: !!responseData.data,
        dataKeys: responseData.data ? Object.keys(responseData.data) : [],
        dataAnswer: responseData.data?.answer,
        dataAnswerType: typeof responseData.data?.answer,
        dataAnswerLength: responseData.data?.answer?.length || 0,
        hasResponse: !!responseData.response,
        responseKeys: responseData.response ? Object.keys(responseData.response) : [],
        responseAnswer: responseData.response?.answer,
        responseAnswerType: typeof responseData.response?.answer,
        responseAnswerLength: responseData.response?.answer?.length || 0,
        hasPayload: !!responseData.payload,
        payloadType: typeof responseData.payload,
        hasMetadata: !!responseData.metadata,
        metadataKeys: responseData.metadata ? Object.keys(responseData.metadata) : [],
        metadataContent: responseData.metadata ? JSON.stringify(responseData.metadata) : null,
        parsedRawBodyKeys: parsedRawBody ? Object.keys(parsedRawBody) : [],
        parsedRawBodyResponseAnswer: parsedRawBody?.response?.answer,
        parsedRawBodyData: parsedRawBody?.data ? JSON.stringify(parsedRawBody.data).substring(0, 500) : null,
        fullResponseData: JSON.stringify(responseData, null, 2).substring(0, 2000),
        rawBodyString: rawBodyString.substring(0, 500),
        // Deep inspection: check if answer is nested in metadata or other fields
        allNestedFields: JSON.stringify(responseData, null, 2),
      });

      // Verify Coordinator signature
      const signature = responseHeaders['x-service-signature'] || responseHeaders['X-Service-Signature'];
      const signer = responseHeaders['x-service-name'] || responseHeaders['X-Service-Name'];
      const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY || process.env.CONTENT_STUDIO_COORDINATOR_PUBLIC_KEY;

      logger.info('[DevlabClient] Verifying Coordinator signature (generateAIExercises)', {
        hasSignature: !!signature,
        hasSigner: !!signer,
        signer,
        hasPublicKey: !!coordinatorPublicKey,
        rawBodyLength: rawBodyString?.length || 0,
        rawBodyPreview: rawBodyString?.substring(0, 200) || '',
        responseDataKeys: responseData ? Object.keys(responseData) : [],
        allHeaders: Object.keys(responseHeaders),
      });

      if (!signature || !signer) {
        logger.error('[DevlabClient] Missing coordinator signature headers (generateAIExercises)', {
          hasSignature: !!signature,
          hasSigner: !!signer,
          allHeaders: Object.keys(responseHeaders),
        });
        throw new Error('Missing coordinator signature');
      }
      if (signer !== 'coordinator') {
        logger.error('[DevlabClient] Unexpected signer (generateAIExercises)', {
          expected: 'coordinator',
          received: signer,
        });
        throw new Error('Unexpected signer: ' + signer);
      }

      if (coordinatorPublicKey) {
        // IMPORTANT: Always verify signature on the FULL raw response body
        // Coordinator signs the entire response body, not just parts of it
        // We MUST verify on rawBodyString (the complete JSON string), NOT on responseData.data
        const bodyToVerify = rawBodyString; // Full object: {"success":true,"data":{...},"metadata":{...}}
        
        // Log what we're verifying to ensure we're using the full object
        logger.info('[DevlabClient] Verifying signature with public key (generateAIExercises)', {
          signatureLength: signature?.length || 0,
          signaturePreview: signature?.substring(0, 50) || '',
          publicKeyLength: coordinatorPublicKey?.length || 0,
          publicKeyPreview: coordinatorPublicKey?.substring(0, 50) || '',
          rawBodyLength: rawBodyString?.length || 0,
          rawBodyPreview: rawBodyString?.substring(0, 200) || '',
          bodyToVerifyLength: bodyToVerify?.length || 0,
          bodyToVerifyPreview: bodyToVerify?.substring(0, 200) || '',
          // Ensure we're NOT verifying only on data
          dataOnlyLength: responseData.data ? JSON.stringify(responseData.data).length : 0,
          verifyingFullObject: true,
        });
        
        const isValid = verifyCoordinatorSignature(coordinatorPublicKey, signature, bodyToVerify);
        
        logger.info('[DevlabClient] Signature verification result (generateAIExercises)', {
          isValid,
          signatureLength: signature?.length || 0,
          rawBodyLength: rawBodyString?.length || 0,
        });
        
        if (!isValid) {
          logger.error('[DevlabClient] Invalid coordinator signature (generateAIExercises)', {
            signatureLength: signature?.length || 0,
            signaturePreview: signature?.substring(0, 100) || '',
            rawBodyLength: rawBodyString?.length || 0,
            rawBodyPreview: rawBodyString?.substring(0, 500) || '',
            publicKeyLength: coordinatorPublicKey?.length || 0,
            publicKeyPreview: coordinatorPublicKey?.substring(0, 100) || '',
            responseDataKeys: responseData ? Object.keys(responseData) : [],
          });
          // Don't throw error - just log warning and continue
          // The signature verification might be failing due to Coordinator changes
          logger.warn('[DevlabClient] Signature verification failed, but continuing anyway (may need Coordinator update)');
        }
      } else {
        logger.warn('[DevlabClient] COORDINATOR_PUBLIC_KEY not set, skipping signature verification (generateAIExercises)');
      }

      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      // OR new format: { success: true, data: { payload: "<stringified JSON>" }, metadata: {...} }
      if (!responseData || typeof responseData !== 'object' || responseData === null) {
        throw new Error('Invalid response structure from Coordinator');
      }

      // Log full response structure for debugging
      logger.info('[DevlabClient] Full Coordinator response structure', {
        responseDataKeys: responseData ? Object.keys(responseData) : [],
        hasData: !!responseData.data,
        dataKeys: responseData.data ? Object.keys(responseData.data) : [],
        dataAnswer: responseData.data?.answer,
        dataAnswerType: typeof responseData.data?.answer,
        dataAnswerLength: responseData.data?.answer?.length || 0,
        dataPayload: responseData.data?.payload ? responseData.data.payload.substring(0, 100) : null,
        hasPayload: !!responseData.payload,
        payloadType: typeof responseData.payload,
        fullResponse: JSON.stringify(responseData).substring(0, 1000),
      });

      // Support both old and new response formats
      // Coordinator may return the response in different formats:
      // 1. { response: { answer: "..." } } - envelope format from devlab-service (PRIORITY)
      // 2. { success: true, data: { answer: "..." } } - new format
      // 3. { data: { payload: "..." } } - payload format
      // 4. { payload: "..." } - old format
      // Priority: 1. response.answer (envelope format), 2. data.answer (new format), 3. data.payload (JSON stringified), 4. payload (old format)
      let answer = null;
      let responseStructure = null;
      
      // First, check if we have response.answer (envelope format from devlab-service)
      // This is the format devlab-service returns: { requester_service, payload, response: { answer: "..." } }
      // Also check parsedRawBody in case Coordinator wraps it differently
      // Also check metadata.response.answer in case Coordinator puts it there
      const responseAnswer = responseData.response?.answer || 
                            parsedRawBody?.response?.answer ||
                            responseData.metadata?.response?.answer ||
                            parsedRawBody?.metadata?.response?.answer;
      
      if (responseAnswer && typeof responseAnswer === 'string') {
        logger.info('[DevlabClient] Found response.answer (envelope format from devlab-service)', {
          answerLength: responseAnswer.length,
          answerPreview: responseAnswer.substring(0, 100),
          source: responseData.response?.answer ? 'responseData.response' : 'parsedRawBody.response',
        });
        // This is the answer from devlab-service - it's JSON stringified
        let rawAnswer = responseAnswer;
        
        // Try to parse as JSON first (devlab-service returns JSON stringified response)
        try {
          const parsedAnswer = JSON.parse(rawAnswer);
          logger.info('[DevlabClient] Parsed response.answer as JSON', {
            parsedKeys: Object.keys(parsedAnswer),
            hasData: !!parsedAnswer.data,
            dataKeys: parsedAnswer.data ? Object.keys(parsedAnswer.data) : [],
            hasHtml: !!parsedAnswer.data?.html,
            htmlLength: parsedAnswer.data?.html?.length || 0,
          });
          
          // Extract HTML from parsed answer (devlab-service format: { success, data: { html, questions, metadata } })
          if (parsedAnswer.data?.html && typeof parsedAnswer.data.html === 'string') {
            answer = parsedAnswer.data.html;
            logger.info('[DevlabClient] Extracted HTML from response.answer', {
              htmlLength: answer.length,
              htmlPreview: answer.substring(0, 100),
            });
          } else {
            // Fallback: use the raw answer if no HTML field found
            answer = rawAnswer;
            logger.warn('[DevlabClient] No HTML field in parsed response.answer, using raw answer', {
              parsedKeys: Object.keys(parsedAnswer),
            });
          }
        } catch (parseError) {
          // If parsing fails, treat it as plain HTML string
          answer = rawAnswer;
          logger.info('[DevlabClient] response.answer is not JSON, using as plain HTML string', {
            answerLength: answer.length,
            answerPreview: answer.substring(0, 100),
          });
        }
      }
      // Check if we have direct answer in data.answer (new format)
      else if (responseData.data?.answer && typeof responseData.data.answer === 'string') {
        // Direct answer format: { success: true, data: { answer: "..." } }
        // BUT: If answer is "content-studio", this is an error - Coordinator didn't get the real answer
        if (responseData.data.answer === 'content-studio' || responseData.data.answer === SERVICE_NAME) {
          logger.error('[DevlabClient] Coordinator returned service name in data.answer - this indicates Coordinator did not receive answer from devlab-service', {
            answer: responseData.data.answer,
            metadata: responseData.metadata,
            fullResponse: JSON.stringify(responseData).substring(0, 1000),
          });
          // Don't set answer here - let it fall through to error handling
        } else {
          // The answer might be a JSON stringified object that contains the HTML
          let rawAnswer = responseData.data.answer;
          
          // Try to parse as JSON first (devlab-service returns JSON stringified response)
          try {
            const parsedAnswer = JSON.parse(rawAnswer);
            logger.info('[DevlabClient] Parsed data.answer as JSON', {
              parsedKeys: Object.keys(parsedAnswer),
              hasData: !!parsedAnswer.data,
              dataKeys: parsedAnswer.data ? Object.keys(parsedAnswer.data) : [],
              hasHtml: !!parsedAnswer.data?.html,
              htmlLength: parsedAnswer.data?.html?.length || 0,
            });
            
            // Extract HTML from parsed answer (devlab-service format: { success, data: { html, questions, metadata } })
            if (parsedAnswer.data?.html && typeof parsedAnswer.data.html === 'string') {
              answer = parsedAnswer.data.html;
              logger.info('[DevlabClient] Extracted HTML from parsed answer', {
                htmlLength: answer.length,
                htmlPreview: answer.substring(0, 100),
              });
            } else {
              // Fallback: use the raw answer if no HTML field found
              answer = rawAnswer;
              logger.warn('[DevlabClient] No HTML field in parsed answer, using raw answer', {
                parsedKeys: Object.keys(parsedAnswer),
              });
            }
          } catch (parseError) {
            // If parsing fails, treat it as plain HTML string
            answer = rawAnswer;
            logger.info('[DevlabClient] data.answer is not JSON, using as plain HTML string', {
              answerLength: answer.length,
              answerPreview: answer.substring(0, 100),
            });
          }
        }
      } else {
        // Try to find payload (old format or nested format)
        // Also check metadata for nested response
        let payloadString = null;
        
        // Check metadata.response.answer or metadata.data.answer
        if (responseData.metadata?.response?.answer && typeof responseData.metadata.response.answer === 'string') {
          logger.info('[DevlabClient] Found answer in metadata.response.answer', {
            answerLength: responseData.metadata.response.answer.length,
            answerPreview: responseData.metadata.response.answer.substring(0, 100),
          });
          answer = responseData.metadata.response.answer;
        } else if (responseData.metadata?.data?.answer && typeof responseData.metadata.data.answer === 'string') {
          logger.info('[DevlabClient] Found answer in metadata.data.answer', {
            answerLength: responseData.metadata.data.answer.length,
            answerPreview: responseData.metadata.data.answer.substring(0, 100),
          });
          answer = responseData.metadata.data.answer;
        } else if (responseData.data?.payload && typeof responseData.data.payload === 'string') {
          // New format: { success: true, data: { payload: "..." } }
          payloadString = responseData.data.payload;
        } else if (responseData.payload && typeof responseData.payload === 'string') {
          // Old format: { serviceName: "ContentStudio", payload: "..." }
          payloadString = responseData.payload;
        }
        
        if (payloadString) {
          // Parse payload to get the nested structure
          try {
            responseStructure = JSON.parse(payloadString);
            logger.info('[DevlabClient] Parsed payload successfully', {
              payloadLength: payloadString.length,
              structureKeys: responseStructure ? Object.keys(responseStructure) : [],
            });
            
            // Extract answer from nested structure
            // Structure: { requester_service: "content-studio", payload: {...}, response: { answer: "string" } }
            if (responseStructure.response && typeof responseStructure.response.answer === 'string') {
              answer = responseStructure.response.answer;
            } else if (responseStructure.answer && typeof responseStructure.answer === 'string') {
              // Alternative structure: { answer: "string" }
              answer = responseStructure.answer;
            }
          } catch (parseError) {
            logger.error('[DevlabClient] Failed to parse payload as JSON', {
              payloadLength: payloadString.length,
              payloadPreview: payloadString.substring(0, 200),
              error: parseError.message,
            });
            throw new Error(`Failed to parse response payload: ${parseError.message}. Payload preview: ${payloadString.substring(0, 100)}`);
          }
        }
      }

      // Check if we have an answer
      if (!answer || answer.trim().length === 0) {
        // Special case: If data.answer is "content-studio", this is a Coordinator error
        if (responseData.data?.answer === 'content-studio' || responseData.data?.answer === SERVICE_NAME) {
          logger.error('[DevlabClient] Coordinator returned service name instead of devlab-service answer', {
            topicId: payloadData.topic_id,
            answer: responseData.data.answer,
            metadata: responseData.metadata,
            fullResponse: JSON.stringify(responseData).substring(0, 1000),
            possibleCauses: [
              'devlab-service did not respond correctly',
              'Coordinator routing error',
              'devlab-service returned error that Coordinator converted to service name',
              'Timeout or connection issue between Coordinator and devlab-service',
            ],
          });
          throw new Error('Coordinator returned service name instead of exercise code. This indicates a Coordinator routing or processing error. Check Coordinator logs and devlab-service status.');
        }
        
        // Check if this is an error response
        if (responseData.success === false || (responseData.data && responseData.data.error)) {
          const errorMessage = responseData.data?.error || responseData.error || 'Unknown error from Coordinator';
          logger.error('[DevlabClient] Coordinator returned error response', {
            error: errorMessage,
            responseData: JSON.stringify(responseData).substring(0, 500),
          });
          throw new Error(`Coordinator error: ${errorMessage}`);
        }
        
        // If no answer and no error, this is an unexpected response format
        logger.error('[DevlabClient] Missing answer in response', {
          responseDataKeys: responseData ? Object.keys(responseData) : [],
          hasData: !!responseData.data,
          dataKeys: responseData.data ? Object.keys(responseData.data) : [],
          dataAnswer: responseData.data?.answer,
          hasMetadata: !!responseData.metadata,
          metadataKeys: responseData.metadata ? Object.keys(responseData.metadata) : [],
          responseDataPreview: JSON.stringify(responseData).substring(0, 1000),
          success: responseData.success,
        });
        throw new Error('Missing answer in response. Expected data.answer, data.payload, or payload field. Response: ' + JSON.stringify(responseData).substring(0, 500));
      }

      // answer is ALWAYS a plain string (code HTML/CSS/JS or error message) - NEVER JSON

      // Check if answer is a service name (invalid response from Coordinator)
      if (answer === 'content-studio' || answer === SERVICE_NAME) {
        logger.error('[DevlabClient] Coordinator returned service name instead of answer - invalid response', {
          topicId: payloadData.topic_id,
          answer,
          responseData: JSON.stringify(responseData).substring(0, 500),
        });
        throw new Error('Invalid response from Coordinator: received service name instead of exercise code. This indicates a Coordinator routing or processing error.');
      }

      // Check if answer is an error message or code
      // Error messages typically don't contain HTML/CSS/JS code patterns
      const isError = answer.length === 0 || 
        answer.toLowerCase().includes('error') ||
        answer.toLowerCase().includes('failed') ||
        answer.toLowerCase().includes('invalid') ||
        answer.toLowerCase().includes('not match') ||
        answer.toLowerCase().includes('does not match') ||
        (!answer.includes('<') && !answer.includes('function') && !answer.includes('const') && !answer.includes('let'));

      if (isError) {
        const errorMessage = answer || 'Exercise validation failed';
        logger.warn('[DevlabClient] AI exercises generation failed', {
          topicId: payloadData.topic_id,
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      // If answer contains code (not error), return it
      const finalResponse = {
        answer: answer, // The code (HTML/CSS/JS) - will be saved to DB in devlab_exercises
      };

      logger.info('[DevlabClient] Successfully received AI exercises from Coordinator', {
        topicId: payloadData.topic_id,
        questionType: questionType,
        answerLength: answer.length,
        hasAnswer: answer.length > 0,
      });

      return finalResponse;
    } catch (error) {
      logger.error('[DevlabClient] Failed to generate AI exercises', {
        error: error.message,
        endpoint,
        topicId: exerciseRequest?.topic_id,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }

  /**
   * Validate manual exercises from trainer
   * Used when trainer selects Manual mode and submits questions
   * 
   * IMPORTANT RULES:
   * - ONLY code questions can be manual (theoretical questions are AI-only)
   * - Always sends 4 questions together as an array
   * - Coordinator returns if approved and HTML code to display them
   * 
   * @param {Object} exerciseData - Exercise data (can be single exercise or array of 4):
   *   {
   *     topic_id: string,
   *     topic_name: string,
   *     skills: string[],
   *     question_type: "code" (only code allowed for manual),
   *     programming_language: string (required),
   *     Language: string,
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string (optional),
   *       solution: string (optional)
   *     }> (exactly 4 exercises)
   *   }
   * @returns {Promise<Object>} Validation result:
   *   {
   *     verified: boolean,
   *     valid: boolean (backward compatibility),
   *     message: string (if rejected),
   *     exercises: Array<{
   *       question_text: string,
   *       hint: string,
   *       solution: string,
   *       html_code: string (HTML code to display the exercise),
   *       ...other fields
   *     }> (if approved, contains validated exercises),
   *     answer: "string" (code HTML/CSS/JS or error message) - NO devlab_exercises field!
   *   }
   */
  async validateManualExercise(exerciseData) {
    // Coordinator URL is now handled by postToCoordinator
    const endpoint = '/api/fill-content-metrics';

    // Validate that only code questions can be manual
    const questionType = exerciseData.question_type || 'code';
    if (questionType !== 'code') {
      throw new Error('Manual exercises are only allowed for code questions. Theoretical questions must be AI-generated.');
    }

    // Validate programming_language is provided for code questions
    if (!exerciseData.programming_language) {
      throw new Error('Programming language is required for code questions');
    }

    // Validate that exercises array exists and has exactly 4 items
    const exercises = Array.isArray(exerciseData.exercises) ? exerciseData.exercises : [];
    if (exercises.length !== 4) {
      throw new Error('Manual code exercises must include exactly 4 questions');
    }

    try {
      // Validate exerciseData
      if (!exerciseData || typeof exerciseData !== 'object') {
        throw new Error('Invalid exercise data');
      }

      // Build payload with required fields
      // Protocol: { requester_service: "content-studio", payload: { action, ... }, response: { answer: "" } }
      // For manual code exercises: always send 4 questions together
      // exercises is an array of strings (question texts)
      // Coordinator routes automatically based on action - no need for target_service
      const payloadData = {
        action: 'validate-question',
        topic_id: exerciseData.topic_id || '',
        topic_name: exerciseData.topic_name || '',
        question_type: 'code', // Manual is only for code questions
        programming_language: exerciseData.programming_language || '',
        skills: Array.isArray(exerciseData.skills) ? exerciseData.skills : [],
        humanLanguage: getLanguageName(exerciseData.Language || exerciseData.language || 'en'), // Convert language code to full name
        exercises: exercises.map(ex => {
          // Support both string format and object format for backward compatibility
          if (typeof ex === 'string') {
            return ex;
          }
          return ex.question_text || '';
        }), // Array of 4 question strings
      };

      // Build full request envelope for Coordinator
      const envelope = {
        requester_service: 'content-studio',
        payload: payloadData,
        response: {
          answer: '',
        },
      };

      logger.info('[DevlabClient] Sending manual code exercises validation request to Coordinator', {
        topicId: payloadData.topic_id,
        questionType: payloadData.question_type,
        exercisesCount: exercises.length,
        programmingLanguage: payloadData.programming_language,
      });

      // Log full request envelope (what we send to Coordinator)
      logger.info('[DevlabClient] Full request envelope to Coordinator (validateManualExercise)', {
        envelope: JSON.stringify(envelope, null, 2),
        envelopeKeys: Object.keys(envelope),
        payloadKeys: Object.keys(payloadData),
        fullPayload: JSON.stringify(payloadData, null, 2),
        exercisesPreview: exercises.map(ex => typeof ex === 'string' ? ex.substring(0, 100) : ex).slice(0, 2),
      });

      // Send request via Coordinator
      const coordinatorResponse = await postToCoordinator(envelope, {
        endpoint,
        timeout: 180000, // 3 minutes timeout
      });

      // Extract response components
      const responseData = coordinatorResponse.data || coordinatorResponse; // Support both new and old format
      const rawBodyString = coordinatorResponse.rawBodyString || JSON.stringify(responseData);
      const responseHeaders = coordinatorResponse.headers || {};

      // Verify Coordinator signature
      const signature = responseHeaders['x-service-signature'] || responseHeaders['X-Service-Signature'];
      const signer = responseHeaders['x-service-name'] || responseHeaders['X-Service-Name'];
      const coordinatorPublicKey = process.env.COORDINATOR_PUBLIC_KEY || process.env.CONTENT_STUDIO_COORDINATOR_PUBLIC_KEY;

      logger.info('[DevlabClient] Verifying Coordinator signature (validateManualExercise)', {
        hasSignature: !!signature,
        hasSigner: !!signer,
        signer,
        hasPublicKey: !!coordinatorPublicKey,
        rawBodyLength: rawBodyString?.length || 0,
        rawBodyPreview: rawBodyString?.substring(0, 200) || '',
        allHeaders: Object.keys(responseHeaders),
      });

      if (!signature || !signer) {
        logger.error('[DevlabClient] Missing coordinator signature headers (validateManualExercise)', {
          hasSignature: !!signature,
          hasSigner: !!signer,
          allHeaders: Object.keys(responseHeaders),
        });
        throw new Error('Missing coordinator signature');
      }
      if (signer !== 'coordinator') {
        logger.error('[DevlabClient] Unexpected signer (validateManualExercise)', {
          expected: 'coordinator',
          received: signer,
        });
        throw new Error('Unexpected signer: ' + signer);
      }

      if (coordinatorPublicKey) {
        logger.info('[DevlabClient] Verifying signature with public key (validateManualExercise)', {
          signatureLength: signature?.length || 0,
          signaturePreview: signature?.substring(0, 50) || '',
          publicKeyLength: coordinatorPublicKey?.length || 0,
          publicKeyPreview: coordinatorPublicKey?.substring(0, 50) || '',
          rawBodyLength: rawBodyString?.length || 0,
        });
        
        const isValid = verifyCoordinatorSignature(coordinatorPublicKey, signature, rawBodyString);
        
        logger.info('[DevlabClient] Signature verification result (validateManualExercise)', {
          isValid,
          signatureLength: signature?.length || 0,
          rawBodyLength: rawBodyString?.length || 0,
        });
        
        if (!isValid) {
          logger.error('[DevlabClient] Invalid coordinator signature (validateManualExercise)', {
            signatureLength: signature?.length || 0,
            signaturePreview: signature?.substring(0, 100) || '',
            rawBodyLength: rawBodyString?.length || 0,
            rawBodyPreview: rawBodyString?.substring(0, 500) || '',
            publicKeyLength: coordinatorPublicKey?.length || 0,
            publicKeyPreview: coordinatorPublicKey?.substring(0, 100) || '',
          });
          throw new Error('Invalid coordinator signature');
        }
      } else {
        logger.warn('[DevlabClient] COORDINATOR_PUBLIC_KEY not set, skipping signature verification (validateManualExercise)');
      }

      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      if (!responseData || typeof responseData !== 'object' || responseData === null) {
        throw new Error('Invalid response structure from Coordinator');
      }

      if (!responseData.payload || typeof responseData.payload !== 'string') {
        throw new Error('Missing or invalid payload in response');
      }

      // Parse response structure
      // Coordinator returns: { serviceName: "ContentStudio", payload: "<stringified JSON>" }
      // Inside payload: { requester_service: "content-studio", payload: {...}, response: { answer: "<stringified JSON>" } }
      // The answer field contains the actual response data
      let responseStructure;
      try {
        responseStructure = JSON.parse(responseData.payload);
      } catch (parseError) {
        throw new Error(`Failed to parse response payload: ${parseError.message}`);
      }

      // Validate response structure
      if (typeof responseStructure !== 'object' || responseStructure === null) {
        throw new Error('Invalid payload structure in response');
      }

      // Extract response object
      if (!responseStructure.response || typeof responseStructure.response !== 'object') {
        throw new Error('Missing or invalid response field in payload');
      }

      // answer can be:
      // 1. A JSON stringified object with { success: true, data: { status: "needs_revision", message: "..." } }
      // 2. A plain HTML/CSS/JS code string (if validation passed)
      const answer = typeof responseStructure.response.answer === 'string' 
        ? responseStructure.response.answer 
        : '';

      // Try to parse answer as JSON to check if it's a validation rejection
      let parsedAnswer;
      let isNeedsRevision = false;
      let revisionMessage = '';

      try {
        parsedAnswer = JSON.parse(answer);
        // Check if it's a validation rejection response
        if (parsedAnswer && 
            parsedAnswer.success === true && 
            parsedAnswer.data && 
            parsedAnswer.data.status === 'needs_revision' &&
            typeof parsedAnswer.data.message === 'string') {
          isNeedsRevision = true;
          revisionMessage = parsedAnswer.data.message;
        }
      } catch (parseError) {
        // Not JSON, treat as plain code string
        parsedAnswer = null;
      }

      // If validation failed (needs_revision), throw error with message
      if (isNeedsRevision) {
        logger.warn('[DevlabClient] Manual exercises validation failed - needs revision', {
          topicId: payloadData.topic_id,
          revisionMessage,
        });
        throw new Error(revisionMessage);
      }

      // If answer is empty or doesn't look like code, treat as error
      if (answer.length === 0) {
        const errorMessage = 'Exercise validation failed - empty response';
        logger.warn('[DevlabClient] Manual exercises validation failed - empty answer', {
          topicId: payloadData.topic_id,
        });
        throw new Error(errorMessage);
      }

      // Check if answer looks like code (contains HTML/CSS/JS patterns)
      const looksLikeCode = answer.includes('<') || 
                           answer.includes('function') || 
                           answer.includes('const') || 
                           answer.includes('let') ||
                           answer.includes('{') ||
                           answer.includes('css') ||
                           answer.includes('html');

      if (!looksLikeCode) {
        // If it doesn't look like code, it might be an error message
        const errorMessage = answer || 'Exercise validation failed';
        logger.warn('[DevlabClient] Manual exercises validation failed - answer does not look like code', {
          topicId: payloadData.topic_id,
          errorMessage: errorMessage.substring(0, 200),
        });
        throw new Error(errorMessage);
      }

      // If answer contains code (validation passed), return it
      // The answer will be saved to DB in devlab_exercises field
      const finalResponse = {
        answer: answer, // The HTML code (HTML/CSS/JS) - will be saved to DB in devlab_exercises
        exercises: exercises, // Keep original exercises array for reference
      };

      logger.info('[DevlabClient] Successfully received validation result from Coordinator', {
        topicId: payloadData.topic_id,
        answerLength: answer.length,
        hasAnswer: answer.length > 0,
        exercisesCount: exercises.length,
      });

      return finalResponse;
    } catch (error) {
      logger.error('[DevlabClient] Failed to validate manual exercise', {
        error: error.message,
        endpoint,
        topicId: exerciseData?.topic_id,
        errorType: error.response ? 'response_error' : error.request ? 'no_response' : 'request_error',
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }

  /**
   * Fetch trainer question validation from DevLab
   * @param {string} question - Question text
   * @param {string} courseId - Course ID
   * @param {string} trainerId - Trainer ID
   * @returns {Promise<Object>} Question validation result with filled fields:
   *   - question: string
   *   - course_id: string
   *   - trainer_id: string
   *   - valid: boolean
   *   - message: string (only in fail case)
   *   - ajax: any (only if valid=true, Content Studio does NOT validate this)
   */
  async fetchTrainerQuestionValidation(question, courseId, trainerId) {
    if (!question || typeof question !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[DevlabClient] Invalid question, using rollback mock data', {
        question,
        courseId,
        trainerId,
      });
      return this.getRollbackMockData({
        question: question || '',
        course_id: courseId || '',
        trainer_id: trainerId || '',
      });
    }

    if (!courseId || typeof courseId !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[DevlabClient] Invalid courseId, using rollback mock data', {
        question,
        courseId,
        trainerId,
      });
      return this.getRollbackMockData({
        question: question || '',
        course_id: courseId || '',
        trainer_id: trainerId || '',
      });
    }

    if (!trainerId || typeof trainerId !== 'string') {
      // For invalid input, return rollback mock data
      logger.warn('[DevlabClient] Invalid trainerId, using rollback mock data', {
        question,
        courseId,
        trainerId,
      });
      return this.getRollbackMockData({
        question: question || '',
        course_id: courseId || '',
        trainer_id: trainerId || '',
      });
    }

    logger.info('[DevlabClient] Fetching trainer question validation from DevLab', {
      question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      courseId,
      trainerId,
    });

    // Build payload object with empty fields
    const payload = {
      question: question,
      course_id: courseId,
      trainer_id: trainerId,
      valid: null,
      message: '',
      ajax: null,
    };

    // Send request to DevLab (will return rollback mock data if it fails)
    const filledValidation = await this.sendRequest(payload);

    // Build validated response with all required fields
    // Important: Content Studio does NOT inspect ajax field - return it AS IS if valid=true
    const validatedResult = {
      question: typeof filledValidation.question === 'string' ? filledValidation.question : question,
      course_id: typeof filledValidation.course_id === 'string' ? filledValidation.course_id : courseId,
      trainer_id: typeof filledValidation.trainer_id === 'string' ? filledValidation.trainer_id : trainerId,
      valid: typeof filledValidation.valid === 'boolean' ? filledValidation.valid : false,
      message: typeof filledValidation.message === 'string' ? filledValidation.message : '',
      // Return ajax AS IS - Content Studio does NOT validate this field
      ajax: filledValidation.ajax !== undefined ? filledValidation.ajax : null,
    };

    logger.info('[DevlabClient] Trainer question validation fetched successfully', {
      question: validatedResult.question.substring(0, 100) + (validatedResult.question.length > 100 ? '...' : ''),
      courseId: validatedResult.course_id,
      trainerId: validatedResult.trainer_id,
      valid: validatedResult.valid,
      hasMessage: validatedResult.message.length > 0,
      hasAjax: validatedResult.ajax !== null,
    });

    return validatedResult;
  }
}

// Export singleton instance
let devlabClientInstance = null;

/**
 * Get DevLab client singleton instance
 * @returns {DevlabClient} DevLab client instance
 */
export function getDevlabClient() {
  if (!devlabClientInstance) {
    devlabClientInstance = new DevlabClient();
  }
  return devlabClientInstance;
}

// Export convenience functions
export async function validateTrainerQuestion(question, courseId, trainerId) {
  const client = getDevlabClient();
  return client.fetchTrainerQuestionValidation(question, courseId, trainerId);
}

export async function generateAIExercises(exerciseRequest) {
  const client = getDevlabClient();
  return client.generateAIExercises(exerciseRequest);
}

export async function validateManualExercise(exerciseData) {
  const client = getDevlabClient();
  return client.validateManualExercise(exerciseData);
}

