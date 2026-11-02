import { DateTime } from 'luxon';
import {
  REFERRAL_OVERDUE_DAYS,
  REFERRAL_SCHEDULER_LABELS,
  REFERRAL_URGENCY_LABELS,
} from 'utils/lib/types/api/referrals/referrals.types';
import { EncounterReferral } from '../../../referrals/load-encounter-referrals';
import { drawBlockHeader } from '../../helpers/render/blockHeader';
import { drawRegularText } from '../../helpers/render/regularText';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, ReferralsData } from '../../types';

// The patient's own copy (requirements item 15): where to go, why, how soon, and who is expected to book it.
export const composeReferralsForDischargeSummary: DataComposer<
  { referrals?: EncounterReferral[]; timezone?: string },
  ReferralsData
> = ({ referrals, timezone }) => ({
  referrals: (referrals ?? []).map((referral) => {
    const recipientLines = referral.recipient
      ? [
          referral.recipient.name,
          referral.recipient.address,
          referral.recipient.phone && `Phone: ${referral.recipient.phone}`,
        ]
      : [`Choose a ${referral.specialty} your insurance covers and bring this summary.`];
    // The window counts from when the referral went out; before that, from when it was written.
    const scheduleAnchor = referral.sentAt ?? referral.authoredOn;
    const scheduleBy =
      referral.whoSchedules === 'patient' && scheduleAnchor
        ? DateTime.fromISO(scheduleAnchor)
            .setZone(timezone ?? 'UTC')
            .plus({ days: REFERRAL_OVERDUE_DAYS[referral.urgency] })
            .toFormat('MM/dd/yyyy')
        : undefined;
    const lines = [
      ...recipientLines,
      `Reason: ${referral.reason}`,
      `Urgency: ${REFERRAL_URGENCY_LABELS[referral.urgency]}`,
      `Who schedules: ${REFERRAL_SCHEDULER_LABELS[referral.whoSchedules]}${scheduleBy ? ` (by ${scheduleBy})` : ''}`,
    ].filter((line): line is string => !!line);
    return { title: referral.specialty, lines };
  }),
});

export const createReferralsSectionForDischargeSummary = <TData extends { referrals?: ReferralsData }>(): PdfSection<
  TData,
  ReferralsData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Referrals',
    dataSelector: (data) => data.referrals,
    shouldRender: (sectionData) => !!sectionData.referrals.length,
    render: (client, data, styles) => {
      data.referrals.forEach((referral) => {
        drawBlockHeader(client, styles, referral.title, styles.textStyles.blockSubHeader);
        referral.lines.forEach((line) => drawRegularText(client, styles, line));
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
