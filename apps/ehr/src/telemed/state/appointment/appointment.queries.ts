import {
  ErxConnectPractitionerParams,
  ErxEnrollPractitionerParams,
  ErxSearchAllergensResponse,
  ErxSearchMedicationsResponse,
} from '@oystehr/sdk';
import { keepPreviousData, useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  Appointment,
  Bundle,
  Coding,
  Encounter,
  FhirResource,
  InsurancePlan,
  Medication,
  Patient,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import {
  CancelMatchUnsolicitedResultTask,
  createSmsModel,
  filterResources,
  FinalizeUnsolicitedResultMatch,
  GetCreateLabOrderResources,
  GetMedicationOrdersInput,
  GetMedicationOrdersResponse,
  GetUnsolicitedResultsDetailInput,
  GetUnsolicitedResultsDetailOutput,
  GetUnsolicitedResultsIconStatusInput,
  GetUnsolicitedResultsIconStatusOutput,
  GetUnsolicitedResultsMatchDataInput,
  GetUnsolicitedResultsMatchDataOutput,
  GetUnsolicitedResultsPatientListInput,
  GetUnsolicitedResultsPatientListOutput,
  GetUnsolicitedResultsRelatedRequestsInput,
  GetUnsolicitedResultsRelatedRequestsOutput,
  GetUnsolicitedResultsTasksInput,
  GetUnsolicitedResultsTasksOutput,
  Icd10SearchRequestParams,
  Icd10SearchResponse,
  IcdSearchRequestParams,
  IcdSearchResponse,
  InstructionType,
  INVENTORY_MEDICATION_TYPE_CODE,
  LabOrderResourcesRes,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MeetingData,
  relatedPersonAndCommunicationMaps,
  ReviewAndSignData,
  TelemedAppointmentInformation,
  UpdateMedicationOrderInput,
  useErrorQuery,
  useSuccessQuery,
} from 'utils';
import { icd10Search } from '../../../api/api';
import { CHAT_REFETCH_INTERVAL, QUERY_STALE_TIME } from '../../../constants';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { OystehrTelemedAPIClient, PromiseReturnType } from '../../data';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { extractReviewAndSignAppointmentData } from '../../utils';
import { useAppointmentData } from './appointment.store';

export const useGetReviewAndSignData = (
  {
    appointmentId,
    runImmediately,
  }: {
    appointmentId: string | undefined;
    runImmediately: boolean;
  },
  onSuccess: (data: ReviewAndSignData | undefined) => void
): UseQueryResult<(Appointment | Encounter)[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['telemed-appointment-review-and-sign', { appointmentId }],

    queryFn: async () => {
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

    enabled: runImmediately,
  });

  useSuccessQuery(queryResult.data, (data) => {
    if (!data || !onSuccess) {
      return;
    }
    const reviewAndSignData = extractReviewAndSignAppointmentData(data);
    onSuccess(reviewAndSignData);
  });

  return queryResult;
};

