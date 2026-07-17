'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { AdminNav } from '../../components/AdminNav';
import { Mail, MessageCircle, CheckCircle, RefreshCw, Clock } from 'lucide-react';

export default function ContactQueries() {
  const router = useRouter();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchQueries = async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('contact_queries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueries(data || []);
    } catch (err) {
      console.error(err);
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
                  <th>Status</th>
                  <th style={{ width: '280px' }}>Quick Actions</th>
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
                        <span className={`admin-badge ${getStatusBadge(q.status)}`} style={{ textTransform: 'capitalize' }}>
                          {q.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Response Link buttons */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a 
                              href={`mailto:${q.email}?subject=Tutor%20Online%20Support%20Query`}
                              className="admin-btn admin-btn-secondary" 
                              style={{ padding: '6px 10px', fontSize: '11px', flex: 1 }}
                            >
                              <Mail size={12} /> Email
                            </a>
                            {q.phone && (
                              <a 
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-btn admin-btn-secondary" 
                                style={{ padding: '6px 10px', fontSize: '11px', flex: 1, borderColor: '#00E676', color: '#00FF87' }}
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </a>
                            )}
                          </div>

                          {/* Status Select action buttons */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <select 
                              className="admin-input" 
                              style={{ height: '28px', padding: '0 8px', fontSize: '11px', borderRadius: 'var(--rounded-sm)', flex: 1 }}
                              value={q.status}
                              onChange={(e) => handleUpdateStatus(q.id, e.target.value)}
                              disabled={submittingAction}
                            >
                              <option value="pending">Pending</option>
                              <option value="replied">Replied</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
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
