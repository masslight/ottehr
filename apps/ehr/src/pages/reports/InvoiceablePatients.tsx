import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Box, Stack } from '@mui/system';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SendInvoiceToPatientDialog } from 'src/components/dialogs';
import {
  chooseJson,
  formatDateConfigurable,
  GET_INVOICES_TASKS_ZAMBDA_KEY,
  GetInvoicesTasksInput,
  GetInvoicesTasksResponse,
  getLatestTaskOutput,
  INVOICEABLE_PATIENTS_PAGE_SIZE,
  InvoiceablePatientReport,
  InvoiceTaskDisplayStatus,
  InvoiceTaskDisplayStatuses,
  InvoiceTaskInput,
  mapDisplayToInvoiceTaskStatus,
  mapInvoiceTaskStatusToDisplay,
} from 'utils';
import { updateInvoiceTask } from '../../api/api';
import { SelectInput } from '../../components/input/SelectInput';
import { MappedStatusChip } from '../../components/MappedStatusChip';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

const LOCAL_STORAGE_FILTERS_KEY = 'invoices-tasks.filters';

const INVOICEABLE_TASK_STATUS_COLORS_MAP: {
  [status in InvoiceTaskDisplayStatus]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
} = {
  ready: {
    background: {
      primary: '#6129ef',
    },
    color: {
      primary: '#ffffff',
    },
  },
  updating: {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  sending: {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#311B92',
    },
  },
  sent: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  error: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
};

