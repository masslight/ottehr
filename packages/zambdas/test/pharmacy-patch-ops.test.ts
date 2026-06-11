import { Operation } from 'fast-json-patch';
import { Organization, Patient, QuestionnaireResponseItem } from 'fhir/r4b';
import { PHARMACY_COLLECTION_LINK_IDS, PREFERRED_PHARMACY_EXTENSION_URL } from 'utils';
import { describe, expect, it } from 'vitest';
import { createUpdatePharmacyPatchOps, PATIENT_CONTAINED_PHARMACY_ID } from '../src/ehr/shared/harvest';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'test-patient',
};

const placesItems: QuestionnaireResponseItem[] = [
  {
    linkId: PHARMACY_COLLECTION_LINK_IDS.placesId,
    answer: [
      {
        valueString: 'some-places-id',
      },
    ],
  },
  {
    linkId: PHARMACY_COLLECTION_LINK_IDS.placesName,
    answer: [
      {
        valueString: 'Walgreens',
      },
    ],
  },
  {
    linkId: PHARMACY_COLLECTION_LINK_IDS.placesAddress,
    answer: [
      {
        valueString: '123 Pineapple St, Brooklyn, NY 11201',
      },
    ],
  },
];

const placesPhoneItem: QuestionnaireResponseItem = {
  linkId: PHARMACY_COLLECTION_LINK_IDS.placesPhone,
  answer: [
    {
      valueString: '(555) 867-5309',
    },
  ],
};

const manualEntryItems: QuestionnaireResponseItem[] = [
  {
    linkId: 'pharmacy-page-manual-entry',
    answer: [
      {
        valueBoolean: true,
      },
    ],
  },
  {
    linkId: 'pharmacy-name',
    answer: [
      {
        valueString: 'Corner Drugs',
      },
    ],
  },
  {
    linkId: 'pharmacy-address',
    answer: [
      {
        valueString: '1 Main St',
      },
    ],
  },
];

const manualPhoneItem: QuestionnaireResponseItem = {
  linkId: 'pharmacy-phone',
  answer: [
    {
      valueString: '(555) 111-2222',
    },
  ],
};

const getContainedPharmacy = (ops: Operation[]): Organization | undefined => {
  const containedOp = ops.find((op) => op.path === '/contained' && (op.op === 'add' || op.op === 'replace'));
  if (!containedOp || !('value' in containedOp)) return undefined;
  return (containedOp.value as Organization[]).find((resource) => resource.id === PATIENT_CONTAINED_PHARMACY_ID);
};

describe('createUpdatePharmacyPatchOps phone handling', () => {
  it('writes the places phone to the contained Organization telecom', () => {
    const items = [...placesItems, placesPhoneItem];
    const pharmacy = getContainedPharmacy(createUpdatePharmacyPatchOps(patient, items));
    expect(pharmacy?.telecom).toEqual([
      {
        system: 'phone',
        value: '(555) 867-5309',
      },
    ]);
  });

  it('writes the manual phone to the contained Organization telecom', () => {
    const items = [...manualEntryItems, manualPhoneItem];
    const pharmacy = getContainedPharmacy(createUpdatePharmacyPatchOps(patient, items));
    expect(pharmacy?.telecom).toEqual([
      {
        system: 'phone',
        value: '(555) 111-2222',
      },
    ]);
  });

  it('prefers the manual phone when both are present', () => {
    const items = [...manualEntryItems, manualPhoneItem, placesPhoneItem];
    const pharmacy = getContainedPharmacy(createUpdatePharmacyPatchOps(patient, items));
    expect(pharmacy?.telecom?.[0]?.value).toBe('(555) 111-2222');
  });

  it('omits telecom when no phone is provided', () => {
    const pharmacy = getContainedPharmacy(createUpdatePharmacyPatchOps(patient, placesItems));
    expect(pharmacy).toBeDefined();
    expect(pharmacy?.telecom).toBeUndefined();
  });

  it('keeps a contained pharmacy and its reference for a phone-only response', () => {
    const patientWithPharmacy: Patient = {
      ...patient,
      contained: [
        {
          resourceType: 'Organization',
          id: PATIENT_CONTAINED_PHARMACY_ID,
          name: 'Walgreens',
        },
      ],
    };
    const ops = createUpdatePharmacyPatchOps(patientWithPharmacy, [placesPhoneItem]);
    expect(ops.find((op) => op.op === 'remove' && op.path === '/contained')).toBeUndefined();
    const pharmacy = getContainedPharmacy(ops);
    expect(pharmacy?.telecom?.[0]?.value).toBe('(555) 867-5309');

    const extensionOp = ops.find((op) => op.path === '/extension');
    expect(extensionOp && 'value' in extensionOp ? extensionOp.value : undefined).toContainEqual({
      url: PREFERRED_PHARMACY_EXTENSION_URL,
      valueReference: {
        reference: `#${PATIENT_CONTAINED_PHARMACY_ID}`,
      },
    });
  });
});
