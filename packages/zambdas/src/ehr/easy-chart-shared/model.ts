// The structured-output model call behind every Easy Chart endpoint: Gemini, one retry, then Anthropic.
// Not `invokeChatbotVertexAI` from shared/ai, which has no token accounting, thinking budget, finish-reason
// handling or second provider.
// PHI: only the envelope is logged unless EASY_CHART_LOG_RESPONSE is set in the local secrets file.

import { ChatAnthropic } from '@langchain/anthropic';
import { EscalationInfo, ModelFailureReason, ModelUsage } from 'utils/lib/easy-chart/api';
import { getOptionalSecret, getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { z } from 'zod';

const EASY_CHART_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
/** A different provider, so a provider-wide outage or refusal does not fail the request. */
const EASY_CHART_BACKUP_MODEL = 'claude-haiku-4-5-20251001';

const REQUEST_TIMEOUT_MS = 180_000;

export interface ModelCallResult<T> {
  parsed: T;
  usage: ModelUsage[];
  escalation: EscalationInfo;
}

export interface ModelCallOptions<T> {
  prompt: string;
  /** The JSON schema Gemini decodes against. */
  wireSchema: object;
  /** Validates and types the parsed answer. A failure counts as a failed attempt and escalates. */
  responseSchema: z.ZodType<T, z.ZodTypeDef, unknown>;
  secrets: Secrets | null;
  logPrefix: string;
  /** Cancels the running request and starts no further attempt. */
  signal?: AbortSignal;
}

class ModelAttemptError extends Error {
  constructor(
    readonly reason: ModelFailureReason,
    message: string
  ) {
    super(message);
    this.name = 'ModelAttemptError';
  }
}

type UsageAccumulator = Map<string, ModelUsage>;

function record(acc: UsageAccumulator, usage: Omit<ModelUsage, 'calls'>): void {
  const key = `${usage.provider}:${usage.model}`;
  const existing = acc.get(key);
  if (!existing) {
    acc.set(key, { ...usage, calls: 1 });
    return;
  }
  existing.inputTokens += usage.inputTokens;
  existing.outputTokens += usage.outputTokens;
  existing.cacheReadTokens += usage.cacheReadTokens;
  existing.cacheWriteTokens += usage.cacheWriteTokens;
  existing.thinkingTokens += usage.thinkingTokens;
  existing.calls += 1;
}

/**
 * Call the model for a structured answer: Gemini, a sequential retry after a failure, then Anthropic.
 * Throws when every attempt failed; the error message carries attempt counts and reasons only.
 */
export async function callModelForJson<T>(options: ModelCallOptions<T>): Promise<ModelCallResult<T>> {
  const { prompt, wireSchema, responseSchema, secrets, logPrefix, signal } = options;
  const acc: UsageAccumulator = new Map();
  const failures: ModelFailureReason[] = [];
  let attempts = 0;

  const attempt = async (runner: () => Promise<unknown>): Promise<T | undefined> => {
    attempts += 1;
    try {
      const result = responseSchema.safeParse(await runner());
      if (result.success) return result.data;
      failures.push('rejected-by-validation');
      // Issue paths and codes only: the messages can quote the model's answer.
      const issues = result.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.code}`)
        .join('; ');
      console.log(`[${logPrefix}] attempt ${attempts} failed validation: ${issues}`);
      return undefined;
    } catch (error) {
      const reason = error instanceof ModelAttemptError ? error.reason : 'error';
      failures.push(reason);
      console.log(`[${logPrefix}] attempt ${attempts} failed: ${reason}`);
      return undefined;
    }
  };

  const primary = (): Promise<unknown> => callVertex(prompt, wireSchema, secrets, acc, logPrefix, signal);

  let parsed = await attempt(primary);
  if (parsed === undefined && !signal?.aborted) parsed = await attempt(primary);

  let escalated = false;
  if (parsed === undefined && !signal?.aborted) {
    escalated = true;
    parsed = await attempt(() => callAnthropic(prompt, secrets, acc, logPrefix, signal));
  }

  const usage = [...acc.values()];
  if (parsed === undefined) {
    console.log(`[${logPrefix}] all ${attempts} attempts failed: ${failures.join(',')}`);
    throw new Error(`Easy Chart model call failed after ${attempts} attempts (${failures.join(', ')})`);
  }

  logUsage(logPrefix, usage);
  if (getOptionalSecret('EASY_CHART_LOG_RESPONSE', secrets) === 'true') {
    console.log(`[${logPrefix}] model response (contains PHI, local use only):\n${JSON.stringify(parsed, null, 2)}`);
  }
  return { parsed, usage, escalation: { attempts, escalated, failures } };
}

/**
 * Parse a model's JSON answer, tolerating what models wrap around it: a markdown fence, prose before
 * or after the object, or the whole object encoded as a JSON string. Throws when there is no JSON.
 */
export function parseModelJson(text: string): unknown {
  const body = stripCodeFence(text.replace(/^\uFEFF/, '').trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = fixAndParseJsonObjectFromString(body);
  }
  return typeof parsed === 'string' ? parseModelJson(parsed) : parsed;
}

function stripCodeFence(text: string): string {
  const fenced = /^```[\w-]*\s*([\s\S]*?)\s*```$/.exec(text);
  return fenced ? fenced[1] : text;
}

function parseOrFail(text: string, provider: string): unknown {
  try {
    return parseModelJson(text);
  } catch {
    throw new ModelAttemptError('unparseable', `${provider} returned unparseable JSON`);
  }
}

/** A cache read of 0 across a session means the static prompt prefix stopped being cacheable. */
function logUsage(logPrefix: string, usage: ModelUsage[]): void {
  for (const u of usage) {
    console.log(
      `[${logPrefix}] usage provider=${u.provider} model=${u.model} in=${u.inputTokens} out=${u.outputTokens} ` +
        `cacheRead=${u.cacheReadTokens} cacheWrite=${u.cacheWriteTokens} thinking=${u.thinkingTokens} calls=${u.calls}`
    );
  }
}

interface VertexResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

async function callVertex(
  prompt: string,
  wireSchema: object,
  secrets: Secrets | null,
  acc: UsageAccumulator,
  logPrefix: string,
  signal: AbortSignal | undefined
): Promise<unknown> {
  const projectId = getSecret(SecretsKeys.GOOGLE_CLOUD_PROJECT_ID, secrets);
  const apiKey = getSecret(SecretsKeys.GOOGLE_CLOUD_API_KEY, secrets);
  const url =
    `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/` +
    `${EASY_CHART_PRIMARY_MODEL}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vertex-AI-LLM-Request-Type': 'shared',
        'X-Vertex-AI-LLM-Shared-Request-Type': 'priority',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          // Unset, this model does no reasoning at all, which measurably cost recall. Capped because an
          // unbounded budget can think without ever answering; the output cap is raised to match.
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 2048 },
          responseMimeType: 'application/json',
          responseSchema: wireSchema,
        },
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ModelAttemptError(timedOut ? 'timeout' : 'error', timedOut ? 'vertex timed out' : 'vertex fetch failed');
  }

  const body = await response.text();
  if (!response.ok) {
    // Status and length only: an error body can echo the prompt.
    console.log(`[${logPrefix}] vertex returned ${response.status}, ${body.length} bytes`);
    throw new ModelAttemptError('error', `vertex returned ${response.status}`);
  }

  let payload: VertexResponse;
  try {
    payload = JSON.parse(body) as VertexResponse;
  } catch {
    throw new ModelAttemptError('unparseable', 'vertex returned a non-JSON envelope');
  }

  const meta = payload.usageMetadata ?? {};
  record(acc, {
    provider: 'vertex',
    model: EASY_CHART_PRIMARY_MODEL,
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    cacheReadTokens: meta.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
    thinkingTokens: meta.thoughtsTokenCount ?? 0,
  });

  const candidate = payload.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = candidate?.content?.parts?.[0]?.text;
  console.log(
    `[${logPrefix}] vertex candidates=${payload.candidates?.length ?? 0} finishReason=${finishReason} ` +
      `textLength=${text?.length ?? 0} blockReason=${payload.promptFeedback?.blockReason}`
  );

  // Truncated JSON is a failure to escalate, not a partial answer.
  if (finishReason === 'MAX_TOKENS') throw new ModelAttemptError('truncated', 'vertex hit the output cap');
  if (!text?.trim()) {
    throw new ModelAttemptError('empty-response', `vertex returned no text (finishReason ${finishReason})`);
  }
  return parseOrFail(text, 'vertex');
}

