import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useRef } from 'react';
import { applyTemplate } from 'src/api/api';
import { CHART_DATA_QUERY_KEY, CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { buildChartSnapshot } from 'src/features/easy-chart/executor/chartSnapshot';
import { runPlan } from 'src/features/easy-chart/executor/runPlan';
import { ExecutionMode, HandlerContext } from 'src/features/easy-chart/executor/types';
import { useCatalogue } from 'src/features/easy-chart/hooks/useCatalogue';
import { useChartWriter } from 'src/features/easy-chart/hooks/useChartWriter';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { useApiClients } from 'src/hooks/useAppClients';
import { TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';
import { invalidateChartFields } from '../../hooks/useChartFields';
import { GET_MEDICATION_ORDERS_QUERY_KEY } from '../../stores/appointment/appointment.queries';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { resetExamObservationsStore } from '../../stores/appointment/reset-exam-observations';
import { useListTemplates } from '../templates/useListTemplates';
import { toPlannedAction } from './analysis';
import {
  applyRecommendations,
  errorMessage,
  pendingObservationIds,
  RecommendationRunner,
} from './applyRecommendations';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { TemplateRecommendation } from './types';

/**
 * Fallback for applying the recommended template. The provider normally picks the sections in the
 * apply-template dialog; this is what a template applied without going through it would use. The
 * transcript-derived items cover ROS, so the template does not overwrite it, and orders stay a
 * manual checklist, so the template's lab/procedure/medication plans are skipped.
 */
export const SCRIBE_TEMPLATE_SECTION_ACTIONS: TemplateSectionActions = {
  hpi: 'append',
  moi: 'skip',
  ros: 'skip',
  examFindings: 'overwrite',
  mdm: 'overwrite',
  diagnoses: 'append',
  patientInstructions: 'overwrite',
  cptCodes: 'append',
  emCode: 'overwrite',
  inHouseLabs: 'skip',
  externalLabs: 'skip',
  procedures: 'skip',
  inHouseMedications: 'skip',
};

/**
 * Writes the selected recommendations into the chart through the Easy Chart executor — the same
 * catalogues, handlers and shared save mutation the charting assistant ran on. Every step settles as
 * applied, skipped with a reason, or failed with a reason, and each verdict lands on its row.
 *
 * The template is the one exception: it writes whole sections through the apply-template endpoint, which
 * the executor deliberately never calls, so it goes first on its own path and the rest run on top of it.
 */
export const useApplyRecommendations = (): {
  /** Stage 2: everything still checked in the observations list. */
  applyObservations: () => Promise<void>;
  /** Stage 1: one recommendation on its own button, whether or not it is checked. */
  applyRecommendation: (id: string) => Promise<void>;
} => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const queryClient = useQueryClient();
  const { oystehrZambda } = useApiClients();
  const { templates } = useListTemplates();

  // The executor's view of the chart, its catalogues and its write layer — the same three the assistant used.
  const { chartData, refetch: refetchChart } = useEasyChartData(encounterId);
  const catalogue = useCatalogue({ encounterId });
  const writer = useChartWriter({
    encounterId: encounterId ?? '',
    // For the procedure write: a quick-pick carries its own CPT codes and supporting diagnoses, and
    // re-saving one already charted duplicates it on the note.
    diagnoses: chartData?.diagnosis,
    cptCodes: chartData?.cptCodes,
    procedures: chartData?.procedures,
    onOrdersChanged: () => void refetchChart(),
  });
  // Read inside the async run, so a chart refetched mid-run is not stale by the next step.
  const chartRef = useRef(chartData);
  chartRef.current = chartData;

  const applyTemplateRecommendation = useCallback(
    async (rec: TemplateRecommendation): Promise<void> => {
      if (!oystehrZambda || !encounterId) throw new Error('The visit is still loading. Please try again.');
      const template = templates.find((t) => t.label.toLowerCase() === rec.templateName.trim().toLowerCase());
      if (!template) {
        throw new Error(
          `Template “${rec.templateName}” isn't available in this environment. Edit the recommendation to pick another template.`
        );
      }
      if (!template.isCurrentVersion) {
        throw new Error('This template is out of date and needs to be updated by an admin before it can be applied.');
      }
      const result = await applyTemplate(oystehrZambda, {
        encounterId,
        templateName: template.value,
        sectionActions: rec.sectionActions ?? SCRIBE_TEMPLATE_SECTION_ACTIONS,
        ...(rec.applyOptions?.externalLabs ? { externalLabs: rec.applyOptions.externalLabs } : {}),
      });
      // Exam observations live in Zustand rather than React Query, so they need a reset before the
      // refetch below can repopulate them (same as ApplyTemplate does).
      resetExamObservationsStore();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY, encounterId] }),
        queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounterId] }),
        queryClient.invalidateQueries({ queryKey: [GET_MEDICATION_ORDERS_QUERY_KEY] }),
      ]);
      for (const warning of result?.warnings ?? []) {
        enqueueSnackbar(warning.message, { variant: 'warning' });
      }
    },
    [oystehrZambda, encounterId, templates, queryClient]
  );

  const run = useCallback<RecommendationRunner>(
    async (recommendations, report, mode: ExecutionMode) => {
      if (!encounterId) throw new Error('The visit is still loading. Please try again.');

      const templateRecs = recommendations.filter((rec): rec is TemplateRecommendation => rec.kind === 'template');
      const rest = recommendations.filter((rec) => rec.kind !== 'template');

      let templateLanded = false;
      for (const rec of templateRecs) {
        report.start(rec.id);
        try {
          await applyTemplateRecommendation(rec);
          report.settle(rec.id, { status: 'applied', createdResourceIds: [] });
          templateLanded = true;
        } catch (error) {
          report.settle(rec.id, { status: 'failed', reason: errorMessage(error) });
        }
      }
      if (rest.length === 0) return;

      // A template that just landed changed the chart, and the executor's duplicate checks and its
      // primary-diagnosis rule have to see what it wrote before anything lands on top of it.
      const chart = templateLanded ? await refetchChart() : chartRef.current;
      const store = useScribeRecommendationsStore.getState();
      const context: HandlerContext = {
        mode,
        encounterId,
        catalogue,
        writer,
        chart: buildChartSnapshot(chart),
        ask: (request) => store.askPick(request),
        // What a handler says instead of writing — a template it can only suggest, a request it could
        // not classify — is kept for the panel to show.
        say: (text) => store.addNote(text),
      };
      // One executor pass over the batch: the snapshot advances as steps apply, so a lab ordered after the
      // diagnosis it needs sees that diagnosis, and a swap's removal frees the primary before the add.
      await runPlan(rest.map(toPlannedAction), context, {
        onStepStart: (step) => report.start(rest[step.index].id),
        onStepSettled: (step) => {
          if (step.outcome) report.settle(rest[step.index].id, step.outcome);
        },
      });
    },
    [encounterId, applyTemplateRecommendation, refetchChart, catalogue, writer]
  );

  // Reconcile every summary on screen with what the server actually stored: the chart itself, the note
  // fields and lists that have field-level caches of their own, the vitals, and any orders a template placed.
  const reconcile = useCallback(async (): Promise<void> => {
    await refetchChart();
    invalidateChartFields(queryClient, encounterId, [
      'chiefComplaint',
      'historyOfPresentIllness',
      'mechanismOfInjury',
      'medicalDecision',
      // The free-text ROS paragraph has a field cache of its own, apart from the ROS checkboxes.
      'ros',
      'medications',
      'vitalsObservations',
      'disposition',
      'episodeOfCare',
      'procedures',
    ]);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`current-encounter-vitals-${encounterId}`] }),
      queryClient.invalidateQueries({ queryKey: [GET_MEDICATION_ORDERS_QUERY_KEY] }),
    ]);
  }, [refetchChart, queryClient, encounterId]);

  const runApply = useCallback(
    (ids: string[], mode: ExecutionMode) => applyRecommendations(ids, run, { mode, reconcile }),
    [run, reconcile]
  );

  const applyObservations = useCallback(async (): Promise<void> => {
    // A whole batch auto-picks among near-equal matches; a provider will not click through a picker per item.
    const { applied, failed, skipped } = await runApply(pendingObservationIds(), 'bulk');
    if (applied + failed + skipped === 0) return;

    const noun = (count: number): string => `${count} observation${count === 1 ? '' : 's'}`;
    if (failed === 0 && skipped === 0) {
      enqueueSnackbar(`Added ${noun(applied)} to the progress note.`, { variant: 'success' });
      return;
    }
    const rest = [
      failed > 0 ? `${failed} could not be applied` : undefined,
      skipped > 0 ? `${skipped} skipped` : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    enqueueSnackbar(`Added ${noun(applied)}; ${rest}. See the panel for details.`, { variant: 'warning' });
  }, [runApply]);

  const applySingle = useCallback(
    async (id: string): Promise<void> => {
      // One row, with the provider watching: ambiguity asks rather than guesses.
      const { applied } = await runApply([id], 'interactive');
      // A single row shows its own outcome, so only the happy path needs a word.
      if (applied > 0) enqueueSnackbar('Applied to the progress note.', { variant: 'success' });
    },
    [runApply]
  );

  return { applyObservations, applyRecommendation: applySingle };
};
