'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminNav } from './AdminNav';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  
  const isLoginPage = pathname === '/login' || pathname === '/';
  
  if (isLoginPage) {
    return <>{children}</>;
  }
  
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      <AdminNav collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ 
        flex: 1, 
        padding: '0', 
        marginLeft: collapsed ? '80px' : '260px', 
        transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0 // Prevents grid overflow issues
      }}>
        {children}
      </div>
    </div>
  );
}
