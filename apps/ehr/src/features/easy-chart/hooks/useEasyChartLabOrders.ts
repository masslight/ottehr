// The encounter's lab orders — in-house and send-out — flattened into one list for the note.
//
// NOT CHART DATA. `get-chart-data` returns lab RESULTS; the ORDERS live in their own two list endpoints,
// which is why the note has two lab sections rather than one. The same test legitimately appears in
// both: "Labs ordered" says it was ordered, "Lab Results" says what came back. A note that shows only
// results is silent about an order still in flight.
//
// EACH CALL IS BEST-EFFORT AND INDEPENDENT. The two lab subsystems fail separately, and one being
// unavailable must not hide the other — a provider seeing an empty section would read it as "nothing
// was ordered", which is a different fact from "we could not ask".

import { useQuery } from '@tanstack/react-query';
import { getExternalLabOrders, getInHouseOrders } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { EasyChartLabOrder } from '../components/NotePane';

export interface EasyChartLabOrders {
  orders: EasyChartLabOrder[];
  refetch: () => void;
}

export function useEasyChartLabOrders(encounterId: string | undefined): EasyChartLabOrders {
  const { oystehrZambda } = useApiClients();

  const { data, refetch } = useQuery({
    queryKey: ['easy-chart-lab-orders', encounterId],
    queryFn: async (): Promise<EasyChartLabOrder[]> => {
      if (!oystehrZambda || !encounterId) return [];
      const searchBy = { searchBy: { field: 'encounterId', value: encounterId } } as const;
      const [inHouse, external] = await Promise.all([
        getInHouseOrders(oystehrZambda, searchBy).catch((error) => {
          console.error('[easy-chart] in-house lab orders could not be loaded', error);
          return null;
        }),
        getExternalLabOrders(oystehrZambda, searchBy).catch((error) => {
          console.error('[easy-chart] send-out lab orders could not be loaded', error);
          return null;
        }),
      ]);

      const orders: EasyChartLabOrder[] = [];
      for (const order of inHouse?.data ?? []) {
        orders.push({
          serviceRequestId: order.serviceRequestId,
          kind: 'in-house',
          testName: order.testItemName,
          status: order.status,
        });
      }
      for (const order of external?.data ?? []) {
        orders.push({
          serviceRequestId: order.serviceRequestId,
          kind: 'external',
          testName: order.testItem,
          labName: order.fillerLab,
          status: order.orderStatus,
        });
      }
      return orders;
    },
    enabled: Boolean(oystehrZambda && encounterId),
  });

  return { orders: data ?? [], refetch: () => void refetch() };
}
