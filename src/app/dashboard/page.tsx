"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, orderBy } from "firebase/firestore";
import { AssetData, TLAsset, CurrencyAsset, MetalAsset, Receivable, ZakatPayment, ZakatSnapshot } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isOneLunarYearPassed, getExchangeRates, getMetalPrices, NISAB_GOLD_GRAMS } from "@/lib/data-service";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Pencil, Coins, Landmark, ShieldCheck, Calculator, TrendingUp, Handshake, Heart, Settings, AlertTriangle, Archive, FileText, Download, Eye, Calendar } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Helper functions for formatting
const formatAmount = (val: string) => {
    if (!val) return "";
    const parts = val.split('.');
    const intPart = parts[0] === "" ? "0" : parts[0];
    // Remove non-digits for parseInt safely
    const cleanInt = intPart.replace(/\D/g, "");
    if (!cleanInt && intPart !== "0") return "";

    const formattedInt = new Intl.NumberFormat('tr-TR').format(parseInt(cleanInt || "0"));

    if (parts.length > 1) {
        return (intPart === "0" && val.startsWith('.') ? "" : formattedInt) + "," + parts[1];
    }
    return formattedInt;
};

const parseAmount = (val: string) => {
    let clean = val;
    // Commas are always decimal markers in Turkish
    if (clean.includes(',')) {
        clean = clean.replace(/\./g, "");
        clean = clean.replace(/,/g, ".");
    } else {
        // No comma. Check dots.
        const dots = (clean.match(/\./g) || []).length;
        if (dots > 1) {
            // Multiple dots -> definitely thousand separators (e.g. 1.000.000)
            clean = clean.replace(/\./g, "");
        } else if (dots === 1) {
            // One dot. If followed by 3 or more digits, it's likely a thousand separator
            // being typed or auto-formatted (e.g. 86.000 -> 86.0000)
            const parts = clean.split('.');
            if (parts[1].length >= 3) {
                clean = clean.replace(/\./g, "");
            }
            // Otherwise keep as decimal (e.g. 10.5)
        }
    }
    return clean.replace(/[^0-9.]/g, "");
};

// Helper to calculate totals for a snapshot context (preserved rates)
const calculateSnapshotTotals = (details: any, rates: any, metalPrices: any) => {
    let eligible = 0;
    const tryRate = rates.TRY || 34.0;

    details.tlAssets.forEach((a: any) => { eligible += a.amount; });
    details.currencyAssets.forEach((a: any) => {
        const rateInTry = (1 / (rates[a.currency] || 1)) * tryRate;
        eligible += a.amount * rateInTry;
    });
    details.metalAssets.forEach((a: any) => {
        eligible += a.amount * (metalPrices[a.metalType] || 0);
    });
    details.receivables.forEach((a: any) => {
        eligible += a.amount;
    });

    return { eligible };
};

