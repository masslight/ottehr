import { describe, it, expect, assert } from 'vitest';
import * as fs from 'fs';
import { getAuth0Token } from '../../../../shared';
import { createOystehrClient } from '../../../../shared/helpers';
import baseQRItem from './data/integration-base-qr-1.json';
import { Account, InsurancePlan, Organization, QuestionnaireResponse } from 'fhir/r4b';
import { sleep } from 'utils';

const TEST_ENCOUNTER_ID_KEY = 'test-encounter-id';
const TEST_PATIENT_ID_KEY = 'test-patient-id';
const TEST_APPOINTMENT_ID_KEY = 'test-appointment-id';
const TEST_QUESTIONNAIRE_RESPONSE_ID_KEY = 'test-questionnaire-response-id';

const TEST_CONFIG: Record<string, string> = {
  [TEST_ENCOUNTER_ID_KEY]: '9b019c97-3156-4745-b384-5dc8a60f63d2',
  [TEST_APPOINTMENT_ID_KEY]: '308c7a77-c992-45f6-b41c-00d021fe4710',
  [TEST_PATIENT_ID_KEY]: '099639e6-c89c-4bad-becf-ce15ce010f21',
  [TEST_QUESTIONNAIRE_RESPONSE_ID_KEY]: 'e5f86b53-cfc4-49f1-baa7-ac70be95589b',
};
describe('Harvest Module Integration Tests', () => {
  const envConfig = JSON.parse(fs.readFileSync('.env/local.json', 'utf8'));
  const INSURANCE_PLAN_ORG_MAP: Record<string, string> = {};
  let token: string | undefined;
  beforeAll(async () => {
    // Set up environment
    console.log('Setting up environment...');
    // Add your setup code here
    expect(process.env).toBeDefined();
    expect(envConfig).toBeDefined();

    if (!token) {
      token = await getAuth0Token(envConfig);
    }

    const oystehrClient = createOystehrClient(token, envConfig);
    expect(oystehrClient).toBeDefined();
    const quesionnaireResponse = await oystehrClient.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: TEST_CONFIG[TEST_QUESTIONNAIRE_RESPONSE_ID_KEY],
    });
    expect(quesionnaireResponse).toBeDefined();
    expect(quesionnaireResponse.encounter?.reference).toEqual(`Encounter/${TEST_CONFIG[TEST_ENCOUNTER_ID_KEY]}`);

    const ipAndOrg1 = (
      await oystehrClient.fhir.search<InsurancePlan | Organization>({
        resourceType: 'InsurancePlan',
        params: [
          {
            name: 'owned-by.name:exact',
            value: 'Aetna',
          },
          {
            name: 'owned-by.active',
            value: 'true',
          },
          {
            name: 'status',
            value: 'active',
          },
          {
            name: '_include',
            value: 'InsurancePlan:owned-by',
          },
        ],
      })
    ).unbundle();

    const iPs = ipAndOrg1.filter((ip) => ip.resourceType === 'InsurancePlan');
    const orgs = ipAndOrg1.filter((org) => org.resourceType === 'Organization');
    expect(iPs.length).toBeGreaterThan(0);
    expect(orgs.length).toBeGreaterThan(0);
    iPs.forEach((ip) => {
      const ownedByReference = ip.ownedBy?.reference;
      if (ownedByReference) {
        const org = orgs.find((org) => `Organization/${org.id}` === ownedByReference);
        if (org) {
          INSURANCE_PLAN_ORG_MAP[ip.id!] = org.id!;
        }
      }
    });
    expect(Object.keys(INSURANCE_PLAN_ORG_MAP).length).toBeGreaterThan(0);

    const firstPair = Object.entries(INSURANCE_PLAN_ORG_MAP)[0];

    const [key] = firstPair;

    const insurancePlanRef = `InsurancePlan/${key}`;

    const replacedItem = JSON.parse(JSON.stringify(baseQRItem).replace(/{{INSURANCE_PLAN_REF}}/g, insurancePlanRef));

    console.log('replaced item', JSON.stringify(replacedItem, null, 2));

    quesionnaireResponse.item = replacedItem;
    quesionnaireResponse.status = 'completed';

    const updatedQuestionnaireResponse = await oystehrClient.fhir.update<QuestionnaireResponse>(quesionnaireResponse);
    expect(updatedQuestionnaireResponse).toBeDefined();
    // give the updates a chance to propagate
    await sleep(2000);
  });

  afterAll(async () => {
    // Clean up environment
    console.log('Cleaning up environment...');
    // Add your cleanup code here
    if (!token) {
      throw new Error('Failed to fetch auth token.');
    }
    const oystehrClient = createOystehrClient(token, envConfig);
    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'subject',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle()[0];
    expect(createdAccount).toBeDefined();
    assert(createdAccount.id);
    await oystehrClient.fhir.delete({ resourceType: 'Account', id: createdAccount.id });
  });

  it('should perform a sample test', async () => {
    // Add your test code here
    expect(true).toBe(true);
  });
});
