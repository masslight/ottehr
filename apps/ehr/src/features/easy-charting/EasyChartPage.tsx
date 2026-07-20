import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { captureException } from '@sentry/react';
import type { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApiClients } from 'src/hooks/useAppClients';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import { useMergedProcedureQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { getPatientName } from 'src/shared/utils';
import { CommandPaletteItem } from 'src/state/command-palette.store';
import {
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  formatWeightKg,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  ProcedureDTO,
  ProcedureQuickPickData,
  SUPPLIES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  TIME_SPENT_VALUE_SET_URL,
} from 'utils';
import { showEnvironmentBanner } from '../../App';
import { AmbientScribeFab } from '../visits/in-person/components/progress-note/AmbientScribeFab';
import { AssistantColumn } from './AssistantColumn';
import {} from './chart-types';
import { computeChartWarnings } from './intent-logic';
import { NoteSections } from './NoteSections';
import { useAiProvenance } from './useAiProvenance';
import { useChartAssistant } from './useChartAssistant';
import { useChartData } from './useChartData';
import { useEasyChartQuickPicks } from './useEasyChartQuickPicks';

export default function EasyChartPage(): JSX.Element {
  const { encounterId } = useParams<{ encounterId: string }>();
  const { oystehr } = useApiClients();

  // Deletions must drop items from the AI needs-review map, but the provenance layer is built ON
  // TOP of the chart-data layer — so the callback goes through a ref that's pointed at
  // clearAiChartedId right after the provenance hook runs (assignment during render is safe here:
  // the callback only fires from event/async time).
  const onResourceDeletedRef = useRef<(resourceId: string) => void>(() => undefined);
  // Chart-data layer: the chart state + its sync mirror, initial load, save→merge, deletion with
  // the red-flash removal, lab orders, and the single-primary-diagnosis invariant.
  const {
    chartData,
    setChartData,
    chartDataRef,
    loading,
    error,
    labOrders,
    fetchLabOrders,
    handleRemoveLabOrder,
    freshlyAdded,
    setFreshlyAdded,
    removingItems,
    flashAndRemoveItem,
    mergeSaveResponse,
    saveAndMerge,
    deleteChartedResource,
    handleConfirmPatientInfo,
    handleMakePrimary,
  } = useChartData({
    encounterId,
    onResourceDeleted: (resourceId) => onResourceDeletedRef.current(resourceId),
  });
  // AI-provenance layer: which items the assistant wrote (and from what), the needs-review queue,
  // drift flags on AI free text, and the inline correction handlers.
  const {
    aiCharted,
    setAiCharted,
    hadAiItems,
    procedureProv,
    setProcedureProv,
    noteFieldMeta,
    setNoteFieldMeta,
    instructionMeta,
    pendingProvenanceRef,
    medDoseMismatchRef,
    withPendingProv,
    flagAiObsIds,
    clearAiChartedId,
    confirmAllAi,
    confirmProcedureField,
    confirmProcedure,
    aiSearch,
    aiReplace,
    aiSetMedDosage,
    aiSetRosState,
    aiRemove,
    detectNoteFieldDrift,
    confirmNoteField,
    confirmInstruction,
  } = useAiProvenance({ encounterId, chartDataRef, saveAndMerge, deleteChartedResource });
  onResourceDeletedRef.current = clearAiChartedId;
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reasonForVisit, setReasonForVisit] = useState<string | null>(null);

  useEasyChartQuickPicks(encounterId, async (p) => {
    await saveAndMerge(p);
  });
  const { quickPicks: procedureQuickPicks } = useMergedProcedureQuickPicks({ enabled: !!encounterId });

  // Register procedure quick-picks into the command palette ("Add Procedure"), mirroring the
  // other easy-chart palette categories in useEasyChartQuickPicks. Procedures can't use that
  // hook's one-shot saveAndMerge because they need the two-step save (CPT/dx resources first,
  // then the ServiceRequest); we route through saveProcedureFromQuickPick instead, held in a
  // ref so the registered items stay referentially stable across renders while the save logic
  // always sees the latest apiClient / chart state.
  const saveProcedureFromQuickPickRef = useRef<
    (qp: ProcedureQuickPickData) => Promise<{ resourceId?: string; inferredFields: Set<string> } | undefined>
  >(async () => undefined);
  const procedurePaletteItems = useMemo<CommandPaletteItem[]>(() => {
    if (!encounterId) return [];
    return procedureQuickPicks.map((qp) => ({
      id: `easy-chart-procedure-${qp.id ?? qp.name}`,
      label: qp.name,
      category: 'Add Procedure',
      keywords: [qp.procedureType, qp.name].filter(Boolean) as string[],
      onSelect: () => {
        void (async () => {
          try {
            await saveProcedureFromQuickPickRef.current(qp);
            enqueueSnackbar(`Added ${qp.name}`, { variant: 'success' });
          } catch (e) {
            console.error('Easy-chart procedure quick-pick save failed:', e);
            enqueueSnackbar(`Failed to add ${qp.name}`, { variant: 'error' });
          }
        })();
      },
    }));
  }, [procedureQuickPicks, encounterId]);
  useCommandPaletteSource('easy-chart-procedures', procedurePaletteItems);

  // Code → name lookup for procedureType. The regular ProceduresNew page saves the display
  // NAME (e.g. "Laceration Repair") instead of the code (e.g. "laceration-repair") so the
  // saved value matches what providers see in the Procedure Type dropdown. Mirror that here.
  const [procedureTypeNameByCode, setProcedureTypeNameByCode] = useState<Map<string, string>>(new Map());
  // Allowed-values registry per procedure field, keyed by ProcedureDTO field name.
  // Populated from the same FHIR ValueSets the regular ProceduresNew dropdowns use, so
  // when an admin edits those ValueSets the easy-chart accepts the new options without
  // any code change.
  const [procedureFieldAllowedValues, setProcedureFieldAllowedValues] = useState<
    Map<keyof ProcedureDTO, Map<string, string>>
  >(new Map());
  useEffect(() => {
    let cancelled = false;
    if (!oystehr) return;
    const fieldByUrl: { url: string; field: keyof ProcedureDTO }[] = [
      { url: PROCEDURE_TYPES_VALUE_SET_URL, field: 'procedureType' },
      { url: BODY_SIDES_VALUE_SET_URL, field: 'bodySide' },
      { url: BODY_SITES_VALUE_SET_URL, field: 'bodySite' },
      { url: COMPLICATIONS_VALUE_SET_URL, field: 'complications' },
      { url: MEDICATIONS_USED_VALUE_SET_URL, field: 'medicationUsed' },
      { url: PATIENT_RESPONSES_VALUE_SET_URL, field: 'patientResponse' },
      { url: POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL, field: 'postInstructions' },
      { url: SUPPLIES_VALUE_SET_URL, field: 'suppliesUsed' },
      { url: TECHNIQUES_VALUE_SET_URL, field: 'technique' },
      { url: TIME_SPENT_VALUE_SET_URL, field: 'timeSpent' },
    ];
    void (async () => {
      try {
        const bundle = await oystehr.fhir.search({
          resourceType: 'ValueSet',
          params: [{ name: 'url', value: fieldByUrl.map((f) => f.url).join(',') }],
        });
        const valueSets = bundle.unbundle() as {
          url?: string;
          version?: string;
          resourceType?: string;
          expansion?: { contains?: { code?: string; display?: string }[] };
        }[];
        const byUrl = new Map<string, { code: string; display: string }[]>();
        for (const vs of valueSets) {
          if (vs.resourceType !== 'ValueSet' || !vs.url) continue;
          const items = (vs.expansion?.contains ?? [])
            .filter((i): i is { code: string; display: string } => !!i.code && !!i.display)
            .map((i) => ({ code: i.code, display: i.display }));
          // ValueSets are versioned — take the latest by version.
          const existing = byUrl.get(vs.url);
          if (!existing || items.length > existing.length) byUrl.set(vs.url, items);
        }
        const procedureTypeItems = byUrl.get(PROCEDURE_TYPES_VALUE_SET_URL) ?? [];
        const ptMap = new Map<string, string>();
        for (const i of procedureTypeItems) ptMap.set(i.code, i.display);
        const allowed = new Map<keyof ProcedureDTO, Map<string, string>>();
        for (const { url, field } of fieldByUrl) {
          const items = byUrl.get(url) ?? [];
          const m = new Map<string, string>();
          for (const i of items) m.set(i.code, i.display);
          if (m.size > 0) allowed.set(field, m);
        }
        if (!cancelled) {
          setProcedureTypeNameByCode(ptMap);
          setProcedureFieldAllowedValues(allowed);
        }
      } catch (e) {
        // Degrades procedure charting (free-text instead of coded pickers) — capture so a broken
        // value-set fetch doesn't silently degrade every procedure for days.
        console.error('Failed to load procedure value sets:', e);
        captureException(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oystehr]);

  // Assistant layer: the conversation state machine, per-intent dispatcher + pickers, plan
  // execution, and the post-completion review pass. Built on the chart-data + provenance layers.
  const assistant = useChartAssistant({
    encounterId,
    chartData,
    chartDataRef,
    setChartData,
    saveAndMerge,
    mergeSaveResponse,
    deleteChartedResource,
    flashAndRemoveItem,
    setFreshlyAdded,
    fetchLabOrders,
    labOrders,
    setAiCharted,
    setProcedureProv,
    setNoteFieldMeta,
    withPendingProv,
    flagAiObsIds,
    clearAiChartedId,
    pendingProvenanceRef,
    medDoseMismatchRef,
    detectNoteFieldDrift,
    procedureQuickPicks,
    procedureTypeNameByCode,
    procedureFieldAllowedValues,
    saveProcedureFromQuickPickRef,
  });
  const { saveNoteField, handleInlineRemove, aiDiscuss, reviewLoading } = assistant;

  // Look up the encounter's appointmentId (for the "Open in regular chart" link) and its patient
  // (so the header can show name + DOB instead of the raw encounter id).
  useEffect(() => {
    let cancelled = false;
    if (!oystehr || !encounterId) return;
    void (async () => {
      try {
        const encounter = await oystehr.fhir.get<Encounter>({
          resourceType: 'Encounter',
          id: encounterId,
        });
        const ref = encounter.appointment?.[0]?.reference;
        const id = ref?.startsWith('Appointment/') ? ref.slice('Appointment/'.length) : null;
        if (!cancelled && id) setAppointmentId(id);
        if (id) {
          const appointment = await oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id });
          if (!cancelled) setReasonForVisit(appointment.description ?? null);
        }
        const patientRef = encounter.subject?.reference;
        const patientId = patientRef?.startsWith('Patient/') ? patientRef.slice('Patient/'.length) : null;
        if (patientId) {
          const p = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
          if (!cancelled) setPatient(p);
        }
      } catch (e) {
        console.error('Failed to fetch encounter for appointment/patient lookup:', e);
        captureException(e);
        if (!cancelled) {
          enqueueSnackbar('Could not load patient details for this encounter.', { variant: 'error' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oystehr, encounterId]);

  // Top chrome height (banner + navbar) to subtract from 100vh so each column scrolls within view.
  const topChrome = { xs: showEnvironmentBanner ? 116 : 56, sm: showEnvironmentBanner ? 124 : 64 };

  const notePane = loading ? (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size={20} />
    </Paper>
  ) : error ? (
    <Paper variant="outlined" sx={{ p: 2, borderColor: 'error.main' }}>
      <Typography variant="body2" color="error">
        {error}
      </Typography>
    </Paper>
  ) : chartData ? (
    <>
      {/* Verify name & DOB — a sign-blocking attestation, surfaced here so the provider can confirm
          it in-context (never auto-checked). */}
      <Box
        sx={{
          mb: 1.5,
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          bgcolor: chartData.patientInfoConfirmed?.value ? 'rgba(46,125,50,0.08)' : 'rgba(237,108,2,0.08)',
          border: '1px solid',
          borderColor: chartData.patientInfoConfirmed?.value ? 'rgba(46,125,50,0.3)' : 'rgba(237,108,2,0.3)',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={chartData.patientInfoConfirmed?.value ?? false}
              onChange={(e) => void handleConfirmPatientInfo(e.target.checked)}
            />
          }
          label={<Typography variant="body2">I verified patient&apos;s name and date of birth.</Typography>}
        />
      </Box>
      {(() => {
        // Sign-off readiness: consolidates the unreviewed-AI count and the deterministic consistency
        // warnings into one banner. Amber when warnings exist, blue when only review remains, green
        // once everything's clear (and something was AI-charted this session). Nothing on a clean
        // fully-manual note.
        // While the post-chart AI review runs, the banner slot shows a live in-progress state
        // instead, so a provider watching the note (not the chat) knows suggestions may still
        // land; on completion this falls through to the normal readiness banner.
        if (reviewLoading) {
          return (
            <Box
              sx={{
                mb: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                bgcolor: 'rgba(25,118,210,0.08)',
                border: '1px solid',
                borderColor: 'rgba(25,118,210,0.3)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={18} sx={{ color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Plan applied — AI review in progress…</strong>
                </Typography>
              </Box>
            </Box>
          );
        }
        const warnings = computeChartWarnings(chartData);
        const flaggedNoteFields =
          [...noteFieldMeta.values()].filter((m) => m.needsReview).length +
          [...instructionMeta.values()].filter((m) => m.needsReview).length;
        const unreviewed = aiCharted.size + procedureProv.size + flaggedNoteFields;
        const blocked = unreviewed > 0 || warnings.length > 0;
        if (!blocked && !hadAiItems) return null;
        const tone = warnings.length > 0 ? 'warn' : blocked ? 'info' : 'ok';
        const palette =
          tone === 'warn'
            ? { bg: 'rgba(237,108,2,0.08)', border: 'rgba(237,108,2,0.4)', icon: 'warning.main' }
            : tone === 'info'
            ? { bg: 'rgba(25,118,210,0.08)', border: 'rgba(25,118,210,0.3)', icon: 'primary.main' }
            : { bg: 'rgba(46,125,50,0.08)', border: 'rgba(46,125,50,0.3)', icon: 'success.main' };
        const lowConf = [...aiCharted.values()].filter((m) => m.lowConfidence).length;
        const reviewBit =
          unreviewed > 0
            ? `${unreviewed} AI ${unreviewed === 1 ? 'item needs' : 'items need'} review${
                lowConf > 0 ? ` (${lowConf} low-confidence)` : ''
              }`
            : '';
        const warnBit =
          warnings.length > 0 ? `${warnings.length} consistency ${warnings.length === 1 ? 'warning' : 'warnings'}` : '';
        const summary = blocked
          ? [reviewBit, warnBit].filter(Boolean).join(' · ')
          : 'All AI-charted items reviewed and no consistency warnings — ready to finalize.';
        return (
          <Box
            sx={{
              mb: 1.5,
              px: 1.5,
              py: 1,
              borderRadius: 1,
              bgcolor: palette.bg,
              border: '1px solid',
              borderColor: palette.border,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tone === 'ok' ? (
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: palette.icon }} />
              ) : tone === 'warn' ? (
                <WarningAmberIcon sx={{ fontSize: 18, color: palette.icon }} />
              ) : (
                <AutoAwesomeIcon sx={{ fontSize: 18, color: palette.icon }} />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {blocked ? <strong>{summary}</strong> : summary}
                {unreviewed > 0 && ' — click a highlighted item to confirm, change, or remove it.'}
              </Typography>
              {unreviewed > 0 && (
                <Button size="small" variant="outlined" sx={{ flexShrink: 0 }} onClick={confirmAllAi}>
                  Confirm all
                </Button>
              )}
            </Box>
            {warnings.length > 0 && (
              <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 3.5 }}>
                {warnings.map((w) => (
                  <Typography key={w.id} component="li" variant="caption" color="warning.dark">
                    {w.text}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        );
      })()}
      <NoteSections
        data={chartData}
        freshlyAdded={freshlyAdded}
        removingItems={removingItems}
        labOrders={labOrders}
        onRemoveLabOrder={handleRemoveLabOrder}
        editable
        onSaveField={saveNoteField}
        noteFieldMeta={noteFieldMeta}
        onConfirmNoteField={confirmNoteField}
        instructionMeta={instructionMeta}
        onConfirmInstruction={confirmInstruction}
        onRemoveItem={handleInlineRemove}
        onMakePrimary={handleMakePrimary}
        onSaveProcedure={(p) => {
          if (!encounterId) return;
          void saveAndMerge({ encounterId, procedures: [p] });
        }}
        onSaveVital={(v) => {
          if (!encounterId) return;
          // Editing a vital saves the updated value and counts as reviewing it (clears the flag).
          void saveAndMerge({ encounterId, vitalsObservations: [v] });
          clearAiChartedId(v.resourceId);
        }}
        procedureFieldAllowed={procedureFieldAllowedValues}
        aiCharted={aiCharted}
        onAiSearch={aiSearch}
        onAiReplace={aiReplace}
        onAiRemove={aiRemove}
        onEditExamComment={async (dto, newText) => {
          if (!encounterId) return;
          await saveAndMerge({ encounterId, examObservations: [{ ...dto, note: newText }] });
        }}
        onAiDiscuss={aiDiscuss}
        onAiSetMedDosage={aiSetMedDosage}
        onAiSetRosState={aiSetRosState}
        onAiConfirm={(dto) => clearAiChartedId(dto.resourceId)}
        procedureProvenance={procedureProv}
        onConfirmProcedureField={confirmProcedureField}
        onConfirmProcedure={confirmProcedure}
      />
    </>
  ) : null;

  // Read-only clinical-context strip (visit management stays in the regular chart). Name · DOB (age)
  // · sex on one line; weight, reason for visit, and allergies (emphasized when present) below.
  const headerName = patient ? getPatientName(patient.name).firstLastName ?? 'Unknown patient' : undefined;
  const headerDob = patient?.birthDate
    ? DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
    : undefined;
  const headerAge = patient?.birthDate
    ? (() => {
        const months = Math.floor(
          DateTime.now().diff(DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd'), 'months').months
        );
        return months >= 24 ? `${Math.floor(months / 12)}y` : `${months}mo`;
      })()
    : undefined;
  const headerSex = patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : undefined;
  const currentAllergies = (chartData?.allergies ?? [])
    .filter((a) => a.current === true)
    .map((a) => a.name)
    .filter((n): n is string => !!n);
  const headerWeightObs = (chartData?.vitalsObservations ?? []).find(
    (o) => o.field === 'vital-weight' && typeof (o as { value?: number }).value === 'number'
  ) as { value: number } | undefined;
  const headerWeight = headerWeightObs ? `${formatWeightKg(headerWeightObs.value)} kg` : undefined;
  const headerLine1 = [
    headerName,
    headerDob ? `DOB ${headerDob}${headerAge ? ` (${headerAge})` : ''}` : undefined,
    headerSex,
  ]
    .filter(Boolean)
    .join('  ·  ');

  // Cheap "nothing charted yet" proxy for the transcript prime banner — mirrors the `incremental`
  // signal in the assistant's narrative path: an E&M code or any charted diagnosis means a
  // write-up already happened (intake-harvested history alone doesn't count as charted).
  const chartLooksEmpty = !chartData?.emCode && !chartData?.diagnosis?.length;

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          {patient ? (
            <>
              <Typography variant="h6" fontWeight={600}>
                {headerLine1}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'baseline' }}>
                {headerWeight && (
                  <Typography variant="caption" color="text.secondary">
                    {headerWeight}
                  </Typography>
                )}
                {reasonForVisit && (
                  <Typography variant="caption" color="text.secondary">
                    Reason: {reasonForVisit}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    color: currentAllergies.length ? 'error.main' : 'text.secondary',
                    fontWeight: currentAllergies.length ? 700 : 400,
                  }}
                >
                  Allergies: {currentAllergies.length ? currentAllergies.join(', ') : 'none'}
                </Typography>
              </Box>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Encounter {encounterId}
            </Typography>
          )}
        </Box>
        {appointmentId && (
          <Button
            variant="outlined"
            size="small"
            component="a"
            href={`/in-person/${appointmentId}/cc-and-intake-notes`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textTransform: 'none' }}
          >
            Open in regular chart
          </Button>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '3fr minmax(320px, 2fr)' },
          gap: 2,
          // Constrain to viewport on md+ so each column scrolls independently
          height: { md: `calc(100vh - ${topChrome.sm}px - 80px)` },
        }}
      >
        {/* Left column: the note */}
        <Box sx={{ overflowY: { md: 'auto' }, pr: { md: 1 } }}>{notePane}</Box>

        {/* Right column: the assistant chat (thread + live turn + composer). */}
        <AssistantColumn assistant={assistant} aiChat={chartData?.aiChat} chartLooksEmpty={chartLooksEmpty} />
      </Box>

      {/* The assistant composer is pinned to this page's bottom-right, so lift the recorder Fab
          (and its popover) above it instead of the layout-default bottom: 8. */}
      {encounterId && (
        <AmbientScribeFab encounterId={encounterId} aiChat={chartData?.aiChat} fabBottom={160} popoverBottom={227} />
      )}
    </Container>
  );
}
