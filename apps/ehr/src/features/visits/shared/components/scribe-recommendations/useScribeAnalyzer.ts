import { useMemo } from 'react';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { buildNoteContextFromChart } from 'utils/lib/easy-chart/chart-state';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { buildAnalysis } from './analysis';
import { draftFromNarrative, narrativeText } from './narrativeLines';
import { ScribeAnalyzer } from './scribeRecommendations.store';

/**
 * The analysis behind the "Plan note" button, in two halves: `plan` asks the Easy Chart plan endpoint to
 * read the TRANSCRIPT into typed actions, and `analysisOf` turns those into the panel's recommendations.
 * Split because the store reads the plan AHEAD of the click when a transcript is picked and maps it only
 * when the click comes — `planAhead` in the store — so the two halves cannot be one function.
 *
 * The narrative step only supplies the provider's corrections: when they edited the generated read-back,
 * the draft and their version go along as `providerEdits`, and the planner follows the differences over the
 * transcript. Unedited, the call is the plain transcript call — which is exactly what the read-ahead sends,
 * because the draft is still the generated text then. Without a transcript (the provider typed the narrative
 * by hand), the narrative itself is what the planner reads.
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

  return useMemo<ScribeAnalyzer>(
    () => ({
      plan: async (narrative, narrativeGenerated, transcript) => {
        if (!apiClient || !encounterId) throw new Error('The visit is still loading. Please try again.');
        const edited = narrativeText(narrative);
        const draftText = draftFromNarrative(narrativeGenerated);
        const hasTranscript = transcript.trim() !== '';
        // The draft is only worth sending when the provider changed it; unedited, the read-back changes nothing.
        const providerEdits =
          hasTranscript && draftText && edited.trim() !== draftText.trim() ? { draft: draftText, edited } : undefined;
        // A narrative is the FIRST pass over the visit, never an addendum to a note already written.
        return apiClient.easyChartPlan({
          narrative: hasTranscript ? transcript : edited,
          encounterId,
          incremental: false,
          ...(providerEdits ? { providerEdits } : {}),
        });
      },
      // The narrative rides along so the analysis can tell the visit back — the narrative itself, with each
      // recommendation's verified quote highlighted and linked to its row — and the generated sentences so
      // each quote can be traced one hop further, to the transcript snippets behind the sentence it sits in.
      analysisOf: (plan, narrative, narrativeGenerated, transcript) =>
        buildAnalysis(plan, undefined, {
          written: buildNoteContextFromChart(chartData) ?? {},
          narrative: narrativeText(narrative),
          narrativeGenerated,
          narrativeIsTranscript: transcript.trim() !== '',
        }),
    }),
    [apiClient, encounterId, chartData]
  );
};
