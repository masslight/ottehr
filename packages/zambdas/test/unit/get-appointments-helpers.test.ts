import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { isResponseSizeExceededError } from 'utils/lib/fhir/responseSize';
import { isNonPaperworkQuestionnaireResponse } from 'utils/lib/helpers/paperwork/paperwork';
import { describe, expect, test } from 'vitest';
import {
  APPOINTMENT_SEARCH_ELEMENTS,
  APPOINTMENT_SEARCH_PAGE_SIZE,
  getAppointmentQueryInput,
  lambdaResultBytes,
  MAX_RESPONSE_BYTES,
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
        { name: '_include', value: 'Appointment:location' },
        { name: '_revinclude:iterate', value: 'Encounter:appointment' },
        { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
        { name: '_include', value: 'Appointment:actor' },
      ])
    );
    expect(queryInput.params).not.toContainEqual({ name: '_revinclude:iterate', value: 'DocumentReference:patient' });
  });

  // Appointment:actor puts a booked Practitioner in the result set, and iterating Encounter:participant from it
  // pulled in every Encounter that provider ever attended, plus their paperwork. One booking for a provider with
  // ~1000 encounters pushed a day's page past the FHIR response size cap, so the board refused that day with 4343.
  // The board's encounters come from Encounter:appointment, keyed by appointment, so the extra ones were never used.
  test("does not revinclude encounters by participant, which pulls in a booked provider's whole history", async () => {
    const queryInput = await getAppointmentQueryInput({
      oystehr: {} as Oystehr,
      resourceId: '550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'Location',
      searchDateFrom: '2026-10-07',
      searchDateTo: '2026-10-07',
      timezone: 'America/New_York',
    });

    expect(queryInput.params).not.toContainEqual({ name: '_revinclude:iterate', value: 'Encounter:participant' });
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

  // Lambda serializes the returned { statusCode, body }, so every quote in the JSON body is escaped once more. A body
  // that fits under the cap can still be refused, and a refused result reaches the EHR as {"status":500,"output":null}
  // instead of the 4343 that tells the user to narrow the range. So the guard has to measure the result, not the body.
  test('measures the response the way Lambda does, with the body escaped once more', () => {
    const body = JSON.stringify(Array.from({ length: 1_200_000 }, () => 'a'));

    expect(Buffer.byteLength(body)).toBeLessThan(MAX_RESPONSE_BYTES);
    expect(lambdaResultBytes({ statusCode: 200, body })).toBeGreaterThan(MAX_RESPONSE_BYTES);
  });

  test('keeps the guard below the 6 MiB Lambda response limit', () => {
    expect(MAX_RESPONSE_BYTES).toBeLessThan(6 * 1024 * 1024);
  });
});
