export interface TranscriptSpan {
  start: number;
  end: number;
}

// Suggestion items the LLM emits as natural-language phrases (display + alternative searchTerms).
// The provider clicks the chip to open a popover that searches the appropriate canonical source
// (ICD-10, eRx, static lists) and saves the chosen record directly. The LLM does NOT emit codes
// for these — codes come from the search source.
export type ChartPlanAddition =
  | {
      kind: 'dx-suggestion';
      display: string;
      searchTerms: string[];
      isPrimary: boolean;
      transcriptSpan?: TranscriptSpan;
    }
  | { kind: 'condition-suggestion'; display: string; searchTerms: string[]; transcriptSpan?: TranscriptSpan }
  | { kind: 'allergy-suggestion'; display: string; searchTerms: string[]; transcriptSpan?: TranscriptSpan }
  | { kind: 'medication-suggestion'; display: string; searchTerms: string[]; transcriptSpan?: TranscriptSpan }
  | { kind: 'surgical-history-suggestion'; display: string; searchTerms: string[]; transcriptSpan?: TranscriptSpan }
  | { kind: 'hospitalization-suggestion'; display: string; searchTerms: string[]; transcriptSpan?: TranscriptSpan }
  // Free-text amendments to template-supplied note sections. When accepted, these overwrite the
  // template's stock text via save-chart-data after apply-template runs.
  | { kind: 'hpi-amend'; text: string; transcriptSpan?: TranscriptSpan }
  | { kind: 'moi-amend'; text: string; transcriptSpan?: TranscriptSpan }
  | { kind: 'mdm-amend'; text: string; transcriptSpan?: TranscriptSpan };

export interface TemplateContentSnapshot {
  hpiNote?: string | null;
  moiNote?: string | null;
  mdm?: string | null;
}

export interface GenerateChartPlanInput {
  encounterId: string;
  narrative: string;
  templateTitles: string[];
  priorPlan?: GenerateChartPlanOutput;
  acceptedAdditions?: ChartPlanAddition[];
  rejectedAdditions?: ChartPlanAddition[];
  instruction?: string;
  templateContent?: TemplateContentSnapshot;
}

export interface GenerateChartPlanOutput {
  templateTitle: string;
  rationale: string;
  additions: ChartPlanAddition[];
}

export interface TranscribeAudioInput {
  z3URL: string;
}

export interface TranscribeAudioOutput {
  transcript: string;
}
