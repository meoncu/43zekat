import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [spotRes, ratesRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot', { next: { revalidate: 3600 } }),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4013'}/api/rates`, { cache: 'no-store' }),
    ]);
    const spot = await spotRes.json();
    const rates = await ratesRes.json();
    const ounceGoldUsd = Number((spot.find((x: Record<string, number>) => x.gold)?.gold ?? 2650));
    const ounceSilverUsd = Number((spot.find((x: Record<string, number>) => x.silver)?.silver ?? 31));
    const usdTry = rates.rates.USD;
    return NextResponse.json({
      metals: {
        ounce_gold: ounceGoldUsd * usdTry,
        gram_gold: (ounceGoldUsd / 31.1035) * usdTry,
        silver: ounceSilverUsd * usdTry,
      },
    });
  } catch {
    return NextResponse.json({ metals: { ounce_gold: 92500, gram_gold: 3000, silver: 34 } });
  }
}
