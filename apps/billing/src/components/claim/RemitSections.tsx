import {
  Link,
  Stack,
  SxProps,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Theme,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { ClaimInsurancePayment, ClaimRemit } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { adjustmentCode, formatAdjustment } from '../../constants/era';
import { otherColors } from '../../themes/ottehr/colors';
import { aggregateAdjustments, eraHref } from '../../utils/claimRemits';
import { formatDate } from '../../utils/format';
import { AdjustmentChip, AmountChip, EraStatusChip } from '../EraChips';
import { ReadOnlySection, thSx } from '../ReadOnlySection';
import { useRemitHighlight } from './RemitHighlight';

const openEraInNewTab = (paymentReconciliationId: string): void => {
  window.open(eraHref(paymentReconciliationId), '_blank', 'noopener');
};

const eraRowSx = (clickable: boolean, highlighted: boolean): SxProps<Theme> => ({
  ...(clickable ? { cursor: 'pointer', '&:hover': { bgcolor: otherColors.apptHover } } : {}),
  ...(highlighted ? { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } : {}),
});

function CheckLink({
  paymentReconciliationId,
  checkNumber,
}: {
  paymentReconciliationId: string;
  checkNumber: string;
}): ReactElement {
  if (!paymentReconciliationId) return <>{checkNumber || '-'}</>;
  return (
    <Link
      href={eraHref(paymentReconciliationId)}
      target="_blank"
      rel="noopener"
      underline="hover"
      onClick={(event) => event.stopPropagation()}
    >
      {checkNumber || 'View ERA'}
    </Link>
  );
}

export function RemitsSection({ remits }: { remits: ClaimRemit[] }): ReactElement {
  const highlight = useRemitHighlight();
  return (
    <ReadOnlySection title="Remits">
      {remits.length === 0 ? (
        'No remits yet'
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Remits">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Remit Date</TableCell>
                <TableCell sx={thSx}>Check Date</TableCell>
                <TableCell sx={thSx}>Payer</TableCell>
                <TableCell sx={thSx}>Check #</TableCell>
                <TableCell sx={thSx}>Adjustments</TableCell>
                <TableCell sx={thSx} align="right">
                  Allowed
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Paid
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Patient Resp
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {remits.map((remit) => {
                const eraId = remit.paymentReconciliationId;
                const highlighted = !!highlight?.claimResponseId && highlight.claimResponseId === remit.claimResponseId;
                return (
                  <TableRow
                    key={remit.claimResponseId}
                    selected={highlighted}
                    onClick={eraId ? () => openEraInNewTab(eraId) : undefined}
                    sx={eraRowSx(!!eraId, highlighted)}
                  >
                    <TableCell>{formatDate(remit.date) || '-'}</TableCell>
                    <TableCell>{formatDate(remit.checkDate) || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{remit.payerName || '-'}</span>
                        {remit.eraStatusCode && <EraStatusChip statusCode={remit.eraStatusCode} />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <CheckLink paymentReconciliationId={eraId} checkNumber={remit.checkNumber} />
                    </TableCell>
                    <TableCell>
                      {remit.adjustments.length === 0 ? (
                        '-'
                      ) : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {aggregateAdjustments(remit.adjustments).map((adjustment) => (
                            <AdjustmentChip
                              key={adjustmentCode(adjustment)}
                              groupCode={adjustment.groupCode}
                              label={formatAdjustment(adjustment)}
                            />
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {remit.allowed === null ? (
                        '-'
                      ) : (
                        <AmountChip label={formatCurrency(remit.allowed)} color="success" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <AmountChip label={formatCurrency(remit.paid)} color="primary" />
                    </TableCell>
                    <TableCell align="right">
                      {remit.patientResp === null ? (
                        '-'
                      ) : (
                        <AmountChip
                          label={formatCurrency(remit.patientResp)}
                          color={remit.patientResp !== 0 ? 'warning' : 'default'}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ReadOnlySection>
  );
}

export function InsurancePaymentsSection({ payments }: { payments: ClaimInsurancePayment[] }): ReactElement {
  const highlight = useRemitHighlight();
  return (
    <ReadOnlySection title="Insurance Payments">
      {payments.length === 0 ? (
        'No insurance payments yet'
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Insurance payments">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Remit Date</TableCell>
                <TableCell sx={thSx}>Check Date</TableCell>
                <TableCell sx={thSx}>Payer</TableCell>
                <TableCell sx={thSx}>Check Number</TableCell>
                <TableCell sx={thSx} align="right">
                  Check Amount
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => {
                const eraId = payment.paymentReconciliationId;
                const highlighted = !!highlight?.paymentReconciliationId && highlight.paymentReconciliationId === eraId;
                return (
                  <TableRow
                    key={eraId}
                    selected={highlighted}
                    onClick={eraId ? () => openEraInNewTab(eraId) : undefined}
                    sx={eraRowSx(!!eraId, highlighted)}
                  >
                    <TableCell>{formatDate(payment.remitDate) || '-'}</TableCell>
                    <TableCell>{formatDate(payment.checkDate) || '-'}</TableCell>
                    <TableCell>{payment.payerName || '-'}</TableCell>
                    <TableCell>
                      <CheckLink paymentReconciliationId={eraId} checkNumber={payment.checkNumber} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} component="span">
                        {formatCurrency(payment.paymentAmount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ReadOnlySection>
  );
}
