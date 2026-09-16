/**
 * @vitest-environment node
 */

import { QuestionnaireResponse } from 'fhir/r4b';
import { PhotoIdExtractionFields } from 'utils/lib/types/data/documents';
import { describe, expect, it } from 'vitest';
import { photoIdBelongsToPatient, readConsentSignerRelationship, withoutPhotoIdName } from './usePhotoIdExtraction';

const makeFields = (overrides: Partial<PhotoIdExtractionFields> = {}): PhotoIdExtractionFields => ({
  firstName: 'Jane',
  middleName: 'Q',
  lastName: 'Doe',
  suffix: 'Jr',
  dateOfBirth: '1985-04-02',
  sex: 'Female',
  addressLine1: '1 Main St',
  addressLine2: 'Apt 2',
  addressCity: 'Boston',
  addressState: 'MA',
  addressZip: '02110',
  licenseNumber: 'S1234567',
  expirationDate: '2030-04-02',
  ...overrides,
});

/** Paperwork nests the consent items a page deep, the way a real intake response does. */
const makePaperwork = (
  relationship: string | undefined,
  lastUpdated = '2026-09-16T12:00:00.000Z'
): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  status: 'in-progress',
  meta: { lastUpdated },
  item: [
    {
      linkId: 'consent-forms-page',
      item: [
        { linkId: 'full-name', answer: [{ valueString: 'Jane Doe' }] },
        ...(relationship === undefined
          ? []
          : [{ linkId: 'consent-form-signer-relationship', answer: [{ valueString: relationship }] }]),
      ],
    },
  ],
});

describe('readConsentSignerRelationship', () => {
  it('reads the answer out of a nested paperwork response', () => {
    expect(readConsentSignerRelationship([makePaperwork('Parent')])).toBe('Parent');
  });

  it('returns undefined when no response has been given', () => {
    expect(readConsentSignerRelationship([])).toBeUndefined();
    expect(readConsentSignerRelationship([makePaperwork(undefined)])).toBeUndefined();
  });

  it('skips responses that have the item but no answer yet, e.g. paperwork in progress', () => {
    const unanswered: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: [{ linkId: 'consent-forms-page', item: [{ linkId: 'consent-form-signer-relationship' }] }],
    };
    expect(readConsentSignerRelationship([unanswered, makePaperwork('Legal Guardian')])).toBe('Legal Guardian');
  });

  it('takes the newest answer, ignoring what older paperwork said', () => {
    const newestFirst = [
      makePaperwork('Self', '2026-09-16T12:00:00.000Z'),
      makePaperwork('Parent', '2025-01-01T12:00:00.000Z'),
    ];
    expect(readConsentSignerRelationship(newestFirst)).toBe('Self');
  });

  it('ignores non-paperwork responses, which never carry the item', () => {
    const labOrderResponse: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [{ linkId: 'fasting-status', answer: [{ valueString: 'Fasting' }] }],
    };
    expect(readConsentSignerRelationship([labOrderResponse, makePaperwork('Spouse')])).toBe('Spouse');
  });
});

describe('photoIdBelongsToPatient', () => {
  it('is true when the patient signed their own consent', () => {
    expect(photoIdBelongsToPatient('Self')).toBe(true);
    expect(photoIdBelongsToPatient(' self ')).toBe(true);
  });

  it('is true when no relationship has been recorded yet', () => {
    expect(photoIdBelongsToPatient(undefined)).toBe(true);
  });

  it('is false for every other signer', () => {
    for (const relationship of ['Parent', 'Legal Guardian', 'Spouse', 'Other']) {
      expect(photoIdBelongsToPatient(relationship)).toBe(false);
    }
  });
});

describe('withoutPhotoIdName', () => {
  it('drops only the name, leaving address and the rest suggestible', () => {
    expect(withoutPhotoIdName(makeFields())).toEqual(makeFields({ firstName: null, middleName: null, lastName: null }));
  });

  it('passes null through', () => {
    expect(withoutPhotoIdName(null)).toBeNull();
  });
});
