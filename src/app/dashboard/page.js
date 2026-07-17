'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { AdminNav } from '../../components/AdminNav';
import { Award, Users, BookOpen, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTutors: 0,
    totalClients: 0,
    pendingKyc: 0,
    activeJobs: 0,
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentTutors, setRecentTutors] = useState([]);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.user_metadata?.role !== 'admin') {
        router.push('/login');
        return;
      }

      try {
        // Fetch Live Stats
        const [
          { count: tutorsCount },
          { count: clientsCount },
          { count: kycCount },
          { count: jobsCount },
        ] = await Promise.all([
          supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('client_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('tutor_profiles').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        ]);

        setStats({
          totalTutors: tutorsCount || 0,
          totalClients: clientsCount || 0,
          pendingKyc: kycCount || 0,
          activeJobs: jobsCount || 0,
        });

        // Fetch recent jobs
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, title, subject, budget_amount, budget_type, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentJobs(jobsData || []);

        // Fetch recent tutors
        const { data: tutorsData } = await supabase
          .from('tutor_profiles')
          .select('id, full_name, email, city, created_at, kyc_status')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentTutors(tutorsData || []);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--surface)', color: 'var(--ink)' }}>
        <p>Loading overview metrics...</p>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Tutors', value: stats.totalTutors, icon: Award, color: 'var(--brand-green-dark)' },
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'var(--accent-purple)' },
    { label: 'Pending KYC', value: stats.pendingKyc, icon: Clock, color: 'var(--accent-orange)' },
    { label: 'Active Jobs', value: stats.activeJobs, icon: BookOpen, color: 'var(--accent-blue)' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--surface)', minHeight: '100vh', width: '100%', maxWidth: '100%' }}>
      {/* Header Band */}
      <div className="admin-header-band">
        <div className="container" style={{ width: '100%', maxWidth: '100%' }}>
          <h1>Platform Overview</h1>
          <p>Real-time analytics and user operations for Pakistan&apos;s Tutor Online marketplace.</p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 'var(--spacing-xl)', width: '100%', maxWidth: '100%' }}>
        
        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--steel)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{card.label}</p>
                  <h2 style={{ margin: 0, fontSize: '32px', color: 'var(--ink)' }}>{card.value}</h2>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={24} style={{ color: card.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Activity Split grids */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 'var(--spacing-lg)' }}>
          
          {/* Recent Tutors */}
          <div className="admin-card" style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Recent Tutor Registrations</h3>
              <Link href="/users" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                View All <ArrowRight size={14} />
              </Link>
            </div>
            {recentTutors.length === 0 ? (
              <p style={{ color: 'var(--steel)', fontSize: '14px' }}>No registered tutors found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentTutors.map((tutor) => (
                  <div key={tutor.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--hairline-soft)' }}>
                    <div>
                      <h5 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 600 }}>{tutor.full_name || 'Unnamed Tutor'}</h5>
                      <span style={{ fontSize: '12px', color: 'var(--steel)' }}>{tutor.email} • {tutor.city || 'No City'}</span>
                    </div>
                    <span className={`admin-badge ${tutor.kyc_status === 'approved' ? 'admin-badge-green' : tutor.kyc_status === 'pending' ? 'admin-badge-orange' : 'admin-badge-grey'}`}>
                      KYC: {tutor.kyc_status || 'none'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Jobs */}
          <div className="admin-card" style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Recent Job Postings</h3>
            </div>
            {recentJobs.length === 0 ? (
              <p style={{ color: 'var(--steel)', fontSize: '14px' }}>No job listings created yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentJobs.map((job) => (
                  <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--hairline-soft)' }}>
                    <div>
                      <h5 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 600 }}>{job.title}</h5>
                      <span style={{ fontSize: '12px', color: 'var(--steel)' }}>Subject: {job.subject}</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand-green-dark)' }}>
                      Rs {job.budget_amount} <span style={{ fontSize: '12px', color: 'var(--steel)' }}>({job.budget_type})</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
