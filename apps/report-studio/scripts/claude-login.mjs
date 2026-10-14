// "Through my Claude login" mode for the studio relays (Form Studio and Report Studio share this file verbatim).
//
// The relay runs each chat turn with the Claude Agent SDK, which authenticates with the Claude Code login on this
// Mac (the one `claude` uses), so nothing is billed to an Anthropic API key. The page's tools still run in the
// page: they are exposed to the SDK as an in-process MCP server whose handlers forward each call over the turn's
// event stream and wait for the page to post the result back.
//
// Optional dependencies, imported lazily so the API-key relay stays dependency-free:
//   npm install @anthropic-ai/claude-agent-sdk zod       (next to this file; zod 4 is a peer dependency)
//
// Routes (all 127.0.0.1 only, CORS handled by the caller):
//   GET  /login/status                 { available, version | reason }
//   POST /login/turn                   { turnId, model, effort, showThinking, system, tools, prompt, sessionId, maxTurns }
//                                      → application/x-ndjson stream of { type: 'init' | 'event' | 'tool_call' |
//                                        'assistant_error' | 'result' | 'error', ... }
//   POST /login/tool-result            { turnId, callId, content, isError }
//   POST /login/abort                  { turnId }
//
// Credentials are never read, printed or stored here: the SDK and the Claude Code binary handle auth. The child
// process gets this process's environment minus every Anthropic API-key variable, and a turn whose auth source is
// an API key is refused.
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOOL_SERVER = 'studio';
const TOOL_PREFIX = `mcp__${TOOL_SERVER}__`;
const DEFAULT_MAX_TURNS = 60;
// The Agent SDK persists sessions per working directory; a scratch one keeps project CLAUDE.md files out.
const CWD = path.join(os.tmpdir(), 'ottehr-studio-login-relay');
// Auth sources the login mode accepts: 'none' is what the SDK reports when the claude.ai login is used.
const LOGIN_AUTH_SOURCES = new Set(['none', 'oauth']);

let sdkPromise;
const loadSdk = () => {
  sdkPromise ??= Promise.all([import('@anthropic-ai/claude-agent-sdk'), import('zod')])
    .then(([sdk, zod]) => ({ ok: true, sdk, z: zod.z, version: sdk.default?.version }))
    .catch((error) => ({
      ok: false,
      reason:
        error?.code === 'ERR_MODULE_NOT_FOUND'
          ? 'The Claude Agent SDK is not installed next to the relay. Run: npm install @anthropic-ai/claude-agent-sdk zod'
          : `Could not load the Claude Agent SDK: ${error?.message ?? error}`,
    }));
  return sdkPromise;
};

/** Environment for the Claude Code child: no API keys, no base-URL override, none of a parent Claude Code session's vars. */
const childEnv = () => {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (
      name === 'ANTHROPIC_API_KEY' ||
      name === 'ANTHROPIC_AUTH_TOKEN' ||
      name === 'ANTHROPIC_BASE_URL' ||
      name === 'CLAUDECODE' ||
      name === 'CLAUDE_PID' ||
      name === 'CLAUDE_EFFORT' ||
      name.startsWith('CLAUDE_CODE_')
    )
      delete env[name];
  }
  env.CLAUDE_AGENT_SDK_CLIENT_APP = 'ottehr-studio-relay/1.0';
  return env;
};

