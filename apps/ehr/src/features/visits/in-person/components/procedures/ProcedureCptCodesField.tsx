import { Close } from '@mui/icons-material';
import { Autocomplete, Box, IconButton, TextField } from '@mui/material';
import { FC, Fragment } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatProcedureCptCode } from 'utils/lib/procedure-coding/format';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PopoverBlank, Sentence } from './narrative/InlineBlanks';

interface ProcedureCptCodesFieldProps {
  codes: CPTCodeDTO[];
  searchOptions: CPTCodeDTO[];
  isSearching: boolean;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onAdd: (code: CPTCodeDTO) => void;
  onDelete: (code: CPTCodeDTO) => void;
  disabled: boolean;
}

export const ProcedureCptCodesField: FC<ProcedureCptCodesFieldProps> = ({
  codes,
  searchOptions,
  isSearching,
  searchTerm,
  onSearchTermChange,
  onAdd,
  onDelete,
  disabled,
}) => (
  <Sentence>
    CPT codes:{' '}
    {codes.map((value, index) => (
      <Fragment key={value.resourceId ?? `${value.code}-${index}`}>
        {index > 0 && '; '}
        <Box component="span">
          <Box
            component="span"
            sx={{ color: 'primary.main', fontWeight: 500 }}
            data-testid={dataTestIds.documentProcedurePage.cptCode}
          >
            {formatProcedureCptCode(value)}
          </Box>
          {!disabled && (
            <IconButton
              size="small"
              aria-label={`Remove ${value.code}`}
              onClick={() => onDelete(value)}
              sx={{ p: '2px', ml: '2px' }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Fragment>
    ))}{' '}
    {(!disabled || codes.length === 0) && (
      <PopoverBlank
        label={codes.length ? '+ another' : 'CPT code'}
        title="CPT code"
        ghost={codes.length > 0}
        readOnly={disabled}
        dataTestId={dataTestIds.documentProcedurePage.addCptCode}
      >
        {(close) => (
          <Box sx={{ width: 360, maxWidth: '100%', pt: 0.5 }}>
            <Autocomplete
              fullWidth
              blurOnSelect
              options={searchOptions}
              filterOptions={(x) => x}
              noOptionsText={
                searchTerm && searchOptions.length === 0
                  ? 'Nothing found for this search criteria'
                  : 'Start typing to load results'
              }
              autoComplete
              includeInputInList
              value={null}
              isOptionEqualToValue={(option, value) => value.code === option.code}
              getOptionDisabled={(option) => codes.some((selected) => selected.code === option.code)}
              loading={isSearching}
              onChange={(_e: unknown, data: CPTCodeDTO | null) => {
                if (data != null && !codes.some((selected) => selected.code === data.code)) {
                  onAdd(data);
                }
                close();
              }}
              getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="CPT code"
                  placeholder="Search CPT code"
                  onChange={(e) => onSearchTermChange(e.target.value)}
                  data-testid={dataTestIds.documentProcedurePage.cptCodeInput}
                />
              )}
            />
          </Box>
        )}
      </PopoverBlank>
    )}
  </Sentence>
);
