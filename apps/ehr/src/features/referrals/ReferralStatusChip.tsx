import { ComponentProps, FC } from 'react';
import { StatusChip } from 'src/components/StatusChip';
import {
  REFERRAL_STATUS_LABELS,
  REFERRAL_URGENCY_LABELS,
  ReferralStatus,
  ReferralUrgency,
} from 'utils/lib/types/api/referrals/referrals.types';

type ChipStyle = ComponentProps<typeof StatusChip>['style'];

const STATUS_STYLES: Record<ReferralStatus, ChipStyle> = {
  'not-sent': 'grey',
  sent: 'blue',
  'given-to-patient': 'purple',
  'response-received': 'orange',
  closed: 'green',
  cancelled: 'whiteGrey',
};

const URGENCY_STYLES: Record<ReferralUrgency, ChipStyle> = {
  routine: 'grey',
  urgent: 'orange',
  asap: 'red',
};

export const ReferralStatusChip: FC<{ status: ReferralStatus }> = ({ status }) => (
  <StatusChip status={REFERRAL_STATUS_LABELS[status]} style={STATUS_STYLES[status]} />
);

export const ReferralUrgencyChip: FC<{ urgency: ReferralUrgency }> = ({ urgency }) => (
  <StatusChip status={REFERRAL_URGENCY_LABELS[urgency]} style={URGENCY_STYLES[urgency]} />
);
