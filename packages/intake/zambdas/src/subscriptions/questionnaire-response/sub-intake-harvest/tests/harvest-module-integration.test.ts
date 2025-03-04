import { describe, it, expect, assert } from 'vitest';
import * as fs from 'fs';
import { getAuth0Token } from '../../../../shared';
import { createOystehrClient } from '../../../../shared/helpers';
import baseQRItem from './data/integration-base-qr-1.json';
import { expectedCoverageResources as qr1ExpectedCoverageResources } from './data/expected-coverage-resources-qr1';
import { Account, Coverage, InsurancePlan, Organization, QuestionnaireResponse } from 'fhir/r4b';
import { sleep } from 'utils';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { performEffect } from '..';
import { fillReferences } from './helpers';

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
  let oystehrClient: Oystehr;
  let BASE_QR: QuestionnaireResponse;

  const normalizedCompare = (rawTemplate: any, rawExpectation: any): any => {
    const [key, val] = Object.entries(INSURANCE_PLAN_ORG_MAP)[0];
    const refs = [`InsurancePlan/${key}`, `Organization/${val}`, `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`];
    const template = fillReferences(rawTemplate, refs);
    expect(template).toEqual({
      ...rawExpectation,
      id: undefined,
      meta: undefined,
    });
  };
  beforeAll(async () => {
    // Set up environment
    console.log('Setting up environment...');
    // Add your setup code here
    expect(process.env).toBeDefined();
    expect(envConfig).toBeDefined();

    if (!token) {
      token = await getAuth0Token(envConfig);
    }

    oystehrClient = createOystehrClient(token, envConfig);
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

    const iPs = ipAndOrg1.filter((ip) => ip.resourceType === 'InsurancePlan') as InsurancePlan[];
    const orgs = ipAndOrg1.filter((org) => org.resourceType === 'Organization') as Organization[];
    expect(iPs.length).toBeGreaterThan(0);
    expect(orgs.length).toBeGreaterThan(0);
    iPs.forEach((ip: InsurancePlan) => {
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

    const [key, val] = firstPair;

    const refs = [`InsurancePlan/${key}`, `Organization/${val}`];

    const replacedItem = fillReferences(baseQRItem, refs);

    quesionnaireResponse.item = replacedItem;
    quesionnaireResponse.status = 'completed';

    BASE_QR = quesionnaireResponse;
    expect(BASE_QR).toBeDefined();
  });

  beforeEach(async () => {
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
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    const patientCoverages = (
      await oystehrClient.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    const deletes: BatchInputDeleteRequest[] = patientCoverages.map((cov) => {
      return {
        method: 'DELETE',
        url: `Coverage/${cov.id}`,
      };
    });
    if (createdAccount[0]?.id) {
      deletes.push({
        method: 'DELETE',
        url: `Account/${createdAccount[0].id}`,
      });
    }
    await oystehrClient.fhir.transaction({ requests: deletes });
  });

  it('should perform a sample test', async () => {
    // Add your test code here
    expect(true).toBe(true);
    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    expect(createdAccount.length).toBe(0);
  });
  it('should create an account with two associated coverages from the base sample QR', async () => {
    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    // give the updates a chance to propagate
    await sleep(500);

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
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
    const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
    const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
    expect(primaryCoverageRef).toBeDefined();
    expect(secondaryCoverageRef).toBeDefined();
    assert(primaryCoverageRef);
    assert(secondaryCoverageRef);

    const createdCoverages = (
      await oystehrClient.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    expect(createdCoverages).toBeDefined();
    expect(createdCoverages.length).toBeGreaterThanOrEqual(2);
    const primaryCoverage = createdCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = createdCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });
    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    // both coverages should have contained RP as the subscriber
    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });

  it('should update existing coverages to live on the new Account when the inputs match', async () => {
    // write some existing coverages and RPs

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    // give the updates a chance to propagate

    const createdAccount = (
      await oystehrClient.fhir.search<Account>({
        resourceType: 'Account',
        params: [
          {
            name: 'patient',
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
    const primaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
    const secondaryCoverageRef = createdAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
    expect(primaryCoverageRef).toBeDefined();
    expect(secondaryCoverageRef).toBeDefined();
    assert(primaryCoverageRef);
    assert(secondaryCoverageRef);

    /*
    const createdCoverages = (
      await oystehrClient.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [
          {
            name: 'patient',
            value: `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    expect(createdCoverages).toBeDefined();
    expect(createdCoverages.length).toBeGreaterThanOrEqual(2);
    const primaryCoverage = createdCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = createdCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });
    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    // both coverages should have contained RP as the subscriber
    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
    */
  });
});
