import Oystehr from '@oystehr/sdk';
import { Observation, Patient, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { VitalsSchema } from 'utils/lib/helpers/vitals/config-schema';
import { withoutBMIUnder24Months } from 'utils/lib/helpers/vitals/vitals-bmi.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { FlowsheetValues, FlowsheetVisit, FlowsheetVitalField } from 'utils/lib/types/api/flowsheets.types';
import { TIMEZONES } from 'utils/lib/types/constants';
import { parseVitalsObservationsToDTOs } from '../../shared/vitals/parse-vitals-observations';
import { getVitalsEngineConfig } from '../../shared/vitals-alert-config';
import { buildVisitColumns, byInstant, describeVisit, fetchVisits, VisitColumnOptions, VisitResources } from './visits';

export interface VitalsFlowsheetResources extends VisitResources {
  observations: Observation[];
  performers: Practitioner[];
  birthDate?: string;
  gender?: Patient['gender'];
  vitalsAlertConfig: VitalsSchema;
}

const fetchVitals = async (
  oystehr: Oystehr,
  patientId: string
): Promise<Pick<VitalsFlowsheetResources, 'observations' | 'performers'>> => {
  const resources = await getAllFhirSearchPages<Observation | Practitioner>(
    {
      resourceType: 'Observation',
      params: [
        { name: 'patient._id', value: patientId },
        { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' },
        { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|` },
        { name: '_include', value: 'Observation:performer' },
      ],
    },
    oystehr
  );
  return {
    observations: resources.filter((r): r is Observation => r.resourceType === 'Observation'),
    performers: resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner'),
  };
};

const fetchDemographics = async (
  oystehr: Oystehr,
  patientId: string
): Promise<Pick<Patient, 'birthDate' | 'gender'>> => {
  const [patient] = await getAllFhirSearchPages<Patient>(
    {
      resourceType: 'Patient',
      params: [
        { name: '_id', value: patientId },
        { name: '_elements', value: 'birthDate,gender' },
      ],
    },
    oystehr
  );
  return { birthDate: patient?.birthDate, gender: patient?.gender };
};

const readingOf = (dto: VitalsObservationDTO): { field: FlowsheetVitalField; values: number[] } | undefined => {
  switch (dto.field) {
    case VitalFieldNames.VitalVision:
    case VitalFieldNames.VitalLastMenstrualPeriod:
      return undefined;
    case VitalFieldNames.VitalBloodPressure:
      return { field: dto.field, values: [dto.systolicPressure, dto.diastolicPressure] };
    default:
      return dto.value === undefined ? undefined : { field: dto.field, values: [dto.value] };
  }
};

export const buildVitalsFlowsheet = (
  resources: VitalsFlowsheetResources,
  options: VisitColumnOptions
): FlowsheetVisit[] => {
  const alertContext = {
    patientDOB: resources.birthDate,
    patientSex: resources.gender,
    vitalsAlertConfig: resources.vitalsAlertConfig,
  };
  const byEncounter = new Map<string, Observation[]>();
  resources.observations.forEach((observation) => {
    const key = getIdFromReference(observation.encounter?.reference, 'Encounter') ?? '';
    byEncounter.set(key, [...(byEncounter.get(key) ?? []), observation]);
  });

  const valuesByEncounter = new Map<string, FlowsheetValues>();
  byEncounter.forEach((observations, encounterId) => {
    const visit = describeVisit(encounterId, resources);
    const dtos = withoutBMIUnder24Months(
      parseVitalsObservationsToDTOs(observations, resources.performers, alertContext),
      resources.birthDate,
      visit.timezone ?? TIMEZONES[0],
      visit.start
    );
    const values: FlowsheetValues = {};
    dtos
      .filter((dto) => dto.lastUpdated)
      .sort((a, b) => byInstant(a.lastUpdated, b.lastUpdated))
      .forEach((dto) => {
        const reading = readingOf(dto);
        if (!reading || !dto.lastUpdated) return;
        values[reading.field] = [
          ...(values[reading.field] ?? []),
          { time: dto.lastUpdated, values: reading.values, flag: dto.alertCriticality },
        ];
      });
    if (Object.keys(values).length > 0) valuesByEncounter.set(encounterId, values);
  });

  return buildVisitColumns(resources, valuesByEncounter, options);
};

export const getVitalsFlowsheet = async (
  oystehr: Oystehr,
  patientId: string,
  options: VisitColumnOptions
): Promise<FlowsheetVisit[]> => {
  const [visits, demographics, vitals, vitalsAlertConfig] = await Promise.all([
    fetchVisits(oystehr, patientId),
    fetchDemographics(oystehr, patientId),
    fetchVitals(oystehr, patientId),
    getVitalsEngineConfig(oystehr),
  ]);
  return buildVitalsFlowsheet({ ...visits, ...demographics, ...vitals, vitalsAlertConfig }, options);
};
