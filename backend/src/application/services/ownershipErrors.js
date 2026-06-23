export class OwnershipUnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'OwnershipUnauthorizedError';
    this.statusCode = 401;
    this.code = 'UNAUTHORIZED';
  }
}

export class OwnershipNotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'OwnershipNotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}
