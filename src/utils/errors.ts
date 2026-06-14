export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: string[];

  constructor(message: string, statusCode = 500, errors: string[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
