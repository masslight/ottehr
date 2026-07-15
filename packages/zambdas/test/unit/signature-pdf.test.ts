import { Practitioner, Provenance } from 'fhir/r4b';
import { PARTICIPATION_CODE_SYSTEM } from 'utils';
import { describe, expect, test } from 'vitest';
import { getEncounterSignatures } from '../../src/shared/pdf/get-encounter-signatures';
import { composeSignature } from '../../src/shared/pdf/sections/visit-note/signature';
import { ProgressNoteSignatures, VisitDetailsForProgressNote } from '../../src/shared/pdf/types';
import { FullAppointmentResourcePackage } from '../../src/shared/pdf/visit-details-pdf/types';

const appointmentPackage = { timezone: 'America/New_York' } as unknown as FullAppointmentResourcePackage;

const initialVisit: VisitDetailsForProgressNote = {
  visitType: 'initial',
  provider: 'Attending, Doc | MD',
  dateOfService: '',
  reasonForVisit: '',
  signedOn: '',
  visitID: '',
  visitState: '',
  address: '',
};

describe('composeSignature', () => {
  test('signs with the author Provenance signer + its recorded time', () => {
    const signatures: ProgressNoteSignatures = {
      signedBy: { name: 'Resident, Ray | MD', dateTimeISO: '2026-06-07T15:30:00.000Z' }, // 11:30 AM EDT
    };

    const { signedBy, approvedBy } = composeSignature({ appointmentPackage, visit: initialVisit, signatures });

    expect(signedBy).toBe('Signed electronically by Resident, Ray | MD on 6/7/2026, 11:30 AM (EDT)');
    expect(approvedBy).toBeUndefined();
  });

  test('adds the approval line from the verifier Provenance', () => {
    const signatures: ProgressNoteSignatures = {
      signedBy: { name: 'Resident, Ray | MD', dateTimeISO: '2026-06-07T15:30:00.000Z' },
      approvedBy: { name: 'Supervisor, Sue | MD', dateTimeISO: '2026-06-07T17:45:00.000Z' }, // 1:45 PM EDT
    };

    const { signedBy, approvedBy } = composeSignature({ appointmentPackage, visit: initialVisit, signatures });

    expect(signedBy).toBe('Signed electronically by Resident, Ray | MD on 6/7/2026, 11:30 AM (EDT)');
    expect(approvedBy).toBe('Approved by Supervisor, Sue | MD on 6/7/2026, 1:45 PM (EDT)');
  });

  test('falls back to the attending provider when no author Provenance exists (non-supervisor flow)', () => {
    const { signedBy, approvedBy } = composeSignature({
      appointmentPackage,
      visit: initialVisit,
      signatures: undefined,
    });

    // Time is the current generation time, so just assert the signer/prefix.
    expect(signedBy).toMatch(/^Signed electronically by Attending, Doc \| MD on /);
    expect(approvedBy).toBeUndefined();
  });

  test('uses the follow-up provider name for follow-up visits', () => {
    const followupVisit: VisitDetailsForProgressNote = {
      visitType: 'followup',
      provider: { practitionerId: 'p1', name: 'Followup, Fay | MD' },
    };

    const { signedBy } = composeSignature({ appointmentPackage, visit: followupVisit, signatures: undefined });

    expect(signedBy).toMatch(/^Signed electronically by Followup, Fay \| MD on /);
  });
});

describe('getEncounterSignatures', () => {
  const practitioner = (id: string, given: string, family: string, suffix: string): Practitioner => ({
    resourceType: 'Practitioner',
    id,
    name: [{ given: [given], family, suffix: [suffix] }],
  });

  const provenance = (role: 'author' | 'verifier', practitionerId: string, recorded: string): Provenance => ({
    resourceType: 'Provenance',
    target: [{ reference: 'Encounter/enc-1' }],
    recorded,
    agent: [
      {
        role: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: role, display: role }] }],
        who: { reference: `Practitioner/${practitionerId}` },
      },
    ],
  });

  const mockOystehr = (resources: (Provenance | Practitioner)[]): any => ({
    fhir: {
      search: async () => ({ unbundle: () => resources }),
    },
  });

  test('resolves both signer (author) and approver (verifier) with names + recorded times', async () => {
    const result = await getEncounterSignatures(
      mockOystehr([
        provenance('author', 'res-1', '2026-06-07T15:30:00.000Z'),
        provenance('verifier', 'sup-1', '2026-06-07T17:45:00.000Z'),
        practitioner('res-1', 'Ray', 'Resident', 'MD'),
        practitioner('sup-1', 'Sue', 'Supervisor', 'MD'),
      ]),
      'enc-1'
    );

    expect(result.signedBy).toEqual({ name: 'Resident, Ray | MD', dateTimeISO: '2026-06-07T15:30:00.000Z' });
    expect(result.approvedBy).toEqual({ name: 'Supervisor, Sue | MD', dateTimeISO: '2026-06-07T17:45:00.000Z' });
  });

  test('returns only signedBy when no verifier Provenance exists', async () => {
    const result = await getEncounterSignatures(
      mockOystehr([
        provenance('author', 'res-1', '2026-06-07T15:30:00.000Z'),
        practitioner('res-1', 'Ray', 'Resident', 'MD'),
      ]),
      'enc-1'
    );

    expect(result.signedBy?.name).toBe('Resident, Ray | MD');
    expect(result.approvedBy).toBeUndefined();
  });

  test('picks the most recently recorded Provenance for a role', async () => {
    const result = await getEncounterSignatures(
      mockOystehr([
        provenance('author', 'res-1', '2026-06-07T15:30:00.000Z'),
        provenance('author', 'res-2', '2026-06-07T16:30:00.000Z'), // later → wins
        practitioner('res-1', 'Ray', 'Resident', 'MD'),
        practitioner('res-2', 'Rob', 'Resident', 'DO'),
      ]),
      'enc-1'
    );

    expect(result.signedBy).toEqual({ name: 'Resident, Rob | DO', dateTimeISO: '2026-06-07T16:30:00.000Z' });
  });

  test('returns an empty object when there are no provenances', async () => {
    const result = await getEncounterSignatures(mockOystehr([]), 'enc-1');
    expect(result).toEqual({ signedBy: undefined, approvedBy: undefined });
  });
});
