import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { DataComposer } from '../../pdf-common';
import { DmeOrdersData } from '../../types';
import { composeDmeOrders } from '../visit-note/dme';

// The patient leaves with dispensed equipment only; pending and third-party orders stay off the summary.
export const composeDmeOrdersForDischargeSummary: DataComposer<{ dmeOrders?: DmeOrderDTO[] }, DmeOrdersData> = ({
  dmeOrders,
}) => composeDmeOrders({ dmeOrders: dmeOrders?.filter((order) => order.status === DmeOrderStatus.dispensed) });
