import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { DmeOrderDTO, formatDmeDuration } from 'utils/lib/types/api/dme.types';
import { useDmeOrders } from '../dme.queries';
import { DME_SECTION_TITLE } from './DmeBreadcrumbs';
import { DmeStatusChip } from './DmeStatusChip';

const orderSummaryLines = (order: DmeOrderDTO): string[] => {
  const details = [
    `Qty ${order.quantity}`,
    order.laterality && order.laterality !== 'NA' ? order.laterality : undefined,
    order.modifier,
    formatDmeDuration(order.duration),
  ].filter(Boolean);
  const lines = [
    details.join(' · '),
    order.billingCodes.length ? `HCPCS: ${order.billingCodes.map((code) => code.code).join(', ')}` : undefined,
    order.diagnoses.length
      ? `Dx: ${order.diagnoses.map((dx) => [dx.code, dx.display].filter(Boolean).join(' ')).join('; ')}`
      : undefined,
    order.external && order.thirdParty?.name ? `Third party: ${order.thirdParty.name}` : undefined,
  ];
  return lines.filter((line): line is string => !!line);
};

interface DmeOrdersReviewContainerProps {
  encounterId?: string;
}

export const DmeOrdersReviewContainer: FC<DmeOrdersReviewContainerProps> = ({ encounterId }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const theme = useTheme();
  // Same query as the orders table, so the collapsed summary lists every order the editor does.
  const { data: orders = [], isLoading, error } = useDmeOrders(encounterId);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}
      data-testid={dataTestIds.dmeOrders.reviewContainer}
    >
      {!titleInCardHeader && <SectionHeading>{DME_SECTION_TITLE}</SectionHeading>}
      {isLoading && <Typography color={theme.palette.text.secondary}>Loading DME orders...</Typography>}
      {!isLoading && error && <Typography color="error">Failed to load DME orders</Typography>}
      {!isLoading && !error && orders.length === 0 && (
        <Typography color={theme.palette.text.secondary}>No DME orders</Typography>
      )}
      {orders.map((order) => (
        <Box
          key={order.id}
          sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}
          data-testid={dataTestIds.dmeOrders.reviewItem(order.id)}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={500}>{order.itemName}</Typography>
            {orderSummaryLines(order).map((line) => (
              <Typography key={line} variant="body2" color={theme.palette.text.secondary}>
                {line}
              </Typography>
            ))}
          </Box>
          <DmeStatusChip status={order.status} />
        </Box>
      ))}
    </Box>
  );
};
