import MedicationIcon from '@mui/icons-material/Medication';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import { Autocomplete, Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import React, { FC, useCallback, useState } from 'react';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useGetCPTHCPCSSearch } from '../../features/visits/shared/stores/appointment/appointment.queries';

export interface CptCodeEntry {
  code: string;
  display: string;
  isMedication?: boolean;
  billableUnitSize?: number;
  billableUnits?: number;
}

/** The list with `code` counted `billableUnits` times; an invalid count leaves the list as it is. */
export const setCptCodeUnits = (cptCodes: CptCodeEntry[], code: string, billableUnits: number): CptCodeEntry[] =>
  Number.isInteger(billableUnits) && billableUnits > 0
    ? cptCodes.map((c) => (c.code === code ? { ...c, billableUnits } : c))
    : cptCodes;

/**
 * The list with `code` added once; with designation, the first code added becomes the medication. With counts
 * (90461 ×5), picking a code again adds one to its count instead.
 */
export const addCptCode = (
  cptCodes: CptCodeEntry[],
  code: CPTCodeDTO,
  showMedicationDesignation: boolean,
  withBillableUnits = false
): CptCodeEntry[] => {
  const existing = cptCodes.find((c) => c.code === code.code);
  if (existing) {
    return withBillableUnits ? setCptCodeUnits(cptCodes, code.code, (existing.billableUnits ?? 1) + 1) : cptCodes;
  }
  const newEntry: CptCodeEntry = { code: code.code, display: code.display };
  if (withBillableUnits) newEntry.billableUnits = 1;
  if (showMedicationDesignation && cptCodes.length === 0) newEntry.isMedication = true;
  return [...cptCodes, newEntry];
};

/** The list without `codeToRemove`; with designation, the first remaining code takes over as the medication. */
export const removeCptCode = (
  cptCodes: CptCodeEntry[],
  codeToRemove: string,
  showMedicationDesignation: boolean
): CptCodeEntry[] => {
  const remaining = cptCodes.filter((c) => c.code !== codeToRemove);
  if (showMedicationDesignation && remaining.length > 0 && !remaining.some((c) => c.isMedication)) {
    remaining[0] = { ...remaining[0], isMedication: true };
  }
  return remaining;
};

/** `code` as the medication; the others lose their designation and billing data. */
export const designateMedicationCptCode = (cptCodes: CptCodeEntry[], code: string): CptCodeEntry[] =>
  cptCodes.map((c) => (c.code === code ? { ...c, isMedication: true } : { code: c.code, display: c.display }));

interface CptCodeSearchProps {
  onPick: (code: CPTCodeDTO) => void;
  dataTestId?: string;
  autoFocus?: boolean;
}

/** The CPT / HCPCS search field on its own; picking a code hands it over and clears the field. */
export const CptCodeSearch: FC<CptCodeSearchProps> = ({ onPick, dataTestId, autoFocus }) => {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const debouncedSetSearchQuery = useCallback((value: string) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setSearchQuery(value), 800);
  }, []);

  const { isFetching, data } = useGetCPTHCPCSSearch({ search: searchQuery, type: 'both' });
  const searchOptions = data?.codes || [];

  return (
    <Autocomplete
      data-testid={dataTestId}
      size="small"
      fullWidth
      blurOnSelect
      options={searchOptions}
      filterOptions={(x) => x}
      loading={isFetching}
      inputValue={inputValue}
      onInputChange={(_e, value, reason) => {
        if (reason === 'input') {
          setInputValue(value);
          debouncedSetSearchQuery(value);
        }
        if (reason === 'clear') {
          clearTimeout(timeoutRef.current);
          setInputValue('');
          setSearchQuery('');
        }
      }}
      onChange={(_e, value) => {
        if (!value) return;
        onPick(value);
        clearTimeout(timeoutRef.current);
        setInputValue('');
        setSearchQuery('');
      }}
      value={null}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      isOptionEqualToValue={(option, value) => option.code === value.code}
      noOptionsText={
        searchQuery && searchQuery.length > 2 && searchOptions.length === 0 ? 'Nothing found' : 'Start typing to search'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          label="Search CPT / HCPCS codes"
          placeholder="Type code or description"
          InputLabelProps={{ shrink: true }}
        />
      )}
      sx={{ mb: 1 }}
    />
  );
};

interface CptCodesInputProps {
  cptCodes: CptCodeEntry[];
  onChange: (codes: CptCodeEntry[]) => void;
  isEditable: boolean;
  dataTestId?: string;
  /** When true, exactly one code is designated as the medication itself and can be re-designated from the list */
  showMedicationDesignation?: boolean;
  /** When true, each code carries a count (90461 ×5): a units field beside it, and picking a code again adds one. */
  withBillableUnits?: boolean;
}

export const CptCodesInput: FC<CptCodesInputProps> = ({
  cptCodes,
  onChange,
  isEditable,
  dataTestId,
  showMedicationDesignation = false,
  withBillableUnits = false,
}) => {
  return (
    <Box>
      <Box sx={{ mb: 1 }}>
        <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>CPT / HCPCS Codes</TooltipWrapper>
      </Box>
      {isEditable && (
        <CptCodeSearch
          dataTestId={dataTestId}
          onPick={(code) => onChange(addCptCode(cptCodes, code, showMedicationDesignation, withBillableUnits))}
        />
      )}
      {cptCodes.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {cptCodes.map((code) => (
            <Box key={code.code} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {showMedicationDesignation &&
                  (code.isMedication ? (
                    <Tooltip title="This code is the medication">
                      <MedicationIcon fontSize="small" color="primary" />
                    </Tooltip>
                  ) : isEditable ? (
                    <Tooltip title="Mark as medication">
                      <IconButton
                        size="small"
                        sx={{ p: 0 }}
                        onClick={() => onChange(designateMedicationCptCode(cptCodes, code.code))}
                      >
                        <MedicationOutlinedIcon fontSize="small" color="disabled" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Box sx={{ width: 20 }} />
                  ))}
                <Typography variant="body2">
                  {code.code} {code.display}
                </Typography>
              </Box>
              {withBillableUnits && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    ×
                  </Typography>
                  {isEditable ? (
                    <TextField
                      type="number"
                      size="small"
                      value={code.billableUnits ?? 1}
                      onChange={(event) => onChange(setCptCodeUnits(cptCodes, code.code, Number(event.target.value)))}
                      inputProps={{ min: 1, step: 1, 'aria-label': `Units for ${code.code}`, style: { width: 40 } }}
                    />
                  ) : (
                    <Typography variant="body2">{code.billableUnits ?? 1}</Typography>
                  )}
                </Box>
              )}
              {isEditable && (
                <DeleteIconButton
                  onClick={() => onChange(removeCptCode(cptCodes, code.code, showMedicationDesignation))}
                />
              )}
            </Box>
          ))}
        </Box>
      ) : (
        !isEditable && (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            No CPT codes
          </Typography>
        )
      )}
    </Box>
  );
};
