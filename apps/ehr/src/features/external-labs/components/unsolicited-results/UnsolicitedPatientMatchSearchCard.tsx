import SearchIcon from '@mui/icons-material/Search';
import { LoadingButton } from '@mui/lab';
import { Box, FormControl, TextField } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import DateSearch from 'src/components/DateSearch';
import { SearchResultParsedPatient } from 'src/components/PatientsSearch/types';
import { usePatientsSearch } from 'src/components/PatientsSearch/usePatientsSearch';
import { UnsolicitedPatientSearchResults } from './UnsolicitedPatientSearchResults';

interface UnsolicitedPatientMatchSearchCardProps {
  selectedPatient: SearchResultParsedPatient | undefined;
  setSelectedPatient: (selected: SearchResultParsedPatient | undefined) => void;
  handleConfirmPatientMatch: (confirmed: SearchResultParsedPatient | undefined) => void;
}
export const UnsolicitedPatientMatchSearchCard: FC<UnsolicitedPatientMatchSearchCardProps> = ({
  selectedPatient,
  setSelectedPatient,
  handleConfirmPatientMatch,
}) => {
  const { searchResult, arePatientsLoading, searchOptions, setSearchField, search } = usePatientsSearch();
  const searchFilters = searchOptions.filters;

  const handlePatientSearch = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setSelectedPatient(undefined);
    search({ pagination: { pageSize: 5, offset: 0 } });
  };

  return (
    <FormControl component="form" onSubmit={handlePatientSearch} fullWidth>
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          sx={{ flex: 1 }}
          label="Last Name"
          placeholder="Doe"
          value={searchFilters.lastName}
          onChange={(e) => setSearchField({ field: 'lastName', value: e.target.value })}
        />
        <TextField
          sx={{ flex: 1 }}
          label="Given Names"
          placeholder="John Henry"
          value={searchFilters.givenNames}
          onChange={(e) => setSearchField({ field: 'givenNames', value: e.target.value })}
        />
        <Box sx={{ flex: 1 }}>
          <DateSearch
            date={searchFilters.dob ? DateTime.fromISO(searchFilters.dob) : null}
            setDate={(date: DateTime | null) =>
              setSearchField({ field: 'dob', value: date ? date.toISODate() || '' : '' })
            }
            label="DOB"
            closeOnSelect
          />
        </Box>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'end', gap: 3 }}>
        <LoadingButton
          loading={arePatientsLoading}
          variant="contained"
          color="primary"
          startIcon={<SearchIcon />}
          type="submit"
          sx={{ mr: 1, borderRadius: 28 }}
        >
          Search
        </LoadingButton>
      </Box>
      <UnsolicitedPatientSearchResults
        search={search}
        arePatientsLoading={arePatientsLoading}
        searchOptions={searchOptions}
        searchResult={searchResult}
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        handleConfirmPatientMatch={handleConfirmPatientMatch}
      />
    </FormControl>
  );
};
