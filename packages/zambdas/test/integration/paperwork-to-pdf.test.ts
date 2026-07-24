import Oystehr from '@oystehr/sdk';
import { DocumentReference, QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType, ServiceMode } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCurrentQuestionnaireForServiceType } from '../../src/patient/appointment/helpers';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for paperwork-to-pdf: renders the paperwork QuestionnaireResponse to a
// PDF stored in Oystehr z3 + a DocumentReference. The seed QR is pointed at the
// instance's intake questionnaire (config-resolved). FHIR + z3 only.
describe('paperwork-to-pdf integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaireResponseId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('paperwork-to-pdf.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode['in-person'], oystehrAdmin);
    const qr = await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    });
    questionnaireResponseId = qr.id!;
  }, 60_000);

  afterAll(async () => {
    const docs = await oystehrAdmin.fhir
      .search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
      })
      .then((r) => r.unbundle())
      .catch(() => []);
    for (const d of docs) {
      await oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id: d.id! }).catch(() => undefined);
    }
    await cleanup();
  }, 60_000);

  it('renders the paperwork to a pdf', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'paperwork-to-pdf',
      questionnaireResponseId,
    });
    expect(response.output).toBeDefined();
  });
});
