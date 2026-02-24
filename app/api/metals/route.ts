import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [spotRes, fxRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot', { next: { revalidate: 3600 } }),
      fetch('https://open.er-api.com/v6/latest/TRY', { next: { revalidate: 3600 } }),
    ]);

    const spot = await spotRes.json();
    const fxData = await fxRes.json();

    const ounceGoldUsd = Number((spot.find((x: Record<string, number>) => x.gold)?.gold ?? 2650));
    const ounceSilverUsd = Number((spot.find((x: Record<string, number>) => x.silver)?.silver ?? 31));
    const usdTry = 1 / Number(fxData?.rates?.USD ?? 0.028);

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
