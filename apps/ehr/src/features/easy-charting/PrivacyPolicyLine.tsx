// Static privacy-policy acknowledgement at the bottom of the easy-chart note, mirroring Review &
// Sign's PrivacyPolicyAcknowledgement ("…reviewed and accepted on {appointment start}"). The date
// renders in the browser's local timezone (house rule for user-facing times); when the appointment
// start isn't available the line renders without it.
import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { formatDateToMDYWithTime } from 'utils';

export function PrivacyPolicyLine({ appointmentStart }: { appointmentStart?: string }): JSX.Element {
  const start = formatDateToMDYWithTime(appointmentStart, DateTime.local().zoneName);
  return (
    <Typography variant="caption" color="text.secondary" sx={{ pt: 1.25, display: 'block' }}>
      {start
        ? `Privacy Policy and Terms and Conditions of Service were reviewed and accepted on ${start.date} at ${start.time}.`
        : 'Privacy Policy and Terms and Conditions of Service were reviewed and accepted.'}
    </Typography>
  );
}
