import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import React, { FC, useState } from 'react';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeDTO } from 'utils';
import { useGetCPTHCPCSSearch } from '../../../../shared/stores/appointment/appointment.queries';

interface MedicationCptCodesProps {
  cptCodes: { code: string; display: string }[];
  onChange: (codes: { code: string; display: string }[]) => void;
  isEditable: boolean;
}

export const MedicationCptCodes: FC<MedicationCptCodesProps> = ({ cptCodes, onChange, isEditable }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { debounce } = useDebounce(800);
  const { isFetching, data } = useGetCPTHCPCSSearch({ search: debouncedSearchTerm, type: 'both' });
  const searchOptions = data?.codes || [];

  const handleInputChange = (value: string): void => {
    setSearchTerm(value);
    debounce(() => {
      setDebouncedSearchTerm(value);
    });
  };

  const handleAdd = (code: CPTCodeDTO | null): void => {
    if (!code) return;
    if (cptCodes.some((c) => c.code === code.code)) return;
    onChange([...cptCodes, { code: code.code, display: code.display }]);
    setSearchTerm('');
    setDebouncedSearchTerm('');
  };

  const handleRemove = (codeToRemove: string): void => {
    onChange(cptCodes.filter((c) => c.code !== codeToRemove));
  };

  return (
    <Box>
      <Box sx={{ mb: 1 }}>
        <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>CPT / HCPCS Codes</TooltipWrapper>
      </Box>
      {isEditable && (
        <Autocomplete
          size="small"
          fullWidth
          blurOnSelect
          options={searchOptions}
          filterOptions={(x) => x}
          loading={isFetching}
          inputValue={searchTerm}
          onInputChange={(_e, value, reason) => {
            if (reason === 'input') handleInputChange(value);
            if (reason === 'clear') {
              setSearchTerm('');
              setDebouncedSearchTerm('');
            }
          }}
          onChange={(_e, value) => handleAdd(value)}
          value={null}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          noOptionsText={
            debouncedSearchTerm && debouncedSearchTerm.length > 2 && searchOptions.length === 0
              ? 'Nothing found'
              : 'Start typing to search'
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search CPT / HCPCS codes"
              placeholder="Type code or description"
              InputLabelProps={{ shrink: true }}
            />
          )}
          sx={{ mb: 1 }}
        />
      )}
      {cptCodes.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {cptCodes.map((code) => (
            <Box key={code.code} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                {code.code} {code.display}
              </Typography>
              {isEditable && <DeleteIconButton onClick={() => handleRemove(code.code)} />}
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
