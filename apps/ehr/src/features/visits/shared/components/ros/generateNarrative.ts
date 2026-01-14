export const isEmptyNarrative = (value: string): boolean => value.trim().length === 0;

interface ParsedRos {
  reports: string[];
  denies: string[];
}

const parseRosMarkdown = (markdown: string): ParsedRos => {
  const reports: string[] = [];
  const denies: string[] = [];

  markdown.split('\n').forEach((line) => {
    const trimmed = line.trim();

    const match = trimmed.match(/^-\s*\[(R|D)\]\s+(.+)$/);
    if (!match) return;

    const [, type, text] = match;
    const normalized = text.trim().toLowerCase();

    if (!normalized) return;

    if (type === 'R') {
      reports.push(normalized);
    } else {
      denies.push(normalized);
    }
  });

  return { reports, denies };
};

export const generateNarrativeFromMarkdown = (markdown: string): string => {
  const { reports, denies } = parseRosMarkdown(markdown);

  const sentences: string[] = [];

  if (reports.length > 0) {
    sentences.push(`Patient reports ${reports.join(', ')}.`);
  }

  if (denies.length > 0) {
    sentences.push(`Patient denies ${denies.join(', ')}.`);
  }

  return sentences.join(' ');
};
