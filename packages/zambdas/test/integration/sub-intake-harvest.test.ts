import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Appointment, FhirResource, Observation, QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils/lib/fhir/constants';
import { IN_PERSON_INTAKE_PAPERWORK_URL } from 'utils/lib/ottehr-config/intake-paperwork/index';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/subscriptions/questionnaire-response/sub-intake-harvest/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { updateStripeCustomerMock } = vi.hoisted(() => ({
  updateStripeCustomerMock: vi.fn(async (customerId: string) => ({ id: customerId })),
}));

vi.mock('../../src/patient/payment-methods/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/patient/payment-methods/helpers')>()),
  getStripeClient: () => ({ customers: { update: updateStripeCustomerMock } }),
}));

const deleteTaggedResources = async (
  oystehr: Oystehr,
  processId: string,
  resourceTypes: FhirResource['resourceType'][]
): Promise<void> => {
  for (const resourceType of resourceTypes) {
    const resources = (
      await oystehr.fhir.search<FhirResource>({
        resourceType,
        params: [{ name: '_tag', value: `${INTEGRATION_TEST_PROCESS_ID_SYSTEM}|${processId}` }],
      })
    ).unbundle();
    await Promise.all(
      resources.map((resource) => oystehr.fhir.delete({ resourceType, id: resource.id! }).catch(() => undefined))
    );
  }
};

describe('sub-intake-harvest', () => {
  let oystehr: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;
  let intakeResponse: QuestionnaireResponse;
  const stripeCustomerId = `cus_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-intake-harvest.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    visit = await insertInPersonAppointmentBase(oystehr, processId);
    const [account] = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${visit.patient.id}` }],
      })
    ).unbundle();
    await oystehr.fhir.patch<Account>({
      resourceType: 'Account',
      id: account.id!,
      operations: [
        {
          op: 'add',
          path: '/identifier',
          value: [{ system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, value: stripeCustomerId }],
        },
        { op: 'add', path: '/guarantor', value: [{ party: { reference: `Patient/${visit.patient.id}` } }] },
      ],
    });

    intakeResponse = await oystehr.fhir.create<QuestionnaireResponse>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          questionnaire: `${IN_PERSON_INTAKE_PAPERWORK_URL}|1.0.0`,
          subject: { reference: `Patient/${visit.patient.id}` },
          encounter: { reference: `Encounter/${visit.encounter.id}` },
          item: [
            {
              linkId: 'additional-page',
              item: [{ linkId: 'covid-symptoms', answer: [{ valueString: 'Yes' }] }],
            },
          ],
        },
        processId
      ) as QuestionnaireResponse
    );
  });

  afterAll(async () => {
    const observations = (
      await oystehr.fhir.search<Observation>({
        resourceType: 'Observation',
        params: [{ name: 'encounter', value: `Encounter/${visit.encounter.id}` }],
      })
    ).unbundle();
    await Promise.all(
      observations.map((observation) =>
        oystehr.fhir.delete({ resourceType: 'Observation', id: observation.id! }).catch(() => undefined)
      )
    );
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['QuestionnaireResponse', 'Account', 'Patient']);
  });

  it('syncs the guarantor to Stripe, saves the additional questions and tags the appointment harvested', async () => {
    const { statusCode, output } = await invokeZambdaHandler<string>(
      index,
      { ...intakeResponse, status: 'completed' },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toBe('all tasks executed successfully');

    expect(updateStripeCustomerMock).toHaveBeenCalledTimes(1);
    expect(updateStripeCustomerMock).toHaveBeenCalledWith(
      stripeCustomerId,
      { email: 'john.doe@example.com', name: 'Jon Snow', phone: expect.stringContaining('2120250519') },
      { stripeAccount: undefined }
    );

    const [appointment, observations] = await Promise.all([
      oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: visit.appointment.id! }),
      oystehr.fhir
        .search<Observation>({
          resourceType: 'Observation',
          params: [
            { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
            { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/${ADDITIONAL_QUESTIONS_META_SYSTEM}|covid-symptoms` },
          ],
        })
        .then((bundle) => bundle.unbundle()),
    ]);

    expect(appointment.meta?.tag).toContainEqual(
      expect.objectContaining({
        system: FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.system,
        code: FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.code,
      })
    );
    expect(observations).toHaveLength(1);
    expect(observations[0].subject?.reference).toBe(`Patient/${visit.patient.id}`);
    expect(observations[0].valueBoolean).toBe(true);
  });
});
