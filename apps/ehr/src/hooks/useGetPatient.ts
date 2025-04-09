import { SearchParam } from '@oystehr/sdk';
import {
  Appointment,
  Bundle,
  Encounter,
  EncounterStatusHistory,
  FhirResource,
  InsurancePlan,
  Location,
  Patient,
  Questionnaire,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import {
  getFirstName,
  getLastName,
  PROJECT_MODULE,
  getVisitStatusHistory,
  getVisitTotalTime,
  INSURANCE_PLAN_PAYER_META_TAG_CODE,
  PromiseReturnType,
  RemoveCoverageZambdaInput,
} from 'utils';
import { getTimezone } from '../helpers/formatDateTime';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { OystehrTelemedAPIClient } from '../telemed/data';
import { useZapEHRAPIClient } from '../telemed/hooks/useOystehrAPIClient';
import { getVisitTypeLabelForAppointment } from '../types/types';
import { useApiClients } from './useAppClients';

const updateQRUrl = import.meta.env.VITE_APP_EHR_ACCOUNT_UPDATE_FORM;

const getTelemedLength = (history?: EncounterStatusHistory[]): number => {
  const value = history?.find((item) => item.status === 'in-progress');
  if (!value || !value.period.start) {
    return 0;
  }

  const { start, end } = value.period;
  const duration = DateTime.fromISO(start).diff(end ? DateTime.fromISO(end) : DateTime.now(), ['minute']);

  return Math.abs(duration.minutes);
};

export type AppointmentHistoryRow = {
  id: string | undefined;
  type: string | undefined;
  office: string | undefined;
  officeTimeZone: string | undefined;
  dateTime: string | undefined;
  length: number;
  appointment: Appointment;
  encounter?: Encounter;
};

export const useGetPatient = (
  id?: string
): {
  loading: boolean;
  otherPatientsWithSameName: boolean;
  setOtherPatientsWithSameName: (value: boolean) => void;
  patient?: Patient;
  setPatient: (patient: Patient) => void;
  appointments?: AppointmentHistoryRow[];
  relatedPerson?: RelatedPerson;
} => {
  const { oystehr } = useApiClients();
  const [loading, setLoading] = useState<boolean>(true);
  const [otherPatientsWithSameName, setOtherPatientsWithSameName] = useState<boolean>(false);
  const [patient, setPatient] = useState<Patient>();
  const [appointments, setAppointments] = useState<AppointmentHistoryRow[]>();
  const [relatedPerson, setRelatedPerson] = useState<RelatedPerson>();

  useEffect(() => {
    async function getPatient(): Promise<void> {
      if (!oystehr || !id) {
        throw new Error('oystehr or patient ID is not defined');
      }

      setLoading(true);
      const resourcesTemp = (
        await oystehr.fhir.search<FhirResource>({
          resourceType: 'Patient',
          params: [
            { name: '_id', value: id },
            {
              name: '_revinclude',
              value: 'Appointment:patient',
            },
            {
              name: '_include:iterate',
              value: 'Appointment:location',
            },
            {
              name: '_revinclude:iterate',
              value: 'RelatedPerson:patient',
            },
            {
              name: '_revinclude:iterate',
              value: 'Encounter:appointment',
            },
          ],
        })
      ).unbundle();

      const patientTemp: Patient = resourcesTemp.find((resource) => resource.resourceType === 'Patient') as Patient;
      const appointmentsTemp: Appointment[] = resourcesTemp.filter(
        (resource) =>
          resource.resourceType === 'Appointment' &&
          resource.meta?.tag?.find((tag) => tag.code === PROJECT_MODULE.IP || tag.code === PROJECT_MODULE.TM) // this is unnecessary now; there are no BH patients to worry about
      ) as Appointment[];
      const locations: Location[] = resourcesTemp.filter(
        (resource) => resource.resourceType === 'Location'
      ) as Location[];
      const relatedPersonTemp: RelatedPerson = resourcesTemp.find(
        (resource) => resource.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      const encounters: Encounter[] = resourcesTemp.filter(
        (resource) => resource.resourceType === 'Encounter'
      ) as Encounter[];

      appointmentsTemp.sort((a, b) => {
        const createdA = DateTime.fromISO(a.start ?? '');
        const createdB = DateTime.fromISO(b.start ?? '');
        return createdB.diff(createdA).milliseconds;
      });

      const first = getFirstName(patientTemp);
      const last = getLastName(patientTemp);
      const otherPatientParams: SearchParam[] = getPatientNameSearchParams({
        firstLast: { first, last },
        narrowByRelatedPersonAndAppointment: false,
        maxResultOverride: 2,
      });
      const otherPatientsWithSameNameTemp = (
        await oystehr.fhir.search<FhirResource>({
          resourceType: 'Patient',
          params: otherPatientParams,
        })
      ).unbundle();

      if (otherPatientsWithSameNameTemp?.length > 1) {
        setOtherPatientsWithSameName(true);
      } else {
        setOtherPatientsWithSameName(false);
      }

      const appointmentRows: AppointmentHistoryRow[] = appointmentsTemp.map((appointment: Appointment) => {
        const appointmentLocationID = appointment.participant
          .find((participant) => participant.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.replace('Location/', '');
        const location = locations.find((location) => location.id === appointmentLocationID);
        const encounter = appointment.id
          ? encounters.find((encounter) => encounter.appointment?.[0]?.reference?.endsWith(appointment.id!))
          : undefined;
        const type = getVisitTypeLabelForAppointment(appointment);

        return {
          id: appointment.id,
          type,
          office:
            location?.address?.state &&
            location?.name &&
            `${location?.address?.state?.toUpperCase()} - ${location?.name}`,
          officeTimeZone: getTimezone(location),
          dateTime: appointment.start,
          length:
            type === 'Telemed'
              ? getTelemedLength(encounter?.statusHistory)
              : (encounter && getVisitTotalTime(appointment, getVisitStatusHistory(encounter), DateTime.now())) || 0,
          appointment,
          encounter,
        };
      });

      setAppointments(appointmentRows);
      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
    }

    getPatient()
      .catch((error) => console.log(error))
      .finally(() => setLoading(false));
  }, [oystehr, id]);

  return {
    loading,
    appointments,
    otherPatientsWithSameName,
    setOtherPatientsWithSameName,
    patient,
    relatedPerson,
    setPatient,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientQuery = (
  {
    patientId,
  }: {
    patientId?: string;
  },
  onSuccess: (data: Bundle<FhirResource>) => void
) => {
  const { oystehr } = useApiClients();
  return useQuery(
    ['patient-data', { patientId }, { enabled: oystehr && patientId }],
    () => {
      if (oystehr && patientId) {
        return oystehr.fhir.search<Bundle>({
          resourceType: 'Patient',
          params: [
            { name: '_id', value: patientId },
            {
              name: '_revinclude',
              value: 'Appointment:patient',
            },
            {
              name: '_include:iterate',
              value: 'Appointment:location',
            },
            {
              name: '_revinclude:iterate',
              value: 'RelatedPerson:patient',
            },
            {
              name: '_revinclude:iterate',
              value: 'Encounter:appointment',
            },
            {
              name: '_revinclude:iterate',
              value: 'Coverage:patient',
            },
            {
              name: '_include:iterate',
              value: 'Coverage:subscriber:RelatedPerson',
            },
            {
              name: '_include:iterate',
              value: 'Coverage:payor:Organization',
            },
          ],
        });
      }
      throw new Error('fhir client not defined or appointmentId not provided');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get patient: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientAccount = (
  {
    apiClient,
    patientId,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    patientId: string | null;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientAccount']>>) => void
) => {
  return useQuery(
    ['patient-account-get', { apiClient, patientId }],
    () => {
      return apiClient!.getPatientAccount({
        patientId: patientId!,
      });
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error fetching patient account: ', err);
      },
      enabled: apiClient != null && patientId != null,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useRemovePatientCoverage = () => {
  const apiClient = useZapEHRAPIClient();

  return useMutation(['remove-patient-coverage'], async (input: RemoveCoverageZambdaInput): Promise<void> => {
    try {
      if (!apiClient || !input) return;
      await apiClient.removePatientCoverage(input);
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdatePatientAccount = (onSuccess?: () => void) => {
  const apiClient = useZapEHRAPIClient();

  return useMutation(
    ['update-patient-account'],
    async (questionnaireResponse: QuestionnaireResponse): Promise<void> => {
      try {
        if (!apiClient || !questionnaireResponse) return;
        await apiClient.updatePatientAccount({
          questionnaireResponse,
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    {
      onSuccess: () => {
        enqueueSnackbar('Patient information updated successfully', {
          variant: 'success',
        });
        if (onSuccess) {
          onSuccess();
        }
      },
      onError: () => {
        enqueueSnackbar('Save operation failed. The server encountered an error while processing your request.', {
          variant: 'error',
        });
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetInsurancePlans = (onSuccess: (data: Bundle<InsurancePlan>) => void) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['insurance-plans'],
    async () => {
      if (oystehr) {
        return oystehr.fhir.search<InsurancePlan>({
          resourceType: 'InsurancePlan',
          params: [
            {
              name: '_tag',
              value: INSURANCE_PLAN_PAYER_META_TAG_CODE,
            },
            {
              name: 'status',
              value: 'active',
            },
            {
              name: '_include',
              value: 'InsurancePlan:owned-by',
            },
          ],
        });
      }
      throw new Error('FHIR client not defined');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching insurance plans: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientDetailsUpdateForm = (onSuccess?: (data: Questionnaire) => void) => {
  const { oystehr } = useApiClients();

  const [url, version] = updateQRUrl.split('|');

  return useQuery(
    ['patient-update-form'],
    async () => {
      if (oystehr) {
        const searchResults = (
          await oystehr.fhir.search<Questionnaire>({
            resourceType: 'Questionnaire',
            params: [
              {
                name: 'url',
                value: url,
              },
              {
                name: 'version',
                value: version,
              },
            ],
          })
        ).unbundle();
        const form = searchResults[0];
        if (!form) {
          throw new Error('Form not found');
        }
        return form;
      } else {
        throw new Error('FHIR client not defined');
      }
    },
    {
      enabled: Boolean(oystehr) && Boolean(updateQRUrl),
      onSuccess,
      onError: (err) => {
        console.error('Error during patient update form: ', err);
      },
    }
  );
};
