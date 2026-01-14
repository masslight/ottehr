export const isEmptyNarrative = (value: string): boolean => value.trim().length === 0;

export const generateNarrativeFromMarkdown = (markdown: string): string => {
  const sentences: string[] = [];

  markdown.split('\n').forEach((line) => {
    const trimmed = line.trim();

    const match = trimmed.match(/^- \[(\+|-)\] (.+)$/);
    if (!match) return;

    const [, type, text] = match;
    const normalized = text.trim().toLowerCase();

    if (!normalized) return;

    if (type === '+') {
      sentences.push(`Patient reports ${normalized}.`);
    } else {
      sentences.push(`Patient denies ${normalized}.`);
    }
  });

  return sentences.join(' ');
};
