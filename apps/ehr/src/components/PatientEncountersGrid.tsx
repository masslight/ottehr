import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import {
  Box,
  ButtonOwnProps,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { FC, ReactElement, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTelemedVisitDetailsUrl } from 'src/features/visits/telemed/utils/routing';
import { getVisitTypeLabelForTypeAndServiceMode } from 'src/shared/utils';
import { visitTypeToInPersonLabel, visitTypeToTelemedLabel } from 'src/types/types';
import styled from 'styled-components';
import {
  AppointmentHistoryRow,
  AppointmentType,
  FollowUpVisitHistoryRow,
  formatMinutes,
  GetPatientAndResponsiblePartyInfoEndpointOutput,
  PatientVisitListResponse,
  PrefilledInvoiceInfo,
  ServiceMode,
  TelemedAppointmentStatus,
  TelemedCallStatusesArr,
  visitStatusArray,
} from 'utils';
import { updateInvoiceTask } from '../api/api';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import { SendInvoiceToPatientDialog } from './dialogs';
import { RoundedButton } from './RoundedButton';
import { TelemedAppointmentStatusChip } from './TelemedAppointmentStatusChip';

type PatientEncountersGridProps = {
  totalCount: number;
  latestVisitDate: string | null;
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

const ProviderCell: FC<{ name: string | undefined }> = ({ name }) => {
  return <Typography variant="body2">{name || '-'}</Typography>;
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
  const { patient, totalCount, latestVisitDate } = props;
  const { id: patientId } = useParams();

  const [type, setType] = useState('all');
  const [period, setPeriod] = useState(0);
  const [status, setStatus] = useState('all');
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideNoShow, setHideNoShow] = useState(false);
  const [sortField, setSortField] = useState<SortField>('dateTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selectedInvoiceTask, setSelectedInvoiceTask] = useState<Task | undefined>(undefined);

  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();

  const {
    data: visitHistory,
    isLoading: visitHistoryIsLoading,
    refetch: refetchVisitHistory,
  } = useQuery({
    queryKey: [`get-patient-visit-history`, { patientId, status, type, period }],
    queryFn: async (): Promise<PatientVisitListResponse> => {
      let from: string | undefined;
      if (period > 0) {
        from = DateTime.now().minus({ months: period }).toISO();
      }
      let typeParam: AppointmentType[] | undefined = undefined;
      let serviceMode: ServiceMode | undefined = undefined;
      if (type !== 'all') {
        const [typeStr, serviceModeStr] = type.split('|');
        typeParam = [typeStr as AppointmentType];
        serviceMode = serviceModeStr as ServiceMode;
      }
      if (oystehrZambda && patient?.id) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-patient-visit-history',
          patientId: patient.id,
          type: typeParam,
          serviceMode,
          status: status !== 'all' ? [status] : undefined,
          from,
          sortDirection,
        });
        return result.output as PatientVisitListResponse;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    enabled: Boolean(patient?.id) && Boolean(oystehrZambda),
  });

  const { data: patientAndRpForInvoiceData, isLoading: patientAndRPLoading } = useQuery({
    queryKey: [`get-patient-and-responsible-party-info`, { patientId }],
    queryFn: async (): Promise<GetPatientAndResponsiblePartyInfoEndpointOutput> => {
      if (oystehrZambda && patient?.id) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-patient-and-responsible-party-info',
          patientId: patient.id,
        });
        return result.output as GetPatientAndResponsiblePartyInfoEndpointOutput;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    enabled: Boolean(patient?.id) && Boolean(oystehrZambda),
  });

  const filtered = useMemo(() => {
    if (!visitHistory) return [];
    const { visits, metadata } = visitHistory;
    let filtered = visits || [];

    if (hideCancelled) {
      filtered = filtered.filter((item) => item.status !== 'cancelled');
    }

    if (hideNoShow) {
      // not sure why all virtual visits are kept but keeping this pre-existing logic
      filtered = filtered.filter((item) => item.serviceMode === ServiceMode.virtual || item.status !== 'no show');
    }

    // Apply sorting
    if (metadata.sortDirection === sortDirection) {
      return filtered;
    } else {
      return filtered.slice().reverse();
    }
  }, [visitHistory, hideCancelled, hideNoShow, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filtered.slice(startIndex, startIndex + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const sendInvoice = async (taskId: string, prefilledInvoiceInfo: PrefilledInvoiceInfo): Promise<void> => {
    try {
      if (oystehrZambda) {
        await updateInvoiceTask(oystehrZambda, {
          taskId,
          status: 'requested',
          prefilledInvoiceInfo,
          userTimezone: DateTime.local().toFormat('z'),
        });
        setSelectedInvoiceTask(undefined);
        void refetchVisitHistory();
        enqueueSnackbar('Invoice created and sent successfully', { variant: 'success' });
      }
    } catch {
      enqueueSnackbar('Error occurred during invoice creation, please try again', { variant: 'error' });
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

  const renderFollowupCellContent = (encounter: FollowUpVisitHistoryRow, columnId: string): React.ReactNode => {
    switch (columnId) {
      case 'dateTime':
        return encounter.dateTime ? formatISOStringToDateAndTime(encounter.dateTime) : '-';
      case 'type': {
        const typeText = encounter.type ?? '-';
        return <Typography variant="body2">{typeText}</Typography>;
      }
      case 'reason':
        if (!encounter.visitReason) return '-';
        return <Typography variant="body2">{encounter.visitReason}</Typography>;
      case 'provider':
        return <ProviderCell name={encounter.provider?.name} />;
      case 'office':
        return encounter.office ? encounter.office : '-';
      case 'status': {
        if (!encounter.status) return null;
        const statusVal = encounter.status === 'in-progress' ? 'OPEN' : 'RESOLVED';
        return getFollowupStatusChip(statusVal);
      }
      case 'note': {
        const { encounterId, originalAppointmentId } = encounter;
        if (!originalAppointmentId) return '-';
        const to = `/in-person/${originalAppointmentId}/follow-up-note`;

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
        return row.dateTime ? formatISOStringToDateAndTime(row.dateTime) : '-';
      case 'status':
        if (!row.status) return null;
        if (row.serviceMode === ServiceMode.virtual) {
          // todo fix typing
          return <TelemedAppointmentStatusChip status={`${row.status}` as TelemedAppointmentStatus} />;
        } else {
          return row.status;
        }
      case 'type':
        return getVisitTypeLabelForTypeAndServiceMode({ type: row.type, serviceMode: row.serviceMode });
      case 'reason':
        return <Typography variant="body2">{row.visitReason || '-'}</Typography>;
      case 'provider':
        return <ProviderCell name={row.provider?.name} />;
      case 'office':
        return row.office || '-';
      case 'los':
        return row.length !== undefined ? `${formatMinutes(row.length)} ${row.length === 1 ? 'min' : 'mins'}` : '-';
      case 'info': {
        if (!row.appointmentId) return null;
        const isInPerson = row.serviceMode === ServiceMode['in-person'];
        return (
          <RoundedButton
            to={isInPerson ? `/visit/${row.appointmentId}` : getTelemedVisitDetailsUrl(row.appointmentId)}
            state={{ encounterId: row.encounterId }}
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
                ? `/telemed/appointments/${row.appointmentId}?tab=sign`
                : `/in-person/${row.appointmentId}/progress-note`
            }
          >
            Progress Note
          </RoundedButton>
        );
      case 'invoice': {
        const lastEncounterTask = row.sendInvoiceTask;

        let buttonColor: ButtonOwnProps['color'] = 'secondary';
        let tooltipText = '---';
        let buttonDisabled = true;
        if (lastEncounterTask !== undefined) {
          switch (lastEncounterTask?.status) {
            case 'ready':
              buttonColor = 'primary';
              tooltipText = 'Invoice can be sent for this visit.';
              buttonDisabled = false;
              break;
            case 'completed':
              buttonColor = 'success';
              tooltipText =
                'Invoice has been sent and processed for this visit successfully. You can resend it by pressing this button';
              buttonDisabled = false;
              break;
            case 'failed':
              buttonColor = 'error';
              tooltipText = 'Invoice has been sent but failed to process for this visit.';
              buttonDisabled = false;
              break;
            default:
              buttonColor = 'secondary';
              tooltipText = "Invoice can't be sent for this visit yet.";
              buttonDisabled = true;
          }
        } else {
          buttonColor = 'inherit';
          tooltipText = "Invoice can't be sent for this visit yet.";
          buttonDisabled = true;
        }
        return (
          <Tooltip title={tooltipText} placement="top">
            <Box>
              <RoundedButton
                disabled={buttonDisabled || patientAndRPLoading}
                color={buttonColor}
                onClick={() => {
                  setSelectedInvoiceTask(lastEncounterTask);
                }}
              >
                Send Invoice
              </RoundedButton>
            </Box>
          </Tooltip>
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
          Encounters - {totalCount}
        </Typography>
        {latestVisitDate && <Typography>Latest visit: {formatISOStringToDateAndTime(latestVisitDate)}</Typography>}
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
          <MenuItem value={'walk-in|in-person'}>{visitTypeToInPersonLabel['walk-in']}</MenuItem>
          <MenuItem value={'post-telemed|in-person'}>{visitTypeToInPersonLabel['post-telemed']}</MenuItem>
          <MenuItem value={'pre-booked|in-person'}>{visitTypeToInPersonLabel['pre-booked']}</MenuItem>
          <MenuItem value={'pre-booked|virtual'}>{visitTypeToTelemedLabel['pre-booked']}</MenuItem>
          <MenuItem value={'walk-in|virtual'}>{visitTypeToTelemedLabel['walk-in']}</MenuItem>
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
            {visitHistoryIsLoading ? (
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
                const rowId = row.appointmentId || `row-${index}`;
                const followupEncountersForRow = row.followUps ?? [];
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
                            key={`followup-${followupEncounter.encounterId || followupIndex}`}
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
        submitButtonName="Send Invoice"
        onSubmit={sendInvoice}
        invoiceTask={selectedInvoiceTask}
        patientAndRP={patientAndRpForInvoiceData}
      />
    </Paper>
  );
};
