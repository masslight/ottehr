import { DateTime } from 'luxon';
import { Option } from 'src/components/input/Option';
import { usePatientLabOrders } from '../external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from '../in-house-labs/components/orders/useInHouseLabOrders';
import { useGetNursingOrders } from '../nursing-orders/components/orders/useNursingOrders';
import { usePatientRadiologyOrders } from '../radiology/components/usePatientRadiologyOrders';
import { useChartData } from '../visits/shared/stores/appointment/appointment.store';

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

export function useNursingOrdersOptions(encounterId: string): {
  nursingOrdersLoading: boolean;
  nursingOrdersOptions: Option[];
} {
  const { nursingOrders, loading } = useGetNursingOrders({
    searchBy: { field: 'encounterId', value: encounterId },
  });
  return {
    nursingOrdersLoading: loading,
    nursingOrdersOptions: nursingOrders.map((order) => {
      return {
        label: order.note,
        value: 'ServiceRequest/' + order.serviceRequestId,
      };
    }),
  };
}

export function useRadiologyOrdersOptions(encounterId: string): {
  radiologyOrdersLoading: boolean;
  radiologyOrdersOptions: Option[];
} {
  const { orders, loading } = usePatientRadiologyOrders({
    encounterIds: encounterId,
  });
  return {
    radiologyOrdersLoading: loading,
    radiologyOrdersOptions: orders.map((order) => {
      return {
        label: order.studyType,
        value: 'ServiceRequest/' + order.serviceRequestId,
      };
    }),
  };
}

export function useProceduresOptions(encounterId: string): {
  proceduresLoading: boolean;
  proceduresOptions: Option[];
} {
  const { chartData, isLoading } = useChartData({ encounterId });
  return {
    proceduresLoading: isLoading,
    proceduresOptions: (chartData?.procedures ?? []).map((procedure) => {
      return {
        label: procedure.procedureType ?? '',
        value: 'Procedure/' + procedure.resourceId,
      };
    }),
  };
}
