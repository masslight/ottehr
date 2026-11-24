import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Person, RelatedPerson } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));

import { performEffect } from '../../src/ehr/get-chat-data';
import { buildSmsRecipients } from '../../src/shared/chat-recipients';

const PATIENT_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';
const SIBLING_ID = '7b1c4a2e-0d3f-4c5b-8e6a-1f2d3c4b5a69';
const ENCOUNTER_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const secrets = {};

const userRelationship = {
  coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }],
};

const relatedPerson = (id: string, patientId: string, smsNumber?: string): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  id,
  patient: { reference: `Patient/${patientId}` },
  relationship: [userRelationship],
  telecom: smsNumber ? [{ system: 'sms', value: smsNumber }] : [],
});

const person = (phone: string, ...rpIds: string[]): Person => ({
  resourceType: 'Person',
  id: `person-${phone}`,
  telecom: [{ system: 'phone', value: phone }],
  link: rpIds.map((id) => ({ target: { reference: `RelatedPerson/${id}` } })),
});

const search = vi.fn();
const oystehr = { fhir: { search } } as unknown as Oystehr;

const mockSearches = (byResourceType: { RelatedPerson?: unknown[]; Encounter?: unknown[] }): void => {
  search.mockImplementation(async ({ resourceType }: { resourceType: 'RelatedPerson' | 'Encounter' }) => ({
    unbundle: () => byResourceType[resourceType] ?? [],
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('get-chat-data recipients', () => {
  it("returns one recipient per user RelatedPerson, using the RelatedPerson's own SMS number", async () => {
    mockSearches({ RelatedPerson: [relatedPerson('rp1', PATIENT_ID, '+15550000001'), person('+15550000002', 'rp1')] });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, secrets });

    // the send reaches the RelatedPerson's own number, so the linked Person's different phone is not a second send
    expect(result.recipients).toEqual([{ recipientResourceUri: 'RelatedPerson/rp1', smsNumber: '+15550000001' }]);
  });

  it("uses a linked Person's phone when the RelatedPerson has no SMS number of its own", async () => {
    mockSearches({ RelatedPerson: [relatedPerson('rp1', PATIENT_ID), person('+15550000002', 'rp1')] });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, secrets });

    expect(result.recipients).toEqual([{ recipientResourceUri: 'RelatedPerson/rp1', smsNumber: '+15550000002' }]);
  });

  it("ignores a Person's links to a sibling's RelatedPerson that share the same login phone", async () => {
    mockSearches({
      RelatedPerson: [
        relatedPerson('rp1', PATIENT_ID),
        relatedPerson('rp-sibling', SIBLING_ID),
        person('+15550000003', 'rp1', 'rp-sibling'),
      ],
    });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, secrets });

    expect(result.recipients).toEqual([{ recipientResourceUri: 'RelatedPerson/rp1', smsNumber: '+15550000003' }]);
  });

  it('does not duplicate a recipient when the RelatedPerson and a Person share a number', async () => {
    mockSearches({ RelatedPerson: [relatedPerson('rp1', PATIENT_ID, '+15550000001'), person('+15550000001', 'rp1')] });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, secrets });

    expect(result.recipients).toHaveLength(1);
  });

  it('returns no recipients when no number is known', async () => {
    mockSearches({ RelatedPerson: [relatedPerson('rp1', PATIENT_ID)] });

    expect((await performEffect(oystehr, { patientId: PATIENT_ID, secrets })).recipients).toEqual([]);
  });
});

describe('get-chat-data visit', () => {
  const location: Location = {
    resourceType: 'Location',
    id: 'loc1',
    name: 'Downtown',
    telecom: [{ system: 'phone', value: '5551234567' }],
    extension: [
      { url: LOCATION_SUPPORT_PHONE_EXTENSION_URL, valueString: '(555) 000-1111' },
      { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
    ],
  };
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: 'appt1',
    status: 'booked',
    start: '2026-11-20T15:30:00.000Z',
    participant: [],
  };
  const encounterOf = (patientId: string): Encounter => ({
    resourceType: 'Encounter',
    id: ENCOUNTER_ID,
    status: 'finished',
    class: { code: 'AMB' },
    subject: { reference: `Patient/${patientId}` },
  });

  it("returns the office details of the patient's encounter", async () => {
    mockSearches({ Encounter: [encounterOf(PATIENT_ID), location, appointment] });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, encounterId: ENCOUNTER_ID, secrets });

    expect(result.visit).toEqual({
      // 15:30Z is 10:30 AM in New York, whatever zone this test runs in
      bookingTime: '10:30 AM',
      locationName: 'Downtown',
      locationReviewLink: undefined,
      officePhone: '(555) 123-4567',
      supportPhone: '(555) 000-1111',
    });
  });

  it('leaves the booking time out when the location has no timezone rather than guessing one', async () => {
    const noTimezone = { ...location, extension: [] };
    mockSearches({ Encounter: [encounterOf(PATIENT_ID), noTimezone, appointment] });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, encounterId: ENCOUNTER_ID, secrets });

    expect(result.visit?.bookingTime).toBeUndefined();
  });

  it("returns no visit data for another patient's encounter", async () => {
    mockSearches({ Encounter: [encounterOf(SIBLING_ID), location, appointment] });

    const result = await performEffect(oystehr, { patientId: PATIENT_ID, encounterId: ENCOUNTER_ID, secrets });

    expect(result.visit).toBeUndefined();
  });

  it('does not search encounters when none is named', async () => {
    mockSearches({});

    await performEffect(oystehr, { patientId: PATIENT_ID, secrets });

    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('buildSmsRecipients', () => {
  it("only uses the given RelatedPersons' phones", () => {
    const recipients = buildSmsRecipients([relatedPerson('rp1', PATIENT_ID)], {
      'RelatedPerson/rp1': new Set(['+15550000001']),
      'RelatedPerson/rp-sibling': new Set(['+15550000001']),
    });

    expect(recipients).toEqual([{ recipientResourceUri: 'RelatedPerson/rp1', smsNumber: '+15550000001' }]);
  });
});
