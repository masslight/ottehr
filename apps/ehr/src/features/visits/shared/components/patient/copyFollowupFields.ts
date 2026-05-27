import {
  AllChartValues,
  ChartDataRequestedFields,
  CopyableFollowupField,
  GetChartDataRequest,
  GetChartDataResponse,
} from 'utils';

// Chief Complaint / HPI storage keys are intentionally swapped to match how the rest of
// the EHR labels these fields — see ChiefComplaintField.tsx / HpiField.tsx.
const COPY_FIELD_TO_CHART_KEY = {
  chiefComplaint: 'historyOfPresentIllness',
  historyOfPresentIllness: 'chiefComplaint',
  mechanismOfInjury: 'mechanismOfInjury',
  diagnosis: 'diagnosis',
  examObservations: 'examObservations',
  rosObservations: 'rosObservations',
} as const satisfies Record<CopyableFollowupField, keyof AllChartValues>;

export interface CopyableFieldConfig {
  key: CopyableFollowupField;
  label: string;
  isEmpty: (data: GetChartDataResponse) => boolean;
  /** Absent for fields copied server-side by create-appointment (currently: `diagnosis`). */
  extract?: (data: GetChartDataResponse) => Partial<AllChartValues>;
}

// Drop resourceId so save-chart-data creates fresh resources on the follow-up encounter.
const stripId = <T extends { resourceId?: string }>(dto: T): T => ({ ...dto, resourceId: undefined });

export const COPYABLE_FOLLOWUP_FIELDS: CopyableFieldConfig[] = [
  {
    key: 'chiefComplaint',
    label: 'Chief Complaint',
    isEmpty: (data) => !data[COPY_FIELD_TO_CHART_KEY.chiefComplaint]?.text?.trim(),
    extract: (data) => {
      const src = data[COPY_FIELD_TO_CHART_KEY.chiefComplaint];
      return src ? { [COPY_FIELD_TO_CHART_KEY.chiefComplaint]: stripId(src) } : {};
    },
  },
  {
    key: 'historyOfPresentIllness',
    label: 'HPI',
    isEmpty: (data) => !data[COPY_FIELD_TO_CHART_KEY.historyOfPresentIllness]?.text?.trim(),
    extract: (data) => {
      const src = data[COPY_FIELD_TO_CHART_KEY.historyOfPresentIllness];
      return src ? { [COPY_FIELD_TO_CHART_KEY.historyOfPresentIllness]: stripId(src) } : {};
    },
  },
  {
    // Bundles `accident` (date of injury) — see spec.
    key: 'mechanismOfInjury',
    label: 'Mechanism of Injury (includes date of injury)',
    isEmpty: (data) => !data.mechanismOfInjury?.text?.trim() && !data.accident?.date && !data.accident?.type?.length,
    extract: (data) => ({
      ...(data.mechanismOfInjury ? { mechanismOfInjury: stripId(data.mechanismOfInjury) } : {}),
      ...(data.accident ? { accident: stripId(data.accident) } : {}),
    }),
  },
  {
    // Server-side: the checkbox state maps to followUpOptions.skipPatientDiagnosis in
    // create-appointment, NOT to a save-chart-data payload — hence no `extract`.
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

// Note fields + accident return only when explicitly requested; array fields return only
// from the unscoped call — so we fetch both and merge.
const NOTE_FIELD_REQUESTED_FIELDS: ChartDataRequestedFields = {
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  accident: {},
};

export interface ChartDataApiClient {
  getChartData: (params: GetChartDataRequest) => Promise<GetChartDataResponse>;
}

export async function fetchCopySourceChartData(
  apiClient: ChartDataApiClient,
  encounterId: string
): Promise<GetChartDataResponse> {
  const [noteFields, fullChart] = await Promise.all([
    apiClient.getChartData({ encounterId, requestedFields: NOTE_FIELD_REQUESTED_FIELDS }),
    apiClient.getChartData({ encounterId }),
  ]);
  // get-chart-data inits requested fields to []; a scalar left as [] means "no data".
  const scalarOrUndefined = <T>(value: T): T | undefined => (Array.isArray(value) ? undefined : value);
  return {
    ...fullChart,
    chiefComplaint: scalarOrUndefined(noteFields.chiefComplaint),
    historyOfPresentIllness: scalarOrUndefined(noteFields.historyOfPresentIllness),
    mechanismOfInjury: scalarOrUndefined(noteFields.mechanismOfInjury),
    accident: scalarOrUndefined(noteFields.accident),
  };
}