let anthropicClient: ChatAnthropic | undefined;

async function callAnthropic(
  prompt: string,
  secrets: Secrets | null,
  acc: UsageAccumulator,
  logPrefix: string,
  signal: AbortSignal | undefined
): Promise<unknown> {
  anthropicClient ??= new ChatAnthropic({
    model: EASY_CHART_BACKUP_MODEL,
    anthropicApiKey: getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets),
    temperature: 0,
    maxTokens: 8192,
    // This is already the last of three attempts; LangChain's own retries would multiply the timeout.
    maxRetries: 0,
    clientOptions: { timeout: REQUEST_TIMEOUT_MS },
  });

  let message;
  try {
    message = await anthropicClient.invoke(
      [
        {
          role: 'user',
          content: `${prompt}\n\nReturn ONLY the JSON object described above. No markdown fences, no commentary.`,
        },
      ],
      { signal }
    );
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|aborted/i.test(error.message);
    throw new ModelAttemptError(timedOut ? 'timeout' : 'error', 'anthropic call failed');
  }

  const usage = message.usage_metadata;
  record(acc, {
    provider: 'anthropic',
    model: EASY_CHART_BACKUP_MODEL,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.input_token_details?.cache_read ?? 0,
    cacheWriteTokens: usage?.input_token_details?.cache_creation ?? 0,
    thinkingTokens: usage?.output_token_details?.reasoning ?? 0,
  });

  const text = message.text;
  const stopReason = (message.response_metadata as { stop_reason?: string } | undefined)?.stop_reason;
  console.log(`[${logPrefix}] anthropic stopReason=${stopReason} textLength=${text.length}`);
  if (stopReason === 'max_tokens') throw new ModelAttemptError('truncated', 'anthropic hit the output cap');
  if (!text.trim()) throw new ModelAttemptError('empty-response', 'anthropic returned no text');
  return parseOrFail(text, 'anthropic');
}
