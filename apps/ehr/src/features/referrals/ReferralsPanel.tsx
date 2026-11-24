import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Chip, Skeleton, Typography, useTheme } from '@mui/material';
import { FC, ReactNode, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ReferralDTO } from 'utils/lib/types/api/referrals/referrals.types';
import { ReferralForm } from './ReferralForm';
import { ReferralFaxDialog, useReferralFax } from './useReferralFax';

export interface ReferralListState {
  expandedId?: string;
  toggle: (referralId: string) => void;
  sendFax: (referralId: string) => void;
}

interface ReferralsPanelProps {
  dataTestId: string;
  referrals: ReferralDTO[];
  isLoading: boolean;
  emptyText: string;
  patientId?: string;
  encounterId?: string;
  appointmentId?: string;
  newReferralHeader?: ReactNode;
  children: (list: ReferralListState) => ReactNode;
}

export const ReferralsPanel: FC<ReferralsPanelProps> = ({
  dataTestId,
  referrals,
  isLoading,
  emptyText,
  patientId,
  encounterId,
  appointmentId,
  newReferralHeader,
  children,
}) => {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string>();
  const { controller, sendFax } = useReferralFax();
  const toggle = (referralId: string): void =>
    setExpandedId((current) => (current === referralId ? undefined : referralId));

  return (
    <AccordionCard
      dataTestId={dataTestId}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" color={theme.palette.primary.dark}>
            Referrals
          </Typography>
          {referrals.length > 0 && <Chip size="small" label={referrals.length} />}
        </Box>
      }
      headerItem={
        patientId ? (
          <Button
            size="small"
            variant="text"
            startIcon={<AddIcon fontSize="small" />}
            disabled={adding}
            onClick={() => setAdding(true)}
            sx={{ textTransform: 'none' }}
            data-testid={dataTestIds.referrals.addButton}
          >
            Add referral
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {isLoading && <Skeleton variant="rounded" height={36} />}
        {referrals.length > 0 && children({ expandedId, toggle, sendFax })}
        {!isLoading && referrals.length === 0 && !adding && <Typography color="text.secondary">{emptyText}</Typography>}
        {adding && patientId && (
          <Box sx={{ border: 1, borderColor: 'primary.main', borderRadius: 1 }}>
            {newReferralHeader}
            <ReferralForm
              patientId={patientId}
              encounterId={encounterId}
              appointmentId={appointmentId}
              onSaved={(saved) => {
                setAdding(false);
                setExpandedId(saved.id);
              }}
              onDiscard={() => setAdding(false)}
              onSendFax={sendFax}
            />
          </Box>
        )}
      </Box>
      <ReferralFaxDialog controller={controller} />
    </AccordionCard>
  );
};
