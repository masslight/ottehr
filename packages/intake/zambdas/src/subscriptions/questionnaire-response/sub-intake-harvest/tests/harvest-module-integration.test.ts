import { describe, it, expect, assert } from 'vitest';
import * as fs from 'fs';
import { getAuth0Token } from '../../../../shared';
import { createOystehrClient } from '../../../../shared/helpers';
import baseQRItem from './data/integration-base-qr-1.json';
import {
  expectedCoverageResources as qr1ExpectedCoverageResources,
  expectedPrimaryPolicyHolderFromQR1,
  expectedSecondaryPolicyHolderFromQR1,
} from './data/expected-coverage-resources-qr1';
import {
  Account,
  Coverage,
  InsurancePlan,
  Organization,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { COVERAGE_MEMBER_IDENTIFIER_BASE, sleep, unbundleBatchPostOutput } from 'utils';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { performEffect } from '..';
import { batchTestInsuranceWrites, fillReferences } from './helpers';
import { relatedPersonsAreSame } from '../helpers';

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

  const stripIdAndMeta = <T extends Resource>(resource: T): T => {
    return {
      ...resource,
      id: undefined,
      meta: undefined,
    };
  };

  const getQR1Refs = (): string[] => {
    const [key, val] = Object.entries(INSURANCE_PLAN_ORG_MAP)[0];
    const refs = [`InsurancePlan/${key}`, `Organization/${val}`, `Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`];
    return refs;
  };

  const fillWithQR1Refs = (template: any): any => {
    const refs = getQR1Refs();
    return fillReferences(template, refs);
  };

  const normalizedCompare = (rawTemplate: any, rawExpectation: any): any => {
    const template = fillWithQR1Refs(rawTemplate);
    expect(template).toEqual(stripIdAndMeta(rawExpectation));
  };

  interface ValidatedAccountData {
    account: Account;
    primaryCoverageRef: string;
    secondaryCoverageRef: string;
  }
  const validatePostEffectAccount = async (idToCheck?: string): Promise<ValidatedAccountData> =>{
    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    const foundAccounts = (
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
    expect(foundAccounts).toBeDefined();
    expect(foundAccounts.length).toBe(1);
    const foundAccount = foundAccounts[0];
    expect(foundAccount).toBeDefined();
    assert(foundAccount.id);
    if (idToCheck) {
      expect(foundAccount.id).toBe(idToCheck);
    }
    expect(foundAccount.coverage).toBeDefined();
    expect(foundAccount.coverage?.length).toBe(2);
    const primaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
    const secondaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
    expect(primaryCoverageRef).toBeDefined();
    expect(secondaryCoverageRef).toBeDefined();
    assert(primaryCoverageRef);
    assert(secondaryCoverageRef);

    return {
      account: foundAccount,
      primaryCoverageRef,
      secondaryCoverageRef
    };
  }

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
      await oystehrClient.fhir.search<Coverage | RelatedPerson>({
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
          {
            name: '_include',
            value: 'Coverage:subscriber:RelatedPerson',
          },
        ],
      })
    ).unbundle();
    const deletes: BatchInputDeleteRequest[] = patientCoverages.map((res) => {
      if ((res as any).resourceType === 'Patient') {
        throw new Error('Patient should not be included in the search results');
      }
      return {
        method: 'DELETE',
        url: `${res.resourceType}/${res.id}`,
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
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(4);

    const writtenPrimaryCoverage = writtenResources.find(
      (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId
    ) as Coverage;
    const writtenSecondaryCoverage = writtenResources.find(
      (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId
    ) as Coverage;
    const writtenPrimarySubscriber = writtenResources.find(
      (res) => `RelatedPerson/${res.id}` === writtenPrimaryCoverage?.subscriber?.reference
    ) as RelatedPerson;
    const writtenSecondarySubscriber = writtenResources.find(
      (res) => `RelatedPerson/${res.id}` === writtenSecondaryCoverage?.subscriber?.reference
    ) as RelatedPerson;

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

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
    expect(createdCoverages.length).toBe(2);
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

    // both coverages should have the existing persisted RP as the subscriber
    expect(primaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenPrimarySubscriber.id}`);
    expect(secondaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenSecondarySubscriber.id}`);

    expect(writtenPrimaryCoverage).toEqual(primaryCoverage);
    expect(writtenSecondaryCoverage).toEqual(secondaryCoverage);
  });

  it('should update existing primary coverage to live on the new Account when the inputs match, but should create a new one for secondary if no match found', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(4);

    const writtenPrimaryCoverage = writtenResources.find(
      (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId
    ) as Coverage;
    const writtenSecondaryCoverage = writtenResources.find(
      (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId
    ) as Coverage;
    const writtenPrimarySubscriber = writtenResources.find(
      (res) => `RelatedPerson/${res.id}` === writtenPrimaryCoverage?.subscriber?.reference
    ) as RelatedPerson;
    const writtenSecondarySubscriber = writtenResources.find(
      (res) => `RelatedPerson/${res.id}` === writtenSecondaryCoverage?.subscriber?.reference
    ) as RelatedPerson;

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

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

    const allCoverages = (
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
    expect(allCoverages).toBeDefined();
    expect(allCoverages.length).toBe(3);
    const primaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });
    const extraCoverageJustHangingOutInFhir = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef !== secondaryCoverageRef && coverageRef !== primaryCoverageRef;
    });
    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(extraCoverageJustHangingOutInFhir).toBeDefined();
    expect(extraCoverageJustHangingOutInFhir?.status).toBe('active');
    expect(extraCoverageJustHangingOutInFhir?.subscriber?.reference).toEqual(
      `RelatedPerson/${writtenSecondarySubscriber.id}`
    );

    expect(primaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenPrimarySubscriber.id}`);
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    expect(writtenPrimaryCoverage).toEqual(primaryCoverage);
    const { secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(secondary, secondaryCoverage);

    expect(relatedPersonsAreSame(writtenSecondarySubscriber, secondaryCoverage?.contained?.[0] as RelatedPerson)).toBe(
      true
    );
  });

  it('should update existing secondary coverage to live on the new Account when the inputs match, but should create a new one for primary is no match found', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: true },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(4);

    const writtenPrimaryCoverage = writtenResources.find(
      (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage1.subscriberId
    ) as Coverage;
    const writtenSecondaryCoverage = writtenResources.find(
      (res) => res.resourceType === 'Coverage' && res.subscriberId === persistedCoverage2.subscriberId
    ) as Coverage;
    const writtenPrimarySubscriber = writtenResources.find(
      (res) => `RelatedPerson/${res.id}` === writtenPrimaryCoverage?.subscriber?.reference
    ) as RelatedPerson;
    const writtenSecondarySubscriber = writtenResources.find(
      (res) => `RelatedPerson/${res.id}` === writtenSecondaryCoverage?.subscriber?.reference
    ) as RelatedPerson;

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

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

    const allCoverages = (
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
    expect(allCoverages).toBeDefined();
    expect(allCoverages.length).toBe(3);
    const primaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });

    const extraCoverageJustHangingOutInFhir = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef !== secondaryCoverageRef && coverageRef !== primaryCoverageRef;
    });
    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(extraCoverageJustHangingOutInFhir).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(extraCoverageJustHangingOutInFhir?.status).toBe('active');
    expect(extraCoverageJustHangingOutInFhir?.subscriber?.reference).toEqual(
      `RelatedPerson/${writtenPrimarySubscriber.id}`
    );

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual(`RelatedPerson/${writtenSecondarySubscriber.id}`);

    expect(writtenSecondaryCoverage).toEqual(secondaryCoverage);
    const { primary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);

    expect(relatedPersonsAreSame(writtenPrimarySubscriber, primaryCoverage?.contained?.[0] as RelatedPerson)).toBe(
      true
    );
  });

  it('should create two new coverages when neither matches existing coverages', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedRP2 = fillReferences(expectedSecondaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences(qr1ExpectedCoverageResources.primary, getQR1Refs());
    const persistedCoverage2 = fillReferences(qr1ExpectedCoverageResources.secondary, getQR1Refs());

    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: false },
      secondary: { subscriber: persistedRP2, coverage: persistedCoverage2, ensureOrder: false },
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(4);

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');

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

    const allCoverages = (
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
    expect(allCoverages).toBeDefined();
    expect(allCoverages.length).toBe(4);
    const primaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });

    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });

  it('existing Account with no coverages should be updated with newly written coverages', async () => {
    const stubAccount: Account = {
      resourceType: 'Account',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/account-type',
            code: 'PBILLACCT',
            display: 'patient billing account',
          },
        ],
      },
      status: 'active',
      subject: [{ reference: `{{PATIENT_REF}}` }],
      description: 'Patient account',
    };
    const batchRequests = batchTestInsuranceWrites({ account: fillWithQR1Refs(stubAccount) });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(1);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

    const effect = await performEffect({ qr: BASE_QR, secrets: envConfig }, oystehrClient);
    expect(effect).toBe('all tasks executed successfully');
    const foundAccounts = (
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
    expect(foundAccounts).toBeDefined();
    expect(foundAccounts.length).toBe(1);
    const foundAccount = foundAccounts[0];
    expect(foundAccount).toBeDefined();
    assert(foundAccount.id);
    expect(foundAccount.id).toEqual(writtenAccount.id);
    expect(foundAccount.coverage).toBeDefined();
    expect(foundAccount.coverage?.length).toBe(2);
    const primaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 1)?.coverage?.reference;
    const secondaryCoverageRef = foundAccount.coverage?.find((cov) => cov.priority === 2)?.coverage?.reference;
    expect(primaryCoverageRef).toBeDefined();
    expect(secondaryCoverageRef).toBeDefined();
    assert(primaryCoverageRef);
    assert(secondaryCoverageRef);

    const allCoverages = (
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
    expect(allCoverages).toBeDefined();
    expect(allCoverages.length).toBe(2);
    const primaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });

    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });

  it('should update an existing Account to remove replace old coverage, which should be updated to "cancelled', async () => {
    const persistedRP1 = fillReferences(expectedPrimaryPolicyHolderFromQR1, getQR1Refs());
    const persistedCoverage1 = fillReferences({
      ...qr1ExpectedCoverageResources.primary,
      identifier: [
        {
          ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
          value: 'SAme_orgDifferEntId',
          assigner: {
            reference: '{{ORGANIZATION_REF}}',
            display: 'Aetna',
          },
        },
      ],
      subscriberId: 'SAme_orgDifferEntId',
    }, getQR1Refs());

    const stubAccount: Account = {
      resourceType: 'Account',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/account-type',
            code: 'PBILLACCT',
            display: 'patient billing account',
          },
        ],
      },
      status: 'active',
      subject: [{ reference: `{{PATIENT_REF}}` }],
      description: 'Patient account',
    };
    const batchRequests = batchTestInsuranceWrites({
      primary: { subscriber: persistedRP1, coverage: persistedCoverage1, ensureOrder: true },
      account: stubAccount,
    });

    const transactionRequests = await oystehrClient.fhir.transaction({ requests: batchRequests });
    expect(transactionRequests).toBeDefined();
    const writtenResources = unbundleBatchPostOutput<Account | RelatedPerson | Coverage | Patient>(transactionRequests);
    expect(writtenResources.length).toBe(1);
    const writtenAccount = writtenResources.find((res) => res.resourceType === 'Account') as Account;

   const { primaryCoverageRef, secondaryCoverageRef } = await validatePostEffectAccount(writtenAccount.id);
    const allCoverages = (
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
    expect(allCoverages).toBeDefined();
    expect(allCoverages.length).toBe(2);
    const primaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === primaryCoverageRef;
    });
    const secondaryCoverage = allCoverages.find((coverage) => {
      const coverageRef = `Coverage/${coverage.id}`;
      return coverageRef === secondaryCoverageRef;
    });

    expect(primaryCoverage).toBeDefined();
    expect(secondaryCoverage).toBeDefined();
    expect(primaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);
    expect(secondaryCoverage?.beneficiary?.reference).toEqual(`Patient/${TEST_CONFIG[TEST_PATIENT_ID_KEY]}`);

    expect(primaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');
    expect(secondaryCoverage?.subscriber?.reference).toEqual('#coverageSubscriber');

    const { primary, secondary } = qr1ExpectedCoverageResources;
    normalizedCompare(primary, primaryCoverage);
    normalizedCompare(secondary, secondaryCoverage);
  });
});
