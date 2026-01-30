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
  refreshKey: number; // drives the refetch for apis not migrated to react query
}

interface UseGetOrdersForTrackingBoardOutput {
  orders: OrdersForTrackingBoardTable;
  refetchOrders: () => Promise<void>;
}

export const useGetOrdersForTrackingBoard = (
  input: UseGetOrdersForTrackingBoardParams
): UseGetOrdersForTrackingBoardOutput => {
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

  const medicationOrdersQuery = useGetMedicationOrders({
    field: 'encounterIds',
    value: encounterIds,
  });

  const { orders: radiologyOrders } = usePatientRadiologyOrders({ encounterIds, refreshKey });

  const erxOrdersQuery = useGetErxOrders({ encounterIds });

  const orders = useMemo(
    () => ({
      externalLabOrdersByAppointmentId: groupByAppointmentId(externalLabOrders?.labOrders),
      inHouseLabOrdersByAppointmentId: groupByAppointmentId(inHouseOrders?.labOrders),
      nursingOrdersByAppointmentId: groupByAppointmentId(nursingOrders),
      inHouseMedicationsByEncounterId: groupByEncounterId(medicationOrdersQuery.data?.orders),
      radiologyOrdersByAppointmentId: groupByAppointmentId(radiologyOrders),
      erxOrdersByEncounterId: groupByEncounterId(erxOrdersQuery.data?.orders),
    }),
    [
      externalLabOrders?.labOrders,
      inHouseOrders?.labOrders,
      nursingOrders,
      medicationOrdersQuery.data?.orders,
      radiologyOrders,
      erxOrdersQuery.data?.orders,
    ]
  );

  const refetchOrders = async (): Promise<void> => {
    await Promise.all([medicationOrdersQuery.refetch(), erxOrdersQuery.refetch()]);
  };

  return {
    orders,
    refetchOrders,
  };
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
