import { QuestionnaireItem } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from 'utils/lib/fhir/constants';
import {
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_FRONT_ID,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_FRONT_ID,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { PHARMACY_COLLECTION_LINK_IDS } from 'utils/lib/types/data/search-places';

const KEYS = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS;

/**
 * A "developed field" is a pre-built questionnaire subtree (composite widget) that the builder inserts
 * as one unit — e.g. a pharmacy search or a photo-ID upload. Its linkIds are load-bearing: downstream
 * code (the paperwork engine, and the harvest pipeline in Part 2) keys on them, so they must be
 * inserted verbatim, kept stable (see ensureUniqueLinkIds), and used at most once per form.
 *
 * `items` are raw FHIR subtrees; the reducer runs each through fhirQuestionnaireItemToManaged on insert
 * to attach _keys and pull recognized extensions into typed fields.
 */
export interface DevelopedFieldTemplate {
  id: string;
  label: string;
  description: string;
  /** linkIds this template inserts; drives the ensureUniqueLinkIds exemption + single-use enforcement */
  reservedLinkIds: string[];
  items: QuestionnaireItem[];
}

const imageAttachment = (
  linkId: string,
  text: string,
  instructions: string,
  documentTypeCode: string
): QuestionnaireItem => ({
  linkId,
  type: 'attachment',
  text,
  extension: [
    { url: KEYS.dataType, valueString: 'Image' },
    { url: KEYS.attachmentText, valueString: instructions },
    { url: KEYS.documentType, valueString: documentTypeCode },
  ],
});

const PHARMACY_SEARCH: DevelopedFieldTemplate = {
  id: 'pharmacy-search',
  label: 'Pharmacy search',
  description: "Google Places pharmacy lookup that captures the patient's preferred pharmacy.",
  reservedLinkIds: [
    PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection,
    PHARMACY_COLLECTION_LINK_IDS.placesId,
    PHARMACY_COLLECTION_LINK_IDS.placesName,
    PHARMACY_COLLECTION_LINK_IDS.placesAddress,
    PHARMACY_COLLECTION_LINK_IDS.placesPhone,
    PHARMACY_COLLECTION_LINK_IDS.placesDataSaved,
    PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId,
  ],
  items: [
    {
      linkId: PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection,
      type: 'group',
      text: 'Preferred pharmacy',
      // group-type routes the engine to the <PharmacyCollection> search widget instead of a plain group
      extension: [{ url: KEYS.groupType, valueString: 'pharmacy-collection' }],
      item: [
        { linkId: PHARMACY_COLLECTION_LINK_IDS.placesId, type: 'string' },
        { linkId: PHARMACY_COLLECTION_LINK_IDS.placesName, type: 'string' },
        { linkId: PHARMACY_COLLECTION_LINK_IDS.placesAddress, type: 'string' },
        { linkId: PHARMACY_COLLECTION_LINK_IDS.placesPhone, type: 'string' },
        { linkId: PHARMACY_COLLECTION_LINK_IDS.placesDataSaved, type: 'boolean' },
        { linkId: PHARMACY_COLLECTION_LINK_IDS.erxPharmacyId, type: 'string' },
      ],
    },
  ],
};

const PHOTO_ID_UPLOAD: DevelopedFieldTemplate = {
  id: 'photo-id-upload',
  label: 'Photo ID upload',
  description: 'Front and back photo-ID image uploads.',
  reservedLinkIds: [PHOTO_ID_FRONT_ID, PHOTO_ID_BACK_ID],
  items: [
    imageAttachment(
      PHOTO_ID_FRONT_ID,
      'Photo ID (front)',
      'Take a picture of the **front side** of your Photo ID',
      PHOTO_ID_CARD_CODE
    ),
    imageAttachment(
      PHOTO_ID_BACK_ID,
      'Photo ID (back)',
      'Take a picture of the **back side** of your Photo ID',
      PHOTO_ID_CARD_CODE
    ),
  ],
};

const INSURANCE_CARD_UPLOAD: DevelopedFieldTemplate = {
  id: 'insurance-card-upload',
  label: 'Insurance card upload',
  description: 'Front and back insurance-card image uploads.',
  reservedLinkIds: [INSURANCE_CARD_FRONT_ID, INSURANCE_CARD_BACK_ID],
  items: [
    imageAttachment(
      INSURANCE_CARD_FRONT_ID,
      'Insurance card (front)',
      'Take a picture of the **front side** of your insurance card',
      INSURANCE_CARD_CODE
    ),
    imageAttachment(
      INSURANCE_CARD_BACK_ID,
      'Insurance card (back)',
      'Take a picture of the **back side** of your insurance card',
      INSURANCE_CARD_CODE
    ),
  ],
};

export const DEVELOPED_FIELD_TEMPLATES: DevelopedFieldTemplate[] = [
  PHARMACY_SEARCH,
  PHOTO_ID_UPLOAD,
  INSURANCE_CARD_UPLOAD,
];

/** Every linkId owned by a developed-field template — exempt from linkId auto-rewrite so it stays stable. */
export const RESERVED_DEVELOPED_FIELD_LINK_IDS: ReadonlySet<string> = new Set(
  DEVELOPED_FIELD_TEMPLATES.flatMap((t) => t.reservedLinkIds)
);
