// The model call for Easy Chart: sequential retry, escalation to a backup provider, and per-call
// accounting. Deliberately NOT `invokeChatbotVertexAI` from shared/ai.
//
// WHY NOT THE SHARED HELPER: it fires three STAGGERED CONCURRENT attempts as a hedge. A plan-sized
// generation outlives the first stagger, so nearly every call ran two or three full generations and
// was billed for all of them. Retry here is SEQUENTIAL and only after a failure.
//
// TWO MORE SPECIFICS FROM PHASE 4.7:
//  - MAX_TOKENS is a FAILURE, not partial success. Returning truncated text hands the caller broken
//    JSON that only fails to parse AFTER the escalation opportunity has passed.
//  - On empty response / unparseable JSON / MAX_TOKENS / timeout: retry once, then escalate to the
//    backup model.
//
// PHI: never log a response body. For this feature the candidates ARE the generated note (HPI, MDM,
// diagnoses, doses); on a transcription call the body is the transcript. Log only the envelope —
// model, candidate count, finish reason, text length, block reason, token usage.

import { ChatAnthropic } from '@langchain/anthropic';
import { EscalationInfo, ModelFailureReason, ModelUsage } from 'utils/lib/easy-chart/api';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';

/** Primary: fast and cheap. Escalation exists because it sometimes is not enough. */
export const EASY_CHART_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
/** Backup: a different provider, so a provider-wide outage or refusal does not end the turn. */
export const EASY_CHART_BACKUP_MODEL = 'claude-haiku-4-5-20251001';

const REQUEST_TIMEOUT_MS = 90_000;

