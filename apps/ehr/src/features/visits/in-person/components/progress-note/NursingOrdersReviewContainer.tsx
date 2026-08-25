import { Box, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { NursingOrdersStatusChip } from 'src/features/nursing-orders/components/NursingOrdersStatusChip';
import { useGetNursingOrders } from 'src/features/nursing-orders/components/orders/useNursingOrders';
import { SectionHeading } from 'src/features/visits/shared/components/NoteSectionHeading';
import { NursingOrder } from 'utils/lib/types/data/orders/types';
import { NotVisibleToPatientLabel } from './NotVisibleToPatientLabel';

const formatOrderedAt = (order: NursingOrder): string => {
  const ordered = DateTime.fromISO(order.orderAddedDate);
  if (!order.orderAddedDate || !ordered.isValid) return '';
  return ordered.setZone(order.encounterTimezone).toFormat('MM/dd/yyyy hh:mm a');
};

interface NursingOrdersReviewContainerProps {
  encounterId?: string;
}

// Nursing orders are staff-facing only: they're summarized here for the provider signing
// the note, but are deliberately left out of the visit note / discharge PDFs.
export const NursingOrdersReviewContainer: FC<NursingOrdersReviewContainerProps> = ({ encounterId }) => {
  const theme = useTheme();
  const { nursingOrders, loading } = useGetNursingOrders({
    searchBy: { field: 'encounterId', value: encounterId ?? '' },
  });

  const orders: NursingOrder[] = Array.isArray(nursingOrders) ? nursingOrders : [];
  // The hook never starts (and so never clears its loading flag) without an encounter id.
  const isLoading = loading && !!encounterId;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.progressNotePage.nursingOrdersContainer}
    >
      <SectionHeading>Nursing Orders</SectionHeading>
      <NotVisibleToPatientLabel />
      {isLoading && <Typography color={theme.palette.text.secondary}>Loading nursing orders...</Typography>}
      {!isLoading && orders.length === 0 && (
        <Typography color={theme.palette.text.secondary}>No nursing orders</Typography>
      )}
      {orders.map((order) => {
        const orderedAt = formatOrderedAt(order);
        return (
          <Box
            key={order.serviceRequestId}
            sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}
            data-testid={dataTestIds.progressNotePage.nursingOrderItem}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ whiteSpace: 'pre-line' }}>{order.note}</Typography>
              {(orderedAt || order.orderingPhysician) && (
                <Typography variant="body2" color={theme.palette.text.secondary}>
                  {[orderedAt, order.orderingPhysician].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Box>
            {order.status && <NursingOrdersStatusChip status={order.status} />}
          </Box>
        );
      })}
    </Box>
  );
};
