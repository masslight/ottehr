// The assistant column: the thread, the running plan, the composer, and the token tally.
//
// Design points that carried their weight and are reproduced deliberately:
//   - settled plan cards STAY in the thread, with per-step ✓ / ⏭ / ✗, so the provider can look back
//     at exactly what was done and why;
//   - the composer stays usable while the assistant works — typed messages queue and send when it
//     frees up;
//   - the elapsed counter appears only once a call runs long: a timer from t=0 makes every call feel
//     slow, and silent waiting is what makes an assistant feel broken;
//   - long pasted narratives collapse, or one paste drowns the thread.

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, useState } from 'react';
import { ModelUsage } from 'utils/lib/easy-chart/api';
import { PlanStep } from '../executor/types';
import { ChartAssistant } from '../hooks/useChartAssistant';

/** Longer than this and a pasted narrative collapses behind a "show more". */
const COLLAPSE_OVER_CHARS = 320;

const CollapsibleText: FC<{ text: string }> = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= COLLAPSE_OVER_CHARS) return <Typography variant="body2">{text}</Typography>;
  return (
    <Box>
      <Typography variant="body2">{expanded ? text : `${text.slice(0, COLLAPSE_OVER_CHARS)}…`}</Typography>
      <Button size="small" onClick={() => setExpanded(!expanded)} sx={{ px: 0 }}>
        {expanded ? 'show less' : `show more (${text.length} characters)`}
      </Button>
    </Box>
  );
};

