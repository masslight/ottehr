import { Stack, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { replaceTemplateVariablesHandlebars } from 'utils/lib/helpers/helpers';
import { getSmsSegmentInfo } from 'utils/lib/helpers/rcm/sms-segment-info';

// Uses the sample invoice URL from EHR configuration.
const SAMPLE_INVOICE_LINK =
  'https://invoice.stripe.com/i/acct_1RMBK7QOl2MSLK9p/test_YWNjdF8xUk1CSzdRT2wyTVNMSzlwLF9VV014QzRwYnloekVGcVp4R0JZdE1Od1pZRnBua2N3LDE2OTUxNjgyOA0200OsKWP9C9?s=ap';

export function InvoiceSmsCounter({
  value,
  sampleValues,
}: {
  value: string;
  sampleValues: Record<string, string>;
}): ReactElement {
  const resolved = replaceTemplateVariablesHandlebars(value, { ...sampleValues, 'invoice-link': SAMPLE_INVOICE_LINK });
  const { charCount, segments, encoding } = getSmsSegmentInfo(resolved);
  const color =
    encoding === 'UCS-2' || segments >= 3 ? 'error.main' : segments === 2 ? 'warning.main' : 'text.secondary';
  return (
    <Stack role="group" aria-label="SMS length estimate" spacing={0.5} sx={{ mt: 1 }}>
      <Typography variant="caption" color={color}>
        {charCount} chars · {segments} segment{segments === 1 ? '' : 's'}
      </Typography>
      {encoding === 'UCS-2' && (
        <Typography variant="caption" color="error.main">
          Unicode characters may require more SMS segments.
        </Typography>
      )}
      {segments > 1 && (
        <Typography variant="caption" color={color}>
          Longer SMS messages may cost more.
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        Estimate based on example values.
      </Typography>
    </Stack>
  );
}
