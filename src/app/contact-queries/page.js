'use client';
import React, { useEffect, useState } from 'react';
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

  const fetchQueries = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { data, error: fetchErr } = await supabase
        .from('contact_queries')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setQueries(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching contact queries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.user_metadata?.role !== 'admin') {
        router.push('/login');
        return;
      }
      fetchQueries();
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
          <button className="admin-btn admin-btn-secondary" onClick={fetchQueries}>
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
                      <td>{idx + 1}</td>
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
                        <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.4', maxHeight: '100px', overflowY: 'auto' }}>
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
                        <select 
                          className={`admin-badge ${getStatusBadge(q.status)}`}
                          style={{ 
                            height: '28px',
                            cursor: 'pointer',
                            outline: 'none',
                            textTransform: 'capitalize',
                            fontFamily: 'inherit',
                            textAlign: 'center',
                            textAlignLast: 'center',
                            width: '120px',
                            padding: '4px 10px',
                            paddingRight: '24px',
                            borderRadius: 'var(--rounded-full)',
                            fontSize: '11px',
                            fontWeight: '600',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23${
                              q.status === 'resolved' ? '00FF87' : q.status === 'replied' ? '40C4FF' : 'FFB300'
                            }' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                            backgroundPosition: 'right 8px center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '16px'
                          }}
                          value={q.status}
                          onChange={(e) => handleUpdateStatus(q.id, e.target.value)}
                          disabled={submittingAction}
                        >
                          <option value="pending" style={{ backgroundColor: '#2F1B10', color: '#FFB300' }}>Pending</option>
                          <option value="replied" style={{ backgroundColor: '#0C1E2F', color: '#40C4FF' }}>Replied</option>
                          <option value="resolved" style={{ backgroundColor: '#14352D', color: '#00FF87' }}>Resolved</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
        </div>

      </div>

    </div>
  );
}
