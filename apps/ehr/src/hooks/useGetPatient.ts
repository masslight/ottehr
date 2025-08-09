import { BundleEntry } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  Appointment,
  Bundle,
  Encounter,
  EncounterStatusHistory,
  FhirResource,
  Location,
  Organization,
  Patient,
  Questionnaire,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { getVisitTypeLabelForAppointment } from 'src/types/types';
import { useSuccessQuery } from 'utils';
import {
  getFirstName,
  getLastName,
  getVisitStatusHistory,
  getVisitTotalTime,
  isAppointmentVirtual,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  OTTEHR_MODULE,
  PromiseReturnType,
  RemoveCoverageZambdaInput,
  ServiceMode,
} from 'utils';
import { getTimezone } from '../helpers/formatDateTime';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { OystehrTelemedAPIClient } from '../telemed/data';
import { useOystehrAPIClient } from '../telemed/hooks/useOystehrAPIClient';
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
  typeLabel: string;
  serviceMode: ServiceMode;
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

  const { data: patientResources } = useQuery({
    queryKey: ['useGetPatientPatientResources', id],
    queryFn: () =>
      oystehr && id
        ? oystehr.fhir
            .search<FhirResource>({
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
            .then((bundle) => bundle.unbundle())
        : null,
    gcTime: 10000,
    enabled: oystehr != null && id != null,
  });

  const patientResource: Patient | undefined = patientResources?.find(
    (resource) => resource.resourceType === 'Patient'
  ) as Patient;

  const { data: otherPatientsWithSameNameResources } = useQuery({
    queryKey: ['otherPatientsWithSameNameResources', id],
    queryFn: () =>
      oystehr && patientResource
        ? oystehr.fhir
            .search<FhirResource>({
              resourceType: 'Patient',
              params: getPatientNameSearchParams({
                firstLast: { first: getFirstName(patientResource), last: getLastName(patientResource) },
                narrowByRelatedPersonAndAppointment: false,
                maxResultOverride: 2,
              }),
            })
            .then((bundle) => bundle.unbundle())
        : null,
    gcTime: 10000,
    enabled: oystehr != null && patientResource != null,
  });

  useEffect(() => {
    async function getPatient(): Promise<void> {
      if (!oystehr) {
        throw new Error('oystehr is not defined');
      }

      setLoading(true);

      if (!patientResources || !otherPatientsWithSameNameResources) {
        return;
      }

      const patientTemp: Patient = patientResources.find((resource) => resource.resourceType === 'Patient') as Patient;
      const appointmentsTemp: Appointment[] = patientResources.filter(
        (resource) =>
          resource.resourceType === 'Appointment' &&
          resource.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP || tag.code === OTTEHR_MODULE.TM) // this is unnecessary now; there are no BH patients to worry about
      ) as Appointment[];
      const locations: Location[] = patientResources.filter(
        (resource) => resource.resourceType === 'Location'
      ) as Location[];
      const relatedPersonTemp: RelatedPerson = patientResources.find(
        (resource) => resource.resourceType === 'RelatedPerson'
      ) as RelatedPerson;
      const encounters: Encounter[] = patientResources.filter(
        (resource) => resource.resourceType === 'Encounter'
      ) as Encounter[];

      appointmentsTemp.sort((a, b) => {
        const createdA = DateTime.fromISO(a.start ?? '');
        const createdB = DateTime.fromISO(b.start ?? '');
        return createdB.diff(createdA).milliseconds;
      });

      if (otherPatientsWithSameNameResources.length > 1) {
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
        const typeLabel = getVisitTypeLabelForAppointment(appointment);

        const serviceMode = isAppointmentVirtual(appointment) ? ServiceMode.virtual : ServiceMode['in-person'];

        return {
          id: appointment.id,
          typeLabel,
          office:
            location?.address?.state &&
            location?.name &&
            `${location?.address?.state?.toUpperCase()} - ${location?.name}`,
          officeTimeZone: getTimezone(location),
          dateTime: appointment.start,
          serviceMode,
          length:
            serviceMode === ServiceMode.virtual
              ? getTelemedLength(encounter?.statusHistory)
              : (encounter && getVisitTotalTime(appointment, getVisitStatusHistory(encounter), DateTime.now())) || 0,
          appointment,
          encounter,
        };
      });

      setAppointments(appointmentRows);
      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
      setLoading(false);
    }

    getPatient().catch((error) => console.log(error));
  }, [oystehr, patientResources, otherPatientsWithSameNameResources]);

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

export const useGetPatientAccount = (
  {
    apiClient,
    patientId,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    patientId: string | null;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientAccount']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientAccount']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['patient-account-get', { apiClient, patientId }],

    queryFn: () => {
      return apiClient!.getPatientAccount({
        patientId: patientId!,
      });
    },

    enabled: apiClient != null && patientId != null,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetPatientCoverages = (
  {
    apiClient,
    patientId,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    patientId: string | null;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['patient-coverages', { apiClient, patientId }],
    queryFn: () => {
      return apiClient!.getPatientCoverages({
        patientId: patientId!,
      });
    },
    enabled: apiClient != null && patientId != null,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useRemovePatientCoverage = (): UseMutationResult<void, Error, RemoveCoverageZambdaInput> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationKey: ['remove-patient-coverage'],

    mutationFn: async (input: RemoveCoverageZambdaInput): Promise<void> => {
      try {
        if (!apiClient || !input) return;
        await apiClient.removePatientCoverage(input);
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
  });
};

export const useUpdatePatientAccount = (
  onSuccess?: () => void
): UseMutationResult<void, Error, QuestionnaireResponse> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationKey: ['update-patient-account'],

    mutationFn: async (questionnaireResponse: QuestionnaireResponse): Promise<void> => {
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
  });
};

export const useGetInsurancePlans = (
  onSuccess: (data: Bundle<Organization> | null) => void
): UseQueryResult<Bundle<Organization>, Error> => {
  const { oystehr } = useApiClients();

  const fetchAllInsurancePlans = async (): Promise<Bundle<Organization>> => {
    if (!oystehr) {
      throw new Error('FHIR client not defined');
    }

    const searchParams = [
      { name: 'type', value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}` },
      { name: 'active:not', value: 'false' },
      { name: '_count', value: '1000' },
    ];

    let offset = 0;
    let allEntries: BundleEntry<Organization>[] = [];

    let bundle = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [...searchParams, { name: '_offset', value: offset }],
    });

    allEntries = allEntries.concat(bundle.entry || []);
    const serverTotal = bundle.total;

    while (bundle.link?.find((link) => link.relation === 'next')) {
      offset += 1000;

      bundle = await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [...searchParams.filter((param) => param.name !== '_offset'), { name: '_offset', value: offset }],
      });

      allEntries = allEntries.concat(bundle.entry || []);
    }

    return {
      ...bundle,
      entry: allEntries,
      total: serverTotal !== undefined ? serverTotal : allEntries.length,
    };
  };

  const queryResult = useQuery({
    queryKey: ['insurance-plans'],
    queryFn: fetchAllInsurancePlans,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetPatientDetailsUpdateForm = (
  onSuccess?: (data: Questionnaire | null) => void
): UseQueryResult<Questionnaire, Error> => {
  const { oystehr } = useApiClients();

  const [url, version] = updateQRUrl.split('|');

  const queryResult = useQuery({
    queryKey: ['patient-update-form'],

    queryFn: async () => {
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

    enabled: Boolean(oystehr) && Boolean(updateQRUrl),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
