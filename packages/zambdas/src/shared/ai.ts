import { AnthropicMessagesModelId, ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk, BaseMessageLike, MessageContentComplex } from '@langchain/core/messages';
import Oystehr, { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Appointment, Condition, DocumentReference, Encounter, Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
  DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT,
  PUBLIC_EXTENSION_BASE_URL,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils/lib/fhir/constants';
import { getFormatDuration } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE } from 'utils/lib/types/api/appointment.types';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { AI_OBSERVATION_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AiSuggestionItem } from 'utils/lib/types/data/screening-questions/types';
import { MIME_TYPES } from 'utils/lib/utils/file';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { makeObservationResource } from './chart-data/index';
import { assertDefined } from './helpers';
import { parseCreatedResourcesBundle, saveResourceRequest, updateResourceRequest } from './resources.helpers';
import { createPresignedUrl } from './z3Utils';

export const NO_SPEECH_DETECTED = 'NO_SPEECH_DETECTED';

export const TRANSCRIPT_PROMPT =
  'Give a transcript of this file, include only the transcript without other input, include who the speaker is ' +
  'with labels for the provider and the patient. If the audio contains just silence or background noise, ' +
  `respond with "${NO_SPEECH_DETECTED}"`;

export class ClaudeClient {
  chatbot: ChatAnthropic;

  constructor(anthropicApiKey: string, model: AnthropicMessagesModelId = 'claude-haiku-4-5-20251001') {
    this.chatbot = new ChatAnthropic({
      model,
      anthropicApiKey,
      temperature: 0,
      clientOptions: {
        timeout: 5000,
        maxRetries: 5,
      },
    });
  }

  async invoke(input: BaseMessageLike[]): Promise<AIMessageChunk> {
    return this.chatbot.invoke(input);
  }
}

let chatbot: ChatAnthropic;

export function getPrompt(patientInfoDetails: string, fields: string): string {
  return `I'll give you a transcript of a chat between a healthcare provider and a patient.
Patient details: ${patientInfoDetails}
Please generate ${fields} based on the transcript.
Return JSON. No markdown. Use camelCase keys.

FORMAT RULES:
- "historyOfPresentIllness", "mechanismOfInjury", "socialHistory", and "familyHistory" should be a single descriptive prose string.
- For the following sections, provide BOTH a prose summary string AND a companion array of individual items with the suffix "Items":
  pastMedicalHistory / pastMedicalHistoryItems,
  pastSurgicalHistory / pastSurgicalHistoryItems,
  medicationsHistory / medicationsHistoryItems,
  allergies / allergiesItems,
  hospitalizationsHistory / hospitalizationsHistoryItems,
  labs / labsItems,
  erx / erxItems,
  procedures / proceduresItems.
- The prose string summarizes the information as a readable sentence.
- Each item in the Items array must be an object with "display" and "searchTerms":
  - "display": the term or phrase as it appears verbatim in the prose (used for highlighting).
  - "searchTerms": an array of 1 to 3 terms to search a medical database.
    For medications and allergies: always include the display term as the first entry (it may be a valid brand name). Add clinical synonyms when the display is colloquial (e.g. "Tylenol" -> ["Tylenol", "acetaminophen"]).
    For conditions, surgical history, and hospitalizations: use ONLY clinical/standard terms suitable for ICD-10 or CPT search. Do NOT include the lay display term if it differs from the clinical term (e.g. "ear infections" -> ["otitis media"], NOT ["ear infections", "otitis media"]).
- For medications: display is the medication name from the prose. searchTerms are standard drug names.
- For allergies: display is the allergen name from the prose. searchTerms are standard allergen names. Do NOT include reactions.
- For conditions: display is the condition as stated in the prose. searchTerms are ICD-10 compatible clinical terms.
- For surgical history: display is the procedure as stated. searchTerms are standard procedure names.
- For hospitalizations: display is the reason as stated. searchTerms are standard clinical terms.
- Do NOT include items the patient denies or negates.
- Omit sections with no relevant information entirely.

Example response:
{
  "historyOfPresentIllness": "The patient presents with chest pain for 2 days, worsening with exertion.",
  "pastMedicalHistory": "History of high blood pressure and sugar disease.",
  "pastMedicalHistoryItems": [{"display": "high blood pressure", "searchTerms": ["hypertension"]}, {"display": "sugar disease", "searchTerms": ["diabetes mellitus"]}],
  "pastSurgicalHistory": "Appendectomy in 2019.",
  "pastSurgicalHistoryItems": [{"display": "appendectomy", "searchTerms": ["appendectomy"]}],
  "medicationsHistory": "Currently taking a blood thinner and Metformin twice daily.",
  "medicationsHistoryItems": [{"display": "blood thinner", "searchTerms": ["warfarin", "apixaban", "enoxaparin"]}, {"display": "Metformin", "searchTerms": ["Metformin"]}],
  "allergies": "Allergic to penicillin, tree nuts, and sulfa drugs.",
  "allergiesItems": [{"display": "penicillin", "searchTerms": ["penicillin"]}, {"display": "tree nuts", "searchTerms": ["tree nut"]}, {"display": "sulfa drugs", "searchTerms": ["sulfonamide"]}],
  "socialHistory": "Non-smoker, occasional alcohol use.",
  "familyHistory": "Father with coronary artery disease, mother with breast cancer.",
  "hospitalizationsHistory": "Hospitalized for pneumonia in January 2023.",
  "hospitalizationsHistoryItems": [{"display": "pneumonia", "searchTerms": ["pneumonia"]}],
  "labs": "CBC and BMP ordered.",
  "labsItems": [{"display": "CBC", "searchTerms": ["CBC"]}, {"display": "BMP", "searchTerms": ["BMP"]}],
  "erx": "Amoxicillin 500mg prescribed.",
  "erxItems": [{"display": "Amoxicillin", "searchTerms": ["Amoxicillin"]}],
  "procedures": "Wound closure performed.",
  "proceduresItems": [{"display": "wound closure", "searchTerms": ["wound closure"]}]
}
The transcript: `;
}

