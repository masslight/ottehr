import { Medication, MedicationAdministration, MedicationStatement } from 'fhir/r4b';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { fetchScopedResources } from '../../../adhoc-report';
import { vaccineOrderRecord } from '../../encounter-clinical-orders';
import { defineEncounterLayer } from '../context';
import { hasChartTag, indexByEncounter, stripEnc } from '../helpers';

// Vaccines given (or not given) on the visit, and vaccine history charted on it.
export const immunizationsLayer = defineEncounterLayer<{
  medAdminsByEncounterId: Map<string, MedicationAdministration[]>;
  medStatementsByEncounterId: Map<string, MedicationStatement[]>;
}>({
  id: 'immunizations',
  fetch: async (ctx) => {
    const [administrations, statements] = await Promise.all([
      ctx.shared.medicationAdministrations(),
      fetchScopedResources<MedicationStatement>(ctx.oystehr, 'MedicationStatement', 'context', ctx.encRefs),
    ]);
    return {
      medAdminsByEncounterId: administrations.byEncounter,
      medStatementsByEncounterId: indexByEncounter(statements, (m) => stripEnc(m.context?.reference)),
    };
  },
  map: (input, out) => {
    const { encounter } = input;
    const { medAdminsByEncounterId, medStatementsByEncounterId } = out;
    const row: Partial<AdHocEncounterRow> = {};
    type VaccineRecord = NonNullable<AdHocEncounterRow['vaccines']>[number];

    const emptyVaccineDetail = {
      visDate: null,
      lotNumber: null,
      expirationDate: null,
      ndc: null,
      cvx: null,
      mvx: null,
      manufacturer: null,
      dose: null,
      units: null,
      route: null,
      bodySite: null,
      instructions: null,
      administeredAt: null,
      administeredBy: null,
      orderedAt: null,
      orderedBy: null,
      cptCodes: [] as string[],
    };

    const vaccines: VaccineRecord[] = [];
    const vaccinesNotGiven: NonNullable<AdHocEncounterRow['vaccinesNotGiven']> = [];

    for (const ma of encounter.id ? medAdminsByEncounterId.get(encounter.id) ?? [] : []) {
      if (ma.status === 'entered-in-error' || !hasChartTag(ma, 'immunization')) continue;

      const record = vaccineOrderRecord(ma);

      if (record && 'given' in record) {
        vaccines.push(record.given);
      } else if (record) {
        vaccinesNotGiven.push(record.notGiven);
      }
    }

    for (const ms of encounter.id ? medStatementsByEncounterId.get(encounter.id) ?? [] : []) {
      if (ms.status === 'entered-in-error' || !hasChartTag(ms, 'immunization')) continue;

      // An administration echo (partOf → MedicationAdministration) is already counted above.
      if (ms.partOf?.some((r) => r.reference?.startsWith('MedicationAdministration/'))) continue;

      const containedMed = ms.contained?.find((c): c is Medication => c.resourceType === 'Medication');

      const name =
        ms.medicationCodeableConcept?.coding?.[0]?.display ||
        ms.medicationCodeableConcept?.text ||
        getMedicationName(containedMed) ||
        '';

      // Charted history, not an administration on this visit: no VIS and no vial of ours.
      if (name) vaccines.push({ name, status: 'recorded', ...emptyVaccineDetail });
    }
    row.vaccines = vaccines;
    row.vaccinesNotGiven = vaccinesNotGiven;
    row.vaccineNames = Array.from(new Set([...vaccines, ...vaccinesNotGiven].map((v) => v.name)));
    return row;
  },
});
