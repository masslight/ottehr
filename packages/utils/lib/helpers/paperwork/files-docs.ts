import { Attachment } from 'fhir/r4b';
import {
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  InsuranceCardId,
  SwapPrimarySecondaryInsuranceCardId,
} from '../../types/data/paperwork/paperwork.constants';
import { getMimeType } from '../../utils/file';

export const addContentTypeToAttachment = (attachment: Attachment): Attachment => {
  if (attachment.contentType || !attachment.url) {
    return { ...attachment };
  }

  const contentType = getMimeType(attachment.url);

  return {
    ...attachment,
    contentType,
  };
};

export const swapPrimarySecondaryInsuranceCardId = ((id: InsuranceCardId): InsuranceCardId => {
  switch (id) {
    case INSURANCE_CARD_FRONT_ID:
      return INSURANCE_CARD_FRONT_2_ID;
    case INSURANCE_CARD_BACK_ID:
      return INSURANCE_CARD_BACK_2_ID;
    case INSURANCE_CARD_FRONT_2_ID:
      return INSURANCE_CARD_FRONT_ID;
    case INSURANCE_CARD_BACK_2_ID:
      return INSURANCE_CARD_BACK_ID;
  }
}) as SwapPrimarySecondaryInsuranceCardId;

export const isInsuranceCardId = (value: string | undefined): value is InsuranceCardId =>
  value === INSURANCE_CARD_FRONT_ID ||
  value === INSURANCE_CARD_BACK_ID ||
  value === INSURANCE_CARD_FRONT_2_ID ||
  value === INSURANCE_CARD_BACK_2_ID;

export const isPrimaryInsuranceCardId = (id: InsuranceCardId): boolean =>
  id === INSURANCE_CARD_FRONT_ID || id === INSURANCE_CARD_BACK_ID;
