import { DateTime } from 'luxon';
import { Option } from 'src/components/input/Option';
import { IN_HOUSE_LAB_TASK, LAB_ORDER_TASK, MANUAL_TASK } from 'utils';
import { usePatientLabOrders } from '../external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from '../in-house-labs/components/orders/useInHouseLabOrders';
import { useGetNursingOrders } from '../nursing-orders/components/orders/useNursingOrders';
import { usePatientRadiologyOrders } from '../radiology/components/usePatientRadiologyOrders';
import { useGetMedicationOrders } from '../visits/shared/stores/appointment/appointment.queries';
import { useChartData } from '../visits/shared/stores/appointment/appointment.store';

export const TASK_CATEGORY_LABEL: Record<string, string> = {
  [LAB_ORDER_TASK.category]: 'External Lab',
  [IN_HOUSE_LAB_TASK.category]: 'In-house Lab',
  [MANUAL_TASK.category.externalLab]: 'External Lab',
  [MANUAL_TASK.category.inHouseLab]: 'In-house Lab',
  [MANUAL_TASK.category.inHouseMedications]: 'In-House Medications',
  [MANUAL_TASK.category.nursingOrders]: 'Nursing Orders',
  [MANUAL_TASK.category.patientFollowUp]: 'Patient Follow-up',
  [MANUAL_TASK.category.procedures]: 'Procedures',
  [MANUAL_TASK.category.radiology]: 'Radiology',
  [MANUAL_TASK.category.erx]: 'eRX',
  [MANUAL_TASK.category.charting]: 'Charting',
  [MANUAL_TASK.category.coding]: 'Coding',
  [MANUAL_TASK.category.other]: 'Other',
};

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
        value: order.serviceRequestId,
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
          value: 'drCentricResultType' in order ? order.resultsDetails?.[0].diagnosticReportId : order.serviceRequestId,
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
        value: order.serviceRequestId,
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
        value: order.serviceRequestId,
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
        value: procedure.resourceId ?? '',
      };
    }),
  };
}

export function useInHouseMedicationsOptions(encounterId: string): {
  inHouseMedicationsLoading: boolean;
  inHouseMedicationsOptions: Option[];
} {
  const { data, isLoading } = useGetMedicationOrders({
    field: 'encounterId',
    value: encounterId,
  });
  return {
    inHouseMedicationsLoading: isLoading,
    inHouseMedicationsOptions: (data?.orders ?? []).map((order) => {
      return {
        label: order.medicationName,
        value: order.medicationId ?? '',
      };
    }),
  };
}
