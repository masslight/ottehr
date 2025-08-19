import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessageChunk, BaseMessageLike, MessageContentComplex } from '@langchain/core/messages';
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { Condition, Encounter, Observation } from 'fhir/r4b';
import { AI_OBSERVATION_META_SYSTEM, AiObservationField, getSecret, Secrets, SecretsKeys } from 'utils';
import { makeDiagnosisConditionResource, makeObservationResource } from './chart-data/index';
import { assertDefined } from './helpers';
import { parseCreatedResourcesBundle, saveResourceRequest } from './resources.helpers';

let chatbot: ChatAnthropic;
// let chatbotVertexAI: ChatVertexAI;

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

export async function invokeChatbotVertexAI(input: MessageContentComplex[], secrets: Secrets | null): Promise<string> {
  // call the vertex ai with fetch
  const GOOGLE_CLOUD_API_KEY = getSecret(SecretsKeys.GOOGLE_CLOUD_API_KEY, secrets);
  const request = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/leafy-antonym-429803-h5/locations/global/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_CLOUD_API_KEY}`,
    {
      method: 'POST',
      // headers: {
      //   Authorization: `Bearer ${GOOGLE_CLOUD_API_KEY}`,
      //   // 'Content-Type': 'application/json',
      // },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [input] }],
        generationConfig: {
          temperature: 0,
        },
      }),
    }
  );
  const response = await request.json();

  console.log(JSON.stringify(response));
  return response.candidates[0].content.parts[0].text;
}

export async function invokeChatbot(input: BaseMessageLike[], secrets: Secrets | null): Promise<AIMessageChunk> {
  process.env.ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  if (chatbot == null) {
    chatbot = new ChatAnthropic({
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0,
    });
  }
  return chatbot.invoke(input);
}

export async function createResourcesFromAiInterview(
  oystehr: Oystehr,
  encounterID: string,
  chatTranscript: string,
  secrets: Secrets | null
): Promise<string> {
  const aiResponseString = (
    await invokeChatbot([{ role: 'user', content: PROMPT + '\n' + chatTranscript }], secrets)
  ).content.toString();
  console.log(`AI response: "${aiResponseString}"`);
  const aiResponse = JSON.parse(aiResponseString);
  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterID,
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
  return createdResources;
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
