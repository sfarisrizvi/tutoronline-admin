import { createClient as createServerClient } from '../../../utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin Client using secret Service Role Key
const getAdminClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// Middleware-like check inside route handler
const verifySuperAdmin = async (supabase) => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role, admin_role')
    .eq('user_id', user.id)
    .maybeSingle();
    
  if (roleError || !roleData) return false;
  
  return roleData.role === 'admin' && roleData.admin_role === 'super_admin';
};

export async function GET(request) {
  try {
    const supabase = await createServerClient();
    const isSuperAdmin = await verifySuperAdmin(supabase);
    
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const supabaseAdmin = getAdminClient();
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Fetch secure roles from DB
    const { data: secureRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role, admin_role')
      .eq('role', 'admin');

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    const adminRoleMap = new Map(secureRoles.map(r => [r.user_id, r.admin_role]));

    // Filter for users who are secure admins
    const admins = users
      .filter(u => adminRoleMap.has(u.id))
      .map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || 'Unnamed Admin',
        admin_role: adminRoleMap.get(u.id),
        created_at: u.created_at
      }));

    return NextResponse.json({ admins });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createServerClient();
    const isSuperAdmin = await verifySuperAdmin(supabase);
    
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { email, password, full_name, admin_role } = await request.json();

    if (!email || !password || !full_name || !admin_role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['super_admin', 'moderator', 'monitor'].includes(admin_role)) {
      return NextResponse.json({ error: 'Invalid admin role' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        admin_role,
        full_name
      }
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // 1. Securely set the role inside public.user_roles (which was initially defaulted by trigger to tutor)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: data.user.id,
        role: 'admin',
        admin_role
      });

    if (roleError) {
      console.error('Role update error:', roleError);
    }

    // 2. Delete default tutor profile created for admin user
    const { error: delError } = await supabaseAdmin
      .from('tutor_profiles')
      .delete()
      .eq('id', data.user.id);

    if (delError) {
      console.error('Default tutor profile deletion warning:', delError);
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
        admin_role
      } 
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const supabase = await createServerClient();
    const isSuperAdmin = await verifySuperAdmin(supabase);
    
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID parameter' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
