'use client';

import { useEffect, useState } from 'react';
import { Protected } from '@/components/layout/protected';
import { Card } from '@/components/ui/card';

type Row = { uid: string; email: string; role: string };

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then((d) => setRows(d.users ?? []));
  }, []);

  return (
    <Protected adminOnly>
      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <h1 className="mb-3 text-xl font-bold">Admin Panel</h1>
          {rows.map((u) => <div className="border-b py-2" key={u.uid}>{u.email} - {u.role}</div>)}
        </Card>
      </main>
    </Protected>
  );
}
