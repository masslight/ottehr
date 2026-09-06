import { Autocomplete, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { LacerationWound } from 'utils/lib/procedure-coding/facts.types';
import {
  FamilyManifest,
  isFieldVisible,
  RepeatableGroupManifest,
  SimpleFieldManifest,
} from 'utils/lib/procedure-coding/manifests';
import { LacerationWoundsField, OptionSelect } from './LacerationWoundsField';

/** The family facts object, treated generically by the renderer. */
export type FactsRecord = Record<string, unknown>;

interface StructuredFactsFieldsProps {
  manifest: FamilyManifest;
  facts: FactsRecord;
  onChange: (next: FactsRecord) => void;
  isReadOnly: boolean;
}

// Facts times persist as HH:MM 24-hour strings; these convert at the TimePicker boundary.
const timeStringToDateTime = (value: unknown): DateTime | null =>
  typeof value === 'string' ? DateTime.fromFormat(value, 'HH:mm') : null;

const dateTimeToTimeString = (value: DateTime | null): string | undefined =>
  value?.isValid ? value.toFormat('HH:mm') : undefined;

// Changing a controlling fact drops the values of dependent fields it just hid,
// so a stale answer (e.g. slit-lamp after switching sites) can't steer the tables.
const clearHiddenFields = (fields: SimpleFieldManifest[], record: FactsRecord): FactsRecord => {
  const next = { ...record };
  for (const field of fields) {
    if (field.visibleWhen != null && next[field.name] !== undefined && !isFieldVisible(field.visibleWhen, next)) {
      delete next[field.name];
    }
  }
  return next;
};

/**
 * Renders a family manifest's fields into the procedure form, mirroring the
 * page's existing MUI field styles. The laceration wound map delegates to
 * LacerationWoundsField.
 */
export function StructuredFactsFields({
  manifest,
  facts,
  onChange,
  isReadOnly,
}: StructuredFactsFieldsProps): ReactElement {
  const simpleFields = manifest.fields.filter(
    (field): field is SimpleFieldManifest => field.kind !== 'repeatable-group' && field.kind !== 'wound-map'
  );
  const setFact = (name: string, value: unknown): void =>
    onChange(clearHiddenFields(simpleFields, { ...facts, [name]: value }));

  const simpleField = (
    field: SimpleFieldManifest,
    record: FactsRecord,
    setValue: (value: unknown) => void
  ): ReactElement | null => {
    if (!isFieldVisible(field.visibleWhen, record)) {
      return null;
    }
    const testId = dataTestIds.documentProcedurePage.structuredFactField(field.name);
    const rawValue = record[field.name];
    switch (field.kind) {
      case 'select':
        return (
          <OptionSelect
            key={field.name}
            label={field.label}
            labelId={field.label}
            options={field.options ?? []}
            fullWidth
            sx={{ backgroundColor: 'white' }}
            value={(rawValue as string) ?? ''}
            onChange={setValue}
            disabled={isReadOnly}
            testId={testId}
          />
        );
      case 'multiselect':
        return (
          <Autocomplete
            key={field.name}
            multiple
            disableCloseOnSelect
            options={field.options ?? []}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            value={(field.options ?? []).filter((option) => ((rawValue as string[]) ?? []).includes(option.value))}
            onChange={(_e, newValues) => setValue(newValues.map((option) => option.value))}
            renderInput={(params) => <TextField {...params} label={field.label} data-testid={testId} />}
            disabled={isReadOnly}
          />
        );
      case 'checkbox':
        return (
          <FormControlLabel
            key={field.name}
            control={
              <Checkbox
                // Unchecked IS a determination: gate rows key on false, so the
                // fact stores an explicit boolean rather than dropping to undefined.
                checked={rawValue === true}
                onChange={(_e, checked) => setValue(checked)}
                data-testid={testId}
              />
            }
            label={field.label}
            disabled={isReadOnly}
          />
        );
      case 'number':
        return (
          <TextField
            key={field.name}
            label={field.label}
            size="small"
            type="number"
            inputProps={{ min: 0, step: field.scale != null ? 1 / field.scale : 1 }}
            value={typeof rawValue === 'number' ? rawValue / (field.scale ?? 1) : ''}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              // Facts declare these as integers (counts, or tenths for scaled fields).
              setValue(Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * (field.scale ?? 1)) : undefined);
            }}
            disabled={isReadOnly}
            data-testid={testId}
          />
        );
      case 'time':
        return (
          <LocalizationProvider dateAdapter={AdapterLuxon} key={field.name}>
            <TimePicker
              label={field.label}
              slotProps={{
                textField: {
                  InputLabelProps: { shrink: true },
                  InputProps: { size: 'small' },
                  // The picker root does not forward data-* attributes; the testid rides on the input.
                  inputProps: { 'data-testid': testId },
                },
              }}
              value={timeStringToDateTime(rawValue)}
              onChange={(time: DateTime | null) => setValue(dateTimeToTimeString(time))}
              disabled={isReadOnly}
            />
          </LocalizationProvider>
        );
      case 'text':
      default:
        return (
          <TextField
            key={field.name}
            label={field.label}
            size="small"
            value={(rawValue as string) ?? ''}
            onChange={(e) => setValue(e.target.value !== '' ? e.target.value : undefined)}
            disabled={isReadOnly}
            data-testid={testId}
          />
        );
    }
  };

  const repeatableGroup = (field: RepeatableGroupManifest): ReactElement => {
    const storedItems = (facts[field.name] as FactsRecord[] | undefined) ?? [];
    // Common case is a single row, so an empty group renders one blank row to fill in.
    const items = storedItems.length > 0 ? storedItems : [{}];
    const setItems = (next: FactsRecord[]): void => setFact(field.name, next.length > 0 ? next : undefined);
    return (
      <Box key={field.name} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {field.label}
        </Typography>
        {items.map((item, index) => (
          <Stack key={index} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {field.itemFields.map((itemField) =>
              simpleField(itemField, item, (value) => {
                const nextItems = [...items];
                nextItems[index] = clearHiddenFields(field.itemFields, { ...item, [itemField.name]: value });
                setItems(nextItems);
              })
            )}
            {!isReadOnly && items.length > 1 && (
              <DeleteIconButton onClick={() => setItems(items.filter((_item, itemIndex) => itemIndex !== index))} />
            )}
          </Stack>
        ))}
        {!isReadOnly && (
          <Button
            size="small"
            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            onClick={() => setItems([...items, {}])}
          >
            {field.addLabel}
          </Button>
        )}
      </Box>
    );
  };

  return (
    <>
      {manifest.fields.map((field) => {
        if (field.kind === 'wound-map') {
          return (
            <LacerationWoundsField
              key={field.name}
              manifest={field}
              wounds={facts[field.name] as Record<string, LacerationWound[]> | undefined}
              onChange={(wounds) => setFact(field.name, wounds)}
              isReadOnly={isReadOnly}
            />
          );
        }
        if (field.kind === 'repeatable-group') {
          return repeatableGroup(field);
        }
        return simpleField(field, facts, (value) => setFact(field.name, value));
      })}
    </>
  );
}
