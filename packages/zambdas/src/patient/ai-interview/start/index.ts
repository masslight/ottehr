import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, Secrets, SecretsKeys, validateJsonBody, validateString, ZambdaInput } from 'zambda-utils';
import { Encounter, QuestionnaireResponse } from 'fhir/r4b';
import { createOystehrClient, StartInterviewInput } from 'utils';
import { getAuth0Token } from '../../shared';
import Oystehr from '@oystehr/sdk';
import { invokeChatbot } from '../common';

export const INTERVIEW_COMPLETED = 'Interview completed.';

const QUESTIONNAIRE_URL = 'https://ottehr.com/FHIR/Questionnaire/ai-interview';
const INITIAL_USER_MESSAGE = `Perform a medical history intake session with me by asking me relevant questions.
 Ask no more than 30 questions.
 Ask one question at a time.
 When you'll have no new questions to ask, make a summary and say 
 "I've recorded what you've shared, and this will be reviewed by your provider, to better understand your situation and prepare for your visit. ${INTERVIEW_COMPLETED}"`;

let oystehrToken: string;

interface Input extends StartInterviewInput {
  secrets: Secrets | null;
}

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { appointmentId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const encounterId = await findEncounter(appointmentId, oystehr);
    if (encounterId == null) {
      throw new Error(`Encounter for appointment "${appointmentId}" not found`);
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
};

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
          value: QUESTIONNAIRE_URL,
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
    questionnaire: QUESTIONNAIRE_URL,
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
        id: 'questionnaire',
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
    extension: [
      {
        url: 'questionnaire',
        valueReference: {
          reference: '#questionnaire',
        },
      },
    ],
  });
}
