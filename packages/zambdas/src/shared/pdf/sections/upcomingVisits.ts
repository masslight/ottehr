import { DateTime } from 'luxon';
import { UpcomingFollowUp } from '../get-upcoming-follow-ups';
import { DataComposer } from '../pdf-common';
import { PdfSection, UpcomingVisitsData } from '../types';

const formatUpcomingFollowUp = ({ startIso, timezone, locationName, reason }: UpcomingFollowUp): string => {
  const dt = startIso ? DateTime.fromISO(startIso).setZone(timezone) : undefined;
  // "06/07/2026 11:30 AM  EDT"
  const dateTimePart = dt?.isValid
    ? `${dt.toFormat('MM/dd/yyyy')} ${dt.toFormat('hh:mm a')}  ${dt.toFormat('ZZZZ')}`
    : '';
  const locationAndReason = [locationName, reason].filter(Boolean).join(' - ');
  return [dateTimePart, locationAndReason].filter(Boolean).join(', ');
};

export const composeUpcomingVisits: DataComposer<{ upcomingFollowUps: UpcomingFollowUp[] }, UpcomingVisitsData> = ({
  upcomingFollowUps,
}) => ({
  rows: upcomingFollowUps.map(formatUpcomingFollowUp),
});

export const createUpcomingVisitsSection = <TData extends { upcomingVisits?: UpcomingVisitsData }>(): PdfSection<
  TData,
  UpcomingVisitsData
> => ({
  title: 'Upcoming Visits',
  dataSelector: (data) => data.upcomingVisits,
  shouldRender: () => true,
  render: (client, data, styles) => {
    if (data.rows.length === 0) {
      client.drawText('No visits planned', styles.textStyles.muted);
    } else {
      for (const row of data.rows) {
        client.drawText(row, styles.textStyles.regular);
      }
    }
    client.drawSeparatedLine(styles.lineStyles.separator);
  },
});
