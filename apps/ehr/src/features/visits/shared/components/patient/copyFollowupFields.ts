import { visitNoteToLegacyChartData } from 'utils/lib/helpers/visit-note/visit-note-to-chart-data.helper';
import { AllChartValues, ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { GetVisitNoteRequest, VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { CopyableFollowupField } from 'utils/lib/types/api/prebook-create-appointment/prebook-create-appointment.types';

export interface CopyableFieldConfig {
  key: CopyableFollowupField;
  label: string;
  isEmpty: (data: GetChartDataResponse) => boolean;
  extract?: (source: GetChartDataResponse, target?: GetChartDataResponse) => Partial<AllChartValues>;
  stale?: (source: GetChartDataResponse, target: GetChartDataResponse) => Partial<AllChartValues>;
}

const takeOver = <T extends { resourceId?: string }>(dto: T, existing?: { resourceId?: string }): T => ({
  ...dto,
  resourceId: existing?.resourceId,
});

const takeOverByField = (source: ExamObservationDTO[], existing?: ExamObservationDTO[]): ExamObservationDTO[] => {
  const byField = new Map((existing ?? []).filter((o) => o.resourceId).map((o) => [o.field, o] as const));
  return source.map((dto) => takeOver(dto, byField.get(dto.field)));
};

const unclaimedOnTarget = (source?: ExamObservationDTO[], existing?: ExamObservationDTO[]): ExamObservationDTO[] => {
  const claimed = new Set(takeOverByField(source ?? [], existing).map((o) => o.resourceId));
  return (existing ?? []).filter((o) => o.resourceId && !claimed.has(o.resourceId));
};

// CC/HPI storage keys are swapped relative to labels; see ChiefComplaintField.tsx / HpiField.tsx.
export const COPYABLE_FOLLOWUP_FIELDS: CopyableFieldConfig[] = [
  {
    // "Chief Complaint" section = staff-confirmed Reason for visit + Additional Information.
    key: 'chiefComplaint',
    label: 'Chief Complaint',
    isEmpty: (data) => !data.reasonForVisit?.text?.trim() && !data.historyOfPresentIllness?.text?.trim(),
    extract: (source, target) => ({
      ...(source.reasonForVisit?.text?.trim()
        ? { reasonForVisit: takeOver(source.reasonForVisit, target?.reasonForVisit) }
        : {}),
      ...(source.historyOfPresentIllness
        ? { historyOfPresentIllness: takeOver(source.historyOfPresentIllness, target?.historyOfPresentIllness) }
        : {}),
    }),
    stale: (source, target) =>
      !source.historyOfPresentIllness && target.historyOfPresentIllness?.resourceId
        ? { historyOfPresentIllness: target.historyOfPresentIllness }
        : {},
  },
  {
    key: 'historyOfPresentIllness',
    label: 'HPI',
    isEmpty: (data) => !data.chiefComplaint?.text?.trim(),
    extract: (source, target) =>
      source.chiefComplaint ? { chiefComplaint: takeOver(source.chiefComplaint, target?.chiefComplaint) } : {},
  },
  {
    key: 'mechanismOfInjury',
    label: 'Mechanism of Injury (includes date of injury)',
    isEmpty: (data) => !data.mechanismOfInjury?.text?.trim() && !data.accident?.date && !data.accident?.type?.length,
    extract: (source, target) => ({
      ...(source.mechanismOfInjury
        ? { mechanismOfInjury: takeOver(source.mechanismOfInjury, target?.mechanismOfInjury) }
        : {}),
      ...(source.accident ? { accident: takeOver(source.accident, target?.accident) } : {}),
    }),
    stale: (source, target) => ({
      ...(!source.mechanismOfInjury && target.mechanismOfInjury?.resourceId
        ? { mechanismOfInjury: target.mechanismOfInjury }
        : {}),
      ...(!source.accident && target.accident?.resourceId ? { accident: target.accident } : {}),
    }),
  },
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    isEmpty: (data) => !data.diagnosis?.length,
  },
  {
    key: 'examObservations',
    label: 'Exam observations',
    isEmpty: (data) => !data.examObservations?.length,
    extract: (source, target) =>
      source.examObservations?.length
        ? { examObservations: takeOverByField(source.examObservations, target?.examObservations) }
        : {},
    stale: (source, target) => {
      const unclaimed = unclaimedOnTarget(source.examObservations, target.examObservations);
      return unclaimed.length > 0 ? { examObservations: unclaimed } : {};
    },
  },
  {
    key: 'rosObservations',
    label: 'ROS observations',
    isEmpty: (data) => !data.rosObservations?.length,
    extract: (source, target) =>
      source.rosObservations?.length
        ? { rosObservations: takeOverByField(source.rosObservations, target?.rosObservations) }
        : {},
    stale: (source, target) => {
      const unclaimed = unclaimedOnTarget(source.rosObservations, target.rosObservations);
      return unclaimed.length > 0 ? { rosObservations: unclaimed } : {};
    },
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
