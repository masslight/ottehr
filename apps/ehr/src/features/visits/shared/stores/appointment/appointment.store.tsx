import {
  QueryKey,
  RefetchOptions,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  Appointment,
  DocumentReference,
  Encounter,
  FhirResource,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { APPOINTMENT_REFRESH_INTERVAL, CHART_DATA_QUERY_KEY, CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import {
  createRefreshableAppointmentData,
  extractPhotoUrlsFromAppointmentData,
  extractReviewAndSignAppointmentData,
} from 'src/features/visits/telemed/utils/appointments';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  AllChartValues,
  ChartDataRequestedFields,
  GetChartDataResponse,
  isLocationVirtual,
  ObservationDTO,
  PromiseReturnType,
  RefreshableAppointmentData,
  RequestedFields,
  ReviewAndSignData,
  SaveChartDataRequest,
  SCHOOL_WORK_NOTE_CODE,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  SchoolWorkNoteExcuseDocFileDTO,
  useErrorQuery,
  useSuccessQuery,
} from 'utils';
import { create } from 'zustand';
import { OystehrTelemedAPIClient } from '../../api/oystehrApi';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { parseBundle } from './parser/parser';
import { VisitMappedData, VisitResources } from './parser/types';

export type AppointmentTelemedState = {
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  location: Location | undefined;
  locationVirtual: Location | undefined;
  practitioner?: Practitioner;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse | undefined;
  patientPhotoUrls: string[];
  schoolWorkNoteUrls: string[];
  reviewAndSignData: ReviewAndSignData | undefined;
};

type AppointmentStateUpdater = {
  appointmentError: any;
  appointmentRefetch: () => any;
  appointmentSetState: (
    updater:
      | Partial<AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState>
      | ((
          state: AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState
        ) => Partial<AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState>)
  ) => void;
};

type AppointmentRawResourcesState = {
  rawResources: AppointmentResources[];
};

type InPersonAppointmentState = {
  resources: VisitResources;
  mappedData: VisitMappedData;
  visitState: Partial<{
    appointment: Appointment;
    patient: Patient;
    location: Location;
    encounter: Encounter;
    questionnaireResponse: QuestionnaireResponse;
  }>;

  // todo: remove duplication
  isAppointmentLoading: boolean;
};

type ReactQueryState = {
  error: any;
  isLoading: boolean;
  refetch: (options?: RefetchOptions | undefined) => Promise<unknown>;
  isFetching: boolean;
  isPending: boolean;
};

type ChartDataResponse = Omit<GetChartDataResponse, Exclude<RequestedFields, 'medications' | 'inhouseMedications'>>;

export type ChartDataState = {
  chartData: ChartDataResponse | undefined;

  // todo: remove duplication
  isChartDataLoading: boolean;
};

interface ChartDataStateUpdater {
  setPartialChartData: (value: Partial<GetChartDataResponse>) => void;
  updateObservation: (observation: ObservationDTO) => void;
  chartDataSetState: (updater: Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>)) => void;
  chartDataRefetch: () => any;
  chartDataError: any;
}

const APPOINTMENT_INITIAL: AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState = {
  appointment: undefined,
  patient: undefined,
  location: undefined,
  locationVirtual: undefined,
  practitioner: undefined,
  encounter: {} as Encounter,
  questionnaireResponse: undefined,
  patientPhotoUrls: [],
  schoolWorkNoteUrls: [],
  reviewAndSignData: undefined,
  rawResources: [],

  // todo: remove and use selectors/utils or something else, keep in store derived data is not a good decision
  resources: {},
  mappedData: {},
  visitState: {},

  isAppointmentLoading: true, // todo: remove duplication
};

export const APP_TELEMED_LOCAL_INITIAL = {
  currentTab: 'hpi',
};

export const useAppTelemedLocalStore = create<typeof APP_TELEMED_LOCAL_INITIAL>()(() => ({
  ...APP_TELEMED_LOCAL_INITIAL,
}));

