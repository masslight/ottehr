import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popover,
  Stack,
  SxProps,
  TextField,
  Typography,
} from '@mui/material';
import { captureException } from '@sentry/react';
import { DocumentReference } from 'fhir/r4b';
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AIChatDetails,
  EASY_CHART_NOTE_TEXT_FIELD_LABELS,
  EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL,
  EASY_CHART_PRIMED_EXTENSION_URL,
  EasyChartAgentIntent,
  EasyChartPrecomputedPlan,
} from 'utils';
import { getDocumentReferenceSource, getSource } from '../visits/shared/components/OttehrAi';
import {
  AddExamFindingIntent,
  AddProcedureIntent,
  ApplyTemplateIntent,
  ConvStep,
  RemoveExamFindingIntent,
  RemoveIntent,
  UpdateProcedureIntent,
} from './chart-types';
import { leafKey } from './exam-ros-catalog';
import { MedicationSearchPicker } from './MedicationSearchPicker';
import { containsTranscriptHeader, extractTranscriptHeaderLabels, transcriptHeaderLine } from './transcript-docs';
import { useChartAssistant } from './useChartAssistant';

export type ChartAssistant = ReturnType<typeof useChartAssistant>;

// Client-side status escalation for long model calls. The server gives the primary model a 120s
// budget before retrying and then escalating to the backup model, so a turn can legitimately run
// 2–5 minutes — surface that instead of an indefinite "Thinking…".
const SLOW_AFTER_S = 25;
const PRIMARY_TIMEOUT_S = 120;

const formatElapsed = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

const escalatedStatus = (elapsed: number, base: string, slow: string, escalated: string): string =>
  elapsed >= PRIMARY_TIMEOUT_S ? escalated : elapsed >= SLOW_AFTER_S ? slow : base;

// Seconds since `activeKey` last became (or changed to) a truthy value. Each thinking phase is a
// fresh conv object, so passing the conv as the key restarts the clock even when two thinking
// phases run back to back. The 1s interval is cleared on deactivate/unmount.
function useElapsedSeconds(activeKey: unknown): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activeKey) return undefined;
    setElapsed(0);
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [activeKey]);
  return elapsed;
}

// Spinner + escalating status line, with a live elapsed counter once the call is running long.
function WorkingStatus({ elapsed, text, sx }: { elapsed: number; text: string; sx?: SxProps }): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      <CircularProgress size={14} sx={{ flexShrink: 0 }} />
      <Typography variant="body1" color="text.secondary">
        {text}
      </Typography>
      {elapsed >= SLOW_AFTER_S && (
        <Typography variant="body2" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
          {formatElapsed(elapsed)}
        </Typography>
      )}
    </Stack>
  );
}

