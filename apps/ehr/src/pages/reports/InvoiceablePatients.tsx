import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PhoneIcon from '@mui/icons-material/Phone';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Box, Stack } from '@mui/system';
import { useQuery } from '@tanstack/react-query';
import { RelatedPerson } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { SendInvoiceToPatientDialog, SendStatementToPatientDialog } from 'src/components/dialogs';
import ChatModal from 'src/features/chat/ChatModal';
import {
  AppointmentMessaging,
  chooseJson,
  EXPORT_INVOICES_ZAMBDA_KEY,
  ExportInvoicesCsvKickOffResponse,
  ExportInvoicesCsvStatusResponse,
  ExportInvoicesTasksCsvInput,
  formatDateConfigurable,
  GET_INVOICES_TASKS_ZAMBDA_KEY,
  getCoding,
  GetInvoicesTasksInput,
  GetInvoicesTasksResponse,
  getLatestTaskOutput,
  getSMSNumberForIndividual,
  getSupportPhoneFor,
  INVOICEABLE_PATIENTS_PAGE_SIZE,
  InvoiceablePatientReport,
  InvoiceSortDirection,
  InvoiceSortDirectionValues,
  InvoiceSortField,
  InvoiceSortFieldValues,
  InvoiceTaskDisplayStatus,
  InvoiceTaskDisplayStatuses,
  InvoiceTaskInput,
  InvoiceTaskSource,
  mapDisplayToInvoiceTaskStatus,
  mapInvoiceTaskStatusToDisplay,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { updateInvoiceTask } from '../../api/api';
import { GenericToolTip } from '../../components/GenericToolTip';
import { SelectInput } from '../../components/input/SelectInput';
import { MappedStatusChip } from '../../components/MappedStatusChip';
import { FEATURE_FLAGS } from '../../constants/feature-flags';
import { useApiClients } from '../../hooks/useAppClients';
import { useSupportPhonesMap } from '../../hooks/useLocationSupportPhones';

const VITE_APP_PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

type QuickTextsContextValue = React.ComponentProps<typeof ChatModal>['quickTextsContext'];

const LOCAL_STORAGE_FILTERS_KEY = 'invoices-tasks.filters';

export const INVOICE_TASK_SOURCE_LABELS: Record<InvoiceTaskSource, string> = {
  candid: 'Candid',
  'ottehr-billing': 'Ottehr Billing',
};

const SP = {
  page: 'page',
  status: 'status',
  patient: 'patient',
  sortField: 'sortField',
  sortDirection: 'sortDirection',
  hideZeroBalance: 'hideZeroBalance',
} as const;

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

interface InvoiceablePatientsProps {
  source: InvoiceTaskSource;
}

export default function InvoiceablePatients({ source }: InvoiceablePatientsProps): React.ReactElement {
  const { oystehrZambda, oystehr } = useApiClients();
  const localStorageFiltersKey = `${LOCAL_STORAGE_FILTERS_KEY}.${source}`;
  const methods = useForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReportToSend, setSelectedReportToSend] = useState<InvoiceablePatientReport | undefined>();
  const [selectedReportForStatement, setSelectedReportForStatement] = useState<InvoiceablePatientReport | undefined>();
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());
  const [sendingTaskIds, setSendingTaskIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [chatAppointmentMessaging, setChatAppointmentMessaging] = useState<AppointmentMessaging | undefined>();
  const [chatQuickTextsContext, setChatQuickTextsContext] = useState<QuickTextsContextValue>({});
  const { phonesByLocationName } = useSupportPhonesMap();

  const pageParam = searchParams.get(SP.page);
  const parsedPage = pageParam ? parseInt(pageParam, 10) : 0;
  const pageSP = Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : 0;
  const [pageInputValue, setPageInputValue] = useState(String(pageSP + 1));
  const statusSP = searchParams.get(SP.status);
  const patientSP = searchParams.get(SP.patient);
  const sortFieldSP =
    (searchParams.get(SP.sortField) as InvoiceSortField | null) ?? InvoiceSortFieldValues.finalizationDate;
  const sortDirectionSP =
    (searchParams.get(SP.sortDirection) as InvoiceSortDirection | null) ?? InvoiceSortDirectionValues.desc;
  const zeroBalanceFilterEnabled = source !== 'ottehr-billing';
  const hideZeroBalanceSP = zeroBalanceFilterEnabled ? searchParams.get(SP.hideZeroBalance) !== 'false' : false;
  const {
    data: invoiceablePatients,
    isLoading: isInvoiceablePatientsLoading,
    refetch: refetchInvoiceablePatients,
  } = useQuery<GetInvoicesTasksResponse>({
    queryKey: [
      GET_INVOICES_TASKS_ZAMBDA_KEY,
      source,
      pageSP,
      statusSP,
      patientSP,
      sortFieldSP,
      sortDirectionSP,
      hideZeroBalanceSP,
    ],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const params: GetInvoicesTasksInput = {
        page: pageSP,
        status: statusSP ? mapDisplayToInvoiceTaskStatus(statusSP as InvoiceTaskDisplayStatus) : undefined,
        patientId: patientSP ?? undefined,
        sortField: sortFieldSP,
        sortDirection: sortDirectionSP,
        hideZeroBalance: hideZeroBalanceSP,
        source,
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

  const totalPages = Math.ceil((invoiceablePatients?.totalCount ?? 0) / INVOICEABLE_PATIENTS_PAGE_SIZE);

  const setPage = (page: number): void => {
    searchParams.set(SP.page, page.toString());
    setSearchParams(searchParams);
  };

  const handlePageJump = (
    e: React.KeyboardEvent<HTMLDivElement> | React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    if ('key' in e && e.key !== 'Enter') return;
    if (totalPages === 0) return;

    let targetPage = parseInt(pageInputValue, 10);

    if (isNaN(targetPage) || targetPage < 1) {
      targetPage = 1;
    } else if (targetPage > totalPages) {
      targetPage = totalPages;
    }

    setPageInputValue(String(targetPage));

    if (targetPage - 1 !== pageSP) {
      setPage(targetPage - 1);
    }
  };

  const setSortField = (field: InvoiceSortField): void => {
    if (field === sortFieldSP) {
      searchParams.set(
        SP.sortDirection,
        sortDirectionSP === InvoiceSortDirectionValues.desc
          ? InvoiceSortDirectionValues.asc
          : InvoiceSortDirectionValues.desc
      );
    } else {
      searchParams.set(SP.sortField, field);
      searchParams.set(SP.sortDirection, InvoiceSortDirectionValues.desc);
    }
    searchParams.set(SP.page, '0');
    setSearchParams(searchParams);
  };

  const sendInvoice = async (taskId: string, invoiceTaskInput: InvoiceTaskInput): Promise<void> => {
    try {
      if (oystehrZambda) {
        setSendingTaskIds((prev) => new Set(prev).add(taskId));

        await updateInvoiceTask(oystehrZambda, {
          taskId,
          status: mapDisplayToInvoiceTaskStatus('sending'),
          invoiceTaskInput,
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
    if (!oystehrZambda || !taskId) return;

    setUpdatingTaskIds((prev) => new Set(prev).add(taskId));

    updateInvoiceTask(oystehrZambda, {
      taskId,
      status: mapDisplayToInvoiceTaskStatus('updating'),
    })
      .then(async () => {
        enqueueSnackbar('Invoice status changed to "updating"', { variant: 'success' });
        await refetchInvoiceablePatients();
      })
      .catch(() => {
        enqueueSnackbar('Error occurred, please try again', { variant: 'error' });
      })
      .finally(() => {
        setUpdatingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      });
  };

  const handleExportCsv = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setIsExporting(true);
    try {
      // Step 1: Kick off export by creating a Task
      const params: ExportInvoicesTasksCsvInput = {
        status: statusSP ? mapDisplayToInvoiceTaskStatus(statusSP as InvoiceTaskDisplayStatus) : undefined,
        sortField: sortFieldSP,
        sortDirection: sortDirectionSP,
        hideZeroBalance: hideZeroBalanceSP,
        source,
      };
      const kickOffResponse = await oystehrZambda.zambda.execute({
        id: EXPORT_INVOICES_ZAMBDA_KEY,
        ...params,
      });
      const { taskId } = chooseJson(kickOffResponse) as ExportInvoicesCsvKickOffResponse;

      // Step 2: Poll for completion
      const POLL_INTERVAL_MS = 2000;
      const MAX_POLLS = 150; // 5 minutes max
      let polls = 0;

      const pollForResult = async (): Promise<ExportInvoicesCsvStatusResponse> => {
        while (polls < MAX_POLLS) {
          polls++;
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          const statusResponse = await oystehrZambda.zambda.execute({
            id: EXPORT_INVOICES_ZAMBDA_KEY,
            taskId,
          });
          const statusData = chooseJson(statusResponse) as ExportInvoicesCsvStatusResponse;

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            return statusData;
          }
        }
        throw new Error('Export timed out');
      };

      const result = await pollForResult();

      if (result.status === 'completed' && result.downloadUrl) {
        // Step 3: Download the CSV via the presigned URL
        const csvResponse = await fetch(result.downloadUrl);
        if (!csvResponse.ok) {
          throw new Error(`Failed to download CSV: ${csvResponse.status}`);
        }
        const csvText = await csvResponse.text();
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoiceable-patients-report-${source}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        enqueueSnackbar(result.error ?? 'Export failed', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Failed to export CSV', { variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenChat = async (report: InvoiceablePatientReport): Promise<void> => {
    if (!oystehr) {
      enqueueSnackbar('API client not available', { variant: 'error' });
      return;
    }
    try {
      // Look up the patient's RelatedPersons. Match the tracking board's phone-number
      // discovery: only consider "user-relatedperson" accounts and only their SMS
      // telecom value that passes getSMSNumberForIndividual (system === 'sms' and a
      // '+'-prefixed value).
      const bundle = await oystehr.fhir.search({
        resourceType: 'RelatedPerson',
        params: [{ name: 'patient', value: `Patient/${report.patient.patientId}` }],
      });
      const relatedPersons = bundle.unbundle().filter((r): r is RelatedPerson => r.resourceType === 'RelatedPerson');

      const isUserRelatedPerson = (rp: RelatedPerson): boolean =>
        getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson';

      const recipientsMap = new Map<string, { recipientResourceUri: string; smsNumber: string }>();
      relatedPersons.forEach((rp) => {
        if (!rp.id || !isUserRelatedPerson(rp)) return;
        const smsNumber = getSMSNumberForIndividual(rp);
        if (!smsNumber) return;
        const recipientResourceUri = `RelatedPerson/${rp.id}`;
        const key = `${recipientResourceUri}|${smsNumber}`;
        if (!recipientsMap.has(key)) {
          recipientsMap.set(key, { recipientResourceUri, smsNumber });
        }
      });
      const recipients = Array.from(recipientsMap.values());

      if (recipients.length === 0) {
        enqueueSnackbar('No related person with a valid SMS number found for this patient — cannot send SMS', {
          variant: 'warning',
        });
        return;
      }

      const nameParts = report.patient.fullName.split(' ');

      const messaging: AppointmentMessaging = {
        id: report.task.id ?? report.claimId,
        encounterId: report.claimId,
        smsModel: {
          recipients,
          hasUnreadMessages: false,
        },
        patient: {
          id: report.patient.patientId,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          dateOfBirth: report.patient.dob ?? '',
        },
      };

      setChatQuickTextsContext({
        patientAppUrl: VITE_APP_PATIENT_APP_URL,
        patientFirstName: nameParts[0],
        patientLastName: nameParts.slice(1).join(' '),
        visitId: report.appointmentId,
        locationName: report.location,
        locationReviewLink: report.locationReviewLink,
        bookingTime: report.visitDate,
        officePhone: report.officePhone,
        supportPhone: getSupportPhoneFor(report.location, phonesByLocationName) || '',
      });
      setChatAppointmentMessaging(messaging);
    } catch (err) {
      console.error('Failed to open chat', err);
      enqueueSnackbar('Failed to open SMS chat', { variant: 'error' });
    }
  };

  useEffect(() => {
    setPageInputValue(String(pageSP + 1));
  }, [pageSP]);

  useEffect(() => {
    const filtersValues = {
      status: searchParams.get(SP.status),
      patient: searchParams.get(SP.patient),
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
        // Preserve sort and hideZeroBalance params — they are managed separately from the form
        if (searchParams.has(SP.sortField)) queryParams.set(SP.sortField, searchParams.get(SP.sortField)!);
        if (searchParams.has(SP.sortDirection)) queryParams.set(SP.sortDirection, searchParams.get(SP.sortDirection)!);
        if (searchParams.has(SP.hideZeroBalance))
          queryParams.set(SP.hideZeroBalance, searchParams.get(SP.hideZeroBalance)!);
        setSearchParams(queryParams);
        if (Object.keys(filtersToPersist).length > 0) {
          localStorage.setItem(localStorageFiltersKey, JSON.stringify(filtersToPersist));
        } else {
          localStorage.removeItem(localStorageFiltersKey);
        }
      },
    });
    return () => callback();
  }, [methods, searchParams, setSearchParams, localStorageFiltersKey]);

  useEffect(() => {
    const persistedFilters = localStorage.getItem(localStorageFiltersKey);
    if (searchParams.size === 0) {
      const queryParams = new URLSearchParams();
      if (persistedFilters != null) {
        const filters = JSON.parse(persistedFilters) as Record<string, string>;
        for (const key in filters) {
          if (key && filters[key]) queryParams.set(key, filters[key]);
        }
      }
      if (!queryParams.has(SP.sortField)) queryParams.set(SP.sortField, InvoiceSortFieldValues.finalizationDate);
      if (!queryParams.has(SP.sortDirection)) queryParams.set(SP.sortDirection, InvoiceSortDirectionValues.desc);
      if (zeroBalanceFilterEnabled && !queryParams.has(SP.hideZeroBalance)) queryParams.set(SP.hideZeroBalance, 'true');
      setSearchParams(queryParams);
    }
  }, [searchParams, setSearchParams, localStorageFiltersKey, zeroBalanceFilterEnabled]);

  return (
    <Box>
      <FormProvider {...methods}>
        <Paper>
          <Stack direction="row" spacing={2} padding="8px" alignItems="center" flexWrap="wrap">
            <Box sx={{ width: '30%' }}>
              <SelectInput name="status" label="Status" options={InvoiceTaskDisplayStatuses as unknown as string[]} />
            </Box>
            <TextField
              {...methods.register('patient')}
              label="Patient id"
              sx={{ width: '30%', flex: 1 }}
              size="small"
            />
            {zeroBalanceFilterEnabled && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hideZeroBalanceSP}
                    onChange={(e) => {
                      searchParams.set(SP.hideZeroBalance, e.target.checked ? 'true' : 'false');
                      searchParams.set(SP.page, '0');
                      setSearchParams(searchParams);
                    }}
                  />
                }
                label="Hide $0 balances"
                sx={{ whiteSpace: 'nowrap' }}
              />
            )}
            {FEATURE_FLAGS.OTTEHR_BILLING_INVOICING_ENABLED && (
              <Chip label={INVOICE_TASK_SOURCE_LABELS[source]} variant="outlined" color="primary" size="small" />
            )}
            <Button
              variant="text"
              size="small"
              startIcon={isExporting ? <CircularProgress size={16} /> : <SaveAltIcon />}
              sx={{ textTransform: 'uppercase', whiteSpace: 'nowrap', ml: 'auto' }}
              disabled={isExporting}
              onClick={handleExportCsv}
            >
              Export
            </Button>
          </Stack>
        </Paper>
      </FormProvider>
      <Paper sx={{ mt: 2 }}>
        <Table sx={{ width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography fontWeight="500" fontSize="14px">
                  Patient Name
                </Typography>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortFieldSP === InvoiceSortFieldValues.appointmentDate}
                  direction={
                    sortFieldSP === InvoiceSortFieldValues.appointmentDate
                      ? sortDirectionSP
                      : InvoiceSortDirectionValues.desc
                  }
                  onClick={() => setSortField(InvoiceSortFieldValues.appointmentDate)}
                >
                  <Typography fontWeight="500" fontSize="14px">
                    Date of Service
                  </Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortFieldSP === InvoiceSortFieldValues.finalizationDate}
                  direction={
                    sortFieldSP === InvoiceSortFieldValues.finalizationDate
                      ? sortDirectionSP
                      : InvoiceSortDirectionValues.desc
                  }
                  onClick={() => setSortField(InvoiceSortFieldValues.finalizationDate)}
                >
                  <Typography fontWeight="500" fontSize="14px">
                    Finalization Date
                  </Typography>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <Typography fontWeight="500" fontSize="14px">
                  Amount
                </Typography>
              </TableCell>
              <TableCell>
                <Typography fontWeight="500" fontSize="14px">
                  Invoice Status
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography fontWeight="500" fontSize="14px">
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isInvoiceablePatientsLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : null}
            {!isInvoiceablePatientsLoading && (invoiceablePatients?.reports ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
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
                const maskedClaimId =
                  report.claimId.length > 12
                    ? `${report.claimId.slice(0, 6)}...${report.claimId.slice(-4)}`
                    : report.claimId;

                return (
                  <TableRow key={report.task.id}>
                    <TableCell>
                      <GenericToolTip
                        customWidth={340}
                        title={
                          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                DOB
                              </Typography>
                              <Typography variant="body2">{report.patient.dob ?? '---'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Responsible Party
                              </Typography>
                              <Typography variant="body2">{report.responsibleParty.fullName ?? '---'}</Typography>
                              <Typography variant="body2">
                                {report.responsibleParty.relationshipToPatient ?? '---'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                RCM Claim ID
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                  {maskedClaimId}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void navigator.clipboard
                                      .writeText(report.claimId)
                                      .then(() => enqueueSnackbar('Copied to clipboard', { variant: 'success' }));
                                  }}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          </Box>
                        }
                      >
                        <Box sx={{ display: 'inline-flex' }}>
                          <Link
                            to={`/patient/${report.patient.patientId}`}
                            style={{ textDecoration: 'underline', color: 'inherit' }}
                          >
                            <Typography variant="inherit">{report.patient.fullName}</Typography>
                          </Link>
                        </Box>
                      </GenericToolTip>
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
                      <Typography variant="body1">${(report.amountInvoiceable / 100).toFixed(2)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`${statusTooltipMessage} (click to copy)`}>
                        <span
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void navigator.clipboard
                              .writeText(statusTooltipMessage)
                              .then(() => enqueueSnackbar('Status copied to clipboard', { variant: 'success' }));
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <MappedStatusChip status={displayStatus} mapper={INVOICEABLE_TASK_STATUS_COLORS_MAP} />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <Tooltip title="Refresh invoice">
                        <IconButton
                          size="small"
                          sx={{
                            mr: 1,
                            border: '2px solid',
                            borderColor: 'primary.main',
                            backgroundColor: '#fff',
                            width: 36,
                            height: 36,
                            '&:hover': { backgroundColor: 'primary.50' },
                          }}
                          onClick={() => {
                            updateInvoice(report.task.id);
                          }}
                        >
                          <RefreshIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                        </IconButton>
                      </Tooltip>
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
                      <Button
                        sx={{ ml: 1 }}
                        variant="contained"
                        disabled={
                          isUpdating || isSending || displayStatus === 'updating' || displayStatus === 'sending'
                        }
                        onClick={() => {
                          setSelectedReportForStatement(report);
                        }}
                      >
                        Statement
                      </Button>
                      <Tooltip title="Send SMS">
                        <IconButton
                          sx={{
                            ml: 1,
                            backgroundColor: 'primary.main',
                            width: 36,
                            height: 36,
                            borderRadius: '100%',
                            '&:hover': { backgroundColor: 'primary.main' },
                          }}
                          onClick={() => handleOpenChat(report)}
                        >
                          <ChatOutlinedIcon sx={{ color: '#fff', width: 20, height: 20 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Contact by Phone">
                        <span>
                          <IconButton
                            size="small"
                            disabled
                            sx={{
                              ml: 1,
                              backgroundColor: 'grey.400',
                              width: 32,
                              height: 32,
                              '&.Mui-disabled': { backgroundColor: 'grey.300' },
                            }}
                          >
                            <PhoneIcon sx={{ color: '#fff', fontSize: 18 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 2 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Go to page
            </Typography>
            <TextField
              size="small"
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onKeyDown={handlePageJump}
              onBlur={handlePageJump}
              disabled={isInvoiceablePatientsLoading || totalPages <= 1}
              inputProps={{
                style: { padding: '4px 8px', width: '35px', textAlign: 'center' },
                'aria-label': 'Go to page',
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              of {totalPages}
            </Typography>
          </Box>
        </Box>
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
      <SendStatementToPatientDialog
        modalOpen={selectedReportForStatement !== undefined}
        handleClose={() => {
          setSelectedReportForStatement(undefined);
        }}
        onSubmit={() => {
          // TODO: implement send statement
          setSelectedReportForStatement(undefined);
        }}
        report={selectedReportForStatement}
      />
      {chatAppointmentMessaging && (
        <ChatModal
          appointment={chatAppointmentMessaging}
          onClose={() => {
            setChatAppointmentMessaging(undefined);
          }}
          onMarkAllRead={() => {}}
          quickTextsContext={chatQuickTextsContext}
        />
      )}
    </Box>
  );
}
