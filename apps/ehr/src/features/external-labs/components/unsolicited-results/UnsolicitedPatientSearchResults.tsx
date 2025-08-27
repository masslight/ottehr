import {
  Button,
  Radio,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { SEARCH_CONFIG } from 'src/components/PatientsSearch/constants';
import {
  PartialSearchOptionsState,
  SearchOptionsState,
  SearchResult,
  SearchResultParsedPatient,
  SortField,
  SortOrder,
} from 'src/components/PatientsSearch/types';

interface UnsolicitedPatientSearchResultsProps {
  search: (params?: PartialSearchOptionsState) => void;
  arePatientsLoading: boolean;
  searchResult: SearchResult;
  searchOptions: SearchOptionsState;
  selectedPatient: SearchResultParsedPatient | undefined;
  setSelectedPatient: (selectedPatient: SearchResultParsedPatient) => void;
  handleConfirmPatientMatch: (confirmed: SearchResultParsedPatient | undefined) => void;
}

export const UnsolicitedPatientSearchResults: FC<UnsolicitedPatientSearchResultsProps> = ({
  search,
  arePatientsLoading,
  searchResult,
  searchOptions,
  selectedPatient,
  setSelectedPatient,
  handleConfirmPatientMatch,
}) => {
  const page = Math.floor(searchOptions.pagination.offset / searchOptions.pagination.pageSize);
  const sort = (field: SortField) => () => {
    const order: SortOrder = searchOptions.sort.field === field && searchOptions.sort.order === 'asc' ? 'desc' : 'asc';
    void search({ sort: { field, order }, pagination: { offset: 0 } });
  };

  const name = selectedPatient?.name ?? '';
  const birthDate = selectedPatient?.birthDate
    ? DateTime.fromISO(selectedPatient.birthDate).toFormat('MM/dd/yyyy')
    : '';

  const selectButtonText = selectedPatient ? `Select ${name}, ${birthDate}` : 'Select';

  if (!searchResult.patients.length) {
    return <></>;
  }

  return (
    <>
      <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
        Please select a patient to match:
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell width="10%">Select</TableCell>
            <TableCell width="30%">
              <TableSortLabel
                active={searchOptions.sort.field === 'name'}
                direction={searchOptions.sort.field === 'name' ? searchOptions.sort.order : 'asc'}
                onClick={sort('name')}
                hideSortIcon={false}
                sx={{
                  '& .MuiTableSortLabel-icon': {
                    opacity: searchOptions.sort.field === 'name' ? 1 : 0.55,
                    color: searchOptions.sort.field === 'name' ? 'inherit' : 'grey.500',
                  },
                }}
              >
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell width="30%">
              <TableSortLabel
                active={searchOptions.sort.field === 'dob'}
                direction={searchOptions.sort.field === 'dob' ? searchOptions.sort.order : 'asc'}
                onClick={sort('dob')}
                hideSortIcon={false}
                sx={{
                  '& .MuiTableSortLabel-icon': {
                    opacity: searchOptions.sort.field === 'dob' ? 1 : 0.55,
                    color: searchOptions.sort.field === 'dob' ? 'inherit' : 'grey.500',
                  },
                }}
              >
                DOB
              </TableSortLabel>
            </TableCell>
            <TableCell width="30%">Last Visit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {arePatientsLoading ? (
            <TableRow>
              <TableCell width="10%"></TableCell>
              <TableCell width="30%">
                <Skeleton animation="wave" width={'100%'} />
              </TableCell>
              <TableCell width="20%">
                <Skeleton animation="wave" width={'100%'} />
              </TableCell>
              <TableCell width="30%">
                <Skeleton animation="wave" width={'100%'} />
              </TableCell>
            </TableRow>
          ) : (
            searchResult?.patients.map((patient) => (
              <TableRow
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell width="10%">
                  <Radio
                    checked={selectedPatient?.id === patient.id}
                    value={patient.id}
                    name={`radio-select-${patient.id}`}
                  />
                </TableCell>
                <TableCell width="30%">{patient.name}</TableCell>
                <TableCell width="30%">
                  {patient.birthDate ? DateTime.fromISO(patient.birthDate).toFormat('MM/dd/yyyy') : ''}
                </TableCell>
                <TableCell width="30%">
                  {patient.lastVisit
                    ? `${new Date(patient.lastVisit.date).toLocaleDateString()} at ${patient.lastVisit.location}`
                    : '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TablePagination
              rowsPerPageOptions={SEARCH_CONFIG.ROWS_PER_PAGE_OPTIONS.map((option) => ({
                value: option,
                label: option.toString(),
              }))}
              colSpan={7}
              count={searchResult?.pagination.totalItems || 0}
              rowsPerPage={searchOptions.pagination.pageSize}
              page={page}
              onPageChange={(_, newPage) => {
                void search({ pagination: { offset: searchOptions.pagination.pageSize * newPage } });
              }}
              onRowsPerPageChange={(event) => {
                const newItemsPerPage = parseInt(event.target.value, 10);
                void search({ pagination: { pageSize: newItemsPerPage, offset: 0 } });
              }}
              slotProps={{
                actions: {
                  nextButton: {
                    disabled: !searchResult?.pagination.next || arePatientsLoading,
                  },
                  previousButton: {
                    disabled: !searchResult?.pagination.prev || arePatientsLoading,
                  },
                },
              }}
            />
          </TableRow>
        </TableFooter>
      </Table>
      <Button
        disabled={selectedPatient === undefined}
        variant="contained"
        color="primary"
        sx={{ borderRadius: 28, mt: '8px', my: 'auto' }}
        onClick={() => {
          if (selectedPatient) {
            handleConfirmPatientMatch(selectedPatient);
          }
        }}
      >
        {selectButtonText}
      </Button>
    </>
  );
};
