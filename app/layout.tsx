import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: '43Zekat',
  description: 'Zekat calculation app with Firebase + PWA',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
