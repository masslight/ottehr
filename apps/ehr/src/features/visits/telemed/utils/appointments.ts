import { Appointment, DocumentReference, Encounter, FhirResource } from 'fhir/r4b';
import { Duration } from 'luxon';
import {
  BRANDING_CONFIG,
  GetTelemedAppointmentsInput,
  getTelemedVisitStatus,
  PATIENT_PHOTO_CODE,
  RefreshableAppointmentData,
  replaceTemplateVariablesArrows,
  ReviewAndSignData,
  TelemedAppointmentStatusEnum,
  TEXTING_CONFIG,
} from 'utils';
import { AppointmentResources } from '../../shared/stores/appointment/appointment.store';

export const formatVideoTimerTime = (difference: Duration): string => {
  const m = Math.abs(difference.minutes);
  const s = Math.floor(Math.abs(difference.seconds));

  const addZero = (num: number): string => {
    return num < 10 ? `0${num}` : num.toString();
  };

  return `${m}:${addZero(s)}`;
};

export const createRefreshableAppointmentData = (originalData: AppointmentResources[]): RefreshableAppointmentData => {
  const photoUrls = extractPhotoUrlsFromAppointmentData(originalData);
  return { patientConditionPhotoUrls: photoUrls };
};

export const extractPhotoUrlsFromAppointmentData = (appointment: AppointmentResources[]): string[] => {
  return (
    (appointment
      ?.filter(
        (resource: FhirResource) =>
          resource.resourceType === 'DocumentReference' &&
          resource.status === 'current' &&
          resource.type?.coding?.[0].code === PATIENT_PHOTO_CODE
      )
      .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
      .filter(Boolean) as string[]) || []
  );
};

const findMainAppointment = (appointments: Appointment[], encounters: Encounter[]): Appointment | undefined => {
  return (
    appointments.find((apt) =>
      encounters.some((enc) => !enc.partOf && enc.appointment?.some((ref) => ref.reference === `Appointment/${apt.id}`))
    ) ?? appointments[0]
  );
};

export const extractReviewAndSignAppointmentData = (
  data: AppointmentResources[],
  context?: { appointmentId?: string; encounterId?: string }
): ReviewAndSignData | undefined => {
  const appointments = data.filter(
    (resource: FhirResource) => resource.resourceType === 'Appointment'
  ) as Appointment[];
  const encounters = data.filter((resource: FhirResource) => resource.resourceType === 'Encounter') as Encounter[];
  const appointment = context?.appointmentId
    ? appointments.find((resource) => resource.id === context.appointmentId)
    : findMainAppointment(appointments, encounters);

  if (!appointment) {
    return;
  }

  const appointmentStatus = appointment.status;

  const encounter = context?.encounterId
    ? encounters.find((resource) => resource.id === context.encounterId)
    : encounters.find(
        (resource) =>
          resource.appointment?.some((appointmentRef) => appointmentRef.reference === `Appointment/${appointment.id}`)
      ) ?? encounters[0];

  if (!encounter) {
    return;
  }

  const encounterStatusHistory = encounter.statusHistory ?? [];
  const finishedHistoryEntry = encounterStatusHistory.find((historyElement) => historyElement.status === 'finished');
  const finishedAtTime = finishedHistoryEntry?.period?.end;
  const encounterStatus = finishedHistoryEntry?.status;
  if (!encounterStatus) {
    return;
  }

  const telemedAppointmentStatus = getTelemedVisitStatus(encounterStatus, appointmentStatus);

  return telemedAppointmentStatus === TelemedAppointmentStatusEnum.complete
    ? { signedOnDate: finishedAtTime }
    : undefined;
};

export type GetAppointmentsRequestParams = Pick<
  GetTelemedAppointmentsInput,
  | 'appointmentId'
  | 'usStatesFilter'
  | 'providersFilter'
  | 'dateFilter'
  | 'timeZone'
  | 'groupsFilter'
  | 'patientFilter'
  | 'statusesFilter'
  | 'locationsIdsFilter'
  | 'visitTypesFilter'
>;

export const getTelemedQuickTexts = (supportPhone: string): string[] => {
  const vars = {
    projectName: BRANDING_CONFIG.projectName,
    supportPhone,
  };

  return TEXTING_CONFIG.telemed.quickTexts.map((t) => replaceTemplateVariablesArrows(t, vars));
};