const turns = new Map(); // turnId → { abort: AbortController, pending: Map<callId, resolve> }

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const json = (res, status, body, cors) => {
  res.writeHead(status, { ...cors, 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

/** The page's JSON-Schema tool definition → an SDK tool whose handler round-trips through the page. */
const pageTool = ({ sdk, z }, turn, def, emit) => {
  let shape;
  try {
    shape = z.fromJSONSchema(def.input_schema ?? { type: 'object', properties: {} }).shape;
  } catch (error) {
    console.warn(`login: could not convert the schema of ${def.name} (${error.message}); it takes any input`);
    shape = {};
  }
  return sdk.tool(
    def.name,
    def.description ?? '',
    shape,
    (args, extra) =>
      new Promise((resolve) => {
        const callId = randomUUID();
        const finish = (content, isError) => {
          turn.pending.delete(callId);
          resolve({ content: [{ type: 'text', text: content }], ...(isError ? { isError: true } : {}) });
        };
        turn.pending.set(callId, finish);
        extra?.signal?.addEventListener?.('abort', () => finish('Stopped by the user.', true));
        emit({ type: 'tool_call', callId, name: def.name, input: args });
      }),
    { alwaysLoad: true }
  );
};

/** Strip the MCP server prefix so the page sees the tool names it defined. */
const unprefix = (name) => (typeof name === 'string' && name.startsWith(TOOL_PREFIX) ? name.slice(TOOL_PREFIX.length) : name);

const unprefixEvent = (event) => {
  if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use')
    return { ...event, content_block: { ...event.content_block, name: unprefix(event.content_block.name) } };
  return event;
};

const describeAssistantError = (code) =>
  ({
    authentication_failed: 'Claude Code is not logged in on this Mac. Run `claude` in a terminal and log in, then retry.',
    oauth_org_not_allowed: 'This Claude login is not allowed to use the Agent SDK.',
    account_on_hold: 'The Claude account is on hold.',
    verification_required: 'The Claude account needs verification; open claude.ai.',
    billing_error: 'Claude reported a billing problem with this login.',
    rate_limit: 'The Claude subscription is rate-limited right now. Wait and retry.',
    overloaded: 'Claude is overloaded; retry in a moment.',
    model_not_found: 'This model is not available to the Claude login.',
    max_output_tokens: 'The response hit the length limit.',
  })[code] ?? `Claude Code reported: ${code}`;

async function runTurn(req, res, cors) {
  const body = await readJson(req);
  const loaded = await loadSdk();
  if (!loaded.ok) return json(res, 503, { type: 'error', message: loaded.reason }, cors);
  const { sdk } = loaded;
  const turnId = String(body.turnId || randomUUID());
  if (turns.has(turnId)) return json(res, 409, { type: 'error', message: `turn ${turnId} is already running` }, cors);

  const turn = { abort: new AbortController(), pending: new Map() };
  turns.set(turnId, turn);
  res.writeHead(200, { ...cors, 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' });
  const emit = (message) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(message)}\n`);
  };
  const stop = () => {
    turn.abort.abort();
    for (const finish of turn.pending.values()) finish('Stopped by the user.', true);
  };
  req.on('close', stop);

  const tools = (Array.isArray(body.tools) ? body.tools : []).map((def) => pageTool(loaded, turn, def, emit));
  const server = sdk.createSdkMcpServer({ name: TOOL_SERVER, version: '1.0.0', tools, alwaysLoad: true });
  const prompt = (async function* () {
    yield { type: 'user', message: { role: 'user', content: body.prompt }, parent_tool_use_id: null };
  })();
  mkdirSync(CWD, { recursive: true });

  const started = Date.now();
  let toolCalls = 0;
  let model;
  let sessionId = body.sessionId;
  let authSource;
  let result;
  console.log(
    `login turn ${turnId}: ${body.model ?? 'default model'}, effort ${body.effort ?? 'default'}, ${tools.length} tools${
      sessionId ? `, resuming ${sessionId}` : ''
    }`
  );
  try {
    for await (const message of sdk.query({
      prompt,
      options: {
        model: body.model,
        effort: body.effort,
        systemPrompt: body.system,
        tools: [],
        mcpServers: { [TOOL_SERVER]: server },
        allowedTools: [`${TOOL_PREFIX}*`],
        permissionMode: 'dontAsk',
        settingSources: [],
        strictMcpConfig: true,
        includePartialMessages: true,
        thinking: { type: 'adaptive', display: body.showThinking === false ? 'omitted' : 'summarized' },
        maxTurns: Number(body.maxTurns) || DEFAULT_MAX_TURNS,
        cwd: CWD,
        env: childEnv(),
        abortController: turn.abort,
        ...(sessionId ? { resume: sessionId } : {}),
        stderr: (data) => {
          const line = data.trim();
          if (line) console.error(`login turn ${turnId} [claude]: ${line.slice(0, 300)}`);
        },
      },
    })) {
      if (message.type === 'system' && message.subtype === 'init') {
        authSource = message.apiKeySource;
        sessionId = message.session_id;
        if (!LOGIN_AUTH_SOURCES.has(authSource)) {
          // Never let this mode bill a key: stop before the model runs.
          emit({
            type: 'error',
            message: `The relay refused the turn: Claude Code would authenticate with "${authSource}", not the Claude login.`,
          });
          stop();
          break;
        }
        emit({ type: 'init', sessionId, model: message.model, authSource });
      } else if (message.type === 'stream_event') {
        if (message.event.type === 'message_start') model = message.event.message?.model ?? model;
        emit({ type: 'event', event: unprefixEvent(message.event) });
      } else if (message.type === 'assistant') {
        if (message.error) emit({ type: 'assistant_error', code: message.error, message: describeAssistantError(message.error) });
        toolCalls += message.message.content.filter((b) => b.type === 'tool_use').length;
      } else if (message.type === 'result') {
        result = message;
      }
    }
  } catch (error) {
    if (!turn.abort.signal.aborted) {
      console.error(`login turn ${turnId} failed: ${error?.message ?? error}`);
      emit({ type: 'error', message: `The login relay could not finish the turn: ${error?.message ?? error}` });
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result) {
    emit({
      type: 'result',
      sessionId: result.session_id ?? sessionId,
      model,
      subtype: result.subtype,
      isError: result.is_error,
      errors: result.errors,
      stopReason: result.stop_reason,
      numTurns: result.num_turns,
      usage: result.usage,
    });
    console.log(
      `login turn ${turnId}: ${result.subtype} in ${seconds}s, ${toolCalls} tool calls, ${result.usage?.input_tokens ?? 0} in / ${
        result.usage?.output_tokens ?? 0
      } out, ${result.usage?.cache_read_input_tokens ?? 0} cached (${model ?? body.model}); auth: ${authSource}, no API key`
    );
  } else {
    emit({ type: 'result', sessionId, model, subtype: turn.abort.signal.aborted ? 'aborted' : 'incomplete', isError: true });
    console.log(`login turn ${turnId}: ${turn.abort.signal.aborted ? 'stopped' : 'ended without a result'} after ${seconds}s, ${toolCalls} tool calls; auth: ${authSource ?? 'unknown'}`);
  }
  turns.delete(turnId);
  res.end();
}

/** Handles /login/* requests; returns false for any other URL so the caller can continue. */
export async function handleLoginRequest(req, res, cors) {
  const url = req.url ?? '';
  if (!url.startsWith('/login/')) return false;
  try {
    if (url === '/login/status' && req.method === 'GET') {
      const loaded = await loadSdk();
      json(res, 200, loaded.ok ? { available: true, version: loaded.version } : { available: false, reason: loaded.reason }, cors);
    } else if (url === '/login/turn' && req.method === 'POST') {
      await runTurn(req, res, cors);
    } else if (url === '/login/tool-result' && req.method === 'POST') {
      const body = await readJson(req);
      const finish = turns.get(String(body.turnId))?.pending.get(String(body.callId));
      if (!finish) return json(res, 404, { type: 'error', message: 'no such pending tool call' }, cors);
      finish(typeof body.content === 'string' ? body.content : JSON.stringify(body.content ?? ''), body.isError === true);
      json(res, 200, { ok: true }, cors);
    } else if (url === '/login/abort' && req.method === 'POST') {
      const body = await readJson(req);
      const turn = turns.get(String(body.turnId));
      if (turn) {
        turn.abort.abort();
        for (const finish of turn.pending.values()) finish('Stopped by the user.', true);
      }
      json(res, 200, { ok: Boolean(turn) }, cors);
    } else {
      json(res, 404, { type: 'error', message: 'unknown login route' }, cors);
    }
  } catch (error) {
    console.error(`login route ${url} failed: ${error?.message ?? error}`);
    if (!res.headersSent) json(res, 500, { type: 'error', message: error?.message ?? String(error) }, cors);
    else res.end();
  }
  return true;
}

/** For /health: whether the SDK can be loaded (does not touch credentials). */
export async function loginAvailable() {
  const loaded = await loadSdk();
  return loaded.ok;
}
