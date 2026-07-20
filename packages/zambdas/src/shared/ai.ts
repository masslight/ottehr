import { AnthropicMessagesModelId, ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessageChunk, BaseMessageLike, MessageContentComplex } from '@langchain/core/messages';
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Appointment, Condition, DocumentReference, Encounter, Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  AI_OBSERVATION_META_SYSTEM,
  AiObservationField,
  AiSuggestionItem,
  DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
  DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT,
  EasyChartTokenUsage,
  fixAndParseJsonObjectFromString,
  getFormatDuration,
  getOptionalSecret,
  getSecret,
  MIME_TYPES,
  PUBLIC_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE,
} from 'utils';
import { makeObservationResource } from './chart-data/index';
import { assertDefined } from './helpers';
import { parseCreatedResourcesBundle, saveResourceRequest } from './resources.helpers';
import { createPresignedUrl } from './z3Utils';

export const TRANSCRIPT_PROMPT =
  'give a transcript of this file, include only the transcript without other input, include who the speaker is with labels for the provider and the patient';

export class ClaudeClient {
  chatbot: ChatAnthropic;

  constructor(anthropicApiKey: string, model: AnthropicMessagesModelId = 'claude-haiku-4-5-20251001') {
    this.chatbot = new ChatAnthropic({
      model,
      anthropicApiKey,
      temperature: 0,
      clientOptions: {
        timeout: 5000, // 5 seconds (in milliseconds)
        maxRetries: 5, // Number of retries on failure
      },
    });
  }

  async invoke(input: BaseMessageLike[]): Promise<AIMessageChunk> {
    return this.chatbot.invoke(input);
  }
}

let chatbot: ChatAnthropic;
// let chatbotVertexAI: ChatVertexAI;

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

// Default model for the Vertex path. Callers (e.g. the easy-chart planner via
// invokeChatbotStructured) may override it per-environment.
export const DEFAULT_VERTEX_MODEL = 'gemini-3.1-flash-lite';

