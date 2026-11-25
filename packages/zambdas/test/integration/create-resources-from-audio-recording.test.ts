import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  AMBIENT_SCRIBE_RECORDING_PENDING_CODING,
  DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
  PUBLIC_EXTENSION_BASE_URL,
} from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('create-resources-from-audio-recording integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let providerProfile: string;
  let base: InsertFullAppointmentDataBaseResult;
  const createdDocumentIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'create-resources-from-audio-recording.test.ts',
      M2MClientMockType.provider
    );
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    providerProfile = setup.testUserM2MProfile;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await Promise.all(
      createdDocumentIds.map((id) =>
        oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id }).catch((error) => console.warn(error))
      )
    );
    await cleanup();
  });

  it('creates a pending ambient scribe DocumentReference for the visit under the calling provider', async () => {
    const z3URL = `https://project-api.zapehr.com/v1/z3/integration-test-missing-bucket/${randomUUID()}.webm`;

    const { output } = await oystehrZambdas.zambda.execute({
      id: 'create-resources-from-audio-recording',
      z3URL,
      visitID: base.encounter.id,
      duration: 125_000,
    });

    const documentId = (output as string).match(/^Successfully created DocumentReference\/(.+)$/)?.[1];
    expect(documentId).toBeDefined();
    createdDocumentIds.push(documentId!);

    const document = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentId!,
    });
    expect(document.status).toBe('current');
    expect(document.type?.coding).toEqual([AMBIENT_SCRIBE_RECORDING_PENDING_CODING]);
    expect(document.description).toBe(DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO);
    expect(document.subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(document.context?.encounter).toEqual([{ reference: `Encounter/${base.encounter.id}` }]);
    expect(document.content?.[0]?.attachment).toMatchObject({ url: z3URL, title: 'Audio recording (02:05)' });
    expect(
      document.extension?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)?.valueReference
        ?.reference
    ).toBe(providerProfile);
  });
});
