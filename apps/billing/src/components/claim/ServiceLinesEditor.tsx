import { Autocomplete, Box, Button, MenuItem, Select, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { CMS_PLACE_OF_SERVICE_CODES } from 'utils';
import { ProcedureCodeAutocomplete } from '../ProcedureCodeAutocomplete';

export interface ServiceLineRow {
  cptCode: string;
  modifiers: string;
  units: string;
  charges: string;
  serviceDate: string;
  placeOfService: string;
  diagnosisPointers: number[];
}

/** A diagnosis as referenced by a service line's `diagnosisPointers` (1-based sequence + its code). */
export interface DiagnosisPointerOption {
  sequence: number;
  code: string;
}

export const emptyServiceLineRow = (overrides?: Partial<ServiceLineRow>): ServiceLineRow => ({
  cptCode: '',
  modifiers: '',
  units: '1',
  charges: '',
  serviceDate: '',
  placeOfService: '',
  diagnosisPointers: [],
  ...overrides,
});

interface ServiceLinesEditorProps {
  value: ServiceLineRow[];
  onChange: (rows: ServiceLineRow[]) => void;
  /** Diagnoses available for the per-line Dx pointer dropdown (1-based sequence). */
  diagnoses: DiagnosisPointerOption[];
  /** Seed date for a newly added line when there's no prior line to copy from. */
  defaultServiceDate?: string;
}

/**
 * Controlled editor for a claim's service lines, including the per-line diagnosis pointers
 * (CMS-1500 box 24E). Shared by the create-claim form and the claim-detail edit experience.
 */
export function ServiceLinesEditor({
  value,
  onChange,
  diagnoses,
  defaultServiceDate,
}: ServiceLinesEditorProps): ReactElement {
  const setRow = <K extends keyof ServiceLineRow>(index: number, field: K, fieldValue: ServiceLineRow[K]): void =>
    onChange(value.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)));

  const dxCode = (sequence: number): string =>
    diagnoses.find((dx) => dx.sequence === sequence)?.code ?? String(sequence);

  const addRow = (): void =>
    onChange([
      ...value,
      emptyServiceLineRow({
        serviceDate: value[0]?.serviceDate ?? defaultServiceDate ?? '',
        placeOfService: value[0]?.placeOfService ?? '',
        diagnosisPointers: diagnoses.length ? [diagnoses[0].sequence] : [],
      }),
    ]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {value.map((row, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <ProcedureCodeAutocomplete value={row.cptCode} onChange={(code) => setRow(i, 'cptCode', code)} width={150} />
          <TextField
            size="small"
            label="Mod"
            value={row.modifiers}
            onChange={(e) => setRow(i, 'modifiers', e.target.value)}
            sx={{ width: 90 }}
          />
          <TextField
            size="small"
            label="Units"
            type="number"
            value={row.units}
            onChange={(e) => setRow(i, 'units', e.target.value)}
            sx={{ width: 80 }}
          />
          <TextField
            size="small"
            label="Charges"
            type="number"
            value={row.charges}
            onChange={(e) => setRow(i, 'charges', e.target.value)}
            sx={{ width: 150 }}
          />
          <TextField
            size="small"
            label="Date"
            type="date"
            value={row.serviceDate}
            onChange={(e) => setRow(i, 'serviceDate', e.target.value)}
            sx={{ width: 160 }}
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            size="small"
            options={CMS_PLACE_OF_SERVICE_CODES}
            value={CMS_PLACE_OF_SERVICE_CODES.find((o) => o.code === row.placeOfService) ?? null}
            onChange={(_, v) => setRow(i, 'placeOfService', v?.code ?? '')}
            getOptionLabel={(o) => o.code}
            renderOption={(props, o) => (
              <Box component="li" {...props} key={o.code}>
                {o.code} - {o.display}
              </Box>
            )}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            renderInput={(p) => <TextField {...p} label="Place of Service" />}
            sx={{ width: 170 }}
          />
          <Select
            multiple
            size="small"
            displayEmpty
            // Clamp to valid sequences so MUI never warns on a pointer whose diagnosis was removed.
            value={row.diagnosisPointers.filter((p) => diagnoses.some((dx) => dx.sequence === p))}
            onChange={(e) => setRow(i, 'diagnosisPointers', e.target.value as number[])}
            renderValue={(selected) =>
              selected.length ? (
                selected.map(dxCode).join(', ')
              ) : (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  Dx
                </Box>
              )
            }
            sx={{ width: 160 }}
          >
            {diagnoses.map((dx) => (
              <MenuItem key={dx.sequence} value={dx.sequence}>
                {dx.sequence}: {dx.code}
              </MenuItem>
            ))}
          </Select>
          <Button size="small" color="error" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </Box>
      ))}
      <Box>
        <Button size="small" onClick={addRow}>
          + Add service line
        </Button>
      </Box>
    </Box>
  );
}
