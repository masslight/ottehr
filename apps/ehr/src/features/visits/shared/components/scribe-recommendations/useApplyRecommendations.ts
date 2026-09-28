import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useRef } from 'react';
import { applyTemplate } from 'src/api/api';
import { buildChartSnapshot } from 'src/features/easy-chart/executor/chartSnapshot';
import { runPlan } from 'src/features/easy-chart/executor/runPlan';
import { ExecutionMode, HandlerContext } from 'src/features/easy-chart/executor/types';
import { useCatalogue } from 'src/features/easy-chart/hooks/useCatalogue';
import { useChartWriter } from 'src/features/easy-chart/hooks/useChartWriter';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { useApiClients } from 'src/hooks/useAppClients';
import { TemplateSectionActions } from 'utils/lib/types/data/apply-template.types';
import { invalidateChart } from '../../hooks/chartSectionCache';
import { GET_MEDICATION_ORDERS_QUERY_KEY } from '../../stores/appointment/appointment.queries';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { resetExamObservationsStore } from '../../stores/appointment/reset-exam-observations';
import { useListTemplates } from '../templates/useListTemplates';
import { appendToNoteField, toPlannedAction } from './analysis';
import {
  applyRecommendations,
  errorMessage,
  pendingObservationIds,
  RecommendationRunner,
} from './applyRecommendations';
import { useScribeRecommendationsStore } from './scribeRecommendations.store';
import { TemplateRecommendation } from './types';

/**
 * Section actions for a template applied without the apply-template dialog. ROS is skipped because the
 * transcript covers it, and orders are skipped because they stay a manual checklist.
 */
const SCRIBE_TEMPLATE_SECTION_ACTIONS: TemplateSectionActions = {
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
 * Writes the selected recommendations into the chart through the Easy Chart executor. A template goes first,
 * through the apply-template endpoint (which the executor never calls), and the rest run on top of it.
 */
export const useApplyRecommendations = (): {
  /** Everything still checked in the observations list. */
  applyObservations: () => Promise<void>;
  /** One recommendation from its own button, whether or not it is checked. */
  applyRecommendation: (id: string) => Promise<void>;
} => {
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const queryClient = useQueryClient();
  const { oystehrZambda } = useApiClients();
  const { templates } = useListTemplates();

  const { chartData, refetch: refetchChart } = useEasyChartData(encounterId);
  const catalogue = useCatalogue();
  const writer = useChartWriter(encounterId ?? '');
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
        // Re-reads the visit note and marks the other chart entries stale (same as ApplyTemplate).
        invalidateChart(queryClient, encounterId),
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

      // Refetch after a template so the executor's duplicate checks and primary-diagnosis rule see what it wrote.
      const chart = templateLanded ? await refetchChart() : chartRef.current;
      const snapshot = buildChartSnapshot(chart);
      const store = useScribeRecommendationsStore.getState();
      const context: HandlerContext = {
        mode,
        encounterId,
        catalogue,
        writer,
        chart: snapshot,
        ask: (request) => store.askPick(request),
        // Handler remarks made instead of writing are shown in the panel.
        say: (text) => store.addNote(text),
      };
      // One executor pass: the snapshot advances as steps apply, so later steps see earlier ones (a lab sees
      // its diagnosis). Note text is appended to or replaces the field per the row's mode.
      const actions = rest.map((rec) =>
        appendToNoteField(toPlannedAction(rec), rec, snapshot, store.itemState[rec.id]?.noteMode)
      );
      await runPlan(actions, context, {
        onStepStart: (step) => report.start(rest[step.index].id),
        onStepSettled: (step) => {
          if (step.outcome) report.settle(rest[step.index].id, step.outcome);
        },
      });
    },
    [encounterId, applyTemplateRecommendation, refetchChart, catalogue, writer]
  );

  // Refresh the chart, vitals and medication orders so every summary on screen matches the server.
  const reconcile = useCallback(async (): Promise<void> => {
    await Promise.all([
      // Re-reads the visit note; section variants it doesn't seed are marked stale.
      invalidateChart(queryClient, encounterId),
      queryClient.invalidateQueries({ queryKey: [`current-encounter-vitals-${encounterId}`] }),
      queryClient.invalidateQueries({ queryKey: [GET_MEDICATION_ORDERS_QUERY_KEY] }),
    ]);
  }, [queryClient, encounterId]);

  const runApply = useCallback(
    (ids: string[], mode: ExecutionMode) => applyRecommendations(ids, run, { mode, reconcile }),
    [run, reconcile]
  );

  const applyObservations = useCallback(async (): Promise<void> => {
    // Bulk mode auto-picks among near-equal matches instead of asking per item.
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
