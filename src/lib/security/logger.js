// src/lib/security/logger.js
import { NextResponse } from 'next/server';

/**
 * Generates a unique trace ID for each request
 */
export function generateTraceId() {
  return `trc_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
}

/**
 * Enterprise standard error response wrapper.
 * Strips raw PostgreSQL error messages and stack traces from client responses.
 * Preserves details in server logs with the corresponding traceId.
 */
export function respondWithError({ error, status = 500, traceId, message = 'Internal Server Error' }) {
  const finalTraceId = traceId || generateTraceId();

  // Internal Server Logging (Keep untruncated details here)
  console.error(`[ERROR][${finalTraceId}] Status: ${status}`);
  if (error) {
    if (error.stack) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
  }

  // Sanitize the response payload
  // Do NOT expose database table names, SQL error codes, or environment variables
  return NextResponse.json(
    {
      success: false,
      error: {
        message: status === 500 ? 'Internal Server Error' : (message || error?.message || 'Unknown Error'),
        code: status,
      },
      traceId: finalTraceId,
    },
    { status }
  );
}

export function respondWithSuccess(data, status = 200, headers = {}) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status, headers }
  );
}
