'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function Protected({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.push('/login');
    else if (adminOnly && role !== 'admin') router.push('/dashboard');
  }, [adminOnly, loading, role, router, user]);

  if (loading || !user || (adminOnly && role !== 'admin')) return <div className="p-6">Loading...</div>;

  return <>{children}</>;
}
