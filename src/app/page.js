'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        router.push('/dashboard');
      }
    };
    checkUser();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--brand-teal-deep)',
      color: 'var(--on-dark)',
      fontFamily: 'inherit'
    }}>
      <div style={{ textAlign: 'center' }}>
        <img 
          src="/light-logo.svg" 
          alt="Tutor Online" 
          style={{ height: '44px', width: 'auto', display: 'inline-block', marginBottom: '20px' }} 
        />
        <h3>Loading Admin Panel...</h3>
      </div>
    </div>
  );
}
