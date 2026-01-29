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
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  APPOINTMENT_REFRESH_INTERVAL,
  CHART_DATA_QUERY_KEY,
  CHART_FIELDS_QUERY_KEY,
  QUERY_STALE_TIME,
} from 'src/constants';
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
  APIErrorCode,
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
import { getEncounterValues } from './parser/extractors';
import { parseBundle } from './parser/parser';
import { VisitMappedData, VisitResources } from './parser/types';
import { resetExamObservationsStore } from './reset-exam-observations';

export type AppointmentTelemedState = {
  appointment: Appointment | undefined;
  patient: Patient | undefined;
  location: Location | undefined;
  locationVirtual: Location | undefined;
  locations: Location[];
  practitioners?: Practitioner[];
  group?: HealthcareService;
  followUpOriginEncounter: Encounter;
  encounter: Encounter;
  followupEncounters?: Encounter[];
  selectedEncounterId: string | undefined;
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
  setSelectedEncounter: (encounterId: string | undefined) => void;
  getSelectedEncounter: () => Encounter | undefined;
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

type ChartDataResponse = Omit<
  GetChartDataResponse,
  Exclude<RequestedFields, 'medications' | 'inhouseMedications' | 'observations'>
>;

export type ChartDataState = {
  chartData: ChartDataResponse | undefined;

  // todo: remove duplication
  isChartDataLoading: boolean;
};

interface ChartDataStateUpdater {
  setPartialChartData: (value: Partial<GetChartDataResponse>, opts?: { invalidateQueries?: boolean }) => void;
  updateObservation: (observation: ObservationDTO) => void;
  chartDataSetState: (
    updater: Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>),
    opts?: { invalidateQueries?: boolean }
  ) => void;
  chartDataRefetch: () => any;
  chartDataError: any;
}

const APPOINTMENT_INITIAL: AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState = {
  appointment: undefined,
  patient: undefined,
  location: undefined,
  locationVirtual: undefined,
  locations: [],
  practitioners: [],
  followUpOriginEncounter: {} as Encounter,
  encounter: {} as Encounter,
  followupEncounters: [],
  selectedEncounterId: undefined,
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
  const [searchParams] = useSearchParams();
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

  const setSelectedEncounter = useCallback(
    (encounterId: string | undefined) => {
      setState((state) => ({
        ...state,
        selectedEncounterId: encounterId,
      }));
    },
    [setState]
  );

  useEffect(() => {
    const encounterIdFromUrl = searchParams.get('encounterId');
    if (!encounterIdFromUrl) {
      return;
    }

    const state = currentState || APPOINTMENT_INITIAL;
    if (state.selectedEncounterId === encounterIdFromUrl) {
      return;
    }

    if (isLoading || isPending) {
      return;
    }

    const allEncounters = [state.followUpOriginEncounter, ...(state.followupEncounters || [])].filter(Boolean);
    const encounterExists = allEncounters.some((enc) => enc.id === encounterIdFromUrl);

    if (!encounterExists) {
      queryClient.setQueryData(
        [TELEMED_APPOINTMENT_QUERY_KEY, appointmentId],
        (prevData: (AppointmentTelemedState & AppointmentRawResourcesState & InPersonAppointmentState) | undefined) => {
          const currentData = prevData || state;
          return {
            ...currentData,
            selectedEncounterId: encounterIdFromUrl,
          };
        }
      );

      void queryClient.invalidateQueries({
        queryKey: [TELEMED_APPOINTMENT_QUERY_KEY, appointmentId],
        exact: false,
      });
      return;
    }

    setSelectedEncounter(encounterIdFromUrl);
  }, [isLoading, isPending, searchParams, setSelectedEncounter, currentState, queryClient, appointmentId]);

  const getSelectedEncounter = useCallback(() => {
    const state = currentState || APPOINTMENT_INITIAL;
    if (!state.selectedEncounterId || state.selectedEncounterId === state.followUpOriginEncounter?.id) {
      return state.followUpOriginEncounter;
    }

    return state.followupEncounters?.find((encounter) => encounter.id === state.selectedEncounterId);
  }, [currentState]);

  const fullState = useMemo(() => {
    const state = currentState || APPOINTMENT_INITIAL;
    const selectedEncounter = getSelectedEncounter();
    const encounterToUse = selectedEncounter || state.followUpOriginEncounter;

    return {
      ...state,
      encounter: encounterToUse,
      visitState: {
        ...state.visitState,
        encounter: encounterToUse,
      },
      resources: {
        ...state.resources,
        encounter: getEncounterValues(encounterToUse),
      },
      isAppointmentLoading: isLoading,
      appointmentRefetch: refetch,
      appointmentSetState: setState,
      appointmentError: error,
      setSelectedEncounter,
      getSelectedEncounter,
      isFetching,
      isPending,
      error,
      isLoading,
      refetch,
    };
  }, [
    currentState,
    isLoading,
    setState,
    refetch,
    error,
    isFetching,
    isPending,
    setSelectedEncounter,
    getSelectedEncounter,
  ]);

  return fullState;
};

export type AppointmentResources =
  | Appointment
  | DocumentReference
  | Encounter
  | Location
  | HealthcareService
  | Practitioner
  | Patient
  | QuestionnaireResponse;

