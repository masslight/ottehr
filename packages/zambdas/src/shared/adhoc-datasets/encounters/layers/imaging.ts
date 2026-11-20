import { DiagnosticReport, DocumentReference, Encounter, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { ORDER_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { fetchOrdersByAuthoredDate, fetchScopedResources } from '../../../adhoc-report';
import { radiologyStudyRecords } from '../../encounter-clinical-orders';
import { defineEncounterLayer } from '../context';
import { indexByEncounter, isActiveOrder, orderDisplay, stripEnc } from '../helpers';

interface ImagingOut {
  radiologyRequestsByEncounterId: Map<string, ServiceRequest[]>;
  radiologyPool: { tasks: Task[]; diagnosticReports: DiagnosticReport[]; documentReferences: DocumentReference[] };
  /** Built on the first row: every practitioner and encounter of the report, as the study records look them up. */
  lookup?: { practitioners: Practitioner[]; encounters: Encounter[] };
}

// The radiology orders page's search (getRadiologyOrders). Cancelled (revoked) orders are kept: the dataset lists
// them, the page does not.
export const imagingLayer = defineEncounterLayer<ImagingOut>({
  id: 'imaging',
  fetch: async (ctx) => {
    const radiologyRequestsByEncounterId = new Map<string, ServiceRequest[]>();
    const radiologyPool: ImagingOut['radiologyPool'] = { tasks: [], diagnosticReports: [], documentReferences: [] };

    if (!ctx.encRefs.length) return { radiologyRequestsByEncounterId, radiologyPool };

    const radiologyParams = [
      { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
      { name: '_revinclude', value: 'Task:based-on' },
      { name: '_revinclude', value: 'DiagnosticReport:based-on' },
      { name: '_revinclude', value: 'DocumentReference:related' },
      { name: '_include', value: 'ServiceRequest:requester' },
    ];
    type RadiologyResource = ServiceRequest | Task | DiagnosticReport | DocumentReference | Practitioner;
    const radiology =
      (await fetchOrdersByAuthoredDate<RadiologyResource>(ctx.oystehr, ctx.dateRange, radiologyParams)) ??
      (await fetchScopedResources<RadiologyResource>(
        ctx.oystehr,
        'ServiceRequest',
        'encounter',
        ctx.encRefs,
        radiologyParams
      ));

    // Practitioners from the radiology search land after the root's own (rootLookups).
    await ctx.rootLookups();
    const requests: ServiceRequest[] = [];

    for (const r of radiology) {
      switch (r.resourceType) {
        case 'ServiceRequest': {
          const encounterId = stripEnc(r.encounter?.reference);
          if (encounterId && ctx.root.encounterById.has(encounterId)) requests.push(r);
          break;
        }
        case 'Task':
          radiologyPool.tasks.push(r);
          break;
        case 'DiagnosticReport':
          if (r.status !== 'entered-in-error') radiologyPool.diagnosticReports.push(r);
          break;
        case 'DocumentReference':
          radiologyPool.documentReferences.push(r);
          break;
        case 'Practitioner':
          ctx.practitioners.add([r]);
          break;
      }
    }

    for (const [encounterId, list] of indexByEncounter(requests, (r) => stripEnc(r.encounter?.reference))) {
      radiologyRequestsByEncounterId.set(encounterId, list);
    }

    return { radiologyRequestsByEncounterId, radiologyPool };
  },
  map: ({ encounter }, out, ctx) => {
    out.lookup ??= {
      practitioners: Array.from(ctx.practitioners.map.values()),
      encounters: Array.from(ctx.root.encounterById.values()),
    };
    const radiologyRequests = encounter.id ? out.radiologyRequestsByEncounterId.get(encounter.id) ?? [] : [];
    const imagingOrders = radiologyRequests.filter(isActiveOrder).map(orderDisplay).filter(Boolean);

    return {
      imagingOrders,
      imagingOrderCount: imagingOrders.length,
      imagingStudies: radiologyStudyRecords({
        serviceRequests: radiologyRequests,
        tasks: out.radiologyPool.tasks,
        diagnosticReports: out.radiologyPool.diagnosticReports,
        documentReferences: out.radiologyPool.documentReferences,
        practitioners: out.lookup.practitioners,
        encounters: out.lookup.encounters,
        nameOf: orderDisplay,
      }),
    };
  },
});
