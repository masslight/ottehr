import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/create-patient';

const createUserResourcesForPatient = vi.hoisted(() => vi.fn());
vi.mock('utils/lib/fhir/patient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/fhir/patient')>()),
  createUserResourcesForPatient,
}));

const input = {
  patient: {
    firstName: 'Example',
    middleName: 'Q',
    lastName: 'Patient',
    dateOfBirth: '2015-04-12',
    sex: 'female' as const,
    phoneNumber: '(202) 555-0143',
  },
  secrets: null,
};

const mockOystehr = (): {
  oystehr: any;
  transaction: ReturnType<typeof vi.fn>;
  friendlyId: ReturnType<typeof vi.fn>;
} => {
  const transaction = vi.fn().mockImplementation(async ({ requests }) => ({
    entry: requests.map((request: any, index: number) => ({
      resource: request.resource && {
        ...request.resource,
        id: request.resource.resourceType === 'Patient' ? 'patient-1' : `other-${index}`,
      },
    })),
  }));
  const friendlyId = vi.fn().mockResolvedValue({});
  const search = vi.fn().mockResolvedValue({ unbundle: () => [{ resourceType: 'RelatedPerson', id: 'rp-1' }] });
  return { oystehr: { fhir: { transaction, search, generateFriendlyPatientId: friendlyId } }, transaction, friendlyId };
};

describe('create-patient performEffect', () => {
  beforeEach(() => {
    createUserResourcesForPatient.mockReset().mockResolvedValue({});
  });

  it('creates the patient, its document folders and a billing account in one transaction, and no visit', async () => {
    const { oystehr, transaction } = mockOystehr();
    const result = await performEffect(input as any, oystehr);

    expect(result).toEqual({ patientId: 'patient-1' });
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    const types = requests.map((request: any) => request.resource.resourceType);
    expect(types.filter((type: string) => type === 'Patient')).toHaveLength(1);
    expect(types).toContain('List');
    expect(types.filter((type: string) => type === 'Account')).toHaveLength(1);
    expect(types).not.toContain('Appointment');
    expect(types).not.toContain('Encounter');
    expect(types).not.toContain('Task');

    const patientRequest = requests.find((request: any) => request.resource.resourceType === 'Patient');
    expect(patientRequest.resource).toMatchObject({
      name: [{ given: ['Example', 'Q'], family: 'Patient' }],
      birthDate: '2015-04-12',
      gender: 'female',
      telecom: [{ system: 'phone', value: '+12025550143' }],
    });
    const account = requests.find((request: any) => request.resource.resourceType === 'Account').resource;
    expect(account.subject).toEqual([{ reference: patientRequest.fullUrl }]);
  });

  it('links the patient to the account holder for the normalized phone number and assigns a friendly id', async () => {
    const { oystehr, friendlyId } = mockOystehr();
    await performEffect(input as any, oystehr);

    expect(createUserResourcesForPatient).toHaveBeenCalledWith(oystehr, 'patient-1', '+12025550143');
    expect(friendlyId).toHaveBeenCalledWith({ id: 'patient-1' });
  });

  it('still succeeds when the friendly id cannot be generated', async () => {
    const { oystehr, friendlyId } = mockOystehr();
    friendlyId.mockRejectedValue(new Error('unavailable'));

    await expect(performEffect(input as any, oystehr)).resolves.toEqual({ patientId: 'patient-1' });
  });

  it('removes what it created when the account holder cannot be linked, so a retry starts clean', async () => {
    const { oystehr, transaction } = mockOystehr();
    createUserResourcesForPatient.mockRejectedValue(new Error('no person'));

    await expect(performEffect(input as any, oystehr)).rejects.toThrow('no person');

    expect(transaction).toHaveBeenCalledTimes(2);
    const created = transaction.mock.calls[0][0].requests.length;
    const deletes = transaction.mock.calls[1][0].requests;
    expect(deletes.every((request: any) => request.method === 'DELETE')).toBe(true);
    expect(deletes.map((request: any) => request.url)).toEqual(
      expect.arrayContaining(['/Patient/patient-1', '/RelatedPerson/rp-1'])
    );
    expect(deletes).toHaveLength(created + 1);
  });

  it('still reports the linking failure when the clean-up fails too', async () => {
    const { oystehr, transaction } = mockOystehr();
    createUserResourcesForPatient.mockRejectedValue(new Error('no person'));
    transaction
      .mockImplementationOnce(transaction.getMockImplementation()!)
      .mockRejectedValueOnce(new Error('cleanup'));

    await expect(performEffect(input as any, oystehr)).rejects.toThrow('no person');
  });
});
