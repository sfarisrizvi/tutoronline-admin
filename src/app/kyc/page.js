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
  FileText, 
  RefreshCw,
  Award,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2
} from 'lucide-react';

export default function KYCReview() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tutors, setTutors] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Filter & Search states
  const [filterMode, setFilterMode] = useState('pending_onboarding'); // 'pending_onboarding' | 'pending' | 'rejected' | 'approved'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ pending_onboarding: 0, pending: 0, rejected: 0, approved: 0 });
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [sortField, setSortField] = useState('created_at'); // 'created_at' | 'hourly_rate' | 'kyc_docs'
  const [sortAsc, setSortAsc] = useState(false); // Default false: latest signup users first (DESC)

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
  
  // Area Annotation states: { [docKey]: [ { x, y, w, h, text } ] }
  const [annotations, setAnnotations] = useState({});
  const [activeAnnotationText, setActiveAnnotationText] = useState('');
  const [newAnnCoords, setNewAnnCoords] = useState(null); // { x, y, w, h }
  const [startCoords, setStartCoords] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [annMode, setAnnMode] = useState(false);

  const resetLightboxControls = () => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
    setNewAnnCoords(null);
    setActiveAnnotationText('');
    setAnnMode(false);
    setDrawing(false);
  };

  const handleSaveAnnotation = () => {
    if (!activeAnnotationText.trim() || !newAnnCoords || !lightbox.docKey) return;
    
    const docKey = lightbox.docKey;
    const newAnn = { 
      x: newAnnCoords.x, 
      y: newAnnCoords.y, 
      w: newAnnCoords.w, 
      h: newAnnCoords.h, 
      text: activeAnnotationText 
    };
    
    const list = annotations[docKey] || [];
    const updated = [...list, newAnn];
    const updatedAll = { ...annotations, [docKey]: updated };
    
    setAnnotations(updatedAll);
    
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

    if (!selectedObjectionDocs.includes(docKey)) {
      setSelectedObjectionDocs(prev => [...prev, docKey]);
    }
    
    // Save to database immediately
    handleVerifyDoc(docKey, 'rejected', activeAnnotationText, updated);
    
    setNewAnnCoords(null);
    setActiveAnnotationText('');
  };

  // Unified authentication check
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
    };
    checkAuth();
  }, [router]);

  // Unified fetching hook for counts and queue items
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      try {
        // Fetch queue metrics counts
        const [pendingOnboardingRes, pendingRes, rejectedRes, approvedRes] = await Promise.all([
          supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).or('onboarding_complete.eq.false,kyc_docs.is.null,kyc_docs.eq.{}').neq('kyc_status', 'approved'),
          supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true).eq('kyc_status', 'pending').not('kyc_docs', 'is', null).neq('kyc_docs', '{}'),
          supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true).eq('kyc_status', 'rejected').not('kyc_docs', 'is', null).neq('kyc_docs', '{}'),
          supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true).eq('kyc_status', 'approved')
        ]);

        if (active) {
          setCounts({
            pending_onboarding: pendingOnboardingRes.count || 0,
            pending: pendingRes.count || 0,
            rejected: rejectedRes.count || 0,
            approved: approvedRes.count || 0
          });
        }

        // Fetch paginated queue items
        let query = supabase.from('tutor_profiles').select('*', { count: 'exact' });
        if (filterMode === 'pending_onboarding') {
          query = query.or('onboarding_complete.eq.false,kyc_docs.is.null,kyc_docs.eq.{}').neq('kyc_status', 'approved');
        } else if (filterMode === 'pending') {
          query = query.eq('onboarding_complete', true).eq('kyc_status', 'pending').not('kyc_docs', 'is', null).neq('kyc_docs', '{}');
        } else if (filterMode === 'rejected') {
          query = query.eq('onboarding_complete', true).eq('kyc_status', 'rejected').not('kyc_docs', 'is', null).neq('kyc_docs', '{}');
        } else if (filterMode === 'approved') {
          query = query.eq('onboarding_complete', true).eq('kyc_status', 'approved');
        }

        if (searchQuery.trim() !== '') {
          const q = searchQuery.trim();
          query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.like.%${q}%`);
        }

        const { data, error, count } = await query
          .order(sortField, { ascending: sortAsc })
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
  }, [page, pageSize, filterMode, searchQuery, reloadTrigger, sortField, sortAsc]);

  const handleFilterModeChange = (mode) => {
    setFilterMode(mode);
    setPage(1);
    setSortField('created_at'); // Reset sorting to default latest signup first
    setSortAsc(false);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'hourly_rate' ? true : false); // hourly_rate ASC (min to max), kyc_docs DESC (submitted first)
    }
    setPage(1);
  };

  // Verify single document
  const handleVerifyDoc = async (key, status, reason = '', customAnnotations = null) => {
    if (!selectedTutor || adminRole === 'monitor') return;
    const supabase = createClient();
    
    const currentVerifications = selectedTutor.kyc_verifications || {};
    const currentDoc = currentVerifications[key] || {};
    const newVerifications = {
      ...currentVerifications,
      [key]: {
        ...currentDoc,
        status,
        reason: reason || currentDoc.reason || '',
        annotations: customAnnotations !== null ? customAnnotations : (currentDoc.annotations || []),
        verified_at: new Date().toISOString()
      }
    };

    // If verifying/approving, clear rejection details
    if (status === 'approved') {
      newVerifications[key].reason = '';
      newVerifications[key].annotations = [];
      
      // Clear from local annotations state too
      setAnnotations(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
    
    setSubmittingAction(true);
    try {
      const { error } = await supabase
        .from('tutor_profiles')
        .update({ kyc_verifications: newVerifications })
        .eq('id', selectedTutor.id);
        
      if (error) throw error;
      
      // Update local state
      setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, kyc_verifications: newVerifications } : t));
      setSelectedTutor(prev => ({ ...prev, kyc_verifications: newVerifications }));
      showToast(`Document marked as ${status}.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectDoc = (key) => {
    const reason = prompt(`Enter rejection reason for ${key.replace('_', ' ')}:`);
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      showToast("Rejection reason is required.", "error");
      return;
    }
    handleVerifyDoc(key, 'rejected', reason.trim());
  };

  // Load private signed URLs when a tutor is selected
  useEffect(() => {
    if (!selectedTutor) {
      const timer = setTimeout(() => {
        setSignedUrls({});
        setAnnotations({});
      }, 0);
      return () => clearTimeout(timer);
    }

    const initialAnns = {};
    const verif = selectedTutor.kyc_verifications || {};
    Object.keys(verif).forEach(k => {
      if (verif[k]?.annotations) {
        initialAnns[k] = verif[k].annotations;
      }
    });
    setTimeout(() => {
      setAnnotations(initialAnns);
    }, 0);

    const loadUrls = async () => {
      setLoadingDocs(true);
      const supabase = createClient();
      const urls = {};
      const kycDocs = selectedTutor.kyc_docs || {};

      try {
        for (const key of Object.keys(kycDocs)) {
          const path = kycDocs[key];
          if (path && typeof path === 'string') {
            const { data, error } = await supabase.storage.from('teacher-files').createSignedUrl(path, 3600);
            if (!error && data) {
              urls[key] = data.signedUrl;
            }
          } else if (Array.isArray(path)) {
            const certUrls = [];
            for (const certPath of path) {
              const { data, error } = await supabase.storage.from('teacher-files').createSignedUrl(certPath, 3600);
              if (!error && data) {
                certUrls.push(data.signedUrl);
              }
            }
            urls[key] = certUrls;
          }
        }
        setSignedUrls(urls);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDocs(false);
      }
    };

    loadUrls();
  }, [selectedTutor]);

  // Approve Tutor
  const handleApprove = async () => {
    if (!selectedTutor || adminRole === 'monitor') return;

    // Validation check: A profile cannot get KYC approved without CNIC and Degree documents approval
    const verif = selectedTutor.kyc_verifications || {};
    const cnicFrontApproved = verif.cnic_front?.status === 'approved';
    const cnicBackApproved = verif.cnic_back?.status === 'approved';
    const degreeApproved = verif.degree?.status === 'approved';

    if (!cnicFrontApproved || !cnicBackApproved || !degreeApproved) {
      showToast("Cannot approve KYC: Both CNIC (front & back) and Degree documents must be approved first.", "error");
      return;
    }

    requestConsent(
      'Approve Tutor KYC',
      'Are you sure you want to mark this tutor as KYC Approved? This will make their profile active in the main app.',
      async () => {
        setSubmittingAction(true);
        const supabase = createClient();
        try {
          const { error } = await supabase
            .from('tutor_profiles')
            .update({ 
              kyc_status: 'approved',
              kyc_objections: {}
            })
            .eq('id', selectedTutor.id);

          if (error) throw error;

          // Update state
          setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, kyc_status: 'approved', kyc_objections: {} } : t));
          setSelectedTutor(prev => ({ ...prev, kyc_status: 'approved', kyc_objections: {} }));
          showToast('Tutor KYC approved successfully.');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          setSubmittingAction(false);
        }
      }
    );
  };

  // Submit Rejection / Objections
  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedTutor || adminRole === 'monitor') return;
    if (selectedObjectionDocs.length === 0 || !objectionComment.trim()) {
      showToast('Please select at least one document and write instructions.', 'error');
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
      showToast('Objections submitted successfully.');
    } catch (err) {
      showToast(err.message, 'error');
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
          const res = await fetch(`/api/admins?id=${selectedTutor.id}`, {
            method: 'DELETE'
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Failed to delete user');
          }

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

  const filteredTutors = tutors;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%', width: '100%' }}>
          <div>
            <h1>KYC Verification Queue</h1>
            <p>Vet credentials, analyze degrees, flag document corrections, and issue verified badges.</p>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => setReloadTrigger(t => t + 1)}>
            <RefreshCw size={14} /> Refresh Queue
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, maxWidth: '100%', width: '100%' }}>
        
        {/* Metric cards filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div 
            onClick={() => handleFilterModeChange('pending_onboarding')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'pending_onboarding' ? '2px solid var(--steel)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Onboarding Incomplete</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--steel)' }}>{counts.pending_onboarding}</h2>
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
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Pending KYC</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--accent-orange)' }}>{counts.pending}</h2>
          </div>

          <div 
            onClick={() => handleFilterModeChange('rejected')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'rejected' ? '2px solid var(--accent-purple)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>In Review (Objections)</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--accent-purple)' }}>{counts.rejected}</h2>
          </div>

          <div 
            onClick={() => handleFilterModeChange('approved')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'approved' ? '2px solid var(--brand-green)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Approved KYC</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--brand-green)' }}>{counts.approved}</h2>
          </div>
        </div>

        {/* Search Panel with transparent background input to fix contrast line issue */}
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--spacing-md)', padding: '12px 16px' }}>
          <Search size={18} style={{ color: 'var(--steel)' }} />
          <input
            type="text"
            className="admin-input"
            style={{ border: 'none', background: 'transparent', color: 'var(--ink)', width: '100%', height: 'auto', padding: 0 }}
            placeholder="Search tutors by name, email or number..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {/* KYC Queue Table */}
        <div className="admin-table-container">
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>Loading KYC queue...</p>
          ) : filteredTutors.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px' }}>No tutors found in this status queue.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S.#</th>
                  <th>Tutor Info</th>
                  <th>City / Area</th>
                  <th 
                    onClick={() => handleSort('hourly_rate')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by Hourly Rate"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Hourly Rate
                      <span style={{ fontSize: '11px', color: sortField === 'hourly_rate' ? 'var(--brand-green)' : 'var(--steel)' }}>
                        {sortField === 'hourly_rate' ? (sortAsc ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('kyc_docs')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort by KYC Document Submissions"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      KYC Documents
                      <span style={{ fontSize: '11px', color: sortField === 'kyc_docs' ? 'var(--brand-green)' : 'var(--steel)' }}>
                        {sortField === 'kyc_docs' ? (sortAsc ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTutors.map((tutor, idx) => (
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
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {tutor.kyc_docs && Object.keys(tutor.kyc_docs).map(docKey => (
                          <span key={docKey} className="admin-badge admin-badge-grey" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                            {docKey.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {tutor.suspended ? (
                        <span className="admin-badge admin-badge-red">Suspended</span>
                      ) : (!tutor.onboarding_complete || !tutor.kyc_docs || Object.keys(tutor.kyc_docs).length === 0) ? (
                        <span className="admin-badge admin-badge-grey">Onboarding Incomplete</span>
                      ) : tutor.kyc_status === 'approved' ? (
                        <span className="admin-badge admin-badge-green">Approved</span>
                      ) : tutor.kyc_status === 'pending' ? (
                        <span className="admin-badge admin-badge-orange">Pending</span>
                      ) : (
                        <span className="admin-badge admin-badge-purple">Objections</span>
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

      {/* Right Drawer: Review details */}
      {selectedTutor && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 940 }}
            onClick={() => { setSelectedTutor(null); setShowObjections(false); }}
          />

          <div className={`admin-drawer ${selectedTutor ? 'open' : ''}`}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--canvas-dark)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Tutor KYC Review</h3>
                <span style={{ fontSize: '11px', color: 'var(--steel)' }}>ID: {selectedTutor.id}</span>
              </div>
              <button 
                onClick={() => { setSelectedTutor(null); setShowObjections(false); }}
                style={{ color: 'var(--steel)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
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

              {/* Document Review List */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Verification Documents</span>
                
                {loadingDocs ? (
                  <p style={{ fontSize: '12px', color: 'var(--steel)' }}>Loading document links...</p>
                ) : !selectedTutor.kyc_docs || Object.keys(selectedTutor.kyc_docs).length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--steel)' }}>No verification documents uploaded.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(selectedTutor.kyc_docs).map((key) => {
                      const docUrl = signedUrls[key];
                      const isArray = Array.isArray(docUrl);
                      const vState = selectedTutor.kyc_verifications?.[key];
                      const docStatus = vState?.status || 'pending';

                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--surface-soft)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', textTransform: 'capitalize', fontWeight: 500 }}>
                                {key.replace('_', ' ')}
                              </span>
                              {docStatus === 'approved' ? (
                                <span style={{ fontSize: '10px', color: 'var(--brand-green-dark)', backgroundColor: 'var(--brand-green-soft)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Verified</span>
                              ) : docStatus === 'rejected' ? (
                                <span 
                                  style={{ fontSize: '10px', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, cursor: 'help' }}
                                  title={`Objection: ${vState.reason}`}
                                >
                                  Rejected (?)
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', color: '#92400E', backgroundColor: '#FEF3C7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Unverified</span>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                                  </div>
                                ))
                              ) : (
                                <button
                                  onClick={() => docUrl && setLightbox({ isOpen: true, url: docUrl, title: key.replace('_', ' '), docKey: key })}
                                  className="admin-btn admin-btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}
                                  disabled={!docUrl}
                                >
                                  <Eye size={12} /> View
                                </button>
                              )}

                              {/* Green Check (Approve) */}
                              <button
                                onClick={() => handleVerifyDoc(key, 'approved')}
                                style={{
                                  backgroundColor: docStatus === 'approved' ? 'var(--brand-green-soft)' : 'transparent',
                                  border: '1px solid ' + (docStatus === 'approved' ? 'var(--brand-green-dark)' : 'var(--hairline)'),
                                  color: docStatus === 'approved' ? 'var(--brand-green-dark)' : 'var(--steel)',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                disabled={adminRole === 'monitor' || submittingAction}
                                title="Approve document"
                              >
                                <Check size={12} />
                              </button>

                              {/* Red Cross (Reject) */}
                              <button
                                onClick={() => handleRejectDoc(key)}
                                style={{
                                  backgroundColor: docStatus === 'rejected' ? '#FEE2E2' : 'transparent',
                                  border: '1px solid ' + (docStatus === 'rejected' ? '#EF4444' : 'var(--hairline)'),
                                  color: docStatus === 'rejected' ? '#EF4444' : 'var(--steel)',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                disabled={adminRole === 'monitor' || submittingAction}
                                title="Reject document"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          {docStatus === 'rejected' && vState?.reason && (
                            <div style={{ fontSize: '11px', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '6px 10px', borderRadius: '4px', border: '1px solid #FECACA' }}>
                              <strong>Objection:</strong> {vState.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedTutor.kyc_status === 'rejected' && selectedTutor.kyc_objections && (
                <div style={{ backgroundColor: '#2F1B10', border: '1px solid rgba(255,110,66,0.2)', borderRadius: 'var(--rounded-md)', padding: '12px', fontSize: '13px', color: '#FFB300' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} /> Active Objections:
                  </div>
                  <div><strong>Flagged Docs:</strong> {selectedTutor.kyc_objections.flagged_documents?.join(', ')}</div>
                  <div style={{ marginTop: '4px' }}><strong>Comment:</strong> {selectedTutor.kyc_objections.comment}</div>
                </div>
              )}

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

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--hairline)', backgroundColor: 'var(--canvas-dark)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {adminRole === 'monitor' ? (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--steel)' }}>
                  <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Monitor Mode: KYC approval is read-only
                </div>
              ) : (
                <>
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
            
            <div style={{ color: 'var(--ink)', marginBottom: '16px', display: 'flex', justifyItems: 'center', alignItems: 'center', gap: '16px', zIndex: 1050 }}>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>{lightbox.title}</span>
              <span className="admin-badge admin-badge-grey">
                {annMode ? 'Click on Document to Pin Correction Note' : 'Drag to Pan • Scroll/Controls to Zoom'}
              </span>
            </div>

            <div style={{ display: 'flex', width: '100%', flex: 1, gap: '20px', overflow: 'hidden' }}>
              
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
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setStartCoords({ x, y });
                    setNewAnnCoords({ x, y, w: 0, h: 0 });
                    setDrawing(true);
                    return;
                  }
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                }}
                onMouseMove={(e) => {
                  if (annMode && drawing && newAnnCoords) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
                    const currentY = ((e.clientY - rect.top) / rect.height) * 100;
                    const left = Math.min(startCoords.x, currentX);
                    const top = Math.min(startCoords.y, currentY);
                    const width = Math.abs(currentX - startCoords.x);
                    const height = Math.abs(currentY - startCoords.y);
                    setNewAnnCoords({ x: left, y: top, w: width, h: height });
                    return;
                  }
                  if (!isDragging || annMode) return;
                  setPanOffset({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                  });
                }}
                onMouseUp={(e) => {
                  if (annMode && drawing) {
                    setDrawing(false);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
                    const currentY = ((e.clientY - rect.top) / rect.height) * 100;
                    const left = Math.min(startCoords.x, currentX);
                    const top = Math.min(startCoords.y, currentY);
                    const width = Math.max(1, Math.abs(currentX - startCoords.x)); // min 1% size
                    const height = Math.max(1, Math.abs(currentY - startCoords.y)); // min 1% size
                    setNewAnnCoords({ x: left, y: top, w: width, h: height });
                    return;
                  }
                  setIsDragging(false);
                }}
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

                    {lightbox.docKey && (annotations[lightbox.docKey] || []).map((ann, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${ann.x}%`,
                          top: `${ann.y}%`,
                          width: `${ann.w}%`,
                          height: `${ann.h}%`,
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                          transformOrigin: 'top left',
                          border: '2px solid #FF5252',
                          backgroundColor: 'rgba(255, 82, 82, 0.15)',
                          pointerEvents: 'none',
                          zIndex: 100
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          left: '2px',
                          backgroundColor: '#FF5252',
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '1px 4px',
                          borderRadius: '2px'
                        }}>
                          Area {idx + 1}
                        </span>
                      </div>
                    ))}

                    {newAnnCoords && (
                      <div 
                        style={{
                          position: 'absolute',
                          left: `${newAnnCoords.x}%`,
                          top: `${newAnnCoords.y}%`,
                          width: `${newAnnCoords.w}%`,
                          height: `${newAnnCoords.h}%`,
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                          transformOrigin: 'top left',
                          border: '2px dashed var(--brand-green)',
                          backgroundColor: 'rgba(0, 237, 100, 0.15)',
                          pointerEvents: 'none',
                          zIndex: 101
                        }}
                      />
                    )}

                    {newAnnCoords && !drawing && (
                      <div 
                        style={{
                          position: 'absolute',
                          left: `${newAnnCoords.x + newAnnCoords.w / 2}%`,
                          top: `${newAnnCoords.y + newAnnCoords.h}%`,
                          transform: `translate(-50%, 8px) translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                          transformOrigin: 'top center',
                          backgroundColor: 'var(--canvas-dark)',
                          border: '2px solid var(--brand-green)',
                          borderRadius: 'var(--rounded-md)',
                          padding: '12px',
                          boxShadow: 'var(--shadow-modal)',
                          zIndex: 500,
                          width: '240px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Area objection note:</div>
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
                            Add Note
                          </button>
                          <button 
                            type="button" 
                            className="admin-btn admin-btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '10px', height: '24px', flex: 1 }}
                            onClick={() => { setNewAnnCoords(null); setActiveAnnotationText(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                <div style={{ padding: '16px', borderBottom: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase' }}>Image Controls</span>
                  
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

                  <button 
                    onClick={() => { setAnnMode(!annMode); setNewAnnCoords(null); }}
                    className={`admin-btn ${annMode ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    style={{ width: '100%', fontSize: '12px' }}
                  >
                    {annMode ? '✓ Drawing Mode Active' : '📍 Pin Objection Comment'}
                  </button>

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

                  {/* View Mode Document Verification Actions */}
                  {lightbox.docKey && (
                    <div style={{ 
                      padding: '16px', 
                      borderTop: '1px solid var(--hairline)', 
                      backgroundColor: 'var(--surface-soft)', 
                      display: 'flex', 
                      gap: '12px',
                      marginTop: 'auto'
                    }}>
                      <button
                        onClick={() => {
                          handleVerifyDoc(lightbox.docKey, 'approved');
                        }}
                        className="admin-btn"
                        style={{ 
                          flex: 1, 
                          backgroundColor: 'var(--brand-green)', 
                          color: '#fff', 
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          borderRadius: 'var(--rounded-md)'
                        }}
                        disabled={submittingAction || adminRole === 'monitor'}
                      >
                        <Check size={16} /> Approve
                      </button>
                      <button
                        onClick={() => {
                          handleRejectDoc(lightbox.docKey);
                        }}
                        className="admin-btn admin-btn-danger"
                        style={{ 
                          flex: 1, 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          borderRadius: 'var(--rounded-md)'
                        }}
                        disabled={submittingAction || adminRole === 'monitor'}
                      >
                        <X size={16} /> Reject
                      </button>
                    </div>
                  )}

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
