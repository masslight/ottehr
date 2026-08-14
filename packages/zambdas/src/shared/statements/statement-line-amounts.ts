export function shareByCharge(totalCents: number, chargeCents: number[]): number[] {
  if (chargeCents.length === 0) return [];

  const totalCharge = chargeCents.reduce((sum, cents) => sum + cents, 0);
  const shares = chargeCents.map((charge) => (totalCharge > 0 ? Math.floor((totalCents * charge) / totalCharge) : 0));
  shares[shares.length - 1] += totalCents - shares.reduce((sum, cents) => sum + cents, 0);

  return shares;
}

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
