'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();

  const onLogin = async () => {
    await loginWithGoogle();
    router.push('/dashboard');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full space-y-4">
        <h1 className="text-2xl font-bold">43Zekat</h1>
        <p className="text-sm text-gray-500">Google hesabınız ile giriş yapın.</p>
        <Button className="w-full" onClick={onLogin}>Google ile Giriş</Button>
      </Card>
    </main>
  );
}
