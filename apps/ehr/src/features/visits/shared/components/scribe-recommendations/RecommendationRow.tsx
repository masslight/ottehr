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
  FormControlLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, FocusEvent, KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { DiagnosesField } from '../assessment-tab/DiagnosesField';
import { TemplateOption } from '../templates/useListTemplates';
import { actionEditPatch, editableActionText, withEditedText } from './actionEdits';
import { resolveExamFinding } from './analysis';
import { NOTE_MODE_MENU_CLASS, NoteModeChip } from './NoteModeChip';
import { hasProvenance, ProvenanceContent } from './Provenance';
import {
  RecommendationItemState,
  startEditingUnlessAnotherIsOpen,
  useScribeRecommendationsStore,
} from './scribeRecommendations.store';
import {
  describeExamResolution,
  describeRecommendation,
  examLeafLabel,
  HPI_FIELD,
  resolvedExamLeaf,
  rosFindingLetter,
} from './scribeSections';
import { AI_SURFACE } from './ScribeStage';
import { scaled } from './scribeTheme';
import { ExamRecommendation, ScribeRecommendation } from './types';

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
}

const testIds = dataTestIds.scribeRecommendations;

/** Hooks the row's hover state so the pencil can hide until the pointer (or focus) is on the line. */
export const ROW_CLASS = 'scribe-row';

/** Matches the Review of Systems table's column colours. */
const ROS_FINDING_COLOR: Record<RosFindingState, string> = {
  [RosFindingState.Reports]: 'error.main',
  [RosFindingState.Denies]: 'success.main',
};

