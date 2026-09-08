import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Autocomplete, Box, Button, IconButton, MenuItem, Select, TextField, Tooltip, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { CMS_PLACE_OF_SERVICE_CODES, CODE_SYSTEM_CLAIM_TYPE_CODES } from 'utils/lib/helpers/rcm/constants';
import { DateInput } from '../DateInput';
import { ProcedureCodeAutocomplete } from '../ProcedureCodeAutocomplete';
import { CapsuleIcon } from './CapsuleIcon';
import { DoctorIcon } from './DoctorIcon';
import { MedicationDetailDialog, ServiceLineDrug } from './MedicationDetailDialog';
import { OrderingProviderDialog, ServiceLineOrderingProvider } from './OrderingProviderDialog';

export interface ServiceLineRow {
  cptCode: string;
  modifiers: string;
  units: string;
  charges: string;
  serviceDate: string;
  placeOfService: string;
  diagnosisPointers: number[];
  revenueCode: string;
  drug: ServiceLineDrug | null;
  orderingProvider: ServiceLineOrderingProvider | null;
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
  revenueCode: '',
  drug: null,
  orderingProvider: null,
  ...overrides,
});

interface ServiceLinesEditorProps {
  value: ServiceLineRow[];
  onChange: (rows: ServiceLineRow[]) => void;
  /** Diagnoses available for the per-line Dx pointer dropdown (1-based sequence). */
  diagnoses: DiagnosisPointerOption[];
  /** Seed date for a newly added line when there's no prior line to copy from. */
  defaultServiceDate?: string;
  claimType: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;
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
  claimType,
}: ServiceLinesEditorProps): ReactElement {
  const [drugIndex, setDrugIndex] = useState<number | null>(null);
  const [providerIndex, setProviderIndex] = useState<number | null>(null);

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
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: 76, flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 16 }}>
              {i + 1}
            </Typography>
            <Tooltip
              title={
                row.drug ? `NDC ${row.drug.ndc} · ${row.drug.quantity} ${row.drug.units}` : 'Add medication detail'
              }
            >
              <IconButton
                size="small"
                onClick={() => setDrugIndex(i)}
                aria-label="Medication detail"
                sx={{ p: 0.25, color: row.drug ? 'primary.main' : 'grey.500' }}
              >
                <CapsuleIcon sx={{ fontSize: 24 }} />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={
                row.orderingProvider
                  ? `Ordering: ${row.orderingProvider.name}${
                      row.orderingProvider.npi ? ` · NPI ${row.orderingProvider.npi}` : ''
                    }`
                  : 'Add ordering provider'
              }
            >
              <IconButton
                size="small"
                onClick={() => setProviderIndex(i)}
                aria-label="Ordering provider"
                sx={{ p: 0.25, color: row.orderingProvider ? 'primary.main' : 'grey.500' }}
              >
                <DoctorIcon sx={{ fontSize: 24 }} />
              </IconButton>
            </Tooltip>
          </Box>
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
          <DateInput
            label="Date"
            size="small"
            value={row.serviceDate}
            onChange={(value) => setRow(i, 'serviceDate', value)}
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
            renderInput={(p) => <TextField {...p} label="Place of Service" required />}
            sx={{ width: 170 }}
          />
          {claimType === 'institutional' && (
            <TextField
              size="small"
              label="Rev Code"
              value={row.revenueCode}
              onChange={(e) => setRow(i, 'revenueCode', e.target.value.replace(/[^0-9]/g, ''))}
              sx={{ width: 150 }}
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 5 }}
            />
          )}
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
          <Tooltip title="Remove">
            <IconButton
              size="small"
              color="error"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="Remove service line"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
      <Box>
        <Button size="small" onClick={addRow}>
          + Add service line
        </Button>
      </Box>
      <MedicationDetailDialog
        open={drugIndex !== null}
        value={drugIndex !== null ? value[drugIndex]?.drug ?? null : null}
        onSave={(drug) => {
          if (drugIndex !== null) setRow(drugIndex, 'drug', drug);
          setDrugIndex(null);
        }}
        onRemove={
          drugIndex !== null && value[drugIndex]?.drug
            ? () => {
                setRow(drugIndex, 'drug', null);
                setDrugIndex(null);
              }
            : undefined
        }
        onClose={() => setDrugIndex(null)}
      />
      <OrderingProviderDialog
        open={providerIndex !== null}
        value={providerIndex !== null ? value[providerIndex]?.orderingProvider ?? null : null}
        onSave={(provider) => {
          if (providerIndex !== null) setRow(providerIndex, 'orderingProvider', provider);
          setProviderIndex(null);
        }}
        onRemove={
          providerIndex !== null && value[providerIndex]?.orderingProvider
            ? () => {
                setRow(providerIndex, 'orderingProvider', null);
                setProviderIndex(null);
              }
            : undefined
        }
        onClose={() => setProviderIndex(null)}
      />
    </Box>
  );
}
