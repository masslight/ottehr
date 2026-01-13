type RosEntryType = 'reports' | 'denies' | 'free';

interface RosEntry {
  type: RosEntryType;
  text: string;
}

const normalizeSentencePart = (text: string): string => text.replace(/\.$/, '').trim().toLowerCase();

const joinSentence = (entries: RosEntry[]): string => entries.map((e) => normalizeSentencePart(e.text)).join(', ');

export function parseRosMarkdown(markdown: string): RosEntry[] {
  if (!markdown.trim()) return [];

  const entries: RosEntry[] = [];

  markdown.split('\n').forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) return;

    const reportMatch = trimmed.match(/^-\s*\[R\]\s*(.+)$/);
    if (reportMatch) {
      entries.push({ type: 'reports', text: reportMatch[1].trim() });
      return;
    }

    const denyMatch = trimmed.match(/^-\s*\[D\]\s*(.+)$/);
    if (denyMatch) {
      entries.push({ type: 'denies', text: denyMatch[1].trim() });
      return;
    }

    // ignore headers and unchecked list items
    if (trimmed.startsWith('#') || trimmed.match(/^-\s*\[\s*\]/)) {
      return;
    }

    // free text
    entries.push({ type: 'free', text: trimmed });
  });

  return entries;
}

export function generateNarrativeFromMarkdown(markdown: string): string {
  const entries = parseRosMarkdown(markdown);

  if (entries.length === 0) return '';

  const reports = entries.filter((e) => e.type === 'reports');
  const denies = entries.filter((e) => e.type === 'denies');
  const free = entries.filter((e) => e.type === 'free');

  const sections: string[] = [];

  if (reports.length) {
    sections.push(`Patient reports ${joinSentence(reports)}.`);
  }

  if (denies.length) {
    sections.push(`Patient denies ${joinSentence(denies)}.`);
  }

  if (free.length) {
    sections.push(free.map((e) => e.text).join(' '));
  }

  return sections.join('\n\n');
}
