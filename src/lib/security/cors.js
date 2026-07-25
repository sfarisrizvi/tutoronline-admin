// src/lib/security/cors.js
import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://tutoronline.pk',
  'https://admin.tutoronline.pk',
  'http://localhost:3000',
  'http://localhost:3001'
];

/**
 * Validates the Origin header against the strict whitelist.
 * Blocks wildcard origins for authenticated endpoints.
 */
export function validateCORS(req) {
  const origin = req.headers.get('origin');
  
  // If no origin is provided (e.g., server-to-server or direct curl), allow it 
  // unless we explicitly want to block non-browser clients (which we might not want yet).
  // For strictness, if an origin IS provided, it must be in the whitelist.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return false;
  }
  
  return true;
}

/**
 * Helper to build strict CORS headers for the response
 */
export function buildCorsHeaders(req) {
  const origin = req.headers.get('origin');
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
    'Access-Control-Allow-Credentials': 'true',
    // Strictly disable wildcard origin when credentials are true
  };
}

/**
 * Handle OPTIONS preflight requests securely
 */
export function handlePreflight(req) {
  if (!validateCORS(req)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req),
  });
}
