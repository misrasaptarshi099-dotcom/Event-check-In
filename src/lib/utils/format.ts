/**
 * Shared currency and number formatting utilities.
 */

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const safeCurrency = (currency || 'USD').trim().toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toLocaleString()}`;
  }
}
