import { useEffect, useState } from 'react';
import { Appointment, Encounter, EncounterStatusHistory, Location, Patient, RelatedPerson, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { SearchParam } from '@zapehr/sdk';
import { getFirstName, getLastName, OTTEHR_MODULE } from 'ehr-utils';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { getVisitTypeLabelForAppointment } from '../types/types';
import { getVisitTotalTime } from '../helpers/visitDurationUtils';
import { useApiClients } from './useAppClients';

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
  dateTime: string | undefined;
  length: number;
};

export const useGetPatient = (
  id?: string,
): {
  loading: boolean;
  otherPatientsWithSameName: boolean;
  setOtherPatientsWithSameName: (value: boolean) => void;
  patient?: Patient;
  appointments?: AppointmentHistoryRow[];
  relatedPerson?: RelatedPerson;
} => {
  const { fhirClient } = useApiClients();
  const [loading, setLoading] = useState<boolean>(true);
  const [otherPatientsWithSameName, setOtherPatientsWithSameName] = useState<boolean>(false);
  const [patient, setPatient] = useState<Patient>();
  const [appointments, setAppointments] = useState<AppointmentHistoryRow[]>();
  const [relatedPerson, setRelatedPerson] = useState<RelatedPerson>();

  useEffect(() => {
    async function getPatient(): Promise<void> {
      if (!fhirClient || !id) {
        throw new Error('fhirClient or patient ID is not defined');
      }

      setLoading(true);
      const resourcesTemp = await fhirClient.searchResources<Resource>({
        resourceType: 'Patient',
        searchParams: [
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
      });

      const patientTemp: Patient = resourcesTemp.find((resource) => resource.resourceType === 'Patient') as Patient;
      const appointmentsTemp: Appointment[] = resourcesTemp.filter(
        (resource) =>
          resource.resourceType === 'Appointment' &&
          resource.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.UC || tag.code === OTTEHR_MODULE.TM),
      ) as Appointment[];
      const locations: Location[] = resourcesTemp.filter(
        (resource) => resource.resourceType === 'Location',
      ) as Location[];
      const relatedPersonTemp: RelatedPerson = resourcesTemp.find(
        (resource) => resource.resourceType === 'RelatedPerson',
      ) as RelatedPerson;
      const encounters: Encounter[] = resourcesTemp.filter(
        (resource) => resource.resourceType === 'Encounter',
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
      const otherPatientsWithSameNameTemp = await fhirClient.searchResources<Resource>({
        resourceType: 'Patient',
        searchParams: otherPatientParams,
      });

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
          dateTime: appointment.start,
          length: getTelemedLength(encounter?.statusHistory),
        };
      });

      setAppointments(appointmentRows);
      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
    }

    getPatient()
      .catch((error) => console.log(error))
      .finally(() => setLoading(false));
  }, [fhirClient, id]);

  return {
    loading,
    appointments,
    otherPatientsWithSameName,
    setOtherPatientsWithSameName,
    patient,
    relatedPerson,
  };
};
