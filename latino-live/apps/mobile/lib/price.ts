// Stripe's amount contract uses two decimals except these charge currencies.
const zeroDecimal = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','VND','VUV','XAF','XOF','XPF']);

const symbols: Record<string, string> = { USD: '$', EUR: '€', MXN: 'MX$', GBP: '£', COP: 'COL$', ARS: 'AR$', CLP: 'CLP$', BRL: 'R$', PEN: 'S/', DOP: 'RD$' };

/**
 * Amounts are formatted with the phone's own rules when it can, and with a
 * plain fallback when the phone lacks the language data for that currency.
 */
function formatAmount(value: number, currency: string, digits: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
  } catch {
    const fixed = value.toFixed(digits);
    return `${symbols[currency] ?? `${currency} `}${fixed}`;
  }
}

export function priceLabel(price: { currency: string; unitAmount: number; recurringInterval?: string | null; recurringIntervalCount?: number }) {
  const currency = price.currency.toUpperCase();
  const digits = zeroDecimal.has(currency) ? 0 : 2;
  const amount = formatAmount(price.unitAmount / 10 ** digits, currency, digits);
  const count = price.recurringIntervalCount ?? 1;
  return price.recurringInterval ? `${amount} / ${count > 1 ? `${count} ${price.recurringInterval}s` : price.recurringInterval}` : amount;
}
