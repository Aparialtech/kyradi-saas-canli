/**
 * Sanitization utilities to prevent XSS and prototype pollution attacks.
 * Use these functions when displaying user-generated content.
 */

/**
 * HTML entity encoding map for preventing XSS
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param str - The string to escape
 * @returns The escaped string safe for HTML display
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) {
    return '';
  }
  
  const stringValue = String(str);
  return stringValue.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Check if a string contains potential XSS patterns
 * @param str - The string to check
 * @returns True if suspicious patterns are found
 */
export function containsXssPatterns(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  
  const xssPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /<\s*\/?\s*\w+[^>]*>/i, // HTML tags
    /data:/i,
    /vbscript:/i,
    /expression\s*\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(str));
}

/**
 * Check if a string contains prototype pollution patterns
 * @param str - The string to check
 * @returns True if suspicious patterns are found
 */
export function containsPrototypePollution(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  
  const pollutionPatterns = [
    /__proto__/i,
    /constructor/i,
    /prototype/i,
  ];
  
  return pollutionPatterns.some(pattern => pattern.test(str));
}

/**
 * Sanitize a string for safe display - removes dangerous patterns
 * @param str - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(str: unknown): string {
  if (str === null || str === undefined) {
    return '';
  }
  
  let value = String(str);
  
  // Remove null bytes
  value = value.replace(/\0/g, '');
  
  // If it contains suspicious patterns, escape HTML
  if (containsXssPatterns(value) || containsPrototypePollution(value)) {
    return escapeHtml(value);
  }
  
  return value;
}

/**
 * Sanitize an object's string values recursively
 * Useful for sanitizing API responses before display
 * @param obj - The object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip prototype pollution keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }
  
  return obj;
}

/**
 * Validate and sanitize email format
 * @param email - The email to validate
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Validate and sanitize phone number
 * @param phone - The phone number to validate
 * @returns Sanitized phone number or empty string if invalid
 */
export function sanitizePhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  
  // Remove all non-digit characters except +
  const sanitized = phone.replace(/[^\d+]/g, '');
  
  // Basic length check
  if (sanitized.length < 10 || sanitized.length > 15) {
    return '';
  }
  
  return sanitized;
}

/**
 * Check if a value is a safe display value (not suspicious)
 * @param value - The value to check
 * @returns True if safe to display
 */
export function isSafeDisplayValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  return !containsXssPatterns(value) && !containsPrototypePollution(value);
}

/**
 * Create a safe display string with truncation
 * @param str - The string to display
 * @param maxLength - Maximum length before truncation
 * @returns Safe truncated string
 */
export function safeDisplayString(str: unknown, maxLength = 100): string {
  const sanitized = sanitizeString(str);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  return sanitized.slice(0, maxLength) + '...';
}

