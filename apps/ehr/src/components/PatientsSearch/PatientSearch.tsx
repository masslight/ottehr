import { Paper } from '@mui/material';
import { PatientsSearchFilters } from './PatientsSearchFilters';
import { PatientsSearchTable } from './PatientsSearchTable';
import { usePatientsSearch } from './usePatientsSearch';

export const PatientSearch: React.FC = () => {
  const { searchResult, arePatientsLoading, searchOptions, setSearchField, resetFilters, search } = usePatientsSearch();

  return (
    <>
      <Paper sx={{ p: 2, mb: 2 }}>
        <PatientsSearchFilters
          searchFilters={searchOptions.filters}
          setSearchField={setSearchField}
          resetFilters={resetFilters}
          search={search}
        />
      </Paper>
      <Paper>
        <PatientsSearchTable
          searchResult={searchResult}
          arePatientsLoading={arePatientsLoading}
          searchOptions={searchOptions}
          search={search}
        />
      </Paper>
    </>
  );
};
