import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { randomInt, randomUUID } from 'crypto';
import { Account, AuditEvent, FhirResource, List, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  FOLDERS_CONFIG,
  FRIENDLY_PATIENT_ID_SYSTEM_BASE,
  PATIENT_BILLING_ACCOUNT_TYPE,
} from 'utils/lib/fhir/constants';
import { CreatePatientResponse } from 'utils/lib/types/api/create-patient.types';
import { PersonSex } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('create-patient integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let createdPatientId: string | undefined;
  const phoneNumber = `+1212${randomInt(2_000_000, 10_000_000)}`;

  const search = async <T extends FhirResource>(
    resourceType: T['resourceType'],
    params: { name: string; value: string }[]
  ): Promise<T[]> => (await oystehrAdmin.fhir.search<T>({ resourceType, params })).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-patient.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (createdPatientId) {
      const patientReference = `Patient/${createdPatientId}`;
      const [lists, accounts, relatedPersons, persons, auditEvents] = await Promise.all([
        search<List>('List', [{ name: 'subject', value: patientReference }]),
        search<Account>('Account', [{ name: 'subject', value: patientReference }]),
        search<RelatedPerson>('RelatedPerson', [{ name: 'patient', value: patientReference }]),
        search<Person>('Person', [{ name: 'telecom', value: phoneNumber }]),
        search<AuditEvent>('AuditEvent', [{ name: 'agent', value: patientReference }]).catch(() => []),
      ]);
      const requests: BatchInputDeleteRequest[] = [
        ...lists,
        ...accounts,
        ...relatedPersons,
        ...persons,
        ...auditEvents,
        { resourceType: 'Patient', id: createdPatientId },
      ].map((resource) => ({ method: 'DELETE', url: `/${resource.resourceType}/${resource.id}` }));
      await oystehrAdmin.fhir.batch({ requests }).catch((error) => console.warn(error));
    }
    await cleanup();
  });

  it('creates the patient with document folders, a billing account and a linked account holder', async () => {
    const lastName = `Stark-${randomUUID().slice(0, 8)}`;

    const { output } = await oystehrZambdas.zambda.execute({
      id: 'create-patient',
      patient: {
        firstName: 'Arya',
        middleName: 'Nymeria',
        lastName,
        dateOfBirth: '2011-04-15',
        sex: PersonSex.Female,
        phoneNumber: `(${phoneNumber.slice(2, 5)}) ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8)}`,
      },
    });
    createdPatientId = (output as CreatePatientResponse).patientId;
    expect(createdPatientId).toBeTruthy();
    const patientReference = `Patient/${createdPatientId}`;

    const [patient, lists, accounts, relatedPersons, persons] = await Promise.all([
      oystehrAdmin.fhir.get<Patient>({ resourceType: 'Patient', id: createdPatientId }),
      search<List>('List', [{ name: 'subject', value: patientReference }]),
      search<Account>('Account', [{ name: 'subject', value: patientReference }]),
      search<RelatedPerson>('RelatedPerson', [
        { name: 'patient', value: patientReference },
        { name: 'relationship', value: 'user-relatedperson' },
      ]),
      search<Person>('Person', [{ name: 'telecom', value: phoneNumber }]),
    ]);

    expect(patient).toMatchObject({
      active: true,
      name: [{ given: ['Arya', 'Nymeria'], family: lastName, use: 'official' }],
      birthDate: '2011-04-15',
      gender: 'female',
      telecom: [{ system: 'phone', value: phoneNumber }],
    });
    expect(
      patient.identifier?.some((identifier) => identifier.system?.startsWith(FRIENDLY_PATIENT_ID_SYSTEM_BASE))
    ).toBe(true);

    expect(lists.map((list) => list.title).sort()).toEqual(FOLDERS_CONFIG.map((config) => config.title).sort());
    expect(accounts).toHaveLength(1);
    expect(accounts[0].type).toEqual(PATIENT_BILLING_ACCOUNT_TYPE);

    expect(relatedPersons).toHaveLength(1);
    expect(relatedPersons[0].telecom).toEqual([
      { system: 'phone', value: phoneNumber },
      { system: 'sms', value: phoneNumber },
    ]);
    expect(persons).toHaveLength(1);
    expect(persons[0].link?.map((link) => link.target.reference)).toContain(`RelatedPerson/${relatedPersons[0].id}`);
  });
});
