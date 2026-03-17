import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
  Appointment,
  Encounter as FhirEncounter,
  Location,
  Patient,
  RelatedPerson,
  Resource,
  Slot,
  Task as FhirTask,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FHIR_EXTENSION,
  formatDateConfigurable,
  GET_INVOICES_TASKS_ZAMBDA_KEY,
  getEmailForIndividual,
  getFullName,
  GetInvoicesTasksInput,
  GetInvoicesTasksResponse,
  getPatientReferenceFromAccount,
  getPhoneNumberForIndividual,
  getResponsiblePartyFromAccount,
  getSecret,
  INVOICEABLE_PATIENTS_PAGE_SIZE,
  InvoiceablePatientReport,
  mapGenderToLabel,
  parseInvoiceTaskInput,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  SecretsKeys,
  TIMEZONES,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { accountMatchesType } from '../shared/harvest';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = GET_INVOICES_TASKS_ZAMBDA_KEY;

type PatientRelationshipToInsured = 'Self' | 'Spouse' | 'Parent' | 'Legal Guardian' | 'Other';
interface TaskGroup {
  task: FhirTask;
  encounter: FhirEncounter;
  patient: Patient;
  account?: Account;
  appointment?: Appointment;
  location?: Location;
  slot?: Slot;
  responsibleParty?: Patient | RelatedPerson;
  relatedPerson?: RelatedPerson;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets } = validatedParams;
    const start = performance.now();

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const fhirSearchStart = performance.now();
    const fhirResources = await getFhirResourcesGrouped(oystehr, validatedParams);
    const fhirSearchEnd = performance.now();
    const taskGroups = fhirResources.taskGroups;

    const response = performEffect(taskGroups, fhirResources.bundleTotal);
    const end = performance.now();
    console.log('Whole zambda execution time:', Math.round((end - start) / 1000), 'seconds.');
    console.log('FHIR search execution time: ', Math.round((fhirSearchEnd - fhirSearchStart) / 1000), 'seconds.');
    // console.log('Candid search execution time: ', Math.round((candidSearchEnd - fhirSearchEnd) / 1000), 'seconds.');
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    console.log('Error occurred:', error);
    return await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function performEffect(taskGroups: TaskGroup[], total: number): GetInvoicesTasksResponse {
  const reports: InvoiceablePatientReport[] = [];

  taskGroups.forEach((group) => {
    const { task, patient, appointment, responsibleParty, slot } = group;
    const taskInput = parseInvoiceTaskInput(task);

    const patientName = getFullName(patient);
    const patientDob = formatDateConfigurable({ isoDate: patient.birthDate });
    const patientGenderLabel = patient?.gender && mapGenderToLabel[patient.gender];

    const responsiblePartyName = responsibleParty && getFullName(responsibleParty);
    const responsiblePartyPhoneNumber = responsibleParty && getPhoneNumberForIndividual(responsibleParty);
    const responsiblePartyEmail = responsibleParty && getEmailForIndividual(responsibleParty);

    let timezone = TIMEZONES[0]; // default timezone
    if (slot && slot.start) {
      // we can just grab the tz from the slot rather than getting the schedule resource
      const slotDateTime = DateTime.fromISO(slot.start, { setZone: true });
      if (slotDateTime.isValid) {
        timezone = slotDateTime.zoneName;
      }
    }
    const visitDate = formatDateConfigurable({ isoDate: appointment?.start, timezone });
    const patientPhoneNumber = group.relatedPerson && getPhoneNumberForIndividual(group.relatedPerson);

    reports.push({
      claimId: taskInput.claimId ?? '---',
      finalizationDateISO: taskInput.finalizationDate ?? '---',
      amountInvoiceable: taskInput.amountCents ?? 0,
      visitDate: visitDate ?? '---',
      location: group.location?.name ?? '---',
      task: task,
      patient: {
        patientId: patient.id!,
        fullName: patientName,
        dob: patientDob,
        gender: patientGenderLabel,
        phoneNumber: patientPhoneNumber ?? '---',
      },
      responsibleParty: {
        fullName: responsiblePartyName,
        email: responsiblePartyEmail,
        phoneNumber: responsiblePartyPhoneNumber,
        relationshipToPatient: responsibleParty && getResponsiblePartyRelationship(responsibleParty)?.toLowerCase(),
      },
    });
  });

  reports.sort((a, b) => {
    const luxonDateA = DateTime.fromISO(a.finalizationDateISO);
    const luxonDateB = DateTime.fromISO(b.finalizationDateISO);
    if (!luxonDateA.isValid && !luxonDateB.isValid) return 0;
    if (!luxonDateA.isValid) return 1;
    if (!luxonDateB.isValid) return -1;
    return luxonDateB.toMillis() - luxonDateA.toMillis();
  });

  return { reports, totalCount: total };
}

