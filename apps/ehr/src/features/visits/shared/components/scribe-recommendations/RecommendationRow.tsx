import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  ClickAwayListener,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, FocusEvent, KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { DiagnosesField } from '../assessment-tab/DiagnosesField';
import { TemplateOption } from '../templates/useListTemplates';
import { hasProvenance, ProvenanceContent } from './Provenance';
import {
  RecommendationItemState,
  startEditingUnlessAnotherIsOpen,
  useScribeRecommendationsStore,
} from './scribeRecommendations.store';
import { describeRecommendation, rosFindingLetter } from './scribeSections';
import { AI_SURFACE } from './ScribeStage';
import { ScribeRecommendation } from './types';

interface RecommendationRowProps {
  recommendation: ScribeRecommendation;
  itemState: RecommendationItemState;
  /** Disables the checkbox and editing while a batch is being applied. */
  locked: boolean;
  /** The chart already holds this, so there is nothing to apply. */
  charted: boolean;
  templates: TemplateOption[];
  onSelectedChange: (selected: boolean) => void;
  onEdit: (patch: Partial<ScribeRecommendation>) => void;
  onRetry: () => void;
  /** Opens straight into the editor, as the narrative popover does, so no pencil is needed. */
  startEditing?: boolean;
  /**
   * Which open editor this row is, for the store's one-at-a-time rule. The same recommendation
   * can be on screen twice — in the list and in the narrative popover — and only the one being
   * worked in should be open, so the popover names its own copy.
   */
  editingKey?: string;
  /** Fired once the editor closes, saving as it goes, so a host popover can close with it. */
  onEditingEnd?: () => void;
  /** The host already shows the "why" (the narrative does, on hover), so the row needn't. */
  hideProvenance?: boolean;
}

const testIds = dataTestIds.scribeRecommendations;

/** Hooks the row's hover state so the pencil can hide until the pointer (or focus) is on the line. */
export const ROW_CLASS = 'scribe-row';

/** The colours the Review of Systems table heads its two columns with, so a finding reads the same here. */
const ROS_FINDING_COLOR: Record<RosFindingState, string> = {
  [RosFindingState.Reports]: 'error.main',
  [RosFindingState.Denies]: 'success.main',
};

/** sx for a control that should only show itself while the line it belongs to is being read. */
export const HOVER_ONLY = {
  opacity: 0,
  transition: 'opacity .15s',
  [`.${ROW_CLASS}:hover &, .${ROW_CLASS}:focus-within &`]: { opacity: 1 },
};

