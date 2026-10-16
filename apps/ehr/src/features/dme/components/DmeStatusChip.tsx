import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DME_ORDER_STATUS_LABELS, DmeOrderStatus } from 'utils/lib/types/api/dme.types';

const STATUS_COLORS: Record<DmeOrderStatus, { backgroundColor: string; color: string }> = {
  [DmeOrderStatus.pending]: { backgroundColor: '#E6E8EE', color: '#616161' },
  [DmeOrderStatus.dispensed]: { backgroundColor: '#C8E6C9', color: '#1B5E20' },
  [DmeOrderStatus.ordered]: { backgroundColor: '#BBDEFB', color: '#0057B2' },
};

interface DmeStatusChipProps {
  status: DmeOrderStatus;
  dataTestId?: string;
}

export const DmeStatusChip = ({ status, dataTestId }: DmeStatusChipProps): ReactElement => (
  <Chip
    size="small"
    label={DME_ORDER_STATUS_LABELS[status].toUpperCase()}
    data-testid={dataTestId ?? dataTestIds.dmeOrders.statusChip}
    sx={{ ...STATUS_COLORS[status], fontWeight: 'bold', borderRadius: '4px' }}
  />
);
