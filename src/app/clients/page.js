'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { 
  Search, 
  UserX, 
  UserCheck, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Shield,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
  School
} from 'lucide-react';

export default function ClientsDirectory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Filters, Search, Pagination
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'active' | 'suspended'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState({ total: 0, active: 0, suspended: 0 });

  // Selected Client details drawer
  const [selectedClient, setSelectedClient] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Parent Children state
  const [childrenList, setChildrenList] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [openChildIndices, setOpenChildIndices] = useState({});

  const fetchMetrics = async () => {
    const supabase = createClient();
    try {
      const [
        { count: total },
        { count: active },
        { count: suspended }
      ] = await Promise.all([
        supabase.from('client_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('client_profiles').select('*', { count: 'exact', head: true }).eq('suspended', false),
        supabase.from('client_profiles').select('*', { count: 'exact', head: true }).eq('suspended', true)
      ]);
      setMetrics({ total: total || 0, active: active || 0, suspended: suspended || 0 });
    } catch (err) {
      console.error('Error fetching client metrics:', err);
    }
  };

  const handleFilterModeChange = (mode) => {
    setFilterMode(mode);
    setPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setPage(1);
  };

  // Fetch clients when dependencies update
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      try {
        let query = supabase
          .from('client_profiles')
          .select('*', { count: 'exact' });

        if (filterMode === 'active') {
          query = query.eq('suspended', false);
        } else if (filterMode === 'suspended') {
          query = query.eq('suspended', true);
        }

        if (searchQuery.trim() !== '') {
          query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
        }

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (error) throw error;
        if (active) {
          setClients(data || []);
          setTotalCount(count || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [page, filterMode, searchQuery, pageSize]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.user_metadata?.role !== 'admin') {
        router.push('/login');
        return;
      }
      setAdminUser(user);
      setAdminRole(user.user_metadata?.admin_role || 'super_admin');
      fetchMetrics();
    };
    checkAuth();
  }, [router]);

  // Load children list if selected client is parent
  useEffect(() => {
    if (!selectedClient || selectedClient.client_type !== 'parent') {
      return;
    }

    let active = true;
    const fetchChildren = async () => {
      setLoadingChildren(true);
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from('children')
          .select('*')
          .eq('client_id', selectedClient.id);
        
        if (error) throw error;
        if (active) {
          setChildrenList(data || []);
          if (data && data.length > 0) {
            setOpenChildIndices({ 0: true });
          } else {
            setOpenChildIndices({});
          }
        }
      } catch (err) {
        console.error('Error fetching children list:', err);
      } finally {
        if (active) setLoadingChildren(false);
      }
    };

    fetchChildren();
    return () => { active = false; };
  }, [selectedClient]);

  const toggleChildAccordian = (idx) => {
    setOpenChildIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Handle Suspension toggle
  const toggleSuspension = async () => {
    if (!selectedClient || adminRole === 'monitor') return;
    const nextSuspendedState = !selectedClient.suspended;

    setSubmittingAction(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('client_profiles')
        .update({ suspended: nextSuspendedState })
        .eq('id', selectedClient.id);

      if (error) throw error;

      // Update state locally
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, suspended: nextSuspendedState } : c));
      setSelectedClient(prev => ({ ...prev, suspended: nextSuspendedState }));
      fetchMetrics();
      alert(`Client account ${nextSuspendedState ? 'suspended' : 'unsuspended'} successfully.`);
    } catch (err) {
      alert(`Error updating suspension: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Verification Badge
  const toggleVerification = async () => {
    if (!selectedClient || adminRole === 'monitor') return;
    const nextVerifiedState = !selectedClient.verified;

    setSubmittingAction(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('client_profiles')
        .update({ verified: nextVerifiedState })
        .eq('id', selectedClient.id);

      if (error) throw error;

      // Update state locally
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, verified: nextVerifiedState } : c));
      setSelectedClient(prev => ({ ...prev, verified: nextVerifiedState }));
      alert(`Verified badge ${nextVerifiedState ? 'granted' : 'removed'} successfully.`);
    } catch (err) {
      alert(`Error updating verification: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Permanently delete Client Account (Super Admin only)
  const handleDeleteAccount = async () => {
    if (!selectedClient || adminRole !== 'super_admin') return;
    if (!confirm(`CRITICAL ACTION: Are you sure you want to permanently delete client account ${selectedClient.full_name}? This cannot be undone.`)) return;

    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/admins?id=${selectedClient.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      // Update state locally
      setClients(prev => prev.filter(c => c.id !== selectedClient.id));
      setSelectedClient(null);
      alert('Client account permanently deleted.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
          <div>
            <h1>Clients Directory</h1>
            <p>Manage parent and student profiles, restrict account access, and review routing metadata.</p>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => { fetchMetrics(); }}>
            <RefreshCw size={14} /> Refresh Directory
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, width: '100%', maxWidth: '100%' }}>
        
        {/* Top metrics filter cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div 
            onClick={() => handleFilterModeChange('all')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'all' ? '2px solid var(--brand-green)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>All Clients</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--brand-green)' }}>{metrics.total}</h2>
          </div>

          <div 
            onClick={() => handleFilterModeChange('active')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'active' ? '2px solid var(--accent-blue)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Active</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--accent-blue)' }}>{metrics.active}</h2>
          </div>

          <div 
            onClick={() => handleFilterModeChange('suspended')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'suspended' ? '2px solid var(--accent-pink)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Suspended</span>
            <h2 style={{ margin: '4px 0 0 0', color: '#FF5252' }}>{metrics.suspended}</h2>
          </div>
        </div>

        {/* Search Bar */}
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--spacing-md)', padding: '12px 16px' }}>
          <Search size={18} style={{ color: 'var(--steel)' }} />
          <input
            type="text"
            className="admin-input"
            style={{ border: 'none', background: 'transparent', color: 'var(--ink)', width: '100%', height: 'auto', padding: 0 }}
            placeholder="Search clients by name, email or number..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Clients list table */}
        <div className="admin-table-container">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>Loading clients directory...</p>
          ) : clients.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>No clients found matching the query.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S.#</th>
                  <th>Client Name</th>
                  <th>Contact Information</th>
                  <th>City / Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, idx) => (
                  <tr 
                    key={client.id}
                    onClick={() => { setSelectedClient(client); setChildrenList([]); setOpenChildIndices({}); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {client.avatar_url ? (
                          <img 
                            src={client.avatar_url.startsWith('http') ? client.avatar_url : `https://qlhcavfyllfcwifxbtbu.supabase.co/storage/v1/object/public/client-files/${client.avatar_url}`}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--slate)', fontSize: '13px' }}>
                            {client.full_name?.substring(0, 2).toUpperCase() || 'CL'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {client.full_name || 'Unnamed Client'}
                            {client.verified && <img src="/shield.svg" alt="Verified" style={{ width: '15px', height: '15px', verticalAlign: 'middle' }} />}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--steel)', textTransform: 'capitalize' }}>
                            {client.client_type || 'Student / Parent'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>{client.email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--steel)' }}>{client.phone || 'No phone'}</div>
                    </td>
                    <td>
                      <div>{client.city || 'No City'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--steel)' }}>
                        Route: {client.academic_route || 'Not set'}
                      </div>
                    </td>
                    <td>
                      {client.suspended ? (
                        <span className="admin-badge admin-badge-red">Suspended</span>
                      ) : (
                        <span className="admin-badge admin-badge-green">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '16px', 
              padding: '12px 16px', 
              backgroundColor: 'var(--canvas)', 
              borderRadius: 'var(--rounded-lg)',
              border: '1px solid var(--hairline)'
            }}>
              <span style={{ fontSize: '13px', color: 'var(--steel)' }}>
                Showing <strong>{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> clients
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                {(() => {
                  const totalPages = Math.ceil(totalCount / pageSize);
                  const pages = [];
                  const maxVisible = 5;
                  let start = Math.max(1, page - Math.floor(maxVisible / 2));
                  let end = Math.min(totalPages, start + maxVisible - 1);
                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1);
                  }
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  return (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {start > 1 && (
                        <>
                          <button
                            className={`admin-btn ${page === 1 ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '13px', minWidth: '32px' }}
                            onClick={() => setPage(1)}
                          >
                            1
                          </button>
                          {start > 2 && <span style={{ padding: '0 4px', color: 'var(--steel)', fontSize: '13px' }}>...</span>}
                        </>
                      )}
                      {pages.map(p => (
                        <button
                          key={p}
                          className={`admin-btn ${page === p ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                          style={{ padding: '6px 12px', fontSize: '13px', minWidth: '32px' }}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      ))}
                      {end < totalPages && (
                        <>
                          {end < totalPages - 1 && <span style={{ padding: '0 4px', color: 'var(--steel)', fontSize: '13px' }}>...</span>}
                          <button
                            className={`admin-btn ${page === totalPages ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '13px', minWidth: '32px' }}
                            onClick={() => setPage(totalPages)}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}
                <button 
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Right Drawer: Client Details */}
      {selectedClient && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 940 }}
            onClick={() => setSelectedClient(null)}
          />

          <div className={`admin-drawer ${selectedClient ? 'open' : ''}`}>
            
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--canvas-dark)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Client Account Review</h3>
                <span style={{ fontSize: '11px', color: 'var(--steel)' }}>ID: {selectedClient.id}</span>
              </div>
              <button 
                onClick={() => setSelectedClient(null)}
                style={{ color: 'var(--steel)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Profile Card Summary */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-lg)', backgroundColor: 'var(--surface-soft)' }}>
                {selectedClient.avatar_url ? (
                  <img 
                    src={selectedClient.avatar_url.startsWith('http') ? selectedClient.avatar_url : `https://qlhcavfyllfcwifxbtbu.supabase.co/storage/v1/object/public/client-files/${selectedClient.avatar_url}`}
                    alt="" 
                    style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'var(--steel)' }}>
                    {selectedClient.full_name?.substring(0, 2).toUpperCase() || 'CL'}
                  </div>
                )}
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{selectedClient.full_name}</h4>
                  <span style={{ fontSize: '12px', color: 'var(--steel)', display: 'block' }}>{selectedClient.email}</span>
                  <span style={{ fontSize: '12px', color: 'var(--steel)', display: 'block' }}>{selectedClient.phone || 'No phone'}</span>
                </div>
              </div>

              {/* Status Banner */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Account Status</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`admin-badge ${selectedClient.suspended ? 'admin-badge-red' : 'admin-badge-green'}`}>
                    {selectedClient.suspended ? 'Suspended' : 'Active Account'}
                  </span>
                  {selectedClient.verified && <img src="/shield.svg" alt="Verified" style={{ width: '15px', height: '15px', verticalAlign: 'middle' }} />}
                </div>
              </div>

              {/* Client Metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Client Type</span>
                  <strong style={{ textTransform: 'capitalize' }}>{selectedClient.client_type || 'Parent / Student'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>City</span>
                  <strong>{selectedClient.city || 'No City'}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Address</span>
                  <strong>{selectedClient.address || 'No address set'}</strong>
                </div>
              </div>

              {/* Dynamic Role Sections: Parent children OR Student classes */}
              <div style={{ borderTop: '1px solid var(--hairline-soft)', paddingTop: '20px' }}>
                {selectedClient.client_type === 'parent' ? (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={16} /> Children Details ({childrenList.length})
                    </h4>
                    
                    {loadingChildren ? (
                      <p style={{ fontSize: '12px', color: 'var(--steel)' }}>Loading children data...</p>
                    ) : childrenList.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--steel)', fontStyle: 'italic' }}>No children details registered on onboarding.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {childrenList.map((kid, index) => {
                          const isOpen = !!openChildIndices[index];
                          return (
                            <div 
                              key={kid.id || index}
                              style={{ 
                                border: '1px solid var(--hairline)', 
                                borderRadius: 'var(--rounded-md)', 
                                backgroundColor: 'var(--canvas-dark)', 
                                overflow: 'hidden' 
                              }}
                            >
                              {/* Accordian Title Bar */}
                              <div 
                                onClick={() => toggleChildAccordian(index)}
                                style={{ 
                                  padding: '12px 16px', 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  cursor: 'pointer',
                                  backgroundColor: 'var(--surface-soft)',
                                  userSelect: 'none'
                                }}
                              >
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>Child #{index + 1}: {kid.name || 'Unnamed Child'}</span>
                                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--steel)' }} /> : <ChevronDown size={16} style={{ color: 'var(--steel)' }} />}
                              </div>

                              {/* Accordian Content Pane */}
                              {isOpen && (
                                <div style={{ padding: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--hairline-soft)' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                      <span style={{ fontSize: '10px', color: 'var(--steel)', display: 'block' }}>Academic Grade</span>
                                      <strong>{kid.grade || 'Primary'}</strong>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '10px', color: 'var(--steel)', display: 'block' }}>School / College</span>
                                      <strong>{kid.school_college || 'Not specified'}</strong>
                                    </div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '10px', color: 'var(--steel)', display: 'block', marginBottom: '6px' }}>Enrolled Subjects</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {Array.isArray(kid.subjects) && kid.subjects.length > 0 ? (
                                        kid.subjects.map((sub, sIdx) => (
                                          <span key={sIdx} className="admin-badge admin-badge-grey" style={{ fontSize: '10px' }}>
                                            {sub}
                                          </span>
                                        ))
                                      ) : (
                                        <span style={{ fontSize: '11px', color: 'var(--steel)', fontStyle: 'italic' }}>No subjects specified</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Student dashboard details */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <GraduationCap size={16} /> Student Academic Profile
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', backgroundColor: 'var(--canvas-dark)', padding: '16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--steel)', display: 'block', marginBottom: '2px' }}><GraduationCap size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />Grade / Class</span>
                        <strong>{selectedClient.grade || 'Not specified'}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--steel)', display: 'block', marginBottom: '2px' }}><School size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />School / College</span>
                        <strong>{selectedClient.school_college || 'Not specified'}</strong>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Enrolled Subjects</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Array.isArray(selectedClient.subjects) && selectedClient.subjects.length > 0 ? (
                          selectedClient.subjects.map((sub, sIdx) => (
                            <span key={sIdx} className="admin-badge admin-badge-grey" style={{ fontSize: '11px' }}>
                              {sub}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--steel)', fontStyle: 'italic' }}>No subjects selected.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Joining Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', borderTop: '1px solid var(--hairline-soft)', paddingTop: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Joining Date</span>
                  <strong>{selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Last Updated</span>
                  <strong>{selectedClient.updated_at ? new Date(selectedClient.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</strong>
                </div>
              </div>

            </div>

            {/* Bottom Actions strip */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--hairline)', backgroundColor: 'var(--canvas-dark)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {adminRole === 'monitor' ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--steel)' }}>
                  <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Monitor Mode: Client details are read-only
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Toggle Verified Badge Button */}
                    <button 
                      onClick={toggleVerification} 
                      className={`admin-btn ${selectedClient.verified ? 'admin-btn-secondary' : 'admin-btn-primary'}`} 
                      style={{ flex: 1 }}
                      disabled={submittingAction}
                    >
                      {selectedClient.verified ? 'Remove Verified' : 'Give Verified Badge'}
                    </button>

                    {/* Suspend button */}
                    <button 
                      onClick={toggleSuspension} 
                      className={`admin-btn ${selectedClient.suspended ? 'admin-btn-primary' : 'admin-btn-secondary'}`} 
                      style={{ flex: 1 }}
                      disabled={submittingAction}
                    >
                      {selectedClient.suspended ? <><UserCheck size={12} /> Lift Ban</> : <><UserX size={12} /> Suspend</>}
                    </button>
                  </div>

                  {/* Super admin account deletion */}
                  {adminRole === 'super_admin' && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        onClick={handleDeleteAccount} 
                        className="admin-btn admin-btn-danger" 
                        style={{ flex: 1 }}
                        disabled={submittingAction}
                      >
                        <Trash2 size={12} /> Delete Account
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
}
