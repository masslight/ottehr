import Oystehr from '@oystehr/sdk';
import { Appointment, Condition, Encounter, Observation, Practitioner } from 'fhir/r4b';
import { appointmentTypeForAppointment, getReasonForVisitFromAppointment } from 'utils/lib/fhir/appointments';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getEncounterVisitType } from 'utils/lib/fhir/encounter';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isTelemedAppointment, OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getFullName } from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { makeVitalsObservationDTO } from 'utils/lib/fhir/vitals';
import { getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';

/** The patient's visits and what every flowsheet's visit columns are described from. */
export interface VisitResources {
  appointments: Appointment[];
  encounters: Encounter[];
  /** The encounters' charted diagnoses. */
  conditions: Condition[];
  practitioners: Practitioner[];
}

export interface VitalsFlowsheetResources extends VisitResources {
  observations: Observation[];
}

const searchByIds = async <T extends Condition | Practitioner>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  ids: (string | undefined)[]
): Promise<T[]> => {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return [];
  return getAllFhirSearchPages<T>({ resourceType, params: [{ name: '_id', value: unique.join(',') }] }, oystehr);
};

export const fetchVisits = async (oystehr: Oystehr, patientId: string): Promise<VisitResources> => {
  const visitResources = await getAllFhirSearchPages<Appointment | Encounter>(
    {
      resourceType: 'Appointment',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_tag', value: `${OTTEHR_MODULE.IP},${OTTEHR_MODULE.TM}` },
        { name: '_revinclude', value: 'Encounter:appointment' },
      ],
    },
    oystehr
  );
  const appointments = visitResources.filter((r): r is Appointment => r.resourceType === 'Appointment');
  const encounters = visitResources.filter((r): r is Encounter => r.resourceType === 'Encounter');

  const [conditions, practitioners] = await Promise.all([
    searchByIds<Condition>(
      oystehr,
      'Condition',
      encounters.flatMap((e) => (e.diagnosis ?? []).map((d) => getIdFromReference(d.condition.reference, 'Condition')))
    ),
    searchByIds<Practitioner>(oystehr, 'Practitioner', encounters.map(getAttendingPractitionerId)),
  ]);
  return { appointments, encounters, conditions, practitioners };
};

export const fetchVitals = (oystehr: Oystehr, patientId: string): Promise<Observation[]> =>
  getAllFhirSearchPages<Observation>(
    {
      resourceType: 'Observation',
      params: [
        { name: 'patient._id', value: patientId },
        { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' },
        { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|` },
      ],
    },
    oystehr
  );

/** Groups per-visit resources by the encounter id in `reference`; unlinked ones land under ''. */
export const groupByEncounter = <T>(items: T[], reference: (item: T) => string | undefined): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getIdFromReference(reference(item), 'Encounter') ?? '';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return groups;
};

// 'walk-in' -> 'Walk-in'
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A visit column's header fields for one encounter. `start` is the appointment start; it is absent for a
 * follow-up or an unknown encounter, which the flowsheet then dates by its own data.
 */
export const describeVisit = (
  encounterId: string,
  resources: VisitResources
): Omit<FlowsheetVisit, 'values' | 'start'> & { start?: string } => {
  const encounter = resources.encounters.find((e) => e.id === encounterId);
  const appointmentId = getIdFromReference(encounter?.appointment?.[0]?.reference, 'Appointment');
  const appointment = resources.appointments.find((a) => a.id === appointmentId);
  const isFollowUp = !!encounter && getEncounterVisitType(encounter) !== 'main';

  const primary = encounter?.diagnosis?.find((d) => d.rank === 1) ?? encounter?.diagnosis?.[0];
  const conditionId = getIdFromReference(primary?.condition.reference, 'Condition');
  const coding = resources.conditions.find((c) => c.id === conditionId)?.code?.coding?.[0];
  const attendingId = encounter && getAttendingPractitionerId(encounter);
  const attending = resources.practitioners.find((p) => p.id === attendingId);

  return {
    appointmentId: appointment?.id,
    encounterId: encounter?.id,
    start: (!isFollowUp && appointment?.start) || undefined,
    isFollowUp,
    visitType: appointment
      ? `${capitalize(appointmentTypeForAppointment(appointment))} · ${
          isTelemedAppointment(appointment) ? 'Telemed' : 'In-person'
        }`
      : '',
    reason: getReasonForVisitFromAppointment(appointment) ?? '',
    primaryDiagnosis: coding ? [coding.code, coding.display].filter(Boolean).join(' — ') : '',
    attending: attending ? getFullName(attending) : '',
  };
};

export const newestFirst = (visits: FlowsheetVisit[]): FlowsheetVisit[] =>
  visits.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));

/** Grid/chart measure keys for one reading; blood pressure splits into its two components. */
const measuresOf = (dto: VitalsObservationDTO): Record<string, number | undefined> => {
  switch (dto.field) {
    case VitalFieldNames.VitalTemperature:
      return { temperature: dto.value };
    case VitalFieldNames.VitalHeartbeat:
      return { heartRate: dto.value };
    case VitalFieldNames.VitalRespirationRate:
      return { respirationRate: dto.value };
    case VitalFieldNames.VitalOxygenSaturation:
      return { oxygenSaturation: dto.value };
    case VitalFieldNames.VitalBloodPressure:
      return { systolic: dto.systolicPressure, diastolic: dto.diastolicPressure };
    case VitalFieldNames.VitalWeight:
      return { weight: dto.value };
    case VitalFieldNames.VitalHeight:
      return { height: dto.value };
    // The saved vital-bmi Observation, never a computed value.
    case VitalFieldNames.VitalBMI:
      return { bmi: dto.value };
    default:
      return {};
  }
};

const byEffectiveDateTime = (a: Observation, b: Observation): number =>
  (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '');

export const buildVitalsFlowsheet = (resources: VitalsFlowsheetResources): FlowsheetVisit[] => {
  const visits: FlowsheetVisit[] = [];
  groupByEncounter(resources.observations, (o) => o.encounter?.reference).forEach((observations, encounterId) => {
    const visit = describeVisit(encounterId, resources);
    // Oldest first, so the latest reading of each measure is the cell value; every reading is kept.
    observations.sort(byEffectiveDateTime);
    const start = visit.start ?? observations[0]?.effectiveDateTime;
    if (!start) return;

    const values: Record<string, FlowsheetValue> = {};
    observations.forEach((o) => {
      const dto = makeVitalsObservationDTO(o);
      if (!dto) return;
      const flag = getVitalDTOCriticalityFromObservation(o);
      Object.entries(measuresOf(dto)).forEach(([key, value]) => {
        // makeVitalsObservationDTO substitutes 0 for a missing reading; no vital here can really be 0.
        if (!value) return;
        const reading = { time: o.effectiveDateTime ?? start, value, flag };
        values[key] = { ...reading, readings: [...(values[key]?.readings ?? []), reading] };
      });
    });

    visits.push({ ...visit, start, values });
  });

  return newestFirst(visits);
};
