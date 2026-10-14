// Transport for the "Through my Claude login (this Mac)" connection. One relay request per turn; the relay runs
// the turn with the Claude Agent SDK (authenticated by the Claude Code login on the Mac) and streams NDJSON events
// back. The page keeps executing the tools: each tool_call event is answered with a POST of the result.
import type Anthropic from '@anthropic-ai/sdk';

export interface LoginToolDef {
  name: string;
  description?: string;
  input_schema: unknown;
}

export interface LoginUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export type LoginEvent =
  | { type: 'init'; sessionId: string; model: string; authSource: string }
  | { type: 'event'; event: Anthropic.Beta.BetaRawMessageStreamEvent }
  | { type: 'assistant_error'; code: string; message: string }
  | {
      type: 'result';
      sessionId?: string;
      model?: string;
      subtype: string;
      isError?: boolean;
      errors?: string[];
      stopReason?: string | null;
      usage?: LoginUsage;
    }
  | { type: 'error'; message: string };

interface ToolCallEvent {
  type: 'tool_call';
  callId: string;
  name: string;
  input: unknown;
}

export interface LoginTurnRequest {
  model: string;
  effort: string;
  showThinking?: boolean;
  system: string;
  tools: LoginToolDef[];
  prompt: Anthropic.Beta.BetaContentBlockParam[];
  sessionId?: string;
  maxTurns: number;
}

export interface LoginTurnHandlers {
  onEvent: (event: LoginEvent) => void;
  onToolCall: (name: string, input: unknown) => Promise<{ content: string; isError?: boolean }>;
}

export const loginStartHint =
  'Start it in a terminal: sh ~/development/documents/form-studio/start-relay-login.sh (it installs the Claude Agent SDK next to the relay the first time).';

/** Runs one turn through the relay's login mode; resolves when the relay ends the stream. */
export const runLoginTurn = async (
  relayUrl: string,
  request: LoginTurnRequest,
  handlers: LoginTurnHandlers,
  signal: AbortSignal
): Promise<void> => {
  const base = relayUrl.replace(/\/$/, '');
  const turnId = crypto.randomUUID();
  const post = (path: string, body: unknown): Promise<Response> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  signal.addEventListener('abort', () => void post('/login/abort', { turnId }).catch(() => undefined));

  let response: Response;
  try {
    response = await fetch(`${base}/login/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ turnId, ...request }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) return;
    throw new Error(`Could not reach the relay at ${base}. ${loginStartHint}`, { cause: error });
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `The relay answered ${response.status} to the login turn.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  const handle = async (line: string): Promise<void> => {
    if (!line.trim()) return;
    const message = JSON.parse(line) as LoginEvent | ToolCallEvent;
    if (message.type !== 'tool_call') {
      handlers.onEvent(message);
      return;
    }
    let result: { content: string; isError?: boolean };
    try {
      result = await handlers.onToolCall(message.name, message.input);
    } catch (error) {
      result = { content: `Tool failed: ${error instanceof Error ? error.message : String(error)}`, isError: true };
    }
    await post('/login/tool-result', { turnId, callId: message.callId, ...result });
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) await handle(line);
    }
    if (buffered.trim()) await handle(buffered);
  } catch (error) {
    if (!signal.aborted) throw error;
  }
};
