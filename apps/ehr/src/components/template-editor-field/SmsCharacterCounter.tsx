import { Stack, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import { replaceTemplateVariablesHandlebars } from 'utils/lib/helpers/helpers';
import { getSmsSegmentInfo } from 'utils/lib/helpers/rcm/sms-segment-info';

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

function getSegmentColor(isUcs2: boolean, segments: number): string {
  if (isUcs2 || segments >= 3) return 'error.main';
  if (segments === 2) return 'warning.main';
  return 'text.secondary';
}

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

  const color = getSegmentColor(isUcs2, segments);
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
