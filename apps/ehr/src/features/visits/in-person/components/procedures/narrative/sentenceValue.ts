/** How a stored option reads inside running prose: "Tolerated Well" → "tolerated well". Only words that are
 * a capital followed by lowercase letters change, so acronyms (IV, EKG), digits ("5-10 min") and inner
 * capitals (McBurney) keep their stored spelling. Display only; stored values and popover lists keep theirs. */
export const sentenceValue = (value: string): string => value.replace(/\b[A-Z][a-z]+\b/g, (word) => word.toLowerCase());
