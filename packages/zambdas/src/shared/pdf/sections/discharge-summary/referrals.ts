import { DateTime } from 'luxon';
import { REFERRAL_SCHEDULER_LABELS, REFERRAL_URGENCY_LABELS } from 'utils/lib/types/api/referrals/referrals.types';
import { EncounterReferral } from '../../../referrals/load-encounter-referrals';
import { referralOverdueAt } from '../../../referrals/referral-task';
import { DataComposer } from '../../pdf-common';
import { PdfSection, ReferralsData } from '../../types';
import { createTitledLinesSection } from '../titledLines';

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
      : [`Choose a specialist in ${referral.specialty} that your insurance covers and bring this summary.`];
    const scheduleAnchor = referral.sentAt ?? referral.givenToPatientAt ?? referral.authoredOn;
    const scheduleBy =
      referral.whoSchedules === 'patient' && scheduleAnchor
        ? DateTime.fromISO(referralOverdueAt(referral.urgency, scheduleAnchor))
            .setZone(timezone ?? 'UTC')
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
> =>
  createTitledLinesSection({
    title: 'Referrals',
    dataSelector: (data: TData) => data.referrals,
    blocks: (data) => data.referrals,
  });
