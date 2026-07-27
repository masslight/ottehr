import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { captureException } from '@sentry/react';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';

/** One alternative offered when correcting an item. `key` round-trips back to the caller. */
export interface AiAlternative {
  key: string;
  label: string;
  /** Secondary line (e.g. a medication's strength). */
  secondary?: string;
}

interface AiChartedItemProps {
  /** The rendered item label (the same content a normal note row would show). */
  children: React.ReactNode;
  /** True when the assistant charted this item and it still needs the provider's review → blue tint.
   * False for provider-entered / already-reviewed items: still editable, but no review highlight. */
  needsReview?: boolean;
  /** Auto-picked but ambiguous → flagged for extra attention. */
  lowConfidence?: boolean;
  /** Planner produced this WITHOUT a phrase from the dictation to back it (default-normal exam,
   * template default, deduced code) — the items most worth verifying. Renders an "inferred" badge. */
  inferred?: boolean;
  /** The verbatim dictation phrase this item was charted from, shown on hover. Empty/undefined when
   * inferred or provider-entered. */
  sourceText?: string;
  /** Reasoning when this item was added by the post-chart REVIEW pass (not the original dictation).
   * Shown on hover + a "· review" tag, so the provider reviews the suggestion in place. */
  reviewNote?: string;
  /** A caution the provider must weigh before confirming — e.g. the dictation called this
   * diagnosis SUSPECTED / pending confirmation. Prepended to the hover. */
  caution?: string;
  /** Name of the chart template this item came from (a default for that presentation, not the
   * dictation), shown on hover so the provider verifies it fits this visit. */
  templateName?: string;
  /** Accept the item as-is (provider reviewed it) → clears the needs-review highlight. Shown as a ✓
   * only while the item needs review. */
  onConfirm?: () => void;
  /** Seed query for the alternatives search (usually the item's display text). */
  initialQuery: string;
  onSearch: (query: string) => Promise<AiAlternative[]>;
  /** Replace the item with the chosen alternative; the checkboxOption state (if any) carries over. */
  onReplace: (key: string, checkboxChecked?: boolean) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onDiscuss: () => void;
  /** Hide the "Discuss" action (code-based items have no right-panel picker). */
  hideDiscuss?: boolean;
  // An optional checkbox shown while editing (e.g. medications' "Patient doesn't know dosage", or ROS
  // "Patient denies"). Toggling it updates the CURRENT item in place via onChange; its state is also
  // passed to onReplace so a chosen replacement inherits it.
  checkboxOption?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
  // FREE-TEXT rows (exam section notes): clicking edits the text itself in a multiline field
  // instead of opening the search-and-replace picker. `value` is the raw stored text; `label`
  // captions the editor so it's obvious WHAT is being edited ("Extremities — exam note").
  editText?: { value: string; label: string; onSave: (newText: string) => void | Promise<void> };
}

/**
 * An editable note item. Clicking it turns the row into an in-place autocomplete: type to search for
 * a replacement (diagnosis code, drug, exam finding, …) and pick one, toggle the per-item option, or
 * remove it — all without leaving the note. Items the assistant charted and that still need review
 * carry a blue (or amber, if low-confidence) tint; provider-entered / reviewed items are untinted but
 * just as editable. Reuses the page's search/replace/remove plumbing via callbacks.
 */
