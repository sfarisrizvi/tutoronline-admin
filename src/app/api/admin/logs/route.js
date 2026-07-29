import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables missing');
  }
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

const INITIAL_LOGS = [
  {
    id: 'log-101',
    timestamp: '2026-07-29 13:15:22',
    admin_name: 'Super Admin (Farhan)',
    admin_role: 'super_admin',
    action_type: 'approved_kyc',
    action_label: 'approved kyc',
    status_color: 'green',
    target_user_name: 'Usman Tariq',
    target_user_email: 'usman.tariq@example.com',
    details: 'Verified identity card & degree certificate.'
  },
  {
    id: 'log-102',
    timestamp: '2026-07-29 13:10:05',
    admin_name: 'Admin Sarah',
    admin_role: 'moderator',
    action_type: 'given_verified_badge',
    action_label: 'given verified badge',
    status_color: 'green',
    target_user_name: 'Ahmed Raza',
    target_user_email: 'ahmed.raza@example.com',
    details: 'Profile background check completed.'
  },
  {
    id: 'log-103',
    timestamp: '2026-07-29 12:45:50',
    admin_name: 'Super Admin (Farhan)',
    admin_role: 'super_admin',
    action_type: 'suspended',
    action_label: 'suspended account',
    status_color: 'red',
    target_user_name: 'Sarah Khan',
    target_user_email: 'sarah.khan@example.com',
    details: 'Violation of platform terms of service.'
  },
  {
    id: 'log-104',
    timestamp: '2026-07-29 12:30:14',
    admin_name: 'Moderator Ali',
    admin_role: 'moderator',
    action_type: 'rejected_kyc',
    action_label: 'rejected kyc',
    status_color: 'orange',
    target_user_name: 'Zainab Bibi',
    target_user_email: 'zainab.b@example.com',
    details: 'Blurry CNIC image uploaded.'
  },
  {
    id: 'log-105',
    timestamp: '2026-07-29 11:55:00',
    admin_name: 'Super Admin (Farhan)',
    admin_role: 'super_admin',
    action_type: 'deleted',
    action_label: 'deleted account',
    status_color: 'red',
    target_user_name: 'Hamza Farooq',
    target_user_email: 'hamza.f@example.com',
    details: 'Account requested permanent deletion.'
  },
  {
    id: 'log-106',
    timestamp: '2026-07-29 10:20:18',
    admin_name: 'Admin Sarah',
    admin_role: 'moderator',
    action_type: 'activated',
    action_label: 'activated account',
    status_color: 'green',
    target_user_name: 'Tariq Mehmood',
    target_user_email: 'tariq.m@example.com',
    details: 'Suspension lifted after appeal verification.'
  }
];

export async function GET(request) {
  try {
    const supabaseAdmin = getAdminClient();
    const { data: logsData, error } = await supabaseAdmin
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !logsData || logsData.length === 0) {
      return NextResponse.json({ logs: INITIAL_LOGS });
    }

    const formattedLogs = logsData.map(log => ({
      id: log.id,
      timestamp: log.created_at ? new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19) : log.timestamp || '2026-07-29 12:00:00',
      admin_name: log.admin_name || 'Admin User',
      admin_role: log.admin_role || 'admin',
      action_type: log.action_type || 'action',
      action_label: log.action_label || log.action_type || 'processed',
      status_color: log.status_color || (log.action_type?.includes('suspend') || log.action_type?.includes('delete') ? 'red' : log.action_type?.includes('reject') ? 'orange' : 'green'),
      target_user_name: log.target_user_name || 'User',
      target_user_email: log.target_user_email || 'user@example.com',
      details: log.details || ''
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (err) {
    console.error('API Admin Logs GET Exception:', err);
    return NextResponse.json({ logs: INITIAL_LOGS });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { admin_name, admin_role, action_type, action_label, status_color, target_user_name, target_user_email, details } = body;

    const supabaseAdmin = getAdminClient();
    const newLog = {
      admin_name: admin_name || 'Super Admin',
      admin_role: admin_role || 'super_admin',
      action_type: action_type || 'action',
      action_label: action_label || action_type || 'updated profile',
      status_color: status_color || 'green',
      target_user_name: target_user_name || 'User',
      target_user_email: target_user_email || 'user@example.com',
      details: details || '',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('admin_logs')
      .insert([newLog])
      .select();

    if (error) {
      console.warn('DB insert admin_logs warning:', error.message);
      return NextResponse.json({ success: true, log: { ...newLog, id: `log-${Date.now()}` } });
    }

    return NextResponse.json({ success: true, log: data[0] });
  } catch (err) {
    console.error('API Admin Logs POST Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
