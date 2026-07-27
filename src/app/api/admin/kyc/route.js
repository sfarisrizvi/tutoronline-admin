import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiter, buildRateLimitHeaders } from '@/lib/security/rateLimiter';
import { sanitizePayload, validatePayloadSize } from '@/lib/security/sanitizer';
import { respondWithError, respondWithSuccess, generateTraceId } from '@/lib/security/logger';

export async function POST(request) {
  const traceId = generateTraceId();
  
  try {
    // 1. Validate Payload Size (1MB max)
    if (!(await validatePayloadSize(request))) {
      return respondWithError({ status: 413, message: 'Payload Too Large', traceId });
    }

    // 2. Rate Limiting (60 requests per minute for admin actions)
    const rateResult = rateLimiter(request, { limit: 60, windowSeconds: 60, keyPrefix: 'admin_kyc' });
    const headers = buildRateLimitHeaders(rateResult);
    
    if (!rateResult.success) {
      return respondWithError({ status: 429, message: 'Too Many Requests', traceId });
    }

    // 3. Extract and Sanitize Payload
    const rawPayload = await request.json();
    const payload = sanitizePayload(rawPayload);
    const { action, tutorId, objections, userId, targetEmail, targetName } = payload;

    // 4. Validate Required Fields
    if (!action || !tutorId) {
      return respondWithError({ status: 400, message: 'Missing required fields: action, tutorId', traceId });
    }
    
    if (action === 'REJECT_KYC' && (!objections || objections.length === 0)) {
      return respondWithError({ status: 400, message: 'Objections are required for rejection', traceId });
    }

    // 5. Initialize Supabase Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase admin credentials missing from environment');
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Optional: Validate Admin Session (Since this is server side, you could check cookies or an authorization header. Assuming authorization header containing user token is sent)
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return respondWithError({ status: 401, message: 'Unauthorized session', traceId });
      }
      
      // Verify user is an admin
      const { data: roleData, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
        
      if (roleError || !roleData || roleData.role !== 'admin') {
         return respondWithError({ status: 403, message: 'Forbidden: Requires admin role', traceId });
      }
    }

    // 7. Perform Business Logic
    let dbResult;
    
    if (action === 'APPROVE_KYC') {
      dbResult = await supabaseAdmin
        .from('tutor_profiles')
        .update({ 
          kyc_status: 'approved',
          verified: true,
          kyc_objections: null
        })
        .eq('id', tutorId);
        
      if (dbResult.error) throw dbResult.error;

      // Background Email & Notification
      if (userId && targetEmail) {
         fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              userEmail: targetEmail,
              userName: targetName,
              role: 'tutor',
              isKycApproved: true // Custom payload handler for KYC
            })
         }).catch(err => console.error(`[${traceId}] Background notification error:`, err));
      }

    } else if (action === 'REJECT_KYC') {
      dbResult = await supabaseAdmin
        .from('tutor_profiles')
        .update({ 
          kyc_status: 'rejected',
          verified: false,
          kyc_objections: objections
        })
        .eq('id', tutorId);
        
      if (dbResult.error) throw dbResult.error;

      // Determine step url for the first objection
      let targetStep = 'identity';
      const firstObjection = objections[0];
      if (firstObjection.includes('degree') || firstObjection.includes('education') || firstObjection.includes('transcript')) {
        targetStep = 'education';
      } else if (firstObjection.includes('profile') || firstObjection.includes('photo')) {
        targetStep = 'profile';
      }

      // Background Notification
      if (userId && targetEmail) {
         fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              userEmail: targetEmail,
              userName: targetName,
              type: 'kyc_rejected',
              actionUrl: `/tutor/fix-documents`,
              objections
            })
         }).catch(err => console.error(`[${traceId}] Background notification error:`, err));
      }
    } else if (action === 'UPDATE_VERIFICATION') {
      const { kyc_verifications } = payload;
      const cnicFrontOk = kyc_verifications?.cnic_front?.status === 'approved';
      const cnicBackOk = kyc_verifications?.cnic_back?.status === 'approved';
      const degreeOk = kyc_verifications?.degree?.status === 'approved';

      const updateData = { kyc_verifications };
      if (cnicFrontOk && cnicBackOk && degreeOk) {
        updateData.kyc_status = 'approved';
        updateData.verified = true;
        updateData.kyc_objections = null;
      }

      dbResult = await supabaseAdmin
        .from('tutor_profiles')
        .update(updateData)
        .eq('id', tutorId);

      if (dbResult.error) throw dbResult.error;

    } else if (action === 'TOGGLE_SUSPENSION') {
      const { suspended } = payload;
      dbResult = await supabaseAdmin
        .from('tutor_profiles')
        .update({ suspended })
        .eq('id', tutorId);

      if (dbResult.error) throw dbResult.error;

    } else {
      return respondWithError({ status: 400, message: 'Invalid action', traceId });
    }

    return respondWithSuccess({ action, tutorId, status: 'success' }, 200, headers);

  } catch (error) {
    return respondWithError({ error, status: 500, traceId });
  }
}
