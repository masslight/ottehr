import {
  Box,
  Button,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, Fragment } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { ReferralForm } from './ReferralForm';
import { NO_RECIPIENT_LABEL } from './referralForm.helpers';
import { useReferralsQuery } from './referrals.queries';
import { ReferralsPanel } from './ReferralsPanel';
import { ReferralStatusChip, ReferralUrgencyChip } from './ReferralStatusChip';

interface PatientReferralsTabProps {
  patientId: string;
}

const COLUMNS = ['Date', 'Specialty', 'Recipient', 'Urgency', 'Status', 'Visit', ''];

export const PatientReferralsTab: FC<PatientReferralsTabProps> = ({ patientId }) => {
  const theme = useTheme();
  const { data, isLoading } = useReferralsQuery(patientId ? { patientId } : undefined);
  const referrals = data?.referrals ?? [];

  return (
    <Box sx={{ mt: 2 }} data-testid={dataTestIds.referrals.patientTab}>
      <ReferralsPanel
        key={patientId}
        dataTestId={dataTestIds.referrals.card}
        referrals={referrals}
        isLoading={isLoading}
        emptyText="No referrals."
        patientId={patientId}
        newReferralHeader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2 }}>
            <Typography variant="h6" color={theme.palette.primary.dark}>
              New referral
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No visit: created from the patient record
            </Typography>
          </Box>
        }
      >
        {({ expandedId, toggle, sendFax }) => (
          <Table size="small" data-testid={dataTestIds.referrals.patientTable}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableCell key={column}>{column}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {referrals.map((referral) => (
                <Fragment key={referral.id}>
                  <TableRow
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => toggle(referral.id)}
                    data-testid={dataTestIds.referrals.row(referral.id)}
                  >
                    <TableCell>{formatDateForDisplay(referral.createdAt)}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{referral.specialty}</TableCell>
                    <TableCell sx={{ color: referral.recipient ? undefined : 'text.secondary' }}>
                      {referral.recipient?.name ?? NO_RECIPIENT_LABEL}
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
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="text"
                        aria-expanded={expandedId === referral.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle(referral.id);
                        }}
                        sx={{ textTransform: 'none' }}
                        data-testid={dataTestIds.referrals.expandButton(referral.id)}
                      >
                        {expandedId === referral.id ? 'Collapse' : 'Expand'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === referral.id && (
                    <TableRow>
                      <TableCell colSpan={COLUMNS.length} sx={{ p: 0 }}>
                        <ReferralForm
                          patientId={referral.patientId}
                          encounterId={referral.encounterId}
                          referral={referral}
                          onSendFax={sendFax}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </ReferralsPanel>
    </Box>
  );
};