const AI_RESPONSE_KEY_TO_FIELD = {
  historyOfPresentIllness: AiObservationField.HistoryOfPresentIllness,
  mechanismOfInjury: AiObservationField.MechanismOfInjury,
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

export const VERTEX_AI_MODEL = 'gemini-3.1-flash-lite';

export async function invokeChatbotVertexAI(
  input: MessageContentComplex[],
  secrets: Secrets | null,
  responseSchema?: object,
  model: string = VERTEX_AI_MODEL
): Promise<string> {
  const GOOGLE_CLOUD_PROJECT_ID = getSecret(SecretsKeys.GOOGLE_CLOUD_PROJECT_ID, secrets);
  const GOOGLE_CLOUD_API_KEY = getSecret(SecretsKeys.GOOGLE_CLOUD_API_KEY, secrets);
  const RETRY_COUNT = 3;
  const FIRST_DELAY_MS = 3000;
  const JITTER = 0.01;

  const shouldRetry = (status: number): boolean => {
    // Retry on rate limiting and server errors
    // these http status codes were chosen by an AI and while they look reasonable they are suspect
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  };

  const backoffTimes = Array.from({ length: RETRY_COUNT }, (_, i) =>
    // This ends up with an array of exponential backoff times with small perturbations like [ 0, 3002, 5964, 12077, 24109 ]
    // for more information about this approach see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    i === 0 ? 0 : 2 ** (i - 1) * FIRST_DELAY_MS * (1 - JITTER + Math.random() * JITTER * 2)
  );

  let resolved = false;
  let terminal = false; // a non-retryable status came back; further attempts would just resend the payload
  // Promise.any cannot reject until every attempt has, so on its own a rejected terminal attempt left the
  // caller waiting out the later attempts' backoff sleeps. Racing this against the ladder surfaces it now.
  let failTerminally: (error: Error) => void = () => undefined;
  const terminalFailure = new Promise<never>((_resolve, reject) => {
    failTerminally = reject;
  });
  const requests = backoffTimes.map(async (backoffTime) => {
    await new Promise((resolve) => setTimeout(resolve, backoffTime));

    // Reject rather than resolve, so a skipped attempt can never become Promise.any's winning value.
    if (resolved || terminal) throw new Error('Vertex AI attempt superseded');

    try {
      const response = await fetch(
        `https://aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/global/publishers/google/models/${model}:generateContent?key=${GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vertex-AI-LLM-Request-Type': 'shared',
            'X-Vertex-AI-LLM-Shared-Request-Type': 'priority',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [input] }],
            generationConfig: {
              temperature: 0,
              ...(responseSchema && {
                responseMimeType: 'application/json',
                responseSchema,
              }),
            },
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        if (shouldRetry(response.status)) {
          // Carry Vertex's own message: if every attempt fails this is all the caller gets to go on.
          throw new Error(`Retryable error: ${response.status} ${errorBody.slice(0, 500)}`);
        }
        terminal = true;
        const failure = new Error(
          `Vertex AI request failed: ${response.status} ${response.statusText} ${errorBody.slice(0, 1000)}`
        );
        failTerminally(failure);
        throw failure;
      }

      const body = await response.text();
      // Size only: on a transcription call the body is the transcript, which is PHI.
      console.log(`Vertex AI responded with ${body.length} bytes`);

      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        // A proxy's HTML error page or a truncated response would otherwise throw a bare SyntaxError.
        throw new Error(`Vertex AI returned a non-JSON body: ${body.slice(0, 1000)}`);
      }

      // Unchecked, an error body fell through to `candidates[0]` and every Vertex failure surfaced as
      // `TypeError: Cannot read properties of undefined` with an empty stack.
      const candidate = parsed?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      // Whitespace is not output: it satisfies every downstream caller's type but dies in the JSON parse or
      // lands a blank transcript on the chart, and it would do so with the attempt already counted a success.
      if (typeof text !== 'string' || text.trim().length === 0) {
        // No candidate text means the model refused, was cut off (safety block, MAX_TOKENS finishReason), or
        // spent the whole turn on thinking tokens and emitted none. Everything outside `candidates` is
        // metadata — quota, model build, response id, prompt feedback — so it is reported whole: it names the
        // cause where a hand-picked field or two left `{}`. `candidates` is dropped wholesale rather than
        // inspected shape by shape, because one that was cut off can still hold a partial transcript and a
        // sibling can hold a whole one, and neither belongs in a log or a Sentry issue.
        // Capped like every other body interpolated here: dropping `candidates` bounds what this can say
        // about a Gemini response, but not about a gateway envelope that carries the request back, which on
        // the transcription path is the base64 audio — and this reason is logged and shipped to Sentry.
        const { candidates: _candidates, ...metadata } = parsed ?? {};
        const reason = JSON.stringify({ finishReason: candidate?.finishReason, ...metadata }).slice(0, 1000);
        throw new Error(`Vertex AI returned no text: ${reason}`);
      }

      // Only an attempt that produced usable text may win. This used to be set on `response.ok` alone, so a
      // 200 carrying no candidates resolved the ladder and the remaining attempts were skipped as superseded.
      resolved = true;
      return text;
    } catch (error) {
      // One attempt failing is not an incident — the ladder exists because Vertex sheds load with 429s and a
      // later attempt usually succeeds. Keep it in the log for the trace, but don't report it: reporting here
      // raised a Sentry alert for every self-healed retry, and double-reported the ones that did fail, since
      // whatever this function finally throws reaches Sentry once via the handler's topLevelCatch.
      console.warn('Vertex AI attempt failed:', error);
      throw error;
    }
  });

  try {
    // Every attempt now resolves only with validated text, so Promise.any picks the first usable result
    // rather than the first HTTP 200.
    return await Promise.race([Promise.any(requests), terminalFailure]);
  } catch (error) {
    // Only Promise.any rejects with an AggregateError; anything else came from the terminal signal. Such a
    // status is its own diagnosis, and wrapping it in the ladder's message would bury it and group it with
    // exhausted ladders in Sentry.
    if (!(error instanceof AggregateError)) throw error;
    // AggregateError's own message is just "All promises were rejected", so unpack the reasons — otherwise
    // the most common failure mode stays as opaque as the TypeError this used to throw.
    const reasons = error.errors.map((reason) => (reason instanceof Error ? reason.message : String(reason)));
    throw new Error(`Vertex AI request failed after ${requests.length} attempts: ${reasons.join('; ')}`);
  }
}

/**
 * Downloads an audio recording from Z3, transcribes it with Vertex AI, and creates the Ambient Scribe
 * resources (DocumentReference + AI Observations) from the transcript. Shared by the in-person
 * create-resources-from-audio-recording zambda and the telemed process-telemed-recording subscription so
 * both feed the recording through an identical pipeline.
 */
export async function transcribeAndCreateResourcesFromZ3Audio(
  oystehr: Oystehr,
  m2mToken: string,
  args: {
    encounterID: string;
    z3URL: string;
    duration?: number;
    providerUserProfile: string | null;
    existingDocumentReference?: DocumentReference;
  },
  secrets: Secrets | null
): Promise<string> {
  const presignedFileDownloadUrl = await createPresignedUrl(m2mToken, args.z3URL, 'download');
  const file = await fetch(presignedFileDownloadUrl);
  if (!file.ok) {
    throw new Error(
      `[transcribeAndCreateResourcesFromZ3Audio] Failed to download audio from Z3: ${file.status} ${file.statusText}`
    );
  }
  const bytes = await file.arrayBuffer();
  const fileBase64 = Buffer.from(bytes).toString('base64');
  const rawMimeType = file.headers.get('Content-Type') || 'unknown';

  // Vertex requires a concrete audio/* MIME type on the inlineData and rejects anything else with a bare
  // INVALID_ARGUMENT. The in-person upload tags the object with the browser's actual recorded type
  // (audio/webm on desktop, audio/mp4 on iOS Safari), but the Oystehr-managed telemed recording's Z3 object
  // can come back with a generic application/octet-stream (or no) Content-Type. Telemed recordings are
  // always MP4, so fall back to audio/mp4 when Z3 doesn't give us a real audio/* type.
  const mimeType = rawMimeType.startsWith('audio/') ? rawMimeType : 'audio/mp4';
  console.log(
    `[transcribeAndCreateResourcesFromZ3Audio] z3URL=${args.z3URL} rawContentType=${rawMimeType} sentMimeType=${mimeType} bytes=${bytes.byteLength} base64Length=${fileBase64.length}`
  );

  const transcript = await invokeChatbotVertexAI(
    [{ text: TRANSCRIPT_PROMPT }, { inlineData: { mimeType, data: fileBase64 } }],
    secrets
  );

  // Trim: Vertex commonly wraps the sentinel in trailing whitespace/newline, and an untrimmed compare would
  // fall through and build chart resources out of the sentinel string itself.
  if (transcript.trim() === NO_SPEECH_DETECTED) {
    console.log(
      `[transcribeAndCreateResourcesFromZ3Audio] No speech detected in recording z3URL=${args.z3URL}; skipping AI resource creation`
    );
    // The in-person ambient scribe marks its recording with AMBIENT_SCRIBE_RECORDING_PENDING_CODING and the EHR
    // keeps the scribe in "Loading" (and keeps polling) until something replaces that coding — normally
    // createResourcesFromAiInterview, which we are skipping here. Clear the pending marker ourselves so the
    // recording settles as a played-back-only document instead of loading forever.
    if (args.existingDocumentReference) {
      await clearPendingRecordingMarker(oystehr, args.existingDocumentReference);
    }
    return 'no speech detected; skipped AI resource creation';
  }

  return createResourcesFromAiInterview(
    oystehr,
    args.encounterID,
    transcript,
    args.z3URL,
    args.duration,
    mimeType,
    args.providerUserProfile,
    args.existingDocumentReference,
    secrets
  );
}

/**
 * Swaps a pending ambient-scribe recording's type coding for the regular consult-note coding, without adding a
 * transcript or AI observations. Used when the recording turns out to be silent: the audio stays listed and
 * playable, but the EHR stops treating it as a recording still awaiting transcription.
 */
async function clearPendingRecordingMarker(
  oystehr: Oystehr,
  existingDocumentReference: DocumentReference
): Promise<void> {
  await oystehr.fhir.update<DocumentReference>({
    ...existingDocumentReference,
    type: {
      coding: [VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE],
    },
  });
}

export async function invokeChatbot(input: BaseMessageLike[], secrets: Secrets | null): Promise<AIMessageChunk> {
  process.env.ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  if (chatbot == null) {
    chatbot = new ChatAnthropic({
      model: 'claude-haiku-4-5-20251001',
      temperature: 0,
      clientOptions: {
        timeout: 10000,
        maxRetries: 1,
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
  existingDocumentReference: DocumentReference | undefined,
  secrets: Secrets | null
): Promise<string> {
  let fields =
    'history of present illness, past medical history, past surgical history, medications history, allergies, social history, family history, hospitalizations history';
  // if there is a provider user profile, it is a recording
  const resources = (
    await oystehr.fhir.search<Encounter | Appointment | Patient>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterID,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
      ],
    })
  ).unbundle();

  const encounter = resources.find((resource) => resource.resourceType === 'Encounter');
  const appointment = resources.find((resource) => resource.resourceType === 'Appointment');
  const patient = resources.find((resource) => resource.resourceType === 'Patient');

  let patientInfoDetails = undefined;

  if (patient) {
    let patientAge = undefined;
    let patientSex = undefined;
    if (patient.birthDate) {
      const birthDate = DateTime.fromISO(patient.birthDate);
      const now = DateTime.now();
      patientAge = Math.floor(now.diff(birthDate, 'years').years);
    }
    if (patient.gender) {
      patientSex = patient.gender;
    }
    patientInfoDetails = `Age: ${patientAge || 'unknown'} year old, Sex: ${patientSex || 'unknown'}`;
  }

  if (
    appointment?.serviceCategory?.find(
      (serviceCategory) =>
        serviceCategory.coding?.find(
          (coding) => coding.system === SERVICE_CATEGORY_SYSTEM && coding.code === 'workers-comp'
        )
    )
  ) {
    fields = 'mechanism of injury, ' + fields;
  }

  const source = providerUserProfile ? 'audio-recording' : 'chat';
  if (source === 'audio-recording') {
    fields = 'labs, erx, procedures, ' + fields;
  }

  const aiResponseString = await invokeChatbotVertexAI(
    [{ text: getPrompt(patientInfoDetails || 'unknown patient details', fields) + '\n' + chatTranscript }],
    secrets
  );
  console.log(`AI response: "${aiResponseString}"`);
  let aiResponse;
  try {
    aiResponse = JSON.parse(aiResponseString);
  } catch (error) {
    console.warn('Failed to parse AI response, attempting to fix JSON format:', error);
    aiResponse = fixAndParseJsonObjectFromString(aiResponseString);
  }

  if (!encounter) {
    throw new Error(`Encounter ID ${encounterID} not found`);
  }

  const encounterId = assertDefined(encounter.id, 'encounter.id');
  const patientId = assertDefined(encounter.subject?.reference?.split('/')[1], 'patientId');
  const requests: BatchInputRequest<DocumentReference | Observation | Condition>[] = [];
  const documentReferenceCreateUrl = existingDocumentReference?.id
    ? `DocumentReference/${existingDocumentReference.id}`
    : `urn:uuid:${uuid()}`;
  requests.push(
    existingDocumentReference
      ? updateDocumentReference(existingDocumentReference, chatTranscript)
      : createDocumentReference(
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
    description: z3URL ? DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO : DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT,
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

function updateDocumentReference(
  existingDocumentReference: DocumentReference,
  transcript: string
): BatchInputPutRequest<DocumentReference> {
  const existingAttachment = existingDocumentReference.content?.[0]?.attachment;
  const documentReference: DocumentReference = {
    ...existingDocumentReference,
    type: {
      coding: [VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE],
    },
    content: [
      ...(existingAttachment
        ? [{ attachment: { ...existingAttachment, contentType: existingAttachment.contentType } }]
        : []),
      {
        attachment: {
          contentType: MIME_TYPES.TXT,
          title: 'Transcript',
          data: btoa(unescape(encodeURIComponent(transcript))),
        },
      },
    ],
  };
  return updateResourceRequest(documentReference);
}

const FIELDS_WITH_ITEMS = new Set([
  'pastMedicalHistory',
  'pastSurgicalHistory',
  'medicationsHistory',
  'allergies',
  'hospitalizationsHistory',
  'labs',
  'erx',
  'procedures',
]);

function createObservations(
  aiResponse: any,
  documentReferenceCreateUrl: string,
  encounterId: string,
  patientId: string
): BatchInputPostRequest<Observation>[] {
  return Object.entries(AI_RESPONSE_KEY_TO_FIELD).flatMap(([key, field]) => {
    if (aiResponse[key] != null) {
      const rawItems = aiResponse[key + 'Items'];
      const items: AiSuggestionItem[] | undefined =
        FIELDS_WITH_ITEMS.has(key) && Array.isArray(rawItems)
          ? rawItems
              .map((item: any) => {
                if (item && typeof item === 'object' && typeof item.display === 'string' && item.display.trim()) {
                  const display = item.display;
                  const searchTerms =
                    Array.isArray(item.searchTerms) && item.searchTerms.every((t: unknown) => typeof t === 'string')
                      ? item.searchTerms
                      : [];
                  return { display, searchTerms };
                }
                return undefined;
              })
              .filter((v: AiSuggestionItem | undefined): v is AiSuggestionItem => v != null)
          : undefined;
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
              items,
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
  aiClient: BaseChatModel,
  hpiText: string | undefined,
  mdmText: string | undefined
): Promise<{ diagnosis: string; icd10: string }[]> {
  try {
    const prompt = getIcdTenCodesPrompt(hpiText, mdmText);
    const aiResponseString = (await aiClient.invoke([{ role: 'user', content: prompt }])).content.toString();

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
