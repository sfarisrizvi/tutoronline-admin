'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { 
  Terminal, 
  Search, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  Activity, 
  Filter,
  UserCheck,
  Ban,
  AlertCircle
} from 'lucide-react';

export default function AdminLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all'); // 'all' | 'green' | 'red' | 'orange'
  const [copied, setCopied] = useState(false);
  const terminalBottomRef = useRef(null);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        const user = data?.user;

        if (error || !user || user.user_metadata?.role !== 'admin') {
          router.push('/login');
          return;
        }
        setAdminUser(user);
      } catch (err) {
        console.error('CheckAuth error in logs:', err);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/logs');
        const data = await res.json();
        if (active && res.ok && data.logs) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Status color filter
      if (actionFilter !== 'all' && log.status_color !== actionFilter) return false;

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesAdmin = (log.admin_name || '').toLowerCase().includes(q);
        const matchesAction = (log.action_label || '').toLowerCase().includes(q);
        const matchesTarget = (log.target_user_name || '').toLowerCase().includes(q);
        const matchesEmail = (log.target_user_email || '').toLowerCase().includes(q);
        return matchesAdmin || matchesAction || matchesTarget || matchesEmail;
      }

      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  // Copy raw terminal logs
  const handleCopyLogs = () => {
    const text = filteredLogs.map(log => 
      `[${log.timestamp}] - ${log.admin_name} ${log.action_label} to the ${log.target_user_name} (${log.target_user_email})`
    ).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export TXT file
  const handleExportTxt = () => {
    const text = filteredLogs.map(log => 
      `[${log.timestamp}] - ${log.admin_name} ${log.action_label} to the ${log.target_user_name} (${log.target_user_email})${log.details ? ` | Note: ${log.details}` : ''}`
    ).join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tutoronline_admin_audit_logs_${new Date().toISOString().substring(0, 10)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clear Terminal Display
  const handleClearTerminal = () => {
    setLogs([]);
  };

  // Metrics
  const greenCount = logs.filter(l => l.status_color === 'green').length;
  const redCount = logs.filter(l => l.status_color === 'red').length;
  const orangeCount = logs.filter(l => l.status_color === 'orange').length;

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* Header Band */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'var(--surface-soft)', padding: '10px', borderRadius: '10px', color: '#38BDF8', border: '1px solid var(--hairline-strong)' }}>
              <Terminal size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Admin Log Book</h2>
              <p style={{ margin: '2px 0 0 0', color: 'var(--steel)', fontSize: '13px' }}>
                System audit log stream for all administrative actions, KYC decisions, badges, and suspensions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleCopyLogs}
            className="admin-btn admin-btn-secondary"
            style={{ fontSize: '12px', padding: '8px 14px' }}
          >
            {copied ? <Check size={14} color="#00ED64" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Logs'}
          </button>

          <button
            onClick={handleExportTxt}
            className="admin-btn admin-btn-secondary"
            style={{ fontSize: '12px', padding: '8px 14px' }}
          >
            <Download size={14} /> Export Log File
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="admin-btn admin-btn-primary"
            style={{ fontSize: '12px', padding: '8px 16px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Stream
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        
        <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: 'var(--surface-soft)', padding: '10px', borderRadius: '8px', color: '#38BDF8' }}>
            <Activity size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase' }}>Total Audit Logs</span>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{logs.length}</h3>
          </div>
        </div>

        <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: 'var(--brand-green-soft)', padding: '10px', borderRadius: '8px', color: '#00ED64' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase' }}>Approvals / Badges</span>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#00ED64' }}>{greenCount}</h3>
          </div>
        </div>

        <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#2D1415', padding: '10px', borderRadius: '8px', color: '#FF5252' }}>
            <Ban size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase' }}>Suspensions / Deletions</span>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FF5252' }}>{redCount}</h3>
          </div>
        </div>

        <div className="admin-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: '#2F1B10', padding: '10px', borderRadius: '8px', color: '#FFB300' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase' }}>Rejections / Warnings</span>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FFB300' }}>{orangeCount}</h3>
          </div>
        </div>

      </div>

      {/* Control Bar: Search & Filter Tabs */}
      <div className="admin-card" style={{ marginBottom: 'var(--spacing-md)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--surface-soft)', padding: '4px', borderRadius: 'var(--rounded-full)', border: '1px solid var(--hairline)' }}>
          {[
            { id: 'all', label: 'All Logs' },
            { id: 'green', label: 'Approvals (Green)' },
            { id: 'red', label: 'Suspensions/Deletions (Red)' },
            { id: 'orange', label: 'Rejections (Orange)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActionFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--rounded-full)',
                border: 'none',
                backgroundColor: actionFilter === tab.id ? 'var(--brand-green-soft)' : 'transparent',
                color: actionFilter === tab.id ? 'var(--brand-green)' : 'var(--slate)',
                fontWeight: actionFilter === tab.id ? 600 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--steel)' }} />
          <input
            type="text"
            placeholder="Search admin, action, user or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input"
            style={{
              paddingLeft: '36px',
              height: '36px',
              fontSize: '12px',
              borderRadius: 'var(--rounded-full)',
              backgroundColor: 'var(--surface-soft)',
              border: '1px solid var(--hairline-strong)'
            }}
          />
        </div>

      </div>

      {/* TERMINAL LOOK & FEEL LOG BOOK WINDOW */}
      <div style={{
        backgroundColor: '#050B0E',
        borderRadius: 'var(--rounded-lg)',
        border: '1px solid #1E3A4A',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
      }}>
        
        {/* Terminal Window Header Bar */}
        <div style={{
          backgroundColor: '#0C1820',
          padding: '10px 16px',
          borderBottom: '1px solid #182C38',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          
          {/* macOS window controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FF5F56', display: 'inline-block' }} />
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#FFBD2E', display: 'inline-block' }} />
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27C93F', display: 'inline-block' }} />
            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
              admin@tutoronline:~/audit-logs/book.log
            </span>
          </div>

          {/* Live indicator & Clear button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#00ED64', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00ED64', boxShadow: '0 0 8px #00ED64', display: 'inline-block' }} />
              LIVE AUDIT STREAM
            </div>

            <button
              onClick={handleClearTerminal}
              title="Clear Terminal Output"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </div>

        {/* Terminal Body Screen */}
        <div style={{
          padding: '20px 24px',
          maxHeight: '520px',
          overflowY: 'auto',
          fontSize: '13px',
          lineHeight: '1.7',
          color: '#E2E8F0',
          backgroundColor: '#050B0E',
          backgroundImage: 'linear-gradient(rgba(0, 237, 100, 0.02) 1px, transparent 1px)',
          backgroundSize: '100% 24px'
        }}>
          {loading ? (
            <div style={{ color: '#00ED64', padding: '20px 0' }}>
              $ initializing audit stream connection... <span className="spin" style={{ display: 'inline-block' }}>⟳</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ color: '#64748B', padding: '30px 0', textAlign: 'center' }}>
              [SYSTEM] No log entries matched your filter or search query.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              // Action status color mapping
              let actionColor = '#4ADE80'; // default green
              if (log.status_color === 'red') actionColor = '#F87171'; // red
              if (log.status_color === 'orange') actionColor = '#FBBF24'; // orange
              if (log.status_color === 'blue') actionColor = '#38BDF8'; // cyan

              return (
                <div 
                  key={log.id || index}
                  style={{
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    wordBreak: 'break-word',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    paddingBottom: '6px'
                  }}
                >
                  {/* Line Number / Gutter */}
                  <span style={{ color: '#334155', fontSize: '11px', minWidth: '24px', select: 'none' }}>
                    {index + 1}
                  </span>

                  {/* Formatted Terminal Line: [Date Time] - {Admin Name} [Action] to the {User Name (Email)} */}
                  <div style={{ flex: 1 }}>
                    {/* Timestamp */}
                    <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                      [{log.timestamp}]
                    </span>
                    
                    <span style={{ color: '#64748B', margin: '0 8px' }}>-</span>

                    {/* Admin Name in Blue/Cyan */}
                    <span style={{ color: '#38BDF8', fontWeight: 600 }}>
                      {log.admin_name}
                    </span>

                    <span> </span>

                    {/* Action in Action Status Color (Green / Red / Orange) */}
                    <span style={{ color: actionColor, fontWeight: 700, textTransform: 'lowercase' }}>
                      [{log.action_label}]
                    </span>

                    <span style={{ color: '#CBD5E1' }}> to the </span>

                    {/* User Name & Email in Bright Orange */}
                    <span style={{ color: '#FB923C', fontWeight: 600 }}>
                      {log.target_user_name} ({log.target_user_email})
                    </span>

                    {/* Optional Details Note */}
                    {log.details && (
                      <span style={{ color: '#64748B', fontSize: '12px', marginLeft: '10px', fontStyle: 'italic' }}>
                        {'// '}{log.details}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          
          <div ref={terminalBottomRef} />
          
          {/* Active Terminal Prompt Line */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00ED64' }}>
            <span>admin@tutoronline:~$</span>
            <span style={{ animation: 'blink 1s infinite', width: '8px', height: '15px', backgroundColor: '#00ED64', display: 'inline-block' }} />
          </div>

        </div>

        {/* Terminal Footer Status Bar */}
        <div style={{
          backgroundColor: '#0C1820',
          padding: '8px 16px',
          borderTop: '1px solid #182C38',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748B'
        }}>
          <div>
            Showing <strong>{filteredLogs.length}</strong> log entries
          </div>
          <div>
            ENCODING: <strong>UTF-8</strong> | PROTOCOL: <strong>SUPABASE_AUDIT_V1</strong>
          </div>
        </div>

      </div>

    </div>
  );
}
