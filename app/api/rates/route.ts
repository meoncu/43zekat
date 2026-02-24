import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/TRY', { next: { revalidate: 3600 } });
    const data = await res.json();
    const usdTry = 1 / data.rates.USD;
    const eurTry = 1 / data.rates.EUR;
    const gbpTry = 1 / data.rates.GBP;
    return NextResponse.json({ rates: { USD: usdTry, EUR: eurTry, GBP: gbpTry } });
  } catch {
    return NextResponse.json({ rates: { USD: 35, EUR: 38, GBP: 44 } });
  }
}
