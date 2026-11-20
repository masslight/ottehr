import { FhirResource, MedicationAdministration, MedicationRequest, MedicationStatement } from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE } from 'utils/lib/fhir/constants';
import {
  getCurrentOrderedByProviderId,
  getPractitionerIdThatOrderedMedication,
  getProviderIdAndDateMedicationWasAdministered,
} from 'utils/lib/fhir/medication-administration';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import { fetchScopedResources } from '../../../adhoc-report';
import { erxDrugRecord, inHouseDrugRecord } from '../../encounter-clinical-orders';
import { defineEncounterLayer, EncounterReportContext, MedicationAdministrationBundle } from '../context';
import {
  conditionIdFromRef,
  hasChartTag,
  indexByEncounter,
  normalizeDrugName,
  practitionerIdFromRef,
  stripEnc,
} from '../helpers';

interface MedicationsOut {
  requestsByEncounterId: Map<string, MedicationRequest[]>;
  administrations: MedicationAdministrationBundle;
  /** Built on the first row: what buildOrderPackage reads for one order, looked up by reference. */
  lookup?: { byRef: Map<string, FhirResource>; statementByMaRef: Map<string, MedicationStatement> };
}

// Only what buildOrderPackage reads for one order: its patient, its practitioners, its MedicationRequest and its
// administration MedicationStatement — so mapping an order never scans every resource of the report.
function orderLookup(out: MedicationsOut, ctx: EncounterReportContext): NonNullable<MedicationsOut['lookup']> {
  if (out.lookup) return out.lookup;
  const resources: FhirResource[] = [
    ...out.administrations.resources,
    ...ctx.root.patientMap.values(),
    ...ctx.practitioners.map.values(),
  ];
  const byRef = new Map(resources.map((r) => [`${r.resourceType}/${r.id}`, r]));
  const statementByMaRef = new Map<string, MedicationStatement>();

  for (const r of out.administrations.resources) {
    if (r.resourceType !== 'MedicationStatement') continue;
    for (const part of r.partOf ?? []) if (part.reference) statementByMaRef.set(part.reference, r);
  }

  out.lookup = { byRef, statementByMaRef };
  return out.lookup;
}

// Prescriptions (eRx) and in-house medication orders of the visit, with the staff who ordered / gave them and the
// diagnosis each drug was given for.
export const medicationsLayer = defineEncounterLayer<MedicationsOut>({
  id: 'medications',
  fetch: async (ctx) => {
    // The prescriptions as get-erx-orders / the tracking board search them: only eRx-tagged requests (the
    // in-house medication orders also carry a MedicationRequest on the encounter, read via their MA).
    const [requests, administrations] = await Promise.all([
      fetchScopedResources<MedicationRequest>(ctx.oystehr, 'MedicationRequest', 'encounter', ctx.encRefs, [
        { name: '_tag', value: ERX_MEDICATION_META_TAG_CODE },
      ]),
      ctx.shared.medicationAdministrations(),
    ]);

    const requestsByEncounterId = indexByEncounter(requests, (m) => stripEnc(m.encounter?.reference));

    // Names of the staff who ordered / administered, and the diagnosis each drug was given for.
    const practitionerIds: (string | undefined)[] = [];
    const drugConditionIds: (string | undefined)[] = [];

    for (const mas of administrations.byEncounter.values()) {
      for (const ma of mas) {
        practitionerIds.push(
          getProviderIdAndDateMedicationWasAdministered(ma)?.administeredProviderId,
          getCurrentOrderedByProviderId(ma),
          getPractitionerIdThatOrderedMedication(ma)
        );
        drugConditionIds.push(conditionIdFromRef(ma.reasonReference?.[0]?.reference));
      }
    }

    for (const req of requests) practitionerIds.push(practitionerIdFromRef(req.requester?.reference));

    await Promise.all([ctx.practitioners.load(practitionerIds), ctx.conditions.load(drugConditionIds)]);

    return { requestsByEncounterId, administrations };
  },
  map: ({ encounter }, out, ctx) => {
    const drugs: NonNullable<AdHocEncounterRow['drugs']> = [];
    const medicationCodes: string[] = [];

    for (const req of encounter.id ? out.requestsByEncounterId.get(encounter.id) ?? [] : []) {
      if (req.status === 'entered-in-error') continue;

      const erx = erxDrugRecord(req, ctx.practitioners.map);

      if (!erx) continue;

      drugs.push(erx.record);

      if (erx.code) medicationCodes.push(erx.code);
    }

    const orderResourcesOf = (ma: MedicationAdministration): FhirResource[] => {
      const { byRef, statementByMaRef } = orderLookup(out, ctx);
      const refs = [
        ma.subject?.reference,
        ma.request?.reference,
        ...(ma.performer ?? []).map((p) => p.actor?.reference),
      ].filter((ref): ref is string => !!ref);
      const statement = statementByMaRef.get(`MedicationAdministration/${ma.id}`);
      return [
        ...refs.map((ref) => byRef.get(ref)).filter((r): r is FhirResource => !!r),
        ...(statement ? [statement] : []),
      ];
    };

    for (const ma of encounter.id ? out.administrations.byEncounter.get(encounter.id) ?? [] : []) {
      if (ma.status === 'entered-in-error') continue;

      if (!hasChartTag(ma, MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE)) continue;

      const record = inHouseDrugRecord(ma, orderResourcesOf(ma), ctx.conditions.map);

      if (record) drugs.push(record);
    }

    return {
      medications: drugs.map((d) => d.name),
      medicationIngredients: drugs.map((d) => normalizeDrugName(d.name)),
      medicationSources: drugs.map((d) => d.source),
      medicationCodes,
      medicationCount: drugs.length,
      drugs,
    };
  },
});
