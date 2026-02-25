export interface TLAsset {
    id: string;
    amount: number;
    acquisitionDate: string;
    description: string;
}

export interface CurrencyAsset {
    id: string;
    currency: string;
    amount: number;
    acquisitionDate: string;
    description: string;
}

export interface MetalAsset {
    id: string;
    metalType: 'gram_gold' | 'ounce_gold' | 'silver';
    amount: number;
    acquisitionDate: string;
    description: string;
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    isAdmin: boolean;
}

export interface Receivable {
    id: string;
    person: string;
    amount: number;
    date: string;
    description: string;
}

export interface ZakatPayment {
    id: string;
    amount: number;
    date: string;
    recipient: string;
    description: string;
}

export interface AssetData {
    tlAssets: TLAsset[];
    currencyAssets: CurrencyAsset[];
    metalAssets: MetalAsset[];
    receivables: Receivable[];
    zakatPayments: ZakatPayment[];
}
export interface ZakatSnapshot {
    id: string;
    year: number;
    saveDate: string;
    totalEligible: number;
    zakatAmount: number;
    nisabValue: number;
    rates: any;
    metalPrices: any;
    details: {
        tlAssets: TLAsset[];
        currencyAssets: CurrencyAsset[];
        metalAssets: MetalAsset[];
        receivables: Receivable[];
    };
    ignoreNisab: boolean;
}
