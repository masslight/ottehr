export const normalizeMarkdown = (md: string): { raw: string; normalized: string } => {
  const lines = md.split('\n');

  const meaningfulLines = lines.filter((line) => !line.match(/^-\s*\[\s\]\s*$/));

  return {
    raw: md.trim(),
    normalized: meaningfulLines.join('\n').trim(),
  };
};

export const hasUncheckedInMarkdown = (md: string): boolean => md.includes('- [ ]');

type MarkdownNode = string | Section;

type Section = {
  level: number;
  header: string;
  children: MarkdownNode[];
};

const UNCHECKED_REGEX = /^-\s*\[\s\]/;
const CHECKED_REGEX = /^-\s*\[x\]/i;
const ANY_CHECKBOX_REGEX = /^-\s*\[[x\s]\]/i;
const HEADER_REGEX = /^(#{1,6})\s/;

export const cleanUncheckedFromMarkdown = (md: string): string => {
  const lines = md.split('\n');

  const root: Section = { level: 0, header: '', children: [] };
  const stack: Section[] = [root];

  const getHeaderLevel = (line: string): number => {
    const match = line.match(HEADER_REGEX);
    return match ? match[1].length : 0;
  };

  for (const line of lines) {
    const level = getHeaderLevel(line);
    if (level > 0) {
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const section = { level, header: line, children: [] };
      stack[stack.length - 1].children.push(section);
      stack.push(section);
      continue;
    }

    if (UNCHECKED_REGEX.test(line)) continue;

    stack[stack.length - 1].children.push(line);
  }

  const serializeSection = (section: Section): string[] => {
    const result: string[] = [];
    let hasContent = false;

    for (const item of section.children) {
      if (typeof item === 'string') {
        if (CHECKED_REGEX.test(item)) hasContent = true;
        if (item.trim() !== '' && !ANY_CHECKBOX_REGEX.test(item)) hasContent = true;
        result.push(item);
      } else {
        const childLines = serializeSection(item);
        if (childLines.length) {
          hasContent = true;
          result.push(...childLines);
        }
      }
    }

    if (section.level === 0) return result;

    return hasContent ? [section.header, ...result] : [];
  };

  return serializeSection(root).join('\n').trim();
};
