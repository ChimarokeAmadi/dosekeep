export class AppError extends Error {
  constructor(code, message, { status = 400, fields } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export const notFound = (what) => new AppError('NOT_FOUND', `${what} not found`, { status: 404 });
export const forbidden = (message = 'Not allowed') => new AppError('FORBIDDEN', message, { status: 403 });
