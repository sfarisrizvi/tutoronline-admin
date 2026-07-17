'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  FileCheck, 
  MessageSquare, 
  Mail, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  ShieldCheck
} from 'lucide-react';

export function AdminNav({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAdminUser(user);
        setAdminRole(user.user_metadata?.admin_role || 'super_admin');
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const links = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Tutors', path: '/tutors', icon: BookOpen },
    { name: 'Clients', path: '/clients', icon: Users },
    { name: 'KYC Review', path: '/kyc', icon: FileCheck },
    { name: 'Chat Monitor', path: '/conversations', icon: MessageSquare },
    { name: 'Contact Queries', path: '/contact-queries', icon: Mail },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const getRoleBadgeLabel = (role) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'moderator') return 'Moderator';
    return 'Monitor';
  };

  const getRoleBadgeClass = (role) => {
    if (role === 'super_admin') return 'admin-badge-red';
    if (role === 'moderator') return 'admin-badge-purple';
    return 'admin-badge-grey';
  };

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: collapsed ? '80px' : '260px',
      backgroundColor: 'var(--canvas-dark)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      zIndex: 900,
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflowX: 'hidden'
    }}>
      {/* Top branding section */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '16px',
          height: '64px',
          borderBottom: '1px solid var(--hairline-dark)'
        }}>
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src="/light-logo.svg" 
                alt="Tutor Online" 
                style={{ height: '28px', width: 'auto', display: 'block' }} 
              />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--brand-green)', border: '1px solid var(--brand-green-dark)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Admin
              </span>
            </div>
          ) : (
            <img 
              src="/favicon.png" 
              alt="TO" 
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'contain' }} 
            />
          )}

          <button 
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--steel)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: 'var(--rounded-sm)',
              backgroundColor: 'var(--surface-soft)'
            }}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Links Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 8px' }}>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.name}
                href={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: 'var(--rounded-md)',
                  color: isActive ? 'var(--brand-green)' : 'var(--slate)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '14px',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  backgroundColor: isActive ? 'var(--surface-soft)' : 'transparent',
                  transition: 'all 0.15s ease'
                }}
                title={collapsed ? link.name : ''}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{link.name}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom User Info & Logout */}
      <div style={{ 
        borderTop: '1px solid var(--hairline-dark)', 
        padding: '16px 8px',
        backgroundColor: 'var(--surface-soft)'
      }}>
        {adminUser && !collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 8px 12px 8px', borderBottom: '1px solid var(--hairline-dark)', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--brand-green)' }} />
              {adminUser.user_metadata?.full_name || 'System Admin'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--steel)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminUser.email}
            </div>
            <div style={{ marginTop: '4px' }}>
              <span className={`admin-badge ${getRoleBadgeClass(adminRole)}`} style={{ fontSize: '10px' }}>
                {getRoleBadgeLabel(adminRole)}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '12px',
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--rounded-md)',
            color: 'var(--accent-orange)',
            fontWeight: 500,
            fontSize: '14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s ease'
          }}
          title={collapsed ? 'Sign Out' : ''}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}
