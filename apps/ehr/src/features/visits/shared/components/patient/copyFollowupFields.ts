import {
  AllChartValues,
  ChartDataRequestedFields,
  GetChartDataRequest,
  GetChartDataResponse,
  SaveChartDataRequest,
} from 'utils';

export type CopyableFollowupField =
  | 'chiefComplaint'
  | 'historyOfPresentIllness'
  | 'mechanismOfInjury'
  | 'diagnosis'
  | 'examObservations'
  | 'rosObservations';

interface CopyableFieldConfig {
  key: CopyableFollowupField;
  label: string;
  isEmpty: (data: GetChartDataResponse) => boolean;
  extract: (data: GetChartDataResponse) => Partial<AllChartValues>;
}

// Drop resourceId so save-chart-data creates fresh resources on the follow-up encounter
const stripId = <T extends { resourceId?: string }>(dto: T): T => ({ ...dto, resourceId: undefined });

export const COPYABLE_FOLLOWUP_FIELDS: CopyableFieldConfig[] = [
  // The in-person flow swaps these two: the "Chief Complaint" UI field is backed by the
  // historyOfPresentIllness chart key, and the "HPI" UI field is backed by the chiefComplaint key.
  // See ChiefComplaintField.tsx / HpiField.tsx.
  {
    key: 'chiefComplaint',
    label: 'Chief Complaint',
    isEmpty: (data) => !data.historyOfPresentIllness?.text?.trim(),
    extract: (data) =>
      data.historyOfPresentIllness ? { historyOfPresentIllness: stripId(data.historyOfPresentIllness) } : {},
  },
  {
    key: 'historyOfPresentIllness',
    label: 'HPI',
    isEmpty: (data) => !data.chiefComplaint?.text?.trim(),
    extract: (data) => (data.chiefComplaint ? { chiefComplaint: stripId(data.chiefComplaint) } : {}),
  },
  {
    // Date of injury (accident) is bundled into this checkbox
    key: 'mechanismOfInjury',
    label: 'Mechanism of Injury',
    isEmpty: (data) => !data.mechanismOfInjury?.text?.trim() && !data.accident?.date && !data.accident?.type?.length,
    extract: (data) => ({
      ...(data.mechanismOfInjury ? { mechanismOfInjury: stripId(data.mechanismOfInjury) } : {}),
      ...(data.accident ? { accident: stripId(data.accident) } : {}),
    }),
  },
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    isEmpty: (data) => !data.diagnosis?.length,
    extract: (data) => (data.diagnosis?.length ? { diagnosis: data.diagnosis.map(stripId) } : {}),
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

// The free-text note fields + accident are only returned by get-chart-data when explicitly requested.
const NOTE_FIELD_REQUESTED_FIELDS: ChartDataRequestedFields = {
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  accident: {},
};

interface ChartDataApiClient {
  getChartData: (params: GetChartDataRequest) => Promise<GetChartDataResponse>;
  saveChartData: (params: SaveChartDataRequest) => Promise<unknown>;
}

// diagnosis / examObservations / rosObservations are only populated by an unscoped get-chart-data call,
// while the free-text note fields + accident are only populated when explicitly requested — so fetch both.
export async function fetchCopySourceChartData(
  apiClient: ChartDataApiClient,
  encounterId: string
): Promise<GetChartDataResponse> {
  const [noteFields, fullChart] = await Promise.all([
    apiClient.getChartData({ encounterId, requestedFields: NOTE_FIELD_REQUESTED_FIELDS }),
    apiClient.getChartData({ encounterId }),
  ]);
  // get-chart-data initializes every requested field to []; a scalar field left as [] means "no data".
  const scalarOrUndefined = <T>(value: T): T | undefined => (Array.isArray(value) ? undefined : value);
  return {
    ...fullChart,
    chiefComplaint: scalarOrUndefined(noteFields.chiefComplaint),
    historyOfPresentIllness: scalarOrUndefined(noteFields.historyOfPresentIllness),
    mechanismOfInjury: scalarOrUndefined(noteFields.mechanismOfInjury),
    accident: scalarOrUndefined(noteFields.accident) ?? scalarOrUndefined(fullChart.accident),
  };
}

export async function copyChartDataToFollowup(
  apiClient: ChartDataApiClient,
  sourceEncounterId: string,
  targetEncounterId: string,
  fields: CopyableFollowupField[]
): Promise<void> {
  const configs = COPYABLE_FOLLOWUP_FIELDS.filter((field) => fields.includes(field.key));
  if (configs.length === 0) return;

  const chartData = await fetchCopySourceChartData(apiClient, sourceEncounterId);

  const payload: SaveChartDataRequest = { encounterId: targetEncounterId };
  for (const config of configs) {
    Object.assign(payload, config.extract(chartData));
  }

  await apiClient.saveChartData(payload);
}
