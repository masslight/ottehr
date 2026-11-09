import { ServiceRequest } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { EncounterOrderRecords } from '../../encounter-orders';
import { defineEncounterLayer } from '../context';
import { isActiveOrder, isLabOrder, orderDisplay } from '../helpers';

// Lab orders of the visit, and each lab test as the lab pages read it.
export const labsLayer = defineEncounterLayer<{
  serviceRequestsByEncounterId: Map<string, ServiceRequest[]>;
  ordersByEncounterId: Map<string, EncounterOrderRecords>;
}>({
  id: 'labs',
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
    const labOrders = srs.filter(isLabOrder).map(orderDisplay).filter(Boolean);
    row.labOrders = labOrders;
    row.labOrderCount = labOrders.length;
    const labTests = (encounter.id ? ordersByEncounterId.get(encounter.id)?.labTests : undefined) ?? [];
    row.labTests = labTests;
    row.labTestNames = labTests.map((test) => test.name);
    row.labNames = Array.from(new Set(labTests.map((test) => test.lab).filter(Boolean)));
    row.labResultComponents = Array.from(new Set(labTests.flatMap((test) => test.resultComponents)));
    return row;
  },
});
