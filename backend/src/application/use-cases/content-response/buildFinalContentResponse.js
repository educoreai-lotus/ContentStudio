export function buildFinalContentResponse(originalRequest, resolvedTopics) {
  if (!originalRequest || typeof originalRequest !== 'object') {
    return JSON.stringify({ response: { course: [] } });
  }

  if (!originalRequest.response || typeof originalRequest.response !== 'object') {
    originalRequest.response = { course: [] };
  }

  if (!originalRequest.response.hasOwnProperty('course')) {
    originalRequest.response.course = [];
  }

  originalRequest.response.course = Array.isArray(resolvedTopics) ? resolvedTopics : [];

  return JSON.stringify(originalRequest);
}

