import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ReferralDTO } from 'utils/lib/types/api/referrals/referrals.types';
import { ReferralForm } from './ReferralForm';
import { NO_RECIPIENT_TEXT } from './referralForm.helpers';
import { ReferralStatusChip, ReferralUrgencyChip } from './ReferralStatusChip';

interface ReferralRowProps {
  referral: ReferralDTO;
  expanded: boolean;
  onToggle: () => void;
  readOnly: boolean;
  onSendFax: (referralId: string) => void;
}

/** One referral on the Plan tab: a summary line, and the form underneath when expanded. */
export const ReferralRow: FC<ReferralRowProps> = ({ referral, expanded, onToggle, readOnly, onSendFax }) => (
  <Box
    sx={{ border: 1, borderColor: expanded ? 'primary.main' : 'divider', borderRadius: 1 }}
    data-testid={dataTestIds.referrals.row(referral.id)}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, flexWrap: 'wrap' }}>
      <Typography sx={{ fontWeight: 500, minWidth: 140 }}>{referral.specialty}</Typography>
      <Typography sx={{ flexGrow: 1 }} color={referral.recipient ? 'text.primary' : 'text.secondary'}>
        {referral.recipient?.name ?? NO_RECIPIENT_TEXT}
      </Typography>
      <ReferralUrgencyChip urgency={referral.urgency} />
      <ReferralStatusChip status={referral.status} />
      <Button
        size="small"
        variant="text"
        onClick={onToggle}
        sx={{ textTransform: 'none' }}
        data-testid={dataTestIds.referrals.expandButton(referral.id)}
      >
        {expanded ? 'Collapse' : 'Expand'}
      </Button>
    </Box>
    {expanded && (
      <ReferralForm
        patientId={referral.patientId}
        encounterId={referral.encounterId}
        referral={referral}
        readOnly={readOnly}
        onSendFax={onSendFax}
      />
    )}
  </Box>
);
