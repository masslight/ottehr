/**
 * Proportionally splits totalCents across a chargeCents. Used when the payer reported an amount for
 * the whole claim without saying which procedure it belongs to. Rounds all values down to the cent
 * then gives the last line any leftover cents to avoid rounding error.
 *
 * @example
 * // insurance paid $200 across a $104 x-ray and a $339 office visit
 * shareByCharge(20_000, [10_400, 33_900]); // [4_695, 15_305]
 */
export function shareByCharge(totalCents: number, chargeCents: number[]): number[] {
  if (chargeCents.length === 0) return [];

  const totalCharge = chargeCents.reduce((sum, cents) => sum + cents, 0);
  const shares = chargeCents.map((charge) => (totalCharge > 0 ? Math.floor((totalCents * charge) / totalCharge) : 0));
  shares[shares.length - 1] += totalCents - shares.reduce((sum, cents) => sum + cents, 0);

  return shares;
}

/**
 * Splits paymentCents across owedCents using a waterfall method. The order of the lines matters.
 * Used when the patient pays a statement.
 *
 * @example
 * // a $50 payment against lines owing $20 and $68
 * applyPaymentToLines(5_000, [2_000, 6_800]); // [2_000, 3_000]
 */
export function applyPaymentToLines(paymentCents: number, owedCents: number[]): number[] {
  if (owedCents.length === 0) return [];

  let remaining = paymentCents;
  const applied = owedCents.map((owed) => {
    const toApply = Math.min(remaining, owed);
    remaining -= toApply;
    return toApply;
  });
  applied[applied.length - 1] += remaining;

  return applied;
}
