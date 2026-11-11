/** Characters that use 2 slots in the GSM-7 extended table. */
const GSM_EXTENDED = new Set('|^{}[]~\\'.split(''));

/** Existing EHR estimate: printable ASCII plus newline/CR/tab is treated as GSM-7. */
function isGsm7(text: string): boolean {
  return !/[^\x20-\x7E\n\r\t]/.test(text);
}

function countGsmChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    count += GSM_EXTENDED.has(ch) ? 2 : 1;
  }
  return count;
}

/** Estimates SMS length using the existing EHR rules. */
export function getSmsSegmentInfo(text: string): {
  charCount: number;
  segments: number;
  encoding: 'GSM-7' | 'UCS-2';
} {
  if (isGsm7(text)) {
    const charCount = countGsmChars(text);
    const segments = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
    return { charCount, segments, encoding: 'GSM-7' };
  }
  const charCount = [...text].length;
  const segments = charCount <= 70 ? 1 : Math.ceil(charCount / 67);
  return { charCount, segments, encoding: 'UCS-2' };
}
