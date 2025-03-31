import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
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
  capitalize,
} from '@mui/material';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';

import { Add } from '@mui/icons-material';
import Oystehr from '@oystehr/sdk';
import { HealthcareService, Location, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { dataTestIds } from '../constants/data-test-ids';
import { OVERRIDE_DATE_FORMAT } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import { Closure, ClosureType, ScheduleExtension } from '../types/types';
import Loading from './Loading';
import { SCHEDULE_EXTENSION_URL } from 'utils';

export type ScheduleType = 'location' | 'provider' | 'group';

interface ScheduleInformationProps {
  scheduleType: ScheduleType;
}
const oystehr = new Oystehr({});
const SCHEDULE_CHANGES_FORMAT = 'MMM d';

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

export const ScheduleInformation = ({ scheduleType }: ScheduleInformationProps): ReactElement => {
  const { oystehr } = useApiClients();
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [pageNumber, setPageNumber] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<(Location | Practitioner)[] | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function getItems(schedule: 'Location' | 'Practitioner' | 'HealthcareService'): Promise<void> {
      if (!oystehr) {
        return;
      }
      setLoading(true);
      const itemsTemp = (
        await oystehr.fhir.search({
          resourceType: schedule,
          params: [{ name: '_count', value: '1000' }],
        })
      ).entry?.map((resourceTemp) => resourceTemp.resource) as any;
      setItems(itemsTemp);
      setLoading(false);
    }
    if (scheduleType === 'location') {
      void getItems('Location');
    } else if (scheduleType === 'provider') {
      void getItems('Practitioner');
    } else if (scheduleType === 'group') {
      void getItems('HealthcareService');
    }
  }, [oystehr, scheduleType]);

  const filteredItems = useMemo(() => {
    if (!items) {
      return [];
    }
    const filtered = items.filter((item) => getName(item).toLowerCase().includes(searchText.toLowerCase()));

    const combinedItems = filtered.map((item) => ({
      ...item,
      combined: getName(item),
    }));

    combinedItems.sort((a, b) => a.combined.localeCompare(b.combined));

    return combinedItems;
  }, [items, searchText]);

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

  const getHoursOfOperationForToday = (item: Location | Practitioner, time: 'open' | 'close'): any => {
    const dayOfWeek = DateTime.now().toLocaleString({ weekday: 'long' }).toLowerCase();
    const extensionSchedule = item.extension?.find((extensionTemp) => extensionTemp.url === SCHEDULE_EXTENSION_URL)
      ?.valueString;

    if (!extensionSchedule) {
      return undefined;
    }

    const scheduleTemp = JSON.parse(extensionSchedule);
    const scheduleDays = scheduleTemp.schedule;
    const scheduleDay = scheduleDays[dayOfWeek];
    let open: number = scheduleDay.open;
    let close: number = scheduleDay.close;
    const scheduleOverrides = scheduleTemp.scheduleOverrides;
    if (scheduleTemp.scheduleOverrides) {
      for (const dateKey in scheduleOverrides) {
        if (Object.hasOwnProperty.call(scheduleOverrides, dateKey)) {
          const date = DateTime.fromFormat(dateKey, OVERRIDE_DATE_FORMAT).toISODate();
          const todayDate = DateTime.local().toISODate();
          if (date === todayDate) {
            open = scheduleOverrides[dateKey].open;
            close = scheduleOverrides[dateKey].close;
          }
        }
      }
    }
    if (time === 'open') {
      return `${(open % 12 === 0 ? 12 : open % 12).toString().padStart(2, '0')}:00 ${
        open < 12 || open === 24 ? 'AM' : 'PM'
      }`;
    } else {
      return `${(close % 12 === 0 ? 12 : close % 12).toString().padStart(2, '0')}:00 ${
        close < 12 || close == 24 ? 'AM' : 'PM'
      }`;
    }
  };

  const validateClosureDates = (closureDates: string[], closure: Closure): string[] => {
    const today = DateTime.now().startOf('day');
    const startDate = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT);
    if (!startDate.isValid) {
      return closureDates;
    }

    if (closure.type === ClosureType.OneDay) {
      if (startDate >= today) {
        closureDates.push(startDate.toFormat(SCHEDULE_CHANGES_FORMAT));
      }
    } else if (closure.type === ClosureType.Period) {
      const endDate = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT);
      if (startDate >= today || endDate >= today) {
        closureDates.push(
          `${startDate.toFormat(SCHEDULE_CHANGES_FORMAT)} - ${endDate.toFormat(SCHEDULE_CHANGES_FORMAT)}`
        );
      }
    }
    return closureDates;
  };

  const validateOverrideDates = (overrideDates: string[], date: string): string[] => {
    const luxonDate = DateTime.fromFormat(date, OVERRIDE_DATE_FORMAT);
    if (luxonDate.isValid && luxonDate >= DateTime.now().startOf('day')) {
      overrideDates.push(luxonDate.toFormat(SCHEDULE_CHANGES_FORMAT));
    }
    return overrideDates;
  };

  function getItemOverrideInformation(item: Location | Practitioner): string | undefined {
    const extensionTemp = item.extension;
    const extensionSchedule = extensionTemp?.find((extensionTemp) => extensionTemp.url === SCHEDULE_EXTENSION_URL)
      ?.valueString;

    if (extensionSchedule) {
      const { scheduleOverrides, closures } = JSON.parse(extensionSchedule) as ScheduleExtension;
      const overrideDates = scheduleOverrides ? Object.keys(scheduleOverrides).reduce(validateOverrideDates, []) : [];
      const closureDates = closures ? closures.reduce(validateClosureDates, []) : [];
      const allDates = [...overrideDates, ...closureDates].sort((d1: string, d2: string): number => {
        // compare the single day or the first day in the period
        const startDateOne = d1.split('-')[0];
        const startDateTwo = d2.split('-')[0];
        return (
          DateTime.fromFormat(startDateOne, SCHEDULE_CHANGES_FORMAT).toSeconds() -
          DateTime.fromFormat(startDateTwo, SCHEDULE_CHANGES_FORMAT).toSeconds()
        );
      });
      const scheduleChangesSet = new Set(allDates);
      const scheduleChanges = Array.from(scheduleChangesSet);
      return scheduleChanges.length ? scheduleChanges.join(', ') : undefined;
    }
    return undefined;
  }

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
              <TableRow key={item.id}>
                <TableCell>
                  <Link to={`/schedule/${scheduleType}/${item.id}`} style={{ textDecoration: 'none' }}>
                    <Typography color="primary">{getName(item)}</Typography>
                  </Link>
                </TableCell>
                <TableCell align="left">
                  <Typography>
                    {item.resourceType === 'Location'
                      ? item.address && oystehr?.fhir.formatAddress(item.address)
                      : item.address && oystehr?.fhir.formatAddress(item.address[0])}
                  </Typography>
                </TableCell>
                <TableCell align="left">
                  <Typography>
                    {getHoursOfOperationForToday(item, 'open') && getHoursOfOperationForToday(item, 'close')
                      ? `${getHoursOfOperationForToday(item, 'open')} -
                                ${getHoursOfOperationForToday(item, 'close')}`
                      : 'No scheduled hours'}
                  </Typography>
                </TableCell>
                <TableCell align="left">
                  <Typography style={{ color: getItemOverrideInformation(item) ? 'inherit' : otherColors.none }}>
                    {getItemOverrideInformation(item) ? getItemOverrideInformation(item) : 'None Scheduled'}
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
