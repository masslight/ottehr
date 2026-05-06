import { DocumentReference, FhirResource } from 'fhir/r4b';
import { Duration } from 'luxon';
import { BRANDING_CONFIG, PATIENT_PHOTO_CODE, replaceTemplateVariablesArrows, TEXTING_CONFIG } from 'utils';
import { AppointmentResources } from '../../shared/stores/appointment/appointment.store';

export const formatVideoTimerTime = (difference: Duration): string => {
  const m = Math.abs(difference.minutes);
  const s = Math.floor(Math.abs(difference.seconds));

  const addZero = (num: number): string => {
    return num < 10 ? `0${num}` : num.toString();
  };

  return `${m}:${addZero(s)}`;
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

export const getTelemedQuickTexts = (supportPhone: string): string[] => {
  const vars = {
    projectName: BRANDING_CONFIG.projectName,
    supportPhone,
  };

  return TEXTING_CONFIG.telemed.quickTexts.map((t) => replaceTemplateVariablesArrows(t, vars));
};
