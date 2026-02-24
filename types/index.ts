export type TLAsset = { amount: number; date: string; description: string };
export type CurrencyAsset = { currency: string; amount: number; date: string; description: string };
export type MetalAsset = { metal: 'gram_gold' | 'ounce_gold' | 'silver'; amount: number; date: string; description: string };

export type UserAssets = {
  tlAssets: TLAsset[];
  currencyAssets: CurrencyAsset[];
  metalAssets: MetalAsset[];
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user';
};
