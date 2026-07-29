export async function logAdminAction({
  adminUser,
  actionType,
  actionLabel,
  statusColor = 'green',
  targetUserName,
  targetUserEmail,
  details = ''
}) {
  try {
    const adminName = adminUser?.user_metadata?.full_name || adminUser?.email?.split('@')[0] || 'Admin User';
    const adminRole = adminUser?.user_metadata?.admin_role || 'super_admin';

    await fetch('/api/admin/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_name: adminName,
        admin_role: adminRole,
        action_type: actionType,
        action_label: actionLabel,
        status_color: statusColor,
        target_user_name: targetUserName || 'User',
        target_user_email: targetUserEmail || 'user@example.com',
        details: details
      })
    });
  } catch (err) {
    console.warn('Failed to log admin action:', err);
  }
}
