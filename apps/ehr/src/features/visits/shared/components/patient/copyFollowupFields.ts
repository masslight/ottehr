import { visitNoteToLegacyChartData } from 'utils/lib/helpers/visit-note/visit-note-to-chart-data.helper';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetVisitNoteRequest, VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { CopyableFollowupField } from 'utils/lib/types/api/prebook-create-appointment/prebook-create-appointment.types';

export interface CopyableFieldConfig {
  key: CopyableFollowupField;
  label: string;
  isEmpty: (data: GetChartDataResponse) => boolean;
  /** Absent for fields copied server-side by create-appointment (currently: `diagnosis`). */
  extract?: (data: GetChartDataResponse) => Partial<AllChartValues>;
}

// Drop resourceId so save-chart-data creates fresh resources on the follow-up encounter.
const stripId = <T extends { resourceId?: string }>(dto: T): T => ({ ...dto, resourceId: undefined });

// CC/HPI storage keys are swapped relative to labels; see ChiefComplaintField.tsx / HpiField.tsx.
export const COPYABLE_FOLLOWUP_FIELDS: CopyableFieldConfig[] = [
  {
    // "Chief Complaint" section = staff-confirmed Reason for visit + Additional Information.
    key: 'chiefComplaint',
    label: 'Chief Complaint',
    isEmpty: (data) => !data.reasonForVisit?.text?.trim() && !data.historyOfPresentIllness?.text?.trim(),
    extract: (data) => ({
      ...(data.reasonForVisit?.text?.trim() ? { reasonForVisit: stripId(data.reasonForVisit) } : {}),
      ...(data.historyOfPresentIllness ? { historyOfPresentIllness: stripId(data.historyOfPresentIllness) } : {}),
    }),
  },
  {
    key: 'historyOfPresentIllness',
    label: 'HPI',
    isEmpty: (data) => !data.chiefComplaint?.text?.trim(),
    extract: (data) => (data.chiefComplaint ? { chiefComplaint: stripId(data.chiefComplaint) } : {}),
  },
  {
    key: 'mechanismOfInjury',
    label: 'Mechanism of Injury (includes date of injury)',
    isEmpty: (data) => !data.mechanismOfInjury?.text?.trim() && !data.accident?.date && !data.accident?.type?.length,
    extract: (data) => ({
      ...(data.mechanismOfInjury ? { mechanismOfInjury: stripId(data.mechanismOfInjury) } : {}),
      ...(data.accident ? { accident: stripId(data.accident) } : {}),
    }),
  },
  {
    // No `extract`: copied server-side via followUpOptions.skipPatientDiagnosis.
    key: 'diagnosis',
    label: 'Diagnosis',
    isEmpty: (data) => !data.diagnosis?.length,
  },
  {
    key: 'examObservations',
    label: 'Exam observations',
    isEmpty: (data) => !data.examObservations?.length,
    extract: (data) => (data.examObservations?.length ? { examObservations: data.examObservations.map(stripId) } : {}),
  },
  {
    key: 'rosObservations',
    label: 'ROS observations',
    isEmpty: (data) => !data.rosObservations?.length,
    extract: (data) => (data.rosObservations?.length ? { rosObservations: data.rosObservations.map(stripId) } : {}),
  },
];

export interface ChartDataApiClient {
  getVisitNote: (params: GetVisitNoteRequest) => Promise<VisitNoteResponse>;
}

/** The source visit's chart in the whole-chart shape the copy configs read; one visit-note read. */
export async function fetchCopySourceChartData(
  apiClient: ChartDataApiClient,
  encounterId: string
): Promise<GetChartDataResponse> {
  const note = await apiClient.getVisitNote({ encounterId });
  return {
    ...visitNoteToLegacyChartData(note, { module: 'in-person' }).chartData,
    reasonForVisit: note.encounterNotes.reasonForVisit,
  };
}
