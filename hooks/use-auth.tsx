'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'meoncu@gmail.com';

type AuthContextType = {
  user: User | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }
      const profileRef = doc(db, 'users', u.uid, 'profile', 'main');
      const snap = await getDoc(profileRef);
      const assignedRole = u.email === ADMIN_EMAIL ? 'admin' : 'user';
      if (!snap.exists()) {
        await setDoc(profileRef, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          role: assignedRole,
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'users', u.uid, 'assets', 'main'), {
          tlAssets: [],
          currencyAssets: [],
          metalAssets: [],
        });
        setRole(assignedRole);
      } else {
        setRole((snap.data().role as 'admin' | 'user') ?? 'user');
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      loginWithGoogle: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      logout: async () => signOut(auth),
    }),
    [loading, role, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
