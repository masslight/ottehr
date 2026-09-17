import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils/lib/fhir/constants';
import { buildAppointmentStartMap, getEncounterDateTime } from 'utils/lib/fhir/encounter';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { SearchBillingClaimTasksResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient, fhirName } from '../shared';
import { getClaimTaskPayerNames } from './payers';
import { SearchBillingClaimTasksParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-claim-tasks';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  complexValidation(params);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, clinicalOystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

function complexValidation(params: SearchBillingClaimTasksParams): void {
  if (params.createdFrom && params.createdTo && params.createdFrom > params.createdTo) {
    throw INVALID_INPUT_ERROR('Creation start date must not be after end date');
  }
}

async function performEffect(
  oystehr: Oystehr,
  clinicalOystehr: Oystehr,
  params: SearchBillingClaimTasksParams
): Promise<SearchBillingClaimTasksResponse> {
  const { status, createdFrom, createdTo, patientId, patientName, patientIdentifier, offset, pageSize } = params;
  const searchParams = [
    { name: 'code', value: `${BILLING_CLAIM_TASK_CODING.system}|${BILLING_CLAIM_TASK_CODING.code}` },
    { name: '_sort', value: '-authored-on,-_id' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_total', value: 'accurate' },
  ];
  if (status) searchParams.push({ name: 'status', value: status });
  if (createdFrom) searchParams.push({ name: 'authored-on', value: `ge${createdFrom}` });
  if (createdTo) searchParams.push({ name: 'authored-on', value: `le${createdTo}` });
  if (patientId) searchParams.push({ name: 'subject', value: `Patient/${patientId}` });
  for (const name of patientName?.split(/[\s,]+/).filter(Boolean) ?? []) {
    searchParams.push({ name: 'subject:Patient.name:contains', value: name.replace(/[\\$|]/g, (char) => `\\${char}`) });
  }
  if (patientIdentifier) {
    const projectId = getSecret(SecretsKeys.PROJECT_ID, params.secrets);
    searchParams.push({
      name: 'subject:Patient.identifier',
      value: `${FRIENDLY_PATIENT_ID_SYSTEM_BASE}/${projectId}|${patientIdentifier}`,
    });
  }

  const bundle = await oystehr.fhir.search<Task>({ resourceType: 'Task', params: searchParams });
  const taskResources = bundle.unbundle();
  const encounterIds = [...new Set(taskResources.flatMap((task) => task.encounter?.reference?.split('/')[1] || []))];
  const patientIds = [...new Set(taskResources.flatMap((task) => task.for?.reference?.split('/')[1] || []))];
  const [visitResources, patients] = await Promise.all([
    encounterIds.length
      ? clinicalOystehr.fhir
          .search<Encounter | Appointment | Account>({
            resourceType: 'Encounter',
            params: [
              { name: '_id', value: encounterIds.join(',') },
              { name: '_include', value: 'Encounter:appointment' },
              { name: '_include', value: 'Encounter:account' },
              { name: '_count', value: String(encounterIds.length) },
            ],
          })
          .then((result) => result.unbundle())
      : [],
    patientIds.length
      ? clinicalOystehr.fhir
          .search<Patient>({
            resourceType: 'Patient',
            params: [
              { name: '_id', value: patientIds.join(',') },
              { name: '_count', value: String(patientIds.length) },
            ],
          })
          .then((result) => result.unbundle())
      : [],
  ]);
  const encountersById = new Map<string, Encounter>();
  for (const resource of visitResources) {
    if (resource.resourceType === 'Encounter' && resource.id) encountersById.set(resource.id, resource);
  }
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));
  const appointmentStarts = buildAppointmentStartMap(visitResources);
  const payerNames = await getClaimTaskPayerNames(clinicalOystehr, oystehr, visitResources);
  const tasks = taskResources.map((task) => {
    const encounterId = task.encounter?.reference?.split('/')[1];
    const patientId = task.for?.reference?.split('/')[1];
    const encounter = encounterId ? encountersById.get(encounterId) : undefined;
    return {
      id: task.id!,
      status: task.status,
      encounterId,
      encounterDate: encounter ? getEncounterDateTime(encounter, appointmentStarts) : undefined,
      appointmentId: encounter?.appointment?.[0]?.reference?.split('/')[1],
      patientId,
      patientName: fhirName(patientsById.get(patientId)) || undefined,
      payerNames: payerNames.get(encounterId ?? '') ?? [],
      createdAt: task.authoredOn,
      updatedAt: task.meta?.lastUpdated,
      error: getFailureMessage(task),
    };
  });
  return { tasks, total: bundle.total ?? 0, offset, pageSize };
}

function getFailureMessage(task: Task): string | undefined {
  if (task.status !== 'failed') return undefined;
  const reason = task.statusReason?.text;
  if (!reason) return 'Claim creation failed';
  try {
    const error: unknown = JSON.parse(reason);
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  } catch {
    // Task failures may already be stored as plain text.
  }
  return reason;
}
