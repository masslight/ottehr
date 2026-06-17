export const formatCurrency = (v: number): string => `$${v.toFixed(2)}`;

// Display names are "Last, First".
export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const parts = name.split(', ');
  return { firstName: parts[1] ?? '', lastName: parts[0] ?? '' };
}

// Returns undefined when every field is blank.
export function buildAddressInput(
  line1: string,
  line2: string,
  city: string,
  state: string,
  zip: string
): { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string } | undefined {
  const address = {
    ...(line1.trim() ? { line1: line1.trim() } : {}),
    ...(line2.trim() ? { line2: line2.trim() } : {}),
    ...(city.trim() ? { city: city.trim() } : {}),
    ...(state.trim() ? { state: state.trim() } : {}),
    ...(zip.trim() ? { postalCode: zip.trim() } : {}),
  };
  return Object.keys(address).length ? address : undefined;
}
