export async function getExchangeRates() {
    try {
        // Exchange Rate API for global rates including TRY and SAR
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        return data.rates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return { TRY: 31.50, EUR: 0.92, GBP: 0.79, SAR: 3.75 }; // Fallback
    }
}

export async function getMetalPrices() {
    try {
        // Fetch through our internal proxy to avoid CORS
        const res = await fetch('/api/prices');
        const data = await res.json();

        // GA: Gram Altın, GUMUS: Gümüş
        const gramGold = parseFloat(data.GA?.s || "7290");
        const silver = parseFloat(data.GUMUS?.s || "95");

        return {
            gram_gold: gramGold,
            ounce_gold: gramGold * 31.1035,
            silver: silver
        };
    } catch (error) {
        console.error('Error fetching metal prices:', error);
        return {
            gram_gold: 7290,
            ounce_gold: 226700,
            silver: 95
        };
    }
}

export function isOneLunarYearPassed(acquisitionDate: string): boolean {
    const diffTime = Math.abs(new Date().getTime() - new Date(acquisitionDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 354;
}

export const NISAB_GOLD_GRAMS = 85;