export interface ModelCallResult<T> {
  parsed: T;
  usage: ModelUsage[];
  escalation: EscalationInfo;
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

interface UsageAccumulator {
  byModel: Map<string, ModelUsage>;
}

function record(acc: UsageAccumulator, usage: Omit<ModelUsage, 'calls'>): void {
  const key = `${usage.provider}:${usage.model}`;
  const existing = acc.byModel.get(key);
  if (!existing) {
    acc.byModel.set(key, { ...usage, calls: 1 });
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
 * Call the model for a structured response, retrying once and then escalating to the backup
 * provider. `validate` gets the parsed object and must throw when it is unusable — a response the
 * validator rejects is a `rejected-by-validation` failure and is worth escalating for, exactly like
 * a truncated one.
 */
export async function callModelForJson<T>(
  prompt: string,
  responseSchema: object,
  secrets: Secrets | null,
  logPrefix: string,
  validate: (parsed: unknown) => T
): Promise<ModelCallResult<T>> {
  const acc: UsageAccumulator = { byModel: new Map() };
  const failures: ModelFailureReason[] = [];
  let attempts = 0;

  const attempt = async (runner: () => Promise<unknown>): Promise<T | undefined> => {
    attempts += 1;
    try {
      return validate(await runner());
    } catch (error) {
      const reason = error instanceof ModelAttemptError ? error.reason : 'rejected-by-validation';
      failures.push(reason);
      // Message only — never the body. Our own attempt errors carry envelope facts by construction.
      console.log(`[${logPrefix}] attempt ${attempts} failed: ${reason}`);
      return undefined;
    }
  };

  const primary = (): Promise<unknown> => callVertex(prompt, responseSchema, secrets, acc, logPrefix);

  // Sequential: retry only AFTER a failure. Never staggered concurrent attempts.
  let parsed = await attempt(primary);
  if (parsed === undefined) parsed = await attempt(primary);

  let escalated = false;
  if (parsed === undefined) {
    escalated = true;
    parsed = await attempt(() => callAnthropic(prompt, secrets, acc, logPrefix));
  }

  const usage = [...acc.byModel.values()];
  if (parsed === undefined) {
    console.log(`[${logPrefix}] all ${attempts} attempts failed: ${failures.join(',')}`);
    throw new Error(`Easy Chart model call failed after ${attempts} attempts (${failures.join(', ')})`);
  }

  logUsage(logPrefix, usage);
  return { parsed, usage, escalation: { attempts, escalated, failures } };
}

/**
 * The cache figures are the point of this line: a cacheRead of 0 across a session means the
 * static-prefix ordering broke and every call is being billed in full.
 */
function logUsage(logPrefix: string, usage: ModelUsage[]): void {
  for (const u of usage) {
    console.log(
      `[${logPrefix}] usage provider=${u.provider} model=${u.model} in=${u.inputTokens} out=${u.outputTokens} ` +
        `cacheRead=${u.cacheReadTokens} cacheWrite=${u.cacheWriteTokens} thinking=${u.thinkingTokens} calls=${u.calls}`
    );
  }
}

async function callVertex(
  prompt: string,
  responseSchema: object,
  secrets: Secrets | null,
  acc: UsageAccumulator,
  logPrefix: string
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
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ModelAttemptError(timedOut ? 'timeout' : 'error', timedOut ? 'vertex timed out' : 'vertex fetch failed');
  }

  const body = await response.text();
  if (!response.ok) {
    // Status and length only: an error body can echo the prompt, and the prompt contains the note.
    console.log(`[${logPrefix}] vertex returned ${response.status}, ${body.length} bytes`);
    throw new ModelAttemptError('error', `vertex returned ${response.status}`);
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new ModelAttemptError('unparseable', 'vertex returned a non-JSON envelope');
  }

  const meta = payload?.usageMetadata ?? {};
  record(acc, {
    provider: 'vertex',
    model: EASY_CHART_PRIMARY_MODEL,
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    cacheReadTokens: meta.cachedContentTokenCount ?? 0,
    cacheWriteTokens: 0,
    thinkingTokens: meta.thoughtsTokenCount ?? 0,
  });

  const candidate = payload?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = candidate?.content?.parts?.[0]?.text;
  console.log(
    `[${logPrefix}] vertex candidates=${payload?.candidates?.length ?? 0} finishReason=${finishReason} ` +
      `textLength=${typeof text === 'string' ? text.length : 0} blockReason=${payload?.promptFeedback?.blockReason}`
  );

  // MAX_TOKENS is a FAILURE. Truncated text parses as broken JSON only after the escalation
  // opportunity has passed — treat it as truncated here and escalate.
  if (finishReason === 'MAX_TOKENS') throw new ModelAttemptError('truncated', 'vertex hit the output cap');
  if (typeof text !== 'string' || !text.trim()) {
    throw new ModelAttemptError('empty-response', `vertex returned no text (finishReason ${finishReason})`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ModelAttemptError('unparseable', 'vertex returned unparseable JSON');
  }
}

let anthropicClient: ChatAnthropic | undefined;

async function callAnthropic(
  prompt: string,
  secrets: Secrets | null,
  acc: UsageAccumulator,
  logPrefix: string
): Promise<unknown> {
  process.env.ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  if (!anthropicClient) {
    anthropicClient = new ChatAnthropic({
      model: EASY_CHART_BACKUP_MODEL,
      temperature: 0,
      maxTokens: 8192,
      clientOptions: { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 },
    });
  }

  let message;
  try {
    message = await anthropicClient.invoke([
      {
        role: 'user',
        content: `${prompt}\n\nReturn ONLY the JSON object described above. No markdown fences, no commentary.`,
      },
    ]);
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|aborted/i.test(error.message);
    throw new ModelAttemptError(timedOut ? 'timeout' : 'error', 'anthropic call failed');
  }

  const usage: any = (message as any).usage_metadata ?? {};
  record(acc, {
    provider: 'anthropic',
    model: EASY_CHART_BACKUP_MODEL,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.input_token_details?.cache_read ?? 0,
    cacheWriteTokens: usage.input_token_details?.cache_creation ?? 0,
    thinkingTokens: usage.output_token_details?.reasoning ?? 0,
  });

  const text = message.content.toString();
  const stopReason = (message as any).response_metadata?.stop_reason;
  console.log(`[${logPrefix}] anthropic stopReason=${stopReason} textLength=${text.length}`);
  if (stopReason === 'max_tokens') throw new ModelAttemptError('truncated', 'anthropic hit the output cap');
  if (!text.trim()) throw new ModelAttemptError('empty-response', 'anthropic returned no text');

  try {
    return JSON.parse(text);
  } catch {
    try {
      // The backup path has no constrained decoding, so a stray fence or trailing comma is expected.
      return fixAndParseJsonObjectFromString(text);
    } catch {
      throw new ModelAttemptError('unparseable', 'anthropic returned unparseable JSON');
    }
  }
}
