import { QuestionnaireResponseItem } from 'fhir/r4b';
import { PHARMACY_COLLECTION_LINK_IDS } from 'utils';

type PharmacyCollectionAnswerSetInput = {
  placesId: string;
  placesName: string;
  placesAddress: string;
  erxPharmacyId: string | undefined;
};

export const makePharmacyCollectionAnswerSet = ({
  placesId,
  placesName,
  placesAddress,
  erxPharmacyId,
}: PharmacyCollectionAnswerSetInput): QuestionnaireResponseItem[] => {
  const answerSet = [
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesId,
      answer: [{ valueString: placesId }],
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesName,
      answer: [{ valueString: placesName }],
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesAddress,
      answer: [{ valueString: placesAddress }],
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesDataSaved,
      answer: [{ valueBoolean: true }],
    },
  ];

  if (erxPharmacyId) {
    answerSet.push({
      linkId: PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId,
      answer: [{ valueString: erxPharmacyId }],
    });
  }

  return answerSet;
};

export const clearPharmacyCollectionAnswerSet = (): QuestionnaireResponseItem[] => {
  return [
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesId,
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesName,
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesAddress,
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.placesDataSaved,
    },
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId,
    },
  ];
};
