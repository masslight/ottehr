import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DeviceRequest, Encounter, FhirResource, Location, Patient, Practitioner, Procedure, Task } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { DME_TASK } from 'utils/lib/types/api/dme.types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { makeCPTCodeDTO } from '../../../shared/chart-data';
import { DME_ORDER_SEARCH_TAG, getDmeBillingProcedureIds, isDmeBillingProcedureOf } from '../../../shared/dme';
import { createTask } from '../../../shared/tasks';

export const resolveCallerPractitionerId = async (userToken: string, secrets: Secrets): Promise<string | undefined> =>
  removePrefix('Practitioner/', (await userMe(userToken, secrets)).profile ?? '') || undefined;

export interface DmeEncounterContext {
  encounter: Encounter;
  patient: Patient;
  location: Location | undefined;
  appointmentId: string | undefined;
}

const getEncounterAppointmentId = (encounter: Encounter | undefined): string | undefined =>
  removePrefix('Appointment/', encounter?.appointment?.[0]?.reference ?? '') || undefined;

export const fetchDmeEncounterContext = async (encounterId: string, oystehr: Oystehr): Promise<DmeEncounterContext> => {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Location>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:patient' },
        { name: '_include', value: 'Encounter:location' },
        { name: '_include', value: 'Encounter:part-of' },
      ],
    })
  ).unbundle();

  const encounter = resources.find((r): r is Encounter => r.resourceType === 'Encounter' && r.id === encounterId);
  if (!encounter) throw { ...FHIR_RESOURCE_NOT_FOUND('Encounter'), statusCode: 404 };

  const patientId = encounter.subject?.reference?.replace('Patient/', '');
  const patient = resources.find((r): r is Patient => r.resourceType === 'Patient' && r.id === patientId);
  if (!patient) throw { ...FHIR_RESOURCE_NOT_FOUND('Patient'), statusCode: 404 };

  const location = resources.find(
    (r): r is Location =>
      r.resourceType === 'Location' && !!encounter.location?.some((l) => l.location.reference === `Location/${r.id}`)
  );
  const parentEncounter = resources.find(
    (r): r is Encounter => r.resourceType === 'Encounter' && `Encounter/${r.id}` === encounter.partOf?.reference
  );
  // A follow-up may reference only its parent encounter; the parent's appointment is the chart that opens it.
  const appointmentId = getEncounterAppointmentId(encounter) ?? getEncounterAppointmentId(parentEncounter);
  return { encounter, patient, location, appointmentId };
};

export const fetchOrderingPractitioner = async (id: string, oystehr: Oystehr): Promise<Practitioner> => {
  try {
    return await oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id });
  } catch {
    throw INVALID_INPUT_ERROR('Ordering provider not found');
  }
};

export const fetchPractitionerNames = async (
  ids: string[],
  oystehr: Oystehr,
  known: Practitioner[] = []
): Promise<Record<string, string>> => {
  const missing = [...new Set(ids)].filter((id) => !known.some((p) => p.id === id));
  const fetched = missing.length
    ? (
        await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [
            { name: '_id', value: missing.join(',') },
            { name: '_count', value: `${missing.length}` },
          ],
        })
      ).unbundle()
    : [];
  return Object.fromEntries(
    [...known, ...fetched].filter((p) => p.id).map((p) => [p.id!, getFullestAvailableName(p) ?? ''])
  );
};

export const dispenseTaskTitle = (itemName: string): string => `Dispense ${itemName}`;

export const makeDmeDispenseTask = (input: {
  deviceRequestReference: string;
  itemName: string;
  orderDate: string | undefined;
  providerName: string | undefined;
  context: DmeEncounterContext;
}): Task => {
  const { deviceRequestReference, itemName, orderDate, providerName, context } = input;
  const { encounter, patient, location, appointmentId } = context;
  return createTask({
    category: DME_TASK.category,
    title: dispenseTaskTitle(itemName),
    code: { system: DME_TASK.system, code: DME_TASK.code.dispense },
    encounterId: encounter.id,
    location: location?.id ? { id: location.id, name: location.name } : undefined,
    basedOn: [deviceRequestReference],
    input: [
      { type: DME_TASK.input.patientName, valueString: getFullestAvailableName(patient) },
      { type: DME_TASK.input.appointmentId, valueString: appointmentId },
      { type: DME_TASK.input.itemName, valueString: itemName },
      { type: DME_TASK.input.orderDate, valueString: orderDate },
      { type: DME_TASK.input.providerName, valueString: providerName },
    ],
  });
};

