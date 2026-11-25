import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Practitioner } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { GetPractitionerNamesResponse } from 'utils/lib/types/api/practitioner-names.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

describe('get-practitioner-names integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  const practitionerIds: string[] = [];

  const createPractitioner = async (given: string, family: string): Promise<Practitioner> => {
    const practitioner = await oystehrAdmin.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ given: [given, 'Middle'], family }] },
        processId
      ) as Practitioner
    );
    practitionerIds.push(practitioner.id!);
    return practitioner;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-practitioner-names.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    await Promise.all(
      practitionerIds.map((id) =>
        oystehrAdmin.fhir.delete({ resourceType: 'Practitioner', id }).catch((error) => console.warn(error))
      )
    );
    await cleanup();
  });

  it('returns first and last names for the requested practitioners and leaves out unknown ids', async () => {
    const suffix = randomUUID().slice(0, 8);
    const first = await createPractitioner('Ada', `Lovelace-${suffix}`);
    const second = await createPractitioner('Grace', `Hopper-${suffix}`);
    const unknownId = randomUUID();

    const { output } = await oystehrZambdas.zambda.execute({
      id: 'get-practitioner-names',
      practitionerIds: [first.id, second.id, first.id, unknownId],
    });

    expect((output as GetPractitionerNamesResponse).names).toEqual({
      [first.id!]: `Ada Lovelace-${suffix}`,
      [second.id!]: `Grace Hopper-${suffix}`,
    });
  });
});
