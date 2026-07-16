import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import {
  Box,
  CircularProgress,
  debounce,
  Grid,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { ChangeEvent, FC, ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  FAX_LOGS_PAGE_SIZE,
  FaxLogStatus,
  formatDateConfigurable,
  formatPhoneNumberDisplay,
  GetFaxLogsOutput,
  isValidUUID,
} from 'utils';
import { getFaxLogs } from '../../api/api';
import DateSearch from '../../components/DateSearch';
import { MappedStatusChip, Mapper } from '../../components/MappedStatusChip';
import { useApiClients } from '../../hooks/useAppClients';
import { ResendFaxButton } from './ResendFaxButton';

const FAX_STATUS_COLORS_MAP: Mapper<FaxLogStatus> = {
  sent: {
    background: { primary: '#C8E6C9' },
    color: { primary: '#1B5E20' },
  },
  failed: {
    background: { primary: '#FFCCBC' },
    color: { primary: '#BF360C' },
  },
  pending: {
    background: { primary: '#B3E5FC' },
    color: { primary: '#01579B' },
  },
};

interface FaxLogsTableProps {
  /** When set, the log is scoped to this patient and the patient search/column are hidden. */
  patientId?: string;
}

export const FaxLogsTable: FC<FaxLogsTableProps> = ({ patientId }) => {
  const { oystehrZambda } = useApiClients();

  const [patientNameField, setPatientNameField] = useState('');
  const [patientNameSearch, setPatientNameSearch] = useState('');
  const [visitIdField, setVisitIdField] = useState('');
  const [visitIdSearch, setVisitIdSearch] = useState('');
  const [visitDate, setVisitDate] = useState<DateTime | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const applySearch = (setSearch: (value: string) => void, value: string): void => {
    setSearch(value.trim());
    setPageIndex(0);
  };

  // one debouncer per field — a shared one would cancel the other field's pending update
  const debouncedApplyPatientName = useMemo(
    () => debounce((value: string) => applySearch(setPatientNameSearch, value), 800),

    []
  );
  const debouncedApplyVisitId = useMemo(
    () => debounce((value: string) => applySearch(setVisitIdSearch, value), 800),

    []
  );

  // Appointment ids are UUIDs, so anything else can't match a visit.
  const visitIdIsInvalid = visitIdSearch !== '' && !isValidUUID(visitIdSearch);
  const visitDateISO = visitDate?.isValid ? visitDate.toISODate() : undefined;

  const {
    data: faxLogs,
    isFetching,
    isError,
    refetch,
  } = useQuery<GetFaxLogsOutput>({
    queryKey: ['get-fax-logs', patientId, patientNameSearch, visitIdSearch, visitDateISO, pageIndex],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehr client is not defined');
      return getFaxLogs(oystehrZambda, {
        patientId,
        patientName: patientNameSearch || undefined,
        visitId: visitIdSearch || undefined,
        visitDate: visitDateISO ?? undefined,
        pageIndex,
        itemsPerPage: FAX_LOGS_PAGE_SIZE,
      });
    },
    enabled: oystehrZambda !== undefined && !visitIdIsInvalid,
  });

  const logs = visitIdIsInvalid ? [] : faxLogs?.logs ?? [];
  const totalCount = visitIdIsInvalid ? 0 : faxLogs?.totalCount ?? 0;
  const showLoading = isFetching && !visitIdIsInvalid;
  const columnsCount = patientId ? 4 : 5;

  const renderSearchField = (
    label: string,
    fieldValue: string,
    setFieldValue: (value: string) => void,
    setSearch: (value: string) => void,
    debouncedApply: ((value: string) => void) & { clear: () => void }
  ): ReactElement => (
    <TextField
      value={fieldValue}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        setFieldValue(value);
        debouncedApply(value);
      }}
      fullWidth
      size="small"
      label={label}
      placeholder="Search"
      InputLabelProps={{ shrink: true }}
      InputProps={{
        endAdornment: (
          <IconButton
            aria-label={`search by ${label.toLowerCase()}`}
            onClick={() => {
              debouncedApply.clear();
              applySearch(setSearch, fieldValue);
            }}
            onMouseDown={(event) => event.preventDefault()}
            sx={{ p: 0 }}
          >
            <SearchOutlinedIcon />
          </IconButton>
        ),
      }}
    />
  );

  return (
    <Paper sx={{ padding: 3 }}>
      <Grid container spacing={2}>
        {!patientId && (
          <Grid item xs={4}>
            {renderSearchField(
              'Patient',
              patientNameField,
              setPatientNameField,
              setPatientNameSearch,
              debouncedApplyPatientName
            )}
          </Grid>
        )}
        <Grid item xs={4}>
          {renderSearchField('Visit ID', visitIdField, setVisitIdField, setVisitIdSearch, debouncedApplyVisitId)}
        </Grid>
        <Grid item xs={4}>
          <DateSearch
            label="Visit Date"
            date={visitDate}
            setDate={(date) => {
              setVisitDate(date);
              setPageIndex(0);
            }}
            updateURL={false}
            storeDateInLocalStorage={false}
            closeOnSelect={true}
            small={true}
          />
        </Grid>
      </Grid>

      <Table sx={{ mt: 2 }}>
        <TableHead>
          <TableRow>
            {!patientId && <TableCell>Patient</TableCell>}
            <TableCell>Visit</TableCell>
            <TableCell>Recipient</TableCell>
            <TableCell>Fax Number</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {showLoading ? (
            <TableRow>
              <TableCell colSpan={columnsCount} align="center">
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={columnsCount} align="center">
                <Typography color="error">Failed to load fax logs. Please try again later.</Typography>
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnsCount} align="center">
                <Typography color="text.secondary">No faxes found</Typography>
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.communicationId}>
                {!patientId && <TableCell>{log.patientName ?? '-'}</TableCell>}
                <TableCell>
                  {log.appointmentId ? (
                    <>
                      <Link
                        component={RouterLink}
                        to={`/visit/${log.appointmentId}`}
                        sx={{
                          display: 'block',
                          maxWidth: 140,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {log.appointmentId}
                      </Link>
                      {log.visitDate && (
                        <Typography variant="body2">{formatDateConfigurable({ isoDate: log.visitDate })}</Typography>
                      )}
                    </>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{log.recipientName ?? '-'}</TableCell>
                <TableCell>{log.faxNumber ? formatPhoneNumberDisplay(log.faxNumber) : '-'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MappedStatusChip status={log.status} mapper={FAX_STATUS_COLORS_MAP} />
                    {log.status === 'failed' && <ResendFaxButton log={log} onResent={() => void refetch()} />}
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TablePagination
        component="div"
        count={totalCount}
        page={pageIndex}
        onPageChange={(_, newPage) => setPageIndex(newPage)}
        rowsPerPage={FAX_LOGS_PAGE_SIZE}
        rowsPerPageOptions={[FAX_LOGS_PAGE_SIZE]}
      />
    </Paper>
  );
};
