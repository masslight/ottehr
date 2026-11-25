import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Location, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { GetBillingInvoiceRecipientResponse } from 'utils/lib/types/data/billing/billing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { index } from '../../src/ehr/get-billing-invoice-visit/index';
import { resolveTimezone } from '../../src/shared/helpers';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

describe('get-billing-invoice-visit integration', () => {
  let oystehrAdmin: Oystehr;
  let testUserM2MToken: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let location: Location;
  const guarantorFamily = `Tully-${randomUUID().slice(0, 8)}`;
  const guarantorEmail = `guarantor-${randomUUID().slice(0, 8)}@example.com`;
  const guarantorPhone = '+12125550142';
  const portalUserPhone = '+12125550143';

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-billing-invoice-visit.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    testUserM2MToken = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const locationId = getIdFromReference(
      base.appointment.participant.find((participant) => participant.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference,
      'Location'
    )!;
    const [fetchedLocation, [account], guarantor] = await Promise.all([
      oystehrAdmin.fhir.get<Location>({ resourceType: 'Location', id: locationId }),
      oystehrAdmin.fhir
        .search<Account>({
          resourceType: 'Account',
          params: [{ name: 'subject', value: `Patient/${base.patient.id}` }],
        })
        .then((bundle) => bundle.unbundle()),
      oystehrAdmin.fhir.create<RelatedPerson>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'RelatedPerson',
            patient: { reference: `Patient/${base.patient.id}` },
            relationship: [
              {
                coding: [
                  { system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'MTH', display: 'mother' },
                ],
              },
            ],
            name: [{ given: ['Catelyn'], family: guarantorFamily }],
            telecom: [
              { system: 'phone', value: guarantorPhone },
              { system: 'email', value: guarantorEmail },
            ],
          },
          setup.processId
        ) as RelatedPerson
      ),
      oystehrAdmin.fhir.create<RelatedPerson>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'RelatedPerson',
            patient: { reference: `Patient/${base.patient.id}` },
            relationship: [
              { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
            ],
            telecom: [
              { system: 'phone', value: portalUserPhone },
              { system: 'sms', value: portalUserPhone },
            ],
          },
          setup.processId
        ) as RelatedPerson
      ),
    ]);
    location = fetchedLocation;

    await oystehrAdmin.fhir.patch<Account>({
      resourceType: 'Account',
      id: account.id!,
      operations: [
        { op: 'add', path: '/guarantor', value: [{ party: { reference: `RelatedPerson/${guarantor.id}` } }] },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the patient, the stand-alone guarantor and the portal phone for the invoice dialog', async () => {
    const { statusCode, output } = await invokeZambdaHandler<GetBillingInvoiceRecipientResponse>(
      index,
      { encounterId: base.encounter.id },
      { token: testUserM2MToken, secrets: { ...loadZambdaSecrets(), INVOICING_IN_BILLING_APP: 'true' } }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({
      patient: {
        fullName: 'Jon Snow',
        dob: '07/07/2002',
        gender: 'Male',
        phoneNumber: portalUserPhone,
      },
      responsibleParty: {
        fullName: `Catelyn ${guarantorFamily}`,
        email: guarantorEmail,
        phoneNumber: guarantorPhone,
      },
      location: 'Integration Test Location',
      visitDate: DateTime.fromISO(base.appointment.start!)
        .setZone(resolveTimezone(undefined, location))
        .toFormat('MM/dd/yyyy'),
    });
  });
});
