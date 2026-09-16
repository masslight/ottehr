import { useCallback } from 'react';
import { useEasyChartData } from 'src/features/easy-chart/hooks/useEasyChartData';
import { NarrativeLine } from 'utils/lib/easy-chart/api';
import { buildNoteContextFromChart } from 'utils/lib/easy-chart/chart-state';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { buildAnalysis } from './analysis';
import { draftFromNarrative, narrativeText } from './narrativeLines';
import { ScribeAnalyzer } from './scribeRecommendations.store';

/**
 * The analysis behind the "Plan note" button: the Easy Chart plan endpoint reads the
 * TRANSCRIPT into typed actions, and those become the panel's recommendations. The narrative step only
 * supplies the provider's corrections: when they edited the generated read-back, the draft and their version
 * go along as `providerEdits`, and the planner follows the differences over the transcript. Unedited, the
 * call is the plain transcript call. Without a transcript (the provider typed the narrative by hand), the
 * narrative itself is what the planner reads.
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
    async (narrative: string, narrativeGenerated: NarrativeLine[], transcript: string) => {
      if (!apiClient || !encounterId) throw new Error('The visit is still loading. Please try again.');
      const edited = narrativeText(narrative);
      const draftText = draftFromNarrative(narrativeGenerated);
      const hasTranscript = transcript.trim() !== '';
      // The draft is only worth sending when the provider changed it; unedited, the read-back changes nothing.
      const providerEdits =
        hasTranscript && draftText && edited.trim() !== draftText.trim() ? { draft: draftText, edited } : undefined;
      // A narrative is the FIRST pass over the visit, never an addendum to a note already written.
      const plan = await apiClient.easyChartPlan({
        narrative: hasTranscript ? transcript : edited,
        encounterId,
        incremental: false,
        ...(providerEdits ? { providerEdits } : {}),
      });
      // The narrative rides along so the analysis can tell the visit back — the narrative itself, with each
      // recommendation's verified quote highlighted and linked to its row — and the generated sentences so
      // each quote can be traced one hop further, to the transcript snippets behind the sentence it sits in.
      return buildAnalysis(plan, undefined, {
        written: buildNoteContextFromChart(chartData) ?? {},
        narrative: edited,
        narrativeGenerated,
        narrativeIsTranscript: hasTranscript,
      });
    },
    [apiClient, encounterId, chartData]
  );
};