export const RecommendationRow: FC<RecommendationRowProps> = ({
  recommendation,
  itemState,
  locked,
  charted,
  templates,
  onSelectedChange,
  onEdit,
  onRetry,
  startEditing,
  editingKey = recommendation.id,
  onEditingEnd,
  hideProvenance,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const isEditing = useScribeRecommendationsStore((state) => state.editingId === editingKey);
  const setEditingId = useScribeRecommendationsStore((state) => state.setEditingId);
  const isHighlighted = useScribeRecommendationsStore((state) => state.hoveredItemId === recommendation.id);
  const setHoveredItemId = useScribeRecommendationsStore((state) => state.setHoveredItemId);

  // The narrative popover opens onto the editor, which is the same as any other row taking it.
  useEffect(() => {
    if (startEditing) setEditingId(editingKey);
  }, [startEditing, editingKey, setEditingId]);
  const { primary, secondary, detail } = describeRecommendation(recommendation);
  const isApplied = itemState.status === 'applied';
  const isApplying = itemState.status === 'applying';
  // Settled either way: this panel wrote it, or it was there already.
  const isDone = isApplied || charted;
  // A generic action row has no editor: it is applied as the executor's own step, or unticked.
  const canEdit = !isDone && !isApplying && !locked && recommendation.kind !== 'action';

  // A template the environment doesn't have can't be applied; say so before the provider tries.
  const templateMissing =
    recommendation.kind === 'template' &&
    templates.length > 0 &&
    !templates.some((t) => t.label.toLowerCase() === recommendation.templateName.trim().toLowerCase());
  const rawWarning = templateMissing
    ? 'This template isn’t available in this environment. Edit the recommendation to pick another one.'
    : recommendation.warning;
  // Once the item is in the chart the caution has been acted on, so it stops flagging the row.
  const warning = isDone ? undefined : rawWarning;

  const provenance = { warning, note: detail, evidence: recommendation.evidence };
  const showProvenance = hasProvenance(provenance);

  const renderStatus = (): JSX.Element | null => {
    if (isApplying) {
      return <CircularProgress size={18} data-testid={testIds.rowStatus(recommendation.id)} aria-label="Applying" />;
    }
    // Nothing is drawn once it lands: the checkbox itself goes green, which is the same news
    // in a place the eye is already on.
    if (itemState.status === 'skipped') {
      return (
        <Tooltip title={itemState.reason ?? 'Nothing was written'}>
          <SkipNextIcon
            color="disabled"
            sx={{ fontSize: 20 }}
            data-testid={testIds.rowStatus(recommendation.id)}
            aria-label="Skipped"
          />
        </Tooltip>
      );
    }
    if (itemState.status === 'error') {
      return (
        <Tooltip title={itemState.error ?? 'Could not apply'}>
          <ErrorOutlineIcon
            color="error"
            sx={{ fontSize: 20 }}
            data-testid={testIds.rowStatus(recommendation.id)}
            aria-label="Failed"
          />
        </Tooltip>
      );
    }
    return null;
  };

  const canStartEditing = canEdit && !isEditing;

  // Closing is saving: there is nothing to cancel, so an empty patch is simply an untouched row.
  const closeEditor = (patch?: Partial<ScribeRecommendation>): void => {
    if (patch) onEdit(patch);
    // Only if this row still holds the editor: another row may have just taken it.
    if (useScribeRecommendationsStore.getState().editingId === editingKey) setEditingId(undefined);
    onEditingEnd?.();
  };

  const row = (
    <Box
      ref={rowRef}
      className={ROW_CLASS}
      data-testid={testIds.row(recommendation.id)}
      onMouseEnter={() => setHoveredItemId(recommendation.id)}
      onMouseLeave={() => setHoveredItemId(undefined)}
      // The whole line is the edit affordance; the pencil is only the sign that it is one.
      onClick={canStartEditing ? () => startEditingUnlessAnotherIsOpen(editingKey) : undefined}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        px: 1,
        py: 0.75,
        cursor: canStartEditing ? 'pointer' : undefined,
        backgroundColor: isHighlighted ? AI_SURFACE : undefined,
        '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' },
      }}
    >
      {/* A pending row carries no box to tick: it is read, and opened when it needs changing.
          The slot is held open so the green of a settled row doesn't shunt the line beside it. */}
      <Box sx={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {(isEditing || isDone) && (
          <Checkbox
            size="small"
            checked={isDone || itemState.selected}
            disabled={isDone || isApplying || locked}
            // Ticking a row is not editing it.
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onSelectedChange(event.target.checked)}
            color={isDone ? 'success' : 'primary'}
            inputProps={{ 'aria-label': `Apply: ${primary}` }}
            data-testid={testIds.rowCheckbox(recommendation.id)}
            sx={{
              p: 0.5,
              mt: -0.25,
              // A settled row is disabled, and MUI paints a disabled checkbox in action.disabled;
              // keep the green — that is how this row now says it is in the chart — but keep it faded
              // too, so it still reads as something there is nothing left to do to.
              ...(isDone ? { '&.Mui-disabled.Mui-checked': { color: 'success.main', opacity: 0.55 } } : {}),
            }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {isEditing ? (
          <RecommendationEditor
            recommendation={recommendation}
            templates={templates}
            rowRef={rowRef}
            onCommit={closeEditor}
          />
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              {/* The finding leads the line — "R: Eyes: Discharge" is the order it is read in —
                  as the single coloured letter the Review of Systems screen heads its columns
                  with. It sits in a fixed column of its own so the findings line up to skim down
                  and a long system name wraps under itself rather than under the letter. */}
              {recommendation.kind === 'ros' && (
                <Typography
                  variant="body2"
                  data-testid={testIds.rowFinding(recommendation.id)}
                  sx={{ flexShrink: 0, width: 16, fontWeight: 600, color: ROS_FINDING_COLOR[recommendation.finding] }}
                >
                  {`${rosFindingLetter(recommendation.finding)}:`}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
                <Typography
                  variant="body2"
                  data-testid={testIds.rowText(recommendation.id)}
                  sx={{
                    fontWeight: 500,
                    overflowWrap: 'anywhere',
                    // Unticked is struck out rather than dimmed: it says "not going in" in the
                    // same hand the narrative above strikes the same item out in.
                    ...(!itemState.selected && !isDone
                      ? { textDecoration: 'line-through', color: 'text.secondary' }
                      : {}),
                  }}
                >
                  {primary}
                </Typography>
                {recommendation.kind === 'diagnosis' && recommendation.isPrimary && (
                  <Chip
                    size="small"
                    label="Primary"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
                {charted && !isApplied && (
                  <Tooltip title="Already in the chart, so it won't be added again">
                    <Chip size="small" label="Already charted" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  </Tooltip>
                )}
              </Box>
            </Box>
            {secondary && (
              <Typography variant="caption" color="text.secondary">
                {secondary}
              </Typography>
            )}
          </>
        )}

        {/* An applied row that the executor has something to say about says it: charted as secondary
            because a primary was already set, auto-picked from several near matches, filed as free text.
            Amber when the pick or the inference is the executor's rather than the transcript's. */}
        {isApplied && (itemState.note || itemState.lowConfidence) && (
          <Typography
            variant="caption"
            color={itemState.lowConfidence ? 'warning.main' : 'text.secondary'}
            data-testid={testIds.rowNote(recommendation.id)}
          >
            {itemState.note ?? 'Picked by the assistant from several near matches — verify.'}
          </Typography>
        )}

        {/* A failed row says why in red; a skipped one says why nothing was written, in grey. Both
            offer another go — the provider may have fixed the wording, or ticked it back on. */}
        {(itemState.status === 'error' || itemState.status === 'skipped') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color={itemState.status === 'error' ? 'error' : 'text.secondary'}>
              {itemState.status === 'error'
                ? itemState.error ?? 'Could not apply.'
                : itemState.reason ?? 'Nothing was written.'}
            </Typography>
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onRetry();
              }}
              disabled={locked}
              sx={{ textTransform: 'none', minWidth: 0, p: 0, fontSize: 12 }}
              data-testid={testIds.rowRetryButton(recommendation.id)}
            >
              Retry
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        {/* The caution has to be readable without hovering, so the flag stays on the row even
            though the sentence behind it has moved into the hover. */}
        {warning && !isEditing && (
          <WarningAmberOutlinedIcon
            role="img"
            aria-hidden={false}
            aria-label={warning}
            sx={{ fontSize: 16, color: 'warning.main' }}
          />
        )}
        {renderStatus()}
        {canStartEditing && (
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              startEditingUnlessAnotherIsOpen(editingKey);
            }}
            aria-label={`Edit: ${primary}`}
            data-testid={testIds.rowEditButton(recommendation.id)}
            // Hidden until the line is under the pointer (or holds focus, for the keyboard).
            sx={{ p: 0.5, ...HOVER_ONLY }}
          >
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  // The "why" is the hover on the line itself now — no "i" to press, and nothing pinned open
  // pushing the rest of the list down. The tooltip stays wrapped around the row even when there is
  // nothing to say — it just stops listening — because unwrapping it would hand React a different
  // element and remount the row's DOM out from under whoever is holding it, the editor included.
  // An empty title is MUI's own way of saying there is nothing to show: it closes a tooltip that
  // is already up, which is what starting an edit under the pointer has to do.
  const title = !showProvenance || hideProvenance || isEditing ? '' : <ProvenanceContent {...provenance} />;
  return (
    <Tooltip title={title} placement="left" enterDelay={300}>
      {row}
    </Tooltip>
  );
};

export interface RecommendationEditorProps {
  recommendation: ScribeRecommendation;
  templates: TemplateOption[];
  /** The line the editor sits on: a click anywhere on it, the tick included, is not a click away. */
  rowRef: RefObject<HTMLElement>;
  /**
   * Closes the editor, with the change to keep or nothing if the fields still say what they said.
   * Fired exactly once, by whichever way out the provider takes.
   */
  onCommit: (patch?: Partial<ScribeRecommendation>) => void;
}

/** A dropdown of the ICD-10 or template picker is portalled out of the row, but is still the editor. */
const isInPicker = (target: EventTarget | Element | null): boolean =>
  target instanceof Element && Boolean(target.closest('.MuiAutocomplete-popper'));

/**
 * Inline editor for the parts of a recommendation a provider is likely to want to correct.
 *
 * There is no Save and no Cancel: the way out is to look somewhere else, and what the fields say
 * when that happens is what is kept. Every exit — clicking off the line, tabbing off it, Enter,
 * Escape, another row taking the editor, the popover closing — runs through the one commit.
 */
export const RecommendationEditor: FC<RecommendationEditorProps> = ({
  recommendation,
  templates,
  rowRef,
  onCommit,
}) => {
  const id = recommendation.id;
  const [text, setText] = useState(() => {
    switch (recommendation.kind) {
      case 'hpi':
        return recommendation.text;
      case 'allergy':
      case 'medication':
        return recommendation.name;
      case 'vital-weight':
        return String(recommendation.weightLbs);
      default:
        return '';
    }
  });
  const [finding, setFinding] = useState<RosFindingState>(
    recommendation.kind === 'ros' ? recommendation.finding : RosFindingState.Reports
  );
  const [template, setTemplate] = useState<TemplateOption | null>(() =>
    recommendation.kind === 'template'
      ? templates.find((t) => t.label.toLowerCase() === recommendation.templateName.toLowerCase()) ?? null
      : null
  );
  const [diagnosis, setDiagnosis] = useState<IcdSearchResponse['codes'][number] | null>(null);

  /** What the fields say, as a patch — an emptied field keeps the old value rather than wiping it. */
  const edit = (): Partial<ScribeRecommendation> => {
    switch (recommendation.kind) {
      case 'hpi':
        return { text: text.trim() || recommendation.text };
      case 'allergy':
      case 'medication':
        return { name: text.trim() || recommendation.name };
      case 'vital-weight': {
        const weightLbs = Number(text);
        return { weightLbs: Number.isFinite(weightLbs) && weightLbs > 0 ? weightLbs : recommendation.weightLbs };
      }
      case 'ros':
        return { finding };
      case 'template':
        return { templateName: template?.label ?? recommendation.templateName };
      case 'diagnosis':
        return diagnosis
          ? { code: diagnosis.code, display: diagnosis.display, transcriptTerm: recommendation.transcriptTerm }
          : {};
      case 'action':
        return {};
    }
  };

  const hasCommitted = useRef(false);
  const commit = (): void => {
    // Click-away and blur can both fire on the way out; the first one out is the one that counts.
    if (hasCommitted.current) return;
    hasCommitted.current = true;
    const patch = edit();
    // Opening a line and leaving it alone is not an edit, and mustn't be recorded as one: the
    // narrative reads the AI's own wording back until the provider actually changes something.
    const changed = Object.entries(patch).some(
      ([key, value]) => (recommendation as unknown as Record<string, unknown>)[key] !== value
    );
    onCommit(changed ? patch : undefined);
  };

  // Whatever takes the editor away — another row, the popover closing — saves it on the way.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  // Armed a beat after mounting, because React's StrictMode tears a fresh mount effect down and
  // sets it up again in the same tick as the mount: committing on that simulated unmount closed
  // the editor in the very tick the click opened it, and the row read as unclickable. Nothing can
  // have been typed in the beat before arming, so nothing is lost by waiting for it.
  const isArmed = useRef(false);
  useEffect(() => {
    const arm = setTimeout(() => (isArmed.current = true), 0);
    return () => {
      clearTimeout(arm);
      if (isArmed.current) commitRef.current();
    };
  }, []);

  // Escape has to work even when the focus has slipped out of the editor — the ICD-10 picker
  // blurs the field the moment a code is chosen — so it is listened for on the document rather
  // than on the editor alone. Anything that has already answered the key (a picker closing its
  // dropdown, the popover closing itself) stops it or marks it handled before it gets here.
  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) commitRef.current();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  const onKeyDown = (event: KeyboardEvent): void => {
    // Escape leaves the editor like everything else does: by keeping what is in the fields.
    if (event.key === 'Escape') commit();
    // Enter commits single-line edits; in the multiline HPI editor it inserts a line break.
    if (event.key === 'Enter' && recommendation.kind !== 'hpi') {
      event.preventDefault();
      commit();
    }
  };

  // Tabbing off the line commits it; focus moving into the row's own tick, or into a picker's
  // dropdown, is still inside the editor. A blur to nothing is left to the click-away.
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (next && !rowRef.current?.contains(next) && !isInPicker(next)) commit();
  };

  const textField = (
    label: string,
    extra?: { multiline?: boolean; adornment?: string; type?: string }
  ): JSX.Element => (
    <TextField
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      label={label}
      size="small"
      fullWidth
      autoFocus
      multiline={extra?.multiline}
      minRows={extra?.multiline ? 2 : undefined}
      type={extra?.type}
      inputProps={{
        'data-testid': testIds.rowEditInput(id),
        inputMode: extra?.type === 'number' ? 'decimal' : undefined,
      }}
      InputProps={
        extra?.adornment
          ? { endAdornment: <InputAdornment position="end">{extra.adornment}</InputAdornment> }
          : undefined
      }
    />
  );

  const renderField = (): JSX.Element => {
    switch (recommendation.kind) {
      case 'hpi':
        return textField('HPI text', { multiline: true });
      case 'allergy':
        return textField('Allergy');
      case 'medication':
        return textField('Medication');
      case 'vital-weight':
        return textField('Weight', { adornment: 'lbs', type: 'number' });
      case 'ros':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              {recommendation.systemLabel}: {recommendation.label}
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={finding}
              onChange={(_event, value: RosFindingState | null) => value && setFinding(value)}
              aria-label="Finding"
            >
              {/* The same two letters, in the same two colours, the row and the Review of
                  Systems screen show the finding as. */}
              <ToggleButton
                value={RosFindingState.Denies}
                color="success"
                aria-label="Denies"
                sx={{ py: 0.25, px: 1.25, fontWeight: 600, color: ROS_FINDING_COLOR[RosFindingState.Denies] }}
              >
                {rosFindingLetter(RosFindingState.Denies)}
              </ToggleButton>
              <ToggleButton
                value={RosFindingState.Reports}
                color="error"
                aria-label="Reports"
                sx={{ py: 0.25, px: 1.25, fontWeight: 600, color: ROS_FINDING_COLOR[RosFindingState.Reports] }}
              >
                {rosFindingLetter(RosFindingState.Reports)}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        );
      case 'template':
        return (
          <Autocomplete
            size="small"
            options={templates.filter((t) => t.isCurrentVersion)}
            value={template}
            onChange={(_event, value) => setTemplate(value)}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Template"
                autoFocus
                inputProps={{ ...params.inputProps, 'data-testid': testIds.rowEditInput(id) }}
              />
            )}
            noOptionsText={templates.length === 0 ? 'Loading templates…' : 'No templates found'}
          />
        );
      case 'diagnosis':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Replace {recommendation.display} ({recommendation.code}) with:
            </Typography>
            <DiagnosesField
              onChange={(value) => setDiagnosis(value)}
              value={diagnosis}
              disableForPrimary={false}
              label="Search ICD-10"
              placeholder="Diagnosis"
            />
          </Box>
        );
      // Not reachable from the row, which never opens an editor for this kind; here for the type's sake.
      case 'action':
        return (
          <Typography variant="body2" color="text.secondary">
            This item can’t be edited here.
          </Typography>
        );
    }
  };

  // Every way out but one is a keystroke, and a keystroke only reaches the editor if something
  // inside it holds the focus. A text field takes it itself (autoFocus), but the R/D toggles and
  // the ICD-10 search don't, and a row opened by clicking its text leaves the focus on the body —
  // where Escape and Tab have nothing to act on. So the editor takes the focus if nothing in it
  // has: the control that is already the answer where there is one, the first control otherwise.
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.contains(document.activeElement)) return;
    const control =
      editor.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      editor.querySelector<HTMLElement>('input, button, textarea');
    control?.focus();
  }, []);

  return (
    <ClickAwayListener
      onClickAway={(event) => {
        // Anywhere on the line — or in a dropdown the line put on screen — is still in here.
        if (rowRef.current?.contains(event.target as Node) || isInPicker(event.target)) return;
        commit();
      }}
    >
      <Box ref={editorRef} onBlur={onBlur} sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 0.5 }}>
        {renderField()}
      </Box>
    </ClickAwayListener>
  );
};
