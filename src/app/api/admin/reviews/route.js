import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAdminAction } from '@/utils/logHelper';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase admin credentials missing' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { action, review_id, status, is_flagged, flag_reason, admin_id, admin_email } = body;

    if (!action || !review_id) {
      return NextResponse.json({ error: 'Missing action or review_id' }, { status: 400 });
    }

    // ACTION 1: TOGGLE VISIBILITY (PUBLISHED / HIDDEN)
    if (action === 'toggle_visibility') {
      const nextStatus = status === 'hidden' ? 'hidden' : 'published';

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('contract_reviews')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', review_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Log admin action
      await logAdminAction(supabaseAdmin, {
        adminId: admin_id || null,
        adminEmail: admin_email || 'admin@tutoronline.pk',
        actionType: nextStatus === 'hidden' ? 'hide_review' : 'publish_review',
        actionLabel: `${nextStatus === 'hidden' ? 'Hidden' : 'Restored'} contract review (${review_id})`,
        targetId: review_id,
        targetEmail: null,
        metadata: { review_id, new_status: nextStatus }
      });

      return NextResponse.json({ success: true, review: updated });
    }

    // ACTION 2: TOGGLE FLAG
    if (action === 'toggle_flag') {
      const { data: updated, error: flagErr } = await supabaseAdmin
        .from('contract_reviews')
        .update({
          is_flagged: Boolean(is_flagged),
          flag_reason: flag_reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', review_id)
        .select()
        .single();

      if (flagErr) throw flagErr;

      await logAdminAction(supabaseAdmin, {
        adminId: admin_id || null,
        adminEmail: admin_email || 'admin@tutoronline.pk',
        actionType: is_flagged ? 'flag_review' : 'unflag_review',
        actionLabel: `${is_flagged ? 'Flagged' : 'Unflagged'} contract review (${review_id})`,
        targetId: review_id,
        targetEmail: null,
        metadata: { review_id, is_flagged, flag_reason }
      });

      return NextResponse.json({ success: true, review: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Error in admin reviews API:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