export const useAppointmentData = (
  appointmentIdFromProps?: string
): AppointmentTelemedState &
  AppointmentRawResourcesState &
  InPersonAppointmentState &
  AppointmentStateUpdater &
  ReactQueryState => {
  const { id: appointmentIdFromUrl } = useParams();
  const appointmentId = appointmentIdFromProps || appointmentIdFromUrl;
  const queryClient = useQueryClient();
  const { data: currentState, isLoading, isFetching, refetch, error, isPending } = useGetAppointment({ appointmentId });

  const setState = useCallback(
    (
      updater:
        | Partial<AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState>
        | ((
            state: AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState
          ) => Partial<AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState>)
    ) => {
      queryClient.setQueryData(
        [TELEMED_APPOINTMENT_QUERY_KEY, appointmentId],
        (prevData: (AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState) | undefined) => {
          const currentData = prevData || currentState || APPOINTMENT_INITIAL;

          if (typeof updater === 'function') {
            const updates = updater(currentData);
            return { ...currentData, ...updates };
          }

          return { ...currentData, ...updater };
        }
      );

      void queryClient.invalidateQueries({
        queryKey: [TELEMED_APPOINTMENT_QUERY_KEY, appointmentId],
        exact: false,
        refetchType: 'none',
      });
    },
    [queryClient, appointmentId, currentState]
  );

  const fullState = useMemo(
    () => ({
      ...(currentState || APPOINTMENT_INITIAL),
      isAppointmentLoading: isLoading,
      appointmentRefetch: refetch,
      appointmentSetState: setState,
      appointmentError: error,
      isFetching,
      isPending,
      error,
      isLoading,
      refetch,
    }),
    [currentState, isLoading, setState, refetch, error, isFetching, isPending]
  );

  return fullState;
};

export type AppointmentResources =
  | Appointment
  | DocumentReference
  | Encounter
  | Location
  | Patient
  | QuestionnaireResponse;

