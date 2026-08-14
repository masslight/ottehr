import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';

const hasText = (note: { text?: string } | undefined): boolean => !!note?.text?.trim();

// "Has anything substantive been charted yet?" — the gate behind the transcript prime banner.
// save-chart-data does NOT dedup, so priming on top of an existing write-up doubles chart content;
// any of the fields below counts as an existing write-up (a diagnosis-step error or a missing E&M
// alone must not make a charted note look empty). Intake-harvested history (allergies, meds,
// conditions) deliberately does NOT count — a chart with only paperwork data is still unprimed.
export function chartHasSubstantiveContent(chartData: AllChartValues | undefined): boolean {
  if (!chartData) return false;
  return (
    !!chartData.emCode ||
    !!chartData.diagnosis?.length ||
    hasText(chartData.medicalDecision) ||
    hasText(chartData.historyOfPresentIllness) ||
    hasText(chartData.chiefComplaint) ||
    !!chartData.examObservations?.length ||
    !!chartData.rosObservations?.length ||
    !!chartData.prescribedMedications?.length ||
    !!chartData.instructions?.length ||
    !!chartData.disposition?.type
  );
}
