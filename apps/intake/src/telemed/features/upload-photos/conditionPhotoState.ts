import { Attachment } from 'fhir/r4b';
import { UCGetPaperworkResponse } from 'utils/lib/types/data/paperwork/paperwork.types';

export interface ConditionPhotoState {
  hasConditionStep: boolean;
  attachment?: Attachment;
  documentReferenceId?: string;
}

const PATIENT_CONDITION_PAGE_LINK_ID = 'patient-condition-page';
const PATIENT_PHOTOS_LINK_ID = 'patient-photos';

export const resolveConditionPhotoState = (data: UCGetPaperworkResponse): ConditionPhotoState => {
  const hasConditionStep = (data.allItems ?? []).some((item) => item.linkId === PATIENT_CONDITION_PAGE_LINK_ID);

  if (hasConditionStep) {
    const attachment = data.questionnaireResponse?.item
      ?.find((item) => item.linkId === PATIENT_CONDITION_PAGE_LINK_ID)
      ?.item?.find((item) => item.linkId === PATIENT_PHOTOS_LINK_ID)?.answer?.[0]?.valueAttachment;
    return { hasConditionStep, attachment };
  }

  const photo = data.patientConditionPhotos?.[0];
  return {
    hasConditionStep,
    attachment: photo ? { url: photo.url, title: photo.title } : undefined,
    documentReferenceId: photo?.documentReferenceId,
  };
};
