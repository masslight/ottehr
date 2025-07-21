import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Consent, Encounter, QuestionnaireResponse } from 'fhir/r4b';
import {
  createOystehrClient,
  FHIR_AI_CHAT_CONSENT_CATEGORY_CODE,
  getSecret,
  Secrets,
  SecretsKeys,
  StartInterviewInput,
} from 'utils';
import { getAuth0Token, validateJsonBody, validateString, wrapHandler, ZambdaInput } from '../../../shared';
import { invokeChatbot } from '../../../shared/ai';

export const INTERVIEW_COMPLETED = 'Interview completed.';

const INITIAL_USER_MESSAGE = `Perform a medical history intake session with me by asking me relevant questions.
 Ask no more than 30 questions.
 Ask one question at a time.
 Don't numerate questions.
 When you'll have no new questions to ask just say 
 "No further questions, thanks for chatting. We've sent the information to your nurse or doctor to review. ${INTERVIEW_COMPLETED}"`;
const QUESTIONNAIRE_ID = 'aiInterviewQuestionnaire';

let oystehrToken: string;

interface Input extends StartInterviewInput {
  secrets: Secrets | null;
}

const ZAMBDA_NAME = 'ai-interview-start';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { appointmentId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const encounterId = await findEncounter(appointmentId, oystehr);
    if (encounterId == null) {
      throw new Error(`Encounter for appointment "${appointmentId}" not found`);
    }
    if (!(await consentPresent(appointmentId, oystehr))) {
      throw new Error(`Patient's consent for  "${appointmentId}" not found`);
    }
    let questionnaireResponse: QuestionnaireResponse;
    const existingQuestionnaireResponse = await findAIInterviewQuestionnaireResponse(encounterId, oystehr);
    if (existingQuestionnaireResponse != null) {
      questionnaireResponse = existingQuestionnaireResponse;
    } else {
      questionnaireResponse = await createQuestionnaireResponse(encounterId, oystehr, secrets);
    }
    return {
      statusCode: 200,
      body: JSON.stringify(questionnaireResponse),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
});

function validateInput(input: ZambdaInput): Input {
  const { appointmentId } = validateJsonBody(input);
  return {
    appointmentId: validateString(appointmentId, 'appointmentId'),
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

async function findEncounter(appointmentId: string, oystehr: Oystehr): Promise<string | undefined> {
  return (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: 'appointment',
          value: 'Appointment/' + appointmentId,
        },
      ],
    })
  ).unbundle()[0]?.id;
}

async function consentPresent(appointmentId: string, oystehr: Oystehr): Promise<boolean> {
  return (
    (
      await oystehr.fhir.search<Consent>({
        resourceType: 'Consent',
        params: [
          {
            name: 'data',
            value: 'Appointment/' + appointmentId,
          },
          {
            name: 'category',
            value: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes|' + FHIR_AI_CHAT_CONSENT_CATEGORY_CODE,
          },
        ],
      })
    ).unbundle().length > 0
  );
}

async function findAIInterviewQuestionnaireResponse(
  encounterId: string,
  oystehr: Oystehr
): Promise<QuestionnaireResponse | undefined> {
  return (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        {
          name: 'encounter',
          value: 'Encounter/' + encounterId,
        },
        {
          name: 'questionnaire',
          value: '#' + QUESTIONNAIRE_ID,
        },
      ],
    })
  ).unbundle()[0];
}

async function createQuestionnaireResponse(
  encounterId: string,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<QuestionnaireResponse> {
  const firstAIQuestion = (
    await invokeChatbot([{ role: 'user', content: INITIAL_USER_MESSAGE }], secrets)
  ).content.toString();
  return oystehr.fhir.create<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    status: 'in-progress',
    questionnaire: '#' + QUESTIONNAIRE_ID,
    encounter: {
      reference: 'Encounter/' + encounterId,
    },
    item: [
      {
        linkId: '0',
        answer: [
          {
            valueString: INITIAL_USER_MESSAGE,
          },
        ],
      },
    ],
    contained: [
      {
        resourceType: 'Questionnaire',
        id: QUESTIONNAIRE_ID,
        status: 'active',
        item: [
          {
            linkId: '0',
            text: 'Initial message',
            type: 'text',
          },
          {
            linkId: '1',
            text: firstAIQuestion,
            type: 'text',
          },
        ],
      },
    ],
  });
}
