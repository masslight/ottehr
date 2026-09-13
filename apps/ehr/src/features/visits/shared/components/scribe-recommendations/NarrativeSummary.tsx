import { Box, Paper, Popover, Tooltip, Typography } from '@mui/material';
import { Patient } from 'fhir/r4b';
import { FC, Fragment, KeyboardEvent, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { calculatePatientAge } from 'utils/lib/utils/dateUtils';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { TemplateOption } from '../templates/useListTemplates';
import { OrderSuggestionRow, useStartOrder } from './OrderSuggestions';
import { ProvenanceContent } from './Provenance';
import { RecommendationRow } from './RecommendationRow';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { describeRecommendation, kgFromLbs } from './scribeSections';
import { AI_SURFACE } from './ScribeStage';
import { NarrativeSegment, OrderSuggestion, ScribeRecommendation } from './types';

const testIds = dataTestIds.scribeRecommendations;

/** Same tint as the panel's own AI surface, one step stronger, for the run under the pointer. */
const AI_SURFACE_ACTIVE = '#B3E5FC';

/** What a linked run may quote from its recommendation, as it stands right now. */
const runValues = (rec: ScribeRecommendation): Record<string, string> => {
  switch (rec.kind) {
    case 'hpi':
      return { text: rec.text };
    case 'allergy':
      return { name: rec.name };
    case 'medication':
      return { name: rec.name, prn: rec.type === 'as-needed' ? 'PRN' : 'scheduled' };
    case 'vital-weight':
      return { weightLbs: String(rec.weightLbs), kg: String(kgFromLbs(rec.weightLbs)) };
    case 'diagnosis':
      return {
        code: rec.code,
        display: rec.display,
        displayLower: rec.display.charAt(0).toLowerCase() + rec.display.slice(1),
      };
    case 'template':
      return { templateName: rec.templateName };
    case 'ros':
      // The finding is the verb of the sentence, so a flip of the R/D toggle rewrites the run
      // rather than leaving it saying the opposite of what the row now says.
      return {
        finding: rec.finding === RosFindingState.Reports ? 'reports' : 'denies',
        label: rec.label.charAt(0).toLowerCase() + rec.label.slice(1),
      };
  }
};

/**
 * Fills the run's {field} placeholders from the live recommendation, so an edit in the panel is
 * reflected in the sentence. The HPI run is a paraphrase, which no longer holds once the provider
 * has rewritten the text; from then on their words are shown verbatim.
 */
export const renderRunText = (
  segment: NarrativeSegment,
  recommendation: ScribeRecommendation | undefined,
  edited?: boolean
): string => {
  if (!recommendation) return segment.text;
  if (recommendation.kind === 'hpi' && edited) return recommendation.text;
  const values = runValues(recommendation);
  return segment.text.replace(/\{(\w+)\}/g, (_match, token: string) => values[token] ?? '');
};

/**
 * The fixture only knows the story, not who it is about; the placeholders are filled from the
 * visit's patient at render time, or dropped when the patient isn't on hand.
 */
const describePatient = (patient: Patient | undefined): string => {
  const age = calculatePatientAge(patient?.birthDate);
  if (!age) return 'adult patient';
  // calculatePatientAge says "34 y" / "5 m" / "3 d"; the sentence wants "34-year-old".
  const [count, unit] = age.split(' ');
  const unitWord = { y: 'year', m: 'month', d: 'day' }[unit];
  if (!unitWord) return 'adult patient';
  const sex = patient?.gender === 'male' || patient?.gender === 'female' ? patient.gender : 'patient';
  return `${count}-${unitWord}-old ${sex}`;
};

interface NarrativeSummaryProps {
  templates: TemplateOption[];
  onRetry: () => void;
}

/**
 * Stage zero: the visit told back as one paragraph. Each run that maps to a recommendation is
 * highlighted, and the run and its row light up together under the pointer, so the provider can
 * read the story and find the item either way. Clicking a run opens its row right there, so it
 * can be checked, questioned and corrected without leaving the sentence.
 */
export const NarrativeSummary: FC<NarrativeSummaryProps> = ({ templates, onRetry }) => {
  const narrative = useScribeRecommendationsStore((state) => state.narrative);
  const { patient } = useAppointmentData();
  const patientPhrase = describePatient(patient);

  return (
    <Paper variant="outlined" data-testid={testIds.narrative} sx={{ px: 1.5, py: 1 }}>
      <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
        {narrative.map((segment, index) =>
          segment.itemId ? (
            <NarrativeSpan
              key={index}
              segment={segment}
              itemId={segment.itemId}
              templates={templates}
              onRetry={onRetry}
            />
          ) : (
            <Fragment key={index}>{segment.text.replace('{age}-year-old {sex}', patientPhrase)}</Fragment>
          )
        )}
      </Typography>
    </Paper>
  );
};

interface NarrativeSpanProps extends NarrativeSummaryProps {
  segment: NarrativeSegment;
  itemId: string;
}

const NarrativeSpan: FC<NarrativeSpanProps> = ({ segment, itemId, templates, onRetry }) => {
  const recommendation = useScribeRecommendationsStore((state) =>
    state.recommendations.find((rec) => rec.id === itemId)
  );
  const order = useScribeRecommendationsStore((state) => state.orderSuggestions.find((o) => o.id === itemId));
  const isHovered = useScribeRecommendationsStore((state) => state.hoveredItemId === itemId);
  const isUnchecked = useScribeRecommendationsStore((state) => state.itemState[itemId]?.selected === false);
  const isEdited = useScribeRecommendationsStore((state) => state.itemState[itemId]?.edited);
  const isDone = useScribeRecommendationsStore(
    (state) =>
      state.chartedIds.includes(itemId) ||
      state.itemState[itemId]?.status === 'applied' ||
      Boolean(state.ordersDone[itemId])
  );
  const setHoveredItemId = useScribeRecommendationsStore((state) => state.setHoveredItemId);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorEl);
  // The tooltip is controlled so it can be put away the moment the popover takes over.
  const [isTipOpen, setIsTipOpen] = useState(false);

  // The popover's backdrop keeps the pointer off everything else, so the only thing that can
  // clear the hover while it is open is the row inside it; pin it so the list row stays lit too.
  useEffect(() => {
    if (isOpen && !isHovered) setHoveredItemId(itemId);
  }, [isOpen, isHovered, itemId, setHoveredItemId]);

  // A run the analysis has no item for reads as plain text rather than a dead link.
  if (!recommendation && !order) return <>{segment.text}</>;

  const isActive = isHovered || isOpen;
  const activate = (): void => setHoveredItemId(itemId);
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

  // The same "why" the row's "i" shows, built the same way; here it is the hover itself.
  const provenance = recommendation
    ? {
        warning: isDone ? undefined : recommendation.warning,
        note: describeRecommendation(recommendation).detail,
        evidence: recommendation.evidence,
      }
    : { note: order?.rationale, evidence: order?.evidence };
  const tooltip = (
    <>
      {isDone && (
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 500 }}>
          Already in the chart
        </Typography>
      )}
      <ProvenanceContent {...provenance} />
    </>
  );

  const span = (
    <Box
      component="span"
      tabIndex={0}
      data-testid={testIds.narrativeSpan(itemId)}
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
      {renderRunText(segment, recommendation, isEdited)}
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
        data-testid={testIds.narrativePopover(itemId)}
      >
        {recommendation ? (
          <NarrativeRecommendationRow
            recommendation={recommendation}
            templates={templates}
            onRetry={onRetry}
            onEditingEnd={close}
          />
        ) : (
          order && <NarrativeOrderRow order={order} />
        )}
      </Popover>
    </>
  );
};

interface NarrativeRecommendationRowProps extends NarrativeSummaryProps {
  recommendation: ScribeRecommendation;
  onEditingEnd: () => void;
}

/** The same row as in the list, wired the same way, opened straight into its editor. */
const NarrativeRecommendationRow: FC<NarrativeRecommendationRowProps> = ({
  recommendation,
  templates,
  onRetry,
  onEditingEnd,
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
      startEditing={!charted && itemState.status !== 'applied'}
      // The list holds a row for this same recommendation, and only one editor is open at a time:
      // this copy is the one being worked in, so it is named apart from the one in the list.
      editingKey={`narrative-${id}`}
      onEditingEnd={onEditingEnd}
      hideProvenance
    />
  );
};

const NarrativeOrderRow: FC<{ order: OrderSuggestion }> = ({ order }) => {
  const done = useScribeRecommendationsStore((state) => Boolean(state.ordersDone[order.id]));
  const setOrderDone = useScribeRecommendationsStore((state) => state.setOrderDone);
  const startOrder = useStartOrder();

  return (
    <OrderSuggestionRow
      order={order}
      done={done}
      onDoneChange={(isDone) => setOrderDone(order.id, isDone)}
      onStartOrder={startOrder}
      hideProvenance
    />
  );
};