async function getFhirResourcesGrouped(
  oystehr: Oystehr,
  complexValidatedInput: GetInvoicesTasksInput
): Promise<{ taskGroups: TaskGroup[]; bundleTotal: number }> {
  const { page, status, patientId } = complexValidatedInput;
  const params: SearchParam[] = [
    {
      name: '_sort',
      value: '-authored-on',
    },
    {
      name: '_total',
      value: 'accurate',
    },
    {
      name: '_count',
      value: INVOICEABLE_PATIENTS_PAGE_SIZE,
    },
    {
      name: 'code',
      value: `${RCM_TASK_SYSTEM}|${RcmTaskCode.sendInvoiceToPatient}`,
    },
    {
      name: '_include',
      value: 'Task:encounter',
    },
    {
      name: '_include:iterate',
      value: 'Encounter:patient',
    },
    {
      name: '_include:iterate',
      value: 'Encounter:appointment',
    },
    {
      name: '_include:iterate',
      value: 'Appointment:location',
    },
    {
      name: '_include:iterate',
      value: 'Appointment:slot',
    },
    {
      name: '_revinclude:iterate',
      value: 'RelatedPerson:patient',
    },
    {
      name: '_revinclude:iterate',
      value: 'Account:patient',
    },
  ];
  if (page) {
    params.push({
      name: '_offset',
      value: page * INVOICEABLE_PATIENTS_PAGE_SIZE,
    });
  }
  if (status) {
    params.push({
      name: 'status',
      value: status,
    });
  }
  if (patientId) {
    console.log('adding patientId to search params: ', patientId);
    params.push({
      name: 'patient',
      value: `Patient/${patientId}`,
    });
  }
  const bundle = await oystehr.fhir.search({
    resourceType: 'Task',
    params,
  });
  const resources = bundle.unbundle() as Resource[];
  const tasks = resources.filter((r) => r.resourceType === 'Task') as FhirTask[];
  console.log('Tasks found: ', tasks.length);
  const resultGroups: TaskGroup[] = [];

  tasks.forEach((task) => {
    const encounterId = task.encounter?.reference?.replace('Encounter/', '');
    const encounter = findResourceById<FhirEncounter>('Encounter', encounterId, resources);
    if (!encounter) {
      console.error(
        `Task with id: ${task.id} was not included in the bundle because it's missing encounter with id: ${encounterId}`
      );
      return;
    }

    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    const patient = findResourceById<Patient>('Patient', patientId, resources);
    if (!patient || !patientId) {
      console.error(
        `Task with id: ${task.id} was not included in the bundle because it's missing patient with id: ${patientId}`
      );
      return;
    }

    const appointmentId = encounter.appointment
      ?.find((ref) => ref.reference?.includes('Appointment/'))
      ?.reference?.replace('Appointment/', '');
    const appointment = findResourceById<Appointment>('Appointment', appointmentId, resources);

    const locationId = appointment?.participant
      ?.find((p) => p.actor?.reference?.includes('Location/'))
      ?.actor?.reference?.replace('Location/', '');
    const location = findResourceById<Location>('Location', locationId, resources);

    const slotId = appointment?.slot?.find((s) => s.reference?.includes('Slot/'))?.reference?.replace('Slot/', '');
    const slot = findResourceById<Slot>('Slot', slotId, resources);

    const account = resources.find(
      (res) =>
        res.resourceType === 'Account' &&
        accountMatchesType(res as Account, PATIENT_BILLING_ACCOUNT_TYPE) &&
        getPatientReferenceFromAccount(res as Account)?.includes(patientId)
    ) as Account;
    const responsibleParty = account ? getResponsiblePartyFromAccount(account, resources) : undefined;

    const relatedPerson = resources.find(
      (resource) =>
        resource.resourceType === 'RelatedPerson' &&
        (resource as RelatedPerson).patient?.reference?.includes(patientId) &&
        (resource as RelatedPerson).relationship?.find(
          (relationship) => relationship.coding?.find((code) => code.code === 'user-relatedperson')
        )
    ) as RelatedPerson;

    resultGroups.push({
      task,
      encounter,
      patient,
      account,
      appointment,
      responsibleParty,
      relatedPerson,
      location,
      slot,
    });
  });

  console.log('Tasks groups created: ', resultGroups.length);
  return { taskGroups: resultGroups, bundleTotal: bundle.total ?? resultGroups.length };
}

function findResourceById<T extends Resource>(
  resourceType: Resource['resourceType'],
  id: string | undefined,
  resources: Resource[]
): T | undefined {
  if (!id) return undefined;
  return resources.find((res) => res.resourceType === resourceType && res.id === id) as T;
}

export function getResponsiblePartyRelationship(
  responsibleParty: RelatedPerson | Patient
): PatientRelationshipToInsured | undefined {
  let result: PatientRelationshipToInsured | undefined = undefined;
  if (responsibleParty.resourceType === 'Patient') return 'Self';
  responsibleParty.relationship?.find(
    (rel) =>
      rel.coding?.find((coding) => {
        if (coding.system === FHIR_EXTENSION.RelatedPerson.responsiblePartyRelationship.url) {
          result = coding.code as PatientRelationshipToInsured;
          return true;
        }
        return false;
      })
  );
  return result;
}
