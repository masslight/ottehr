import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessageChunk, BaseMessageLike, MessageContentComplex } from '@langchain/core/messages';
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Condition, DocumentReference, Encounter, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  AI_OBSERVATION_META_SYSTEM,
  AiObservationField,
  fixAndParseJsonObjectFromString,
  getFormatDuration,
  getSecret,
  MIME_TYPES,
  PUBLIC_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
  VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE,
} from 'utils';
import { makeObservationResource } from './chart-data/index';
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
  const RETRY_COUNT = 5;
  const FIRST_DELAY_MS = 1000;
  const JITTER_PERCENT = 0.01;

  const backoffTimes = Array.from(
    { length: RETRY_COUNT },
    (_, i) => 2 ** i * FIRST_DELAY_MS * (1 - JITTER_PERCENT + Math.random() * JITTER_PERCENT * 2)
  );
  const requests = backoffTimes.map(async (backoffTime) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      return fetch(
        `https://aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/global/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [input] }],
            generationConfig: {
              temperature: 0,
            },
          }),
        }
      );
    } catch (error) {
      console.error('Error invoking Vertex AI:', error);
      captureException(error);
      throw error;
    }
  });
  const response = await (await Promise.any(requests)).json();

  console.log(JSON.stringify(response));
  return response.candidates[0].content.parts[0].text;
}

export async function invokeChatbot(input: BaseMessageLike[], secrets: Secrets | null): Promise<AIMessageChunk> {
  process.env.ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  if (chatbot == null) {
    chatbot = new ChatAnthropic({
      model: 'claude-haiku-4-5-20251001',
      temperature: 0,
      clientOptions: {
        timeout: 10000, // 10 seconds (in milliseconds)
        maxRetries: 5, // Number of retries on failure
      },
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
  const source = providerUserProfile ? 'audio-recording' : 'chat';
  if (source === 'audio-recording') {
    fields = 'labs, erx, procedures, ' + fields;
  }
  const aiResponseString = (
    await invokeChatbot([{ role: 'user', content: getPrompt(fields) + '\n' + chatTranscript }], secrets)
  ).content.toString();
  console.log(`AI response: "${aiResponseString}"`);
  let aiResponse;
  try {
    aiResponse = JSON.parse(aiResponseString);
  } catch (error) {
    console.warn('Failed to parse AI response, attempting to fix JSON format:', error);
    aiResponse = fixAndParseJsonObjectFromString(aiResponseString);
  }
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

function getIcdTenCodesPrompt(hpiText: string | undefined, mdmText: string | undefined): string {
  const content = [];
  if (hpiText) {
    content.push(`History of Present Illness: ${hpiText}`);
  }
  if (mdmText) {
    content.push(`Medical Decision Making: ${mdmText}`);
  }

  return `Based on the following clinical notes, suggest potential ICD-10 diagnoses for a patient

${content.join('\n\n')}

Provide a JSON response with this example format. Do not include markdown formatting.

{
  "potentialDiagnoses": [
    {
      "diagnosis": "Diagnosis description",
      "icd10": "ICD-10 Code"
    }
  ]
}

Only suggest diagnoses that are supported by the clinical information provided. Provide at most 5 results. If there are not relevant results, return an empty list`;
}

export async function generateIcdTenCodesFromNotes(
  hpiText: string | undefined,
  mdmText: string | undefined,
  secrets: Secrets | null
): Promise<{ diagnosis: string; icd10: string }[]> {
  try {
    const prompt = getIcdTenCodesPrompt(hpiText, mdmText);
    const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();

    console.log(`AI ICD-10 codes response: "${aiResponseString}"`);
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseString);
    } catch (parseError) {
      console.warn('Failed to parse AI ICD-10 response, attempting to fix JSON format:', parseError);
      aiResponse = fixAndParseJsonObjectFromString(aiResponseString);
    }

    return aiResponse.potentialDiagnoses || [];
  } catch (error) {
    console.error('Error generating ICD-10 codes:', error);
    captureException(error);
    throw error;
  }
}
