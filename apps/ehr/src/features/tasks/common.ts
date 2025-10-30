import { DateTime } from 'luxon';
import { Option } from 'src/components/input/Option';
import { usePatientLabOrders } from '../external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from '../in-house-labs/components/orders/useInHouseLabOrders';

export function formatDate(dateIso: string): string {
  return DateTime.fromISO(dateIso).toFormat('MM/dd/yyyy h:mm a');
}

export function useInHouseLabOrdersOptions(encounterId: string): {
  inHouseLabOrdersLoading: boolean;
  inHouseLabOrdersOptions: Option[];
} {
  const { labOrders, loading } = useInHouseLabOrders({
    searchBy: {
      field: 'encounterId',
      value: encounterId,
    },
  });
  return {
    inHouseLabOrdersLoading: loading,
    inHouseLabOrdersOptions: labOrders.map((order) => {
      return {
        label: order.testItemName,
        value: 'ServiceRequest/' + order.serviceRequestId,
      };
    }),
  };
}

export function useExternalLabOrdersOptions(encounterId: string): {
  externalLabOrdersLoading: boolean;
  externalLabOrdersOptions: Option[];
} {
  const { groupedLabOrdersForChartTable, loading } = usePatientLabOrders({
    searchBy: {
      field: 'encounterId',
      value: encounterId,
    },
  });
  return {
    externalLabOrdersLoading: loading,
    externalLabOrdersOptions: [
      ...Object.values(groupedLabOrdersForChartTable?.hasResults ?? {}),
      ...Object.values(groupedLabOrdersForChartTable?.pendingActionOrResults ?? {}),
    ]
      .flatMap((orderBundle) => orderBundle.orders)
      .map((order) => {
        return {
          label: order.testItem,
          value:
            'drCentricResultType' in order
              ? 'DiagnosticReport/' + order.resultsDetails?.[0].diagnosticReportId
              : 'ServiceRequest/' + order.serviceRequestId,
        };
      }),
  };
}
