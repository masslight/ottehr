import { Organization, Patient, Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  PHARMACY_COLLECTION_LINK_IDS,
  PREFERRED_PHARMACY_MANUAL_ENTRY_URL,
  PREFERRED_PHARMACY_PLACES_ID_URL,
} from '../../../main';
import { makePrepopulatedItemsFromPatientRecord } from '../prePopulation';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'test-patient',
};

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  item: [
    {
      linkId: 'preferred-pharmacy-section',
      type: 'group',
      item: [
        {
          linkId: PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection,
          type: 'group',
          item: [
            {
              linkId: PHARMACY_COLLECTION_LINK_IDS.placesId,
              type: 'string',
            },
            {
              linkId: PHARMACY_COLLECTION_LINK_IDS.placesName,
              type: 'string',
            },
            {
              linkId: PHARMACY_COLLECTION_LINK_IDS.placesAddress,
              type: 'string',
            },
            {
              linkId: PHARMACY_COLLECTION_LINK_IDS.placesPhone,
              type: 'string',
            },
          ],
        },
        {
          linkId: 'pharmacy-name',
          type: 'string',
        },
        {
          linkId: 'pharmacy-address',
          type: 'string',
        },
        {
          linkId: 'pharmacy-phone',
          type: 'string',
        },
      ],
    },
  ],
};

const makePharmacy = (extensionUrl: string): Organization => ({
  resourceType: 'Organization',
  id: 'pharmacy',
  name: 'Walgreens',
  address: [
    {
      text: '123 Pineapple St, Brooklyn, NY 11201',
    },
  ],
  telecom: [
    {
      system: 'phone',
      value: '(555) 867-5309',
    },
  ],
  extension: [
    extensionUrl === PREFERRED_PHARMACY_MANUAL_ENTRY_URL
      ? {
          url: extensionUrl,
          valueBoolean: true,
        }
      : {
          url: extensionUrl,
          valueString: 'some-places-id',
        },
  ],
});

const prePopulate = (pharmacy: Organization): QuestionnaireResponseItem[] => {
  const items = makePrepopulatedItemsFromPatientRecord({
    patient,
    questionnaire,
    pharmacy,
    coverages: {},
    insuranceOrgs: [],
    coverageChecks: [],
  });
  return items.find((i) => i.linkId === 'preferred-pharmacy-section')?.item ?? [];
};

const findAnswer = (items: QuestionnaireResponseItem[], linkId: string): string | undefined =>
  items.find((i) => i.linkId === linkId)?.answer?.[0]?.valueString;

describe('pharmacy phone prepopulation', () => {
  it('reads the telecom phone back into pharmacy-places-phone for a places pharmacy', () => {
    const sectionItems = prePopulate(makePharmacy(PREFERRED_PHARMACY_PLACES_ID_URL));
    const collectionItems =
      sectionItems.find((i) => i.linkId === PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection)?.item ?? [];
    expect(findAnswer(collectionItems, PHARMACY_COLLECTION_LINK_IDS.placesPhone)).toBe('(555) 867-5309');
    expect(findAnswer(sectionItems, 'pharmacy-phone')).toBeUndefined();
  });

  it('reads the telecom phone back into pharmacy-phone for a manually entered pharmacy', () => {
    const sectionItems = prePopulate(makePharmacy(PREFERRED_PHARMACY_MANUAL_ENTRY_URL));
    expect(findAnswer(sectionItems, 'pharmacy-phone')).toBe('(555) 867-5309');
    const collectionItems =
      sectionItems.find((i) => i.linkId === PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection)?.item ?? [];
    expect(findAnswer(collectionItems, PHARMACY_COLLECTION_LINK_IDS.placesPhone)).toBeUndefined();
  });

  it('omits the phone answers when the pharmacy has no telecom', () => {
    const pharmacy = makePharmacy(PREFERRED_PHARMACY_PLACES_ID_URL);
    delete pharmacy.telecom;
    const sectionItems = prePopulate(pharmacy);
    const collectionItems =
      sectionItems.find((i) => i.linkId === PHARMACY_COLLECTION_LINK_IDS.pharmacyCollection)?.item ?? [];
    expect(findAnswer(collectionItems, PHARMACY_COLLECTION_LINK_IDS.placesPhone)).toBeUndefined();
    expect(findAnswer(sectionItems, 'pharmacy-phone')).toBeUndefined();
  });
});
