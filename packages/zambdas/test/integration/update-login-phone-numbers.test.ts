import Oystehr from '@oystehr/sdk';
import { randomInt } from 'crypto';
import { Person, RelatedPerson } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

const USER_RELATIONSHIP_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/relationship`;

const randomPhone = (): string => `+1555${randomInt(1_000_000, 9_999_999)}`;

describe('update-login-phone-numbers integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let oldRelatedPerson: RelatedPerson;
  let oldPerson: Person;
  const oldPhone = randomPhone();
  const newPhone = randomPhone();
  const personIdsToDelete = new Set<string>();

  const searchUserRelatedPersons = async (): Promise<RelatedPerson[]> =>
    (
      await oystehr.fhir.search<RelatedPerson>({
        resourceType: 'RelatedPerson',
        params: [{ name: 'patient', value: `Patient/${base.patient.id}` }],
      })
    )
      .unbundle()
      .filter(
        (relatedPerson) =>
          relatedPerson.relationship?.some(
            (relationship) =>
              relationship.coding?.some(
                (coding) => coding.system === USER_RELATIONSHIP_SYSTEM && coding.code === 'user-relatedperson'
              )
          )
      );

  const searchPersonsByPhone = async (phone: string): Promise<Person[]> =>
    (
      await oystehr.fhir.search<Person>({ resourceType: 'Person', params: [{ name: 'telecom', value: phone }] })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-login-phone-numbers.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    oldRelatedPerson = await oystehr.fhir.create<RelatedPerson>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'RelatedPerson',
          patient: { reference: `Patient/${base.patient.id}` },
          relationship: [{ coding: [{ system: USER_RELATIONSHIP_SYSTEM, code: 'user-relatedperson' }] }],
          telecom: [
            { system: 'phone', value: oldPhone },
            { system: 'sms', value: oldPhone },
          ],
        },
        setup.processId
      ) as RelatedPerson
    );
    oldPerson = await oystehr.fhir.create<Person>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Person',
          telecom: [{ system: 'phone', value: oldPhone }],
          link: [{ target: { reference: `RelatedPerson/${oldRelatedPerson.id}` } }],
        },
        setup.processId
      ) as Person
    );
    personIdsToDelete.add(oldPerson.id!);
  }, 60_000);

  afterAll(async () => {
    for (const id of personIdsToDelete) {
      await oystehr.fhir.delete({ resourceType: 'Person', id }).catch(() => undefined);
    }
    await oystehr.fhir.delete({ resourceType: 'RelatedPerson', id: oldRelatedPerson.id! }).catch(() => undefined);
    await cleanup();
  });

  it("replaces the patient's login phone: links a new user for the new number and unlinks the old one", async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-login-phone-numbers',
      patientId: base.patient.id,
      phoneNumbers: [newPhone],
    });

    expect(response.output).toEqual({ result: 'success' });

    const userRelatedPersons = await searchUserRelatedPersons();
    expect(userRelatedPersons).toHaveLength(1);
    const [newRelatedPerson] = userRelatedPersons;
    expect(newRelatedPerson.id).not.toBe(oldRelatedPerson.id);
    expect(newRelatedPerson.telecom).toEqual([
      { system: 'phone', value: newPhone },
      { system: 'sms', value: newPhone },
    ]);

    const newPersons = await searchPersonsByPhone(newPhone);
    newPersons
      .filter(
        (person) => person.link?.some((link) => link.target?.reference === `RelatedPerson/${newRelatedPerson.id}`)
      )
      .forEach((person) => personIdsToDelete.add(person.id!));
    expect(newPersons).toHaveLength(1);
    expect(newPersons[0].link).toEqual([{ target: { reference: `RelatedPerson/${newRelatedPerson.id}` } }]);

    const oldPersonAfter = await oystehr.fhir.get<Person>({ resourceType: 'Person', id: oldPerson.id! });
    expect(oldPersonAfter.link ?? []).toEqual([]);
    await expect(oystehr.fhir.get({ resourceType: 'RelatedPerson', id: oldRelatedPerson.id! })).rejects.toBeDefined();

    const loginPhones = await oystehrZambdas.zambda.execute({
      id: 'get-login-phone-numbers',
      patientId: base.patient.id,
    });
    expect(loginPhones.output).toEqual({ phoneNumbers: [newPhone] });
  });
});
