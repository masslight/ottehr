// The conversation with Claude: a manual streaming tool loop over the beta Messages API. History is
// append-only (thinking blocks go back unchanged); each user turn is one undo step — the report before
// the turn is kept with the "changes" card the turn produces.
import Anthropic from '@anthropic-ai/sdk';
import { createTwoFilesPatch } from 'diff';
import { ReportSnapshot, snapshotOf } from '../report/types';
import { AssistantBlock, ChatItem, Settings, ToolBlock, Usage, useStudio } from '../state/store';
import { loginStartHint, runLoginTurn } from './loginClient';
import { MAX_TOKENS, supportsFallback } from './models';
import { buildSystemPrompt } from './systemPrompt';
import { executeTool, TOOLS } from './tools';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;

export interface Attachment {
  name: string;
  block: ContentBlockParam;
}

const MAX_TOOL_ROUNDS = 40;
const MAX_JSON_RETRIES = 2;

// Module state: the API transcript (what Claude sees) and the undo stack of report snapshots. In the login mode
// the transcript lives in the relay's Agent SDK session instead: `loginSessionId` resumes it, and notes for Claude
// (undo, manual edits) wait in `pendingNotes` until the next message.
let history: MessageParam[] = [];
let loginSessionId: string | undefined;
let pendingNotes: string[] = [];
let seq = 0;
const nextId = (): string => `${Date.now().toString(36)}-${(seq += 1)}`;

export function resetConversation(): void {
  history = [];
  loginSessionId = undefined;
  pendingNotes = [];
  useStudio.getState().clearChat();
}

const isLogin = (): boolean => useStudio.getState().settings.connection === 'login';

/** A note for Claude that is not a user message: appended to the transcript, or queued for the next login turn. */
function noteForClaude(text: string): void {
  if (isLogin()) pendingNotes.push(text);
  else history.push({ role: 'user', content: [{ type: 'text', text }] });
}

export function createClient(settings: Settings): Anthropic {
  const relay = settings.connection === 'relay';
  if (settings.connection === 'direct' && !settings.apiKey)
    throw new Error('Add your Anthropic API key in Settings, or connect through the local relay.');
  return new Anthropic({
    // The relay may hold the key itself (ANTHROPIC_API_KEY in its env); a placeholder satisfies the SDK.
    apiKey: settings.apiKey || 'relay',
    baseURL: relay ? settings.relayUrl.replace(/\/+$/, '') : undefined,
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  });
}

function requestParams(settings: Settings, messages: MessageParam[]): Record<string, unknown> {
  const fallback = supportsFallback(settings.model);
  return {
    model: settings.model,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(),
    messages,
    tools: TOOLS,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: settings.effort },
    cache_control: { type: 'ephemeral' },
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  };
}

