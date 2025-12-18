import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { ClinicalImpression, Condition, Encounter, Patient, Task } from 'fhir/r4b';
import { ChartDataResources, getSecret, PRIVATE_EXTENSION_BASE_URL, SecretsKeys } from 'utils';
import { makeDiagnosisConditionResource, saveOrUpdateResourceRequest } from '../../../shared';
import { generateIcdTenCodesFromNotes } from '../../../shared/ai';
import { wrapTaskHandler } from '../helpers';
import { TaskSubscriptionInput } from '../validateRequestParameters';

const ZAMBDA_NAME = 'sub-recommend-diagnosis-codes';

export const index = wrapTaskHandler(ZAMBDA_NAME, handler);

export async function handler(
  input: TaskSubscriptionInput,
  oystehr: Oystehr
): Promise<{ taskStatus: 'completed' | 'failed'; statusReason?: string }> {
  const aiClient = new ChatAnthropic({
    model: 'claude-haiku-4-5-20251001',
    anthropicApiKey: getSecret(SecretsKeys.ANTHROPIC_API_KEY, input.secrets),
    temperature: 0,
    clientOptions: {
      timeout: 5000, // 5 seconds (in milliseconds)
      maxRetries: 5, // Number of retries on failure
    },
  });
  return createDiagnosisCodeRecommendations(input.task, oystehr, aiClient);
}

export async function createDiagnosisCodeRecommendations(
  task: Task,
  oystehr: Oystehr,
  aiClient: BaseChatModel
): Promise<{ taskStatus: 'completed' | 'failed'; statusReason?: string }> {
  const encounterId = task.focus?.reference?.replace('Encounter/', '');
  if (!encounterId) {
    throw new Error(`No valid Encounter focus found on Task ${task.id}`);
  }

  console.time('time');
  console.timeLog('time', 'before creating fhir client and token resources');
  console.log('Getting token');
  console.timeLog('time', 'before fetching resources');

  console.log(`Getting encounter ${encounterId}`);
  const allResources = (
    await oystehr.fhir.search<Encounter | ClinicalImpression | Condition | Patient>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_revinclude:iterate',
          value: 'Condition:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'ClinicalImpression:encounter',
        },
      ],
    })
  ).unbundle();
  console.timeLog('time', 'after fetching resources');

  const encounter = allResources.find((resource) => resource.resourceType === 'Encounter');
  if (!encounter) {
    throw new Error(`Encounter ${encounterId} not found`);
  }
  const patient = allResources.find(
    (resource) =>
      resource.resourceType === 'Patient' && resource.id === encounter.subject?.reference?.replace('Patient/', '')
  );
  if (!patient) {
    throw new Error(`Patient for Encounter ${encounterId} not found`);
  }

  let hpiTextUpdated: string | undefined;
  let mdmTextUpdated: string | undefined;
  // Try to get HPI from existing chart data
  const existingChiefComplaint = allResources.find(
    (resource) =>
      resource.resourceType === 'Condition' && resource.meta?.tag?.find((tag) => tag.code === 'chief-complaint')
  ) as Condition | undefined;
  if (existingChiefComplaint?.note?.[0].text) {
    console.log('Using existing chief complaint text');
    hpiTextUpdated = existingChiefComplaint.note?.[0].text;
  }

  // Try to get MDM from existing chart data
  const existingMedicalDecision = allResources.find(
    (resource) =>
      resource.resourceType === 'ClinicalImpression' &&
      resource.meta?.tag?.find((tag) => tag.code === 'medical-decision')
  ) as ClinicalImpression | undefined;
  if (existingMedicalDecision?.summary) {
    console.log('Using existing medical decision text');
    mdmTextUpdated = existingMedicalDecision.summary;
  }

  const saveOrUpdateRequests: (
    | BatchInputPostRequest<ChartDataResources>
    | BatchInputPutRequest<ChartDataResources>
    | BatchInputRequest<ChartDataResources>
  )[] = [];

  console.timeLog('time', 'before generating codes');
  let potentialDiagnoses: { icd10: string; diagnosis: string }[] = [];
  if (!hpiTextUpdated && !mdmTextUpdated) {
    console.log('No HPI or MDM text available, skipping ICD-10 code generation');
  } else {
    console.log('Generating ICD-10 codes from clinical notes');
    potentialDiagnoses = await generateIcdTenCodesFromNotes(aiClient, hpiTextUpdated, mdmTextUpdated);
  }
  console.timeLog('time', 'after generating codes');
  const existingAiDiagnoses: Condition[] = allResources.filter(
    (resource) =>
      resource.resourceType === 'Condition' &&
      resource.meta?.tag?.find((tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/ai-potential-diagnosis`)?.code ===
        'ai-potential-diagnosis'
  ) as Condition[];
  // suggestions that are not suggested any more
  existingAiDiagnoses.forEach((existingDiagnosis) => {
    if (
      existingDiagnosis.id &&
      !potentialDiagnoses.some((diagnosis) => diagnosis.icd10 === existingDiagnosis.code?.coding?.[0]?.code)
    ) {
      saveOrUpdateRequests.push({ method: 'DELETE', url: `/Condition/${existingDiagnosis.id}` });
    }
  });

  potentialDiagnoses.forEach((diagnosis) => {
    // Try to not create duplicate suggestions
    if (existingAiDiagnoses.some((temp) => temp.code?.coding?.[0]?.code === diagnosis.icd10)) {
      return;
    }
    saveOrUpdateRequests.push(
      saveOrUpdateResourceRequest(
        makeDiagnosisConditionResource(
          encounterId,
          patient.id!,
          {
            code: diagnosis.icd10,
            display: diagnosis.diagnosis,
            isPrimary: false,
          },
          'ai-potential-diagnosis',
          'hpi-mdm'
        )
      )
    );
  });

  console.timeLog('time', 'before saving resources');
  const result = await oystehr.fhir.batch({
    requests: saveOrUpdateRequests,
  });
  console.timeLog('time', 'after saving resources');
  result.entry?.forEach(({ response }) => {
    if (response && Number(response.status) >= 300) {
      const outcome = response.outcome?.resourceType === 'OperationOutcome' ? response.outcome : undefined;
      console.error(
        `Error modifying resource: ${response.status} ${outcome?.issue.map((issue) => issue.details?.text).join(', ')}`
      );
    }
  });

  console.timeEnd('time');
  return {
    taskStatus: 'completed',
    statusReason: `Recommended ${potentialDiagnoses.length} diagnosis codes`,
  };
}