export async function invokeChatbotVertexAI(
  input: MessageContentComplex[],
  secrets: Secrets | null,
  responseSchema?: object,
  model: string = DEFAULT_VERTEX_MODEL,
  onUsage?: (usage: EasyChartTokenUsage) => void,
  // OPT-IN output ceiling (the easy-chart paths pass it via invokeChatbotStructured). Large (32k)
  // for the planner/review whose JSON can be several thousand tokens; callers that emit a small
  // fixed payload (e.g. the single-shot agent's one intent) should pass a SMALL value so a
  // flash-lite runaway loop fails fast and cheap. When omitted, the model defaults apply (no output
  // cap, dynamic thinking) — long-output callers like transcription must not be truncated at an
  // arbitrary ceiling.
  maxOutputTokens?: number,
  // Optional caller-owned timeout/abort budget (invokeChatbotStructured passes AbortSignal.timeout
  // so a hung request can't eat the whole zambda invocation). When it fires we bail out
  // immediately: an abort means the caller's budget is spent, so it is deliberately NOT retried
  // like a transient network failure.
  signal?: AbortSignal
): Promise<string> {
  // call the vertex ai with fetch
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

  // Sequential retry with exponential backoff (delays like ~3s, ~6s; see
  // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/). This used to be a
  // timer-staggered hedge that fired the 2nd/3rd request while the first was still generating — but
  // a planner-sized generation takes longer than the first stagger, so nearly every call ran 2-3
  // concurrent full generations and billed all of them. Retrying only after a retryable FAILURE
  // does the same job at 1x cost.
  let httpResponse: Response | undefined;
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    if (attempt > 0) {
      // Don't sleep out a backoff on a budget that has already expired.
      signal?.throwIfAborted();
      const backoff = 2 ** (attempt - 1) * FIRST_DELAY_MS * (1 - JITTER + Math.random() * JITTER * 2);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
    try {
      httpResponse = await fetch(
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
              // Opt-in caps (see the maxOutputTokens param note). Thinking is bounded alongside the
              // output cap: these are reasoning models, and uncapped the heavier ones burn 50k+
              // tokens "thinking" and never emit the plan — the unbounded hang we hit early on.
              // Output itself needs real headroom: the planner emits per-step `sourceText`
              // provenance and a full note's plan can run several thousand tokens, so the old 8k
              // cap truncated the JSON (finishReason MAX_TOKENS) and failed the whole chart.
              ...(maxOutputTokens != null && {
                maxOutputTokens,
                thinkingConfig: { thinkingBudget: 2048 },
              }),
              ...(responseSchema && {
                responseMimeType: 'application/json',
                responseSchema,
              }),
            },
          }),
          signal,
        }
      );
    } catch (error) {
      // A caller-signal abort/timeout is a spent budget, not a transient blip — rethrow now so
      // invokeChatbotStructured's single escalation gets the remaining time (its catch does the
      // capture). Retrying here would burn the backup's window on a request we know is dead.
      if (signal?.aborted) throw error;
      // Network-level failure — retryable, like a 5xx.
      console.error('Error invoking Vertex AI:', error);
      captureException(error);
      if (attempt === RETRY_COUNT - 1) throw error;
      continue;
    }
    if (!httpResponse.ok && shouldRetry(httpResponse.status) && attempt < RETRY_COUNT - 1) {
      console.error(`Vertex AI returned ${httpResponse.status}; retrying.`);
      continue;
    }
    break;
  }

  const response = await httpResponse?.json();

  console.log(JSON.stringify(response));
  // Vertex can return a 200 with NO candidate text — finishReason MAX_TOKENS/SAFETY, a blocked
  // prompt, or a transient hiccup. Guard the access so we surface a clear error instead of a cryptic
  // "Cannot read properties of undefined (reading '0')" TypeError, and so callers that catch (e.g.
  // the easy-chart post-template re-plan) can fall back cleanly.
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    const reason = response?.candidates?.[0]?.finishReason ?? response?.promptFeedback?.blockReason ?? 'no candidates';
    throw new Error(`Vertex AI returned no usable text (${reason})`);
  }
  if (response?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    // Partial text is NOT usable output. Returning it hands truncated JSON to the caller, which
    // fails to parse only after invokeChatbotStructured has already returned — silently defeating
    // the backup-model escalation that exists precisely for this failure. Throw so it fires.
    throw new Error(`Vertex AI output truncated (MAX_TOKENS, ${model})`);
  }
  if (onUsage) {
    const u = response?.usageMetadata ?? {};
    onUsage({
      provider: 'gemini',
      model,
      inputTokens: u.promptTokenCount ?? 0,
      outputTokens: u.candidatesTokenCount ?? 0,
      cacheReadTokens: u.cachedContentTokenCount ?? 0,
      thinkingTokens: u.thoughtsTokenCount ?? 0,
    });
  }
  return text;
}