// The right column of the easy-chart page: the unified chat thread (history + the live in-progress
// turn with all its disambiguation pickers), the running-plan card, the review indicator, and the
// composer pinned at the bottom. Purely presentational over the assistant hook's state/handlers —
// all behavior lives in useChartAssistant. The one extra input is `aiChat` (encounter transcript
// DocumentReferences from ambient-scribe recordings / the intake chatbot) + `chartLooksEmpty`,
// which drive the transcript chips and the prime-from-transcript banner.
export function AssistantColumn({
  assistant,
  aiChat,
  chartLooksEmpty,
  transcriptPending,
  chipsPortalEl,
}: {
  assistant: ChartAssistant;
  aiChat: AIChatDetails | undefined;
  chartLooksEmpty: boolean;
  // A recording was uploaded and its transcript is still being produced server-side — show a
  // placeholder chip so the provider knows the system heard them.
  transcriptPending?: boolean;
  // When set, the transcript chips render into this element (the page header) via portal instead
  // of above the composer. Chip state/handlers stay here either way.
  chipsPortalEl?: HTMLElement | null;
}): JSX.Element {
  const {
    conv,
    setConv,
    thread,
    committedConv,
    plan,
    setPlan,
    refineText,
    setRefineText,
    pickerRefineText,
    setPickerRefineText,
    examPickSelected,
    setExamPickSelected,
    isThinking,
    tokenTally,
    setTokenTally,
    reviewLoading,
    pendingNoteEdits,
    applyPendingNoteEdit,
    dismissPendingNoteEdit,
    reviewError,
    reviewAnchorId,
    describePlanStep,
    sendText,
    handleSkipPicker,
    handleRefinePicker,
    handleLabPick,
    handleRemovePick,
    handleApplyTemplate,
    handleProcedurePick,
    handleRosPick,
    handleExamPickMulti,
    handleExamRemove,
    handleRosRemove,
    handleProcedureUpdate,
    handlePick,
    runReview,
  } = assistant;
  const refineInputRef = useRef<HTMLTextAreaElement | null>(null);
  // The right column scrolls independently; its interactive bits (questions, the Approve and
  // Run buttons, review cards) render at the bottom of the stack and are easy to miss below the
  // fold. Auto-scroll the column to the bottom whenever that content changes so new prompts and
  // buttons come into view (mirrors a chat panel following its latest message).
  const rightColScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the chat column to the bottom whenever its content changes so new prompts and
  // buttons come into view (mirrors a chat panel following its latest message).
  useEffect(() => {
    const el = rightColScrollRef.current;
    if (!el) return;
    // Wait for the new content to lay out, then follow it to the bottom.
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [conv, plan, reviewLoading, thread]);

  // Restore focus to the refine bar after each action completes so the provider can keep
  // typing the next request without manually clicking the input (a Send click moves focus to
  // the button). Triggered off the !isThinking edge — the end of a turn.
  useEffect(() => {
    if (!isThinking) {
      requestAnimationFrame(() => refineInputRef.current?.focus());
    }
  }, [isThinking]);

  // Escalating status timers for the thinking and review bubbles (see SLOW_AFTER_S above).
  const thinkingElapsed = useElapsedSeconds(conv?.kind === 'thinking' ? conv : null);
  const reviewElapsed = useElapsedSeconds(reviewLoading);

  // ---- Transcript priming --------------------------------------------------------------------
  // Ambient-scribe recordings and the intake HPI chatbot each leave a DocumentReference on the
  // encounter with the full transcript as an inline attachment titled 'Transcript'. Surface those
  // as one chip per document so the provider can feed a transcript through the narrative pipeline
  // with one click instead of copy-pasting it.
  const { oystehr } = useApiClients();
  // Session-only: which transcript documents have already been sent (chips render as done).
  const [usedTranscriptIds, setUsedTranscriptIds] = useState<Set<string>>(new Set());
  const transcriptDocs = (aiChat?.documents ?? [])
    .map((doc) => ({
      doc,
      data: doc.content?.find((c) => c.attachment?.title === 'Transcript')?.attachment?.data,
    }))
    .filter((t): t is { doc: DocumentReference; data: string } => !!t.data && !!t.doc.id)
    .sort((a, b) => (a.doc.date ?? '').localeCompare(b.doc.date ?? ''));
  // "Used" = sent this session OR carrying the durable primed extension (stamped on the
  // DocumentReference after a successful prime, so the state survives reloads and other browsers).
  const isPrimed = (doc: DocumentReference): boolean =>
    !!doc.extension?.some((e) => e.url === EASY_CHART_PRIMED_EXTENSION_URL);
  const isUsedTranscript = (t: { doc: DocumentReference }): boolean =>
    usedTranscriptIds.has(t.doc.id!) || isPrimed(t.doc);
  const unusedTranscripts = transcriptDocs.filter((t) => !isUsedTranscript(t));
  // Same label on the chip and in the multi-transcript section headers, so the provider can match
  // a thread section back to the chip it came from.
  const transcriptLabel = (doc: DocumentReference): string =>
    `${getDocumentReferenceSource(doc) === 'audio' ? '🎤' : '💬'} ${getSource(doc, oystehr, aiChat?.providers)}`;
  // Exact inverse of the server-side btoa(unescape(encodeURIComponent(...))) encoding (see
  // createDocumentReference in the ai zambda shared helpers) — plain atob would mangle non-ASCII.
  const decodeTranscript = (data: string): string => decodeURIComponent(escape(atob(data)));

  // Precomputed-plan cache stamped on the DocumentReference by the recording pipeline. Only valid
  // for the transcript's UN-EDITED decoded text, so exclusively the direct transcript send paths
  // pass it — never the composer (inserted text may be edited). A malformed payload counts as
  // absent: the cache is purely an optimization and sendText falls back to a live planner call.
  const extractPlanCache = (doc: DocumentReference): EasyChartPrecomputedPlan | undefined => {
    const raw = doc.extension?.find((e) => e.url === EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL)?.valueString;
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as EasyChartPrecomputedPlan;
    } catch (e) {
      captureException(e);
      return undefined;
    }
  };

  // Durable consumed mark: stamp the primed extension on the DocumentReference once its transcript
  // has been sent, so the prime banner stays gone across reloads and other browsers. Patch, not
  // update: our in-memory copy of the doc can be stale, and a full update would clobber concurrent
  // edits to the whole resource — the patch only ever touches the extension array. Best-effort by
  // design: a failure never blocks the priming UX (the session mark still covers this session).
  const markTranscriptPrimed = async (doc: DocumentReference): Promise<void> => {
    if (!oystehr || !doc.id || isPrimed(doc)) return;
    const ext = { url: EASY_CHART_PRIMED_EXTENSION_URL, valueDateTime: new Date().toISOString() };
    try {
      await oystehr.fhir.patch<DocumentReference>({
        resourceType: 'DocumentReference',
        id: doc.id,
        operations: doc.extension
          ? [{ op: 'add', path: '/extension/-', value: ext }]
          : [{ op: 'add', path: '/extension', value: [ext] }],
      });
      // Keep the in-memory copy consistent so a deliberate re-click doesn't stamp a duplicate.
      doc.extension = [...(doc.extension ?? []), ext];
    } catch (e) {
      console.error('Failed to mark transcript as primed:', e);
      captureException(e);
    }
  };

  // forceNarrative: a transcript is a whole-visit narrative BY CONSTRUCTION — a short chat
  // transcript could fall under the length/sentence heuristic and be misrouted to the
  // single-intent agent. sendText never rejects (it surfaces failures in the thread itself) and
  // resolves true only when the transcript actually made it into the pipeline — persist the
  // durable consumed mark then. On failure, roll back the session mark added below (the chip was
  // disabled up-front to prevent a double-send while in flight) so the banner/chip come back and
  // the provider can retry.
  const sendTranscript = async (t: { doc: DocumentReference; data: string }): Promise<void> => {
    setUsedTranscriptIds((prev) => new Set(prev).add(t.doc.id!));
    const sent = await sendText(decodeTranscript(t.data), { forceNarrative: true, planCache: extractPlanCache(t.doc) });
    if (!sent) {
      setUsedTranscriptIds((prev) => {
        const next = new Set(prev);
        next.delete(t.doc.id!);
        return next;
      });
      return;
    }
    await markTranscriptPrimed(t.doc);
  };

  // Prime the whole chart from every unused transcript at once, chronologically; multiple
  // transcripts get labeled section headers so the planner (and the thread bubble) keeps the
  // sources distinguishable.
  const primeFromTranscripts = async (): Promise<void> => {
    const toSend = unusedTranscripts;
    if (toSend.length === 0) return;
    const text =
      toSend.length === 1
        ? decodeTranscript(toSend[0].data)
        : toSend
            .map((t) => `${transcriptHeaderLine(transcriptLabel(t.doc))}\n${decodeTranscript(t.data)}`)
            .join('\n\n');
    setUsedTranscriptIds((prev) => {
      const next = new Set(prev);
      for (const t of toSend) next.add(t.doc.id!);
      return next;
    });
    // A combined multi-transcript message was never precomputed — only the single-transcript send
    // (whose text is exactly the decoded transcript) can use the cache.
    const planCache = toSend.length === 1 ? extractPlanCache(toSend[0].doc) : undefined;
    const sent = await sendText(text, { forceNarrative: true, planCache });
    if (!sent) {
      // Failed send: nothing was consumed — restore the session marks so the banner reappears.
      setUsedTranscriptIds((prev) => {
        const next = new Set(prev);
        for (const t of toSend) next.delete(t.doc.id!);
        return next;
      });
      return;
    }
    for (const t of toSend) await markTranscriptPrimed(t.doc);
  };

  // Offer the one-click prime only while it's clearly the opening move: nothing charted yet and
  // the provider hasn't sent anything this session (a user thread bubble exists once they have —
  // including a transcript sent from the preview card).
  const showPrimeBanner = unusedTranscripts.length > 0 && chartLooksEmpty && !thread.some((m) => m.role === 'user');

  // Composer send. The hook's handleSend can't serve the composer anymore: transcript text
  // inserted via the preview card must route as narrative (its section header is the signal —
  // a short chat transcript could otherwise fall under the length heuristic), and a SUCCESSFUL
  // send must consume the transcripts whose headers survived verbatim. Both need the send
  // result, which handleSend doesn't expose. Mirrors handleSend's clear-composer-synchronously
  // contract (the queue effect below relies on it). Edited/unknown headers stamp nothing —
  // conservative by design.
  const sendComposer = async (): Promise<void> => {
    const message = refineText.trim();
    if (!message) return;
    setRefineText('');
    const forceNarrative = containsTranscriptHeader(message);
    const sent = await sendText(message, forceNarrative ? { forceNarrative: true } : undefined);
    if (!sent || !forceNarrative) return;
    const labels = new Set(extractTranscriptHeaderLabels(message));
    const matched = transcriptDocs.filter((t) => labels.has(transcriptLabel(t.doc)));
    if (matched.length === 0) return;
    setUsedTranscriptIds((prev) => {
      const next = new Set(prev);
      for (const t of matched) next.add(t.doc.id!);
      return next;
    });
    for (const t of matched) await markTranscriptPrimed(t.doc);
  };

  // One-slot send queue: the composer stays enabled during a turn so the provider can keep
  // typing, but sendComposer must never run concurrently with an active turn — a Send while
  // thinking stashes the text here and it auto-sends when the turn finishes. A second Send
  // while one is queued replaces it.
  const [queuedText, setQueuedText] = useState<string | null>(null);
  const queuedDraftRef = useRef('');
  useEffect(() => {
    if (isThinking || queuedText === null) return;
    // sendComposer reads the composer state, so stage the queued text there first (preserving any
    // draft typed after queueing), then send on the re-render where the staged value is visible.
    if (refineText !== queuedText) {
      queuedDraftRef.current = refineText;
      setRefineText(queuedText);
      return;
    }
    setQueuedText(null);
    void sendComposer(); // clears the composer synchronously…
    setRefineText(queuedDraftRef.current); // …then the preserved draft goes back in
    queuedDraftRef.current = '';
    // sendComposer is recreated every render (it closes over the freshest composer/transcript
    // state) — listing it would just make the effect re-run each render; the guards above already
    // make that harmless, and the states it's called with are all in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThinking, queuedText, refineText, setRefineText]);

  const trySend = (): void => {
    if (!refineText.trim()) return;
    if (isThinking) {
      setQueuedText(refineText.trim());
      setRefineText('');
      return;
    }
    void sendComposer();
  };

  // ---- Transcript preview card ---------------------------------------------------------------
  // Chip click opens a preview instead of sending: the provider reads the transcript and picks
  // Generate chart (the full prime flow) / Insert into composer (to edit before sending) / Copy.
  // Tracked by doc id, not by captured object, so the card always renders the freshest doc.
  const [previewAnchor, setPreviewAnchor] = useState<HTMLElement | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);
  useEffect(() => {
    // Unmount-only cleanup for the "Copied" reset timer.
    return () => {
      if (copyResetRef.current !== null) clearTimeout(copyResetRef.current);
    };
  }, []);
  const previewTranscript = previewDocId ? transcriptDocs.find((t) => t.doc.id === previewDocId) : undefined;
  const closePreview = (): void => {
    setPreviewAnchor(null);
    setPreviewDocId(null);
    setCopied(false);
    if (copyResetRef.current !== null) clearTimeout(copyResetRef.current);
  };

  // Append (never replace): the provider may have a draft in progress. The blank-line separator
  // plus the transcript's section header keeps the sources separable in the message, and the
  // header is what routes the eventual send as narrative + stamps the transcript consumed.
  const insertIntoComposer = (t: { doc: DocumentReference; data: string }): void => {
    const block = `${transcriptHeaderLine(transcriptLabel(t.doc))}\n${decodeTranscript(t.data)}`;
    setRefineText(refineText.trim() ? `${refineText.trimEnd()}\n\n${block}` : block);
    closePreview();
    requestAnimationFrame(() => refineInputRef.current?.focus());
  };

  // Raw text, no header — for pasting outside the assistant. "Copied" only on confirmed write.
  const copyTranscript = (t: { data: string }): void => {
    navigator.clipboard.writeText(decodeTranscript(t.data)).then(
      () => {
        setCopied(true);
        if (copyResetRef.current !== null) clearTimeout(copyResetRef.current);
        copyResetRef.current = window.setTimeout(() => setCopied(false), 1500);
      },
      (e) => captureException(e)
    );
  };

  const transcriptChips = (transcriptDocs.length > 0 || transcriptPending) && (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {transcriptDocs.map((t) => {
        const used = isUsedTranscript(t);
        return (
          <Chip
            key={t.doc.id}
            size="small"
            variant="outlined"
            sx={{ '& .MuiChip-label': { fontSize: '0.875rem' } }}
            label={`${used ? '✓' : ''} ${transcriptLabel(t.doc)}`.trim()}
            // Used (✓) chips stay clickable: the preview is read-only, and its Generate action is
            // the deliberate re-prime path (the durable primed mark would otherwise permanently
            // lock out re-priming, e.g. after a chart wipe). The preview stays openable while a
            // turn runs — its actions are what disable on isThinking.
            onClick={(e) => {
              setPreviewAnchor(e.currentTarget);
              setPreviewDocId(t.doc.id!);
            }}
          />
        );
      })}
      {transcriptPending && (
        <Chip
          size="small"
          variant="outlined"
          disabled
          sx={{ '& .MuiChip-label': { fontSize: '0.875rem' } }}
          label="🎤 Transcribing…"
        />
      )}
    </Stack>
  );

  const transcriptPreview = previewTranscript && (
    <Popover
      open={!!previewAnchor}
      anchorEl={previewAnchor}
      onClose={closePreview}
      // Chips live in the page header (via portal), so open the preview below its chip.
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Box sx={{ p: 1.5, width: 480, maxWidth: '90vw' }}>
        <Typography variant="subtitle2" sx={{ mb: 0.75, fontSize: '0.875rem' }}>
          {transcriptLabel(previewTranscript.doc)}
        </Typography>
        <Box sx={{ maxHeight: '40vh', overflowY: 'auto', p: 1, bgcolor: 'action.hover', borderRadius: 1, mb: 1 }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {decodeTranscript(previewTranscript.data)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            sx={{ textTransform: 'none' }}
            disabled={isThinking}
            onClick={() => {
              closePreview();
              void sendTranscript(previewTranscript);
            }}
          >
            Generate chart
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none' }}
            disabled={isThinking}
            onClick={() => insertIntoComposer(previewTranscript)}
          >
            Insert into composer
          </Button>
          <Button
            size="small"
            variant="text"
            sx={{ textTransform: 'none' }}
            disabled={isThinking}
            onClick={() => copyTranscript(previewTranscript)}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </Stack>
      </Box>
    </Popover>
  );

  const primeBanner = showPrimeBanner && (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="body1" color="text.secondary">
          A visit transcript is available — generate the chart from it?
        </Typography>
        <Button
          size="small"
          variant="contained"
          sx={{ textTransform: 'none', flexShrink: 0 }}
          disabled={isThinking}
          onClick={() => void primeFromTranscripts()}
        >
          Generate chart
        </Button>
      </Stack>
    </Paper>
  );

  // Composer pinned to the bottom of the chat column (chat-app style). The thread scrolls above it.
  const refineBar = (
    <Paper elevation={0} sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack spacing={1}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          placeholder='Paste a narrative to chart, or ask — e.g. "add diagnosis sinusitis"'
          value={refineText}
          onChange={(e) => setRefineText(e.target.value)}
          inputRef={refineInputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              trySend();
            }
          }}
        />
        {queuedText !== null && (
          <Typography variant="body2" color="text.secondary">
            Queued — will send when the current step finishes (a new Send replaces it): &ldquo;
            {queuedText.length > 80 ? `${queuedText.slice(0, 77)}…` : queuedText}&rdquo;
          </Typography>
        )}
        {/* The review runs automatically when the AI charts a note (it exists to catch the AI's own
            mistakes); there is no manual "Review note" button — a provider hand-editing the note is
            applying their own judgment and doesn't need the AI to re-review it. */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Button
            variant="contained"
            sx={{ borderRadius: 100, textTransform: 'none' }}
            onClick={trySend}
            disabled={!refineText.trim()}
          >
            {isThinking ? <CircularProgress size={18} color="inherit" /> : 'Send'}
          </Button>
        </Stack>
        {/* TEMPORARY: per-session LLM token tally (debug) */}
        {tokenTally.calls > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4 }}
            >
              🔢 Claude {tokenTally.claudeIn.toLocaleString()} in ({tokenTally.claudeCacheRead.toLocaleString()} cached,{' '}
              {tokenTally.claudeCacheWrite.toLocaleString()} wrote) / {tokenTally.claudeOut.toLocaleString()} out ·
              Gemini {tokenTally.geminiIn.toLocaleString()} in / {tokenTally.geminiOut.toLocaleString()} out ·{' '}
              {tokenTally.calls} calls
            </Typography>
            <Button
              size="small"
              variant="text"
              sx={{ minWidth: 0, fontSize: 11, textTransform: 'none' }}
              onClick={() =>
                setTokenTally({
                  calls: 0,
                  claudeIn: 0,
                  claudeOut: 0,
                  claudeCacheRead: 0,
                  claudeCacheWrite: 0,
                  geminiIn: 0,
                  geminiOut: 0,
                  geminiThinking: 0,
                })
              }
            >
              reset
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );

  // Status icon for a given step index in the currently-running plan. Reads from plan.results
  // (which holds outcomes of completed steps, in order) and plan.currentIdx (the active step).
  const planStepStatusIcon = (idx: number): string => {
    if (!plan) return '·';
    if (idx < plan.results.length) {
      const r = plan.results[idx];
      if (r.status === 'done') return '✓';
      if (r.status === 'skipped') return '⏭';
      return '✗';
    }
    if (idx === plan.currentIdx) return '▶';
    return '·';
  };

  const planProgress = plan && (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          {/* Spinner while a step is actively running; hidden when paused awaiting a picker choice. */}
          {(!conv || !conv.kind.startsWith('choose')) && <CircularProgress size={12} />}
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {!conv || !conv.kind.startsWith('choose') ? 'Charting…' : 'Plan'} — step {plan.currentIdx + 1} of{' '}
            {plan.steps.length}
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="text"
          sx={{ textTransform: 'none', minWidth: 0 }}
          onClick={() => {
            setPlan(null);
            setConv({ kind: 'unknown', user: plan.narrative, reply: 'Plan cancelled.' });
          }}
        >
          Cancel plan
        </Button>
      </Stack>
      {/* Full step list with status icons — surfaces what was already done so the provider
          can interpret a mid-plan picker in context. */}
      <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
        {plan.steps.map((step, i) => {
          const isCurrent = i === plan.currentIdx;
          const isDone = i < plan.results.length;
          const color = isCurrent ? 'text.primary' : isDone ? 'text.secondary' : 'text.disabled';
          return (
            <Typography
              key={i}
              variant="body2"
              sx={{
                display: 'block',
                color,
                fontWeight: isCurrent ? 600 : 400,
                fontFamily: 'monospace',
                lineHeight: 1.5,
              }}
            >
              {planStepStatusIcon(i)} {i + 1}. {describePlanStep(step)}
            </Typography>
          );
        })}
      </Box>
    </Paper>
  );

  // Skip + Refine controls rendered at the bottom of every picker. Skip terminates the picker
  // with status="skipped" (visible as ⏭ in the running plan). Refine appends free-text to
  // the intent and re-dispatches to narrow the matches. Intent can be any kind that carries
  // a display/searchTerms — update-procedure / code-only intents don't (Refine is a no-op).
  const renderPickerActions = (
    intent:
      | EasyChartAgentIntent
      | RemoveIntent
      | ApplyTemplateIntent
      | AddProcedureIntent
      | UpdateProcedureIntent
      | AddExamFindingIntent
      | RemoveExamFindingIntent
  ): JSX.Element => {
    const refinable = 'display' in intent;
    return (
      <Stack direction="column" spacing={0.5} sx={{ mt: 1, mb: 1 }}>
        {refinable && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              fullWidth
              placeholder="Search again (e.g. 'lac repair', 'short leg', 'left ear')"
              value={pickerRefineText}
              onChange={(e) => setPickerRefineText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pickerRefineText.trim()) {
                  e.preventDefault();
                  handleRefinePicker(intent, pickerRefineText);
                }
              }}
              inputProps={{ style: { fontSize: 14 } }}
            />
            <Button
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', minWidth: 0 }}
              disabled={!pickerRefineText.trim()}
              onClick={() => handleRefinePicker(intent, pickerRefineText)}
            >
              Refine
            </Button>
          </Stack>
        )}
        {plan && (
          <Button
            size="small"
            variant="text"
            sx={{ textTransform: 'none', alignSelf: 'flex-start', minWidth: 0 }}
            onClick={handleSkipPicker}
          >
            Skip this step
          </Button>
        )}
      </Stack>
    );
  };

  // Short, concrete description of what accepting a suggestion will do — so a card like "Add the
  // pertinent negatives you noted?" lists exactly which items it will add.
  // Inline "Reviewing…" indicator while the post-chart review runs (its suggestions land directly in
  // the note, so there are no cards here). Index of the first thread message NEWER than the anchor so
  // the indicator sits inline at the point review started.
  const firstNewerIdx = reviewAnchorId === null ? -1 : thread.findIndex((m) => m.id > reviewAnchorId);
  // Review-proposed rewrites of already-written note fields — never auto-applied (a wrong
  // "reconciliation" would overwrite correct provider prose). One card per proposal.
  const NOTE_FIELD_LABELS: Record<string, string> = EASY_CHART_NOTE_TEXT_FIELD_LABELS;
  const noteEditCards = pendingNoteEdits.length > 0 && (
    <Stack spacing={1}>
      {pendingNoteEdits.map((edit) => (
        <Paper
          key={edit.id}
          variant="outlined"
          sx={{ p: 1.75, width: '100%', borderRadius: '14px 14px 14px 4px', borderColor: 'rgba(237,108,2,0.5)' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark' }}>
            Proposed edit — {NOTE_FIELD_LABELS[edit.field] ?? edit.field}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {edit.note}
          </Typography>
          <Typography
            variant="body1"
            sx={{ mt: 0.75, p: 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1, whiteSpace: 'pre-wrap' }}
          >
            {edit.newText.length > 400 ? `${edit.newText.slice(0, 397)}…` : edit.newText}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" variant="contained" onClick={() => void applyPendingNoteEdit(edit.id)}>
              Apply edit
            </Button>
            <Button size="small" onClick={() => dismissPendingNoteEdit(edit.id)}>
              Dismiss
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  const reviewPane = (reviewLoading || reviewError) && (
    <Box sx={{ display: 'flex' }}>
      <Paper variant="outlined" sx={{ p: 1.75, width: '100%', borderRadius: '14px 14px 14px 4px' }}>
        {reviewLoading ? (
          <WorkingStatus
            elapsed={reviewElapsed}
            text={escalatedStatus(
              reviewElapsed,
              'Reviewing the note and adding suggestions…',
              'Still reviewing — the model is responding slowly right now…',
              'The primary review model is slow or unavailable — retrying, then a backup model takes over. This can take another minute or two.'
            )}
          />
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body1" color="error">
              Couldn&apos;t review the note.
            </Typography>
            <Button size="small" onClick={() => void runReview()}>
              Retry review
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );

  // A picker conv is one awaiting the provider's choice (disambiguation). During a running plan we
  // only surface the live conv for pickers — the evolving plan card already shows step progress —
  // while a single-shot turn (no plan) shows its live conv until it settles into history.
  const isPickerConv = (k: ConvStep['kind']): boolean => k.startsWith('choose');
  const showLiveConv = !!conv && committedConv !== conv && (!plan || isPickerConv(conv.kind));

  // The live (in-progress) assistant turn — "thinking", a picker, or a per-action result. The user's
  // message is now its own thread bubble and the settled summary is folded into history, so this is
  // rendered only while the turn is active and uncommitted (gated by showLiveConv in the layout).
  const conversationCard = conv && (
    <Box sx={{ display: 'flex' }}>
      <Paper variant="outlined" sx={{ p: 1.75, width: '100%', borderRadius: '14px 14px 14px 4px' }}>
        {conv.kind === 'thinking' && (
          <WorkingStatus
            sx={{ mt: 0.5 }}
            elapsed={thinkingElapsed}
            text={escalatedStatus(
              thinkingElapsed,
              'Thinking…',
              'Still working — the model is responding slowly right now…',
              'The primary model is slow or unavailable — retrying, then a backup model takes over. This can take another minute or two.'
            )}
          />
        )}
        {conv.kind === 'unknown' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            {conv.reply}
          </Typography>
        )}
        {conv.kind === 'no-match' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            No matches found for &ldquo;{conv.intent.display}&rdquo;. Try a different phrasing.
          </Typography>
        )}
        {conv.kind === 'choose' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {conv.intent.kind === 'add-medication'
                ? 'Pick the medication — type to search the full catalog:'
                : `I found ${conv.results.length} matches for “${conv.intent.display}”. Which one?`}
            </Typography>
            {(() => {
              // Strength-mismatch warning: when the provider asked for a specific medication
              // strength (e.g. "400 mg/5 mL") that doesn't appear in ANY catalog result, surface
              // the gap so they don't silently pick a different concentration. Checks the requested
              // strength against each result's name+strength fields after normalization.
              if (conv.intent.kind !== 'add-medication' || !conv.intent.strength) return null;
              const want = conv.intent.strength.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
              const present = conv.results.some((r) => {
                const haystack = `${r.name} ${r.strength ?? ''}`.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
                return haystack.includes(want);
              });
              if (present) return null;
              return (
                <Typography variant="body2" sx={{ display: 'block', mt: 0.5, color: 'warning.dark', fontWeight: 600 }}>
                  ⚠ Requested strength <strong>{conv.intent.strength}</strong> is not in the formulary — these are the
                  closest available options.
                </Typography>
              );
            })()}
            {renderPickerActions(conv.intent)}
            {conv.intent.kind === 'add-medication' ? (
              <MedicationSearchPicker
                seedTerm={conv.intent.display}
                initialResults={conv.results}
                onPick={(r) => void handlePick(conv.intent, r, conv.user)}
              />
            ) : (
              <List dense sx={{ mt: 0.5 }}>
                {conv.results.map((r, i) => (
                  <ListItemButton
                    key={`${r.code ?? r.id ?? i}`}
                    onClick={() => void handlePick(conv.intent, r, conv.user)}
                  >
                    <ListItemText
                      primary={r.name + (r.strength ? ` — ${r.strength}` : '')}
                      secondary={r.code}
                      primaryTypographyProps={{ variant: 'body1' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </>
        )}
        {conv.kind === 'saving' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body1" color="text.secondary">
              Adding {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'done' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            Added <strong>{conv.chosenName}</strong> to the chart.
          </Typography>
        )}
        {conv.kind === 'no-match-remove' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find &ldquo;{conv.intent.display}&rdquo; in the chart.
          </Typography>
        )}
        {conv.kind === 'choose-remove' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} matches for &ldquo;{conv.intent.display}&rdquo;. Which one to remove?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => (
                <ListItemButton key={m.resourceId} onClick={() => void handleRemovePick(m, conv.user)}>
                  <ListItemText primary={m.displayName} primaryTypographyProps={{ variant: 'body1' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'removing' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body1" color="text.secondary">
              Removing {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'removed' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            Removed <strong>{conv.chosenName}</strong> from the chart.
          </Typography>
        )}
        {conv.kind === 'no-match-template' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find a template matching &ldquo;{conv.intent.display}&rdquo;.
          </Typography>
        )}
        {conv.kind === 'choose-template' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} templates matching &ldquo;{conv.intent.display}&rdquo;. Which one to apply?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => (
                <ListItemButton key={m.id} onClick={() => void handleApplyTemplate(m, conv.user)}>
                  <ListItemText primary={m.title} primaryTypographyProps={{ variant: 'body1' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'applying-template' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body1" color="text.secondary">
              Applying {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'applied-template' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            Applied template <strong>{conv.chosenName}</strong>.
          </Typography>
        )}
        {conv.kind === 'no-match-procedure' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find a procedure matching &ldquo;{conv.intent.display}&rdquo; in this practice&rsquo;s
            quick picks.
          </Typography>
        )}
        {conv.kind === 'choose-procedure' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} procedures matching &ldquo;{conv.intent.display}&rdquo;. Which one to add?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => (
                <ListItemButton key={m.id ?? m.name} onClick={() => void handleProcedurePick(m, conv.user)}>
                  <ListItemText primary={m.name} primaryTypographyProps={{ variant: 'body1' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'choose-lab' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              There are {conv.candidates.length} {conv.labKind === 'in-house' ? 'in-house' : 'send-out'} tests matching
              &ldquo;{conv.display}&rdquo;. Which one to order?
            </Typography>
            <List dense sx={{ mt: 0.5 }}>
              {conv.candidates.map((c, i) => (
                <ListItemButton key={`${c.label}-${i}`} onClick={() => handleLabPick(conv, c)}>
                  <ListItemText primary={c.label} primaryTypographyProps={{ variant: 'body1' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'no-procedure-to-update' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            There&rsquo;s no procedure on this chart yet to update. Try &ldquo;add lac repair procedure&rdquo; first.
          </Typography>
        )}
        {conv.kind === 'choose-procedure-to-update' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              There are {conv.candidates.length} procedures on this chart. Which one to update?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.candidates.map((p, i) => {
                const label = p.procedureType ?? p.cptCodes?.[0]?.display ?? `Procedure ${i + 1}`;
                return (
                  <ListItemButton
                    key={p.resourceId ?? i}
                    onClick={() => void handleProcedureUpdate(p, conv.intent, conv.user)}
                  >
                    <ListItemText primary={label} primaryTypographyProps={{ variant: 'body1' }} />
                  </ListItemButton>
                );
              })}
            </List>
          </>
        )}
        {conv.kind === 'updating-procedure' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body1" color="text.secondary">
              Updating {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'updated-procedure' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            Updated <strong>{conv.chosenName}</strong>: {conv.summary}
          </Typography>
        )}
        {conv.kind === 'editing-note-text' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body1" color="text.secondary">
              Updating {conv.fieldLabel}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'edited-note-text' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            Updated <strong>{conv.fieldLabel}</strong>.
          </Typography>
        )}
        {conv.kind === 'no-match-exam' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find an exam finding matching &ldquo;{conv.intent.display}&rdquo;.
          </Typography>
        )}
        {conv.kind === 'choose-exam' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} exam findings matching &ldquo;{conv.intent.display}&rdquo;. Select the ones
              that apply (you can choose more than one):
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => {
                const key = leafKey(m);
                const checked = examPickSelected.has(key);
                return (
                  <ListItemButton
                    key={key}
                    dense
                    onClick={() =>
                      setExamPickSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                      <Checkbox edge="start" size="small" checked={checked} tabIndex={-1} disableRipple sx={{ p: 0 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={m.label}
                      secondary={`${m.section} · ${m.normalAbnormal}`}
                      primaryTypographyProps={{ variant: 'body1' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
            <Button
              size="small"
              variant="contained"
              sx={{ textTransform: 'none', mt: 0.5 }}
              disabled={examPickSelected.size === 0}
              onClick={() => {
                const chosen = conv.matches.filter((m) => examPickSelected.has(leafKey(m)));
                void handleExamPickMulti(chosen, conv.user);
              }}
            >
              {examPickSelected.size > 1 ? `Add ${examPickSelected.size} findings` : 'Add finding'}
            </Button>
          </>
        )}
        {conv.kind === 'no-match-exam-remove' && (
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find anything in the exam matching &ldquo;{conv.intent.display}&rdquo;.
          </Typography>
        )}
        {conv.kind === 'choose-exam-remove' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} exam findings matching &ldquo;{conv.intent.display}&rdquo;. Which one to
              remove?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m, i) => (
                <ListItemButton
                  key={`${m.resourceId}-${m.componentCode ?? 'obs'}-${i}`}
                  onClick={() => void handleExamRemove(m, conv.user)}
                >
                  <ListItemText
                    primary={m.displayName}
                    secondary={m.section}
                    primaryTypographyProps={{ variant: 'body1' }}
                    secondaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'choose-ros-remove' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} Review of Systems findings matching &ldquo;{conv.display}&rdquo;. Which one
              to remove?
            </Typography>
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m, i) => (
                <ListItemButton key={`${m.obs.resourceId}-${i}`} onClick={() => void handleRosRemove(m.obs, conv.user)}>
                  <ListItemText primary={m.label} primaryTypographyProps={{ variant: 'body1' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'skipped' && (
          <Typography variant="body1" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {conv.reason ? `Skipped — ${conv.reason}` : 'Skipped.'}
          </Typography>
        )}
        {conv.kind === 'choose-ros' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              A few Review of Systems options match &ldquo;{conv.intent.display}&rdquo;. Which did you mean?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m, i) => (
                <ListItemButton
                  key={`${m.baseKey}-${i}`}
                  onClick={() => {
                    void handleRosPick(m, conv.finding, conv.user);
                  }}
                >
                  <ListItemText
                    primary={`${conv.finding === 'denies' ? 'Denies' : 'Reports'} ${m.label}`}
                    secondary={m.system}
                    primaryTypographyProps={{ variant: 'body1' }}
                    secondaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'error' && (
          <Typography variant="body1" color="error" sx={{ mt: 0.5 }}>
            {conv.reply}
          </Typography>
        )}
        {conv.kind === 'plan-preview' && (
          <>
            <Typography variant="body1" sx={{ mt: 0.5, mb: 1 }}>
              Here&rsquo;s what I&rsquo;ll do ({conv.steps.length} step{conv.steps.length === 1 ? '' : 's'}):
            </Typography>
            <Box sx={{ maxHeight: 280, overflowY: 'auto', mb: 1 }}>
              {conv.steps.map((step, i) => (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{
                    display: 'block',
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                >
                  {i + 1}. {describePlanStep(step)}
                </Typography>
              ))}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                sx={{ textTransform: 'none' }}
                onClick={() => {
                  if (conv.kind !== 'plan-preview') return;
                  const { narrative, steps } = conv;
                  setPlan({ narrative, steps, currentIdx: 0, results: [] });
                }}
              >
                Approve &amp; run
              </Button>
              <Button
                size="small"
                variant="text"
                sx={{ textTransform: 'none' }}
                onClick={() => {
                  if (conv.kind !== 'plan-preview') return;
                  setConv({ kind: 'unknown', user: conv.user, reply: 'Plan cancelled before execution.' });
                }}
              >
                Cancel
              </Button>
            </Stack>
          </>
        )}
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box ref={rightColScrollRef} sx={{ flex: 1, overflowY: { md: 'auto' }, pr: { md: 1 }, minHeight: 0 }}>
        <Stack spacing={1.5} sx={{ py: 1 }}>
          {primeBanner}
          {thread.length === 0 && !conv && !plan && (
            <Box sx={{ display: 'flex' }}>
              <Paper variant="outlined" sx={{ p: 1.75, width: '100%', borderRadius: '14px 14px 14px 4px' }}>
                <Typography variant="body1" color="text.secondary">
                  Paste a dictation to chart the visit, or ask me to add or change anything — e.g.{' '}
                  <em>“add diagnosis sinusitis”</em>. I’ll chart as we go.
                </Typography>
              </Paper>
            </Box>
          )}
          {thread.map((m, i) => (
            <Fragment key={m.id}>
              {/* Suggestions sit inline at the point they were produced; later turns render below. */}
              {i === firstNewerIdx && reviewPane}
              <Box sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    maxWidth: '90%',
                    bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover',
                    color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </Typography>
                </Paper>
              </Box>
            </Fragment>
          ))}
          {planProgress}
          {showLiveConv && conversationCard}
          {/* Trailing render when nothing in the thread is newer than the anchor (incl. loading). */}
          {firstNewerIdx === -1 && reviewPane}
          {noteEditCards}
        </Stack>
      </Box>
      {chipsPortalEl ? createPortal(transcriptChips, chipsPortalEl) : transcriptChips}
      {transcriptPreview}
      {refineBar}
    </Box>
  );
}
