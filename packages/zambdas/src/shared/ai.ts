import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessageChunk, BaseMessageLike, MessageContentComplex } from '@langchain/core/messages';
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { Condition, DocumentReference, Encounter, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  AI_OBSERVATION_META_SYSTEM,
  AiObservationField,
  getFormatDuration,
  getSecret,
  MIME_TYPES,
  PUBLIC_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
  VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE,
} from 'utils';
import { makeDiagnosisConditionResource, makeObservationResource } from './chart-data/index';
import { assertDefined } from './helpers';
import { parseCreatedResourcesBundle, saveResourceRequest } from './resources.helpers';

let chatbot: ChatAnthropic;
// let chatbotVertexAI: ChatVertexAI;

function getPrompt(fields: string): string {
  return `I'll give you a transcript of a chat between a healthcare provider and a patient. 
Please generate ${fields} with ICD-10 codes for the patient. 
Please present a response in JSON format. Don't add markdown. Use property names in camel case. For ICD-10 codes use "icd10" property.  
Use a single string property in JSON for each section except potential diagnoses. 
The transcript: `;
}

const AI_RESPONSE_KEY_TO_FIELD = {
  historyOfPresentIllness: AiObservationField.HistoryOfPresentIllness,
  pastMedicalHistory: AiObservationField.PastMedicalHistory,
  pastSurgicalHistory: AiObservationField.PastSurgicalHistory,
  medicationsHistory: AiObservationField.MedicationsHistory,
  allergies: AiObservationField.Allergies,
  socialHistory: AiObservationField.SocialHistory,
  familyHistory: AiObservationField.FamilyHistory,
  hospitalizationsHistory: AiObservationField.HospitalizationsHistory,
  labs: AiObservationField.Labs,
  erx: AiObservationField.eRX,
  procedures: AiObservationField.Procedures,
};

export async function invokeChatbotVertexAI(input: MessageContentComplex[], secrets: Secrets | null): Promise<string> {
  // call the vertex ai with fetch
  const GOOGLE_CLOUD_PROJECT_ID = getSecret(SecretsKeys.GOOGLE_CLOUD_PROJECT_ID, secrets);
  const GOOGLE_CLOUD_API_KEY = getSecret(SecretsKeys.GOOGLE_CLOUD_API_KEY, secrets);
  const request = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/global/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_CLOUD_API_KEY}`,
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
      model: 'claude-haiku-4-5-20251001',
      temperature: 0,
    });
  }
  return chatbot.invoke(input);
}

export async function createResourcesFromAiInterview(
  oystehr: Oystehr,
  encounterID: string,
  chatTranscript: string,
  z3URL: string | null,
  duration: number | undefined,
  mimeType: string | null,
  providerUserProfile: string | null,
  secrets: Secrets | null
): Promise<string> {
  let fields =
    'history of present illness, past medical history, past surgical history, medications history, allergies, social history, family history, hospitalizations history and potential diagnoses';
  // if there is a provider user profile, it is a recording
  if (providerUserProfile) {
    fields = 'labs, erx, procedures, ' + fields;
  }
  const aiResponseString = (
    await invokeChatbot([{ role: 'user', content: getPrompt(fields) + '\n' + chatTranscript }], secrets)
  ).content.toString();
  console.log(`AI response: "${aiResponseString}"`);
  const aiResponse = JSON.parse(aiResponseString);
  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterID,
  });
  const encounterId = assertDefined(encounter.id, 'encounter.id');
  const patientId = assertDefined(encounter.subject?.reference?.split('/')[1], 'patientId');
  const requests: BatchInputPostRequest<DocumentReference | Observation | Condition>[] = [];
  const documentReferenceCreateUrl = `urn:uuid:${uuid()}`;
  requests.push(
    createDocumentReference(
      encounterID,
      patientId,
      providerUserProfile,
      documentReferenceCreateUrl,
      z3URL,
      chatTranscript,
      duration,
      mimeType
    )
  );
  requests.push(...createObservations(aiResponse, documentReferenceCreateUrl, encounterId, patientId));
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

function createDocumentReference(
  encounterID: string,
  patientID: string,
  providerUserProfile: string | null,
  documentReferenceCreateUrl: string,
  z3URL: string | null,
  transcript: string,
  duration: number | undefined,
  mimeType: string | null
): BatchInputPostRequest<DocumentReference> {
  const documentReference: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: {
      coding: [VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE],
    },
    category: [
      {
        coding: [
          {
            system: 'http://loinc.org',
            code: '34133-9',
            display: 'Summarization of episode note',
          },
        ],
      },
    ],
    description: z3URL ? 'Summary of visit from audio recording' : 'Summary of visit from chat',
    subject: {
      reference: `Patient/${patientID}`,
    },
    date: DateTime.now().toISO(),
    content: [
      ...(mimeType && z3URL
        ? [
            {
              attachment: {
                contentType: mimeType,
                url: z3URL,
                title: `Audio recording (${duration ? getFormatDuration(duration) : 'unknown'})`,
              },
            },
          ]
        : []),
      {
        attachment: {
          contentType: MIME_TYPES.TXT,
          title: 'Transcript',
          data: btoa(unescape(encodeURIComponent(transcript))),
        },
      },
    ],
    context: {
      encounter: [
        {
          reference: `Encounter/${encounterID}`,
        },
      ],
    },
    extension: providerUserProfile
      ? [
          {
            url: `${PUBLIC_EXTENSION_BASE_URL}/provider`,
            valueReference: {
              reference: providerUserProfile,
            },
          },
        ]
      : [],
  };
  return saveResourceRequest(documentReference, documentReferenceCreateUrl);
}

function createObservations(
  aiResponse: any,
  documentReferenceCreateUrl: string,
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
            documentReferenceCreateUrl,
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
