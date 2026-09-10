import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, KeyboardEvent, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { DiagnosesField } from '../assessment-tab/DiagnosesField';
import { TemplateOption } from '../templates/useListTemplates';
import { hasProvenance, ProvenanceContent, ProvenancePanel, ProvenanceToggle } from './Provenance';
import { RecommendationItemState } from './scribeRecommendations.store';
import { describeRecommendation, rosFindingLabel } from './scribeSections';
import { ScribeRecommendation } from './types';

interface RecommendationRowProps {
  recommendation: ScribeRecommendation;
  itemState: RecommendationItemState;
  /** Disables the checkbox and editing while a batch is being applied. */
  locked: boolean;
  templates: TemplateOption[];
  onSelectedChange: (selected: boolean) => void;
  onEdit: (patch: Partial<ScribeRecommendation>) => void;
  onRetry: () => void;
}

const testIds = dataTestIds.scribeRecommendations;

export const RecommendationRow: FC<RecommendationRowProps> = ({
  recommendation,
  itemState,
  locked,
  templates,
  onSelectedChange,
  onEdit,
  onRetry,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { primary, secondary, detail } = describeRecommendation(recommendation);
  const isApplied = itemState.status === 'applied';
  const isApplying = itemState.status === 'applying';
  const canEdit = !isApplied && !isApplying && !locked;

  // A template the environment doesn't have can't be applied; say so before the provider tries.
  const templateMissing =
    recommendation.kind === 'template' &&
    templates.length > 0 &&
    !templates.some((t) => t.label.toLowerCase() === recommendation.templateName.trim().toLowerCase());
  const rawWarning = templateMissing
    ? 'This template isn’t available in this environment. Edit the recommendation to pick another one.'
    : recommendation.warning;
  // Once the item is in the chart the caution has been acted on, so it stops flagging the row.
  const warning = isApplied ? undefined : rawWarning;

  const provenance = { warning, note: detail, evidence: recommendation.evidence };
  const showProvenance = hasProvenance(provenance);

  const renderStatus = (): JSX.Element | null => {
    if (isApplying) {
      return <CircularProgress size={18} data-testid={testIds.rowStatus(recommendation.id)} aria-label="Applying" />;
    }
    if (isApplied) {
      return (
        <Tooltip title="Applied to the progress note">
          <CheckCircleIcon
            color="success"
            sx={{ fontSize: 20 }}
            data-testid={testIds.rowStatus(recommendation.id)}
            aria-label="Applied"
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

  return (
    <Box
      data-testid={testIds.row(recommendation.id)}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.5,
        px: 1,
        py: 0.75,
        opacity: !itemState.selected && !isApplied ? 0.65 : 1,
        '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' },
      }}
    >
      <Checkbox
        size="small"
        checked={isApplied || itemState.selected}
        disabled={isApplied || isApplying || locked}
        onChange={(event) => onSelectedChange(event.target.checked)}
        inputProps={{ 'aria-label': `Apply: ${primary}` }}
        data-testid={testIds.rowCheckbox(recommendation.id)}
        sx={{ p: 0.5, mt: -0.25 }}
      />

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {isEditing ? (
          <RecommendationEditor
            recommendation={recommendation}
            templates={templates}
            onSave={(patch) => {
              onEdit(patch);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                {primary}
              </Typography>
              {recommendation.kind === 'ros' && (
                <Chip
                  size="small"
                  label={rosFindingLabel(recommendation.finding)}
                  color={recommendation.finding === RosFindingState.Reports ? 'error' : 'success'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
              {recommendation.kind === 'diagnosis' && recommendation.isPrimary && (
                <Chip
                  size="small"
                  label="Primary"
                  color="primary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
            </Box>
            {secondary && (
              <Typography variant="caption" color="text.secondary">
                {secondary}
              </Typography>
            )}
            <Collapse in={isDetailOpen} unmountOnExit>
              <ProvenancePanel hasWarning={Boolean(warning)} dataTestId={testIds.rowDetail(recommendation.id)}>
                <ProvenanceContent {...provenance} />
              </ProvenancePanel>
            </Collapse>
          </>
        )}

        {itemState.status === 'error' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="error">
              {itemState.error ?? 'Could not apply.'}
            </Typography>
            <Button
              size="small"
              onClick={onRetry}
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
        {showProvenance && !isEditing && (
          <ProvenanceToggle
            content={<ProvenanceContent {...provenance} />}
            isOpen={isDetailOpen}
            onToggle={() => setIsDetailOpen((open) => !open)}
            subject={primary}
            hasWarning={Boolean(warning)}
            dataTestId={testIds.rowDetailButton(recommendation.id)}
          />
        )}
        {renderStatus()}
        {canEdit && !isEditing && (
          <Tooltip title="Edit before applying">
            <IconButton
              size="small"
              onClick={() => setIsEditing(true)}
              aria-label={`Edit: ${primary}`}
              data-testid={testIds.rowEditButton(recommendation.id)}
              sx={{ p: 0.5 }}
            >
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

interface RecommendationEditorProps {
  recommendation: ScribeRecommendation;
  templates: TemplateOption[];
  onSave: (patch: Partial<ScribeRecommendation>) => void;
  onCancel: () => void;
}

/** Inline editor for the parts of a recommendation a provider is likely to want to correct. */
const RecommendationEditor: FC<RecommendationEditorProps> = ({ recommendation, templates, onSave, onCancel }) => {
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

  const save = (): void => {
    switch (recommendation.kind) {
      case 'hpi':
        return onSave({ text: text.trim() });
      case 'allergy':
      case 'medication':
        return onSave({ name: text.trim() });
      case 'vital-weight': {
        const weightLbs = Number(text);
        return onSave({
          weightLbs: Number.isFinite(weightLbs) && weightLbs > 0 ? weightLbs : recommendation.weightLbs,
        });
      }
      case 'ros':
        return onSave({ finding });
      case 'template':
        return onSave({ templateName: template?.label ?? recommendation.templateName });
      case 'diagnosis':
        return onSave(
          diagnosis
            ? { code: diagnosis.code, display: diagnosis.display, transcriptTerm: recommendation.transcriptTerm }
            : {}
        );
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onCancel();
    // Enter commits single-line edits; in the multiline HPI editor it inserts a line break.
    if (event.key === 'Enter' && recommendation.kind !== 'hpi') {
      event.preventDefault();
      save();
    }
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
              <ToggleButton value={RosFindingState.Denies} color="success" sx={{ py: 0.25, textTransform: 'none' }}>
                Denies
              </ToggleButton>
              <ToggleButton value={RosFindingState.Reports} color="error" sx={{ py: 0.25, textTransform: 'none' }}>
                Reports
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
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 0.5 }}>
      {renderField()}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
        <Button
          size="small"
          onClick={onCancel}
          startIcon={<CloseIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none' }}
          data-testid={testIds.rowEditCancelButton(id)}
        >
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={save}
          sx={{ textTransform: 'none' }}
          data-testid={testIds.rowEditSaveButton(id)}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};
