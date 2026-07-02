import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Fragment, useEffect, useRef } from 'react';
import { EASY_CHART_NOTE_TEXT_FIELD_LABELS, EasyChartAgentIntent } from 'utils';
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
import { useChartAssistant } from './useChartAssistant';

export type ChartAssistant = ReturnType<typeof useChartAssistant>;

// The right column of the easy-chart page: the unified chat thread (history + the live in-progress
// turn with all its disambiguation pickers), the running-plan card, the review indicator, and the
// composer pinned at the bottom. Purely presentational over the assistant hook's state/handlers —
// all behavior lives in useChartAssistant.
export function AssistantColumn({ assistant }: { assistant: ChartAssistant }): JSX.Element {
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
    handleSend,
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
  // typing the next request without manually clicking the input. We trigger off the !isThinking
  // edge — the TextField is `disabled` while thinking, so refocusing must wait for re-enable.
  useEffect(() => {
    if (!isThinking) {
      requestAnimationFrame(() => refineInputRef.current?.focus());
    }
  }, [isThinking]);

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
              void handleSend();
            }
          }}
          disabled={isThinking}
        />
        {/* The review runs automatically when the AI charts a note (it exists to catch the AI's own
            mistakes); there is no manual "Review note" button — a provider hand-editing the note is
            applying their own judgment and doesn't need the AI to re-review it. */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Button
            variant="contained"
            sx={{ borderRadius: 100, textTransform: 'none' }}
            onClick={() => void handleSend()}
            disabled={!refineText.trim() || isThinking}
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
              sx={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4 }}
            >
              🔢 Claude {tokenTally.claudeIn.toLocaleString()} in ({tokenTally.claudeCacheRead.toLocaleString()} cached,{' '}
              {tokenTally.claudeCacheWrite.toLocaleString()} wrote) / {tokenTally.claudeOut.toLocaleString()} out ·
              Gemini {tokenTally.geminiIn.toLocaleString()} in / {tokenTally.geminiOut.toLocaleString()} out ·{' '}
              {tokenTally.calls} calls
            </Typography>
            <Button
              size="small"
              variant="text"
              sx={{ minWidth: 0, fontSize: 10, textTransform: 'none' }}
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
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
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
              variant="caption"
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
              inputProps={{ style: { fontSize: 13 } }}
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
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.dark' }}>
            Proposed edit — {NOTE_FIELD_LABELS[edit.field] ?? edit.field}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {edit.note}
          </Typography>
          <Typography
            variant="body2"
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
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Reviewing the note and adding suggestions…
            </Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="error">
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Thinking…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'unknown' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {conv.reply}
          </Typography>
        )}
        {conv.kind === 'no-match' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            No matches found for &ldquo;{conv.intent.display}&rdquo;. Try a different phrasing.
          </Typography>
        )}
        {conv.kind === 'choose' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, color: 'warning.dark', fontWeight: 600 }}
                >
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
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
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
            <Typography variant="body2" color="text.secondary">
              Adding {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'done' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Added <strong>{conv.chosenName}</strong> to the chart.
          </Typography>
        )}
        {conv.kind === 'no-match-remove' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find &ldquo;{conv.intent.display}&rdquo; in the chart.
          </Typography>
        )}
        {conv.kind === 'choose-remove' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} matches for &ldquo;{conv.intent.display}&rdquo;. Which one to remove?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => (
                <ListItemButton key={m.resourceId} onClick={() => void handleRemovePick(m, conv.user)}>
                  <ListItemText primary={m.displayName} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'removing' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Removing {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'removed' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Removed <strong>{conv.chosenName}</strong> from the chart.
          </Typography>
        )}
        {conv.kind === 'no-match-template' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find a template matching &ldquo;{conv.intent.display}&rdquo;.
          </Typography>
        )}
        {conv.kind === 'choose-template' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} templates matching &ldquo;{conv.intent.display}&rdquo;. Which one to apply?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => (
                <ListItemButton key={m.id} onClick={() => void handleApplyTemplate(m, conv.user)}>
                  <ListItemText primary={m.title} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'applying-template' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Applying {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'applied-template' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Applied template <strong>{conv.chosenName}</strong>.
          </Typography>
        )}
        {conv.kind === 'no-match-procedure' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find a procedure matching &ldquo;{conv.intent.display}&rdquo; in this practice&rsquo;s
            quick picks.
          </Typography>
        )}
        {conv.kind === 'choose-procedure' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} procedures matching &ldquo;{conv.intent.display}&rdquo;. Which one to add?
            </Typography>
            {renderPickerActions(conv.intent)}
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m) => (
                <ListItemButton key={m.id ?? m.name} onClick={() => void handleProcedurePick(m, conv.user)}>
                  <ListItemText primary={m.name} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'choose-lab' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              There are {conv.candidates.length} {conv.labKind === 'in-house' ? 'in-house' : 'send-out'} tests matching
              &ldquo;{conv.display}&rdquo;. Which one to order?
            </Typography>
            <List dense sx={{ mt: 0.5 }}>
              {conv.candidates.map((c, i) => (
                <ListItemButton key={`${c.label}-${i}`} onClick={() => handleLabPick(conv, c)}>
                  <ListItemText primary={c.label} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'no-procedure-to-update' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            There&rsquo;s no procedure on this chart yet to update. Try &ldquo;add lac repair procedure&rdquo; first.
          </Typography>
        )}
        {conv.kind === 'choose-procedure-to-update' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                    <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2' }} />
                  </ListItemButton>
                );
              })}
            </List>
          </>
        )}
        {conv.kind === 'updating-procedure' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Updating {conv.chosenName}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'updated-procedure' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Updated <strong>{conv.chosenName}</strong>: {conv.summary}
          </Typography>
        )}
        {conv.kind === 'editing-note-text' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Updating {conv.fieldLabel}…
            </Typography>
          </Stack>
        )}
        {conv.kind === 'edited-note-text' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Updated <strong>{conv.fieldLabel}</strong>.
          </Typography>
        )}
        {conv.kind === 'no-match-exam' && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find an exam finding matching &ldquo;{conv.intent.display}&rdquo;.
          </Typography>
        )}
        {conv.kind === 'choose-exam' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
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
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            I couldn&rsquo;t find anything in the exam matching &ldquo;{conv.intent.display}&rdquo;.
          </Typography>
        )}
        {conv.kind === 'choose-exam-remove' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'choose-ros-remove' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              I found {conv.matches.length} Review of Systems findings matching &ldquo;{conv.display}&rdquo;. Which one
              to remove?
            </Typography>
            <List dense sx={{ mt: 0.5 }}>
              {conv.matches.map((m, i) => (
                <ListItemButton key={`${m.obs.resourceId}-${i}`} onClick={() => void handleRosRemove(m.obs, conv.user)}>
                  <ListItemText primary={m.label} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'skipped' && (
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {conv.reason ? `Skipped — ${conv.reason}` : 'Skipped.'}
          </Typography>
        )}
        {conv.kind === 'choose-ros' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
        {conv.kind === 'error' && (
          <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
            {conv.reply}
          </Typography>
        )}
        {conv.kind === 'plan-preview' && (
          <>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
              Here&rsquo;s what I&rsquo;ll do ({conv.steps.length} step{conv.steps.length === 1 ? '' : 's'}):
            </Typography>
            <Box sx={{ maxHeight: 280, overflowY: 'auto', mb: 1 }}>
              {conv.steps.map((step, i) => (
                <Typography
                  key={i}
                  variant="caption"
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
          {thread.length === 0 && !conv && !plan && (
            <Box sx={{ display: 'flex' }}>
              <Paper variant="outlined" sx={{ p: 1.75, width: '100%', borderRadius: '14px 14px 14px 4px' }}>
                <Typography variant="body2" color="text.secondary">
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
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
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
      {refineBar}
    </Box>
  );
}
