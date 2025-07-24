import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Condition, Encounter, Observation, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import {
  AI_OBSERVATION_META_SYSTEM,
  AiObservationField,
  createOystehrClient,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  assertDefined,
  configSentry,
  getAuth0Token,
  makeDiagnosisConditionResource,
  makeObservationResource,
  parseCreatedResourcesBundle,
  saveResourceRequest,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { invokeChatbot } from '../../../shared/ai';

export const INTERVIEW_COMPLETED = 'Interview completed.';

const ZAMBDA_NAME = 'ai-interview-summary';

const PROMPT = `I'll give you a transcript of a chat between a healthcare provider and a patient. 
Please generate history of present illness, past medical history, past surgical history, medications history, 
allergies, social history, family history, hospitalizations history and potential diagnoses with ICD-10 codes for the patient. 
Please present a response in JSON format. Don't add markdown. Use property names in camel case. For ICD-10 codes use "icd10" property.  
Use a single string property in JSON for each section except potential diagnoses. 
The transcript: `;

const AI_RESPONSE_KEY_TO_FIELD = {
  historyOfPresentIllness: AiObservationField.HistoryOfPresentIllness,
  pastMedicalHistory: AiObservationField.PastMedicalHistory,
  pastSurgicalHistory: AiObservationField.PastSurgicalHistory,
  medicationsHistory: AiObservationField.MedicationsHistory,
  allergies: AiObservationField.Allergies,
  socialHistory: AiObservationField.SocialHistory,
  familyHistory: AiObservationField.FamilyHistory,
  hospitalizationsHistory: AiObservationField.HospitalizationsHistory,
};

let oystehrToken: string;

interface Input {
  questionnaireResponse: QuestionnaireResponse;
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('sub-ai-interview-summary', input.secrets);
  console.log('AI interview summary invoked');
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponse, secrets } = validateInput(input);
    const chatTranscript = createChatTranscript(questionnaireResponse);
    const aiResponseString = (
      await invokeChatbot([{ role: 'user', content: PROMPT + '\n' + chatTranscript }], secrets)
    ).content.toString();
    console.log(`AI response: "${aiResponseString}"`);
    const aiResponse = JSON.parse(aiResponseString);
    const oystehr = await createOystehr(secrets);
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: questionnaireResponse.encounter?.reference?.split('/')[1] ?? '',
    });
    const encounterId = assertDefined(encounter.id, 'encounter.id');
    const patientId = assertDefined(encounter.subject?.reference?.split('/')[1], 'patientId');
    const requests: BatchInputPostRequest<Observation | Condition>[] = [];
    requests.push(...createObservations(aiResponse, encounterId, patientId));
    requests.push(...createDiagnosis(aiResponse, encounterId, patientId));
    console.log('Transaction requests: ' + JSON.stringify(requests, null, 2));
    const transactionBundle = await oystehr.fhir.transaction({
      requests: requests,
    });
    const createdResources = parseCreatedResourcesBundle(transactionBundle)
      .map((resource) => resource.resourceType + '/' + resource.id)
      .join(',');
    console.log('Created ' + createdResources);
    return {
      statusCode: 200,
      body: JSON.stringify(`Successfully created ` + createdResources),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
});

function createChatTranscript(questionnaireResponse: QuestionnaireResponse): string {
  const questionnaire = questionnaireResponse.contained?.[0] as Questionnaire;
  return (questionnaire.item ?? [])
    .sort((itemA, itemB) => parseInt(itemA.linkId) - parseInt(itemB.linkId))
    .flatMap<string>((questionItem) => {
      if (questionItem.linkId == '0') {
        return [];
      }
      const answerItem = questionnaireResponse.item?.find((answerItem) => answerItem.linkId === questionItem.linkId);
      const answerText = answerItem?.answer?.[0]?.valueString;
      const result: string[] = [`Provider: "${questionItem.text}"`];
      if (answerText != null) {
        result.push(`Patient: "${answerText}"`);
      }
      return result;
    })
    .join('\n');
}

function createObservations(
  aiResponse: any,
  encounterId: string,
  patientId: string
): BatchInputPostRequest<Observation>[] {
  return Object.entries(AI_RESPONSE_KEY_TO_FIELD).flatMap(([key, field]) => {
    if (aiResponse[key] != null) {
      return [
        saveResourceRequest(
          makeObservationResource(
            encounterId,
            patientId,
            '',
            {
              field: field,
              value: aiResponse[key],
            },
            AI_OBSERVATION_META_SYSTEM
          )
        ),
      ];
    }
    return [];
  });
}

function createDiagnosis(aiResponse: any, encounterId: string, patientId: string): BatchInputPostRequest<Condition>[] {
  return aiResponse.potentialDiagnoses?.map((diagnosis: { diagnosis: any; icd10: string }) => {
    return saveResourceRequest(
      makeDiagnosisConditionResource(
        encounterId,
        patientId,
        {
          code: diagnosis.icd10,
          display: diagnosis.diagnosis,
          isPrimary: false,
        },
        'ai-potential-diagnosis'
      )
    );
  });
}

function validateInput(input: ZambdaInput): Input {
  const questionnaireResponse = validateJsonBody(input);
  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw new Error(
      `QuestionnaireResponse is expected as request's body but received "${JSON.stringify(questionnaireResponse)}"`
    );
  }
  return {
    questionnaireResponse,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(
    oystehrToken,
    getSecret(SecretsKeys.FHIR_API, secrets),
    getSecret(SecretsKeys.PROJECT_API, secrets)
  );
}
