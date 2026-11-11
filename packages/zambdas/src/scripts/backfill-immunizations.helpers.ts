import Oystehr from '@oystehr/sdk';
import { Immunization, MedicationAdministration } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getImmunizationAdministrationId,
  IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM,
  immunizationFromMedicationAdministration,
} from 'utils/lib/fhir/immunization';
import { IMMUNIZATION_ORDER_TAG_CODE, isImmunizationOrder } from 'utils/lib/fhir/medication-administration';

const BACKFILL_PAGE_SIZE = 100;

export interface ImmunizationBackfillStats {
  examined: number;
  created: number;
  existing: number;
  skipped: number;
  failed: number;
}

/**
 * The administered vaccine orders (administered or partly administered) without an Immunization linked to them.
 * Orders that are pending, not administered or cancelled never get one; an order whose Immunization exists is skipped,
 * so a run can be repeated.
 */
export function selectAdministrationsToBackfill(
  medicationAdministrations: MedicationAdministration[],
  existingImmunizations: Immunization[]
): { toCreate: MedicationAdministration[]; existing: number; skipped: number } {
  const linked = new Set(existingImmunizations.map(getImmunizationAdministrationId).filter(Boolean));
  const toCreate: MedicationAdministration[] = [];
  let existing = 0;
  let skipped = 0;
  for (const medicationAdministration of medicationAdministrations) {
    const administered =
      isImmunizationOrder(medicationAdministration) &&
      ['completed', 'on-hold'].includes(medicationAdministration.status) &&
      !!medicationAdministration.id;
    if (!administered) skipped += 1;
    else if (linked.has(medicationAdministration.id)) existing += 1;
    else toCreate.push(medicationAdministration);
  }
  return { toCreate, existing, skipped };
}

export async function backfillImmunizations(oystehr: Oystehr, dryRun: boolean): Promise<ImmunizationBackfillStats> {
  const stats: ImmunizationBackfillStats = { examined: 0, created: 0, existing: 0, skipped: 0, failed: 0 };
  let offset = 0;
  for (;;) {
    const page = (
      await oystehr.fhir.search<MedicationAdministration>({
        resourceType: 'MedicationAdministration',
        params: [
          { name: '_tag', value: IMMUNIZATION_ORDER_TAG_CODE },
          { name: 'status', value: 'completed,on-hold' },
          { name: '_count', value: String(BACKFILL_PAGE_SIZE) },
          { name: '_offset', value: String(offset) },
        ],
      })
    ).unbundle();
    if (page.length === 0) break;
    stats.examined += page.length;

    const ids = page.flatMap((medicationAdministration) => medicationAdministration.id ?? []);
    const existingImmunizations = await getAllFhirSearchPages<Immunization>(
      {
        resourceType: 'Immunization',
        params: [
          {
            name: 'identifier',
            value: ids.map((id) => `${IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM}|${id}`).join(','),
          },
        ],
      },
      oystehr
    );
    const { toCreate, existing, skipped } = selectAdministrationsToBackfill(page, existingImmunizations);
    stats.existing += existing;
    stats.skipped += skipped;

    for (const medicationAdministration of toCreate) {
      const immunization = immunizationFromMedicationAdministration(medicationAdministration);
      const label = `${immunization.vaccineCode.text ?? '?'} given ${immunization.occurrenceDateTime} for ${
        immunization.patient.reference
      } (order ${medicationAdministration.id})`;
      if (dryRun) {
        console.log(`  + would create Immunization: ${label}`);
        stats.created += 1;
        continue;
      }
      try {
        const created = await oystehr.fhir.create<Immunization>(immunization);
        console.log(`  ✓ Immunization/${created.id}: ${label}`);
        stats.created += 1;
      } catch (error) {
        console.error(`  ✗ failed for order ${medicationAdministration.id}:`, error);
        stats.failed += 1;
      }
    }

    if (page.length < BACKFILL_PAGE_SIZE) break;
    offset += BACKFILL_PAGE_SIZE;
  }
  return stats;
}
