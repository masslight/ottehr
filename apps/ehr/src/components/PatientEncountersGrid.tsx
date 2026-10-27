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
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { FC, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getInPersonUrlByAppointmentType,
  withFollowUpEncounterId,
} from 'src/features/visits/in-person/routing/helpers';
import { ROUTER_PATH } from 'src/features/visits/in-person/routing/routesInPerson';
import { getVisitTypeLabelForTypeAndServiceMode } from 'src/shared/utils/formatLabelValue';
import { visitTypeToInPersonLabel, visitTypeToTelemedLabel } from 'src/types/types';
import styled from 'styled-components';
import { getAnnotationFollowupStatusLabel, getFollowUpProgressNotePathSegment } from 'utils/lib/fhir/encounter';
import { AppointmentType, visitStatusArray } from 'utils/lib/types/api/appointment.types';
import {
  AppointmentHistoryRow,
  FollowUpVisitHistoryRow,
  FreeFormEncounterHistoryRow,
  PatientVisitListResponse,
} from 'utils/lib/types/api/patient-visit-history.types';
import { ServiceMode } from 'utils/lib/types/common';
import { formatMinutes } from 'utils/lib/utils/visitUtils';
import { dataTestIds } from '../constants/data-test-ids';
import { FEATURE_FLAGS } from '../constants/feature-flags';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import { useMergedServiceCategories } from '../hooks/useMergedServiceCategories';
import { useServiceCategoryAbbreviationResolver } from '../hooks/useServiceCategoryAbbreviation';
import { FreeFormEncounterRow, FreeFormSaveSession } from './FreeFormEncounterRow';
import {
  applyLocalFreeFormSaves,
  filterVisitsByServiceCategory,
  mergeEncounterGridRows,
  pruneCaughtUpLocalSaves,
} from './patientEncountersFilters';
import { RoundedButton } from './RoundedButton';

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

export const FREE_FORM_RECONCILE_DELAYS_MS = [0, 1000, 2000, 4000, 8000];

interface FreeFormDraft {
  draftId: string;
  patientId: string;
  createdAt: string;
  encounterId?: string;
  reconcileExhausted?: boolean;
}

interface LocalFreeFormSaves {
  patientId: string | undefined;
  rows: Record<string, FreeFormEncounterHistoryRow>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
  { id: 'type', label: 'Type & Service Category', width: 180 },
  { id: 'reason', label: "Reason for today's visit", width: 150 },
  { id: 'provider', label: 'Provider', width: 150 },
  { id: 'office', label: 'Office', width: 150 },
  { id: 'los', label: 'LOS', width: 100 },
  { id: 'info', label: 'Visit Info', width: 120, align: 'center' },
  { id: 'note', label: 'Progress Note', width: 150 },
];

