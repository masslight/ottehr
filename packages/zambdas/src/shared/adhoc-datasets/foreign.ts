// Foreign layers: another dataset's layers on this dataset's rows, matched by a base field. Today: the patients
// dataset's layers (`patients.<layer>`) on the encounters and billing rows, by patientId.
import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { AdHocLayerMap, layerFields } from 'utils/lib/types/adhoc/datasets/dataset';
import { PatientLayerId } from 'utils/lib/types/adhoc/datasets/patients';
import { fetchPatientLayerColumns, PATIENT_LAYER_MODULES } from './patients/layers';

const PATIENT_PREFIX = 'patients.';

const includeFlag = (id: string): string => `include${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/** The foreign `patients.*` layers an endpoint input asks for. */
export function requestedForeignPatientLayers(foreign: AdHocLayerMap, params: object): string[] {
  const flags = params as Record<string, unknown>;
  return Object.keys(foreign).filter((id) => id.startsWith(PATIENT_PREFIX) && flags[includeFlag(id)] === true);
}

/**
 * Loads the requested foreign patient layers for the given patients and returns, per patient id, the columns
 * those layers add — only the fields each foreign layer declares (the dataset's own fields are never overwritten).
 */
export async function fetchForeignPatientColumns(
  oystehr: Oystehr,
  params: {
    dateRange: { start: string; end: string };
    patients: Patient[];
    foreign: AdHocLayerMap;
    requested: string[];
  }
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!params.requested.length) return out;

  const layerIds = params.requested
    .map((id) => id.slice(PATIENT_PREFIX.length))
    .filter((id): id is PatientLayerId => id in PATIENT_LAYER_MODULES);
  const fields = params.requested.flatMap((id) => layerFields(params.foreign[id]));

  const columns = await fetchPatientLayerColumns(oystehr, {
    dateRange: params.dateRange,
    patients: params.patients,
    layerIds,
  });

  for (const [patientRef, row] of columns) {
    const picked: Record<string, unknown> = {};
    const source = row as Record<string, unknown>;
    for (const field of fields) if (field in source) picked[field] = source[field];
    out.set(patientRef.replace('Patient/', ''), picked);
  }
  return out;
}
