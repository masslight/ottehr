import { Box, Divider, Paper, Popover, Tooltip, Typography } from '@mui/material';
import { FC, Fragment, KeyboardEvent, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { TemplateOption } from '../templates/useListTemplates';
import { ProvenanceContent } from './Provenance';
import { RecommendationRow } from './RecommendationRow';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { describeRecommendation } from './scribeSections';
import { AI_SURFACE } from './ScribeStage';
import { NarrativeSegment, ScribeRecommendation } from './types';

const testIds = dataTestIds.scribeRecommendations;

/** Same tint as the panel's own AI surface, one step stronger, for the run under the pointer. */
const AI_SURFACE_ACTIVE = '#B3E5FC';

/** Tall enough to read a stretch of the visit in; the rest scrolls, so a long transcript cannot bury the list. */
const NARRATIVE_MAX_HEIGHT = 320;

interface NarrativeSummaryProps {
  templates: TemplateOption[];
  onRetry: () => void;
}

/**
 * Stage zero: the visit told back in the words that were said. The transcript is shown as pasted, and every
 * phrase a recommendation was drawn from is highlighted; the run and its row light up together under the
 * pointer, so the provider can read the story and find the item either way. Clicking a run opens its row
 * right there, so it can be checked, questioned and corrected without leaving the sentence — and a phrase
 * that several items came from opens all of them.
 */
export const NarrativeSummary: FC<NarrativeSummaryProps> = ({ templates, onRetry }) => {
  const narrative = useScribeRecommendationsStore((state) => state.narrative);

  return (
    <Paper
      variant="outlined"
      data-testid={testIds.narrative}
      sx={{ px: 1.5, py: 1, maxHeight: NARRATIVE_MAX_HEIGHT, overflowY: 'auto' }}
    >
      <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {narrative.map((segment, index) =>
          segment.itemIds && segment.itemIds.length > 0 ? (
            <NarrativeSpan
              key={index}
              segment={segment}
              itemIds={segment.itemIds}
              templates={templates}
              onRetry={onRetry}
            />
          ) : (
            <Fragment key={index}>{segment.text}</Fragment>
          )
        )}
      </Typography>
    </Paper>
  );
};

interface NarrativeSpanProps extends NarrativeSummaryProps {
  segment: NarrativeSegment;
  itemIds: string[];
}

const NarrativeSpan: FC<NarrativeSpanProps> = ({ segment, itemIds, templates, onRetry }) => {
  const recommendations = useScribeRecommendationsStore((state) =>
    itemIds
      .map((id) => state.recommendations.find((rec) => rec.id === id))
      .filter((rec): rec is ScribeRecommendation => rec !== undefined)
  );
  const isHovered = useScribeRecommendationsStore(
    (state) => state.hoveredItemId !== undefined && itemIds.includes(state.hoveredItemId)
  );
  // Struck out only when every item this phrase produced is out; settled only when every one is in.
  const isUnchecked = useScribeRecommendationsStore((state) =>
    itemIds.every((id) => state.itemState[id]?.selected === false)
  );
  const isDone = useScribeRecommendationsStore((state) =>
    itemIds.every((id) => state.chartedIds.includes(id) || state.itemState[id]?.status === 'applied')
  );
  const setHoveredItemId = useScribeRecommendationsStore((state) => state.setHoveredItemId);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorEl);
  // The tooltip is controlled so it can be put away the moment the popover takes over.
  const [isTipOpen, setIsTipOpen] = useState(false);
  // One id stands for the run in the store's hover state; the rows themselves each light up on their own id.
  const leadId = itemIds[0];
  const key = itemIds.join('+');

  // The popover's backdrop keeps the pointer off everything else, so the only thing that can
  // clear the hover while it is open is the row inside it; pin it so the list row stays lit too.
  // Only ever from nothing, though: two popovers open at once would each keep re-pinning their
  // own run over the other's and loop until React gave up.
  const nothingHovered = useScribeRecommendationsStore((state) => state.hoveredItemId === undefined);
  useEffect(() => {
    if (isOpen && nothingHovered) setHoveredItemId(leadId);
  }, [isOpen, nothingHovered, leadId, setHoveredItemId]);

  // A run the analysis has no item for reads as plain text rather than a dead link.
  if (recommendations.length === 0) return <>{segment.text}</>;

  const isActive = isHovered || isOpen;
  const activate = (): void => setHoveredItemId(leadId);
  const deactivate = (): void => {
    if (!isOpen) setHoveredItemId(undefined);
  };
  const open = (target: HTMLElement): void => {
    setIsTipOpen(false);
    setAnchorEl(target);
  };
  const close = (): void => {
    setAnchorEl(null);
    setHoveredItemId(undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(event.currentTarget);
    }
  };

  // What this phrase produced, one line per item, with any caution; the phrase itself is the evidence.
  const tooltip = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {isDone && (
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 500 }}>
          Already in the chart
        </Typography>
      )}
      {recommendations.map((rec) => (
        <ProvenanceContent
          key={rec.id}
          note={describeRecommendation(rec).primary}
          warning={isDone ? undefined : rec.warning}
        />
      ))}
    </Box>
  );

  const span = (
    <Box
      component="span"
      tabIndex={0}
      data-testid={testIds.narrativeSpan(key)}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onFocus={activate}
      onBlur={deactivate}
      // A line elsewhere already has an editor open: this click is the one closing it (and
      // saving it), so it does only that rather than also putting this run's popover up.
      onClick={(event) => {
        if (useScribeRecommendationsStore.getState().editingId !== undefined) return;
        open(event.currentTarget);
      }}
      onKeyDown={onKeyDown}
      sx={{
        borderRadius: '4px',
        padding: '0 3px',
        cursor: 'pointer',
        outline: 'none',
        ...(isDone
          ? { backgroundColor: 'action.hover', color: 'text.secondary' }
          : { backgroundColor: isActive ? AI_SURFACE_ACTIVE : AI_SURFACE }),
        ...(isUnchecked && !isDone ? { textDecoration: 'line-through' } : {}),
      }}
    >
      {segment.text}
    </Box>
  );

  return (
    <>
      <Tooltip
        title={tooltip}
        placement="left"
        enterDelay={300}
        open={isTipOpen && !isOpen}
        onOpen={() => setIsTipOpen(true)}
        onClose={() => setIsTipOpen(false)}
      >
        {span}
      </Tooltip>
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        // The page behind must not jump when the popover opens; that is the bounce this replaces.
        disableScrollLock
        elevation={0}
        PaperProps={{ variant: 'outlined', sx: { width: 'min(440px, calc(100vw - 32px))' } }}
        data-testid={testIds.narrativePopover(key)}
      >
        {recommendations.map((rec, index) => (
          <Fragment key={rec.id}>
            {index > 0 && <Divider />}
            <NarrativeRecommendationRow
              recommendation={rec}
              templates={templates}
              onRetry={onRetry}
              onEditingEnd={close}
              // A phrase that produced one item opens straight into editing it; one that produced several
              // shows them all, and the provider picks the line to open.
              openEditor={recommendations.length === 1}
            />
          </Fragment>
        ))}
      </Popover>
    </>
  );
};

