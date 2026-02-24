'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { addDays, format } from 'date-fns';
import { Protected } from '@/components/layout/protected';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { isDue, LUNAR_DAYS } from '@/lib/utils';
import { MetalAsset, UserAssets } from '@/types';
import { useThemeStore } from '@/store/theme-store';

const emptyAssets: UserAssets = { tlAssets: [], currencyAssets: [], metalAssets: [] };

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { toggleTheme } = useThemeStore();
  const [assets, setAssets] = useState<UserAssets>(emptyAssets);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 35, EUR: 38, GBP: 44 });
  const [metals, setMetals] = useState<Record<MetalAsset['metal'], number>>({ gram_gold: 3000, ounce_gold: 92500, silver: 34 });

  const [tlForm, setTlForm] = useState({ amount: '', date: '', description: '' });
  const [fxForm, setFxForm] = useState({ currency: 'USD', amount: '', date: '', description: '' });
  const [metalForm, setMetalForm] = useState<{ metal: MetalAsset['metal']; amount: string; date: string; description: string }>({ metal: 'gram_gold', amount: '', date: '', description: '' });

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'assets', 'main'), (snap) => {
      if (snap.exists()) setAssets(snap.data() as UserAssets);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    Promise.all([fetch('/api/rates').then((r) => r.json()), fetch('/api/metals').then((r) => r.json())]).then(([r, m]) => {
      setRates(r.rates);
      setMetals(m.metals);
    }).catch(() => null);
  }, []);

  if (!user) return null;

  const saveAssets = async (next: UserAssets) => {
    setAssets(next);
    await updateDoc(doc(db, 'users', user.uid, 'assets', 'main'), next);
  };

  const eligibleTL = assets.tlAssets.filter((a) => isDue(a.date)).reduce((sum, a) => sum + a.amount, 0);
  const eligibleFX = assets.currencyAssets.filter((a) => isDue(a.date)).reduce((sum, a) => sum + a.amount * (rates[a.currency] ?? 0), 0);
  const eligibleMetals = assets.metalAssets.filter((a) => isDue(a.date)).reduce((sum, a) => sum + a.amount * (metals[a.metal] ?? 0), 0);
  const totalEligible = eligibleTL + eligibleFX + eligibleMetals;
  const nisab = 85 * (metals.gram_gold ?? 0);
  const zakat = totalEligible >= nisab ? totalEligible * 0.025 : 0;

  const breakdown = useMemo(() => ([
    { label: 'TL Assets', value: eligibleTL },
    { label: 'Foreign Currency', value: eligibleFX },
    { label: 'Metals', value: eligibleMetals },
  ]), [eligibleFX, eligibleMetals, eligibleTL]);

  return (
    <Protected>
      <main className="mx-auto max-w-6xl space-y-5 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">43Zekat Dashboard</h1>
          <div className="space-x-2">
            <Button onClick={toggleTheme}>Tema</Button>
            <Button onClick={() => logout()}>Çıkış</Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="space-y-2">
            <h2 className="font-semibold">TL Varlıkları</h2>
            <input className="w-full rounded border p-2" placeholder="Tutar" value={tlForm.amount} onChange={(e) => setTlForm({ ...tlForm, amount: e.target.value })} />
            <input className="w-full rounded border p-2" type="date" value={tlForm.date} onChange={(e) => setTlForm({ ...tlForm, date: e.target.value })} />
            <input className="w-full rounded border p-2" placeholder="Açıklama" value={tlForm.description} onChange={(e) => setTlForm({ ...tlForm, description: e.target.value })} />
            <Button onClick={() => saveAssets({ ...assets, tlAssets: [...assets.tlAssets, { amount: Number(tlForm.amount), date: tlForm.date, description: tlForm.description }] })}>Ekle</Button>
          </Card>

          <Card className="space-y-2">
            <h2 className="font-semibold">Döviz</h2>
            <select className="w-full rounded border p-2" value={fxForm.currency} onChange={(e) => setFxForm({ ...fxForm, currency: e.target.value })}>
              {Object.keys(rates).map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="w-full rounded border p-2" placeholder="Miktar" value={fxForm.amount} onChange={(e) => setFxForm({ ...fxForm, amount: e.target.value })} />
            <input className="w-full rounded border p-2" type="date" value={fxForm.date} onChange={(e) => setFxForm({ ...fxForm, date: e.target.value })} />
            <p className="text-sm">TRY: {(Number(fxForm.amount || 0) * (rates[fxForm.currency] ?? 0)).toFixed(2)}</p>
            <Button onClick={() => saveAssets({ ...assets, currencyAssets: [...assets.currencyAssets, { currency: fxForm.currency, amount: Number(fxForm.amount), date: fxForm.date, description: fxForm.description }] })}>Ekle</Button>
          </Card>

          <Card className="space-y-2">
            <h2 className="font-semibold">Metal</h2>
            <select className="w-full rounded border p-2" value={metalForm.metal} onChange={(e) => setMetalForm({ ...metalForm, metal: e.target.value as MetalAsset['metal'] })}>
              <option value="gram_gold">Gram Altın</option>
              <option value="ounce_gold">Ons Altın</option>
              <option value="silver">Gümüş</option>
            </select>
            <input className="w-full rounded border p-2" placeholder="Miktar" value={metalForm.amount} onChange={(e) => setMetalForm({ ...metalForm, amount: e.target.value })} />
            <input className="w-full rounded border p-2" type="date" value={metalForm.date} onChange={(e) => setMetalForm({ ...metalForm, date: e.target.value })} />
            <p className="text-sm">TRY: {(Number(metalForm.amount || 0) * (metals[metalForm.metal] ?? 0)).toFixed(2)}</p>
            <Button onClick={() => saveAssets({ ...assets, metalAssets: [...assets.metalAssets, { metal: metalForm.metal, amount: Number(metalForm.amount), date: metalForm.date, description: metalForm.description }] })}>Ekle</Button>
          </Card>
        </section>

        <Card>
          <h2 className="mb-3 text-xl font-semibold">Özet</h2>
          <p>354 günden eski varlık toplamı: ₺{totalEligible.toFixed(2)}</p>
          <p>Nisab (85gr altın): ₺{nisab.toFixed(2)}</p>
          <p>Zekat: ₺{zakat.toFixed(2)}</p>
          <p>Önerilen ödeme tarihi: {format(addDays(new Date(), 7), 'dd.MM.yyyy')}</p>
          <table className="mt-4 w-full text-left">
            <thead><tr><th>Kalem</th><th>Tutar</th></tr></thead>
            <tbody>
              {breakdown.map((b) => <tr key={b.label}><td>{b.label}</td><td>₺{b.value.toFixed(2)}</td></tr>)}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Varlık Listesi</h2>
          {[...assets.tlAssets.map((a) => ({ title: a.description || 'TL', date: a.date, due: isDue(a.date) })), ...assets.currencyAssets.map((a) => ({ title: `${a.currency} ${a.amount}`, date: a.date, due: isDue(a.date) })), ...assets.metalAssets.map((a) => ({ title: `${a.metal} ${a.amount}`, date: a.date, due: isDue(a.date) }))].map((item, i) => (
            <div key={i} className="flex justify-between border-b py-2 text-sm">
              <span>{item.title}</span>
              <span>{item.due ? 'Zekat Due' : `Not Due Yet (${LUNAR_DAYS} gün)`}</span>
            </div>
          ))}
        </Card>
      </main>
    </Protected>
  );
}
