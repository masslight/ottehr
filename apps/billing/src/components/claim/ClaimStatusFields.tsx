import { ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import {
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_GROUPS,
  ClaimStatusFieldDef,
  ClaimStatusFieldKey,
  ClaimStatusGroupDef,
  ClaimStatusValues,
  formatClaimStatusValue,
  getActiveStatusGroup,
} from 'utils';
import { otherColors } from '../../themes/ottehr/colors';

interface ClaimStatusFieldsProps {
  // Current value per status field (use empty string for None).
  values: ClaimStatusValues;
  // Called when a field changes; the parent decides whether to persist or hold in form state.
  onChange: (field: ClaimStatusFieldKey, value: string) => void;
  // Optional heading shown on the left of the toggle row.
  title?: string;
  // When set, AR Stage is marked required (asterisk + error styling until chosen).
  requireArStage?: boolean;
}

/**
 * Controlled editor for the claim status indicators. AR Stage is the top-level field and selects
 * which group's statuses are "active"; those sit inline with the AR Stage picker. The other groups
 * are hidden until expanded. Used by both the claim detail (persists each change) and the create
 * form (holds values in local state).
 */
export function ClaimStatusFields({ values, onChange, title, requireArStage }: ClaimStatusFieldsProps): ReactElement {
  const [expanded, setExpanded] = useState(false);

  const renderField = (field: ClaimStatusFieldDef): ReactElement => {
    const value = values[field.key] ?? '';
    const showError = !!requireArStage && field.key === 'arStage' && !value;
    const label = `${field.label}${field.key === 'arStage' ? ' *' : ''}`;
    return (
      <FormControl size="small" fullWidth>
        <InputLabel id={`${field.key}-label`}>{label}</InputLabel>
        <Select
          size="small"
          fullWidth
          error={showError}
          value={value}
          label={label}
          labelId={`${field.key}-label`}
          onChange={(e) => onChange(field.key, e.target.value)}
          renderValue={
            value
              ? () => formatClaimStatusValue(field, value)
              : () => (
                  <Box component="span" sx={{ color: showError ? 'error.main' : 'text.disabled' }}>
                    {showError ? 'Required' : 'None'}
                  </Box>
                )
          }
        >
          {/* Nullable fields can be cleared back to their null/default state. */}
          {field.defaultCode === null && (
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
          )}
          {field.options.map((o) => (
            <MenuItem key={o.code} value={o.code}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const fieldBox = (field: ClaimStatusFieldDef, width = 240): ReactElement => (
    <Box key={field.key} sx={{ width: { xs: '100%', sm: width } }}>
      {renderField(field)}
    </Box>
  );

  // Inactive groups (revealed when expanded) get a labelled, de-emphasized panel.
  const renderGroupPanel = (group: ClaimStatusGroupDef): ReactElement => (
    <Box
      key={group.key}
      sx={{ border: '1px solid', borderColor: otherColors.lightDivider, borderRadius: 1, p: 2, pt: 1.5, mb: 1.5 }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'text.secondary',
          fontSize: 12,
          fontWeight: 700,
          mb: 1.5,
        }}
      >
        {group.label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {CLAIM_STATUS_FIELDS.filter((f) => f.group === group.key).map((field) => fieldBox(field))}
      </Box>
    </Box>
  );

  const arStageField = CLAIM_STATUS_FIELDS.find((f) => !f.group);
  const activeGroup = getActiveStatusGroup(values.arStage);
  const activeFields = activeGroup ? CLAIM_STATUS_FIELDS.filter((f) => f.group === activeGroup.key) : [];
  const otherGroups = CLAIM_STATUS_GROUPS.filter((g) => g.key !== activeGroup?.key);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, minHeight: 32 }}>
        {title ? <Typography variant="h6">{title}</Typography> : <span />}
        <Button
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ textTransform: 'none' }}
        >
          {expanded ? 'Show active only' : 'Show all statuses'}
        </Button>
      </Box>

      {/* AR Stage + the active group's statuses share one row to keep things compact. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
        {arStageField && fieldBox(arStageField, 260)}
        {activeFields.map((field) => fieldBox(field))}
      </Box>

      {!activeGroup && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Select an AR Stage above to see its related statuses{expanded ? '.' : ', or expand to set any status.'}
        </Typography>
      )}

      {expanded && otherGroups.length > 0 && <Box sx={{ mt: 2.5 }}>{otherGroups.map(renderGroupPanel)}</Box>}
    </Box>
  );
}
