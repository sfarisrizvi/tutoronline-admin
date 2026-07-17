'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { AdminNav } from '../../components/AdminNav';
import { Shield, ShieldAlert, UserPlus, Trash2, Key, RefreshCw } from 'lucide-react';

export default function AdminSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState('super_admin');

  // Admin list state
  const [adminsList, setAdminsList] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Add Admin Modal state
  const [addAdminModal, setAddAdminModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    full_name: '',
    email: '',
    password: '',
    admin_role: 'monitor'
  });
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await fetch('/api/admins');
      const data = await res.json();
      if (res.ok) {
        setAdminsList(data.admins || []);
      } else {
        console.error('Error fetching admins:', data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdmins(false);
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
      
      const role = user.user_metadata?.admin_role || 'super_admin';
      setAdminRole(role);

      setLoading(false);

      if (role === 'super_admin') {
        fetchAdmins();
      }
    };
    checkAuth();
  }, [router]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.full_name || !newAdmin.email || !newAdmin.password || !newAdmin.admin_role) return;

    setSubmittingAction(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create admin user');
      }

      setAddAdminModal(false);
      setNewAdmin({ full_name: '', email: '', password: '', admin_role: 'monitor' });
      fetchAdmins();
      alert('Admin user created successfully.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeleteAdmin = async (id, email) => {
    if (email === adminUser?.email) {
      alert('You cannot delete your own active administrator profile.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete administrator ${email}?`)) return;

    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/admins?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete admin');
      }

      setAdminsList(prev => prev.filter(adm => adm.id !== id));
      alert('Admin profile deleted.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getRoleLabel = (role) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'moderator') return 'Moderator';
    return 'Monitor';
  };

  const getRoleBadge = (role) => {
    if (role === 'super_admin') return 'admin-badge-red';
    if (role === 'moderator') return 'admin-badge-purple';
    return 'admin-badge-grey';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--surface)', color: 'var(--ink)' }}>
        <p>Loading setting parameters...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '100%' }}>
          <div>
            <h1>Settings & Security</h1>
            <p>Review administrative roles, toggle operator permissions, and provision new credentials.</p>
          </div>
          {adminRole === 'super_admin' && (
            <button className="admin-btn admin-btn-secondary" onClick={fetchAdmins}>
              <RefreshCw size={14} /> Refresh Admins List
            </button>
          )}
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', flex: 1, width: '100%', maxWidth: '100%' }}>
        
        {/* Current profile info card */}
        <div className="admin-card" style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={24} style={{ color: 'var(--brand-green)' }} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Current Account: {adminUser?.user_metadata?.full_name || 'System Admin'}</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--steel)' }}>
              <span>Email: <strong>{adminUser?.email}</strong></span>
              <span>Authorization level: <span className={`admin-badge ${getRoleBadge(adminRole)}`}>{getRoleLabel(adminRole)}</span></span>
            </div>
          </div>
        </div>

        {/* Admin Management Section for Super Admin */}
        {adminRole === 'super_admin' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
              <h2 style={{ fontSize: '20px', margin: 0 }}>System Administrators List</h2>
              
              <button className="admin-btn admin-btn-primary" onClick={() => setAddAdminModal(true)}>
                <UserPlus size={16} /> Add New Admin
              </button>
            </div>

            <div className="admin-table-container">
              {loadingAdmins ? (
                <p style={{ textAlign: 'center', padding: '40px' }}>Loading admins...</p>
              ) : adminsList.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px' }}>No administrators found.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role Profile</th>
                      <th>Created Date</th>
                      <th style={{ width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminsList.map((adm) => (
                      <tr key={adm.id}>
                        <td style={{ fontWeight: 600 }}>{adm.full_name}</td>
                        <td>{adm.email}</td>
                        <td>
                          <span className={`admin-badge ${getRoleBadge(adm.admin_role)}`}>
                            {getRoleLabel(adm.admin_role)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--steel)', fontSize: '13px' }}>
                          {new Date(adm.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteAdmin(adm.id, adm.email)}
                            className="admin-btn admin-btn-danger"
                            style={{ padding: '6px 10px', borderRadius: 'var(--rounded-md)' }}
                            disabled={submittingAction || adm.email === adminUser?.email}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="admin-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#1A1813', border: '1px solid #332B1A', color: '#FFB300', padding: '20px' }}>
            <ShieldAlert size={24} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#FFB300', fontSize: '15px' }}>Administrator Settings Restricted</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#B39E80' }}>
                Only accounts with Super Admin privileges are authorized to provision, query, or delete secondary admin credentials.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Add Admin Modal */}
      {addAdminModal && (
        <div className="admin-modal-overlay" onClick={() => setAddAdminModal(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', marginBottom: '20px' }}>
              Add New Administrator
            </h3>

            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate)', marginBottom: '8px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="admin-input"
                  placeholder="e.g. Ali Raza"
                  value={newAdmin.full_name}
                  onChange={e => setNewAdmin(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate)', marginBottom: '8px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="admin-input"
                  placeholder="e.g. ali.raza@tutoronline.pk"
                  value={newAdmin.email}
                  onChange={e => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate)', marginBottom: '8px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="admin-input"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  value={newAdmin.password}
                  onChange={e => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--slate)', marginBottom: '8px' }}>
                  Administrative Role
                </label>
                <select
                  className="admin-input"
                  value={newAdmin.admin_role}
                  onChange={e => setNewAdmin(prev => ({ ...prev, admin_role: e.target.value }))}
                >
                  <option value="super_admin">Super Admin (Full access)</option>
                  <option value="moderator">Moderator (KYC, suspension, support)</option>
                  <option value="monitor">Monitor (View-only, update contact query status)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setAddAdminModal(false)} disabled={submittingAction}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submittingAction}>
                  {submittingAction ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
