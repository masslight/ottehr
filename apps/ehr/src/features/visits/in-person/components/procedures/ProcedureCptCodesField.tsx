import { Autocomplete, TextField, Typography } from '@mui/material';
import { FC } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CPTCodeDTO } from 'utils';

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
  <>
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
      disableClearable
      value={null as unknown as undefined}
      isOptionEqualToValue={(option, value) => value.code === option.code}
      loading={isSearching}
      onChange={(_e: unknown, data: CPTCodeDTO | null) => {
        if (data != null) {
          onAdd(data);
        }
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
      disabled={disabled}
    />
    <ActionsList
      data={codes}
      getKey={(value, index) => value.resourceId || index}
      renderItem={(value) => (
        <Typography data-testid={dataTestIds.documentProcedurePage.cptCode}>
          {value.code} {value.display}
          {value.billableUnits != null && value.billableUnits > 1 ? ` (× ${value.billableUnits})` : ''}
        </Typography>
      )}
      renderActions={(value) => (!disabled ? <DeleteIconButton onClick={() => onDelete(value)} /> : undefined)}
      divider
    />
  </>
);
