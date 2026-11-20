import { Procedure, ServiceRequest } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { chartDataResourceHasMetaTagByCode, makeProceduresDTOFromFhirResources } from '../../../chart-data';
import { defineEncounterLayer } from '../context';
import { isActiveOrder } from '../helpers';

// Completed procedures of the visit, as the chart's procedures section reads them.
export const proceduresLayer = defineEncounterLayer<{
  serviceRequestsByEncounterId: Map<string, ServiceRequest[]>;
  proceduresByEncounterId: Map<string, Procedure[]>;
}>({
  id: 'procedures',
  fetch: async (ctx) => {
    // Procedures link their CPT codes (Procedure) and diagnoses (Condition) the same way the codes layer does.
    const [serviceRequestsByEncounterId, proceduresByEncounterId] = await Promise.all([
      ctx.shared.serviceRequests(),
      ctx.shared.procedures(),
      ctx.shared.diagnoses(),
    ]);
    return { serviceRequestsByEncounterId, proceduresByEncounterId };
  },
  map: (input, out, ctx) => {
    const { encounter } = input;
    const { serviceRequestsByEncounterId, proceduresByEncounterId } = out;
    const conditionById = ctx.conditions.map;
    const srs = (encounter.id ? serviceRequestsByEncounterId.get(encounter.id) ?? [] : []).filter(isActiveOrder);
    const row: Partial<AdHocEncounterRow> = {};
    // As the tracking board and the chart's procedures section: completed procedure ServiceRequests,
    // mapped with the chart's DTO builder (CPT codes via supportingInfo, diagnoses via reasonReference).
    const procedureRequests = srs.filter(
      (sr) => sr.status === 'completed' && chartDataResourceHasMetaTagByCode(sr, 'procedure')
    );

    const procedures = procedureRequests.length
      ? makeProceduresDTOFromFhirResources(encounter, [
          ...procedureRequests,
          ...(encounter.id ? proceduresByEncounterId.get(encounter.id) ?? [] : []),
          ...Array.from(conditionById.values()),
        ]) ?? []
      : [];

    row.procedures = procedures.map((p) => ({
      type: p.procedureType ?? '',
      cptCodes: (p.cptCodes ?? []).map((c) => c.code).filter(Boolean),
      icdCodes: (p.diagnoses ?? []).map((d) => d.code).filter(Boolean),
      performedAt: p.procedureDateTime ?? null,
      performerType: p.performerType ?? '',
      bodySite: p.bodySite ?? '',
      bodySide: p.bodySide ?? '',
      technique: p.technique ?? [],
      medicationUsed: p.medicationUsed ?? '',
      suppliesUsed: p.suppliesUsed ?? '',
      lengthCm: typeof p.lengthCm === 'number' && Number.isFinite(p.lengthCm) ? p.lengthCm : null,
      repairDepth: p.repairDepth ?? '',
      infusionStartTime: p.infusionStartTime || null,
      infusionStopTime: p.infusionStopTime || null,
      procedureDetails: p.procedureDetails ?? '',
      timeSpent: p.timeSpent ?? '',
      complications: p.complications ?? '',
      patientResponse: p.patientResponse ?? '',
      postInstructions: p.postInstructions ?? '',
      consentObtained: p.consentObtained ?? null,
      specimenSent: p.specimenSent ?? null,
      documentedBy: p.documentedBy ?? '',
      documentedAt: p.documentedDateTime || null,
    }));

    row.procedureTypes = row.procedures.map((p) => p.type);
    row.procedureCount = row.procedures.length;
    return row;
  },
});
