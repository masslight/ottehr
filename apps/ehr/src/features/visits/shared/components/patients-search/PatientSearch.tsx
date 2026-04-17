import { Paper } from '@mui/material';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import { CommandPaletteItem } from 'src/state/command-palette.store';
import { PatientsSearchFilters } from './PatientsSearchFilters';
import { PatientsSearchTable } from './PatientsSearchTable';
import { usePatientsSearch } from './usePatientsSearch';

export const PatientSearch: React.FC = () => {
  const { searchResult, arePatientsLoading, searchOptions, setSearchField, resetFilters, search } = usePatientsSearch();
  const navigate = useNavigate();

  const patientPaletteItems = useMemo((): CommandPaletteItem[] => {
    if (!searchResult?.patients?.length) return [];
    const items: CommandPaletteItem[] = [];
    for (const patient of searchResult.patients) {
      const dob = patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : 'Unknown';
      const label = `${patient.name} (DOB: ${dob})`;
      items.push({
        id: `patient-${patient.id}`,
        label,
        category: 'Patient',
        keywords: [patient.name, patient.id],
        onSelect: () => navigate(`/patient/${patient.id}?tab=encounters`),
      });
    }
    return items;
  }, [searchResult?.patients, navigate]);

  useCommandPaletteSource('patient-search-results', patientPaletteItems);

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
