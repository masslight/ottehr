import { DocumentReference } from 'fhir/r4b';
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

export interface PatientConditionPhotoRef {
  url: string;
  documentRefId: string;
}

export const extractPatientConditionPhotoRefsFromAppointmentData = (
  appointment: AppointmentResources[]
): PatientConditionPhotoRef[] => {
  if (!appointment) return [];
  const result: PatientConditionPhotoRef[] = [];
  for (const resource of appointment) {
    if (
      resource.resourceType !== 'DocumentReference' ||
      resource.status !== 'current' ||
      resource.type?.coding?.[0].code !== PATIENT_PHOTO_CODE
    ) {
      continue;
    }
    const docRef = resource as DocumentReference;
    if (!docRef.id) continue;
    for (const cnt of docRef.content) {
      if (cnt.attachment.url) {
        result.push({ url: cnt.attachment.url, documentRefId: docRef.id });
      }
    }
  }
  return result;
};

export const getTelemedQuickTexts = (supportPhone: string): string[] => {
  const vars = {
    projectName: BRANDING_CONFIG.projectName,
    supportPhone,
  };

  return TEXTING_CONFIG.telemed.quickTexts.map((t) => replaceTemplateVariablesArrows(t, vars));
};
