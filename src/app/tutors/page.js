'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { 
  Search, 
  ExternalLink, 
  Eye, 
  Check, 
  X, 
  AlertCircle, 
  UserX, 
  UserCheck, 
  Trash2, 
  FileText, 
  BookOpen, 
  RefreshCw,
  Award,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MapPin,
  MessageSquareOff
} from 'lucide-react';

export default function AdminTutors() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tutors, setTutors] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Filter, Search, Pagination
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending' | 'verified' | 'suspended'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState({ total: 0, pending: 0, verified: 0, suspended: 0 });

  // Selected Tutor Drawer state
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Lightbox state
  const [lightbox, setLightbox] = useState({ isOpen: false, url: '', title: '', docKey: '' });

  // Objection state
  const [showObjections, setShowObjections] = useState(false);
  const [selectedObjectionDocs, setSelectedObjectionDocs] = useState([]);
  const [objectionComment, setObjectionComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Custom Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Custom Consent Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: false
  });
  const requestConsent = (title, message, onConfirm, danger = false) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      danger
    });
  };

  // Lightbox Interactive states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Annotation states: { [docKey]: [ { x, y, text } ] }
  const [annotations, setAnnotations] = useState({});
  const [activeAnnotationText, setActiveAnnotationText] = useState('');
  const [newAnnCoords, setNewAnnCoords] = useState(null);
  const [annMode, setAnnMode] = useState(false);

  const resetLightboxControls = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
    setNewAnnCoords(null);
    setActiveAnnotationText('');
    setAnnMode(false);
  };

  const fetchMetrics = async () => {
    const supabase = createClient();
    try {
      const [
        { count: total },
        { count: pending },
        { count: verified },
        { count: suspended }
      ] = await Promise.all([
        supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
        supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('verified', true),
        supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('suspended', true)
      ]);
      setMetrics({
        total: total || 0,
        pending: pending || 0,
        verified: verified || 0,
        suspended: suspended || 0
      });
    } catch (err) {
      console.error('Error fetching tutor metrics:', err);
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

  // Fetch tutors when dependencies update
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      try {
        let query = supabase
          .from('tutor_profiles')
          .select('*', { count: 'exact' });

        if (filterMode === 'pending') {
          query = query.eq('kyc_status', 'pending');
        } else if (filterMode === 'verified') {
          query = query.eq('verified', true);
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
          setTutors(data || []);
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

  const handleSaveAnnotation = () => {
    if (!activeAnnotationText.trim() || !newAnnCoords || !lightbox.docKey) return;
    
    const docKey = lightbox.docKey;
    const newAnn = { x: newAnnCoords.x, y: newAnnCoords.y, text: activeAnnotationText };
    
    setAnnotations(prev => {
      const list = prev[docKey] || [];
      const updated = [...list, newAnn];
      const updatedAll = { ...prev, [docKey]: updated };
      
      // Automatically construct objectionComment text from annotations
      const formattedComments = [];
      Object.keys(updatedAll).forEach(k => {
        const listItems = updatedAll[k];
        if (listItems && listItems.length > 0) {
          formattedComments.push(`- Objections for ${k.replace('_', ' ')}:`);
          listItems.forEach((ann, i) => {
            formattedComments.push(`  * [Marker ${i+1}] ${ann.text}`);
          });
        }
      });
      setObjectionComment(formattedComments.join('\n'));
      
      return updatedAll;
    });

    if (!selectedObjectionDocs.includes(docKey)) {
      setSelectedObjectionDocs(prev => [...prev, docKey]);
    }
    setShowObjections(true);
    setNewAnnCoords(null);
    setActiveAnnotationText('');
  };

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

  // Load private signed URLs when a tutor is selected
  useEffect(() => {
    if (!selectedTutor) {
      return;
    }

    let active = true;
    const loadUrls = async () => {
      setLoadingDocs(true);
      const supabase = createClient();
      const urls = {};
      const kycDocs = selectedTutor.kyc_docs || {};

      try {
        for (const key of Object.keys(kycDocs)) {
          if (!active) return;
          const path = kycDocs[key];
          if (path && typeof path === 'string') {
            const { data, error } = await supabase.storage.from('teacher-files').createSignedUrl(path, 3600);
            if (!error && data) {
              urls[key] = data.signedUrl;
            }
          } else if (Array.isArray(path)) {
            const certUrls = [];
            for (const certPath of path) {
              if (!active) return;
              const { data, error } = await supabase.storage.from('teacher-files').createSignedUrl(certPath, 3600);
              if (!error && data) {
                certUrls.push(data.signedUrl);
              }
            }
            urls[key] = certUrls;
          }
        }
        if (active) {
          setSignedUrls(urls);
        }
      } catch (err) {
        console.error('Error signing KYC files:', err);
      } finally {
        if (active) setLoadingDocs(false);
      }
    };

    loadUrls();
    return () => {
      active = false;
    };
  }, [selectedTutor]);

  // Approve Tutor
  const handleApprove = async () => {
    if (!selectedTutor || adminRole === 'monitor') return;
    if (!confirm('Mark this tutor as Approved and Academic Verified?')) return;

    setSubmittingAction(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('tutor_profiles')
        .update({ 
          kyc_status: 'approved',
          verified: true,
          kyc_objections: {}
        })
        .eq('id', selectedTutor.id);

      if (error) throw error;

      // Update state
      setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, kyc_status: 'approved', verified: true, kyc_objections: {} } : t));
      setSelectedTutor(prev => ({ ...prev, kyc_status: 'approved', verified: true, kyc_objections: {} }));
      alert('Tutor approved successfully.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Rejection / Objections
  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedTutor || adminRole === 'monitor') return;
    if (selectedObjectionDocs.length === 0 || !objectionComment.trim()) {
      alert('Please select at least one document and write instructions.');
      return;
    }

    setSubmittingAction(true);
    const supabase = createClient();
    try {
      const objectionsData = {
        flagged_documents: selectedObjectionDocs,
        comment: objectionComment,
        rejected_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tutor_profiles')
        .update({
          kyc_status: 'rejected',
          verified: false,
          kyc_objections: objectionsData
        })
        .eq('id', selectedTutor.id);

      if (error) throw error;

      // Update state
      setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, kyc_status: 'rejected', verified: false, kyc_objections: objectionsData } : t));
      setSelectedTutor(prev => ({ ...prev, kyc_status: 'rejected', verified: false, kyc_objections: objectionsData }));
      setShowObjections(false);
      alert('Objections submitted successfully.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Suspension
  const toggleSuspension = async () => {
    if (!selectedTutor || adminRole === 'monitor') return;
    const nextSuspendedState = !selectedTutor.suspended;
    
    requestConsent(
      nextSuspendedState ? 'Suspend Tutor Account' : 'Unsuspend Tutor Account',
      nextSuspendedState 
        ? 'Are you sure you want to suspend this tutor account? They will lose access to their tutor dashboard, onboarding, and will be hidden from all public searches.'
        : 'Are you sure you want to unsuspend this tutor account? This will restore their active portal and onboarding access.',
      async () => {
        setSubmittingAction(true);
        const supabase = createClient();
        try {
          const { error } = await supabase
            .from('tutor_profiles')
            .update({ suspended: nextSuspendedState })
            .eq('id', selectedTutor.id);

          if (error) throw error;

          // Update state
          setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, suspended: nextSuspendedState } : t));
          setSelectedTutor(prev => ({ ...prev, suspended: nextSuspendedState }));
          showToast(`Account successfully ${nextSuspendedState ? 'suspended' : 'unsuspended'}.`);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setSubmittingAction(false);
        }
      },
      nextSuspendedState // danger flag is true when suspending
    );
  };

  // Toggle Verification Badge
  const toggleVerification = async () => {
    if (!selectedTutor || adminRole === 'monitor') return;
    if (selectedTutor.kyc_status !== 'approved') {
      showToast("Tutor is not eligible for verified badge until their KYC status is approved.", "error");
      return;
    }
    const nextVerifiedState = !selectedTutor.verified;
    const updatedVerifications = {
      ...(selectedTutor.kyc_verifications || {}),
      profile_verified_at: nextVerifiedState ? new Date().toISOString() : null
    };
    
    requestConsent(
      nextVerifiedState ? 'Grant Verified Premium Badge' : 'Remove Verified Premium Badge',
      nextVerifiedState
        ? 'Are you sure you want to grant the Verified Badge (Premium Status) to this tutor?'
        : 'Are you sure you want to remove the Verified Badge (Premium Status) from this tutor?',
      async () => {
        setSubmittingAction(true);
        const supabase = createClient();
        try {
          const { error } = await supabase
            .from('tutor_profiles')
            .update({ 
              verified: nextVerifiedState,
              kyc_verifications: updatedVerifications
            })
            .eq('id', selectedTutor.id);

          if (error) throw error;

          // Update state
          setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, verified: nextVerifiedState, kyc_verifications: updatedVerifications } : t));
          setSelectedTutor(prev => ({ ...prev, verified: nextVerifiedState, kyc_verifications: updatedVerifications }));
          showToast(`Verified badge ${nextVerifiedState ? 'granted' : 'removed'} successfully.`);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setSubmittingAction(false);
        }
      }
    );
  };

  // Delete User Account (Super Admin only)
  const handleDeleteAccount = async () => {
    if (!selectedTutor || adminRole !== 'super_admin') return;
    
    requestConsent(
      'PERMANENT DELETION',
      'CRITICAL ACTION: Are you sure you want to permanently delete this tutor account? All documents, profiles, and dashboard data will be deleted forever. This cannot be undone.',
      async () => {
        setSubmittingAction(true);
        try {
          // Call server API route /api/admins to delete auth.user securely
          const res = await fetch(`/api/admins?id=${selectedTutor.id}`, {
            method: 'DELETE'
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Failed to delete user');
          }

          // Also trigger a notification (Mock email notification to user)
          console.log(`Account deletion notification dispatched to ${selectedTutor.email}`);

          // Update state
          setTutors(prev => prev.filter(t => t.id !== selectedTutor.id));
          setSelectedTutor(null);
          showToast('Account permanently deleted.');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setSubmittingAction(false);
        }
      },
      true // danger flag
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
          <div>
            <h1>Tutors Directory</h1>
            <p>Verify qualifications, approve KYC files, suspend accounts, and view profiles.</p>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => { fetchMetrics(); }}>
            <RefreshCw size={14} /> Refresh Directory
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, width: '100%', maxWidth: '100%' }}>
        
        {/* Metric cards filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
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
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>All Tutors</span>
            <h2 style={{ margin: '4px 0 0 0' }}>{metrics.total}</h2>
          </div>

          <div 
            onClick={() => handleFilterModeChange('pending')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'pending' ? '2px solid var(--accent-orange)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>KYC Pending</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--accent-orange)' }}>{metrics.pending}</h2>
          </div>

          <div 
            onClick={() => handleFilterModeChange('verified')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'verified' ? '2px solid var(--brand-green)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Verified</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--brand-green)' }}>{metrics.verified}</h2>
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

        {/* Search Panel */}
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--spacing-md)', padding: '12px 16px' }}>
          <Search size={18} style={{ color: 'var(--steel)' }} />
          <input
            type="text"
            className="admin-input"
            style={{ border: 'none', background: 'transparent', color: 'var(--ink)', width: '100%', height: 'auto', padding: 0 }}
            placeholder="Search tutors by name, email or number..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Tutors Grid Table */}
        <div className="admin-table-container">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>Loading tutors directory...</p>
          ) : tutors.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>No tutors found matching the criteria.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S.#</th>
                  <th>Tutor Info</th>
                  <th>City / Area</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {tutors.map((tutor, idx) => (
                  <tr 
                    key={tutor.id} 
                    onClick={() => { setSelectedTutor(tutor); setSignedUrls({}); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{(page - 1) * pageSize + idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {tutor.avatar_url ? (
                          <img 
                            src={tutor.avatar_url.startsWith('http') ? tutor.avatar_url : `https://qlhcavfyllfcwifxbtbu.supabase.co/storage/v1/object/public/teacher-media/${tutor.avatar_url}`}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--slate)', fontSize: '13px' }}>
                            {tutor.full_name?.substring(0, 2).toUpperCase() || 'TR'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {tutor.full_name || 'Unnamed Tutor'}
                            {tutor.verified && <img src="/shield.svg" alt="Verified" style={{ width: '15px', height: '15px', verticalAlign: 'middle' }} />}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--steel)' }}>{tutor.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{tutor.city || 'No City'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--steel)' }}>{tutor.area || 'No Area'}</div>
                    </td>
                    <td>
                      {tutor.hourly_rate ? `Rs ${tutor.hourly_rate}/hr` : 'Not set'}
                    </td>
                    <td>
                      {tutor.suspended ? (
                        <span className="admin-badge admin-badge-red">Suspended</span>
                      ) : tutor.kyc_status === 'approved' ? (
                        <span className="admin-badge admin-badge-green">Verified</span>
                      ) : tutor.kyc_status === 'pending' ? (
                        <span className="admin-badge admin-badge-orange">KYC Pending</span>
                      ) : (
                        <span className="admin-badge admin-badge-grey">Objections</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <a 
                        href={`https://tutoronline.pk/tutors/${tutor.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="admin-btn admin-btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '11px' }}
                      >
                        <ExternalLink size={12} /> Public view
                      </a>
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
                Showing <strong>{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong>{Math.min(page * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> tutors
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

      {/* Right Drawer: Tutor Details */}
      {selectedTutor && (
        <>
          {/* Overlay to close drawer */}
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 940 }}
            onClick={() => { setSelectedTutor(null); setShowObjections(false); setSignedUrls({}); }}
          />

          <div className={`admin-drawer ${selectedTutor ? 'open' : ''}`}>
            
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--canvas-dark)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Tutor Profile Review</h3>
                <span style={{ fontSize: '11px', color: 'var(--steel)' }}>ID: {selectedTutor.id}</span>
              </div>
              <button 
                onClick={() => { setSelectedTutor(null); setShowObjections(false); setSignedUrls({}); }}
                style={{ color: 'var(--steel)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* KYC Status & Verification Badge Toggle Above Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`admin-badge ${
                    selectedTutor.suspended 
                      ? 'admin-badge-red' 
                      : (!selectedTutor.onboarding_complete || !selectedTutor.kyc_docs || Object.keys(selectedTutor.kyc_docs).length === 0)
                        ? 'admin-badge-grey'
                        : selectedTutor.kyc_status === 'approved' 
                          ? 'admin-badge-green' 
                          : selectedTutor.kyc_status === 'rejected' 
                            ? 'admin-badge-purple' 
                            : 'admin-badge-orange'
                  }`}>
                    {selectedTutor.suspended 
                      ? 'Suspended' 
                      : (!selectedTutor.onboarding_complete || !selectedTutor.kyc_docs || Object.keys(selectedTutor.kyc_docs).length === 0)
                        ? 'Onboarding Incomplete'
                        : `KYC status: ${selectedTutor.kyc_status}`}
                  </span>
                                   {/* Verified Badge Pill (Informational Only, Hidden when unverified) */}
                  {selectedTutor.verified && (
                    <span
                      style={{
                        background: 'var(--brand-green-soft)',
                        border: '1px solid var(--brand-green)',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'help'
                      }}
                      title={`Verified on ${(() => {
                        const verifiedAt = selectedTutor.kyc_verifications?.profile_verified_at || selectedTutor.kyc_verifications?.approved_at || selectedTutor.created_at;
                        if (!verifiedAt) return 'JUL 2026';
                        const d = new Date(verifiedAt);
                        const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                        const year = d.getFullYear();
                        return `${month} ${year}`;
                      })()}`}
                    >
                      <img 
                        src="/shield.svg" 
                        alt="Verified" 
                        style={{ 
                          width: '14px', 
                          height: '14px' 
                        }} 
                      />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-green-dark)' }}>
                        VERIFIED
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Tutor Profile Summary Card (Name Card) */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-lg)', backgroundColor: 'var(--surface-soft)', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
                  {selectedTutor.avatar_url ? (
                    <img 
                      src={selectedTutor.avatar_url.startsWith('http') ? selectedTutor.avatar_url : `https://qlhcavfyllfcwifxbtbu.supabase.co/storage/v1/object/public/teacher-media/${selectedTutor.avatar_url}`}
                      alt="" 
                      style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'var(--steel)' }}>
                      {selectedTutor.full_name?.substring(0, 2).toUpperCase() || 'TR'}
                    </div>
                  )}
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{selectedTutor.full_name}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--steel)', display: 'block' }}>{selectedTutor.email}</span>
                    <span style={{ fontSize: '12px', color: 'var(--steel)', display: 'block' }}>{selectedTutor.phone || 'No phone'}</span>
                  </div>
                </div>

                {/* Shield Toggle Icon on the right side of the card */}
                <button
                  onClick={toggleVerification}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: selectedTutor.kyc_status === 'approved' ? 'pointer' : 'not-allowed',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: selectedTutor.kyc_status === 'approved' ? 1 : 0.4,
                    transition: 'transform 0.2s ease',
                  }}
                  title={selectedTutor.kyc_status === 'approved' ? (selectedTutor.verified ? "Remove Verified Badge" : "Give Verified Badge") : "Approve KYC first then verify the profile."}
                  disabled={submittingAction}
                  onMouseEnter={(e) => { if (selectedTutor.kyc_status === 'approved') e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <img 
                    src="/shield.svg" 
                    alt="Verified Toggle" 
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      filter: selectedTutor.verified ? 'none' : 'grayscale(100%) opacity(30%)' 
                    }} 
                  />
                </button>
              </div>

              {/* Bio & Details */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Bio / Intro</span>
                <p style={{ fontSize: '13px', margin: 0, color: 'var(--charcoal)', backgroundColor: 'var(--surface-soft)', padding: '12px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--hairline)' }}>
                  {selectedTutor.bio || 'No bio written.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Hourly Rate</span>
                  <strong>{selectedTutor.hourly_rate ? `Rs ${selectedTutor.hourly_rate}/hr` : 'Not set'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Experience</span>
                  <strong>{selectedTutor.experience_years ? `${selectedTutor.experience_years} Years` : 'Not set'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Qualification</span>
                  <strong>{selectedTutor.qualification || 'Not set'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>City / Area</span>
                  <strong>{selectedTutor.city} ({selectedTutor.area || 'No Area'})</strong>
                </div>
              </div>

              {/* Joining and Approval dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', borderTop: '1px solid var(--hairline-soft)', paddingTop: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Joining Date</span>
                  <strong>{selectedTutor.created_at ? new Date(selectedTutor.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', marginBottom: '4px' }}>Approval Date</span>
                  <strong>{selectedTutor.kyc_status === 'approved' ? (selectedTutor.kyc_verifications?.approved_at ? new Date(selectedTutor.kyc_verifications.approved_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : new Date(selectedTutor.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })) : 'Not Approved'}</strong>
                </div>
              </div>

              {/* Document Review Section */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>KYC Document Files</span>
                
                {loadingDocs ? (
                  <p style={{ fontSize: '12px', color: 'var(--steel)' }}>Loading document links...</p>
                ) : !selectedTutor.kyc_docs || Object.keys(selectedTutor.kyc_docs).length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--steel)' }}>No verification documents uploaded.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(selectedTutor.kyc_docs).map((key) => {
                      const docUrl = signedUrls[key];
                      const isArray = Array.isArray(docUrl);

                      return (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--surface-soft)' }}>
                          <span style={{ fontSize: '13px', textTransform: 'capitalize', fontWeight: 500 }}>
                            {key.replace('_', ' ')}
                          </span>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            {isArray ? (
                              docUrl.map((url, i) => (
                                <div key={i} style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    onClick={() => setLightbox({ isOpen: true, url, title: `${key.replace('_', ' ')} (${i + 1})`, docKey: key })}
                                    className="admin-btn admin-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}
                                  >
                                    <Eye size={12} /> {i + 1}
                                  </button>
                                  <a
                                    href={url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-btn admin-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                    title="Download document file"
                                  >
                                    <Download size={12} />
                                  </a>
                                </div>
                              ))
                            ) : (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => docUrl && setLightbox({ isOpen: true, url: docUrl, title: key.replace('_', ' '), docKey: key })}
                                  className="admin-btn admin-btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '4px' }}
                                  disabled={!docUrl}
                                >
                                  <Eye size={12} /> View
                                </button>
                                <a
                                  href={docUrl}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="admin-btn admin-btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '4px', display: 'flex', alignItems: 'center', pointerEvents: docUrl ? 'auto' : 'none', opacity: docUrl ? 1 : 0.5 }}
                                  title="Download document file"
                                >
                                  <Download size={12} />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Objections history display */}
              {selectedTutor.kyc_status === 'rejected' && selectedTutor.kyc_objections && (
                <div style={{ backgroundColor: '#2F1B10', border: '1px solid rgba(255,110,66,0.2)', borderRadius: 'var(--rounded-md)', padding: '12px', fontSize: '13px', color: '#FFB300' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} /> Active Objections:
                  </div>
                  <div><strong>Flagged Docs:</strong> {selectedTutor.kyc_objections.flagged_documents?.join(', ')}</div>
                  <div style={{ marginTop: '4px' }}><strong>Comment:</strong> {selectedTutor.kyc_objections.comment}</div>
                </div>
              )}

              {/* Objections Form Dropdown */}
              {showObjections && (
                <form onSubmit={handleReject} style={{ border: '1px solid var(--hairline-strong)', padding: '16px', borderRadius: 'var(--rounded-lg)', backgroundColor: 'var(--surface-soft)', marginTop: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Select Objections Details</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {Object.keys(selectedTutor.kyc_docs || {}).map((docKey) => (
                      <label key={docKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={selectedObjectionDocs.includes(docKey)}
                          onChange={() => {
                            setSelectedObjectionDocs(prev => 
                              prev.includes(docKey) ? prev.filter(k => k !== docKey) : [...prev, docKey]
                            );
                          }}
                          style={{ accentColor: 'var(--brand-green)' }}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{docKey.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <textarea 
                      required
                      rows={3}
                      className="admin-input"
                      style={{ height: 'auto', padding: '10px' }}
                      placeholder="Input correction instructions for the tutor..."
                      value={objectionComment}
                      onChange={e => setObjectionComment(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setShowObjections(false)}>Cancel</button>
                    <button type="submit" className="admin-btn admin-btn-danger" style={{ flex: 1 }} disabled={submittingAction || selectedObjectionDocs.length === 0}>Send Objections</button>
                  </div>
                </form>
              )}

            </div>

            {/* Drawer Action Bottom Strip */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--hairline)', backgroundColor: 'var(--canvas-dark)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {adminRole === 'monitor' ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--steel)' }}>
                  <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Monitor Mode: Profile actions are read-only
                </div>
              ) : (
                <>
                  {/* Approve / Reject buttons */}
                  {!showObjections && selectedTutor.kyc_status === 'pending' && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={handleApprove} className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={submittingAction}>
                        <Check size={16} /> Approve KYC
                      </button>
                      <button onClick={() => setShowObjections(true)} className="admin-btn admin-btn-danger" style={{ flex: 1 }} disabled={submittingAction}>
                        <X size={16} /> Reject / Objections
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    {selectedTutor.suspended ? (
                      <>
                        <button 
                          onClick={toggleSuspension} 
                          className="admin-btn" 
                          style={{ flex: 1, backgroundColor: 'var(--brand-green)', color: '#fff', border: 'none' }}
                          disabled={submittingAction}
                        >
                          <UserCheck size={14} /> Unsuspend
                        </button>
                        {adminRole === 'super_admin' && (
                          <button 
                            onClick={handleDeleteAccount} 
                            className="admin-btn admin-btn-danger" 
                            style={{ flex: 1 }}
                            disabled={submittingAction}
                          >
                            <Trash2 size={14} /> Delete Account
                          </button>
                        )}
                      </>
                    ) : (
                      <button 
                        onClick={toggleSuspension} 
                        className="admin-btn admin-btn-secondary" 
                        style={{ flex: 1 }}
                        disabled={submittingAction}
                      >
                        <UserX size={14} /> Suspend Account
                      </button>
                    )}
                  </div>
                </>
              )}

            </div>

          </div>
        </>
      )}

      {/* Document Lightbox Overlay */}
      {lightbox.isOpen && (
        <div className="admin-lightbox" onClick={() => { setLightbox({ isOpen: false, url: '', title: '', docKey: '' }); resetLightboxControls(); }}>
          <div 
            className="admin-lightbox-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              width: '90vw', 
              height: '90vh',
              position: 'relative'
            }}
          >
            <button 
              className="admin-lightbox-close" 
              onClick={() => { setLightbox({ isOpen: false, url: '', title: '', docKey: '' }); resetLightboxControls(); }}
              style={{ position: 'absolute', top: 0, right: 0, zIndex: 1200 }}
            >
              ✕
            </button>
            
            {/* Title / Info Bar */}
            <div style={{ color: 'var(--ink)', marginBottom: '16px', display: 'flex', justifyItems: 'center', alignItems: 'center', gap: '16px', zIndex: 1050 }}>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>{lightbox.title}</span>
              <span className="admin-badge admin-badge-grey">
                {annMode ? 'Click on Document to Pin Correction Note' : 'Drag to Pan • Scroll/Controls to Zoom'}
              </span>
            </div>

            {/* Interactive Workspace: Image on left, annotations list on right */}
            <div style={{ display: 'flex', width: '100%', flex: 1, gap: '20px', overflow: 'hidden' }}>
              
              {/* Left Side: Document Viewer Container */}
              <div 
                style={{ 
                  flex: 1, 
                  position: 'relative', 
                  overflow: 'hidden', 
                  backgroundColor: '#04080A', 
                  borderRadius: 'var(--rounded-md)',
                  border: '1px solid var(--hairline-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: annMode ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
                }}
                onMouseDown={(e) => {
                  if (annMode) {
                    // Click to add annotation
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setNewAnnCoords({ x, y });
                    return;
                  }
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                }}
                onMouseMove={(e) => {
                  if (!isDragging || annMode) return;
                  setPanOffset({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  });
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                {lightbox.url.includes('.pdf') || lightbox.url.includes('/pdf') ? (
                  <iframe 
                    src={lightbox.url} 
                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' }}
                  />
                ) : (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={lightbox.url} 
                      alt={lightbox.title} 
                      draggable="false"
                      style={{ 
                        maxHeight: '75vh',
                        maxWidth: '60vw',
                        objectFit: 'contain',
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        userSelect: 'none'
                      }}
                    />

                    {/* Render Pins inside the image coordinate space so they scale with zoom/pan */}
                    {lightbox.docKey && (annotations[lightbox.docKey] || []).map((ann, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${ann.x}%`,
                          top: `${ann.y}%`,
                          transform: `translate(-50%, -50%) translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                          transformOrigin: 'center center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: '#FF5252',
                          border: '2px solid white',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 100
                        }}
                        title={ann.text}
                      >
                        {idx + 1}
                      </div>
                    ))}

                    {/* Popover form to write annotation details */}
                    {newAnnCoords && (
                      <div 
                        style={{
                          position: 'absolute',
                          left: `${newAnnCoords.x}%`,
                          top: `${newAnnCoords.y}%`,
                          transform: 'translate(-50%, -105%)',
                          backgroundColor: 'var(--canvas-dark)',
                          border: '2px solid var(--brand-green)',
                          borderRadius: 'var(--rounded-md)',
                          padding: '12px',
                          boxShadow: 'var(--shadow-modal)',
                          zIndex: 500,
                          width: '220px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Pin objection note:</div>
                        <input 
                          type="text"
                          autoFocus
                          className="admin-input"
                          style={{ height: '30px', padding: '4px 8px', fontSize: '12px', marginBottom: '8px' }}
                          placeholder="e.g. Blurred name/signature"
                          value={activeAnnotationText}
                          onChange={e => setActiveAnnotationText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveAnnotation();
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button" 
                            className="admin-btn admin-btn-primary" 
                            style={{ padding: '4px 8px', fontSize: '10px', height: '24px', flex: 1 }}
                            onClick={handleSaveAnnotation}
                          >
                            Add
                          </button>
                          <button 
                            type="button" 
                            className="admin-btn admin-btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '10px', height: '24px', flex: 1 }}
                            onClick={() => setNewAnnCoords(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side: Toolbar and Pin comments list */}
              <div 
                style={{ 
                  width: '320px', 
                  backgroundColor: 'var(--canvas)', 
                  borderRadius: 'var(--rounded-md)', 
                  border: '1px solid var(--hairline)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  overflow: 'hidden' 
                }}
              >
                {/* Control Panel */}
                <div style={{ padding: '16px', borderBottom: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>Image Controls</span>
                  
                  {/* Zoom/Rotate/Reset buttons row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button 
                      onClick={() => setZoom(z => Math.min(z + 0.25, 4))} 
                      className="admin-btn admin-btn-secondary" 
                      style={{ padding: '6px 10px', flex: 1 }}
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button 
                      onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} 
                      className="admin-btn admin-btn-secondary" 
                      style={{ padding: '6px 10px', flex: 1 }}
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button 
                      onClick={() => setRotation(r => (r + 90) % 360)} 
                      className="admin-btn admin-btn-secondary" 
                      style={{ padding: '6px 10px', flex: 1 }}
                      title="Rotate 90°"
                    >
                      <RotateCw size={14} />
                    </button>
                    <button 
                      onClick={() => { setZoom(1); setRotation(0); setPanOffset({ x: 0, y: 0 }); }} 
                      className="admin-btn admin-btn-secondary" 
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                    >
                      Reset
                    </button>
                  </div>

                  {/* Pin mode trigger button */}
                  <button 
                    onClick={() => { setAnnMode(!annMode); setNewAnnCoords(null); }}
                    className={`admin-btn ${annMode ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    style={{ width: '100%', fontSize: '12px' }}
                  >
                    {annMode ? '✓ Drawing Mode Active' : '📍 Pin Objection Comment'}
                  </button>

                  {/* Direct download inside lightbox */}
                  <a 
                    href={lightbox.url} 
                    download 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn-primary" 
                    style={{ width: '100%', fontSize: '12px' }}
                  >
                    <Download size={14} /> Download Document
                  </a>
                </div>

                {/* List of pins placed */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline-soft)', fontSize: '12px', fontWeight: 600, color: 'var(--slate)' }}>
                    Active Objection Notes ({lightbox.docKey ? (annotations[lightbox.docKey] || []).length : 0})
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lightbox.docKey && (annotations[lightbox.docKey] || []).length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--steel)', textAlign: 'center', margin: '20px 0' }}>
                        No objection notes pinned. Turn on Pin Mode above and click on the document image to flag issues.
                      </p>
                    ) : (
                      lightbox.docKey && (annotations[lightbox.docKey] || []).map((ann, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            padding: '10px', 
                            border: '1px solid var(--hairline)', 
                            borderRadius: 'var(--rounded-md)', 
                            backgroundColor: 'var(--surface-soft)',
                            display: 'flex',
                            gap: '10px',
                            fontSize: '12px'
                          }}
                        >
                          <span style={{ 
                            width: '18px', 
                            height: '18px', 
                            borderRadius: '50%', 
                            backgroundColor: '#FF5252', 
                            color: 'white', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 'bold',
                            fontSize: '10px',
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Note:</div>
                            <div style={{ color: 'var(--slate)', wordBreak: 'break-all' }}>{ann.text}</div>
                            <span style={{ fontSize: '9px', color: 'var(--steel)' }}>Position: {Math.round(ann.x)}%, {Math.round(ann.y)}%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Toast container */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: toast.type === 'error' ? '#EF4444' : 'var(--brand-green-dark)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 'var(--rounded-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          fontWeight: 600,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: toast.type === 'error' ? '1px solid #F87171' : '1px solid var(--brand-green)'
        }}>
          {toast.type === 'error' ? <X size={16} /> : <Check size={16} />}
          {toast.message}
        </div>
      )}

      {/* Consent Modal overlay & dialog */}
      {confirmModal.isOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9998 }}
            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--canvas)',
            borderRadius: 'var(--rounded-lg)',
            border: '1px solid var(--hairline)',
            boxShadow: 'var(--shadow-xl)',
            padding: '24px',
            width: '400px',
            maxWidth: '90%',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{confirmModal.title}</h4>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--slate)', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                className="admin-btn admin-btn-secondary" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                {confirmModal.cancelText}
              </button>
              <button 
                className={`admin-btn ${confirmModal.danger ? 'admin-btn-danger' : 'admin-btn-primary'}`}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
