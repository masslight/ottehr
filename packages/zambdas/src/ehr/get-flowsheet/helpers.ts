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

export interface VitalsFlowsheetResources {
  appointments: Appointment[];
  encounters: Encounter[];
  observations: Observation[];
  conditions: Condition[];
  practitioners: Practitioner[];
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

export const fetchVitalsFlowsheet = async (oystehr: Oystehr, patientId: string): Promise<FlowsheetVisit[]> => {
  const [visitResources, observations] = await Promise.all([
    getAllFhirSearchPages<Appointment | Encounter>(
      {
        resourceType: 'Appointment',
        params: [
          { name: 'patient', value: `Patient/${patientId}` },
          { name: '_tag', value: `${OTTEHR_MODULE.IP},${OTTEHR_MODULE.TM}` },
          { name: '_revinclude', value: 'Encounter:appointment' },
        ],
      },
      oystehr
    ),
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
    ),
  ]);
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

  return buildVitalsFlowsheet({ appointments, encounters, observations, conditions, practitioners });
};

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

// 'walk-in' -> 'Walk-in'
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const buildVitalsFlowsheet = (resources: VitalsFlowsheetResources): FlowsheetVisit[] => {
  const appointmentById = new Map(resources.appointments.map((a) => [a.id, a]));
  const encounterById = new Map(resources.encounters.map((e) => [e.id, e]));
  const conditionById = new Map(resources.conditions.map((c) => [c.id, c]));
  const practitionerById = new Map(resources.practitioners.map((p) => [p.id, p]));

  const byEncounter = new Map<string, Observation[]>();
  resources.observations.forEach((o) => {
    const key = getIdFromReference(o.encounter?.reference, 'Encounter') ?? '';
    byEncounter.set(key, [...(byEncounter.get(key) ?? []), o]);
  });

  const visits: FlowsheetVisit[] = [];
  byEncounter.forEach((observations, encounterId) => {
    const encounter = encounterById.get(encounterId);
    const appointment = appointmentById.get(
      getIdFromReference(encounter?.appointment?.[0]?.reference, 'Appointment') ?? ''
    );
    const isFollowUp = !!encounter && getEncounterVisitType(encounter) !== 'main';
    const start =
      (!isFollowUp && appointment?.start) || observations.slice().sort(byEffectiveDateTime)[0]?.effectiveDateTime;
    if (!start) return;

    // Oldest first, so the latest reading of each measure is the cell value; every reading is kept.
    const values: Record<string, FlowsheetValue> = {};
    observations.sort(byEffectiveDateTime).forEach((o) => {
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

    const primary = encounter?.diagnosis?.find((d) => d.rank === 1) ?? encounter?.diagnosis?.[0];
    const condition = conditionById.get(getIdFromReference(primary?.condition.reference, 'Condition') ?? '');
    const coding = condition?.code?.coding?.[0];
    const attending = practitionerById.get((encounter && getAttendingPractitionerId(encounter)) ?? '');

    visits.push({
      appointmentId: appointment?.id,
      encounterId: encounter?.id,
      start,
      isFollowUp,
      visitType: appointment
        ? `${capitalize(appointmentTypeForAppointment(appointment))} · ${
            isTelemedAppointment(appointment) ? 'Telemed' : 'In-person'
          }`
        : '',
      reason: getReasonForVisitFromAppointment(appointment) ?? '',
      primaryDiagnosis: coding ? [coding.code, coding.display].filter(Boolean).join(' — ') : '',
      attending: attending ? getFullName(attending) : '',
      values,
    });
  });

  return visits.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
};
