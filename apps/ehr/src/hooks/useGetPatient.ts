import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Bundle,
  Coverage,
  Encounter,
  EncounterStatusHistory,
  FhirResource,
  InsurancePlan,
  Location,
  Patient,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { BatchInputPostRequest, SearchParam } from '@oystehr/sdk';
import { useMutation, useQuery } from 'react-query';
import {
  getFirstName,
  getLastName,
  getPatchBinary,
  OTTEHR_MODULE,
  ResourceTypeNames,
  getVisitStatusHistory,
  getVisitTotalTime,
  consolidateOperations,
  PatientMasterRecordResource,
} from 'utils';
import { getTimezone } from '../helpers/formatDateTime';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { usePatientStore } from '../state/patient.store';
import { getVisitTypeLabelForAppointment } from '../types/types';
import { useApiClients } from './useAppClients';
import { enqueueSnackbar } from 'notistack';

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
          resource.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP || tag.code === OTTEHR_MODULE.TM) // this is unnecessary now; there are no BH patients to worry about
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

const preprocessUpdateOperations = (operations: Operation[], resource: PatientMasterRecordResource): Operation[] => {
  const processedOps = consolidateOperations(operations, resource);
  const telecomOp = processedOps.find((op) => op.path === '/telecom');
  if (telecomOp && telecomOp.op === 'add') {
    telecomOp.value = deduplicateContacts(telecomOp.value);
  }

  if (resource.resourceType === ResourceTypeNames.patient) {
    // Find name-related operations and add old name to the list
    const nameOperations = operations.filter(
      (op) => op.path.startsWith('/name/0/') && (op.op === 'replace' || op.op === 'remove')
    );

    if (nameOperations.length > 0) {
      const currentOfficialName = (resource as Patient).name?.find((name) => name.use === 'official');
      if (currentOfficialName) {
        processedOps.push({
          op: 'add',
          path: '/name/-',
          value: {
            ...currentOfficialName,
            use: 'old',
          },
        });
      }
    }
  }

  return processedOps;
};

type Contact = { system: string; value: string };

function deduplicateContacts(contacts: Contact[]): Contact[] {
  const lastContacts = new Map();

  for (let i = contacts.length - 1; i >= 0; i--) {
    if (!lastContacts.has(contacts[i].system)) {
      lastContacts.set(contacts[i].system, contacts[i]);
    }
  }

  return Array.from(lastContacts.values());
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdatePatient = () => {
  const {
    patient,
    insurances,
    policyHolders,
    tempInsurances,
    patchOperations,
    setPatient,
    setInsurances,
    setPolicyHolders,
  } = usePatientStore();
  const { oystehr } = useApiClients();

  return useMutation(
    ['update-patient'],
    async (): Promise<void> => {
      try {
        if (!oystehr || !patient) return;
        const patchRequests = [];

        // Process Patient patches
        if (patchOperations?.patient.length > 0) {
          const processedPatientOperations = preprocessUpdateOperations(patchOperations?.patient || [], patient);
          const patientPatch = getPatchBinary({
            resourceId: patient.id!,
            resourceType: ResourceTypeNames.patient,
            patchOperations: processedPatientOperations,
          });
          patchRequests.push(patientPatch);
        }

        // Process Coverage patches
        if (patchOperations?.coverages && Object.keys(patchOperations?.coverages).length > 0) {
          Object.entries(patchOperations?.coverages || {}).forEach(([coverageId, operations]) => {
            const coverage = insurances.find((ins) => ins.id === coverageId);
            if (coverage) {
              const processedCoverageOperations = preprocessUpdateOperations(operations, coverage);
              const coveragePatch = getPatchBinary({
                resourceType: ResourceTypeNames.coverage,
                resourceId: coverageId,
                patchOperations: processedCoverageOperations,
              });
              patchRequests.push(coveragePatch);
            }
          });
        }

        // Process RelatedPerson patches
        if (patchOperations?.relatedPersons && Object.keys(patchOperations?.relatedPersons).length > 0) {
          Object.entries(patchOperations?.relatedPersons || {}).forEach(([relatedPersonId, operations]) => {
            const relatedPersonPatch = getPatchBinary({
              resourceType: ResourceTypeNames.relatedPerson,
              resourceId: relatedPersonId,
              patchOperations: operations,
            });
            patchRequests.push(relatedPersonPatch);
          });
        }

        // Create POST requests for temporary insurances
        const postInsuranceRequests: BatchInputPostRequest<FhirResource>[] = tempInsurances.flatMap(
          ({ coverage, relatedPerson }) => [
            {
              method: 'POST',
              url: '/RelatedPerson',
              resource: relatedPerson,
            },
            {
              method: 'POST',
              url: '/Coverage',
              resource: coverage,
            },
          ]
        );

        const response = await oystehr.fhir.transaction({
          requests: [...patchRequests, ...postInsuranceRequests],
        });

        const updatedPatient = response.entry?.find(
          (entry) => entry.resource?.resourceType === ResourceTypeNames.patient && entry.resource?.id === patient.id
        )?.resource as Patient;

        const updatedCoverages = response.entry
          ?.filter((entry) => entry.resource?.resourceType === ResourceTypeNames.coverage)
          .map((entry) => entry.resource as Coverage)
          .filter((coverage) => coverage.status === 'active') as Coverage[];

        const updatedRelatedPersons = response.entry
          ?.filter((entry) => entry.resource?.resourceType === ResourceTypeNames.relatedPerson)
          .map((entry) => entry.resource) as RelatedPerson[];

        // Update store with all updated resources
        if (updatedPatient) setPatient(updatedPatient);
        if (updatedCoverages.length > 0) {
          const updatedInsuranceIds = updatedCoverages.map((coverage) => coverage.id);

          const mergedInsurances = insurances
            .map((insurance) =>
              updatedInsuranceIds.includes(insurance.id)
                ? updatedCoverages.find((updated) => updated.id === insurance.id)
                : insurance
            )
            .filter((insurance): insurance is Coverage => insurance !== undefined);

          const newInsurances = updatedCoverages.filter(
            (updated) => !insurances.some((existing) => existing.id === updated.id)
          );

          setInsurances([...mergedInsurances, ...newInsurances]);
        }

        if (updatedRelatedPersons.length > 0) {
          const updatedPolicyHolderIds = updatedRelatedPersons.map((relatedPerson) => relatedPerson.id);

          const mergedPolicyHolders = policyHolders
            .map((policyHolder) =>
              updatedPolicyHolderIds.includes(policyHolder.id)
                ? updatedRelatedPersons.find((updated) => updated.id === policyHolder.id)
                : policyHolder
            )
            .filter((policyHolder): policyHolder is RelatedPerson => policyHolder !== undefined);

          const newPolicyHolders = updatedRelatedPersons.filter(
            (updated) => !policyHolders.some((existing) => existing.id === updated.id)
          );

          setPolicyHolders([...mergedPolicyHolders, ...newPolicyHolders]);
        }
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
              value: 'insurance-payer-plan',
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
