import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Communication, DocumentReference, Practitioner, Provenance, Task } from 'fhir/r4b';
import { M2MClientMockType, userMe } from 'utils/lib/auth/user-me.helper';
import {
  OUTBOUND_DELIVERY_INPUT_CODES,
  OUTBOUND_DELIVERY_OUTPUT_CODES,
  OUTBOUND_DELIVERY_TASK_CODES,
} from 'utils/lib/fhir/constants';
import { getOutboundDeliveryInput } from 'utils/lib/fhir/outbound-delivery';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { CreateDmeOrderResponse, SendDmeOrderFaxResponse } from 'utils/lib/types/api/dme.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/dme/send-dme-order-fax/index';
import { DME_ORDER_FORM_DOC_REF_DOCTYPE } from '../../src/shared/pdf/dme-order-form-pdf';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const { sendLetterFax } = vi.hoisted(() => ({ sendLetterFax: vi.fn() }));

vi.mock('../../src/shared/send-letter-fax', () => ({ sendLetterFax }));

describe('send-dme-order-fax integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let token: string;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let orderingPractitioner: Practitioner;
  let deviceRequestId: string;
  let attemptId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('send-dme-order-fax.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    token = setup.testUserM2MToken;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    orderingPractitioner = await oystehr.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ given: ['James'], family: `Wilson-${randomUUID().slice(0, 8)}` }] },
        setup.processId
      ) as Practitioner
    );
    const created = (
      await oystehrZambdas.zambda.execute({
        id: 'create-dme-order',
        encounterId: base.encounter.id,
        itemName: 'Knee immobilizer',
        quantity: 1,
        billingCodes: [{ code: 'L1830', display: 'Knee immobilizer' }],
        orderedByPractitionerId: orderingPractitioner.id,
        external: true,
        thirdParty: { name: 'Acme Medical Supply', fax: '2125550100' },
      })
    ).output as CreateDmeOrderResponse;
    deviceRequestId = created.deviceRequestId;
  }, 60_000);

  afterAll(async () => {
    if (attemptId) await oystehr.fhir.delete({ resourceType: 'Task', id: attemptId }).catch(() => undefined);
    if (deviceRequestId) {
      const provenances = (
        await oystehr.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `DeviceRequest/${deviceRequestId}` }],
        })
      ).unbundle();
      for (const provenance of provenances) {
        await oystehr.fhir.delete({ resourceType: 'Provenance', id: provenance.id! }).catch(() => undefined);
      }
      await oystehr.fhir.delete({ resourceType: 'DeviceRequest', id: deviceRequestId }).catch(() => undefined);
    }
    await cleanup();
    if (orderingPractitioner?.id) {
      await oystehr.fhir.delete({ resourceType: 'Practitioner', id: orderingPractitioner.id }).catch(() => undefined);
    }
  });

  it('faxes the order form to the third party and records the completed outbound attempt', async () => {
    const communication: Communication = { resourceType: 'Communication', id: randomUUID(), status: 'in-progress' };
    sendLetterFax.mockResolvedValueOnce(communication);
    const secrets = loadZambdaSecrets();

    const { statusCode, output } = await invokeZambdaHandler<SendDmeOrderFaxResponse>(
      index,
      { deviceRequestId, faxNumber: '(212) 555-0199' },
      { token, secrets }
    );

    expect(statusCode).toBe(200);
    attemptId = output.outboundAttemptId;

    const [form] = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'related', value: `DeviceRequest/${deviceRequestId}` },
          { name: 'type', value: `${DME_ORDER_FORM_DOC_REF_DOCTYPE.system}|${DME_ORDER_FORM_DOC_REF_DOCTYPE.code}` },
        ],
      })
    ).unbundle();
    expect(form.subject?.reference).toBe(`Patient/${base.patient.id}`);

    expect(sendLetterFax).toHaveBeenCalledTimes(1);
    expect(sendLetterFax).toHaveBeenCalledWith(
      expect.objectContaining({
        media: form.content[0].attachment.url,
        patientId: base.patient.id,
        faxNumber: '+12125550199',
        organizationId: getSecret(SecretsKeys.ORGANIZATION_ID, secrets),
      })
    );

    const attempt = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: output.outboundAttemptId });
    const inputValue = (code: string): string | undefined => {
      const input = getOutboundDeliveryInput(attempt, code);
      return input?.valueString ?? input?.valueReference?.reference;
    };
    expect(attempt.status).toBe('completed');
    expect(attempt.code?.coding?.[0]?.code).toBe(OUTBOUND_DELIVERY_TASK_CODES.fax);
    expect(attempt.for?.reference).toBe(`Patient/${base.patient.id}`);
    expect(attempt.focus?.reference).toBe(`Appointment/${base.appointment.id}`);
    expect(attempt.requester?.reference).toBe(callerProfile);
    expect(inputValue(OUTBOUND_DELIVERY_INPUT_CODES.recipientAddress)).toBe('+12125550199');
    expect(inputValue(OUTBOUND_DELIVERY_INPUT_CODES.recipientName)).toBe('Acme Medical Supply');
    expect(inputValue(OUTBOUND_DELIVERY_INPUT_CODES.documentReference)).toBe(`DocumentReference/${form.id}`);
    expect(inputValue(OUTBOUND_DELIVERY_INPUT_CODES.senderId)).toBe((await userMe(token, secrets)).id);
    expect(
      attempt.output?.find((o) => o.type.coding?.some((c) => c.code === OUTBOUND_DELIVERY_OUTPUT_CODES.communication))
        ?.valueReference?.reference
    ).toBe(`Communication/${communication.id}`);
  });
});
