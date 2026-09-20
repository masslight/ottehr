import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils/lib/fhir/constants';
import { buildAppointmentStartMap, getEncounterDateTime } from 'utils/lib/fhir/encounter';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { BILLING_CLAIM_TASK_CODING } from 'utils/lib/types/data/billing/billing.constants';
import { BillingClaimTaskItem, SearchBillingClaimTasksResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
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

  if (params.payerName) {
    return searchByPayer(oystehr, clinicalOystehr, searchParams, params);
  }
  const bundle = await oystehr.fhir.search<Task>({ resourceType: 'Task', params: searchParams });
  const tasks = await getTaskRows(oystehr, clinicalOystehr, bundle.unbundle());
  return { tasks, total: bundle.total ?? 0, offset, pageSize };
}

async function searchByPayer(
  billing: Oystehr,
  clinical: Oystehr,
  searchParams: SearchParam[],
  { payerName, offset, pageSize }: SearchBillingClaimTasksParams
): Promise<SearchBillingClaimTasksResponse> {
  // Apply the payer filter before pagination, including tasks whose claims do not exist yet.
  const filterParams = searchParams.filter(({ name }) => !['_count', '_offset', '_total'].includes(name));
  const matching: BillingClaimTaskItem[] = [];
  const payer = payerName!.toLowerCase();
  await fetchAllPages(
    async (scanOffset, count) => {
      const bundle = await billing.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          ...filterParams,
          { name: '_count', value: String(count) },
          { name: '_offset', value: String(scanOffset) },
          { name: '_total', value: 'accurate' },
        ],
      });
      const rows = await getTaskRows(billing, clinical, bundle.unbundle());
      matching.push(...rows.filter((row) => row.payerNames.some((name) => name.toLowerCase().includes(payer))));
      return bundle;
    },
    100,
    { failOnLimit: true }
  );
  return { tasks: matching.slice(offset, offset + pageSize), total: matching.length, offset, pageSize };
}

async function getTaskRows(
  oystehr: Oystehr,
  clinicalOystehr: Oystehr,
  taskResources: Task[]
): Promise<BillingClaimTaskItem[]> {
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
  return taskResources.map((task) => {
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
