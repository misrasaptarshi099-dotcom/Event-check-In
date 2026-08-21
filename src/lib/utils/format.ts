/**
 * Shared currency and number formatting utilities.
 */

const LOCALE_MAP: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const safeCurrency = (currency || 'USD').trim().toUpperCase();
  const locale = LOCALE_MAP[safeCurrency] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    if (safeCurrency === 'INR') {
      return `₹${amount.toLocaleString('en-IN')}`;
    }
    return `${safeCurrency} ${amount.toLocaleString()}`;
  }
}
