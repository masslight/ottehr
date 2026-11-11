import { ServiceRequest } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { EncounterOrderRecords } from '../../encounter-orders';
import { defineEncounterLayer } from '../context';
import { isActiveOrder, orderDisplay } from '../helpers';

// Nursing orders of the visit.
export const nursingLayer = defineEncounterLayer<{
  serviceRequestsByEncounterId: Map<string, ServiceRequest[]>;
  ordersByEncounterId: Map<string, EncounterOrderRecords>;
}>({
  id: 'nursing',
  fetch: async (ctx) => {
    const [serviceRequestsByEncounterId, ordersByEncounterId] = await Promise.all([
      ctx.shared.serviceRequests(),
      ctx.shared.encounterOrders(),
    ]);
    return { serviceRequestsByEncounterId, ordersByEncounterId };
  },
  map: (input, out) => {
    const { encounter } = input;
    const { serviceRequestsByEncounterId, ordersByEncounterId } = out;
    const srs = (encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []).filter(isActiveOrder);
    const row: Partial<AdHocEncounterRow> = {};
    const nursingOrders = srs
      .filter((sr) => sr.meta?.tag?.some((t) => t.code?.includes('nursing')))
      .map(orderDisplay)
      .filter(Boolean);
    row.nursingOrders = nursingOrders;
    row.nursingOrderCount = nursingOrders.length;
    row.nursingOrderDetails = (encounter.id ? ordersByEncounterId.get(encounter.id)?.nursingOrders : undefined) ?? [];
    return row;
  },
});
