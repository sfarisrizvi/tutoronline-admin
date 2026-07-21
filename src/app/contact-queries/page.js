'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { AdminNav } from '../../components/AdminNav';
import { Mail, MessageCircle, CheckCircle, RefreshCw, Clock, AlertCircle } from 'lucide-react';

export default function ContactQueries() {
  const router = useRouter();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Fetch contact queries when dependencies update
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      try {
        const { data, error: fetchErr, count } = await supabase
          .from('contact_queries')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (fetchErr) throw fetchErr;
        if (active) {
          setQueries(data || []);
          setTotalCount(count || 0);
        }
      } catch (err) {
        console.error(err);
        if (active) setError(err.message || 'An error occurred while fetching contact queries.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [page, pageSize, reloadTrigger]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.user_metadata?.role !== 'admin') {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  // Update Status action (Allowed for ALL roles including Monitor)
  const handleUpdateStatus = async (queryId, nextStatus) => {
    setSubmittingAction(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('contact_queries')
        .update({ status: nextStatus })
        .eq('id', queryId);

      if (error) throw error;

      // Update local state
      setQueries(prev => prev.map(q => q.id === queryId ? { ...q, status: nextStatus } : q));
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'resolved') return 'admin-badge-green';
    if (status === 'replied') return 'admin-badge-blue';
    return 'admin-badge-orange';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
          <div>
            <h1>Contact Form Queries</h1>
            <p>Review billing, trial class requests, or customer feedback. Click Email or WhatsApp to respond directly.</p>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => setReloadTrigger(t => t + 1)}>
            <RefreshCw size={14} /> Refresh Queries
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, width: '100%', maxWidth: '100%' }}>
        
        {/* Table layout */}
        <div className="admin-table-container">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>Loading queries...</p>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-pink)' }}>
              <AlertCircle size={24} style={{ display: 'block', margin: '0 auto 8px auto' }} />
              <strong>Error Loading Queries:</strong>
              <p style={{ fontSize: '13px', margin: '4px 0 0 0', opacity: 0.8 }}>{error}</p>
            </div>
          ) : queries.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>No queries submitted yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S.#</th>
                  <th>Submitter</th>
                  <th>Role</th>
                  <th style={{ width: '350px' }}>Message Details</th>
                  <th>Date</th>
                  <th style={{ width: '160px' }}>Status</th>
                  <th style={{ width: '240px' }}>Respond</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q, idx) => {
                  // Format phone number for whatsapp
                  let cleanPhone = q.phone ? q.phone.replace(/[^0-9]/g, '') : '';
                  if (cleanPhone.startsWith('0')) {
                    cleanPhone = '92' + cleanPhone.substring(1); // Standard Pakistan prefix
                  }
                  const waUrl = `https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(q.name)},%20this%20is%20Tutor%20Online%20Support...`;
                  
                  return (
                    <tr key={q.id}>
                      <td>{(page - 1) * pageSize + idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{q.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--steel)' }}>{q.email}</div>
                        <div style={{ fontSize: '11px', color: 'var(--steel)' }}>{q.phone || 'No phone'}</div>
                      </td>
                      <td>
                        <span className="admin-badge admin-badge-grey" style={{ textTransform: 'capitalize' }}>
                          {q.role ? q.role.replace('_', ' ') : 'Visitor'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--brand-green)', fontSize: '13px', marginBottom: '4px' }}>
                          {q.subject || 'No Subject'}
                        </div>
                        <div style={{ fontSize: '12px', lineHeight: '1.4', opacity: 0.9 }}>
                          {q.message}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>{new Date(q.created_at).toLocaleDateString()}</div>
                        <div style={{ fontSize: '11px', color: 'var(--steel)' }}>
                          {new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span className={`admin-badge ${getStatusBadge(q.status)}`} style={{ alignSelf: 'flex-start', textTransform: 'uppercase', fontSize: '10px' }}>
                            {q.status || 'pending'}
                          </span>
                          
                          {/* Quick Actions */}
                          {q.status !== 'resolved' && (
                            <button 
                              disabled={submittingAction}
                              onClick={() => handleUpdateStatus(q.id, 'resolved')}
                              className="admin-btn"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                backgroundColor: 'rgba(74, 222, 128, 0.15)', 
                                color: '#4ade80', 
                                border: '1px solid rgba(74, 222, 128, 0.3)',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <CheckCircle size={10} /> Mark Resolved
                            </button>
                          )}
                          
                          {q.status === 'pending' && (
                            <button 
                              disabled={submittingAction}
                              onClick={() => handleUpdateStatus(q.id, 'replied')}
                              className="admin-btn"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                backgroundColor: 'rgba(56, 189, 248, 0.15)', 
                                color: '#38bdf8', 
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Clock size={10} /> Mark Replied
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a 
                            href={`mailto:${q.email}?subject=Tutor%20Online%20Support%20Query`}
                            className="admin-btn" 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              backgroundColor: 'rgba(0, 114, 198, 0.15)', 
                              color: '#38bdf8', 
                              border: '1px solid rgba(0, 114, 198, 0.4)',
                              borderRadius: 'var(--rounded-full)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              textDecoration: 'none'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 114, 198, 0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 114, 198, 0.15)';
                            }}
                          >
                            <Mail size={13} /> Email
                          </a>
                          {q.phone && (
                            <a 
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="admin-btn" 
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                backgroundColor: 'rgba(37, 211, 102, 0.15)', 
                                color: '#4ade80', 
                                border: '1px solid rgba(37, 211, 102, 0.4)',
                                borderRadius: 'var(--rounded-full)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'none'
                              }}
                              onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(37, 211, 102, 0.3)';
                              }}
                              onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(37, 211, 102, 0.15)';
                              }}
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                Showing <strong>{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> queries
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

    </div>
  );
}
