export const sentenceValue = (value: string): string => {
  const titleCase = value.split(/\s+/).every((word) => !/^[a-z]/.test(word));
  return value.replace(/\b[A-Z][a-z]+\b/g, (word, offset: number) =>
    offset === 0 || titleCase ? word.toLowerCase() : word
  );
};
