import { TextField } from '@mui/material';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

interface InlineNoteFieldProps {
  /** Human label for the field; used as the empty-state placeholder and aria-label. */
  label: string;
  /** Current text from chart-data — the source of truth when the field is not being edited. */
  value: string;
  /** Persist the new text. Debounced; also fired on blur and unmount. */
  onSave: (text: string) => void | Promise<void>;
  placeholder?: string;
  minRows?: number;
}

const DEBOUNCE_MS = 500;

/**
 * Always-on editable text area for an Easy Chart free-text note field (CC, HPI, MOI, ROS, MDM).
 *
 * The Easy Chart left pane and the right-pane AI planner both edit the same chart-data fields, so
 * the incoming `value` can change underneath the user (e.g. a planner step rewrites the MDM). We
 * reconcile that into the local draft ONLY while the user is neither focused nor mid-edit, so an
 * assistant update lands when the box is idle but never clobbers text the clinician is typing.
 */
export default function InlineNoteField({
  label,
  value,
  onSave,
  placeholder,
  minRows = 2,
}: InlineNoteFieldProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  return (
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
      sx={{ mt: 0.5, '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
    />
  );
}
