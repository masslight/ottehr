import { Button, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { isInvoiceableClaimStatus } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { useInvoicingInBillingApp } from '../hooks/useInvoicingInBillingApp';
import { InvoiceStatusChip } from '../pages/InvoicesList';
import { formatDate } from '../utils/format';
import { ReadOnlySection, thSx } from './ReadOnlySection';
import { SendInvoiceDialog } from './SendInvoiceDialog';

export function ClaimInvoicesSection({
  claim,
  refetchClaim,
}: {
  claim: ClaimDetailResponse;
  refetchClaim: () => Promise<void>;
}): ReactElement | null {
  const invoicingInBillingApp = useInvoicingInBillingApp();
  const [sending, setSending] = useState(false);

  if (!invoicingInBillingApp) return null;

  return (
    <>
      <ReadOnlySection
        title="Invoices"
        action={
          <Button
            size="small"
            variant="contained"
            disabled={!isInvoiceableClaimStatus(claim.statuses)}
            onClick={() => setSending(true)}
          >
            Send Invoice
          </Button>
        }
      >
        {claim.invoices.length === 0 ? (
          'No invoices yet'
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Issued</TableCell>
                  <TableCell sx={thSx}>Due</TableCell>
                  <TableCell sx={thSx}>Status</TableCell>
                  <TableCell sx={thSx}>Invoice</TableCell>
                  <TableCell sx={thSx} align="right">
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claim.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{DateTime.fromISO(invoice.issueDate).toFormat('MM/dd/yyyy')}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>
                      <InvoiceStatusChip status={invoice.status} />
                    </TableCell>
                    <TableCell>
                      {invoice.hostedInvoiceUrl ? (
                        <Link href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener" underline="hover">
                          View
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(invoice.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ReadOnlySection>
      {sending && (
        <SendInvoiceDialog
          claim={{ id: claim.id, claimBalance: claim.balance }}
          onClose={() => setSending(false)}
          onSent={() => {
            setSending(false);
            void refetchClaim();
          }}
        />
      )}
    </>
  );
}
