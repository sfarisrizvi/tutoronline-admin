'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import {
  Star,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  EyeOff,
  Flag,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  FileText,
  X,
  ExternalLink
} from 'lucide-react';

export default function ReviewsAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [adminUser, setAdminUser] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'published' | 'hidden' | 'flagged'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    published: 0,
    hidden: 0,
    flagged: 0,
    hidden: 0,
    flagged: 0,
    avgRating: 5.0
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadReviews() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (isCancelled) return;
        setAdminUser(user);

        // Fetch reviews with joins
        const { data, error } = await supabase
          .from('contract_reviews')
          .select(`
            *,
            contracts (
              id,
              terms,
              subjects,
              mode,
              amount,
              payment_plan,
              duration_value,
              duration_unit,
              created_at
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (isCancelled) return;

        // Collect user profiles
        const userIds = [...new Set([
          ...(data || []).map(r => r.reviewer_id),
          ...(data || []).map(r => r.reviewee_id)
        ])];

        let clientMap = {};
        let tutorMap = {};

        if (userIds.length > 0) {
          const [{ data: clients }, { data: tutors }] = await Promise.all([
            supabase.from('client_profiles').select('id, full_name, email, city').in('id', userIds),
            supabase.from('tutor_profiles').select('id, full_name, email, city').in('id', userIds)
          ]);

          if (clients) clients.forEach(c => { clientMap[c.id] = c; });
          if (tutors) tutors.forEach(t => { tutorMap[t.id] = t; });
        }

        if (isCancelled) return;

        const formatted = (data || []).map(r => ({
          ...r,
          reviewer_info: clientMap[r.reviewer_id] || tutorMap[r.reviewer_id] || { full_name: 'Unknown', email: 'N/A' },
          reviewee_info: tutorMap[r.reviewee_id] || clientMap[r.reviewee_id] || { full_name: 'Unknown', email: 'N/A' }
        }));

        setReviews(formatted);

        // Calculate Metrics
        const total = formatted.length;
        const published = formatted.filter(r => r.status === 'published').length;
        const hidden = formatted.filter(r => r.status === 'hidden').length;
        const flagged = formatted.filter(r => r.is_flagged).length;
        const sumRatings = formatted.reduce((acc, curr) => acc + Number(curr.overall_rating || 5), 0);
        const avg = total > 0 ? (sumRatings / total).toFixed(1) : '5.0';

        setMetrics({ total, published, hidden, flagged, avgRating: avg });
      } catch (err) {
        console.error('Error fetching admin reviews:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadReviews();

    return () => {
      isCancelled = true;
    };
  }, [refreshTrigger]);

  const handleToggleVisibility = async (review) => {
    const nextStatus = review.status === 'hidden' ? 'published' : 'hidden';
    const confirmMsg = nextStatus === 'hidden' 
      ? 'Hide this review from the tutor\'s public profile? It will be excluded from rating calculations.'
      : 'Restore and republish this review to the public profile?';

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_visibility',
          review_id: review.id,
          status: nextStatus,
          admin_id: adminUser?.id,
          admin_email: adminUser?.email
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update visibility');

      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: nextStatus } : r));
      if (selectedReview?.id === review.id) {
        setSelectedReview(prev => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      alert(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFlag = async (review) => {
    const nextFlag = !review.is_flagged;
    const reason = nextFlag ? prompt('Enter reason for flagging this review (optional):') : null;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_flag',
          review_id: review.id,
          is_flagged: nextFlag,
          flag_reason: reason,
          admin_id: adminUser?.id,
          admin_email: adminUser?.email
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to toggle flag');

      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, is_flagged: nextFlag, flag_reason: reason } : r));
      if (selectedReview?.id === review.id) {
        setSelectedReview(prev => ({ ...prev, is_flagged: nextFlag, flag_reason: reason }));
      }
    } catch (err) {
      alert(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered reviews
  const filtered = reviews.filter(r => {
    if (filterStatus === 'published' && r.status !== 'published') return false;
    if (filterStatus === 'hidden' && r.status !== 'hidden') return false;
    if (filterStatus === 'flagged' && !r.is_flagged) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const tutorName = r.reviewee_info?.full_name?.toLowerCase() || '';
      const clientName = r.reviewer_info?.full_name?.toLowerCase() || '';
      const feedback = r.feedback_text?.toLowerCase() || '';
      return tutorName.includes(q) || clientName.includes(q) || feedback.includes(q);
    }

    return true;
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--brand-green-dark, #00684A)',
            backgroundColor: 'rgba(0, 104, 74, 0.08)',
            padding: '4px 10px',
            borderRadius: '999px',
            marginBottom: '8px'
          }}>
            <ShieldCheck size={14} /> REPUTATION &amp; REVIEWS AUDIT
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: 'var(--ink, #001E2B)' }}>
            Contract Reviews &amp; Moderation
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--stone, #5C768D)' }}>
            Audit verified tuition reviews, inspect private parent notes, and moderate abusive or disputed submissions.
          </p>
        </div>

        <button
          onClick={() => { setLoading(true); setRefreshTrigger(k => k + 1); }}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '999px',
            border: '1px solid var(--hairline-strong, #E8EDEB)',
            backgroundColor: 'var(--canvas, #fff)',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--ink, #001E2B)',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Verified Reviews', val: metrics.total, color: 'var(--ink, #001E2B)', icon: Star },
          { label: 'Published & Live', val: metrics.published, color: '#059669', icon: CheckCircle2 },
          { label: 'Hidden by Admin', val: metrics.hidden, color: '#DC2626', icon: EyeOff },
          { label: 'Flagged for Review', val: metrics.flagged, color: '#D97706', icon: Flag },
          { label: 'Avg Platform Rating', val: `${metrics.avgRating} ★`, color: '#F59E0B', icon: ThumbsUp }
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              style={{
                backgroundColor: 'var(--canvas, #fff)',
                border: '1px solid var(--hairline-strong, #E8EDEB)',
                borderRadius: '16px',
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--stone, #5C768D)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {m.label}
                </span>
                <Icon size={16} color={m.color} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: m.color }}>
                {m.val}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        backgroundColor: 'var(--canvas, #fff)',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid var(--hairline-strong, #E8EDEB)',
        marginBottom: '20px'
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: `All (${metrics.total})` },
            { id: 'published', label: `Published (${metrics.published})` },
            { id: 'hidden', label: `Hidden (${metrics.hidden})` },
            { id: 'flagged', label: `Flagged (${metrics.flagged})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: filterStatus === tab.id ? 'var(--brand-teal-deep, #001E2B)' : 'transparent',
                color: filterStatus === tab.id ? '#fff' : 'var(--stone, #5C768D)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--stone, #5C768D)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutor, client, or feedback..."
            style={{
              width: '100%',
              padding: '8px 14px 8px 36px',
              borderRadius: '999px',
              border: '1px solid var(--hairline-strong, #E8EDEB)',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: 'var(--surface-soft, #F7FAFA)'
            }}
          />
        </div>
      </div>

      {/* Reviews Table / Grid */}
      <div style={{
        backgroundColor: 'var(--canvas, #fff)',
        border: '1px solid var(--hairline-strong, #E8EDEB)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--stone, #5C768D)' }}>
            Loading contract reviews...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--stone, #5C768D)' }}>
            No reviews matching this filter.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-soft, #F7FAFA)', borderBottom: '1px solid var(--hairline-strong, #E8EDEB)', color: 'var(--stone, #5C768D)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 18px' }}>Tutor (Reviewee)</th>
                <th style={{ padding: '14px 18px' }}>Parent (Reviewer)</th>
                <th style={{ padding: '14px 18px' }}>Rating &amp; Breakdown</th>
                <th style={{ padding: '14px 18px' }}>Public Feedback</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rev) => (
                <tr
                  key={rev.id}
                  style={{
                    borderBottom: '1px solid var(--hairline-strong, #E8EDEB)',
                    backgroundColor: rev.is_flagged ? '#FFFBEB' : rev.status === 'hidden' ? '#FEF2F2' : 'transparent'
                  }}
                >
                  {/* Tutor */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--ink, #001E2B)' }}>
                      {rev.reviewee_info?.full_name || 'Tutor'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--stone, #5C768D)' }}>
                      {rev.reviewee_info?.city || 'Pakistan'}
                    </div>
                  </td>

                  {/* Parent */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink, #001E2B)' }}>
                      {rev.reviewer_info?.full_name || 'Client'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--stone, #5C768D)' }}>
                      {rev.reviewer_info?.city || 'Pakistan'}
                    </div>
                  </td>

                  {/* Rating */}
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 800, color: '#D97706' }}>
                      <Star size={14} fill="#F59E0B" color="#F59E0B" />
                      <span>{Number(rev.overall_rating).toFixed(1)} / 5.0</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--stone, #5C768D)', marginTop: '2px' }}>
                      M:{rev.subject_mastery || '-'} • P:{rev.punctuality || '-'} • C:{rev.communication || '-'}
                    </div>
                  </td>

                  {/* Feedback Snippet */}
                  <td style={{ padding: '14px 18px', maxWidth: '320px' }}>
                    <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink, #001E2B)' }}>
                      &ldquo;{rev.feedback_text}&rdquo;
                    </p>
                    {rev.private_feedback && (
                      <span style={{ fontSize: '10px', color: '#92400E', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                        🔒 Has Private Admin Note
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      backgroundColor: rev.status === 'hidden' ? '#FEE2E2' : rev.is_flagged ? '#FEF3C7' : 'rgba(16, 185, 129, 0.1)',
                      color: rev.status === 'hidden' ? '#DC2626' : rev.is_flagged ? '#D97706' : '#059669'
                    }}>
                      {rev.status === 'hidden' ? 'HIDDEN' : rev.is_flagged ? 'FLAGGED' : 'PUBLISHED'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedReview(rev)}
                        title="View Full Docket"
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid var(--hairline-strong, #E8EDEB)',
                          backgroundColor: 'var(--canvas, #fff)',
                          cursor: 'pointer',
                          color: 'var(--brand-teal-deep, #001E2B)'
                        }}
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        onClick={() => handleToggleVisibility(rev)}
                        disabled={actionLoading}
                        title={rev.status === 'hidden' ? 'Publish Review' : 'Hide Review'}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid var(--hairline-strong, #E8EDEB)',
                          backgroundColor: 'var(--canvas, #fff)',
                          cursor: 'pointer',
                          color: rev.status === 'hidden' ? '#059669' : '#DC2626'
                        }}
                      >
                        {rev.status === 'hidden' ? <CheckCircle2 size={14} /> : <EyeOff size={14} />}
                      </button>

                      <button
                        onClick={() => handleToggleFlag(rev)}
                        disabled={actionLoading}
                        title={rev.is_flagged ? 'Remove Flag' : 'Flag Review'}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid var(--hairline-strong, #E8EDEB)',
                          backgroundColor: 'var(--canvas, #fff)',
                          cursor: 'pointer',
                          color: rev.is_flagged ? '#D97706' : 'var(--stone, #5C768D)'
                        }}
                      >
                        <Flag size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Details Modal */}
      {selectedReview && (
        <div
          onClick={() => setSelectedReview(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--canvas, #fff)',
              borderRadius: '24px',
              maxWidth: '600px',
              width: '100%',
              padding: '28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            {/* Close */}
            <button
              onClick={() => setSelectedReview(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--stone, #5C768D)'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={18} color="var(--brand-green-dark, #00684A)" />
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-green-dark, #00684A)', textTransform: 'uppercase' }}>
                VERIFIED CONTRACT REVIEW DOCKET
              </span>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--ink, #001E2B)' }}>
              Review Details &amp; Audit Trail
            </h2>

            {/* Parties Card */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: 'var(--surface-soft, #F7FAFA)',
              marginBottom: '18px'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--stone, #5C768D)', textTransform: 'uppercase' }}>TUTOR (REVIEWEE)</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink, #001E2B)' }}>{selectedReview.reviewee_info?.full_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--stone, #5C768D)' }}>{selectedReview.reviewee_info?.email}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--stone, #5C768D)', textTransform: 'uppercase' }}>CLIENT (REVIEWER)</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink, #001E2B)' }}>{selectedReview.reviewer_info?.full_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--stone, #5C768D)' }}>{selectedReview.reviewer_info?.email}</div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--surface-soft, #F7FAFA)' }}>
                <div style={{ fontSize: '10px', color: 'var(--stone, #5C768D)', fontWeight: 700 }}>OVERALL</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#D97706' }}>{Number(selectedReview.overall_rating).toFixed(1)} ★</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--surface-soft, #F7FAFA)' }}>
                <div style={{ fontSize: '10px', color: 'var(--stone, #5C768D)', fontWeight: 700 }}>MASTERY</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #001E2B)' }}>{selectedReview.subject_mastery || '-'}/5</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--surface-soft, #F7FAFA)' }}>
                <div style={{ fontSize: '10px', color: 'var(--stone, #5C768D)', fontWeight: 700 }}>PUNCTUALITY</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #001E2B)' }}>{selectedReview.punctuality || '-'}/5</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: 'var(--surface-soft, #F7FAFA)' }}>
                <div style={{ fontSize: '10px', color: 'var(--stone, #5C768D)', fontWeight: 700 }}>COMMUNICATION</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #001E2B)' }}>{selectedReview.communication || '-'}/5</div>
              </div>
            </div>

            {/* Public Review */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #001E2B)', marginBottom: '6px' }}>
                Public Feedback
              </div>
              <div style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface-soft, #F7FAFA)',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--ink, #001E2B)'
              }}>
                &ldquo;{selectedReview.feedback_text}&rdquo;
              </div>
            </div>

            {/* Private Note to Admin */}
            {selectedReview.private_feedback && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                  <MessageSquare size={13} /> Private Feedback to Admin
                </div>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: '#92400E'
                }}>
                  {selectedReview.private_feedback}
                </div>
              </div>
            )}

            {/* Tutor Response */}
            {selectedReview.response_text && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-green-dark, #00684A)', marginBottom: '6px' }}>
                  Tutor&apos;s Public Response
                </div>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(0, 104, 74, 0.05)',
                  borderLeft: '3px solid var(--brand-green-dark, #00684A)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: 'var(--ink, #001E2B)'
                }}>
                  {selectedReview.response_text}
                </div>
              </div>
            )}

            {/* Audit Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--hairline-strong, #E8EDEB)', paddingTop: '18px' }}>
              <button
                type="button"
                onClick={() => handleToggleVisibility(selectedReview)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  height: '42px',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: selectedReview.status === 'hidden' ? '#059669' : '#DC2626',
                  backgroundColor: selectedReview.status === 'hidden' ? '#059669' : '#DC2626',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {selectedReview.status === 'hidden' ? 'Publish Review' : 'Hide Review from Profile'}
              </button>

              <button
                type="button"
                onClick={() => handleToggleFlag(selectedReview)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  height: '42px',
                  borderRadius: '999px',
                  border: '1px solid var(--hairline-strong, #E8EDEB)',
                  backgroundColor: 'var(--canvas, #fff)',
                  color: selectedReview.is_flagged ? '#D97706' : 'var(--ink, #001E2B)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {selectedReview.is_flagged ? 'Remove Flag' : 'Flag for Investigation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
