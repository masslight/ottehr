import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { AdHocLayerMap, layerFields } from 'utils/lib/types/adhoc/datasets/dataset';
import { PatientLayerId } from 'utils/lib/types/adhoc/datasets/patients';
import { REPORT_ATTENDED_APPOINTMENT_STATUSES } from '../adhoc-report';
import { fetchPatientLayerColumns, PATIENT_LAYER_MODULES, PatientVisit } from './patients/layers';

const PATIENT_PREFIX = 'patients.';

/**
 * Each patient's visits, as the patients dataset counts them: attended appointments (no cancelled / no-show), each
 * with its main encounter (an annotation follow-up is not the visit). Keyed `Patient/{id}`.
 */
function patientVisits(appointments: Appointment[], encounters: Encounter[]): Map<string, PatientVisit[]> {
  const attended = new Set(REPORT_ATTENDED_APPOINTMENT_STATUSES.split(','));
  const encounterIdByAppointment = new Map<string, string>();
  for (const e of encounters) {
    const appointmentRef = e.appointment?.[0]?.reference;
    if (appointmentRef && e.id && !isAnnotationFollowupEncounter(e)) encounterIdByAppointment.set(appointmentRef, e.id);
  }
  const out = new Map<string, PatientVisit[]>();
  for (const appointment of appointments) {
    if (!appointment.status || !attended.has(appointment.status) || !appointment.start) continue;
    const patientRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor
      ?.reference;
    if (!patientRef) continue;
    out.set(patientRef, [
      ...(out.get(patientRef) ?? []),
      { appointment, encounterId: encounterIdByAppointment.get(`Appointment/${appointment.id}`) },
    ]);
  }
  return out;
}

const includeFlag = (id: string): string => `include${id.charAt(0).toUpperCase()}${id.slice(1)}`;

export function requestedForeignPatientLayers(foreign: AdHocLayerMap, params: object): string[] {
  const flags = params as Record<string, unknown>;
  return Object.keys(foreign).filter((id) => id.startsWith(PATIENT_PREFIX) && flags[includeFlag(id)] === true);
}

export async function fetchForeignPatientColumns(
  oystehr: Oystehr,
  params: {
    dateRange: { start: string; end: string };
    patients: Patient[];
    /** The dataset's appointments and encounters of the range, for the patients' visits (visitHistory). */
    appointments: Appointment[];
    encounters: Encounter[];
    foreign: AdHocLayerMap;
    requested: string[];
    timings?: Map<string, number>;
  }
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  if (!params.requested.length) return out;

  const layerIds = params.requested
    .map((id) => id.slice(PATIENT_PREFIX.length))
    .filter((id): id is PatientLayerId => id in PATIENT_LAYER_MODULES);
  const fields = params.requested.flatMap((id) => layerFields(params.foreign[id]));

  const layerTimings = new Map<string, number>();
  const columns = await fetchPatientLayerColumns(oystehr, {
    dateRange: params.dateRange,
    patients: params.patients,
    visitsByPatient: patientVisits(params.appointments, params.encounters),
    layerIds,
    timings: layerTimings,
  });
  for (const [id, ms] of layerTimings) params.timings?.set(`${PATIENT_PREFIX}${id}`, ms);

  for (const [patientRef, row] of columns) {
    const picked: Record<string, unknown> = {};
    const source = row as Record<string, unknown>;
    for (const field of fields) if (field in source) picked[field] = source[field];
    out.set(patientRef.replace('Patient/', ''), picked);
  }
  return out;
}