export function AiChartedItem({
  children,
  needsReview,
  lowConfidence,
  inferred,
  sourceText,
  reviewNote,
  caution,
  templateName,
  onConfirm,
  initialQuery,
  onSearch,
  onReplace,
  onRemove,
  onDiscuss,
  hideDiscuss,
  checkboxOption,
  editText,
}: AiChartedItemProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [options, setOptions] = useState<AiAlternative[]>([]);
  const [loading, setLoading] = useState(false);
  const [optChecked, setOptChecked] = useState(!!checkboxOption?.checked);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // Debounced server search as the provider types (no client-side filtering — onSearch already ranks).
  useEffect(() => {
    if (!editing) return;
    const q = query.trim();
    if (!q) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      onSearchRef
        .current(q)
        .then((r) => !cancelled && setOptions(r))
        .catch((e) => {
          // A failed search must not masquerade as "no matches" — say so and report it.
          console.error('AI item search failed:', e);
          captureException(e);
          if (!cancelled) {
            setOptions([]);
            enqueueSnackbar('Search failed — please try again.', { variant: 'error' });
          }
        })
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, editing]);

  const startEditing = (): void => {
    setQuery(editText ? editText.value : initialQuery);
    setOptChecked(!!checkboxOption?.checked);
    setOptions([]);
    setEditing(true);
  };
  const stopEditing = (): void => setEditing(false);

  if (editing && editText) {
    // Free-text mode: this row IS prose (an exam section note), so editing means editing the
    // text — no checkbox search involved. Saving empty text is the same as removing the note.
    return (
      <ClickAwayListener onClickAway={stopEditing}>
        <Stack spacing={0.75} sx={{ width: '100%', py: 0.25 }}>
          <Typography variant="caption" color="text.secondary">
            {editText.label} — free-text note
          </Typography>
          <TextField
            size="small"
            multiline
            minRows={2}
            fullWidth
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const next = query.trim();
                stopEditing();
                if (next === editText.value.trim()) return;
                void (next ? editText.onSave(next) : onRemove());
              }}
            >
              Save
            </Button>
            <Button size="small" onClick={stopEditing}>
              Cancel
            </Button>
            <Button size="small" color="error" startIcon={<CloseIcon />} onClick={() => void onRemove()}>
              Remove
            </Button>
          </Stack>
        </Stack>
      </ClickAwayListener>
    );
  }

  if (editing) {
    return (
      <ClickAwayListener onClickAway={stopEditing}>
        <Stack spacing={0.5} sx={{ width: '100%', py: 0.25 }}>
          {/* Polarity/option toggle (ROS denies↔reports, med "doesn't know dosage") sits ABOVE the
              search box. The autocomplete dropdown opens downward (flip disabled below), so it can
              never render on top of this checkbox and hide it — the bug where a down-opening list
              covered "Patient denies (uncheck for reports)", leaving findings stuck as denies. */}
          {checkboxOption && (
            <FormControlLabel
              sx={{ ml: 0 }}
              control={
                <Checkbox
                  size="small"
                  sx={{ p: 0.5 }}
                  checked={optChecked}
                  onChange={(e) => {
                    setOptChecked(e.target.checked);
                    // Toggle applies to the CURRENT item in place; it also carries to a replacement.
                    checkboxOption.onChange(e.target.checked);
                  }}
                />
              }
              label={<Typography variant="caption">{checkboxOption.label}</Typography>}
            />
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Autocomplete
              open
              freeSolo
              fullWidth
              size="small"
              options={options}
              loading={loading}
              clearOnBlur={false}
              disableClearable
              blurOnSelect
              // Always open the option list downward (no flip): the toggle now lives above the box,
              // so a downward list never covers it regardless of the item's position on screen.
              slotProps={{ popper: { placement: 'bottom-start', modifiers: [{ name: 'flip', enabled: false }] } }}
              filterOptions={(x) => x}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
              inputValue={query}
              onInputChange={(_e, v, reason) => {
                // Only react to the user typing — ignore MUI's internal reset/resync events, which
                // (combined with a controlled inputValue) can otherwise loop "max update depth".
                if (reason === 'input') setQuery(v);
              }}
              onChange={(_e, v) => {
                if (v && typeof v !== 'string') {
                  stopEditing();
                  void onReplace(v.key, optChecked);
                }
              }}
              renderOption={(props, o) => (
                <li {...props} key={o.key}>
                  <Box>
                    <Typography variant="body2">{o.label}</Typography>
                    {o.secondary && (
                      <Typography variant="caption" color="text.secondary">
                        {o.secondary}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  variant="standard"
                  placeholder="Type to replace…"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') stopEditing();
                  }}
                />
              )}
            />
            <IconButton
              size="small"
              color="error"
              aria-label="Remove item"
              onClick={() => {
                stopEditing();
                void onRemove();
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
            {!hideDiscuss && (
              <IconButton
                size="small"
                aria-label="Discuss item"
                onClick={() => {
                  stopEditing();
                  onDiscuss();
                }}
              >
                <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        </Stack>
      </ClickAwayListener>
    );
  }

  // Tint priority while it needs review: amber for the "look closer" cases (low-confidence OR
  // inferred — no dictation phrase backs it), blue for an ordinary sourced AI item. No tint once
  // reviewed / provider-entered (still editable — a subtle hover signals that).
  const attention = lowConfidence || inferred;
  const tint = !needsReview ? 'transparent' : attention ? 'rgba(237,108,2,0.14)' : 'rgba(25,118,210,0.12)';
  const tintHover = !needsReview ? 'rgba(0,0,0,0.05)' : attention ? 'rgba(237,108,2,0.26)' : 'rgba(25,118,210,0.24)';

  // Hover hint: the review-pass reasoning, the source phrase for a traceable item, or an explicit
  // "inferred" note for one the planner couldn't tie to the dictation. Provider-entered items: none.
  const baseHint = reviewNote
    ? `Suggested by note review: ${reviewNote}`
    : sourceText
    ? `Charted from the dictation: “${sourceText}”`
    : templateName
    ? `Charted from the “${templateName}” template — verify it fits this visit.`
    : inferred
    ? 'Inferred — not stated in the dictation. Verify before signing.'
    : needsReview
    ? // Blue but no specific provenance (a provider command, etc.) — still explain why it's
      // highlighted so a flagged item is never hover-less.
      'Added by the assistant — review it, then confirm (✓) or correct it.'
    : undefined;
  const provenanceHint = caution ? [`⚠ ${caution}`, baseHint].filter(Boolean).join(' ') : baseHint;

  return (
    <Box
      onClick={startEditing}
      role="button"
      aria-label="Edit item"
      sx={{
        cursor: 'pointer',
        borderRadius: 1,
        px: 0.5,
        mx: -0.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        bgcolor: tint,
        transition: 'background-color .15s',
        '&:hover': { bgcolor: tintHover },
      }}
    >
      {lowConfidence && (
        <WarningAmberIcon
          sx={{ fontSize: 15, color: 'warning.main', mt: '2px' }}
          titleAccess="Low confidence — review"
        />
      )}
      {!lowConfidence && inferred && needsReview && (
        <Tooltip title={provenanceHint ?? ''} placement="top" arrow>
          <HelpOutlineIcon sx={{ fontSize: 15, color: 'warning.main', mt: '2px' }} />
        </Tooltip>
      )}
      <Tooltip title={provenanceHint ?? ''} placement="top-start" arrow disableHoverListener={!provenanceHint}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {children}
          {inferred && needsReview && (
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 0.75, color: 'warning.dark', fontStyle: 'italic', fontWeight: 600 }}
            >
              · inferred
            </Typography>
          )}
          {reviewNote && needsReview && (
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 0.75, color: 'info.main', fontStyle: 'italic', fontWeight: 600 }}
            >
              · review
            </Typography>
          )}
        </Box>
      </Tooltip>
      {needsReview && onConfirm && (
        <Tooltip title="Looks right — mark reviewed" placement="top" arrow>
          <IconButton
            size="small"
            color="success"
            aria-label="Confirm item"
            sx={{ p: 0.25 }}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            <CheckIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
