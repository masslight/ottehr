import { useMemo } from 'react';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { buildNoteContextFromChart } from 'utils/lib/easy-chart/chart-state';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { buildAnalysis } from './analysis';
import { draftFromNarrative, narrativeText } from './narrativeLines';
import { ScribeAnalyzer } from './scribeRecommendations.store';

/**
 * `plan` sends the transcript (or, without one, the typed narrative) to the Easy Chart plan endpoint, with the
 * provider's edits when the draft was changed; `analysisOf` maps the answer to recommendations. The endpoint
 * reads the chart itself by encounterId.
 */
export const useScribeAnalyzer = (): ScribeAnalyzer => {
  const apiClient = useOystehrAPIClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { chartData } = useEasyChartData(encounterId);

  return useMemo<ScribeAnalyzer>(
    () => ({
      plan: async (narrative, narrativeGenerated, transcript) => {
        if (!apiClient || !encounterId) throw new Error('The visit is still loading. Please try again.');
        const edited = narrativeText(narrative);
        const draftText = draftFromNarrative(narrativeGenerated);
        const hasTranscript = transcript.trim() !== '';
        // Provider edits go along only when the draft was actually changed.
        const providerEdits =
          hasTranscript && draftText && edited.trim() !== draftText.trim() ? { draft: draftText, edited } : undefined;
        return apiClient.easyChartPlan({
          narrative: hasTranscript ? transcript : edited,
          encounterId,
          ...(providerEdits ? { providerEdits } : {}),
        });
      },
      // The narrative and its generated sentences let each recommendation's quote be traced to transcript snippets.
      analysisOf: (plan, narrative, narrativeGenerated, transcript) =>
        buildAnalysis(plan, {
          written: buildNoteContextFromChart(chartData) ?? {},
          narrative: narrativeText(narrative),
          narrativeGenerated,
          narrativeIsTranscript: transcript.trim() !== '',
        }),
    }),
    [apiClient, encounterId, chartData]
  );
};
