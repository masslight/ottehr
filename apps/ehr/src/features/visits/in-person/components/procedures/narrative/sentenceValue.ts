/** How a stored option reads inside running prose: "Tolerated Well" → "tolerated well", "Left elbow" → "left elbow".
 * The first word always drops its capital, the rest only when the whole value is in Title Case (a label, not a
 * sentence), so a name inside a sentence-case value keeps its capital ("second-degree AV block, Mobitz I").
 * Only words that are a capital followed by lowercase letters change, so acronyms (IV, EKG), digits ("5-10 min")
 * and inner capitals (McBurney) keep their stored spelling. Display only; stored values and popover lists keep theirs. */
export const sentenceValue = (value: string): string => {
  const titleCase = value.split(/\s+/).every((word) => !/^[a-z]/.test(word));
  return value.replace(/\b[A-Z][a-z]+\b/g, (word, offset: number) =>
    offset === 0 || titleCase ? word.toLowerCase() : word
  );
};
