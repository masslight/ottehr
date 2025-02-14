import {
  Box,
  Paper,
  Skeleton,
  styled,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLUMN_CONFIG, SEARCH_CONFIG } from './constants';
import { SortField, SortOrder, SearchResult, PartialSearchOptionsState, SearchOptionsState } from './types';
import { dataTestIds } from '../../constants/data-test-ids';

const StyledTabs = styled(Tabs)(({ theme }) => ({
  color: theme.palette.background.paper,
  padding: 0,
  '& .MuiTabs-indicator': {
    display: 'none',
  },
  '& .MuiTab-root': {
    borderRadius: 0,
    minHeight: 40,
    textTransform: 'none',
    fontWeight: 400,
    padding: '6px 16px',
  },
  '& .Mui-selected': {
    backgroundColor: `${theme.palette.primary.main} !important`,
    color: `${theme.palette.background.paper} !important`,
  },
}));

export const PatientsSearchTable: React.FC<{
  searchResult: SearchResult | null;
  arePatientsLoading: boolean;
  searchOptions: SearchOptionsState;
  search: (params?: PartialSearchOptionsState) => void;
}> = ({ searchResult, arePatientsLoading, searchOptions, search }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('allPatients');
  const page = Math.floor(searchOptions.pagination.offset / searchOptions.pagination.pageSize);

  const sort = (field: SortField) => () => {
    const order: SortOrder = searchOptions.sort.field === field && searchOptions.sort.order === 'asc' ? 'desc' : 'asc';
    void search({ sort: { field, order }, pagination: { offset: 0 } });
  };

  if (!searchResult?.patients.length && !arePatientsLoading) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Typography variant="body1">Set up search filter and press Search to find patients</Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2 }}>
        <StyledTabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab value="allPatients" label="All Patients" />
        </StyledTabs>
      </Box>

      <TableContainer
        component={Paper}
        sx={{
          '& .MuiTableCell-root': {
            overflowWrap: 'anywhere',
          },
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={COLUMN_CONFIG.pid.width}>PID</TableCell>
              <TableCell width={COLUMN_CONFIG.name.width}>
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
              <TableCell width={COLUMN_CONFIG.dob.width}>
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
              <TableCell width={COLUMN_CONFIG.email.width}>Email</TableCell>
              <TableCell width={COLUMN_CONFIG.phone.width}>Phone</TableCell>
              <TableCell width={COLUMN_CONFIG.address.width}>Address</TableCell>
              <TableCell width={COLUMN_CONFIG.lastVisit.width}>Last Visit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {arePatientsLoading
              ? Array.from(new Array(searchResult?.patients.length || searchOptions.pagination.pageSize)).map(
                  (_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell width={COLUMN_CONFIG.pid.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                      <TableCell width={COLUMN_CONFIG.name.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                      <TableCell width={COLUMN_CONFIG.dob.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                      <TableCell width={COLUMN_CONFIG.email.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                      <TableCell width={COLUMN_CONFIG.phone.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                      <TableCell width={COLUMN_CONFIG.address.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                      <TableCell width={COLUMN_CONFIG.lastVisit.width}>
                        <Skeleton animation="wave" width={'100%'} />
                      </TableCell>
                    </TableRow>
                  )
                )
              : searchResult?.patients.map((patient) => (
                  <TableRow key={patient.id} data-testid={dataTestIds.patients.searchResultRow(patient.id)}>
                    <TableCell
                      data-testid={dataTestIds.patients.patientId}
                      width={COLUMN_CONFIG.pid.width}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        navigate(`/patient/${patient.id}`);
                      }}
                    >
                      {patient.id}
                    </TableCell>
                    <TableCell width={COLUMN_CONFIG.name.width} data-testid={dataTestIds.patients.patientName}>
                      {patient.name}
                    </TableCell>
                    <TableCell width={COLUMN_CONFIG.dob.width} data-testid={dataTestIds.patients.patientDateOfBirth}>
                      {patient.birthDate ? DateTime.fromISO(patient.birthDate).toFormat('MM/dd/yyyy') : ''}
                    </TableCell>
                    <TableCell width={COLUMN_CONFIG.email.width} data-testid={dataTestIds.patients.patientEmail}>
                      {patient.email}
                    </TableCell>
                    <TableCell width={COLUMN_CONFIG.phone.width} data-testid={dataTestIds.patients.patientPhoneNumber}>
                      {patient.phone}
                    </TableCell>
                    <TableCell width={COLUMN_CONFIG.address.width} data-testid={dataTestIds.patients.patientAddress}>
                      {patient.address ? (
                        <>
                          {patient?.address?.line}
                          {patient?.address?.line && patient?.address?.city && `, `}
                          {patient?.address?.city}
                          {patient?.address?.city && patient?.address?.state && <br />}
                          {patient?.address?.state}
                          {patient?.address?.state && patient?.address?.zip && ' '}
                          {patient?.address?.zip}
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell width={COLUMN_CONFIG.lastVisit.width}>
                      {patient.lastVisit
                        ? `${new Date(patient.lastVisit.date).toLocaleDateString()} at ${patient.lastVisit.location}`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
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
                nextIconButtonProps={{
                  disabled: !searchResult?.pagination.next || arePatientsLoading,
                }}
                backIconButtonProps={{
                  disabled: !searchResult?.pagination.prev || arePatientsLoading,
                }}
                data-testid={dataTestIds.pagination.paginationContainer}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </>
  );
};