export const useGetDocumentReferences = (
  {
    appointmentId,
    patientId,
  }: {
    appointmentId: string | undefined;
    patientId: string | undefined;
  },
  onSuccess: (data: Bundle<FhirResource>) => void
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const { oystehr } = useApiClients();
  const queryResult = useQuery({
    queryKey: ['telemed-appointment-documents', appointmentId],

    queryFn: () => {
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

    enabled: Boolean(oystehr) && Boolean(appointmentId),
  });

  useSuccessQuery(queryResult.data, (data) => onSuccess?.(data as Bundle<FhirResource>));

  return queryResult;
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

  const queryResult = useQuery({
    queryKey: ['telemed-appointment-messaging', appointmentId],

    queryFn: async () => {
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

    refetchInterval: CHAT_REFETCH_INTERVAL,
    enabled: !!oystehr && !!appointmentId,
  });

  useSuccessQuery(queryResult.data, (data) => onSuccess?.(data as unknown as TelemedAppointmentInformation));

  return queryResult as unknown as { data: TelemedAppointmentInformation | undefined; isFetching: boolean };
};

export const useGetMeetingData = (
  getAccessTokenSilently: () => Promise<string>,
  onSuccess: (data: MeetingData | null) => void,
  onError: (error: Error) => void
): UseQueryResult<MeetingData, Error> => {
  const { encounter } = useAppointmentData();

  const queryResult = useQuery({
    queryKey: ['meeting-data'],

    queryFn: async () => {
      const token = await getAccessTokenSilently();

      if (encounter?.id && token) {
        const videoTokenResp = await fetch(
          `${import.meta.env.VITE_APP_PROJECT_API_URL}/telemed/v2/meeting/${encounter.id}/join`,
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

    // todo: why is this disabled?
    enabled: false,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  useErrorQuery(queryResult.error, onError);

  return queryResult;
};

export type ExtractObjectType<T> = T extends (infer U)[] ? U : never;

export const useGetMedicationsSearch = (
  medicationSearchTerm: string
): UseQueryResult<ErxSearchMedicationsResponse, Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['medications-search', medicationSearchTerm],

    queryFn: async () => {
      if (oystehr) {
        return oystehr.erx.searchMedications({ name: medicationSearchTerm });
      }
      throw new Error('api client not defined');
    },

    enabled: Boolean(medicationSearchTerm),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });

  useEffect(() => {
    if (queryResult.error) {
      enqueueSnackbar('An error occurred during the search. Please try again in a moment', {
        variant: 'error',
      });
    }
  }, [queryResult.error]);

  return queryResult;
};

export const useGetAllergiesSearch = (
  allergiesSearchTerm: string
): UseQueryResult<ErxSearchAllergensResponse, Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['allergies-search', allergiesSearchTerm],

    queryFn: async () => {
      if (oystehr) {
        return oystehr.erx.searchAllergens({ name: allergiesSearchTerm });
      }
      throw new Error('api client not defined');
    },

    enabled: Boolean(allergiesSearchTerm),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });

  useEffect(() => {
    if (queryResult.error) {
      enqueueSnackbar('An error occurred during the search. Please try again in a moment', {
        variant: 'error',
      });
    }
  }, [queryResult.error]);

  return queryResult;
};

export const useGetCreateExternalLabResources = ({
  patientId,
  search,
  labOrgIdsString,
}: GetCreateLabOrderResources): UseQueryResult<LabOrderResourcesRes | null, Error> => {
  const apiClient = useOystehrAPIClient();
  return useQuery({
    queryKey: ['external lab resource search', patientId, search, labOrgIdsString],

    queryFn: async () => {
      const res = await apiClient?.getCreateExternalLabResources({ patientId, search, labOrgIdsString });
      if (res) {
        return res;
      } else {
        return null;
      }
    },

    enabled: Boolean(apiClient && (patientId || search)),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
};

export function useDisplayUnsolicitedResultsIcon(
  input: GetUnsolicitedResultsIconStatusInput
): UseQueryResult<GetUnsolicitedResultsIconStatusOutput | null, Error> {
  const apiClient = useOystehrAPIClient();
  const { requestType } = input;

  return useQuery({
    queryKey: ['get unsolicited results resources', requestType],

    queryFn: async () => {
      const data = await apiClient?.getUnsolicitedResultsResources(input);
      if (data && 'tasksAreReady' in data) {
        return data;
      }
      return null;
    },

    enabled: Boolean(apiClient && FEATURE_FLAGS.LAB_ORDERS_ENABLED),
    staleTime: 1000 * 15, // 15 seconds
  });
}

export function useGetUnsolicitedResultsTasks(
  input: GetUnsolicitedResultsTasksInput
): UseQueryResult<GetUnsolicitedResultsTasksOutput | null, Error> {
  const apiClient = useOystehrAPIClient();
  const { requestType } = input;

  return useQuery({
    queryKey: ['get unsolicited results resources', requestType],

    queryFn: async () => {
      const data = await apiClient?.getUnsolicitedResultsResources(input);
      if (data && 'unsolicitedResultsTasks' in data) {
        return data;
      }
      return null;
    },

    enabled: Boolean(apiClient),
  });
}

export function useGetUnsolicitedResultsMatchData(
  input: GetUnsolicitedResultsMatchDataInput
): UseQueryResult<GetUnsolicitedResultsMatchDataOutput | null, Error> {
  const apiClient = useOystehrAPIClient();
  const { requestType, diagnosticReportId } = input;

  return useQuery({
    queryKey: ['get unsolicited results resources', requestType, diagnosticReportId],

    queryFn: async () => {
      const data = await apiClient?.getUnsolicitedResultsResources({ requestType, diagnosticReportId });
      if (data && 'unsolicitedLabInfo' in data) {
        return data;
      }
      return null;
    },

    enabled: Boolean(apiClient && diagnosticReportId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
}

export function useGetUnsolicitedResultsRelatedRequests(
  input: GetUnsolicitedResultsRelatedRequestsInput
): UseQueryResult<GetUnsolicitedResultsRelatedRequestsOutput | null, Error> {
  const apiClient = useOystehrAPIClient();
  const { requestType, diagnosticReportId, patientId } = input;

  return useQuery({
    queryKey: ['get unsolicited results resources', requestType, diagnosticReportId, patientId],

    queryFn: async () => {
      const data = await apiClient?.getUnsolicitedResultsResources({ requestType, diagnosticReportId, patientId });
      if (data && 'possibleRelatedSRsWithVisitDate' in data) {
        return data;
      }
      return null;
    },

    enabled: Boolean(apiClient && diagnosticReportId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
}

export function useGetUnsolicitedResultsDetail(
  input: GetUnsolicitedResultsDetailInput
): UseQueryResult<GetUnsolicitedResultsDetailOutput | null, Error> {
  const apiClient = useOystehrAPIClient();
  const { requestType, diagnosticReportId } = input;

  return useQuery({
    queryKey: ['get unsolicited results resources', requestType, diagnosticReportId],

    queryFn: async () => {
      const data = await apiClient?.getUnsolicitedResultsResources({ requestType, diagnosticReportId });
      if (data && 'unsolicitedLabDTO' in data) {
        return data;
      }
      return null;
    },

    enabled: Boolean(apiClient && diagnosticReportId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
}

export function useGetUnsolicitedResultsForPatientList(
  input: GetUnsolicitedResultsPatientListInput
): UseQueryResult<GetUnsolicitedResultsPatientListOutput | null, Error> {
  const apiClient = useOystehrAPIClient();
  const { requestType, patientId } = input;

  return useQuery({
    queryKey: ['get unsolicited results resources', requestType, patientId],

    queryFn: async () => {
      const data = await apiClient?.getUnsolicitedResultsResources({ requestType, patientId });
      if (data && 'unsolicitedLabListDTOs' in data) {
        return data;
      }
      return null;
    },

    enabled: Boolean(apiClient && patientId),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
}

export function useCancelMatchUnsolicitedResultTask(): UseMutationResult<
  void,
  Error,
  CancelMatchUnsolicitedResultTask
> {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: async (input: CancelMatchUnsolicitedResultTask) => {
      const { taskId, event } = input;
      const data = await apiClient?.updateLabOrderResources({ taskId, event });

      if (data && 'possibleRelatedSRsWithVisitDate' in data) {
        return data;
      }

      return;
    },
  });
}

export function useFinalizeUnsolicitedResultMatch(): UseMutationResult<void, Error, FinalizeUnsolicitedResultMatch> {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: async (input: FinalizeUnsolicitedResultMatch) => {
      const data = await apiClient?.updateLabOrderResources(input);

      if (data && 'possibleRelatedSRsWithVisitDate' in data) {
        return data;
      }

      return;
    },
  });
}

export const useGetIcd10Search = ({
  search,
  sabs,
  radiologyOnly,
}: IcdSearchRequestParams): UseQueryResult<IcdSearchResponse | undefined, Error> => {
  const apiClient = useOystehrAPIClient();

  const queryResult = useQuery({
    queryKey: ['icd-search', search, sabs, radiologyOnly],

    queryFn: async () => {
      return apiClient?.icdSearch({ search, sabs, radiologyOnly });
    },

    enabled: Boolean(apiClient && search),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });

  useEffect(() => {
    if (queryResult.error) {
      enqueueSnackbar('An error occurred during the search. Please try again in a moment.', {
        variant: 'error',
      });
    }
  }, [queryResult.error]);

  return queryResult;
};

export const useICD10SearchNew = ({
  search,
}: Icd10SearchRequestParams): UseQueryResult<Icd10SearchResponse | undefined, Error> => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['icd-10-search', search],

    queryFn: async () => {
      if (!oystehrZambda) return undefined;
      return icd10Search(oystehrZambda, { search });
    },

    enabled: Boolean(oystehrZambda && search),
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });

  useEffect(() => {
    if (queryResult.error) {
      enqueueSnackbar('An error occurred during the search. Please try again in a moment.', {
        variant: 'error',
      });
    }
  }, [queryResult.error]);

  return queryResult;
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
      const UPDATE_PAPERWORK_ZAMBDA_ID = 'update-paperwork';

      if (!oystehrZambda) {
        throw new Error('api client not defined');
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

export const useGetPatientInstructions = (
  { type }: { type: InstructionType },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientInstructions']>> | null) => void
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiClient = useOystehrAPIClient();

  const queryResult = useQuery({
    queryKey: ['telemed-get-patient-instructions', type],

    queryFn: () => {
      if (apiClient) {
        return apiClient.getPatientInstructions({
          type,
        });
      }
      throw new Error('api client not defined');
    },

    enabled: !!apiClient,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSavePatientInstruction = () => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: (instruction: { text: string }) => {
      if (apiClient) {
        return apiClient.savePatientInstruction(instruction);
      }
      throw new Error('api client not defined');
    },
  });
};

export const useDeletePatientInstruction = (): UseMutationResult<void, Error, { instructionId: string }> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: (instruction: { instructionId: string }) => {
      if (apiClient) {
        return apiClient.deletePatientInstruction(instruction);
      }
      throw new Error('api client not defined');
    },
  });
};

export const useSyncERXPatient = ({
  patient,
  enabled,
  onError,
}: {
  patient: Patient;
  enabled: boolean;
  onError: (err: any) => void;
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
}) => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['erx-sync-patient', patient],

    queryFn: async () => {
      if (oystehr) {
        console.log(`Start syncing patient with erx patient ${patient.id}`);
        try {
          await oystehr.erx.syncPatient({ patientId: patient.id! });
          console.log('Successfully synced erx patient');
          return true;
        } catch (err) {
          console.error('Error during syncing erx patient: ', err);
          throw err;
        }
      }
      throw new Error('oystehr client is not defined');
    },

    retry: 2,
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  useErrorQuery(queryResult.error, onError);

  return queryResult;
};

export const useConnectPractitionerToERX = ({
  patientId,
  encounterId,
}: {
  patientId?: string;
  encounterId?: string;
}): UseMutationResult<string, Error, void> => {
  const { oystehr } = useApiClients();

  return useMutation({
    mutationKey: ['erx-connect-practitioner', patientId],

    mutationFn: async () => {
      if (oystehr) {
        console.log(`Start connecting practitioner to erx`);
        try {
          const params: ErxConnectPractitionerParams = {};
          if (patientId) {
            params.patientId = patientId;
          }
          if (encounterId) {
            params.encounterId = encounterId;
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

    retry: 2,
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEnrollPractitionerToERX = ({ onError }: { onError?: (err: any) => void }) => {
  const { oystehr } = useApiClients();

  return useMutation({
    mutationKey: ['erx-enroll-practitioner'],

    mutationFn: async (practitionerId: string) => {
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

    retry: 2,
    onError,
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCheckPractitionerEnrollment = ({ enabled }: { enabled: boolean }) => {
  const { oystehr } = useApiClients();
  const user = useEvolveUser();

  return useQuery({
    queryKey: ['erx-check-practitioner-enrollment'],

    queryFn: async () => {
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

    retry: 2,
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });
};

/*
 * This should be deletable now but need to verify that ClaimsQueue feature has been mothballed
 */
export const useGetInsurancePlan = ({ id }: { id: string | undefined }): UseQueryResult<InsurancePlan, Error> => {
  const { oystehr } = useApiClients();
  const queryResult = useQuery({
    queryKey: ['telemed-insurance-plan', id],

    queryFn: () => {
      if (oystehr && id) {
        return oystehr.fhir.get<InsurancePlan>({
          resourceType: 'InsurancePlan',
          id,
        });
      }
      throw new Error('fhir client not defined or Insurance Plan ID not provided');
    },

    enabled: Boolean(oystehr) && Boolean(id),
  });

  return queryResult;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useCreateUpdateMedicationOrder = () => {
  const apiClient = useOystehrAPIClient();
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

export const useGetMedicationOrders = (
  searchBy: GetMedicationOrdersInput['searchBy']
): UseQueryResult<GetMedicationOrdersResponse, Error> => {
  const apiClient = useOystehrAPIClient();

  const encounterIdIsDefined = searchBy.field === 'encounterId' && searchBy.value;
  const encounterIdsHasLen = searchBy.field === 'encounterIds' && searchBy.value.length > 0;

  return useQuery({
    queryKey: ['telemed-get-medication-orders', JSON.stringify(searchBy)],

    queryFn: () => {
      if (apiClient) {
        return apiClient.getMedicationOrders({ searchBy }) as Promise<GetMedicationOrdersResponse>;
      }
      throw new Error('api client not defined');
    },

    enabled: !!apiClient && Boolean(encounterIdIsDefined || encounterIdsHasLen),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

const emptyMedications: Record<string, string> = {};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetMedicationList = () => {
  const { oystehr } = useApiClients();

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

  const queryResult = useQuery({
    queryKey: ['medication-list-search'],

    queryFn: async () => {
      if (!oystehr) {
        return emptyMedications;
      }
      const data = await oystehr.fhir.search<Medication>({
        resourceType: 'Medication',
        params: [{ name: 'identifier', value: INVENTORY_MEDICATION_TYPE_CODE }],
      });

      return getMedicationIdentifierNames(data.unbundle());
    },

    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });

  useEffect(() => {
    if (queryResult.error) {
      enqueueSnackbar('An error occurred while searching medications.', {
        variant: 'error',
      });
    }
  }, [queryResult.error]);

  return queryResult;
};
