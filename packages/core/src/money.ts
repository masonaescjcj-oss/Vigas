/**
 * Money is stored as integer micro-dollars (1 USD = 1,000,000 micros) so ledgers never
 * accumulate floating-point error. Token prices are micro-dollars per 1M tokens.
 */

export const MICROS_PER_USD = 1_000_000;

export function usdToMicros(usd: number): number {
  return Math.round(usd * MICROS_PER_USD);
}

export function microsToUsd(micros: number): number {
  return micros / MICROS_PER_USD;
}

/** "$48.20", "$0.0041", "Free". Small amounts keep enough digits to be meaningful. */
export function formatUsd(micros: number, opts: { free?: boolean; maxDecimals?: number } = {}): string {
  if (opts.free && micros === 0) return 'Free';
  const usd = microsToUsd(micros);
  const abs = Math.abs(usd);
  let decimals = 2;
  if (abs > 0 && abs < 0.01) {
    decimals = Math.min(opts.maxDecimals ?? 6, Math.max(4, Math.ceil(-Math.log10(abs)) + 1));
  }
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals });
  return `${usd < 0 ? '−' : ''}$${s}`;
}

/** Price per 1M tokens for display, e.g. 15_000_000 → "$15.00", 70_000 → "$0.07". */
export function formatPricePerMillion(microsPerMillion: number): string {
  if (microsPerMillion === 0) return 'Free';
  return formatUsd(microsPerMillion, { maxDecimals: 4 });
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface TokenPrice {
  inputPerMillionMicros: number;
  outputPerMillionMicros: number;
}

/** Cost of a request in micros, rounded up so the platform never undercharges. */
export function costMicros(usage: TokenUsage, price: TokenPrice): number {
  const raw =
    usage.promptTokens * price.inputPerMillionMicros + usage.completionTokens * price.outputPerMillionMicros;
  return Math.ceil(raw / 1_000_000);
}

export interface TopupQuote {
  amountMicros: number;
  feeMicros: number;
  totalMicros: number;
  /** Part of the amount that fell inside the fee-free allowance. */
  freeMicros: number;
}

/**
 * Fee charged on a credit top-up. The first `freeAllowanceMicros` of a user's lifetime
 * top-ups are fee-free; after that `feeBps` basis points apply (500 = 5%).
 */
export function quoteTopup(
  amountMicros: number,
  lifetimeTopupMicros: number,
  feeBps: number,
  freeAllowanceMicros = 5 * MICROS_PER_USD,
): TopupQuote {
  if (!Number.isInteger(amountMicros) || amountMicros <= 0) {
    throw new Error('Top-up amount must be a positive integer of micros');
  }
  const remainingFree = Math.max(0, freeAllowanceMicros - Math.max(0, lifetimeTopupMicros));
  const freeMicros = Math.min(amountMicros, remainingFree);
  const feeMicros = Math.ceil(((amountMicros - freeMicros) * feeBps) / 10_000);
  return { amountMicros, feeMicros, totalMicros: amountMicros + feeMicros, freeMicros };
}
