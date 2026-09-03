/**
 * Digests a value to a short, stable string (cyrb53).
 *
 * Callers pass whole chart payloads, so the serialized form is far too large to sit in a query key
 * that React Query keeps alive for every cached note version. cyrb53 gives ~53 bits, which is ample
 * to tell one revision of a single encounter's note from another.
 */
export function hashInput(input: unknown): string {
  const serialized = JSON.stringify(input) ?? '';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
