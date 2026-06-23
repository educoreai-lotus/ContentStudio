/**
 * Resolve authenticated directory user ID from verified Coordinator/nAuth validation.
 * Never trust client-supplied trainer_id query/body/header values for authorization.
 */
export function getDirectoryUserId(req) {
  return req.user?.directoryUserId || req.user?.userId || null;
}
