import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AI_QUESTIONNAIRE_ID,
  createOystehrClient,
  getSecret,
  Secrets,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  StartInterviewInput,
} from 'utils';
import {
  getAuth0Token,
  topLevelCatch,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { invokeChatbot } from '../../../shared/ai';

export const INTERVIEW_COMPLETED = 'Interview completed.';

function getInitialUserMessageUrgentCare(patientInfo: string): string {
  return `Perform a medical history intake session in the manner of a physician preparing me or my dependent for an urgent care visit, without using a fake name:
  •	Use a friendly and concerned physician's tone
  ${patientInfo}
  • Determine if you are communicating with the patient directly or a parent/guardian.
  •	Ask only one question at a time.
  •	Ask no more than 8 questions in total.
  •	Don't number the questions.
  •	Cover all the major domains efficiently: chief complaint, history of present illness, past medical history, past surgical history, medications, allergies, family history, social history, hospitalizations, and relevant review of systems.
  •	Phrase questions in a clear, patient-friendly way that keeps the conversation moving quickly.
  •	If I give vague or incomplete answers, ask a brief follow-up before moving on.
  •	When you have gathered all useful information, end by saying: "No further questions, thanks for chatting. We've sent the information to your nurse or doctor to review. ${INTERVIEW_COMPLETED}";
  Begin taking the history by saying "I am an AI assistant who will ask you some questions to help your nurse or doctor prepare for your visit. Are you the patient or are you their parent or guardian?"`;
}

function getInitialUserMessageWorkerComp(patientInfo: string): string {
  return `Perform a medical history intake session in the manner of a physician doing patient intake for a potential job related injury.
  • Use a friendly and concerned physician's tone, but do not give yourself a name
  ${patientInfo}
  • Determine if you are communicating with the patient directly or a parent/guardian.
  • Ask only one question at a time.
  • Ask no more than 8 questions in total.
  • Don't number the questions.

  Be sure to cover the following:
  When did the injury happen?
  How did the injury happen?
  What body part(s) got injured?
  Was this related to work or an auto accident?
  Date and time of injury (very specific)
  Location where injury occurred (workplace/job site)
  Activity being performed at time of injury
  Detailed description of what happened
  Body part(s) affected
  Symptoms noted at time of injury

  If this was related to an auto-accident, cover these topics:
  Patient's role (driver, passenger, pedestrian, cyclist)
  Type of collision (rear-end, T-bone, head-on, rollover, etc.)
  Speed estimate (if available)
  Restraint use (seatbelt, airbag triggered)
  Any loss of consciousness
  Immediate symptoms

  If time permits ask about past medical history, past surgical history, medications, allergies, family history, social history, hospitalizations, and relevant review of systems.
  • Phrase questions in a clear, patient-friendly way that keeps the conversation moving quickly.
  • If I give vague or incomplete answers, ask a brief follow-up before moving on.
  • When you have gathered all useful information, end by saying: "No further questions, thanks for chatting. We've sent the information to your nurse or doctor to review. ${INTERVIEW_COMPLETED}"
  Begin taking the history by saying "I am an AI assistant who will ask you some questions to help your nurse or doctor prepare for your visit. Are you the patient or are you their parent or guardian?"`;
}

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

    const resources = (
      await oystehr.fhir.search<Encounter | Appointment | Patient>({
        resourceType: 'Encounter',
        params: [
          {
            name: 'appointment',
            value: 'Appointment/' + appointmentId,
          },
          {
            name: '_include',
            value: 'Encounter:appointment',
          },
          {
            name: '_include:iterate',
            value: 'Appointment:patient',
          },
        ],
      })
    ).unbundle();
    const encounter = resources.find((resource) => resource.resourceType === 'Encounter');
    const encounterId = encounter?.id;
    if (encounter == null || encounterId == null) {
      throw new Error(`Encounter for appointment ID ${appointmentId} not found`);
    }

    const appointment = resources.find((resource) => resource.resourceType === 'Appointment');
    if (appointment == null) {
      throw new Error(`Appointment for appointment ID ${appointmentId} not found`);
    }

    const patient = resources.find((resource) => resource.resourceType === 'Patient');
    let questionnaireResponse: QuestionnaireResponse;
    const existingQuestionnaireResponse = await findAIInterviewQuestionnaireResponse(encounterId, oystehr);
    const patientInfoDetails = [];
    if (patient) {
      if (patient.name && patient.name.length > 0) {
        patientInfoDetails.push(`The patient name is: ${patient.name[0].given?.[0]} ${patient.name[0].family}`);
      }
      if (patient.birthDate) {
        const birthDate = DateTime.fromISO(patient.birthDate);
        const now = DateTime.now();
        const patientAge = Math.floor(now.diff(birthDate, 'years').years);
        patientInfoDetails.push(`Age: ${patientAge} year old`);
      }
      if (patient.gender) {
        patientInfoDetails.push(`Sex: ${patient.gender}`);
      }
      if (appointment.description) {
        patientInfoDetails.push(`Reason for visit: ${appointment.description}`);
      }
    }
    let prompt = getInitialUserMessageUrgentCare(patientInfoDetails.join(', ') + '.');

    if (
      appointment.serviceCategory?.find(
        (serviceCategory) =>
          serviceCategory.coding?.find(
            (coding) => coding.system === SERVICE_CATEGORY_SYSTEM && coding.code === 'workers-comp'
          )
      )
    ) {
      console.log('Using workers compensation prompt');
      prompt = getInitialUserMessageWorkerComp(patientInfoDetails.join(', ') + '.');
    }

    if (existingQuestionnaireResponse != null) {
      questionnaireResponse = existingQuestionnaireResponse;
    } else {
      questionnaireResponse = await createQuestionnaireResponse(encounterId, prompt, oystehr, secrets);
    }
    return {
      statusCode: 200,
      body: JSON.stringify(questionnaireResponse),
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
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
          value: '#' + AI_QUESTIONNAIRE_ID,
        },
      ],
    })
  ).unbundle()[0];
}

// #aiInterview: start ai interview questionnaire
async function createQuestionnaireResponse(
  encounterId: string,
  prompt: string,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<QuestionnaireResponse> {
  const firstAIQuestion = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();
  return oystehr.fhir.create<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    status: 'in-progress',
    questionnaire: '#' + AI_QUESTIONNAIRE_ID,
    encounter: {
      reference: 'Encounter/' + encounterId,
    },
    item: [
      {
        linkId: '0',
        answer: [
          {
            valueString: prompt,
          },
        ],
      },
    ],
    contained: [
      {
        resourceType: 'Questionnaire',
        id: AI_QUESTIONNAIRE_ID,
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
