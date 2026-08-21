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
// CLICKING EDITS IN PLACE. A row turns into the chart's OWN field for that section — the Assessment page's
// diagnosis and billing pickers, the eRx allergen and drug searches, the hospitalization and surgery lists —
// seeded with what is charted, so the provider refines rather than retypes. Provider-entered rows are
// untinted but just as editable: the provider never depends on the AI to fix something. Correcting a row is
// a direct edit, and routing it back through the chat would be the slower way to do what the picker did.
//
// There used to be a bespoke search editor here as well, for rows whose catalogue was the assistant's own
// fuzzy matcher. Every one of those rows now opens a real field instead, so it is gone — a partially typed
// query matched nothing in those catalogues, which made a row look editable and do nothing.
//
// AND IT CLOSES ITSELF. Picking a value, pressing Escape, clicking the ✕, or simply moving focus away all
// return the row to text. An editor that stays open until dismissed is one the provider has to remember to
// dismiss, and on a note of thirty rows several end up open at once — each one hiding the value it is
// meant to be editing behind an input showing the same thing.

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { FC, ReactNode, useRef, useState } from 'react';
import { explainProvenance, ProvenanceRecord } from '../provenance/provenance';

const TINTS: Record<string, { background: string; hover: string }> = {
  sourced: { background: 'rgba(25,118,210,0.12)', hover: 'rgba(25,118,210,0.2)' },
  inferred: { background: 'rgba(237,108,2,0.14)', hover: 'rgba(237,108,2,0.22)' },
  review: { background: 'rgba(237,108,2,0.14)', hover: 'rgba(237,108,2,0.22)' },
  'template-default': { background: 'rgba(237,108,2,0.14)', hover: 'rgba(237,108,2,0.22)' },
};

const NEUTRAL = { background: 'transparent', hover: 'rgba(0,0,0,0.04)' };

export interface AiChartedItemProps {
  children: ReactNode;
  /** Absent, or `reviewed`, renders as provider-entered: no tint. */
  provenance?: ProvenanceRecord;
  /** Click opens a simple editor instead of a search — vitals, free-text rows. */
  onCorrect?: () => void;
  /**
   * Render THIS editor in place on click, instead of the built-in catalogue search.
   *
   * EVERY searchable row uses this: the Assessment page's diagnosis and CPT pickers, the eRx allergen and
   * drug searches, the hospitalization and surgery lists, and the E&M dropdown. One field per section,
   * defined once where that section lives.
   *
   * A RENDER PROP, because the editor has to be able to close itself. This row is controlled from chart
   * data, so an editor left open after writing re-renders with the PRE-write value and looks as though the
   * selection was thrown away. Closing on selection hands the row back to the refetched data.
   */
  editor?: (close: () => void) => ReactNode;
  /** Marks the item reviewed without changing it. */
  onConfirm?: () => void;
  onDelete?: () => void;
  dataTestId?: string;
}

export const AiChartedItem: FC<AiChartedItemProps> = ({
  children,
  provenance,
  onCorrect,
  editor,
  onConfirm,
  onDelete,
  dataTestId,
}) => {
  const [editing, setEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  /**
   * Leave edit mode as soon as focus goes somewhere else. A row left sitting open is a row the provider has
   * to remember to dismiss, and on a note of thirty rows several can end up open at once.
   *
   * Focus, and NOT a click-away listener: MUI renders an Autocomplete's dropdown in a PORTAL, so every
   * option is "away" and picking one would close the editor before the click landed — the pick would appear
   * to do nothing. MUI keeps the caret in the input while the dropdown is open, including while an option is
   * being clicked, so focus is the reliable signal.
   *
   * Deferred to the next frame because `relatedTarget` is null for plenty of legitimate transitions inside
   * the editor; by then `activeElement` has settled and can be asked directly.
   */
  const closeOnFocusLeaving = (): void => {
    requestAnimationFrame(() => {
      const node = editorRef.current;
      if (!node) return;
      const active = document.activeElement;
      if (active && (node === active || node.contains(active))) return;
      setEditing(false);
    });
  };

  const aiAuthored = Boolean(provenance) && !provenance?.reviewed;
  const tint = aiAuthored ? TINTS[provenance!.origin] ?? TINTS.inferred : NEUTRAL;
  const inferred = aiAuthored && provenance!.origin !== 'sourced';
  const clickable = Boolean(editor) || Boolean(onCorrect);

  if (editing && editor) {
    // The hosted editor writes through its own save path, so there is nothing to hand it and nothing to
    // interpret back — closing is the only thing this component still owns. It closes three ways: on
    // selection (the editor calls back), on the ✕, and on losing focus.
    return (
      <Stack
        ref={editorRef}
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1, py: 0.5 }}
        onBlur={closeOnFocusLeaving}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false);
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>{editor(() => setEditing(false))}</Box>
        <IconButton size="small" aria-label="done" onClick={() => setEditing(false)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    );
  }
  return (
    <Tooltip title={aiAuthored ? explainProvenance(provenance) : ''} placement="top-start" arrow>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        data-testid={dataTestId}
        onClick={() => {
          if (editor) setEditing(true);
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
