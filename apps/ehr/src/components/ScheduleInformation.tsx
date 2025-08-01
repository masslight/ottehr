import { otherColors } from '@ehrTheme/colors';
import { Add } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  capitalize,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { useQuery } from '@tanstack/react-query';
import { HealthcareService, Location, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { APIError, isApiError, SchedulesAndOwnerListItem, useErrorQuery } from 'utils';
import { listScheduleOwners } from '../api/api';
import { dataTestIds } from '../constants/data-test-ids';
import { useApiClients } from '../hooks/useAppClients';
import Loading from './Loading';

export type ScheduleType = 'location' | 'provider' | 'group';

interface ScheduleInformationProps {
  scheduleType: ScheduleType;
}
const oystehr = new Oystehr({});
export function getName(item: Resource): string {
  let name = undefined;
  if (item.resourceType === 'Location') {
    name = (item as Location)?.name;
  } else if (item.resourceType === 'Practitioner') {
    const nameTemp = (item as Practitioner)?.name;
    if (nameTemp) {
      name = oystehr.fhir.formatHumanName(nameTemp[0]);
    }
  } else if (item.resourceType === 'HealthcareService') {
    name = (item as HealthcareService)?.name;
  } else {
    console.log('getName called with unavailable resource', item);
    throw Error('getName called with unavailable resource');
  }

  if (!name) {
    return 'Undefined name';
  }
  return name;
}

const emptyScheduleList: SchedulesAndOwnerListItem[] = [];

export const ScheduleInformation = ({ scheduleType }: ScheduleInformationProps): ReactElement => {
  const { oystehrZambda } = useApiClients();
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [pageNumber, setPageNumber] = useState(0);
  const [searchText, setSearchText] = useState('');

  const ownerType = (() => {
    if (scheduleType === 'location') {
      return 'Location';
    }
    if (scheduleType === 'provider') {
      return 'Practitioner';
    }
    return 'HealthcareService';
  })();

  const { data, error, isLoading, isFetching, isRefetching } = useQuery({
    queryKey: ['schedule-list'],
    queryFn: () => (oystehrZambda ? listScheduleOwners({ ownerType }, oystehrZambda) : null),
    enabled: !!oystehrZambda,
  });

  useErrorQuery(error, (error) => {
    if (error) {
      let errorMessage = 'Error fetching schedule owners';
      if (isApiError(error)) {
        errorMessage = (error as APIError).message;
      }
      enqueueSnackbar({
        message: errorMessage,
        variant: 'error',
      });
    }
  });

  const loading = isLoading || isFetching || isRefetching;

  const filteredItems = useMemo(() => {
    if (!data?.list) {
      return emptyScheduleList;
    }
    return data.list.filter((item) => item.owner.name.toLowerCase().includes(searchText.toLowerCase()));
  }, [data, searchText]);

  // For pagination, only include the rows that are on the current page
  const pageItems = useMemo(
    () =>
      filteredItems.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [pageNumber, filteredItems, rowsPerPage]
  );

  const handleChangePage = (event: unknown, newPageNumber: number): void => {
    setPageNumber(newPageNumber);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPageNumber(0);
  };

  const handleChangeSearchText = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    setSearchText(event.target.value);
  };

  return (
    <Paper sx={{ padding: 2 }}>
      <TableContainer>
        {/* Items Search Box */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            id={`search-${scheduleType}`}
            label={`Search ${scheduleType}s`}
            variant="outlined"
            onChange={handleChangeSearchText}
            InputProps={{ endAdornment: <SearchIcon /> }}
            // sx={{ marginBottom: 2 }}
            margin="dense"
            size="small"
          />
          <Link to={`/schedule/${scheduleType}/add`}>
            <Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<Add />}>
              Add {scheduleType}
            </Button>
          </Link>
          {loading && (
            <Box sx={{ marginLeft: 'auto' }}>
              <Loading />
            </Box>
          )}
        </Box>

        <Table sx={{ minWidth: 650 }} aria-label={`${scheduleType}sTable`}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>{capitalize(scheduleType)} name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Address</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Today&apos;s hours</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Upcoming schedule changes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow key={item.owner.id}>
                <TableCell>
                  <Link to={getLinkForItem(item)} style={{ textDecoration: 'none' }}>
                    <Typography color="primary">{item.owner.name}</Typography>
                  </Link>
                </TableCell>
                <TableCell align="left">
                  <Typography>{item.owner.address ?? ''}</Typography>
                </TableCell>
                <TableCell align="left">
                  <Typography>{getHoursOfOperationText(item)}</Typography>
                </TableCell>
                <TableCell align="left">
                  <Typography
                    style={{
                      color: item.schedules[0]?.upcomingScheduleChanges ? 'inherit' : otherColors.none,
                    }}
                  >
                    {item.schedules[0]?.upcomingScheduleChanges ?? 'No upcoming schedule changes'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Table Pagination */}
        <TablePagination
          rowsPerPageOptions={[1, 5, 10, 25]}
          component="div"
          count={filteredItems.length}
          rowsPerPage={rowsPerPage}
          page={pageNumber}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          data-testid={dataTestIds.pagination.paginationContainer}
        />
      </TableContainer>
    </Paper>
  );
};

const getHoursOfOperationText = (item: SchedulesAndOwnerListItem): string => {
  if (!item.schedules.length) {
    return 'No scheduled hours';
  }
  const schedule = item.schedules[0];
  const hoursOfOperation = schedule.todayHoursISO;
  const timezone = schedule.timezone;
  if (!hoursOfOperation) {
    return 'No scheduled hours';
  }
  const { open, close } = hoursOfOperation;
  const openTime = DateTime.fromISO(open).setZone(timezone);
  const closeTime = DateTime.fromISO(close).setZone(timezone);
  if (openTime.isValid && closeTime.isValid) {
    return openTime.toFormat('h:mm a') + ' - ' + closeTime.toFormat('h:mm a');
  }
  return 'No scheduled hours';
};

const getLinkForItem = (item: SchedulesAndOwnerListItem): string => {
  let itemPathSegment = '';
  if (item.owner.resourceType === 'Practitioner') {
    itemPathSegment = 'provider';
  } else if (item.owner.resourceType === 'Location') {
    itemPathSegment = 'location';
  } else {
    itemPathSegment = 'group';
  }

  if (item.owner.resourceType === 'HealthcareService') {
    return `/group/id/${item.owner.id}`;
  }
  if (item.schedules.length) {
    return `/schedule/id/${item.schedules[0].id}`;
  }
  return `/schedule/new/${itemPathSegment}/${item.owner.id}`;
};
