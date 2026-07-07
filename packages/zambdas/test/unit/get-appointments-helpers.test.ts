import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { isNonPaperworkQuestionnaireResponse } from 'utils';
import { describe, expect, test } from 'vitest';
import {
  APPOINTMENT_SEARCH_ELEMENTS,
  APPOINTMENT_SEARCH_PAGE_SIZE,
  getAppointmentQueryInput,
  isResponseSizeExceededError,
} from '../../src/ehr/get-appointments/helpers';

describe('get-appointments helpers', () => {
  test('uses smaller page size and type-scoped elements for appointment search', async () => {
    const queryInput = await getAppointmentQueryInput({
      oystehr: {} as Oystehr,
      resourceId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'Location',
      searchDateFrom: '2026-06-01',
      searchDateTo: '2026-06-01',
      timezone: 'America/New_York',
    });

    expect(queryInput.params).toContainEqual({ name: '_count', value: `${APPOINTMENT_SEARCH_PAGE_SIZE}` });
    expect(APPOINTMENT_SEARCH_PAGE_SIZE).toBe(100);
    expect(queryInput.params).toContainEqual({ name: '_elements', value: APPOINTMENT_SEARCH_ELEMENTS });
  });

  test('preserves required tracking-board appointment includes and revincludes', async () => {
    const queryInput = await getAppointmentQueryInput({
      oystehr: {} as Oystehr,
      resourceId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'Location',
      searchDateFrom: '2026-06-01',
      searchDateTo: '2026-06-01',
      timezone: 'America/New_York',
    });

    expect(queryInput.params).toEqual(
      expect.arrayContaining([
        { name: '_include', value: 'Appointment:patient' },
        { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
        { name: '_revinclude:iterate', value: 'Person:link' },
        { name: '_revinclude:iterate', value: 'Encounter:participant' },
        { name: '_include', value: 'Appointment:location' },
        { name: '_revinclude:iterate', value: 'Encounter:appointment' },
        { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
        { name: '_include', value: 'Appointment:actor' },
      ])
    );
    expect(queryInput.params).not.toContainEqual({ name: '_revinclude:iterate', value: 'DocumentReference:patient' });
  });

  // isNonPaperworkQuestionnaireResponse (index.ts) reads QuestionnaireResponse.questionnaire; if _elements
  // strips it, every QR is misclassified as non-paperwork and dropped from the tracking board.
  test('keeps QuestionnaireResponse.questionnaire so paperwork QRs survive the bundle filter', () => {
    expect(APPOINTMENT_SEARCH_ELEMENTS.split(',')).toContain('QuestionnaireResponse.questionnaire');

    const paperworkQR: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      questionnaire: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.0',
    };
    expect(isNonPaperworkQuestionnaireResponse(paperworkQR)).toBe(false);

    // A QR with questionnaire stripped (as _elements would do if the field were missing from the
    // list) is misclassified as non-paperwork — this is the failure mode the element entry guards.
    const strippedQR: QuestionnaireResponse = { resourceType: 'QuestionnaireResponse', status: 'completed' };
    expect(isNonPaperworkQuestionnaireResponse(strippedQR)).toBe(true);
  });

  test('recognizes the Oystehr response-size-exceeded error', () => {
    expect(
      isResponseSizeExceededError(
        new Error(
          'An internal response size (8,388,981) exceeds the maximum allowed size (6,291,456).  Please refine your search.'
        )
      )
    ).toBe(true);

    expect(isResponseSizeExceededError(new Error('Some other FHIR error'))).toBe(false);
    expect(isResponseSizeExceededError(undefined)).toBe(false);
    expect(isResponseSizeExceededError('string error')).toBe(false);
  });
});
