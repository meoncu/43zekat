import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res = await fetch('https://api.genelpara.com/embed/para-birimleri.json', {
            next: { revalidate: 300 } // Cache for 5 minutes
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
    }
}