const selectAppointmentData = (
  data: AppointmentResources[] | undefined,
  preserveSelectedEncounterId?: string
): (AppointmentTelemedState & InPersonAppointmentState & AppointmentRawResourcesState) | null => {
  if (!data) return null;

  const questionnaireResponse = data?.find(
    (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse'
  ) as QuestionnaireResponse;

  const parsed = parseBundle(data);
  const appointment = data?.find((resource: FhirResource) => resource.resourceType === 'Appointment') as Appointment;
  const patient = data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as Patient;

  const appointmentLocationRef = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))
    ?.actor?.reference;
  const appointmentLocationId = appointmentLocationRef?.split('/')?.pop();
  const location = data.find(
    (resource): resource is Location =>
      resource.resourceType === 'Location' && resource.id === appointmentLocationId && !isLocationVirtual(resource)
  );

  const followUpOriginEncounter = data?.find(
    (resource: FhirResource) => resource.resourceType === 'Encounter' && !resource.partOf
  ) as Encounter;
  const followupEncounters = data?.filter(
    (resource: FhirResource) => resource.resourceType === 'Encounter' && resource.partOf
  ) as Encounter[] | undefined;

  // Preserve the selected encounter ID if it exists and is valid, otherwise default to main encounter
  const allEncounters = [followUpOriginEncounter, ...(followupEncounters || [])].filter(Boolean);
  const validSelectedEncounterId =
    preserveSelectedEncounterId && allEncounters.some((enc) => enc.id === preserveSelectedEncounterId)
      ? preserveSelectedEncounterId
      : followUpOriginEncounter?.id;

  return {
    rawResources: data,
    appointment,
    patient,
    location,
    locationVirtual: (data?.filter((resource) => resource.resourceType === 'Location') || []).find(isLocationVirtual),
    locations: data?.filter((resource): resource is Location => resource.resourceType === 'Location'),
    practitioners: data?.filter((resource): resource is Practitioner => resource.resourceType === 'Practitioner'),
    group: data?.find((resource): resource is HealthcareService => resource.resourceType === 'HealthcareService'),
    followUpOriginEncounter,
    encounter: followUpOriginEncounter, // Default to main encounter, will be updated by hook
    followupEncounters,
    selectedEncounterId: validSelectedEncounterId,
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
      encounter: followUpOriginEncounter,
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
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [TELEMED_APPOINTMENT_QUERY_KEY, appointmentId],
    queryFn: async () => {
      if (oystehr && appointmentId) {
        // Get the current selected encounter ID from the query cache to preserve it
        const currentData = queryClient.getQueryData([TELEMED_APPOINTMENT_QUERY_KEY, appointmentId]) as
          | (AppointmentTelemedState & InPersonAppointmentState & AppointmentRawResourcesState)
          | undefined;
        const currentSelectedEncounterId = currentData?.selectedEncounterId;

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
                name: '_include',
                value: 'Appointment:practitioner',
              },
              {
                name: '_include',
                value: 'Appointment:actor:HealthcareService',
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
                name: '_include:iterate',
                value: 'Encounter:location',
              },
              {
                name: '_revinclude:iterate',
                value: 'Encounter:part-of',
              },
              {
                name: '_revinclude:iterate',
                value: 'QuestionnaireResponse:encounter',
              },
              { name: '_revinclude', value: 'DocumentReference:related' },
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

        return selectAppointmentData(data, currentSelectedEncounterId);
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

      if (apiClient && encounter?.id) {
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chartDataFields: AllChartValues & { schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[] }) => {
      if (apiClient && encounter?.id) {
        return apiClient.deleteChartData({
          encounterId: encounter.id,
          ...chartDataFields,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },
    onError: async (error) => {
      if ((error as any).code === APIErrorCode.FHIR_RESOURCE_IS_GONE) {
        // Usually this happens due to an attempt to delete an already deleted resource. Thus full state refresh is required.
        resetExamObservationsStore();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY, encounter.id] }),
          queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounter.id] }),
        ]);
      }
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
  refetchOnMount,
  encounterId: paramEncounterId,
}: {
  appointmentId?: string;
  onSuccess?: (data: ChartDataResponse | null) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
  shouldUpdateExams?: boolean; // todo: migrate this to the separate hook
  refetchInterval?: number;
  refetchOnMount?: boolean;
  encounterId?: string;
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
  const encounterId = encounter?.id ?? paramEncounterId;
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
    { apiClient, encounterId, enabled, refetchInterval, refetchOnMount, requestKey: CHART_DATA_QUERY_KEY },
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
    (
      updater: Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>),
      opts: { invalidateQueries?: boolean } = { invalidateQueries: true }
    ) => {
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
        refetchType: opts.invalidateQueries ? 'active' : 'none',
      });
    },
    [queryClient, queryKey, chartDataResponse, isLoading, encounterId]
  );

  const setPartialChartData = useCallback(
    (data: Partial<ChartDataResponse>, opts: { invalidateQueries?: boolean } = { invalidateQueries: true }) => {
      setQueryCache(
        (state) => ({
          chartData: { ...state.chartData, patientId: state.chartData?.patientId || '', ...data },
        }),
        opts
      );
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
      queryKey: [CHART_DATA_QUERY_KEY, encounter?.id],
      exact: false,
    });
  }, [queryClient, encounter.id]);

  return {
    refetch: chartDataRefetch,
    chartDataRefetch: chartDataRefetch,
    chartData: chartDataResponse,
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
    refetchOnMount,
    requestKey,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    encounterId?: string;
    requestedFields?: ChartDataRequestedFields;
    enabled?: boolean;
    refetchInterval?: number;
    refetchOnMount?: boolean;
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
    staleTime: QUERY_STALE_TIME,
    refetchInterval: refetchInterval || false,
    refetchOnMount: refetchOnMount ?? true,
  });

  useSuccessQuery(query.data, onSuccess);

  useErrorQuery(query.error, onError);

  return {
    ...query,
    queryKey: key,
  };
};

export const TELEMED_APPOINTMENT_QUERY_KEY = 'telemed-appointment';
