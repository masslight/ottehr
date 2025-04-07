import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Observation, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { createOystehrClient, FHIR_EXTENSION, getSecret, Secrets, SecretsKeys } from 'utils';
import { configSentry, getAuth0Token, validateJsonBody, ZambdaInput } from '../../../shared';
import Oystehr from '@oystehr/sdk';
import { invokeChatbot } from '../../../shared/ai';

export const INTERVIEW_COMPLETED = 'Interview completed.';

const PROMPT = `I'll give you a transcript of a chat between a healthcare provider and a patient. 
Please generate history of present illness, past medical history, past surgical history, medications history, 
allergies, social history, family history and potential diagnoses with ICD-10 codes for the patient. 
Please present the response in JSON format. The transcript:`;

const AI_RESPONSE_KEY_TO_LOINC = {
  history_of_present_illness: '10164-2',
  past_medical_history: '10158-4',
  past_surgical_history: '10167-5',
  medications_history: '10160-0',
  allergies: '10155-0',
  social_history: '10166-7',
  family_history: '10157-6',
};

let oystehrToken: string;

interface Input {
  questionnaireResponse: QuestionnaireResponse;
  secrets: Secrets | null;
}

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('sub-generate-diagnostic-report', input.secrets);
  console.log('Generate AI diagnostic report invoked');
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponse, secrets } = validateInput(input);
    const chatTranscript = createChatTranscript(questionnaireResponse);
    const aiResponseString = (
      await invokeChatbot([{ role: 'user', content: PROMPT + '\n' + chatTranscript }], secrets)
    ).content.toString();
    const aiResponse = JSON.parse(aiResponseString);
    const observations = createObservations(aiResponse);
    const oystehr = await createOystehr(secrets);
    const diagnosticReport = await oystehr.fhir.create<DiagnosticReport>({
      resourceType: 'DiagnosticReport',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: FHIR_EXTENSION.DiagnosticReport.potentialDiagnosis.url,
              code: 'ai-chat',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '10164-2',
          },
        ],
      },
      encounter: questionnaireResponse.encounter,
      result: observations.map((observation) => {
        return { reference: '#' + observation.id };
      }),
      contained: observations,
      extension: aiResponse.potential_diagnoses?.map(
        (diagnosis: { diagnosis: any; icd10_code: string; rationale: string }) => {
          return {
            ...FHIR_EXTENSION.DiagnosticReport.potentialDiagnosis,
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://hl7.org/fhir/sid/icd-10',
                  code: diagnosis.icd10_code,
                  display: diagnosis.diagnosis,
                },
              ],
            },
            text: diagnosis.rationale,
          };
        }
      ),
    });
    return {
      statusCode: 200,
      body: JSON.stringify(`Successfully created DiagnosticReport/${diagnosticReport.id}`),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

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

function createObservations(aiResponse: any): Observation[] {
  return Object.entries(AI_RESPONSE_KEY_TO_LOINC).flatMap(([key, loinc]) => {
    if (aiResponse[key] != null) {
      return [createObservation(aiResponse[key], loinc)];
    }
    return [];
  });
}

function createObservation(text: string, code: string): Observation {
  return {
    resourceType: 'Observation',
    id: code,
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: code,
        },
      ],
    },
    valueString: text,
  };
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