interface NarrativeRecommendationRowProps extends NarrativeSummaryProps {
  recommendation: ScribeRecommendation;
  onEditingEnd: () => void;
  openEditor: boolean;
}

/** The same row as in the list, wired the same way. */
const NarrativeRecommendationRow: FC<NarrativeRecommendationRowProps> = ({
  recommendation,
  templates,
  onRetry,
  onEditingEnd,
  openEditor,
}) => {
  const id = recommendation.id;
  const itemState = useScribeRecommendationsStore((state) => state.itemState[id]) ?? {
    selected: true,
    status: 'idle',
  };
  const charted = useScribeRecommendationsStore((state) => state.chartedIds.includes(id));
  const isApplying = useScribeRecommendationsStore((state) => state.isApplying);
  const setSelected = useScribeRecommendationsStore((state) => state.setSelected);
  const updateRecommendation = useScribeRecommendationsStore((state) => state.updateRecommendation);

  return (
    <RecommendationRow
      recommendation={recommendation}
      itemState={itemState}
      locked={isApplying}
      charted={charted}
      templates={templates}
      onSelectedChange={(selected) => setSelected(id, selected)}
      onEdit={(patch: Partial<ScribeRecommendation>) => updateRecommendation(id, patch)}
      onRetry={() => {
        setSelected(id, true);
        onRetry();
      }}
      // A settled item has nothing left to edit; it opens read-only instead.
      startEditing={openEditor && !charted && itemState.status !== 'applied'}
      // The list holds a row for this same recommendation, and only one editor is open at a time:
      // this copy is the one being worked in, so it is named apart from the one in the list.
      editingKey={`narrative-${id}`}
      onEditingEnd={onEditingEnd}
      hideProvenance
    />
  );
};
