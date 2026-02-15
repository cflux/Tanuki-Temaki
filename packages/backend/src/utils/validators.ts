/**
 * Reusable validation utilities
 * Provides common validation functions to reduce duplication across routes
 */
import { AppError } from '../middleware/errorHandler.js';

/**
 * Validate that required fields are present in an object
 * @param data - Object to validate
 * @param fields - Array of required field names
 * @throws AppError if any required field is missing
 */
export function validateRequired(data: Record<string, any>, fields: string[]): void {
  const missing = fields.filter(field => data[field] === undefined || data[field] === null);
  if (missing.length > 0) {
    throw new AppError(400, `Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate that a number is within a specified range
 * @param value - Number to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Name of the field being validated (for error message)
 * @throws AppError if value is not a number or is out of range
 */
export function validateNumberRange(
  value: any,
  min: number,
  max: number,
  fieldName: string = 'value'
): void {
  if (typeof value !== 'number') {
    throw new AppError(400, `${fieldName} must be a number`);
  }
  if (value < min || value > max) {
    throw new AppError(400, `${fieldName} must be between ${min} and ${max}`);
  }
}

/**
 * Validate rating value (0-5)
 * @param rating - Rating value to validate
 * @throws AppError if rating is invalid
 */
export function validateRating(rating: any): void {
  validateNumberRange(rating, 0, 5, 'rating');
}

/**
 * Validate that a string is not empty
 * @param value - String to validate
 * @param fieldName - Name of the field being validated
 * @throws AppError if value is not a string or is empty
 */
export function validateNonEmptyString(value: any, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, `${fieldName} must be a non-empty string`);
  }
}

/**
 * Validate series ID format
 * @param seriesId - Series ID to validate
 * @throws AppError if seriesId is invalid
 */
export function validateSeriesId(seriesId: any): void {
  validateNonEmptyString(seriesId, 'seriesId');
}

/**
 * Validate that a value is one of the allowed options
 * @param value - Value to validate
 * @param allowedValues - Array of allowed values
 * @param fieldName - Name of the field being validated
 * @throws AppError if value is not in allowedValues
 */
export function validateEnum<T>(value: any, allowedValues: T[], fieldName: string): void {
  if (!allowedValues.includes(value as T)) {
    throw new AppError(
      400,
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Validate array of values
 * @param value - Value to validate
 * @param fieldName - Name of the field being validated
 * @param validator - Optional validator function for each array element
 * @throws AppError if value is not an array
 */
export function validateArray(
  value: any,
  fieldName: string,
  validator?: (item: any) => void
): void {
  if (!Array.isArray(value)) {
    throw new AppError(400, `${fieldName} must be an array`);
  }
  if (validator) {
    value.forEach((item, index) => {
      try {
        validator(item);
      } catch (error) {
        if (error instanceof AppError) {
          throw new AppError(
            400,
            `${fieldName}[${index}]: ${error.message.replace(/^\d+:\s*/, '')}`
          );
        }
        throw error;
      }
    });
  }
}
