import { Bundle, FhirResource } from 'fhir/r4';
import { useMutation, useQuery } from 'react-query';
import { AllergyDTO, FreeTextNoteDTO, MedicalConditionDTO, MedicationDTO, ProcedureDTO } from 'ehr-utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { PromiseReturnType, ZapEHRTelemedAPIClient } from '../../data';
import { useZapEHRTelemedAPIClient } from '../../hooks/useZapEHRAPIClient';
import { useAppointmentStore } from './appointment.store';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetTelemedAppointment = (
  {
    appointmentId,
  }: {
    appointmentId: string | undefined;
  },
  onSuccess: (data: Bundle<FhirResource>[]) => void,
): any => {
  const { fhirClient } = useApiClients();
  return useQuery(
    ['telemed-appointment', { appointmentId }],
    () => {
      if (fhirClient && appointmentId) {
        return fhirClient.searchResources<Bundle>({
          resourceType: 'Appointment',
          searchParams: [
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
              name: '_revinclude:iterate',
              value: 'Encounter:appointment',
            },
            {
              name: '_revinclude:iterate',
              value: 'QuestionnaireResponse:encounter',
            },
          ],
        });
      }
      throw new Error('fhir client not defined or appointmentId not provided');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointment: ', err);
      },
    },
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetVideoToken = (
  getAccessTokenSilently: () => Promise<string>,
  onSuccess: (data: { token: string }) => void,
): any => {
  return useQuery(
    ['video-token'],
    async () => {
      const appointment = useAppointmentStore.getState();
      const token = await getAccessTokenSilently();

      if (appointment.encounter.id && token) {
        // TODO: use env variable
        const videoTokenResp = await fetch(
          `https://project-api.zapehr.com/v1/telemed/token?encounterId=${appointment.encounter.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            method: 'GET',
          },
        );
        return (await videoTokenResp.json()) as { token: string };
      }

      throw new Error('token or encounterId not provided');
    },
    {
      enabled: false,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get waiting room: ', err);
      },
    },
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetChartData = (
  { apiClient, encounterId }: { apiClient: ZapEHRTelemedAPIClient | null; encounterId?: string },
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRTelemedAPIClient['getChartData']>>) => void,
): any => {
  return useQuery(
    ['telemed-get-chart-data', { apiClient, encounterId }],
    () => {
      if (apiClient && encounterId) {
        return apiClient.getChartData({
          encounterId,
        });
      }
      console.log(1, apiClient, encounterId);
      throw new Error('api client not defined or encounterId not provided');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointments: ', err);
      },
    },
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSaveChartData = () => {
  const apiClient = useZapEHRTelemedAPIClient();
  const { encounter } = useAppointmentStore.getState();

  return useMutation({
    mutationFn: ({
      chiefComplaint,
      ros,
      conditions,
      medications,
      allergies,
      procedures,
      proceduresNote,
      observations,
    }: {
      chiefComplaint?: MedicalConditionDTO;
      ros?: MedicalConditionDTO;
      conditions?: MedicalConditionDTO[];
      medications?: MedicationDTO[];
      allergies?: AllergyDTO[];
      procedures?: ProcedureDTO[];
      proceduresNote?: FreeTextNoteDTO;
      observations?: FreeTextNoteDTO;
    }) => {
      if (apiClient && encounter.id) {
        return apiClient.saveChartData({
          encounterId: encounter.id,
          chiefComplaint,
          ros,
          conditions,
          medications,
          allergies,
          procedures,
          proceduresNote,
          observations,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useDeleteChartData = () => {
  const apiClient = useZapEHRTelemedAPIClient();
  const { encounter } = useAppointmentStore.getState();

  return useMutation({
    mutationFn: ({
      chiefComplaint,
      ros,
      conditions,
      medications,
      allergies,
      procedures,
      proceduresNote,
      observations,
    }: {
      chiefComplaint?: MedicalConditionDTO;
      ros?: MedicalConditionDTO;
      conditions?: MedicalConditionDTO[];
      medications?: MedicationDTO[];
      allergies?: AllergyDTO[];
      procedures?: ProcedureDTO[];
      proceduresNote?: FreeTextNoteDTO;
      observations?: FreeTextNoteDTO;
    }) => {
      if (apiClient && encounter.id) {
        return apiClient.deleteChartData({
          encounterId: encounter.id,
          chiefComplaint,
          ros,
          conditions,
          medications,
          allergies,
          procedures,
          proceduresNote,
          observations,
        });
      }
      throw new Error('api client not defined or encounterId not provided');
    },
  });
};