const selectAppointmentData = (
  data: AppointmentResources[] | undefined
): (AppointmentTelemedState & InPersonAppointmentState & AppointmentRawResourcesState) | null => {
  if (!data) return null;

  const questionnaireResponse = data?.find(
    (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse'
  ) as QuestionnaireResponse;

  const parsed = parseBundle(data);
  const appointment = data?.find((resource: FhirResource) => resource.resourceType === 'Appointment') as Appointment;
  const patient = data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as Patient;
  const location = (data?.filter((resource: FhirResource) => resource.resourceType === 'Location') as Location[]).find(
    (location) => !isLocationVirtual(location)
  );
  const encounter = data?.find((resource: FhirResource) => resource.resourceType === 'Encounter') as Encounter;

  return {
    rawResources: data,
    appointment,
    patient,
    location,
    locationVirtual: (
      data?.filter((resource: FhirResource) => resource.resourceType === 'Location') as Location[]
    ).find(isLocationVirtual),
    practitioner: data?.find(
      (resource: FhirResource) => resource.resourceType === 'Practitioner'
    ) as unknown as Practitioner,
    encounter,
    questionnaireResponse,
    patientPhotoUrls: extractPhotoUrlsFromAppointmentData(data),
    schoolWorkNoteUrls:
      (data
        ?.filter(
          (resource: FhirResource) =>
            resource.resourceType === 'DocumentReference' &&
            resource.status === 'current' &&
            (resource.type?.coding?.[0].code === SCHOOL_WORK_NOTE_CODE ||
              resource.type?.coding?.[0].code === SCHOOL_WORK_NOTE_TEMPLATE_CODE)
        )
        .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
        .filter(Boolean) as string[]) || [],
    reviewAndSignData: extractReviewAndSignAppointmentData(data),
    resources: parsed.resources,
    mappedData: parsed.mappedData,

    // todo: remove
    visitState: {
      appointment,
      patient,
      location,
      encounter,
      questionnaireResponse,
    },

    isAppointmentLoading: false,
  };
};

const useGetAppointment = (
  {
    appointmentId,
  }: {
    appointmentId: string | undefined;
  },
  onSuccess?: (data: (AppointmentTelemedState & InPersonAppointmentState & AppointmentRawResourcesState) | null) => void
): UseQueryResult<
  (AppointmentTelemedState & InPersonAppointmentState & AppointmentRawResourcesState) | null,
  unknown
> => {
  const { oystehr } = useApiClients();

  const query = useQuery({
    queryKey: [TELEMED_APPOINTMENT_QUERY_KEY, appointmentId],
    queryFn: async () => {
      if (oystehr && appointmentId) {
        const data = (
          await oystehr.fhir.search<AppointmentResources>({
            resourceType: 'Appointment',
            params: [
              { name: '_id', value: appointmentId },
              {
                name: '_include',
                value: 'Appointment:patient',
              },
              {
                name: '_include',
                value: 'Appointment:location',
              },
              {
                name: '_include:iterate',
                value: 'Encounter:participant:Practitioner',
              },
              {
                name: '_revinclude:iterate',
                value: 'Encounter:appointment',
              },
              {
                name: '_revinclude:iterate',
                value: 'QuestionnaireResponse:encounter',
              },
              { name: '_revinclude', value: 'DocumentReference:related' },
              { name: '_revinclude:iterate', value: 'Account:patient' },
              { name: '_revinclude:iterate', value: 'Coverage:patient' },
            ],
          })
        )
          .unbundle()
          .filter(
            (resource) =>
              resource.resourceType !== 'QuestionnaireResponse' ||
              resource.questionnaire?.includes('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson') ||
              resource.questionnaire?.includes('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-virtual')
          );

        return selectAppointmentData(data);
      }
      throw new Error('fhir client not defined or appointmentId not provided');
    },
    enabled: Boolean(oystehr) && Boolean(appointmentId),
    staleTime: 5_000, // fast fix for the https://github.com/masslight/ottehr/issues/3776; It might be related to rerenders triggering refetching and React Query getting stuck in an infinite loading loop
  });

  const data = query.data;
  useSuccessQuery(data, (data) => data && onSuccess && onSuccess(data));

  return query;
};

export const useRefreshableAppointmentData = (
  {
    appointmentId,
    isEnabled,
  }: {
    appointmentId: string | undefined;
    isEnabled: boolean;
  },
  onSuccess: (data: RefreshableAppointmentData) => void
): UseQueryResult<AppointmentResources[], unknown> => {
  return useGetTelemedAppointmentPeriodicRefresh(
    {
      appointmentId: appointmentId,
      isEnabled: isEnabled,
      refreshIntervalMs: APPOINTMENT_REFRESH_INTERVAL,
    },
    (originalData) => {
      if (!originalData || !onSuccess) {
        return;
      }
      const refreshedData = createRefreshableAppointmentData(originalData);
      onSuccess(refreshedData);
    }
  );
};

export const useGetTelemedAppointmentPeriodicRefresh = (
  {
    appointmentId,
    isEnabled,
    refreshIntervalMs,
  }: {
    appointmentId: string | undefined;
    isEnabled: boolean;
    refreshIntervalMs: number | undefined;
  },
  onSuccess: (data: AppointmentResources[] | null) => void
): UseQueryResult<AppointmentResources[], unknown> => {
  const { oystehr } = useApiClients();
  const refetchOptions = refreshIntervalMs ? { refetchInterval: refreshIntervalMs } : {};

  const queryResult = useQuery({
    queryKey: ['telemed-appointment-periodic-refresh', appointmentId],

    queryFn: async () => {
      if (oystehr && appointmentId) {
        return (
          await oystehr.fhir.search<AppointmentResources>({
            resourceType: 'Appointment',
            params: [
              { name: '_id', value: appointmentId },
              { name: '_revinclude', value: 'DocumentReference:related' },
            ],
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined or appointmentId not provided');
    },

    ...refetchOptions,
    enabled: isEnabled && Boolean(appointmentId) && Boolean(oystehr),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useSaveChartData = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrTelemedAPIClient['saveChartData']>>,
  Error,
  Omit<SaveChartDataRequest, 'encounterId'>
> => {
  const apiClient = useOystehrAPIClient();
  const { encounter } = useAppointmentData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return useMutation({
    mutationFn: (chartDataFields: Omit<SaveChartDataRequest, 'encounterId'>) => {
      // disabled saving chart data in read only mode except addendum note
      if (isReadOnly && Object.keys(chartDataFields).some((key) => (key as keyof AllChartValues) !== 'addendumNote')) {
        throw new Error('update disabled in read only mode');
      }

      if (apiClient && encounter.id) {
        return apiClient.saveChartData({
          encounterId: encounter.id,
          ...chartDataFields,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },
    retry: 2,
  });
};

export const useDeleteChartData = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrTelemedAPIClient['deleteChartData']>>,
  Error,
  AllChartValues & { schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[] }
> => {
  const apiClient = useOystehrAPIClient();
  const { encounter } = useAppointmentData();

  return useMutation({
    mutationFn: (chartDataFields: AllChartValues & { schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[] }) => {
      if (apiClient && encounter.id) {
        return apiClient.deleteChartData({
          encounterId: encounter.id,
          ...chartDataFields,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },
    retry: 2,
  });
};

export const useChartData = ({
  appointmentId,
  shouldUpdateExams,
  onSuccess,
  onError,
  enabled = true,
  refetchInterval,
}: {
  appointmentId?: string;
  onSuccess?: (data: ChartDataResponse | null) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
  shouldUpdateExams?: boolean; // todo: migrate this to the separate hook
  refetchInterval?: number;
} = {}): {
  refetch: () => Promise<void>;
  isLoading: boolean;
  isFetching: boolean;
  error: any;
  queryKey: QueryKey;
  isFetched: boolean;
} & ChartDataState &
  ChartDataStateUpdater &
  ReactQueryState => {
  const apiClient = useOystehrAPIClient();
  const { update: updateExamObservations } = useExamObservations();
  const { id: appointmentIdFromUrl } = useParams();
  const { encounter } = useAppointmentData(appointmentId || appointmentIdFromUrl);
  const encounterId = encounter?.id;
  const queryClient = useQueryClient();

  const {
    error: chartDataError,
    isLoading,
    isFetching,
    data: chartDataResponse,
    queryKey,
    isFetched,
    isPending,
  } = useGetChartData(
    { apiClient, encounterId, enabled, refetchInterval, requestKey: CHART_DATA_QUERY_KEY },
    (data) => {
      if (!data) {
        return;
      }

      onSuccess?.(data);
      if (shouldUpdateExams) {
        updateExamObservations(data.examObservations, true);
      }
    },
    (error) => {
      onError?.(error);
    }
  );

  const setQueryCache = useCallback(
    (updater: Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>)) => {
      queryClient.setQueryData(queryKey, (prevData: ChartDataResponse | null) => {
        const currentState = {
          chartData: prevData || chartDataResponse || undefined,
          isChartDataLoading: isLoading,
        };

        const newData = typeof updater === 'function' ? updater(currentState) : updater;
        return newData.chartData || prevData;
      });

      // Force invalidate all related queries to update the UI
      void queryClient.invalidateQueries({
        queryKey: [CHART_DATA_QUERY_KEY, encounterId],
        exact: false,
        refetchType: 'active',
      });
    },
    [queryClient, queryKey, chartDataResponse, isLoading, encounterId]
  );

  const setPartialChartData = useCallback(
    (data: Partial<ChartDataResponse>) => {
      setQueryCache((state) => ({
        chartData: { ...state.chartData, patientId: state.chartData?.patientId || '', ...data },
      }));
    },
    [setQueryCache]
  );

  const updateObservation = useCallback(
    (newObservation: ObservationDTO) => {
      setQueryCache((state) => {
        const currentObservations = state.chartData?.observations || [];
        const updatedObservations: ObservationDTO[] = [...currentObservations];

        const existingObservationIndex = updatedObservations.findIndex(
          (observation) => observation.field === newObservation.field
        );

        if (existingObservationIndex !== -1 && 'value' in newObservation) {
          const updatedObservation = { ...updatedObservations[existingObservationIndex] };

          if (!('note' in newObservation) && 'note' in updatedObservation) {
            delete updatedObservation.note;
          }

          updatedObservations[existingObservationIndex] = {
            ...updatedObservation,
            value: newObservation.value,
            ...('note' in newObservation && { note: newObservation.note }),
          } as ObservationDTO;
        } else {
          updatedObservations.push(newObservation);
        }

        return {
          chartData: {
            ...state.chartData!,
            observations: updatedObservations,
          },
        };
      });
    },
    [setQueryCache]
  );

  const chartDataRefetch = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: [CHART_DATA_QUERY_KEY, encounter.id],
      exact: false,
    });
  }, [queryClient, encounter.id]);

  return {
    refetch: chartDataRefetch,
    chartDataRefetch: chartDataRefetch,
    chartData: chartDataResponse || undefined,
    isLoading,
    isChartDataLoading: isLoading,
    error: chartDataError,
    queryKey,
    isFetching,
    isFetched,
    setPartialChartData,
    updateObservation,
    chartDataSetState: setQueryCache,
    chartDataError,
    isPending,
  };
};

export const useGetChartData = (
  {
    apiClient,
    encounterId,
    requestedFields,
    enabled,
    refetchInterval,
    requestKey,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    encounterId?: string;
    requestedFields?: ChartDataRequestedFields;
    enabled?: boolean;
    refetchInterval?: number;
    requestKey: typeof CHART_DATA_QUERY_KEY | typeof CHART_FIELDS_QUERY_KEY;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getChartData']>> | null) => void,
  onError?: (error: any) => void
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const user = useEvolveUser();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const key = [requestKey, encounterId, requestedFields, isReadOnly]; // TODO: check if isReadOnly is needed (it causes duplicate requests because it's unstable and has not isLoading state)

  const query = useQuery({
    queryKey: key,

    queryFn: () => {
      if (apiClient && encounterId) {
        return apiClient.getChartData({
          encounterId,
          requestedFields,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },

    enabled: !!apiClient && !!encounterId && !!user && enabled,
    staleTime: 0, // TODO: screening note is not refreshed after saving on the progress note screen, fix this and similar cases and add staleTime with default QUERY_STALE_TIME
    refetchInterval: refetchInterval || false,
  });

  useSuccessQuery(query.data, onSuccess);

  useErrorQuery(query.error, onError);

  return {
    ...query,
    queryKey: key,
  };
};

export const TELEMED_APPOINTMENT_QUERY_KEY = 'telemed-appointment';
