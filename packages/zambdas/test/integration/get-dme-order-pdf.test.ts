import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CreateDmeOrderResponse, GetDmeOrderPdfResponse } from 'utils/lib/types/api/dme.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DME_ORDER_FORM_DOC_REF_DOCTYPE,
  DME_ORDER_FORM_SOURCE_VERSION_SYSTEM,
} from '../../src/shared/pdf/dme-order-form-pdf';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('get-dme-order-pdf integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let orderingPractitioner: Practitioner;
  let deviceRequestId: string;

  const searchOrderForms = async (): Promise<DocumentReference[]> =>
    (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'related', value: `DeviceRequest/${deviceRequestId}` },
          { name: 'type', value: `${DME_ORDER_FORM_DOC_REF_DOCTYPE.system}|${DME_ORDER_FORM_DOC_REF_DOCTYPE.code}` },
        ],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-dme-order-pdf.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
    orderingPractitioner = await oystehr.fhir.create<Practitioner>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Practitioner', name: [{ given: ['Lisa'], family: `Cuddy-${randomUUID().slice(0, 8)}` }] },
        setup.processId
      ) as Practitioner
    );
    const created = (
      await oystehrZambdas.zambda.execute({
        id: 'create-dme-order',
        encounterId: base.encounter.id,
        itemName: 'Wrist splint',
        quantity: 1,
        billingCodes: [{ code: 'L3908', display: 'Wrist hand orthosis' }],
        diagnoses: [{ code: 'S63.501A', display: 'Sprain of right wrist' }],
        orderedByPractitionerId: orderingPractitioner.id,
        external: true,
        thirdParty: { name: 'Acme Medical Supply', fax: '2125550100' },
      })
    ).output as CreateDmeOrderResponse;
    deviceRequestId = created.deviceRequestId;
  }, 60_000);

  afterAll(async () => {
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

  it('renders the order form once, files it on the visit and reuses it while the order is unchanged', async () => {
    const first = (await oystehrZambdas.zambda.execute({ id: 'get-dme-order-pdf', deviceRequestId }))
      .output as GetDmeOrderPdfResponse;

    const pdf = await fetch(first.presignedURL);
    expect(pdf.ok).toBe(true);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString()
    ).toBe('%PDF');

    const [form] = await searchOrderForms();
    expect(form.status).toBe('current');
    expect(form.subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(form.context?.encounter?.[0]?.reference).toBe(`Encounter/${base.encounter.id}`);
    expect(form.identifier?.find((i) => i.system === DME_ORDER_FORM_SOURCE_VERSION_SYSTEM)?.value).toBeTruthy();
    const mediaUrl = form.content[0].attachment.url!;
    expect(first.presignedURL).toContain(new URL(mediaUrl).pathname.split('/').pop());

    const second = (await oystehrZambdas.zambda.execute({ id: 'get-dme-order-pdf', deviceRequestId }))
      .output as GetDmeOrderPdfResponse;
    expect(second.presignedURL).toContain(new URL(mediaUrl).pathname.split('/').pop());
    expect((await searchOrderForms()).map((docRef) => docRef.id)).toEqual([form.id]);
  });
});
