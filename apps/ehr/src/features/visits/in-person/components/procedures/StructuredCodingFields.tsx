import { Add, DeleteOutline, ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, ReactNode } from 'react';
import { ProcedureFamilyModel } from 'utils/lib/procedure-coding/model.types';
import {
  CodingField,
  getStructuredFieldsData,
  StructuredFacts,
  StructuredRow,
} from 'utils/lib/procedure-coding/structured-fields';

/** Answers are read back off this form during a visit, so they are set at the body text size, not the dense
 * default: 14px grey-on-white was the complaint that prompted this. Controls stay `size="small"` to match
 * the rest of the procedure form. */
const FIELD_TEXT = { fontSize: '16px' };
const fieldSx = {
  backgroundColor: 'white',
  '& .MuiInputBase-input': FIELD_TEXT,
  '& .MuiInputLabel-root': FIELD_TEXT,
  '& .MuiFormHelperText-root': { fontSize: '13px' },
};

interface Props {
  family: ProcedureFamilyModel | undefined;
  value: StructuredFacts | undefined;
  onChange: (value: StructuredFacts) => void;
  readOnly: boolean;
  medicationUsed?: string;
}

export const StructuredCodingFields: FC<Props> = ({ family, value = {}, onChange, readOnly, medicationUsed }) => {
  const render = (
    fields: readonly CodingField[],
    answers: StructuredFacts,
    update: (next: StructuredFacts) => void
  ): ReactNode => {
    const displayed = getStructuredFieldsData({ structuredFacts: answers }, fields);
    const visibleFields = fields.filter((field) => !field.visible || field.visible(displayed));
    const details = visibleFields.filter((field) => field.details);
    if (details.length)
      return (
        <>
          {render(
            visibleFields.filter((field) => !field.details),
            answers,
            update
          )}
          <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography sx={{ ...FIELD_TEXT, fontWeight: 500, color: 'text.primary' }}>
                Additional findings and documentation
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {render(
                details.map((field) => ({ ...field, details: false })),
                answers,
                update
              )}
            </AccordionDetails>
          </Accordion>
        </>
      );
    return visibleFields.map((field) => {
      const current = displayed[field.key];
      const change = (next: StructuredFacts[string]): void => update({ ...answers, [field.key]: next });
      if (field.kind === 'rows') {
        // The page feeds this component through resolveFamilyFacts, and every family that has a
        // repeating group opens with one row ready to fill, so the ordinary visit needs no "Add" click.
        // This fallback is only for a value that arrives without rows.
        const rows = Array.isArray(current) ? current : [];

        return (
          <Box key={field.key} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 600, color: 'text.primary' }}>{field.label}</Typography>
            {rows.map((row, index) => (
              <Box
                key={index}
                sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1, backgroundColor: 'white' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography sx={{ ...FIELD_TEXT, fontWeight: 600, color: 'text.primary' }}>
                    {field.rowLabel} {index + 1}
                  </Typography>
                  {!readOnly && (
                    <Tooltip title={`Remove ${field.rowLabel.toLowerCase()} ${index + 1}`}>
                      <IconButton
                        aria-label={`Remove ${field.rowLabel} ${index + 1}`}
                        onClick={() => change(rows.filter((_, i) => i !== index))}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteOutline sx={{ fontSize: '24px' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {render(field.fields ?? [], row, (next) =>
                    change(rows.map((r, i) => (i === index ? (next as StructuredRow) : r)))
                  )}
                </Box>
              </Box>
            ))}
            {!readOnly && (
              <Button
                variant="outlined"
                sx={{ alignSelf: 'flex-start', ...FIELD_TEXT, textTransform: 'none', fontWeight: 600, px: 2, py: 1 }}
                startIcon={<Add sx={{ fontSize: '24px !important' }} />}
                onClick={() =>
                  change([
                    ...rows,
                    {
                      ...Object.fromEntries(
                        (field.fields ?? [])
                          .filter((f) => f.defaultValue !== undefined)
                          .map((f) => [f.key, f.defaultValue])
                      ),
                      ...(field.key === 'administrations' && medicationUsed ? { drug: medicationUsed } : {}),
                    },
                  ])
                }
              >
                Add {field.rowLabel.toLowerCase()}
              </Button>
            )}
          </Box>
        );
      }
      if (field.kind === 'checkbox')
        return (
          <FormControlLabel
            key={field.key}
            sx={{ alignItems: 'flex-start', m: 0 }}
            label={<Typography sx={{ ...FIELD_TEXT, color: 'text.primary', pt: '9px' }}>{field.label}</Typography>}
            control={
              <Checkbox checked={current === true} disabled={readOnly} onChange={(_, checked) => change(checked)} />
            }
          />
        );
      const unknownOption =
        field.kind === 'select' && typeof current === 'string' && current !== '' && !field.options?.includes(current);
      return (
        <TextField
          key={field.key}
          label={field.label}
          helperText={field.helperText}
          size="small"
          fullWidth
          sx={fieldSx}
          disabled={readOnly}
          select={field.kind === 'select'}
          type={field.kind === 'number' ? 'number' : field.kind === 'time' ? 'time' : 'text'}
          value={typeof current === 'string' || typeof current === 'number' ? current : ''}
          InputLabelProps={field.kind === 'time' ? { shrink: true } : undefined}
          inputProps={field.kind === 'number' ? { min: field.min, step: field.step ?? 1 } : undefined}
          onChange={(event) =>
            change(
              event.target.value === ''
                ? undefined
                : field.kind === 'number'
                ? Number(event.target.value)
                : event.target.value
            )
          }
        >
          {field.kind === 'select' && [
            <MenuItem key="empty" value="" sx={FIELD_TEXT}>
              <em>Select</em>
            </MenuItem>,
            ...(unknownOption
              ? [
                  <MenuItem key="legacy" value={String(current)} sx={FIELD_TEXT}>
                    {String(current)} (saved value)
                  </MenuItem>,
                ]
              : []),
            ...[...(field.options ?? [])]
              .sort((a, b) => a.localeCompare(b))
              .map((option) => (
                <MenuItem key={option} value={option} sx={FIELD_TEXT}>
                  {option}
                </MenuItem>
              )),
          ]}
        </TextField>
      );
    });
  };
  if (!family) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {render(family.fields, value, (next) =>
        onChange(getStructuredFieldsData({ structuredFacts: next }, family.fields))
      )}
    </Box>
  );
};