/** sx that shows a control only while its row is hovered or focused. */
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
}) => {
  const editingKey = recommendation.id;
  const rowRef = useRef<HTMLDivElement>(null);
  const isEditing = useScribeRecommendationsStore((state) => state.editingId === editingKey);
  const setEditingId = useScribeRecommendationsStore((state) => state.setEditingId);
  const isHighlighted = useScribeRecommendationsStore((state) => state.hoveredItemId === recommendation.id);
  const setHoveredItemId = useScribeRecommendationsStore((state) => state.setHoveredItemId);
  const { primary, secondary, detail } = describeRecommendation(recommendation);
  const isApplied = itemState.status === 'applied';
  const isApplying = itemState.status === 'applying';
  // Settled either way: this panel wrote it, or it was there already.
  const isDone = isApplied || charted;
  // Every pending row opens; a coded action (E&M level, coded history item) opens onto just its tick.
  const canEdit = !isDone && !isApplying && !locked;

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

  const provenance = {
    warning,
    note: detail,
    evidence: recommendation.evidence,
    transcriptSources: recommendation.transcriptSources,
    chartSources: recommendation.chartSources,
    evidenceOrigin: recommendation.evidenceOrigin,
  };
  const showProvenance = hasProvenance(provenance);

  const renderStatus = (): JSX.Element | null => {
    if (isApplying) {
      return (
        <CircularProgress size={scaled(18)} data-testid={testIds.rowStatus(recommendation.id)} aria-label="Applying" />
      );
    }
    // No icon once applied; the checkbox turns green instead.
    if (itemState.status === 'skipped') {
      return (
        <Tooltip title={itemState.reason ?? 'Nothing was written'}>
          <SkipNextIcon
            color="disabled"
            sx={{ fontSize: scaled(20) }}
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
            sx={{ fontSize: scaled(20) }}
            data-testid={testIds.rowStatus(recommendation.id)}
            aria-label="Failed"
          />
        </Tooltip>
      );
    }
    return null;
  };

  const canStartEditing = canEdit && !isEditing;
  // A pending row shows its checkbox only in the editor; a note row uses its mode chip instead.
  const showCheckbox = (isEditing && recommendation.kind !== 'hpi') || isDone;

  // Closing saves; no patch means the row was left untouched.
  const closeEditor = (patch?: Partial<ScribeRecommendation>): void => {
    if (patch) onEdit(patch);
    // Only if this row still holds the editor: another row may have just taken it.
    if (useScribeRecommendationsStore.getState().editingId === editingKey) setEditingId(undefined);
  };

  const row = (
    <Box
      ref={rowRef}
      className={ROW_CLASS}
      data-testid={testIds.row(recommendation.id)}
      onMouseEnter={() => setHoveredItemId(recommendation.id)}
      onMouseLeave={() => setHoveredItemId(undefined)}
      // The whole line opens the editor; the pencil is only a hint.
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
      {/* Fixed-width slot so a settled row's checkbox doesn't shift the text. */}
      <Box sx={{ width: scaled(28), flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {showCheckbox && (
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
              // MUI greys out a disabled checkbox; keep a settled row's green, faded.
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
              {/* The R/D finding letter, in a fixed column so long system names wrap under themselves. */}
              {recommendation.kind === 'ros' && (
                <Typography
                  variant="body2"
                  data-testid={testIds.rowFinding(recommendation.id)}
                  sx={{
                    flexShrink: 0,
                    width: scaled(16),
                    fontWeight: 600,
                    color: ROS_FINDING_COLOR[recommendation.finding],
                  }}
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
                    // Struck out, matching how the narrative marks an unticked item.
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
                    sx={{ height: scaled(20), fontSize: scaled(11) }}
                  />
                )}
                {charted && !isApplied && (
                  <Tooltip title="Already in the chart, so it won't be added again">
                    <Chip
                      size="small"
                      label="Already charted"
                      variant="outlined"
                      sx={{ height: scaled(20), fontSize: scaled(11) }}
                    />
                  </Tooltip>
                )}
                {/* A note row's tick is its mode chip. */}
                {recommendation.kind === 'hpi' && !isDone && (
                  <NoteModeChip
                    id={recommendation.id}
                    mode={itemState.noteMode ?? 'append'}
                    existingWords={recommendation.existingWords}
                    disabled={isApplying || locked}
                  />
                )}
              </Box>
            </Box>
            {/* An exam row's secondary is a prediction; once applied, the executor's note says where it landed. */}
            {secondary && !(recommendation.kind === 'exam' && isApplied) && (
              <Typography
                variant="caption"
                color="text.secondary"
                data-testid={recommendation.kind === 'exam' ? testIds.examLeaf(recommendation.id) : undefined}
              >
                {secondary}
              </Typography>
            )}
          </>
        )}

        {/* Executor remark on an applied row; amber when the executor picked or inferred it. */}
        {isApplied && (itemState.note || itemState.lowConfidence) && (
          <Typography
            variant="caption"
            color={itemState.lowConfidence ? 'warning.main' : 'text.secondary'}
            data-testid={testIds.rowNote(recommendation.id)}
          >
            {itemState.note ?? 'Picked by the assistant from several near matches — verify.'}
          </Typography>
        )}

        {/* Failed (red) and skipped (grey) rows say why and offer a retry. */}
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
              sx={{ textTransform: 'none', minWidth: 0, p: 0, fontSize: scaled(12) }}
              data-testid={testIds.rowRetryButton(recommendation.id)}
            >
              Retry
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        {/* The warning flag stays visible without hovering; its text is in the tooltip. */}
        {warning && !isEditing && (
          <WarningAmberOutlinedIcon
            role="img"
            aria-hidden={false}
            aria-label={warning}
            sx={{ fontSize: scaled(16), color: 'warning.main' }}
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
            sx={{ p: 0.5, ...HOVER_ONLY }}
          >
            <EditOutlinedIcon sx={{ fontSize: scaled(18) }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  // Keep the Tooltip wrapper even with nothing to show: unwrapping would remount the row, editor included.
  // An empty title disables it and closes one already open, e.g. when an edit starts under the pointer.
  const title = !showProvenance || isEditing ? '' : <ProvenanceContent {...provenance} />;
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
  /** Called exactly once when the editor closes, with the patch, or undefined if nothing changed. */
  onCommit: (patch?: Partial<ScribeRecommendation>) => void;
}

/** Portalled dropdowns (the ICD-10 and template pickers, the note mode menu) count as inside the editor. */
const isInPopup = (target: EventTarget | Element | null): boolean =>
  target instanceof Element && Boolean(target.closest(`.MuiAutocomplete-popper, .${NOTE_MODE_MENU_CLASS}`));

/**
 * Inline recommendation editor with no Save or Cancel: every exit (click-away, Tab, Enter, Escape, another
 * row opening, the popover closing) commits what the fields say.
 */
export const RecommendationEditor: FC<RecommendationEditorProps> = ({
  recommendation,
  templates,
  rowRef,
  onCommit,
}) => {
  const id = recommendation.id;
  const noteMode = useScribeRecommendationsStore((state) => state.itemState[id]?.noteMode ?? 'append');
  const [text, setText] = useState(() => {
    switch (recommendation.kind) {
      case 'hpi':
        return recommendation.text;
      case 'allergy':
      case 'medication':
        return recommendation.name;
      case 'vital-weight':
        return String(recommendation.weightLbs);
      case 'exam':
        return recommendation.display;
      case 'action':
        return editableActionText(recommendation.action)?.value ?? '';
      default:
        return '';
    }
  });
  const [finding, setFinding] = useState<RosFindingState>(
    recommendation.kind === 'ros' ? recommendation.finding : RosFindingState.Reports
  );
  // Field of the box picked among an exam row's near-equal matches; '' while unpicked.
  const [chosenField, setChosenField] = useState<string>(
    recommendation.kind === 'exam' ? resolvedExamLeaf(recommendation)?.field ?? '' : ''
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
      case 'exam':
        return examEdit(recommendation);
      case 'template':
        return { templateName: template?.label ?? recommendation.templateName };
      case 'diagnosis':
        return diagnosis
          ? { code: diagnosis.code, display: diagnosis.display, transcriptTerm: recommendation.transcriptTerm }
          : {};
      case 'action': {
        // Wording that doesn't parse keeps the old value, like an emptied field.
        const edited = withEditedText(recommendation.action, text);
        return edited ? actionEditPatch(edited) : {};
      }
    }
  };

  /**
   * New wording is resolved afresh, dropping the old synonyms and pick; the same wording with a new pick records
   * it. Returns only what changed, since a fresh resolution object would always read as an edit.
   */
  const examEdit = (rec: ExamRecommendation): Partial<ExamRecommendation> => {
    const next = text.trim();
    if (next && next !== rec.display) {
      return { display: next, searchTerms: undefined, resolution: resolveExamFinding(next, undefined) };
    }
    if (rec.resolution.kind !== 'ambiguous' || chosenField === (rec.resolution.chosen?.field ?? '')) return {};
    const chosen = rec.resolution.alternatives.find((leaf) => leaf.field === chosenField);
    return chosen ? { resolution: { ...rec.resolution, chosen } } : {};
  };

  const hasCommitted = useRef(false);
  const commit = (): void => {
    // Click-away and blur can both fire on the way out; only the first commits.
    if (hasCommitted.current) return;
    hasCommitted.current = true;
    const patch = edit();
    // An untouched row is not an edit, so the narrative keeps showing the AI's wording.
    const changed = Object.entries(patch).some(
      ([key, value]) => (recommendation as unknown as Record<string, unknown>)[key] !== value
    );
    onCommit(changed ? patch : undefined);
  };

  // Unmounting (another row opening, the popover closing) commits too.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  // Armed a tick after mount so StrictMode's simulated unmount doesn't commit and close the editor the
  // moment it opens.
  const isArmed = useRef(false);
  useEffect(() => {
    const arm = setTimeout(() => (isArmed.current = true), 0);
    return () => {
      clearTimeout(arm);
      if (isArmed.current) commitRef.current();
    };
  }, []);

  // Listened for on the document because the ICD-10 picker blurs the field once a code is chosen.
  // Whatever already handled the key (a dropdown closing) stops it or marks it defaultPrevented.
  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) commitRef.current();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  // The HPI box and a generic row's free text (an instruction, a disposition note) are paragraphs.
  const isMultiline =
    recommendation.kind === 'hpi' ||
    (recommendation.kind === 'action' && editableActionText(recommendation.action)?.field === 'text');

  const onKeyDown = (event: KeyboardEvent): void => {
    // Escape commits too; there is no cancel.
    if (event.key === 'Escape') commit();
    // Enter commits single-line edits; in a multiline editor it inserts a line break.
    if (event.key === 'Enter' && !isMultiline) {
      event.preventDefault();
      commit();
    }
  };

  // Tabbing off the line commits it; focus moving into the row's own tick, or into a picker's
  // dropdown, is still inside the editor. A blur to nothing is left to the click-away.
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (next && !rowRef.current?.contains(next) && !isInPopup(next)) commit();
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
        return (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <NoteModeChip id={id} mode={noteMode} existingWords={recommendation.existingWords} />
            </Box>
            {textField(NOTE_FIELD_LABELS[recommendation.field ?? HPI_FIELD], { multiline: true })}
          </>
        );
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
      case 'exam': {
        const { resolution } = recommendation;
        return (
          <>
            {textField('Exam finding')}
            {/* Ambiguous match: the provider picks the box here rather than in the executor's dialog at apply
                time. Retyped words are looked up afresh when the editor closes. */}
            {resolution.kind === 'ambiguous' && text.trim() === recommendation.display ? (
              <RadioGroup
                value={chosenField}
                onChange={(_event, value) => setChosenField(value)}
                aria-label="Which exam finding did you mean?"
                data-testid={testIds.examLeafChooser(id)}
              >
                {resolution.alternatives.map((leaf) => (
                  <FormControlLabel
                    key={leaf.field}
                    value={leaf.field}
                    control={
                      <Radio size="small" sx={{ py: 0.25 }} data-testid={testIds.examLeafOption(id, leaf.field)} />
                    }
                    label={examLeafLabel(leaf)}
                    slotProps={{ typography: { variant: 'body2' } }}
                  />
                ))}
              </RadioGroup>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {text.trim() === recommendation.display
                  ? describeExamResolution(recommendation)
                  : 'The new wording is looked up when you leave the editor.'}
              </Typography>
            )}
          </>
        );
      }
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
      case 'action': {
        const editable = editableActionText(recommendation.action);
        // Coded kinds (E&M level, conditions) have no wording to edit; the editor is just the tick.
        if (!editable) {
          const { primary, secondary } = describeRecommendation(recommendation);
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                {primary}
              </Typography>
              {secondary && (
                <Typography variant="caption" color="text.secondary">
                  {secondary}
                </Typography>
              )}
            </Box>
          );
        }
        return textField(editable.label, { multiline: editable.field === 'text' });
      }
    }
  };

  // Pull focus into the editor so Escape and Tab reach it; the R/D toggles and ICD-10 search don't autofocus.
  // Prefers the pressed toggle, else the first control.
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
        // Clicks on the row or in its portalled dropdowns are inside the editor.
        if (rowRef.current?.contains(event.target as Node) || isInPopup(event.target)) return;
        commit();
      }}
    >
      <Box ref={editorRef} onBlur={onBlur} sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 0.5 }}>
        {renderField()}
      </Box>
    </ClickAwayListener>
  );
};