export default function InvoiceablePatients(): React.ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const methods = useForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReportToSend, setSelectedReportToSend] = useState<InvoiceablePatientReport | undefined>();
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());
  const [sendingTaskIds, setSendingTaskIds] = useState<Set<string>>(new Set());
  const pageSP = Number(searchParams.get('page') ?? '0');
  const statusSP = searchParams.get('status');
  const patientSP = searchParams.get('patient');

  const handleBack = (): void => {
    navigate('/reports');
  };

  const setPage = (page: number): void => {
    searchParams.set('page', page.toString());
    setSearchParams(searchParams);
  };

  const {
    data: invoiceablePatients,
    isLoading: isInvoiceablePatientsLoading,
    refetch: refetchInvoiceablePatients,
  } = useQuery<GetInvoicesTasksResponse>({
    queryKey: [GET_INVOICES_TASKS_ZAMBDA_KEY, pageSP, statusSP, patientSP],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const params: GetInvoicesTasksInput = {
        page: pageSP,
        status: statusSP ? mapDisplayToInvoiceTaskStatus(statusSP as InvoiceTaskDisplayStatus) : undefined,
        patientId: patientSP ?? undefined,
      };
      const response = await oystehrZambda.zambda.execute({
        id: GET_INVOICES_TASKS_ZAMBDA_KEY,
        ...params,
      });
      return chooseJson(response);
    },
    enabled: oystehrZambda !== undefined,
    retry: 2,
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000,
  });

  const sendInvoice = async (taskId: string, invoiceTaskInput: InvoiceTaskInput): Promise<void> => {
    try {
      if (oystehrZambda) {
        setSendingTaskIds((prev) => new Set(prev).add(taskId));

        await updateInvoiceTask(oystehrZambda, {
          taskId,
          status: mapDisplayToInvoiceTaskStatus('sending'),
          invoiceTaskInput,
          userTimezone: DateTime.local().zoneName,
        }).finally(() => {
          setSendingTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        });

        setSelectedReportToSend(undefined);
        enqueueSnackbar('Invoice status changed to "sending"', { variant: 'success' });
        await refetchInvoiceablePatients();
      }
    } catch {
      enqueueSnackbar('Error occurred, please try again', { variant: 'error' });
    }
  };

  const updateInvoice = (taskId: string | undefined): void => {
    try {
      if (oystehrZambda && taskId) {
        setUpdatingTaskIds((prev) => new Set(prev).add(taskId));

        void updateInvoiceTask(oystehrZambda, {
          taskId,
          status: mapDisplayToInvoiceTaskStatus('updating'),
          userTimezone: DateTime.local().zoneName,
        }).finally(async () => {
          enqueueSnackbar('Invoice status changed to "updating"', { variant: 'success' });
          await refetchInvoiceablePatients();
          setUpdatingTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        });
      }
    } catch {
      enqueueSnackbar('Error occurred, please try again', { variant: 'error' });
    }
  };

  useEffect(() => {
    const filtersValues = {
      status: searchParams.get('status'),
      patient: searchParams.get('patient'),
    };
    methods.reset(filtersValues);
  }, [searchParams, methods]);

  useEffect(() => {
    const callback = methods.subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        const queryParams = new URLSearchParams();
        const filtersToPersist: Record<string, string> = {};
        for (const key in values) {
          const value = values[key];
          if (value) {
            queryParams.set(key, value);
            filtersToPersist[key] = value;
          }
        }
        setSearchParams(queryParams);
        if (Object.keys(filtersToPersist).length > 0) {
          localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(filtersToPersist));
        } else {
          localStorage.removeItem(LOCAL_STORAGE_FILTERS_KEY);
        }
      },
    });
    return () => callback();
  }, [methods, navigate, setSearchParams]);

  useEffect(() => {
    const persistedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
    if (searchParams.size === 0 && persistedFilters != null) {
      const filters = JSON.parse(persistedFilters);
      const queryParams = new URLSearchParams();
      for (const key in filters) {
        queryParams.set(key, filters[key]);
      }
      setSearchParams(queryParams);
    }
  }, [searchParams, setSearchParams]);

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssessmentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Invoiceable Patients Report
            </Typography>
          </Box>
        </Box>

        <FormProvider {...methods}>
          <Paper>
            <Stack direction="row" spacing={2} padding="8px">
              <SelectInput name="status" label="Status" options={InvoiceTaskDisplayStatuses as unknown as string[]} />
              <TextField {...methods.register('patient')} label="Patient id" sx={{ width: '100%' }} size="small" />
            </Stack>
          </Paper>
        </FormProvider>
        <Paper sx={{ mt: 2 }}>
          <Table sx={{ width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Patient Name
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '150px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    DOB
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '150px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Appointment Date
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '150px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Finalization Date
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Responsible Party
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '120px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Amount
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '150px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    RCM Claim id
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '100px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Status
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '200px' }}>
                  <Typography fontWeight="500" fontSize="14px">
                    Actions
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isInvoiceablePatientsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : null}
              {!isInvoiceablePatientsLoading && (invoiceablePatients?.reports ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2">No reports</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              {!isInvoiceablePatientsLoading &&
                (invoiceablePatients?.reports ?? []).map((report) => {
                  const isUpdating = report.task.id ? updatingTaskIds.has(report.task.id) : false;
                  const isSending = report.task.id ? sendingTaskIds.has(report.task.id) : false;
                  const displayStatus = isUpdating
                    ? 'updating'
                    : isSending
                    ? 'sending'
                    : mapInvoiceTaskStatusToDisplay(report.task.status);
                  const lastTaskOutput = getLatestTaskOutput(report.task);
                  const statusTooltipMessage = lastTaskOutput
                    ? lastTaskOutput.type === 'success'
                      ? 'Invoice id: ' + lastTaskOutput.message
                      : 'Error: ' + lastTaskOutput.message
                    : displayStatus;

                  return (
                    <TableRow key={report.task.id}>
                      <TableCell>
                        <Link
                          to={`/patient/${report.patient.patientId}`}
                          style={{ textDecoration: 'underline', color: 'inherit' }}
                        >
                          <Typography variant="inherit">{report.patient.fullName}</Typography>
                        </Link>{' '}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">{report.patient.dob}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">{report.visitDate}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {formatDateConfigurable({ isoDate: report.finalizationDateISO })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {report.responsibleParty.fullName}, {report.responsibleParty.relationshipToPatient}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">${(report.amountInvoiceable / 100).toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {report.claimId.slice(0, 8)}...
                          <Tooltip title="Copy claim id">
                            <IconButton
                              size="small"
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(report.claimId)
                                  .then(() => enqueueSnackbar('Copied to clipboard', { variant: 'success' }));
                              }}
                            >
                              <ContentCopyIcon />
                            </IconButton>
                          </Tooltip>
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={statusTooltipMessage}>
                          <span>
                            <MappedStatusChip status={displayStatus} mapper={INVOICEABLE_TASK_STATUS_COLORS_MAP} />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Button
                          sx={{ mr: 1 }}
                          onClick={() => {
                            updateInvoice(report.task.id);
                          }}
                        >
                          Refresh
                        </Button>
                        <Button
                          disabled={
                            isUpdating || isSending || displayStatus === 'updating' || displayStatus === 'sending'
                          }
                          onClick={() => {
                            setSelectedReportToSend(report);
                          }}
                          variant="contained"
                        >
                          Invoice
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[INVOICEABLE_PATIENTS_PAGE_SIZE]}
            component="div"
            count={invoiceablePatients?.totalCount ?? -1}
            rowsPerPage={INVOICEABLE_PATIENTS_PAGE_SIZE}
            page={pageSP}
            onPageChange={(_e, newPageNumber) => {
              setPage(newPageNumber);
            }}
          />
        </Paper>
        <SendInvoiceToPatientDialog
          title="Send invoice"
          modalOpen={selectedReportToSend !== undefined}
          handleClose={() => {
            setSelectedReportToSend(undefined);
          }}
          submitButtonName="Send Invoice"
          onSubmit={sendInvoice}
          report={selectedReportToSend}
        />
      </Box>
    </PageContainer>
  );
}