const describeError = (error: unknown, settings: Settings): string => {
  if (error instanceof Anthropic.AuthenticationError)
    return 'Claude rejected the API key (401). Check Settings → Claude.';
  if (error instanceof Anthropic.PermissionDeniedError) return `Claude refused the request (403): ${error.message}`;
  if (error instanceof Anthropic.RateLimitError)
    return 'Claude is rate-limiting this key (429). Wait a moment and retry.';
  if (error instanceof Anthropic.BadRequestError) return `Claude rejected the request (400): ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) {
    return settings.connection === 'relay'
      ? `Could not reach the local relay at ${settings.relayUrl}. Start it: node apps/report-studio/scripts/claude-relay.mjs`
      : 'Could not reach api.anthropic.com from the browser. This org blocks browser (CORS) requests — switch Settings → Claude to the local relay.';
  }
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
};

type UpdateBlocks = (fn: (blocks: AssistantBlock[]) => AssistantBlock[]) => void;

// Mirrors one raw streaming event into the assistant item. `uiIndex` maps the message's content block index to
// the UI block index and `partialJson` accumulates tool input; both are per API message.
function applyStreamEvent(
  update: UpdateBlocks,
  uiIndex: Map<number, number>,
  partialJson: Map<number, string>,
  event: Anthropic.Beta.BetaRawMessageStreamEvent
): void {
  if (event.type === 'content_block_start') {
    const block = event.content_block;
    if (block.type === 'text') update((b) => (uiIndex.set(event.index, b.length), [...b, { type: 'text', text: '' }]));
    else if (block.type === 'thinking')
      update((b) => (uiIndex.set(event.index, b.length), [...b, { type: 'thinking', text: '' }]));
    else if (block.type === 'tool_use') {
      partialJson.set(event.index, '');
      update(
        (b) => (
          uiIndex.set(event.index, b.length),
          [...b, { type: 'tool', id: block.id, name: block.name, input: undefined, status: 'running' }]
        )
      );
    }
  } else if (event.type === 'content_block_delta') {
    const at = uiIndex.get(event.index);
    if (at === undefined) return;
    const delta = event.delta;
    if (delta.type === 'text_delta')
      update((b) => b.map((x, i) => (i === at && x.type === 'text' ? { ...x, text: x.text + delta.text } : x)));
    else if (delta.type === 'thinking_delta')
      update((b) => b.map((x, i) => (i === at && x.type === 'thinking' ? { ...x, text: x.text + delta.thinking } : x)));
    else if (delta.type === 'input_json_delta') {
      const json = (partialJson.get(event.index) ?? '') + delta.partial_json;
      partialJson.set(event.index, json);
      update((b) => b.map((x, i) => (i === at && x.type === 'tool' ? { ...x, input: json } : x)));
    }
  }
}

/** Runs one tool for the tool block at UI index `at`, keeping the card in step; returns the result for Claude. */
async function runToolBlock(
  update: UpdateBlocks,
  at: number,
  name: string,
  input: unknown
): Promise<{ result: string; isError: boolean }> {
  const { addEvent } = useStudio.getState();
  const started = Date.now();
  update((b) => b.map((x, i) => (i === at && x.type === 'tool' ? { ...x, input } : x)));
  addEvent('llm', `Tool ${name}`, summarizeInput(input));
  let result: string;
  let isError = false;
  try {
    result = await executeTool(name, input);
  } catch (error) {
    isError = true;
    result = `Tool failed: ${error instanceof Error ? error.message : String(error)}`;
    addEvent('error', `Tool ${name} failed: ${result}`);
  }
  const ms = Date.now() - started;
  update((b) =>
    b.map((x, i) =>
      i === at && x.type === 'tool' ? ({ ...x, status: isError ? 'error' : 'done', result, ms } satisfies ToolBlock) : x
    )
  );
  return { result, isError };
}

// "Through my Claude login": the relay drives the whole turn with the Agent SDK and the page mirrors its stream,
// running the tools it asks for. Everything streams into one assistant item.
async function runLoginTurnUi(
  settings: Settings,
  userContent: ContentBlockParam[],
  usage: Usage
): Promise<{ error?: string; model?: string }> {
  const store = useStudio.getState();
  const itemId = nextId();
  store.pushChat({ id: itemId, role: 'assistant', blocks: [], streaming: true });
  const update: UpdateBlocks = (fn) =>
    useStudio.getState().updateAssistant(itemId, (item) => ({ ...item, blocks: fn(item.blocks) }));
  let uiIndex = new Map<number, number>();
  let partialJson = new Map<number, string>();
  // UI indices of tool blocks in the order they started; a tool_call (which carries no tool_use id) takes the
  // first queued block with its name.
  const queued: number[] = [];
  let error: string | undefined;
  let model: string | undefined;
  const notes = pendingNotes.splice(0);
  const prompt: ContentBlockParam[] = notes.length
    ? userContent.map((block) =>
        block.type === 'text' && block === userContent.at(-1)
          ? { ...block, text: `${notes.join('\n')}\n\n${block.text}` }
          : block
      )
    : userContent;
  try {
    await runLoginTurn(
      settings.relayUrl,
      {
        model: settings.model,
        effort: settings.effort,
        system: buildSystemPrompt(),
        tools: TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
        prompt,
        sessionId: loginSessionId,
        maxTurns: MAX_TOOL_ROUNDS,
      },
      {
        onEvent: (ev) => {
          if (ev.type === 'init') loginSessionId = ev.sessionId;
          else if (ev.type === 'event') {
            if (ev.event.type === 'message_start') {
              uiIndex = new Map();
              partialJson = new Map();
            }
            applyStreamEvent(update, uiIndex, partialJson, ev.event);
            if (ev.event.type === 'content_block_start' && ev.event.content_block.type === 'tool_use') {
              const at = uiIndex.get(ev.event.index);
              if (at !== undefined) queued.push(at);
            }
          } else if (ev.type === 'assistant_error' || ev.type === 'error') error = ev.message;
          else if (ev.type === 'result') {
            usage.input += ev.usage?.input_tokens ?? 0;
            usage.output += ev.usage?.output_tokens ?? 0;
            usage.cacheRead += ev.usage?.cache_read_input_tokens ?? 0;
            usage.cacheWrite += ev.usage?.cache_creation_input_tokens ?? 0;
            if (ev.sessionId) loginSessionId = ev.sessionId;
            model = ev.model;
            useStudio.getState().updateAssistant(itemId, (item) => ({ ...item, usage: { ...usage }, model }));
            if (ev.subtype === 'error_max_turns')
              error ??= 'Claude stopped after the maximum number of steps for one turn.';
            else if (ev.subtype === 'aborted') error ??= 'Stopped.';
            else if (ev.subtype === 'incomplete')
              error ??= `The relay ended the turn without a result. ${loginStartHint}`;
            else if (ev.isError) error ??= ev.errors?.join('\n') || 'The turn failed.';
          }
        },
        onToolCall: async (name, input) => {
          const blocks =
            useStudio.getState().chat.find((c): c is Extract<ChatItem, { role: 'assistant' }> => c.id === itemId)
              ?.blocks ?? [];
          const position = queued.findIndex(
            (i) => blocks[i]?.type === 'tool' && (blocks[i] as ToolBlock).name === name
          );
          const at = position >= 0 ? queued.splice(position, 1)[0] : -1;
          const { result, isError } = await runToolBlock(update, at, name, input);
          return { content: result, isError };
        },
      },
      new AbortController().signal
    );
  } finally {
    finishItem(itemId);
  }
  if (error) update((b) => [...b, { type: 'notice', tone: 'error', text: error as string }]);
  return { error, model };
}

export async function sendMessage(text: string, attachments: Attachment[] = []): Promise<void> {
  const store = useStudio.getState();
  if (store.busy) return;
  const { settings, addEvent } = store;

  let client: Anthropic;
  try {
    client = createClient(settings);
  } catch (error) {
    store.pushChat({
      id: nextId(),
      role: 'assistant',
      blocks: [{ type: 'notice', tone: 'error', text: (error as Error).message }],
      streaming: false,
    });
    return;
  }

  store.setBusy(true);
  const before: ReportSnapshot = snapshotOf(store.report);
  if (!store.report.prompt) store.setReport({ prompt: text }, { dirty: true });

  const userContent: ContentBlockParam[] = [...attachments.map((a) => a.block), { type: 'text', text }];
  const login = settings.connection === 'login';
  if (!login) history.push({ role: 'user', content: userContent });
  store.pushChat({ id: nextId(), role: 'user', text, attachments: attachments.map((a) => a.name) });

  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let servedBy: string | undefined;

  try {
    if (login) {
      const outcome = await runLoginTurnUi(settings, userContent, usage);
      servedBy = outcome.model;
      if (outcome.error) addEvent('error', outcome.error);
    }
    let jsonRetries = 0;
    for (let round = 0; round < MAX_TOOL_ROUNDS && !login; round += 1) {
      const itemId = nextId();
      store.pushChat({ id: itemId, role: 'assistant', blocks: [], streaming: true });
      const update = (fn: (blocks: AssistantBlock[]) => AssistantBlock[]): void =>
        useStudio.getState().updateAssistant(itemId, (item) => ({ ...item, blocks: fn(item.blocks) }));

      const stream = client.beta.messages.stream(requestParams(settings, history) as any);
      // Index of the stream's content block → index in the UI block list.
      const uiIndex = new Map<number, number>();
      const partialJson = new Map<number, string>();

      for await (const event of stream) applyStreamEvent(update, uiIndex, partialJson, event);

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        if (error instanceof Anthropic.APIError || jsonRetries >= MAX_JSON_RETRIES) throw error;
        jsonRetries += 1;
        addEvent('warn', 'A tool input was not parseable JSON; re-issuing the turn');
        update((b) => [...b, { type: 'notice', tone: 'warn', text: 'Tool input was not valid JSON — retrying.' }]);
        continue;
      }

      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
      servedBy = message.model;
      useStudio.getState().updateAssistant(itemId, (item) => ({ ...item, usage: { ...usage }, model: servedBy }));
      for (const block of message.content) {
        if ((block as { type: string }).type === 'fallback') {
          const fb = block as unknown as { from: { model: string }; to: { model: string } };
          update((b) => [
            ...b,
            { type: 'notice', tone: 'info', text: `${fb.from.model} declined; ${fb.to.model} continued.` },
          ]);
        }
      }

      // Append exactly what came back (thinking blocks included) — the transcript is never edited.
      history.push({ role: 'assistant', content: message.content as unknown as ContentBlockParam[] });

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (message.stop_reason === 'refusal') {
        const details = (message as unknown as { stop_details?: { explanation?: string } }).stop_details;
        update((b) => [
          ...b,
          {
            type: 'notice',
            tone: 'error',
            text: `Claude declined to continue${details?.explanation ? `: ${details.explanation}` : '.'}`,
          },
        ]);
        finishItem(itemId);
        break;
      }
      if (message.stop_reason === 'max_tokens') {
        update((b) => [
          ...b,
          {
            type: 'notice',
            tone: 'warn',
            text: toolUses.length
              ? 'The response hit the length limit mid-tool-call; nothing was run. Ask Claude to continue in smaller steps.'
              : 'The response hit the length limit.',
          },
        ]);
        finishItem(itemId);
        break;
      }
      if (message.stop_reason === 'pause_turn') {
        finishItem(itemId);
        continue;
      }
      if (toolUses.length === 0) {
        finishItem(itemId);
        break;
      }

      const results: ContentBlockParam[] = [];
      for (const tool of toolUses) {
        const at =
          useStudio
            .getState()
            .chat.find((c): c is Extract<ChatItem, { role: 'assistant' }> => c.id === itemId)
            ?.blocks.findIndex((b) => b.type === 'tool' && b.id === tool.id) ?? -1;
        const { result, isError } = await runToolBlock(update, at, tool.name, tool.input);
        results.push({ type: 'tool_result', tool_use_id: tool.id, content: result, is_error: isError || undefined });
      }
      finishItem(itemId);
      history.push({ role: 'user', content: results });
    }
  } catch (error) {
    const text = describeError(error, settings);
    addEvent('error', text);
    const last = useStudio.getState().chat.at(-1);
    if (last?.role === 'assistant' && last.streaming) {
      useStudio.getState().updateAssistant(last.id, (item) => ({
        ...item,
        streaming: false,
        blocks: [...item.blocks, { type: 'notice', tone: 'error', text }],
      }));
    } else {
      store.pushChat({
        id: nextId(),
        role: 'assistant',
        blocks: [{ type: 'notice', tone: 'error', text }],
        streaming: false,
      });
    }
  } finally {
    const after = snapshotOf(useStudio.getState().report);
    const changes = diffSnapshots(before, after);
    if (changes.summary.length) {
      store.pushChat({
        id: nextId(),
        role: 'assistant',
        blocks: [{ type: 'changes', ...changes, before, undone: false }],
        streaming: false,
      });
    }
    addEvent(
      'llm',
      `Turn done: ${usage.input} in / ${usage.output} out tokens, ${usage.cacheRead} cached${
        servedBy ? `, ${servedBy}` : ''
      }`
    );
    useStudio.getState().setBusy(false);
  }
}

function finishItem(id: string): void {
  useStudio.getState().updateAssistant(id, (item) => ({ ...item, streaming: false }));
}

const summarizeInput = (input: unknown): string => {
  try {
    const text = JSON.stringify(input);
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch {
    return '';
  }
};

function diffSnapshots(
  before: ReportSnapshot,
  after: ReportSnapshot
): { summary: string[]; diffs: { label: string; patch: string }[] } {
  const summary: string[] = [];
  const diffs: { label: string; patch: string }[] = [];
  const text = (label: string, a: string | undefined, b: string | undefined): void => {
    if ((a ?? '') === (b ?? '')) return;
    summary.push(label);
    diffs.push({
      label,
      patch: createTwoFilesPatch(label, label, (a ?? '') + '\n', (b ?? '') + '\n', 'before', 'after', { context: 2 }),
    });
  };
  text('name', before.name, after.name);
  text('title', before.title, after.title);
  text('description', before.description, after.description);
  text('dateRange', JSON.stringify(before.dateRange), JSON.stringify(after.dateRange));
  text('plan', JSON.stringify(before.plan, null, 2), JSON.stringify(after.plan, null, 2));
  text('code', before.code, after.code);
  return { summary, diffs };
}

/** Undo one Claude turn: restore the report as it was before it, and tell Claude on the next message. */
export function undoTurn(before: ReportSnapshot): void {
  useStudio.getState().restoreSnapshot(before);
  noteForClaude(
    '[The user pressed Undo: the report (plan, code, title, date range) is back to how it was before your last turn.]'
  );
  useStudio.getState().addEvent('info', 'Undid the last Claude turn');
}

/** Tell Claude about edits the user made by hand in the Code / Plan tabs (appended, not edited in). */
export function noteManualEdit(what: string): void {
  if (history.length === 0 && !loginSessionId) return;
  noteForClaude(
    `[The user edited the ${what} by hand in the studio; call get_report_state to see the current version before changing it.]`
  );
}
