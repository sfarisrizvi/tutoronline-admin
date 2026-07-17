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
  Maximize2
} from 'lucide-react';

export default function KYCReview() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tutors, setTutors] = useState([]);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Filter & Search states
  const [filterMode, setFilterMode] = useState('pending'); // 'pending' | 'rejected' | 'approved'
  const [searchQuery, setSearchQuery] = useState('');

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

  const fetchTutors = async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('tutor_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTutors(data || []);
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
      setAdminUser(user);
      setAdminRole(user.user_metadata?.admin_role || 'super_admin');
      fetchTutors();
    };
    checkAuth();
  }, [router]);

  // Load private signed URLs when a tutor is selected
  useEffect(() => {
    if (!selectedTutor) {
      setSignedUrls({});
      return;
    }

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
      alert('Tutor KYC approved.');
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
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Verification Badge
  const toggleVerification = async () => {
    if (!selectedTutor || adminRole === 'monitor') return;
    const nextVerifiedState = !selectedTutor.verified;
    
    setSubmittingAction(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('tutor_profiles')
        .update({ verified: nextVerifiedState })
        .eq('id', selectedTutor.id);

      if (error) throw error;

      // Update state
      setTutors(prev => prev.map(t => t.id === selectedTutor.id ? { ...t, verified: nextVerifiedState } : t));
      setSelectedTutor(prev => ({ ...prev, verified: nextVerifiedState }));
      alert(`Verified badge ${nextVerifiedState ? 'granted' : 'removed'} successfully.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filter list locally for KYC page
  const getFilteredTutors = () => {
    let list = tutors;

    if (filterMode === 'pending') {
      list = list.filter(t => t.kyc_status === 'pending');
    } else if (filterMode === 'rejected') {
      list = list.filter(t => t.kyc_status === 'rejected');
    } else if (filterMode === 'approved') {
      list = list.filter(t => t.kyc_status === 'approved');
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        (t.full_name && t.full_name.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q))
      );
    }

    return list;
  };

  const filteredTutors = getFilteredTutors();

  const totalPending = tutors.filter(t => t.kyc_status === 'pending').length;
  const totalInReview = tutors.filter(t => t.kyc_status === 'rejected').length; // Rejected = In Review with objections
  const totalApproved = tutors.filter(t => t.kyc_status === 'approved').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%', width: '100%' }}>
          <div>
            <h1>KYC Verification Queue</h1>
            <p>Vet credentials, analyze degrees, flag document corrections, and issue verified badges.</p>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={fetchTutors}>
            <RefreshCw size={14} /> Refresh Queue
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, maxWidth: '100%', width: '100%' }}>
        
        {/* Metric cards filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <div 
            onClick={() => setFilterMode('pending')}
            style={{ 
              backgroundColor: 'var(--canvas)', 
              padding: 'var(--spacing-md)', 
              borderRadius: 'var(--rounded-lg)',
              border: filterMode === 'pending' ? '2px solid var(--accent-orange)' : '1px solid var(--hairline)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', display: 'block', textTransform: 'uppercase' }}>Pending Reviews</span>
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--accent-orange)' }}>{totalPending}</h2>
          </div>

          <div 
            onClick={() => setFilterMode('rejected')}
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
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--accent-purple)' }}>{totalInReview}</h2>
          </div>

          <div 
            onClick={() => setFilterMode('approved')}
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
            <h2 style={{ margin: '4px 0 0 0', color: 'var(--brand-green)' }}>{totalApproved}</h2>
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
                  <th>Hourly Rate</th>
                  <th>KYC Documents</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTutors.map((tutor, idx) => (
                  <tr 
                    key={tutor.id} 
                    onClick={() => setSelectedTutor(tutor)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{idx + 1}</td>
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
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', border: '1px solid var(--hairline)', borderRadius: 'var(--rounded-lg)', backgroundColor: 'var(--surface-soft)' }}>
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

              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--steel)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>KYC Status</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`admin-badge ${selectedTutor.suspended ? 'admin-badge-red' : selectedTutor.kyc_status === 'approved' ? 'admin-badge-green' : 'admin-badge-orange'}`}>
                    {selectedTutor.suspended ? 'Suspended' : `KYC status: ${selectedTutor.kyc_status}`}
                  </span>
                  {selectedTutor.verified && <img src="/shield.svg" alt="Verified" style={{ width: '15px', height: '15px', verticalAlign: 'middle' }} />}
                </div>
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

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Toggle Verified Badge Button */}
                    <button 
                      onClick={toggleVerification} 
                      className={`admin-btn ${selectedTutor.verified ? 'admin-btn-secondary' : 'admin-btn-primary'}`} 
                      style={{ flex: 1 }}
                      disabled={submittingAction}
                    >
                      {selectedTutor.verified ? 'Remove Verified' : 'Give Verified Badge'}
                    </button>

                    <button 
                      onClick={toggleSuspension} 
                      className={`admin-btn ${selectedTutor.suspended ? 'admin-btn-primary' : 'admin-btn-secondary'}`} 
                      style={{ flex: 1 }}
                      disabled={submittingAction}
                    >
                      {selectedTutor.suspended ? <><UserCheck size={14} /> Lift Ban</> : <><UserX size={14} /> Suspend Account</>}
                    </button>
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
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
