import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, Divider, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react';

interface InlineNoteFieldProps {
  /** Human label for the field; used as the empty-state placeholder and aria-label. */
  label: string;
  /** Current text from chart-data — the source of truth when the field is not being edited. */
  value: string;
  /** Persist the new text. Debounced; also fired on blur and unmount. */
  onSave: (text: string) => void | Promise<void>;
  placeholder?: string;
  minRows?: number;
  /** The dictation snippet this field was generated from, shown for side-by-side comparison. */
  sourceText?: string;
  /** True when the AI rewrite is likely to have drifted from the dictation (amber highlight). */
  needsReview?: boolean;
  /** Why it was flagged — shown in the review popover. */
  reviewNote?: string;
  /** Clear the needs-review flag (the provider has checked the text against the source). */
  onConfirm?: () => void;
}

const DEBOUNCE_MS = 500;

/**
 * Always-on editable text area for an Easy Chart free-text note field (CC, HPI, MOI, ROS, MDM).
 *
 * The Easy Chart left pane and the right-pane AI planner both edit the same chart-data fields, so
 * the incoming `value` can change underneath the user (e.g. a planner step rewrites the MDM). We
 * reconcile that into the local draft ONLY while the user is neither focused nor mid-edit, so an
 * assistant update lands when the box is idle but never clobbers text the clinician is typing.
 *
 * Because these fields are AI-generated PROSE (not a discrete charted item), they can quietly drift
 * from what the provider dictated. When `sourceText` is supplied the provider can pop open the
 * original dictation to compare; when `needsReview` is set (a likely mismatch) the field is
 * highlighted amber until the provider confirms it.
 */
export default function InlineNoteField({
  label,
  value,
  onSave,
  placeholder,
  minRows = 2,
  sourceText,
  needsReview = false,
  reviewNote,
  onConfirm,
}: InlineNoteFieldProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // Keep the latest onSave without re-running effects/timers that close over a stale copy.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Reconcile an external (planner) change into the draft only when the field is idle.
  useEffect(() => {
    if (!focusedRef.current && !dirtyRef.current && value !== draftRef.current) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value]);

  const flushPending = (): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current) {
      dirtyRef.current = false;
      void onSaveRef.current(draftRef.current);
    }
  };

  // Flush a pending edit if the component unmounts (e.g. navigation) before the debounce fires.
  useEffect(() => {
    return () => flushPending();
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const next = event.target.value;
    draftRef.current = next;
    dirtyRef.current = true;
    setDraft(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        void onSaveRef.current(draftRef.current);
      }
    }, DEBOUNCE_MS);
  };

  const openPopover = (e: MouseEvent<HTMLElement>): void => setAnchorEl(e.currentTarget);
  const closePopover = (): void => setAnchorEl(null);
  const confirm = (): void => {
    closePopover();
    onConfirm?.();
  };
  const hasProvenance = needsReview || !!sourceText;

  return (
    <Box sx={{ position: 'relative' }}>
      {hasProvenance && (
        <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
          <Tooltip title={needsReview ? reviewNote || 'Review against your dictation' : 'Compare to dictation'}>
            <IconButton
              size="small"
              onClick={openPopover}
              sx={{ color: needsReview ? 'warning.main' : 'text.disabled', p: 0.25 }}
            >
              {needsReview ? (
                <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
              ) : (
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <TextField
        value={draft}
        onChange={handleChange}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          flushPending();
        }}
        placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
        inputProps={{ 'aria-label': label }}
        multiline
        minRows={minRows}
        fullWidth
        size="small"
        variant="outlined"
        sx={{
          mt: 0.5,
          '& .MuiInputBase-input': { fontSize: '0.875rem' },
          ...(needsReview && {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main', borderWidth: 1.5 },
            bgcolor: 'rgba(237,108,2,0.05)',
          }),
        }}
      />
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={closePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 360 }}>
          {needsReview && reviewNote && (
            <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 600, mb: sourceText ? 1 : 0 }}>
              {reviewNote}
            </Typography>
          )}
          {sourceText && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                From your dictation:
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.25, fontStyle: 'italic', color: 'text.secondary', whiteSpace: 'pre-wrap' }}
              >
                “{sourceText}”
              </Typography>
            </>
          )}
          {needsReview && onConfirm && (
            <>
              <Divider sx={{ my: 1 }} />
              <Button size="small" variant="contained" startIcon={<CheckRoundedIcon />} onClick={confirm}>
                Looks right
              </Button>
            </>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
