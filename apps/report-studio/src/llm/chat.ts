// The conversation with Claude: a manual streaming tool loop over the beta Messages API. History is
// append-only (thinking blocks go back unchanged); each user turn is one undo step — the report before
// the turn is kept with the "changes" card the turn produces.
import Anthropic from '@anthropic-ai/sdk';
import { createTwoFilesPatch } from 'diff';
import { ReportSnapshot, snapshotOf } from '../report/types';
import { AssistantBlock, ChatItem, Settings, ToolBlock, Usage, useStudio } from '../state/store';
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

// Module state: the API transcript (what Claude sees) and the undo stack of report snapshots.
let history: MessageParam[] = [];
let seq = 0;
const nextId = (): string => `${Date.now().toString(36)}-${(seq += 1)}`;

export function resetConversation(): void {
  history = [];
  useStudio.getState().clearChat();
}

export function createClient(settings: Settings): Anthropic {
  const relay = settings.connection === 'relay';
  if (!relay && !settings.apiKey)
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
  history.push({ role: 'user', content: userContent });
  store.pushChat({ id: nextId(), role: 'user', text, attachments: attachments.map((a) => a.name) });

  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let servedBy: string | undefined;

  try {
    let jsonRetries = 0;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const itemId = nextId();
      store.pushChat({ id: itemId, role: 'assistant', blocks: [], streaming: true });
      const update = (fn: (blocks: AssistantBlock[]) => AssistantBlock[]): void =>
        useStudio.getState().updateAssistant(itemId, (item) => ({ ...item, blocks: fn(item.blocks) }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = client.beta.messages.stream(requestParams(settings, history) as any);
      // Index of the stream's content block → index in the UI block list.
      const uiIndex = new Map<number, number>();
      const partialJson = new Map<number, string>();

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'text')
            update((b) => (uiIndex.set(event.index, b.length), [...b, { type: 'text', text: '' }]));
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
          if (at === undefined) continue;
          const delta = event.delta;
          if (delta.type === 'text_delta')
            update((b) => b.map((x, i) => (i === at && x.type === 'text' ? { ...x, text: x.text + delta.text } : x)));
          else if (delta.type === 'thinking_delta')
            update((b) =>
              b.map((x, i) => (i === at && x.type === 'thinking' ? { ...x, text: x.text + delta.thinking } : x))
            );
          else if (delta.type === 'input_json_delta') {
            const json = (partialJson.get(event.index) ?? '') + delta.partial_json;
            partialJson.set(event.index, json);
            update((b) => b.map((x, i) => (i === at && x.type === 'tool' ? { ...x, input: json } : x)));
          }
        }
      }

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
        const started = Date.now();
        update((b) => b.map((x, i) => (i === at && x.type === 'tool' ? { ...x, input: tool.input } : x)));
        addEvent('llm', `Tool ${tool.name}`, summarizeInput(tool.input));
        let result: string;
        let isError = false;
        try {
          result = await executeTool(tool.name, tool.input);
        } catch (error) {
          isError = true;
          result = `Tool failed: ${error instanceof Error ? error.message : String(error)}`;
          addEvent('error', `Tool ${tool.name} failed: ${result}`);
        }
        const ms = Date.now() - started;
        update((b) =>
          b.map((x, i) =>
            i === at && x.type === 'tool'
              ? ({ ...x, status: isError ? 'error' : 'done', result, ms } satisfies ToolBlock)
              : x
          )
        );
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
      useStudio
        .getState()
        .updateAssistant(last.id, (item) => ({
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
  history.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: '[The user pressed Undo: the report (plan, code, title, date range) is back to how it was before your last turn.]',
      },
    ],
  });
  useStudio.getState().addEvent('info', 'Undid the last Claude turn');
}

/** Tell Claude about edits the user made by hand in the Code / Plan tabs (appended, not edited in). */
export function noteManualEdit(what: string): void {
  if (history.length === 0) return;
  history.push({
    role: 'user',
    content: [
      {
        type: 'text',
        text: `[The user edited the ${what} by hand in the studio; call get_report_state to see the current version before changing it.]`,
      },
    ],
  });
}
