import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Practitioner, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { QR_DISTRIBUTION_TAG, QR_SENT_BY_SYSTEM } from 'utils/lib/fhir/constants';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { SendPatientFormOutput } from 'utils/lib/types/data/send-patient-form';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/send-patient-form/index';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const { sendSmsForPatient } = vi.hoisted(() => ({ sendSmsForPatient: vi.fn() }));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  sendSmsForPatient,
}));

describe('send-patient-form integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let providerProfile: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaire: Questionnaire;
  let questionnaireResponseId: string | undefined;
  const title = `Return to work form ${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('send-patient-form.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    providerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    questionnaire = await oystehr.fhir.create<Questionnaire>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Questionnaire',
          url: `https://ottehr.com/FHIR/Questionnaire/integration-${randomUUID()}`,
          version: '1.0.0',
          status: 'active',
          title,
          item: [{ linkId: 'work-page', type: 'group', item: [{ linkId: 'return-date', type: 'date', text: 'Date' }] }],
        },
        setup.processId
      ) as Questionnaire
    );
    sendSmsForPatient.mockResolvedValue({ total: 1, sent: 1, failures: [] });
  }, 60_000);

  afterAll(async () => {
    if (questionnaireResponseId) {
      await oystehr.fhir
        .delete({ resourceType: 'QuestionnaireResponse', id: questionnaireResponseId })
        .catch(() => undefined);
    }
    if (questionnaire?.id) {
      await oystehr.fhir.delete({ resourceType: 'Questionnaire', id: questionnaire.id }).catch(() => undefined);
    }
    await cleanup();
  });

  it('creates the form response for the visit and texts the patient its link', async () => {
    const { statusCode, output } = await invokeZambdaHandler<SendPatientFormOutput>(
      index,
      { appointmentId: base.appointment.id, questionnaireId: questionnaire.id },
      { token }
    );

    expect(statusCode).toBe(200);
    questionnaireResponseId = output.questionnaireResponseId;
    const [questionnaireResponse, sender] = await Promise.all([
      oystehr.fhir.get<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        id: output.questionnaireResponseId,
      }),
      oystehr.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: providerProfile.replace('Practitioner/', ''),
      }),
    ]);
    expect(questionnaireResponse).toMatchObject({
      status: 'in-progress',
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
      subject: { reference: `Patient/${base.patient.id}` },
      encounter: { reference: `Encounter/${base.encounter.id}` },
      item: [{ linkId: 'work-page' }],
    });
    expect(questionnaireResponse.meta?.tag).toEqual(
      expect.arrayContaining([
        expect.objectContaining(QR_DISTRIBUTION_TAG),
        expect.objectContaining({
          system: QR_SENT_BY_SYSTEM,
          code: providerProfile,
          display: getFullestAvailableName(sender),
        }),
      ])
    );

    expect(sendSmsForPatient).toHaveBeenCalledTimes(1);
    const [message, , patient] = sendSmsForPatient.mock.calls[0];
    expect(message).toBe(
      `Please complete ${title} for your visit: ${loadZambdaSecrets().WEBSITE_URL}/forms/${
        output.questionnaireResponseId
      }`
    );
    expect(patient.id).toBe(base.patient.id);
  });
});
