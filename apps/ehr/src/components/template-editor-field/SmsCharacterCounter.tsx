import { Stack, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import { replaceTemplateVariablesHandlebars } from 'utils';

// ---------------------------------------------------------------------------
// GSM-7 / UCS-2 character counting helpers
// ---------------------------------------------------------------------------

/** Characters that use 2 slots in the GSM-7 extended table. */
const GSM_EXTENDED = new Set('|^{}[]~\\'.split(''));

/** Returns true if every character in the string is representable in GSM-7. */
function isGsm7(text: string): boolean {
  // GSM basic charset covers ASCII printable (0x20-0x7E), plus a few control chars.
  // For simplicity: if every char is in the printable-ASCII + newline/CR/tab range
  // then it's GSM-7 compatible.
  return !/[^\x20-\x7E\n\r\t]/.test(text);
}

function countGsmChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    count += GSM_EXTENDED.has(ch) ? 2 : 1;
  }
  return count;
}

function getSmsSegmentInfo(text: string): { charCount: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  if (isGsm7(text)) {
    const charCount = countGsmChars(text);
    const segments = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
    return { charCount, segments, encoding: 'GSM-7' };
  }
  // UCS-2: each character counts as 1 (but emoji may be 2 via surrogate pairs)
  const charCount = [...text].length;
  const segments = charCount <= 70 ? 1 : Math.ceil(charCount / 67);
  return { charCount, segments, encoding: 'UCS-2' };
}

function computeSmsStats(
  template: string,
  sampleValues: Record<string, string>
): { charCount: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  const resolved = replaceTemplateVariablesHandlebars(template, sampleValues);
  return getSmsSegmentInfo(resolved);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmsCharacterCounter({
  value,
  sampleValues,
}: {
  value: string;
  sampleValues: Record<string, string>;
}): ReactElement {
  const { charCount, segments, encoding } = React.useMemo(
    () => computeSmsStats(value, sampleValues),
    [value, sampleValues]
  );
  const isUcs2 = encoding === 'UCS-2';
  const color = isUcs2
    ? 'error.main'
    : segments >= 3
    ? 'error.main'
    : segments === 2
    ? 'warning.main'
    : 'text.secondary';
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
      <Typography variant="caption" color={color}>
        {charCount} chars · {segments} segment{segments !== 1 ? 's' : ''}
      </Typography>
      {isUcs2 && (
        <Typography variant="caption" color="error.main">
          — contains non-ASCII characters (emoji/unicode), switches to UCS-2 encoding (70 chars/segment)
        </Typography>
      )}
      {!isUcs2 && segments >= 2 && segments <= 3 && (
        <Typography variant="caption" color={color}>
          · additional carrier costs will apply for messages over 2 segments
        </Typography>
      )}
      {!isUcs2 && segments > 3 && (
        <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>
          · messages over 3 segments will not be sent
        </Typography>
      )}
      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
        (estimate based on example values)
      </Typography>
    </Stack>
  );
}
