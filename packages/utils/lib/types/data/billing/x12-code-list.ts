// One code of an X12 external code list (CARC, RARC) with its official description.
export interface X12CodeListEntry {
  code: string;
  description: string;
}

const CODE_LINE = /^([A-Z]{0,2}\d{1,4}) (.+)$/;
const USAGE_NOTE = /\s+Usage:/;

// Parses a code list as X12 renders it with the "Current" filter:
//
//   <code> <description>
//   [more description paragraphs, blank-line separated]
//   Start: mm/dd/yyyy [| Last Modified: mm/dd/yyyy]
//   [Notes: ...]
//
// Start/Notes lines are revision metadata and are dropped. dropUsage cuts a description at its
// " Usage:" guidance — CARCs carry adjudication instructions for payers there, which billers keying a
// remit don't need. Throws on anything unexpected so a bad paste fails generation loudly.
export function parseX12CodeList(text: string, options: { dropUsage?: boolean } = {}): X12CodeListEntry[] {
  const entries: X12CodeListEntry[] = [];
  const seen = new Set<string>();
  let current: { code: string; paragraphs: string[] } | undefined;
  // before the first code, and after each Start: line, the next text line must be a code line
  let expectingCode = true;

  const finish = (entry: { code: string; paragraphs: string[] }): void => {
    let description = entry.paragraphs.join('\n\n');
    if (options.dropUsage) description = description.split(USAGE_NOTE)[0];
    description = description.trim();
    if (!description) throw new Error(`Code ${entry.code} has no description`);
    entries.push({ code: entry.code, description });
  };

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    const where = `line ${index + 1}`;
    if (!line) return;
    if (line.startsWith('Start:')) {
      if (!current || expectingCode) throw new Error(`Unexpected "Start:" on ${where}`);
      expectingCode = true;
      return;
    }
    if (line.startsWith('Notes:')) {
      if (!current || !expectingCode) throw new Error(`Unexpected "Notes:" on ${where}`);
      return;
    }
    if (!expectingCode) {
      current?.paragraphs.push(line);
      return;
    }
    const match = CODE_LINE.exec(line);
    if (!match) throw new Error(`Expected "<code> <description>" on ${where}, got "${line}"`);
    const [, code, description] = match;
    if (seen.has(code)) throw new Error(`Duplicate code ${code} on ${where}`);
    seen.add(code);
    if (current) finish(current);
    current = { code, paragraphs: [description] };
    expectingCode = false;
  });

  if (current) {
    if (!expectingCode) throw new Error(`Code ${current.code} has no "Start:" line`);
    finish(current);
  }
  return entries;
}