// Structured-output via Anthropic. Mirrors invokeChatbotVertexAI's contract: same text input +
// JSON Schema, same "return the JSON as a string" result. We force a single tool call whose
// input_schema IS the response schema — Claude's equivalent of Vertex's responseSchema — so the
// model can only reply with a schema-valid object, which we stringify back to the caller.
export async function invokeClaudeStructured(
  input: MessageContentComplex[],
  secrets: Secrets | null,
  responseSchema: object,
  model = 'claude-haiku-4-5-20251001',
  onUsage?: (usage: EasyChartTokenUsage) => void,
  maxTokens = 8192,
  // Optional caller-owned timeout/abort budget (see invokeChatbotVertexAI's matching param).
  signal?: AbortSignal
): Promise<string> {
  const ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  // Prompt caching: the easy-chart prompts lead with a fixed instruction block and place a
  // "═══ END OF FIXED INSTRUCTIONS ═══" marker just before the per-call variable text. We split each
  // text block at that marker and tag the static prefix with cache_control, so repeat calls within
  // the (rolling 5-min) cache window re-bill that ~4k-token block at ~10% instead of full price. The
  // tools/schema sit ahead of the messages, so they're covered by the same cached prefix for free.
  // A block with no marker is sent uncached, unchanged.
  const CACHE_MARK = '═══ END OF FIXED INSTRUCTIONS';
  const content = input.flatMap((part) => {
    if (typeof part === 'object' && part && 'text' in part) {
      const text = (part as { text: string }).text;
      const mi = text.indexOf(CACHE_MARK);
      if (mi > 0) {
        const nl = text.indexOf('\n', mi);
        const cut = nl >= 0 ? nl + 1 : text.length;
        const staticPart = text.slice(0, cut);
        const variablePart = text.slice(cut);
        const blocks: Array<Record<string, unknown>> = [
          { type: 'text', text: staticPart, cache_control: { type: 'ephemeral' } },
        ];
        if (variablePart.trim()) blocks.push({ type: 'text', text: variablePart });
        return blocks;
      }
      return [{ type: 'text', text }];
    }
    return [part as unknown as Record<string, unknown>];
  });
  const TOOL_NAME = 'emit_result';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      // claude-opus-4-8 and claude-sonnet-5 reject non-default sampling params (400), so omit
      // temperature entirely. Sonnet 5 also runs adaptive thinking by default when `thinking` is
      // omitted, which would eat the max_tokens budget and can truncate the forced tool_use output —
      // disable it: this structured extraction path doesn't need it.
      thinking: { type: 'disabled' },
      tools: [{ name: TOOL_NAME, description: 'Return the structured result.', input_schema: responseSchema }],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content }],
    }),
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Anthropic error ${response.status}: ${body.slice(0, 200)}`);
    captureException(err);
    throw err;
  }
  const json = await response.json();
  if (onUsage) {
    const u = json.usage ?? {};
    onUsage({
      provider: 'claude',
      model,
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    });
  }
  if (json.stop_reason === 'max_tokens') {
    // A tool_use input cut mid-generation is truncated JSON — not usable output. Throw so
    // invokeChatbotStructured's backup escalation (with a larger ceiling) fires.
    throw new Error(`Anthropic output truncated (max_tokens, ${model})`);
  }
  const toolUse = (json.content ?? []).find((b: { type?: string }) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Anthropic returned no tool_use block');
  return JSON.stringify(toolUse.input);
}

// Backend-agnostic structured-output entry point used by the easy-chart planner. The backend is
// formatted "<provider>:<model>" where provider is `anthropic`, or `vertex` / `gemini` (aliases —
// both route to the Vertex path). Defaults to gemini flash-lite BY DESIGN, in all environments:
// it's cheap and fast, and its mistakes are expected — the provider review UX exists to surface
// and correct them. The Sonnet backup is strictly an escalation path that fires only when
// flash-lite structurally fails (runaway hitting the output cap, truncated/blocked JSON) — it is
// not a quality-upgrade knob. The EASY_CHART_PLANNER_MODEL secret is an exceptional
// per-environment override, not the intended configuration mechanism. (History: a 10-transcript
// ICD-10 eval of flash-lite's region/laterality misses motivated the matcher guards, not a default
// switch.) Examples:
//   vertex:gemini-3.1-flash-lite
//   anthropic:claude-haiku-4-5-20251001
export async function invokeChatbotStructured(
  input: MessageContentComplex[],
  secrets: Secrets | null,
  responseSchema: object,
  backendOverride?: string,
  onUsage?: (usage: EasyChartTokenUsage) => void,
  // Output ceiling for the PRIMARY model. Kept deliberately limited so a flash-lite runaway loop
  // fails fast and cheap instead of bursting to tens of thousands of tokens (which would erase the
  // cost advantage). On that failure we escalate to the reliable backup with generous room.
  maxOutputTokens = 16384,
  // Optional semantic guard on a successfully-parsed result. A syntactically valid response can
  // still be a known one-off failure (e.g. flash-lite answering {"steps": []} to a rich
  // narrative). When it returns false the attempt is a soft failure: retry the primary once, then
  // escalate to the backup; a backup result that is also rejected is returned anyway — the guard
  // is best-effort and never becomes an error the caller sees.
  acceptResult?: (parsed: unknown) => boolean
): Promise<string> {
  const dispatch = (backend: string, maxTokens: number, timeoutMs: number): Promise<string> => {
    const sep = backend.indexOf(':');
    const provider = sep >= 0 ? backend.slice(0, sep) : backend;
    const model = sep >= 0 ? backend.slice(sep + 1) : '';
    // Explicit per-attempt deadline. Without one, a hung upstream sits until undici's 300s default
    // headers timeout (UND_ERR_HEADERS_TIMEOUT) — on the longest transcripts the PRIMARY call did
    // exactly that and the whole invocation died without the backup ever running.
    const signal = AbortSignal.timeout(timeoutMs);
    // Providers: 'anthropic' → Claude; anything else → Vertex. In practice configs use both
    // 'vertex:' and 'gemini:' prefixes (the synth secret and easy-chart-agent say 'gemini:') —
    // both intentionally route to the Vertex path.
    if (provider === 'anthropic') {
      return invokeClaudeStructured(input, secrets, responseSchema, model || undefined, onUsage, maxTokens, signal);
    }
    return invokeChatbotVertexAI(input, secrets, responseSchema, model || undefined, onUsage, maxTokens, signal);
  };

  // Timeout budget: the easy-chart zambdas set no explicit timeout in
  // config/oystehr-core/zambdas.json; long-running zambdas there cap at the 595s platform max, and
  // undici only abandons a hung request at its 300s default headers timeout. Size both attempts to
  // fit comfortably inside one ~300s request window (and far inside the 595s hard kill), leaving
  // the caller's remaining FHIR work some slack: the primary gets 120s (~40% of the window — many
  // multiples of a healthy flash-lite generation, so it trips only on a genuine hang) and the
  // backup gets the more generous remainder, 170s (sonnet-5 is slower on planner-sized output but
  // must still finish before the runtime kills the zambda). Worst case: 120s + 170s = 290s. An
  // acceptResult-triggered primary retry can add one more primary window (410s worst case) — still
  // inside the 595s hard kill, and it only happens after a COMPLETED primary response, not a hang.
  const PRIMARY_TIMEOUT_MS = 120_000;
  const BACKUP_TIMEOUT_MS = 170_000;

  const primary =
    backendOverride ||
    getOptionalSecret(SecretsKeys.EASY_CHART_PLANNER_MODEL, secrets) ||
    `gemini:${DEFAULT_VERTEX_MODEL}`;
  const backup = getOptionalSecret(SecretsKeys.EASY_CHART_BACKUP_MODEL, secrets) || 'anthropic:claude-sonnet-5';

  // Semantic guard check for one attempt's raw output. Only a successfully-parsed result is the
  // guard's call: with a guard present, unparseable output makes parseStructuredModelOutput throw,
  // which rides the same escalation path as any other structural failure. Without a guard nothing
  // is parsed here and the raw string passes through untouched, exactly as before.
  const rejectedByGuard = (raw: string): boolean =>
    acceptResult != null && !acceptResult(parseStructuredModelOutput(raw, 'structured result (acceptResult guard)'));

  try {
    let result = await dispatch(primary, maxOutputTokens, PRIMARY_TIMEOUT_MS);
    if (rejectedByGuard(result)) {
      // A valid-but-rejected result (e.g. flash-lite's one-off empty plan) is usually transient —
      // one primary retry recovers it far cheaper and faster than the backup.
      console.warn(
        `invokeChatbotStructured: structured result rejected by acceptResult, retrying primary "${primary}".`
      );
      result = await dispatch(primary, maxOutputTokens, PRIMARY_TIMEOUT_MS);
      if (rejectedByGuard(result)) {
        // Throw into the escalation below — deliberately the same machinery (logging, capture,
        // backup budget) as a structural failure.
        throw new Error('structured result rejected by acceptResult twice');
      }
    }
    return result;
  } catch (err) {
    // Primary failed (a flash-lite runaway hitting the cap, a truncated/blocked response, a
    // terminal API error, or a hang that blew the timeout budget — AbortSignal.timeout surfaces as
    // a TimeoutError/AbortError, caught here like any other structural failure). Capture it — a
    // silent fallback masks a degrading/outaging primary model from on-call — then escalate ONCE
    // to the backup model with generous output room and its own (larger) deadline. When backup
    // === primary this is still worth one retry: truncation failures succeed at the larger ceiling.
    console.error(
      `invokeChatbotStructured: primary "${primary}" failed (${
        (err as Error)?.message ?? err
      }); falling back to "${backup}".`
    );
    captureException(err);
    const backupResult = await dispatch(backup, 32768, BACKUP_TIMEOUT_MS);
    if (rejectedByGuard(backupResult)) {
      // The guard is best-effort: the backup's answer is the last resort, so return it rather
      // than surface an error the caller (and user) would see.
      console.warn(
        `invokeChatbotStructured: backup "${backup}" result also rejected by acceptResult; returning it anyway.`
      );
    }
    return backupResult;
  }
}

// Parse a model's JSON output, recovering fenced/noisy-but-fixable output (```json fences, trailing
// prose) via fixAndParseJsonObjectFromString before giving up. Throws a RAW Error on unparseable
// output: that is an upstream model failure, not a user-input problem — wrapping it in an APIError
// would blame the provider's input and hide a model outage from Sentry/on-call.
export function parseStructuredModelOutput(raw: string, what: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return fixAndParseJsonObjectFromString(raw);
    } catch {
      console.error(`Model returned non-JSON ${what}:`, raw.slice(0, 500));
      throw new Error(`Model returned non-JSON output for ${what}`);
    }
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
  args: { encounterID: string; z3URL: string; duration?: number; providerUserProfile: string | null },
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
  // INVALID_ARGUMENT. The in-person upload is tagged audio/webm by the SDK, but the Oystehr-managed telemed
  // recording's Z3 object can come back with a generic application/octet-stream (or no) Content-Type. Telemed
  // recordings are always MP4, so fall back to audio/mp4 when Z3 doesn't give us a real audio/* type.
  const mimeType = rawMimeType.startsWith('audio/') ? rawMimeType : 'audio/mp4';
  console.log(
    `[transcribeAndCreateResourcesFromZ3Audio] z3URL=${args.z3URL} rawContentType=${rawMimeType} sentMimeType=${mimeType} bytes=${bytes.byteLength} base64Length=${fileBase64.length}`
  );

  const transcript = await invokeChatbotVertexAI(
    [{ text: TRANSCRIPT_PROMPT }, { inlineData: { mimeType, data: fileBase64 } }],
    secrets
  );

  return createResourcesFromAiInterview(
    oystehr,
    args.encounterID,
    transcript,
    args.z3URL,
    args.duration,
    mimeType,
    args.providerUserProfile,
    secrets
  );
}

export async function invokeChatbot(input: BaseMessageLike[], secrets: Secrets | null): Promise<AIMessageChunk> {
  process.env.ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  if (chatbot == null) {
    chatbot = new ChatAnthropic({
      model: 'claude-haiku-4-5-20251001',
      temperature: 0,
      clientOptions: {
        timeout: 10000, // 5 seconds (in milliseconds)
        maxRetries: 1, // Number of retries on failure
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
