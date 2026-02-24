'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string>('');

  const onLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed';
      if (message.includes('auth/unauthorized-domain')) {
        setError('Bu domain Firebase Auth içinde yetkili değil. Firebase Console > Authentication > Settings > Authorized domains kısmına ekleyin.');
        return;
      }
      setError('Giriş başarısız oldu. Firebase Auth ayarlarını kontrol edin.');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full space-y-4">
        <h1 className="text-2xl font-bold">43Zekat</h1>
        <p className="text-sm text-gray-500">Google hesabınız ile giriş yapın.</p>
        {error ? <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p> : null}
        <Button className="w-full" onClick={onLogin}>Google ile Giriş</Button>
      </Card>
    </main>
  );
}
