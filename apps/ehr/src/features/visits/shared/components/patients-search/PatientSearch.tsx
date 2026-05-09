import { Paper } from '@mui/material';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandPaletteSource } from '../../../../../hooks/useCommandPaletteSource';
import { CommandPaletteItem } from '../../../../../state/command-palette.store';
import { PatientsSearchFilters } from './PatientsSearchFilters';
import { PatientsSearchTable } from './PatientsSearchTable';
import { usePatientsSearch } from './usePatientsSearch';

export const PatientSearch: React.FC = () => {
  const { searchResult, arePatientsLoading, searchOptions, setSearchField, resetFilters, search } = usePatientsSearch();
  const navigate = useNavigate();

  // Register the currently-displayed patients as command-palette items so the
  // user can Cmd+K, type a name/PID/DOB/phone/email/etc. and jump straight to
  // a patient's chart. The palette's keyword matcher (label + category +
  // keywords) does the filtering — anything we put in `keywords` is searchable.
  // Mirrors the same data the table row shows.
  const patientPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const patients = searchResult?.patients ?? [];
    return patients.map((patient) => {
      const dobDisplay = patient.birthDate ? DateTime.fromISO(patient.birthDate).toFormat('MM/dd/yyyy') : undefined;
      const labelParts = [patient.name];
      if (patient.pid) labelParts.push(`PID ${patient.pid}`);
      const labelSuffix = dobDisplay ? ` (DOB: ${dobDisplay})` : '';
      const label = `${labelParts.join(' — ')}${labelSuffix}`;

      const addressString = patient.address
        ? `${patient.address.city}, ${patient.address.state} ${patient.address.zip}`.trim()
        : undefined;

      const keywords = [
        patient.name,
        patient.pid,
        patient.id,
        patient.birthDate,
        dobDisplay,
        patient.phone,
        patient.email,
        addressString,
      ].filter((k): k is string => !!k);

      return {
        id: `patient-${patient.id}`,
        label,
        category: 'Patient',
        keywords,
        // PatientPage defaults to the encounters tab; navigate there directly.
        onSelect: () => navigate(`/patient/${patient.id}`),
      };
    });
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
