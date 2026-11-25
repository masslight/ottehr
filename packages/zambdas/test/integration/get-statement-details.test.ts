import Oystehr, { SearchParam } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Claim, Coverage, FhirResource, Organization, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FHIR_EXTENSION, FHIR_IDENTIFIER_SYSTEM } from 'utils/lib/fhir/constants';
import { codeableConcept, createCoverageMemberIdentifier } from 'utils/lib/fhir/helpers';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { StatementDetails } from 'utils/lib/statements/generate-statement';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../src/billing/payments';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

describe('get-statement-details integration', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let oystehrProvider: Oystehr;
  let processId: string;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  const created: FhirResource[] = [];
  const createdBilling: FhirResource[] = [];
  const suffix = randomUUID().slice(0, 8);

  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  const waitUntilSearchable = async (client: Oystehr, resource: FhirResource, params: SearchParam[]): Promise<void> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const found = (await client.fhir.search({ resourceType: resource.resourceType, params })).unbundle();
      if (found.some((candidate) => candidate.id === resource.id)) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${resource.resourceType}/${resource.id} never became searchable`);
  };

  const findPatientAccount = async (): Promise<Account> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const [account] = (
        await oystehr.fhir.search<Account>({
          resourceType: 'Account',
          params: [{ name: 'patient', value: `Patient/${base.patient.id}` }],
        })
      ).unbundle();
      if (account) return account;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Patient/${base.patient.id} has no searchable Account`);
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-statement-details.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    oystehrProvider = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    for (const resource of createdBilling) {
      await oystehrBilling.fhir
        .delete({ resourceType: resource.resourceType, id: resource.id! })
        .catch(() => undefined);
    }
    for (const resource of created) {
      await oystehr.fhir.delete({ resourceType: resource.resourceType, id: resource.id! }).catch(() => undefined);
    }
    await cleanup();
  });

  it('builds the statement from the guarantor, coverage, billing claim amounts and default biller', async () => {
    const encounterId = base.encounter.id!;
    const patientReference = `Patient/${base.patient.id}`;
    const secrets = loadZambdaSecrets();

    const payerId = `IT${suffix}`;
    const insuranceOrg = await oystehr.fhir.create<Organization>(
      tag({
        resourceType: 'Organization',
        active: true,
        name: `Integration Payer ${suffix}`,
        type: [codeableConcept('pay', FHIR_EXTENSION.Organization.organizationType.url)],
        identifier: [{ type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: 'PAYERID' }] }, value: payerId }],
      })
    );
    created.push(insuranceOrg);
    const memberId = `M${suffix}`;
    const coverage = await oystehr.fhir.create<Coverage>(
      tag({
        resourceType: 'Coverage',
        status: 'active',
        order: 1,
        beneficiary: { reference: patientReference },
        subscriber: { reference: patientReference },
        payor: [{ reference: `Organization/${insuranceOrg.id}` }],
        class: [
          {
            type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
            value: payerId,
            name: insuranceOrg.name,
          },
        ],
        identifier: [createCoverageMemberIdentifier(memberId, insuranceOrg)],
      })
    );
    created.push(coverage);

    const guarantor = {
      firstName: 'Lyanna',
      lastName: `Stark${suffix}`,
      addressLine1: '1 Winterfell Road',
      addressLine2: 'Suite 7',
      city: 'Winterfell',
      provinceOrState: 'NY',
      postalOrZip: '10001',
      countryCode: 'US',
    };
    const account = await findPatientAccount();
    await oystehr.fhir.update<Account>({
      ...account,
      contained: [
        {
          resourceType: 'RelatedPerson',
          id: 'guarantor',
          patient: { reference: patientReference },
          name: [{ given: [guarantor.firstName], family: guarantor.lastName }],
          address: [
            {
              line: [guarantor.addressLine1, guarantor.addressLine2],
              city: guarantor.city,
              state: guarantor.provinceOrState,
              postalCode: guarantor.postalOrZip,
              country: guarantor.countryCode,
            },
          ],
        },
      ],
      guarantor: [{ party: { reference: '#guarantor' } }],
      coverage: [{ coverage: { reference: `Coverage/${coverage.id}` }, priority: 1 }],
    });

    const claim = await oystehrBilling.fhir.create<Claim>(
      tag({
        resourceType: 'Claim',
        meta: { tag: [{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient }] },
        status: 'active',
        use: 'claim',
        identifier: [{ system: CLAIM_ENCOUNTER_ID_SYSTEM, value: encounterId }],
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        patient: { display: 'Integration Test Patient' },
        created: '2026-11-01',
        provider: { display: 'Integration Test Provider' },
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        item: [
          {
            sequence: 1,
            productOrService: {
              coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213', display: 'Office visit' }],
            },
            net: { value: 150, currency: 'USD' },
          },
        ],
        total: { value: 150, currency: 'USD' },
      })
    );
    createdBilling.push(claim);
    const patientPayment = await oystehrBilling.fhir.create<PaymentNotice>(
      tag({
        resourceType: 'PaymentNotice',
        status: 'active',
        created: '2026-11-02T15:00:00.000Z',
        request: { type: 'Claim', identifier: { system: CLAIM_ENCOUNTER_ID_SYSTEM, value: encounterId } },
        identifier: [{ system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() }],
        payment: { display: 'Integration test payment' },
        recipient: { display: 'Integration test clinic' },
        amount: { value: 40, currency: 'USD' },
      })
    );
    createdBilling.push(patientPayment);
    await Promise.all([
      waitUntilSearchable(oystehrBilling, claim, [
        { name: 'identifier', value: `${CLAIM_ENCOUNTER_ID_SYSTEM}|${encounterId}` },
      ]),
      waitUntilSearchable(oystehrBilling, patientPayment, [
        { name: 'request:identifier', value: `${CLAIM_ENCOUNTER_ID_SYSTEM}|${encounterId}` },
      ]),
    ]);

    const billerName = (
      await oystehr.fhir.get<Organization>({
        resourceType: 'Organization',
        id: secrets.DEFAULT_BILLING_RESOURCE.split('/')[1],
      })
    ).name;

    const output = (
      await oystehrProvider.zambda.execute({
        id: 'get-statement-details',
        encounterId,
        statementType: 'past-due',
        billingAppInvoice: true,
      })
    ).output as StatementDetails;

    expect(output.respParty).toEqual(guarantor);
    expect(output.pastDue).toBe(true);
    expect(output.finalNotice).toBe(false);
    expect(output.statement.number).toBe(base.appointment.id);
    expect(output.patient).toEqual({ firstName: 'Jon', lastName: 'Snow', dob: '07/07/2002' });
    expect(output.insurance).toEqual({ payerName: insuranceOrg.name, memberId });
    expect(output.facility.name).toBe('Integration Test Location');
    expect(output.service).toEqual([
      {
        cpt: '99213',
        description: '99213 - Office visit',
        charged: formatCurrencyFromCents(15000),
        insurancePaid: formatCurrencyFromCents(0),
        patientPaid: formatCurrencyFromCents(4000),
        writeOffs: formatCurrencyFromCents(0),
        patientOwes: formatCurrencyFromCents(11000),
      },
    ]);
    expect(output.totals).toEqual({
      charged: formatCurrencyFromCents(15000),
      insurancePaid: formatCurrencyFromCents(0),
      patientPaid: formatCurrencyFromCents(4000),
      writeOffs: formatCurrencyFromCents(0),
      deductible: formatCurrencyFromCents(0),
      balanceDue: formatCurrencyFromCents(11000),
    });
    expect(output.payment.url).toBe(secrets.PATIENT_LOGIN_REDIRECT_URL);
    expect(billerName).toBeTruthy();
    expect(output.biller.name).toBe(billerName);
  }, 120_000);
});
