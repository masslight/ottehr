import { ComponentProps, ReactElement } from 'react';
import { StatusChip } from 'src/components/StatusChip';
import { DME_ORDER_STATUS_LABELS, DmeOrderStatus } from 'utils/lib/types/api/dme.types';

const STATUS_STYLE: Record<DmeOrderStatus, ComponentProps<typeof StatusChip>['style']> = {
  [DmeOrderStatus.pending]: 'grey',
  [DmeOrderStatus.dispensed]: 'green',
  [DmeOrderStatus.ordered]: 'blue',
};

export const DmeStatusChip = ({ status }: { status: DmeOrderStatus }): ReactElement => (
  <StatusChip status={DME_ORDER_STATUS_LABELS[status]} style={STATUS_STYLE[status]} />
);
