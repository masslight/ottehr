import Oystehr, { BatchInputJSONPatchRequest } from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/visit-details/update-visit-details';

const GUARDIANS_URL = FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url;
const OTHER_EXTENSION = { url: 'https://example.com/other', valueString: 'kept' };

function makeInput(patient: Patient, authorizedNonLegalGuardians: string): Parameters<typeof performEffect>[0] {
  return {
    appointmentId: 'appointment-1',
    bookingDetails: { authorizedNonLegalGuardians },
    secrets: {},
    userToken: 'test-token',
    user: {
      id: 'user-1',
      name: 'Test User',
      email: null,
      phoneNumber: null,
      authenticationMethod: 'email',
      profile: 'Practitioner/practitioner-1',
    },
    patient,
    appointment: { resourceType: 'Appointment', id: 'appointment-1', status: 'arrived', participant: [] },
    encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'arrived', class: { code: 'AMB' } },
  };
}

async function patientRequests(
  patient: Patient,
  authorizedNonLegalGuardians: string
): Promise<BatchInputJSONPatchRequest[]> {
  const transaction = vi
    .fn<(input: { requests: BatchInputJSONPatchRequest[] }) => Promise<void>>()
    .mockResolvedValue(undefined);
  await performEffect(makeInput(patient, authorizedNonLegalGuardians), { fhir: { transaction } } as unknown as Oystehr);
  return transaction.mock.calls[0][0].requests.filter(({ url }) => url === '/Patient/patient-1');
}

const patientWithGuardians = (): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  extension: [OTHER_EXTENSION, { url: GUARDIANS_URL, valueString: 'Aunt May' }],
});

describe('update-visit-details authorized non-legal guardians', () => {
  it.each([' ', '   ', '\n\t'])('removes the stored guardians extension when the new value is %j', async (value) => {
    const requests = await patientRequests(patientWithGuardians(), value);
    expect(requests).toEqual([
      expect.objectContaining({ operations: [{ op: 'replace', path: '/extension', value: [OTHER_EXTENSION] }] }),
    ]);
  });

  it.each([' ', '   ', '\n\t'])('writes nothing when there are no guardians and the new value is %j', async (value) => {
    const requests = await patientRequests({ resourceType: 'Patient', id: 'patient-1' }, value);
    expect(requests).toEqual([]);
  });

  it('removes the stored guardians extension when the new value is empty', async () => {
    const requests = await patientRequests(patientWithGuardians(), '');
    expect(requests).toEqual([
      expect.objectContaining({ operations: [{ op: 'replace', path: '/extension', value: [OTHER_EXTENSION] }] }),
    ]);
  });

  it('replaces the stored guardians with the new non-blank value without surrounding whitespace', async () => {
    const requests = await patientRequests(patientWithGuardians(), '  Uncle Ben  ');
    expect(requests).toEqual([
      expect.objectContaining({
        operations: [
          {
            op: 'replace',
            path: '/extension',
            value: [OTHER_EXTENSION, { url: GUARDIANS_URL, valueString: 'Uncle Ben' }],
          },
        ],
      }),
    ]);
  });

  it('adds the guardians extension for a non-blank value on a patient without one', async () => {
    const requests = await patientRequests({ resourceType: 'Patient', id: 'patient-1' }, 'Uncle Ben');
    expect(requests).toEqual([
      expect.objectContaining({
        operations: [{ op: 'add', path: '/extension', value: [{ url: GUARDIANS_URL, valueString: 'Uncle Ben' }] }],
      }),
    ]);
  });
});