const StepRow: FC<{ step: PlanStep; live?: boolean }> = ({ step, live }) => {
  const status = step.outcome?.status;
  const icon =
    status === 'applied' ? (
      <CheckIcon fontSize="small" color="success" />
    ) : status === 'skipped' ? (
      <SkipNextIcon fontSize="small" color="warning" />
    ) : status === 'failed' ? (
      <CloseIcon fontSize="small" color="error" />
    ) : live ? (
      <CircularProgress size={14} />
    ) : null;

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box sx={{ width: 20, display: 'flex', justifyContent: 'center', pt: 0.25 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: status ? 400 : 600 }}>
          {step.label}
        </Typography>
        {/* An outcome that is not `applied` always carries a reason, and the provider reads it here. */}
        {step.outcome?.reason && (
          <Typography variant="caption" color="text.secondary">
            {step.outcome.reason}
          </Typography>
        )}
        {step.outcome?.status === 'applied' && step.outcome.note && (
          <Typography variant="caption" color="text.secondary">
            {step.outcome.note}
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

const TokenTally: FC<{ usage: ModelUsage[]; onReset: () => void }> = ({ usage, onReset }) => {
  if (usage.length === 0) return null;
  const totalCalls = usage.reduce((sum, entry) => sum + entry.calls, 0);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
        🔢{' '}
        {usage
          .map(
            (entry) =>
              // The CACHED figure is the point: a cache read of zero across a session means the
              // static-prefix ordering broke and every call is being billed in full.
              `${entry.provider} ${entry.inputTokens.toLocaleString()} in ` +
              `(${entry.cacheReadTokens.toLocaleString()} cached, ${entry.cacheWriteTokens.toLocaleString()} wrote)` +
              ` / ${entry.outputTokens.toLocaleString()} out`
          )
          .join(' · ')}{' '}
        · {totalCalls} call{totalCalls === 1 ? '' : 's'}
      </Typography>
      <Button size="small" onClick={onReset} sx={{ minWidth: 0, px: 0.5 }}>
        reset
      </Button>
    </Stack>
  );
};

export interface AssistantColumnProps {
  assistant: ChartAssistant;
  readOnly?: boolean;
  readOnlyReason?: string;
}

export const AssistantColumn: FC<AssistantColumnProps> = ({ assistant, readOnly, readOnlyReason }) => {
  const [draft, setDraft] = useState('');
  const busy = assistant.status !== 'idle';

  const submit = (): void => {
    if (!draft.trim()) return;
    assistant.send(draft);
    setDraft('');
  };

  return (
    <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
      {readOnly && (
        <Alert severity="info">{readOnlyReason ?? 'This visit is signed — the assistant is read-only.'}</Alert>
      )}

      <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
        {assistant.thread.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Paste or dictate the visit narrative, or type a single request like “add diagnosis sinusitis”.
          </Typography>
        )}

        {assistant.thread.map((entry) => {
          if (entry.role === 'provider') {
            return (
              <Paper key={entry.id} variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <CollapsibleText text={entry.text} />
              </Paper>
            );
          }
          if (entry.kind === 'plan') {
            return (
              <Paper key={entry.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={0.75}>
                  {entry.steps.map((step) => (
                    <StepRow key={`${step.index}-${step.label}`} step={step} />
                  ))}
                </Stack>
              </Paper>
            );
          }
          if (entry.kind === 'review') {
            // The second look's findings. Rendered as QUESTIONS with their reasoning, never as applied
            // changes: each carries the actions that would answer it, and the provider decides.
            return (
              <Paper key={entry.id} variant="outlined" sx={{ p: 1.5, borderColor: 'warning.light' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  A second look at the note
                </Typography>
                <Stack spacing={1}>
                  {entry.suggestions.map((suggestion, index) => (
                    <Box key={`${entry.id}-${index}`}>
                      <Typography variant="body2" fontWeight={600}>
                        {suggestion.question}
                      </Typography>
                      {suggestion.rationale && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {suggestion.rationale}
                        </Typography>
                      )}
                      {suggestion.partial && suggestion.partialNote && (
                        <Typography variant="caption" color="warning.main" display="block">
                          {suggestion.partialNote}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Paper>
            );
          }
          if (entry.kind === 'error') {
            return (
              <Alert key={entry.id} severity="error">
                {entry.text}
              </Alert>
            );
          }
          return (
            <Alert key={entry.id} severity={entry.kind === 'provider-note' ? 'warning' : 'info'}>
              {entry.text}
            </Alert>
          );
        })}

        {busy && (
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: assistant.liveSteps.length ? 1 : 0 }}>
              <CircularProgress size={16} />
              <Typography variant="body2">
                {assistant.status === 'reviewing'
                  ? 'Reviewing the note and adding suggestions…'
                  : assistant.status === 'planning'
                  ? 'Reading the narrative and building a plan…'
                  : `Charting — step ${assistant.liveSteps.filter((s) => s.outcome).length + 1} of ${
                      assistant.liveSteps.length || '?'
                    }`}
              </Typography>
              {assistant.elapsedSeconds != null && (
                <Typography variant="caption" color="text.secondary">
                  ⏳ {Math.floor(assistant.elapsedSeconds / 60)}:
                  {String(assistant.elapsedSeconds % 60).padStart(2, '0')}
                </Typography>
              )}
            </Stack>
            <Stack spacing={0.75}>
              {assistant.liveSteps.map((step) => (
                <StepRow key={`${step.index}-${step.label}`} step={step} live />
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>

      {assistant.queued.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
          {assistant.queued.map((message, index) => (
            <Tooltip key={index} title={message}>
              <Chip size="small" label={`queued: ${message.slice(0, 24)}…`} />
            </Tooltip>
          ))}
        </Stack>
      )}

      <Stack spacing={0.5}>
        <TextField
          multiline
          minRows={3}
          maxRows={10}
          fullWidth
          size="small"
          value={draft}
          disabled={readOnly}
          placeholder={readOnly ? 'This visit is signed.' : 'Dictate, paste, or ask…'}
          data-testid="easy-chart-composer"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. The palette's own shortcut must not be swallowed
            // while focus is here, so nothing else is intercepted.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {busy ? 'Typing is fine — messages queue and send when the assistant frees up.' : 'Enter to send'}
          </Typography>
          <Button
            variant="contained"
            size="small"
            endIcon={<SendIcon />}
            onClick={submit}
            disabled={readOnly || !draft.trim()}
            data-testid="easy-chart-send"
          >
            Send
          </Button>
        </Stack>
        <TokenTally usage={assistant.usage} onReset={assistant.resetUsage} />
      </Stack>

      {/* Ambiguity asks rather than guessing — for an interactively typed request, and always for a
          removal. Skipping is a first-class answer: it settles the step with a reason. */}
      <Dialog open={Boolean(assistant.pendingPick)} onClose={() => assistant.answerPick(undefined)} fullWidth>
        <DialogTitle>{assistant.pendingPick?.prompt}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            You said “{assistant.pendingPick?.query}”.
          </Typography>
          <List dense>
            {assistant.pendingPick?.options.map((option) => (
              <ListItemButton key={option.id} onClick={() => assistant.answerPick(option)}>
                <ListItemText primary={option.display} />
              </ListItemButton>
            ))}
            <ListItemButton onClick={() => assistant.answerPick(undefined)}>
              <ListItemText primary="Skip — none of these" primaryTypographyProps={{ color: 'text.secondary' }} />
            </ListItemButton>
          </List>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};