const OPEN_TASK_STATUSES: Task['status'][] = ['draft', 'requested', 'received', 'accepted', 'ready', 'in-progress'];

export const isOpenDmeDispenseTask = (task: Task): boolean =>
  OPEN_TASK_STATUSES.includes(task.status) &&
  !!task.code?.coding?.some((c) => c.system === DME_TASK.system && c.code === DME_TASK.code.dispense);

export const setTaskInputValue = (task: Task, type: string, valueString: string | undefined): Task => {
  const matches = (i: NonNullable<Task['input']>[number]): boolean =>
    !!i.type.coding?.some((c) => c.system === TASK_INPUT_SYSTEM && c.code === type);
  const others = (task.input ?? []).filter((i) => !matches(i));
  if (!valueString) return { ...task, input: others.length ? others : undefined };
  return {
    ...task,
    input: [...others, { type: { coding: [{ system: TASK_INPUT_SYSTEM, code: type }] }, valueString }],
  };
};

export type BillingProcedureRequest = BatchInputPostRequest<Procedure> & { fullUrl: string };

export const makeBillingProcedureRequests = (procedures: Procedure[]): BillingProcedureRequest[] =>
  procedures.map((resource) => ({ method: 'POST', url: '/Procedure', resource, fullUrl: `urn:uuid:${randomUUID()}` }));

const searchEncounterCptProcedures = (encounterId: string, oystehr: Oystehr): Promise<Procedure[]> =>
  getAllFhirSearchPages<Procedure>(
    {
      resourceType: 'Procedure',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: '_tag', value: 'cpt-code' },
      ],
    },
    oystehr
  );

export const fetchDmeBillingProcedures = async (deviceRequest: DeviceRequest, oystehr: Oystehr): Promise<Procedure[]> =>
  (await searchEncounterCptProcedures(getDeviceRequestEncounterId(deviceRequest), oystehr)).filter((procedure) =>
    isDmeBillingProcedureOf(procedure, deviceRequest)
  );

export const fetchEncounterDmeBillingProcedureIds = async (
  encounterId: string,
  oystehr: Oystehr
): Promise<Set<string>> =>
  new Set(
    (
      await getAllFhirSearchPages<DeviceRequest>(
        {
          resourceType: 'DeviceRequest',
          params: [
            { name: 'encounter', value: `Encounter/${encounterId}` },
            { name: '_tag', value: DME_ORDER_SEARCH_TAG },
          ],
        },
        oystehr
      )
    ).flatMap(getDmeBillingProcedureIds)
  );

export const getEncounterCptCodes = async (encounterId: string, oystehr: Oystehr): Promise<CPTCodeDTO[]> =>
  (await searchEncounterCptProcedures(encounterId, oystehr))
    .map(makeCPTCodeDTO)
    .filter((dto): dto is CPTCodeDTO => !!dto);

export const runDmeTransaction = async (
  requests: BatchInputRequest<FhirResource>[],
  oystehr: Oystehr
): Promise<FhirResource[]> => {
  if (!requests.length) return [];
  const bundle = await oystehr.fhir.transaction<FhirResource>({ requests });
  if (!bundle.entry?.every((entry) => entry.response?.status?.startsWith('2'))) {
    throw new Error('DME order transaction failed');
  }
  return bundle.entry.map((entry) => entry.resource).filter((r): r is FhirResource => !!r);
};

export const getDeviceRequestPatientId = (deviceRequest: DeviceRequest): string =>
  deviceRequest.subject?.reference?.replace('Patient/', '') ?? '';

export const getDeviceRequestEncounterId = (deviceRequest: DeviceRequest): string =>
  deviceRequest.encounter?.reference?.replace('Encounter/', '') ?? '';
