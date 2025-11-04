import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import {
  Box,
  capitalize,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
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
import { useQuery } from '@tanstack/react-query';
import { Encounter, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { FC, ReactElement, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTelemedVisitDetailsUrl } from 'src/features/visits/telemed/utils/routing';
import { visitTypeToInPersonLabel, visitTypeToTelemedLabel } from 'src/types/types';
import styled from 'styled-components';
import {
  EmployeeDetails,
  FOLLOWUP_SYSTEMS,
  formatMinutes,
  getInPersonVisitStatus,
  getTelemedVisitStatus,
  isInPersonAppointment,
  PrefilledInvoiceInfo,
  ServiceMode,
  TelemedCallStatusesArr,
  useSuccessQuery,
  visitStatusArray,
} from 'utils';
import { create } from 'zustand';
import { getEmployees, updateInvoiceTask } from '../api/api';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import { AppointmentHistoryRow } from '../hooks/useGetPatient';
import { SendInvoiceToPatientDialog } from './dialogs';
import { RoundedButton } from './RoundedButton';
import { TelemedAppointmentStatusChip } from './TelemedAppointmentStatusChip';

type PatientEncountersGridProps = {
  appointments?: AppointmentHistoryRow[];
  patientId?: string;
  loading: boolean;
  patient?: Patient;
};

interface ColorScheme {
  bg: string;
  text: string;
}

type StatusType = 'OPEN' | 'RESOLVED';

const statusColors: Record<StatusType, ColorScheme> = {
  OPEN: { bg: '#b3e5fc', text: '#01579B' },
  RESOLVED: { bg: '#c8e6c9', text: '#1b5e20' },
};

const StatusChip = styled(Chip)(() => ({
  borderRadius: '8px',
  padding: '0 9px',
  margin: 0,
  height: '24px',
  '& .MuiChip-label': {
    padding: 0,
    fontWeight: 'bold',
    fontSize: '0.7rem',
  },
  '& .MuiChip-icon': {
    marginLeft: 'auto',
    marginRight: '-4px',
    order: 1,
  },
}));

export const getFollowupStatusChip = (status: 'OPEN' | 'RESOLVED'): ReactElement => {
  const statusVal =
    status === 'OPEN'
      ? { statusText: 'OPEN', statusColors: statusColors.OPEN }
      : { statusText: 'RESOLVED', statusColors: statusColors.RESOLVED };
  return (
    <StatusChip
      label={statusVal.statusText}
      sx={{
        backgroundColor: statusVal.statusColors.bg,
        color: statusVal.statusColors.text,
        '& .MuiSvgIcon-root': {
          color: 'inherit',
          fontSize: '1.2rem',
          margin: '0 -4px 0 2px',
        },
      }}
    />
  );
};

const useEmployeesStore = create<{ employees: EmployeeDetails[] }>()(() => ({ employees: [] }));

const ProviderCell: FC<{ encounter?: Encounter }> = ({ encounter }) => {
  const { employees } = useEmployeesStore();

  const practitioner = encounter?.participant
    ?.find((participant) => participant.individual?.reference?.startsWith('Practitioner'))
    ?.individual?.reference?.split('/')?.[1];

  const employee = practitioner ? employees.find((employee) => employee.profile.endsWith(practitioner)) : undefined;

  return <Typography variant="body2">{employee ? `${employee.firstName} ${employee.lastName}` : '-'}</Typography>;
};

type SortField = 'dateTime';
type SortDirection = 'asc' | 'desc';

interface TableColumn {
  id: string;
  label: string;
  sortable?: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

const columns: TableColumn[] = [
  { id: 'dateTime', label: 'Date & Time', sortable: true, width: 150 },
  { id: 'status', label: 'Status', width: 140 },
  { id: 'type', label: 'Type', width: 150 },
  { id: 'reason', label: 'Reason for visit', width: 150 },
  { id: 'provider', label: 'Provider', width: 150 },
  { id: 'office', label: 'Office', width: 150 },
  { id: 'los', label: 'LOS', width: 100 },
  { id: 'info', label: 'Visit Info', width: 120, align: 'center' },
  { id: 'note', label: 'Progress Note', width: 150 },
  { id: 'invoice', label: 'Invoice', width: 100, align: 'center' },
];

export const PatientEncountersGrid: FC<PatientEncountersGridProps> = (props) => {
  const { appointments, loading, patient } = props;

  const [type, setType] = useState('all');
  const [period, setPeriod] = useState(0);
  const [status, setStatus] = useState('all');
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideNoShow, setHideNoShow] = useState(false);
  const [sortField, setSortField] = useState<SortField>('dateTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [followupEncounters, setFollowupEncounters] = useState<Encounter[]>([]);
  const [followupLocations, setFollowupLocations] = useState<Map<string, Location>>(new Map());
  const [selectedInvoiceTask, setSelectedInvoiceTask] = useState<Task | undefined>(undefined);

  const { oystehrZambda, oystehr } = useApiClients();
  const navigate = useNavigate();

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      if (!oystehrZambda) {
        return null;
      }
      const data = await getEmployees(oystehrZambda);
      if (!data.employees) {
        return null;
      }
      return data;
    },
    enabled: !!oystehrZambda,
  });

  useSuccessQuery(employeesData, (data) => {
    const employees = data?.employees || [];
    useEmployeesStore.setState({ employees });
  });

  // Fetch follow-up encounters
  const { data: followupData } = useQuery({
    queryKey: ['followupEncounters', patient?.id],
    queryFn: async () => {
      if (!oystehr || !patient?.id) {
        return { encounters: [], locations: new Map<string, Location>() };
      }
      try {
        const fhirResources = await oystehr.fhir.search({
          resourceType: 'Encounter',
          params: [
            {
              name: '_sort',
              value: '-date',
            },
            {
              name: 'subject',
              value: `Patient/${patient.id}`,
            },
            {
              name: 'type',
              value: FOLLOWUP_SYSTEMS.type.code,
            },
            {
              name: 'part-of:missing',
              value: 'false',
            },
            {
              name: '_include',
              value: 'Encounter:location',
            },
          ],
        });

        const bundle = fhirResources.unbundle();

        const encounters = bundle.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
        const locations = bundle.filter((resource) => resource.resourceType === 'Location') as Location[];

        const locationMap = new Map<string, Location>();
        locations.forEach((location) => {
          if (location.id) {
            locationMap.set(location.id, location);
          }
        });

        return { encounters, locations: locationMap };
      } catch (e) {
        console.error('error loading follow-up encounters', e);
        return { encounters: [], locations: new Map<string, Location>() };
      }
    },
    enabled: !!oystehr && !!patient?.id,
  });

  // Update follow-up encounters when data changes
  React.useEffect(() => {
    if (followupData) {
      setFollowupEncounters(followupData.encounters);
      setFollowupLocations(followupData.locations);
    }
  }, [followupData]);

  const filtered = useMemo(() => {
    let filtered = appointments || [];

    if (type !== 'all') {
      filtered = filtered.filter((item) => item.typeLabel === type);
    }

    if (period) {
      filtered = filtered.filter((item) => {
        return -DateTime.fromISO(item.dateTime ?? '').diffNow('months').months < period;
      });
    }

    if (status !== 'all') {
      filtered = filtered.filter((item) => filterAppointmentForStatus(item, status));
    }

    if (hideCancelled) {
      filtered = filtered.filter((item) => !filterAppointmentForStatus(item, 'cancelled'));
    }

    if (hideNoShow) {
      filtered = filtered.filter(
        (item) => item.serviceMode === ServiceMode.virtual || !filterAppointmentForStatus(item, 'no show')
      );
    }

    // Apply sorting
    if (sortField === 'dateTime') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = DateTime.fromISO(a.dateTime ?? '');
        const dateB = DateTime.fromISO(b.dateTime ?? '');
        const diff = dateA.diff(dateB).milliseconds;
        return sortDirection === 'asc' ? diff : -diff;
      });
    }

    return filtered;
  }, [appointments, period, type, status, hideCancelled, hideNoShow, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filtered.slice(startIndex, startIndex + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  function filterAppointmentForStatus(appointmentHistory: AppointmentHistoryRow, filterStatus: string): boolean {
    if (!appointmentHistory.encounter) return false;
    const appointmentStatus =
      appointmentHistory.serviceMode === ServiceMode.virtual
        ? getTelemedVisitStatus(appointmentHistory.encounter.status, appointmentHistory.appointment.status)
        : getInPersonVisitStatus(appointmentHistory.appointment, appointmentHistory.encounter);
    return filterStatus === appointmentStatus;
  }

  const sendInvoice = async (taskId: string, prefilledInvoiceInfo: PrefilledInvoiceInfo): Promise<void> => {
    try {
      if (oystehrZambda) {
        await updateInvoiceTask(oystehrZambda, {
          taskId,
          status: 'requested',
          prefilledInvoiceInfo,
        });
        setSelectedInvoiceTask(undefined);
        enqueueSnackbar('Invoice created and sent successfully', { variant: 'success' });
      }
    } catch {
      enqueueSnackbar('Error occured during invoice creation, please try again', { variant: 'error' });
    }
  };

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getFollowupEncountersForRow = (row: AppointmentHistoryRow): Encounter[] => {
    if (!row.encounter?.id) return [];
    return followupEncounters.filter((encounter) => encounter.partOf?.reference?.endsWith(row.encounter?.id || ''));
  };

  const renderFollowupCellContent = (encounter: Encounter, columnId: string): React.ReactNode => {
    const locationReference = encounter.location?.[0]?.location?.reference;
    const locationId = locationReference?.replace('Location/', '');
    const location = locationId ? followupLocations.get(locationId) : undefined;

    switch (columnId) {
      case 'dateTime':
        return encounter.period?.start ? formatISOStringToDateAndTime(encounter.period.start) : '-';
      case 'type': {
        const typeCoding = encounter.type?.find(
          (t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.type.url && c.code === FOLLOWUP_SYSTEMS.type.code)
        );
        let typeText = '-';
        if (typeCoding?.text) {
          typeText = typeCoding.text;
        }
        return <Typography variant="body2">{typeText}</Typography>;
      }
      case 'reason':
        if (!encounter.reasonCode) return '-';
        return <Typography variant="body2">{encounter.reasonCode[0].text}</Typography>;
      case 'provider':
        return <ProviderCell encounter={encounter} />;
      case 'office':
        return location?.address?.state && location?.name
          ? `${location.address.state.toUpperCase()} - ${location.name}`
          : '-';
      case 'status': {
        if (!encounter.status) return null;
        const statusVal = encounter.status === 'in-progress' ? 'OPEN' : 'RESOLVED';
        return getFollowupStatusChip(statusVal);
      }
      case 'note': {
        const appointmentId = encounter.appointment?.[0]?.reference?.replace('Appointment/', '');
        if (!appointmentId) return '-';

        const encounterId = encounter.id;
        const to = `/in-person/${appointmentId}/follow-up-note`;

        return (
          <RoundedButton to={to} state={{ encounterId }}>
            Progress Note
          </RoundedButton>
        );
      }
      default:
        return '-';
    }
  };

  const renderCellContent = (row: AppointmentHistoryRow, columnId: string): React.ReactNode => {
    switch (columnId) {
      case 'dateTime':
        return row.dateTime ? formatISOStringToDateAndTime(row.dateTime, row.officeTimeZone) : '-';
      case 'status':
        if (row.serviceMode === ServiceMode.virtual) {
          if (!row.encounter) return null;
          const status = getTelemedVisitStatus(row.encounter.status, row.appointment.status);
          return !!status && <TelemedAppointmentStatusChip status={status} />;
        } else {
          if (!row.encounter) return null;
          const encounterStatus = getInPersonVisitStatus(row.appointment, row.encounter);
          return encounterStatus || null;
        }
      case 'type':
        return row.typeLabel || '-';
      case 'reason':
        return (
          <Typography variant="body2">
            {(row.appointment?.description ?? '')
              .split(',')
              .map((complaint) => complaint.trim())
              .join(', ') || '-'}
          </Typography>
        );
      case 'provider':
        return <ProviderCell encounter={row.encounter} />;
      case 'office':
        return row.office || '-';
      case 'los':
        return row.length !== undefined ? `${formatMinutes(row.length)} ${row.length === 1 ? 'min' : 'mins'}` : '-';
      case 'info': {
        if (!row.id) return null;
        const isInPerson = isInPersonAppointment(row.appointment);
        return (
          <RoundedButton
            to={isInPerson ? `/visit/${row.id}` : getTelemedVisitDetailsUrl(row.id)}
            state={{ encounterId: row.encounter?.id }}
          >
            Visit Info
          </RoundedButton>
        );
      }
      case 'note':
        return (
          <RoundedButton
            to={
              row.serviceMode === ServiceMode.virtual
                ? `/telemed/appointments/${row.id}?tab=sign`
                : `/in-person/${row.id}/progress-note`
            }
          >
            Progress Note
          </RoundedButton>
        );
      case 'invoice': {
        const lastActiveEncounterTask = row.encounterTasks?.find((task) => task.status === 'ready'); // todo how to do this
        return (
          <RoundedButton
            disabled={!lastActiveEncounterTask}
            onClick={() => {
              setSelectedInvoiceTask(lastActiveEncounterTask);
            }}
          >
            Invoice
          </RoundedButton>
        );
      }
      default:
        return '-';
    }
  };

  return (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Encounters - {appointments?.length || 0}
        </Typography>
        {appointments?.[0]?.dateTime && (
          <Typography>
            Latest visit: {formatISOStringToDateAndTime(appointments[0].dateTime, appointments[0].officeTimeZone)}
          </Typography>
        )}
        <RoundedButton to="/visits/add" target="_blank" variant="contained" startIcon={<AddIcon fontSize="small" />}>
          New Visit
        </RoundedButton>
        <RoundedButton
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => navigate('followup/add')}
        >
          Follow-up
        </RoundedButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField size="small" fullWidth label="Type" select value={type} onChange={(e) => setType(e.target.value)}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value={visitTypeToInPersonLabel['walk-in']}>{visitTypeToInPersonLabel['walk-in']}</MenuItem>
          <MenuItem value={visitTypeToInPersonLabel['post-telemed']}>
            {visitTypeToInPersonLabel['post-telemed']}
          </MenuItem>
          <MenuItem value={visitTypeToInPersonLabel['pre-booked']}>{visitTypeToInPersonLabel['pre-booked']}</MenuItem>
          <MenuItem value={visitTypeToTelemedLabel['pre-booked']}>{visitTypeToTelemedLabel['pre-booked']}</MenuItem>
          <MenuItem value={visitTypeToTelemedLabel['walk-in']}>{visitTypeToTelemedLabel['walk-in']}</MenuItem>
        </TextField>

        <TextField
          size="small"
          fullWidth
          label="Visit Period"
          select
          value={period}
          onChange={(e) => setPeriod(+e.target.value)}
        >
          <MenuItem value={0}>All</MenuItem>
          <MenuItem value={1}>Last month</MenuItem>
          <MenuItem value={3}>Last 3 months</MenuItem>
          <MenuItem value={6}>Last 6 months</MenuItem>
          <MenuItem value={12}>Last year</MenuItem>
        </TextField>

        <TextField
          size="small"
          fullWidth
          label="Visit Status"
          select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="all">All</MenuItem>
          {[...new Set([...TelemedCallStatusesArr, ...visitStatusArray.filter((item) => item !== 'cancelled')])].map(
            (status) => (
              <MenuItem key={status} value={status}>
                {capitalize(status)}
              </MenuItem>
            )
          )}
        </TextField>

        <FormControlLabel
          sx={{
            whiteSpace: 'nowrap',
          }}
          control={<Checkbox value={hideCancelled} onChange={(e) => setHideCancelled(e.target.checked)} />}
          label="Hide “Cancelled”"
        />

        <FormControlLabel
          sx={{
            whiteSpace: 'nowrap',
          }}
          control={<Checkbox value={hideNoShow} onChange={(e) => setHideNoShow(e.target.checked)} />}
          label="Hide “No Show”"
        />
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  sx={{
                    width: column.width,
                    fontWeight: 500,
                    textAlign: column.align || 'left',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {column.label}
                    {column.sortable && (
                      <IconButton size="small" onClick={() => handleSort(column.id as SortField)} sx={{ padding: 0 }}>
                        {sortField === column.id ? (
                          sortDirection === 'asc' ? (
                            <ArrowUpwardIcon fontSize="small" />
                          ) : (
                            <ArrowDownwardIcon fontSize="small" />
                          )
                        ) : (
                          <ArrowDownwardIcon fontSize="small" sx={{ opacity: 0.3 }} />
                        )}
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4 }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4 }}>
                  No encounters found
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => {
                const rowId = row.id || `row-${index}`;
                const followupEncountersForRow = getFollowupEncountersForRow(row);
                const hasFollowups = followupEncountersForRow.length > 0;

                return (
                  <React.Fragment key={rowId}>
                    <TableRow hover>
                      {columns.map((column, colIndex) => (
                        <TableCell
                          key={column.id}
                          sx={{
                            width: column.width,
                            textAlign: column.align || 'left',
                            paddingLeft: colIndex === 0 ? 2 : 1,
                          }}
                        >
                          {renderCellContent(row, column.id)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {hasFollowups && (
                      <>
                        {followupEncountersForRow.map((followupEncounter, followupIndex) => (
                          <TableRow
                            key={`followup-${followupEncounter.id || followupIndex}`}
                            sx={{
                              backgroundColor: 'rgba(0, 0, 0, 0.02)',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              },
                            }}
                          >
                            {columns.map((column, colIndex) => (
                              <TableCell
                                key={`followup-${column.id}`}
                                sx={{
                                  width: column.width,
                                  textAlign: column.align || 'left',
                                  ...(colIndex === 0
                                    ? {
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 1,
                                      }
                                    : {}),
                                }}
                              >
                                {colIndex === 0 && <SubdirectoryArrowRightIcon />}
                                {renderFollowupCellContent(followupEncounter, column.id)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5]}
        component="div"
        count={filtered.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
      <SendInvoiceToPatientDialog
        title="Send invoice"
        modalOpen={selectedInvoiceTask !== undefined}
        handleClose={() => setSelectedInvoiceTask(undefined)}
        submitButtonName="Send"
        onSubmit={sendInvoice}
        invoiceTask={selectedInvoiceTask}
      />
    </Paper>
  );
};