export const PatientEncountersGrid: FC<PatientEncountersGridProps> = (props) => {
  const { patient, totalCount, latestVisitDate } = props;
  const { id: routePatientId } = useParams();
  const currentPatientId = patient?.id && patient.id === routePatientId ? patient.id : undefined;

  const [type, setType] = useState('all');
  const [period, setPeriod] = useState(0);
  const [status, setStatus] = useState('all');
  const [serviceCategory, setServiceCategory] = useState('all');
  const serviceCategories = useMergedServiceCategories();
  const resolveServiceCategoryAbbr = useServiceCategoryAbbreviationResolver();
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideNoShow, setHideNoShow] = useState(false);
  const [sortField, setSortField] = useState<SortField>('dateTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();

  const {
    data: visitHistory,
    isLoading: visitHistoryIsLoading,
    refetch: refetchVisitHistory,
  } = useQuery({
    queryKey: [`get-patient-visit-history`, { patientId: currentPatientId, status, type, period }],
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
      if (oystehrZambda && currentPatientId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-patient-visit-history',
          patientId: currentPatientId,
          type: typeParam,
          serviceMode,
          status: status !== 'all' ? [status] : undefined,
          from,
          sortDirection,
          supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
        });
        return result.output as PatientVisitListResponse;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    enabled: Boolean(currentPatientId) && Boolean(oystehrZambda),
  });

  const [storedDraft, setDraft] = useState<FreeFormDraft | null>(null);
  const draft = storedDraft?.patientId === currentPatientId ? storedDraft : null;
  const draftRef = useRef<FreeFormDraft | null>(null);
  const draftCounterRef = useRef(0);
  const [draftEditing, setDraftEditing] = useState(false);
  const [localSaves, setLocalSaves] = useState<LocalFreeFormSaves>({ patientId: currentPatientId, rows: {} });
  const generationRef = useRef(0);

  const updateDraft = useCallback((update: (current: FreeFormDraft | null) => FreeFormDraft | null): void => {
    draftRef.current = update(draftRef.current);
    setDraft(draftRef.current);
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    updateDraft(() => null);
    setDraftEditing(false);
    setLocalSaves({ patientId: currentPatientId, rows: {} });
    return () => {
      generationRef.current += 1;
    };
  }, [currentPatientId, updateDraft]);

  const filteredVisits = useMemo(() => {
    let visits = visitHistory?.visits ?? [];

    if (hideCancelled) {
      visits = visits.filter((item) => item.status !== 'cancelled');
    }

    if (hideNoShow) {
      // not sure why all virtual visits are kept but keeping this pre-existing logic
      visits = visits.filter((item) => item.serviceMode === ServiceMode.virtual || item.status !== 'no show');
    }

    if (serviceCategory !== 'all') {
      visits = filterVisitsByServiceCategory(visits, serviceCategory);
    }

    return visits;
  }, [visitHistory, hideCancelled, hideNoShow, serviceCategory]);

  const serverFreeFormEncounters = visitHistory?.freeFormEncounters;
  const freeFormEncounters = useMemo(
    () =>
      applyLocalFreeFormSaves(
        serverFreeFormEncounters ?? [],
        localSaves.patientId === currentPatientId ? Object.values(localSaves.rows) : []
      ),
    [serverFreeFormEncounters, localSaves, currentPatientId]
  );

  const includeFreeForm = type === 'all' && status === 'all' && serviceCategory === 'all';
  const allRows = useMemo(
    () => mergeEncounterGridRows(filteredVisits, freeFormEncounters, { includeFreeForm, sortDirection }),
    [filteredVisits, freeFormEncounters, includeFreeForm, sortDirection]
  );

  const draftEncounterId = draft?.encounterId;
  const visibleRows = useMemo(
    () =>
      draftEncounterId ? allRows.filter((row) => !(row.kind === 'free-form' && row.id === draftEncounterId)) : allRows,
    [allRows, draftEncounterId]
  );

  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return visibleRows.slice(startIndex, startIndex + rowsPerPage);
  }, [visibleRows, page, rowsPerPage]);

  useEffect(() => {
    if (!serverFreeFormEncounters) return;
    setLocalSaves((current) => {
      const rows = pruneCaughtUpLocalSaves(serverFreeFormEncounters, current.rows);
      return rows === current.rows ? current : { ...current, rows };
    });
  }, [serverFreeFormEncounters]);

  useEffect(() => {
    if (!draft?.encounterId || draftEditing) return;
    const { encounterId, reconcileExhausted } = draft;
    const onServer = serverFreeFormEncounters?.some((row) => row.encounterId === encounterId) ?? false;
    if (!onServer && !reconcileExhausted) return;

    const index = allRows.findIndex((row) => row.kind === 'free-form' && row.id === encounterId);
    if (index >= 0) setPage(Math.floor(index / rowsPerPage));
    updateDraft(() => null);
  }, [draft, draftEditing, serverFreeFormEncounters, allRows, rowsPerPage, updateDraft]);

  const reconcileCreatedNote = useCallback(
    async (isCurrent: () => boolean, encounterId: string): Promise<void> => {
      let lastAttemptFailed = false;
      for (const delay of FREE_FORM_RECONCILE_DELAYS_MS) {
        if (delay) await sleep(delay);
        if (!isCurrent()) return;
        const result = await refetchVisitHistory();
        if (!isCurrent()) return;
        lastAttemptFailed = result.isError;
        if (result.data?.freeFormEncounters.some((row) => row.encounterId === encounterId)) return;
      }
      updateDraft((current) =>
        current?.encounterId === encounterId ? { ...current, reconcileExhausted: true } : current
      );
      enqueueSnackbar(
        lastAttemptFailed
          ? "Note saved, but the visit list couldn't refresh"
          : 'Note saved; it may take a moment to appear after a reload',
        { variant: 'warning' }
      );
    },
    [refetchVisitHistory, updateDraft]
  );

  const createSaveSession = useCallback(
    (draftId?: string): FreeFormSaveSession => {
      const generation = generationRef.current;
      const isCurrent = (): boolean =>
        generation === generationRef.current && (draftId === undefined || draftRef.current?.draftId === draftId);
      return {
        isCurrent,
        onSaved: (saved, created) => {
          if (!isCurrent()) return;
          setLocalSaves((current) => ({ ...current, rows: { ...current.rows, [saved.encounterId]: saved } }));
          if (draftId === undefined || !created) return;
          updateDraft((current) =>
            current?.draftId === draftId ? { ...current, encounterId: saved.encounterId } : current
          );
          void reconcileCreatedNote(isCurrent, saved.encounterId);
        },
      };
    },
    [reconcileCreatedNote, updateDraft]
  );

  const handleAddFreeForm = (): void => {
    if (!currentPatientId) return;
    setType('all');
    setStatus('all');
    setServiceCategory('all');
    setPage(0);
    draftCounterRef.current += 1;
    const draftId = String(draftCounterRef.current);
    updateDraft(() => ({ draftId, patientId: currentPatientId, createdAt: DateTime.now().toISO() }));
  };

  const discardDraft = useCallback((): void => {
    setDraftEditing(false);
    updateDraft(() => null);
  }, [updateDraft]);

  const draftSavedRow = draftEncounterId
    ? freeFormEncounters.find((row) => row.encounterId === draftEncounterId)
    : undefined;

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
        const serviceCategoryAbbr = resolveServiceCategoryAbbr(encounter.serviceCategory);
        return (
          <Stack component="span" direction="column" spacing={0}>
            <Typography variant="body2">{typeText}</Typography>
            {serviceCategoryAbbr && <Typography variant="body2">{serviceCategoryAbbr}</Typography>}
          </Stack>
        );
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
        // Scheduled follow-ups use encounter status directly (planned, arrived, etc.)
        // Annotation follow-ups use OPEN/RESOLVED
        if (encounter.followupSubtype === 'scheduled') {
          return <Typography variant="body2">{encounter.status}</Typography>;
        }
        return getFollowupStatusChip(getAnnotationFollowupStatusLabel(encounter.status));
      }
      case 'info': {
        if (encounter.followupSubtype !== 'scheduled' || !encounter.appointmentId) return null;
        return (
          <RoundedButton to={`/visit/${encounter.appointmentId}`} state={{ encounterId: encounter.encounterId }}>
            Visit Info
          </RoundedButton>
        );
      }
      case 'note': {
        const { encounterId, originalAppointmentId, followupSubtype, status } = encounter;
        if (!originalAppointmentId) return '-';
        if (typeof status === 'string' && ['planned', 'arrived'].includes(status)) {
          return null;
        }
        const pathSegment = getFollowUpProgressNotePathSegment(followupSubtype);
        const to = getInPersonUrlByAppointmentType(
          { id: originalAppointmentId, encounterId, isFollowUp: true },
          pathSegment
        );
        return <RoundedButton to={to}>Progress Note</RoundedButton>;
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
        return row.status;
      case 'type': {
        const typeLabel = getVisitTypeLabelForTypeAndServiceMode({ type: row.type, serviceMode: row.serviceMode });
        const serviceCategoryAbbr = resolveServiceCategoryAbbr(row.serviceCategory);
        return (
          <Stack component="span" direction="column" spacing={0}>
            <Typography variant="body2">{typeLabel}</Typography>
            {serviceCategoryAbbr && <Typography variant="body2">{serviceCategoryAbbr}</Typography>}
          </Stack>
        );
      }
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
        return (
          <RoundedButton to={`/visit/${row.appointmentId}`} state={{ encounterId: row.encounterId }}>
            Visit Info
          </RoundedButton>
        );
      }
      case 'note': {
        const baseUrl = `/in-person/${row.appointmentId}/${ROUTER_PATH.REVIEW_AND_SIGN}`;
        const to = row.encounterId
          ? withFollowUpEncounterId(baseUrl, { isFollowUp: true, encounterId: row.encounterId })
          : baseUrl;
        return <RoundedButton to={to}>Progress Note</RoundedButton>;
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
        <RoundedButton
          to={patient?.id ? `/visits/add?patientId=${patient.id}` : '/visits/add'}
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
        >
          New Visit
        </RoundedButton>
        <RoundedButton
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => navigate('followup/add')}
        >
          Follow-up
        </RoundedButton>
        <RoundedButton
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleAddFreeForm}
          disabled={!currentPatientId || draft !== null}
          data-testid={dataTestIds.patientRecordPage.addFreeFormButton}
        >
          Free Form
        </RoundedButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          fullWidth
          label="Type"
          select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(0);
          }}
        >
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
          label="Service Category"
          select
          value={serviceCategory}
          onChange={(e) => {
            setServiceCategory(e.target.value);
            setPage(0);
          }}
        >
          <MenuItem value="all">All</MenuItem>
          {serviceCategories.map((sc) => (
            <MenuItem key={sc.code} value={sc.code}>
              {sc.display}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          fullWidth
          label="Visit Period"
          select
          value={period}
          onChange={(e) => {
            setPeriod(+e.target.value);
            setPage(0);
          }}
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
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <MenuItem value="all">All</MenuItem>
          {[...new Set(visitStatusArray.filter((item) => item !== 'cancelled'))].map((status) => (
            <MenuItem key={status} value={status}>
              {capitalize(status)}
            </MenuItem>
          ))}
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
            {draft && currentPatientId && (
              <FreeFormEncounterRow
                key={`draft-${draft.draftId}`}
                patientId={currentPatientId}
                dateTime={draftSavedRow?.dateTime ?? draft.createdAt}
                encounterId={draft.encounterId}
                note={draftSavedRow?.note ?? ''}
                columnCount={columns.length}
                isDraft
                startSave={() => createSaveSession(draft.draftId)}
                onDiscardDraft={discardDraft}
                onEditingChange={setDraftEditing}
              />
            )}
            {visitHistoryIsLoading || !currentPatientId ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4 }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              !draft && (
                <TableRow>
                  <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4 }}>
                    No encounters found
                  </TableCell>
                </TableRow>
              )
            ) : (
              paginatedData.map((gridRow, index) => {
                if (gridRow.kind === 'free-form') {
                  return (
                    <FreeFormEncounterRow
                      key={gridRow.id}
                      patientId={currentPatientId ?? ''}
                      dateTime={gridRow.encounter.dateTime}
                      encounterId={gridRow.encounter.encounterId}
                      note={gridRow.encounter.note}
                      columnCount={columns.length}
                      startSave={() => createSaveSession()}
                    />
                  );
                }
                const row = gridRow.visit;
                const rowId = row.appointmentId || `row-${index}`;
                const followupEncountersForRow = [...(row.followUps ?? [])].sort(
                  (a, b) =>
                    DateTime.fromISO(a.dateTime ?? '').diff(DateTime.fromISO(b.dateTime ?? ''), 'milliseconds')
                      .milliseconds
                );
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
        rowsPerPageOptions={[20]}
        component="div"
        count={visibleRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};
