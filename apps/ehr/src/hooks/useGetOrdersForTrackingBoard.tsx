import { useMemo } from 'react';
import { usePatientLabOrders } from 'src/features/external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from 'src/features/in-house-labs/components/orders/useInHouseLabOrders';
import { useGetNursingOrders } from 'src/features/nursing-orders/components/orders/useNursingOrders';
import { usePatientRadiologyOrders } from 'src/features/radiology/components/usePatientRadiologyOrders';
import { useGetMedicationOrders } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { OrdersForTrackingBoardTable } from 'utils';
import { useGetErxOrders } from './useGetErxOrders';

interface UseGetOrdersForTrackingBoardParams {
  encounterIds: string[];
  refreshKey: number;
}

export const useGetOrdersForTrackingBoard = (
  input: UseGetOrdersForTrackingBoardParams
): OrdersForTrackingBoardTable => {
  const { encounterIds, refreshKey } = input;

  const externalLabOrders = usePatientLabOrders({
    searchBy: { field: 'encounterIds', value: encounterIds },
    itemsPerPage: 100,
    refreshKey,
  });

  const inHouseOrders = useInHouseLabOrders({
    searchBy: { field: 'encounterIds', value: encounterIds },
    itemsPerPage: 100,
    refreshKey,
  });

  const { nursingOrders } = useGetNursingOrders({
    searchBy: { field: 'encounterIds', value: encounterIds },
    refreshKey,
  });

  const { data: inHouseMedications } = useGetMedicationOrders(
    {
      field: 'encounterIds',
      value: encounterIds,
    },
    refreshKey
  );

  const { orders: radiologyOrders } = usePatientRadiologyOrders({ encounterIds, refreshKey });

  const { data: erxOrders } = useGetErxOrders({ encounterIds, refreshKey });

  return useMemo(
    () => ({
      externalLabOrdersByAppointmentId: groupByAppointmentId(externalLabOrders?.labOrders),
      inHouseLabOrdersByAppointmentId: groupByAppointmentId(inHouseOrders?.labOrders),
      nursingOrdersByAppointmentId: groupByAppointmentId(nursingOrders),
      inHouseMedicationsByEncounterId: groupByEncounterId(inHouseMedications?.orders),
      radiologyOrdersByAppointmentId: groupByAppointmentId(radiologyOrders),
      erxOrdersByEncounterId: groupByEncounterId(erxOrders?.orders),
    }),
    [
      externalLabOrders?.labOrders,
      inHouseOrders?.labOrders,
      nursingOrders,
      inHouseMedications?.orders,
      radiologyOrders,
      erxOrders?.orders,
    ]
  );
};

const groupByAppointmentId = <T extends { appointmentId: string }>(items?: T[]): Record<string, T[]> =>
  items?.reduce(
    (acc, item) => {
      acc[item.appointmentId] = [...(acc[item.appointmentId] || []), item];
      return acc;
    },
    {} as Record<string, T[]>
  ) ?? {};

const groupByEncounterId = <T extends { encounterId?: string }>(items?: T[]): Record<string, T[]> =>
  items?.reduce(
    (acc, item) => {
      const id = item.encounterId ?? '';
      acc[id] = [...(acc[id] || []), item];
      return acc;
    },
    {} as Record<string, T[]>
  ) ?? {};
