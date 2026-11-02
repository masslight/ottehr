import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Chip, Skeleton, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { ReferralForm } from './ReferralForm';
import { ReferralRow } from './ReferralRow';
import { useReferralsQuery } from './referrals.queries';

/** The visit's referrals on the Plan tab, beside the disposition (requirements items 1 and 3). */
export const ReferralsCard: FC = () => {
  const theme = useTheme();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { encounter, resources } = useAppointmentData();
  const encounterId = encounter?.id;
  const patientId = resources?.patient?.id;
  const { data, isLoading } = useReferralsQuery(encounterId ? { encounterId } : undefined);
  const referrals = data?.referrals ?? [];

  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string>();
  // One fax dialog for the card: a new referral's form is replaced by its row the moment it is saved.
  const [faxReferralId, setFaxReferralId] = useState<string>();
  const fax = useSendFax(faxReferralId ? { type: 'referral', referralId: faxReferralId } : undefined);
  const sendFax = (referralId: string): void => {
    setFaxReferralId(referralId);
    fax.open();
  };

  return (
    <AccordionCard
      dataTestId={dataTestIds.referrals.card}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" color={theme.palette.primary.dark}>
            Referrals
          </Typography>
          {referrals.length > 0 && <Chip size="small" label={referrals.length} />}
        </Box>
      }
      headerItem={
        !isReadOnly && patientId ? (
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
        {referrals.map((referral) => (
          <ReferralRow
            key={referral.id}
            referral={referral}
            expanded={expandedId === referral.id}
            onToggle={() => setExpandedId((current) => (current === referral.id ? undefined : referral.id))}
            readOnly={isReadOnly}
            onSendFax={sendFax}
          />
        ))}
        {!isLoading && referrals.length === 0 && !adding && (
          <Typography color="text.secondary">No referrals for this visit.</Typography>
        )}
        {adding && patientId && (
          <Box sx={{ border: 1, borderColor: 'primary.main', borderRadius: 1 }}>
            <ReferralForm
              patientId={patientId}
              encounterId={encounterId}
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
      <SendFaxDialog controller={fax} title="Send referral" />
    </AccordionCard>
  );
};
