import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, Fragment, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useSendFax } from 'src/features/fax/hooks/useSendFax';
import { SendFaxDialog } from 'src/features/fax/ui/SendFaxDialog';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { ReferralForm } from './ReferralForm';
import { useReferralsQuery } from './referrals.queries';
import { ReferralStatusChip, ReferralUrgencyChip } from './ReferralStatusChip';

interface PatientReferralsTabProps {
  patientId: string;
}

const COLUMNS = ['Date', 'Specialty', 'Recipient', 'Urgency', 'Status', 'Visit'];

/** The patient record's Referrals tab: every referral, open ones first, and a new one without a visit. */
export const PatientReferralsTab: FC<PatientReferralsTabProps> = ({ patientId }) => {
  const theme = useTheme();
  const { data, isLoading } = useReferralsQuery(patientId ? { patientId } : undefined);
  const referrals = data?.referrals ?? [];
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string>();
  // One fax dialog for the tab: a new referral's form is replaced by its row the moment it is saved.
  const [faxReferralId, setFaxReferralId] = useState<string>();
  const fax = useSendFax(faxReferralId ? { type: 'referral', referralId: faxReferralId } : undefined);
  const sendFax = (referralId: string): void => {
    setFaxReferralId(referralId);
    fax.open();
  };

  return (
    <Box
      sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.referrals.patientTab}
    >
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" color={theme.palette.primary.dark}>
            Referrals
          </Typography>
          {referrals.length > 0 && <Chip size="small" label={referrals.length} />}
          <Box sx={{ flexGrow: 1 }} />
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
        </Box>
        {isLoading ? (
          <Skeleton variant="rounded" height={48} />
        ) : (
          <Table size="small" data-testid={dataTestIds.referrals.patientTable}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableCell key={column}>{column}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {referrals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}>
                    <Typography color="text.secondary">No referrals.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {referrals.map((referral) => {
                const expanded = expandedId === referral.id;
                return (
                  <Fragment key={referral.id}>
                    <TableRow
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setExpandedId(expanded ? undefined : referral.id)}
                      data-testid={dataTestIds.referrals.row(referral.id)}
                    >
                      <TableCell>{DateTime.fromISO(referral.createdAt).toLocal().toFormat(DATE_FORMAT)}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{referral.specialty}</TableCell>
                      <TableCell sx={{ color: referral.recipient ? undefined : 'text.secondary' }}>
                        {referral.recipient?.name ?? 'No recipient'}
                      </TableCell>
                      <TableCell>
                        <ReferralUrgencyChip urgency={referral.urgency} />
                      </TableCell>
                      <TableCell>
                        <ReferralStatusChip status={referral.status} />
                      </TableCell>
                      <TableCell>
                        {referral.appointmentId ? (
                          <Link
                            component={RouterLink}
                            to={`/in-person/${referral.appointmentId}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            Visit
                          </Link>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No visit
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={COLUMNS.length} sx={{ p: 0 }}>
                          {/* A visit's referral is edited on that visit; here it can only be sent, printed or closed. */}
                          <ReferralForm
                            patientId={referral.patientId}
                            encounterId={referral.encounterId}
                            referral={referral}
                            readOnly={!!referral.encounterId}
                            keepActions
                            onSendFax={sendFax}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {adding && (
        <Paper sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2 }}>
            <Typography variant="h6" color={theme.palette.primary.dark}>
              New referral
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No visit: created from the patient record
            </Typography>
          </Box>
          <ReferralForm
            patientId={patientId}
            onSaved={(saved) => {
              setAdding(false);
              setExpandedId(saved.id);
            }}
            onDiscard={() => setAdding(false)}
            onSendFax={sendFax}
          />
        </Paper>
      )}
      <SendFaxDialog controller={fax} title="Send referral" />
    </Box>
  );
};
