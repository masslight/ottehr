import { Close } from '@mui/icons-material';
import { Autocomplete, Box, IconButton, TextField } from '@mui/material';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { PopoverBlank, Sentence } from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

const CodeSearch: React.FC<{ selected: CPTCodeDTO[]; onPick: (code: CPTCodeDTO) => void }> = ({ selected, onPick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isFetching, data } = useGetCPTHCPCSSearch({ search: searchTerm, type: 'both' });
  const options: CPTCodeDTO[] = searchTerm
    ? (data?.codes ?? []).filter((option) => !selected.some((code) => code.code === option.code))
    : [];
  const { debounce, clear } = useDebounce(800);
  // A search typed just before the popover closes must not land on the unmounted field.
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => () => clearRef.current(), []);

  return (
    <Autocomplete
      size="small"
      fullWidth
      openOnFocus
      filterOptions={(x) => x}
      noOptionsText={searchTerm ? 'Nothing found for this search criteria' : 'Start typing to load results'}
      value={null}
      options={options}
      loading={isFetching}
      getOptionLabel={(option) => `${option.code} ${option.display}`}
      onChange={(_event, option) => option && onPick({ code: option.code, display: option.display })}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search CPT / HCPCS codes"
          onChange={(e) => debounce(() => setSearchTerm(e.target.value))}
        />
      )}
      sx={{ width: 360, maxWidth: '100%', pt: 0.5 }}
    />
  );
};

interface DmeBillingCodesSentenceProps {
  value: CPTCodeDTO[];
  onChange: (value: CPTCodeDTO[]) => void;
  readOnly: boolean;
  dataTestId?: string;
}

/** "CPT / HCPCS codes: L4361 Walking boot; … + another", the same pattern as the diagnosis sentence. */
export const DmeBillingCodesSentence: React.FC<DmeBillingCodesSentenceProps> = ({
  value,
  onChange,
  readOnly,
  dataTestId,
}) => (
  <Sentence dataTestId={dataTestId}>
    CPT / HCPCS codes:{' '}
    {value.map((code, index) => (
      <Fragment key={`${code.code}-${index}`}>
        {index > 0 && '; '}
        <Box component="span">
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }}>
            {code.code} {code.display}
          </Box>
          {!readOnly && (
            <IconButton
              size="small"
              aria-label={`Remove ${code.code}`}
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              sx={{ p: '2px', ml: '2px' }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Fragment>
    ))}{' '}
    {(!readOnly || value.length === 0) && (
      <PopoverBlank
        label={value.length ? '+ another' : readOnly ? 'none' : 'add CPT / HCPCS code'}
        title="CPT / HCPCS code"
        ghost={value.length > 0}
        readOnly={readOnly}
      >
        {(close) => (
          <CodeSearch
            selected={value}
            onPick={(code) => {
              onChange([...value, code]);
              close();
            }}
          />
        )}
      </PopoverBlank>
    )}
  </Sentence>
);
