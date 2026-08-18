// The most important interaction in the feature: every row is a button-like surface, not static text.
//
//   AI-written, sourced from a dictated phrase  → blue tint, hover darkens
//   AI-written but INFERRED or low-confidence   → AMBER tint + an "inferred" badge
//   Reviewed / provider-entered                 → no tint, neutral grey on hover
//
// Amber vs blue is the whole point: it directs attention to what the model GUESSED rather than heard.
// Hover shows provenance — the verbatim quote, the review pass's reasoning, or "template default,
// verify" — which is how a provider audits a whole note in seconds.
//
// CLICKING EDITS IN PLACE. A searchable row turns into an autocomplete seeded with its own text: type
// to find a replacement, pick one, toggle its per-item option, or remove it, without leaving the note.
// Provider-entered rows are untinted but just as editable — the provider never depends on the AI to
// fix something. The editor offers Remove and Cancel and nothing else: correcting a row is a direct
// edit, and routing it back through the chat would be the slower way to do what the picker just did.

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Checkbox,
  CircularProgress,
  ClickAwayListener,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { explainProvenance, ProvenanceRecord } from '../provenance/provenance';

const TINTS: Record<string, { background: string; hover: string }> = {
  sourced: { background: 'rgba(25,118,210,0.12)', hover: 'rgba(25,118,210,0.2)' },
  inferred: { background: 'rgba(237,108,2,0.14)', hover: 'rgba(237,108,2,0.22)' },
  review: { background: 'rgba(237,108,2,0.14)', hover: 'rgba(237,108,2,0.22)' },
  'template-default': { background: 'rgba(237,108,2,0.14)', hover: 'rgba(237,108,2,0.22)' },
};

const NEUTRAL = { background: 'transparent', hover: 'rgba(0,0,0,0.04)' };

/** One replacement candidate, as the catalogue ranked it. */
export interface CorrectionOption {
  id: string;
  display: string;
}

export interface ItemCorrection {
  /** Seeds the search box with what is currently charted, so refining beats retyping. */
  initialQuery: string;
  search: (query: string) => Promise<CorrectionOption[]>;
  replace: (option: CorrectionOption) => void | Promise<void>;
  /**
   * A per-item toggle shown while editing — medications' "patient could not confirm the dosage", ROS
   * polarity. Its state carries over to a replacement, so correcting the drug does not silently drop
   * the fact that its dose was never confirmed.
   */
  option?: { label: string; checked: boolean; onChange: (checked: boolean) => void | Promise<void> };
}

export interface AiChartedItemProps {
  children: ReactNode;
  /** Absent, or `reviewed`, renders as provider-entered: no tint. */
  provenance?: ProvenanceRecord;
  /** Click opens correction in place. Omit for a row with nothing to search against. */
  correction?: ItemCorrection;
  /** Click opens a simple editor instead of a search — vitals, free-text rows. */
  onCorrect?: () => void;
  /** Marks the item reviewed without changing it. */
  onConfirm?: () => void;
  onDelete?: () => void;
  dataTestId?: string;
}

export const AiChartedItem: FC<AiChartedItemProps> = ({
  children,
  provenance,
  correction,
  onCorrect,
  onConfirm,
  onDelete,
  dataTestId,
}) => {
  const [editing, setEditing] = useState(false);
  const aiAuthored = Boolean(provenance) && !provenance?.reviewed;
  const tint = aiAuthored ? TINTS[provenance!.origin] ?? TINTS.inferred : NEUTRAL;
  const inferred = aiAuthored && provenance!.origin !== 'sourced';
  const clickable = Boolean(correction) || Boolean(onCorrect);

  if (editing && correction) {
    return <CorrectionEditor correction={correction} onClose={() => setEditing(false)} onRemove={onDelete} />;
  }

  return (
    <Tooltip title={aiAuthored ? explainProvenance(provenance) : ''} placement="top-start" arrow>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        data-testid={dataTestId}
        onClick={() => {
          if (correction) setEditing(true);
          else onCorrect?.();
        }}
        sx={{
          px: 1,
          py: 0.5,
          borderRadius: 1,
          backgroundColor: tint.background,
          cursor: clickable ? 'pointer' : 'default',
          '&:hover': { backgroundColor: tint.hover },
          '&:hover .easy-chart-item-actions': { opacity: 1 },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>

        {inferred && (
          <Typography
            variant="caption"
            sx={{ color: 'warning.dark', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0 }}
          >
            inferred
          </Typography>
        )}

        <Stack
          direction="row"
          className="easy-chart-item-actions"
          sx={{ opacity: 0, transition: 'opacity 120ms', flexShrink: 0 }}
        >
          {aiAuthored && onConfirm && (
            <Tooltip title="Looks right — mark reviewed">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onConfirm();
                }}
              >
                <CheckCircleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Remove">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Tooltip>
  );
};

/**
 * The in-place correction: search, pick, or skip.
 *
 * Debounced against the catalogue, which already ranks — no client-side re-filtering, or the provider
 * would be fighting two different orderings.
 */
const CorrectionEditor: FC<{
  correction: ItemCorrection;
  onClose: () => void;
  onRemove?: () => void;
}> = ({ correction, onClose, onRemove }) => {
  const [query, setQuery] = useState(correction.initialQuery);
  const [options, setOptions] = useState<CorrectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(Boolean(correction.option?.checked));
  const searchRef = useRef(correction.search);
  searchRef.current = correction.search;

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      let cancelled = false;
      void searchRef
        .current(term)
        .then((result) => {
          if (!cancelled) setOptions(result);
        })
        .catch((error) => {
          console.error('[easy-chart] correction search failed', error);
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <ClickAwayListener onClickAway={onClose}>
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Stack spacing={0.5}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            label="Search for a replacement"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
            }}
            InputProps={{ endAdornment: loading ? <CircularProgress size={16} /> : undefined }}
          />

          {correction.option && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={checked}
                  onChange={(event) => {
                    setChecked(event.target.checked);
                    void correction.option!.onChange(event.target.checked);
                  }}
                />
              }
              label={<Typography variant="caption">{correction.option.label}</Typography>}
            />
          )}

          {options.length > 0 && (
            <List dense sx={{ maxHeight: 220, overflowY: 'auto' }}>
              {options.map((option) => (
                <ListItemButton
                  key={option.id}
                  onClick={() => {
                    onClose();
                    void correction.replace(option);
                  }}
                >
                  <ListItemText primary={option.display} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItemButton>
              ))}
            </List>
          )}

          {!loading && query.trim() && options.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Nothing in the catalogue matches that. Reword it, or ask the assistant.
            </Typography>
          )}

          <Stack direction="row" spacing={1}>
            {onRemove && (
              <Typography
                component="button"
                variant="caption"
                onClick={() => {
                  onClose();
                  onRemove();
                }}
                sx={{ border: 0, background: 'none', p: 0, cursor: 'pointer', color: 'error.main' }}
              >
                Remove
              </Typography>
            )}
            <Typography
              component="button"
              variant="caption"
              onClick={onClose}
              sx={{ border: 0, background: 'none', p: 0, cursor: 'pointer', color: 'text.secondary' }}
            >
              Cancel
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </ClickAwayListener>
  );
};
