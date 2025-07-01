import { ErxConnectPractitionerParams, ErxEnrollPractitionerParams } from '@oystehr/sdk';
import {
  Appointment,
  Bundle,
  Coding,
  DocumentReference,
  Encounter,
  FhirResource,
  InsurancePlan,
  Location,
  Medication,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useMutation, useQuery, UseQueryResult } from 'react-query';
import {
  APIError,
  ChartDataFields,
  ChartDataRequestedFields,
  createSmsModel,
  filterResources,
  GetCreateLabOrderResources,
  GetMedicationOrdersResponse,
  IcdSearchRequestParams,
  InstructionType,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MeetingData,
  RefreshableAppointmentData,
  relatedPersonAndCommunicationMaps,
  ReviewAndSignData,
  SaveChartDataRequest,
  SchoolWorkNoteExcuseDocFileDTO,
  TelemedAppointmentInformation,
  UpdateMedicationOrderInput,
} from 'utils';
import { APPOINTMENT_REFRESH_INTERVAL, CHAT_REFETCH_INTERVAL, QUERY_STALE_TIME } from '../../../constants';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser, { EvolveUser } from '../../../hooks/useEvolveUser';
import { getSelectors } from '../../../shared/store/getSelectors';
import { OystehrTelemedAPIClient, PromiseReturnType } from '../../data';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useZapEHRAPIClient } from '../../hooks/useOystehrAPIClient';
import { createRefreshableAppointmentData, extractReviewAndSignAppointmentData } from '../../utils';
import { useAppointmentStore } from './appointment.store';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetReviewAndSignData = (
  {
    appointmentId,
    runImmediately,
  }: {
    appointmentId: string | undefined;
    runImmediately: boolean;
  },
  onSuccess: (data: ReviewAndSignData | undefined) => void
) => {
  const { oystehr } = useApiClients();
  return useQuery(
    ['telemed-appointment-review-and-sign', { appointmentId }],
    async () => {
      if (oystehr && appointmentId) {
        return (
          await oystehr.fhir.search<Appointment | Encounter>({
            resourceType: 'Appointment',
            params: [
              { name: '_id', value: appointmentId },
              { name: '_revinclude:iterate', value: 'Encounter:appointment' },
            ],
          })
        ).unbundle();
      }
      throw new Error('Oystehr client not defined or appointmentId not provided');
    },
    {
      enabled: runImmediately,
      onSuccess: (data) => {
        const reviewAndSignData = extractReviewAndSignAppointmentData(data);
        onSuccess(reviewAndSignData);
      },
      onError: (err) => {
        console.error('Error during fetching get telemed appointment: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useRefreshableAppointmentData = (
  {
    appointmentId,
    isEnabled,
  }: {
    appointmentId: string | undefined;
    isEnabled: boolean;
  },
  onSuccess: (data: RefreshableAppointmentData) => void
) => {
  return useGetTelemedAppointmentPeriodicRefresh(
    {
      appointmentId: appointmentId,
      isEnabled: isEnabled,
      refreshIntervalMs: APPOINTMENT_REFRESH_INTERVAL,
    },
    (originalData) => {
      const refreshedData = createRefreshableAppointmentData(originalData);
      onSuccess(refreshedData);
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
  onSuccess: (data: VisitResources[]) => void
) => {
  const { oystehr } = useApiClients();
  const refetchOptions = refreshIntervalMs ? { refetchInterval: refreshIntervalMs } : {};
  return useQuery(
    ['telemed-appointment-periodic-refresh', { appointmentId }],
    async () => {
      if (oystehr && appointmentId) {
        return (
          await oystehr.fhir.search<VisitResources>({
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
    {
      ...refetchOptions,
      enabled: isEnabled && Boolean(appointmentId) && Boolean(oystehr),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointment periodic: ', err);
      },
    }
  );
};

export type VisitResources = Appointment | DocumentReference | Encounter | Location | Patient | QuestionnaireResponse;

export const useGetAppointment = (
  {
    appointmentId,
  }: {
    appointmentId: string | undefined;
  },
  onSuccess: (data: VisitResources[]) => void
): UseQueryResult<VisitResources[], unknown> => {
  const { oystehr } = useApiClients();
  const query = useQuery(
    ['telemed-appointment', { appointmentId }],
    async () => {
      if (oystehr && appointmentId) {
        return (
          await oystehr.fhir.search<VisitResources>({
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
      }
      throw new Error('fhir client not defined or appointmentId not provided');
    },
    {
      enabled: Boolean(oystehr) && Boolean(appointmentId),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointment: ', err);
      },
    }
  );
  const { isFetching } = query;

  useEffect(() => {
    useAppointmentStore.setState({ isAppointmentLoading: isFetching });
  }, [isFetching]);

  return query;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetDocumentReferences = (
  {
    appointmentId,
    patientId,
  }: {
    appointmentId: string | undefined;
    patientId: string | undefined;
  },
  onSuccess: (data: Bundle<FhirResource>) => void
) => {
  const { oystehr } = useApiClients();
  return useQuery(
    ['telemed-appointment-documents', { appointmentId }],
    () => {
      if (oystehr && appointmentId && patientId) {
        return oystehr.fhir.batch({
          requests: [
            {
              method: 'GET',
              url: `/DocumentReference?status=current&subject=Patient/${patientId}&related=Appointment/${appointmentId}`,
            },
          ],
        });
      }
      throw new Error('fhir client not defined or appointmentId and patientId not provided 3');
    },
    {
      enabled: Boolean(oystehr) && Boolean(appointmentId),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointment related documents: ', err);
      },
    }
  );
};

export const useGetTelemedAppointmentWithSMSModel = (
  {
    appointmentId,
    patientId,
  }: {
    appointmentId: string | undefined;
    patientId: string | undefined;
  },
  onSuccess: (data: TelemedAppointmentInformation) => void
): { data: TelemedAppointmentInformation | undefined; isFetching: boolean } => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['telemed-appointment-messaging', { appointmentId }],
    async () => {
      if (oystehr && appointmentId) {
        const appointmentResources = (
          await oystehr.fhir.search<Appointment | Patient | RelatedPerson>({
            resourceType: 'Appointment',
            params: [
              { name: '_id', value: appointmentId },
              {
                name: '_include',
                value: 'Appointment:patient',
              },
              {
                name: '_revinclude:iterate',
                value: 'RelatedPerson:patient',
              },
            ],
          })
        ).unbundle();

        const appointment = filterResources(appointmentResources, 'Appointment')[0];

        const allRelatedPersonMaps = await relatedPersonAndCommunicationMaps(oystehr, appointmentResources);

        const smsModel = createSmsModel(patientId!, allRelatedPersonMaps);

        return { ...appointment, smsModel };
      }
      throw new Error('fhir client is not defined or appointmentId and patientId are not provided');
    },
    {
      refetchInterval: CHAT_REFETCH_INTERVAL,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching appointment or creating SMS model: ', err);
      },
      enabled: !!oystehr && !!appointmentId,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetMeetingData = (
  getAccessTokenSilently: () => Promise<string>,
  onSuccess: (data: MeetingData) => void,
  onError: (error: Error) => void
) => {
  return useQuery(
    ['meeting-data'],
    async () => {
      const appointment = useAppointmentStore.getState();
      const token = await getAccessTokenSilently();

      if (appointment.encounter.id && token) {
        const videoTokenResp = await fetch(
          `${import.meta.env.VITE_APP_PROJECT_API_URL}/telemed/v2/meeting/${appointment.encounter.id}/join`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            method: 'GET',
          }
        );
        const data = await videoTokenResp.json();
        if (!videoTokenResp.ok) {
          throw new Error('Error trying to get meeting data for appointment: ' + JSON.stringify(data));
        }
        return data as MeetingData;
      }

      throw new Error('token or encounterId not provided');
    },
    {
      enabled: false,
      onSuccess,
      onError,
    }
  );
};

export const CHART_DATA_QUERY_KEY_BASE = 'telemed-get-chart-data';

export type ChartDataCacheKey = [
  typeof CHART_DATA_QUERY_KEY_BASE,
  OystehrTelemedAPIClient | undefined | null,
  string | undefined,
  EvolveUser | undefined,
  boolean,
  boolean,
  { [key: string]: any } | undefined,
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetChartData = (
  {
    apiClient,
    encounterId,
    requestedFields,
    enabled,
    refetchInterval,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    encounterId?: string;
    requestedFields?: ChartDataRequestedFields;
    enabled?: boolean;
    refetchInterval?: number;
  },
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getChartData']>>) => void,
  onError?: (error: any) => void
) => {
  const user = useEvolveUser();
  const { isAppointmentLoading } = getSelectors(useAppointmentStore, ['isAppointmentLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const key: ChartDataCacheKey = [
    CHART_DATA_QUERY_KEY_BASE,
    apiClient,
    encounterId,
    user,
    isReadOnly,
    isAppointmentLoading,
    requestedFields,
  ];

  const query = useQuery(
    key,
    () => {
      if (apiClient && encounterId) {
        return apiClient.getChartData({
          encounterId,
          requestedFields,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },
    {
      onSuccess: (data) => {
        onSuccess(data);
      },
      onError: (err) => {
        onError?.(err);
        console.error('Error during fetching get telemed appointments: ', err);
      },
      enabled: !!apiClient && !!encounterId && !!user && !isAppointmentLoading && enabled,
      staleTime: 0,
      refetchInterval: refetchInterval || false,
    }
  );
  return {
    ...query,
    queryKey: key,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSaveChartData = () => {
  const apiClient = useZapEHRAPIClient();
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return useMutation({
    mutationFn: (chartDataFields: Omit<SaveChartDataRequest, 'encounterId'>) => {
      if (isReadOnly) {
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useDeleteChartData = () => {
  const apiClient = useZapEHRAPIClient();
  const { encounter } = useAppointmentStore.getState();

  return useMutation({
    mutationFn: (chartDataFields: ChartDataFields & { schoolWorkNotes?: SchoolWorkNoteExcuseDocFileDTO[] }) => {
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

export type ExtractObjectType<T> = T extends (infer U)[] ? U : never;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetMedicationsSearch = (medicationSearchTerm: string) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['medications-search', { medicationSearchTerm }],
    async () => {
      if (oystehr) {
        return oystehr.erx.searchMedications({ name: medicationSearchTerm });
      }
      throw new Error('api client not defined');
    },
    {
      onError: (_err) => {
        enqueueSnackbar('An error occurred during the search. Please try again in a moment', {
          variant: 'error',
        });
      },
      enabled: Boolean(medicationSearchTerm),
      keepPreviousData: true,
      staleTime: QUERY_STALE_TIME,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetAllergiesSearch = (allergiesSearchTerm: string) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['allergies-search', { allergiesSearchTerm }],
    async () => {
      if (oystehr) {
        return oystehr.erx.searchAllergens({ name: allergiesSearchTerm });
      }
      throw new Error('api client not defined');
    },
    {
      onError: (_err) => {
        enqueueSnackbar('An error occurred during the search. Please try again in a moment', {
          variant: 'error',
        });
      },
      enabled: Boolean(allergiesSearchTerm),
      keepPreviousData: true,
      staleTime: QUERY_STALE_TIME,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetCreateExternalLabResources = ({ patientId, search }: GetCreateLabOrderResources) => {
  const apiClient = useZapEHRAPIClient();
  return useQuery(
    ['external lab resource search', { patientId, search }],
    async () => {
      return apiClient?.getCreateExternalLabResources({ patientId, search });
    },
    {
      enabled: Boolean(apiClient && (patientId || search)),
      keepPreviousData: true,
      staleTime: QUERY_STALE_TIME,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetIcd10Search = ({ search, sabs, radiologyOnly }: IcdSearchRequestParams) => {
  const apiClient = useZapEHRAPIClient();
  const openError = (): void => {
    enqueueSnackbar('An error occurred during the search. Please try again in a moment.', {
      variant: 'error',
    });
  };

  return useQuery(
    ['icd-search', { search, sabs, radiologyOnly }],
    async () => {
      return apiClient?.icdSearch({ search, sabs, radiologyOnly });
    },
    {
      onError: (error: APIError) => {
        openError();
        return error;
      },
      enabled: Boolean(apiClient && search),
      keepPreviousData: true,
      staleTime: QUERY_STALE_TIME,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdatePaperwork = () => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationFn: async ({
      appointmentID,
      paperwork = {},
    }: {
      appointmentID: string;
      paperwork: Record<string, string>;
    }) => {
      const UPDATE_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_PAPERWORK_ZAMBDA_ID;

      if (!oystehrZambda) {
        throw new Error('api client not defined');
      }
      if (!UPDATE_PAPERWORK_ZAMBDA_ID) {
        throw new Error('update paperwork zambda id not defined');
      }

      const response = await oystehrZambda.zambda.execute({
        id: UPDATE_PAPERWORK_ZAMBDA_ID,
        appointmentID,
        paperwork,
        timezone: DateTime.now().zoneName,
      });
      return import.meta.env.VITE_APP_IS_LOCAL === 'true' ? response : response.output;
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientInstructions = (
  { type }: { type: InstructionType },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientInstructions']>>) => void
) => {
  const apiClient = useZapEHRAPIClient();

  return useQuery(
    ['telemed-get-patient-instructions', { apiClient, type }],
    () => {
      if (apiClient) {
        return apiClient.getPatientInstructions({
          type,
        });
      }
      throw new Error('api client not defined');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get patient instructions: ', err);
      },
      enabled: !!apiClient,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSavePatientInstruction = () => {
  const apiClient = useZapEHRAPIClient();

  return useMutation({
    mutationFn: (instruction: { text: string }) => {
      if (apiClient) {
        return apiClient.savePatientInstruction(instruction);
      }
      throw new Error('api client not defined');
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useDeletePatientInstruction = () => {
  const apiClient = useZapEHRAPIClient();

  return useMutation({
    mutationFn: (instruction: { instructionId: string }) => {
      if (apiClient) {
        return apiClient.deletePatientInstruction(instruction);
      }
      throw new Error('api client not defined');
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSyncERXPatient = ({
  patient,
  enabled,
  onError,
}: {
  patient: Patient;
  enabled: boolean;
  onError: (err: any) => void;
}) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['erx-sync-patient', patient],
    async () => {
      if (oystehr) {
        console.log(`Start syncing patient with erx patient ${patient.id}`);
        try {
          await oystehr.erx.syncPatient({ patientId: patient.id! });
          console.log('Successfully synced erx patient');
          return;
        } catch (err) {
          console.error('Error during syncing erx patient: ', err);
          throw err;
        }
      }
      throw new Error('oystehr client is not defined');
    },
    {
      retry: 2,
      enabled,
      onError,
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useConnectPractitionerToERX = ({ patientId }: { patientId?: string }) => {
  const { oystehr } = useApiClients();

  return useMutation(
    ['erx-connect-practitioner', { patientId }],
    async () => {
      if (oystehr) {
        console.log(`Start connecting practitioner to erx`);
        try {
          const params: ErxConnectPractitionerParams = {};
          if (patientId) {
            params.patientId = patientId;
          }
          const resp = await oystehr.erx.connectPractitioner(params);
          console.log('Successfully connected practitioner to erx');
          return resp.ssoLink;
        } catch (err) {
          console.error('Error during connecting practitioner to erx: ', err);
          throw err;
        }
      }
      throw new Error('oystehr client is not defined');
    },
    {
      retry: 2,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEnrollPractitionerToERX = ({ onError }: { onError?: (err: any) => void }) => {
  const { oystehr } = useApiClients();

  return useMutation(
    ['erx-enroll-practitioner'],
    async (practitionerId: string) => {
      if (oystehr) {
        console.log(`Start enrolling practitioner to erx`);
        try {
          const params: ErxEnrollPractitionerParams = { practitionerId };
          await oystehr.erx.enrollPractitioner(params);
          console.log('Successfully enrolled practitioner to erx');
          return;
        } catch (err: any) {
          if (err && err.code === '4006') {
            // Practitioner is already enrolled to erx
            return;
          }
          console.error('Error during enrolling practitioner to erx: ', err);
          throw err;
        }
      }
      throw new Error('oystehr client is not defined');
    },
    {
      retry: 2,
      onError,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCheckPractitionerEnrollment = ({ enabled }: { enabled: boolean }) => {
  const { oystehr } = useApiClients();
  const user = useEvolveUser();

  return useQuery(
    ['erx-check-practitioner-enrollment'],
    async () => {
      if (oystehr) {
        console.log(`Start checking practitioner enrollment`);
        try {
          if (!user?.profileResource?.id) {
            throw new Error("Current user doesn't have a profile resource id");
          }
          const resp = await oystehr.erx.checkPractitionerEnrollment({
            practitionerId: user?.profileResource?.id,
          });
          console.log('Successfully checked practitioner enrollment');
          return resp;
        } catch (err) {
          console.error('Error during checking practitioner enrollment: ', err);
          throw err;
        }
      }
      throw new Error('oystehr client is not defined');
    },
    {
      retry: 2,
      enabled,
      staleTime: 0,
      cacheTime: 0,
      refetchOnMount: true,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetInsurancePlan = ({ id }: { id: string | undefined }) => {
  const { oystehr } = useApiClients();
  return useQuery(
    ['telemed-insurance-plan', { id }],
    () => {
      if (oystehr && id) {
        return oystehr.fhir.get<InsurancePlan>({
          resourceType: 'InsurancePlan',
          id,
        });
      }
      throw new Error('fhir client not defined or Insurance Plan ID not provided');
    },
    {
      enabled: Boolean(oystehr) && Boolean(id),
      onError: (err) => {
        console.error('Error during fetching get Insurance Plan: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateUpdateMedicationOrder = () => {
  const apiClient = useZapEHRAPIClient();
  return useMutation({
    mutationFn: (props: UpdateMedicationOrderInput) => {
      if (apiClient) {
        return apiClient.createUpdateMedicationOrder({
          ...props,
        });
      }
      throw new Error('error during create update medication order');
    },
    retry: 2,
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetMedicationOrders = ({ encounterId }: { encounterId?: string }) => {
  const apiClient = useZapEHRAPIClient();

  return useQuery(
    ['telemed-get-medication-orders', encounterId, apiClient],
    () => {
      if (apiClient && encounterId) {
        return apiClient.getMedicationOrders({ encounterId }) as Promise<GetMedicationOrdersResponse>;
      }
      throw new Error('api client not defined');
    },
    {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetMedicationList = () => {
  const { oystehr } = useApiClients();

  const openError = (): void => {
    enqueueSnackbar('An error occurred while searching medications.', {
      variant: 'error',
    });
  };

  const getMedicationIdentifierNames = (data: Medication[]): Record<string, string> => {
    return (data || []).reduce(
      (acc, entry) => {
        const identifier = entry.identifier?.find((id: Coding) => id.system === MEDICATION_IDENTIFIER_NAME_SYSTEM);

        if (identifier?.value && entry.id) {
          acc[entry.id] = identifier.value;
        }

        return acc;
      },
      {} as Record<string, string>
    );
  };

  return useQuery(
    ['medication-list-search'],
    async () => {
      if (!oystehr) {
        return [];
      }
      const data = await oystehr.fhir.search<Medication>({
        resourceType: 'Medication',
        params: [{ name: 'identifier', value: INVENTORY_MEDICATION_TYPE_CODE }],
      });

      return getMedicationIdentifierNames(data.unbundle());
    },
    {
      onError: (_err) => {
        openError();
        return {};
      },
      keepPreviousData: true,
      staleTime: QUERY_STALE_TIME,
    }
  );
};