export default function Dashboard() {
    const { user } = useAuthStore();
    const [tlAssets, setTlAssets] = useState<TLAsset[]>([]);
    const [currencyAssets, setCurrencyAssets] = useState<CurrencyAsset[]>([]);
    const [metalAssets, setMetalAssets] = useState<MetalAsset[]>([]);
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [zakatPayments, setZakatPayments] = useState<ZakatPayment[]>([]);
    const [rates, setRates] = useState<any>({});
    const [metalPrices, setMetalPrices] = useState<any>({});
    const [ignoreNisab, setIgnoreNisab] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [snapshots, setSnapshots] = useState<ZakatSnapshot[]>([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState<ZakatSnapshot | null>(null);
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [isEditingSnapshot, setIsEditingSnapshot] = useState(false);
    const [tempSnapshotDetails, setTempSnapshotDetails] = useState<any>(null);

    const today = new Date().toISOString().split('T')[0];

    // Form states
    const [tlAmount, setTlAmount] = useState("");
    const [tlDate, setTlDate] = useState(today);
    const [tlDesc, setTlDesc] = useState("");

    // Editing states
    const [editingAsset, setEditingAsset] = useState<any>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editAmount, setEditAmount] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editCurrency, setEditCurrency] = useState("");
    const [editMetalType, setEditMetalType] = useState("");
    const [editPerson, setEditPerson] = useState("");

    useEffect(() => {
        if (!user) return;

        const qTl = query(collection(db, `users/${user.uid}/tlAssets`));
        const unsubTl = onSnapshot(qTl, (snapshot) => {
            setTlAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TLAsset)));
        }, (error) => {
            console.error("TL query error:", error);
            toast.error("Veriler alınırken hata oluştu (TL)");
        });

        const qCurr = query(collection(db, `users/${user.uid}/currencyAssets`));
        const unsubCurr = onSnapshot(qCurr, (snapshot) => {
            setCurrencyAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurrencyAsset)));
        }, (error) => {
            console.error("Currency query error:", error);
        });

        const qMetal = query(collection(db, `users/${user.uid}/metalAssets`));
        const unsubMetal = onSnapshot(qMetal, (snapshot) => {
            setMetalAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MetalAsset)));
        }, (error) => {
            console.error("Metal query error:", error);
        });

        const qRec = query(collection(db, `users/${user.uid}/receivables`));
        const unsubRec = onSnapshot(qRec, (snapshot) => {
            setReceivables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receivable)));
        }, (error) => {
            console.error("Receivables query error:", error);
        });

        const qZakat = query(collection(db, `users/${user.uid}/zakatPayments`));
        const unsubZakat = onSnapshot(qZakat, (snapshot) => {
            setZakatPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ZakatPayment)));
        }, (error) => {
            console.error("Zakat payments query error:", error);
        });

        // Settings listener
        const unsubSettings = onSnapshot(doc(db, `users/${user.uid}/settings`, 'account'), (doc) => {
            if (doc.exists()) {
                setIgnoreNisab(doc.data().ignoreNisab || false);
            }
        });

        // Snapshots listener
        const qSnap = query(collection(db, `users/${user.uid}/zakatSnapshots`), orderBy("saveDate", "desc"));
        const unsubSnap = onSnapshot(qSnap, (snapshot) => {
            setSnapshots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        });

        const initData = async () => {
            const r = await getExchangeRates();
            setRates(r);
            const m = await getMetalPrices();
            setMetalPrices(m);
        };
        initData();

        return () => {
            unsubTl();
            unsubCurr();
            unsubMetal();
            unsubRec();
            unsubZakat();
            unsubSettings();
            unsubSnap();
        };
    }, [user]);

    const handleAddTl = async () => {
        if (!tlAmount) {
            toast.error("Lütfen miktar giriniz.");
            return;
        }
        if (!tlDate) {
            toast.error("Lütfen tarih seçiniz.");
            return;
        }
        try {
            await addDoc(collection(db, `users/${user!.uid}/tlAssets`), {
                amount: parseFloat(tlAmount),
                acquisitionDate: tlDate,
                description: tlDesc,
            });
            setTlAmount("");
            setTlDate("");
            setTlDesc("");
            toast.success("TL Varlığı eklendi.");
        } catch (e: any) {
            toast.error("Hata: " + e.message);
        }
    };

    const handleUpdate = async () => {
        if (!editingAsset || !editAmount || !editDate || !user) return;

        setIsUpdating(true);
        const { id, type } = editingAsset;

        try {
            const cleanAmount = editAmount.toString().replace(',', '.');
            const updateData: any = {
                amount: parseFloat(cleanAmount),
                acquisitionDate: editDate,
                description: editDesc,
            };

            if (type === 'currency') updateData.currency = editCurrency;
            if (type === 'metal') updateData.metalType = editMetalType;
            if (type === 'receivable') {
                updateData.person = editPerson;
                updateData.date = editDate;
                delete updateData.acquisitionDate;
            }
            if (type === 'zakatPayment') {
                updateData.recipient = editPerson;
                updateData.date = editDate;
                delete updateData.acquisitionDate;
            }

            // Optimistic close: Modal'ı hemen kapatıyoruz ki kullanıcı beklemek zorunda kalmasın
            setEditingAsset(null);

            let collectionName = "";
            if (type === 'receivable') collectionName = 'receivables';
            else if (type === 'zakatPayment') collectionName = 'zakatPayments';
            else collectionName = `${type}Assets`;

            const assetRef = doc(db, `users/${user.uid}/${collectionName}`, id);
            await updateDoc(assetRef, updateData);

            toast.success("Varlık güncellendi.");
        } catch (e: any) {
            console.error("Güncelleme hatası:", e);
            toast.error("Hata: " + e.message);
            // Hata olursa modalı tekrar açmıyoruz (kapatmıştık) ama console'a bastık
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async (type: string, id: string) => {
        try {
            let collectionName = "";
            if (type === 'receivable') collectionName = 'receivables';
            else if (type === 'zakatPayment') collectionName = 'zakatPayments';
            else collectionName = `${type}Assets`;

            await deleteDoc(doc(db, `users/${user!.uid}/${collectionName}`, id));
            toast.success("Kayıt silindi.");
        } catch (e: any) {
            toast.error("Hata: " + e.message);
        }
    };

    const openEditModal = (asset: any, type: string) => {
        setEditingAsset({ ...asset, type });
        setEditAmount(asset.amount.toString());
        setEditDate(asset.date || asset.acquisitionDate);
        setEditDesc(asset.description || "");
        if (type === 'currency') setEditCurrency(asset.currency);
        if (type === 'metal') setEditMetalType(asset.metalType);
        if (type === 'receivable') setEditPerson(asset.person);
        if (type === 'zakatPayment') setEditPerson(asset.recipient);
    };

    const calculateTotals = () => {
        let eligible = 0;
        let gross = 0;
        const tryRate = rates.TRY || 34.0; // Updated fallback for 2026

        tlAssets.forEach(a => {
            gross += a.amount;
            if (isOneLunarYearPassed(a.acquisitionDate)) eligible += a.amount;
        });

        currencyAssets.forEach(a => {
            const rateInTry = (1 / (rates[a.currency] || 1)) * tryRate;
            const value = a.amount * rateInTry;
            gross += value;
            if (isOneLunarYearPassed(a.acquisitionDate)) eligible += value;
        });

        metalAssets.forEach(a => {
            const value = a.amount * (metalPrices[a.metalType] || 0);
            gross += value;
            if (isOneLunarYearPassed(a.acquisitionDate)) eligible += value;
        });

        receivables.forEach(a => {
            gross += a.amount;
            eligible += a.amount; // Receivables are generally part of existing wealth, so they are always included.
        });

        return { eligible, gross };
    };

    const { eligible: totalEligible, gross: totalGross } = calculateTotals();
    const currentGoldPrice = metalPrices.gram_gold || 7290;
    const nisabValue = currentGoldPrice * NISAB_GOLD_GRAMS;
    const zakatAmount = (ignoreNisab || totalEligible >= nisabValue) ? totalEligible * 0.025 : 0;

    const handleSaveSnapshot = async () => {
        if (!user) return;
        const year = new Date().getFullYear();
        try {
            await addDoc(collection(db, `users/${user.uid}/zakatSnapshots`), {
                year,
                saveDate: new Date().toISOString(),
                totalEligible,
                zakatAmount,
                nisabValue,
                rates,
                metalPrices,
                details: {
                    tlAssets,
                    currencyAssets,
                    metalAssets,
                    receivables
                },
                ignoreNisab
            });
            toast.success(`${year} yılı zekat hesaplaması kaydedildi.`);
        } catch (e: any) {
            toast.error("Hata: " + e.message);
        }
    };

    const updateTempItem = (listName: string, index: number, field: string, value: any) => {
        setTempSnapshotDetails((prev: any) => {
            const newList = [...prev[listName]];
            newList[index] = { ...newList[index], [field]: value };
            return { ...prev, [listName]: newList };
        });
    };

    const removeTempItem = (listName: string, index: number) => {
        setTempSnapshotDetails((prev: any) => {
            const newList = prev[listName].filter((_: any, i: number) => i !== index);
            return { ...prev, [listName]: newList };
        });
    };

    const handleSaveSnapshotUpdate = async () => {
        if (!selectedSnapshot || !user) return;
        const { eligible } = calculateSnapshotTotals(tempSnapshotDetails, selectedSnapshot.rates, selectedSnapshot.metalPrices);
        const zakat = (selectedSnapshot.ignoreNisab || eligible >= selectedSnapshot.nisabValue) ? eligible * 0.025 : 0;

        try {
            await updateDoc(doc(db, `users/${user.uid}/zakatSnapshots`, selectedSnapshot.id), {
                details: tempSnapshotDetails,
                totalEligible: eligible,
                zakatAmount: zakat
            });
            setIsEditingSnapshot(false);
            setIsSnapshotModalOpen(false);
            toast.success("Kayıt başarıyla güncellendi.");
        } catch (e: any) {
            toast.error("Hata: " + e.message);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
            <header className="sticky top-0 z-30 w-full border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
                <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                            <span className="text-white font-bold font-outfit text-xl">43</span>
                        </div>
                        <h1 className="text-xl font-bold font-outfit hidden sm:block">43Zekat</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                            {user?.photoURL ? (
                                <img src={user.photoURL} className="w-6 h-6 rounded-full" alt="avatar" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] text-emerald-700 font-bold uppercase">
                                    {user?.displayName?.[0] || user?.email?.[0] || "?"}
                                </div>
                            )}
                            <span className="text-sm font-medium hidden md:inline">{user?.displayName}</span>
                            {user?.email === "meoncu@gmail.com" && (
                                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-800 uppercase">
                                    Admin
                                </span>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                            <Settings className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => signOut(auth)}>
                            <LogOut className="h-5 w-5 text-red-500" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    <Card className="bg-emerald-600 text-white shadow-emerald-500/20 border-none transition-transform hover:scale-[1.02]">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium opacity-90">Toplam Sorumlu Varlık</CardTitle>
                            <Landmark className="h-4 w-4 opacity-80" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalEligible.toLocaleString('tr-TR')} ₺</div>
                            <p className="text-xs opacity-70 mt-1">Nisab: {nisabValue.toLocaleString('tr-TR')} ₺</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200 dark:shadow-none border-zinc-200 dark:border-zinc-800 transition-transform hover:scale-[1.02]">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Hesaplanan Zekat</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">{zakatAmount.toLocaleString('tr-TR')} ₺</div>
                            <p className="text-xs text-zinc-500 mt-1">
                                {totalEligible >= nisabValue ? "Zekat Yükümlülüğü Var" : "Nisab Altında"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-200 dark:shadow-none border-zinc-200 dark:border-zinc-800 transition-transform hover:scale-[1.02]">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Piyasa Bilgisi</CardTitle>
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold">Altın: {metalPrices.gram_gold?.toLocaleString('tr-TR')} ₺</div>
                            <p className="text-xs text-zinc-500 mt-1">Dolar: {((1 / rates.USD) * (rates.TRY || 1)).toFixed(2)} ₺</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="tl" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 mb-8 h-12 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <TabsTrigger value="tl" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">TL</TabsTrigger>
                        <TabsTrigger value="currency" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Döviz</TabsTrigger>
                        <TabsTrigger value="metals" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Altın/Gümüş</TabsTrigger>
                        <TabsTrigger value="receivables" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Alacaklar</TabsTrigger>
                        <TabsTrigger value="zakat" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Zekatlarım</TabsTrigger>
                        <TabsTrigger value="summary" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg transition-all"><Calculator className="w-4 h-4 mr-2" /> Özet</TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg transition-all"><Archive className="w-4 h-4 mr-2" /> Geçmiş</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tl" className="space-y-6">
                        <Card className="border-zinc-200 dark:border-zinc-800 shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-emerald-600" />
                                    TL Varlığı Ekle
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-4 items-end">
                                <div className="space-y-2 col-span-1">
                                    <Label>Miktar (₺)</Label>
                                    <Input
                                        type="text"
                                        placeholder="0"
                                        value={formatAmount(tlAmount)}
                                        onChange={e => setTlAmount(parseAmount(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2 col-span-1">
                                    <Label>Edinim Tarihi</Label>
                                    <Input type="date" value={tlDate} onChange={e => setTlDate(e.target.value)} />
                                </div>
                                <div className="space-y-2 col-span-1">
                                    <Label>Açıklama</Label>
                                    <Input placeholder="Birikim hesabı vb." value={tlDesc} onChange={e => setTlDesc(e.target.value)} />
                                </div>
                                <Button onClick={handleAddTl} className="bg-emerald-600 hover:bg-emerald-700">Ekle</Button>
                            </CardContent>
                        </Card>

                        <div className="rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg">
                            <Table>
                                <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
                                    <TableRow>
                                        <TableHead>Miktar</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tlAssets.map((asset) => (
                                        <TableRow key={asset.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <TableCell className="font-bold">{asset.amount.toLocaleString('tr-TR')} ₺</TableCell>
                                            <TableCell>{new Date(asset.acquisitionDate).toLocaleDateString('tr-TR')}</TableCell>
                                            <TableCell>{asset.description}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isOneLunarYearPassed(asset.acquisitionDate)
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                                                    }`}>
                                                    {isOneLunarYearPassed(asset.acquisitionDate) ? "Zekata Dahil" : "Beklemede"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="flex gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEditModal(asset, 'tl')} className="text-zinc-400 hover:text-emerald-500 transition-colors">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete('tl', asset.id)} className="text-zinc-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {tlAssets.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-zinc-500">Henüz TL varlığı eklenmemiş.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="currency">
                        <CurrencyTab user={user} rates={rates} handleDelete={handleDelete} openEditModal={openEditModal} isOneLunarYearPassed={isOneLunarYearPassed} currencyAssets={currencyAssets} />
                    </TabsContent>

                    <TabsContent value="metals">
                        <MetalsTab user={user} metalPrices={metalPrices} handleDelete={handleDelete} openEditModal={openEditModal} isOneLunarYearPassed={isOneLunarYearPassed} metalAssets={metalAssets} />
                    </TabsContent>

                    <TabsContent value="receivables">
                        <ReceivableTab user={user} receivables={receivables} handleDelete={handleDelete} openEditModal={openEditModal} isOneLunarYearPassed={isOneLunarYearPassed} />
                    </TabsContent>

                    <TabsContent value="zakat">
                        <ZakatPaymentTab user={user} zakatPayments={zakatPayments} handleDelete={handleDelete} openEditModal={openEditModal} />
                    </TabsContent>

                    <TabsContent value="summary">
                        <SummaryTab
                            totalEligible={totalEligible}
                            totalGross={totalGross}
                            nisabValue={nisabValue}
                            zakatAmount={zakatAmount}
                            tlAssets={tlAssets}
                            currencyAssets={currencyAssets}
                            metalAssets={metalAssets}
                            receivables={receivables}
                            rates={rates}
                            metalPrices={metalPrices}
                            isOneLunarYearPassed={isOneLunarYearPassed}
                            ignoreNisab={ignoreNisab}
                            onSave={handleSaveSnapshot}
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        <HistoryTab
                            snapshots={snapshots}
                            onView={(s: any) => {
                                setSelectedSnapshot(s);
                                setIsSnapshotModalOpen(true);
                            }}
                            onDelete={(id: string) => handleDelete('zakatSnapshots', id)}
                        />
                    </TabsContent>
                </Tabs>

                {/* Edit Modal */}
                <Dialog open={!!editingAsset} onOpenChange={() => setEditingAsset(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Varlık Güncelle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Miktar</Label>
                                <Input
                                    type="text"
                                    value={formatAmount(editAmount)}
                                    onChange={e => setEditAmount(parseAmount(e.target.value))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Tarih</Label>
                                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                            </div>
                            {editingAsset?.type === 'receivable' && (
                                <div className="grid gap-2">
                                    <Label>Borç Verilen Kişi</Label>
                                    <Input value={editPerson} onChange={e => setEditPerson(e.target.value)} />
                                </div>
                            )}
                            {editingAsset?.type === 'currency' && (
                                <div className="grid gap-2">
                                    <Label>Döviz</Label>
                                    <Select value={editCurrency} onValueChange={setEditCurrency}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="EUR">EUR</SelectItem>
                                            <SelectItem value="GBP">GBP</SelectItem>
                                            <SelectItem value="SAR">SAR (Riyal)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {editingAsset?.type === 'metal' && (
                                <div className="grid gap-2">
                                    <Label>Maden Türü</Label>
                                    <Select value={editMetalType} onValueChange={setEditMetalType}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gram_gold">Gram Altın</SelectItem>
                                            <SelectItem value="ounce_gold">Ons Altın</SelectItem>
                                            <SelectItem value="silver">Gümüş (Gram)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label>Açıklama</Label>
                                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingAsset(null)} disabled={isUpdating}>İptal</Button>
                            <Button onClick={handleUpdate} className="bg-emerald-600 hover:bg-emerald-700" disabled={isUpdating}>
                                {isUpdating ? "Güncelleniyor..." : "Kaydet"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Settings Modal */}
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" /> Hesap Ayarları
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-6 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <Label className="text-base font-bold">Nisab Limitini Devre Dışı Bırak</Label>
                                    <p className="text-xs text-zinc-500">Varlıklarınız 85g altın değerinden düşük olsa bile zekat hesaplamasını aktif eder.</p>
                                </div>
                                <div
                                    onClick={async () => {
                                        const newVal = !ignoreNisab;
                                        setIgnoreNisab(newVal);
                                        if (user) {
                                            await updateDoc(doc(db, `users/${user.uid}/settings`, 'account'), {
                                                ignoreNisab: newVal
                                            }).catch(async (e) => {
                                                if (e.code === 'not-found') {
                                                    await addDoc(collection(db, `users/${user.uid}/settings`), {
                                                        ignoreNisab: newVal
                                                    });
                                                } else {
                                                    // use setDoc if update fails due to document not existing
                                                    const { setDoc } = await import("firebase/firestore");
                                                    await setDoc(doc(db, `users/${user.uid}/settings`, 'account'), { ignoreNisab: newVal });
                                                }
                                            });
                                        }
                                    }}
                                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 flex items-center ${ignoreNisab ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform duration-200 ${ignoreNisab ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3 text-amber-800 dark:text-amber-400 text-sm">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <p>Nisab limiti varsayılan olarak aktiftir ve zekat yükümlülüğünün alt sınırını belirler. Bu ayarı sadece özel tercihleriniz için kullanınız.</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button className="w-full bg-zinc-900" onClick={() => setIsSettingsOpen(false)}>Kapat</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Snapshot Detail Modal */}
                <Dialog open={isSnapshotModalOpen} onOpenChange={(open) => {
                    setIsSnapshotModalOpen(open);
                    if (!open) setIsEditingSnapshot(false);
                }}>
                    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                                <Archive className="h-6 w-6 text-emerald-600" /> {selectedSnapshot?.year} Yılı Zekat Kaydı
                            </DialogTitle>
                        </DialogHeader>
                        {selectedSnapshot && (
                            <div className="py-6 space-y-8">
                                {/* Historical Price Info Alert - Enhanced for better user understanding */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-3 text-blue-800 dark:text-blue-300">
                                        <div className="bg-blue-600 p-2 rounded-lg">
                                            <ShieldCheck className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm uppercase tracking-wider">Tarihsel Kur Koruması Aktif</h4>
                                            <p className="text-[12px] opacity-80">Hesaplamalarınızın doğruluğu için zaman donduruldu.</p>
                                        </div>
                                    </div>

                                    <div className="pl-12 text-[12px] text-blue-700 dark:text-blue-400 space-y-2 leading-relaxed">
                                        <p>
                                            Bu dosyayı güncellerken, bugün kü fiyatlar yerine kaydın oluşturulduğu
                                            <b className="mx-1">{new Date(selectedSnapshot.saveDate).toLocaleDateString('tr-TR')}</b>
                                            tarihindeki fiyatlar kullanılır.
                                        </p>
                                        <div className="bg-blue-600/10 p-3 rounded-xl border border-blue-600/10 flex justify-between items-center">
                                            <span>O Günkü Altın Fiyatı:</span>
                                            <span className="font-bold underline">{selectedSnapshot.metalPrices?.gram_gold?.toLocaleString() || '0'} ₺ / gr</span>
                                        </div>
                                        <p className="italic opacity-60 text-[10px]">
                                            * Miktarları değiştirdiğinizde, sistem otomatik olarak "o günkü" değer üzerinden toplamınızı yeniden hesaplar.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-zinc-900 text-white p-4 rounded-2xl">
                                        <span className="text-[10px] uppercase opacity-50 block">Zekata Tabi Toplam</span>
                                        <span className="text-xl font-bold">
                                            {isEditingSnapshot
                                                ? calculateSnapshotTotals(tempSnapshotDetails, selectedSnapshot.rates, selectedSnapshot.metalPrices).eligible.toLocaleString('tr-TR')
                                                : selectedSnapshot.totalEligible.toLocaleString('tr-TR')} ₺
                                        </span>
                                    </div>
                                    <div className="bg-emerald-600 text-white p-4 rounded-2xl">
                                        <span className="text-[10px] uppercase opacity-80 block">Ödenecek Zekat (%2.5)</span>
                                        <span className="text-xl font-bold">
                                            {isEditingSnapshot
                                                ? (calculateSnapshotTotals(tempSnapshotDetails, selectedSnapshot.rates, selectedSnapshot.metalPrices).eligible * 0.025).toLocaleString('tr-TR', { maximumFractionDigits: 0 })
                                                : selectedSnapshot.zakatAmount.toLocaleString('tr-TR')} ₺
                                        </span>
                                    </div>
                                    <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl">
                                        <span className="text-[10px] uppercase opacity-50 block text-zinc-500">Durum</span>
                                        <span className="text-lg font-bold flex items-center gap-2">
                                            {isEditingSnapshot ? <span className="text-amber-600 animate-pulse">Düzenleniyor...</span> : "Kaydedildi"}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold flex items-center gap-2"><FileText className="h-4 w-4" /> Varlık Detayları</h3>
                                        {!isEditingSnapshot && (
                                            <Button variant="outline" size="sm" onClick={() => {
                                                setIsEditingSnapshot(true);
                                                setTempSnapshotDetails(JSON.parse(JSON.stringify(selectedSnapshot.details)));
                                            }} className="h-8 rounded-lg gap-2 text-xs">
                                                <Pencil className="h-3 w-3" /> Verileri Düzenle
                                            </Button>
                                        )}
                                    </div>
                                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
                                                <TableRow>
                                                    <TableHead>Tür</TableHead>
                                                    <TableHead>Açıklama / Kişi</TableHead>
                                                    <TableHead className="text-right">Miktar</TableHead>
                                                    {isEditingSnapshot && <TableHead className="w-[50px]"></TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(isEditingSnapshot ? tempSnapshotDetails : selectedSnapshot.details).tlAssets.map((a: any, i: number) => (
                                                    <TableRow key={`tl-${i}`}>
                                                        <TableCell className="text-[11px] font-bold">TL</TableCell>
                                                        <TableCell>{isEditingSnapshot ? <Input className="h-7 text-xs" value={a.description} onChange={e => updateTempItem('tlAssets', i, 'description', e.target.value)} /> : a.description}</TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            {isEditingSnapshot ? <Input className="h-7 text-xs text-right" type="number" value={a.amount} onChange={e => updateTempItem('tlAssets', i, 'amount', parseFloat(e.target.value))} /> : <>{a.amount.toLocaleString()} ₺</>}
                                                        </TableCell>
                                                        {isEditingSnapshot && <TableCell><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeTempItem('tlAssets', i)}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                                                    </TableRow>
                                                ))}
                                                {(isEditingSnapshot ? tempSnapshotDetails : selectedSnapshot.details).currencyAssets.map((a: any, i: number) => (
                                                    <TableRow key={`curr-${i}`}>
                                                        <TableCell className="text-[11px] font-bold">DÖVİZ ({a.currency})</TableCell>
                                                        <TableCell>{isEditingSnapshot ? <Input className="h-7 text-xs" value={a.description} onChange={e => updateTempItem('currencyAssets', i, 'description', e.target.value)} /> : a.description}</TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            {isEditingSnapshot ? <Input className="h-7 text-xs text-right" type="number" value={a.amount} onChange={e => updateTempItem('currencyAssets', i, 'amount', parseFloat(e.target.value))} /> : <>{a.amount.toLocaleString()} {a.currency}</>}
                                                        </TableCell>
                                                        {isEditingSnapshot && <TableCell><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeTempItem('currencyAssets', i)}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                                                    </TableRow>
                                                ))}
                                                {(isEditingSnapshot ? tempSnapshotDetails : selectedSnapshot.details).metalAssets.map((a: any, i: number) => (
                                                    <TableRow key={`metal-${i}`}>
                                                        <TableCell className="text-[11px] font-bold">ALTIN</TableCell>
                                                        <TableCell>{isEditingSnapshot ? <Input className="h-7 text-xs" value={a.description} onChange={e => updateTempItem('metalAssets', i, 'description', e.target.value)} /> : a.description}</TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            {isEditingSnapshot ? <Input className="h-7 text-xs text-right" type="number" value={a.amount} onChange={e => updateTempItem('metalAssets', i, 'amount', parseFloat(e.target.value))} /> : <>{a.amount.toFixed(2)} gr</>}
                                                        </TableCell>
                                                        {isEditingSnapshot && <TableCell><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeTempItem('metalAssets', i)}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                                                    </TableRow>
                                                ))}
                                                {(isEditingSnapshot ? tempSnapshotDetails : selectedSnapshot.details).receivables.map((a: any, i: number) => (
                                                    <TableRow key={`rec-${i}`}>
                                                        <TableCell className="text-[11px] font-bold">ALACAK</TableCell>
                                                        <TableCell>{isEditingSnapshot ? <Input className="h-7 text-xs" value={a.person} onChange={e => updateTempItem('receivables', i, 'person', e.target.value)} /> : a.person}</TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            {isEditingSnapshot ? <Input className="h-7 text-xs text-right" type="number" value={a.amount} onChange={e => updateTempItem('receivables', i, 'amount', parseFloat(e.target.value))} /> : <>{a.amount.toLocaleString()} ₺</>}
                                                        </TableCell>
                                                        {isEditingSnapshot && <TableCell><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeTempItem('receivables', i)}><Trash2 className="h-3 w-3" /></Button></TableCell>}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {isEditingSnapshot && (
                                        <div className="pt-4 flex gap-3">
                                            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={handleSaveSnapshotUpdate}>
                                                Değişiklikleri Dosyaya Kaydet
                                            </Button>
                                            <Button variant="outline" onClick={() => setIsEditingSnapshot(false)}>
                                                İptal
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            {!isEditingSnapshot && <Button className="w-full bg-zinc-900" onClick={() => setIsSnapshotModalOpen(false)}>Kapat</Button>}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}

// Sub-components will be defined here or in separate files.
// For brevity in this big file, I'll include them as simplified components.

function CurrencyTab({ user, rates, handleDelete, openEditModal, isOneLunarYearPassed, currencyAssets }: any) {
    const today = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(today);
    const [currency, setCurrency] = useState("USD");
    const [desc, setDesc] = useState("");

    const handleAdd = async () => {
        if (!amount) {
            toast.error("Lütfen miktar giriniz.");
            return;
        }
        if (!date) {
            toast.error("Lütfen tarih seçiniz.");
            return;
        }
        try {
            await addDoc(collection(db, `users/${user.uid}/currencyAssets`), {
                amount: parseFloat(amount),
                acquisitionDate: date,
                currency,
                description: desc,
            });
            setAmount(""); setDate(""); setDesc("");
            toast.success("Döviz varlığı eklendi.");
        } catch (e: any) { toast.error("Hata: " + e.message); }
    };

    const tryRate = rates.TRY || 1;

    return (
        <div className="space-y-6">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-lg">
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-600" /> Döviz Varlığı Ekle</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-5 items-end">
                    <div className="space-y-2"><Label>Döviz</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="SAR">SAR (Riyal)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Miktar</Label>
                        <Input
                            type="text"
                            placeholder="0"
                            value={formatAmount(amount)}
                            onChange={e => setAmount(parseAmount(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2"><Label>Edinim Tarihi</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Açıklama</Label><Input value={desc} onChange={e => setDesc(e.target.value)} /></div>
                    <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700">Ekle</Button>
                </CardContent>
            </Card>
            <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden shadow-lg">
                <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50"><TableRow><TableHead>Varlık</TableHead><TableHead>Miktar</TableHead><TableHead>TRY Değeri</TableHead><TableHead>Durum</TableHead><TableHead className="w-[80px]"></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {currencyAssets.map((a: any) => {
                            const rateInTry = (1 / rates[a.currency]) * tryRate;
                            const valueInTry = a.amount * rateInTry;
                            return (
                                <TableRow key={a.id}>
                                    <TableCell className="font-bold">{a.currency}</TableCell>
                                    <TableCell>{a.amount.toLocaleString()} {a.currency}</TableCell>
                                    <TableCell className="text-emerald-600 font-medium">{valueInTry.toLocaleString('tr-TR')} ₺</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${isOneLunarYearPassed(a.acquisitionDate) ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                                            {isOneLunarYearPassed(a.acquisitionDate) ? "Zekata Dahil" : "Beklemede"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(a, 'currency')} className="text-zinc-400 hover:text-emerald-500"><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete('currency', a.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div >
    );
}

function MetalsTab({ user, metalPrices, handleDelete, openEditModal, isOneLunarYearPassed, metalAssets }: any) {
    const today = new Date().toISOString().split('T')[0];
    const [counts, setCounts] = useState<any>({
        k14: "", k18: "", k22: "", k24: "",
        ceyrek: "", yarim: "", tam: "",
        ata: "", resat: "", hamit: "",
        gremse: "", k2_5: "", k5: ""
    });
    const [date, setDate] = useState(today);
    const [desc, setDesc] = useState("");

    const updateCount = (key: string, val: string) => {
        setCounts((prev: any) => ({ ...prev, [key]: val }));
    };

    const calculateTotal24K = () => {
        let total = 0;
        // Grams by carat
        total += (parseFloat(counts.k14) || 0) * 0.585;
        total += (parseFloat(counts.k18) || 0) * 0.750;
        total += (parseFloat(counts.k22) || 0) * 0.916;
        total += (parseFloat(counts.k24) || 0) * 1.0;

        // Coins (Weights are standard, purity is 22K = 0.916)
        const purity22 = 0.916;
        total += (parseFloat(counts.ceyrek) || 0) * 1.75 * purity22;
        total += (parseFloat(counts.yarim) || 0) * 3.50 * purity22;
        total += (parseFloat(counts.tam) || 0) * 7.00 * purity22;
        total += (parseFloat(counts.ata) || 0) * 7.22 * purity22;
        total += (parseFloat(counts.resat) || 0) * 7.22 * purity22;
        total += (parseFloat(counts.hamit) || 0) * 7.22 * purity22;
        total += (parseFloat(counts.gremse) || 0) * 17.50 * purity22;
        total += (parseFloat(counts.k2_5) || 0) * 18.05 * purity22; // 2.5 Ata
        total += (parseFloat(counts.k5) || 0) * 36.10 * purity22;  // 5'li Ata

        return total;
    };

    const handleAdd = async () => {
        const totalGram = calculateTotal24K();
        if (totalGram <= 0 || !date) {
            toast.error("Lütfen miktar ve tarih giriniz.");
            return;
        }
        try {
            await addDoc(collection(db, `users/${user.uid}/metalAssets`), {
                amount: totalGram,
                acquisitionDate: date,
                metalType: "gram_gold",
                description: desc || "Gelişmiş Altın Hesabı",
            });
            // Reset counts
            const reset: any = {};
            Object.keys(counts).forEach(k => reset[k] = "");
            setCounts(reset);
            setDate(""); setDesc("");
            toast.success("Altın varlığı eklendi.");
        } catch (e: any) { toast.error("Hata: " + e.message); }
    };

    const total24K = calculateTotal24K();

    return (
        <div className="space-y-6">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b">
                    <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Coins className="h-5 w-5" /> Gelişmiş Altın Hesaplama
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                    {/* Ayar Bazlı Gram */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span> Gram Altın (Ayar)
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { k: "k14", l: "14 Ayar (gr)" },
                                { k: "k18", l: "18 Ayar (gr)" },
                                { k: "k22", l: "22 Ayar (gr)" },
                                { k: "k24", l: "24 Ayar (gr)" }
                            ].map(item => (
                                <div key={item.k} className="space-y-1.5">
                                    <Label className="text-[11px] font-bold">{item.l}</Label>
                                    <Input type="text" placeholder="0" value={formatAmount(counts[item.k])} onChange={e => updateCount(item.k, parseAmount(e.target.value))} className="h-10 text-right font-mono" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ziynet / Sikke */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span> Ziynet / Sikke (Adet)
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                            {[
                                { k: "ceyrek", l: "Çeyrek (1.75g)" },
                                { k: "yarim", l: "Yarım (3.5g)" },
                                { k: "tam", l: "Tam (7g)" },
                                { k: "ata", l: "Ata (7.22g)" },
                                { k: "resat", l: "Reşat (7.22g)" },
                                { k: "hamit", l: "Hamit (7.22g)" },
                                { k: "gremse", l: "Gremse (17.5g)" },
                                { k: "k2_5", l: "2.5'luk (18.05g)" },
                                { k: "k5", l: "5'li (36.1g)" }
                            ].map(item => (
                                <div key={item.k} className="space-y-1.5 ">
                                    <Label className="text-[11px] font-bold">{item.l}</Label>
                                    <Input type="text" placeholder="0" value={formatAmount(counts[item.k])} onChange={e => updateCount(item.k, parseAmount(e.target.value))} className="h-10 text-right font-mono" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t grid gap-4 sm:grid-cols-3 items-end">
                        <div className="space-y-2">
                            <Label className="font-bold">Edinim Tarihi</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10" />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">Açıklama</Label>
                            <Input placeholder="Altın birikimi vb." value={desc} onChange={e => setDesc(e.target.value)} className="h-10" />
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Toplam 24K Gram</span>
                            <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{total24K.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} gr</span>
                        </div>
                    </div>

                    <Button onClick={handleAdd} className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg h-12 rounded-xl shadow-lg shadow-emerald-600/20 group">
                        <Plus className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform" />
                        Hesapla ve Varlık Olarak Ekle
                    </Button>
                </CardContent>
            </Card>

            <div className="rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg">
                <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
                        <TableRow>
                            <TableHead>Maden</TableHead>
                            <TableHead>Miktar</TableHead>
                            <TableHead>TRY Değeri</TableHead>
                            <TableHead>Açıklama</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {metalAssets.map((a: any) => {
                            const valueInTry = a.amount * (metalPrices[a.metalType] || 0);
                            return (
                                <TableRow key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <TableCell className="font-bold uppercase">{a.metalType.replace('_', ' ')}</TableCell>
                                    <TableCell>{a.amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} Gram (24K)</TableCell>
                                    <TableCell className="text-emerald-600 font-bold">{valueInTry.toLocaleString('tr-TR')} ₺</TableCell>
                                    <TableCell className="text-zinc-600 dark:text-zinc-400">{a.description || "-"}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${isOneLunarYearPassed(a.acquisitionDate) ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-zinc-100 text-zinc-600 border border-zinc-200"}`}>
                                            {isOneLunarYearPassed(a.acquisitionDate) ? "Zekata Dahil" : "Beklemede"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(a, 'metal')} className="text-zinc-400 hover:text-emerald-500"><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete('metal', a.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {metalAssets.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-zinc-500">Henüz altın/gümüş varlığı eklenmemiş.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function SummaryTab({ totalEligible, totalGross, nisabValue, zakatAmount, tlAssets, currencyAssets, metalAssets, receivables, rates, metalPrices, isOneLunarYearPassed, ignoreNisab, onSave }: any) {
    const tryRate = rates.TRY || 34.0;
    const suggestion = new Date();
    suggestion.setDate(suggestion.getDate() + 7);

    const isBelowNisab = totalEligible < nisabValue && totalEligible > 0;
    const hasPendingAssets = totalGross > totalEligible;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-zinc-900 text-white border-zinc-800 shadow-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Landmark className="w-32 h-32" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-emerald-400 flex items-center gap-2">
                            <Calculator className="h-6 w-6" />
                            Hesap Özeti
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 relative z-10">
                        <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                            <span className="opacity-70">Toplam Varlık Değeriniz:</span>
                            <div className="text-right">
                                <span className="text-xl font-bold block">{totalGross.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                <span className="text-[10px] opacity-50">Tüm eklediğiniz kalemler</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                            <span className="opacity-70">Zekata Tabi Toplam:</span>
                            <div className="text-right">
                                <span className="text-2xl font-black text-emerald-400 block">{totalEligible.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                <span className="text-[10px] opacity-50">Üzerinden 1 yıl geçen varlıklar</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
                            <span className="opacity-70">Nisab Eşiği (85g Altın):</span>
                            <div className="text-right">
                                <span className={`text-lg transition-opacity ${ignoreNisab ? 'opacity-30 line-through' : 'font-medium'}`}>
                                    {nisabValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                                {ignoreNisab && <span className="text-[9px] block text-amber-400 italic">Hesaplamada yoksayılıyor</span>}
                            </div>
                        </div>

                        {zakatAmount > 0 ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-emerald-600/20 p-5 rounded-2xl border border-emerald-500/30 shadow-inner">
                                    <span className="font-bold text-emerald-400">Ödenecek Zekat (%2.5):</span>
                                    <span className="text-4xl font-black text-emerald-400">{zakatAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                </div>
                                <Button onClick={onSave} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl text-lg font-bold shadow-lg shadow-emerald-500/20 border border-emerald-500/50">
                                    <Download className="mr-2 h-5 w-5" /> Bu Hesaplamayı Kaydet ({new Date().getFullYear()})
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/30">
                                <p className="text-amber-400 font-bold text-center text-sm">
                                    {totalGross === 0 ? "Varlık eklediğinizde hesaplama başlayacaktır." :
                                        totalEligible === 0 ? "Zekat için varlıkların üzerinden 1 yıl geçmesi gerekir. Tüm varlıklarınız 'Beklemede' görünüyor." :
                                            "Toplam zekata tabi varlığınız Nisab eşiğinin altında kalmaktadır."}
                                </p>
                            </div>
                        )}

                        <div className="pt-2">
                            <p className="text-zinc-400 text-sm italic flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" />
                                Önerilen ödeme tarihi: {suggestion.toLocaleDateString('tr-TR')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Varlık Analizi</CardTitle>
                            <div className="text-right">
                                <span className="text-[10px] text-zinc-500 block uppercase">Toplam Varlık</span>
                                <span className="font-bold text-zinc-700 dark:text-zinc-300">{totalGross.toLocaleString('tr-TR')} ₺</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {hasPendingAssets && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-400 flex gap-2">
                                <TrendingUp className="h-4 w-4 shrink-0" />
                                <span>Henüz yılı dolmamış <b>{(totalGross - totalEligible).toLocaleString('tr-TR')} ₺</b> değerinde varlığınız var.</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm"><span>TL Varlıkları</span><span>{tlAssets.filter((a: any) => isOneLunarYearPassed(a.acquisitionDate)).reduce((acc: any, cur: any) => acc + cur.amount, 0).toLocaleString()} ₺</span></div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-400 h-full transition-all duration-1000" style={{ width: `${(totalEligible > 0 ? (tlAssets.filter((a: any) => isOneLunarYearPassed(a.acquisitionDate)).reduce((acc: any, cur: any) => acc + cur.amount, 0) / totalEligible * 100) : 0)}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm"><span>Döviz Varlıkları</span><span>{currencyAssets.filter((a: any) => isOneLunarYearPassed(a.acquisitionDate)).reduce((acc: any, a: any) => acc + (a.amount * (1 / (rates[a.currency] || 1)) * (rates.TRY || 34)), 0).toLocaleString()} ₺</span></div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-400 h-full transition-all duration-1000" style={{ width: `${(totalEligible > 0 ? (currencyAssets.filter((a: any) => isOneLunarYearPassed(a.acquisitionDate)).reduce((acc: any, a: any) => acc + (a.amount * (1 / (rates[a.currency] || 1)) * (rates.TRY || 34)), 0) / totalEligible * 100) : 0)}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm"><span>Altın & Maden</span><span>{metalAssets.filter((a: any) => isOneLunarYearPassed(a.acquisitionDate)).reduce((acc: any, a: any) => acc + (a.amount * (metalPrices[a.metalType] || 0)), 0).toLocaleString()} ₺</span></div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-amber-400 h-full transition-all duration-1000" style={{ width: `${(totalEligible > 0 ? (metalAssets.filter((a: any) => isOneLunarYearPassed(a.acquisitionDate)).reduce((acc: any, a: any) => acc + (a.amount * (metalPrices[a.metalType] || 0)), 0) / totalEligible * 100) : 0)}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm"><span>Verilen Borçlar</span><span>{receivables.reduce((acc: any, cur: any) => acc + cur.amount, 0).toLocaleString()} ₺</span></div>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-purple-400 h-full transition-all duration-1000" style={{ width: `${(totalEligible > 0 ? (receivables.reduce((acc: any, cur: any) => acc + cur.amount, 0) / totalEligible * 100) : 0)}%` }}></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-400 mb-4">Önemli Notlar</h3>
                <ul className="space-y-3 text-emerald-900/80 dark:text-emerald-300/80 text-sm">
                    <li className="flex gap-2 items-start"><span className="text-emerald-500 font-bold">•</span> Zekat, üzerinden 1 hicri yıl (354 gün) geçmiş nisab miktarı üzerindeki birikimlere verilir.</li>
                    <li className="flex gap-2 items-start"><span className="text-emerald-500 font-bold">•</span> Nisab miktarı 85 gram altın veya bunun değerindeki nakit paradır.</li>
                    <li className="flex gap-2 items-start"><span className="text-emerald-500 font-bold">•</span> Borçlar, asli ihtiyaçlar ve ticaret dışı gayrimenkuller zekata dahil edilmez.</li>
                </ul>
            </Card>
        </div>
    );
}

function ReceivableTab({ user, receivables, handleDelete, openEditModal, isOneLunarYearPassed }: any) {
    const today = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(today);
    const [person, setPerson] = useState("");
    const [desc, setDesc] = useState("");

    const handleAdd = async () => {
        if (!amount || !person) {
            toast.error("Lütfen kişi ve miktar bilgilerini doldurunuz.");
            return;
        }
        if (!date) {
            toast.error("Lütfen tarih seçiniz.");
            return;
        }
        try {
            const cleanAmount = amount.replace(',', '.');
            await addDoc(collection(db, `users/${user.uid}/receivables`), {
                amount: parseFloat(cleanAmount),
                date: date,
                person: person,
                description: desc,
            });
            setAmount(""); setDate(""); setPerson(""); setDesc("");
            toast.success("Alacak kaydı eklendi.");
        } catch (e: any) { toast.error("Hata: " + e.message); }
    };

    return (
        <div className="space-y-6">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-lg">
                <CardHeader><CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-emerald-600" /> Verilen Borç Ekle (TL)</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-5 items-end">
                    <div className="space-y-2 col-span-1">
                        <Label>Borç Verilen Kişi</Label>
                        <Input placeholder="İsim Soyisim" value={person} onChange={e => setPerson(e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1">
                        <Label>Miktar (₺)</Label>
                        <Input
                            type="text"
                            placeholder="0"
                            value={formatAmount(amount)}
                            onChange={e => setAmount(parseAmount(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2 col-span-1">
                        <Label>Veriliş Tarihi</Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1">
                        <Label>Açıklama</Label>
                        <Input placeholder="Borç detayı..." value={desc} onChange={e => setDesc(e.target.value)} />
                    </div>
                    <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700">Ekle</Button>
                </CardContent>
            </Card>

            <div className="rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg">
                <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
                        <TableRow>
                            <TableHead>Kişi</TableHead>
                            <TableHead>Miktar</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Açıklama</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {receivables.map((asset: any) => (
                            <TableRow key={asset.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <TableCell className="font-bold">{asset.person}</TableCell>
                                <TableCell className="font-bold">{asset.amount.toLocaleString('tr-TR')} ₺</TableCell>
                                <TableCell>{new Date(asset.date).toLocaleDateString('tr-TR')}</TableCell>
                                <TableCell>{asset.description}</TableCell>
                                <TableCell>
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                                        Zekata Dahil
                                    </span>
                                </TableCell>
                                <TableCell className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEditModal(asset, 'receivable')} className="text-zinc-400 hover:text-emerald-500 transition-colors">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete('receivable', asset.id)} className="text-zinc-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {receivables.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">Henüz alacak kaydı eklenmemiş.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function HistoryTab({ snapshots, onView, onDelete }: any) {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {snapshots.map((s: any) => (
                    <Card key={s.id} className="border-zinc-200 dark:border-zinc-800 hover:shadow-xl transition-all group overflow-hidden border-l-4 border-l-emerald-500">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3 text-emerald-600" />
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{new Date(s.saveDate).toLocaleDateString('tr-TR')}</span>
                                    </div>
                                    <CardTitle className="text-2xl font-black">{s.year} Yılı Zekat Hesabı</CardTitle>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold uppercase mb-1">Hesaplanan</span>
                                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{s.zakatAmount.toLocaleString('tr-TR')} ₺</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* İcmal Bilgileri Grid */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Zekata Dahil</span>
                                    <p className="font-bold text-zinc-700 dark:text-zinc-300">{s.totalEligible.toLocaleString('tr-TR')} ₺</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Nisab Limit</span>
                                    <p className="font-bold text-zinc-700 dark:text-zinc-300">{s.nisabValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</p>
                                </div>
                            </div>

                            {/* Varlık Kırılımı İcmali */}
                            <div className="flex flex-wrap gap-2 pt-2">
                                <span className="px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-[10px] font-medium flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {s.details?.tlAssets?.length || 0} TL
                                </span>
                                <span className="px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-[10px] font-medium flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {s.details?.metalAssets?.length || 0} Maden
                                </span>
                                <span className="px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-[10px] font-medium flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {s.details?.currencyAssets?.length || 0} Döviz
                                </span>
                                <span className="px-2 py-1 bg-white dark:bg-zinc-900 border rounded-lg text-[10px] font-medium flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> {s.details?.receivables?.length || 0} Alacak
                                </span>
                            </div>

                            <div className="flex gap-2 pt-4 border-t dark:border-zinc-800">
                                <Button variant="secondary" className="flex-1 gap-2 rounded-xl font-bold transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700" onClick={() => onView(s)}>
                                    <Eye className="h-4 w-4" /> Tüm Detayları Gör
                                </Button>
                                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl" onClick={() => onDelete(s.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {snapshots.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl border-zinc-200 dark:border-zinc-800">
                        <Archive className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-zinc-500">Henüz kaydedilmiş bir hesaplama yok.</h3>
                        <p className="text-sm text-zinc-400">Zekat hesaplama sonucunuzu Özet sekmesinden kaydedebilirsiniz.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ZakatPaymentTab({ user, zakatPayments, handleDelete, openEditModal }: any) {
    const today = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(today);
    const [recipient, setRecipient] = useState("");
    const [desc, setDesc] = useState("");

    const handleAdd = async () => {
        if (!amount || !recipient) {
            toast.error("Lütfen alıcı ve miktar bilgilerini doldurunuz.");
            return;
        }
        if (!date) {
            toast.error("Lütfen tarih seçiniz.");
            return;
        }
        try {
            const cleanAmount = amount.replace(',', '.');
            await addDoc(collection(db, `users/${user.uid}/zakatPayments`), {
                amount: parseFloat(cleanAmount),
                date: date,
                recipient: recipient,
                description: desc,
            });
            setAmount(""); setDate(""); setRecipient(""); setDesc("");
            toast.success("Zekat kaydı eklendi.");
        } catch (e: any) { toast.error("Hata: " + e.message); }
    };

    // Grouping logic
    const groupedPayments = zakatPayments.reduce((acc: any, pay: any) => {
        const d = new Date(pay.date);
        const year = d.getFullYear();
        const month = d.toLocaleString('tr-TR', { month: 'long' });

        if (!acc[year]) acc[year] = { total: 0, months: {} };
        if (!acc[year].months[month]) acc[year].months[month] = [];

        acc[year].total += pay.amount;
        acc[year].months[month].push(pay);
        return acc;
    }, {});

    const sortedYears = Object.keys(groupedPayments).sort((a, b) => parseInt(b) - parseInt(a));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30 border-b">
                    <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Heart className="h-5 w-5" /> Verilen Zekat Kaydı
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid gap-4 sm:grid-cols-5 items-end">
                        <div className="space-y-2 col-span-1">
                            <Label className="font-bold">Alıcı / Kurum</Label>
                            <Input placeholder="İsim veya Vakıf..." value={recipient} onChange={e => setRecipient(e.target.value)} />
                        </div>
                        <div className="space-y-2 col-span-1">
                            <Label className="font-bold">Miktar (₺)</Label>
                            <Input
                                type="text"
                                placeholder="0"
                                value={formatAmount(amount)}
                                onChange={e => setAmount(parseAmount(e.target.value))}
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2 col-span-1">
                            <Label className="font-bold">Ödeme Tarihi</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2 col-span-1">
                            <Label className="font-bold">Açıklama</Label>
                            <Input placeholder="Ramazan zekatı vb." value={desc} onChange={e => setDesc(e.target.value)} />
                        </div>
                        <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 h-10 shadow-lg shadow-emerald-600/20">
                            Kaydı Ekle
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                {sortedYears.map(year => (
                    <div key={year} className="space-y-4">
                        <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <h3 className="text-xl font-extrabold flex items-center gap-2">
                                <Landmark className="h-5 w-5 text-emerald-600" /> {year} Yılı Toplamı
                            </h3>
                            <span className="text-2xl font-black text-emerald-600">
                                {groupedPayments[year].total.toLocaleString('tr-TR')} ₺
                            </span>
                        </div>

                        <div className="grid gap-4">
                            {Object.keys(groupedPayments[year].months).map(month => (
                                <Card key={month} className="border-emerald-100/30 dark:border-emerald-900/10 shadow-sm overflow-hidden border">
                                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-b font-bold text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div> {month}
                                    </div>
                                    <Table>
                                        <TableBody>
                                            {groupedPayments[year].months[month].map((pay: any) => (
                                                <TableRow key={pay.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    <TableCell className="font-bold w-1/4">{pay.recipient}</TableCell>
                                                    <TableCell className="w-1/4 text-zinc-600 dark:text-zinc-400">{pay.description || "-"}</TableCell>
                                                    <TableCell className="text-zinc-500 text-sm">{new Date(pay.date).toLocaleDateString('tr-TR')}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                                                        {pay.amount.toLocaleString('tr-TR')} ₺
                                                    </TableCell>
                                                    <TableCell className="text-right w-[100px]">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(pay, 'zakatPayment')} className="h-8 w-8 text-zinc-400 hover:text-emerald-500">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete('zakatPayment', pay.id)} className="h-8 w-8 text-zinc-400 hover:text-red-500">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}

                {zakatPayments.length === 0 && (
                    <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Heart className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-400">Henüz zekat kaydı bulunmuyor</h3>
                        <p className="text-zinc-500 text-sm">Verdiğiniz zekatları ekleyerek yıllık takibini yapabilirsiniz.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
