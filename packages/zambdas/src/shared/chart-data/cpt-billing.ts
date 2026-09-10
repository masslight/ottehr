import Oystehr from '@oystehr/sdk';
import { FhirResource, MedicationAdministration, Procedure } from 'fhir/r4b';
import {
  getCptCodesFromMA,
  getDosageFromMA,
  getMedicationFromMA,
  getNdcCodeFromMedication,
  MedicationCptCodeEntry,
} from 'utils/lib/fhir/medication-administration';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

/**
 * CPT codes that were added by an in-house medication administration carry `partOf` a
 * MedicationAdministration; that resource holds the NDC, dose and billable units the claim needs.
 * Looks those up and folds them onto the matching CPT DTOs.
 */
export async function enrichCptCodesWithMedicationAdministration(
  cptCodes: CPTCodeDTO[],
  resources: FhirResource[],
  oystehr: Oystehr
): Promise<CPTCodeDTO[]> {
  if (cptCodes.length === 0) return cptCodes;

  // Build procedure ID → MA ID map from partOf references
  const procedureMaIdMap = new Map<string, string>();
  resources.forEach((r) => {
    if (r.resourceType === 'Procedure' && r.id) {
      const proc = r as Procedure;
      const maRef = proc.partOf?.find((ref) => ref.reference?.startsWith('MedicationAdministration/'));
      if (maRef?.reference) {
        procedureMaIdMap.set(r.id, maRef.reference.replace('MedicationAdministration/', ''));
      }
    }
  });
  if (procedureMaIdMap.size === 0) return cptCodes;

  const maIds = [...new Set(procedureMaIdMap.values())];
  const maBundle = await oystehr.fhir.search<MedicationAdministration>({
    resourceType: 'MedicationAdministration',
    params: [{ name: '_id', value: maIds.join(',') }],
  });
  const maMap = new Map<string, MedicationAdministration>();
  maBundle.unbundle().forEach((ma) => {
    if (ma.id) maMap.set(ma.id, ma);
  });

  const procedureBillingMap = new Map<
    string,
    { ndcCode?: string; dose?: number; doseUnits?: string; cptEntries?: MedicationCptCodeEntry[] }
  >();
  procedureMaIdMap.forEach((maId, procedureId) => {
    const ma = maMap.get(maId);
    if (!ma) return;
    const med = getMedicationFromMA(ma);
    const ndc = med ? getNdcCodeFromMedication(med) : undefined;
    const dosage = getDosageFromMA(ma);
    const cptEntries = getCptCodesFromMA(ma);
    if (ndc || dosage || cptEntries) {
      procedureBillingMap.set(procedureId, {
        ndcCode: ndc,
        dose: dosage?.dose,
        doseUnits: dosage?.units,
        cptEntries,
      });
    }
  });
  if (procedureBillingMap.size === 0) return cptCodes;

  return cptCodes.map((cpt) => {
    const billing = cpt.resourceId ? procedureBillingMap.get(cpt.resourceId) : undefined;
    if (!billing) return cpt;
    const billableUnits = billing.cptEntries?.find((entry) => entry.code === cpt.code)?.billableUnits;
    return {
      ...cpt,
      ...(billing.ndcCode != null && { ndcCode: billing.ndcCode }),
      ...(billing.dose != null && { dose: billing.dose, doseUnits: billing.doseUnits }),
      ...(billableUnits != null && { billableUnits }),
    };
  });
}
