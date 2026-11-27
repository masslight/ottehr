import Oystehr, { FhirResourceReturnValue, SearchParam } from '@oystehr/sdk';
import {
  Account,
  Consent,
  Coverage,
  DocumentReference,
  FhirResource,
  HealthcareService,
  List,
  Organization,
  PaymentNotice,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  BUCKET_NAMES,
  FHIR_EXTENSION,
  FHIR_IDENTIFIER_SYSTEM,
  INTAKE_PAPERWORK_QR_TAG,
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PAYMENT_METHOD_EXTENSION_URL,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
} from 'utils/lib/fhir/constants';
import { codeableConcept, createCoverageMemberIdentifier } from 'utils/lib/fhir/helpers';
import { LOINC_SYSTEM } from 'utils/lib/fhir/vitals';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { VisitDetailsResponse } from 'utils/lib/types/api/visit-details/visit-details.types';
import {
  PAPERWORK_CONSENT_CODE_UNIQUE,
  PHOTO_ID_CARD_CODE,
  VISIT_DETAILS_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { stripeAccountExtension } from '../../src/billing/payments';
import { index } from '../../src/ehr/visit-details/visit-details-to-pdf/index';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';
import { createPresignedUrl, deleteZ3Object } from '../../src/shared/z3Utils';
import { SECRETS } from '../data/secrets';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';
import { ligatureFreeSuffix } from '../helpers/ligature-free-suffix';

vi.hoisted(() => vi.resetModules());

const { stripeClient } = vi.hoisted(() => ({
  stripeClient: {
    paymentIntents: { retrieve: vi.fn(), search: vi.fn() },
    paymentMethods: { retrieve: vi.fn(), list: vi.fn() },
  },
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: vi.fn(() => stripeClient),
}));

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const BILLING_ACCOUNT_CODE = PATIENT_BILLING_ACCOUNT_TYPE?.coding?.[0]?.code;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('visit-details-to-pdf integration', () => {
  let oystehr: Oystehr;
  let adminToken: string;
  let token: string;
  let processId: string;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  const created: FhirResource[] = [];
  const z3Objects: string[] = [];
  const suffix = ligatureFreeSuffix();
  const paymentIntentId = `pi_${suffix}`;
  const paymentMethodId = `pm_${suffix}`;
  const insurerName = `Integration Payer ${suffix}`;
  const memberId = `M${suffix}`;
  const employerName = `Integration Employer ${suffix}`;
  const signature = `Jon Snow ${suffix}`;
  const signerName = `Ned Stark ${suffix}`;

  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  const createTagged = async <T extends FhirResource>(resource: T): Promise<FhirResourceReturnValue<T>> => {
    const result = await oystehr.fhir.create<T>(tag(resource));
    created.push(result);
    return result;
  };

  const waitUntilSearchable = async (resource: FhirResource, params: SearchParam[]): Promise<void> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const found = (await oystehr.fhir.search({ resourceType: resource.resourceType, params })).unbundle();
      if (found.some((candidate) => candidate.id === resource.id)) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${resource.resourceType}/${resource.id} never became searchable`);
  };

  const uploadPhotoIdFront = async (): Promise<string> => {
    const url = `${SECRETS.PROJECT_API}/z3/${SECRETS.PROJECT_ID}-${BUCKET_NAMES.PHOTO_ID_CARDS}/${base.patient.id}/${suffix}-photo-id-front.png`;
    const uploadUrl = await createPresignedUrl(adminToken, url, 'upload');
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: ONE_PIXEL_PNG,
    });
    if (!response.ok) throw new Error(`Photo ID upload failed: ${response.status}`);
    z3Objects.push(url);
    return url;
  };

  const generateVisitDetailsPdf = async (): Promise<{ docRef: DocumentReference; text: string }> => {
    const { statusCode, output } = await invokeZambdaHandler<VisitDetailsResponse>(
      index,
      { appointmentId: base.appointment.id },
      { token }
    );
    expect(statusCode).toBe(200);
    const docRef = await oystehr.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: output.documentReference.replace('DocumentReference/', ''),
    });
    created.push(docRef);
    const pdfUrl = docRef.content[0].attachment.url!;
    z3Objects.push(pdfUrl);
    const data = new Uint8Array(await (await fetch(await getPresignedURL(pdfUrl, adminToken))).arrayBuffer());
    const pdf = await getDocument({ data }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return { docRef, text: pages.join(' ').replace(/\s+/g, ' ') };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('visit-details-to-pdf.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    adminToken = setup.token;
    token = setup.testUserM2MToken;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const patientReference = `Patient/${base.patient.id}`;
    const appointmentReference = `Appointment/${base.appointment.id}`;
    const encounterReference = `Encounter/${base.encounter.id}`;

    const payerId = `IT${suffix}`;
    const [insurer, employer, consentDocRef, photoIdUrl] = await Promise.all([
      createTagged<Organization>({
        resourceType: 'Organization',
        active: true,
        name: insurerName,
        type: [codeableConcept('pay', FHIR_EXTENSION.Organization.organizationType.url)],
        identifier: [{ type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: 'PAYERID' }] }, value: payerId }],
      }),
      createTagged<Organization>({
        resourceType: 'Organization',
        active: true,
        name: employerName,
        type: [codeableConcept('occupational-medicine-employer', FHIR_EXTENSION.Organization.organizationType.url)],
      }),
      createTagged<DocumentReference>({
        resourceType: 'DocumentReference',
        status: 'current',
        type: { coding: [PAPERWORK_CONSENT_CODE_UNIQUE] },
        subject: { reference: patientReference },
        context: { related: [{ reference: appointmentReference }] },
        content: [
          {
            attachment: {
              url: `${SECRETS.PROJECT_API}/z3/${SECRETS.PROJECT_ID}-${BUCKET_NAMES.CONSENT_FORMS}/${base.patient.id}/${suffix}-consent.pdf`,
              contentType: 'application/pdf',
              title: 'consent-forms.pdf',
            },
          },
        ],
      }),
      uploadPhotoIdFront(),
    ]);

    const [coverage, omAccount, consent, photoIdDocRef, paymentNotice, questionnaireResponse, account] =
      await Promise.all([
        createTagged<Coverage>({
          resourceType: 'Coverage',
          status: 'active',
          order: 1,
          beneficiary: { reference: patientReference },
          subscriber: { reference: patientReference },
          payor: [{ reference: `Organization/${insurer.id}` }],
          class: [
            {
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
              value: payerId,
              name: insurerName,
            },
          ],
          identifier: [createCoverageMemberIdentifier(memberId, insurer)],
        }),
        createTagged<Account>({
          resourceType: 'Account',
          status: 'active',
          type: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
          subject: [{ reference: patientReference }],
          owner: { reference: `Organization/${employer.id}` },
        }),
        createTagged<Consent>({
          resourceType: 'Consent',
          status: 'active',
          dateTime: '2025-03-14T15:00:00.000Z',
          patient: { reference: patientReference },
          scope: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }],
          },
          category: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes', code: 'hipaa-ack' }] },
          ],
          policy: [{ uri: 'https://ottehr.com' }],
          sourceReference: { reference: `DocumentReference/${consentDocRef.id}` },
        }),
        createTagged<DocumentReference>({
          resourceType: 'DocumentReference',
          status: 'current',
          type: { coding: [{ system: LOINC_SYSTEM, code: PHOTO_ID_CARD_CODE }] },
          subject: { reference: patientReference },
          date: new Date().toISOString(),
          context: { related: [{ reference: patientReference }] },
          content: [{ attachment: { url: photoIdUrl, contentType: 'image/png', title: 'photo-id-front' } }],
        }),
        createTagged<PaymentNotice>({
          resourceType: 'PaymentNotice',
          status: 'active',
          request: { type: 'Encounter', reference: encounterReference },
          created: '2025-02-11T15:00:00.000Z',
          amount: { value: 25, currency: 'USD' },
          identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: paymentIntentId }],
          extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }, stripeAccountExtension(undefined)],
          payment: { display: 'Stripe card payment' },
          recipient: { display: 'Integration test clinic' },
        }),
        createTagged<QuestionnaireResponse>({
          resourceType: 'QuestionnaireResponse',
          meta: { tag: [INTAKE_PAPERWORK_QR_TAG] },
          status: 'in-progress',
          subject: { reference: patientReference },
          encounter: { reference: encounterReference },
          item: [
            { linkId: 'signature', answer: [{ valueString: signature }] },
            { linkId: 'full-name', answer: [{ valueString: signerName }] },
            { linkId: 'consent-form-signer-relationship', answer: [{ valueString: 'Parent' }] },
          ],
        }),
        (async () => {
          for (let attempt = 0; attempt < 20; attempt++) {
            const found = (
              await oystehr.fhir.search<Account>({
                resourceType: 'Account',
                params: [{ name: 'patient', value: patientReference }],
              })
            )
              .unbundle()
              .find((candidate) => candidate.type?.coding?.some((coding) => coding.code === BILLING_ACCOUNT_CODE));
            if (found) return found;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          throw new Error(`${patientReference} has no searchable Account`);
        })(),
      ]);
    await oystehr.fhir.update<Account>({
      ...account,
      coverage: [{ coverage: { reference: `Coverage/${coverage.id}` }, priority: 1 }],
    });

    await Promise.all([
      waitUntilSearchable(coverage, [{ name: 'patient', value: patientReference }]),
      waitUntilSearchable(omAccount, [{ name: 'patient', value: patientReference }]),
      waitUntilSearchable(consentDocRef, [
        { name: 'subject', value: patientReference },
        { name: 'related', value: appointmentReference },
        { name: 'type', value: `${PAPERWORK_CONSENT_CODE_UNIQUE.system}|${PAPERWORK_CONSENT_CODE_UNIQUE.code}` },
      ]),
      waitUntilSearchable(consent, [{ name: 'source-reference', value: `DocumentReference/${consentDocRef.id}` }]),
      waitUntilSearchable(photoIdDocRef, [
        { name: 'related', value: patientReference },
        { name: 'type', value: `${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}` },
      ]),
      waitUntilSearchable(paymentNotice, [{ name: 'request', value: encounterReference }]),
      waitUntilSearchable(questionnaireResponse, [{ name: 'encounter', value: encounterReference }]),
    ]);
  }, 120_000);

  afterAll(async () => {
    const lists = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'subject', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle();
    for (const resource of [...created, ...lists]) {
      await oystehr.fhir.delete({ resourceType: resource.resourceType, id: resource.id! }).catch(() => undefined);
    }
    for (const url of z3Objects) {
      await deleteZ3Object(url, adminToken).catch(() => undefined);
    }
    await cleanup();
  });

  it('stores a visit details PDF with the consent, insurance, payments, photo ID and employer of the visit', async () => {
    stripeClient.paymentIntents.retrieve.mockResolvedValue({
      id: paymentIntentId,
      payment_method: paymentMethodId,
      latest_charge: { id: `ch_${suffix}`, amount_refunded: 0 },
    });
    stripeClient.paymentMethods.retrieve.mockResolvedValue({
      id: paymentMethodId,
      card: { brand: 'visa', last4: '4242' },
    });

    const { docRef, text } = await generateVisitDetailsPdf();

    expect(docRef.status).toBe('current');
    expect(docRef.type?.coding?.[0]?.code).toBe(VISIT_DETAILS_CODE);
    expect(docRef.subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(docRef.context?.related).toContainEqual({ reference: `Appointment/${base.appointment.id}` });
    expect(docRef.context?.encounter).toEqual([{ reference: `Encounter/${base.encounter.id}` }]);
    expect(docRef.content[0].attachment.title).toMatch(/^Visit Details: \d{2}-\d{2}-\d{4}$/);
    expect(docRef.content[0].attachment.url).toContain(
      `/z3/${SECRETS.PROJECT_ID}-${BUCKET_NAMES.VISIT_NOTES}/${base.patient.id}/`
    );

    expect(stripeClient.paymentIntents.retrieve).toHaveBeenCalledWith(
      paymentIntentId,
      { expand: ['latest_charge'] },
      { stripeAccount: undefined }
    );
    expect(stripeClient.paymentMethods.retrieve).toHaveBeenCalledWith(paymentMethodId, { stripeAccount: undefined });

    expect(text).toContain('VISIT DETAILS');
    expect(text).toMatch(new RegExp(`Signature\\s*${escapeRegExp(signature)}`));
    expect(text).toMatch(new RegExp(`Full name\\s*${escapeRegExp(signerName)}`));
    expect(text).toMatch(/Relationship to the patient\s*Parent/);
    expect(text).toMatch(/Date\s*03\/14\/2025/);
    expect(text).toMatch(new RegExp(`Insurance Carrier\\s*${escapeRegExp(insurerName)}`));
    expect(text).toMatch(new RegExp(`Member ID\\s*${escapeRegExp(memberId)}`));
    expect(text).toMatch(/Visa.{0,12}4242\s+02\/11\/2025\s+\$25\b/);
    expect(text).toMatch(new RegExp(`Employer name\\s*${escapeRegExp(employerName)}`));
    expect(text).toContain('Photo ID');
  }, 120_000);

  it("prints the visit's service category with the abbreviation from the service category catalog", async () => {
    const code = `it-category-${suffix}`;
    const abbreviation = `Q${suffix.toUpperCase().replace(/[^A-Z]/g, '')}ZX`;
    const serviceCategory = await createTagged<HealthcareService>({
      resourceType: 'HealthcareService',
      active: true,
      name: `Integration Category ${suffix}`,
      meta: { tag: [SERVICE_CATEGORY_TAG] },
      type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display: `Integration Category ${suffix}` }] }],
      extension: [{ url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL, valueString: JSON.stringify({ abbreviation }) }],
    });
    try {
      await waitUntilSearchable(serviceCategory, [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }]);
      await oystehr.fhir.patch({
        resourceType: 'Appointment',
        id: base.appointment.id!,
        operations: [
          { op: 'add', path: '/serviceCategory', value: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }] }] },
        ],
      });

      const { text } = await generateVisitDetailsPdf();

      expect(text).toMatch(new RegExp(`\\b${abbreviation} \\| Scheduled\\b`));
    } finally {
      await oystehr.fhir.delete({ resourceType: 'HealthcareService', id: serviceCategory.id! }).catch(() => undefined);
    }
  }, 120_000);
});
