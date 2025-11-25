import {
  Box,
  Button,
  Dialog,
  FormControlLabel,
  Pagination,
  PaginationItem,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  PartialSearchOptionsState,
  SearchOptionsState,
  SearchResult,
  SearchResultParsedPatient,
} from '../patients-search/types';

interface AddVisitPatientSearchDialogProps {
  openSearchResults: boolean;
  setOpenSearchResults: (open: boolean) => void;
  selectedPatient: SearchResultParsedPatient | undefined;
  setSelectedPatient: (patient: SearchResultParsedPatient | undefined) => void;
  searchResult: SearchResult;
  searchOptions: SearchOptionsState;
  patientsPerPage: number;
  search: (params?: PartialSearchOptionsState | undefined) => void;
  handleSelectExistingPatient: () => void;
  handleManuallyEnterPatientDetails: () => void;
}
export const AddVisitPatientSearchDialog: FC<AddVisitPatientSearchDialogProps> = ({
  openSearchResults,
  setOpenSearchResults,
  selectedPatient,
  setSelectedPatient,
  searchResult,
  searchOptions,
  patientsPerPage,
  search,
  handleSelectExistingPatient,
  handleManuallyEnterPatientDetails,
}) => {
  const page = Math.floor(searchOptions.pagination.offset / searchOptions.pagination.pageSize) + 1;
  const paginationCount = Math.ceil(searchResult.pagination.totalItems / patientsPerPage);
  const showPagination = searchResult?.pagination && paginationCount > 1;

  const getFullNameForSearchedPatient = (patient: SearchResultParsedPatient): string => {
    return `${patient.firstName}${patient.middleName ? ` ${patient.middleName}` : ''} ${patient.lastName}`;
  };

  return (
    <Dialog
      open={openSearchResults}
      onClose={() => {
        setSelectedPatient(undefined);
        setOpenSearchResults(false);
      }}
    >
      <Box sx={{ minWidth: '600px', borderRadius: '4px', p: '35px', maxHeight: '450px', overflow: 'scroll' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: '600 !important', color: 'primary.main', marginBottom: '4px' }}>
            Select Patient
          </Typography>
        </Box>
        <Box>
          <RadioGroup
            onChange={(e) => {
              const id = e.target.value;
              const patient = searchResult.patients.find((p) => p.id === id);
              setSelectedPatient(patient);
            }}
          >
            {searchResult?.patients.map((patient) => {
              const label = `${getFullNameForSearchedPatient(patient)} (DOB: ${DateTime.fromISO(
                patient?.birthDate || ''
              ).toFormat('MMMM dd, yyyy')})`;
              return <FormControlLabel key={patient.id} value={patient.id} control={<Radio />} label={label} />;
            })}
          </RadioGroup>
          {showPagination && (
            <Box display="flex" justifyContent="right">
              <Pagination
                count={paginationCount}
                shape="rounded"
                color="primary"
                page={page}
                onChange={(_, newPage) => {
                  console.log('newPage', newPage);
                  void search({ pagination: { offset: searchOptions.pagination.pageSize * (newPage - 1) } });
                }}
                renderItem={(item) => (
                  <PaginationItem
                    {...item}
                    disabled={
                      (item.type === 'previous' && !searchResult.pagination.prev) ||
                      (item.type === 'next' && !searchResult.pagination.next)
                    }
                  />
                )}
              />
            </Box>
          )}
        </Box>
        {selectedPatient && (
          <Box sx={{ marginTop: 2 }}>
            <Button
              data-testid={dataTestIds.addPatientPage.prefillForButton}
              variant="outlined"
              sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
              }}
              onClick={handleSelectExistingPatient}
            >
              Prefill for {getFullNameForSearchedPatient(selectedPatient)}
            </Button>
          </Box>
        )}
        <Box sx={{ marginTop: 2 }}>
          <Button
            data-testid={dataTestIds.addPatientPage.patientNotFoundButton}
            variant="contained"
            sx={{
              borderRadius: 100,
              textTransform: 'none',
              fontWeight: 600,
            }}
            onClick={handleManuallyEnterPatientDetails}
          >
            Patient Not Found - Add Manually
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};
