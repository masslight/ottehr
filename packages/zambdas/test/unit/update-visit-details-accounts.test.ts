import Oystehr, { BatchInputPatchRequest } from '@oystehr/sdk';
import { applyPatch } from 'fast-json-patch';
import { Account, Appointment, Encounter } from 'fhir/r4b';
import {
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  SERVICE_CATEGORY_SYSTEM,
  WORKERS_COMP_ACCOUNT_TYPE,
} from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/visit-details/update-visit-details';

const patientAccountReference = { reference: 'Account/patient-billing' };
const workersCompAccount: Account = {
  resourceType: 'Account',
  id: 'workers-comp',
  status: 'active',
  type: WORKERS_COMP_ACCOUNT_TYPE,
};
const occupationalMedicineAccount: Account = {
  resourceType: 'Account',
  id: 'occupational-medicine',
  status: 'active',
  type: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
};

function makeInput(category: string): Parameters<typeof performEffect>[0] {
  return {
    appointmentId: 'appointment-1',
    bookingDetails: { serviceCategory: { system: SERVICE_CATEGORY_SYSTEM, code: category } },
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
    patient: { resourceType: 'Patient', id: 'patient-1' },
    appointment: {
      resourceType: 'Appointment',
      id: 'appointment-1',
      status: 'arrived',
      participant: [],
      serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care' }] }],
    },
    encounter: {
      resourceType: 'Encounter',
      id: 'encounter-1',
      status: 'arrived',
      class: { code: 'AMB' },
      account: [patientAccountReference],
    },
  };
}

async function updateEncounter(input: Parameters<typeof performEffect>[0]): Promise<Encounter> {
  const transaction = vi
    .fn<(input: { requests: BatchInputPatchRequest<Encounter | Appointment>[] }) => Promise<void>>()
    .mockResolvedValue(undefined);
  await performEffect(input, { fhir: { transaction } } as unknown as Oystehr);
  expect(transaction).toHaveBeenCalledTimes(1);
  const patch = transaction.mock.calls[0][0].requests.find(({ url }) => url === '/Encounter/encounter-1');
  expect(patch).toBeDefined();
  return applyPatch(input.encounter, patch!.operations, true, false).newDocument;
}

describe('visit service-category Account links', () => {
  it.each(['occupational-medicine', 'workers-comp'])(
    'preserves the patient billing Account when switching to %s without a special Account',
    async (category) => {
      const encounter = await updateEncounter(makeInput(category));
      expect(encounter.account).toEqual([patientAccountReference]);
    }
  );

  it.each([
    ['urgent-care', 'occupational-medicine'],
    ['urgent-care', 'workers-comp'],
    ['workers-comp', 'occupational-medicine'],
    ['occupational-medicine', 'workers-comp'],
    ['workers-comp', 'urgent-care'],
    ['occupational-medicine', 'urgent-care'],
  ])('preserves the patient Account and selects the special Account when switching %s to %s', async (from, to) => {
    const input = makeInput(to);
    input.workersCompAccount = workersCompAccount;
    input.occupationalMedicineAccount = occupationalMedicineAccount;
    input.appointment.serviceCategory = [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: from }] }];
    if (from !== 'urgent-care') input.encounter.account!.push({ reference: `Account/${from}` });

    const encounter = await updateEncounter(input);
    expect(encounter.account).toEqual([
      patientAccountReference,
      ...(to === 'urgent-care' ? [] : [{ reference: `Account/${to}` }]),
    ]);
  });

  it.each(['occupational-medicine', 'workers-comp'])(
    'keeps one patient Account and one special Account when saving %s repeatedly',
    async (category) => {
      const input = makeInput(category);
      input.workersCompAccount = workersCompAccount;
      input.occupationalMedicineAccount = occupationalMedicineAccount;
      input.encounter = await updateEncounter(input);
      input.appointment.serviceCategory = [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: category }] }];

      const encounter = await updateEncounter(input);
      expect(encounter.account).toEqual([patientAccountReference, { reference: `Account/${category}` }]);
    }
  );
});
