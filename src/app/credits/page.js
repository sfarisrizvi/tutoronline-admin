'use client';
import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import {
  WalletCards,
  Search,
  RefreshCw,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  X,
  CreditCard,
  User,
  Building,
  Hash,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  SlidersHorizontal,
  PlusCircle,
  Check,
  ShieldCheck
} from 'lucide-react';

export default function CreditRequestsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Filters & Search
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending' | 'in_review' | 'approved' | 'rejected'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'client' | 'tutor'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [totalCount, setTotalCount] = useState(0);

  // Top Metrics
  const [metrics, setMetrics] = useState({
    pending: 0,
    in_review: 0,
    approved: 0,
    rejected: 0,
    total_approved_credits: 0
  });

  // Selected Request Drawer
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedUserWallet, setSelectedUserWallet] = useState(null);
  const [userStatement, setUserStatement] = useState([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Credit Allocation Form state
  const [allocateCredits, setAllocateCredits] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Lightbox
  const [lightboxImg, setLightboxImg] = useState(null);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setAdminUser(user);
      setAdminRole(user.user_metadata?.admin_role || 'super_admin');
    };
    checkAuth();
  }, [router]);

  // Load metrics & requests
  const fetchMetricsAndRequests = async () => {
    setLoading(true);
    setActionSuccess('');
    setActionError('');
    const supabase = createClient();

    try {
      // 1. Fetch KPI metrics counts
      const [pendingRes, reviewRes, approvedRes, rejectedRes] = await Promise.all([
        supabase.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'in_review'),
        supabase.from('credit_requests').select('credits_requested', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('credit_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected')
      ]);

      const approvedCreditsSum = (approvedRes.data || []).reduce((acc, curr) => acc + (Number(curr.credits_requested) || 0), 0);

      setMetrics({
        pending: pendingRes.count || 0,
        in_review: reviewRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
        total_approved_credits: approvedCreditsSum
      });

      // 2. Fetch paginated list
      let query = supabase.from('credit_requests').select('*', { count: 'exact' });

      if (filterMode !== 'all') {
        query = query.eq('status', filterMode);
      }
      if (roleFilter !== 'all') {
        query = query.eq('user_role', roleFilter);
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim();
        query = query.or(`transaction_ref.ilike.%${q}%,bank_name.ilike.%${q}%`);
      }

      const { data: reqs, error: reqErr, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (reqErr) throw reqErr;

      // 3. Enrich with user profile details
      if (reqs && reqs.length > 0) {
        const userIds = [...new Set(reqs.map(r => r.user_id))];
        const [clientsRes, tutorsRes] = await Promise.all([
          supabase.from('client_profiles').select('id, full_name, email, phone, avatar_url').in('id', userIds),
          supabase.from('tutor_profiles').select('id, full_name, email, phone, avatar_url').in('id', userIds)
        ]);

        const profileMap = {};
        clientsRes.data?.forEach(c => { profileMap[c.id] = { ...c, role: 'client' }; });
        tutorsRes.data?.forEach(t => { profileMap[t.id] = { ...t, role: 'tutor' }; });

        const enriched = reqs.map(r => ({
          ...r,
          profile: profileMap[r.user_id] || { full_name: 'Unknown User', email: 'N/A', phone: 'N/A', role: r.user_role }
        }));

        setRequests(enriched);
        setTotalCount(count || 0);

        // Keep drawer in sync if open
        if (selectedRequest) {
          const updatedSelected = enriched.find(r => r.id === selectedRequest.id);
          if (updatedSelected) {
            setSelectedRequest(updatedSelected);
          }
        }
      } else {
        setRequests([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching credit requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndRequests();
  }, [filterMode, roleFilter, page]);

  // Handle row click: open side panel & fetch statement
  const handleSelectRequest = async (req) => {
    setSelectedRequest(req);
    setAllocateCredits(req.amount_pkr ? String(Math.round(req.amount_pkr)) : String(req.credits_requested));
    setAdminNote(req.admin_notes || '');
    setActionSuccess('');
    setActionError('');
    setLoadingStatement(true);

    const supabase = createClient();
    try {
      // Fetch user wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', req.user_id)
        .maybeSingle();

      setSelectedUserWallet(wallet);

      // Fetch user previous statement
      const { data: stmts } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', req.user_id)
        .order('created_at', { ascending: false })
        .limit(10);

      setUserStatement(stmts || []);
    } catch (err) {
      console.error('Error loading user ledger statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setSelectedRequest(null);
    setSelectedUserWallet(null);
    setUserStatement([]);
    setActionSuccess('');
    setActionError('');
  };

  // Approve action
  const handleApprove = async () => {
    if (!selectedRequest || !adminUser) return;
    const creditsNum = parseInt(allocateCredits, 10);
    if (isNaN(creditsNum) || creditsNum <= 0) {
      setActionError('Please enter a valid credit amount to allocate.');
      return;
    }

    setSubmittingAction(true);
    setActionError('');
    setActionSuccess('');
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('admin_approve_credit_request', {
        p_request_id: selectedRequest.id,
        p_admin_id: adminUser.id,
        p_credits_to_add: creditsNum,
        p_admin_notes: adminNote.trim() || null
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to approve request');
      }

      setActionSuccess(`Successfully approved & credited ${creditsNum.toLocaleString()} credits!`);

      // Dispatch in-app notification to the user
      try {
        await supabase.from('notifications').insert({
          user_id: selectedRequest.user_id,
          title: 'Credits Deposited to Your Wallet',
          message: `Your deposit request for PKR ${Number(selectedRequest.deposit_amount).toLocaleString()} has been approved. ${creditsNum.toLocaleString()} credits have been added to your balance.`,
          type: 'wallet',
          priority: 'HIGH',
          action_url: selectedRequest.user_role === 'tutor' ? '/tutor/wallet' : '/client/wallet',
          read: false
        });
      } catch (notifErr) {
        console.warn('Could not dispatch in-app notification for credit approval:', notifErr);
      }

      // Refresh requests & statement
      await fetchMetricsAndRequests();
      // Reload statement for drawer
      const { data: updatedWallet } = await supabase.from('wallets').select('*').eq('user_id', selectedRequest.user_id).maybeSingle();
      setSelectedUserWallet(updatedWallet);
      const { data: stmts } = await supabase.from('wallet_transactions').select('*').eq('user_id', selectedRequest.user_id).order('created_at', { ascending: false }).limit(10);
      setUserStatement(stmts || []);
    } catch (err) {
      console.error('Approval failed:', err);
      setActionError(err.message || 'Error approving credit request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Mark in review
  const handleMarkInReview = async () => {
    if (!selectedRequest) return;
    setSubmittingAction(true);
    setActionError('');
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('credit_requests')
        .update({
          status: 'in_review',
          admin_notes: adminNote.trim() || selectedRequest.admin_notes,
          reviewed_by: adminUser?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;
      setActionSuccess('Request marked as In Review.');
      await fetchMetricsAndRequests();
    } catch (err) {
      console.error('In-review update failed:', err);
      setActionError(err.message || 'Error updating status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reject action
  const handleReject = async () => {
    if (!selectedRequest || !adminUser) return;
    if (!adminNote.trim()) {
      setActionError('Please provide a reason in Admin Notes before rejecting.');
      return;
    }

    setSubmittingAction(true);
    setActionError('');
    setActionSuccess('');
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('admin_reject_credit_request', {
        p_request_id: selectedRequest.id,
        p_admin_id: adminUser.id,
        p_admin_notes: adminNote.trim()
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to reject request');
      }

      setActionSuccess('Credit request rejected with note.');

      // Dispatch in-app notification to the user
      try {
        await supabase.from('notifications').insert({
          user_id: selectedRequest.user_id,
          title: 'Credit Deposit Request Update',
          message: `Your credit deposit request for PKR ${Number(selectedRequest.deposit_amount).toLocaleString()} was rejected. Reason: ${adminNote.trim()}`,
          type: 'wallet',
          priority: 'URGENT',
          action_url: selectedRequest.user_role === 'tutor' ? '/tutor/wallet' : '/client/wallet',
          read: false
        });
      } catch (notifErr) {
        console.warn('Could not dispatch in-app notification for credit rejection:', notifErr);
      }

      await fetchMetricsAndRequests();
    } catch (err) {
      console.error('Rejection failed:', err);
      setActionError(err.message || 'Error rejecting credit request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: 'rgba(255, 179, 0, 0.15)',
            color: '#FFB300',
            border: '1px solid rgba(255, 179, 0, 0.3)'
          }}>
            <Clock size={12} /> Pending
          </span>
        );
      case 'in_review':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: 'rgba(0, 114, 198, 0.15)',
            color: '#38BDF8',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <Eye size={12} /> In Review
          </span>
        );
      case 'approved':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: 'rgba(0, 237, 100, 0.15)',
            color: 'var(--brand-green)',
            border: '1px solid rgba(0, 237, 100, 0.3)'
          }}>
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: 'rgba(255, 75, 75, 0.15)',
            color: '#FF6B6B',
            border: '1px solid rgba(255, 75, 75, 0.3)'
          }}>
            <XCircle size={12} /> Rejected
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ padding: '32px', color: 'var(--charcoal)', minHeight: '100vh' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <WalletCards size={30} color="var(--brand-green)" />
            Credit Requests & Wallet Allocations
          </h1>
          <p style={{ margin: 0, color: 'var(--slate)', fontSize: '14px' }}>
            Verify bank payment receipts, allocate platform credits, and audit ledger transactions for parents and tutors.
          </p>
        </div>
        <button
          onClick={fetchMetricsAndRequests}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: 'var(--rounded-md)',
            background: 'var(--canvas)',
            border: '1px solid var(--hairline-strong)',
            color: 'var(--charcoal)',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh Requests
        </button>
      </div>

      {/* ── TOP KPI CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Pending Card */}
        <div
          onClick={() => setFilterMode('pending')}
          style={{
            background: 'var(--canvas)',
            border: filterMode === 'pending' ? '2px solid #FFB300' : '1px solid var(--hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pending Verification
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 179, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#FFB300" />
            </div>
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 700, margin: '0', color: '#FFB300' }}>
            {metrics.pending}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>Awaiting admin review</span>
        </div>

        {/* In Review Card */}
        <div
          onClick={() => setFilterMode('in_review')}
          style={{
            background: 'var(--canvas)',
            border: filterMode === 'in_review' ? '2px solid #38BDF8' : '1px solid var(--hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              In Review
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={16} color="#38BDF8" />
            </div>
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 700, margin: '0', color: '#38BDF8' }}>
            {metrics.in_review}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>Under investigation</span>
        </div>

        {/* Approved Card */}
        <div
          onClick={() => setFilterMode('approved')}
          style={{
            background: 'var(--canvas)',
            border: filterMode === 'approved' ? '2px solid var(--brand-green)' : '1px solid var(--hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Approved Requests
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0, 237, 100, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="var(--brand-green)" />
            </div>
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 700, margin: '0', color: 'var(--brand-green)' }}>
            {metrics.approved}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>
            {metrics.total_approved_credits.toLocaleString()} Credits allocated
          </span>
        </div>

        {/* Rejected Card */}
        <div
          onClick={() => setFilterMode('rejected')}
          style={{
            background: 'var(--canvas)',
            border: filterMode === 'rejected' ? '2px solid #FF6B6B' : '1px solid var(--hairline)',
            borderRadius: 'var(--rounded-lg)',
            padding: '20px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, border-color 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Rejected Requests
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 107, 107, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={16} color="#FF6B6B" />
            </div>
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 700, margin: '0', color: '#FF6B6B' }}>
            {metrics.rejected}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>Invalid or fake slips</span>
        </div>
      </div>

      {/* ── TOOLBAR & FILTERS ── */}
      <div style={{
        background: 'var(--canvas)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--rounded-lg)',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Left Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', 'pending', 'in_review', 'approved', 'rejected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterMode(tab)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--rounded-sm)',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: filterMode === tab ? 'var(--brand-green-dark)' : 'var(--surface-soft)',
                color: filterMode === tab ? '#FFFFFF' : 'var(--slate)',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}

          <div style={{ width: '1px', height: '24px', background: 'var(--hairline)', margin: '0 8px' }} />

          {/* Role selector */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--rounded-sm)',
              background: 'var(--surface-soft)',
              border: '1px solid var(--hairline-strong)',
              color: 'var(--charcoal)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Roles (Parents & Tutors)</option>
            <option value="client">Parents / Clients Only</option>
            <option value="tutor">Tutors Only</option>
          </select>
        </div>

        {/* Right Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', color: 'var(--steel)' }} />
            <input
              type="text"
              placeholder="Search reference, bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchMetricsAndRequests(); }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--rounded-sm)',
                background: 'var(--surface-soft)',
                border: '1px solid var(--hairline-strong)',
                color: 'var(--ink)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── REQUESTS TABLE ── */}
      <div style={{
        background: 'var(--canvas)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--rounded-lg)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-soft)', borderBottom: '1px solid var(--hairline)', color: 'var(--slate)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>User</th>
                <th style={{ padding: '14px 20px' }}>Role</th>
                <th style={{ padding: '14px 20px' }}>Deposit Amount</th>
                <th style={{ padding: '14px 20px' }}>Credits Req.</th>
                <th style={{ padding: '14px 20px' }}>Bank & Reference</th>
                <th style={{ padding: '14px 20px' }}>Receipt Slip</th>
                <th style={{ padding: '14px 20px' }}>Status</th>
                <th style={{ padding: '14px 20px' }}>Submitted</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--steel)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                    Loading credit requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--steel)' }}>
                    <WalletCards size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '15px', color: 'var(--charcoal)', fontWeight: 600 }}>No credit requests found</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>There are no requests matching the current filters.</p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isSelected = selectedRequest?.id === req.id;
                  const profile = req.profile;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => handleSelectRequest(req)}
                      style={{
                        borderBottom: '1px solid var(--hairline)',
                        background: isSelected ? 'rgba(0, 237, 100, 0.05)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* User Column */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--hairline-strong)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            color: 'var(--brand-green)',
                            fontSize: '14px',
                            overflow: 'hidden'
                          }}>
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (profile.full_name || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{profile.full_name || 'User'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--steel)' }}>{profile.email || 'No email'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Column */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: req.user_role === 'tutor' ? 'rgba(180, 92, 255, 0.15)' : 'rgba(0, 114, 198, 0.15)',
                          color: req.user_role === 'tutor' ? 'var(--accent-purple)' : '#38BDF8'
                        }}>
                          {req.user_role === 'tutor' ? 'Tutor' : 'Parent'}
                        </span>
                      </td>

                      {/* Deposit Amount */}
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--ink)' }}>
                        PKR {Number(req.amount_pkr).toLocaleString()}
                      </td>

                      {/* Credits Req. */}
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--brand-green)' }}>
                        {Number(req.credits_requested).toLocaleString()}
                      </td>

                      {/* Bank & Ref */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--charcoal)' }}>{req.bank_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--steel)', fontFamily: 'monospace' }}>
                          Ref: {req.transaction_ref || 'None'}
                        </div>
                      </td>

                      {/* Receipt Slip Thumbnail */}
                      <td style={{ padding: '14px 20px' }}>
                        {req.screenshot_url ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImg(req.screenshot_url);
                            }}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: 'var(--rounded-xs)',
                              overflow: 'hidden',
                              border: '1px solid var(--hairline-strong)',
                              cursor: 'zoom-in',
                              background: '#000'
                            }}
                            title="Click to view full receipt"
                          >
                            <img src={req.screenshot_url} alt="Slip" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>No image</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        {getStatusBadge(req.status)}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--slate)' }}>
                        {new Date(req.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRequest(req);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            borderRadius: 'var(--rounded-sm)',
                            background: 'var(--surface-feature)',
                            color: 'var(--brand-green)',
                            border: '1px solid rgba(0, 237, 100, 0.2)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Review <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT SLIDE-OVER REVIEW DRAWER ── */}
      {selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '540px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--canvas)',
          borderLeft: '1px solid var(--hairline-strong)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.7)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Drawer Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface-soft)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                  Credit Request Review
                </h3>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--steel)' }}>
                ID: {selectedRequest.id}
              </p>
            </div>
            <button
              onClick={handleCloseDrawer}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--slate)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {/* Action Feedback Messages */}
            {actionSuccess && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--rounded-md)',
                background: 'rgba(0, 237, 100, 0.1)',
                border: '1px solid rgba(0, 237, 100, 0.3)',
                color: 'var(--brand-green)',
                marginBottom: '20px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Check size={16} /> {actionSuccess}
              </div>
            )}
            {actionError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--rounded-md)',
                background: 'rgba(255, 75, 75, 0.1)',
                border: '1px solid rgba(255, 75, 75, 0.3)',
                color: '#FF6B6B',
                marginBottom: '20px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} /> {actionError}
              </div>
            )}

            {/* 1. Payment Slip Preview Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>
                  Bank Transfer Screenshot
                </span>
                {selectedRequest.screenshot_url && (
                  <button
                    onClick={() => setLightboxImg(selectedRequest.screenshot_url)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-green)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={12} /> View Full Size
                  </button>
                )}
              </div>

              {selectedRequest.screenshot_url ? (
                <div
                  onClick={() => setLightboxImg(selectedRequest.screenshot_url)}
                  style={{
                    width: '100%',
                    height: '240px',
                    borderRadius: 'var(--rounded-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--hairline-strong)',
                    background: '#04080A',
                    cursor: 'zoom-in',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  <img
                    src={selectedRequest.screenshot_url}
                    alt="Receipt Screenshot"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#fff'
                  }}>
                    Click to Zoom
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '32px',
                  borderRadius: 'var(--rounded-md)',
                  background: 'var(--surface-soft)',
                  textAlign: 'center',
                  color: 'var(--steel)'
                }}>
                  No receipt screenshot uploaded
                </div>
              )}
            </div>

            {/* 2. Reported Deposit Info */}
            <div style={{
              background: 'var(--surface-soft)',
              borderRadius: 'var(--rounded-md)',
              padding: '16px',
              border: '1px solid var(--hairline)',
              marginBottom: '24px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--steel)', textTransform: 'uppercase' }}>Amount Deposited</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                  PKR {Number(selectedRequest.amount_pkr).toLocaleString()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--steel)', textTransform: 'uppercase' }}>Requested Credits</span>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-green)' }}>
                  {Number(selectedRequest.credits_requested).toLocaleString()}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--steel)', textTransform: 'uppercase' }}>Bank Transferred To</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--charcoal)' }}>
                  {selectedRequest.bank_name}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--steel)', textTransform: 'uppercase' }}>Transaction Ref</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--charcoal)', fontFamily: 'monospace' }}>
                  {selectedRequest.transaction_ref || 'None'}
                </div>
              </div>
            </div>

            {/* 3. User Wallet Snapshot */}
            <div style={{
              background: 'var(--surface-soft)',
              borderRadius: 'var(--rounded-md)',
              padding: '16px',
              border: '1px solid var(--hairline)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>
                  User Account & Wallet Snapshot
                </span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: selectedRequest.user_role === 'tutor' ? 'rgba(180, 92, 255, 0.15)' : 'rgba(0, 114, 198, 0.15)',
                  color: selectedRequest.user_role === 'tutor' ? 'var(--accent-purple)' : '#38BDF8'
                }}>
                  {selectedRequest.user_role === 'tutor' ? 'Tutor Profile' : 'Parent Profile'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--steel)' }}>Name:</span> <strong style={{ color: 'var(--ink)' }}>{selectedRequest.profile?.full_name || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--steel)' }}>Phone:</span> <strong style={{ color: 'var(--ink)' }}>{selectedRequest.profile?.phone || 'N/A'}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--steel)' }}>Email:</span> <strong style={{ color: 'var(--ink)' }}>{selectedRequest.profile?.email || 'N/A'}</strong>
                </div>
              </div>

              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--steel)' }}>Current Balance:</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--brand-green)' }}>
                    {selectedUserWallet ? Number(selectedUserWallet.balance).toLocaleString() : '0'} Credits
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--steel)' }}>In Escrow:</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#38BDF8' }}>
                    {selectedUserWallet ? Number(selectedUserWallet.escrow_balance).toLocaleString() : '0'} Credits
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--steel)' }}>Total Deposited:</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                    PKR {selectedUserWallet ? Number(selectedUserWallet.total_deposited).toLocaleString() : '0'}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Action Section: Add Credit & Update Status */}
            <div style={{
              background: 'var(--surface-feature)',
              borderRadius: 'var(--rounded-md)',
              padding: '20px',
              border: '1px solid rgba(0, 237, 100, 0.2)',
              marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                Credit Allocation & Decision
              </h4>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate)', marginBottom: '6px' }}>
                  Credits to Allocate (1 PKR = 1 Credit)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <CreditCard size={16} style={{ position: 'absolute', left: '12px', color: 'var(--brand-green)' }} />
                  <input
                    type="number"
                    min="1"
                    value={allocateCredits}
                    onChange={(e) => setAllocateCredits(e.target.value)}
                    disabled={selectedRequest.status === 'approved' || submittingAction}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: 'var(--rounded-sm)',
                      background: 'var(--canvas)',
                      border: '1px solid var(--hairline-strong)',
                      color: 'var(--ink)',
                      fontSize: '15px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate)', marginBottom: '6px' }}>
                  Admin Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional internal remarks or reason for rejection..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  disabled={submittingAction}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--rounded-sm)',
                    background: 'var(--canvas)',
                    border: '1px solid var(--hairline-strong)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedRequest.status !== 'approved' && (
                  <button
                    onClick={handleApprove}
                    disabled={submittingAction}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 'var(--rounded-sm)',
                      background: 'var(--brand-green)',
                      color: '#001E2B',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle2 size={16} /> Approve & Credit Wallet
                  </button>
                )}

                {selectedRequest.status === 'pending' && (
                  <button
                    onClick={handleMarkInReview}
                    disabled={submittingAction}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--rounded-sm)',
                      background: 'var(--surface-soft)',
                      color: '#38BDF8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Mark In Review
                  </button>
                )}

                {selectedRequest.status !== 'rejected' && selectedRequest.status !== 'approved' && (
                  <button
                    onClick={handleReject}
                    disabled={submittingAction}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--rounded-sm)',
                      background: 'rgba(255, 75, 75, 0.1)',
                      color: '#FF6B6B',
                      border: '1px solid rgba(255, 75, 75, 0.3)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>

            {/* 5. User Previous Statement History Table */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>
                Recent Wallet Statement History
              </h4>

              {loadingStatement ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--steel)', fontSize: '13px' }}>
                  Loading statement...
                </div>
              ) : userStatement.length === 0 ? (
                <div style={{ padding: '20px', borderRadius: 'var(--rounded-md)', background: 'var(--surface-soft)', textAlign: 'center', color: 'var(--steel)', fontSize: '13px' }}>
                  No previous wallet transactions recorded for this user.
                </div>
              ) : (
                <div style={{ borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-soft)', color: 'var(--slate)', borderBottom: '1px solid var(--hairline)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userStatement.map((st) => {
                        const isCredit = Number(st.amount) > 0;
                        return (
                          <tr key={st.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--steel)' }}>
                              {new Date(st.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--charcoal)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {st.description}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: isCredit ? 'var(--brand-green)' : '#FF6B6B' }}>
                              {isCredit ? `+${Number(st.amount).toLocaleString()}` : Number(st.amount).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink)' }}>
                              {Number(st.balance_after).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX MODAL ── */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#04080A',
              borderRadius: 'var(--rounded-lg)',
              overflow: 'hidden',
              border: '1px solid var(--hairline-strong)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              padding: '12px 16px',
              background: 'var(--surface-soft)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--hairline)'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                Payment Receipt Slip
              </span>
              <button
                onClick={() => setLightboxImg(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--slate)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={lightboxImg}
                alt="Full receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--rounded-xs)'
                }}
              />
            </div>
            <div style={{
              padding: '10px 16px',
              background: 'var(--surface-soft)',
              borderTop: '1px solid var(--hairline)',
              textAlign: 'right'
            }}>
              <a
                href={lightboxImg}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '12px',
                  color: 'var(--brand-green)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Open in new window <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
