import { useCallback } from 'react';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { buildNoteContextFromChart } from 'utils/lib/easy-chart/chart-state';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { buildAnalysis } from './analysis';
import { ScribeAnalyzer } from './scribeRecommendations.store';

/**
 * The analysis behind the "Get charting recommendations" button: the Easy Chart plan endpoint reads the
 * transcript into typed actions, and those become the panel's recommendations.
 *
 * The chart is NOT sent. The endpoint reads it by encounterId — the same pair of get-chart-data calls the
 * visit-note PDF makes — so the model sees every section, not just the ones this page happens to fetch.
 * What is read here is only which note fields already have text, so a rewrite of one can start unticked.
 *
 * THE REVIEW PASS IS NOT CALLED HERE, deliberately. It reads the note as written back against the
 * transcript, and at this point nothing from the plan has been written: run now, it can only repeat the
 * plan (dropped as duplicates) or judge a chart the provider is about to change. It belongs after the
 * provider has applied the plan — `buildAnalysis` already knows how to fold its suggestions into the
 * list, tagged with their question, for when that step is wired.
 */
export const useScribeAnalyzer = (): ScribeAnalyzer => {
  const apiClient = useOystehrAPIClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { chartData } = useEasyChartData(encounterId);

  return useCallback(
    async (transcript: string) => {
      if (!apiClient || !encounterId) throw new Error('The visit is still loading. Please try again.');
      // A transcript is the FIRST pass over the visit, never an addendum to a note already written.
      const plan = await apiClient.easyChartPlan({ narrative: transcript, encounterId, incremental: false });
      return buildAnalysis(plan, undefined, { written: buildNoteContextFromChart(chartData) ?? {} });
    },
    [apiClient, encounterId, chartData]
  );
};
