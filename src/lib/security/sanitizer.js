// src/lib/security/sanitizer.js

/**
 * Checks if a string contains potentially dangerous XSS patterns
 */
function hasXSS(value) {
  if (typeof value !== 'string') return false;
  
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /onerror=/gi,
    /onload=/gi,
    /onmouseover=/gi,
    /eval\(/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(value));
}

/**
 * Checks if a string contains SQL injection patterns
 */
function hasSQLi(value) {
  if (typeof value !== 'string') return false;
  
  const sqliPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
    /\w*((\%27)|(\'))(\s|%20)*(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP)\b/gi,
  ];

  return sqliPatterns.some(pattern => pattern.test(value));
}

/**
 * Strips basic XSS and SQLi characters from a string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags
    .replace(/javascript:/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onload=/gi, '')
    .replace(/;/g, '') // SQLi prevention
    .replace(/--/g, '') // SQLi prevention
    .trim();
}

/**
 * Recursively sanitizes an object or array payload
 */
export function sanitizePayload(payload) {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return sanitizeString(payload);
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item));
  }

  if (typeof payload === 'object') {
    const sanitizedObj = {};
    for (const [key, value] of Object.entries(payload)) {
      sanitizedObj[sanitizeString(key)] = sanitizePayload(value);
    }
    return sanitizedObj;
  }

  return payload;
}

/**
 * Helper to validate request payload size
 * Enforces a default 1MB limit.
 */
export async function validatePayloadSize(req, maxBytes = 1048576) {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return false;
  }
  return true;
}
